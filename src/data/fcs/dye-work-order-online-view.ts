import {listFactoryReceipts} from './factory-receiving.ts'
import type {YarnWeight} from './yarn-weight.ts'
import {listFactoryReceivingSources,getSourceActualReceipts} from './factory-receiving.ts'
import { DYE_DEMO_DETAILS, DYE_DEMO_PARTNER_SCENARIOS, DYE_PARTNERS, dyePartnerFields, dyeTheoreticalWeight, type DyePartner } from './dye-work-order-demo-details.ts'
import { listWarehouseIssueOrders, listWarehouseInternalTransferOrders } from './warehouse-material-execution.ts'
import { listPdaHandoverHeads, getPdaHandoverRecordsByHead } from './pda-handover-events.ts'
import { getDyeMaterialReceiptOptions } from './dyeing-material-receipts.ts'
import { getProcessOrderTaskRelationView } from './process-order-task-links.ts'
import {
  listDyeWorkOrders,
  listDyeExecutionNodeRecords,
  getDyeOrderHandoverRecords,
  getDyeOutputRolls,
  type DyeWorkOrder,
} from './dyeing-task-domain.ts'
import {
  getDyeWorkOrderOnlineRecord,
  type DyeWorkOrderOnlineStatus,
} from './dye-work-order-online-domain.ts'
import {
  PROCESS_WORK_ORDER_SOURCE_LABEL,
  getProcessWorkOrderById,
  type ProcessWorkOrderSourceType,
} from './process-work-order-domain.ts'
import {
  PROCESS_ORDER_HANDOVER_STATUS_LABEL,
  PROCESS_ORDER_PROCESSING_STATUS_LABEL,
  PROCESS_ORDER_RECEIPT_STATUS_LABEL,
  type ProcessOrderHandoverStatus,
  type ProcessOrderInputSourceType,
  type ProcessOrderProcessingStatus,
  type ProcessOrderReceiptStatus,
} from './process-order-flow-contract.ts'
import { getDyeWorkOrderThreeAxisView } from './process-order-three-axis-view.ts'
import { getDyeOrderImageManifest } from './process-order-image-manifest.ts'
import { productionOrders } from './production-orders.ts'

export type DyeWorkOrderKeywordField =
  | 'all'
  | 'workOrderNo'
  | 'taskNo'
  | 'productionOrderNo'
  | 'purchaseOrderNo'
  | 'productCode'

export interface DyeWorkOrderOnlineFilters {
  keywordField: DyeWorkOrderKeywordField
  upstreamName: string
  exception: string
  keyword: string
  statuses: DyeWorkOrderOnlineStatus[]
  receiptStatus: '' | ProcessOrderReceiptStatus
  processingStatus: '' | ProcessOrderProcessingStatus
  handoverStatus: '' | ProcessOrderHandoverStatus
  salesType: string
  factoryName: string
  processName: string
  receiverName: string
  sourceType: '' | ProcessWorkOrderSourceType
  yarn: '全部' | '是' | '否'
  replenishment: '全部' | '是' | '否'
  gtgInStock: '全部' | '是' | '否'
  materialType: string
  colorNo: string
  timeField: 'orderedAt' | 'plannedFinishAt' | 'completedAt' | 'deliveredAt'
  startDate: string
  endDate: string
  composition: string
  width: string
  weightGsm: string
}

