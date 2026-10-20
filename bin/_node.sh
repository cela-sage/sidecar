node=node
# A Claude Code started outside an nvm shell has no node on PATH, so fall back to the one sidecar setup recorded.
command -v node >/dev/null 2>&1 || IFS= read -r node 2>/dev/null < "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sidecar/node" || {
  echo "sidecar: node is not on PATH, and sidecar setup has not recorded one in ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sidecar/node" >&2
  exit 127
}
