# EnZIME Creator — frontend

Bootstrap stub. Vite + React + TypeScript scaffold is intentionally
deferred to the Creator app's dedicated architect session.

See `../CHECKLIST.md` Phase Creator-1+ rows and `../ARCHITECTURE.md`
for the pending architectural-pass agenda.

Stack target (matches reader for suite consistency):
- Vite + React 19 + TypeScript
- Zustand for state
- Theme imported from / shared-with the reader's `theme.ts` when both
  apps are real (currently each app maintains its own theme; promotion
  to a `crates/enzime-shared-ui/` or sibling `frontend-shared/` is on
  the architect-session agenda).

To scaffold (when the architect session reaches that row):

```bash
pnpm --dir "$REPO/creator/frontend" create vite@latest . --template react-ts
```

(Following the cwd-agnostic command style established in the reader's
`README.md`.)
