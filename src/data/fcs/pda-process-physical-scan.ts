export type PdaPhysicalScanSourceType = 'SPECIAL_CRAFT' | 'BINDING_PROCESS_ORDER'
export type PdaPhysicalScanAction = 'RECEIVE' | 'HANDOUT'
export type PdaPhysicalScanInputMethod = 'SCANNER' | 'MANUAL'
export type PdaPhysicalScanObjectType = 'MATERIAL_LABEL' | 'FEI_TICKET' | 'GARMENT_LABEL' | 'OUTPUT_LABEL'

export interface PdaPhysicalScanCandidate {
  code: string
  aliases?: string[]
  objectKey: string
  objectType: PdaPhysicalScanObjectType
  objectLabel: string
  qty: number
  maxQty?: number
  unit: string
  detailId?: string
  lineProgressKey?: string
  feiTicketNo?: string
  skuCode?: string
}

export interface PdaPhysicalScanLine extends PdaPhysicalScanCandidate {
  scanLineId: string
  scannedCode: string
  inputMethod: PdaPhysicalScanInputMethod
  scannedAt: string
}

export interface PdaPhysicalScanBatchRecord {
  scanBatchId: string
  sourceType: PdaPhysicalScanSourceType
  workOrderId: string
  action: PdaPhysicalScanAction
  lines: PdaPhysicalScanLine[]
  totalQty: number
  unit: string
  businessRecordIds: string[]
  operatorName: string
  committedAt: string
}

interface PdaPhysicalScanScope {
  sourceType: PdaPhysicalScanSourceType
  workOrderId: string
  action: PdaPhysicalScanAction
}

interface PdaPhysicalScanStore {
  draftLinesByScope: Map<string, PdaPhysicalScanLine[]>
  committedBatches: PdaPhysicalScanBatchRecord[]
  sequence: number
}

const store: PdaPhysicalScanStore = {
  draftLinesByScope: new Map(),
  committedBatches: [],
  sequence: 0,
}

function roundQty(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 1_000_000) / 1_000_000
}

function normalizeCode(value: string): string {
  return String(value || '').trim().toUpperCase()
}

function scopeKey(scope: PdaPhysicalScanScope): string {
  return `${scope.sourceType}::${scope.workOrderId}::${scope.action}`
}

function cloneLine(line: PdaPhysicalScanLine): PdaPhysicalScanLine {
  return { ...line, aliases: [...(line.aliases || [])] }
}

function cloneBatch(batch: PdaPhysicalScanBatchRecord): PdaPhysicalScanBatchRecord {
  return {
    ...batch,
    lines: batch.lines.map(cloneLine),
    businessRecordIds: [...batch.businessRecordIds],
  }
}

function nextId(prefix: string): string {
  store.sequence += 1
  return `${prefix}-${String(store.sequence).padStart(4, '0')}`
}

function candidateCodes(candidate: PdaPhysicalScanCandidate): string[] {
  return [candidate.code, ...(candidate.aliases || [])]
    .map(normalizeCode)
    .filter(Boolean)
}

export function listPdaPhysicalScanDraftLines(scope: PdaPhysicalScanScope): PdaPhysicalScanLine[] {
  return (store.draftLinesByScope.get(scopeKey(scope)) || []).map(cloneLine)
}

export function addPdaPhysicalScanLine(input: PdaPhysicalScanScope & {
  rawCode: string
  inputMethod: PdaPhysicalScanInputMethod
  candidates: PdaPhysicalScanCandidate[]
  scannedAt: string
}): PdaPhysicalScanLine {
  const normalizedCode = normalizeCode(input.rawCode)
  if (!normalizedCode) throw new Error(input.inputMethod === 'SCANNER' ? '请扫描标签或菲票。' : '请输入标签码或菲票号。')

  const matches = input.candidates.filter((candidate) => candidateCodes(candidate).includes(normalizedCode))
  if (matches.length === 0) throw new Error('该标签或菲票不属于当前加工单，请核对后重扫。')
  if (matches.length > 1) throw new Error('该码对应多条明细，不能判断具体实物；请扫描实物上的唯一标签。')

  const candidate = matches[0]
  const qty = roundQty(candidate.qty)
  const maxQty = roundQty(candidate.maxQty ?? candidate.qty)
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(maxQty) || maxQty <= 0) {
    throw new Error('该标签或菲票当前没有可操作数量，请刷新加工单。')
  }

  const key = scopeKey(input)
  const currentLines = store.draftLinesByScope.get(key) || []
  if (currentLines.some((line) => line.objectKey === candidate.objectKey || normalizeCode(line.scannedCode) === normalizedCode)) {
    throw new Error('本批已经扫过该标签或菲票，请勿重复扫描。')
  }
  if (currentLines.some((line) => line.unit !== candidate.unit)) {
    throw new Error('本批扫描对象的数量单位不一致，已阻断提交。')
  }

  const line: PdaPhysicalScanLine = {
    ...candidate,
    aliases: [...(candidate.aliases || [])],
    qty,
    maxQty,
    scanLineId: nextId('PSL'),
    scannedCode: input.rawCode.trim(),
    inputMethod: input.inputMethod,
    scannedAt: input.scannedAt,
  }
  store.draftLinesByScope.set(key, [...currentLines, line])
  return cloneLine(line)
}

