import { getAvailableOnboardingPpicOptions, getCurrentSewingOutsourcingPpic } from './factory-onboarding-ppic.ts'
import { listSewingFactoryMasterRecords } from './factory-master-store.ts'
import { hydrateProductionContextRecords } from './production-context-records.ts'
import { getCurrentSewingTaskResponsibility, listSewingTaskResponsibilityVersions } from './sewing-outsourcing-responsibility.ts'
import { listSewingOutsourcingReturnTrackingRows } from './sewing-outsourcing-return-tracking.ts'
import { listPostFinishingReturnConfirmationVersions } from './post-finishing-full-flow.ts'
import { getPpicReturnQuantityBasis, type PpicReturnQuantityBasis } from './ppic-return-quantity-basis.ts'
import { withCutPieceReleaseReadSnapshot } from './cut-piece-release.ts'
import { assertPostFinishingWrite, ensurePostFinishingRecordState, getPostFinishingStorageFailure, registerPostFinishingRepository, registerPostFinishingCommitProjection, runPostFinishingCommand } from './post-finishing-records.ts'
import { createPpicDailyStore, ppicConfigAt, ppicBusinessDate, ppicInstant, ppicPromiseResult, ppicTaskCapacity, syncPpicReceipts, addPpicPromise, arrangePpicMakeup, recordPpicGapReason, confirmPpicDay, changePpicConfig, amendPpicPromise, type PpicDailyStore, type PpicActor, type PpicTaskContext, type PpicPromise } from './ppic-daily-return.ts'

let store = createPpicDailyStore()
const collections = { promises: 'ppicPromises', makeups: 'ppicMakeups', allocations: 'ppicAllocations', confirmations: 'ppicConfirmations', configs: 'ppicConfigs', bases: 'ppicBases', actions: 'ppicActions', evaluations: 'ppicEvaluations' } as const
function validateRows(key: keyof PpicDailyStore, value: unknown): void {
  if (!Array.isArray(value)) throw new Error('每日回货资料格式不完整，未覆盖原记录。')
  for (const row of value) {
    if (!row || typeof row !== 'object') throw new Error('每日回货记录无效，请保留原资料。')
    const qty = key === 'bases' ? row.expectedQty : row.quantity
    if (['promises', 'makeups', 'allocations', 'bases'].includes(key) && (!Number.isSafeInteger(qty) || qty < (key === 'bases' ? 0 : 1))) throw new Error('已保存的每日回货数量无效，请保留原资料。')
    if (key === 'promises') {
      if (!row.assignmentId || !row.factoryId || !row.actorId || !Array.isArray(row.revisions)) throw new Error('原承诺任务或责任资料缺失。')
      ppicInstant(row.originalDeadlineAt); ppicInstant(row.createdAt)
    }
    if (key === 'makeups') { if (row.releasedQty !== undefined && (!Number.isSafeInteger(row.releasedQty) || row.releasedQty < 0 || row.releasedQty > row.quantity)) throw new Error('补回解除数量无效，原资料保留。'); if (!row.promiseId || !row.actorId || !Number.isSafeInteger(row.round) || row.round < 1) throw new Error('补回关联资料缺失。'); ppicInstant(row.deadlineAt); ppicInstant(row.createdAt) }
    if (key === 'allocations' && (!row.promiseId || !row.receiptId || typeof row.active !== 'boolean')) throw new Error('实收分摊关联资料缺失。')
    if (key === 'confirmations' && (!Array.isArray(row.taskIds) || !Array.isArray(row.promiseIds) || !row.configId || !row.actorId)) throw new Error('日确认覆盖资料缺失。')
    if (key === 'configs' && (row.timeZone !== 'Asia/Jakarta' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.cutoff) || !/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveFrom))) throw new Error('已保存的日截止配置无效。')
  }
}
for (const key of Object.keys(collections) as Array<keyof PpicDailyStore>) registerPostFinishingRepository(collections[key],
  () => store[key], value => { validateRows(key, value); (store[key] as unknown[]) = value })
