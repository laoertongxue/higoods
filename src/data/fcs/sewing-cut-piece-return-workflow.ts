import type { Factory } from './factory-types.ts'
import {
  getFactoryActivePpicSnapshot,
  getFactoryMasterRecordById,
  upsertFactoryMasterRecord,
} from './factory-master-store.ts'
import {
  createAndConfirmCutPieceReturn,
  getCutPieceReturnCase,
  listCutPieceReturnCases,
  listCutPieceReturnInitiationCandidates,
  registerCutPieceReturnInitiationCandidateMock,
  scrapCutPieceReturnInventory,
  type CutPieceReturnIdentificationMode,
  type CutPieceReturnInitiationCandidate,
  type CutPieceReturnPhysicalTicketStatus,
} from './cutting/cut-piece-return-domain.ts'

export type SewingCutPieceReturnWorkflowStatus =
  | 'APPROVED_WAITING_WAREHOUSE'
  | 'WAREHOUSE_EXCEPTION'
  | 'WAREHOUSED'

export type SewingCutPieceReturnActorRole = 'PPIC' | 'WAREHOUSE'

export type SewingCutPieceReturnReasonCode =
  | 'EXCESS_OR_WRONG_PIECES'
  | 'QUALITY_REPLACEMENT'
  | 'EXCLUDED_PART_UNUSED'
  | 'TASK_QTY_REDUCED'
  | 'TASK_CANCELLED_OR_TRANSFERRED'

export type SewingCutPieceReturnResponsibilityImpact = 'NO_CHANGE' | 'DEDUCT_ON_WAREHOUSE_RECEIPT'

export interface SewingCutPieceReturnReasonPolicy {
  code: SewingCutPieceReturnReasonCode
  label: string
  responsibilityImpact: SewingCutPieceReturnResponsibilityImpact
  responsibilityExplanation: string
  requiresDecisionReference: boolean
}

export const SEWING_CUT_PIECE_RETURN_REASON_POLICIES: Record<SewingCutPieceReturnReasonCode, SewingCutPieceReturnReasonPolicy> = {
  EXCESS_OR_WRONG_PIECES: {
    code: 'EXCESS_OR_WRONG_PIECES',
    label: '多交／错发裁片退回',
    responsibilityImpact: 'NO_CHANGE',
    responsibilityExplanation: '仅退回多交或错发的实物，不减少工厂已形成的回货责任。',
    requiresDecisionReference: false,
  },
  QUALITY_REPLACEMENT: {
    code: 'QUALITY_REPLACEMENT',
    label: '质量问题换片',
    responsibilityImpact: 'NO_CHANGE',
    responsibilityExplanation: '问题裁片退回等待换片，工厂仍需按原回货责任完成大货。',
    requiresDecisionReference: false,
  },
  EXCLUDED_PART_UNUSED: {
    code: 'EXCLUDED_PART_UNUSED',
    label: '排除部位补交后未使用',
    responsibilityImpact: 'NO_CHANGE',
    responsibilityExplanation: '该部位曾被排除且后续补交未使用，退回实物不重复改变已冻结的回货责任。',
    requiresDecisionReference: false,
  },
  TASK_QTY_REDUCED: {
    code: 'TASK_QTY_REDUCED',
    label: '任务数量正式调减',
    responsibilityImpact: 'DEDUCT_ON_WAREHOUSE_RECEIPT',
    responsibilityExplanation: '必须引用已确认的任务数量调整依据，仓库实际入仓后才按核定件数减少工厂回货责任。',
    requiresDecisionReference: true,
  },
  TASK_CANCELLED_OR_TRANSFERRED: {
    code: 'TASK_CANCELLED_OR_TRANSFERRED',
    label: '剩余任务正式取消／转派',
    responsibilityImpact: 'DEDUCT_ON_WAREHOUSE_RECEIPT',
    responsibilityExplanation: '必须引用已确认的取消或转派依据，仓库实际入仓后才按核定件数减少原工厂回货责任。',
    requiresDecisionReference: true,
  },
}

export interface SewingCutPieceReturnActor {
  actorId: string
  actorName: string
  role: SewingCutPieceReturnActorRole
}

