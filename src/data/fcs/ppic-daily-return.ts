/** PPIC每日回货的数量契约。保存和正式来源读取由现有记录入口负责。 */
export interface PpicActor { id: string; name: string; leader: boolean }
export interface PpicTaskContext {
  assignmentId: string; taskId: string; factoryId: string; ownerId: string
  expectedQty: number | null; basisVersion: string; sourceKind: string; sourceRefs: unknown[]; status: string
}
export interface PpicPromise {
  promiseId: string; operationId: string; fingerprint: string; promiseNo: string; assignmentId: string; taskId: string; factoryId: string
  actorId: string; actorName: string; date: string; quantity: number; originalDeadlineAt: string; createdAt: string
  basisVersion: string; revisions: Array<{ at: string; actorId: string; deadlineAt: string; reason: string }>
}
export const PPIC_RETURN_REASONS = ['辅料不足', '裁片不足或异常', '二次增加裁片', '工厂生产延迟', '运输延迟', '其他'] as const
export interface PpicMakeup {
  makeupId: string; operationId: string; fingerprint: string; promiseId: string; previousId?: string
  round: number; quantity: number; deadlineAt: string; createdAt: string; actorId: string; reason: string; detail: string; active: boolean; endedAt?: string
  releasedQty?: number
  releaseAdjustments?: Array<{ quantity: number; at: string; evaluationVersion: string }>
}
export interface PpicReceipt { id: string; deliveryId: string; assignmentId: string; factoryId: string; quantity: number; confirmedAt: string; recordedAt: string }
export interface PpicAllocation { allocationId: string; promiseId: string; makeupId?: string; receiptId: string; quantity: number; confirmedAt: string; active: boolean; evaluationVersion: string }
export interface PpicDailyConfirmation {
  confirmationId: string; operationId: string; fingerprint: string; actorId: string; date: string; submittedAt: string; configId: string
  taskIds: string[]; noArrangementReasons: Record<string, string>; promiseIds: string[]; makeupIds?: string[]; revisionIds?: string[]; active: boolean
}
export interface PpicConfig { configId: string; operationId: string; fingerprint: string; timeZone: string; cutoff: string; effectiveFrom: string; createdAt: string; actorId: string }
export interface PpicBasis { basisId: string; assignmentId: string; version: string; expectedQty: number; effectiveAt: string; sourceKind: string; sourceRefs: unknown[] }
export interface PpicAction { actionId: string; operationId: string; fingerprint: string; actorId: string; action: string; at: string; promiseId?: string; reason?: string }
export interface PpicEvaluation { evaluationId: string; promiseId: string; receiptVersion: string; timelyQty: number; receivedQty: number; recordedAt: string }
export interface PpicDailyStore {
  promises: PpicPromise[]; makeups: PpicMakeup[]; allocations: PpicAllocation[]; confirmations: PpicDailyConfirmation[]
  configs: PpicConfig[]; bases: PpicBasis[]; actions: PpicAction[]; evaluations: PpicEvaluation[]
}
export function createPpicDailyStore(): PpicDailyStore {
  return { promises: [], makeups: [], allocations: [], confirmations: [], bases: [], actions: [], evaluations: [],
    configs: [{ configId: 'PPIC-JAKARTA-1700-V1', operationId: 'STATIC-CONFIG', fingerprint: '', timeZone: 'Asia/Jakarta', cutoff: '17:00', effectiveFrom: '0000-01-01', createdAt: '', actorId: 'BUSINESS-CONFIRMED' }] }
}
const clone = <T>(value: T): T => structuredClone(value)
export function ppicInstant(value: string, timeZone = 'Asia/Jakarta'): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}[ T]/.test(value)) throw new Error('日期时间格式不正确。')
  const wall = value.replace(' ', 'T')
  const offset = timeZone === 'Asia/Jakarta' ? '+07:00' : timeZone === 'Asia/Shanghai' ? '+08:00' : ''
  if (!offset) throw new Error('业务时区尚未设置。')
  const iso = /(?:Z|[+-]\d{2}:?\d{2})$/.test(wall) ? wall : wall + offset
  const result = Date.parse(iso)
  if (!Number.isFinite(result)) throw new Error('日期时间格式不正确。')
  const day = wall.slice(0, 10)
  if (new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) throw new Error('业务日期不存在。')
  return result
}
export function ppicBusinessDate(nowAt = new Date().toISOString(), timeZone = 'Asia/Jakarta'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ppicInstant(nowAt, timeZone)))
  const get = (type: string) => parts.find(p => p.type === type)!.value
  return get('year') + '-' + get('month') + '-' + get('day')
}
export function ppicDailyTime(value: string, timeZone = 'Asia/Jakarta'): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ppicInstant(value, timeZone)))
}
export function ppicConfigAt(s: PpicDailyStore, date: string): PpicConfig {
  return [...s.configs].filter(c => c.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.createdAt.localeCompare(a.createdAt))[0]!
}
const stamp = (at: string, zone: string) => new Date(ppicInstant(at, zone)).toISOString()
function quantity(value: number): void { if (!Number.isSafeInteger(value) || value <= 0) throw new Error('数量必须是大于0的整数件数。') }
function owner(actor: PpicActor, task: PpicTaskContext): void { if (actor.id !== task.ownerId) throw new Error('只能填写本人当前负责的任务。') }
function fingerprint(input: unknown): string { return JSON.stringify(input) }
function versionFingerprint(input: unknown): string {
  let result = 2166136261
  for (const ch of fingerprint(input)) result = Math.imul(result ^ ch.charCodeAt(0), 16777619)
  return (result >>> 0).toString(16)
}
function repeat<T extends { operationId: string; fingerprint: string }>(rows: T[], id: string, fp: string): T | undefined {
  if (!id?.trim()) throw new Error('操作标识缺失，未保存。')
  const old = rows.find(r => r.operationId === id)
  if (old && old.fingerprint !== fp) throw new Error('同一操作标识对应不同输入，未保存。')
  return old
}
function recordAction(s: PpicDailyStore, operationId: string, actor: PpicActor, action: string, at: string, fp: string, promiseId?: string, reason?: string): void {
  s.actions.push({ actionId: 'ACTION-' + operationId, operationId, fingerprint: fp, actorId: actor.id, action, at, promiseId, reason })
}
export function ppicPromiseResult(s: PpicDailyStore, p: PpicPromise, nowAt = new Date().toISOString()) {
  const rows = s.allocations.filter(a => a.active && a.promiseId === p.promiseId)
  const receivedQty = rows.reduce((n, a) => n + a.quantity, 0)
  const timelyQty = rows.filter(a => ppicInstant(a.confirmedAt) <= ppicInstant(p.originalDeadlineAt)).reduce((n, a) => n + a.quantity, 0)
  const currentGap = p.quantity - receivedQty
  const originalGap = Math.max(p.quantity - timelyQty, 0)
  const due = ppicInstant(nowAt) >= ppicInstant(p.originalDeadlineAt)
  const status = !currentGap ? originalGap ? '逾期已补齐' : '按期兑现' : due ? '到期欠回' : '待履行'
  let remainingObligation = Math.max(0, currentGap)
  const makeups = s.makeups.filter(m => m.promiseId === p.promiseId).slice().sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt) || a.createdAt.localeCompare(b.createdAt) || a.makeupId.localeCompare(b.makeupId)).map(m => {
    const receivedQty = rows.filter(a => a.makeupId === m.makeupId).reduce((n, a) => n + a.quantity, 0)
    const unreceivedQty = Math.max(0, m.quantity - receivedQty)
    // 迟录／正式订正可以解除原欠回；保留安排原数量，不制造安排前的实收分摊。
    const rememberedRelief = Math.min(unreceivedQty, m.releasedQty || 0)
    const currentGap = m.active ? Math.min(unreceivedQty - rememberedRelief, remainingObligation) : unreceivedQty - rememberedRelief
    if (m.active) remainingObligation -= currentGap
    return { ...clone(m), receivedQty, currentGap, releasedQty: m.active ? unreceivedQty - currentGap : 0 }
  })
  const covered = makeups.filter(m => m.active && ppicInstant(m.deadlineAt) > ppicInstant(nowAt)).reduce((n, m) => n + m.currentGap, 0)
  return { receivedQty, timelyQty, originalGap, currentGap, status, due, makeupAvailableQty: Math.max(0, currentGap - covered), makeupAllocationConflict: currentGap < 0 || makeups.some(m => m.receivedQty > m.quantity), rounds: Math.max(0, ...makeups.map(m => m.round)), makeups }
}
function rememberMakeupRelief(s: PpicDailyStore, rows: ReturnType<typeof ppicPromiseResult>['makeups'], at: string, evaluationVersion: string): void {
  for (const row of rows) {
    const saved = s.makeups.find(m => m.makeupId === row.makeupId)!
    if (!row.active || row.releasedQty <= (saved.releasedQty || 0)) continue
    const delta = row.releasedQty - (saved.releasedQty || 0)
    saved.releasedQty = row.releasedQty
    ;(saved.releaseAdjustments ||= []).push({ quantity: delta, at, evaluationVersion })
  }
}
export function ppicTaskCapacity(s: PpicDailyStore, task: PpicTaskContext, receivedQty: number) {
  const reserved = s.promises.filter(p => p.assignmentId === task.assignmentId).reduce((n, p) => n + ppicPromiseResult(s, p).currentGap, 0)
  const pending = (task.expectedQty ?? 0) - receivedQty
  const available = pending - reserved
  const conflict = task.expectedQty === null || task.status !== 'READY' || pending < 0 || available < 0
  return { expectedQty: task.expectedQty, receivedQty, pending, reserved, available, conflict }
}
type Common = { operationId: string; actor: PpicActor; task: PpicTaskContext; nowAt: string }
export function addPpicPromise(s: PpicDailyStore, input: Common & { date: string; quantity: number; deadlineAt: string; receivedQty?: number }): PpicPromise {
  owner(input.actor, input.task)
  const fp = fingerprint({ actorId: input.actor.id, assignmentId: input.task.assignmentId, date: input.date, quantity: input.quantity, deadlineAt: input.deadlineAt })
  const old = repeat(s.promises, input.operationId, fp); if (old) return old
  quantity(input.quantity)
  const config = ppicConfigAt(s, input.date)
  if (input.date !== ppicBusinessDate(input.nowAt, config.timeZone)) throw new Error('只能新增当前业务日期的承诺。')
  const createdAt = stamp(input.nowAt, config.timeZone), deadlineAt = stamp(input.deadlineAt, config.timeZone)
  if (deadlineAt <= createdAt) throw new Error('预计后道确认时间必须晚于当前时间。')
  const capacity = ppicTaskCapacity(s, input.task, input.receivedQty || 0)
  if (capacity.conflict) throw new Error('应回来源待核对或数量冲突，不能新增承诺。')
  if (input.quantity > capacity.available) throw new Error('数量超过可新增承诺量。')
  const p: PpicPromise = { promiseId: 'PROMISE-' + input.operationId, operationId: input.operationId, fingerprint: fp,
    promiseNo: '回货承诺 ' + input.date.replaceAll('-', '') + ' ' + String(s.promises.length + 1).padStart(3, '0'),
    assignmentId: input.task.assignmentId, taskId: input.task.taskId, factoryId: input.task.factoryId,
    actorId: input.actor.id, actorName: input.actor.name, date: input.date, quantity: input.quantity, createdAt,
    originalDeadlineAt: deadlineAt, basisVersion: input.task.basisVersion, revisions: [] }
  if (!s.bases.some(b => b.assignmentId === input.task.assignmentId && b.version === input.task.basisVersion)) {
    s.bases.push({ basisId: input.task.assignmentId + ':' + input.task.basisVersion, assignmentId: input.task.assignmentId, version: input.task.basisVersion,
      expectedQty: input.task.expectedQty!, effectiveAt: createdAt, sourceKind: input.task.sourceKind, sourceRefs: clone(input.task.sourceRefs) })
  }
  s.promises.push(p); recordAction(s, input.operationId, input.actor, '新增原承诺', createdAt, fp, p.promiseId)
  return p
}
export function amendPpicPromise(s: PpicDailyStore, input: Common & { promiseId: string; deadlineAt: string; reason: string }): PpicPromise {
  owner(input.actor, input.task)
  const p = s.promises.find(p => p.promiseId === input.promiseId && p.assignmentId === input.task.assignmentId)
  if (!p) throw new Error('找不到本人任务的原承诺。')
  const fp = fingerprint({ actorId: input.actor.id, promiseId: input.promiseId, deadlineAt: input.deadlineAt, reason: input.reason })
  if (repeat(s.actions, input.operationId, fp)) return p
  if (ppicInstant(input.nowAt) >= ppicInstant(p.originalDeadlineAt)) throw new Error('原承诺已到期，请登记补回。')
  if (!input.reason.trim()) throw new Error('填写修改原因。')
  const deadlineAt = stamp(input.deadlineAt, 'Asia/Jakarta')
  if (ppicInstant(deadlineAt) <= ppicInstant(input.nowAt)) throw new Error('新的安排时间必须晚于当前时间。')
  p.revisions.push({ at: stamp(input.nowAt, 'Asia/Jakarta'), actorId: input.actor.id, deadlineAt, reason: input.reason.trim() })
  recordAction(s, input.operationId, input.actor, '修改安排时间', input.nowAt, fp, p.promiseId, input.reason)
  return p
}
export function arrangePpicMakeup(s: PpicDailyStore, input: Common & { promiseId: string; quantity: number; deadlineAt: string; reason: string; detail: string }): PpicMakeup {
  owner(input.actor, input.task)
  const fp = fingerprint({ actorId: input.actor.id, promiseId: input.promiseId, quantity: input.quantity, deadlineAt: input.deadlineAt, reason: input.reason, detail: input.detail })
  const old = repeat(s.makeups, input.operationId, fp); if (old) return old
  const p = s.promises.find(p => p.promiseId === input.promiseId && p.assignmentId === input.task.assignmentId)
  if (!p) throw new Error('找不到本人任务的原承诺。')
  const result = ppicPromiseResult(s, p, input.nowAt)
  if (!result.due) throw new Error('承诺尚未到期，无需登记补回。')
  if (!PPIC_RETURN_REASONS.includes(input.reason as typeof PPIC_RETURN_REASONS[number])) throw new Error('选择欠回原因。')
  if (input.reason === '其他' && !input.detail.trim()) throw new Error('填写其他原因的具体情况。')
  if (result.currentGap === 0) throw new Error('欠回已经补齐，只需补充原因。')
  quantity(input.quantity)
  if (input.quantity > result.currentGap) throw new Error('补回数量超过当前欠回量。')
  const deadlineAt = stamp(input.deadlineAt, 'Asia/Jakarta')
  if (ppicInstant(deadlineAt) <= ppicInstant(input.nowAt)) throw new Error('新的回货时间必须晚于当前时间。')
  const active = s.makeups.filter(m => m.promiseId === p.promiseId && m.active)
  const outstanding = (m: PpicMakeup) => result.makeups.find(row => row.makeupId === m.makeupId)?.currentGap || 0
  const expired = active.filter(m => outstanding(m) > 0 && ppicInstant(m.deadlineAt) <= ppicInstant(input.nowAt))
  const valid = active.filter(m => !expired.includes(m))
  if (input.quantity + valid.reduce((n, m) => n + Math.max(0, outstanding(m)), 0) > result.currentGap) throw new Error('已有补回安排覆盖了这部分欠回。')
  rememberMakeupRelief(s, result.makeups, stamp(input.nowAt, 'Asia/Jakarta'), 'ARRANGE-' + input.operationId)
  expired.forEach(m => { m.active = false; m.endedAt = stamp(input.nowAt, 'Asia/Jakarta') })
  const round = expired.length ? result.rounds + 1 : Math.max(1, result.rounds)
  const m: PpicMakeup = { makeupId: 'MAKEUP-' + input.operationId, operationId: input.operationId, fingerprint: fp,
    promiseId: p.promiseId, previousId: expired.at(-1)?.makeupId, quantity: input.quantity, deadlineAt, createdAt: stamp(input.nowAt, 'Asia/Jakarta'),
    actorId: input.actor.id, reason: input.reason, detail: input.detail.trim(), round, active: true }
  s.makeups.push(m); recordAction(s, input.operationId, input.actor, '登记补回', m.createdAt, fp, p.promiseId, input.reason)
  return m
}
export function recordPpicGapReason(s: PpicDailyStore, input: Common & { promiseId: string; reason: string; detail: string }): void {
  owner(input.actor, input.task)
  const p = s.promises.find(p => p.promiseId === input.promiseId && p.assignmentId === input.task.assignmentId)
  if (!p) throw new Error('找不到已到期的本人承诺。')
  const fp = fingerprint({ promiseId: input.promiseId, reason: input.reason, detail: input.detail, actorId: input.actor.id })
  if (repeat(s.actions, input.operationId, fp)) return
  const result = ppicPromiseResult(s, p, input.nowAt)
  if (!result.due || !result.originalGap) throw new Error('没有原到期欠回，不能登记欠回原因。')
  if (!PPIC_RETURN_REASONS.includes(input.reason as typeof PPIC_RETURN_REASONS[number]) || (input.reason === '其他' && !input.detail.trim())) throw new Error('填写欠回原因及其他原因说明。')
  recordAction(s, input.operationId, input.actor, '补充欠回原因', input.nowAt, fp, p.promiseId, input.reason + (input.detail ? '：' + input.detail : ''))
}
export function syncPpicReceipts(s: PpicDailyStore, receipts: PpicReceipt[]): void {
  if (!s.promises.length) return
  const existing = s.allocations.filter(a => a.active)
  const proposed: Omit<PpicAllocation, 'active' | 'allocationId'>[] = []
  const fulfilled = new Map<string, number>(), makeupFulfilled = new Map<string, number>()
  const roots = [...s.promises].sort((a, b) => a.originalDeadlineAt.localeCompare(b.originalDeadlineAt) || a.createdAt.localeCompare(b.createdAt) || a.promiseId.localeCompare(b.promiseId))
  for (const r of [...receipts].sort((a, b) => ppicInstant(a.confirmedAt) - ppicInstant(b.confirmedAt) || a.id.localeCompare(b.id))) {
    if (!Number.isSafeInteger(r.quantity) || r.quantity < 0) throw new Error('正式实收数量无效，未更新分摊。')
    let left = r.quantity
    for (const p of roots) {
      if (!left) break
      if (p.assignmentId !== r.assignmentId || p.factoryId !== r.factoryId || ppicInstant(r.confirmedAt) < ppicInstant(p.createdAt)) continue
      const qty = Math.min(left, p.quantity - (fulfilled.get(p.promiseId) || 0))
      if (!qty) continue
      const candidates = s.makeups.filter(m => m.promiseId === p.promiseId && ppicInstant(m.createdAt) <= ppicInstant(r.confirmedAt))
        .filter(m => !m.endedAt || ppicInstant(r.confirmedAt) < ppicInstant(m.endedAt))
        .filter(m => !s.makeups.some(next => next.previousId === m.makeupId && ppicInstant(next.createdAt) <= ppicInstant(r.confirmedAt)))
        .sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt) || a.makeupId.localeCompare(b.makeupId))
      let remaining = qty
      for (const m of candidates) {
        const portion = Math.min(remaining, Math.max(0, m.quantity - (m.releasedQty || 0) - (makeupFulfilled.get(m.makeupId) || 0)))
        if (!portion) continue
        proposed.push({ promiseId: p.promiseId, makeupId: m.makeupId, receiptId: r.id, quantity: portion, confirmedAt: r.confirmedAt, evaluationVersion: '' })
        makeupFulfilled.set(m.makeupId, (makeupFulfilled.get(m.makeupId) || 0) + portion); remaining -= portion
      }
      if (remaining) proposed.push({ promiseId: p.promiseId, receiptId: r.id, quantity: remaining, confirmedAt: r.confirmedAt, evaluationVersion: '' })
      fulfilled.set(p.promiseId, (fulfilled.get(p.promiseId) || 0) + qty); left -= qty
    }
  }
  const comparable = (a: Omit<PpicAllocation, 'active' | 'allocationId'>) => ({ promiseId: a.promiseId, makeupId: a.makeupId, receiptId: a.receiptId, quantity: a.quantity, confirmedAt: a.confirmedAt })
  for (const p of s.promises) {
    const before = existing.filter(a => a.promiseId === p.promiseId), after = proposed.filter(a => a.promiseId === p.promiseId)
    const taskReceipts = receipts.filter(r => r.assignmentId === p.assignmentId)
    const recordedAt = taskReceipts.map(r => r.recordedAt).sort().at(-1) || new Date().toISOString()
    if (fingerprint(before.map(comparable)) === fingerprint(after.map(comparable))) {
      rememberMakeupRelief(s, ppicPromiseResult(s, p).makeups, recordedAt, versionFingerprint(taskReceipts))
      continue
    }
    before.forEach(a => { a.active = false })
    const version = 'E' + String(s.evaluations.length + 1)
    after.forEach((a, i) => s.allocations.push({ ...a, evaluationVersion: version, allocationId: 'ALLOC-' + version + '-' + i, active: true }))
    const result = ppicPromiseResult(s, p)
    rememberMakeupRelief(s, result.makeups, recordedAt, versionFingerprint(taskReceipts))
    s.evaluations.push({ evaluationId: version + '-' + p.promiseId, promiseId: p.promiseId, receiptVersion: versionFingerprint(taskReceipts), timelyQty: result.timelyQty, receivedQty: result.receivedQty, recordedAt })
  }
}
export function confirmPpicDay(s: PpicDailyStore, input: { operationId: string; actor: PpicActor; date: string; tasks: PpicTaskContext[]; noArrangementReasons: Record<string, string>; nowAt: string }): PpicDailyConfirmation {
  const config = ppicConfigAt(s, input.date)
  const makeupIds = s.makeups.filter(m => m.actorId === input.actor.id && ppicBusinessDate(m.createdAt, config.timeZone) === input.date).map(m => m.makeupId)
  const revisions = s.actions.filter(a => a.actorId === input.actor.id && a.action === '修改安排时间' && ppicBusinessDate(a.at, config.timeZone) === input.date)
  const revisionIds = revisions.map(a => a.actionId)
  const fp = fingerprint({ actorId: input.actor.id, date: input.date, taskIds: input.tasks.map(t => t.assignmentId).sort(), reasons: input.noArrangementReasons, promiseIds: s.promises.filter(p => p.actorId === input.actor.id && p.date === input.date).map(p => p.promiseId), makeupIds, revisionIds })
  const old = repeat(s.confirmations, input.operationId, fp); if (old) return old
  if (input.date !== ppicBusinessDate(input.nowAt, config.timeZone)) throw new Error('只能确认当前业务日期的填报。')
  input.tasks.forEach(t => owner(input.actor, t))
  const promises = s.promises.filter(p => p.date === input.date && p.actorId === input.actor.id)
  for (const t of input.tasks) if (!promises.some(p => p.assignmentId === t.assignmentId) && !s.makeups.some(m => makeupIds.includes(m.makeupId) && s.promises.some(p => p.promiseId === m.promiseId && p.assignmentId === t.assignmentId)) && !revisions.some(a => s.promises.some(p => p.promiseId === a.promiseId && p.assignmentId === t.assignmentId)) && !input.noArrangementReasons[t.assignmentId]?.trim()) throw new Error('每个任务需要回货安排或无安排原因。')
  s.confirmations.filter(d => d.actorId === input.actor.id && d.date === input.date).forEach(d => { d.active = false })
  const row: PpicDailyConfirmation = { confirmationId: 'DAILY-' + input.operationId, operationId: input.operationId, fingerprint: fp, actorId: input.actor.id, date: input.date,
    submittedAt: stamp(input.nowAt, config.timeZone), configId: config.configId, taskIds: input.tasks.map(t => t.assignmentId), noArrangementReasons: clone(input.noArrangementReasons), promiseIds: promises.map(p => p.promiseId), makeupIds, revisionIds, active: true }
  s.confirmations.push(row); recordAction(s, input.operationId, input.actor, '确认今日填报', row.submittedAt, fp)
  return row
}
export function changePpicConfig(s: PpicDailyStore, input: { operationId: string; actor: PpicActor; cutoff: string; timeZone: string; effectiveFrom: string; nowAt: string }): PpicConfig {
  const fp = fingerprint({ actorId: input.actor.id, cutoff: input.cutoff, timeZone: input.timeZone, effectiveFrom: input.effectiveFrom })
  const old = repeat(s.configs, input.operationId, fp); if (old) return old
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.cutoff)) throw new Error('提交截止时间格式不正确。')
  if (input.timeZone !== 'Asia/Jakarta') throw new Error('本轮业务时区固定为Asia/Jakarta，不能通过每日截止设置改变。')
  if (input.effectiveFrom < ppicBusinessDate(input.nowAt, input.timeZone)) throw new Error('配置不能追溯覆盖过去业务日。')
  ppicInstant(input.effectiveFrom + 'T00:00', input.timeZone)
  const c: PpicConfig = { configId: 'CONFIG-' + input.operationId, operationId: input.operationId, fingerprint: fp, cutoff: input.cutoff, timeZone: input.timeZone, effectiveFrom: input.effectiveFrom, createdAt: stamp(input.nowAt, input.timeZone), actorId: input.actor.id }
  s.configs.push(c); recordAction(s, input.operationId, input.actor, '修改每日截止', c.createdAt, fp)
  return c
}
