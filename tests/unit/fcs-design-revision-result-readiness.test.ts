import { getDyeWorkOrderProgressView } from '../../src/data/fcs/process-order-three-axis-view.ts'
import assert from 'node:assert/strict'
import { listHandoverOrdersByTaskId } from '../../src/data/fcs/pda-handover-events.ts'
import test from 'node:test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import '../../src/data/fcs/design-revision-process-work-order-adapter.ts'
import {
  bindDesignRevisionApprovedProfessionalResult,
  prepareDesignRevisionProcessWorkOrders,
  readDesignRevisionProcessWorkOrderStatuses,
  type DesignRevisionProcessWorkOrderReference,
} from '../../src/data/pcs-design-revision-process-work-order-port.ts'
import {
  PRINTING_DEMAND_SOURCE_LABEL,
  acceptPrintWorkOrderPdaTask,
  assignPrintingWorkOrder,
  completePrintWorkOrderDocument,
  completePrintingWorkOrder,
  confirmPrintingDispatch,
  createPrintingDispatch,
  getPrintWorkOrderById,
  getPrintingWorkOrderById,
  getPrintingWorkflowFacts,
  markPrintingRollBarcodesPrinted,
  recordPrintingProductionStage,
  scanPrintingDispatchRoll,
  startPrintingProduction,
  submitPrintHandover,
  updatePrintingRollBarcode,
  updatePrintingOrderInformation,
} from '../../src/data/fcs/printing-task-domain.ts'
import {
  acceptDyeWorkOrderPdaTask,
  assignDyeWorkOrderFactory,
  completeDyeNode,
  completeDyeWorkOrderDocument,
  completeDyeing,
  createDyeDispatchDocument,
  finishDyeDispatchDocument,
  getDyeDispatchPartner,
  getDyeWorkOrderById,
  listDyeDispatchDocuments,
  listDyeVatOptions,
  markDyeOutputRolls,
  planDyeVat,
  saveDyeDispatchTransport,
  saveDyeOutputRolls,
  scanDyeDispatchRoll,
  startDyeNode,
  startDyeing,
} from '../../src/data/fcs/dyeing-task-domain.ts'
import {
  confirmDesignRevisionWarehouseDispatch,
  createDesignRevisionProcessMaterialTransfer,
  getDesignRevisionProcessMaterialTransferReadiness,
  getDesignRevisionMaterialTransferPlan,
} from '../../src/data/fcs/design-revision-material-transfer.ts'
import { captureFactoryReceivingData, FACTORY_RECEIVING_KEY, approveFactoryTransfer, getDefaultFactoryReceiptPosition, getSourceActualReceipts, listFactoryReceivingSources, registerFactoryReceivingSource } from '../../src/data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt } from '../../src/data/fcs/factory-receiving-links.ts'
import { listFactoryMasterRecords } from '../../src/data/fcs/factory-master-store.ts'
import { GOTO_GLOBAL_FACTORY_ID, GOTO_GLOBAL_FACTORY_NAME } from '../../src/data/fcs/factory-mock-data.ts'
import { listFactoryInternalWarehouses } from '../../src/data/fcs/factory-internal-warehouse-locations.ts'
import { listPrintingFactoryOptions } from '../../src/data/fcs/printing-factories.ts'
import { PROCESS_WORK_ORDER_SOURCE_LABEL } from '../../src/data/fcs/process-work-order-domain.ts'
import { formatProcessQuantityWithUnit, getQuantityLabel } from '../../src/data/fcs/process-quantity-labels.ts'
import { buildDyeWorkOrderCsv, listDyeWorkOrderOnlineRows } from '../../src/data/fcs/dye-work-order-online-view.ts'
import { DYE_FACTORY_TABS } from '../../src/data/fcs/dye-work-order-demo-details.ts'
import { buildDyeWorkOrderTimes } from '../../src/data/fcs/dye-work-order-times.ts'
import { printingDemandFields, renderPrintingDemandSource } from '../../src/pages/process-factory/printing/presentation.ts'
import { printingWorkOrderTimeGroups } from '../../src/pages/process-factory/printing/work-order-times.ts'
import { renderDyeDispatchPrint } from '../../src/pages/process-factory/dyeing/dispatch-print.ts'
import { createDyeOrderDisplayColumns, createPrintingOrderDisplayColumns } from '../../src/pages/process-work-orders/order-list-columns.ts'
import {
  DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS,
  confirmEngineeringIndependentSamplingScheme,
  createEngineeringIndependentSampling,
  listEngineeringIndependentAvailablePatternVersions,
  listEngineeringIndependentSamplingRecords,
  submitEngineeringIndependentProfessionalTask,
} from '../../src/data/pcs-engineering-master-sampling.ts'
import { saveEngineeringBomPricingPlan, saveEngineeringBomVersion } from '../../src/data/pcs-engineering-bom-repository.ts'
import { collectProjectArchiveAutoData } from '../../src/data/pcs-project-archive-collector.ts'
import { getProjectArchiveByProjectId } from '../../src/data/pcs-project-archive-repository.ts'
import { getProjectById } from '../../src/data/pcs-project-repository.ts'
import { listProjectRelationsBySourceObject } from '../../src/data/pcs-project-relation-repository.ts'
import { getStyleArchiveById } from '../../src/data/pcs-style-archive-repository.ts'

