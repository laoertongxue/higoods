// @page-pattern: list
import { renderStandardListPage } from '../components/ui/list-page.ts'
import { type StandardListColumn } from '../components/ui/list-table.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import { CURRENT_PCS_ENGINEERING_USER } from '../data/pcs-engineering-current-user.ts'
import {
  confirmEngineeringIndependentSamplingPlan,
  confirmEngineeringIndependentSamplingResult,
  confirmEngineeringIndependentColorRequirement,
  createEngineeringIndependentSampling,
  getEngineeringIndependentSamplingRecord,
  listEngineeringIndependentSamplingRecords,
  reviewEngineeringIndependentProfessionalTask,
  resolveEngineeringIndependentSamplingBomLines,
  startEngineeringIndependentProfessionalTask,
  submitEngineeringIndependentProfessionalTask,
  updateEngineeringIndependentSamplingBomLine,
} from '../data/pcs-engineering-master-sampling.ts'
import type {
  EngineeringIndependentProfessionalTask,
  EngineeringIndependentProfessionalTaskType,
  EngineeringIndependentSamplingRecord,
  EngineeringIndependentSamplingType,
} from '../data/pcs-engineering-master-types.ts'
import { getStyleArchiveById, listStyleArchives } from '../data/pcs-style-archive-repository.ts'
import { escapeHtml } from '../utils.ts'

// 标准列表契约的 renderStandardListTable、renderTablePagination 由共享控制器统一调用。

const PREFIX = 'pcs-independent-sampling'
const BUYER = { role: '买手' as const, userId: 'U-BUYER-WANGMING', userName: '买手-王明' }
const EXECUTORS = {
  BASE_PATTERN: { role: '版师', userId: 'U-PATTERN-ZHAO', userName: '版师-赵云' },
  DISPLAY_SAMPLE: { role: '制作团队', userId: 'U-SAMPLE-ALAN', userName: '样衣制作-阿兰' },
  PATTERN_ARTWORK: { role: '花型团队', userId: 'U-ARTWORK-BING', userName: '花型-冰冰' },
  COLOR_YARN: { role: '染厂', userId: 'U-DYE-CHEN', userName: '染厂-陈师傅' },
  COLOR_FABRIC: { role: '染厂', userId: 'U-DYE-CHEN', userName: '染厂-陈师傅' },
} as const
const TYPE_TEXT: Record<EngineeringIndependentSamplingType, string> = { REVISION: '改款打样', DESIGN: '设计打样' }
const STATUS_TEXT: Record<EngineeringIndependentSamplingRecord['status'], string> = { DRAFT: '草稿', IN_PROGRESS: '进行中', WAIT_CONFIRMATION: '待整单确认', COMPLETED: '已完成' }
const TASK_STATUS_TEXT: Record<EngineeringIndependentProfessionalTask['status'], string> = { WAIT_DEPENDENCY: '待前置', WAIT_START: '待开始', IN_PROGRESS: '进行中', WAIT_REVIEW: '待买手审核', REWORK: '待返工', COMPLETED: '已完成' }
const TASK_OPTIONS: Array<{ value: EngineeringIndependentProfessionalTaskType; label: string }> = [
  { value: 'BASE_PATTERN', label: '基码纸样' },
  { value: 'DISPLAY_SAMPLE', label: '版衣／销售展示样衣' },
  { value: 'PATTERN_ARTWORK', label: '花型任务' },
  { value: 'COLOR_YARN', label: '调色任务（纱线）' },
  { value: 'COLOR_FABRIC', label: '调色任务（面料）' },
]

const ui = { createType: '' as EngineeringIndependentSamplingType | '', previewUrl: '', previewAlt: '', feedback: '', ok: true }

function listControllerState(): ProcessOrderListControllerState {
  return { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false }
}

const listStates: Record<EngineeringIndependentSamplingType, ProcessOrderListControllerState> = {
  REVISION: listControllerState(),
  DESIGN: listControllerState(),
}

function imageButton(url: string, alt: string, body = ''): string {
  return `<button type="button" class="flex items-center gap-2 text-left" data-${PREFIX}-action="open-image" data-skip-page-rerender="true" data-image-url="${escapeHtml(url)}" data-image-alt="${escapeHtml(alt)}"><span class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-600">图片加载失败</span></span><span>${body}</span></button>`
}

