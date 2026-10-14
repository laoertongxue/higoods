import { getEffectiveTaskAssignment, type EffectiveTaskAssignment } from './effective-task-assignments.ts'
import { getCurrentSewingTaskResponsibility } from './sewing-outsourcing-responsibility.ts'
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import { getSewingCutPieceResponsibilityProjection, listSewingCutPieceHandoverEvents } from './sewing-cut-piece-responsibility.ts'
import { getCutPieceDispatchReadinessForTask, getCutPieceReleaseSummaryForProductionOrder, listCutPieceReleaseAvailableQtyVersions, withCutPieceReleaseReadSnapshot } from './cut-piece-release.ts'
import { listManagedCuttingRuntimeEvents, listSimpleCutPieceHandoverEvents, type WholeBagHandoverSubmitPayload } from './cutting/cutting-runtime-event-ledger.ts'
import { isCompleteSuccessfulWholeBagHandoverEvent } from './cutting/whole-bag-handover-read-contract.ts'

export type PpicReturnQuantityBasisStatus = 'READY' | 'WAIT_HANDOVER' | 'AMBIGUOUS' | 'SOURCE_UNAVAILABLE'
export type PpicReturnQuantitySourceKind = 'ASSIGNMENT' | 'CUT_PIECE_COMPLETE_KIT' | 'CUT_PIECE_RELEASE'
export type PpicReturnTaskType = 'INDEPENDENT_SEWING' | 'SEWING_TO_IRON_PACK' | 'CUTTING_TO_IRON_PACK'

export interface PpicReturnQuantitySourceRef {
  kind: 'ASSIGNMENT' | 'REQUIREMENTS' | 'SIMPLE_HANDOVER' | 'TRANSFER_BAG_HANDOVER' | 'LEGACY_HANDOVER' | 'CUT_PIECE_RELEASE'
  recordId: string
  version: string
  occurredAt: string
}
export interface PpicReturnQuantitySkuLine {
  skuCode: string
  color: string
  size: string
  assignedQty: number
  handedOverCompleteKitQty: number
  releaseConfirmQty: number | null
  expectedQty: number | null
}
export interface PpicReturnMissingPart {
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  piecesPerGarment: number
  /** 本色码已交出裁片的最大成衣覆盖量，尚未交出的任务余量不冒充缺部位。 */
  requiredPieceQty: number
  handedOverPieceQty: number
  missingPieceQty: number
}
export interface PpicReturnQuantityBasis {
  assignmentId: string
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  factoryId: string
  factoryName: string
  taskType: PpicReturnTaskType | null
  ppicId: string
  ppicName: string
  expectedQty: number | null
  sourceKind: PpicReturnQuantitySourceKind | null
  status: PpicReturnQuantityBasisStatus
  message: string
  sourceRefs: PpicReturnQuantitySourceRef[]
  skuLines: PpicReturnQuantitySkuLine[]
  missingParts: PpicReturnMissingPart[]
  /** 同一数量及同一来源版本返回相同身份；责任移交不会改变数量依据身份。 */
  basisVersion: string
  imageUrl: string
}

export interface PpicReturnQuantityRequirement {
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  piecesPerGarment: number
}
export interface PpicReturnQuantityHandover {
  sourceRef: PpicReturnQuantitySourceRef
  taskId: string
  factoryId: string
  productionOrderId: string
  lines: Array<{ skuCode: string; color: string; size: string; partCode: string; pieceQty: number; ticketId?: string }>
}
export interface PpicReturnQuantityRelease {
  sourceRef: PpicReturnQuantitySourceRef
  status: 'CONFIRMED' | 'UNCONFIRMED' | 'NEEDS_REVIEW'
  lines: Array<{
    skuCode: string
    color: string
    size: string
    /** 已确认放行数量，绝不传 availableQty。 */
    releaseConfirmQty: number | null
    allocationTaskIds: string[]
    /** 有显式逐任务放行来源时才可提供；不能按工厂或生产单摊量。 */
    taskReleaseConfirmQty?: number
  }>
}
export interface PpicReturnQuantityBasisInput {
  assignment?: EffectiveTaskAssignment
  assignmentId: string
  requirements: PpicReturnQuantityRequirement[]
  requirementRef?: PpicReturnQuantitySourceRef
  handovers: PpicReturnQuantityHandover[]
  release?: PpicReturnQuantityRelease
  ppic?: { ppicId: string; ppicName: string }
  imageUrl?: string
  nowAt?: string
  sourceError?: string
  sourceErrorStatus?: 'SOURCE_UNAVAILABLE' | 'AMBIGUOUS'
}

