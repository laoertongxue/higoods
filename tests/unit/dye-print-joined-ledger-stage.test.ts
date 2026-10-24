import test from 'node:test'
import assert from 'node:assert/strict'
import { withDyeingLedgerStage, withPrintingLedgerStage, readFactoryProcessStorage, writeFactoryProcessStorage } from '../../src/data/fcs/factory-process-storage.ts'

test('C03.32 joined dye and print stages keep full shared facts in the command, PCS receives only its rows, and failures release the stage', () => {
  const key = 'higoods.formal-dye-execution.v1', pending = new Map<string, string>()
  const full = JSON.stringify({ state: { workOrders: [['DWO-ACTUAL', { quantity: 5 }]] } })
  const own = JSON.stringify({ state: { workOrders: [] } })
  for (const stage of [withPrintingLedgerStage, withDyeingLedgerStage]) {
    pending.clear()
    assert.throws(() => stage(pending, (_key, raw) => { assert.equal(raw, full); return own }, () => {
      assert.deepEqual(writeFactoryProcessStorage(key, full, null), { handled: false, raw: own })
      assert.equal(readFactoryProcessStorage(key, null), full)
      assert.throws(() => withDyeingLedgerStage(new Map(), (_k, value) => value, () => null), /尚未保存/)
      throw Error('actual command failed')
    }), /actual command failed/)
    assert.equal(pending.get(key), full)
    assert.equal(readFactoryProcessStorage(key, 'unchanged original'), 'unchanged original')
    assert.deepEqual(writeFactoryProcessStorage(key, full, null), { handled: false })
  }
})
