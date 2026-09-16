import assert from 'node:assert/strict'
import test from 'node:test'

import '../../src/data/fcs/design-revision-process-work-order-adapter.ts'
import {
  bindDesignRevisionApprovedProfessionalResult,
  prepareDesignRevisionProcessWorkOrders,
  readDesignRevisionProcessWorkOrderStatuses,
  type DesignRevisionProcessWorkOrderReference,
} from '../../src/data/pcs-design-revision-process-work-order-port.ts'
import {
  acceptPrintWorkOrderPdaTask,
  assignPrintingWorkOrder,
  getPrintWorkOrderById,
} from '../../src/data/fcs/printing-task-domain.ts'
import {
  acceptDyeWorkOrderPdaTask,
  assignDyeWorkOrderFactory,
  getDyeWorkOrderById,
} from '../../src/data/fcs/dyeing-task-domain.ts'
import {
  createDesignRevisionProcessMaterialTransfer,
  getDesignRevisionProcessMaterialTransferReadiness,
} from '../../src/data/fcs/design-revision-material-transfer.ts'
import { approveFactoryTransfer, listFactoryReceivingSources } from '../../src/data/fcs/factory-receiving.ts'
import { listFactoryMasterRecords } from '../../src/data/fcs/factory-master-store.ts'

const attachment = {
  fileId: 'FILE-DR-READY-01',
  fileName: 'approved-result.png',
  mimeType: 'image/png',
  sizeBytes: 12,
  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
}

function createProcessOrders(): DesignRevisionProcessWorkOrderReference[] {
  const transaction = prepareDesignRevisionProcessWorkOrders({
    designRevisionTaskId: 'ES-DR-READY-01',
    designRevisionTaskNo: 'ES-DR-READY-01',
    targetSpuCode: 'STYLE-READY-01',
    targetSpuName: '结果接线测试款',
    createdAt: '2026-09-15 11:00:00',
    createdBy: '买手-测试',
    receivingTeamId: 'TEAM-SAMPLE',
    receivingTeamName: '制作团队',
    receivingFactoryId: 'ID-F014',
    receivingFactoryName: 'CV Satellite Tangerang Barat',
    receivingLocationId: 'LOC-SAMPLE',
    receivingLocationName: '销售展示样衣制作区',
    lines: [
      {
        processType: 'DYEING', professionalTaskId: 'TASK-COLOR-READY-01', professionalTaskNo: '调色任务-01', targetSpuImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        targetColorId: 'COLOR-READY-01', targetColor: '海军蓝', bomVersionId: 'BOM-READY-01', bomVersionLabel: 'BOM V1',
        bomItemId: 'BOM-LINE-READY-01', materialId: 'MAT-READY-01', materialSkuId: 'SKU-READY-01', materialSkuCode: 'SKU-READY-01', materialName: '全棉面料', materialType: '面料', materialReceivingKind: 'FABRIC', materialImageUrl: '/products/fabric-cotton-blue.jpg', materialComposition: '100% 棉', materialSpecification: '150cm / 180G', plannedQty: 20, qtyUnit: 'Yard',
      },
      {
        processType: 'PRINTING', professionalTaskId: 'TASK-ART-READY-01', professionalTaskNo: '花型任务-01', targetSpuImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        targetColorId: 'COLOR-READY-01', targetColor: '海军蓝', bomVersionId: 'BOM-READY-01', bomVersionLabel: 'BOM V1',
        bomItemId: 'BOM-LINE-READY-01', materialId: 'MAT-READY-01', materialSkuId: 'SKU-READY-01', materialSkuCode: 'SKU-READY-01', materialName: '全棉面料', materialType: '面料', materialReceivingKind: 'FABRIC', materialImageUrl: '/products/fabric-cotton-blue.jpg', materialComposition: '100% 棉', materialSpecification: '150cm / 180G', plannedQty: 20, qtyUnit: 'Yard',
      },
    ],
  })
  return transaction.commit()
}

