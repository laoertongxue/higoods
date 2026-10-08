import { escapeHtml } from '../../utils'
import { findTimingCase, getTimingBranch, findTimingDocument, TIMING_AS_OF } from '../../data/production-timing/source'
import { loadFollowups, readFollowups, saveFollowup, followupStorageState, type FollowupRecord } from './followup-storage'

interface Draft {
  caseId: string; author: string; nodeId: string; reason: string; action: string; expectedAt: string
  phase: 'editing' | 'saving' | 'saved' | 'unconfirmed'; error: string; reading: boolean; readStarted: boolean
  attempt?: FollowupRecord; savedId?: string; onUpdated?: () => void
}
const drafts = new Map<string, Draft>()
const ROOT = '[data-timing-followups]'
const e = escapeHtml
let sequence = 0

function draftFor(caseId: string): Draft {
  let draft = drafts.get(caseId)
  if (!draft) {
    draft = { caseId, author: '', nodeId: '', reason: '', action: '', expectedAt: '', phase: 'editing', error: '', reading: false, readStarted: false }
    drafts.set(caseId, draft)
  }
  return draft
}

function hasInput(draft: Draft): boolean {
  return [draft.author, draft.reason, draft.action, draft.expectedAt].some(value => value.trim() !== '') || draft.nodeId !== ''
}

function isDirty(draft: Draft): boolean { return draft.phase !== 'saved' && hasInput(draft) }
function recordEqual(a: FollowupRecord, b: FollowupRecord): boolean { return JSON.stringify(a) === JSON.stringify(b) }

function time(value: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '未填写'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value)).replaceAll('/', '-')
}

function status(draft: Draft): string {
  const storage = followupStorageState()
  const label = draft.phase === 'saving' ? '正在保存，请稍候'
    : draft.phase === 'saved' ? '跟进记录已保存并核对'
      : draft.phase === 'unconfirmed' ? '保存结果待确认，请重新读取'
        : hasInput(draft) ? '未保存' : '尚未填写，未保存'
  const color = draft.phase === 'saved' ? 'text-emerald-700' : draft.phase === 'saving' ? 'text-blue-700' : 'text-amber-700'
  const error = draft.error || storage.error
  return `<p class="text-sm font-medium ${color}" role="status">${e(label)}</p>${draft.reading ? '<p class="mt-1 text-xs text-slate-500">正在读取本浏览器的跟进记录，当前输入保留。</p>' : ''}${error ? `<p class="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700" role="alert">${e(error)}</p>` : ''}`
}

function history(caseId: string): string {
  const storage = followupStorageState(), records = readFollowups().filter(record => record.taskId === caseId).slice().sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id))
  const oldRecords = readFollowups().filter(record => !findTimingCase(record.taskId)).length
  const warning = storage.loaded ? '' : '<p class="mb-2 text-sm text-amber-700">本次跟进记录尚未成功读取；下方如有记录，只是上次已读取结果。</p>'
  const legacy = `<p class="mt-3 text-xs text-slate-500">旧记录仍按原归属保留，本页只显示与当前${findTimingCase(caseId)?.order ? '生产单' : '采购单'} 准确对应的记录；不能确认归属的记录继续保留，待核实。${storage.legacyCount || oldRecords ? `另有 ${storage.legacyCount + oldRecords} 条旧资料未自动归入当前记录。` : ''}</p>${storage.legacyWarning ? `<p class="mt-1 text-xs text-amber-700">${e(storage.legacyWarning)}</p>` : ''}`
  const rows = records.length ? records.map(record => {
    const document = record.nodeId ? findTimingDocument(record.nodeId)?.document : null
    const work = !record.nodeId ? '整单' : document ? `<button type="button" class="doc-link" data-document="${e(document.id)}" data-skip-page-rerender="true">${e(document.type)} · ${e(document.no)}</button>` : `<span>对应工作 ${e(record.nodeId)}（关联待核实）</span>`
    return `<article class="rounded border border-slate-200 bg-white p-3"><div class="flex flex-wrap items-center justify-between gap-2"><strong class="text-sm">${e(record.author)}</strong><span class="text-xs text-slate-500">实际登记 ${e(time(record.at))}</span></div><div class="mt-2 text-sm">${work}</div><dl class="mt-2 space-y-2 text-sm"><div><dt class="text-xs text-slate-500">原因 / 当前反馈</dt><dd class="whitespace-pre-wrap">${e(record.reason)}</dd></div><div><dt class="text-xs text-slate-500">已安排的跟进动作</dt><dd class="whitespace-pre-wrap">${e(record.action)}</dd></div><div><dt class="text-xs text-slate-500">预计对应工作完成、交出或接收时间（反馈）</dt><dd>${record.expectedAt ? e(time(record.expectedAt)) : '未填写'}</dd></div></dl></article>`
  }).join('') : `<p class="rounded border border-dashed border-slate-200 p-3 text-sm text-slate-500">${storage.loaded ? '当前记录暂无已保存的跟进记录。' : '跟进记录待成功读取。'}</p>`
  return warning + `<div class="space-y-3">${rows}</div>` + legacy
}