export interface SewingCutPieceReturnPartCount {
  partCode: string
  partName: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  pieceQty: number
  identificationMode: CutPieceReturnIdentificationMode
  physicalTicketStatus: CutPieceReturnPhysicalTicketStatus
  scannedTicketNo: string
}

export interface SewingCutPieceReturnWorkflowEvent {
  eventId: string
  eventType: 'PPIC_CREATED' | 'WAREHOUSE_EXCEPTION' | 'WAREHOUSED' | 'PPIC_RECONFIRMED'
  occurredAt: string
  actorId: string
  actorName: string
  actorRole: SewingCutPieceReturnActorRole
  note: string
}

export interface SewingCutPieceReturnRequest {
  requestId: string
  requestNo: string
  commandId: string
  candidateId: string
  responsibilityScopeKey: string
  sourceHandoverOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sewingTaskNo: string
  factoryId: string
  factoryName: string
  ppicId: string
  ppicName: string
  spuCode: string
  styleName: string
  styleImageUrl: string
  styleImageAlt: string
  garmentColor: string
  size: string
  returnedGarmentQty: number
  returnReasonCode: SewingCutPieceReturnReasonCode
  returnReasonLabel: string
  returnReasonDetail: string
  responsibilityImpact: SewingCutPieceReturnResponsibilityImpact
  responsibilityDecisionReference: string
  expectedReturnQtyBefore: number
  responsibilityAdjustmentQty: number
  expectedReturnQtyAfter: number
  partCounts: SewingCutPieceReturnPartCount[]
  status: SewingCutPieceReturnWorkflowStatus
  createdAt: string
  createdBy: string
  offlineRequestNote: string
  warehouseReceivedAt: string
  warehouseReceivedBy: string
  warehouseExceptionNote: string
  legacyReturnCaseId: string
  legacyReturnOrderNo: string
  events: SewingCutPieceReturnWorkflowEvent[]
}

const requests = new Map<string, SewingCutPieceReturnRequest>()
const commandResults = new Map<string, string>()
let requestSequence = 0
let eventSequence = 0
const WORKFLOW_STORAGE_KEY = 'higood:fcs:sewing-outsourcing:cut-piece-return-workflow:v1'

interface SewingCutPieceReturnWorkflowStore {
  requests: SewingCutPieceReturnRequest[]
  commandResults: Array<[string, string]>
  requestSequence: number
  eventSequence: number
}

function hydrateWorkflowStore(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<SewingCutPieceReturnWorkflowStore>
    ;(parsed.requests || []).forEach((request) => {
      const legacy = request as SewingCutPieceReturnRequest & Partial<Pick<SewingCutPieceReturnRequest,
        'returnReasonCode' | 'returnReasonLabel' | 'returnReasonDetail' | 'responsibilityImpact'
        | 'responsibilityDecisionReference' | 'expectedReturnQtyBefore' | 'responsibilityAdjustmentQty'
        | 'expectedReturnQtyAfter'>>
      const reasonCode = legacy.returnReasonCode || 'TASK_QTY_REDUCED'
      const policy = SEWING_CUT_PIECE_RETURN_REASON_POLICIES[reasonCode]
      const adjustmentQty = Number.isInteger(legacy.responsibilityAdjustmentQty)
        ? legacy.responsibilityAdjustmentQty
        : legacy.returnedGarmentQty
      const expectedBefore = Number.isInteger(legacy.expectedReturnQtyBefore)
        ? legacy.expectedReturnQtyBefore
        : Math.max(legacy.returnedGarmentQty, adjustmentQty)
      requests.set(legacy.requestId, {
        ...legacy,
        returnReasonCode: reasonCode,
        returnReasonLabel: legacy.returnReasonLabel || policy.label,
        returnReasonDetail: legacy.returnReasonDetail || legacy.offlineRequestNote,
        responsibilityImpact: legacy.responsibilityImpact || policy.responsibilityImpact,
        responsibilityDecisionReference: legacy.responsibilityDecisionReference || '历史原型口径',
        expectedReturnQtyBefore: expectedBefore,
        responsibilityAdjustmentQty: adjustmentQty,
        expectedReturnQtyAfter: Number.isInteger(legacy.expectedReturnQtyAfter)
          ? legacy.expectedReturnQtyAfter
          : Math.max(expectedBefore - adjustmentQty, 0),
      })
    })
    ;(parsed.commandResults || []).forEach(([commandId, requestId]) => commandResults.set(commandId, requestId))
    requestSequence = Number.isInteger(parsed.requestSequence) ? parsed.requestSequence! : requests.size
    eventSequence = Number.isInteger(parsed.eventSequence)
      ? parsed.eventSequence!
      : [...requests.values()].reduce((sum, request) => sum + request.events.length, 0)
  } catch {
    // 原型浏览器存储损坏时退回当前会话内存态，页面仍可继续演示。
  }
}