function renderPreview(): string {
  if (!ui.previewUrl) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" data-${PREFIX}-action="close-image"><section class="relative max-h-full max-w-5xl rounded-lg bg-background p-3" role="dialog" aria-modal="true" aria-label="图片大图"><button class="absolute right-3 top-3 z-10 rounded bg-background px-3 py-1 text-sm" data-${PREFIX}-action="close-image">关闭</button><img src="${escapeHtml(ui.previewUrl)}" alt="${escapeHtml(ui.previewAlt)}" class="max-h-[82vh] max-w-[88vw] object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="p-12 text-sm text-red-600">图片加载失败，请检查原图地址。</p></section></div>`
}

function renderIndependentBomEditor(record: EngineeringIndependentSamplingRecord): string {
  const lines = resolveEngineeringIndependentSamplingBomLines(record)
  return `<section class="rounded-lg border bg-card p-4"><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="font-semibold">BOM 与价格</h2><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.bomDraftVersionId)} · 仅买手维护，跟单和专业团队只读</p></div><a class="text-sm text-blue-700 hover:underline" href="/pcs/technical-data/bom-pricing">查看全部 BOM 版本</a></div><div class="mt-3 overflow-x-auto"><table class="w-full min-w-[980px] text-sm"><thead><tr class="border-b bg-muted/50 text-left"><th class="p-3">物料</th><th class="p-3">单位用量</th><th class="p-3">打样数量</th><th class="p-3">损耗率</th><th class="p-3">本次总需求量</th><th class="p-3">标准单价（CNY）</th><th class="p-3">物料成本（CNY）</th><th class="p-3">操作</th></tr></thead><tbody>${lines.map((line) => `<tr class="border-b"><td class="p-3">${imageButton(line.materialImageUrl || '', line.materialName, `<span><strong>${escapeHtml(line.materialName)}</strong><small class="block text-muted-foreground">${escapeHtml(line.materialSkuCode)} · ${escapeHtml(line.specification || '-')}</small></span>`)}</td><td class="p-3"><div class="flex items-center gap-2"><input type="number" min="0.0001" step="0.0001" class="h-9 w-24 rounded border px-2" value="${line.usage}" data-bom-field="usage" data-bom-item-id="${escapeHtml(line.bomItemId || '')}" ${record.status === 'COMPLETED' ? 'disabled' : ''}><span>${escapeHtml(line.usageUnit)}</span></div></td><td class="p-3"><input type="number" min="1" step="1" class="h-9 w-20 rounded border px-2" value="${line.sampleQuantity}" data-bom-field="sampleQuantity" data-bom-item-id="${escapeHtml(line.bomItemId || '')}" ${record.status === 'COMPLETED' ? 'disabled' : ''}></td><td class="p-3"><div class="flex items-center gap-1"><input type="number" min="0" max="99.99" step="0.01" class="h-9 w-20 rounded border px-2" value="${line.lossRate * 100}" data-bom-field="lossRatePercent" data-bom-item-id="${escapeHtml(line.bomItemId || '')}" ${record.status === 'COMPLETED' ? 'disabled' : ''}><span>%</span></div></td><td class="p-3 font-medium">${line.totalRequirementQuantity.toFixed(4)} ${escapeHtml(line.pricingUnit)}</td><td class="p-3">¥ ${line.standardUnitPriceCny?.toFixed(4) || '-'}</td><td class="p-3">¥ ${line.materialCostCny?.toFixed(2) || '-'}</td><td class="p-3">${record.status === 'COMPLETED' ? '<span class="text-muted-foreground">已锁定</span>' : `<button class="rounded border px-3 py-1.5 text-blue-700" data-${PREFIX}-action="save-bom-line" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-bom-item-id="${escapeHtml(line.bomItemId || '')}">买手保存</button>`}</td></tr>`).join('')}</tbody></table></div></section>`
}

function activeSamplingRecordFromPath(): EngineeringIndependentSamplingRecord | null {
  if (typeof location === 'undefined') return null
  const match = location.pathname.match(/^\/pcs\/engineering\/(?:revision|design)-sampling\/([^/]+)$/)
  return match ? getEngineeringIndependentSamplingRecord(decodeURIComponent(match[1])) : null
}

function renderDialogHost(): string {
  const record = activeSamplingRecordFromPath()
  return `<div data-independent-sampling-dialogs data-skip-page-rerender="true">${record ? renderIndependentBomEditor(record) : ''}${ui.createType ? renderCreateDialog(ui.createType) : ''}${renderPreview()}</div>`
}

function refreshDialogs(): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll<HTMLElement>('[data-independent-sampling-dialogs]').forEach((host) => {
    const record = activeSamplingRecordFromPath()
    host.innerHTML = `${record ? renderIndependentBomEditor(record) : ''}${ui.createType ? renderCreateDialog(ui.createType) : ''}${renderPreview()}`
  })
}

function styleOptions(selected = ''): string {
  return listStyleArchives().filter((style) => style.mainImageUrl).map((style) => `<option value="${escapeHtml(style.styleId)}" ${style.styleId === selected ? 'selected' : ''}>${escapeHtml(style.styleCode)} · ${escapeHtml(style.styleName)}</option>`).join('')
}

function renderCreateDialog(type: EngineeringIndependentSamplingType): string {
  if (ui.createType !== type) return ''
  const isRevision = type === 'REVISION'
  return `<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" data-${PREFIX}-action="close-create"><section class="w-full max-w-2xl rounded-lg bg-background p-5 shadow-xl" role="dialog" aria-modal="true"><div class="mb-4 flex items-center justify-between"><h2 class="text-lg font-semibold">新建${TYPE_TEXT[type]}任务</h2><button data-${PREFIX}-action="close-create">关闭</button></div><div class="grid gap-4 md:grid-cols-2">${isRevision ? `<label class="space-y-1 text-sm"><span>基于款式（SPU）</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="sourceStyleId"><option value="">请选择</option>${styleOptions()}</select></label>` : ''}<label class="space-y-1 text-sm"><span>做成款式（SPU）</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="targetStyleId"><option value="">请选择</option>${styleOptions()}</select></label><label class="space-y-1 text-sm"><span>BOM 与价格草稿</span><input class="h-10 w-full rounded border px-3" data-${PREFIX}-field="bomDraftVersionId" value="BOM-DRAFT-V1"></label><label class="space-y-1 text-sm"><span>跟单</span><input class="h-10 w-full rounded border bg-muted px-3" value="${escapeHtml(CURRENT_PCS_ENGINEERING_USER.userName)}" readonly></label></div><fieldset class="mt-4"><legend class="mb-2 text-sm font-medium">系统建议专业任务（跟单可调整）</legend><div class="grid gap-2 md:grid-cols-2">${TASK_OPTIONS.map((item, index) => `<label class="flex items-center gap-2 rounded border p-2 text-sm"><input type="checkbox" data-${PREFIX}-field="taskType" value="${item.value}" ${index < 3 ? 'checked' : ''}>${item.label}</label>`).join('')}</div></fieldset><div class="mt-5 flex justify-end gap-2"><button class="h-9 rounded border px-4" data-${PREFIX}-action="close-create">取消</button><button class="h-9 rounded bg-primary px-4 text-primary-foreground" data-${PREFIX}-action="create" data-sampling-type="${type}">创建草稿</button></div></section></div>`
}

