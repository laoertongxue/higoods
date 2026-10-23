import assert from 'node:assert/strict'
import test from 'node:test'

test('X07/X09: execution account reads do not seed, migrate, or rewrite existing accounts', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let raw: string | null = null, writes = 0
  const storage = {
    getItem(key: string) { return key === 'fcs_pda_user_store_v1' ? raw : null },
    setItem() { writes++ }, removeItem() { writes++ }, clear() { throw new Error('Unexpected clear') },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try {
    const accounts = await import('../../src/data/fcs/store-domain-pda.ts')
    const initial = accounts.readFactoryPdaExecutionUsers('FAC-APF')
    assert.ok(initial.some(user => user.roleId === 'ROLE_ADMIN'))
    assert.equal(writes, 0, 'opening PDA must not persist seed accounts')
    const custom = { ...initial[0], name: 'Existing employee', passwordHash: 'retain-existing-hash', status: 'LOCKED' as const }
    raw = JSON.stringify([custom])
    assert.deepEqual(JSON.parse(JSON.stringify(accounts.readFactoryPdaExecutionUsers('FAC-APF'))), [custom])
    assert.equal(writes, 0, 'reads must preserve name, credentials and locked state')
    raw = '{broken'
    assert.throws(() => accounts.readFactoryPdaExecutionUsers('FAC-APF'))
    assert.equal(writes, 0, 'invalid data must not be replaced with defaults')
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
