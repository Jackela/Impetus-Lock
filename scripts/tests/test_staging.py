"""Exercise deployment skip/configuration and the shared deploy-only path without a server."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class StagingContract(unittest.TestCase):
    def test_unconfigured_and_incomplete_remote(self):
        workflow = (ROOT / '.github/workflows/deploy-staging.yml').read_text()
        block = workflow.split('          echo "deployed=false"', 1)[1].split('\n  health-check:', 1)[0]
        script = 'echo "deployed=false"' + block
        script = '\n'.join(line[10:] if line.startswith('          ') else line for line in script.splitlines())
        script = script.replace('${{ github.repository }}', 'example/project')
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'outputs'
            env = {**os.environ, 'GITHUB_OUTPUT': str(output), 'STAGING_HOST': '', 'STAGING_USER': '', 'STAGING_SSH_KEY': ''}
            skipped = subprocess.run(['bash', '-eu', '-c', script], env=env, capture_output=True, text=True)
            self.assertEqual(skipped.returncode, 0, skipped.stderr)
            self.assertIn('deployed=false', output.read_text())
            self.assertNotIn('deployed=true', output.read_text())
            env['STAGING_HOST'] = 'example.invalid'
            failed = subprocess.run(['bash', '-eu', '-c', script], env=env, capture_output=True, text=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertIn('STAGING_USER and STAGING_SSH_KEY are required', failed.stdout)
        self.assertIn("needs.deploy-staging.outputs.deployed == 'true'", workflow)
        self.assertNotIn('STAGING_HOST:-localhost', workflow)

    def test_deploy_only_uses_server_files_and_reports_health_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            (base / 'docker-compose.prod.yml').write_text('services: {}\n')
            (base / '.env.staging').write_text('API_PORT=8002\nCLIENT_PORT=8003\n')
            commands = base / 'commands'
            for name, body in {'docker-compose': 'echo "$*" >> "$COMMAND_LOG"', 'sleep': ':', 'curl': 'exit "${CURL_EXIT:-0}"'}.items():
                path = base / name
                path.write_text('#!/bin/bash\n' + body + '\n')
                path.chmod(0o755)
            env = {**os.environ, 'PATH': f'{base}:{os.environ["PATH"]}', 'DEPLOY_DIR': str(base), 'API_IMAGE': 'test/api:sha', 'CLIENT_IMAGE': 'test/client:sha', 'COMMAND_LOG': str(commands)}
            command = ['bash', str(ROOT / 'scripts/deploy-staging.sh'), '--deploy-only']
            passed = subprocess.run(command, env=env, capture_output=True, text=True)
            self.assertEqual(passed.returncode, 0, passed.stderr)
            self.assertIn(' pull', commands.read_text())
            self.assertIn(' up -d', commands.read_text())
            env['CURL_EXIT'] = '22'
            failed = subprocess.run(command, env=env, capture_output=True, text=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertIn('Health checks failed', failed.stdout)


if __name__ == '__main__':
    unittest.main()