export const PPIC_DAILY_DEMO_MEMBERS: PpicActor[] = [
  ...getAvailableOnboardingPpicOptions().map(p => ({ id: p.ppicId, name: p.ppicName, leader: p.role === 'TEAM_LEADER' })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: 'PPIC-DAILY-MOCK-' + (i + 1), name: '演示成员 ' + (i + 1), leader: false })),
]
export function getCurrentPpicDailyActor(): PpicActor {
  const current = getCurrentSewingOutsourcingPpic()
  return { id: current.ppicId, name: current.ppicName, leader: current.role === 'TEAM_LEADER' }
}
function receipts() {
  return listPostFinishingReturnConfirmationVersions({ activeOnly: true }).map(r => ({ id: r.confirmationVersionId, deliveryId: r.deliveryId, assignmentId: r.assignmentId, factoryId: r.factoryId, quantity: r.confirmedQty, confirmedAt: r.confirmedAt, recordedAt: r.versionCreatedAt }))
}
export function syncPpicDailyReceiptAllocations(): void {
  assertPostFinishingWrite()
  syncPpicReceipts(store, receipts())
}
registerPostFinishingCommitProjection(syncPpicDailyReceiptAllocations)
export async function ensurePpicDailyReturnState(): Promise<void> {
  await hydrateProductionContextRecords()
  await ensurePostFinishingRecordState()
  if (getPostFinishingStorageFailure()) throw new Error(getPostFinishingStorageFailure())
}
export function capturePpicDailyStore(): PpicDailyStore { return structuredClone(store) }
export function restorePpicDailyStoreForTests(value: PpicDailyStore): void { assertPostFinishingWrite(); store = structuredClone(value) }