export function updatePdaPhysicalScanLineQty(input: PdaPhysicalScanScope & {
  scanLineId: string
  qty: number
}): PdaPhysicalScanLine {
  const key = scopeKey(input)
  const currentLines = store.draftLinesByScope.get(key) || []
  const index = currentLines.findIndex((line) => line.scanLineId === input.scanLineId)
  if (index < 0) throw new Error('本批扫描明细已失效，请重新扫描。')
  const current = currentLines[index]
  const qty = roundQty(input.qty)
  const maxQty = roundQty(current.maxQty ?? current.qty)
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('本次数量必须大于 0。')
  if (qty > maxQty) throw new Error(`本次数量不能超过该标签可操作数量 ${maxQty} ${current.unit}。`)
  const next = { ...current, qty }
  const nextLines = [...currentLines]
  nextLines[index] = next
  store.draftLinesByScope.set(key, nextLines)
  return cloneLine(next)
}

export function removePdaPhysicalScanLine(input: PdaPhysicalScanScope & { scanLineId: string }): void {
  const key = scopeKey(input)
  const currentLines = store.draftLinesByScope.get(key) || []
  store.draftLinesByScope.set(key, currentLines.filter((line) => line.scanLineId !== input.scanLineId))
}

export function clearPdaPhysicalScanDraft(scope: PdaPhysicalScanScope): void {
  store.draftLinesByScope.delete(scopeKey(scope))
}

export function commitPdaPhysicalScanBatch(input: PdaPhysicalScanScope & {
  businessRecordIds: string[]
  operatorName: string
  committedAt: string
}): PdaPhysicalScanBatchRecord {
  const lines = listPdaPhysicalScanDraftLines(input)
  if (lines.length === 0) {
    throw new Error(input.action === 'RECEIVE' ? '请先逐张扫描本批接收的标签或菲票。' : '请先逐张扫描本批交出的标签或菲票。')
  }
  const businessRecordIds = input.businessRecordIds.map((item) => item.trim()).filter(Boolean)
  if (businessRecordIds.length === 0) throw new Error('业务动作未返回记录 ID，本批扫码证据不能提交。')
  const unit = lines[0].unit
  if (lines.some((line) => line.unit !== unit)) throw new Error('本批扫描对象的数量单位不一致，已阻断提交。')
  const batch: PdaPhysicalScanBatchRecord = {
    scanBatchId: nextId('PSB'),
    sourceType: input.sourceType,
    workOrderId: input.workOrderId,
    action: input.action,
    lines: lines.map(cloneLine),
    totalQty: roundQty(lines.reduce((sum, line) => sum + line.qty, 0)),
    unit,
    businessRecordIds,
    operatorName: input.operatorName,
    committedAt: input.committedAt,
  }
  store.committedBatches.push(batch)
  clearPdaPhysicalScanDraft(input)
  return cloneBatch(batch)
}

export function listPdaPhysicalScanBatches(filter: Partial<PdaPhysicalScanScope> = {}): PdaPhysicalScanBatchRecord[] {
  return store.committedBatches
    .filter((batch) => !filter.sourceType || batch.sourceType === filter.sourceType)
    .filter((batch) => !filter.workOrderId || batch.workOrderId === filter.workOrderId)
    .filter((batch) => !filter.action || batch.action === filter.action)
    .map(cloneBatch)
}

export function resetPdaPhysicalScanRuntime(): void {
  store.draftLinesByScope.clear()
  store.committedBatches = []
  store.sequence = 0
}