function actions(draft: Draft): string {
  const busy = draft.phase === 'saving' || draft.reading
  const save = draft.phase === 'saved'
    ? '<button type="button" class="btn primary" disabled>跟进记录已保存</button><button type="button" class="btn" data-timing-followup-action="new" data-skip-page-rerender="true">新增一条跟进</button>'
    : `<button type="button" class="btn primary" data-timing-followup-action="save" data-skip-page-rerender="true" ${busy || draft.phase === 'unconfirmed' ? 'disabled' : ''}>${draft.phase === 'saving' ? '保存中…' : '保存跟进记录'}</button>`
  return `<div class="flex flex-wrap items-center gap-2">${save}<button type="button" class="btn" data-timing-followup-action="reload" data-skip-page-rerender="true" ${busy ? 'disabled' : ''}>重新读取</button></div>`
}

function updateRegions(draft: Draft): void {
  if (typeof document === 'undefined') return
  const root = Array.from(document.querySelectorAll<HTMLElement>(ROOT)).find(element => element.dataset.timingFollowups === draft.caseId)
  if (!root) return
  const feedback = root.querySelector<HTMLElement>('[data-timing-followup-region="status"]')
  const records = root.querySelector<HTMLElement>('[data-timing-followup-region="history"]')
  const buttons = root.querySelector<HTMLElement>('[data-timing-followup-region="actions"]')
  if (feedback) feedback.innerHTML = status(draft)
  if (records) records.innerHTML = history(draft.caseId)
  if (buttons) buttons.innerHTML = actions(draft)
  root.dataset.draftDirty = String(isDirty(draft))
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-timing-followup-field]').forEach(field => { field.disabled = draft.phase === 'saving' || draft.phase === 'saved' || draft.phase === 'unconfirmed' })
}

async function reread(draft: Draft): Promise<void> {
  if (draft.reading || draft.phase === 'saving') return
  draft.reading = true; draft.readStarted = true; updateRegions(draft)
  let failure = ''
  try { await loadFollowups() } catch (error) { failure = error instanceof Error ? error.message : '跟进记录读取失败，当前输入保留。' }
  draft.reading = false
  const storage = followupStorageState()
  if (failure || !storage.loaded) draft.error = failure || storage.error || '未能读取跟进记录，当前输入保留；请重新读取后保存。'
  else {
    draft.error = ''
    if (draft.attempt && readFollowups().some(record => record.id === draft.attempt!.id && recordEqual(record, draft.attempt!))) {
      draft.phase = 'saved'; draft.savedId = draft.attempt.id
    } else if (draft.phase === 'unconfirmed') draft.phase = 'editing'
  }
  updateRegions(draft)
  draft.onUpdated?.()
}

