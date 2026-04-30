import { techPacks, type TechPackPatternPieceInstance, type TechPackPatternPieceSpecialCraftAssignment } from '../tech-packs.ts'
import {
  buildPatternItemsFromTechPack,
} from '../../../pages/tech-pack/context.ts'
import {
  listGeneratedOriginalCutOrderSourceRecords,
  type GeneratedOriginalCutOrderSourceRecord,
} from './generated-original-cut-orders.ts'

export type CutPieceFeiTicketPrintStatus = '待打印' | '已打印' | '已补打' | '已作废'
export type CutPieceFeiTicketFlowStatus =
  | '待生成'
  | '已生成'
  | '已打印'
  | '已绑定周转口袋'
  | '已交出'
  | '已流转到下一工序'
  | '已完成'

export interface FeiTicketSpecialCraft {
  craftCode: string
  craftName: string
  craftCategory?: 'AUXILIARY' | 'SPECIAL'
  craftCategoryName?: '辅助工艺' | '特种工艺'
  craftPosition: 'LEFT' | 'RIGHT' | 'BOTTOM' | 'FACE'
  craftPositionName: '左' | '右' | '底' | '面'
  sourceAssignmentId: string
  remark?: string
}

export interface CutPieceFeiTicket {
  feiTicketId: string
  feiTicketNo: string
  sourceTechPackVersionId: string
  sourcePatternId: string
  sourcePieceId: string
  sourcePieceInstanceId: string
  originalCutPieceOrderId: string
  originalCutPieceOrderNo: string
  mergeBatchId?: string
  mergeBatchNo?: string
  productionOrderId: string
  productionOrderNo: string
  styleNo: string
  skuId: string
  colorId: string
  colorName: string
  sizeName: string
  pieceName: string
  sequenceNo: number
  pieceDisplayName: string
  specialCrafts: FeiTicketSpecialCraft[]
  specialCraftSummary: string
  qrCodePayload: string
  printStatus: CutPieceFeiTicketPrintStatus
  flowStatus: CutPieceFeiTicketFlowStatus
  relatedTransferBagId?: string
  relatedTransferBagNo?: string
  isReprint: boolean
  originalFeiTicketId?: string
  voidReason?: string
  createdAt: string
  printedAt?: string
  updatedAt: string
}

export interface GenerateFeiTicketsInput {
  techPackVersionId: string
  patternId: string
  pieceInstances: TechPackPatternPieceInstance[]
  originalCutPieceOrderId: string
  originalCutPieceOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleNo?: string
  skuId?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  existingTickets?: CutPieceFeiTicket[]
  createdAt?: string
  sourceByPieceInstanceId?: Record<string, {
    sourceTechPackVersionId?: string
    sourcePatternId?: string
  }>
}

export interface FeiTicketGenerationPreview {
  originalCutPieceOrderId: string
  originalCutPieceOrderNo: string
  sourceTechPackVersionId: string
  sourcePatternId: string
  mergeBatchId?: string
  mergeBatchNo?: string
  pieceInstanceTotal: number
  pendingGenerateCount: number
  duplicatePieceInstanceIds: string[]
  specialCraftTicketCount: number
  plainTicketCount: number
  partCount: number
  colorCount: number
  message: string
}

interface PieceInstanceSourceRef {
  techPackVersionId: string
  patternId: string
  patternName: string
  instance: TechPackPatternPieceInstance
}

const GENERATED_TICKETS_STORAGE_KEY = 'cuttingPerPieceFeiTickets'
const DEMO_GENERATED_ORDER_COUNT = 3
const DEMO_PIECES_PER_ORDER = 12
const DEMO_GENERATION_SOURCE_COUNT = 4

let runtimeTickets: CutPieceFeiTicket[] | null = null

function cloneTicket(ticket: CutPieceFeiTicket): CutPieceFeiTicket {
  return {
    ...ticket,
    specialCrafts: ticket.specialCrafts.map((craft) => ({ ...craft })),
  }
}

function cloneTickets(tickets: CutPieceFeiTicket[]): CutPieceFeiTicket[] {
  return tickets.map(cloneTicket)
}

