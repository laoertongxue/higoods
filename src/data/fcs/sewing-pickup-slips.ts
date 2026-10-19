import { getBrowserLocalStorage } from '../browser-storage.ts'
import { getEffectiveTaskAssignment, type EffectiveTaskAssignment } from './effective-task-assignments.ts'
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import { DEDICATED_CUTTING_FACTORY_ID } from './factory-mock-data.ts'
import {
  getSewingCutPieceResponsibilityProjection,
  initializeSewingCutPieceResponsibility,
  recordSewingCutPieceHandover,
} from './sewing-cut-piece-responsibility.ts'
import {
  getSewingMaterialHandoverProjection,
  initializeSewingMaterialHandoverForAssignment,
  recordSewingMaterialHandover,
} from './sewing-material-handover.ts'

export type SewingPickupObjectKind = 'CUT_PIECE' | 'ACCESSORY' | 'FABRIC_ACCESSORY'
export type SewingPickupSlipStatus = 'CURRENT' | 'VOIDED'

export interface SewingPickupSlipLine {
  lineId: string
  sourceLineId: string
  sourcePartCode?: string
  piecesPerGarment?: number
  allocatedGarmentQty?: number
  objectType: '裁片' | '面料' | '辅料'
  objectCode: string
  objectName: string
  color: string
  size: string
  part: string
  unit: string
  requiredQty: number
  previouslyHandedOverQty: number
  availableQty: number
  imageUrl: string
}

export interface SewingPickupSlipVersion {
  slipId: string
  slipNo: string
  versionId: string
  versionNo: number
  versionLabel: string
  status: SewingPickupSlipStatus
  assignmentId: string
  runtimeTaskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  taskKindLabel: string
  factoryId: string
  factoryName: string
  ppicId: string
  ppicName: string
  warehouseName: string
  objectKind: SewingPickupObjectKind
  styleCode: string
  styleName: string
  styleImageUrl: string
  lines: SewingPickupSlipLine[]
  printedAt: string
  printedByPpicId: string
  printedByPpicName: string
  reprintReason?: string
  voidedAt?: string
}

export interface SewingPickupHandoverResult {
  commandId: string
  versionId: string
  sourceRecordId: string
  sourceRecordNo: string
  recordedAt: string
  recordedBy: string
  actorFactoryId: string
  objectKind: SewingPickupObjectKind
  recordedByRole: 'CUTTING_WAREHOUSE' | 'MATERIAL_WAREHOUSE'
  quantities: Array<{ lineId: string; actualQty: number }>
}