/** Modal contents only. A read may occur, but no business write or migration. */
export function renderTimingFollowups(caseId: string): string {
  const order = findTimingCase(caseId)
  if (!order) return '<p class="text-sm text-slate-500">未找到当前生产单或采购单，不能登记无归属的跟进记录。</p>'
  const draft = draftFor(caseId), branch = getTimingBranch(order)
  if (!draft.readStarted) void reread(draft)
  const works = branch ? Object.values(branch.docs).filter(document => document.type !== '商品采购单') : []
  const disabled = draft.phase === 'saving' || draft.phase === 'saved' || draft.phase === 'unconfirmed' ? 'disabled' : ''
  return `<div data-timing-followups="${e(caseId)}" data-draft-dirty="${isDirty(draft)}" class="space-y-4"><div><h2 class="text-lg font-semibold">跟进记录 · ${e(order.order ?? order.purchases[0]?.id ?? caseId)}</h2><p class="mt-1 text-xs text-slate-500">图示固定查看时点 ${e(TIMING_AS_OF)}；这里按当前实际时间登记业务反馈。填写预计时间时请在跟进动作说明是完成、交出还是接收；预计时间仅作为反馈，不覆盖加工、交接或入库事实。</p></div><div data-timing-followup-region="status">${status(draft)}</div><div class="grid gap-3"><label class="block text-sm"><span>跟进人 <b class="text-red-600">*</b></span><input class="mt-1 w-full rounded border border-slate-300 px-3 py-2" data-timing-followup-field="author" data-skip-page-rerender="true" maxlength="60" value="${e(draft.author)}" placeholder="请输入实际跟进人" ${disabled}></label><label class="block text-sm"><span>对应工作</span><select class="mt-1 w-full rounded border border-slate-300 px-3 py-2" data-timing-followup-field="nodeId" data-skip-page-rerender="true" ${disabled}><option value="">整单</option>${works.map(work => `<option value="${e(work.id)}" ${draft.nodeId === work.id ? 'selected' : ''}>${e(work.type)} · ${e(work.no)} · ${e(work.object)}</option>`).join('')}</select></label><label class="block text-sm"><span>原因 / 当前反馈 <b class="text-red-600">*</b></span><textarea class="mt-1 w-full rounded border border-slate-300 px-3 py-2" data-timing-followup-field="reason" data-skip-page-rerender="true" maxlength="1000" rows="3" placeholder="说明当前情况和需要协调的原因" ${disabled}>${e(draft.reason)}</textarea></label><label class="block text-sm"><span>跟进动作 <b class="text-red-600">*</b></span><textarea class="mt-1 w-full rounded border border-slate-300 px-3 py-2" data-timing-followup-field="action" data-skip-page-rerender="true" maxlength="1000" rows="3" placeholder="说明谁安排了什么动作" ${disabled}>${e(draft.action)}</textarea></label><label class="block text-sm"><span>预计对应工作完成、交出或接收时间（北京时间，可选）</span><input type="datetime-local" class="mt-1 w-full rounded border border-slate-300 px-3 py-2" data-timing-followup-field="expectedAt" data-skip-page-rerender="true" value="${e(draft.expectedAt)}" ${disabled}></label></div><p class="text-xs text-slate-500">未保存输入仅保留在当前页面内存；关闭此弹窗可重新打开继续填写，刷新或离开页面会丢失。</p><div data-timing-followup-region="actions">${actions(draft)}</div><section class="border-t border-slate-200 pt-4"><h3 class="mb-3 text-base font-semibold">已保存的跟进历史</h3><div data-timing-followup-region="history">${history(caseId)}</div></section></div>`
}