export interface DyeWorkOrderOnlineRow {
  yarnQuantities?: {upstream:YarnWeight[];received:YarnWeight[];shipped:YarnWeight[];downstream:YarnWeight[]}
  inputMaterials: Array<{name: string; sku: string; imageUrl: string; materialType: string; composition: string; width: string; weightGsm: number | null}>
  upstreamDocuments: DyeUpstreamDocument[]
  upstreamPartners: DyePartner[]
  downstreamPartner?: DyePartner
  preparedRollCount: number
  completedRollCount: number
  handedOverRollCount: number
  outputImageUrl: string
  sampleImageUrl: string
  sampleNote: string
  supplierName: string
  fabricReceiver: string
  targetColorName: string
  requiresWaterSoluble: boolean
  usageKnown: boolean
  receiptKnown: boolean
  lossKnown: boolean
  upstreamName: string
  upstreamLinks: Array<{label: string; href?: string}>
  downstreamLinks: Array<{label: string; href?: string}>
  receiptRecords: Array<{receiptId: string; upstreamRecordId?: string; qty: number; receiverName: string; receivedAt: string}>
  executionRecords: Array<{nodeName: string; operatorName: string; startedAt?: string; finishedAt?: string; inputQty?: number; outputQty?: number; lossQty?: number; qtyUnit: string}>
  handoverRecords: ReturnType<typeof getDyeOrderHandoverRecords>
  dyeOrderId: string
  workOrderNo: string
  platformWorkOrderNo: string
  taskNo: string
  productionOrderNo: string
  productCode: string
  productName: string
  productImageUrl: string
  purchaseOrderNo: string
  purchaseType: string
  salesType: string
  receiverInventoryQty: number
  gtgInventoryQty: number
  materialName: string
  materialImageUrl: string
  rawMaterialSku: string
  colorSku: string
  colorNo: string
  composition: string
  width: string
  weightGsm: number | null
  processName: string
  factoryId: string
  factoryName: string
  receiverName: string
  receiverWarehouseName: string
  receiverReady: boolean
  status: DyeWorkOrderOnlineStatus
  receiptStatus: ProcessOrderReceiptStatus
  receiptStatusLabel: string
  processingStatus: ProcessOrderProcessingStatus
  processingStatusLabel: string
  handoverStatus: ProcessOrderHandoverStatus
  handoverStatusLabel: string
  inputSourceMode: ProcessOrderInputSourceType | 'UNRESOLVED'
  inputSourceDocumentNos: string[]
  shade: '' | '浅色' | '深色'
  temperature: 190 | 200 | 205 | null
  plannedQty: number
  qtyUnit: string
  rawMaterialQty: number
  rawMaterialRollCount: number
  preparedQty: number
  preparedWeightKg: number
  completedQty: number
  lossQty: number
  pendingWritebackQty: number
  differenceQty: number
  objectionQty: number
  pendingInboundQty: number
  receivedInputQty: number
  handedOverQty: number
  downstreamReceivedQty: number
  orderedAt: string
  plannedFinishAt: string
  completedAt: string
  deliveredAt: string
  isOverdue: boolean
  isYarn: boolean
  isReplenishment: boolean
  materialType: string
  headVatOrRedye: string
  handoverOrderNo: string
  batchNo: string
  sourceType: ProcessWorkOrderSourceType
  sourceLabel: string
  remark: string
}

export interface DyeUpstreamDocument {
  name: string
  partner: DyePartner
  documentNo: string
  documentType: '调拨单' | '出库单' | '加工单'
  status: string
  plannedQty: number
  sentQty: number
  unit: string
  href?: string
}

function warehousePartner(id: string, name: string): DyePartner {
  return Object.values(DYE_PARTNERS).find(party=>party.kind === 'WAREHOUSE' && (party.id === id || party.name === name))
    || {kind:'WAREHOUSE', id, name, warehouseAttribute:'待维护仓库属性'}
}

function factoryPartner(id: string, name: string, processName: string): DyePartner {
  return Object.values(DYE_PARTNERS).find(party=>party.kind === 'FACTORY' && (party.id === id || party.name === name))
    || {kind:'FACTORY', id, name, factoryType:processName ? `${processName}厂` : '加工厂'}
}

