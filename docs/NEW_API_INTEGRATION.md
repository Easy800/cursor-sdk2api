# new-api integration

Phase 4 of `docs/DELIVERY_PLAN.md` adds an optional external channel to `QuantumNous/new-api`. That work is out of scope for this v0.1 slice.

Until a standalone v0.1 image exists at an immutable digest:

- configure new-api / one-api / internal gateways as a generic Anthropic-compatible upstream
- Base URL: `http://<gateway-host>:8080`
- Key: the Cursor API key (BYOK) or the gateway access key (managed)
- model discovery: `GET /v1/models`
- account/health: `GET /v1/account` and `GET /health`

Do not embed `@cursor/sdk` or this Node process inside new-api. The gateway stays a sidecar.

No upstream PR URL exists yet. Do not invent one.