function listColumns(type: EngineeringIndependentSamplingType): StandardListColumn<EngineeringIndependentSamplingRecord>[] {
  return [
    { key: 'code', title: '任务号', width: 130, required: true, freezeable: true, sortable: true, sortValue: (row) => row.samplingTaskCode, render: (row) => `<a class="font-medium text-blue-700 hover:underline" href="/pcs/engineering/${type === 'REVISION' ? 'revision' : 'design'}-sampling/${escapeHtml(row.samplingTaskId)}">${escapeHtml(row.samplingTaskCode)}</a>` },
    { key: 'style', title: type === 'REVISION' ? '基于款式 → 做成款式' : '目标款式', width: 360, required: true, render: (row) => { const target = getStyleArchiveById(row.targetStyleId); const source = row.sourceStyleId ? getStyleArchiveById(row.sourceStyleId) : null; return `${source ? `${imageButton(source.mainImageUrl, source.styleName, `<span class="block"><strong>${escapeHtml(source.styleCode)}</strong><small class="block text-muted-foreground">${escapeHtml(source.styleName)}</small></span>`)}<span class="px-1">→</span>` : ''}${target ? imageButton(target.mainImageUrl, target.styleName, `<span class="block"><strong>${escapeHtml(target.styleCode)}</strong><small class="block text-muted-foreground">${escapeHtml(target.styleName)}</small></span>`) : escapeHtml(row.targetStyleCode)}` } },
    { key: 'status', title: '状态', width: 120, sortable: true, sortValue: (row) => STATUS_TEXT[row.status], render: (row) => `<span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${STATUS_TEXT[row.status]}</span>` },
    { key: 'progress', title: '专业任务', width: 150, render: (row) => `${row.professionalTasks.filter((task) => task.status === 'COMPLETED').length}/${row.professionalTasks.length || row.selectedTaskTypes.length}` },
    { key: 'bom', title: 'BOM 与价格', width: 170, render: (row) => `<a class="text-blue-700 hover:underline" href="/pcs/technical-data/bom-pricing">${escapeHtml(row.bomDraftVersionId)}</a>` },
    { key: 'owner', title: '跟单', width: 130, render: (row) => escapeHtml(row.merchandiserName) },
    { key: 'updated', title: '更新时间', width: 170, sortable: true, sortValue: (row) => row.updatedAt, render: (row) => escapeHtml(row.updatedAt) },
    { key: 'action', title: '操作', width: 110, actionColumn: true, render: (row) => `<a class="inline-flex h-8 items-center rounded border px-3 text-xs" href="/pcs/engineering/${type === 'REVISION' ? 'revision' : 'design'}-sampling/${escapeHtml(row.samplingTaskId)}">查看详情</a>` },
  ]
}