function persistWorkflowStore(): void {
  if (typeof window === 'undefined') return
  try {
    const store: SewingCutPieceReturnWorkflowStore = {
      requests: [...requests.values()],
      commandResults: [...commandResults.entries()],
      requestSequence,
      eventSequence,
    }
    window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // 原型环境禁用 localStorage 时保留当前会话内存事实。
  }
}

hydrateWorkflowStore()

function clone<T>(value: T): T {
  return structuredClone(value)
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label}必须为大于0的整数。`)
  return value
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label}必须为不小于0的整数。`)
  return value
}

function requireRole(actor: SewingCutPieceReturnActor, role: SewingCutPieceReturnActorRole): void {
  if (actor.role !== role) throw new Error(`当前动作仅允许${role === 'PPIC' ? '任务PPIC' : '待交出仓'}操作。`)
}

function appendEvent(
  request: SewingCutPieceReturnRequest,
  eventType: SewingCutPieceReturnWorkflowEvent['eventType'],
  occurredAt: string,
  actor: SewingCutPieceReturnActor,
  note: string,
): void {
  eventSequence += 1
  request.events.push({
    eventId: `CPR-WF-EVT-${String(eventSequence).padStart(5, '0')}`,
    eventType,
    occurredAt,
    actorId: actor.actorId,
    actorName: actor.actorName,
    actorRole: actor.role,
    note,
  })
}

function requireRequest(requestId: string): SewingCutPieceReturnRequest {
  const request = requests.get(requestId)
  if (!request) throw new Error('未找到裁片退仓申请。')
  return request
}

function requireCandidate(candidateId: string): CutPieceReturnInitiationCandidate {
  const candidate = listCutPieceReturnInitiationCandidates().find((item) => item.candidateId === candidateId)
  if (!candidate) throw new Error('未找到车缝任务的正式裁片交出责任范围。')
  if (!candidate.eligible) throw new Error(`当前责任范围不能退仓：${candidate.blockedReasons.join('；')}。`)
  return candidate
}

function normalizePartCounts(
  candidate: CutPieceReturnInitiationCandidate,
  input: Array<{
    partCode: string
    sourceCutOrderId: string
    pieceQty: number
    identificationMode?: CutPieceReturnIdentificationMode
    physicalTicketStatus?: CutPieceReturnPhysicalTicketStatus
    scannedTicketNo?: string
  }>,
): SewingCutPieceReturnPartCount[] {
  const byKey = new Map(input.map((item) => [`${item.sourceCutOrderId}::${item.partCode}`, item]))
  if (byKey.size !== input.length) throw new Error('同一裁片单的同一部位不能重复提交。')
  const counts = candidate.parts.map((part) => {
    const item = byKey.get(`${part.sourceCutOrderId}::${part.partCode}`)
    if (!item) throw new Error(`请完成${part.sourceCutOrderNo} / ${part.partName}的部位和数量核查。`)
    const pieceQty = nonNegativeInteger(item.pieceQty, `${part.partName}数量`)
    if (pieceQty > part.currentReturnablePieceQty) {
      throw new Error(`${part.sourceCutOrderNo} / ${part.partName}最多可退${part.currentReturnablePieceQty}片。`)
    }
    const scannedTicketNo = item.scannedTicketNo?.trim() || ''
    const identificationMode = item.identificationMode || (scannedTicketNo ? 'SCAN_OLD_TICKET' : 'MANUAL_PART_SELECTION')
    const physicalTicketStatus = item.physicalTicketStatus || (scannedTicketNo ? 'PRESENT_AND_SCANNED' : 'MISSING')
    if (identificationMode === 'SCAN_OLD_TICKET' && !part.historicalTicketNos.includes(scannedTicketNo)) {
      throw new Error(`${part.partName}扫描的菲票与冻结来源不匹配。`)
    }
    return {
      partCode: part.partCode,
      partName: part.partName,
      sourceCutOrderId: part.sourceCutOrderId,
      sourceCutOrderNo: part.sourceCutOrderNo,
      pieceQty,
      identificationMode,
      physicalTicketStatus,
      scannedTicketNo,
    }
  })
  if (!counts.some((item) => item.pieceQty > 0)) throw new Error('至少需要有一个部位的实际退仓数量。')
  return counts
}