/** 来源状态与发出量属于上游单据，不能从染色接收量推导。 */
function buildUpstreamDocuments(order: DyeWorkOrder, source: ReturnType<typeof getDyeMaterialReceiptOptions>, relation: ReturnType<typeof getProcessOrderTaskRelationView>): DyeUpstreamDocument[] {
  const recordIds = new Set([...source.options.map(item => item.recordId), ...(order.materialReceipts ?? []).map(item => item.upstreamRecordId)])
  const documents: DyeUpstreamDocument[] = []
  if (order.initialYarnTransfer) {
    const transfer = order.initialYarnTransfer
    const partner = warehousePartner(transfer.warehouseId, transfer.warehouseName)
    documents.push({name:partner.name,partner,documentNo:transfer.documentNo,documentType:'调拨单',status:transfer.status,plannedQty:transfer.plannedNetKg,sentQty:transfer.sentNetKg,unit:'kg'})
  }
  const warehouseStatus: Record<string, string> = {PLANNED:'待备料', PREPARING:'备料中', PARTIALLY_PREPARED:'部分备料', READY:'待调拨', ISSUED:'已调拨', IN_TRANSIT:'调拨在途', RECEIVED:'已收货', CLOSED:'已关闭', PARTIALLY_RETURNED:'部分退回', RETURNED:'已退回'}
  for (const doc of [...listWarehouseIssueOrders(), ...listWarehouseInternalTransferOrders()]) {
    const lines = doc.lines.filter(line => recordIds.has(line.lineId) || (doc.runtimeTaskId === order.taskId && [order.rawMaterialSku, order.materialId].includes(line.materialCode || '')))
    if (!lines.length) continue
    for (const unit of new Set(lines.map(line => line.unit))) {
      const sameUnit = lines.filter(line => line.unit === unit)
      const partner = warehousePartner(doc.warehouseId || '', doc.warehouseName || '仓库名称待维护')
      documents.push({name: partner.name, partner, documentNo: doc.docNo, documentType:doc.docType==='ISSUE'?'出库单':'调拨单', status: doc.docType==='ISSUE'?(doc.status==='ISSUED'?'已出库':doc.status==='READY'?'待出库':warehouseStatus[doc.status]||'出库处理中'):warehouseStatus[doc.status]||'调拨处理中', plannedQty: round(sameUnit.reduce((sum,line)=>sum+line.plannedQty,0)), sentQty: round(sameUnit.reduce((sum,line)=>sum+(doc.docType === 'ISSUE' ? line.issuedQty : line.transferredQty),0)), unit})
    }
  }
  const heads = listPdaHandoverHeads()
  for (const predecessor of relation?.predecessors ?? []) {
    if (predecessor.documentKind === 'SOURCE_DOCUMENT') continue
    const upstream = getProcessWorkOrderById(predecessor.documentId)
    if (!upstream) continue
    const records = heads.filter(head => [head.taskId,head.sourceTaskId].includes(upstream.taskId)).flatMap(head=>getPdaHandoverRecordsByHead(head.handoverId)).filter(record=>recordIds.has(record.handoverRecordId || record.recordId) && record.handoverRecordStatus !== 'VOIDED' && record.qtyUnit === order.qtyUnit)
    const partner = factoryPartner(upstream.factoryId, upstream.factoryName || '上游工厂待分配', upstream.processType)
    documents.push({name: partner.name, partner, documentNo: upstream.workOrderNo, documentType:'加工单', status: upstream.statusLabel, plannedQty: upstream.plannedQty, sentQty: round(records.reduce((sum,record)=>sum+(record.submittedQty ?? record.plannedQty ?? 0),0)), unit: upstream.plannedUnit, href: predecessor.href})
  }
  for(const src of listFactoryReceivingSources(order.dyeFactoryId).filter(s=>s.lines.some(l=>l.dyeOrderId===order.dyeOrderId))){
    for(const line of src.lines.filter(l=>l.dyeOrderId===order.dyeOrderId))if(!documents.some(d=>d.documentNo===src.documentNo&&d.unit===line.unit))documents.push({name:src.origin.name,partner:src.origin,documentNo:src.documentNo,documentType:src.type==='HANDOUT'?'加工单':src.type==='ISSUE'?'出库单':'调拨单',status:src.type==='HANDOUT'?'已实际交出':src.approvedAt?'审核通过':'待审核',plannedQty:line.plannedQty,sentQty:line.sentQty,unit:line.unit,href:`/fcs/craft/dyeing/pending-receipts?sourceId=${encodeURIComponent(src.id)}`})
  }
  if (!documents.length) {
    const demo = DYE_DEMO_DETAILS[order.dyeOrderId]
    const scenario = DYE_DEMO_PARTNER_SCENARIOS[order.dyeOrderId]
    const partner = scenario?.upstream || warehousePartner(order.sourceWarehouseId || '', '上游仓库待关联')
    const factoryOrder = partner.kind === 'FACTORY' ? scenario?.upstreamWorkOrder : undefined
    documents.push({name: partner.name, partner, documentNo: factoryOrder?.no || demo?.plannedTransferNo || '尚未生成', documentType: partner.kind === 'FACTORY' ? '加工单' : '调拨单', status: factoryOrder?.status || (demo ? '待备料（计划）' : '等待上游建单'), plannedQty: order.plannedQty, sentQty: 0, unit: order.qtyUnit})
  }
  return documents
}

export interface DyeWorkOrderUnitSummary {
  unit: string
  qty: number
}

export interface DyeWorkOrderOnlineSummary {
  receivedQtyByUnit: DyeWorkOrderUnitSummary[]
  pendingQtyByUnit: DyeWorkOrderUnitSummary[]
  unknownUsageCount: number
  unknownReceiptCount: number
  plannedQtyByUnit: DyeWorkOrderUnitSummary[]
  rawMaterialQtyByUnit: DyeWorkOrderUnitSummary[]
  completedQtyByUnit: DyeWorkOrderUnitSummary[]
  lossQtyByUnit: DyeWorkOrderUnitSummary[]
  purchaseOrderCount: number
}

