## Summary

<!-- What does this PR do? Why is the change needed? -->

## Type of change

- [ ] `feat` — New capability or agent
- [ ] `fix` — Bug fix
- [ ] `perf` — Performance improvement
- [ ] `docs` — Documentation only
- [ ] `test` — Test additions or fixes
- [ ] `refactor` — Code restructure without behaviour change
- [ ] `chore` — Build, CI, config changes

## Related issue / TODO item

<!-- Link to a GitHub issue or a TODO.md item (e.g. TODO 3.2) -->

## Changes made

<!-- Bullet list of the specific files/functions changed and why -->

## How to test

<!-- Steps to verify this PR works as expected -->

## Checklist

- [ ] `npm test` passes — **3318/3318** checks green
- [ ] `npm run lint` passes — zero TypeScript errors
- [ ] Every new user-facing string added to `src/core/i18n.ts` for **all 11 languages**
- [ ] No API keys or secrets committed
- [ ] No `console.log` debug statements in production paths
- [ ] The engine remains **keyless and deterministic** — no live-only code paths without a reference fallback
- [ ] Related `TODO.md` item updated (mark Done with short explanation) if applicable
- [ ] Screenshots / recordings attached for any UI change
