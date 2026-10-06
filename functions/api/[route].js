// Costanza Showdown game API, backed by Cloudflare D1 (strongly consistent,
// so buzz order is fair). One table: kv(k TEXT PRIMARY KEY, v TEXT).
// The host owns the "game" key; players write only their own per-round
// buzz:<round>:<player> and ans:<round>:<player> keys (first write wins).

const PLAYERS = ["vj", "ava"];
const json = (data, status) => new Response(JSON.stringify(data), {
  status: status || 200,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const DEFAULTG = { ts: 0, round: 0, mode: "idle", phase: "closed", scores: { vj: 0, ava: 0 }, locked: [], q: null, winner: null, correctText: null, award: 100, msg: "" };

async function ensureTable(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)").run();
}

async function getKV(db, k) {
  const r = await db.prepare("SELECT v FROM kv WHERE k = ?").bind(k).first();
  return r ? r.v : null;
}

export async function onRequest({ request, env, params }) {
  const db = env.DB;
  const route = params.route;
  await ensureTable(db);

  if (route === "game") {
    if (request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { body = null; }
      if (!body || typeof body !== "object") return json({ error: "bad state" }, 400);
      const raw = JSON.stringify(body);
      if (raw.length > 32000) return json({ error: "too large" }, 400);
      await db.prepare("INSERT INTO kv (k, v) VALUES ('game', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(raw).run();
      return json({ ok: true });
    }
    const v = await getKV(db, "game");
    return json(v ? JSON.parse(v) : DEFAULTG);
  }

  if (route === "buzz" || route === "answer") {
    let body;
    try { body = await request.json(); } catch { body = null; }
    if (!body || !PLAYERS.includes(body.player) || !Number.isInteger(body.round) || body.round < 0 || body.round > 1000000)
      return json({ error: "bad request" }, 400);
    const ts = Date.now();
    if (route === "buzz") {
      const k = `buzz:${body.round}:${body.player}`;
      await db.prepare("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO NOTHING").bind(k, String(ts)).run();
      return json({ ts: Number(await getKV(db, k)) });
    } else {
      if (!Number.isInteger(body.choice) || body.choice < 0 || body.choice > 7) return json({ error: "bad choice" }, 400);
      const k = `ans:${body.round}:${body.player}`;
      await db.prepare("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO NOTHING").bind(k, JSON.stringify({ c: body.choice, ts })).run();
      return json(JSON.parse(await getKV(db, k)));
    }
  }

  if (route === "status") {
    const round = Number(new URL(request.url).searchParams.get("round")) || 0;
    const out = { buzz: {}, ans: {} };
    const { results } = await db.prepare("SELECT k, v FROM kv WHERE k IN (?, ?, ?, ?)")
      .bind(`buzz:${round}:vj`, `buzz:${round}:ava`, `ans:${round}:vj`, `ans:${round}:ava`).all();
    for (const row of results || []) {
      const [kind, , player] = row.k.split(":");
      if (kind === "buzz") out.buzz[player] = Number(row.v);
      else out.ans[player] = JSON.parse(row.v);
    }
    return json(out);
  }

  if (route === "reset") {
    await db.prepare("DELETE FROM kv").run();
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}
