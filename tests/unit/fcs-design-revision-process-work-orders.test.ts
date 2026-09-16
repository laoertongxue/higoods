import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ensureProcessWorkOrders,
  setProcessWorkOrderGenerationCommitFailureForTest,
  type ProcessWorkOrderGenerationInput,
} from '../../src/data/fcs/process-work-order-generation-service.ts'
import { getPrintWorkOrderById, listPrintWorkOrders } from '../../src/data/fcs/printing-task-domain.ts'
import { getDyeWorkOrderById, listDyeWorkOrders } from '../../src/data/fcs/dyeing-task-domain.ts'
import { getProcessOrderTaskRelationView } from '../../src/data/fcs/process-order-task-links.ts'
import { getDyeWorkOrderThreeAxisView } from '../../src/data/fcs/process-order-three-axis-view.ts'
import { buildTaskRouteCardPrintDoc } from '../../src/data/fcs/task-print-cards.ts'
import { getPlatformProcessResultView } from '../../src/data/fcs/platform-process-result-view.ts'
import { normalizeProcessWorkOrderSourceSnapshot } from '../../src/data/fcs/process-work-order-generation-key.ts'

function designRevisionInput(suffix: string, overrides: Partial<ProcessWorkOrderGenerationInput> = {}): ProcessWorkOrderGenerationInput {
  return {
    source: {
      sourceType: 'DESIGN_REVISION',
      designRevisionTaskId: `ES-DR-${suffix}`,
      designRevisionTaskNo: `ES-DR-${suffix}`,
      professionalTaskId: `PT-${suffix}`,
      professionalTaskNo: `HT-${suffix}`,
      professionalResultId: `RESULT-${suffix}`,
      professionalResultVersion: 'V2',
      targetSpuCode: `STYLE-${suffix}`,
      targetSpuName: '设计改款测试款',
      targetSpuImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      targetColorId: `COLOR-${suffix}`,
      targetColorName: '经典蓝',
      bomVersionId: `BOM-V-${suffix}`,
      bomVersionLabel: 'BOM 方案 V2',
      bomItemId: `BOM-LINE-${suffix}`,
      bomItemIds: [`BOM-LINE-${suffix}`],
      materialSkuCode: `FAB-${suffix}`,
      materialName: '棉混纺面料',
      materialReceivingKind: 'FABRIC',
      materialImageUrl: '/products/fabric-cotton-blue.jpg',
      materialColor: '经典蓝',
      materialComposition: '100% 棉',
      materialSpecification: '150cm / 180G',
      receivingTeamId: 'TEAM-SAMPLE',
      receivingTeamName: '样衣团队',
      receivingFactoryId: 'ID-F014',
      receivingFactoryName: 'CV Satellite Tangerang Barat',
      receivingLocationId: 'LOC-SAMPLE-MATERIAL',
      receivingLocationName: '销售展示样衣用料区',
    },
    processCodes: ['DYE', 'PRINT'],
    orderedAt: '2026-09-15 10:00:00',
    materialId: `FAB-${suffix}`,
    materialName: '棉混纺面料',
    materialItems: [{ sourceBomItemId: `BOM-LINE-${suffix}`, materialId: `FAB-${suffix}`, materialName: '棉混纺面料', materialType: '面料' }],
    targetColor: '经典蓝',
    plannedQty: 60,
    qtyUnit: 'Yard',
    dyeProcessName: '面料染色',
    printProcessName: '数码印花',
    spuCode: `STYLE-${suffix}`,
    spuName: '设计改款测试款',
    requiredDeliveryDate: '2026-09-20',
    createdBy: '买手-测试',
    ...overrides,
  }
}

test('设计改款可成批生成染色和印花加工单，且完整投影来源与上下游', () => {
  const result = ensureProcessWorkOrders(designRevisionInput('FLOW-01'))
  assert.ok(result.dyeWorkOrderId)
  assert.ok(result.printWorkOrderId)

  const dye = getDyeWorkOrderById(result.dyeWorkOrderId)
  const print = getPrintWorkOrderById(result.printWorkOrderId)
  assert.ok(dye)
  assert.ok(print)
  for (const order of [dye, print]) {
    assert.equal(order.sourceType, 'DESIGN_REVISION')
    assert.equal(order.sourceSnapshot?.designRevisionTaskNo, 'ES-DR-FLOW-01')
    assert.equal(order.sourceSnapshot?.professionalTaskNo, 'HT-FLOW-01')
    assert.equal(order.sourceSnapshot?.professionalResultVersion, 'V2')
    assert.equal(order.sourceSnapshot?.targetSpuCode, 'STYLE-FLOW-01')
    assert.equal(order.sourceSnapshot?.bomVersionId, 'BOM-V-FLOW-01')
    assert.equal(order.sourceProductionOrderId, undefined)
    assert.equal(order.formalProductionOrderSnapshot, undefined)
    assert.match(order.remark || '', /来源设计改款任务/)
  }
  assert.equal(dye.sourceSnapshot?.downstreamWorkOrderId, print.printOrderId)
  assert.equal(print.sourceSnapshot?.upstreamWorkOrderId, dye.dyeOrderId)

  const dyeRelation = getProcessOrderTaskRelationView(dye.dyeOrderId)
  const printRelation = getProcessOrderTaskRelationView(print.printOrderId)
  assert.ok(dyeRelation?.predecessors.some((item) => item.documentId === 'PT-FLOW-01'))
  assert.ok(dyeRelation?.successors.some((item) => item.documentId === print.printOrderId))
  assert.ok(printRelation?.predecessors.some((item) => item.documentId === dye.dyeOrderId))

  const axes = getDyeWorkOrderThreeAxisView(dye)
  assert.equal(axes.receiver.ready, true)
  assert.equal(axes.receiver.downstreamOrderNo, print.printOrderNo)

  const printDoc = buildTaskRouteCardPrintDoc({ sourceType: 'PRINTING_WORK_ORDER', sourceId: print.printOrderId })
  assert.ok(printDoc.summaryRows.some((row) => row.label === '设计改款任务' && row.value === 'ES-DR-FLOW-01'))
  assert.ok(printDoc.summaryRows.some((row) => row.label === '专业结果' && row.value.includes('V2')))

  assert.equal(getPlatformProcessResultView('PRINT', print.printOrderId)?.productionOrderNo, 'ES-DR-FLOW-01')
})

