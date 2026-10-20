import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { confirmLaceReceipt, listLaceHandovers, listLaceReceipts, resetLaceFactoryRuntime, WLS_ACCESSORY_CLERK, WLS_ACCESSORY_SUPERVISOR } from '../../src/data/fcs/lace-factory-domain.ts'

beforeEach(() => resetLaceFactoryRuntime())
const source = () => listLaceHandovers(undefined, WLS_ACCESSORY_CLERK).find(row => row.receiptStatus === '待收货')!

test('LACE 多收分别保留实际收货人与确认主管，旧单调用默认沿用原收货人员', () => {
  const handover = source()
  const receivedBy = { actorId: 'LACE-ACTUAL-RECEIVER', actorName: '实际清点员' }
  const result = confirmLaceReceipt({ handoverId: handover.handoverId, actualQty: handover.qty + 1, differenceReason: '实物多到1码', evidence: '实物凭证.jpg', warehouseLocation: 'A-01', overReceiptConfirmed: true, clientActionId: 'LACE-TWO-RESPONSIBILITIES', actor: WLS_ACCESSORY_SUPERVISOR, receivedBy })
  assert.equal(result.receivedById, receivedBy.actorId)
  assert.equal(result.receivedByName, receivedBy.actorName)
  assert.equal(result.overReceiptConfirmedById, WLS_ACCESSORY_SUPERVISOR.actorId)
  assert.equal(result.overReceiptConfirmedByName, WLS_ACCESSORY_SUPERVISOR.actorName)
  assert.deepEqual(listLaceReceipts().find(row => row.receiptId === result.receiptId), result)
  resetLaceFactoryRuntime()
  const ordinary = source()
  const legacy = confirmLaceReceipt({ handoverId: ordinary.handoverId, actualQty: ordinary.qty, differenceReason: '', evidence: '', warehouseLocation: 'A-01', clientActionId: 'LACE-LEGACY-RECEIVER', actor: WLS_ACCESSORY_CLERK })
  assert.equal(legacy.receivedById, WLS_ACCESSORY_CLERK.actorId)
  assert.equal(legacy.receivedByName, WLS_ACCESSORY_CLERK.actorName)
  assert.equal(legacy.overReceiptConfirmedById, undefined)
})

test('LACE 明确提供收货人时必须有姓名和身份，实际收货人不会放宽超收主管校验', () => {
  const handover = source(), before = listLaceReceipts()
  const common = { handoverId: handover.handoverId, actualQty: handover.qty + 1, differenceReason: '实物多到1码', evidence: '凭证.jpg', warehouseLocation: 'A-01', overReceiptConfirmed: true }
  assert.throws(() => confirmLaceReceipt({ ...common, clientActionId: 'LACE-NAME-MISSING', actor: WLS_ACCESSORY_SUPERVISOR, receivedBy: { actorId: 'RECEIVER', actorName: ' ' } }), /实际收货人/)
  assert.throws(() => confirmLaceReceipt({ ...common, clientActionId: 'LACE-NO-SUPERVISOR', actor: WLS_ACCESSORY_CLERK, receivedBy: { actorId: 'RECEIVER', actorName: '清点员' } }), /主管/)
  assert.deepEqual(listLaceReceipts(), before)
})