const text = (value: string) => value.trim().toLowerCase()
const skuKey = (value: { skuCode: string; color: string; size: string }) => JSON.stringify([text(value.skuCode), text(value.color), text(value.size)])
const partKey = (value: { skuCode: string; color: string; size: string; partCode: string }) => JSON.stringify([skuKey(value), text(value.partCode)])
const naturalQuantity = (value: number) => Number.isSafeInteger(value) && value >= 0
const instant = (value: string) => Date.parse(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?$/.test(value) ? `${value.replace(' ', 'T')}+07:00` : value)

function taskTypeFor(processCodes: string[]): PpicReturnTaskType | null {
  const codes = new Set(processCodes.map(code => code.trim().toUpperCase()))
  if (![...codes].some(code => ['SEW', 'SEWING', 'PROC_SEW', 'SEWING_IRON_PACK', 'CUTTING_SEWING_IRON_PACK'].includes(code))) return null
  if ([...codes].some(code => ['CUT', 'CUTTING', 'CUT_PANEL', 'PROC_CUT', 'CUTTING_SEWING_IRON_PACK'].includes(code))) return 'CUTTING_TO_IRON_PACK'
  if ([...codes].some(code => ['IRON_PACK', 'SEWING_IRON_PACK'].includes(code))) return 'SEWING_TO_IRON_PACK'
  return 'INDEPENDENT_SEWING'
}

function versionOf(value: unknown): string {
  // 数量来源在保存前还会核对 sourceRefs；该同步身份只用于比较，不作鉴权或签名。
  let hash = 14695981039346656037n
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 1099511628211n)
  return `PPIC-QTY-V1-${hash.toString(16).padStart(16, '0')}`
}

