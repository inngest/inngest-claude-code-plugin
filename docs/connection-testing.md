# Connection tests

Test the actual MCP connection, not a successful answer produced through the
CLI or REST API. Use a dedicated Inngest demo account with synthetic data.

## Preserve existing Claude data

For CLI tests, `scripts/test-install.sh` creates a fresh `CLAUDE_CONFIG_DIR`
and an empty project outside this repository. Its generated `claude` wrapper
always selects that profile. Do not use the normal `claude` command for fixture
changes. Use a Claude subscription login, not a Console/profile login, since
Console profiles are not isolated by `CLAUDE_CONFIG_DIR`.

The fixture does not copy credentials or history. It disables account connector
sync to isolate the package's own MCP connection. Account plugin sync and
managed policy are separate; use a dedicated Claude test account to avoid
mixing in existing account installs. Keep fixture folders private after login.

For Desktop, use a separate macOS user with its own Claude Desktop data and
Keychain, signed into the Claude test account. `CLAUDE_CONFIG_DIR` is a Claude
Code setting, not a supported Desktop profile switch. Using the same Claude
account in another OS user still shares account-level connectors and plugins.
Do not clear your normal Desktop app data, history, or Keychain.

## CLI package checks

From this repository:

```sh
bash scripts/test-install.sh clean
bash scripts/test-install.sh legacy-user
bash scripts/test-install.sh legacy-project
bash scripts/test-install.sh legacy-local
bash scripts/test-install.sh legacy-alias
```

Each command creates a separate fixture and prints its launcher path. It
installs the current checkout through a local marketplace, including uncommitted
changes. Run from the fixture's empty project, not this plugin repository:
the repository's `.mcp.json` would also become a project-scoped MCP definition.

For each fixture:

1. Launch the printed wrapper; complete Claude login and project trust.
2. Open `/plugin` and `/mcp`. Record the installed version, each Inngest server's
   source, its status, and which duplicate is hidden. Approve a project server
   when testing the project-scoped fixture.
3. Run `/inngest:connect` (available in the candidate package). Authenticate the
   active server through `/mcp` and choose the Inngest demo account.
4. Run the read-only smoke prompt below. Inspect tool calls: both must come
   from the selected MCP connection, with no Bash, CLI, or raw HTTP fallback.
5. Quit and reopen the same wrapper. Repeat the prompt; authentication should
   persist. Confirm the same account/environment.
6. For a legacy fixture, disable only the old entry through `/mcp`, start a
   fresh session, and authenticate the plugin connection if requested. Repeat
   the smoke prompt. Record whether the bundled server becomes active. If the
   host still hides it, remove only the fixture's old entry using its exact
   scope, then retry. Do not apply fixture removals to your regular profile.

The fixture preparation passing is not an OAuth or end-to-end pass.

### Observed installation results

Tested on macOS with Claude Code 2.1.291, October 7, 2026, using the v0.4.1
candidate. All five fixtures installed successfully and passed manifest
validation. Before login, `claude mcp list` showed:

| Fixture | Visible Cloud connection |
| --- | --- |
| Clean | Plugin server; needs authentication |
| Prior user entry | Manual server; plugin server hidden |
| Prior local entry | Manual server; plugin server hidden |
| Prior entry named `old-inngest` | Manual server; plugin server hidden |
| Prior project entry, not approved | Plugin server plus manual server pending approval |

Removing only the user-scoped entry in its disposable fixture restored the
plugin server. This confirms endpoint shadowing and targeted recovery, not
the cause of any particular Desktop failure. OAuth, live tool calls, restart
persistence, and Desktop checks still require the interactive steps below.

## Published directory and Desktop checks

Use the test account in the separate OS user. Record whether testing Chat,
Cowork, or the Code tab; results on one do not establish the others work.

1. Install the published Inngest plugin from Claude's directory. Record its
   version and install source. Do not also install our GitHub marketplace copy.
2. Open the plugin/connector controls and complete Inngest OAuth. For Code,
   inspect `/mcp`; for Chat/Cowork, use the host's connector settings.
3. Run the smoke prompt and verify the actual MCP calls and demo account.
4. Restart Desktop and repeat in a new conversation.
5. In the CLI, sign into the same test account with a fresh `CLAUDE_CONFIG_DIR`.
   Leave account connector sync enabled for this test. Confirm the directory
   plugin appears and repeat the smoke prompt.
6. On the test account only, repeat with a custom Inngest Cloud connector added
   before installing the plugin. Test both an authenticated old connector and
   one needing sign-in. Repeat separately with an older local plugin copy and
   with a manually added CLI MCP server. Capture which source wins.
7. Repeat in the team workspace with its administrator's connector policy.
   Record a policy block separately from an OAuth or duplicate-entry failure.

For candidate Desktop testing, load the candidate through the host's local
plugin support, if offered, and repeat. That tests the package, not publication
or account sync; repeat the directory test after the new version is published.

### Smoke prompt

> Use the Inngest Cloud MCP connection to call fetch_account and list_envs.
> Report the account and environments returned. Do not use the CLI, REST API,
> cached answers, or any write tools. If MCP is unavailable, report the exact
> connection error instead of using a fallback.

Then select one returned environment explicitly and ask for its apps. When
the demo app exists, list its functions and inspect a seeded run and trace.
An empty app list is not an auth failure; check the selected environment.

## Existing-install recovery

Start with `/inngest:connect` in versions that include it, or inspect `/mcp`
and the host's connector settings directly. A working prior connection can
be reused; the plugin's skills do not require a specific MCP tool prefix.

Claude Code chooses local > project > user > plugin > account connector
definitions, with organization-managed definitions taking priority. Plugins
and connectors are deduplicated by endpoint, including when their names differ.
Renaming the plugin's server therefore does not fix endpoint shadowing.

Authenticate the active entry. If replacing an old entry is needed, disable
only that entry first. Never automatically remove user configuration on plugin
install. A `401` calls for reconnecting the active server; a denied grant or
workspace policy calls for permission changes, not deleting local history.
Do not append a query string to the MCP URL to evade duplicate detection.

In Chat/Cowork, prior connectors are account-level settings. CLI config edits
cannot repair those connections. Inspect the failing connection in that host
and use its reconnect controls; check workspace policy if Connect is disabled.

## Result record

Record: date, OS, Claude version/surface, plugin version/source, Claude workspace
type, pre-existing connection/source, selected connection, OAuth outcome, actual
MCP tools called, restart result, and recovery applied. Record clean install,
legacy connection, and recovery separately as PASS, FAIL, or NOT RUN.

Do not include tokens, authorization URLs, auth headers, or raw debug logs in
shared reports. A redacted status/error is enough to start investigating.

References: [MCP precedence](https://code.claude.com/docs/en/mcp#scope-hierarchy-and-precedence),
[separate CLI accounts](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts),
[plugin troubleshooting](https://code.claude.com/docs/en/plugins/troubleshooting).