export interface SewingPickupIssueInput {
  assignmentId: string
  objectKind: SewingPickupObjectKind
  printedAt: string
  printedByPpicId: string
  printedByPpicName: string
  reprintReason?: string
}
export interface SewingPickupConfirmInput {
  commandId: string
  versionId: string
  recordedAt: string
  recordedBy: string
  actorFactoryId: string
  recordedByRole: 'CUTTING_WAREHOUSE' | 'MATERIAL_WAREHOUSE' | 'PPIC'
  quantities: Array<{ lineId: string; actualQty: number }>
}
export interface SewingPickupWarehouseBridge {
  ownsAssignment(assignmentId: string): boolean
  usesCanonical(assignmentId: string): boolean
  versions(): SewingPickupSlipVersion[]
  results(): SewingPickupHandoverResult[]
  availability(assignmentId: string, kind: SewingPickupObjectKind): { available: boolean; reason: string }
  issue(input: SewingPickupIssueInput): Promise<SewingPickupSlipVersion>
  record(input: SewingPickupConfirmInput): Promise<SewingPickupHandoverResult>
  pickupPath(assignmentId: string, versionId?: string): string | undefined
}
let warehouseBridge: SewingPickupWarehouseBridge | null = null
export function installSewingPickupWarehouseBridge(bridge: SewingPickupWarehouseBridge): void { warehouseBridge = bridge }
function allVersions(): SewingPickupSlipVersion[] {
  return [...new Map([...versions.values()].filter(row => row.objectKind === 'CUT_PIECE' || !warehouseBridge?.usesCanonical(row.assignmentId)).concat(warehouseBridge?.versions() || []).map(row => [row.versionId, row])).values()]
}
export function getSewingPickupWarehousePath(assignmentId: string, versionId?: string): string | undefined { return warehouseBridge?.pickupPath(assignmentId, versionId) }
export function isWarehouseManagedSewingAssignment(assignmentId: string): boolean { return Boolean(warehouseBridge?.ownsAssignment(assignmentId)) }
export async function issueSewingPickupSlipPersisted(input: SewingPickupIssueInput): Promise<SewingPickupSlipVersion> {
  if (warehouseBridge?.ownsAssignment(input.assignmentId)) return warehouseBridge.issue(input)
  return issueSewingPickupSlip(input)
}
export async function recordSewingPickupHandoverPersisted(input: SewingPickupConfirmInput): Promise<SewingPickupHandoverResult> {
  const version = getSewingPickupSlipVersion(input.versionId)
  if (version && version.objectKind !== 'CUT_PIECE' && warehouseBridge?.ownsAssignment(version.assignmentId)) return warehouseBridge.record(input)
  return recordSewingPickupHandover(input)
}
/** 显式迁移用；读取不写入，不把旧源当作新事实自动重放。 */
export function readLegacySewingPickupStorage(): { raw: string | null; versions: SewingPickupSlipVersion[]; handoverResults: SewingPickupHandoverResult[] } {
  const raw = getBrowserLocalStorage()?.getItem(STORAGE_KEY) ?? null
  if (!raw) return { raw, versions: [], handoverResults: [] }
  const parsed = JSON.parse(raw)
  if (parsed.version !== 1 || !Array.isArray(parsed.versions) || !Array.isArray(parsed.handoverResults)) throw new Error('旧车缝领料资料格式无法核对，保留原资料。')
  return { raw, versions: clone(parsed.versions), handoverResults: clone(parsed.handoverResults) }
}
export function cleanupLegacySewingPickupStorage(expectedRaw: string | null, ownedVersionIds: readonly string[]): void {
  const storage = getBrowserLocalStorage()
  if ((storage?.getItem(STORAGE_KEY) ?? null) !== expectedRaw) throw new Error('旧标签页已改动车缝领料资料，请刷新后重新核对。')
  const parsed = readLegacySewingPickupStorage()
  const owned = new Set(ownedVersionIds)
  const original = parsed.raw ? JSON.parse(parsed.raw) : { version: 1 }
  const remaining = { ...original, versions: parsed.versions.filter(row => !owned.has(row.versionId)), handoverResults: parsed.handoverResults.filter(row => !owned.has(row.versionId)) }
  if (remaining.versions.length || remaining.handoverResults.length || Object.keys(remaining).some(key => !['version', 'versions', 'handoverResults'].includes(key))) storage?.setItem?.(STORAGE_KEY, JSON.stringify(remaining))
  else storage?.removeItem?.(STORAGE_KEY)
  for (const id of owned) versions.delete(id)
  for (const [id, result] of handoverResults) if (owned.has(result.versionId)) handoverResults.delete(id)
  for (const [id, versionId] of currentVersionIdBySlip) if (owned.has(versionId)) currentVersionIdBySlip.delete(id)
}

const STORAGE_KEY = 'higood:ppic:sewing-pickup-slips:v1'
const versions = new Map<string, SewingPickupSlipVersion>()
const currentVersionIdBySlip = new Map<string, string>()
const handoverResults = new Map<string, SewingPickupHandoverResult>()
let loaded = false

function clone<T>(value: T): T {
  return structuredClone(value)
}

function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

function normalizedCodes(assignment: EffectiveTaskAssignment): string[] {
  return assignment.processCodes.map((code) => code.trim().toUpperCase()).map((code) => code === 'SEW' ? 'SEWING' : code)
}

function assignmentTaskKind(assignment: EffectiveTaskAssignment): { kind: SewingPickupObjectKind; label: string } {
  const codes = normalizedCodes(assignment)
  if (!codes.includes('SEWING')) throw new Error('只有含车缝的执行任务可以打印领料单')
  if (codes.includes('CUTTING')) return { kind: 'FABRIC_ACCESSORY', label: '裁剪+车缝+烫包' }
  if (codes.includes('IRON_PACK')) return { kind: 'ACCESSORY', label: '车缝+烫包' }
  return { kind: 'ACCESSORY', label: '独立车缝' }
}

function slipId(assignmentId: string, objectKind: SewingPickupObjectKind): string {
  return `PPIC-PICKUP-${assignmentId}-${objectKind}`
}