function assertCurrentPpic(request: SewingCutPieceReturnRequest, actor: SewingCutPieceReturnActor): void {
  requireRole(actor, 'PPIC')
  if (actor.actorId !== request.ppicId) throw new Error('只有该车缝任务当前PPIC可以处理裁片退仓。')
}

export function createSewingCutPieceReturnRequestByPpic(input: {
  commandId: string
  candidateId: string
  returnedGarmentQty: number
  returnReasonCode: SewingCutPieceReturnReasonCode
  returnReasonDetail: string
  responsibilityAdjustmentQty?: number
  responsibilityDecisionReference?: string
  partCounts: Array<{
    partCode: string
    sourceCutOrderId: string
    pieceQty: number
    identificationMode?: CutPieceReturnIdentificationMode
    physicalTicketStatus?: CutPieceReturnPhysicalTicketStatus
    scannedTicketNo?: string
  }>
  offlineRequestNote: string
  actor: SewingCutPieceReturnActor
  createdAt: string
}): SewingCutPieceReturnRequest {
  const replayId = commandResults.get(input.commandId)
  if (replayId) return clone(requireRequest(replayId))
  requireRole(input.actor, 'PPIC')
  const candidate = requireCandidate(input.candidateId)
  if ([...requests.values()].some((item) => item.responsibilityScopeKey === candidate.responsibilityScopeKey && item.status !== 'WAREHOUSED')) {
    throw new Error('该责任范围已有处理中退仓申请，不能重复创建。')
  }
  const ppic = getFactoryActivePpicSnapshot(candidate.sourceFactoryId)
  if (!ppic) throw new Error('承接工厂缺少有效PPIC，必须先补齐工厂主数据。')
  if (input.actor.actorId !== ppic.ppicId) throw new Error('只有该车缝任务当前PPIC可以根据线下申请创建裁片退仓。')
  const returnedGarmentQty = positiveInteger(input.returnedGarmentQty, '实物退仓折算件数')
  const policy = SEWING_CUT_PIECE_RETURN_REASON_POLICIES[input.returnReasonCode]
  if (!policy) throw new Error('请选择有效的裁片退仓原因。')
  const returnReasonDetail = input.returnReasonDetail.trim()
  if (!returnReasonDetail) throw new Error('请填写具体退仓原因。')
  const responsibilityDecisionReference = input.responsibilityDecisionReference?.trim() || ''
  if (policy.requiresDecisionReference && !responsibilityDecisionReference) {
    throw new Error(`${policy.label}会调整工厂回货责任，必须填写已确认的调整依据号。`)
  }
  const requestedAdjustmentQty = input.responsibilityAdjustmentQty === undefined
    ? (policy.responsibilityImpact === 'DEDUCT_ON_WAREHOUSE_RECEIPT' ? returnedGarmentQty : 0)
    : nonNegativeInteger(input.responsibilityAdjustmentQty, '回货责任调整数量')
  if (policy.responsibilityImpact === 'NO_CHANGE' && requestedAdjustmentQty !== 0) {
    throw new Error(`${policy.label}只处理实物退回，不允许减少工厂回货责任。`)
  }
  if (policy.responsibilityImpact === 'DEDUCT_ON_WAREHOUSE_RECEIPT' && requestedAdjustmentQty <= 0) {
    throw new Error(`${policy.label}必须填写大于0的回货责任调整数量。`)
  }
  if (requestedAdjustmentQty > returnedGarmentQty) {
    throw new Error('回货责任调整数量不能超过本次实物退仓折算件数。')
  }
  if (requestedAdjustmentQty > candidate.currentExpectedReturnQty) {
    throw new Error(`回货责任调整${requestedAdjustmentQty}件超过当前应回${candidate.currentExpectedReturnQty}件。`)
  }
  const partCounts = normalizePartCounts(candidate, input.partCounts)
  const offlineRequestNote = input.offlineRequestNote.trim()
  if (!offlineRequestNote) throw new Error('请填写线下收到的车缝工厂退仓申请说明。')
  requestSequence += 1
  const request: SewingCutPieceReturnRequest = {
    requestId: `CPR-WF-${String(requestSequence).padStart(5, '0')}`,
    requestNo: `CPTK-${input.createdAt.slice(0, 10).replaceAll('-', '')}-${String(requestSequence).padStart(4, '0')}`,
    commandId: input.commandId,
    candidateId: candidate.candidateId,
    responsibilityScopeKey: candidate.responsibilityScopeKey,
    sourceHandoverOrderNo: candidate.sourceHandoverOrderNo,
    productionOrderId: candidate.productionOrderId,
    productionOrderNo: candidate.productionOrderNo,
    sewingTaskNo: candidate.sewingTaskId,
    factoryId: candidate.sourceFactoryId,
    factoryName: candidate.sourceFactoryName,
    ppicId: ppic.ppicId,
    ppicName: ppic.ppicName,
    spuCode: candidate.spuCode,
    styleName: candidate.styleName,
    styleImageUrl: candidate.styleImageUrl,
    styleImageAlt: candidate.styleImageAlt,
    garmentColor: candidate.garmentColor,
    size: candidate.size,
    returnedGarmentQty,
    returnReasonCode: policy.code,
    returnReasonLabel: policy.label,
    returnReasonDetail,
    responsibilityImpact: policy.responsibilityImpact,
    responsibilityDecisionReference,
    expectedReturnQtyBefore: candidate.currentExpectedReturnQty,
    responsibilityAdjustmentQty: requestedAdjustmentQty,
    expectedReturnQtyAfter: candidate.currentExpectedReturnQty - requestedAdjustmentQty,
    partCounts,
    status: 'APPROVED_WAITING_WAREHOUSE',
    createdAt: input.createdAt,
    createdBy: input.actor.actorName,
    offlineRequestNote,
    warehouseReceivedAt: '',
    warehouseReceivedBy: '',
    warehouseExceptionNote: '',
    legacyReturnCaseId: '',
    legacyReturnOrderNo: '',
    events: [],
  }
  appendEvent(
    request,
    'PPIC_CREATED',
    input.createdAt,
    input.actor,
    `PPIC根据线下申请建单：${policy.label}；实物退仓折算${returnedGarmentQty}件、${partCounts.reduce((sum, item) => sum + item.pieceQty, 0)}片；${requestedAdjustmentQty > 0 ? `仓库入仓后回货责任由${candidate.currentExpectedReturnQty}件调整为${candidate.currentExpectedReturnQty - requestedAdjustmentQty}件` : `工厂回货责任仍为${candidate.currentExpectedReturnQty}件`}。`,
  )
  requests.set(request.requestId, request)
  commandResults.set(input.commandId, request.requestId)
  persistWorkflowStore()
  return clone(request)
}

