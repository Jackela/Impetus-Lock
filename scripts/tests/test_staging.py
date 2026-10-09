"""Exercise deployment skip/configuration and the shared deploy-only path without a server."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class StagingContract(unittest.TestCase):
    def test_workflow_metadata_normalizes_owner_and_preserves_version(self):
        workflow = (ROOT / '.github/workflows/deploy-staging.yml').read_text()
        block = workflow.split('      - name: Generate metadata\n', 1)[1].split('\n      - name:', 1)[0]
        script = block.split('        run: |\n', 1)[1]
        script = '\n'.join(line[10:] for line in script.splitlines())
        sha = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, text=True).strip()
        for owner in ('Jackela', 'MiXeD-Owner42', 'already-lowercase'):
            with self.subTest(owner=owner), tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / 'outputs'
                env = {**os.environ, 'GITHUB_OUTPUT': str(output), 'DOCKER_REGISTRY': 'ghcr.io', 'DOCKER_NAMESPACE': owner}
                expanded = script.replace('${{ env.DOCKER_REGISTRY }}', 'ghcr.io').replace('${{ env.DOCKER_NAMESPACE }}', owner)
                result = subprocess.run(['bash', '-eu', '-o', 'pipefail', '-c', expanded], cwd=ROOT, env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                metadata = dict(line.split('=', 1) for line in output.read_text().splitlines())
                self.assertEqual(metadata, {
                    'version': f'sha-{sha}',
                    'api_image': f'ghcr.io/{owner.lower()}/impetus-api',
                    'client_image': f'ghcr.io/{owner.lower()}/impetus-client',
                })
                for service in ('api', 'client'):
                    for tag in (metadata['version'], 'staging', 'latest'):
                        self.assertRegex(f'{metadata[service + "_image"]}:{tag}', r'^ghcr\.io/[a-z0-9-]+/impetus-(api|client):(sha-[a-f0-9]+|staging|latest)$')

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

    def test_normal_deployment_defaults_to_checkout_commit_tag(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            subprocess.run(['git', 'init', '-q', str(base)], check=True)
            subprocess.run(['git', '-C', str(base), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture'], check=True)
            sha = subprocess.check_output(['git', '-C', str(base), 'rev-parse', '--short', 'HEAD'], text=True).strip()
            (base / 'docker-compose.prod.yml').write_text('services: {}\n')
            (base / '.env.staging').write_text('API_PORT=8002\nCLIENT_PORT=8003\n')
            commands = base / 'commands'
            for name in ('docker', 'docker-compose', 'sleep', 'curl'):
                path = base / name
                path.write_text('#!/bin/bash\nprintf "%s %s\\n" "' + name + '" "$*" >> "$COMMAND_LOG"\n')
                path.chmod(0o755)
            env = {**os.environ, 'PATH': f'{base}:{os.environ["PATH"]}', 'DEPLOY_DIR': str(base), 'COMMAND_LOG': str(commands)}
            passed = subprocess.run(['bash', str(ROOT / 'scripts/deploy-staging.sh')], cwd=base, input='n', env=env, capture_output=True, text=True)
            self.assertEqual(passed.returncode, 0, passed.stderr)
            for service in ('api', 'client'):
                self.assertIn(f'docker tag impetus-lock_{service}:latest ghcr.io/impetus-lock/{service}:staging-{sha}', commands.read_text())
                self.assertIn(f'docker tag impetus-lock_{service}:latest ghcr.io/impetus-lock/{service}:staging', commands.read_text())

    def test_deploy_only_uses_server_files_and_reports_health_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            (base / 'docker-compose.prod.yml').write_text('services: {}\n')
            (base / '.env.staging').write_text('API_PORT=8002\nCLIENT_PORT=8003\n')
            commands = base / 'commands'
            for name, body in {'docker-compose': 'echo "$*" >> "$COMMAND_LOG"', 'sleep': ':', 'git': 'echo unexpected-git >&2; exit 99', 'curl': 'exit "${CURL_EXIT:-0}"'}.items():
                path = base / name
                path.write_text('#!/bin/bash\n' + body + '\n')
                path.chmod(0o755)
            env = {**os.environ, 'PATH': f'{base}:{os.environ["PATH"]}', 'DEPLOY_DIR': str(base), 'API_IMAGE': 'test/api:sha', 'CLIENT_IMAGE': 'test/client:sha', 'COMMAND_LOG': str(commands)}
            command = ['bash', str(ROOT / 'scripts/deploy-staging.sh'), '--deploy-only']
            passed = subprocess.run(command, cwd=base, env=env, capture_output=True, text=True)
            self.assertEqual(passed.returncode, 0, passed.stderr)
            self.assertIn(' pull', commands.read_text())
            self.assertIn(' up -d', commands.read_text())
            env['CURL_EXIT'] = '22'
            failed = subprocess.run(command, cwd=base, env=env, capture_output=True, text=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertIn('Health checks failed', failed.stdout)


if __name__ == '__main__':
    unittest.main()