function load(): void {
  if (loaded) return
  let raw: string | null | undefined
  try { raw = getBrowserLocalStorage()?.getItem(STORAGE_KEY) }
  catch {
    if (warehouseBridge?.versions().length) { loaded = true; return }
    throw new Error('旧车缝领料资料无法读取，请先核对本机资料。')
  }
  loaded = true
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as {
      version?: number
      versions?: SewingPickupSlipVersion[]
      handoverResults?: SewingPickupHandoverResult[]
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.versions) || !Array.isArray(parsed.handoverResults)) return
    parsed.versions.forEach((item) => {
      if (!item?.versionId || !item.slipId || !Array.isArray(item.lines)) return
      versions.set(item.versionId, clone(item))
      if (item.status === 'CURRENT') currentVersionIdBySlip.set(item.slipId, item.versionId)
    })
    parsed.handoverResults.forEach((item) => {
      if (item?.commandId && item.versionId && Array.isArray(item.quantities) && item.recordedByRole) {
        handoverResults.set(item.commandId, clone(item))
      }
    })
    handoverResults.forEach((result) => {
      const version = versions.get(result.versionId)
      if (!version || (version.objectKind !== 'CUT_PIECE' && warehouseBridge?.ownsAssignment(version.assignmentId))) return
      try {
        ensureSourceContext(version)
        applyHandoverToExistingLedger(version, result)
      } catch {
        // The scan page will show the current source error instead of fabricating a second fact.
      }
    })
  } catch {
    // Corrupt prototype storage is ignored instead of overwriting current domain facts.
  }
}

function persist(): void {
  getBrowserLocalStorage()?.setItem?.(STORAGE_KEY, JSON.stringify({
    version: 1,
    versions: [...versions.values()],
    handoverResults: [...handoverResults.values()],
  }))
}

function requireAssignment(assignmentId: string): EffectiveTaskAssignment {
  const assignment = getEffectiveTaskAssignment(assignmentId)
  if (!assignment || assignment.status !== 'EFFECTIVE') throw new Error('领料单必须绑定当前有效的车缝执行任务')
  if (!assignment.ppicId || !assignment.ppicName) throw new Error('执行任务没有冻结PPIC，不能打印领料单')
  return assignment
}

function ensureSourceContext(version: SewingPickupSlipVersion): void {
  const assignment = requireAssignment(version.assignmentId)
  if (version.objectKind === 'CUT_PIECE') {
    try {
      getSewingCutPieceResponsibilityProjection(version.assignmentId)
      return
    } catch {
      initializeSewingCutPieceResponsibility({
        assignmentId: version.assignmentId,
        requirementSnapshotId: `PICKUP-SNAPSHOT-${version.slipId}`,
        requirementSnapshotAt: version.printedAt,
        requirementSnapshotBy: version.printedByPpicName,
        requirementLines: version.lines.map((line) => ({
          skuCode: line.objectCode,
          color: line.color,
          size: line.size,
          partCode: line.sourcePartCode || line.part,
          partName: line.part,
          piecesPerGarment: line.piecesPerGarment || 1,
          allocatedGarmentQty: line.allocatedGarmentQty || assignment.skuLines.find((item) => item.skuCode === line.objectCode)?.qty || 1,
        })),
      })
      return
    }
  }
  initializeSewingMaterialHandoverForAssignment({ ...assignment, ppicId: assignment.ppicId!, ppicName: assignment.ppicName! })
}

function applyHandoverToExistingLedger(
  version: SewingPickupSlipVersion,
  result: SewingPickupHandoverResult,
): void {
  const lineById = new Map(version.lines.map((line) => [line.lineId, line]))
  const quantities = result.quantities.map((item) => {
    const line = lineById.get(item.lineId)
    if (!line) throw new Error(`领料明细${item.lineId}不属于当前领料单`)
    return { line, actualQty: item.actualQty }
  })
  if (version.objectKind === 'CUT_PIECE') {
    recordSewingCutPieceHandover({
      commandId: result.commandId,
      assignmentId: version.assignmentId,
      handoverRecordId: result.sourceRecordId,
      handoverRecordNo: result.sourceRecordNo,
      dispatchBatchId: version.versionId,
      handedOverAt: result.recordedAt,
      handedOverBy: result.recordedBy,
      lines: quantities.map(({ line, actualQty }) => ({
        skuCode: line.objectCode,
        color: line.color,
        size: line.size,
        partCode: line.sourcePartCode || line.part,
        pieceQty: actualQty,
      })),
    })
    return
  }
  recordSewingMaterialHandover({
    commandId: result.commandId,
    assignmentId: version.assignmentId,
    sourceRecordId: result.sourceRecordId,
    sourceRecordNo: result.sourceRecordNo,
    handedOverAt: result.recordedAt,
    handedOverBy: result.recordedBy,
    handedOverByRole: result.recordedByRole,
    lines: quantities.map(({ line, actualQty }) => ({ requirementLineId: line.sourceLineId, actualQty })),
  })
}

