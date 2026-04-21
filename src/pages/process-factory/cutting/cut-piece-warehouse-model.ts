import {
  listFormalCutPieceWarehouseRecords,
  type CutPieceHandoverStatus,
  type CutPieceInboundStatus,
  type CutPieceWarehouseRecord,
  type CutPieceZoneCode,
} from '../../../data/fcs/cutting/warehouse-runtime.ts'
import type { OriginalCutOrderRow } from './original-orders-model.ts'
import {
  listPdaHandoverWritebacks,
  listPdaInboundWritebacks,
  type PdaCutPieceHandoverWritebackRecord,
  type PdaCutPieceInboundWritebackRecord,
} from '../../../data/fcs/cutting/pda-execution-writeback-ledger.ts'
import {
  listCutPieceWarehouseWritebacks,
  type CutPieceWarehouseWritebackRecord,
} from '../../../data/fcs/cutting/warehouse-writeback-ledger.ts'
import { buildWarehouseQueryPayload, type WarehouseNavigationPayload } from './warehouse-shared.ts'
import { getBrowserLocalStorage } from '../../../data/browser-storage.ts'
import type { TransferBagViewModel } from './transfer-bags-model.ts'
import {
  buildSpreadingTraceAnchors,
  findSpreadingTraceAnchor,
  type MarkerSpreadingStore,
} from './marker-spreading-model.ts'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export type CutPieceWarehouseRiskKey = 'UNASSIGNED_ZONE' | 'WAITING_INBOUND' | 'WAITING_HANDOFF'

export interface CutPieceWarehouseRiskTag {
  key: CutPieceWarehouseRiskKey
  label: string
  className: string
}

export interface CutPieceWarehouseStatusMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface CutPieceWarehouseItem {
  warehouseItemId: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  materialSku: string
  styleCode: string
  spuCode: string
  cuttingGroup: string
  zoneCode: CutPieceZoneCode
  locationCode: string
  quantity: number
  pieceQty: number
  warehouseStatus: CutPieceWarehouseStatusMeta<'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'>
  handoffStatus: CutPieceWarehouseStatusMeta<CutPieceHandoverStatus>
  inWarehouseAt: string
  inWarehouseBy: string
  handoffTarget: string
  spreadingSessionId: string
  spreadingSessionNo: string
  sourceWritebackId: string
  bagUsageId: string
  bagUsageNo: string
  bagCode: string
  bagFirstSatisfied: boolean
  bagFirstRuleLabel: string
  note: string
  riskTags: CutPieceWarehouseRiskTag[]
  navigationPayload: WarehouseNavigationPayload
  keywordIndex: string[]
}

export interface CutPieceWarehouseZoneSummary {
  zoneCode: CutPieceZoneCode
  itemCount: number
  quantityTotal: number
  pieceQtyTotal: number
  cuttingGroupSummary: string
  occupancyStatus: string
}

export interface CutPieceWarehouseSummary {
  totalItemCount: number
  totalQuantity: number
  pieceQtyTotal: number
  waitingInWarehouseCount: number
  inWarehouseCount: number
  waitingHandoffCount: number
  zoneCount: number
}

export interface CutPieceWarehouseFilters {
  keyword: string
  zoneCode: 'ALL' | CutPieceZoneCode
  cuttingGroup: string
  warehouseStatus: 'ALL' | 'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'
  handoffOnly: boolean
  risk: 'ALL' | CutPieceWarehouseRiskKey
}

export interface CutPieceWarehousePrefilter {
  originalCutOrderId?: string
  originalCutOrderNo?: string
  productionOrderId?: string
  productionOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  materialSku?: string
  spreadingSessionId?: string
  sourceWritebackId?: string
  cuttingGroup?: string
  zoneCode?: CutPieceZoneCode
  warehouseStatus?: 'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'
}

export interface CutPieceWarehouseViewModel {
  items: CutPieceWarehouseItem[]
  itemsById: Record<string, CutPieceWarehouseItem>
  zoneSummary: CutPieceWarehouseZoneSummary[]
  summary: CutPieceWarehouseSummary
}