function createSamplingListController(type: EngineeringIndependentSamplingType) {
  const root = `[data-independent-sampling-list="${type}"]`
  return createProcessOrderListController({
    state: listStates[type], columns: listColumns(type),
    preferenceKey: `higood-pcs-${type.toLowerCase()}-sampling-list-preferences-v1`,
    pageSizeOptions: [10, 20, 50], eventPrefix: PREFIX, rootSelector: root,
    tableSurfaceSelector: '[data-independent-sampling-table]',
    paginationSurfaceSelector: '[data-independent-sampling-pagination]',
    overlaysSurfaceSelector: '[data-independent-sampling-overlays]',
    defaultFrozenKeys: ['code'], columnSettingsTitle: `${TYPE_TEXT[type]}列表列设置`,
    emptyText: `暂无${TYPE_TEXT[type]}任务`, getRows: () => listEngineeringIndependentSamplingRecords(type),
  })
}

const listControllers = { REVISION: createSamplingListController('REVISION'), DESIGN: createSamplingListController('DESIGN') }

function renderList(type: EngineeringIndependentSamplingType): string {
  const controller = listControllers[type]
  const all = listEngineeringIndependentSamplingRecords(type)
  const view = controller.getView()
  controller.installColumnDragEvents()
  return `<div data-independent-sampling-list="${type}">${renderStandardListPage({ title: `${TYPE_TEXT[type]}任务`, primaryActionsHtml: `<button class="h-9 rounded border px-4 text-sm" data-${PREFIX}-action="open-column-settings">列设置</button><button class="h-9 rounded bg-primary px-4 text-sm text-primary-foreground" data-${PREFIX}-action="open-create" data-sampling-type="${type}">新建${TYPE_TEXT[type]}</button>`, feedbackHtml: ui.feedback ? `<p class="rounded border px-3 py-2 text-sm ${ui.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}">${escapeHtml(ui.feedback)}</p>` : '', filtersHtml: `<div class="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">当前跟单：${escapeHtml(CURRENT_PCS_ENGINEERING_USER.userName)} · ${type === 'REVISION' ? '来源 SPU 和目标 SPU 均必须已建档' : '目标 SPU 必须已建档'}</div>`, listTitle: `共 ${all.length} 条`, tableHtml: `<div data-independent-sampling-table>${view.tableHtml}</div>`, paginationHtml: `<div data-independent-sampling-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-independent-sampling-overlays>${controller.renderColumnSettings()}</div>${renderDialogHost()}` })}</div>`
}

export function renderPcsRevisionSamplingListPage(): string { return renderList('REVISION') }
export function renderPcsDesignSamplingListPage(): string { return renderList('DESIGN') }

function styleCard(styleId: string, label: string): string {
  const style = getStyleArchiveById(styleId)
  if (!style) return ''
  return `<div class="rounded-lg border p-3"><p class="mb-2 text-xs text-muted-foreground">${label}</p>${imageButton(style.mainImageUrl, style.styleName, `<span><strong>${escapeHtml(style.styleCode)}</strong><small class="block text-muted-foreground">${escapeHtml(style.styleName)}</small></span>`)}</div>`
}