function materialLines(assignment: EffectiveTaskAssignment, objectKind: SewingPickupObjectKind): SewingPickupSlipLine[] {
  initializeSewingMaterialHandoverForAssignment({
    ...assignment,
    ppicId: assignment.ppicId!,
    ppicName: assignment.ppicName!,
  })
  const projection = getSewingMaterialHandoverProjection(assignment.assignmentId)
  if (projection.context.dataCompleteness !== 'COMPLETE') throw new Error('技术包物料需求不完整，不能打印领料单')
  return projection.lines
    .filter((line) => objectKind === 'FABRIC_ACCESSORY' || line.materialType === '辅料')
    .map((line) => ({
      lineId: `PICKUP-LINE-${line.requirementLineId}`,
      sourceLineId: line.requirementLineId,
      objectType: line.materialType,
      objectCode: line.materialCode,
      objectName: line.materialName,
      color: line.materialSpec || '按技术包',
      size: '不适用',
      part: line.materialType,
      unit: line.unit,
      requiredQty: line.requiredQty,
      previouslyHandedOverQty: line.cumulativeHandedOverQty,
      availableQty: line.shortageQty,
      imageUrl: line.imageUrl || '',
    }))
}

function cutPieceLines(assignment: EffectiveTaskAssignment): SewingPickupSlipLine[] {
  const projection = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
  return projection.lines.map((line) => ({
    lineId: `PICKUP-LINE-${line.requirementLineId}`,
    sourceLineId: line.requirementLineId,
    sourcePartCode: line.partCode,
    piecesPerGarment: line.piecesPerGarment,
    allocatedGarmentQty: line.allocatedGarmentQty,
    objectType: '裁片',
    objectCode: line.skuCode,
    objectName: `${line.partName}裁片`,
    color: line.color,
    size: line.size,
    part: line.partName,
    unit: '片',
    requiredQty: line.requiredPieceQty,
    previouslyHandedOverQty: line.handedOverPieceQty,
    availableQty: line.debtPieceQty,
    imageUrl: '',
  }))
}

function buildLines(assignment: EffectiveTaskAssignment, objectKind: SewingPickupObjectKind): SewingPickupSlipLine[] {
  const task = assignmentTaskKind(assignment)
  if (objectKind === 'CUT_PIECE' && task.kind === 'FABRIC_ACCESSORY') {
    throw new Error('裁剪+车缝+烫包任务不生成裁片领料单')
  }
  const lines = objectKind === 'CUT_PIECE' ? cutPieceLines(assignment) : materialLines(assignment, objectKind)
  if (!lines.length) throw new Error(objectKind === 'CUT_PIECE' ? '当前执行任务没有冻结裁片部位，不能打印裁片领料单' : '当前执行任务没有适用物料，不能打印物料领料单')
  return lines
}

