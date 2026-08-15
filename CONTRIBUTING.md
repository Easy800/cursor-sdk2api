# Contributing

## Test layers

1. Deterministic contract tests with the injected fake SDK (`tests/contract`, `tests/integration`).
2. Isolated Docker build.
3. Opt-in live smoke only (`scripts/live-smoke`). Never put real credentials in fixtures or CI.

## Rules

- Official `@cursor/sdk` only. Exact pin. No private H2, browser cookies, or copied gateway internals.
- Fail closed on empty turns, unknown tool IDs, identity mismatch, and usage uncertainty.
- Do not log secrets or raw tool payloads.
- Keep the default profile free of ambient Cursor tools.

## Checks

```bash
npm ci
npm run typecheck
npm test
npm run build
```