// Optional browser evidence fixtures are captured after real domain actions, never by editing statuses.
function captureBrowserEvidenceStage(stage: string): void {
  const dir = process.env.DESIGN_REVISION_EVIDENCE_DIR
  if (!dir || typeof localStorage === 'undefined') return
  const values: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) values[key] = localStorage.getItem(key)!
  }
  values[FACTORY_RECEIVING_KEY] = JSON.stringify(captureFactoryReceivingData())
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${stage}.json`), JSON.stringify(values))
}

const attachment = {
  fileId: 'FILE-DR-READY-01',
  fileName: 'approved-result.png',
  mimeType: 'image/png',
  sizeBytes: 12,
  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
}

function createProcessOrders(processTypes: Array<'DYEING' | 'PRINTING'> = ['DYEING', 'PRINTING'], taskId?: string, accessory = false): DesignRevisionProcessWorkOrderReference[] {
  const sourceTaskId = taskId || (processTypes.length === 2 ? 'ES-DR-READY-01' : `ES-DR-READY-${processTypes[0]}`)
  const transaction = prepareDesignRevisionProcessWorkOrders({
    designRevisionTaskId: sourceTaskId,
    designRevisionTaskNo: sourceTaskId,
    targetSpuCode: 'STYLE-READY-01',
    targetSpuName: '结果接线测试款',
    createdAt: '2026-09-15 11:00:00',
    createdBy: '买手-测试',
    receivingTeamId: 'TEAM-SAMPLE',
    receivingTeamName: '制作团队',
    receivingFactoryId: GOTO_GLOBAL_FACTORY_ID,
    receivingFactoryName: GOTO_GLOBAL_FACTORY_NAME,
    receivingLocationId: 'LOC-SAMPLE',
    receivingLocationName: '销售展示样衣制作区',
    lines: [
      {
        processType: 'DYEING', professionalTaskId: 'TASK-COLOR-READY-01', professionalTaskNo: '调色任务-01', targetSpuImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        targetColorId: 'COLOR-READY-01', targetColor: '海军蓝', bomVersionId: 'BOM-READY-01', bomVersionLabel: 'BOM V1',
        bomItemId: 'BOM-LINE-READY-01', materialId: 'MAT-READY-01', materialSkuId: 'SKU-RAW-01', materialSkuCode: 'SKU-RAW-01', targetMaterialSkuId: 'SKU-PRINT-01', targetMaterialSkuCode: 'SKU-PRINT-01', rawMaterialSkuCode: 'SKU-RAW-01', dyedMaterialSkuId: 'SKU-DYED-01', dyedMaterialSkuCode: 'SKU-DYED-01', pantoneCode: '11-0601 TPX', patternCode: 'FLOWER-01', patternImageUrl: '/products/fabric-cotton-blue.jpg', materialName: '全棉面料', materialType: '面料', materialReceivingKind: 'FABRIC', materialImageUrl: '/products/fabric-cotton-blue.jpg', materialComposition: '100% 棉', materialSpecification: '150cm / 180G', plannedQty: 20, qtyUnit: 'Yard',
      },
      {
        processType: 'PRINTING', professionalTaskId: 'TASK-ART-READY-01', professionalTaskNo: '花型任务-01', targetSpuImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        targetColorId: 'COLOR-READY-01', targetColor: '海军蓝', bomVersionId: 'BOM-READY-01', bomVersionLabel: 'BOM V1',
        bomItemId: 'BOM-LINE-READY-01', materialId: 'MAT-READY-01', materialSkuId: 'SKU-DYED-01', materialSkuCode: 'SKU-DYED-01', targetMaterialSkuId: 'SKU-PRINT-01', targetMaterialSkuCode: 'SKU-PRINT-01', rawMaterialSkuCode: 'SKU-RAW-01', dyedMaterialSkuId: 'SKU-DYED-01', dyedMaterialSkuCode: 'SKU-DYED-01', pantoneCode: '11-0601 TPX', patternCode: 'FLOWER-01', patternImageUrl: '/products/fabric-cotton-blue.jpg', materialName: '全棉面料', materialType: '面料', materialReceivingKind: 'FABRIC', materialImageUrl: '/products/fabric-cotton-blue.jpg', materialComposition: '100% 棉', materialSpecification: '150cm / 180G', plannedQty: 20, qtyUnit: 'Yard',
      },
    ].filter((line) => processTypes.includes(line.processType as 'DYEING' | 'PRINTING')).map((line) => accessory ? {
      ...line, materialId: 'MAT-ACCESSORY-01', materialType: '辅料', materialReceivingKind: 'ACCESSORY' as const,
      materialName: '欧根纱刺绣蕾丝小花', materialImageUrl: '/materials/archive/8e7910031d7e27bed3951f0369555a83.png',
      materialSkuId: 'ACCESSORY-DYED-01', materialSkuCode: 'ACCESSORY-DYED-01', rawMaterialSkuCode: 'ACCESSORY-RAW-01',
      targetMaterialSkuId: 'ACCESSORY-DYED-01', targetMaterialSkuCode: 'ACCESSORY-DYED-01', plannedQty: 6, qtyUnit: 'PCS',
    } : line),
  })
  return transaction.commit()
}

test('设计改款染后印花必须先分配印花厂，染色交出不能误送中央工厂', () => {
  const refs = createProcessOrders(['DYEING', 'PRINTING'], 'ES-DR-PRINT-RECEIVER-GUARD')
  const dyeRef = refs.find((ref) => ref.processType === 'DYEING')!
  const printRef = refs.find((ref) => ref.processType === 'PRINTING')!
  assert.throws(() => getDyeDispatchPartner(dyeRef.processOrderId), /先给后续印花加工单分配印花厂/)
  const printFactory = listPrintingFactoryOptions()[0]!
  assignPrintingWorkOrder(printRef.processOrderId, { factoryId: printFactory.id, operatorName: 'PPIC' })
  const receiver = getDyeDispatchPartner(dyeRef.processOrderId)
  assert.equal(receiver.id, printFactory.id)
  assert.equal(receiver.name, printFactory.name)
})

test('仅染与仅印分别创建一张加工单和一条仓库首道调拨计划', () => {
  const centralFactory = listFactoryMasterRecords().find((item) => item.id === GOTO_GLOBAL_FACTORY_ID)
  assert.equal(centralFactory?.factoryType, 'CENTRAL_GARMENT')
  assert.equal(listPrintingFactoryOptions().some((item) => item.id === GOTO_GLOBAL_FACTORY_ID), false)
  assert.equal(DYE_FACTORY_TABS.some((item) => item.id === GOTO_GLOBAL_FACTORY_ID), false)
  assert.equal(listFactoryInternalWarehouses(GOTO_GLOBAL_FACTORY_ID).some((item) => item.factoryKind === 'CENTRAL_GARMENT' && item.warehouseKind === 'WAIT_PROCESS'), true)
  assert.ok(getDefaultFactoryReceiptPosition(GOTO_GLOBAL_FACTORY_ID).locationId)
  assert.equal(PROCESS_WORK_ORDER_SOURCE_LABEL.DESIGN_REVISION, '设计改款任务')
  assert.equal(PRINTING_DEMAND_SOURCE_LABEL.DESIGN_REVISION, '设计改款任务')
  for (const processType of ['DYEING', 'PRINTING'] as const) {
    const refs = createProcessOrders([processType])
    assert.equal(refs.length, 1)
    assert.equal(refs[0].processType, processType)
    assert.equal(refs[0].prerequisiteProcessOrderId, '')
    if (processType === 'PRINTING') {
      const order = getPrintWorkOrderById(refs[0].processOrderId)!
      assert.equal(order.receiverKind, 'FACTORY')
      assert.equal(order.receiverName, '制作团队')
    }
    const transfer = getDesignRevisionProcessMaterialTransferReadiness(processType, refs[0].processOrderId)
    assert.equal(transfer.plannedQty, 20)
    assert.equal(transfer.status, 'WAIT_ASSIGNMENT')
  }
})

test('辅料染色单创建后已有辅料仓调拨计划，分厂时自动落实原单但不冒充实发', () => {
  const refs = createProcessOrders(['DYEING'], 'ES-DR-ACCESSORY-01', true)
  const orderId = refs[0].processOrderId
  const plan = getDesignRevisionMaterialTransferPlan('DYEING', orderId)!
  assert.equal(plan.originName, '辅料中央仓')
  assert.equal(plan.plannedQty, 6)
  assert.equal(plan.qtyUnit, 'PCS')
  assert.equal(plan.status, 'WAIT_ASSIGNMENT')
  const factory = listFactoryMasterRecords().find((candidate) => candidate.status === 'active' && candidate.eligibility.allowDispatch && candidate.processAbilities.some((ability) => ability.processCode === 'DYE' && (ability.status ?? 'ACTIVE') === 'ACTIVE' && ability.canReceiveTask !== false))!
  assignDyeWorkOrderFactory(orderId, { factoryId: factory.id, factoryName: factory.name, assignedAt: '2026-09-15 11:22:00', assignedBy: 'PPIC' })
  const transfer = createDesignRevisionProcessMaterialTransfer({ processType: 'DYEING', processOrderId: orderId, issuedBy: '系统自动生成', issuedAt: '2026-09-15 11:22:00' })
  assert.equal(transfer.origin.name, '辅料中央仓')
  assert.equal(transfer.lines[0].plannedQty, 6)
  assert.equal(transfer.lines[0].sentQty, 0)
  assert.equal(getDesignRevisionMaterialTransferPlan('DYEING', orderId)?.status, 'WAIT_WAREHOUSE_DISPATCH')
})

test('历史双工艺加工单仍可追溯原有染印交接', () => {
  const refs = createProcessOrders()
  const dyeRef = refs.find((ref) => ref.processType === 'DYEING')!
  const printRef = refs.find((ref) => ref.processType === 'PRINTING')!
  const firstPlan = getDesignRevisionMaterialTransferPlan('DYEING', dyeRef.processOrderId)!
  const secondPlan = getDesignRevisionMaterialTransferPlan('PRINTING', printRef.processOrderId)!
  assert.deepEqual([firstPlan.originName, firstPlan.targetName], ['面料中央仓', '待分配染色厂'])
  assert.deepEqual([secondPlan.originName, secondPlan.targetName], ['待分配染色厂', '待分配印花厂'])
  const dye = getDyeWorkOrderById(dyeRef.processOrderId)!
  const print = getPrintWorkOrderById(printRef.processOrderId)!
  assert.equal(dye.colorNo, '11-0601 TPX')
  assert.equal(dye.composition, '100% 棉')
  assert.equal(dye.outputMaterial?.composition, '100% 棉')
  assert.equal(dye.width, '150cm')
  assert.equal(dye.weightGsm, 180)
  const dyeQtyContext = { processType: 'DYE', sourceId: dye.dyeOrderId, objectType: '面料', qtyUnit: 'Yard', qtyPurpose: '计划' } as const
  assert.equal(getQuantityLabel(dyeQtyContext), '计划染色面料Yard数')
  assert.equal(formatProcessQuantityWithUnit(20, dyeQtyContext), '20 Yard')
  const dyeCreationTimes = buildDyeWorkOrderTimes({
    order: dye, nodes: [], handovers: [], plannedFinishAt: '', upstreamDocumentNos: [],
    materialSku: dye.rawMaterialSku, sentQty: 0, receivedQty: 0, completedQty: 0, handedOverQty: 0, downstreamReceivedQty: 0,
    context: { sources: [], deliveries: [], receipts: [], dispatches: [] },
  })[0]
  assert.deepEqual(dyeCreationTimes.items.map((item) => item.label), ['染色加工单创建'])
  const printCreationTimes = printingWorkOrderTimeGroups(getPrintingWorkOrderById(print.printOrderId)!)[0]
  assert.deepEqual(printCreationTimes.fields.map(([label]) => label), ['加工单创建'])
  const dyeListRow = listDyeWorkOrderOnlineRows().find((row) => row.dyeOrderId === dye.dyeOrderId)!
  assert.equal(dyeListRow.materialImageUrl, '/products/fabric-cotton-blue.jpg')
  assert.deepEqual(dyeListRow.upstreamDocuments.map((document) => [document.name, document.documentNo, document.status, document.plannedQty, document.sentQty]), [
    ['面料中央仓', `DB-${dye.dyeOrderNo}`, '调拨计划已创建，待分配染色厂', 20, 0],
  ])
  const requirementColumn = createDyeOrderDisplayColumns(() => '').find((column) => column.key === 'requirement')!
  assert.doesNotMatch(requirementColumn.render!(dyeListRow), /调色任务|调色结果/)
  assert.equal(dyeListRow.designRevisionTaskNo, 'ES-DR-READY-01')
  assert.equal(dyeListRow.productionOrderNo, '')
  assert.equal(dyeListRow.purchaseOrderNo, '')
  assert.match(buildDyeWorkOrderCsv([dyeListRow], '全部'), /"设计改款任务号"/)
  assert.match(buildDyeWorkOrderCsv([dyeListRow], '全部'), /"ES-DR-READY-01"/)
  assert.deepEqual(printingDemandFields(print.businessView!).slice(0, 2).map(([label]) => label), ['需求来源', '设计改款任务'])
  assert.doesNotMatch(renderPrintingDemandSource(print.businessView!), /生产单：|需求单：/)
  const printRequirementColumn = createPrintingOrderDisplayColumns(() => '').find((column) => column.key === 'requirement')!
  assert.doesNotMatch(printRequirementColumn.render!(print.businessView!), /花型任务：|花型成果：/)
  const printOrderColumn = createPrintingOrderDisplayColumns(() => '').find((column) => column.key === 'order')!
  assert.doesNotMatch(printOrderColumn.render!(print.businessView!), /生产单：待匹配/)
  assert.equal(dye.sourceSnapshot?.downstreamWorkOrderId, print.printOrderId)
  assert.equal(print.sourceSnapshot?.upstreamWorkOrderId, dye.dyeOrderId)
  assert.equal(dye.sourceSnapshot?.inputMaterialSkuCode, 'SKU-RAW-01')
  assert.equal(print.sourceSnapshot?.inputMaterialSkuCode, 'SKU-DYED-01')
  assert.match(dye.remark, /需求来源：设计改款任务.*潘通 11-0601 TPX/)
  assert.match(print.remark, /需求来源：设计改款任务.*目标物料 SKU SKU-PRINT-01.*花型 FLOWER-01/)
  assert.doesNotMatch(`${dye.remark} ${print.remark}`, /待专业成果|调色成果|花型成果/)
  assert.equal(print.receiverKind, 'FACTORY')
  assert.equal(print.receiverName, '制作团队')
  assert.equal(print.businessView?.plannedInput.composition, '100% 棉')
  assert.equal(print.businessView?.output.composition, '100% 棉')
  assert.equal(getPrintingWorkflowFacts(print.printOrderId).artworkConfirmed, true)
  assert.equal(getPrintingWorkflowFacts(print.printOrderId).sampleConfirmed, true)
  assert.equal(getPrintingWorkflowFacts(print.printOrderId).stageLabel, '待接收物料')
  assert.throws(() => recordPrintingProductionStage(print.printOrderId, { id: 'DR-UNNEEDED-ARTWORK', stage: 'ARTWORK', action: 'FINISH', operatorName: '印花工厂' }), /目标物料 SKU/)
  const unchangedPrintRequirement = print.businessView!.requirement
  assert.throws(() => updatePrintingOrderInformation(print.printOrderId, {
    craftName: unchangedPrintRequirement.craftName, type: unchangedPrintRequirement.type,
    shade: unchangedPrintRequirement.shade, temperature: unchangedPrintRequirement.temperature,
    printSide: unchangedPrintRequirement.printSide,
    frontPattern: { ...unchangedPrintRequirement.frontPattern, patternNo: 'OTHER-PATTERN' },
    printerNo: 'PR-01', plannedFinishAt: '', remark: '', operatorName: '印花跟单员', changeReason: '擅自改花型',
  }), /目标物料 SKU/)
  assert.deepEqual(readDesignRevisionProcessWorkOrderStatuses(refs).map((item) => item.status), ['WAIT_ASSIGNMENT', 'WAIT_ASSIGNMENT'])
  assert.equal(getDesignRevisionProcessMaterialTransferReadiness('DYEING', dyeRef.processOrderId).status, 'WAIT_ASSIGNMENT')
  assert.equal(getDesignRevisionProcessMaterialTransferReadiness('PRINTING', printRef.processOrderId).status, 'WAIT_UPSTREAM')
  assignPrintingWorkOrder(print.printOrderId, { factoryId: 'FAC-FLOWER', operatorName: 'PPIC' })
  acceptPrintWorkOrderPdaTask(print.taskId, '印花工厂')
  assert.equal(readDesignRevisionProcessWorkOrderStatuses([printRef])[0].status, 'WAIT_PREREQUISITE_PROCESS')
  const dyeFactory = listFactoryMasterRecords().find((candidate) => candidate.status === 'active' && candidate.eligibility.allowDispatch && candidate.processAbilities.some((ability) => ability.processCode === 'DYE' && (ability.status ?? 'ACTIVE') === 'ACTIVE' && ability.canReceiveTask !== false))
  assert.ok(dyeFactory)
  assignDyeWorkOrderFactory(dye.dyeOrderId, { factoryId: dyeFactory.id, factoryName: dyeFactory.name, assignedAt: '2026-09-15 11:22:00', assignedBy: 'PPIC' })
  acceptDyeWorkOrderPdaTask(dye.taskId, '染色工厂', '2026-09-15 11:23:00')
  const transfer = createDesignRevisionProcessMaterialTransfer({ processType: 'DYEING', processOrderId: dye.dyeOrderId, issuedBy: '系统', issuedAt: '2026-09-15 11:24:00' })
  assert.equal(transfer.lines[0].plannedQty, 20)
  assert.equal(transfer.lines[0].sentQty, 0)
  assert.throws(() => approveFactoryTransfer(transfer.id, '面料仓主管', '2026-09-15 11:25:00'), /确认实际发料数量和卷码/)
  confirmDesignRevisionWarehouseDispatch({ processType: 'DYEING', processOrderId: dye.dyeOrderId, sentQty: 20, rolls: [{ barcode: 'RAW-ROLL-01', yard: 20 }], operatorName: '面料仓管', dispatchedAt: '2026-09-15 11:24:30' })
  approveFactoryTransfer(transfer.id, '面料仓主管', '2026-09-15 11:25:00')
  assert.equal(listFactoryReceivingSources(dyeFactory.id).some((item) => item.id === transfer.id), true)
  assert.throws(() => createDesignRevisionProcessMaterialTransfer({ processType: 'PRINTING', processOrderId: print.printOrderId, issuedBy: '系统', issuedAt: '2026-09-15 11:26:00' }), /应接收前序染色交出物/)
  const dyedMaterial = getDyeWorkOrderById(dye.dyeOrderId)!.outputMaterial!
  registerFactoryReceivingSource({
    id: `DYE-DISPATCH-READY-${print.printOrderId}`, documentNo: 'SJ-DR-READY-01', type: 'HANDOUT',
    origin: { kind: 'FACTORY', id: dyeFactory.id, name: dyeFactory.name, factoryType: '染色厂' },
    targetFactoryId: getPrintWorkOrderById(print.printOrderId)!.printFactoryId, targetFactoryName: getPrintWorkOrderById(print.printOrderId)!.printFactoryName,
    createdAt: '2026-09-15 11:30:00', createdBy: '染厂仓管', handedOutAt: '2026-09-15 11:30:00',
    workOrderNo: dye.dyeOrderNo,
    lines: [{ id: `DYE-DISPATCH-READY-${print.printOrderId}-L1`, material: { ...dyedMaterial, batchNo: 'DR-READY-01' }, plannedQty: 20, sentQty: 18, unit: 'Yard', rolls: [{ barcode: 'DYED-ROLL-01', yard: 18 }], label: 'SJ-DR-READY-01', printingOrderId: print.printOrderId }],
  })
  const secondStage = getDesignRevisionMaterialTransferPlan('PRINTING', print.printOrderId)!
  assert.equal(secondStage.stage, 'DYE_FACTORY_TO_PRINT_FACTORY')
  assert.equal(secondStage.plannedQty, 20)
  assert.equal(secondStage.sentQty, 18)
  assert.equal(secondStage.status, 'DISPATCHED')

  const finalSourceId = `PRINT-DISPATCH-READY-${print.printOrderId}`
  const assignedPrint = getPrintWorkOrderById(print.printOrderId)!
  registerFactoryReceivingSource({
    id: finalSourceId, documentNo: 'SJ-DR-READY-02', type: 'HANDOUT',
    origin: { kind: 'FACTORY', id: assignedPrint.printFactoryId, name: assignedPrint.printFactoryName, factoryType: '印花厂' },
    targetFactoryId: GOTO_GLOBAL_FACTORY_ID, targetFactoryName: 'goto_global 中央车缝工厂',
    createdAt: '2026-09-15 12:00:00', createdBy: '印花厂仓管', handedOutAt: '2026-09-15 12:00:00',
    workOrderNo: print.printOrderNo,
    lines: [{ id: `${finalSourceId}-L1`, material: { ...dyedMaterial, sku: 'SKU-PRINT-01', batchNo: 'PRINT-READY-01' }, plannedQty: 20, sentQty: 18, unit: 'Yard', rolls: [{ barcode: 'PRINT-ROLL-01', yard: 18 }], label: 'SJ-DR-READY-02' }],
  })
  const position = getDefaultFactoryReceiptPosition(GOTO_GLOBAL_FACTORY_ID)
  confirmFactoryMaterialReceipt({
    id: `CENTRAL-RECEIVE-${print.printOrderId}`, factoryId: GOTO_GLOBAL_FACTORY_ID,
    operatorId: 'GOTO-GLOBAL-WAREHOUSE', operatorName: '中央工厂仓管', receivedAt: '2026-09-15 12:05:00',
    remark: '按印花厂实际交出卷接收',
    lines: [{ sourceId: finalSourceId, sourceLineId: `${finalSourceId}-L1`, ...position,
      rolls: [{ barcode: 'PRINT-ROLL-01', yard: 17, ...position }],
    }],
  })
  assert.equal(getSourceActualReceipts(finalSourceId).reduce((sum, item) => sum + item.qty, 0), 17)
  assert.equal(getDesignRevisionMaterialTransferPlan('PRINTING', print.printOrderId)?.plannedQty, 20)
})

test('双工艺 SKU 仅生成印花单，仓库直接发印厂并完成样衣归档', () => {
  const seeded = listEngineeringIndependentSamplingRecords()
  const reference = seeded.find((record) => record.targetStyleCode === 'STYLE-PRJ-202603-011' && record.status === 'COMPLETED')!
  const target = seeded.find((record) => record.targetStyleCode === 'STYLE-PRJ-202603-012')!
  const pattern = reference.professionalTasks.find((task) => task.taskType === 'BASE_PATTERN')?.results[0]?.files.find((file) => file.extension === 'prj')!
  const sampleImage = reference.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')?.results[0]?.files.find((file) => ['jpg', 'jpeg', 'png', 'webp'].includes(file.extension))!
  assert.ok(pattern && sampleImage)
  const buyer = { role: '买手' as const, userId: target.buyerId, userName: target.buyerName }
  const draft = createEngineeringIndependentSampling({
    sourceStyleId: reference.targetStyleId, targetStyleId: target.targetStyleId,
    creationReason: '双工艺 SKU 仅印花，最后制作展示样衣', designFiles: target.designFiles,
    patternHandling: 'REUSE', reusedPatternFiles: [pattern], buyer,
    createdAt: '2026-09-23 09:00:00',
  })
  saveEngineeringBomVersion({
    versionId: draft.bomDraftVersionId, ...buyer,
    materialLines: [{ materialSkuId: 'dr_cotton_dye_print', usage: 20, quantityBasis: 'ORDER_TOTAL', sampleQuantity: 1, usageUnit: 'Yard', lossRate: 0, dyeRequirement: '否', printRequirement: '是' }],
    updatedAt: '2026-09-23 09:01:00',
  })
  saveEngineeringBomPricingPlan({
    ownerStage: 'INDEPENDENT_SAMPLING', ownerId: draft.samplingTaskId, ...buyer,
    customCostDecision: 'NO_CUSTOM_COST', customCosts: [], updatedAt: '2026-09-23 09:02:00',
  })
  const active = confirmEngineeringIndependentSamplingScheme({
    samplingTaskId: draft.samplingTaskId, actor: buyer,
    displaySampleAssignment: DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0],
    sampleRequirements: [{ targetColor: '整款', targetSize: 'M', requiredQuantity: 1, requirementNote: '' }],
    selectedTaskTypes: ['DISPLAY_SAMPLE'], confirmedAt: '2026-09-23 09:03:00',
  })
  const sampleTask = active.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')!
  const refs = sampleTask.processWorkOrderRefs
  assert.equal(refs.length, 1)
  assert.ok(refs.every(ref => ref.processType === 'PRINTING'))
  const printRef = refs.find((ref) => ref.processType === 'PRINTING')!
  const printFactory = listPrintingFactoryOptions().find((candidate) => {
    try { return Boolean(getDefaultFactoryReceiptPosition(candidate.id).locationId) } catch { return false }
  })
  assert.ok(printFactory)
  assignPrintingWorkOrder(printRef.processOrderId, { factoryId: printFactory.id, operatorName: 'PPIC' })
  captureBrowserEvidenceStage('print-assigned')
  acceptPrintWorkOrderPdaTask(getPrintWorkOrderById(printRef.processOrderId)!.taskId, '印花工厂')
  const transfer = createDesignRevisionProcessMaterialTransfer({
    processType: 'PRINTING', processOrderId: printRef.processOrderId, issuedBy: '系统', issuedAt: '2026-09-15 11:22:00',
  })
  assert.equal(transfer.origin.name, '面料中央仓')
  confirmDesignRevisionWarehouseDispatch({
    processType: 'PRINTING', processOrderId: printRef.processOrderId, sentQty: 20,
    rolls: [{ barcode: 'CHAIN-RAW-ROLL-01', yard: 20 }], operatorName: '面料仓管', dispatchedAt: '2026-09-15 11:23:00',
  })
  approveFactoryTransfer(transfer.id, '面料仓主管', '2026-09-15 11:24:00')
  captureBrowserEvidenceStage('warehouse-dispatched')
  const printPosition = getDefaultFactoryReceiptPosition(printFactory.id)
  confirmFactoryMaterialReceipt({
    id: `CHAIN-PRINT-INPUT-${printRef.processOrderId}`, factoryId: printFactory.id,
    operatorId: 'PRINT-WAREHOUSE', operatorName: '印花厂仓管', receivedAt: '2026-09-15 11:25:00',
    lines: [{ sourceId: transfer.id, sourceLineId: transfer.lines[0].id, ...printPosition,
      rolls: [{ barcode: 'CHAIN-RAW-ROLL-01', yard: 20, ...printPosition }],
    }],
  })
  const printOrder = getPrintWorkOrderById(printRef.processOrderId)!
  assert.ok(!printOrder.sourceSnapshot?.upstreamWorkOrderId)
  assert.equal(getPrintingWorkOrderById(printRef.processOrderId)?.actualInput.receivedQty, 20)
  assert.notEqual(readDesignRevisionProcessWorkOrderStatuses([printRef])[0].status, 'WAIT_PREREQUISITE_PROCESS')
  assert.equal(getPrintingWorkflowFacts(printRef.processOrderId).artworkConfirmed, true)
  assert.equal(getPrintingWorkflowFacts(printRef.processOrderId).sampleConfirmed, true)
  captureBrowserEvidenceStage('print-received')
  startPrintingProduction(printRef.processOrderId, { id: 'DR-CHAIN-START', qty: 20, operatorName: '印花工厂' })
  recordPrintingProductionStage(printRef.processOrderId, { id: 'DR-CHAIN-RUN', stage: 'PRINT', action: 'START', operatorName: '印花工厂' })
  recordPrintingProductionStage(printRef.processOrderId, { id: 'DR-CHAIN-FINISH', stage: 'PRINT', action: 'FINISH', qty: 20, operatorName: '印花工厂' })
  completePrintingWorkOrder(printRef.processOrderId, {
    usedQty: 20, usedRollCount: 1, completedQty: 20, completedRollCount: 1,
    printerNo: 'PRINT-01', operatorName: '印花工厂', batchId: 'DR-CHAIN-BATCH', lossQty: 0, finishOrder: true,
  })
  const outputBarcode = getPrintingWorkOrderById(printRef.processOrderId)!.barcodes.find((item) => item.batchId === 'DR-CHAIN-BATCH')!
  assert.ok(outputBarcode)
  updatePrintingRollBarcode(printRef.processOrderId, outputBarcode.id, {
    lengthY: 20, gsm: 180, widthCm: 150, vatNo: 'DR-CHAIN-01',
    warehouseName: '印花厂待交出区', remark: '印花实际产出',
  })
  markPrintingRollBarcodesPrinted(printRef.processOrderId, [outputBarcode.id], '印花工厂')
  captureBrowserEvidenceStage('print-output-ready')
  assert.throws(() => submitPrintHandover(printRef.processOrderId, { handoverQty: 20 }), /逐卷建单/)
  const printDispatchId = createPrintingDispatch([{ workOrderId: printRef.processOrderId, barcodeIds: [outputBarcode.id] }], '印花厂仓管')
  captureBrowserEvidenceStage('print-dispatch-draft')
  scanPrintingDispatchRoll(printDispatchId, outputBarcode.barcode, '印花厂仓管')
  confirmPrintingDispatch(printDispatchId, '印花厂仓管')
  const centralSource = listFactoryReceivingSources(GOTO_GLOBAL_FACTORY_ID).find((item) =>
    item.type === 'HANDOUT' && item.workOrderNo === printOrder.printOrderNo && item.id.startsWith('PRINT-HANDOUT-'))
  assert.ok(centralSource)
  assert.equal(centralSource.lines[0].material.sku, 'DR-COTTON-001-WHITE-BLUE-PRINT')
  assert.equal(centralSource.lines[0].sentQty, 20)
  assert.notEqual(readDesignRevisionProcessWorkOrderStatuses([printRef])[0].status, 'COMPLETED', '印厂交出不等于中央工厂确认接收')
  captureBrowserEvidenceStage('print-dispatched')
  const centralPosition = getDefaultFactoryReceiptPosition(GOTO_GLOBAL_FACTORY_ID)
  confirmFactoryMaterialReceipt({
    id: `CHAIN-CENTRAL-${printRef.processOrderId}`, factoryId: GOTO_GLOBAL_FACTORY_ID,
    operatorId: 'CENTRAL-WAREHOUSE', operatorName: '中央工厂仓管', receivedAt: '2030-01-01 12:40:00',
    lines: [{ sourceId: centralSource.id, sourceLineId: centralSource.lines[0].id, ...centralPosition,
      rolls: [{ barcode: outputBarcode.barcode, yard: 20, ...centralPosition }],
    }],
  })
  assert.equal(getSourceActualReceipts(centralSource.id).reduce((sum, item) => sum + item.qty, 0), 20)
  assert.deepEqual(readDesignRevisionProcessWorkOrderStatuses(refs).map((item) => item.status), ['COMPLETED'], '印花实物由中央工厂确认接收即可填报样衣')
  captureBrowserEvidenceStage('print-delivered')
  completePrintWorkOrderDocument(printRef.processOrderId, { operatorName: 'PPIC' })
  captureBrowserEvidenceStage('completed')
  assert.equal(getPrintingWorkOrderById(printRef.processOrderId)!.receivingTargetId, GOTO_GLOBAL_FACTORY_ID, '接收组织编号必须是中央工厂，不能用库区编号冒充')
  const completedPrint = getPrintWorkOrderById(printRef.processOrderId)!
  const completedHeads = listHandoverOrdersByTaskId(completedPrint.taskId, { includeWool: false })
  assert.ok(completedHeads.length > 0)
  assert.deepEqual(completedHeads.map(head => ({taskStatus:head.taskStatus,status:head.handoverOrderStatus})), completedHeads.map(() => ({taskStatus:'DONE',status:'WRITTEN_BACK'})), '设计改款完单后交出单必须同步完成，不要求重复确认')
  assert.deepEqual(readDesignRevisionProcessWorkOrderStatuses(refs).map((item) => item.status), ['COMPLETED'])
  assert.equal(listFactoryReceivingSources(printFactory.id).some((item) => item.id === `DR-MATERIAL-PRINTING-${printRef.processOrderId}`), true, '直接仓库发印厂的调拨保留追溯')
  const sampleResult = submitEngineeringIndependentProfessionalTask({
    taskId: sampleTask.taskId,
    actor: { role: '制作团队', userId: 'GOTO-GLOBAL-SAMPLE', userName: 'goto_global 样衣团队' },
    results: [{
      title: '整款 / M 销售展示样衣', requirementLineId: sampleTask.sampleRequirements[0].requirementLineId,
      sampleQuantity: 1, sampleColor: '整款', sampleSize: 'M',
      sourcePatternVersion: listEngineeringIndependentAvailablePatternVersions(active)[0].value,
      description: '按已接收的印花面料制作', files: [sampleImage],
    }],
    submittedAt: '2030-01-01 12:41:00',
  })
  assert.equal(sampleResult.status, 'COMPLETED')
  assert.equal(sampleResult.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')?.status, 'COMPLETED')
  const targetStyle = getStyleArchiveById(sampleResult.targetStyleId)!
  const project = getProjectById(targetStyle.sourceProjectId)!
  const archive = getProjectArchiveByProjectId(project.projectId)!
  const relations = listProjectRelationsBySourceObject({
    sourceModule: '设计改款任务', sourceObjectType: '设计改款任务', sourceObjectId: sampleResult.samplingTaskId,
  })
  assert.equal(relations.length, 1)
  assert.equal(relations[0].sourceStatus, 'COMPLETED')
  const autoCollected = collectProjectArchiveAutoData(archive, project, targetStyle)
  const archivedTask = autoCollected.documents.find((item) => item.documentGroup === 'DESIGN_REVISION_RECORD' && item.sourceObjectId === sampleResult.samplingTaskId)
  assert.equal(archivedTask?.documentStatus, 'COMPLETED')
  assert.ok(autoCollected.files.some((file) => file.archiveDocumentId === archivedTask?.archiveDocumentId && file.fileName === sampleImage.fileName))
})

test('印花实际交出生成中央工厂待接收原单，实收回写原交接并允许完成加工单', () => {
  const [ref] = createProcessOrders(['PRINTING'], 'ES-DR-READY-FINAL-PRINT')
  const assignedFactory = listPrintingFactoryOptions().find((candidate) => {
    try { return Boolean(getDefaultFactoryReceiptPosition(candidate.id).locationId) } catch { return false }
  })
  assert.ok(assignedFactory)
  assignPrintingWorkOrder(ref.processOrderId, { factoryId: assignedFactory.id, operatorName: 'PPIC' })
  const order = getPrintWorkOrderById(ref.processOrderId)!
  const warehouseTransfer = createDesignRevisionProcessMaterialTransfer({
    processType: 'PRINTING', processOrderId: ref.processOrderId, issuedBy: '系统', issuedAt: '2026-09-15 11:20:00',
  })
  confirmDesignRevisionWarehouseDispatch({
    processType: 'PRINTING', processOrderId: ref.processOrderId, sentQty: 20,
    rolls: [{ barcode: 'PRINT-RAW-ROLL-01', yard: 20 }], operatorName: '面料仓管', dispatchedAt: '2026-09-15 11:21:00',
  })
  approveFactoryTransfer(warehouseTransfer.id, '面料仓主管', '2026-09-15 11:22:00')
  const sourceLine = getDesignRevisionMaterialTransferPlan('PRINTING', ref.processOrderId)!
  assert.equal(sourceLine.stage, 'WAREHOUSE_TO_FACTORY')
  const printPosition = getDefaultFactoryReceiptPosition(assignedFactory.id)
  confirmFactoryMaterialReceipt({
    id: `PRINT-INPUT-${ref.processOrderId}`, factoryId: assignedFactory.id,
    operatorId: 'PRINT-WAREHOUSE', operatorName: '印花厂仓管', receivedAt: '2026-09-15 11:23:00',
    lines: [{ sourceId: warehouseTransfer.id, sourceLineId: warehouseTransfer.lines[0].id, ...printPosition,
      rolls: [{ barcode: 'PRINT-RAW-ROLL-01', yard: 20, ...printPosition }],
    }],
  })
  const business = getPrintingWorkOrderById(ref.processOrderId)!
  assert.equal(business.actualInput.receivedQty, 20)
  assert.equal(getPrintingWorkflowFacts(ref.processOrderId).artworkConfirmed, true)
  assert.equal(getPrintingWorkflowFacts(ref.processOrderId).sampleConfirmed, true)
  assert.throws(() => startPrintingProduction(ref.processOrderId, { id: 'DR-FINAL-EARLY', qty: 20, operatorName: '印花工厂' }), /先由印花工厂接单/)
  acceptPrintWorkOrderPdaTask(order.taskId, '印花工厂')
  startPrintingProduction(ref.processOrderId, { id: 'DR-FINAL-START', qty: 20, operatorName: '印花工厂' })
  recordPrintingProductionStage(ref.processOrderId, { id: 'DR-FINAL-RUN', stage: 'PRINT', action: 'START', operatorName: '印花工厂' })
  recordPrintingProductionStage(ref.processOrderId, { id: 'DR-FINAL-FINISH', stage: 'PRINT', action: 'FINISH', qty: 20, operatorName: '印花工厂' })
  completePrintingWorkOrder(ref.processOrderId, {
    usedQty: 20, usedRollCount: 1, completedQty: 20, completedRollCount: 1,
    printerNo: 'PRINT-01', operatorName: '印花工厂', batchId: 'DR-FINAL-BATCH', lossQty: 0, finishOrder: true,
  })
  const output = getPrintingWorkOrderById(ref.processOrderId)!
  const barcode = output.barcodes.find((item) => item.batchId === 'DR-FINAL-BATCH')!
  assert.ok(barcode)
  updatePrintingRollBarcode(ref.processOrderId, barcode.id, {
    lengthY: 20, gsm: 180, widthCm: 150, vatNo: 'DR-FINAL-01',
    warehouseName: '印花厂待交出区', remark: '设计改款实际印花产出',
  })
  markPrintingRollBarcodesPrinted(ref.processOrderId, [barcode.id], '印花工厂')
  const dispatchId = createPrintingDispatch([{ workOrderId: ref.processOrderId, barcodeIds: [barcode.id] }], '印花厂仓管')
  scanPrintingDispatchRoll(dispatchId, barcode.barcode, '印花厂仓管')
  confirmPrintingDispatch(dispatchId, '印花厂仓管')
  const centralSource = listFactoryReceivingSources(GOTO_GLOBAL_FACTORY_ID).find((item) =>
    item.type === 'HANDOUT' && item.workOrderNo === order.printOrderNo && item.id.startsWith('PRINT-HANDOUT-'))
  assert.ok(centralSource)
  assert.equal(centralSource.targetFactoryId, GOTO_GLOBAL_FACTORY_ID)
  assert.equal(centralSource.lines[0].material.sku, 'SKU-PRINT-01')
  assert.equal(centralSource.lines[0].sentQty, 20)
  captureBrowserEvidenceStage('print-dispatched')
  const centralPosition = getDefaultFactoryReceiptPosition(GOTO_GLOBAL_FACTORY_ID)
  confirmFactoryMaterialReceipt({
    id: `PRINT-CENTRAL-${ref.processOrderId}`, factoryId: GOTO_GLOBAL_FACTORY_ID,
    operatorId: 'CENTRAL-WAREHOUSE', operatorName: '中央工厂仓管', receivedAt: '2030-01-01 12:30:00',
    lines: [{ sourceId: centralSource.id, sourceLineId: centralSource.lines[0].id, ...centralPosition,
      rolls: [{ barcode: barcode.barcode, yard: 20, ...centralPosition }],
    }],
  })
  assert.equal(getSourceActualReceipts(centralSource.id).reduce((sum, item) => sum + item.qty, 0), 20)
  completePrintWorkOrderDocument(ref.processOrderId, { operatorName: 'PPIC' })
  assert.equal(readDesignRevisionProcessWorkOrderStatuses([ref])[0].status, 'COMPLETED')
})

test('专业成果没有真实附件时保持未绑定', () => {
  const refs = createProcessOrders().filter((ref) => ref.processType === 'DYEING')
  assert.throws(() => bindDesignRevisionApprovedProfessionalResult({
    designRevisionTaskId: 'ES-DR-READY-01', professionalTaskId: 'TASK-COLOR-READY-01', professionalResultId: 'COLOR-RESULT-BAD', professionalResultVersion: 'V1',
    approvedAt: '2026-09-15 11:30:00', approvedBy: '买手-测试', attachments: [{ ...attachment, dataUrl: '/not-an-upload.png' }],
    processWorkOrderRefs: refs,
  }), /真实附件/)
})