/** 纯数量契约。来源读取和数量计算分开，缺少依据时保留 null。 */
export function derivePpicReturnQuantityBasis(input: PpicReturnQuantityBasisInput): PpicReturnQuantityBasis {
  const assignment = input.assignment
  const result: PpicReturnQuantityBasis = {
    assignmentId: input.assignmentId, taskId: assignment?.runtimeTaskId || '', taskNo: assignment?.taskNo || '',
    productionOrderId: assignment?.productionOrderId || '', productionOrderNo: assignment?.productionOrderNo || assignment?.productionOrderId || '',
    factoryId: assignment?.factoryId || '', factoryName: assignment?.factoryName || '', taskType: assignment ? taskTypeFor(assignment.processCodes) : null,
    ppicId: input.ppic?.ppicId || assignment?.ppicId || '', ppicName: input.ppic?.ppicName || assignment?.ppicName || '',
    expectedQty: null, sourceKind: null, status: 'SOURCE_UNAVAILABLE', message: '', sourceRefs: [], skuLines: [], missingParts: [], basisVersion: '', imageUrl: input.imageUrl || '',
  }
  function finish(status: PpicReturnQuantityBasisStatus, message: string): PpicReturnQuantityBasis {
    result.status = status; result.message = message
    result.sourceRefs.sort((a, b) => `${a.kind}:${a.recordId}:${a.version}`.localeCompare(`${b.kind}:${b.recordId}:${b.version}`))
    result.basisVersion = versionOf({ assignmentId: result.assignmentId, taskId: result.taskId, factoryId: result.factoryId, taskType: result.taskType,
      status, expectedQty: result.expectedQty, sourceKind: result.sourceKind, sourceRefs: result.sourceRefs, skuLines: result.skuLines, missingParts: result.missingParts })
    return result
  }
  if (input.sourceError) return finish(input.sourceErrorStatus || 'SOURCE_UNAVAILABLE', input.sourceError)
  if (!assignment || assignment.status !== 'EFFECTIVE' || !result.taskType) return finish('SOURCE_UNAVAILABLE', '任务尚无有效车缝分配依据。')
  if (!assignment.runtimeTaskId || !assignment.factoryId || !assignment.productionOrderId || !naturalQuantity(assignment.assignedQty) || assignment.assignedQty <= 0) return finish('SOURCE_UNAVAILABLE', '任务分配身份或数量不完整。')
  if (!assignment.skuLines.length || assignment.skuLines.some(line => !line.skuCode.trim() || !line.color.trim() || !line.size.trim() || !naturalQuantity(line.qty) || line.qty <= 0)
    || assignment.skuLines.reduce((sum, line) => sum + line.qty, 0) !== assignment.assignedQty) return finish('SOURCE_UNAVAILABLE', '分配的颜色、尺码及件数不完整或合计不一致。')
  const assignedKeys = assignment.skuLines.map(skuKey)
  if (new Set(assignedKeys).size !== assignedKeys.length) return finish('AMBIGUOUS', '任务存在重复 SKU 色码，无法唯一确定应回范围。')
  result.sourceRefs.push({ kind: 'ASSIGNMENT', recordId: assignment.assignmentId, version: assignment.operatedAt, occurredAt: assignment.businessAssignedAt })
  result.skuLines = assignment.skuLines.map(line => ({ skuCode: line.skuCode, color: line.color, size: line.size, assignedQty: line.qty, handedOverCompleteKitQty: 0, releaseConfirmQty: null, expectedQty: null })).sort((a, b) => skuKey(a).localeCompare(skuKey(b)))
  if (result.taskType === 'CUTTING_TO_IRON_PACK') {
    result.expectedQty = assignment.assignedQty; result.sourceKind = 'ASSIGNMENT'
    result.skuLines.forEach(line => { line.expectedQty = line.assignedQty })
    return finish('READY', '裁剪＋车缝＋烫包按任务分配数量应回。')
  }
  const until = input.nowAt ? instant(input.nowAt) : Infinity
  if (!Number.isFinite(until) && until !== Infinity) return finish('SOURCE_UNAVAILABLE', '数量核对时间无效。')
  const handovers = input.handovers.filter(event => event.taskId === assignment.runtimeTaskId && event.factoryId === assignment.factoryId && event.productionOrderId === assignment.productionOrderId
    && instant(event.sourceRef.occurredAt) <= until).sort((a, b) => `${a.sourceRef.kind}:${a.sourceRef.recordId}`.localeCompare(`${b.sourceRef.kind}:${b.sourceRef.recordId}`))
  if (!handovers.length) return finish('WAIT_HANDOVER', '裁床尚未形成该任务的实际交出，应回数量待确认。')
  const requirements = input.requirements.filter(line => assignedKeys.includes(skuKey(line))).sort((a, b) => partKey(a).localeCompare(partKey(b)))
  if (!requirements.length || result.skuLines.some(sku => !requirements.some(part => skuKey(sku) === skuKey(part)))
    || requirements.some(part => !part.partCode.trim() || !naturalQuantity(part.piecesPerGarment) || part.piecesPerGarment <= 0)) return finish('SOURCE_UNAVAILABLE', '该任务的必需裁片部位或每件用片数尚未确定。')
  if (new Set(requirements.map(partKey)).size !== requirements.length) return finish('AMBIGUOUS', '同一色码裁片部位存在多个依据，需核对后确定应回数量。')
  if (input.requirementRef) result.sourceRefs.push(input.requirementRef)
  const pieces = new Map<string, number>(), tickets = new Map<string, string>(), records = new Map<string, string>()
  for (const handover of handovers) {
    const identity = handover.sourceRef.recordId
    const sourceTotals = new Map<string, number>()
    handover.lines.forEach(line => sourceTotals.set(partKey(line), (sourceTotals.get(partKey(line)) || 0) + line.pieceQty))
    const canonical = JSON.stringify([...sourceTotals].sort(([a], [b]) => a.localeCompare(b)))
    if (records.has(identity)) {
      if (records.get(identity) !== canonical) return finish('AMBIGUOUS', '同一交出来源存在不同数量版本，请核对原记录。')
      continue
    }
    records.set(identity, canonical); result.sourceRefs.push(handover.sourceRef)
    for (const line of handover.lines) {
      const key = partKey(line)
      if (!requirements.some(part => partKey(part) === key) || !naturalQuantity(line.pieceQty)) return finish('AMBIGUOUS', '交出裁片与当前任务的必需部位或数量不一致。')
      if (line.ticketId) {
        const ticketValue = `${key}:${line.pieceQty}`
        if (tickets.has(line.ticketId)) {
          if (tickets.get(line.ticketId) !== ticketValue) return finish('AMBIGUOUS', '同一菲票在交出来源中存在冲突数量，不能重复计量。')
          continue
        }
        tickets.set(line.ticketId, ticketValue)
      }
      pieces.set(key, (pieces.get(key) || 0) + line.pieceQty)
    }
  }
  for (const sku of result.skuLines) {
    const parts = requirements.filter(part => skuKey(part) === skuKey(sku))
    const coverages = parts.map(part => (pieces.get(partKey(part)) || 0) / part.piecesPerGarment)
    const handedCoverage = Math.max(...coverages)
    if (handedCoverage > sku.assignedQty) return finish('AMBIGUOUS', '实际交出裁片超过该任务分配范围，需核对归属。')
    sku.handedOverCompleteKitQty = Math.floor(Math.min(...coverages))
    for (const part of parts) {
      const handed = pieces.get(partKey(part)) || 0
      const required = Math.ceil(handedCoverage) * part.piecesPerGarment
      if (handed < required) result.missingParts.push({ ...part, requiredPieceQty: required, handedOverPieceQty: handed, missingPieceQty: required - handed })
    }
  }
  if (!result.missingParts.length) {
    const total = result.skuLines.reduce((sum, sku) => sum + sku.handedOverCompleteKitQty, 0)
    if (total <= 0) return finish('WAIT_HANDOVER', '尚无有效齐套交出数量，应回数量待确认。')
    result.expectedQty = total; result.sourceKind = 'CUT_PIECE_COMPLETE_KIT'
    result.skuLines.forEach(sku => { sku.expectedQty = sku.handedOverCompleteKitQty })
    return finish('READY', '无缺裁片，按该任务实际交出的齐套件数应回。')
  }
  result.sourceKind = 'CUT_PIECE_RELEASE'
  const release = input.release
  if (!release || release.status !== 'CONFIRMED' || instant(release.sourceRef.occurredAt) > until) return finish('SOURCE_UNAVAILABLE', release?.status === 'NEEDS_REVIEW' ? '放行数量待裁床复核，应回依据尚未确认。' : '有缺裁片，但该任务尚无已确认的裁片放行数量。')
  result.sourceRefs.push(release.sourceRef)
  for (const sku of result.skuLines) {
    const matches = release.lines.filter(line => skuKey(line) === skuKey(sku))
    if (matches.length !== 1) return finish(matches.length > 1 ? 'AMBIGUOUS' : 'SOURCE_UNAVAILABLE', '放行矩阵无法唯一对应该任务 SKU 色码。')
    const source = matches[0]!
    const taskIds = [...new Set(source.allocationTaskIds)]
    const explicit = source.taskReleaseConfirmQty
    if (explicit === undefined && (taskIds.length !== 1 || taskIds[0] !== assignment.runtimeTaskId)) return finish('AMBIGUOUS', '同一放行色码涉及多个任务或归属未明，不能将生产单放行总量分摊到任务。')
    const quantity = explicit ?? source.releaseConfirmQty
    if (quantity === null || !naturalQuantity(quantity)) return finish('SOURCE_UNAVAILABLE', '对应放行色码尚无有效的实际放行件数。')
    if (quantity > sku.assignedQty) return finish('AMBIGUOUS', '放行数量包含该任务以外的数量，需核对逐任务放行范围。')
    if (quantity < sku.handedOverCompleteKitQty) return finish('AMBIGUOUS', '当前放行数量小于该任务已交出齐套数量，需核对放行版本。')
    sku.releaseConfirmQty = quantity; sku.expectedQty = quantity
  }
  result.expectedQty = result.skuLines.reduce((sum, sku) => sum + (sku.expectedQty || 0), 0)
  if (result.expectedQty <= 0) { result.expectedQty = null; return finish('SOURCE_UNAVAILABLE', '缺片任务尚无正数放行数量，应回数量待确认。') }
  return finish('READY', '有缺裁片，按该任务对应放行矩阵的实际放行件数应回。')
}