export function getSewingPickupAvailability(
  assignmentId: string,
  objectKind: SewingPickupObjectKind,
): { available: boolean; reason: string } {
  if (objectKind === 'CUT_PIECE') return { available: false, reason: '请打印任务单，并在裁床待交出仓使用简易裁片交出。' }
  if (warehouseBridge?.ownsAssignment(assignmentId)) return warehouseBridge.availability(assignmentId, objectKind)
  try {
    const assignment = requireAssignment(assignmentId)
    const snapshot = getProductionOrderTechPackSnapshot(assignment.productionOrderId)
    const styleImageUrl = snapshot?.imageSnapshot.productImages[0] || snapshot?.imageSnapshot.styleImages[0] || ''
    if (!styleImageUrl) return { available: false, reason: '缺少对应款式图' }
    const lines = buildLines(assignment, objectKind)
    if (lines.some((line) => !line.imageUrl)) {
      return { available: false, reason: '存在缺少正式图片的物料' }
    }
    return { available: true, reason: '' }
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

export function issueSewingPickupSlip(input: {
  assignmentId: string
  objectKind: SewingPickupObjectKind
  printedAt: string
  printedByPpicId: string
  printedByPpicName: string
  reprintReason?: string
}): SewingPickupSlipVersion {
  if (warehouseBridge?.ownsAssignment(input.assignmentId)) throw new Error('本任务领料凭证已迁至辅料仓资料，请使用当前任务页打印。')
  if (input.objectKind === 'CUT_PIECE') throw new Error('裁片改用任务单，请从任务打印入口打印。')
  load()
  const assignment = requireAssignment(input.assignmentId)
  if (assignment.ppicId !== input.printedByPpicId || assignment.ppicName !== input.printedByPpicName) {
    throw new Error('只能由该执行任务当前PPIC打印领料单')
  }
  const task = assignmentTaskKind(assignment)
  const lines = buildLines(assignment, input.objectKind)
  const snapshot = getProductionOrderTechPackSnapshot(assignment.productionOrderId)
  const styleImageUrl = snapshot?.imageSnapshot.productImages[0] || snapshot?.imageSnapshot.styleImages[0] || ''
  if (!styleImageUrl) throw new Error('缺少对应款式图，不能打印领料单')
  if (lines.some((line) => !line.imageUrl)) {
    throw new Error('存在缺少正式图片的物料，不能打印领料单')
  }
  const id = slipId(assignment.assignmentId, input.objectKind)
  const currentId = currentVersionIdBySlip.get(id)
  const current = currentId ? versions.get(currentId) : undefined
  const versionNo = (current?.versionNo || 0) + 1
  if (current) {
    versions.set(current.versionId, { ...current, status: 'VOIDED', voidedAt: input.printedAt })
  }
  const objectLabel = input.objectKind === 'ACCESSORY' ? 'ACC' : 'MAT'
  const version: SewingPickupSlipVersion = {
    slipId: id,
    slipNo: `LL-${assignment.taskNo || assignment.runtimeTaskId}-${objectLabel}`,
    versionId: `${id}-V${versionNo}`,
    versionNo,
    versionLabel: `V${versionNo}`,
    status: 'CURRENT',
    assignmentId: assignment.assignmentId,
    runtimeTaskId: assignment.runtimeTaskId,
    taskNo: assignment.taskNo || assignment.runtimeTaskId,
    productionOrderId: assignment.productionOrderId,
    productionOrderNo: assignment.productionOrderNo || assignment.productionOrderId,
    taskKindLabel: task.label,
    factoryId: assignment.factoryId,
    factoryName: assignment.factoryName,
    ppicId: assignment.ppicId!,
    ppicName: assignment.ppicName!,
    warehouseName: '辅料仓',
    objectKind: input.objectKind,
    styleCode: snapshot?.styleCode || assignment.productionOrderNo || assignment.productionOrderId,
    styleName: snapshot?.styleName || '款式资料待补充',
    styleImageUrl,
    lines: clone(lines),
    printedAt: input.printedAt,
    printedByPpicId: input.printedByPpicId,
    printedByPpicName: input.printedByPpicName,
    reprintReason: current ? (input.reprintReason?.trim() || 'PPIC任务页补打') : undefined,
  }
  versions.set(version.versionId, version)
  currentVersionIdBySlip.set(id, version.versionId)
  persist()
  return clone(version)
}

export function getCurrentSewingPickupSlip(
  assignmentId: string,
  objectKind: SewingPickupObjectKind,
): SewingPickupSlipVersion | null {
  load()
  const version = allVersions().filter(row => row.slipId === slipId(assignmentId, objectKind) && row.status === 'CURRENT').sort((a, b) => b.versionNo - a.versionNo)[0]
  return version ? clone(version) : null
}

export function getSewingPickupSlipVersion(versionId: string): SewingPickupSlipVersion | null {
  load()
  const version = allVersions().find(row => row.versionId === versionId)
  // Retired cut-piece papers are historical snapshots, even after their assignment expires.
  if (version && version.objectKind !== 'CUT_PIECE' && !warehouseBridge?.ownsAssignment(version.assignmentId)) ensureSourceContext(version)
  return version ? clone(version) : null
}

export function listSewingPickupHandoverResults(versionId: string): SewingPickupHandoverResult[] {
  load()
  return [...new Map([...handoverResults.values()].filter(row => versions.get(row.versionId)?.objectKind === 'CUT_PIECE' || !warehouseBridge?.usesCanonical(versions.get(row.versionId)?.assignmentId || '')).concat(warehouseBridge?.results() || []).map(row => [row.commandId, row])).values()]
    .filter((item) => item.versionId === versionId)
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt))
    .map(clone)
}