export function reconfirmSewingCutPieceReturnByPpic(input: {
  commandId: string
  requestId: string
  note: string
  actor: SewingCutPieceReturnActor
  reconfirmedAt: string
}): SewingCutPieceReturnRequest {
  const replayId = commandResults.get(input.commandId)
  if (replayId) return clone(requireRequest(replayId))
  const request = requireRequest(input.requestId)
  assertCurrentPpic(request, input.actor)
  if (request.status !== 'WAREHOUSE_EXCEPTION') throw new Error('只有仓库反馈接收异常的申请需要PPIC重新确认。')
  const note = input.note.trim()
  if (!note) throw new Error('重新提交仓库前必须填写处理结果。')
  request.status = 'APPROVED_WAITING_WAREHOUSE'
  request.warehouseExceptionNote = ''
  appendEvent(request, 'PPIC_RECONFIRMED', input.reconfirmedAt, input.actor, `${note}；原建单部位和数量继续有效。`)
  commandResults.set(input.commandId, request.requestId)
  persistWorkflowStore()
  return clone(request)
}

export function receiveApprovedCutPieceReturnByWarehouse(input: {
  commandId: string
  requestId: string
  actor: SewingCutPieceReturnActor
  receivedAt: string
  exceptionNote?: string
}): SewingCutPieceReturnRequest {
  const replayId = commandResults.get(input.commandId)
  if (replayId) return clone(requireRequest(replayId))
  const request = requireRequest(input.requestId)
  requireRole(input.actor, 'WAREHOUSE')
  if (request.status === 'WAREHOUSED') return clone(request)
  if (request.status !== 'APPROVED_WAITING_WAREHOUSE') throw new Error('只有PPIC创建并核对完成的退仓申请才能接收入仓。')
  const exceptionNote = input.exceptionNote?.trim() || ''
  if (exceptionNote) {
    request.status = 'WAREHOUSE_EXCEPTION'
    request.warehouseExceptionNote = exceptionNote
    appendEvent(request, 'WAREHOUSE_EXCEPTION', input.receivedAt, input.actor, `仓库仅记录接收异常，不修改PPIC建单数量：${exceptionNote}`)
    commandResults.set(input.commandId, request.requestId)
    persistWorkflowStore()
    return clone(request)
  }
  const result = createAndConfirmCutPieceReturn({
    candidateId: request.candidateId,
    returnedGarmentQty: request.returnedGarmentQty,
    responsibilityAdjustmentGarmentQty: request.responsibilityAdjustmentQty,
    partCounts: request.partCounts.map((item) => ({
      partCode: item.partCode,
      sourceCutOrderId: item.sourceCutOrderId,
      pieceQty: item.pieceQty,
      identificationMode: item.identificationMode,
      physicalTicketStatus: item.physicalTicketStatus,
      scannedTicketNo: item.scannedTicketNo,
      identifiedAt: request.createdAt,
      identifiedBy: request.createdBy,
    })),
    confirmedBy: input.actor.actorName,
    confirmedAt: input.receivedAt,
  })
  request.status = 'WAREHOUSED'
  request.warehouseReceivedAt = input.receivedAt
  request.warehouseReceivedBy = input.actor.actorName
  request.legacyReturnCaseId = result.caseId
  request.legacyReturnOrderNo = result.returnOrderNo
  appendEvent(
    request,
    'WAREHOUSED',
    input.receivedAt,
    input.actor,
    `按PPIC建单数量接收并入仓：实物${request.returnedGarmentQty}件、${request.partCounts.reduce((sum, item) => sum + item.pieceQty, 0)}片；${request.responsibilityAdjustmentQty > 0 ? `工厂回货责任同步减少${request.responsibilityAdjustmentQty}件，调整后应回${request.expectedReturnQtyAfter}件` : `本次原因不影响工厂回货责任，仍应回${request.expectedReturnQtyBefore}件`}。`,
  )
  commandResults.set(input.commandId, request.requestId)
  persistWorkflowStore()
  return clone(request)
}