function relativeDemoFinishAt(days: number): string {
  const date = new Date()
  date.setHours(18, 0, 0, 0)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day} 18:00:00`
}

const DYE_WORK_ORDER_PRESENTATION_FACTS: Record<string, Partial<Pick<DyeWorkOrderOnlineRow,
  'productImageUrl' | 'materialImageUrl' | 'materialName' | 'productCode' | 'productName' | 'salesType' | 'purchaseOrderNo' | 'purchaseType' | 'plannedFinishAt'
>>> = {
  'DWO-001': {
    productImageUrl: '/shirt-sample.jpg',
    materialImageUrl: '/materials/fabric-main.jpg',
    materialName: '细冰丝坑条 Td-s 025',
    plannedFinishAt: relativeDemoFinishAt(-2),
  },
  'DWO-002': {
    productImageUrl: '/cardigan-sample.jpg',
    materialImageUrl: '/materials/fabric-contrast.jpg',
    materialName: '牛奶丝 R063',
    plannedFinishAt: relativeDemoFinishAt(-1),
  },
  'DWO-003': {
    productImageUrl: '/dress-sample-1.jpg',
    materialImageUrl: '/materials/fabric-lining.jpg',
    materialName: '50D 四面弹里布 S256',
    plannedFinishAt: relativeDemoFinishAt(-1),
  },
  'DWO-004': {
    productImageUrl: '/tshirt-sample.jpg',
    materialImageUrl: '/materials/yarn-stitching.jpg',
    materialName: '棉感针织布 K118',
  },
}

export const DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS: DyeWorkOrderOnlineFilters = {
  keywordField: 'all',
  keyword: '',
  upstreamName: '',
  exception: '',
  statuses: [],
  receiptStatus: '',
  processingStatus: '',
  handoverStatus: '',
  salesType: '',
  factoryName: '',
  processName: '',
  receiverName: '',
  sourceType: '',
  yarn: '全部',
  replenishment: '全部',
  gtgInStock: '全部',
  materialType: '',
  colorNo: '',
  timeField: 'orderedAt',
  startDate: '',
  endDate: '',
  composition: '',
  width: '',
  weightGsm: '',
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function getDyePendingReceiptQty(records: ReturnType<typeof getDyeOrderHandoverRecords>): number {
  return round(records.reduce((sum, record) => {
    if (record.handoverRecordStatus === 'VOIDED' || record.factoryDiffDecision === 'ACCEPT_DIFF' || record.objectionStatus === 'RESOLVED') return sum
    const received = record.taskReceipts?.length ? record.taskReceipts.reduce((qty, receipt) => qty + receipt.qty, 0) : record.receiverWrittenQty ?? record.warehouseWrittenQty ?? 0
    return sum + Math.max(0, (record.submittedQty ?? record.plannedQty ?? 0) - received)
  }, 0))
}

function makeRow(order: DyeWorkOrder): DyeWorkOrderOnlineRow {
  const online = getDyeWorkOrderOnlineRecord(order.dyeOrderId)
  const axes = getDyeWorkOrderThreeAxisView(order)
  const presentation = DYE_WORK_ORDER_PRESENTATION_FACTS[order.dyeOrderId] || {}
  const demo = DYE_DEMO_DETAILS[order.dyeOrderId]
  const images = getDyeOrderImageManifest(order.dyeOrderId)
  const plannedQty = order.plannedQty
  const executionRecords = [...(order.completedExecutionBatches ?? []).flat(), ...listDyeExecutionNodeRecords(order.dyeOrderId)]
  const dyeNodes = executionRecords.filter(node => node.nodeCode === 'DYE' && node.qtyUnit === order.qtyUnit)
  const rawMaterialQty = dyeNodes.reduce((sum, node) => sum + (node.inputQty ?? 0), 0)
  const usageKnown = dyeNodes.some(node => typeof node.inputQty === 'number') || (!dyeNodes.some(node => node.startedAt) && !executionRecords.some(node => ['DYE','PACK'].includes(node.nodeCode) && (node.outputQty ?? 0) > 0))
  const completedQty = axes.completedQty
  const confirmedLossNodes = executionRecords.filter(node => node.finishedAt && node.qtyUnit === order.qtyUnit && typeof node.lossQty === 'number')
  const lossQty = round(confirmedLossNodes.reduce((sum, node) => sum + (node.lossQty ?? 0), 0))
  const receiptKnown = order.yarnOrderedWeightKg!==undefined || Boolean(order.materialReceipts?.length) || (!rawMaterialQty && !completedQty && axes.processingStatus !== 'PROCESSING')
  const source = getDyeMaterialReceiptOptions(order.dyeOrderId)
  const relation = getProcessOrderTaskRelationView(order.dyeOrderId)
  const upstreamLinks = (relation?.predecessors ?? []).filter(item => item.documentKind !== 'SOURCE_DOCUMENT').map(item => ({label: `${item.processName} · ${item.documentNo}`, href: item.href}))
  const downstreamLinks = (relation?.successors ?? []).filter(item => item.documentKind !== 'SOURCE_DOCUMENT').map(item => ({label: `${item.processName} · ${item.documentNo}`, href: item.href}))
  const orderedAt = order.createdAt
  const plannedFinishAt = online.plannedFinishAt || order.plannedFinishAt || presentation.plannedFinishAt || (demo ? relativeDemoFinishAt(3) : '')
  const isClosed = online.status === '取消' || online.status === '已完成'
  const handoverRecords = getDyeOrderHandoverRecords(order.dyeOrderId)
  const pendingInboundQty = getDyePendingReceiptQty(handoverRecords)
  const snapshot = order.formalProductionOrderSnapshot
  const sourceProductionOrder = order.sourceType === 'PRODUCTION_ORDER'
    ? productionOrders.find((item) => item.productionOrderId === order.sourceProductionOrderId
      || item.productionOrderId === order.productionOrderIds?.[0]
      || item.productionOrderNo === order.sourceProductionOrderNo)
    : undefined
  const productCode = presentation.productCode
    || snapshot?.spuCode
    || sourceProductionOrder?.demandSnapshot.spuCode
    || order.stockMaterialId
    || '—'
  const productName = presentation.productName
    || snapshot?.spuName
    || sourceProductionOrder?.demandSnapshot.spuName
    || (order.sourceType === 'STOCK' ? order.stockMaterialName || '备货物料' : '')
    || (order.sourceType === 'CUT_PIECE_SUPPLEMENT' ? '生产补料' : '')
    || '商品名称待补齐'
  const materialName = demo?.materialName || presentation.materialName || snapshot?.materialName || order.stockMaterialName || order.rawMaterialSku
  const snapshotMaterialTypes = [...new Set(
    (snapshot?.materialItems ?? [])
      .map((item) => item.materialType?.trim())
      .filter((value): value is string => Boolean(value)),
  )]
  const materialType = /花边|织带/.test(materialName) ? '辅料' : snapshotMaterialTypes.length === 1
    ? snapshotMaterialTypes[0]
    : /纱|yarn/i.test(`${materialName} ${order.rawMaterialSku}`) ? '纱线' : '面料'
  const isYarn = materialType === '纱线' || /纱|yarn/i.test(materialType)
  const upstreamDocuments = buildUpstreamDocuments(order, source, relation)
  const downstreamPartner = DYE_DEMO_PARTNER_SCENARIOS[order.dyeOrderId]?.downstream
  const outputRolls = getDyeOutputRolls(order.dyeOrderId)
  const composition = demo?.composition || (order.composition && ![snapshot?.materialName, ...(snapshot?.materialItems ?? []).map(item => item.materialName)].includes(order.composition) && !/主面料|放行|补料|净色/.test(order.composition) ? order.composition : '成分待补充')
  const width = isYarn ? '不适用（纱线）' : demo ? `${demo.widthCm} cm` : order.width || '—'
  const weightGsm = demo?.gsm ?? order.weightGsm ?? null
  const yarnQuantities:DyeWorkOrderOnlineRow['yarnQuantities']=isYarn?{
      upstream:[...(order.initialYarnReceipt?[order.initialYarnReceipt]:[]),...listFactoryReceivingSources(order.dyeFactoryId).flatMap(s=>s.lines.filter(l=>l.dyeOrderId===order.dyeOrderId&&l.yarn).map(l=>l.yarn!))],
      received:[...(order.initialYarnReceipt?[order.initialYarnReceipt]:[]),...listFactoryReceipts(order.dyeFactoryId).flatMap(r=>r.lines.filter(l=>l.dyeOrderId===order.dyeOrderId&&l.yarn).map(l=>l.yarn!))],
      shipped:listFactoryReceivingSources(undefined,true).filter(s=>s.type==='HANDOUT'&&!s.voidedAt&&s.workOrderNo===order.dyeOrderNo).flatMap(s=>s.lines.flatMap(l=>l.yarn?[l.yarn]:[])),
      downstream:listFactoryReceivingSources(undefined,true).filter(s=>s.type==='HANDOUT'&&s.workOrderNo===order.dyeOrderNo).flatMap(s=>getSourceActualReceipts(s.id).flatMap(l=>l.yarn?[l.yarn]:[])),
    }:undefined
  const yarnNet=(weights:YarnWeight[])=>weights.reduce((n,w)=>n+w.netGrams,0)/1000
  return {
    inputMaterials: [{name: materialName, sku: demo?.rawSku || order.rawMaterialSku, imageUrl: images?.material || presentation.materialImageUrl || '', materialType, composition, width, weightGsm}],
    upstreamDocuments,
    upstreamPartners: [...new Map(upstreamDocuments.map(doc=>[`${doc.partner.kind}|${doc.partner.id}`,doc.partner])).values()],
    downstreamPartner,
    preparedRollCount: demo?.preparedRollCount ?? (axes.receivedInputQty > 0 ? online.rawMaterialRollCount : 0),
    completedRollCount: outputRolls.length ? outputRolls.filter(roll => roll.qty > 0).length : (demo?.completedRollCount ?? 0),
    handedOverRollCount: outputRolls.length ? outputRolls.filter(roll=>roll.dispatchId).length : (demo?.handedOverRollCount ?? 0),
    outputImageUrl: demo?.outputImage || '', sampleImageUrl: demo?.sampleImage || '',
    sampleNote: demo?.sampleNote || order.remark || '', supplierName: demo?.supplier || '供应商待确认',
    fabricReceiver: demo?.fabricReceiver || online.receiverName, targetColorName: demo?.colorName || order.targetColor,
    requiresWaterSoluble: order.requiresWaterSoluble,
    usageKnown, receiptKnown, lossKnown: confirmedLossNodes.length > 0 || (usageKnown && rawMaterialQty === 0),
    upstreamName: [...new Set(upstreamDocuments.map(doc=>doc.name))].join(' / '),
    upstreamLinks: upstreamLinks.length ? upstreamLinks : upstreamDocuments.filter(doc=>doc.documentType === '加工单').map(doc=>({label:`${doc.name} · ${doc.documentNo}`, href:doc.href})),
    downstreamLinks: downstreamPartner ? [] : downstreamLinks,
    receiptRecords: order.materialReceipts ?? [], executionRecords,
    handoverRecords,
    dyeOrderId: order.dyeOrderId,
    workOrderNo: order.dyeOrderNo,
    platformWorkOrderNo: order.dyeOrderNo,
    taskNo: order.taskNo,
    productionOrderNo: order.sourceProductionOrderNo || '',
    productCode,
    productName,
    productImageUrl: images?.product || presentation.productImageUrl || '',
    purchaseOrderNo: demo?.demandNo || presentation.purchaseOrderNo || (order.sourceType === 'STOCK'
      ? '备货创建'
      : order.sourceType === 'CUT_PIECE_SUPPLEMENT'
        ? (order.sourceSnapshot?.supplementRecordNo || '补料创建')
        : '—'),
    purchaseType: presentation.purchaseType || sourceProductionOrder?.demandSnapshot.saleType || (order.sourceType === 'STOCK'
      ? '备货'
      : order.sourceType === 'CUT_PIECE_SUPPLEMENT'
        ? '补料'
        : '—'),
    salesType: presentation.salesType || sourceProductionOrder?.demandSnapshot.saleType || demo?.salesType || (order.sourceType === 'STOCK' ? '采购备货' : '尚未指定'),
    receiverInventoryQty: 0,
    gtgInventoryQty: 0,
    materialName,
    materialImageUrl: images?.material || presentation.materialImageUrl || '',
    rawMaterialSku: demo?.rawSku || order.rawMaterialSku,
    colorSku: demo?.outputSku || '',
    colorNo: demo?.colorNo || [order.colorNo, order.targetColor].find(value => value && !/^(TDV|tdv)[-_]/.test(value)) || '目标色号待补充',
    composition, width, weightGsm,
    processName: order.dyeProcessName || '匹染',
    factoryId: online.factoryId,
    factoryName: online.factoryName,
    receiverName: downstreamPartner?.name || axes.receiver.receiverName,
    receiverWarehouseName: downstreamPartner ? (downstreamPartner.kind === 'WAREHOUSE' ? downstreamPartner.name : '不适用（直接交加工厂）') : axes.receiver.receiverWarehouseName,
    receiverReady: axes.receiver.ready,
    status: online.status,
    receiptStatus: axes.receiptStatus,
    receiptStatusLabel: PROCESS_ORDER_RECEIPT_STATUS_LABEL[axes.receiptStatus],
    processingStatus: axes.processingStatus,
    processingStatusLabel: PROCESS_ORDER_PROCESSING_STATUS_LABEL[axes.processingStatus],
    handoverStatus: axes.handoverStatus,
    handoverStatusLabel: PROCESS_ORDER_HANDOVER_STATUS_LABEL[axes.handoverStatus],
    inputSourceMode: upstreamDocuments.some(doc=>doc.documentType === '加工单') ? 'UPSTREAM_HANDOUT' : axes.sourceMode,
    inputSourceDocumentNos: upstreamDocuments.map(doc=>doc.documentNo),
    shade: online.shade || demo?.shade || '',
    temperature: online.temperature ?? demo?.temperature ?? null,
    plannedQty,
    qtyUnit: order.qtyUnit,
    rawMaterialQty,
    rawMaterialRollCount: online.rawMaterialRollCount,
    preparedQty: axes.receivedInputQty,
    preparedWeightKg: dyeTheoreticalWeight(axes.receivedInputQty, order.qtyUnit, demo?.widthCm ?? parseFloat(order.width || '0'), demo?.gsm ?? order.weightGsm ?? 0) ?? 0,
    completedQty,
    lossQty,
    pendingWritebackQty: 0,
    differenceQty: Math.max(0, axes.handedOverQty - axes.downstreamReceivedQty),
    objectionQty: 0,
    pendingInboundQty:yarnQuantities?Math.max(0,(yarnQuantities.shipped.reduce((n,w)=>n+w.netGrams,0)-yarnQuantities.downstream.reduce((n,w)=>n+w.netGrams,0))/1000):pendingInboundQty,
    receivedInputQty: axes.receivedInputQty,
    handedOverQty: yarnQuantities?yarnNet(yarnQuantities.shipped):axes.handedOverQty,
    downstreamReceivedQty: yarnQuantities?yarnNet(yarnQuantities.downstream):axes.downstreamReceivedQty,
    orderedAt,
    plannedFinishAt,
    completedAt: online.completedAt,
    deliveredAt: online.deliveredAt,
    isOverdue: Boolean(plannedFinishAt && new Date(plannedFinishAt).getTime() < Date.now() && !isClosed),
    isYarn,
    yarnQuantities,
    isReplenishment: order.isReplenishment === true,
    materialType,
    headVatOrRedye: demo?.headVat || '未安排',
    handoverOrderNo: order.handoverOrderNo || order.handoverOrderId || '',
    batchNo: demo?.batchNo || '尚未分批',
    sourceType: order.sourceType,
    sourceLabel: PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType],
    remark: online.remark,
  }
}

export function listDyeWorkOrderOnlineRows(): DyeWorkOrderOnlineRow[] {
  return listDyeWorkOrders().map(makeRow)
}

function matchesBooleanFilter(value: boolean, filter: '全部' | '是' | '否'): boolean {
  return filter === '全部' || value === (filter === '是')
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

function keywordValue(row: DyeWorkOrderOnlineRow, field: DyeWorkOrderKeywordField): string {
  if (field === 'workOrderNo') return row.workOrderNo
  if (field === 'taskNo') return row.taskNo
  if (field === 'productionOrderNo') return row.productionOrderNo
  if (field === 'purchaseOrderNo') return row.purchaseOrderNo
  if (field === 'productCode') return row.productCode
  return [row.workOrderNo, row.taskNo, row.productionOrderNo, row.purchaseOrderNo, row.productCode, row.productName, row.materialName, row.rawMaterialSku, ...row.inputMaterials.map(item=>item.sku), row.upstreamName, row.receiverName, row.handoverOrderNo, ...row.inputSourceDocumentNos, ...row.upstreamDocuments.flatMap(item=>[item.documentNo, ...dyePartnerFields(item.partner).map(([,value])=>value)]), ...(row.downstreamPartner ? dyePartnerFields(row.downstreamPartner).map(([,value])=>value) : []), ...row.downstreamLinks.map(item => item.label)].join(' ')
}

export function filterDyeWorkOrderOnlineRows(
  rows: DyeWorkOrderOnlineRow[],
  input: Partial<DyeWorkOrderOnlineFilters>,
): DyeWorkOrderOnlineRow[] {
  const filters = { ...DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS, ...input }
  const keyword = normalized(filters.keyword)
  return rows.filter((row) => {
    const time = row[filters.timeField]
    return (!keyword || normalized(keywordValue(row, filters.keywordField)).includes(keyword))
      && (!filters.statuses.length || filters.statuses.includes(row.status))
      && (!filters.receiptStatus || row.receiptStatus === filters.receiptStatus)
      && (!filters.processingStatus || row.processingStatus === filters.processingStatus)
      && (!filters.handoverStatus || row.handoverStatus === filters.handoverStatus)
      && (!filters.upstreamName || row.upstreamName === filters.upstreamName)
      && (!filters.exception || (filters.exception === '超期' ? row.isOverdue : filters.exception === '补料' ? row.isReplenishment : filters.exception === '历史待补录' ? !row.receiptKnown || !row.usageKnown : row.receiptStatus === 'RECEIPT_DIFFERENCE'))
      && (!filters.salesType || row.salesType === filters.salesType)
      && (!filters.factoryName || row.factoryName === filters.factoryName)
      && (!filters.processName || row.processName === filters.processName)
      && (!filters.receiverName || row.receiverName === filters.receiverName)
      && (!filters.sourceType || row.sourceType === filters.sourceType)
      && matchesBooleanFilter(row.isYarn, filters.yarn)
      && matchesBooleanFilter(row.isReplenishment, filters.replenishment)
      && matchesBooleanFilter(row.gtgInventoryQty > 0, filters.gtgInStock)
      && (!filters.materialType || row.materialType === filters.materialType)
      && (!normalized(filters.colorNo) || normalized(row.colorNo).includes(normalized(filters.colorNo)))
      && (!normalized(filters.composition) || normalized(row.composition).includes(normalized(filters.composition)))
      && (!filters.width || row.width === filters.width)
      && (!filters.weightGsm || String(row.weightGsm || '') === filters.weightGsm)
      && (!filters.startDate || time.slice(0, 10) >= filters.startDate)
      && (!filters.endDate || time.slice(0, 10) <= filters.endDate)
  })
}

function sumByUnit(rows: DyeWorkOrderOnlineRow[], selector: (row: DyeWorkOrderOnlineRow) => number): DyeWorkOrderUnitSummary[] {
  const grouped = new Map<string, number>()
  rows.forEach((row) => grouped.set(row.qtyUnit, round((grouped.get(row.qtyUnit) || 0) + selector(row))))
  return [...grouped.entries()].map(([unit, qty]) => ({ unit, qty })).sort((a, b) => a.unit.localeCompare(b.unit, 'zh-CN'))
}

export function getDyeWorkOrderOnlineSummary(rows: DyeWorkOrderOnlineRow[]): DyeWorkOrderOnlineSummary {
  return {
    receivedQtyByUnit: sumByUnit(rows.filter(row => row.receiptKnown), row => row.receivedInputQty),
    pendingQtyByUnit: sumByUnit(rows, row => row.pendingInboundQty),
    unknownUsageCount: rows.filter(row => !row.usageKnown).length,
    unknownReceiptCount: rows.filter(row => !row.receiptKnown).length,
    plannedQtyByUnit: sumByUnit(rows, (row) => row.plannedQty),
    rawMaterialQtyByUnit: sumByUnit(rows.filter(row => row.usageKnown), (row) => row.rawMaterialQty),
    completedQtyByUnit: sumByUnit(rows, (row) => row.completedQty),
    lossQtyByUnit: sumByUnit(rows, (row) => row.lossQty),
    purchaseOrderCount: new Set(rows.map((row) => row.purchaseOrderNo).filter((value) => value && value !== '备货创建')).size,
  }
}

type DyeWorkOrderExportKind = '全部' | '投入接收' | '超期未完结'

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function buildDyeWorkOrderCsv(rows: DyeWorkOrderOnlineRow[], kind: DyeWorkOrderExportKind): string {
  const selectedRows = kind === '超期未完结' ? rows.filter((row) => row.isOverdue) : rows
  const columns: Array<[string, (row: DyeWorkOrderOnlineRow) => unknown]> = kind === '投入接收'
    ? [
        ['平台加工单号', (row) => row.platformWorkOrderNo],
        ['生产单号', (row) => row.productionOrderNo || '备货创建'],
        ['面料名称', (row) => row.materialName],
        ['原料SKU', (row) => row.rawMaterialSku],
        ['计划数量', (row) => `${row.plannedQty} ${row.qtyUnit}`],
        ['接收状态', (row) => row.receiptStatusLabel],
        ['累计接收', (row) => row.receiptKnown ? `${row.receivedInputQty} ${row.qtyUnit}` : '历史接收待补录'],
        ['来源单据', (row) => row.inputSourceDocumentNos.join(' / ') || '尚无可接收来源'],
      ]
    : [
        ['平台加工单号', (row) => row.platformWorkOrderNo],
        ['任务单号', (row) => row.taskNo],
        ['生产单号', (row) => row.productionOrderNo || '备货创建'],
        ['商品编码', (row) => row.productCode],
        ['商品名称', (row) => row.productName],
        ['采购单号', (row) => row.purchaseOrderNo],
        ['面料名称', (row) => row.materialName],
        ['染色色号', (row) => row.colorNo],
        ['接收状态', (row) => row.receiptStatusLabel],
        ['加工状态', (row) => row.processingStatusLabel],
        ['交出状态', (row) => row.handoverStatusLabel],
        ['上游供料方', (row) => row.upstreamName],
        ['上游属性', (row) => row.upstreamPartners.map(partner=>dyePartnerFields(partner).map(([key,value])=>`${key}：${value}`).join(' / ')).join('；')],
        ['来源单据', (row) => row.inputSourceDocumentNos.join(' / ') || '待补录'],
        ['下游接收方', (row) => `${row.receiverName} / ${row.receiverWarehouseName}`],
        ['下游属性', (row) => row.downstreamPartner ? dyePartnerFields(row.downstreamPartner).map(([key,value])=>`${key}：${value}`).join(' / ') : '按接收方资料'],
        ['计划数量', (row) => `${row.plannedQty} ${row.qtyUnit}`],
        ['已接收', (row) => row.receiptKnown ? `${row.receivedInputQty} ${row.qtyUnit}` : '历史接收待补录'],
        ['完成数量', (row) => `${row.completedQty} ${row.qtyUnit}`],
        ['已交出', (row) => `${row.handedOverQty} ${row.qtyUnit}`],
        ['下游已收', (row) => `${row.downstreamReceivedQty} ${row.qtyUnit}`],
        ['下游待接收', (row) => `${row.pendingInboundQty} ${row.qtyUnit}`],
        ['实际使用', (row) => row.usageKnown ? `${row.rawMaterialQty} ${row.qtyUnit}` : '待补录'],
        ['确认损耗', (row) => row.lossKnown ? `${row.lossQty} ${row.qtyUnit}` : '待确认'],
        ['预计完成时间', (row) => row.plannedFinishAt],
      ]
  return `\uFEFF${[
    columns.map(([label]) => csvCell(label)).join(','),
    ...selectedRows.map((row) => columns.map(([, getter]) => csvCell(getter(row))).join(',')),
  ].join('\n')}`
}