export function renderPcsIndependentSamplingDetailPage(type: EngineeringIndependentSamplingType, id: string): string {
  const record = getEngineeringIndependentSamplingRecord(id)
  if (!record || record.samplingType !== type) return `<section class="p-6"><h1 class="text-xl font-semibold">任务不存在</h1></section>`
  return `<section class="space-y-4 p-4"><header class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"><div><h1 class="text-xl font-semibold">${TYPE_TEXT[type]} · ${escapeHtml(record.samplingTaskCode)}</h1><p class="mt-1 text-sm text-muted-foreground">${STATUS_TEXT[record.status]} · 跟单：${escapeHtml(record.merchandiserName)}</p></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/engineering/${type === 'REVISION' ? 'revision' : 'design'}-sampling">返回列表</a></header>${ui.feedback ? `<p class="rounded border px-3 py-2 text-sm ${ui.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}">${escapeHtml(ui.feedback)}</p>` : ''}<div class="grid gap-3 md:grid-cols-2">${record.sourceStyleId ? styleCard(record.sourceStyleId, '基于款式（SPU）') : ''}${styleCard(record.targetStyleId, '做成款式（SPU）')}</div><section class="rounded-lg border bg-card p-4"><div class="flex items-center justify-between"><h2 class="font-semibold">专业任务</h2>${record.status === 'DRAFT' ? `<button class="rounded bg-primary px-4 py-2 text-sm text-primary-foreground" data-${PREFIX}-action="confirm-plan" data-sampling-id="${escapeHtml(record.samplingTaskId)}">确认任务安排并生成</button>` : ''}</div>${record.status === 'DRAFT' ? `<div class="mt-3 grid gap-2 md:grid-cols-3">${TASK_OPTIONS.map((item) => `<label class="flex items-center gap-2 rounded border p-2 text-sm"><input type="checkbox" data-${PREFIX}-field="planTaskType" value="${item.value}" ${record.selectedTaskTypes.includes(item.value) ? 'checked' : ''}>${item.label}</label>`).join('')}</div>` : `<div class="mt-3 overflow-x-auto"><table class="w-full min-w-[780px] text-sm"><thead><tr class="border-b bg-muted/50 text-left"><th class="p-3">任务</th><th class="p-3">团队</th><th class="p-3">状态</th><th class="p-3">前置</th><th class="p-3">成果</th><th class="p-3">操作</th></tr></thead><tbody>${record.professionalTasks.map((task) => `<tr class="border-b"><td class="p-3 font-medium">${escapeHtml(task.taskName)}</td><td class="p-3">${escapeHtml(task.ownerTeamName)}</td><td class="p-3">${TASK_STATUS_TEXT[task.status]}</td><td class="p-3">${task.dependsOnTaskIds.length ? task.dependsOnTaskIds.map((value) => escapeHtml(value)).join('<br>') : '无'}</td><td class="p-3">${task.results.length} 项</td><td class="p-3"><a class="text-blue-700 hover:underline" href="/pcs/engineering/sampling-professional/${escapeHtml(task.taskId)}">进入任务</a></td></tr>`).join('')}</tbody></table></div>`}</section><section class="grid gap-3 md:grid-cols-2"><div class="rounded-lg border bg-card p-4"><h2 class="font-semibold">BOM 与价格</h2><a class="mt-3 block text-blue-700 hover:underline" href="/pcs/technical-data/bom-pricing">${escapeHtml(record.bomDraftVersionId)}（草稿）</a></div><div class="rounded-lg border bg-card p-4"><h2 class="font-semibold">整单成果</h2>${record.status === 'WAIT_CONFIRMATION' ? `<div class="mt-3 grid gap-2"><input class="h-9 rounded border px-3" data-${PREFIX}-field="resultVersion" placeholder="成果版本，如 v1.0"><textarea class="rounded border p-3" data-${PREFIX}-field="resultSummary" placeholder="成果摘要"></textarea><button class="rounded bg-primary px-4 py-2 text-primary-foreground" data-${PREFIX}-action="confirm-result" data-sampling-id="${escapeHtml(record.samplingTaskId)}">跟单确认整单成果</button></div>` : `<p class="mt-3 text-sm">${record.resultVersion ? `${escapeHtml(record.resultVersion)} · ${escapeHtml(record.resultSummary)}` : '待全部专业任务完成'}</p>`}</div></section><section class="rounded-lg border bg-card p-4"><h2 class="font-semibold">操作记录</h2><div class="mt-3 space-y-2">${record.operationLogs.map((log) => `<div class="grid gap-1 border-b pb-2 text-sm md:grid-cols-[150px_150px_1fr]"><span>${escapeHtml(log.occurredAt)}</span><span>${escapeHtml(log.operatorName)} · ${escapeHtml(log.action)}</span><span class="text-muted-foreground">${escapeHtml(log.detail)}</span></div>`).join('')}</div></section>${renderDialogHost()}</section>`
}

