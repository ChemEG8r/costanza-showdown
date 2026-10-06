# Costanza Showdown

Family game-show night for VJ and Ava. Everyone opens the same link: kids
pick their names and get a giant buzzer; Dad picks Host and gets the control
room — scoreboard with manual adjust, a 49-question deck built from the
overlap of both kids' space tests (planets, space vocab, sun & stars, Earth
motions, and moon-phase PICTURE questions), and two round types:

- **Buzzer rounds** — the host reads a question aloud (the deck's "I'll read
  it" view shows him the answer, or read from paper), opens the buzzers, and
  phones race. Buzz order is stamped server-side; the host sees who won and
  by how much, awards points, or locks out a wrong answer for a steal.
- **Push rounds** — "Send to phones" puts the question (with its moon
  drawing, options shuffled) on both kids' screens at once; first CORRECT
  answer wins, auto-judged with one-tap award.

Built on Cloudflare Pages Functions with **D1** (strongly consistent — that
is what makes buzz ordering fair). One kv table; the host writes the game
state key, players write only their own per-round buzz/ans keys where the
first write wins. Phones poll about once a second.

Deploy: `npx wrangler pages deploy . --project-name costanza-showdown --branch main`
(needs `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; D1 database
"showdown-db" bound as `DB`).