export function getSewingPickupSlipCurrentLines(versionId: string): SewingPickupSlipLine[] {
  const version = getSewingPickupSlipVersion(versionId)
  if (!version) return []
  if (version.objectKind === 'CUT_PIECE') {
    if (getEffectiveTaskAssignment(version.assignmentId)?.status !== 'EFFECTIVE') return clone(version.lines)
    const currentById = new Map(getSewingCutPieceResponsibilityProjection(version.assignmentId).lines.map((line) => [line.requirementLineId, line]))
    return version.lines.map((line) => {
      const current = currentById.get(line.sourceLineId)
      return current ? { ...line, previouslyHandedOverQty: current.handedOverPieceQty, availableQty: current.debtPieceQty } : line
    })
  }
  const currentById = new Map(getSewingMaterialHandoverProjection(version.assignmentId).lines.map((line) => [line.requirementLineId, line]))
  return version.lines.map((line) => {
    const current = currentById.get(line.sourceLineId)
    return current ? { ...line, previouslyHandedOverQty: current.cumulativeHandedOverQty, availableQty: current.shortageQty } : line
  })
}

export function recordSewingPickupHandover(input: {
  commandId: string
  versionId: string
  recordedAt: string
  recordedBy: string
  actorFactoryId: string
  recordedByRole: 'CUTTING_WAREHOUSE' | 'MATERIAL_WAREHOUSE' | 'PPIC'
  quantities: Array<{ lineId: string; actualQty: number }>
}): SewingPickupHandoverResult {
  load()
  const managedVersion = allVersions().find(row => row.versionId === input.versionId)
  if (managedVersion && managedVersion.objectKind !== 'CUT_PIECE' && warehouseBridge?.ownsAssignment(managedVersion.assignmentId)) throw new Error('本任务领料已迁至对应辅料仓，请从当前领料入口办理。')
  const prior = handoverResults.get(input.commandId)
  if (prior) return clone(prior)
  const version = versions.get(input.versionId)
  if (!version) throw new Error('未找到领料单版本，请核对二维码')
  if (version.objectKind === 'CUT_PIECE') throw new Error('该裁片领料单仅供历史查看；请使用当前任务单办理简易裁片交出。')
  const currentVersionId = currentVersionIdBySlip.get(version.slipId)
  if (version.status !== 'CURRENT' || currentVersionId !== version.versionId) {
    throw new Error(`该二维码对应${version.versionLabel}已失效，请扫描当前${versions.get(currentVersionId || '')?.versionLabel || '有效版本'}`)
  }
  if (input.recordedByRole === 'PPIC') throw new Error('PPIC不能代替交出仓确认实交数量')
  if (input.recordedByRole !== 'MATERIAL_WAREHOUSE') throw new Error('物料领料单只能由辅料仓确认')
  if (!input.quantities.length) throw new Error('本次实交明细不能为空')
  const lineById = new Map(version.lines.map((line) => [line.lineId, line]))
  input.quantities.forEach((item) => {
    if (!lineById.has(item.lineId)) throw new Error(`领料明细${item.lineId}不属于当前领料单`)
    if (!Number.isFinite(item.actualQty) || item.actualQty <= 0) throw new Error('本次实交数量必须大于0')
  })
  const sourceRecordId = `PPIC-PICKUP-HAND-${input.commandId}`
  const sourceRecordNo = `${version.slipNo}-${String(handoverResults.size + 1).padStart(2, '0')}`
  const result: SewingPickupHandoverResult = {
    commandId: input.commandId,
    versionId: version.versionId,
    sourceRecordId,
    sourceRecordNo,
    recordedAt: input.recordedAt,
    recordedBy: input.recordedBy,
    actorFactoryId: input.actorFactoryId,
    objectKind: version.objectKind,
    recordedByRole: input.recordedByRole,
    quantities: input.quantities.map((item) => ({ lineId: item.lineId, actualQty: roundQty(item.actualQty) })),
  }
  ensureSourceContext(version)
  applyHandoverToExistingLedger(version, result)
  handoverResults.set(input.commandId, result)
  persist()
  return clone(result)
}

export function resetSewingPickupSlipsForTests(): void {
  versions.clear()
  currentVersionIdBySlip.clear()
  handoverResults.clear()
  loaded = true
  getBrowserLocalStorage()?.removeItem?.(STORAGE_KEY)
}