export function listSewingCutPieceReturnRequests(): SewingCutPieceReturnRequest[] {
  return [...requests.values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.requestId.localeCompare(left.requestId))
    .map(clone)
}

export function getSewingCutPieceReturnRequest(requestId: string): SewingCutPieceReturnRequest | null {
  const request = requests.get(requestId)
  return request ? clone(request) : null
}

function ensureReturnDemoFactoryMaster(): void {
  if (getFactoryMasterRecordById('sew-factory-01')) return
  const factory: Factory = {
    id: 'sew-factory-01',
    code: 'SEW-FACTORY-01',
    name: 'PT Indo Sewing Center',
    factoryShortName: 'Indo Sewing',
    address: 'Jakarta, Indonesia',
    contact: '车缝工厂负责人',
    mobilePhone: '+62 21 8800 0101',
    phone: '+62 21 8800 0101',
    status: 'active',
    cooperationMode: 'general',
    processAbilities: [{ processCode: 'SEW', craftCodes: [], abilityId: 'ABILITY_SEW', processName: '车缝', craftNames: [], abilityName: '车缝', abilityScope: 'PROCESS', canReceiveTask: true, capacityManaged: true, status: 'ACTIVE' }],
    qualityScore: 95,
    deliveryScore: 94,
    createdAt: '2026-08-31 08:00:00',
    updatedAt: '2026-08-31 08:00:00',
    factoryTier: 'THIRD_PARTY',
    factoryType: 'THIRD_SEWING',
    pdaEnabled: true,
    pdaTenantId: 'sew-factory-01',
    assignedPpicId: 'PPIC-ACTIVE-002',
    assignedPpicName: '李敏 PPIC',
    assignedPpicPhone: '13800000002',
    eligibility: { allowDispatch: true, allowBid: true, allowExecute: true, allowSettle: true },
    taskAcceptanceConfig: { singleProcessEnabled: true, canAcceptSewingIronPack: true, canAcceptCuttingSewingIronPack: false },
  }
  upsertFactoryMasterRecord(factory)
}