function prepare(draft: Draft): FollowupRecord {
  if (!draft.author.trim() || !draft.reason.trim() || !draft.action.trim()) throw new Error('跟进人、原因和跟进动作都需要填写；本次未保存，当前输入保留。')
  if (draft.author.length > 60 || draft.reason.length > 1000 || draft.action.length > 1000) throw new Error('跟进人最多60字，原因和动作各最多1000字；本次未保存，当前输入保留。')
  const order = findTimingCase(draft.caseId)
  if (!order) throw new Error('当前业务归属未找到，本次未保存。')
  if (draft.nodeId && !getTimingBranch(order)?.docs[draft.nodeId]) throw new Error('对应工作不属于当前记录，请重新选择；本次未保存。')
  let expectedAt = ''
  if (draft.expectedAt) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.expectedAt)) throw new Error('预计时间格式不正确，本次未保存。')
    const date = new Date(draft.expectedAt + ':00+08:00')
    if (!Number.isFinite(date.getTime())) throw new Error('预计时间无效，本次未保存。')
    if (new Date(date.getTime() + 8 * 3_600_000).toISOString().slice(0, 16) !== draft.expectedAt) throw new Error('预计时间无效，本次未保存。')
    expectedAt = date.toISOString()
  }
  if (draft.attempt) return draft.attempt
  const uuid = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`
  draft.attempt = { id: `timing-followup-${uuid}`, taskId: draft.caseId, nodeId: draft.nodeId, author: draft.author.trim(), at: new Date().toISOString(), reason: draft.reason.trim(), action: draft.action.trim(), expectedAt, kind: '业务跟进反馈' }
  return draft.attempt
}

async function save(draft: Draft): Promise<void> {
  if (draft.phase === 'saving' || draft.phase === 'saved' || draft.phase === 'unconfirmed' || draft.reading) return
  try {
    const record = prepare(draft)
    if (!followupStorageState().loaded) throw new Error('跟进资料尚未成功读取，请重新读取后保存；当前输入保留。')
    draft.phase = 'saving'; draft.error = ''; updateRegions(draft)
    // The forecast argument is intentionally absent: feedback never changes source facts.
    await saveFollowup(record)
    if (!followupStorageState().loaded || !readFollowups().some(row => row.id === record.id && recordEqual(row, record))) throw new Error('跟进记录已提交，但重新读取未确认；请重新读取确认，避免重复登记。')
    draft.phase = 'saved'; draft.savedId = record.id; draft.error = ''
  } catch (error) {
    const message = error instanceof Error ? error.message : '跟进保存失败，本次未保存，当前输入保留。'
    draft.phase = /已提交|读回/.test(message) ? 'unconfirmed' : 'editing'
    draft.error = message
  }
  updateRegions(draft)
  draft.onUpdated?.()
}

export function handleTimingFollowupClick(target: HTMLElement, onUpdated: () => void): boolean {
  const root = target.closest<HTMLElement>(ROOT), button = target.closest<HTMLElement>('[data-timing-followup-action]')
  if (!root || !button || !root.dataset.timingFollowups) return false
  const draft = draftFor(root.dataset.timingFollowups)
  draft.onUpdated = onUpdated
  if (button.dataset.timingFollowupAction === 'save') { void save(draft); return true }
  if (button.dataset.timingFollowupAction === 'reload') { void reread(draft); return true }
  if (button.dataset.timingFollowupAction === 'new' && draft.phase === 'saved') {
    draft.nodeId = ''; draft.reason = ''; draft.action = ''; draft.expectedAt = ''; draft.phase = 'editing'; draft.attempt = undefined; draft.savedId = undefined; draft.error = ''
    root.innerHTML = renderTimingFollowups(draft.caseId).replace(/^<div\b[^>]*>|<\/div>$/g, '')
    root.dataset.draftDirty = String(isDirty(draft))
    return true
  }
  return false
}

export function handleTimingFollowupField(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>(ROOT), field = target.closest<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-timing-followup-field]')
  const key = field?.dataset.timingFollowupField
  if (!root?.dataset.timingFollowups || !field || !key || !['author', 'nodeId', 'reason', 'action', 'expectedAt'].includes(key)) return false
  const draft = draftFor(root.dataset.timingFollowups)
  if (draft.phase !== 'editing') return true
  const fields = draft as unknown as Record<string, string>
  if (fields[key] !== field.value) { fields[key] = field.value; draft.attempt = undefined; draft.error = '' }
  updateRegions(draft)
  return true
}

if (typeof window !== 'undefined') window.addEventListener('beforeunload', event => {
  if (![...drafts.values()].some(isDirty)) return
  event.preventDefault(); event.returnValue = ''
})
