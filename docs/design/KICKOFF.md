# Kickoff — paste this as the first message to the implementing agent

Attach `echo-design-handoff.zip` to the same message, or point at the folder once it is in the repo.

---

You are implementing a finished design for Echo, the Japanese shadowing PWA in this repository (`KakkoiDev/jp-echo`, vanilla JS, ES modules, IndexedDB, FSRS, no build step, no backend). The design is complete and measured; your job is to make the app match it, PR by PR, without redesigning.

**Start by unzipping `echo-design-handoff.zip` into `docs/design/` and committing it as the first PR** (`docs: design handoff, October edition`). The design then lives with the code, and every later PR can link the artboard it implements.

Then read, in this order, before touching `index.html`, `app.js` or `styles.css`:

1. `docs/design/README.md` — the reading order and the principles.
2. `docs/design/REDESIGN-HANDOFF.md` — the whole spec. Read *October refresh*, *The animation shipped and nobody saw it*, *Echo anywhere*, the screen→artboard table, *Decisions taken so you don't have to*, and *Suggested PR sequence*.
3. Open `docs/design/design/index.html` in a browser and walk the app. Every board is plain HTML with every value inline; when the spec and a board disagree, the board's measurement wins and you say so in the PR.

Rules of engagement:

- **One PR per step of the sequence in the spec.** Branch off `main`, conventional commit, PR body with a Summary and a screenshot of each changed screen beside its artboard. Run `npm test` and `npm run check` before pushing. Do not merge two steps in one PR.
- **The two data blockers come before any UI that depends on them** (JLPT kanji list; per-point grammar notes). Ship them as their own PRs.
- **Never invent a screen.** If the design is missing a state you need, say so in the PR and draw nothing; the designer will add it.
- **Never weaken a principle to make a PR smaller.** The Library is the sentence list; the study tool is a pushed screen; your own sentence comes first on every sheet; Echo is a prefill, not a mode; movement means audio is playing; copy about the microphone, reminders and backups stays exactly as honest as the spec writes it.
- **Motion:** replace the echo animation in `styles.css` with `docs/design/motion.css` whole, mark the playing-screen ripples `.live`, and select both `.arcs > .echo` and `.ripple.echo.live` in the loop's `onState`. Then do the acceptance test in the spec on a real phone.
- **Tokens:** `docs/design/tokens.css` is the palette; `theme-map.json` is how dark is derived. No new colours.
- **Report back** with the PR links in order, what you could not match and why, and anything in the design that contradicts the code you found — those are the designer's bugs to fix, not yours to paper over.

Begin with the docs PR, then `design-system`.
