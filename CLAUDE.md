# Sidecar repo

**Purpose:** conventions for working in the sidecar: the Nuxt app, its CLI, the Electron shell and the Claude Code mod that ship as one plugin.
**Loads:** when you touch any file under `projects/Cela/sidecar`.
**Never put here:** global behaviour goes to `~/.claude/CLAUDE.md` · code and TS style go to `~/.claude/rules/code-style.md` · the modes system goes to the mode plugin's own repo · the Cela product domain goes to `projects/Cela/CLAUDE.md`.

GitHub `cela-sage/sidecar`.

---

## Naming · fires: on every user-facing string and new code

The product, its CLI and its plugin are **the sidecar**, never "Mode". Mode is a separate plugin the sidecar only talks to through `mode forget` when a conversation is removed.

## The two surfaces · fires: when the sidecar's desktop-versus-web behaviour matters

A Web artifact renders one of two ways, and which one is the surface chosen in `sidecar setup`, stored in `~/.claude/sidecar/config.json` as `{ surface: "desktop" | "web" }`:

- **desktop** is the Electron shell in `desktop/`, where a Web artifact is a real top-level Chromium page signed in with imported Chrome cookies, heavier because it is a separate Chromium but with no framing refusals.
- **web** is a tab in Chrome against the sidecar, where a Web artifact is framed through the rewriting proxy, light but broken on framing-hostile sites.

The running app knows which it is through `window.sidecarShell`, injected by the desktop shell's preload and absent in a plain browser. The user agent cannot be used, because the shell strips its Electron token on purpose so framed pages see plain Chrome.

## The mod · fires: when touching `hooks/`, `types/` or `rules/sidecar.md`

`hooks/` is the Claude Code mod, one hooks module in `hooks/register.tsx`, and the repo root is the plugin, so `$.plugin.root` is the checkout and `bin/sidecar` is found from it. A change there is live in the next session, and `pnpm test:mod` validates and tests it.