function findProfessional(taskId: string): { record: EngineeringIndependentSamplingRecord; task: EngineeringIndependentProfessionalTask } | null {
  for (const record of listEngineeringIndependentSamplingRecords()) { const task = record.professionalTasks.find((item) => item.taskId === taskId); if (task) return { record, task } }
  return null
}

export function renderPcsIndependentSamplingProfessionalTaskPage(taskId: string): string {
  const found = findProfessional(taskId)
  if (!found) return `<section class="p-6"><h1 class="text-xl font-semibold">任务不存在</h1></section>`
  const { record, task } = found
  const isColor = task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC'
  const colorRequirement = isColor ? `<section class="rounded-lg border bg-card p-4"><h2 class="font-semibold">颜色要求</h2><div class="mt-3 grid gap-3 md:grid-cols-3"><input class="h-10 rounded border px-3" data-${PREFIX}-field="pantoneColorCode" value="${escapeHtml(task.pantoneColorCode)}" placeholder="潘通色号"><input class="h-10 rounded border px-3" data-${PREFIX}-field="colorName" value="${escapeHtml(task.colorName)}" placeholder="颜色名称"><div class="text-sm text-muted-foreground">${task.colorRequirementConfirmedAt ? `跟单已确认 · ${escapeHtml(task.colorRequirementConfirmedAt)}` : '待跟单确认'}</div></div>${['WAIT_START', 'IN_PROGRESS', 'REWORK'].includes(task.status) ? `<button class="mt-4 rounded border border-blue-200 px-4 py-2 text-blue-700" data-${PREFIX}-action="confirm-color-requirement" data-task-id="${escapeHtml(task.taskId)}">跟单确认颜色要求</button>` : ''}</section>` : ''
  return `<section class="space-y-4 p-4"><header class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"><div><h1 class="text-xl font-semibold">${escapeHtml(task.taskName)}</h1><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(task.taskId)} · ${TASK_STATUS_TEXT[task.status]} · ${escapeHtml(record.targetStyleCode)}</p></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/engineering/${record.samplingType === 'REVISION' ? 'revision' : 'design'}-sampling/${escapeHtml(record.samplingTaskId)}">返回主任务</a></header>${ui.feedback ? `<p class="rounded border px-3 py-2 text-sm ${ui.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}">${escapeHtml(ui.feedback)}</p>` : ''}<section class="rounded-lg border bg-card p-4"><h2 class="font-semibold">任务概要</h2><dl class="mt-3 grid gap-3 text-sm md:grid-cols-4"><div><dt class="text-muted-foreground">负责团队</dt><dd>${escapeHtml(task.ownerTeamName)}</dd></div><div><dt class="text-muted-foreground">当前状态</dt><dd>${TASK_STATUS_TEXT[task.status]}</dd></div><div><dt class="text-muted-foreground">开始时间</dt><dd>${escapeHtml(task.startedAt || '-')}</dd></div><div><dt class="text-muted-foreground">完成时间</dt><dd>${escapeHtml(task.completedAt || '-')}</dd></div></dl>${task.status === 'WAIT_START' ? `<button class="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground" data-${PREFIX}-action="start-task" data-task-id="${escapeHtml(task.taskId)}">开始任务</button>` : ''}</section>${colorRequirement}${['IN_PROGRESS', 'REWORK'].includes(task.status) ? `<section class="rounded-lg border bg-card p-4"><h2 class="font-semibold">提交成果</h2><div class="mt-3 grid gap-3 md:grid-cols-2">${isColor ? `<input class="h-10 rounded border px-3" data-${PREFIX}-field="dyeColorCode" value="${escapeHtml(task.dyeColorCode)}" placeholder="染厂色号">` : ''}<input class="h-10 rounded border px-3" data-${PREFIX}-field="resultTitle" placeholder="成果名称"><input class="h-10 rounded border px-3" data-${PREFIX}-field="resultImageUrl" value="${escapeHtml(getStyleArchiveById(record.targetStyleId)?.mainImageUrl || '')}" placeholder="成果图片地址"></div><button class="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground" data-${PREFIX}-action="submit-task" data-task-id="${escapeHtml(task.taskId)}">提交成果</button></section>` : ''}<section class="rounded-lg border bg-card p-4"><h2 class="font-semibold">成果记录</h2><div class="mt-3 grid gap-3 md:grid-cols-2">${task.results.length ? task.results.map((result) => `<div class="rounded border p-3">${imageButton(result.imageUrl, result.title, `<span><strong>${escapeHtml(result.title)}</strong><small class="block text-muted-foreground">${escapeHtml(result.status === 'APPROVED' ? '已通过' : result.status === 'REJECTED' ? '未通过' : '待审核')}</small></span>`)}${task.status === 'WAIT_REVIEW' ? `<div class="mt-3 flex flex-wrap gap-2"><label class="text-sm"><input type="radio" name="review-${escapeHtml(result.resultId)}" value="approve" checked data-${PREFIX}-review-result="${escapeHtml(result.resultId)}"> 通过</label><label class="text-sm"><input type="radio" name="review-${escapeHtml(result.resultId)}" value="reject" data-${PREFIX}-review-result="${escapeHtml(result.resultId)}"> 不通过</label><input class="h-8 flex-1 rounded border px-2 text-sm" data-${PREFIX}-review-reason="${escapeHtml(result.resultId)}" placeholder="未通过原因"></div>` : result.rejectReason ? `<p class="mt-2 text-sm text-red-600">${escapeHtml(result.rejectReason)}</p>` : ''}</div>`).join('') : '<p class="text-sm text-muted-foreground">尚未提交成果</p>'}</div>${task.status === 'WAIT_REVIEW' ? `<button class="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground" data-${PREFIX}-action="review-task" data-task-id="${escapeHtml(task.taskId)}">买手提交整张审核</button>` : ''}</section><section class="rounded-lg border bg-card p-4"><h2 class="font-semibold">前置依赖</h2><p class="mt-3 text-sm">${task.dependsOnTaskIds.length ? task.dependsOnTaskIds.map(escapeHtml).join('、') : '无前置任务'}</p></section>${renderDialogHost()}</section>`
}

