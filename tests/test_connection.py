import base64
import hashlib
import http.server
import json
import os
from pathlib import Path
import pty
import re
import select
import shutil
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]


class OAuthMCP(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def respond(self, status, data, headers=None):
        body = json.dumps(data).encode()
        self.send_response(status)
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        origin = self.server.origin
        path = urllib.parse.urlparse(self.path)
        if path.path.startswith('/.well-known/oauth-protected-resource'):
            self.respond(200, {'resource': origin + '/mcp', 'authorization_servers': [origin]})
        elif path.path.startswith('/.well-known/'):
            self.respond(200, {
                'issuer': origin,
                'authorization_endpoint': origin + '/authorize',
                'token_endpoint': origin + '/token',
                'registration_endpoint': origin + '/register',
                'response_types_supported': ['code'],
                'grant_types_supported': ['authorization_code'],
                'code_challenge_methods_supported': ['S256'],
                'token_endpoint_auth_methods_supported': ['none'],
            })
        elif path.path == '/authorize':
            query = urllib.parse.parse_qs(path.query)
            self.server.challenge = query['code_challenge'][0]
            self.server.redirect_uri = query['redirect_uri'][0]
            location = self.server.redirect_uri + '?' + urllib.parse.urlencode({
                'code': 'fixture-code', 'state': query['state'][0],
            })
            self.respond(302, {}, {'Location': location})
        else:
            self.respond(405, {})

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if self.path == '/register':
            self.respond(201, {**json.loads(body), 'client_id': 'fixture-client'})
            return
        if self.path == '/token':
            fields = urllib.parse.parse_qs(body.decode())
            challenge = base64.urlsafe_b64encode(hashlib.sha256(
                fields.get('code_verifier', [''])[0].encode()
            ).digest()).rstrip(b'=').decode()
            if (challenge != self.server.challenge
                    or fields.get('code') != ['fixture-code']
                    or fields.get('redirect_uri') != [self.server.redirect_uri]):
                self.respond(400, {'error': 'invalid_grant'})
                return
            self.server.token_exchanges += 1
            self.respond(200, {'access_token': 'fixture-access', 'token_type': 'Bearer', 'expires_in': 3600})
            return
        if self.path != '/mcp':
            self.respond(404, {})
            return
        if self.headers.get('Authorization') != 'Bearer fixture-access':
            self.respond(401, {}, {'WWW-Authenticate':
                f'Bearer resource_metadata="{self.server.origin}/.well-known/oauth-protected-resource"'})
            return
        message = json.loads(body)
        if 'id' not in message:
            self.respond(202, {})
            return
        method = message['method']
        if method == 'initialize':
            result = {'protocolVersion': message['params']['protocolVersion'],
                      'capabilities': {'tools': {}}, 'serverInfo': {'name': 'fixture', 'version': '1'}}
        elif method == 'tools/list':
            self.server.authenticated_discoveries += 1
            result = {'tools': [{'name': 'fetch_account', 'description': 'Read fixture account',
                                 'inputSchema': {'type': 'object', 'properties': {}}}]}
        else:
            result = {}
        self.respond(200, {'jsonrpc': '2.0', 'id': message['id'], 'result': result})


@unittest.skipUnless(shutil.which('claude'), 'Claude Code CLI required')
class ConnectionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='inngest-plugin-oauth-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.project = self.root / 'project'
        self.project.mkdir()
        self.config = self.root / 'config'
        self.config.mkdir()
        self.env = os.environ.copy()
        for key in list(self.env):
            if key.startswith(('ANTHROPIC_', 'CLAUDE_', 'MCP_')) or key == 'CLAUDECODE':
                self.env.pop(key)
        self.env.update(CLAUDE_CONFIG_DIR=str(self.config), ENABLE_CLAUDEAI_MCP_SERVERS='false')
        self.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), OAuthMCP)
        self.server.origin = f'http://127.0.0.1:{self.server.server_port}'
        self.server.challenge = None
        self.server.redirect_uri = None
        self.server.token_exchanges = 0
        self.server.authenticated_discoveries = 0
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.plugin = self.root / 'downloaded plugin'
        (self.plugin / '.claude-plugin').mkdir(parents=True)
        (self.plugin / 'scripts').mkdir()
        shutil.copy(ROOT / 'scripts/connect.sh', self.plugin / 'scripts/connect.sh')
        (self.plugin / '.claude-plugin/plugin.json').write_text(json.dumps({'name': 'inngest', 'version': '0.0.0'}))
        (self.plugin / '.mcp.json').write_text(json.dumps({'mcpServers': {'inngest-cloud': {
            'type': 'http', 'url': self.server.origin + '/mcp',
        }}}))
        self.addCleanup(self.run_cli, f'--plugin-dir={self.plugin}', 'mcp', 'logout', 'plugin:inngest:inngest-cloud')

    def run_cli(self, *args):
        return subprocess.run(['claude', *args], env=self.env, cwd=self.project,
                              text=True, capture_output=True, timeout=30)

    def helper(self, *args):
        return subprocess.run(['bash', str(self.plugin / 'scripts/connect.sh'), *args],
                              env=self.env, cwd=self.project, text=True, capture_output=True, timeout=30)

    def test_oauth_for_unregistered_plugin_and_credential_reuse(self):
        server_name = 'plugin:inngest:inngest-cloud'
        missing = self.run_cli('mcp', 'get', server_name)
        self.assertIn('No MCP server named', missing.stdout + missing.stderr)
        self.assertIn('Needs authentication', self.helper('status').stdout)
        self.assertEqual(self.helper('login').returncode, 2)

        master, slave = pty.openpty()
        proc = subprocess.Popen(['bash', str(self.plugin / 'scripts/connect.sh'), 'login', '--no-browser'],
                                env=self.env, cwd=self.project, stdin=slave, stdout=slave, stderr=slave)
        os.close(slave)
        output = b''
        try:
            deadline = time.monotonic() + 20
            authorized = False
            while time.monotonic() < deadline:
                if select.select([master], [], [], 0.1)[0]:
                    try:
                        output += os.read(master, 65536)
                    except OSError:
                        break
                if not authorized:
                    match = re.search(rb'http://127\.0\.0\.1:\d+/authorize\?[^\s\x07\x1b]+', output)
                    if match:
                        with urllib.request.urlopen(match[0].decode(), timeout=5) as response:
                            response.read()
                        authorized = True
                if proc.poll() is not None:
                    break
            self.assertTrue(authorized, output.decode(errors='replace'))
            self.assertEqual(proc.wait(timeout=5), 0, output.decode(errors='replace'))
        finally:
            if proc.poll() is None:
                proc.terminate()
                proc.wait(timeout=5)
            os.close(master)

        self.assertEqual(self.server.token_exchanges, 1)
        self.assertIn('Connected', self.helper('status').stdout)
        self.assertGreater(self.server.authenticated_discoveries, 0)
        self.assertIn('No MCP server named', self.run_cli('mcp', 'get', server_name).stderr)
        self.assertFalse((self.project / '.mcp.json').exists())
        config = json.loads((self.config / '.claude.json').read_text())
        self.assertFalse(config.get('mcpServers'))

        marketplace = self.root / 'marketplace'
        (marketplace / '.claude-plugin').mkdir(parents=True)
        shutil.copytree(self.plugin, marketplace / 'inngest')
        (marketplace / '.claude-plugin/marketplace.json').write_text(json.dumps({
            'name': 'fixture', 'owner': {'name': 'fixture'},
            'plugins': [{'name': 'inngest', 'source': './inngest'}],
        }))
        self.assertEqual(self.run_cli('plugin', 'marketplace', 'add', str(marketplace)).returncode, 0)
        self.assertEqual(self.run_cli('plugin', 'install', 'inngest@fixture').returncode, 0)
        self.assertIn('Connected', self.run_cli('mcp', 'get', server_name).stdout)
        self.assertEqual(self.server.token_exchanges, 1)

    def test_manual_duplicate_is_reported_without_creating_or_removing_entries(self):
        added = self.run_cli('mcp', 'add', '--scope', 'user', '--transport', 'http',
                             'old-inngest', self.server.origin + '/mcp')
        self.assertEqual(added.returncode, 0)
        config_path = self.config / '.claude.json'
        before = json.loads(config_path.read_text())['mcpServers']
        result = self.helper('status')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('No MCP server named', result.stdout + result.stderr)
        self.assertEqual(json.loads(config_path.read_text())['mcpServers'], before)
        self.assertEqual(self.server.token_exchanges, 0)

    def test_invalid_arguments_do_not_start_oauth(self):
        for args in [('remove',), ('status', '--no-browser'), ('login', '--scope', 'user')]:
            with self.subTest(args=args):
                self.assertEqual(self.helper(*args).returncode, 2)
        self.assertEqual(self.server.token_exchanges, 0)


if __name__ == '__main__':
    unittest.main()
