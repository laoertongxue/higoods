import assert from 'node:assert/strict'
import test from 'node:test'
import { createEngineeringMasterOrder, listEngineeringMasterOrders, resetEngineeringMasterRepository } from '../../src/data/pcs-engineering-master-repository.ts'
import { getTestingOrderById, hasPassedTestingOrder, updateTestingOrder } from '../../src/data/pcs-testing-order-repository.ts'
import { buildFirstProductionQualificationFact } from '../../src/data/pcs-engineering-first-production-policy.ts'

test('生产准备必须读取测款最终通过事实，保存时重新校验且失败不生成主单', () => {
  resetEngineeringMasterRepository()
  const order = getTestingOrderById('to_seed_history')!
  assert.ok(order)
  const original = { ...order }
  const input = {
    styleId: order.styleId, styleCode: order.styleCode,
    merchandiserName: '测试跟单', merchandiserId: 'test', createdBy: '测试跟单', createdById: 'test', createdByRole: '跟单',
    qualificationFact: buildFirstProductionQualificationFact({ styleCode: order.styleCode, hasFormalSale: false, formalSaleSource: '测试事实', checkedAt: '2026-09-24 10:00' }),
    bulkProductionQualification: { basisType: 'TEST_APPROVED' as const, triggerBusinessObjectType: '测款单', triggerBusinessObjectId: order.testingOrderId, thresholdQuantity: 0, reachedQuantity: 0, reachedAt: '2026-09-24 10:00', reason: '测款通过', uniqueTriggerKey: 'eligibility-test' },
    creationReason: '资格校验测试',
  }
  try {
    // Invalid facts may not be forged through the general editing entry point.
    for (const patch of [
      { status: '进行中' as const, bulkDecision: '' as const },
      { bulkDecision: '待定' as const },
      { status: '已结束' as const, bulkDecision: '否' as const },
      { bulkDecision: '是' as const },
    ]) assert.throws(() => updateTestingOrder(order.testingOrderId, patch), /对应业务动作/)
    assert.equal(hasPassedTestingOrder('no-testing-style'), false)
    const rejected = getTestingOrderById('to_seed_buyer_kill')!
    assert.throws(() => createEngineeringMasterOrder({ ...input, styleId: rejected.styleId, styleCode: rejected.styleCode, qualificationFact: { ...input.qualificationFact, styleCode: rejected.styleCode }, bulkProductionQualification: { ...input.bulkProductionQualification, triggerBusinessObjectId: rejected.testingOrderId } }), /尚未测款通过/)
    assert.equal(listEngineeringMasterOrders().length, 0)
    assert.equal(hasPassedTestingOrder(order.styleId), true)
    assert.deepEqual(getTestingOrderById(order.testingOrderId), original)
    const created = createEngineeringMasterOrder(input)
    assert.equal(created.styleId, order.styleId)
    assert.equal(created.status, '草稿')
  } finally { resetEngineeringMasterRepository() }
})
