# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 2.0.x (current) | Yes |
| < 2.0 | No |

## Reporting a vulnerability

If you discover a security vulnerability in ORCA, **please do not open a public GitHub issue**.

Instead, report it privately by emailing the maintainer directly (see the GitHub profile of [@tarang-shah-18](https://github.com/tarang-shah-18)) or by using [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) if enabled on this repository.

Please include:

1. A clear description of the vulnerability
2. Steps to reproduce (proof-of-concept if possible)
3. The potential impact (data exposure, denial of service, etc.)
4. Your suggested fix or mitigation (optional but appreciated)

We aim to acknowledge reports within **72 hours** and provide a resolution timeline within **7 days**.

## Scope

### In scope

- Server-side API endpoints (`/api/*`)
- Rate-limiting bypass or denial-of-service vectors
- Information disclosure (stack traces, internal paths leaked in responses)
- Dependency vulnerabilities with a direct exploit path in ORCA
- Session handling (`src/server/session.ts`, `ORCA_SESSIONS_FILE`)

### Out of scope

- Vulnerabilities in upstream data sources (IMD, INCOIS, GDACS) — report those to the respective agencies
- Issues requiring a valid API key that ORCA does not ship with (keyless/offline invariant)
- Theoretical vulnerabilities with no realistic attack path against a deployed ORCA instance
- Issues in browsers or operating systems not caused by ORCA code

## Security design notes

ORCA is designed with the following security properties:

- **No secrets in source** — API keys are read from environment variables only; `.env` is in `.gitignore`
- **Rate limiting** — sliding-window per-IP throttle on `/api/chat` and `/api/chat/stream` (configurable via `ORCA_RATE_MAX` / `ORCA_RATE_WINDOW_MS`)
- **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`
- **No stack traces in responses** — all async routes wrapped in `asyncRoute`; errors return clean JSON 4xx/5xx
- **CORS scoped to `APP_URL`** — never a bare `*` in production
- **Unprivileged container** — Docker image runs as `USER node`
- **Keyless / offline invariant** — the engine never invents data; a dead network produces a labelled reference fallback, not fabricated readings

## Dependency updates

Run `npm audit` regularly. PRs that update dependencies to resolve high/critical CVEs are always welcome and will be fast-tracked for review.
