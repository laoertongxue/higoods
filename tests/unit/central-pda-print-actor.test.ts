import assert from 'node:assert/strict'
import test from 'node:test'
import { assertCentralPrintingFactoryActor } from '../../src/data/fcs/central-printing-actor.ts'
import { readFactoryPdaExecutionUsers } from '../../src/data/fcs/store-domain-pda.ts'

test('printing responsibility uses either real active account without depending on the old device session', () => {
  const users = readFactoryPdaExecutionUsers('F090')
  for (const role of ['ROLE_ADMIN', 'ROLE_OPERATOR']) {
    const user = users.find(user => user.roleId === role)!
    assert.ok(user)
    assert.doesNotThrow(() => assertCentralPrintingFactoryActor('F090', user))
  }
})

test('a copied display name or another factory cannot acquire printing responsibility', () => {
  const user = readFactoryPdaExecutionUsers('F090').find(user => user.roleId === 'ROLE_ADMIN')!
  for (const actor of [
    { ...user, name: 'FAKE' },
    { ...user, userId: 'NONEXISTENT-ACCOUNT' },
    { ...user, factoryId: 'NONEXISTENT-FACTORY' },
  ]) assert.throws(() => assertCentralPrintingFactoryActor('F090', actor), /PRINT_wrongActor/)
  assert.throws(() => assertCentralPrintingFactoryActor('NONEXISTENT-FACTORY', user), /PRINT_wrongActor/)
})
