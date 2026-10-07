/** @page-pattern: form — 申请编辑/详情和单步业务弹窗；样衣选择为表单的一部分。 */
import { escapeHtml as e } from '../utils.ts'
import { retryPcsRecordState, runPcsRecordCommand } from '../data/pcs-record-runtime.ts'
import { ensureLosLiveRoomState, liveRoomTransferGuards } from '../data/los-live-room-master.ts'
import { listPcsSampleLocations, getPcsSampleLocationById } from '../data/pcs-sample-location-master.ts'
import {
  PCS_SAMPLE_STORAGE_KEY,
  listPcsSampleRecords,
  listPcsSampleRequests,
  listPcsSampleReturnCases,
  listPcsSampleStocktakeDiffs,
  getPcsSampleLabelIdentity,
  canRequestPcsSample,
  savePcsSampleRequestDraft,
  actPcsSampleRequest,
  createPcsSampleReturnCase,
  actPcsSampleReturnCase,
  resolvePcsSampleStocktake,
  type PcsSampleRequestDraft,
  type PcsSampleUseRequest,
  type PcsSampleRecord,
  type PcsSampleRequestAction,
} from '../data/pcs-sample-management.ts'
import { confirmPcsAction } from './pcs-action-dialog.ts'
const BASE = '/pcs/samples/application'
const button = (text: string, action: string, extra = '') =>
  `<button type="button" class="rounded border bg-white px-3 py-2 text-sm hover:bg-blue-50 disabled:opacity-50" data-sample-workflow-action="${action}" ${extra}>${e(text)}</button>`
const nav = (text: string, path: string) =>
  `<a class="rounded border bg-white px-3 py-2 text-sm text-blue-700" href="${e(path)}" data-nav="${e(path)}">${e(text)}</a>`
const control = 'mt-2 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm'
const field = (label: string, key: string, value: string, type = 'text') =>
  `<label class="block text-sm">${e(label)}<input class="${control}" data-sample-workflow-field="${key}" data-skip-page-rerender="true" type="${type}" value="${e(value)}"></label>`
const select = (label: string, key: string, value: string, options: Array<[string, string]>) =>
  `<label class="block text-sm">${e(label)}<select class="${control}" data-sample-workflow-field="${key}" data-skip-page-rerender="true">${options.map(([v, t]) => `<option value="${e(v)}" ${v === value ? 'selected' : ''}>${e(t)}</option>`).join('')}</select></label>`
let editorKey = '',
  draft: PcsSampleRequestDraft | null = null,
  revision = 0,
  dirty = false,
  tab = 'info',
  search = '',
  page = 1,
  error = '',
  busy = false,
  actionError = ''
let pending: {
  kind: 'request' | 'case' | 'stocktake' | 'create-case'
  id: string
  action: string
  title: string
  revision?: number
  operationId: string
  pathname: string
} | null = null
let actor = '',
  note = '',
  caseSample = '',
  caseType = '退货',
  caseTarget = ''