export interface PpicDailyTaskView {
  basis: PpicReturnQuantityBasis
  task: PpicTaskContext
  capacity: ReturnType<typeof ppicTaskCapacity>
  promises: Array<PpicPromise & { result: ReturnType<typeof ppicPromiseResult> & { missingReason: boolean } }>
  todayHasArrangement?: boolean
  historical?: boolean
  milestones: Array<{ ratio: number; targetQty: number; deadlineAt: string; status: string }>
  missingMilestones?: Array<{ ratio: number; deadlineAt: string }>
  responsibilityHistory: Array<{ ppicId: string; ppicName: string; effectiveAt: string; reason?: string }>
}
function taskViews(nowAt: string, actorId?: string): PpicDailyTaskView[] {
  return withCutPieceReleaseReadSnapshot(() => readTaskViews(nowAt, actorId), false)
}
function readTaskViews(nowAt: string, actorId?: string): PpicDailyTaskView[] {
  const factories = new Set(listSewingFactoryMasterRecords().filter(f => f.factoryTier === 'THIRD_PARTY' && f.factoryType === 'THIRD_SEWING').map(f => f.id))
  const personalHistory = new Set(store.promises.filter(p => p.actorId === actorId).map(p => p.assignmentId))
  const current: PpicDailyTaskView[] = listSewingOutsourcingReturnTrackingRows(nowAt, assignment => factories.has(assignment.factoryId)
    && (!actorId || (getCurrentSewingTaskResponsibility(assignment.runtimeTaskId)?.ppicId || assignment.ppicId || '') === actorId || personalHistory.has(assignment.assignmentId))).map(r => {
    const basis = getPpicReturnQuantityBasis(r.assignment.assignmentId, nowAt)
    const task: PpicTaskContext = { assignmentId: basis.assignmentId, taskId: basis.taskId, factoryId: basis.factoryId, ownerId: r.ppicId,
      expectedQty: basis.expectedQty, status: basis.status, sourceKind: basis.sourceKind || '', sourceRefs: basis.sourceRefs, basisVersion: basis.basisVersion }
    return { basis, task, capacity: ppicTaskCapacity(store, task, r.confirmedQty),
      promises: store.promises.filter(p => p.assignmentId === task.assignmentId).map(p => { const result = ppicPromiseResult(store, p, nowAt); return { ...structuredClone(p), result: { ...result, missingReason: result.due && result.originalGap > 0 && !store.actions.some(a => a.promiseId === p.promiseId && ['登记补回', '补充欠回原因'].includes(a.action)) } } }),
      milestones: r.returnProjection.milestones.map(m => ({ ratio: m.ratio, targetQty: m.targetQty, deadlineAt: m.deadlineAt, status: m.status })),
      missingMilestones: r.returnProjection.missingMilestones,
      responsibilityHistory: listSewingTaskResponsibilityVersions(task.taskId).map(v => ({ ppicId: v.ppicId, ppicName: v.ppicName, effectiveAt: v.effectiveAt, reason: v.reason })) }
  })
  const ids = new Set(current.map(t => t.task.assignmentId))
  for (const p of store.promises) if ((!actorId || p.actorId === actorId) && !ids.has(p.assignmentId)) {
    ids.add(p.assignmentId)
    const basis = getPpicReturnQuantityBasis(p.assignmentId, nowAt)
    const saved = store.bases.find(b => b.assignmentId === p.assignmentId && b.version === p.basisVersion)
    const task: PpicTaskContext = { assignmentId: p.assignmentId, taskId: p.taskId, factoryId: p.factoryId, ownerId: p.actorId, expectedQty: saved?.expectedQty ?? null, basisVersion: p.basisVersion, status: 'SOURCE_UNAVAILABLE', sourceKind: saved?.sourceKind || '', sourceRefs: saved?.sourceRefs || [] }
    const received = receipts().filter(r => r.assignmentId === p.assignmentId).reduce((n, r) => n + r.quantity, 0)
    current.push({ basis: { ...basis, expectedQty: saved?.expectedQty ?? null, message: '历史任务，只读追溯原承诺和应回依据。' }, task, historical: true,
      capacity: ppicTaskCapacity(store, task, received), milestones: [],
      promises: store.promises.filter(root => root.assignmentId === p.assignmentId).map(root => { const result = ppicPromiseResult(store, root, nowAt); return { ...structuredClone(root), result: { ...result, missingReason: false } } }),
      responsibilityHistory: listSewingTaskResponsibilityVersions(p.taskId).filter(v => v.assignmentId === p.assignmentId).map(v => ({ ppicId: v.ppicId, ppicName: v.ppicName, effectiveAt: v.effectiveAt, reason: v.reason })) } as PpicDailyTaskView)
  }
  return current
}
function needsDailyTaskConfirmation(t: PpicDailyTaskView): boolean {
  return !t.historical && (t.capacity.conflict || t.capacity.pending > 0 || t.promises.some(p => p.result.currentGap > 0 || p.result.missingReason))
}
export function getPpicDailyReturnView(input: { date?: string; nowAt?: string } = {}) {
  const actor = getCurrentPpicDailyActor(), nowAt = input.nowAt || new Date().toISOString()
  const date = input.date || ppicBusinessDate(nowAt)
  const config = ppicConfigAt(store, date)
  const all = taskViews(nowAt, actor.id)
  const tasks = all.filter(t => t.task.ownerId === actor.id && needsDailyTaskConfirmation(t))
    .map(t => ({ ...t, todayHasArrangement: t.promises.some(p => p.actorId === actor.id && p.date === date) || store.makeups.some(m => m.actorId === actor.id && ppicBusinessDate(m.createdAt, config.timeZone) === date && t.promises.some(p => p.promiseId === m.promiseId)) || store.actions.some(a => a.action === '修改安排时间' && a.actorId === actor.id && ppicBusinessDate(a.at, config.timeZone) === date && t.promises.some(p => p.promiseId === a.promiseId)) }))
  const history = all.filter(t => (t.historical || t.task.ownerId !== actor.id) && t.promises.some(p => p.actorId === actor.id))
    .map(t => ({ assignmentId: t.task.assignmentId, taskNo: t.basis.taskNo, factoryName: t.basis.factoryName, promises: t.promises.filter(p => p.actorId === actor.id) }))
  const confirmation = store.confirmations.find(d => d.active && d.actorId === actor.id && d.date === date)
  const needsReconfirmation = Boolean(confirmation && date === ppicBusinessDate(nowAt, config.timeZone) && (tasks.some(t => !confirmation.taskIds.includes(t.task.assignmentId))
    || store.promises.some(p => p.actorId === actor.id && p.date === date && !confirmation.promiseIds.includes(p.promiseId))
    || store.makeups.some(m => m.actorId === actor.id && ppicBusinessDate(m.createdAt, config.timeZone) === date && !(confirmation.makeupIds || []).includes(m.makeupId)) || store.actions.some(a => a.actorId === actor.id && a.action === '修改安排时间' && ppicBusinessDate(a.at, config.timeZone) === date && !(confirmation.revisionIds || []).includes(a.actionId))))
  return { actor, date, nowAt, config, tasks, history, needsReconfirmation, confirmation: confirmation ? structuredClone(confirmation) : null,
    submissionStatus: needsReconfirmation ? '待重新确认' : confirmation ? (() => { const c = store.configs.find(c => c.configId === confirmation.configId) || config; return ppicInstant(confirmation.submittedAt) <= ppicInstant(date + 'T' + c.cutoff, c.timeZone) ? '已提交' : '逾期补交' })() : ppicInstant(nowAt) >= ppicInstant(date + 'T' + config.cutoff, config.timeZone) ? '未提交已超时' : '待提交' }
}
export interface PpicDailySummaryQuery { date?: string; ppicId?: string; factoryId?: string; keyword?: string; reason?: string; status?: string; nowAt?: string }
export function getPpicDailySupervisorView(query: PpicDailySummaryQuery = {}) {
  const actor = getCurrentPpicDailyActor(); if (!actor.leader) throw new Error('只有组长可以查看团队汇总。')
  const nowAt = query.nowAt || new Date().toISOString(), date = query.date || ppicBusinessDate(nowAt), config = ppicConfigAt(store, date)
  const allTasks = taskViews(nowAt)
  const eligible = new Map(allTasks.map(t => [t.task.assignmentId, t]))
  const keyword = (query.keyword || '').trim().toLowerCase()
  const taskMatches = (t: PpicDailyTaskView) => (!query.factoryId || t.basis.factoryId === query.factoryId)
    && (!keyword || [t.basis.productionOrderNo, t.basis.taskNo, t.basis.factoryName].some(v => v.toLowerCase().includes(keyword)) || rows.some(r => r.promise.assignmentId === t.task.assignmentId) || todayMakeups.some(r => r.promise.assignmentId === t.task.assignmentId))
    && (!query.ppicId || t.task.ownerId === query.ppicId || rows.some(r => r.promise.assignmentId === t.task.assignmentId) || todayMakeups.some(r => r.promise.assignmentId === t.task.assignmentId))
  const todayMakeups = store.makeups.filter(m => ppicBusinessDate(m.createdAt, config.timeZone) === date).flatMap(m => {
    const p = store.promises.find(p => p.promiseId === m.promiseId), view = p ? eligible.get(p.assignmentId) : undefined
    if (!p || !view) return []
    const result = ppicPromiseResult(store, p, nowAt).makeups.find(row => row.makeupId === m.makeupId)!
    const { receivedQty, currentGap, releasedQty } = result
    const status = !m.active ? '已重新安排' : !currentGap ? releasedQty ? '原欠回已解除' : '已补齐' : ppicInstant(nowAt) >= ppicInstant(m.deadlineAt) ? '补回逾期' : '待补回'
    return [{ makeup: structuredClone(m), promise: structuredClone(p), basis: view.basis, ownerId: view.task.ownerId, result: { receivedQty, currentGap, releasedQty, status } }]
  }).filter(r => (!query.ppicId || r.makeup.actorId === query.ppicId) && (!query.factoryId || r.basis.factoryId === query.factoryId)
    && (!keyword || [r.basis.productionOrderNo, r.basis.taskNo, r.basis.factoryName, r.promise.promiseNo].some(v => v.toLowerCase().includes(keyword)))
    && (!query.reason || r.makeup.reason === query.reason) && (!query.status || r.result.status === query.status || ppicPromiseResult(store, r.promise, nowAt).status === query.status))
  const rows = store.promises.filter(p => p.date === date).flatMap(p => {
    const view = eligible.get(p.assignmentId); if (!view) return []
    const result = ppicPromiseResult(store, p, nowAt)
    const reason = store.actions.filter(a => a.promiseId === p.promiseId && a.reason && ['登记补回', '补充欠回原因'].includes(a.action)).at(-1)?.reason || ''
    const deadlineResponsibility = view.responsibilityHistory.filter(v => ppicInstant(v.effectiveAt) <= ppicInstant(p.originalDeadlineAt)).at(-1)
    return [{ promise: structuredClone(p), result, reason, basis: view.basis, ownerId: view.task.ownerId, dueOwnerId: deadlineResponsibility?.ppicId || p.actorId }]
  }).filter(r => (!query.ppicId || r.promise.actorId === query.ppicId) && (!query.factoryId || r.basis.factoryId === query.factoryId)
    && (!keyword || [r.basis.productionOrderNo, r.basis.taskNo, r.basis.factoryName, r.promise.promiseNo].some(v => v.toLowerCase().includes(keyword)))
    && (!query.reason || r.reason.startsWith(query.reason)) && (!query.status || r.result.status === query.status))
  const taskScope = allTasks.filter(taskMatches).filter(t => !query.reason && !query.status || rows.some(r => r.promise.assignmentId === t.task.assignmentId) || todayMakeups.some(r => r.promise.assignmentId === t.task.assignmentId))
  const scopedPeople = new Set(taskScope.flatMap(t => [t.task.ownerId, ...rows.filter(r => r.promise.assignmentId === t.task.assignmentId).map(r => r.promise.actorId), ...todayMakeups.filter(r => r.promise.assignmentId === t.task.assignmentId).map(r => r.makeup.actorId)]))
  const hasTaskFilter = Boolean(query.factoryId || keyword || query.reason || query.status)
  const people = PPIC_DAILY_DEMO_MEMBERS.filter(m => !m.leader && (!query.ppicId || m.id === query.ppicId) && (!hasTaskFilter || scopedPeople.has(m.id))).map(m => {
    const confirmation = store.confirmations.find(d => d.active && d.actorId === m.id && d.date === date)
    const dayConfig = confirmation ? store.configs.find(c => c.configId === confirmation.configId) || config : config
    const needsReconfirmation = Boolean(confirmation && date === ppicBusinessDate(nowAt, config.timeZone) && (allTasks.some(t => t.task.ownerId === m.id && needsDailyTaskConfirmation(t) && !confirmation.taskIds.includes(t.task.assignmentId))
      || store.promises.some(p => p.actorId === m.id && p.date === date && !confirmation.promiseIds.includes(p.promiseId))
      || store.makeups.some(item => item.actorId === m.id && ppicBusinessDate(item.createdAt, config.timeZone) === date && !(confirmation.makeupIds || []).includes(item.makeupId)) || store.actions.some(a => a.actorId === m.id && a.action === '修改安排时间' && ppicBusinessDate(a.at, config.timeZone) === date && !(confirmation.revisionIds || []).includes(a.actionId))))
    return { ...m, confirmation: confirmation ? structuredClone(confirmation) : null, needsReconfirmation, status: needsReconfirmation ? '待重新确认' : confirmation ? ppicInstant(confirmation.submittedAt) <= ppicInstant(date + 'T' + dayConfig.cutoff, dayConfig.timeZone) ? '已提交' : '逾期补交' : '未提交', taskCount: confirmation?.taskIds.length ?? allTasks.filter(t => t.task.ownerId === m.id && needsDailyTaskConfirmation(t)).length }
  })
  const originalQty = rows.reduce((n, r) => n + r.promise.quantity, 0), timelyQty = rows.reduce((n, r) => n + r.result.timelyQty, 0)
  const visibleTaskIds = new Set(taskScope.map(t => t.task.assignmentId))
  // 原因／状态针对承诺和补回段筛选，不能把同任务其他原因的实收合并进来。
  // 仅按生产单、任务、工厂筛选时仍包含尚未分摊的正式实收。
  const visiblePromiseIds = new Set(rows.map(r => r.promise.promiseId))
  const visibleMakeupIds = new Set(todayMakeups.map(r => r.makeup.makeupId))
  const promiseOnlyKeyword = Boolean(keyword && !taskScope.some(t => [t.basis.productionOrderNo, t.basis.taskNo, t.basis.factoryName].some(v => v.toLowerCase().includes(keyword))))
  const scopedAllocations = store.allocations.filter(a => a.active && ppicBusinessDate(a.confirmedAt, config.timeZone) === date
    && store.promises.some(p => p.promiseId === a.promiseId && visibleTaskIds.has(p.assignmentId))
    && (!(query.reason || query.status || promiseOnlyKeyword) || visiblePromiseIds.has(a.promiseId) || Boolean(a.makeupId && visibleMakeupIds.has(a.makeupId))))
  const actualReceivedQty = query.reason || query.status || promiseOnlyKeyword ? scopedAllocations.reduce((n, a) => n + a.quantity, 0)
    : receipts().filter(r => visibleTaskIds.has(r.assignmentId) && ppicBusinessDate(r.confirmedAt, config.timeZone) === date).reduce((n, r) => n + r.quantity, 0)
  const actualMakeupReceivedQty = scopedAllocations.filter(a => store.promises.some(p => p.promiseId === a.promiseId && ppicInstant(a.confirmedAt) > ppicInstant(p.originalDeadlineAt))).reduce((n, a) => n + a.quantity, 0)
  return { actor, date, nowAt, config, rows, people, tasks: taskScope, todayMakeups, stats: { originalQty, timelyQty, timelyRate: originalQty ? timelyQty / originalQty : null,
    originalGap: rows.filter(r => r.result.due).reduce((n, r) => n + r.result.originalGap, 0), currentGap: rows.filter(r => r.result.due).reduce((n, r) => n + r.result.currentGap, 0),
    makeupRounds: rows.reduce((n, r) => n + r.result.rounds, 0), actualReceivedQty, todayMakeupPlans: todayMakeups.length, todayMakeupPendingQty: todayMakeups.filter(r => r.makeup.active).reduce((n, r) => n + r.result.currentGap, 0), actualMakeupReceivedQty, submitted: people.filter(p => p.confirmation && !p.needsReconfirmation).length, members: people.length } }
}
async function save<T>(recipe: () => T): Promise<T> {
  const startedBy = getCurrentPpicDailyActor()
  await hydrateProductionContextRecords()
  return runPostFinishingCommand(() => {
    const current = getCurrentPpicDailyActor()
    if (current.id !== startedBy.id || current.name !== startedBy.name || current.leader !== startedBy.leader) throw new Error('当前登录身份已变化，尚未保存。重新读取后再提交。')
    return recipe()
  })
}
function currentTask(assignmentId: string): PpicDailyTaskView {
  const view = taskViews(new Date().toISOString()).find(t => t.task.assignmentId === assignmentId)
  if (!view || view.historical) throw new Error('第三方车缝任务不存在或已失效，历史任务只读。')
  return view
}
export function savePpicDailyReturnPromise(input: { operationId: string; assignmentId: string; quantity: number; deadlineAt: string; date: string; basisVersion: string; nowAt?: string }) {
  return save(() => { const view = currentTask(input.assignmentId)
    if (view.task.basisVersion !== input.basisVersion) throw new Error('应回数量来源已变化，请重新读取后填写。')
    syncPpicDailyReceiptAllocations()
    return addPpicPromise(store, { ...input, actor: getCurrentPpicDailyActor(), task: view.task, receivedQty: view.capacity.receivedQty, nowAt: input.nowAt || new Date().toISOString() }) })
}
export function savePpicDailyReturnMakeup(input: { operationId: string; assignmentId: string; promiseId: string; quantity: number; deadlineAt: string; reason: string; detail: string; nowAt?: string }) {
  return save(() => { syncPpicDailyReceiptAllocations(); return arrangePpicMakeup(store, { ...input, actor: getCurrentPpicDailyActor(), task: currentTask(input.assignmentId).task, nowAt: input.nowAt || new Date().toISOString() }) })
}
export function savePpicDailyReturnReason(input: { operationId: string; assignmentId: string; promiseId: string; reason: string; detail: string; nowAt?: string }) {
  return save(() => recordPpicGapReason(store, { ...input, actor: getCurrentPpicDailyActor(), task: currentTask(input.assignmentId).task, nowAt: input.nowAt || new Date().toISOString() }))
}
export function savePpicDailyReturnAmendment(input: { operationId: string; assignmentId: string; promiseId: string; deadlineAt: string; reason: string; nowAt?: string }) {
  return save(() => amendPpicPromise(store, { ...input, actor: getCurrentPpicDailyActor(), task: currentTask(input.assignmentId).task, nowAt: input.nowAt || new Date().toISOString() }))
}
export function confirmPpicDailyReport(input: { operationId: string; date: string; noArrangementReasons: Record<string, string>; nowAt?: string }) {
  return save(() => confirmPpicDay(store, { ...input, actor: getCurrentPpicDailyActor(), tasks: getPpicDailyReturnView({ date: input.date, nowAt: input.nowAt }).tasks.map(t => t.task), nowAt: input.nowAt || new Date().toISOString() }))
}
export function getPpicTaskPromiseHistory(assignmentId: string, nowAt = new Date().toISOString()) {
  const view = currentTask(assignmentId), actor = getCurrentPpicDailyActor()
  if (!actor.leader && view.task.ownerId !== actor.id) throw new Error('只能查看本人当前负责的任务。')
  return { promises: view.promises, allocations: store.allocations.filter(a => view.promises.some(p => p.promiseId === a.promiseId)), actions: store.actions.filter(a => view.promises.some(p => p.promiseId === a.promiseId)), evaluations: store.evaluations.filter(e => view.promises.some(p => p.promiseId === e.promiseId)), bases: store.bases.filter(b => b.assignmentId === assignmentId) }
}
export function savePpicDailyReturnConfig(input: { operationId: string; cutoff: string; timeZone: string; effectiveFrom: string; nowAt?: string }) {
  return save(() => changePpicConfig(store, { ...input, actor: getCurrentPpicDailyActor(), nowAt: input.nowAt || new Date().toISOString() }))
}