export const cutPieceWarehouseZoneMeta: Record<CutPieceZoneCode, { label: string; className: string }> = {
  A: { label: 'A 区', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  B: { label: 'B 区', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  C: { label: 'C 区', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  UNASSIGNED: { label: '未分配', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
}

export const cutPieceWarehouseStatusMeta: Record<'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER', { label: string; className: string; detailText: string }> = {
  PENDING_INBOUND: { label: '待入仓', className: 'bg-slate-100 text-slate-700 border border-slate-200', detailText: '当前裁片仍待入仓整理。' },
  INBOUNDED: { label: '已入仓', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200', detailText: '当前裁片已进入裁片仓。' },
  WAITING_HANDOVER: { label: '待交接', className: 'bg-amber-100 text-amber-700 border border-amber-200', detailText: '当前裁片已入仓，待发后道。' },
  HANDED_OVER: { label: '已交接', className: 'bg-sky-100 text-sky-700 border border-sky-200', detailText: '当前裁片已完成后道交接。' },
}

export const cutPieceHandoverStatusMeta: Record<CutPieceHandoverStatus, { label: string; className: string; detailText: string }> = {
  WAITING_HANDOVER: { label: '待交接', className: 'bg-amber-100 text-amber-700 border border-amber-200', detailText: '待交接给后道或后续口袋流程。' },
  HANDED_OVER: { label: '已交接', className: 'bg-sky-100 text-sky-700 border border-sky-200', detailText: '已完成当前交接。' },
}

function parseQuantity(pieceSummary: string): number {
  const matched = pieceSummary.match(/(\d+)/)
  return matched ? Number(matched[1]) : 0
}

function createStatusMeta<Key extends string>(key: Key, label: string, className: string, detailText: string): CutPieceWarehouseStatusMeta<Key> {
  return { key, label, className, detailText }
}

export function deriveCutPieceWarehouseStatus(record: Pick<CutPieceWarehouseRecord, 'inboundStatus'>): CutPieceWarehouseStatusMeta<'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'> {
  const meta = cutPieceWarehouseStatusMeta[record.inboundStatus]
  return createStatusMeta(record.inboundStatus, meta.label, meta.className, meta.detailText)
}

function deriveCutPieceHandoverStatus(record: Pick<CutPieceWarehouseRecord, 'handoverStatus'>): CutPieceWarehouseStatusMeta<CutPieceHandoverStatus> {
  const meta = cutPieceHandoverStatusMeta[record.handoverStatus]
  return createStatusMeta(record.handoverStatus, meta.label, meta.className, meta.detailText)
}

function deriveCutPieceRiskTags(record: CutPieceWarehouseRecord): CutPieceWarehouseRiskTag[] {
  const tags: CutPieceWarehouseRiskTag[] = []
  if (record.zoneCode === 'UNASSIGNED') tags.push({ key: 'UNASSIGNED_ZONE', label: '未分区', className: 'bg-rose-100 text-rose-700 border border-rose-200' })
  if (record.inboundStatus === 'PENDING_INBOUND') tags.push({ key: 'WAITING_INBOUND', label: '待入仓', className: 'bg-slate-100 text-slate-700 border border-slate-200' })
  if (record.handoverStatus === 'WAITING_HANDOVER') tags.push({ key: 'WAITING_HANDOFF', label: '待交接', className: 'bg-amber-100 text-amber-700 border border-amber-200' })
  return tags
}

function buildWarehouseOverlayRecord(options: {
  baseRecord?: CutPieceWarehouseRecord
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
}): CutPieceWarehouseRecord {
  return options.baseRecord || {
    id: `cpw-pda-${options.originalCutOrderId || options.originalCutOrderNo}`,
    warehouseType: 'CUT_PIECE',
    bindingState: options.originalCutOrderId ? 'BOUND_FORMAL_WAREHOUSE_RECORD' : 'UNBOUND_FORMAL_WAREHOUSE_RECORD',
    originalCutOrderId: options.originalCutOrderId,
    originalCutOrderNo: options.originalCutOrderNo,
    productionOrderId: options.productionOrderId,
    productionOrderNo: options.productionOrderNo,
    mergeBatchId: '',
    mergeBatchNo: '',
    cutPieceOrderNo: options.originalCutOrderNo,
    materialSku: options.materialSku,
    groupNo: '工厂端回写',
    zoneCode: 'UNASSIGNED',
    locationLabel: '待补位',
    inboundStatus: 'PENDING_INBOUND',
    inboundAt: '',
    inboundBy: '',
    pieceSummary: '工厂端回写生成的裁片仓记录。',
    handoverStatus: 'WAITING_HANDOVER',
    handoverTarget: '待交接',
    note: '',
  }
}

function applyExecutionWritebackOverlay(
  records: CutPieceWarehouseRecord[],
  options: {
    inboundWritebacks?: PdaCutPieceInboundWritebackRecord[]
    handoverWritebacks?: PdaCutPieceHandoverWritebackRecord[]
  } = {},
): CutPieceWarehouseRecord[] {
  const storage = getBrowserLocalStorage() || undefined
  const inboundWritebacks = options.inboundWritebacks ?? listPdaInboundWritebacks(storage)
  const handoverWritebacks = options.handoverWritebacks ?? listPdaHandoverWritebacks(storage)
  const runtimeMap = new Map<string, CutPieceWarehouseRecord>(
    records.map((record) => [record.originalCutOrderId || record.originalCutOrderNo, { ...record }]),
  )

  inboundWritebacks.forEach((writeback) => {
    const key = writeback.originalCutOrderId || writeback.originalCutOrderNo
    const current = runtimeMap.get(key)
    const next = buildWarehouseOverlayRecord({
      baseRecord: current,
      originalCutOrderId: writeback.originalCutOrderId,
      originalCutOrderNo: writeback.originalCutOrderNo,
      productionOrderId: writeback.productionOrderId,
      productionOrderNo: writeback.productionOrderNo,
      materialSku: writeback.materialSku,
    })
    runtimeMap.set(key, {
      ...next,
      id: current?.id || `cpw-pda-${writeback.originalCutOrderId || writeback.originalCutOrderNo}`,
      bindingState: writeback.originalCutOrderId ? 'BOUND_FORMAL_WAREHOUSE_RECORD' : 'UNBOUND_FORMAL_WAREHOUSE_RECORD',
      originalCutOrderId: writeback.originalCutOrderId,
      originalCutOrderNo: writeback.originalCutOrderNo,
      productionOrderId: writeback.productionOrderId,
      productionOrderNo: writeback.productionOrderNo,
      cutPieceOrderNo: writeback.originalCutOrderNo,
      materialSku: writeback.materialSku,
      mergeBatchId: writeback.mergeBatchId,
      mergeBatchNo: writeback.mergeBatchNo,
      zoneCode: writeback.zoneCode,
      locationLabel: writeback.locationLabel,
      inboundStatus: 'WAITING_HANDOVER',
      inboundAt: writeback.submittedAt,
      inboundBy: writeback.operatorName,
      handoverStatus: current?.handoverStatus || 'WAITING_HANDOVER',
      note: writeback.note || next.note,
    })
  })

  handoverWritebacks.forEach((writeback) => {
    const key = writeback.originalCutOrderId || writeback.originalCutOrderNo
    const current = runtimeMap.get(key)
    const next = buildWarehouseOverlayRecord({
      baseRecord: current,
      originalCutOrderId: writeback.originalCutOrderId,
      originalCutOrderNo: writeback.originalCutOrderNo,
      productionOrderId: writeback.productionOrderId,
      productionOrderNo: writeback.productionOrderNo,
      materialSku: writeback.materialSku,
    })
    runtimeMap.set(key, {
      ...next,
      id: current?.id || `cpw-pda-${writeback.originalCutOrderId || writeback.originalCutOrderNo}`,
      bindingState: writeback.originalCutOrderId ? 'BOUND_FORMAL_WAREHOUSE_RECORD' : 'UNBOUND_FORMAL_WAREHOUSE_RECORD',
      originalCutOrderId: writeback.originalCutOrderId,
      originalCutOrderNo: writeback.originalCutOrderNo,
      productionOrderId: writeback.productionOrderId,
      productionOrderNo: writeback.productionOrderNo,
      cutPieceOrderNo: writeback.originalCutOrderNo,
      materialSku: writeback.materialSku,
      mergeBatchId: writeback.mergeBatchId,
      mergeBatchNo: writeback.mergeBatchNo,
      inboundStatus: 'HANDED_OVER',
      inboundAt: current?.inboundAt || writeback.submittedAt,
      inboundBy: current?.inboundBy || writeback.operatorName,
      handoverStatus: 'HANDED_OVER',
      handoverTarget: writeback.targetLabel,
      note: writeback.note || next.note,
    })
  })

  return Array.from(runtimeMap.values())
}

function applyWarehouseWritebackOverlay(
  records: CutPieceWarehouseRecord[],
  options: {
    warehouseWritebacks?: CutPieceWarehouseWritebackRecord[]
  } = {},
): CutPieceWarehouseRecord[] {
  const storage = getBrowserLocalStorage() || undefined
  const warehouseWritebacks = [...(options.warehouseWritebacks ?? listCutPieceWarehouseWritebacks(storage))]
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt, 'zh-CN'))
  const runtimeMap = new Map<string, CutPieceWarehouseRecord>(
    records.map((record) => [record.id, { ...record }]),
  )

  warehouseWritebacks.forEach((writeback) => {
    const current = runtimeMap.get(writeback.warehouseRecordId)
    const next = buildWarehouseOverlayRecord({
      baseRecord: current,
      originalCutOrderId: writeback.originalCutOrderId,
      originalCutOrderNo: writeback.originalCutOrderNo,
      productionOrderId: writeback.productionOrderId,
      productionOrderNo: writeback.productionOrderNo,
      materialSku: writeback.materialSku,
    })

    const overlayBase: CutPieceWarehouseRecord = {
      ...next,
      id: writeback.warehouseRecordId,
      bindingState: writeback.originalCutOrderId ? 'BOUND_FORMAL_WAREHOUSE_RECORD' : 'UNBOUND_FORMAL_WAREHOUSE_RECORD',
      originalCutOrderId: writeback.originalCutOrderId,
      originalCutOrderNo: writeback.originalCutOrderNo,
      productionOrderId: writeback.productionOrderId,
      productionOrderNo: writeback.productionOrderNo,
      cutPieceOrderNo: writeback.originalCutOrderNo,
      materialSku: writeback.materialSku,
      mergeBatchId: writeback.mergeBatchId,
      mergeBatchNo: writeback.mergeBatchNo,
      zoneCode: (writeback.zoneCode || next.zoneCode) as CutPieceZoneCode,
      locationLabel: writeback.locationCode || next.locationLabel,
      note: writeback.note || next.note,
    }

    if (writeback.actionType === 'CUT_PIECE_WAREHOUSE_SAVE_LOCATION') {
      runtimeMap.set(writeback.warehouseRecordId, overlayBase)
      return
    }

    if (writeback.actionType === 'CUT_PIECE_WAREHOUSE_MARK_INBOUND') {
      runtimeMap.set(writeback.warehouseRecordId, {
        ...overlayBase,
        inboundStatus: 'INBOUNDED',
        inboundAt: writeback.submittedAt,
        inboundBy: writeback.operatorName,
      })
      return
    }

    if (writeback.actionType === 'CUT_PIECE_WAREHOUSE_MARK_WAITING_HANDOFF') {
      runtimeMap.set(writeback.warehouseRecordId, {
        ...overlayBase,
        inboundStatus: 'WAITING_HANDOVER',
        inboundAt: next.inboundAt || writeback.submittedAt,
        inboundBy: next.inboundBy || writeback.operatorName,
        handoverStatus: 'WAITING_HANDOVER',
        handoverTarget: writeback.handoverTarget || '待后道交接',
      })
      return
    }

    runtimeMap.set(writeback.warehouseRecordId, {
      ...overlayBase,
      inboundStatus: 'HANDED_OVER',
      inboundAt: next.inboundAt || writeback.submittedAt,
      inboundBy: next.inboundBy || writeback.operatorName,
      handoverStatus: 'HANDED_OVER',
      handoverTarget: writeback.handoverTarget || '已交接至后道 / 中转袋后续',
    })
  })

  return Array.from(runtimeMap.values())
}

export function buildCutPieceWarehouseNavigationPayload(
  item: Pick<
    CutPieceWarehouseItem,
    | 'originalCutOrderId'
    | 'originalCutOrderNo'
    | 'productionOrderId'
    | 'productionOrderNo'
    | 'mergeBatchId'
    | 'mergeBatchNo'
    | 'materialSku'
    | 'cuttingGroup'
    | 'zoneCode'
    | 'warehouseStatus'
    | 'styleCode'
    | 'spreadingSessionId'
    | 'sourceWritebackId'
    | 'bagUsageId'
    | 'bagCode'
  >,
): WarehouseNavigationPayload {
  return buildWarehouseQueryPayload({
    originalCutOrderId: item.originalCutOrderId,
    originalCutOrderNo: item.originalCutOrderNo,
    productionOrderId: item.productionOrderId,
    productionOrderNo: item.productionOrderNo,
    mergeBatchId: item.mergeBatchId || undefined,
    mergeBatchNo: item.mergeBatchNo || undefined,
    materialSku: item.materialSku || undefined,
    cuttingGroup: item.cuttingGroup,
    zoneCode: item.zoneCode,
    warehouseStatus: item.warehouseStatus.key,
    styleCode: item.styleCode,
    usageId: item.bagUsageId || undefined,
    bagCode: item.bagCode || undefined,
    sampleNo: item.spreadingSessionId || undefined,
    holder: item.sourceWritebackId || undefined,
    autoOpenDetail: true,
  })
}

export function buildCutPieceWarehouseViewModel(
  originalRows: OriginalCutOrderRow[],
  records = listFormalCutPieceWarehouseRecords(),
  options: {
    inboundWritebacks?: PdaCutPieceInboundWritebackRecord[]
    handoverWritebacks?: PdaCutPieceHandoverWritebackRecord[]
    warehouseWritebacks?: CutPieceWarehouseWritebackRecord[]
    transferBagViewModel?: TransferBagViewModel
    spreadingStore?: MarkerSpreadingStore
  } = {},
): CutPieceWarehouseViewModel {
  const runtimeRecords = applyWarehouseWritebackOverlay(
    applyExecutionWritebackOverlay(records, options),
    options,
  )
  const rowById = Object.fromEntries(originalRows.map((row) => [row.originalCutOrderId, row]))
  const rowByOrderNo = Object.fromEntries(originalRows.map((row) => [row.originalCutOrderNo, row]))
  const findBoundOriginalRow = (record: CutPieceWarehouseRecord): OriginalCutOrderRow | undefined =>
    rowById[record.originalCutOrderId] ||
    rowByOrderNo[record.originalCutOrderNo]
  const transferBagBindings = options.transferBagViewModel?.bindings || []
  const spreadingTraceAnchors = options.spreadingStore ? buildSpreadingTraceAnchors(options.spreadingStore) : []
  const spreadingSessionById = new Map((options.spreadingStore?.sessions || []).map((session) => [session.spreadingSessionId, session] as const))
  const items = runtimeRecords
    .map((record) => {
      const row = findBoundOriginalRow(record)
      const baseTraceAnchor = findSpreadingTraceAnchor(spreadingTraceAnchors, {
        originalCutOrderIds: record.originalCutOrderId ? [record.originalCutOrderId] : [],
        mergeBatchId: row?.latestMergeBatchId || record.mergeBatchId,
        materialSku: record.materialSku || '',
        color: '',
      })
      const matchedBinding =
        transferBagBindings.find(
          (binding) =>
            binding.originalCutOrderId === record.originalCutOrderId &&
            (!binding.ticket?.materialSku || binding.ticket.materialSku === record.materialSku) &&
            (!baseTraceAnchor?.spreadingSessionId || binding.usage?.spreadingSessionId === baseTraceAnchor.spreadingSessionId),
        ) ||
        transferBagBindings.find(
          (binding) =>
            binding.originalCutOrderId === record.originalCutOrderId &&
            (!baseTraceAnchor?.spreadingSessionId || binding.usage?.spreadingSessionId === baseTraceAnchor.spreadingSessionId),
        ) ||
        transferBagBindings.find(
          (binding) =>
            binding.originalCutOrderId === record.originalCutOrderId &&
            (!binding.ticket?.materialSku || binding.ticket.materialSku === record.materialSku),
        ) ||
        transferBagBindings.find((binding) => binding.originalCutOrderId === record.originalCutOrderId) ||
        null
      const usageSession = matchedBinding?.usage?.spreadingSessionId
        ? spreadingSessionById.get(matchedBinding.usage.spreadingSessionId) || null
        : null
      const usageSessionMatchesRecord = usageSession
        ? usageSession.originalCutOrderIds.includes(record.originalCutOrderId) ||
          Boolean((row?.latestMergeBatchId || record.mergeBatchId) && usageSession.mergeBatchId === (row?.latestMergeBatchId || record.mergeBatchId))
        : false
      const inheritedUsageTrace =
        matchedBinding?.usage?.spreadingSessionId && usageSessionMatchesRecord
          ? {
              spreadingSessionId: matchedBinding.usage.spreadingSessionId,
              spreadingSessionNo: matchedBinding.usage.spreadingSessionNo,
              sourceWritebackId: matchedBinding.usage.spreadingSourceWritebackId,
            }
          : null
      const traceAnchor =
        inheritedUsageTrace ||
        baseTraceAnchor ||
        findSpreadingTraceAnchor(spreadingTraceAnchors, {
        originalCutOrderIds: record.originalCutOrderId ? [record.originalCutOrderId] : [],
        mergeBatchId: row?.latestMergeBatchId || record.mergeBatchId,
        materialSku: record.materialSku || '',
        color: matchedBinding?.ticket?.color || '',
        })
      const item: CutPieceWarehouseItem = {
        warehouseItemId: record.id,
        originalCutOrderId: record.originalCutOrderId,
        originalCutOrderNo: record.originalCutOrderNo,
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        mergeBatchId: row?.latestMergeBatchId || record.mergeBatchId,
        mergeBatchNo: row?.latestMergeBatchNo || record.mergeBatchNo,
        sourceMarkerId: traceAnchor?.sourceMarkerId || '',
        sourceMarkerNo: traceAnchor?.sourceMarkerNo || '',
        materialSku: record.materialSku,
        styleCode: row?.styleCode || '',
        spuCode: row?.spuCode || '',
        cuttingGroup: record.groupNo,
        zoneCode: record.zoneCode,
        locationCode: record.locationLabel,
        quantity: parseQuantity(record.pieceSummary),
        pieceQty: parseQuantity(record.pieceSummary),
        warehouseStatus: deriveCutPieceWarehouseStatus(record),
        handoffStatus: deriveCutPieceHandoverStatus(record),
        inWarehouseAt: record.inboundAt,
        inWarehouseBy: record.inboundBy,
        handoffTarget: record.handoverTarget,
        spreadingSessionId: traceAnchor?.spreadingSessionId || '',
        spreadingSessionNo: traceAnchor?.spreadingSessionNo || '',
        sourceWritebackId: traceAnchor?.sourceWritebackId || '',
        bagUsageId: matchedBinding?.usageId || '',
        bagUsageNo: matchedBinding?.usage?.usageNo || '',
        bagCode: matchedBinding?.bagCode || '',
        bagFirstSatisfied: Boolean(matchedBinding?.bindingId),
        bagFirstRuleLabel: matchedBinding?.bindingId
          ? '先装袋，再入裁片仓；当前已找到正式中转袋装袋绑定。'
          : '先装袋，再入裁片仓；当前未找到正式中转袋装袋绑定，仅作为待补链路展示。',
        note: record.note,
        riskTags: deriveCutPieceRiskTags(record),
        navigationPayload: buildCutPieceWarehouseNavigationPayload({
          originalCutOrderId: record.originalCutOrderId,
          originalCutOrderNo: record.originalCutOrderNo,
          productionOrderId: record.productionOrderId,
          productionOrderNo: record.productionOrderNo,
          mergeBatchId: row?.latestMergeBatchId || record.mergeBatchId,
          mergeBatchNo: row?.latestMergeBatchNo || record.mergeBatchNo,
          materialSku: record.materialSku,
          cuttingGroup: record.groupNo,
          zoneCode: record.zoneCode,
          warehouseStatus: record.inboundStatus,
          styleCode: row?.styleCode || '',
          spreadingSessionId: traceAnchor?.spreadingSessionId || '',
          sourceWritebackId: traceAnchor?.sourceWritebackId || '',
          bagUsageId: matchedBinding?.usageId || '',
          bagCode: matchedBinding?.bagCode || '',
        }),
        keywordIndex: [
          record.originalCutOrderId,
          record.originalCutOrderNo,
          record.productionOrderId,
          record.productionOrderNo,
          record.materialSku,
          row?.styleCode,
          row?.spuCode,
          record.groupNo,
          record.locationLabel,
          row?.latestMergeBatchId,
          row?.latestMergeBatchNo,
          traceAnchor?.spreadingSessionId,
          traceAnchor?.sourceWritebackId,
          matchedBinding?.bagCode,
          matchedBinding?.usage?.usageNo,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase()),
      }
      return item
    })
    .sort((left, right) => left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN'))

  return {
    items,
    itemsById: Object.fromEntries(items.map((item) => [item.warehouseItemId, item])),
    zoneSummary: summarizeCutPieceWarehouseZones(items),
    summary: {
      totalItemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      pieceQtyTotal: items.reduce((sum, item) => sum + item.pieceQty, 0),
      waitingInWarehouseCount: items.filter((item) => item.warehouseStatus.key === 'PENDING_INBOUND').length,
      inWarehouseCount: items.filter((item) => item.warehouseStatus.key !== 'PENDING_INBOUND').length,
      waitingHandoffCount: items.filter((item) => item.handoffStatus.key === 'WAITING_HANDOVER').length,
      zoneCount: new Set(items.map((item) => item.zoneCode)).size,
    },
  }
}

export function summarizeCutPieceWarehouseZones(items: CutPieceWarehouseItem[]): CutPieceWarehouseZoneSummary[] {
  return (['A', 'B', 'C', 'UNASSIGNED'] as CutPieceZoneCode[])
    .map((zoneCode) => {
      const zoneItems = items.filter((item) => item.zoneCode === zoneCode)
      return {
        zoneCode,
        itemCount: zoneItems.length,
        quantityTotal: zoneItems.reduce((sum, item) => sum + item.quantity, 0),
        pieceQtyTotal: zoneItems.reduce((sum, item) => sum + item.pieceQty, 0),
        cuttingGroupSummary: Array.from(new Set(zoneItems.map((item) => item.cuttingGroup))).slice(0, 3).join(' / ') || '待补',
        occupancyStatus: zoneItems.length ? (zoneCode === 'UNASSIGNED' ? '待整理' : '已使用') : '空位充足',
      }
    })
    .filter((zone) => zone.itemCount > 0 || zone.zoneCode !== 'UNASSIGNED')
}

export function filterCutPieceWarehouseItems(
  items: CutPieceWarehouseItem[],
  filters: CutPieceWarehouseFilters,
  prefilter: CutPieceWarehousePrefilter | null,
): CutPieceWarehouseItem[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return items.filter((item) => {
    if (prefilter?.originalCutOrderId && item.originalCutOrderId !== prefilter.originalCutOrderId) return false
    if (prefilter?.originalCutOrderNo && item.originalCutOrderNo !== prefilter.originalCutOrderNo) return false
    if (prefilter?.productionOrderId && item.productionOrderId !== prefilter.productionOrderId) return false
    if (prefilter?.productionOrderNo && item.productionOrderNo !== prefilter.productionOrderNo) return false
    if (prefilter?.mergeBatchId && item.mergeBatchId !== prefilter.mergeBatchId) return false
    if (prefilter?.mergeBatchNo && item.mergeBatchNo !== prefilter.mergeBatchNo) return false
    if (prefilter?.materialSku && item.materialSku !== prefilter.materialSku) return false
    if (prefilter?.spreadingSessionId && item.spreadingSessionId !== prefilter.spreadingSessionId) return false
    if (prefilter?.sourceWritebackId && item.sourceWritebackId !== prefilter.sourceWritebackId) return false
    if (prefilter?.cuttingGroup && item.cuttingGroup !== prefilter.cuttingGroup) return false
    if (prefilter?.zoneCode && item.zoneCode !== prefilter.zoneCode) return false
    if (prefilter?.warehouseStatus && item.warehouseStatus.key !== prefilter.warehouseStatus) return false
    if (filters.zoneCode !== 'ALL' && item.zoneCode !== filters.zoneCode) return false
    if (filters.cuttingGroup && item.cuttingGroup !== filters.cuttingGroup) return false
    if (filters.warehouseStatus !== 'ALL' && item.warehouseStatus.key !== filters.warehouseStatus) return false
    if (filters.handoffOnly && item.handoffStatus.key !== 'WAITING_HANDOVER') return false
    if (filters.risk !== 'ALL' && !item.riskTags.some((tag) => tag.key === filters.risk)) return false
    if (!keyword) return true
    return item.keywordIndex.some((value) => value.includes(keyword))
  })
}

export function findCutPieceWarehouseByPrefilter(items: CutPieceWarehouseItem[], prefilter: CutPieceWarehousePrefilter | null): CutPieceWarehouseItem | null {
  if (!prefilter) return null
  return (
    (prefilter.originalCutOrderId && items.find((item) => item.originalCutOrderId === prefilter.originalCutOrderId)) ||
    (prefilter.originalCutOrderNo && items.find((item) => item.originalCutOrderNo === prefilter.originalCutOrderNo)) ||
    (prefilter.mergeBatchId && items.find((item) => item.mergeBatchId === prefilter.mergeBatchId)) ||
    (prefilter.mergeBatchNo && items.find((item) => item.mergeBatchNo === prefilter.mergeBatchNo)) ||
    (prefilter.productionOrderId && items.find((item) => item.productionOrderId === prefilter.productionOrderId)) ||
    (prefilter.productionOrderNo && items.find((item) => item.productionOrderNo === prefilter.productionOrderNo)) ||
    (prefilter.materialSku && items.find((item) => item.materialSku === prefilter.materialSku)) ||
    (prefilter.spreadingSessionId && items.find((item) => item.spreadingSessionId === prefilter.spreadingSessionId)) ||
    (prefilter.sourceWritebackId && items.find((item) => item.sourceWritebackId === prefilter.sourceWritebackId)) ||
    null
  )
}

export function formatCutPieceQuantity(value: number): string {
  return `${numberFormatter.format(Math.max(value, 0))} 件`
}
