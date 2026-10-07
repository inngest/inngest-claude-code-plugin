#!/usr/bin/env bash
set -euo pipefail

scenario="${1:-clean}"
case "$scenario" in
  clean|legacy-user|legacy-project|legacy-local|legacy-alias) ;;
  *) echo "Usage: $0 [clean|legacy-user|legacy-project|legacy-local|legacy-alias]" >&2; exit 2 ;;
esac

command -v claude >/dev/null || { echo 'Install Claude Code first.' >&2; exit 1; }
plugin_root="$(cd "$(dirname "$0")/.." && pwd)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/inngest-claude-test.XXXXXX")"
chmod 700 "$test_root"
mkdir -p "$test_root/config" "$test_root/project"

cat > "$test_root/claude" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
test_root="$(cd "$(dirname "$0")" && pwd)"
export CLAUDE_CONFIG_DIR="$test_root/config"
export ENABLE_CLAUDEAI_MCP_SERVERS=false
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN ANTHROPIC_PROFILE
unset ANTHROPIC_BASE_URL CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX CLAUDE_CODE_USE_FOUNDRY
cd "$test_root/project"
exec claude "$@"
WRAPPER
chmod 700 "$test_root/claude"

printf 'Isolated test folder: %s\n' "$test_root"
case "$scenario" in
  legacy-user|legacy-project|legacy-local)
    "$test_root/claude" mcp add --scope "${scenario#legacy-}" --transport http inngest-cloud https://api.inngest.com/mcp
    ;;
  legacy-alias)
    "$test_root/claude" mcp add --scope user --transport http old-inngest https://api.inngest.com/mcp
    ;;
esac

"$test_root/claude" plugin marketplace add "$plugin_root"
"$test_root/claude" plugin install inngest@inngest-claude-code-plugin --scope user
"$test_root/claude" plugin list
cat <<EOF

Scenario: $scenario
Start this isolated CLI (sign in with a Claude subscription test account):
  $test_root/claude

Then run /inngest:connect and complete Inngest OAuth through /mcp.
Ask it to call fetch_account and list_envs through MCP, without CLI fallback.
Repeat in a fresh session to test persisted authentication.

Only this folder holds the test's local settings and history. Account-synced
plugins and organization policies can still apply after login; use a separate
Claude test account for a clean directory-install test. This fixture tests the
local marketplace package, not directory distribution or Claude Desktop.
No OAuth test has run yet.
EOF
