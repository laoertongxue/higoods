// @page-pattern: list
// 独立改款／设计打样任务：不属于工程主单，只承接做大货前的独立样衣开发。

import type { RevisionTaskRecord } from '../../data/pcs-revision-task-types.ts'
import type { renderStandardListPage } from '../../components/ui/list-page.ts'
import type { renderStandardListTable } from '../../components/ui/list-table.ts'
import type { renderTablePagination } from '../../components/ui/pagination.ts'
import { getRevisionTaskById, listRevisionTasks, updateRevisionTask } from '../../data/pcs-revision-task-repository.ts'
import { listStyleArchives } from '../../data/pcs-style-archive-repository.ts'
import { saveRevisionTaskDraft } from '../../data/pcs-task-project-relation-writeback.ts'
import { escapeHtml, formatDateTime } from '../../utils.ts'
import {
  ENGINEERING_COMMON_FILTER_STATUS_OPTIONS,
  type EngineeringListRow,
  createEngineeringListColumns,
  normalizeEngineeringVisibleStatus,
  renderDialog,
  renderEmptyDetail,
  renderEngineeringStandardListPage,
  renderHeaderMeta,
  renderKeyValueGrid,
  renderListFilters,
  renderMetricButton,
  renderSectionCard,
  renderStatusBadge,
  registerEngineeringListModule,
  setNotice,
  splitLines,
  state,
} from './shared.ts'

const LIST_PATH = '/pcs/patterns/revision'
type RevisionKind = '改款' | '设计打样'
// 列表实际由 shared.ts 的工程列表骨架统一组合三个标准组件；保留类型契约，避免页面绕过该骨架。
type StandardListContract = [typeof renderStandardListPage, typeof renderStandardListTable, typeof renderTablePagination]
const standardListContract: StandardListContract | null = null
void standardListContract

interface RevisionEditorState {
  open: boolean
  mode: 'create' | 'edit'
  taskId: string
  kind: RevisionKind
  baseStyleId: string
  targetStyleId: string
  title: string
  ownerName: string
  dueAt: string
  scopeText: string
  issueSummary: string
  note: string
}

const EMPTY_EDITOR: RevisionEditorState = {
  open: false,
  mode: 'create',
  taskId: '',
  kind: '改款',
  baseStyleId: '',
  targetStyleId: '',
  title: '',
  ownerName: '',
  dueAt: '',
  scopeText: '',
  issueSummary: '',
  note: '',
}

let editor: RevisionEditorState = { ...EMPTY_EDITOR }

function taskKind(task: RevisionTaskRecord): RevisionKind {
  return task.sourceType === '人工改版需求' ? '设计打样' : '改款'
}

function filteredTasks(): RevisionTaskRecord[] {
  const keyword = state.revisionList.search.trim().toLowerCase()
  return listRevisionTasks().filter((task) => {
    const text = [task.revisionTaskCode, task.title, task.styleCode, task.styleName, task.baseStyleCode, task.targetStyleCodeCandidate, task.ownerName]
      .filter(Boolean).join(' ').toLowerCase()
    const visibleStatus = normalizeEngineeringVisibleStatus(task.status)
    if (keyword && !text.includes(keyword)) return false
    if (state.revisionList.status !== 'all' && visibleStatus !== state.revisionList.status) return false
    if (state.revisionList.owner !== 'all' && task.ownerName !== state.revisionList.owner) return false
    if (state.revisionList.source !== 'all' && taskKind(task) !== state.revisionList.source) return false
    if (state.revisionList.quickFilter === 'remodel' && taskKind(task) !== '改款') return false
    if (state.revisionList.quickFilter === 'design' && taskKind(task) !== '设计打样') return false
    return true
  })
}

const COLUMNS = createEngineeringListColumns([
  { key: 'task', title: '任务', width: 240, required: true, freezeable: true, sortable: true },
  { key: 'kind', title: '任务类型', width: 110, required: true, sortable: true },
  { key: 'baseStyle', title: '基于款式', width: 170, sortable: true },
  { key: 'targetStyle', title: '目标款式', width: 190, required: true, sortable: true },
  { key: 'scope', title: '修改范围', width: 190, sortable: true },
  { key: 'status', title: '状态', width: 120, required: true, sortable: true },
  { key: 'owner', title: '负责人', width: 110, sortable: true },
  { key: 'updated', title: '更新时间', width: 170, sortable: true },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true },
])

