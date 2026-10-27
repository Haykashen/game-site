import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, unlinkSync, utimesSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const options = {skip: process.platform === 'win32' && !process.env.DEPLOY_TEST_BASH ? 'Requires Git Bash or Linux.' : false};
for (const clean of [false, true]) test(`transport archive maintenance clean=${clean} protects backups and live/latest files`, options, () => {
  const root = mkdtempSync(join(tmpdir(), 'discvault-cache-test-'));
  try {
    const app = join(root, 'app'), incoming = join(app, '.deploy/incoming'), backups = join(app, '.deploy/backups'), bin = join(root, 'bin');
    for (const path of [incoming, backups, bin]) mkdirSync(path, {recursive: true});
    writeFileSync(join(app, '.env'), 'TEST=true'); writeFileSync(join(app, 'docker-compose.prod.yml'), 'name: discvault');
    const live = 'a'.repeat(40), old = 'b'.repeat(40), latest = 'c'.repeat(40);
    writeFileSync(join(app, '.deploy/current-revision'), live);
    const dirs = [live+'-1-1', old+'-2-1', latest+'-3-1', 'unrecognized'];
    for (const name of dirs) {
      const dir = join(incoming, name); mkdirSync(dir);
      for (const filename of ['release.tar.gz', 'images.tar.gz', 'release.tar.gz.sha256', 'images.yml', 'revision']) writeFileSync(join(dir, filename), 'keep-or-clean');
    }
    utimesSync(join(incoming, latest+'-3-1'), new Date('2099-01-01'), new Date('2099-01-01'));
    writeFileSync(join(backups, 'database.dump'), 'precious backup');
    const linked = process.platform !== 'win32';
    if (linked) {unlinkSync(join(incoming, old+'-2-1','release.tar.gz.sha256')); symlinkSync(join(backups,'database.dump'),join(incoming,old+'-2-1','release.tar.gz.sha256'));}
    writeFileSync(join(bin, 'docker'), '#!/bin/sh\nprintf "test-only Docker usage\\n"\n', {mode: 0o755});
    writeFileSync(join(bin, 'flock'), '#!/bin/sh\nexit 0\n', {mode: 0o755});
    const portable = (value) => value.replaceAll('\\', '/');
    const result = spawnSync(process.env.DEPLOY_TEST_BASH || 'bash', [portable(resolve('deploy/transfer-cache.sh')), portable(app), String(clean)], {env: {...process.env, PATH: bin+(process.platform==='win32'?';':':')+process.env.PATH}, encoding:'utf8', timeout:15000});
    assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp('files='+(linked?2:3)+' '));
    for (const filename of ['release.tar.gz', 'images.tar.gz', 'release.tar.gz.sha256']) {
      assert.equal(existsSync(join(incoming, old+'-2-1', filename)), !clean || (linked && filename==='release.tar.gz.sha256'));
      for (const name of [live+'-1-1', latest+'-3-1', 'unrecognized']) assert.equal(existsSync(join(incoming, name, filename)), true);
    }
    assert.equal(readFileSync(join(backups, 'database.dump'), 'utf8'), 'precious backup');
    assert.equal(existsSync(join(incoming, old+'-2-1', 'images.yml')), true);
    assert.equal(existsSync(join(incoming, old+'-2-1', 'revision')), true);
  } finally {rmSync(root,{recursive:true,force:true});}
});
