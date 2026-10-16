---
name: Bug report
about: Report something that is broken or incorrect in ORCA
title: "fix: <short description>"
labels: bug
assignees: ""
---

## Describe the bug

<!-- A clear, concise description of what the bug is. -->

## Steps to reproduce

1. Go to ...
2. Select language ...
3. Type / say ...
4. See error / wrong output

## Expected behaviour

<!-- What you expected to happen. -->

## Actual behaviour

<!-- What actually happened. Paste any error messages or wrong answers verbatim. -->

## Environment

| Field | Value |
|-------|-------|
| ORCA version | <!-- e.g. v2.0.0 — check `/api/health` `version` field --> |
| Browser / OS | <!-- e.g. Chrome 126 / Windows 11 --> |
| Language selected | <!-- e.g. Malayalam (ml-IN) --> |
| Network mode | <!-- Live (keys set) or Reference (keyless / offline) --> |

## Console / server logs

```
<!-- Paste relevant browser console or server terminal output here -->
```

## Additional context

<!-- Screenshots, recordings, or any other context that helps explain the problem. -->

## Non-negotiable invariant affected (if known)

- [ ] Test suite (`npm test` — 3318 checks)
- [ ] Language completeness (11 languages)
- [ ] Keyless / offline contract
- [ ] Verbatim product tokens / severity codes
- [ ] Not sure