function value(field: string): string { return document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-${PREFIX}-field="${field}"]`)?.value.trim() || '' }
function checkedTaskTypes(field: string): EngineeringIndependentProfessionalTaskType[] { return [...document.querySelectorAll<HTMLInputElement>(`[data-${PREFIX}-field="${field}"]:checked`)].map((node) => node.value as EngineeringIndependentProfessionalTaskType) }
function bomNumber(field: string, bomItemId: string): number {
  const node = [...document.querySelectorAll<HTMLInputElement>(`[data-bom-field="${field}"]`)]
    .find((item) => item.dataset.bomItemId === bomItemId)
  return Number(node?.value || 0)
}
function rerender(): void { if (typeof window !== 'undefined') window.dispatchEvent(new Event('higood:request-render')) }
function run(action: () => void, success: string): void { try { action(); ui.feedback = success; ui.ok = true } catch (error) { ui.feedback = error instanceof Error ? error.message : '操作失败。'; ui.ok = false } rerender() }
function currentListType(): EngineeringIndependentSamplingType { return location.pathname.includes('revision') ? 'REVISION' : 'DESIGN' }

export function handlePcsIndependentSamplingEvent(target: HTMLElement): boolean {
  const node = target.closest<HTMLElement>(`[data-${PREFIX}-action]`); if (!node) return false
  const action = node.dataset.pcsIndependentSamplingAction || ''
  const controller = listControllers[currentListType()]
  if (action === 'prev-page' || action === 'next-page') { controller.stepPage(action === 'next-page' ? 1 : -1); controller.refresh(); return true }
  if (action === 'sort-column') { controller.cycleSort(node.dataset.columnKey || ''); controller.refresh(); return true }
  if (action === 'open-column-settings') { listStates[currentListType()].showColumnSettings = true; controller.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'close-column-settings') { listStates[currentListType()].showColumnSettings = false; controller.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = node.dataset.pcsIndependentSamplingColumnKey || node.closest<HTMLElement>('[data-pcs-independent-sampling-column-key]')?.dataset.pcsIndependentSamplingColumnKey || ''
    controller.updateColumnPreference(action, key, target instanceof HTMLInputElement ? target.checked : undefined)
    controller.refresh({ overlays: true })
    return true
  }
  if (action === 'restore-column-settings') { controller.restorePreferences(); controller.refresh({ overlays: true }); return true }
  if (action === 'open-image') { ui.previewUrl = node.dataset.imageUrl || ''; ui.previewAlt = node.dataset.imageAlt || ''; refreshDialogs(); return true }
  if (action === 'close-image') { ui.previewUrl = ''; ui.previewAlt = ''; refreshDialogs(); return true }
  if (action === 'open-create') { ui.createType = node.dataset.samplingType as EngineeringIndependentSamplingType; ui.feedback = ''; refreshDialogs(); return true }
  if (action === 'close-create') { if (target !== node && target.closest('section')) return true; ui.createType = ''; refreshDialogs(); return true }
  if (action === 'create') { const type = node.dataset.samplingType as EngineeringIndependentSamplingType; run(() => { const created = createEngineeringIndependentSampling({ samplingType: type, sourceStyleId: type === 'REVISION' ? value('sourceStyleId') : undefined, targetStyleId: value('targetStyleId'), merchandiser: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: checkedTaskTypes('taskType'), bomDraftVersionId: value('bomDraftVersionId'), createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19) }); ui.createType = ''; window.location.href = `/pcs/engineering/${type === 'REVISION' ? 'revision' : 'design'}-sampling/${created.samplingTaskId}` }, '任务已创建。'); return true }
  if (action === 'save-bom-line') { const bomItemId = node.dataset.bomItemId || ''; run(() => { updateEngineeringIndependentSamplingBomLine({ samplingTaskId: node.dataset.samplingId || '', bomItemId, actor: BUYER, usage: bomNumber('usage', bomItemId), sampleQuantity: bomNumber('sampleQuantity', bomItemId), lossRate: bomNumber('lossRatePercent', bomItemId) / 100 }) }, 'BOM 物料用量已保存。'); return true }
  if (action === 'confirm-plan') { run(() => { confirmEngineeringIndependentSamplingPlan({ samplingTaskId: node.dataset.samplingId || '', actor: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: checkedTaskTypes('planTaskType') }) }, '任务安排已确认，专业任务已生成。'); return true }
  if (action === 'start-task') { const found = findProfessional(node.dataset.taskId || ''); run(() => { if (!found) throw new Error('任务不存在。'); startEngineeringIndependentProfessionalTask({ taskId: found.task.taskId, actor: EXECUTORS[found.task.taskType] }) }, '任务已开始。'); return true }
  if (action === 'confirm-color-requirement') { run(() => { confirmEngineeringIndependentColorRequirement({ taskId: node.dataset.taskId || '', actor: CURRENT_PCS_ENGINEERING_USER, pantoneColorCode: value('pantoneColorCode'), colorName: value('colorName') }) }, '颜色要求已确认。'); return true }
  if (action === 'submit-task') { const found = findProfessional(node.dataset.taskId || ''); run(() => { if (!found) throw new Error('任务不存在。'); submitEngineeringIndependentProfessionalTask({ taskId: found.task.taskId, actor: EXECUTORS[found.task.taskType], resultTitles: [value('resultTitle')], resultImageUrls: [value('resultImageUrl')], dyeColorCode: value('dyeColorCode') }) }, '成果已提交。'); return true }
  if (action === 'review-task') { const taskId = node.dataset.taskId || ''; const found = findProfessional(taskId); run(() => { if (!found) throw new Error('任务不存在。'); const decisions = found.task.results.map((result) => { const selected = document.querySelector<HTMLInputElement>(`[data-${PREFIX}-review-result="${result.resultId}"]:checked`); const reason = document.querySelector<HTMLInputElement>(`[data-${PREFIX}-review-reason="${result.resultId}"]`)?.value || ''; return { resultId: result.resultId, approved: selected?.value === 'approve', reason } }); reviewEngineeringIndependentProfessionalTask({ taskId, actor: BUYER, decisions }) }, '买手审核结果已提交。'); return true }
  if (action === 'confirm-result') { run(() => { confirmEngineeringIndependentSamplingResult({ samplingTaskId: node.dataset.samplingId || '', actor: CURRENT_PCS_ENGINEERING_USER, resultVersion: value('resultVersion'), resultSummary: value('resultSummary'), confirmedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) }) }, '整张任务成果已确认。'); return true }
  return false
}

export function handlePcsIndependentSamplingInput(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  if (target.matches(`[data-${PREFIX}-field="pageSize"]`)) { const controller = listControllers[currentListType()]; controller.setPageSize(Number(target.value)); controller.refresh(); return true }
  // 创建与任务表单由本模块读取 DOM 当前值；必须消费输入事件，避免继续落入全局
  // 默认处理器触发整页渲染并清空尚未提交的选择。
  if (target.matches(`[data-${PREFIX}-field], [data-bom-field]`) || target.matches(`[data-${PREFIX}-review-result], [data-${PREFIX}-review-reason]`)) return true
  return false
}

export function isPcsIndependentSamplingDialogOpen(): boolean { return Boolean(ui.createType || ui.previewUrl) }
