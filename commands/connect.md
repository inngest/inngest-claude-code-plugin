---
description: Check the Inngest Cloud connection and resolve setup issues without resetting Claude
---

# Check the Inngest connection

Help the user connect to `https://api.inngest.com/mcp`. Start with diagnosis;
do not remove installations, credentials, or configuration automatically.

1. Identify the host: Claude Code CLI, Desktop Code tab, or chat/Cowork. Check
   the active Claude account/workspace and plugin version when available.
2. Inspect the available Inngest MCP connections. In Claude Code, use
   `claude plugin list` and `claude mcp list` from the user's project, then
   direct the user to `/mcp` for connection details and OAuth sign-in.
   In chat/Cowork, use the host's connector settings. Do not suggest terminal
   commands when the host cannot run them.
3. Check for a prior manually configured connection or another Inngest plugin
   install. Claude Code gives local, project, and user MCP entries precedence
   over plugin servers with the same endpoint, even under different names.
   A local plugin install can also shadow an account-synced plugin. Report
   the observed source and status; do not assume duplicates caused the error.
4. Reuse a working connection to the intended Inngest account. If the winning
   connection needs authentication, sign in to that connection. Signing in to
   a hidden duplicate does not fix the active connection. The bundled server
   normally appears as `plugin:inngest:inngest-cloud`; use the actual name
   shown by the host rather than requiring that exact prefix.
5. If the user wants to replace an obsolete manual entry, first identify its
   exact name and scope and explain the proposed change. Prefer a reversible
   per-server disable through `/mcp`. For removal, request approval for only
   that entry; use `claude mcp remove --scope <scope> <name>` in Claude Code.
   Never delete `~/.claude`, `~/.claude.json`, Desktop app data, chat history,
   or the user's credential store. Do not read or print tokens, auth headers,
   credential files, or Keychain contents.
6. Start a fresh conversation after a connection or plugin change. Verify
   using the connected MCP's `fetch_account` and `list_envs` tools. Report the
   account and available environments. Do not use a CLI/API fallback to claim
   the MCP works; if tools are unavailable, report that the check is blocked.

For a `401`, reconnect the active connection. For a permission or scope error,
check its grants and the selected Inngest account. A disabled Connect control
in a managed Claude workspace may need an administrator; reinstalling does
not change that policy. Never switch to another account or to the local Dev
Server to get past an access error.

If unresolved, collect the host/version, plugin version and install source,
connection name/source/status, active workspace type, and the error with
secrets removed. Keep authorization URLs, raw logs, and tokens out of the
report. See `docs/connection-testing.md` for isolated reproduction steps.