function nowText(input = new Date()): string {
  const year = input.getFullYear()
  const month = `${input.getMonth() + 1}`.padStart(2, '0')
  const day = `${input.getDate()}`.padStart(2, '0')
  const hours = `${input.getHours()}`.padStart(2, '0')
  const minutes = `${input.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function sanitize(value: string): string {
  return String(value || '').trim().replace(/[^A-Za-z0-9\u4e00-\u9fa5_-]+/g, '-').replace(/^-+|-+$/g, '') || 'NA'
}

function normalizeText(value: string | undefined | null, fallback = ''): string {
  const text = String(value || '').trim()
  return text || fallback
}

function buildPieceInstanceSourcePool(): PieceInstanceSourceRef[] {
  return techPacks.flatMap((techPack) => {
    const techPackVersionId = `${techPack.spuCode || 'TECHPACK'}-${techPack.versionLabel || 'V1'}`
    return buildPatternItemsFromTechPack(techPack).flatMap((pattern) =>
      pattern.pieceInstances.map((instance) => ({
        techPackVersionId,
        patternId: pattern.id,
        patternName: pattern.name,
        instance,
      })),
    )
  })
}

function mapSpecialCraftAssignment(assignment: TechPackPatternPieceSpecialCraftAssignment): FeiTicketSpecialCraft {
  return {
    craftCode: assignment.craftCode,
    craftName: assignment.craftName,
    craftCategory: assignment.craftCategory,
    craftCategoryName: assignment.craftCategoryName,
    craftPosition: assignment.craftPosition,
    craftPositionName: assignment.craftPositionName,
    sourceAssignmentId: assignment.assignmentId,
    remark: assignment.remark || '',
  }
}

export function buildSpecialCraftSummary(specialCrafts: FeiTicketSpecialCraft[]): string {
  if (!specialCrafts.length) return '无特殊工艺'
  return specialCrafts.map((craft) => `${craft.craftName}（${craft.craftPositionName}）`).join('、')
}

export function buildFeiTicketNo(input: {
  originalCutPieceOrderNo: string
  sequenceNo: number
}): string {
  return `FT-${input.originalCutPieceOrderNo}-${String(input.sequenceNo).padStart(3, '0')}`
}

export function buildFeiTicketQrPayload(ticket: Pick<
  CutPieceFeiTicket,
  | 'feiTicketId'
  | 'feiTicketNo'
  | 'originalCutPieceOrderId'
  | 'originalCutPieceOrderNo'
  | 'sourcePieceInstanceId'
  | 'productionOrderNo'
  | 'pieceName'
  | 'colorName'
  | 'sizeName'
  | 'sequenceNo'
  | 'specialCrafts'
>): string {
  return JSON.stringify({
    codeType: 'FEI_TICKET',
    schema: 'PER_PIECE_V1',
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    originalCutPieceOrderId: ticket.originalCutPieceOrderId,
    originalCutPieceOrderNo: ticket.originalCutPieceOrderNo,
    sourcePieceInstanceId: ticket.sourcePieceInstanceId,
    productionOrderNo: ticket.productionOrderNo,
    pieceName: ticket.pieceName,
    colorName: ticket.colorName,
    sizeName: ticket.sizeName,
    sequenceNo: ticket.sequenceNo,
    specialCrafts: ticket.specialCrafts.map((craft) => ({
      craftCode: craft.craftCode,
      craftName: craft.craftName,
      craftPosition: craft.craftPosition,
      craftPositionName: craft.craftPositionName,
    })),
  })
}

function getEffectiveTicketByPieceInstanceId(tickets: CutPieceFeiTicket[], sourcePieceInstanceId: string): CutPieceFeiTicket | null {
  return tickets.find((ticket) => ticket.sourcePieceInstanceId === sourcePieceInstanceId && ticket.printStatus !== '已作废') || null
}

function makeTicketId(originalCutPieceOrderId: string, sourcePieceInstanceId: string): string {
  return `FTID-${sanitize(originalCutPieceOrderId)}-${sanitize(sourcePieceInstanceId)}`
}

function buildTicketFromPieceInstance(
  input: GenerateFeiTicketsInput,
  pieceInstance: TechPackPatternPieceInstance,
  sequenceNo: number,
): CutPieceFeiTicket {
  const sourceRef = input.sourceByPieceInstanceId?.[pieceInstance.pieceInstanceId]
  const feiTicketNo = buildFeiTicketNo({
    originalCutPieceOrderNo: input.originalCutPieceOrderNo,
    sequenceNo,
  })
  const feiTicketId = makeTicketId(input.originalCutPieceOrderId, pieceInstance.pieceInstanceId)
  const specialCrafts = pieceInstance.specialCraftAssignments.map(mapSpecialCraftAssignment)
  const sizeName = normalizeText(pieceInstance.sizeName, '均码')
  const pieceDisplayName = `${pieceInstance.pieceName} / ${pieceInstance.colorName} / ${sizeName} / 第${pieceInstance.sequenceNo}片`
  const createdAt = input.createdAt || nowText()
  const ticketWithoutQr: CutPieceFeiTicket = {
    feiTicketId,
    feiTicketNo,
    sourceTechPackVersionId: sourceRef?.sourceTechPackVersionId || input.techPackVersionId,
    sourcePatternId: sourceRef?.sourcePatternId || input.patternId,
    sourcePieceId: pieceInstance.sourcePieceId,
    sourcePieceInstanceId: pieceInstance.pieceInstanceId,
    originalCutPieceOrderId: input.originalCutPieceOrderId,
    originalCutPieceOrderNo: input.originalCutPieceOrderNo,
    mergeBatchId: input.mergeBatchId || '',
    mergeBatchNo: input.mergeBatchNo || '',
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    styleNo: input.styleNo || '',
    skuId: input.skuId || `${input.productionOrderId}-${pieceInstance.colorId}-${sizeName}`,
    colorId: pieceInstance.colorId,
    colorName: pieceInstance.colorName,
    sizeName,
    pieceName: pieceInstance.pieceName,
    sequenceNo: pieceInstance.sequenceNo,
    pieceDisplayName,
    specialCrafts,
    specialCraftSummary: buildSpecialCraftSummary(specialCrafts),
    qrCodePayload: '',
    printStatus: '待打印',
    flowStatus: '已生成',
    isReprint: false,
    createdAt,
    updatedAt: createdAt,
  }
  return {
    ...ticketWithoutQr,
    qrCodePayload: buildFeiTicketQrPayload(ticketWithoutQr),
  }
}

export function generateFeiTicketsFromPieceInstances(input: GenerateFeiTicketsInput): CutPieceFeiTicket[] {
  const existingTickets = input.existingTickets || []
  const results: CutPieceFeiTicket[] = []
  input.pieceInstances.forEach((pieceInstance, index) => {
    const existing = getEffectiveTicketByPieceInstanceId(existingTickets, pieceInstance.pieceInstanceId)
    if (existing) {
      results.push(cloneTicket(existing))
      return
    }
    results.push(buildTicketFromPieceInstance(input, pieceInstance, index + 1))
  })
  return results
}

function getDemoGenerationSources(): Array<{
  source: GeneratedOriginalCutOrderSourceRecord
  pieceRefs: PieceInstanceSourceRef[]
  mergeBatchId?: string
  mergeBatchNo?: string
}> {
  const originalOrders = listGeneratedOriginalCutOrderSourceRecords().slice(0, DEMO_GENERATION_SOURCE_COUNT)
  const piecePool = buildPieceInstanceSourcePool()
  return originalOrders.map((source, index) => ({
    source,
    pieceRefs: piecePool.slice(index * DEMO_PIECES_PER_ORDER, (index + 1) * DEMO_PIECES_PER_ORDER),
    mergeBatchId: index === 1 ? 'merge-batch:MB-2604-PIECE-01' : '',
    mergeBatchNo: index === 1 ? 'MB-2604-PIECE-01' : '',
  })).filter((item) => item.pieceRefs.length > 0)
}

function buildGenerateInputForSource(
  source: GeneratedOriginalCutOrderSourceRecord,
  pieceRefs: PieceInstanceSourceRef[],
  mergeBatchId?: string,
  mergeBatchNo?: string,
  existingTickets: CutPieceFeiTicket[] = [],
): GenerateFeiTicketsInput {
  const firstRef = pieceRefs[0]
  return {
    techPackVersionId: firstRef?.techPackVersionId || `${source.sourceTechPackSpuCode}-${source.techPackVersionLabel || 'V1'}`,
    patternId: firstRef?.patternId || 'UNKNOWN_PATTERN',
    pieceInstances: pieceRefs.map((item) => item.instance),
    originalCutPieceOrderId: source.originalCutOrderId,
    originalCutPieceOrderNo: source.originalCutOrderNo,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    styleNo: source.sourceTechPackSpuCode,
    skuId: source.materialSku,
    mergeBatchId,
    mergeBatchNo,
    existingTickets,
    createdAt: '2026-04-20 09:30',
    sourceByPieceInstanceId: Object.fromEntries(
      pieceRefs.map((item) => [
        item.instance.pieceInstanceId,
        {
          sourceTechPackVersionId: item.techPackVersionId,
          sourcePatternId: item.patternId,
        },
      ]),
    ),
  }
}

function applyDemoStatus(ticket: CutPieceFeiTicket, index: number): CutPieceFeiTicket {
  const printStatuses: CutPieceFeiTicketPrintStatus[] = ['待打印', '已打印', '已打印', '已补打', '已作废', '已打印']
  const flowStatuses: CutPieceFeiTicketFlowStatus[] = ['已生成', '已打印', '已绑定周转口袋', '已交出', '已完成', '已流转到下一工序']
  const printStatus = printStatuses[index % printStatuses.length]
  const flowStatus = flowStatuses[index % flowStatuses.length]
  const printedAt = printStatus === '待打印' ? '' : `2026-04-${String(20 + (index % 6)).padStart(2, '0')} 10:${String(index % 60).padStart(2, '0')}`
  const transferBagNo = flowStatus === '已绑定周转口袋' || flowStatus === '已交出' ? `TB-PIECE-${String(index + 1).padStart(3, '0')}` : ''
  return {
    ...ticket,
    printStatus,
    flowStatus,
    relatedTransferBagId: transferBagNo ? `transfer-bag:${transferBagNo}` : '',
    relatedTransferBagNo: transferBagNo,
    isReprint: printStatus === '已补打',
    originalFeiTicketId: printStatus === '已补打' ? ticket.feiTicketId : '',
    voidReason: printStatus === '已作废' ? '样票污损，现场作废演示。' : '',
    printedAt: printedAt || undefined,
    updatedAt: printedAt || ticket.updatedAt,
  }
}

function buildSeedTickets(): CutPieceFeiTicket[] {
  let sequence = 0
  const generated: CutPieceFeiTicket[] = []
  getDemoGenerationSources().slice(0, DEMO_GENERATED_ORDER_COUNT).forEach((entry) => {
    const input = buildGenerateInputForSource(entry.source, entry.pieceRefs, entry.mergeBatchId, entry.mergeBatchNo, generated)
    const tickets = generateFeiTicketsFromPieceInstances(input)
      .filter((ticket) => !generated.some((item) => item.feiTicketId === ticket.feiTicketId))
      .map((ticket) => applyDemoStatus(ticket, sequence++))
    generated.push(...tickets)
  })
  return generated
}

function readStoredTickets(): CutPieceFeiTicket[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(GENERATED_TICKETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CutPieceFeiTicket[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistRuntimeTickets(): void {
  if (typeof localStorage === 'undefined' || !runtimeTickets) return
  localStorage.setItem(GENERATED_TICKETS_STORAGE_KEY, JSON.stringify(runtimeTickets))
}

function ensureTicketStore(): CutPieceFeiTicket[] {
  if (!runtimeTickets) {
    const seedTickets = buildSeedTickets()
    const storedTickets = readStoredTickets()
    const byId = new Map<string, CutPieceFeiTicket>()
    ;[...seedTickets, ...storedTickets].forEach((ticket) => byId.set(ticket.feiTicketId, ticket))
    runtimeTickets = Array.from(byId.values())
  }
  return runtimeTickets
}

export function listCutPieceFeiTickets(): CutPieceFeiTicket[] {
  return cloneTickets(ensureTicketStore()).sort((left, right) => left.feiTicketNo.localeCompare(right.feiTicketNo, 'zh-CN'))
}

export function getCutPieceFeiTicketById(feiTicketId: string): CutPieceFeiTicket | null {
  const matched = ensureTicketStore().find((ticket) => ticket.feiTicketId === feiTicketId || ticket.feiTicketNo === feiTicketId)
  return matched ? cloneTicket(matched) : null
}

export function getFeiTicketsByOriginalCutPieceOrder(originalCutPieceOrderId: string): CutPieceFeiTicket[] {
  return listCutPieceFeiTickets().filter((ticket) => ticket.originalCutPieceOrderId === originalCutPieceOrderId)
}

export function getFeiTicketsByPieceInstance(pieceInstanceId: string): CutPieceFeiTicket[] {
  return listCutPieceFeiTickets().filter((ticket) => ticket.sourcePieceInstanceId === pieceInstanceId)
}

export function getFeiTicketsBySpecialCraft(craftCode: string): CutPieceFeiTicket[] {
  return listCutPieceFeiTickets().filter((ticket) => ticket.specialCrafts.some((craft) => craft.craftCode === craftCode || craft.craftName === craftCode))
}

export function getFeiTicketsNeedSpecialCraft(): CutPieceFeiTicket[] {
  return listCutPieceFeiTickets().filter((ticket) => ticket.specialCrafts.length > 0)
}

export function listCutPieceFeiTicketGenerationSourceOrders(): Array<{
  originalCutPieceOrderId: string
  originalCutPieceOrderNo: string
  productionOrderNo: string
  mergeBatchId?: string
  mergeBatchNo?: string
  generatedCount: number
  pendingCount: number
}> {
  const tickets = ensureTicketStore()
  return getDemoGenerationSources().map((entry) => {
    const generatedCount = entry.pieceRefs.filter((ref) =>
      tickets.some((ticket) => ticket.sourcePieceInstanceId === ref.instance.pieceInstanceId && ticket.originalCutPieceOrderId === entry.source.originalCutOrderId),
    ).length
    return {
      originalCutPieceOrderId: entry.source.originalCutOrderId,
      originalCutPieceOrderNo: entry.source.originalCutOrderNo,
      productionOrderNo: entry.source.productionOrderNo,
      mergeBatchId: entry.mergeBatchId || '',
      mergeBatchNo: entry.mergeBatchNo || '',
      generatedCount,
      pendingCount: Math.max(entry.pieceRefs.length - generatedCount, 0),
    }
  })
}

export function previewFeiTicketGeneration(originalCutPieceOrderId: string): FeiTicketGenerationPreview | null {
  const entry = getDemoGenerationSources().find((item) => item.source.originalCutOrderId === originalCutPieceOrderId)
  if (!entry) return null
  const tickets = ensureTicketStore()
  const duplicatePieceInstanceIds = entry.pieceRefs
    .map((ref) => ref.instance.pieceInstanceId)
    .filter((pieceInstanceId) => getEffectiveTicketByPieceInstanceId(tickets, pieceInstanceId))
  const pendingRefs = entry.pieceRefs.filter((ref) => !duplicatePieceInstanceIds.includes(ref.instance.pieceInstanceId))
  const specialCraftTicketCount = pendingRefs.filter((ref) => ref.instance.specialCraftAssignments.length > 0).length
  const partCount = new Set(pendingRefs.map((ref) => ref.instance.pieceName)).size
  const colorCount = new Set(pendingRefs.map((ref) => ref.instance.colorId || ref.instance.colorName)).size
  return {
    originalCutPieceOrderId: entry.source.originalCutOrderId,
    originalCutPieceOrderNo: entry.source.originalCutOrderNo,
    sourceTechPackVersionId: entry.pieceRefs[0]?.techPackVersionId || `${entry.source.sourceTechPackSpuCode}-${entry.source.techPackVersionLabel || 'V1'}`,
    sourcePatternId: entry.pieceRefs[0]?.patternId || '',
    mergeBatchId: entry.mergeBatchId || '',
    mergeBatchNo: entry.mergeBatchNo || '',
    pieceInstanceTotal: entry.pieceRefs.length,
    pendingGenerateCount: pendingRefs.length,
    duplicatePieceInstanceIds,
    specialCraftTicketCount,
    plainTicketCount: Math.max(pendingRefs.length - specialCraftTicketCount, 0),
    partCount,
    colorCount,
    message: pendingRefs.length
      ? `本次将生成 ${pendingRefs.length} 张菲票，其中 ${specialCraftTicketCount} 张包含特殊工艺。`
      : '当前裁片实例已生成菲票，请勿重复生成。',
  }
}

export function confirmFeiTicketGeneration(originalCutPieceOrderId: string): {
  success: boolean
  message: string
  preview: FeiTicketGenerationPreview | null
  createdTickets: CutPieceFeiTicket[]
} {
  const entry = getDemoGenerationSources().find((item) => item.source.originalCutOrderId === originalCutPieceOrderId)
  if (!entry) {
    return { success: false, message: '请先选择原始裁片单。', preview: null, createdTickets: [] }
  }
  const preview = previewFeiTicketGeneration(originalCutPieceOrderId)
  if (!preview || preview.pendingGenerateCount <= 0) {
    return { success: false, message: '当前裁片实例已生成菲票，请勿重复生成。', preview, createdTickets: [] }
  }
  const store = ensureTicketStore()
  const pendingRefs = entry.pieceRefs.filter((ref) => !getEffectiveTicketByPieceInstanceId(store, ref.instance.pieceInstanceId))
  const input = buildGenerateInputForSource(entry.source, pendingRefs, entry.mergeBatchId, entry.mergeBatchNo, store)
  const createdTickets = generateFeiTicketsFromPieceInstances(input)
    .filter((ticket) => !store.some((item) => item.feiTicketId === ticket.feiTicketId))
  runtimeTickets = [...store, ...createdTickets]
  persistRuntimeTickets()
  return {
    success: createdTickets.length > 0,
    message: createdTickets.length
      ? `本次将生成 ${createdTickets.length} 张菲票，其中 ${createdTickets.filter((ticket) => ticket.specialCrafts.length > 0).length} 张包含特殊工艺。`
      : '当前裁片实例已生成菲票，请勿重复生成。',
    preview,
    createdTickets: cloneTickets(createdTickets),
  }
}

export function reprintCutPieceFeiTicket(feiTicketId: string): CutPieceFeiTicket | null {
  const store = ensureTicketStore()
  const index = store.findIndex((ticket) => ticket.feiTicketId === feiTicketId)
  if (index < 0) return null
  const next: CutPieceFeiTicket = {
    ...store[index],
    printStatus: '已补打',
    isReprint: true,
    originalFeiTicketId: store[index].originalFeiTicketId || store[index].feiTicketId,
    printedAt: nowText(),
    updatedAt: nowText(),
  }
  runtimeTickets = [...store.slice(0, index), next, ...store.slice(index + 1)]
  persistRuntimeTickets()
  return cloneTicket(next)
}

export function voidCutPieceFeiTicket(feiTicketId: string, voidReason: string): CutPieceFeiTicket | null {
  const store = ensureTicketStore()
  const index = store.findIndex((ticket) => ticket.feiTicketId === feiTicketId)
  if (index < 0) return null
  const next: CutPieceFeiTicket = {
    ...store[index],
    printStatus: '已作废',
    voidReason: voidReason || '已打印菲票不能删除，如需取消请作废。',
    updatedAt: nowText(),
  }
  runtimeTickets = [...store.slice(0, index), next, ...store.slice(index + 1)]
  persistRuntimeTickets()
  return cloneTicket(next)
}

export function resetCutPieceFeiTicketRuntimeForTest(): void {
  runtimeTickets = null
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(GENERATED_TICKETS_STORAGE_KEY)
  }
}
