# CLAUDE.md — Echo maintainer constitution

Read this file and `COMPONENTS.md` before changing Echo.

## Purpose

Echo is a language-production and automaticity tool. A learner expresses what
they mean, Echo helps produce correct target-language material, and repeated
listening, speaking, retrieval and review make that material automatic.

The user often does **not know the target language well enough to type or edit
it manually**. Therefore the UI should minimize required target-language typing.
Prefer intent, dictation, language switching and AI-assisted revision.

The core loop is:

**mean something → get/shape the target-language expression → hear it → say it
repeatedly → retrieve it later → use it naturally**

Features are useful only insofar as they strengthen that loop.

## Product principles

1. **One action, one implementation.** Repeated behavior belongs in
   `components.js`; screens configure components rather than cloning them.
2. **Voice first, typing available.** Learner-language inputs use the shared
   LearnerComposer: input + language switch + mic + submit.
3. **AI adjustment instead of forced manual editing.** Editable/generated
   learning content exposes the shared AIAdjuster. Feed the current content back
   to the model with the learner's instruction. Manual editing is an escape hatch.
4. **Local first.** Learning state and credentials stay on-device unless a
   feature explicitly requires a configured model/provider.
5. **URLs are navigation state.** Do not create another workspace/navigation
   state system. Preserve canonical routes, reload and back/forward behavior.
6. **Audio is practice, not decoration.** Preserve the shadowing/repetition
   model when changing presentation.
7. **Visual consistency is correctness.** A functionally correct feature that
   looks like a different application is unfinished.

## Visual language — Washi and seal

Echo already has a design system in `styles.css`. Reuse it.

- Background: warm washi texture, not generic white/gray application chrome.
- Typography: Shippori Mincho for expressive/display Japanese; Zen Kaku Gothic
  New for UI. Use the existing `--display` and `--ui` tokens.
- Accent: restrained vermilion seal (`--seal`), not arbitrary new colors.
- Surfaces/lines/text must use existing semantic tokens such as `--washi`,
  `--panel`, `--sumi`, `--ink-muted`, `--hairline`, `--rule`.
- Controls are quiet. Do not introduce generic Bootstrap/material/chat-app
  aesthetics, thick pill selectors, bright chat bubbles, gradients or arbitrary
  shadows unless the existing system already has the equivalent.
- Mobile is primary. Desktop should feel like the same object with more room.

### Before inventing a visual

Search `styles.css` and existing screens for the closest existing control or
surface. Reuse its component/class/tokens. If no equivalent exists, add the
smallest reusable primitive to the component/design system first.

Do not solve a local screen with one-off CSS if the concept exists elsewhere.

## Visual invariants

A change must not:
- introduce raw colors where a semantic token exists;
- introduce a new font family;
- create a second visual treatment for the same action;
- copy SVG/control markup already owned by a component;
- make a new screen look like a generic web app or messaging product;
- obscure the bottom learner composer;
- break dark/system themes;
- break narrow mobile layouts;
- depend on hover to expose a required action.

Sentence and Discussion are two modes of the same Practice experience. Their
mode switch must be a quiet Echo-native control, not a foreign segmented-control
visual. Discussion messages are learning material, not social-media chat:
alignment may distinguish speakers, but typography, paper surfaces, borders and
accent remain Echo's.

## Safe change workflow

Before editing:
1. Read this file and `COMPONENTS.md`.
2. Find the existing component that owns the action.
3. Find the existing visual primitive closest to the requested UI.
4. Identify route, offline, mobile, dark-mode and persistence consequences.

While editing:
1. Change the shared primitive before individual call sites.
2. Keep domain logic out of presentation components.
3. Never add save-on-blur or render-time persistence.
4. Await persistence before showing success.
5. Never force page reload/navigation from service-worker activation.
6. Keep provider/model behavior behind existing API/domain modules.

Before considering the change complete:
1. Run tests.
2. Add a regression test for the behavior being changed.
3. Check narrow mobile and desktop structure.
4. Check light, dark and system-theme token use.
5. Compare the new UI with adjacent existing Echo UI.
6. Verify back/forward/reload for route changes.
7. Verify offline cache entries when adding runtime modules.
8. Ask: **Did I introduce a new way to perform an action that Echo already had?**
   If yes, refactor it to the existing component.
9. Ask: **Could this screenshot plausibly be from a different app?** If yes,
   the visual work is not finished.

## Architecture map

- `components.js`: reusable UI behavior/components. One action lives here once.
- `COMPONENTS.md`: component contracts and usage rules.
- `styles.css`: design tokens and shared visual language.
- `app.js`: screen orchestration and legacy code being migrated toward components.
- `api.js`: model/provider-facing behavior.
- `core.js`: shared Japanese/domain logic synchronized from JP Core where noted.
- `actions.js`: explicit persistence mutations.
- `routes.js`: canonical URL/navigation model.
- `speech.js`: speech and repetition engines.
- `db.js`: IndexedDB.
- `sw.js`: offline cache/service worker. Never navigate/reload clients on update.
- `test/`: behavior/regression contracts.

## Migration rule

Legacy duplication exists. Do not use it as precedent. When touching a duplicated
area, move it toward the component library rather than adding another variant.
Migration should be incremental and behavior-preserving.

Do not perform a giant visual rewrite. Echo's established design is the source of
truth; consolidate around it.

## Agent handoff

Leave the repository easier for the next agent to understand than you found it.
For a new reusable interaction, update `COMPONENTS.md`. For a new architectural
constraint, update this file. Tests should encode important invariants rather than
leaving them only in prose.