export function sampleWorkflowImage(sample: PcsSampleRecord): string {
  return `<div class="flex min-w-0 items-center gap-3"><button type="button" class="shrink-0 cursor-zoom-in" data-pda-image-preview-url="${e(sample.imageUrl)}" data-pda-image-preview-title="${e(sample.name)}" aria-label="查看${e(sample.name)}大图" data-skip-page-rerender="true"><img class="h-16 w-12 rounded border object-cover" src="${e(sample.imageUrl)}" alt="${e(sample.name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="p-2 text-xs text-red-700">图片加载失败</span></button><div class="min-w-0 text-sm"><p class="font-medium">${e(sample.name)}</p><p class="break-all">${e(getPcsSampleLabelIdentity(sample.skuCode)?.hgCode || 'HG 编号待生成')} · ${e(sample.skuCode)}</p><p class="text-xs text-slate-500">${e(sample.color)} · ${e(sample.size)} · ${e(sample.currentLocation)} · ${e(sample.status)}</p></div></div>`
}
function requestControls(r: PcsSampleUseRequest): string {
  const actions: Record<string, Array<[string, PcsSampleRequestAction]>> = {
    草稿: [
      ['提交申请', 'submit'],
      ['取消申请', 'cancel'],
    ],
    待审批: [
      ['审批通过', 'approve'],
      ['驳回', 'reject'],
      ['取消申请', 'cancel'],
    ],
    已批准待领用: [
      ['确认实际领用', 'pickup'],
      ['取消申请', 'cancel'],
    ],
    使用中: [['发起归还', 'return']],
    归还中: [['确认归还入库', 'receive']],
  }
  return `${r.status === '草稿' ? nav('编辑草稿', `${BASE}/${encodeURIComponent(r.requestId)}/edit`) : ''}${(actions[r.status] || []).map(([label, action]) => button(label, 'request-action', `data-id="${e(r.requestId)}" data-command="${action}" data-label="${label}"`)).join('')}`
}
export function renderSampleRequestControls(r: PcsSampleUseRequest): string {
  return requestControls(r)
}
export function renderSampleCaseControls(id: string): string {
  const r = listPcsSampleReturnCases().find((r) => r.caseId === id)
  if (!r) return ''
  const actions =
    r.status === '待审批'
      ? [
          ['审批通过', 'approve'],
          ['驳回案件', 'reject'],
        ]
      : ['待执行', '执行中'].includes(r.status)
        ? [[`确认执行${r.caseType}`, 'execute']]
        : []
  return actions
    .map(([label, action]) =>
      button(label, 'case-action', `data-id="${e(id)}" data-command="${action}" data-label="${label}"`),
    )
    .join('')
}
export function renderSampleStocktakeControls(id: string): string {
  const d = listPcsSampleStocktakeDiffs().find((r) => r.diffId === id)
  if (!d || d.status === '已关闭') return ''
  return button(
    d.status === '待确认' ? '开始核查' : '记录结论并关闭',
    'stocktake-action',
    `data-id="${e(id)}" data-command="${d.status === '待确认' ? 'investigate' : 'close'}" data-label="${d.status === '待确认' ? '开始核查' : '记录结论并关闭'}"`,
  )
}
function pickList(): string {
  if (!draft) return ''
  const rows = listPcsSampleRecords().filter(
    (s) =>
      s.responsibleSite === draft!.responsibleSite &&
      canRequestPcsSample(s, draft!.requestId) &&
      (!search ||
        [s.name, s.skuCode, getPcsSampleLabelIdentity(s.skuCode)?.hgCode || '']
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())),
  )
  const total = Math.max(1, Math.ceil(rows.length / 12))
  page = Math.min(page, total)
  return `<div class="space-y-3"><p class="text-sm">已选择 <strong>${draft.sampleIds.length}</strong> 条样衣记录；同 SKU 的多件样衣共用 HG 编号，按当前库存记录选择。</p><div class="grid gap-3 md:grid-cols-2">${
    rows
      .slice((page - 1) * 12, page * 12)
      .map(
        (s) =>
          `<label class="flex items-center gap-3 rounded border p-3"><input type="checkbox" data-sample-workflow-field="sample" data-skip-page-rerender="true" value="${e(s.sampleId)}" ${draft!.sampleIds.includes(s.sampleId) ? 'checked' : ''}>${sampleWorkflowImage(s)}</label>`,
      )
      .join('') ||
    '<p class="p-4 text-sm text-slate-500">没有符合条件的样衣，请检查责任站点或查询条件。维修、在途、未贴码及已占用样衣不能申请。</p>'
  }</div><div class="flex items-center gap-3 text-sm">${button('上一页', 'pick-prev', page === 1 ? 'disabled' : '')}<span>第 ${page}/${total} 页 · 共 ${rows.length} 条</span>${button('下一页', 'pick-next', page === total ? 'disabled' : '')}</div></div>`
}
function editorBody(): string {
  if (!draft) return '<p>申请不存在或已不能编辑。</p>'
  const locations = listPcsSampleLocations().filter((l) => l.enabled !== false),
    selected = draft.sampleIds
      .map((id) => listPcsSampleRecords().find((s) => s.sampleId === id))
      .filter((s): s is PcsSampleRecord => !!s)
  return `<div class="space-y-4 p-5" data-sample-request-editor><header class="flex items-center justify-between"><h1 class="text-xl font-semibold">${editorKey !== 'new' ? '编辑样衣使用申请' : '新建样衣使用申请'}</h1>${nav('返回申请列表', BASE)}${button('重新读取', 'reload-workflow')}</header><p role="alert" class="text-sm text-red-700">${e(error)}</p><p class="text-sm text-amber-700" data-sample-unsaved ${dirty ? '' : 'hidden'}>当前修改尚未保存</p><div class="flex gap-2 border-b pb-3">${button('申请信息', 'editor-info', tab === 'info' ? 'aria-current="page"' : '')}${button(`样衣清单（${draft.sampleIds.length}）`, 'editor-samples', tab === 'samples' ? 'aria-current="page"' : '')}</div>${
    tab === 'info'
      ? `<section class="rounded border bg-white p-5"><div class="grid gap-5 md:grid-cols-2">${select(
          '责任站点',
          'responsibleSite',
          draft.responsibleSite,
          [
            ['深圳样衣间', '深圳样衣间'],
            ['雅加达样衣间', '雅加达样衣间'],
          ],
        )}${field('申请人', 'applicant', draft.applicant)}${field('申请用途', 'purpose', draft.purpose)}${field('使用人 / 接收人', 'receiver', draft.receiver)}${select('使用位置', 'targetLocationId', draft.targetLocationId, [['', '请选择使用位置'], ...locations.map((l) => [l.locationId, l.locationName] as [string, string])])}${select('归还仓库', 'returnLocationId', draft.returnLocationId, [['', '请选择归还仓库'], ...locations.filter((l) => l.locationType === 'warehouse').map((l) => [l.locationId, l.locationName] as [string, string])])}${field('预计开始使用', 'useStartedAt', draft.useStartedAt, 'datetime-local')}${field('预计归还（到小时）', 'expectedReturnAt', draft.expectedReturnAt, 'datetime-local')}${field('备注', 'remark', draft.remark)}</div><p class="mt-4 text-xs text-slate-500">直播房间由 LOS 维护，此处选择启用房间。保存草稿不会占用样衣；提交申请后预占。</p></section><section class="space-y-3 rounded border bg-white p-5"><h2 class="font-semibold">已选样衣</h2>${selected.map(sampleWorkflowImage).join('') || '<p class="text-sm text-slate-500">请切换到样衣清单选择。</p>'}</section>`
      : `<section class="rounded border bg-white p-5"><div class="mb-4 flex gap-3">${field('查询 HG / SKU / 名称', 'pick-search', search)}${button('查询', 'pick-query')}</div><div data-sample-picker>${pickList()}</div></section>`
  }<footer class="sticky bottom-0 flex justify-end gap-3 rounded border bg-white p-4">${button('取消编辑', 'editor-cancel')}${button(busy ? '保存中…' : '保存草稿', 'save-draft', busy ? 'disabled' : '')}</footer></div>`
}
export function renderPcsSampleApplicationEditPage(id = ''): string {
  const key = id || 'new'
  if (editorKey !== key || !draft) {
    editorKey = key
    const r = id ? listPcsSampleRequests().find((r) => r.requestId === id) : null
    revision = r?.revision || 0
    dirty = false
    tab = 'info'
    search = ''
    page = 1
    error = ''
    if (id && (!r || r.status !== '草稿')) {
      draft = null
      return '<div class="p-5">申请不存在或已提交，不能编辑。</div>'
    }
    draft = {
      requestId: r?.requestId || crypto.randomUUID(),
      responsibleSite: r?.responsibleSite || '深圳样衣间',
      sampleIds: [...(r?.sampleIds || [])],
      purpose: r?.purpose || '',
      applicant: r?.applicant || '',
      targetLocationId: r?.targetLocationId || '',
      returnLocationId: r?.returnLocationId || '',
      receiver: r?.receiver || '',
      useStartedAt: (r?.useStartedAt || '').replace(' ', 'T'),
      expectedReturnAt: (r?.expectedReturnAt || '').replace(' ', 'T'),
      remark: r?.remark || '',
    }
  }
  return editorBody()
}
export function renderPcsSampleApplicationDetailPage(id: string): string {
  const r = listPcsSampleRequests().find((r) => r.requestId === id)
  if (!r) return '<div class="p-5">申请不存在。</div>'
  const samples = r.sampleIds
    .map((id) => listPcsSampleRecords().find((s) => s.sampleId === id))
    .filter((s): s is PcsSampleRecord => !!s)
  return `<div class="space-y-4 p-5" data-sample-request-detail><header class="flex flex-wrap justify-between gap-3"><div><h1 class="text-xl font-semibold">样衣使用申请详情</h1><p class="break-all text-sm">${e(r.requestCode)} · ${e(r.status)}</p></div>${nav('返回申请列表', BASE)}${button('重新读取', 'reload-workflow')}</header><p role="alert" class="text-sm text-red-700">${e(pending ? '' : actionError)}</p><section class="rounded border bg-white p-5"><dl class="grid gap-4 text-sm md:grid-cols-3">${[
    ['责任站点', r.responsibleSite],
    ['用途', r.purpose],
    ['申请人', r.applicant],
    ['使用人', r.receiver || r.applicant],
    ['使用位置', getPcsSampleLocationById(r.targetLocationId || '')?.locationName || '未维护'],
    ['归还仓库', getPcsSampleLocationById(r.returnLocationId || '')?.locationName || '未维护'],
    ['预计开始使用', r.useStartedAt || '—'],
    ['预计归还', r.expectedReturnAt],
    ['审批人 / 仓管', `${r.approver || '—'} / ${r.keeper || '—'}`],
  ]
    .map(([k, v]) => `<div><dt class="text-slate-500">${e(k)}</dt><dd class="mt-1">${e(v)}</dd></div>`)
    .join(
      '',
    )}</dl><div class="mt-4 flex flex-wrap gap-3">${requestControls(r)}</div></section><section class="space-y-3 rounded border bg-white p-5"><h2 class="font-semibold">样衣清单</h2>${samples.map(sampleWorkflowImage).join('')}</section><details class="rounded border bg-white p-5" open><summary>处理记录</summary>${r.timeline.map((t) => `<p class="mt-3 text-sm">${e(t.time)} · ${e(t.action)} · ${e(t.operator)} · ${e(t.remark || '')}</p>`).join('')}</details>${renderSampleWorkflowModal()}</div>`
}
export function renderSampleWorkflowModal(): string {
  if (!pending) return ''
  const options = listPcsSampleRecords().filter(
    (s) => ['在库可用', '维修中', '待处置'].includes(s.status) && s.occupancyType === '无',
  )
  const selected = options.find((s) => s.sampleId === caseSample)
  return `<div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="${e(pending.title)}" data-sample-workflow-modal><section class="max-h-[90vh] w-full max-w-xl space-y-4 overflow-auto rounded bg-white p-5"><header class="flex justify-between"><h2 class="font-semibold">${e(pending.title)}</h2>${button('关闭', 'close-modal')}</header><p role="alert" class="text-sm text-red-700">${e(actionError)}</p>${
    pending.kind === 'create-case'
      ? `${select('样衣', 'case-sample', caseSample, [['', '请选择'], ...options.map((s) => [s.sampleId, `${getPcsSampleLabelIdentity(s.skuCode)?.hgCode || 'HG待生成'} · ${s.skuCode} · ${s.name}`] as [string, string])])}<div data-case-preview>${selected ? sampleWorkflowImage(selected) : ''}</div>${select(
          '案件类型',
          'case-type',
          caseType,
          [
            ['退货', '退货'],
            ['处置', '处置'],
          ],
        )}${field('退货接收方（退货必填）', 'case-target', caseTarget)}`
      : ''
  }${field('实际操作人', 'actor', actor)}${field(pending.kind === 'create-case' ? '原因' : '处理原因 / 实际结果', 'note', note)}<p class="text-xs text-slate-500">${pending.action === 'pickup' ? '确认接收方已经实际领到样衣后再保存。' : pending.action === 'receive' ? '确认归还仓库已经实际验收到样衣后再保存。' : pending.kind === 'stocktake' ? '此处记录差异核查结论，不调整仓储库存。' : '保存后记录操作人、时间及结果。'}</p><footer class="flex justify-end gap-3">${button('取消', 'close-modal')}${button(busy ? '保存中…' : '确认并保存', 'save-modal', busy ? 'disabled' : '')}</footer></section></div>`
}
export function sampleWorkflowDialogOpen(): boolean {
  return !!pending
}
export async function closeSampleWorkflowDialog(): Promise<boolean> {
  if (busy) return false
  if ((actor || note || caseSample) && !(await confirmPcsAction('当前输入尚未保存，是否放弃？'))) return false
  pending = null
  return true
}
function navigate(path: string): void {
  const a = document.createElement('a')
  a.dataset.nav = path
  a.href = path
  ;(document.querySelector('main') || document.body).append(a)
  a.click()
  a.remove()
}
function updateEditor(): void {
  const root = document.querySelector('[data-sample-request-editor]')
  if (root) root.outerHTML = editorBody()
}
export function handleSampleWorkflowInput(target: Element): boolean {
  const el = target.closest<HTMLInputElement>('[data-sample-workflow-field]')
  if (!el) return false
  const key = el.dataset.sampleWorkflowField!,
    value = el.value
  if (key === 'actor') actor = value
  else if (key === 'note') note = value
  else if (key === 'case-target') caseTarget = value
  else if (key === 'case-type') caseType = value
  else if (key === 'case-sample') {
    caseSample = value
    const s = listPcsSampleRecords().find((s) => s.sampleId === value)
    const preview = document.querySelector('[data-case-preview]')
    if (preview) preview.innerHTML = s ? sampleWorkflowImage(s) : ''
  } else if (key === 'pick-search') search = value
  else if (draft) {
    dirty = true
    if (key === 'sample') {
      draft.sampleIds = el.checked
        ? [...new Set([...draft.sampleIds, value])]
        : draft.sampleIds.filter((id) => id !== value)
      const picked = document.querySelector('[data-sample-picker]')
      if (picked) picked.innerHTML = pickList()
      const tabButton = document.querySelector('[data-sample-workflow-action=editor-samples]')
      if (tabButton) tabButton.textContent = `样衣清单（${draft.sampleIds.length}）`
    } else {
      Object.assign(draft, { [key]: value })
      if (key === 'responsibleSite') {
        draft.sampleIds = []
        updateEditor()
      }
    }
    const warning = document.querySelector<HTMLElement>('[data-sample-unsaved]')
    if (warning) warning.hidden = false
  }
  return true
}
export async function handleSampleWorkflowAction(target: HTMLElement): Promise<boolean | null> {
  const el = target.closest<HTMLElement>('[data-sample-workflow-action]')
  if (!el) return null
  if (busy) return false
  const action = el.dataset.sampleWorkflowAction!
  if (action === 'reload-workflow') {
    if (dirty && !(await confirmPcsAction('重新读取将放弃未保存修改，是否确认？'))) return false
    try {
      await retryPcsRecordState()
      await ensureLosLiveRoomState()
      dirty = false
      draft = null
      editorKey = ''
      error = ''
      actionError = ''
      return true
    } catch (err) {
      error = `重新读取失败：${(err as Error).message}`
      actionError = error
      const editor = document.querySelector('[data-sample-request-editor]')
      if (!editor) return true
      // Keep the existing form and selected images: failed reads invalidate the data cache.
      const alert = editor.querySelector('[role=alert]')
      if (alert) alert.textContent = `${error}。当前输入已保留，请重新读取后继续。`
      editor
        .querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>(
          'button, select, input[type=checkbox]',
        )
        .forEach((control) => {
          if (!['reload-workflow', 'editor-cancel'].includes(control.dataset.sampleWorkflowAction || ''))
            control.disabled = true
        })
      return false
    }
  }
  if (action === 'close-modal') return closeSampleWorkflowDialog()
  if (['request-action', 'case-action', 'stocktake-action', 'create-case'].includes(action)) {
    const kind =
      action === 'request-action'
        ? 'request'
        : action === 'case-action'
          ? 'case'
          : action === 'stocktake-action'
            ? 'stocktake'
            : 'create-case'
    pending = {
      kind,
      id: el.dataset.id || crypto.randomUUID(),
      action: el.dataset.command || '',
      title: el.dataset.label || '新建退货与处理案件',
      revision: listPcsSampleRequests().find((r) => r.requestId === el.dataset.id)?.revision || 0,
      operationId: crypto.randomUUID(),
      pathname: window.location.pathname,
    }
    actor = ''
    note = ''
    caseSample = ''
    caseTarget = ''
    caseType = '退货'
    actionError = ''
    return true
  }
  if (action.startsWith('editor-')) {
    if (action === 'editor-cancel') {
      if (dirty && !(await confirmPcsAction('当前申请尚未保存，是否放弃？'))) return false
      draft = null
      editorKey = ''
      dirty = false
      navigate(BASE)
      return false
    }
    tab = action === 'editor-info' ? 'info' : 'samples'
    updateEditor()
    return false
  }
  if (['pick-query', 'pick-prev', 'pick-next'].includes(action)) {
    if (action === 'pick-prev') page--
    else if (action === 'pick-next') page++
    else page = 1
    const root = document.querySelector('[data-sample-picker]')
    if (root) root.innerHTML = pickList()
    return false
  }
  if (action === 'save-draft' && draft) {
    busy = true
    error = ''
    try {
      await ensureLosLiveRoomState()
      const guards = [
        ...liveRoomTransferGuards(draft.targetLocationId),
        ...liveRoomTransferGuards(draft.returnLocationId),
      ]
      const r = await runPcsRecordCommand(
        () => savePcsSampleRequestDraft(draft!, revision),
        draft.requestId + '-save-' + revision,
        [PCS_SAMPLE_STORAGE_KEY],
        guards,
      )
      dirty = false
      draft = null
      editorKey = ''
      pending = null
      navigate(`${BASE}/${r.requestId}`)
    } catch (err) {
      error = `未保存：${(err as Error).message}`
      updateEditor()
    } finally {
      busy = false
      if (error) updateEditor()
    }
    return false
  }
  if (action === 'save-modal' && pending) {
    busy = true
    actionError = ''
    const command = pending
    try {
      if (
        ['cancel', 'reject', 'execute', 'close'].includes(command.action) &&
        !(await confirmPcsAction(
          `${command.title}后将记录处理结果${command.action === 'execute' ? '并结束该样衣的可用状态' : ''}，是否确认？`,
        ))
      )
        return false
      await ensureLosLiveRoomState()
      const request =
        command.kind === 'request' ? listPcsSampleRequests().find((r) => r.requestId === command.id) : null
      const guards =
        request && ['submit', 'approve', 'pickup', 'receive'].includes(command.action)
          ? [
              ...liveRoomTransferGuards(
                command.action === 'receive' ? request.returnLocationId || '' : request.targetLocationId || '',
              ),
              ...(command.action === 'submit' ? liveRoomTransferGuards(request.returnLocationId || '') : []),
            ]
          : []
      await runPcsRecordCommand(
        () =>
          command.kind === 'request'
            ? actPcsSampleRequest(command.id, command.action as PcsSampleRequestAction, actor, note, command.revision)
            : command.kind === 'create-case'
              ? createPcsSampleReturnCase({
                  caseId: command.id,
                  sampleId: caseSample,
                  caseType: caseType as '退货' | '处置',
                  reason: note,
                  target: caseTarget,
                  actor,
                })
              : command.kind === 'case'
                ? actPcsSampleReturnCase(command.id, command.action as 'approve' | 'reject' | 'execute', actor, note)
                : resolvePcsSampleStocktake(command.id, command.action as 'investigate' | 'close', actor, note),
        command.operationId,
        [PCS_SAMPLE_STORAGE_KEY],
        guards,
      )
      pending = null
    } catch (err) {
      actionError = `未保存：${(err as Error).message}`
    } finally {
      busy = false
    }
    return true
  }
  return false
}
// Keep unsaved input page-local. Never persist drafts during reads or navigation.
document.addEventListener(
  'click',
  (event) => {
    if (
      !(document.querySelector('[data-sample-request-editor]') && dirty) &&
      !(pending && (actor || note || caseSample))
    )
      return
    const el = (event.target as Element)?.closest(
      '[data-nav], [data-action="close-tab"], [data-action="close-all-tabs"]',
    )
    if (!el) return
    if (!confirm('当前申请尚未保存，是否放弃并离开？')) {
      event.preventDefault()
      event.stopImmediatePropagation()
    } else {
      dirty = false
      draft = null
      editorKey = ''
      pending = null
    }
  },
  true,
)
window.addEventListener('beforeunload', (event) => {
  if ((dirty && document.querySelector('[data-sample-request-editor]')) || (pending && (actor || note || caseSample))) {
    event.preventDefault()
    event.returnValue = ''
  }
})
window.addEventListener('higood:before-history-navigation', (event) => {
  if ((dirty && document.querySelector('[data-sample-request-editor]')) || (pending && (actor || note || caseSample))) {
    if (!confirm('当前申请尚未保存，是否放弃并离开？')) {
      event.preventDefault()
      history.pushState(
        null,
        '',
        pending?.pathname || (editorKey === 'new' ? `${BASE}/new` : `${BASE}/${encodeURIComponent(editorKey)}/edit`),
      )
    } else {
      dirty = false
      draft = null
      editorKey = ''
      pending = null
    }
  }
})