/** 只读正式来源；不初始化演示、不保存业务记录、不生成缺失的审批或放行。 */
export function getPpicReturnQuantityBasis(assignmentId: string, nowAt?: string): PpicReturnQuantityBasis {
  let assignment: EffectiveTaskAssignment | undefined
  try {
    assignment = getEffectiveTaskAssignment(assignmentId)
    if (!assignment) return derivePpicReturnQuantityBasis({ assignmentId, requirements: [], handovers: [], nowAt })
    const current = assignment
    const ppic = getCurrentSewingTaskResponsibility(assignment.runtimeTaskId) || undefined
    const techPack = getProductionOrderTechPackSnapshot(assignment.productionOrderId)
    const imageUrl = techPack?.imageSnapshot.productImages[0] || techPack?.imageSnapshot.styleImages[0] || ''
    if (taskTypeFor(assignment.processCodes) === 'CUTTING_TO_IRON_PACK') return derivePpicReturnQuantityBasis({ assignmentId, assignment, requirements: [], handovers: [], ppic, imageUrl, nowAt })
    const simpleEvents = listSimpleCutPieceHandoverEvents().filter(event => event.payload.assignmentId === assignmentId)
    let requirements: PpicReturnQuantityRequirement[] = []
    let requirementRef: PpicReturnQuantitySourceRef | undefined
    try {
      const context = getSewingCutPieceResponsibilityProjection(assignmentId).context
      requirements = context.requirementLines.map(part => ({ skuCode: part.skuCode, color: part.color, size: part.size, partCode: part.partCode, partName: part.partName, piecesPerGarment: part.piecesPerGarment }))
      requirementRef = { kind: 'REQUIREMENTS', recordId: context.requirementSnapshotId, version: context.requirementSnapshotAt, occurredAt: context.requirementSnapshotAt }
    } catch {
      if (techPack) {
        requirements = assignment.skuLines.flatMap(sku => techPack.cutPieceParts.filter(part => (!part.applicableColorList.length || part.applicableColorList.some(color => text(color) === text(sku.color)))
          && (!part.applicableSizeList.length || part.applicableSizeList.some(size => text(size) === text(sku.size)))).map(part => ({ skuCode: sku.skuCode, color: sku.color, size: sku.size, partCode: part.partCode, partName: part.partNameCn, piecesPerGarment: part.pieceCountPerGarment })))
        requirementRef = { kind: 'REQUIREMENTS', recordId: techPack.snapshotId, version: techPack.versionLabel, occurredAt: techPack.snapshotAt }
      }
    }
    const handovers: PpicReturnQuantityHandover[] = simpleEvents.map(event => ({ taskId: event.payload.runtimeTaskId, factoryId: event.payload.factoryId, productionOrderId: event.payload.productionOrderId,
      sourceRef: { kind: 'SIMPLE_HANDOVER', recordId: event.payload.handoverRecordId, version: event.eventId, occurredAt: event.occurredAt }, lines: event.payload.tickets.map(ticket => ({ ...ticket, ticketId: ticket.feiTicketId })) }))
    const simpleRecordIds = new Set(simpleEvents.map(event => event.payload.handoverRecordId))
    for (const event of listSewingCutPieceHandoverEvents(assignmentId)) {
      if (event.status !== 'CONFIRMED' || simpleRecordIds.has(event.handoverRecordId)) continue
      handovers.push({ taskId: event.runtimeTaskId, factoryId: assignment.factoryId, productionOrderId: assignment.productionOrderId,
        sourceRef: { kind: 'LEGACY_HANDOVER', recordId: event.handoverRecordId, version: event.handoverEventId, occurredAt: event.handedOverAt }, lines: event.lines.map(line => ({ ...line })) })
    }
    for (const event of listManagedCuttingRuntimeEvents()) {
      if (!isCompleteSuccessfulWholeBagHandoverEvent(event)) continue
      const payload = event.payload as WholeBagHandoverSubmitPayload
      const tickets = payload.transferBagUses.flatMap(use => use.ticketSnapshot).filter(ticket => ticket.sewingTaskId === current.runtimeTaskId && ticket.receiverFactoryId === current.factoryId && ticket.productionOrderId === current.productionOrderId
        && ticket.ticketKind !== 'BINDING_STRIP' && ticket.ticketKind !== 'REPLACEMENT_FABRIC')
      if (!tickets.length) continue
      const lines: PpicReturnQuantityHandover['lines'] = []
      for (const ticket of tickets) {
        const sku = assignment.skuLines.filter(candidate => text(candidate.color) === text(ticket.color) && text(candidate.size) === text(ticket.size))
        if (sku.length !== 1) return derivePpicReturnQuantityBasis({ assignmentId, assignment, requirements, handovers, ppic, imageUrl, nowAt, sourceErrorStatus: 'AMBIGUOUS', sourceError: '中转袋交出的色码无法唯一对应当前任务 SKU，请核对归属。' })
        lines.push({ skuCode: sku[0]!.skuCode, color: ticket.color, size: ticket.size, partCode: ticket.partCode, pieceQty: ticket.pieceQty, ticketId: ticket.feiTicketId })
      }
      handovers.push({ taskId: assignment.runtimeTaskId, factoryId: assignment.factoryId, productionOrderId: assignment.productionOrderId,
        sourceRef: { kind: 'TRANSFER_BAG_HANDOVER', recordId: payload.handoverRecordId, version: event.eventId, occurredAt: event.occurredAt }, lines })
    }
    // 无缺片时无需遍历整张放行矩阵；放行读取失败也不能抹掉已确认的齐套交出事实。
    const handedBasis = derivePpicReturnQuantityBasis({ assignmentId, assignment, requirements, requirementRef, handovers, ppic, imageUrl, nowAt })
    if (handedBasis.status === 'READY' || handedBasis.status === 'WAIT_HANDOVER' || handedBasis.status === 'AMBIGUOUS' || !handedBasis.missingParts.length) return handedBasis
    const { readiness, summary, versions } = withCutPieceReleaseReadSnapshot(() => {
      const readiness = getCutPieceDispatchReadinessForTask({ productionOrderId: current.productionOrderId, productionOrderNo: current.productionOrderNo, skuLines: current.skuLines })
      return { readiness, summary: getCutPieceReleaseSummaryForProductionOrder(readiness.productionOrderId), versions: listCutPieceReleaseAvailableQtyVersions(readiness.productionOrderId) }
    })
    const until = nowAt ? instant(nowAt) : Infinity
    const releaseVersion = versions.filter(version => instant(version.confirmedAt) <= until).sort((a, b) => a.releaseVersionNo - b.releaseVersionNo).at(-1)
    const release: PpicReturnQuantityRelease | undefined = readiness.hasRecord && summary ? {
      sourceRef: { kind: 'CUT_PIECE_RELEASE', recordId: summary.recordId, version: releaseVersion?.releaseVersionId || String(summary.latestReleaseVersion || ''), occurredAt: releaseVersion?.confirmedAt || summary.latestUpdatedAt },
      status: !releaseVersion ? 'UNCONFIRMED' : releaseVersion.releaseStatus === '确认后需复核' || (instant(summary.latestUpdatedAt) <= until && readiness.releaseAvailableStatus === '确认后需复核') ? 'NEEDS_REVIEW' : ['按齐套放行', '风险放行'].includes(releaseVersion.releaseStatus) ? 'CONFIRMED' : 'UNCONFIRMED',
      lines: readiness.lines.map(line => {
        const matches = releaseVersion ? Object.entries(releaseVersion.releaseQtyByColorSize).filter(([coordinate]) => {
          const [color, size] = coordinate.split('::')
          return text(color || '') === text(line.color) && text(size || '') === text(line.size)
        }) : []
        return { skuCode: line.skuCode, color: line.color, size: line.size, releaseConfirmQty: releaseVersion ? matches.length === 1 ? matches[0]![1] : null : line.releaseConfirmQty, allocationTaskIds: line.allocationTaskIds }
      }),
    } : undefined
    return derivePpicReturnQuantityBasis({ assignmentId, assignment, requirements, requirementRef, handovers, release, ppic, imageUrl, nowAt })
  } catch (error) {
    return derivePpicReturnQuantityBasis({ assignmentId, assignment, requirements: [], handovers: [], nowAt, sourceError: error instanceof Error ? error.message : '应回数量的正式来源无法读取，请保留原记录并重试。' })
  }
}