function rows(): EngineeringListRow[] {
  return filteredTasks().map((task) => {
    const kind = taskKind(task)
    const target = task.targetStyleCodeCandidate || task.styleCode
    return {
      cells: {
        task: `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="${LIST_PATH}/${escapeHtml(task.revisionTaskId)}">${escapeHtml(task.title)}</button><p class="text-xs text-slate-500">${escapeHtml(task.revisionTaskCode)}</p>`,
        kind: escapeHtml(kind),
        baseStyle: escapeHtml(kind === '改款' ? (task.baseStyleCode || '-') : '-'),
        targetStyle: escapeHtml(target || '-'),
        scope: escapeHtml(task.revisionScopeNames.join('、') || '-'),
        status: renderStatusBadge(normalizeEngineeringVisibleStatus(task.status)),
        owner: escapeHtml(task.ownerName || '-'),
        updated: escapeHtml(formatDateTime(task.updatedAt)),
        actions: `<div class="flex items-center gap-2"><button type="button" class="text-xs text-blue-700 hover:underline" data-nav="${LIST_PATH}/${escapeHtml(task.revisionTaskId)}">查看</button><button type="button" class="text-xs text-slate-700 hover:underline" data-pcs-engineering-action="open-revision-editor" data-task-id="${escapeHtml(task.revisionTaskId)}">编辑</button></div>`,
      },
      sortValues: {
        task: task.title, kind, baseStyle: task.baseStyleCode, targetStyle: target,
        scope: task.revisionScopeNames.join('、'), status: normalizeEngineeringVisibleStatus(task.status),
        owner: task.ownerName, updated: task.updatedAt,
      },
    }
  })
}

function stats(): string {
  const tasks = listRevisionTasks()
  return `<section class="flex flex-wrap gap-3">
    ${renderMetricButton('全部任务', tasks.length, state.revisionList.quickFilter === 'all', 'all', 'set-revision-quick-filter')}
    ${renderMetricButton('改款', tasks.filter((task) => taskKind(task) === '改款').length, state.revisionList.quickFilter === 'remodel', 'remodel', 'set-revision-quick-filter')}
    ${renderMetricButton('设计打样', tasks.filter((task) => taskKind(task) === '设计打样').length, state.revisionList.quickFilter === 'design', 'design', 'set-revision-quick-filter')}
  </section>`
}

function renderStyleOptions(selectedId: string, emptyLabel: string): string {
  return `<option value="">${escapeHtml(emptyLabel)}</option>${listStyleArchives().map((style) => `<option value="${escapeHtml(style.styleId)}" ${style.styleId === selectedId ? 'selected' : ''}>${escapeHtml(`${style.styleCode} · ${style.styleName}`)}</option>`).join('')}`
}

function renderEditor(): string {
  return renderDialog(editor.open, editor.mode === 'create' ? '新建独立任务' : '编辑独立任务', `
    <div class="grid gap-4 md:grid-cols-2">
      <label class="space-y-2 text-sm"><span class="text-slate-600">任务类型</span><select class="h-10 w-full rounded-md border px-3" data-pcs-engineering-field="revision-editor-kind"><option value="改款" ${editor.kind === '改款' ? 'selected' : ''}>改款</option><option value="设计打样" ${editor.kind === '设计打样' ? 'selected' : ''}>设计打样</option></select></label>
      <label class="space-y-2 text-sm"><span class="text-slate-600">任务名称</span><input class="h-10 w-full rounded-md border px-3" value="${escapeHtml(editor.title)}" data-pcs-engineering-field="revision-editor-title" /></label>
      <label class="space-y-2 text-sm"><span class="text-slate-600">基于款式（改款必填）</span><select class="h-10 w-full rounded-md border px-3" data-pcs-engineering-field="revision-editor-base-style">${renderStyleOptions(editor.baseStyleId, '请选择基于款式')}</select></label>
      <label class="space-y-2 text-sm"><span class="text-slate-600">目标款式</span><select class="h-10 w-full rounded-md border px-3" data-pcs-engineering-field="revision-editor-target-style">${renderStyleOptions(editor.targetStyleId, '请选择目标款式')}</select></label>
      <label class="space-y-2 text-sm"><span class="text-slate-600">负责人</span><input class="h-10 w-full rounded-md border px-3" value="${escapeHtml(editor.ownerName)}" data-pcs-engineering-field="revision-editor-owner" /></label>
      <label class="space-y-2 text-sm"><span class="text-slate-600">计划完成时间</span><input type="datetime-local" class="h-10 w-full rounded-md border px-3" value="${escapeHtml(editor.dueAt)}" data-pcs-engineering-field="revision-editor-due-at" /></label>
      <label class="space-y-2 text-sm md:col-span-2"><span class="text-slate-600">修改范围</span><input class="h-10 w-full rounded-md border px-3" value="${escapeHtml(editor.scopeText)}" placeholder="用逗号分隔" data-pcs-engineering-field="revision-editor-scope" /></label>
      <label class="space-y-2 text-sm md:col-span-2"><span class="text-slate-600">任务要求</span><textarea class="min-h-24 w-full rounded-md border p-3" data-pcs-engineering-field="revision-editor-issue">${escapeHtml(editor.issueSummary)}</textarea></label>
      <label class="space-y-2 text-sm md:col-span-2"><span class="text-slate-600">备注</span><textarea class="min-h-20 w-full rounded-md border p-3" data-pcs-engineering-field="revision-editor-note">${escapeHtml(editor.note)}</textarea></label>
    </div>
  `, 'close-revision-editor', 'save-revision-editor', editor.mode === 'create' ? '创建任务' : '保存')
}

