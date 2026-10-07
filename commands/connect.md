---
description: Connect or recover the Inngest plugin MCP, complete OAuth, and verify live tools without adding manual servers
---

# Connect Inngest

Recover this plugin's Cloud MCP connection, then continue the user's original
request. Do not stop at a diagnosis or repeat a failed instruction.

Never add a manual MCP server, custom connector, proxy, token header, or second
plugin install to work around this connection. Do not replace MCP calls with
the Inngest CLI or REST API. Leave unrelated connections and history alone.

## Find the active connection

Use the host's MCP status and tool discovery first. Missing tools may be deferred;
search for the plugin's `fetch_account` and `list_envs` before diagnosing auth.
The usual server name is `plugin:inngest:inngest-cloud`.

If connected, verify the live tools below. For a transient failure, use the
host's reconnect tool for this server and check its result before escalating
to OAuth. Do not repeatedly reconnect a server that explicitly needs login.

Check both plugin and MCP conflicts when there is evidence of shadowing. A local
plugin can hide a synced plugin; a manual server can hide the plugin's server
by endpoint. Report the loaded source/version, not just a directory label.
Compare actual files before calling a version mismatch cosmetic. Use the
host's supported update/reload controls for stale files, without changing the
installation source. A helper from a different checkout does not establish
which plugin is running in this session.

## Start OAuth through this plugin

In a local Claude Code CLI or Desktop Code session with shell access, run:

```sh
bash "${CLAUDE_PLUGIN_ROOT}/scripts/connect.sh" status
```

The helper uses Claude's `--plugin-dir` to load this exact package for the
command. This resolves account-synced plugins that a standalone `claude mcp`
command cannot discover. It keeps the plugin's server name and the current
Claude profile; it does not install anything or write a manual MCP definition.

If this plugin needs authentication, run:

```sh
bash "${CLAUDE_PLUGIN_ROOT}/scripts/connect.sh" login
```

Use an interactive terminal/PTY and keep it running. If the shell tool has no
PTY but the host exposes terminal-panel tools, use that terminal. Let the user
complete browser sign-in and consent, then collect the command's result. Do
not say you cannot start OAuth before checking the available terminal tools.

For a remote/headless terminal, append `--no-browser`. The user opens its
authorization link and pastes the callback into that terminal, never chat.
Do not read credentials or construct, copy, or transfer tokens yourself.

Use the same execution host and Claude profile as the running session. In
Chat/Cowork or a host without a usable CLI, use its existing plugin connection
controls. Inspect the actual controls; do not assume `/mcp` opens a Desktop
login dialog or that a separate Connectors-page login authenticates Code.

If policy or an existing entry hides the plugin even with `--plugin-dir`,
identify the exact blocker. For user-owned conflicts, propose disabling only
the conflicting entry through supported controls, preserving its data. Honor
existing approval or ask for that specific change. Do not weaken managed
policy. Removing a remote MCP entry deletes its stored OAuth credentials, so
never use add/login/remove as a credential-transfer trick.

## Verify and resume

After login succeeds, check helper status again. Use the session's reconnect
tool for this plugin and rediscover its tools. Call `fetch_account` and
`list_envs` through the plugin MCP, confirm the intended account, then resume
the original request. A CLI health check alone is not an end-to-end pass.

If the host cannot refresh the session's servers, request one fresh session
only after explaining that authentication succeeded but tool loading did not.
Do not repeat browser login when the helper is already connected. A disabled
button alone does not prove an admin restriction; require a policy/error message.

If recovery needs consent, access, or a host capability you cannot supply,
give the exact remaining action and retain the original task for continuation.
For a reproducible host failure, include the host/version, loaded plugin source,
helper result, and session MCP status, without tokens or raw authorization URLs.
Keep progress brief: action taken, observed result, and the next step.
