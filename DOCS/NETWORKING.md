# EnZIME Networking

EnZIME Reader is **offline-first** per INV-OFFLINE (see
`DOCS/ARCHITECTURE.md` §1). Networking exists only as additive
opt-in paths; nothing in the codebase is premised on online
connectivity. This document records the online endpoints when
they *are* reachable, and where the routing comes from.

## Subdomain

`enzime.robin.mba` — operator-owned subdomain on `robin.mba`,
served by nginx-ui at CT 123 / `192.168.0.126`.

| Wildcard cert | `/etc/nginx/ssl/*.robin.mba_robin.mba_P256/` (one level only — covers `enzime.robin.mba` directly) |
| nginx vhost | `/etc/nginx/sites-available/enzime.robin.mba.conf` (CT 123) |
| Reverse-proxy convention | [`~/forgejo/admin/DOCS/CICD_CONVENTIONS/nginx-ui-vhost-conventions.md`](../../admin/DOCS/CICD_CONVENTIONS/nginx-ui-vhost-conventions.md) (CC6) |

The cert is wildcard-on-`*.robin.mba` (one level). Multi-service
sub-subdomains (`mirror.enzime.robin.mba`) are NOT covered. Per
CC6, EnZIME uses **path-based routing** under one subdomain.

## Routes

All under `https://enzime.robin.mba/`:

| Route | Used by | Backend status |
|---|---|---|
| `/` | landing / docs | 200 placeholder |
| `/mirror/*` | `MirrorFetcher` (E-MOD-11) for model-weight `.litertlm` manifests + blobs | **503 placeholder** — backend not yet deployed |
| `/update/*` | `AppUpdater` (E-UPD-1) for release-channel update manifests | **503 placeholder** — backend not yet deployed |
| `/catalog/*` | `PackCatalog` (E-PACK-1) for ZIM-pack catalog manifests | **503 placeholder** — backend not yet deployed |

**Compile-time defaults** (in code; overridable via build-time env):

```
ENZIME_MIRROR_URL       = https://enzime.robin.mba/mirror
ENZIME_UPDATE_URL       = https://enzime.robin.mba/update
ENZIME_PACK_CATALOG_URL = https://enzime.robin.mba/catalog/v1/catalog.json
```

These are `option_env!()` reads at compile time, not runtime env vars.
Override at build time only if pointing to a staging host.

## INV-OFFLINE compliance for these routes

When any of `/mirror`, `/update`, or `/catalog` returns non-2xx, times
out, or is DNS-unresolvable, the calling Rust code MUST fall back to
local state:

| Caller | Failure-mode fallback |
|---|---|
| `MirrorFetcher` (E-MOD-11) | If weights already on disk: continue. Otherwise: surface "Install from media" UX, do not crash. |
| `AppUpdater` (E-UPD-1) | Silent no-op — never surface error to user (Decision 22 + the sharpened INV-OFFLINE). |
| `PackCatalog` (E-PACK-1) | Fall back to bundled-catalog + local-catalog-file paths (see architect-debt B3/B4 in audit findings — to land before W4 dispatches). |

## Backend-deployment lineage

The 503 placeholders exist so:
1. Client code can resolve URL constants to real DNS+TLS now (no
   "connection refused"; the route exists, just returns 503).
2. The transition to real backends is purely operator-side
   (deploy a backend at `192.168.0.X:Y`, update the nginx vhost's
   `location` block from `return 503` to `proxy_pass`, reload).
3. Clients written against the URL constants will work without
   recompilation when backends land.

Deployment-time vhost mutation pattern (when each backend is ready):

```nginx
location /mirror/ {
    proxy_pass http://<mirror-backend-ip>:<port>/;
    include /etc/nginx/snippets/proxy-params.conf;
}
```

## LAN smoke-test (without DNS)

```bash
curl -sk -H 'Host: enzime.robin.mba' https://192.168.0.126/         # 200
curl -sk -H 'Host: enzime.robin.mba' https://192.168.0.126/mirror/  # 503
curl -sk -H 'Host: enzime.robin.mba' https://192.168.0.126/update/  # 503
curl -sk -H 'Host: enzime.robin.mba' https://192.168.0.126/catalog/ # 503
```

## Dev / preview ports (I-16 — high, non-patterned)

| Port | Surface | Notes |
|---|---|---|
| `38417` | Vite dev server + Tauri `devUrl` | Baked into `vite.config.ts` `server.port` and `tauri.conf.json` `build.devUrl` (E-BLD-45). |
| `41739` | `DOCS/EnZIME-Synthesis-Pitch.html` preview | Optional only — the pitch is a single self-contained file that opens directly via `file://` (double-click), no server needed. For a localhost preview: `python3 -m http.server 41739 -d DOCS/`. Preview only, not a runtime dependency. |
| `47921` | `EntitlementSyncBridge` bind address | Bridge binds `0.0.0.0:47921` for webhook intake (E-ENT-18). Non-patterned high port per I-16. |

## DNS

External DNS for `enzime.robin.mba` → operator's WAN-facing IP or
LAN IP. (Registrar-managed; not tracked here.)

## Anti-patterns

- ❌ Treating any of `/mirror`, `/update`, `/catalog` as required —
  they are best-effort additive paths only.
- ❌ Adding new project subdomains as `<service>.enzime.robin.mba`
  (wildcard cert doesn't reach two levels deep). Use path-based
  routing under `enzime.robin.mba`.
- ❌ Re-deriving the nginx-ui topology from scratch each session —
  the global convention is at CC6 (see link above).