test('设计改款加工单等待买手审核成果，绑定真实附件后才可安排，先染后印继续受前序交出约束', () => {
  const refs = createProcessOrders()
  const dyeRef = refs.find((ref) => ref.processType === 'DYEING')!
  const printRef = refs.find((ref) => ref.processType === 'PRINTING')!

  assert.deepEqual(readDesignRevisionProcessWorkOrderStatuses(refs).map((item) => item.status), [
    'WAIT_PROFESSIONAL_RESULT',
    'WAIT_PROFESSIONAL_RESULT',
  ])
  assert.equal(getDesignRevisionProcessMaterialTransferReadiness('DYEING', dyeRef.processOrderId).status, 'WAIT_PROFESSIONAL_RESULT')
  assert.throws(
    () => assignDyeWorkOrderFactory(dyeRef.processOrderId, { factoryId: '', factoryName: '', assignedAt: '2026-09-15 11:10:00', assignedBy: 'PPIC' }),
    /等待买手审核调色成果/,
  )
  assert.throws(
    () => assignPrintingWorkOrder(printRef.processOrderId, { factoryId: 'FAC-FLOWER', operatorName: 'PPIC' }),
    /等待买手审核花型成果/,
  )

  bindDesignRevisionApprovedProfessionalResult({
    designRevisionTaskId: 'ES-DR-READY-01', professionalTaskId: 'TASK-COLOR-READY-01', professionalResultId: 'COLOR-RESULT-01', professionalResultVersion: 'V1',
    approvedAt: '2026-09-15 11:20:00', approvedBy: '买手-测试', attachments: [attachment],
    processWorkOrderRefs: [dyeRef],
  })
  bindDesignRevisionApprovedProfessionalResult({
    designRevisionTaskId: 'ES-DR-READY-01', professionalTaskId: 'TASK-ART-READY-01', professionalResultId: 'ART-RESULT-01', professionalResultVersion: 'V2',
    approvedAt: '2026-09-15 11:21:00', approvedBy: '买手-测试', attachments: [{ ...attachment, fileId: 'FILE-DR-READY-02', fileName: 'artwork.png' }],
    processWorkOrderRefs: [printRef],
  })

  const dye = getDyeWorkOrderById(dyeRef.processOrderId)!
  const print = getPrintWorkOrderById(printRef.processOrderId)!
  assert.equal(dye.sourceSnapshot?.professionalResultId, 'COLOR-RESULT-01')
  assert.equal(dye.sourceSnapshot?.professionalResultAttachments?.[0].fileId, 'FILE-DR-READY-01')
  assert.equal(dye.sourceSnapshot?.downstreamWorkOrderId, print.printOrderId)
  assert.equal(dye.sampleStatus, 'DONE')
  assert.equal(print.sourceSnapshot?.professionalResultId, 'ART-RESULT-01')
  assert.equal(print.sourceSnapshot?.professionalResultAttachments?.[0].fileId, 'FILE-DR-READY-02')
  assert.equal(print.sourceSnapshot?.upstreamWorkOrderId, dye.dyeOrderId)
  assert.deepEqual(readDesignRevisionProcessWorkOrderStatuses(refs).map((item) => item.status), [
    'WAIT_ASSIGNMENT',
    'WAIT_ASSIGNMENT',
  ])
  assert.equal(getDesignRevisionProcessMaterialTransferReadiness('DYEING', dyeRef.processOrderId).status, 'WAIT_ASSIGNMENT')

  assignPrintingWorkOrder(print.printOrderId, { factoryId: 'FAC-FLOWER', operatorName: 'PPIC' })
  acceptPrintWorkOrderPdaTask(print.taskId, '印花工厂')
  const printStatus = readDesignRevisionProcessWorkOrderStatuses([printRef])[0]
  assert.equal(printStatus.status, 'WAIT_PREREQUISITE_PROCESS')
  assert.match(printStatus.blockReason, /等待染色交出/)
  assert.equal(getDesignRevisionProcessMaterialTransferReadiness('PRINTING', print.printOrderId).status, 'WAIT_UPSTREAM')

  const dyeFactory = listFactoryMasterRecords().find((candidate) => candidate.status === 'active' && candidate.eligibility.allowDispatch && candidate.processAbilities.some((ability) => ability.processCode === 'DYE' && (ability.status ?? 'ACTIVE') === 'ACTIVE' && ability.canReceiveTask !== false))
  assert.ok(dyeFactory)
  assignDyeWorkOrderFactory(dye.dyeOrderId, { factoryId: dyeFactory.id, factoryName: dyeFactory.name, assignedAt: '2026-09-15 11:22:00', assignedBy: 'PPIC' })
  acceptDyeWorkOrderPdaTask(dye.taskId, '染色工厂', '2026-09-15 11:23:00')
  assert.equal(getDesignRevisionProcessMaterialTransferReadiness('DYEING', dye.dyeOrderId).status, 'READY')
  const transfer = createDesignRevisionProcessMaterialTransfer({ processType: 'DYEING', processOrderId: dye.dyeOrderId, issuedBy: '面料仓管', issuedAt: '2026-09-15 11:24:00' })
  assert.equal(getDesignRevisionProcessMaterialTransferReadiness('DYEING', dye.dyeOrderId).status, 'EXISTING')
  assert.equal(listFactoryReceivingSources(dyeFactory.id).some((item) => item.id === transfer.id), false, '待审核调拨不能提前作为可收来源')
  approveFactoryTransfer(transfer.id, '面料仓主管', '2026-09-15 11:25:00')
  assert.equal(listFactoryReceivingSources(dyeFactory.id).some((item) => item.id === transfer.id), true, '仓库审核后加工厂才能按真实原单收料')
  assert.throws(
    () => createDesignRevisionProcessMaterialTransfer({ processType: 'PRINTING', processOrderId: print.printOrderId, issuedBy: '面料仓管', issuedAt: '2026-09-15 11:25:00' }),
    /应接收前序染色交出物/,
  )
})

test('专业成果没有真实附件时保持未绑定', () => {
  const refs = createProcessOrders().filter((ref) => ref.processType === 'DYEING')
  assert.throws(() => bindDesignRevisionApprovedProfessionalResult({
    designRevisionTaskId: 'ES-DR-READY-01', professionalTaskId: 'TASK-COLOR-READY-01', professionalResultId: 'COLOR-RESULT-BAD', professionalResultVersion: 'V1',
    approvedAt: '2026-09-15 11:30:00', approvedBy: '买手-测试', attachments: [{ ...attachment, dataUrl: '/not-an-upload.png' }],
    processWorkOrderRefs: refs,
  }), /真实附件/)
})