function closePageDemoReturnInventory(returnCase: NonNullable<ReturnType<typeof getCutPieceReturnCase>>): void {
  if (returnCase.settlementType) return
  returnCase.inventoryLots
    .filter((lot) => lot.warehouseArea === '退裁片库区' && lot.pieceQty - lot.scrappedPieceQty - lot.transferredPieceQty > 0)
    .forEach((lot, index) => {
      scrapCutPieceReturnInventory({
        caseId: returnCase.caseId,
        partCode: lot.partCode,
        sourceCutOrderId: lot.sourceCutOrderId,
        pieceQty: lot.pieceQty - lot.scrappedPieceQty - lot.transferredPieceQty,
        reason: '历史演示单已完成仓内处置，释放同一责任范围的剩余裁片继续申请退仓。',
        operatedBy: '裁床主管 王敏',
        operatedAt: `2026-09-01 10:${String(10 + index).padStart(2, '0')}:00`,
      })
    })
}

function closeLegacyPageDemoCases(): void {
  listCutPieceReturnCases()
    .filter((returnCase) => returnCase.sourceFactoryId === 'sew-factory-01'
      && !returnCase.settlementType
      && returnCase.receipts.some((receipt) => receipt.confirmedBy === '裁床待交出仓 王敏' && receipt.confirmedAt === '2026-09-01 10:00:00'))
    .forEach(closePageDemoReturnInventory)
}

function ensureAvailableReturnCreationCandidate(): void {
  const candidateId = 'RETURN-SOURCE-PPIC-CREATE-DEMO-001'
  if (listCutPieceReturnInitiationCandidates().some((item) => item.candidateId === candidateId)) return
  const source = listCutPieceReturnInitiationCandidates().find((item) => item.eligible && item.sourceFactoryId === 'sew-factory-01')
  if (!source) throw new Error('缺少可复制的正式交出责任范围，无法建立新增退仓演示来源。')
  registerCutPieceReturnInitiationCandidateMock({
    ...source,
    candidateId,
    responsibilityScopeKey: `${source.responsibilityScopeKey}::PPIC-CREATE-DEMO-001`,
    sourceHandoverOrderId: 'HANDOVER-PPIC-CREATE-DEMO-001',
    sourceHandoverOrderNo: 'JCD-PPIC-CREATE-DEMO-001',
    sourceHandoverRecordIds: ['HANDOVER-RECORD-PPIC-CREATE-DEMO-001'],
    sourceHandoverRecordNos: ['JCR-PPIC-CREATE-DEMO-001'],
    productionOrderId: 'PO-202603-0102',
    productionOrderNo: 'PO-202603-0102',
    sewingTaskId: 'ST-260325-002',
    frozenReleaseSnapshotId: 'CUT-RELEASE-PPIC-CREATE-DEMO-001',
    frozenMinimumReturnQty: 120,
    currentExpectedReturnQty: 120,
    parts: source.parts.map((part) => ({
      ...part,
      effectiveHandedPieceQty: Math.max(part.piecesPerGarment * 120, part.piecesPerGarment),
      confirmedReturnedPieceQty: 0,
      currentReturnablePieceQty: Math.max(part.piecesPerGarment * 120, part.piecesPerGarment),
    })),
    eligible: true,
    blockedReasons: [],
  })
}

