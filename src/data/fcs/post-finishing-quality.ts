import type { InspectionSnapshot, InspectionIssue, InspectionAuditView } from './quality-management-types.ts'
import { calculateInspectionTarget, evaluateRoundAudit, validateAuditUpgrade, validateInspectionIssues } from './quality-management-rules.ts'

export interface PostQcCount { skuId: string; passedQty: number; defectQty: number; returnQty: number; issues?: InspectionIssue[]; issuePhotoUrls?: string[] }
export interface PostQcRound {
  id: string; operationId: string; intent: string; roundNumber: number; submittedAt: string; actorId: string
  percent: number; target: number; lines: PostQcCount[]
}
export interface PostQcPaper { id: string; version: number; name: string; url: string; uploadedAt: string }
export interface PostQcInspection {
  snapshot: InspectionSnapshot
  percent: number
  fullReasons: string[]
  rounds: PostQcRound[]
  audits: InspectionAuditView[]
  paperVersion: number
  papers: PostQcPaper[]
  basisClarifications?: Array<{id:string;itemId:string;conflictDescription:string;adoptedBasis:string;clarificationNote:string;at:string;by:string}>
}
export interface PostQcSupply { skuId: string; quantity: number }
const copy = <T>(value: T): T => structuredClone(value)
function count(value: number): void { if (!Number.isSafeInteger(value) || value < 0) throw new Error('检查数量必须为非负整数件数。') }
export function createPostQcInspection(snapshot: InspectionSnapshot, reasons: string[] = []): PostQcInspection {
  if (!snapshot.ruleSnapshot) throw new Error('当前环节没有适用检验方式规则，不能开检。')
  return { snapshot: copy(snapshot), percent: reasons.length ? 100 : snapshot.ruleSnapshot.defaultPercent, fullReasons: [...new Set(reasons)], rounds: [], audits: [], paperVersion: 1, papers: [] }
}
export function getPostQcSummary(inspection: PostQcInspection, supply: PostQcSupply[]) {
  const lines = supply.map(row => {
    count(row.quantity)
    const checked = inspection.rounds.flatMap(round => round.lines).filter(line => line.skuId === row.skuId)
    const passedQty = checked.reduce((sum, line) => sum + line.passedQty, 0)
    const defectQty = checked.reduce((sum, line) => sum + line.defectQty, 0)
    const returnQty = checked.reduce((sum, line) => sum + line.returnQty, 0)
    const inspectedQty = passedQty + defectQty + returnQty
    if (inspectedQty > row.quantity) throw new Error('累计检查数量超过该SKU实际接收数量。')
    return { skuId: row.skuId, quantity: row.quantity, inspectedQty, passedQty, defectQty, returnQty,
      uninspectedQty: row.quantity - inspectedQty, releasedQty: row.quantity - defectQty - returnQty }
  })
  const sum = (key: keyof typeof lines[number]) => lines.reduce((n, row) => n + Number(row[key]), 0)
  const quantity = sum('quantity'), inspectedQty = sum('inspectedQty')
  const target = calculateInspectionTarget({ quantity, percent: inspection.percent, minQuantity: inspection.snapshot.ruleSnapshot!.minQuantity })
  return { quantity, target, inspectedQty, remainingQty: Math.max(0, target - inspectedQty), passedQty: sum('passedQty'), defectQty: sum('defectQty'), returnQty: sum('returnQty'),
    uninspectedQty: sum('uninspectedQty'), releasedQty: sum('releasedQty'), fullInspection: target === quantity && quantity > 0,
    pendingAudit: inspection.audits.find(row => row.status === 'PENDING'), lines }
}
export function submitPostQcRound(inspection: PostQcInspection, supply: PostQcSupply[], input: {
  operationId: string; actorId: string; submittedAt: string; lines: PostQcCount[]
}): PostQcRound {
  if (!input.operationId.trim() || !input.actorId || !Number.isFinite(Date.parse(input.submittedAt))) throw new Error('检查提交缺少有效身份或时间。')
  const intent = JSON.stringify(input.lines)
  const previous = inspection.rounds.find(round => round.operationId === input.operationId)
  if (previous) { if (previous.intent !== intent) throw new Error('此轮已经提交，不允许更正结果。'); return copy(previous) }
  const summary = getPostQcSummary(inspection, supply)
  if (!summary.quantity) throw new Error('没有实际接收的衣服，不能虚构检查完成。')
  if (summary.pendingAudit) throw new Error('本单有待处理稽查，请先提高检查比例或全检。')
  if (!summary.remainingQty) throw new Error('当前应检量已经达到，请完成QC或处理已有稽查，不能重复登记。')
  const seen = new Set<string>()
  const next = input.lines.map(line => {
    if (seen.has(line.skuId)) throw new Error('本轮SKU重复。')
    seen.add(line.skuId)
    const available = summary.lines.find(row => row.skuId === line.skuId)
    if (!available) throw new Error('检查结果含不属于本批的SKU。')
    count(line.passedQty); count(line.defectQty); count(line.returnQty)
    if (line.passedQty + line.defectQty + line.returnQty > available.uninspectedQty) throw new Error('本轮检查量超过该SKU剩余未检实物。')
    const issues = line.issues || []
    validateInspectionIssues(inspection.snapshot.skuSnapshots?.find(row => row.skuId === line.skuId)?.snapshot || inspection.snapshot, issues)
    if (line.defectQty + line.returnQty > 0 && !issues.length) throw new Error('有瑕疵或返工时，须标记本次标准中的具体问题。')
    return copy({ ...line, issues })
  })
  const actual = next.reduce((sum, row) => sum + row.passedQty + row.defectQty + row.returnQty, 0)
  if (actual < summary.remainingQty) throw new Error(`本轮尚需检查${summary.remainingQty}件；未足当前应检量，请先核对未提交输入。`)
  const round: PostQcRound = { id: input.operationId, operationId: input.operationId, intent, actorId: input.actorId, submittedAt: input.submittedAt,
    roundNumber: inspection.rounds.length + 1, percent: inspection.percent, target: summary.target, lines: next }
  const audit = evaluateRoundAudit({ roundNumber: round.roundNumber, roundDefectQty: next.reduce((n, row) => n + row.defectQty, 0),
    roundReturnedQty: next.reduce((n, row) => n + row.returnQty, 0), percent: inspection.percent, quantity: summary.quantity, target: summary.target, rule: inspection.snapshot.ruleSnapshot! })
  inspection.rounds.push(round)
  if (audit.requiresAudit) inspection.audits.push({ id: `audit:${round.id}`, roundNumber: round.roundNumber, threshold: audit.threshold!, unqualifiedQty: audit.unqualifiedQty,
    status: 'PENDING', fromPercent: inspection.percent })
  return copy(round)
}
export function upgradePostQcInspection(inspection: PostQcInspection, input: { nextPercent: number; decidedAt: string; note: string }): void {
  const pending = inspection.audits.find(row => row.status === 'PENDING')
  if (!pending) throw new Error('当前没有待处理稽查。')
  validateAuditUpgrade({ currentPercent: inspection.percent, nextPercent: input.nextPercent, percentSteps: inspection.snapshot.ruleSnapshot!.percentSteps })
  if (!input.note.trim() || !Number.isFinite(Date.parse(input.decidedAt))) throw new Error('请填写稽查决定和有效时间。')
  pending.status = 'UPGRADED'; pending.toPercent = input.nextPercent; pending.decidedAt = input.decidedAt; pending.note = input.note.trim()
  inspection.percent = input.nextPercent; inspection.paperVersion++
}
export function applyPostQcFullCoverage(inspection: PostQcInspection, reasons: string[], now: string): void {
  if (!reasons.length) return
  inspection.fullReasons = [...new Set([...inspection.fullReasons, ...reasons])]
  if (inspection.percent < 100) { inspection.percent = 100; inspection.paperVersion++ }
  for (const audit of inspection.audits) if (audit.status === 'PENDING') { audit.status = 'UPGRADED'; audit.toPercent = 100; audit.decidedAt = now; audit.note = `初始全检覆盖：${reasons.join('；')}` }
}
export function assertPostQcCompletable(inspection: PostQcInspection, supply: PostQcSupply[], requireSignedPaper: boolean): ReturnType<typeof getPostQcSummary> {
  const summary = getPostQcSummary(inspection, supply)
  if (!summary.quantity || summary.remainingQty > 0) throw new Error('未检查足当前应检量，不能完成QC。')
  if (summary.pendingAudit) throw new Error('仍有待处理稽查，不能完成QC。')
  if (requireSignedPaper && !inspection.papers.some(paper => paper.version === inspection.paperVersion)) throw new Error('请上传当前检查要求版本的纸面双签单，升检后须重新打印并上传。')
  return summary
}