function renderMaterialPlan(task: RevisionTaskRecord): string {
  if (task.materialAdjustmentLines.length === 0) return '<p class="text-sm text-slate-500">暂无物料</p>'
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left text-xs text-slate-500">
          <tr><th class="px-3 py-2 font-medium">物料</th><th class="px-3 py-2 font-medium">物料编码</th><th class="px-3 py-2 font-medium">单位用量</th><th class="px-3 py-2 font-medium">工艺要求</th><th class="px-3 py-2 font-medium">备注</th></tr>
        </thead>
        <tbody>
          ${task.materialAdjustmentLines.map((line) => `<tr class="border-t"><td class="px-3 py-2 text-slate-900">${escapeHtml(line.materialName || '-')}</td><td class="px-3 py-2 text-slate-600">${escapeHtml(line.materialSku || '-')}</td><td class="px-3 py-2 text-slate-600">${escapeHtml(String(line.quantity || '-'))}</td><td class="px-3 py-2 text-slate-600">${escapeHtml(line.printRequirement || '-')}</td><td class="px-3 py-2 text-slate-600">${escapeHtml(line.note || '-')}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderRelatedWork(task: RevisionTaskRecord): string {
  const lines = [task.patternChangeNote, task.newPatternSpuCode ? `花型成果：${task.newPatternSpuCode}` : '']
    .filter(Boolean)
    .flatMap(splitLines)
  return lines.length > 0
    ? `<ul class="space-y-2 text-sm text-slate-700">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
    : '<p class="text-sm text-slate-500">暂无关联任务</p>'
}

registerEngineeringListModule('revision', {
  getColumns: () => COLUMNS,
  getRows: () => rows(),
  getState: () => state.revisionList,
  getEmptyText: () => '暂无独立改款／设计打样任务',
  getStatsHtml: () => stats(),
})

export function renderPcsRevisionTaskPage(): string {
  const tasks = listRevisionTasks()
  return renderEngineeringStandardListPage({
    module: 'revision', title: '改款与设计打样任务', createLabel: '新建任务', createAction: 'open-revision-editor',
    filtersHtml: renderListFilters({
      searchPlaceholder: '搜索任务编号 / 款式 / 负责人', listState: state.revisionList,
      searchField: 'revision-search', statusField: 'revision-status', ownerField: 'revision-owner', sourceField: 'revision-source',
      statusOptions: ENGINEERING_COMMON_FILTER_STATUS_OPTIONS,
      ownerOptions: Array.from(new Set(tasks.map((task) => task.ownerName).filter(Boolean))), sourceOptions: ['改款', '设计打样'],
    }),
    statsHtml: stats(), rows: rows(), columns: COLUMNS, listState: state.revisionList,
    emptyText: '暂无独立改款／设计打样任务', overlaysHtml: renderEditor(),
  })
}

export function renderPcsRevisionTaskDetailPage(taskId: string): string {
  const task = getRevisionTaskById(taskId)
  if (!task) return renderEmptyDetail('改款与设计打样任务', LIST_PATH)
  const kind = taskKind(task)
  return `<div class="space-y-5 p-4">
    ${renderHeaderMeta(`${task.title} · ${task.revisionTaskCode}`, kind, renderStatusBadge(normalizeEngineeringVisibleStatus(task.status)), `<div class="flex gap-2"><button type="button" class="inline-flex h-10 items-center rounded-md border px-4 text-sm" data-nav="${LIST_PATH}">返回列表</button><button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm text-white" data-pcs-engineering-action="open-revision-editor" data-task-id="${escapeHtml(task.revisionTaskId)}">编辑任务</button></div>`)}
    ${renderSectionCard('任务信息', renderKeyValueGrid([
      { label: '任务类型', value: escapeHtml(kind) },
      { label: '基于款式', value: escapeHtml(kind === '改款' ? (task.baseStyleCode || '-') : '-') },
      { label: '目标款式', value: escapeHtml(task.targetStyleCodeCandidate || task.styleCode || '-') },
      { label: '负责人', value: escapeHtml(task.ownerName || '-') },
      { label: '计划完成时间', value: escapeHtml(task.dueAt ? formatDateTime(task.dueAt) : '-') },
      { label: '修改范围', value: escapeHtml(task.revisionScopeNames.join('、') || '-') },
    ], 3))}
    ${renderSectionCard('任务要求', `<p class="whitespace-pre-wrap text-sm text-slate-700">${escapeHtml(task.issueSummary || '-')}</p>`)}
    ${renderSectionCard('样衣物料', renderMaterialPlan(task))}
    ${renderSectionCard('关联任务', renderRelatedWork(task))}
    ${renderEditor()}
  </div>`
}

export function handleRevisionTaskInput(target: Element): boolean {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return false
  const field = target.dataset.pcsEngineeringField
  const fields: Record<string, keyof RevisionEditorState> = {
    'revision-editor-kind': 'kind', 'revision-editor-title': 'title', 'revision-editor-base-style': 'baseStyleId',
    'revision-editor-target-style': 'targetStyleId', 'revision-editor-owner': 'ownerName', 'revision-editor-due-at': 'dueAt',
    'revision-editor-scope': 'scopeText', 'revision-editor-issue': 'issueSummary', 'revision-editor-note': 'note',
  }
  const key = field ? fields[field] : undefined
  if (!key) return false
  ;(editor[key] as string) = target.value
  return true
}

function openEditor(taskId = ''): void {
  const task = taskId ? getRevisionTaskById(taskId) : null
  editor = task ? {
    open: true, mode: 'edit', taskId: task.revisionTaskId, kind: taskKind(task), baseStyleId: task.baseStyleId,
    targetStyleId: task.styleId, title: task.title, ownerName: task.ownerName, dueAt: task.dueAt,
    scopeText: task.revisionScopeNames.join('、'), issueSummary: task.issueSummary, note: task.note,
  } : { ...EMPTY_EDITOR, open: true }
}

function saveEditor(): void {
  const targetStyle = listStyleArchives().find((style) => style.styleId === editor.targetStyleId)
  const baseStyle = listStyleArchives().find((style) => style.styleId === editor.baseStyleId)
  if (!editor.title.trim()) throw new Error('请填写任务名称。')
  if (!targetStyle) throw new Error('请选择目标款式。')
  if (editor.kind === '改款' && !baseStyle) throw new Error('改款任务必须选择基于款式。')
  if (editor.kind === '改款' && baseStyle?.styleId === targetStyle.styleId) throw new Error('基于款式与目标款式不能是同一个 SPU。')
  const scope = splitLines(editor.scopeText)
  const patch = {
    title: editor.title.trim(), ownerName: editor.ownerName.trim(), dueAt: editor.dueAt,
    revisionScopeCodes: scope, revisionScopeNames: scope, issueSummary: editor.issueSummary.trim(), note: editor.note.trim(),
    baseStyleId: baseStyle?.styleId || '', baseStyleCode: baseStyle?.styleCode || '', baseStyleName: baseStyle?.styleName || '',
    styleId: targetStyle.styleId, styleCode: targetStyle.styleCode, styleName: targetStyle.styleName,
    targetStyleCodeCandidate: targetStyle.styleCode, targetStyleNameCandidate: targetStyle.styleName,
    sourceType: editor.kind === '改款' ? '既有商品改款' as const : '人工改版需求' as const,
    updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19), updatedBy: '当前用户',
  }
  if (editor.mode === 'edit') updateRevisionTask(editor.taskId, patch)
  else saveRevisionTaskDraft({ projectId: targetStyle.sourceProjectId, operatorName: '当前用户', ...patch })
  editor = { ...EMPTY_EDITOR }
  setNotice(editor.mode === 'edit' ? '任务已保存。' : '任务已创建。')
}

export function handleRevisionTaskEvent(target: HTMLElement): boolean {
  const action = target.dataset.pcsEngineeringAction
  if (action === 'open-revision-editor') { openEditor(target.dataset.taskId || ''); return true }
  if (action === 'close-revision-editor') { editor = { ...EMPTY_EDITOR }; return true }
  if (action === 'save-revision-editor') {
    try { const wasEdit = editor.mode === 'edit'; saveEditor(); setNotice(wasEdit ? '任务已保存。' : '任务已创建。') }
    catch (error) { setNotice(error instanceof Error ? error.message : '保存失败。') }
    return true
  }
  return false
}

export function resetRevisionTaskPageState(): void { editor = { ...EMPTY_EDITOR } }
export function isRevisionTaskDialogOpen(): boolean { return editor.open }
