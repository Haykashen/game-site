import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import test from 'node:test';

// Executes the real script with fake infrastructure, never a real Docker daemon.
function runDeployment(scenario, migrations = 'false') {
  const directory = mkdtempSync(join(tmpdir(), 'discvault-deploy-test-'));
  try {
    const app = join(directory, 'app');
    const release = join(directory, 'release');
    const bin = join(directory, 'bin');
    for (const path of [app, release, bin]) mkdirSync(path);
    const revision = 'a'.repeat(40);
    writeFileSync(join(app, '.env'), 'TEST_ONLY=true\n');
    writeFileSync(join(app, 'docker-compose.prod.yml'), 'name: discvault\n');
    writeFileSync(join(release, 'revision'), revision + '\n');
    writeFileSync(join(release, 'images.tar.gz'), gzipSync('fake images'));
    copyFileSync(resolve('deploy/auto-deploy.sh'), join(release, 'deploy.sh'));
    const commandLog = join(directory, 'commands');
    writeFileSync(join(bin, 'flock'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    copyFileSync(resolve('scripts/fixtures/deploy-docker.sh'), join(bin, 'docker'));
    chmodSync(join(bin, 'docker'), 0o755);
    writeFileSync(join(bin, 'curl'),
      '#!/bin/sh\nif [ "$MOCK_SCENARIO" = health-failure ]; then exit 22; fi\nprintf \'{"status":"ok","database":"up"}\'\n',
      { mode: 0o755 });
    const portable = (path) => path.replaceAll('\\', '/');
    writeFileSync(join(bin, 'test-environment.sh'),
      'docker() { bash "$MOCK_BIN/docker" "$@"; }\ncurl() { sh "$MOCK_BIN/curl" "$@"; }\nflock() { return 0; }\n');
    const result = spawnSync(process.env.DEPLOY_TEST_BASH || 'bash', [portable(join(release, 'deploy.sh')), portable(app), revision, migrations], {
      env: { ...process.env, PATH: bin + (process.platform === 'win32' ? ';' : ':') + process.env.PATH, BASH_ENV: portable(join(bin, 'test-environment.sh')), MOCK_BIN: portable(bin), MOCK_SCENARIO: scenario, MOCK_LOG: portable(commandLog), MOCK_REVISION: revision },
      encoding: 'utf8', timeout: 15000,
    });
    assert.ifError(result.error);
    return { ...result, commands: readFileSync(commandLog, 'utf8') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const options = { skip: process.platform === 'win32' && !process.env.DEPLOY_TEST_BASH ? 'Set DEPLOY_TEST_BASH to run with Git Bash on Windows.' : false };
test('deployment backs up DB and files before replacing application containers', options, () => {
  const result = runDeployment('success');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.commands.indexOf('pg_dump') < result.commands.indexOf('up -d --no-deps'));
  assert.match(result.commands, /--entrypoint tar/);
  assert.doesNotMatch(result.commands, /down|prune|migrate reset|db seed/);
});
test('unapproved migration stops before maintenance', options, () => {
  const result = runDeployment('pending');
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.commands, /stop -t 30 api|pg_dump|up -d/);
});
test('backup failure restarts original API without replacing images', options, () => {
  const result = runDeployment('backup-failure');
  assert.notEqual(result.status, 0);
  assert.match(result.commands, /start api-id/);
  assert.doesNotMatch(result.commands, /up -d/);
});
test('health failure rolls application images back without restoring database', options, () => {
  const result = runDeployment('health-failure');
  assert.notEqual(result.status, 0);
  assert.match(result.commands, /rollback.yml up/);
  assert.doesNotMatch(result.commands, /pg_restore.*-d/);
});
test('migration failure stops API and does not blindly roll code or DB back', options, () => {
  const result = runDeployment('migration-failure', 'true');
  assert.notEqual(result.status, 0);
  assert.match(result.commands, /npx prisma migrate deploy/);
  assert.match(result.commands, /images.yml stop api/);
  assert.doesNotMatch(result.commands, /rollback.yml up|start api-id/);
});