export function ensureSewingCutPieceReturnWorkflowDemo(): SewingCutPieceReturnRequest {
  ensureReturnDemoFactoryMaster()
  const existing = listSewingCutPieceReturnRequests().find((item) => item.commandId === 'CMD-CPR-WF-DEMO-CREATE-001')
  if (existing) return existing
  closeLegacyPageDemoCases()
  const candidate = listCutPieceReturnInitiationCandidates().find((item) => item.eligible && item.sourceFactoryId === 'sew-factory-01')
  if (!candidate) throw new Error('缺少可用于PPIC退仓建单演示的正式交出责任范围。')
  const ppic = getFactoryActivePpicSnapshot(candidate.sourceFactoryId)
  if (!ppic) throw new Error('演示工厂缺少有效PPIC。')
  return createSewingCutPieceReturnRequestByPpic({
    commandId: 'CMD-CPR-WF-DEMO-CREATE-001',
    candidateId: candidate.candidateId,
    returnedGarmentQty: 10,
    returnReasonCode: 'TASK_QTY_REDUCED',
    returnReasonDetail: '生产单数量已正式调减10件，工厂将对应未生产裁片退回。',
    responsibilityAdjustmentQty: 10,
    responsibilityDecisionReference: 'TASK-CHANGE-PPIC-DEMO-001',
    partCounts: candidate.parts.map((part) => ({
      partCode: part.partCode,
      sourceCutOrderId: part.sourceCutOrderId,
      pieceQty: Math.min(10 * part.piecesPerGarment, part.currentReturnablePieceQty),
      identificationMode: 'MANUAL_PART_SELECTION',
      physicalTicketStatus: 'MISSING',
    })),
    offlineRequestNote: 'PPIC线下收到车缝工厂退仓申请，并已核对实物部位和数量。',
    actor: { actorId: ppic.ppicId, actorName: ppic.ppicName, role: 'PPIC' },
    createdAt: '2026-09-01 09:20:00',
  })
}

export function ensureSewingCutPieceReturnPageDemo(): SewingCutPieceReturnRequest {
  const created = ensureSewingCutPieceReturnWorkflowDemo()
  const request = created.status === 'APPROVED_WAITING_WAREHOUSE'
    ? receiveApprovedCutPieceReturnByWarehouse({
        commandId: 'CMD-CPR-WF-DEMO-WAREHOUSE-001',
        requestId: created.requestId,
        actor: { actorId: 'WAREHOUSE-DEMO-001', actorName: '裁床待交出仓 王敏', role: 'WAREHOUSE' },
        receivedAt: '2026-09-01 10:00:00',
      })
    : created
  if (request.status !== 'WAREHOUSED' || !request.legacyReturnCaseId) return request

  const returnCase = getCutPieceReturnCase(request.legacyReturnCaseId)
  if (returnCase) closePageDemoReturnInventory(returnCase)
  ensureAvailableReturnCreationCandidate()
  const pendingExists = listSewingCutPieceReturnRequests().some((item) => item.commandId === 'CMD-CPR-WF-DEMO-CREATE-002')
  if (!pendingExists) {
    const candidate = listCutPieceReturnInitiationCandidates().find((item) => item.eligible && item.sourceFactoryId === 'sew-factory-01')
    const ppic = candidate ? getFactoryActivePpicSnapshot(candidate.sourceFactoryId) : null
    if (candidate && ppic) {
      createSewingCutPieceReturnRequestByPpic({
        commandId: 'CMD-CPR-WF-DEMO-CREATE-002',
        candidateId: candidate.candidateId,
        returnedGarmentQty: 8,
        returnReasonCode: 'EXCESS_OR_WRONG_PIECES',
        returnReasonDetail: '裁片交出时多配了8件的前片和后片，工厂未投入生产并申请原样退回。',
        responsibilityAdjustmentQty: 0,
        partCounts: candidate.parts.map((part) => ({
          partCode: part.partCode,
          sourceCutOrderId: part.sourceCutOrderId,
          pieceQty: Math.min(8 * part.piecesPerGarment, part.currentReturnablePieceQty),
          identificationMode: 'MANUAL_PART_SELECTION',
          physicalTicketStatus: 'MISSING',
        })),
        offlineRequestNote: 'PPIC已线下收到工厂多交裁片退仓申请，并核对了未投入生产的实物数量。',
        actor: { actorId: ppic.ppicId, actorName: ppic.ppicName, role: 'PPIC' },
        createdAt: '2026-09-01 10:30:00',
      })
    }
  }
  return request
}

export function resetSewingCutPieceReturnWorkflowForTests(): void {
  requests.clear()
  commandResults.clear()
  requestSequence = 0
  eventSequence = 0
  if (typeof window !== 'undefined') window.localStorage.removeItem(WORKFLOW_STORAGE_KEY)
}
