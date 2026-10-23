import assert from 'node:assert/strict'
import test from 'node:test'
import { captureDesignRevisionFcsCaches, restoreDesignRevisionFcsCaches, hydrateDesignRevisionFcsCaches, registerDesignRevisionFcsCacheHooks } from '../../src/data/fcs/design-revision-pcs-storage.ts'

test('X09: a shared-ledger command rolls back and reloads its named owners without touching unrelated caches', () => {
  let related = 4, unrelated = 8, relatedReads = 0, unrelatedReads = 0
  registerDesignRevisionFcsCacheHooks('central-test-related', {
    capture() { relatedReads++; return related }, restore(value: number) { related = value }, hydrate() { related = 40 },
  })
  registerDesignRevisionFcsCacheHooks('central-test-unrelated', {
    capture() { unrelatedReads++; return unrelated }, restore(value: number) { unrelated = value }, hydrate() { unrelated = 80 },
  })
  const snapshot = captureDesignRevisionFcsCaches(['central-test-related'])
  assert.deepEqual(snapshot, [['central-test-related', 4]])
  assert.equal(relatedReads, 1)
  assert.equal(unrelatedReads, 0)
  related = 5; unrelated = 9
  restoreDesignRevisionFcsCaches(snapshot)
  assert.equal(related, 4)
  assert.equal(unrelated, 9)
  hydrateDesignRevisionFcsCaches(['central-test-related'])
  assert.equal(related, 40)
  assert.equal(unrelated, 9)
  const legacy = captureDesignRevisionFcsCaches()
  assert.ok(legacy.some(([key, value]) => key === 'central-test-related' && value === 40))
  assert.ok(legacy.some(([key, value]) => key === 'central-test-unrelated' && value === 9))
  hydrateDesignRevisionFcsCaches()
  assert.equal(unrelated, 80, 'callers without an owner scope retain the existing full reload contract')
})
