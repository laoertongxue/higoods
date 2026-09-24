import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'

for (const existing of [false, true]) {
  test(`technical version reads do not write when storage is full (${existing ? 'saved data' : 'first visit'})`, () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { createTechnicalDataVersionBootstrapSnapshot } from './src/data/pcs-technical-data-version-bootstrap.ts';
      const key = 'higood-pcs-technical-data-version-store-v5';
      const values = new Map();
      const seed = createTechnicalDataVersionBootstrapSnapshot();
      seed.records[0].updatedBy = '保留同事已保存内容';
      if (${existing}) values.set(key, JSON.stringify(seed));
      const original = values.get(key);
      let blocked = true, writes = 0;
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: k => values.get(k) ?? null,
        setItem: (k, v) => { if (k === key) { writes++; if (blocked) throw new DOMException('quota', 'QuotaExceededError'); } values.set(k, v); },
        removeItem: k => values.delete(k),
      }});
      const repo = await import('./src/data/pcs-technical-data-version-repository.ts');
      const before = repo.getTechnicalDataVersionStoreSnapshot();
      assert.ok(before.records.length);
      assert.equal(writes, 0);
      assert.equal(values.get(key), original);
      if (${existing}) assert.equal(before.records.find(r => r.technicalVersionId === seed.records[0].technicalVersionId).updatedBy, '保留同事已保存内容');
      const id = before.records[0].technicalVersionId;
      assert.throws(() => repo.updateTechnicalDataVersionRecord(id, {updatedBy:'失败修改'}), /quota/);
      assert.deepEqual(repo.getTechnicalDataVersionStoreSnapshot(), before);
      assert.equal(values.get(key), original);
      blocked = false;
      repo.updateTechnicalDataVersionRecord(id, {updatedBy:'成功修改'});
      assert.equal(JSON.parse(values.get(key)).records.find(r => r.technicalVersionId === id).updatedBy, '成功修改');
    `], { cwd: process.cwd(), encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })
}
