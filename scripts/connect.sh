#!/usr/bin/env bash
set -euo pipefail

action="${1:-status}"
case "$action" in
  status|login) ;;
  *) echo "Usage: $0 [status|login] [--no-browser]" >&2; exit 2 ;;
esac
if [[ $# -gt 1 && ( "$action" != login || "$2" != --no-browser || $# -gt 2 ) ]]; then
  echo "Usage: $0 [status|login] [--no-browser]" >&2
  exit 2
fi

command -v claude >/dev/null || { echo 'Claude Code CLI is not available in this host.' >&2; exit 1; }
plugin_root="$(cd "$(dirname "$0")/.." && pwd)"
server='plugin:inngest:inngest-cloud'
claude_args=("--plugin-dir=$plugin_root" mcp)

if [[ "$action" == status ]]; then
  exec claude "${claude_args[@]}" get "$server"
fi

if [[ ! -t 0 ]]; then
  echo 'Run this login in an interactive terminal/PTY; keep it open for browser consent.' >&2
  exit 2
fi

claude "${claude_args[@]}" get "$server" || {
  echo 'Resolve plugin discovery, policy, or duplicate configuration first. Do not add a manual MCP server.' >&2
  exit 1
}

login_args=(login "$server")
[[ "${2:-}" == --no-browser ]] && login_args+=(--no-browser)
exec claude "${claude_args[@]}" "${login_args[@]}"
