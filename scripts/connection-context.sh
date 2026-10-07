#!/usr/bin/env bash
set -euo pipefail

plugin_root="$(cd "$(dirname "$0")/.." && pwd)"
cat <<EOF
For requests through Inngest Cloud MCP, use this plugin's server. If its tools are missing,
search the host's deferred tools first. If disconnected or unauthenticated,
read "$plugin_root/commands/connect.md" and carry out recovery before resuming
the request. Use these concrete commands from this installed copy:
  bash "$plugin_root/scripts/connect.sh" status
  bash "$plugin_root/scripts/connect.sh" login
The helper loads this exact plugin with --plugin-dir
for OAuth without installing or configuring another server. Never add a manual
MCP, custom connector, proxy, or second plugin install to bypass this plugin;
never substitute CLI/REST calls for its MCP. Keep the task pending through
browser consent and verify actual plugin tool calls before claiming success.
EOF
