import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const scenarios = [
  ['success', '旧数据成功保存后才删除旧键并报告完成'],
  ['missing-remove', '存储不支持删除时保留旧键且不报告迁移完成'],
  ['throwing-remove', '删除失败时保留旧键且不报告迁移完成'],
  ['invalid-json', 'JSON 解析失败保留旧数据，不写入目标'],
  ['invalid-state', '格式校验失败保留旧数据，不写入目标'],
  ['write-abort', '目标事务中止保留旧数据与原目标，不报告完成'],
] as const

for (const [scenario, description] of scenarios) {
  test(`TMF 旧存储迁移：${description}`, () => {
    // 独立进程隔离一次性迁移 Promise；仅替换浏览器存储设施，执行真实迁移及 pmsTx。
    const script = `
      import assert from 'node:assert/strict'
      import { withBrowserBusinessStorage } from './src/data/browser-storage.ts'
      import { getTmfPurchaseState, migrateTmfPurchaseStateFromLocalStorage, TMF_PURCHASE_STORAGE_KEY } from './src/data/pms/tmf-material-purchases.ts'
      const scenario = ${JSON.stringify(scenario)}
      const legacy = getTmfPurchaseState()
      legacy.workPlans = [{ workOrderId: 'LEGACY-WORK-001', responsibleName: '原负责人', plannedStartAt: '2026-10-01', plannedFinishAt: '2026-10-02', waitingReason: '', revision: 1, updatedAt: '2026-10-01T08:00:00Z', updatedBy: '原登记人' }]
      const raw = scenario === 'invalid-json' ? '{invalid json' : JSON.stringify(scenario === 'invalid-state' ? { ...legacy, orders: null } : legacy)
      let storedRaw = raw, removeCalls = 0, writes = 0, committed = false
      const target = new Map([['existing-record', { value: '保留原目标' }]])
      const beforeTarget = structuredClone(target)
      const info = [], warnings = [], errors = []
      console.info = (...args) => info.push(args)
      console.warn = (...args) => warnings.push(args)
      console.error = (...args) => errors.push(args)
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
        open() {
          const request = { result: {
            transaction(names, mode) {
              assert.equal(mode, 'readwrite')
              assert.equal(names.length, 4)
              const pending = new Map()
              const tx = { objectStore(name) { assert.ok(names.includes(name)); return { put(value) { writes += 1; pending.set(name, structuredClone(value)) } } } }
              setImmediate(() => {
                if (scenario === 'write-abort') {
                  tx.error = new Error('test transaction aborted')
                  tx.onabort()
                } else {
                  for (const [name, value] of pending) target.set(name, value)
                  committed = true
                  tx.oncomplete()
                }
              })
              return tx
            }
          } }
          setImmediate(() => request.onsuccess())
          return request
        }
      } })
      const storage = { getItem(key) { assert.equal(key, TMF_PURCHASE_STORAGE_KEY); return storedRaw } }
      if (scenario !== 'missing-remove') storage.removeItem = function(key) {
        assert.equal(this, storage, '保留方法接收对象')
        assert.equal(key, TMF_PURCHASE_STORAGE_KEY)
        removeCalls += 1
        if (scenario === 'throwing-remove') throw new Error('test deletion denied')
        assert.equal(committed, true, '目标事务完成前不得删除旧源')
        storedRaw = null
      }
      const migration = withBrowserBusinessStorage(storage, () => migrateTmfPurchaseStateFromLocalStorage())
      if (['invalid-json', 'invalid-state', 'write-abort'].includes(scenario)) {
        await assert.rejects(migration, scenario === 'write-abort' ? /保存被中断/ : scenario === 'invalid-state' ? /格式不符/ : SyntaxError)
        assert.equal(removeCalls, 0, '失败不得尝试删除旧源')
        assert.equal(storedRaw, raw)
        assert.deepEqual(target, beforeTarget)
        assert.equal(writes, scenario === 'write-abort' ? 4 : 0)
        assert.equal(info.length, 0)
        assert.ok(errors.some(args => args[0] === '[TMF_LEGACY_MIGRATION_FAILED]'))
      } else {
        await migration
        assert.equal(committed, true)
        assert.equal(writes, 4)
        assert.deepEqual(target.get('pmsTmfOrders').section.workPlans, legacy.workPlans)
        assert.deepEqual(getTmfPurchaseState().workPlans, legacy.workPlans)
        if (scenario === 'success') {
          assert.equal(storedRaw, null)
          assert.equal(removeCalls, 1)
          assert.deepEqual(info.map(args => args[0]), ['[TMF_LEGACY_MIGRATION_DONE]'])
          assert.equal(warnings.length, 0)
        } else {
          assert.equal(storedRaw, raw)
          assert.equal(removeCalls, scenario === 'missing-remove' ? 0 : 1)
          assert.equal(info.length, 0)
          assert.ok(warnings.some(args => args[0] === '[TMF_LEGACY_MIGRATION_REMOVE_FAILED]'))
        }
        assert.equal(errors.length, 0)
      }
      assert.ok([...warnings, ...errors].flat().every(value => !(value instanceof TypeError)), '不得捕获可选方法误调用产生的 TypeError 后伪装完成')
    `
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
      cwd: new URL('../..', import.meta.url), encoding: 'utf8', timeout: 15_000,
    })
    assert.equal(result.status, 0, result.stderr || result.error?.message)
  })
}
