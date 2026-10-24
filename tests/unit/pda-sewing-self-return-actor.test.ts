import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSewingSelfReturnDiscardActor, resolveSewingSelfReturnRegistrationActor } from '../../src/pages/pda-sewing-self-return.ts'
import type { getPdaSewingSelfReturnModeLock } from '../../src/data/fcs/pda-sewing-self-return-mode.ts'

const runtime = { userId: 'ID-F002_admin', userName: '实际后道管理员', roleId: 'ROLE_ADMIN', factoryId: 'ID-F002' }
const lock = { active: true, factoryId: 'ID-F002', openedBy: runtime.userName, openedAt: '2026-10-22T01:00:00Z' } as NonNullable<ReturnType<typeof getPdaSewingSelfReturnModeLock>>

test('只有本公共站实际开启管理员承担本次回货确认废弃责任，ID与姓名保持真实登录人', () => {
  assert.deepEqual(resolveSewingSelfReturnDiscardActor(runtime, lock), { actorId: runtime.userId, actorName: runtime.userName, roleName: '后道回货确认人员' })
  for (const [person, station] of [
    [runtime, null], [runtime, { ...lock, active: false }], [runtime, { ...lock, factoryId: 'OTHER-FACTORY' }],
    [runtime, { ...lock, openedBy: '另一管理员' }], [{ ...runtime, roleId: 'ROLE_OPERATOR' }, lock],
  ] as const) {
    const actor = resolveSewingSelfReturnDiscardActor(person, station)
    assert.deepEqual(actor, { actorId: person.userId, actorName: person.userName, roleName: person.roleId })
  }
})

test('公共站送货登记仍是现场送货人，不因管理员管理废弃改变原送货事实', () => {
  const delivery = resolveSewingSelfReturnRegistrationActor(runtime, '现场车缝送货人', lock)
  assert.equal(delivery.actorId, `PUBLIC-PDA-COURIER:${runtime.factoryId}:${encodeURIComponent('现场车缝送货人')}`)
  assert.equal(delivery.actorName, '现场车缝送货人'); assert.equal(delivery.roleName, '车缝厂送货人员')
  assert.notEqual(delivery.actorId, resolveSewingSelfReturnDiscardActor(runtime, lock).actorId)
  assert.throws(() => resolveSewingSelfReturnRegistrationActor(runtime, '', lock), /送货人姓名/)
})