test('设计改款加工单生成幂等，重复请求不增加单据', () => {
  const input = designRevisionInput('IDEMPOTENT-02')
  const first = ensureProcessWorkOrders(input)
  const dyeCount = listDyeWorkOrders().filter((item) => item.sourceSnapshot?.designRevisionTaskId === input.source.designRevisionTaskId).length
  const printCount = listPrintWorkOrders().filter((item) => item.sourceSnapshot?.designRevisionTaskId === input.source.designRevisionTaskId).length
  const second = ensureProcessWorkOrders(input)
  assert.deepEqual(second, first)
  assert.equal(listDyeWorkOrders().filter((item) => item.sourceSnapshot?.designRevisionTaskId === input.source.designRevisionTaskId).length, dyeCount)
  assert.equal(listPrintWorkOrders().filter((item) => item.sourceSnapshot?.designRevisionTaskId === input.source.designRevisionTaskId).length, printCount)
})

test('同一设计改款任务的不同颜色和 BOM 行分别生成加工单', () => {
  const first = ensureProcessWorkOrders(designRevisionInput('SPLIT-03'))
  const secondInput = designRevisionInput('SPLIT-03')
  secondInput.source = {
    ...secondInput.source,
    targetColorId: 'COLOR-SPLIT-03-B',
    targetColorName: '珍珠白',
    bomItemId: 'BOM-LINE-SPLIT-03-B',
    bomItemIds: ['BOM-LINE-SPLIT-03-B'],
  }
  secondInput.materialId = 'FAB-SPLIT-03-B'
  secondInput.materialItems = [{ sourceBomItemId: 'BOM-LINE-SPLIT-03-B', materialId: 'FAB-SPLIT-03-B', materialName: '珍珠白面料' }]
  const second = ensureProcessWorkOrders(secondInput)
  assert.notEqual(second.dyeWorkOrderId, first.dyeWorkOrderId)
  assert.notEqual(second.printWorkOrderId, first.printWorkOrderId)
})

test('成批提交失败时染色与印花加工单一起回滚', () => {
  const input = designRevisionInput('ROLLBACK-04')
  setProcessWorkOrderGenerationCommitFailureForTest('PRINT')
  assert.throws(() => ensureProcessWorkOrders(input), /模拟印花加工单提交失败/)
  setProcessWorkOrderGenerationCommitFailureForTest(null)
  assert.equal(listDyeWorkOrders().some((item) => item.sourceSnapshot?.designRevisionTaskId === input.source.designRevisionTaskId), false)
  assert.equal(listPrintWorkOrders().some((item) => item.sourceSnapshot?.designRevisionTaskId === input.source.designRevisionTaskId), false)
})

test('设计改款来源缺关键引用或来源未知时必须阻断', () => {
  const missingTask = designRevisionInput('INVALID-05')
  missingTask.source = { ...missingTask.source, professionalTaskId: undefined }
  assert.throws(() => ensureProcessWorkOrders(missingTask), /必须携带专业任务 ID/)
  assert.throws(
    () => normalizeProcessWorkOrderSourceSnapshot({ sourceType: 'UNKNOWN' } as never),
    /来源类型无效/,
  )

  const production = normalizeProcessWorkOrderSourceSnapshot({
    sourceType: 'PRODUCTION_ORDER',
    productionOrderId: 'PO-KEEP',
    productionOrderNo: 'PO-KEEP',
    techPackVersionId: 'TP-KEEP',
    techPackVersionLabel: 'V1',
    bomItemId: 'BOM-KEEP',
  })
  assert.equal(production.sourceType, 'PRODUCTION_ORDER')
  assert.equal(production.productionOrderNo, 'PO-KEEP')
})
