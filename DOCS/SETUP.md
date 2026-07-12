# EnZIME Suite — Clone-Time Setup

This document covers one-time setup steps required after cloning the EnZIME repository.

## Per-remote LFS disable (E-BLD-31)

The EnZIME repository uses Git LFS for large binary assets (model weights, voice files, ZIM fixtures). **Forgejo (`origin`) is the sole LFS host**. The GitHub mirror exists only for external tool integration and must never receive LFS blobs.

After cloning, configure the `github` remote with the LFS disable sentinel:

```bash
git config --local remote.github.lfsurl "DISABLED-LFS-DO-NOT-PUSH-BLOBS"
```

This serves two purposes:

1. **Prevents git-lfs from contacting GitHub** — The invalid `lfsurl` value causes `git-lfs push` to fail fast for the `github` remote.
2. **Belt-and-suspenders with pre-push hook** — The `scripts/hooks/pre-push` hook (E-BLD-13) also blocks LFS blobs from being pushed to GitHub, providing a second enforcement layer.

### Verification

Verify the sentinel is configured:

```bash
git config --local --get remote.github.lfsurl
# Output: DISABLED-LFS-DO-NOT-PUSH-BLOBS
```

### Installing the pre-push hook

Copy the pre-push hook to your local Git hooks directory:

```bash
cp scripts/hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

The hook will automatically block any push that attempts to send LFS blobs to the `github` remote.
