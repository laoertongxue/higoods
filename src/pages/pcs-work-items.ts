import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'
import {
  getPcsWorkItemDefinition,
  getPcsWorkItemLibraryMeta,
  listPcsWorkItems,
} from '../data/pcs-work-items.ts'
import {
  getProjectWorkItemContractById,
  listProjectWorkItemFieldGroups,
  type PcsProjectNodeFieldGroupDefinition,
  type PcsProjectNodeOperationDefinition,
  type PcsProjectNodeStatusDefinition,
} from '../data/pcs-project-domain-contract.ts'

type WorkItemStatusFilter = '全部状态' | '启用' | '停用'

interface PcsWorkItemLibraryPageState {
  search: string
  nature: string
  role: string
  status: WorkItemStatusFilter
  currentPage: number
  itemsPerPage: number
  jumpPage: string
}

const initialState: PcsWorkItemLibraryPageState = {
  search: '',
  nature: '全部类型',
  role: '全部角色',
  status: '全部状态',
  currentPage: 1,
  itemsPerPage: 10,
  jumpPage: '',
}

const state: PcsWorkItemLibraryPageState = {
  ...initialState,
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: '单行文本',
  textarea: '多行文本',
  number: '数字',
  select: '下拉单选',
  'multi-select': '多选标签',
  date: '日期',
  datetime: '日期时间',
  image: '图片上传',
  file: '文件上传',
  'cascade-select': '级联选择',
  'single-select': '单选下拉',
  'user-select': '用户选择',
  'user-multi-select': '多用户选择',
  'team-select': '团队选择',
  url: '链接',
  reference: '关联引用',
  'reference-multi': '多对象关联',
  system: '系统字段',
}

function resetState(): void {
  Object.assign(state, initialState)
}

function getWorkItems() {
  return listPcsWorkItems().map((item) => {
    const definition = getPcsWorkItemDefinition(item.id)
    return {
      ...item,
      enabledFlag: definition?.enabledFlag !== false,
      displayStatus: definition?.enabledFlag === false ? '停用' : '启用',
    }
  })
}

function getNatureOptions(): string[] {
  return ['全部类型', ...Array.from(new Set(getWorkItems().map((item) => item.nature)))]
}

function getRoleOptions(): string[] {
  return ['全部角色', ...Array.from(new Set(getWorkItems().map((item) => item.role)))]
}

function getFilteredWorkItems() {
  const keyword = state.search.trim().toLowerCase()
  return getWorkItems().filter((item) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [item.name, item.code, item.phaseName, item.category, item.desc, item.role].join(' ').toLowerCase().includes(keyword)
    const matchesNature = state.nature === '全部类型' || item.nature === state.nature
    const matchesRole = state.role === '全部角色' || item.role === state.role
    const matchesStatus = state.status === '全部状态' || item.displayStatus === state.status
    return matchesKeyword && matchesNature && matchesRole && matchesStatus
  })
}

function clampCurrentPage(totalPages: number): number {
  if (totalPages <= 0) return 1
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages
  }
  if (state.currentPage < 1) {
    state.currentPage = 1
  }
  return state.currentPage
}

function getPagedWorkItems() {
  const filteredItems = getFilteredWorkItems()
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / state.itemsPerPage))
  const currentPage = clampCurrentPage(totalPages)
  const startIndex = (currentPage - 1) * state.itemsPerPage
  return {
    filteredItems,
    totalPages,
    currentPage,
    pagedItems: filteredItems.slice(startIndex, startIndex + state.itemsPerPage),
  }
}

function getNatureBadgeClass(nature: string): string {
  if (nature === '决策类') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (nature === '执行类') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (nature === '里程碑类') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function getStatusBadgeClass(status: string): string {
  return status === '停用' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'
}

function renderCapabilityBadges(capabilities: string[]): string {
  return capabilities
    .map(
      (capability) =>
        `<span class="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(capability)}</span>`,
    )
    .join('')
}

function renderPagerButton(label: string, page: number, currentPage: number, disabled = false): string {
  return `
    <button
      type="button"
      class="${toClassName(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs',
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
          : currentPage === page
            ? 'border-blue-600 bg-blue-600 text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      )}"
      data-pcs-work-item-action="set-page"
      data-pcs-work-item-page="${page}"
      ${disabled ? 'disabled' : ''}
    >${escapeHtml(label)}</button>
  `
}

function renderPagination(totalPages: number, currentPage: number): string {
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1, currentPage - 2, currentPage + 2])
  const visiblePages = Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)
  const content: string[] = []

  visiblePages.forEach((page, index) => {
    const previous = visiblePages[index - 1]
    if (typeof previous === 'number' && page - previous > 1) {
      content.push('<span class="px-1 text-xs text-slate-400">...</span>')
    }
    content.push(renderPagerButton(String(page), page, currentPage))
  })

  return content.join('')
}

function renderLibraryHeader(): string {
  const items = getWorkItems()
  const enabledCount = items.filter((item) => item.displayStatus === '启用').length
  const factCount = items.filter((item) => item.nature === '事实类').length
  const milestoneCount = items.filter((item) => item.nature === '里程碑类').length

  return `
    <header class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs text-slate-500">商品中心 / 标准工作项</p>
          <h1 class="text-xl font-semibold text-slate-900">工作项库</h1>
          <p class="mt-1 text-sm text-slate-500">统一查看 PCS 标准工作项定义、字段结构、状态口径与项目承载方式，作为项目模板编排和跨模块映射的参照底座。</p>
        </div>
      </div>
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-slate-500">工作项总数</p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">${items.length}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-slate-500">当前启用</p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">${enabledCount}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-slate-500">里程碑 / 事实类</p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">${milestoneCount + factCount}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-slate-500">最近更新</p>
          <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(formatDateTime(getWorkItems()[0]?.updatedAt ?? ''))}</p>
        </article>
      </section>
    </header>
  `
}

function renderLibraryFilters(): string {
  const natureOptions = getNatureOptions()
  const roleOptions = getRoleOptions()
  const statusOptions: WorkItemStatusFilter[] = ['全部状态', '启用', '停用']

  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-3 xl:grid-cols-[minmax(240px,1.4fr)_180px_220px_140px_auto]">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索工作项</span>
          <input
            class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="搜索工作项名称、编码、阶段或说明"
            value="${escapeHtml(state.search)}"
            data-pcs-work-item-field="search"
          />
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">工作项性质</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-work-item-field="nature">
            ${natureOptions
              .map(
                (option) =>
                  `<option value="${escapeHtml(option)}" ${state.nature === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">默认执行角色</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-work-item-field="role">
            ${roleOptions
              .map(
                (option) =>
                  `<option value="${escapeHtml(option)}" ${state.role === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">状态</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-work-item-field="status">
            ${statusOptions
              .map(
                (option) =>
                  `<option value="${escapeHtml(option)}" ${state.status === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-work-item-action="query">查询</button>
          <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-work-item-action="reset">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderLibraryTable(): string {
  const { filteredItems, pagedItems, totalPages, currentPage } = getPagedWorkItems()

  return `
    <section class="overflow-hidden rounded-lg border bg-white">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50">
            <tr class="border-b border-slate-200 text-left text-slate-600">
              <th class="px-4 py-3 font-medium">操作</th>
              <th class="px-4 py-3 font-medium">工作项名称</th>
              <th class="px-4 py-3 font-medium">工作项性质</th>
              <th class="px-4 py-3 font-medium">工作项分类</th>
              <th class="px-4 py-3 font-medium">系统能力</th>
              <th class="px-4 py-3 font-medium">默认执行角色</th>
              <th class="px-4 py-3 font-medium">最近更新</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">工作项说明</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${
              pagedItems.length === 0
                ? `
                  <tr>
                    <td colspan="9" class="px-4 py-16 text-center">
                      <p class="text-sm font-medium text-slate-700">未找到符合条件的工作项</p>
                      <p class="mt-1 text-xs text-slate-500">可以调整筛选条件，或重置后重新查看全部标准工作项。</p>
                    </td>
                  </tr>
                `
                : pagedItems
                    .map(
                      (item) => `
                        <tr class="align-top hover:bg-slate-50">
                          <td class="px-4 py-3">
                            <button type="button" class="inline-flex rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="/pcs/work-items/${escapeHtml(item.id)}">查看</button>
                          </td>
                          <td class="px-4 py-3">
                            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/work-items/${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>
                            <p class="mt-1 text-xs text-slate-400">${escapeHtml(item.code)}</p>
                          </td>
                          <td class="px-4 py-3">
                            <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getNatureBadgeClass(item.nature)}">${escapeHtml(item.nature)}</span>
                          </td>
                          <td class="px-4 py-3">
                            <p class="text-slate-700">${escapeHtml(item.category)}</p>
                            <p class="mt-1 text-xs text-slate-400">${escapeHtml(item.phaseName)}</p>
                          </td>
                          <td class="px-4 py-3">
                            <div class="flex max-w-[280px] flex-wrap gap-1.5">
                              ${renderCapabilityBadges(item.capabilities)}
                            </div>
                          </td>
                          <td class="px-4 py-3 text-slate-600">${escapeHtml(item.role)}</td>
                          <td class="px-4 py-3 text-xs text-slate-500">${escapeHtml(formatDateTime(item.updatedAt))}</td>
                          <td class="px-4 py-3">
                            <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getStatusBadgeClass(item.displayStatus)}">${escapeHtml(item.displayStatus)}</span>
                          </td>
                          <td class="px-4 py-3 text-slate-600">
                            <p class="max-w-[360px] leading-6">${escapeHtml(item.desc)}</p>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <div class="text-sm text-slate-600">共 ${filteredItems.length} 条</div>
        <div class="flex flex-wrap items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <span>每页</span>
            <select class="h-8 rounded-md border border-slate-200 px-2 text-xs" data-pcs-work-item-field="pageSize">
              ${[10, 20, 50]
                .map(
                  (size) => `<option value="${size}" ${state.itemsPerPage === size ? 'selected' : ''}>${size} 条/页</option>`,
                )
                .join('')}
            </select>
          </label>
          <div class="flex items-center gap-1">
            ${renderPagerButton('上一页', Math.max(1, currentPage - 1), currentPage, currentPage === 1)}
            ${renderPagination(totalPages, currentPage)}
            ${renderPagerButton('下一页', Math.min(totalPages, currentPage + 1), currentPage, currentPage === totalPages)}
          </div>
          <div class="flex items-center gap-2 text-sm text-slate-600">
            <span>前往</span>
            <input
              class="h-8 w-16 rounded-md border border-slate-200 px-2 text-center text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value="${escapeHtml(state.jumpPage)}"
              inputmode="numeric"
              data-pcs-work-item-field="jumpPage"
            />
            <span>页</span>
            <button type="button" class="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-work-item-action="jump-page">跳转</button>
          </div>
        </div>
      </div>
    </section>
  `
}

function renderKeyValueCard(label: string, value: string, helper?: string): string {
  return `
    <article class="rounded-lg border bg-white p-4">
      <p class="text-xs text-slate-500">${escapeHtml(label)}</p>
      <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(value || '-')}</p>
      ${helper ? `<p class="mt-1 text-xs leading-5 text-slate-500">${escapeHtml(helper)}</p>` : ''}
    </article>
  `
}

function renderCapabilityCards(definition: NonNullable<ReturnType<typeof getPcsWorkItemDefinition>>): string {
  const capabilityItems = [
    { label: '可复用', enabled: definition.capabilities.canReuse, icon: 'copy' },
    { label: '可多次执行', enabled: definition.capabilities.canMultiInstance, icon: 'layers-3' },
    { label: '可回退', enabled: definition.capabilities.canRollback, icon: 'rotate-ccw' },
    { label: '可并行', enabled: definition.capabilities.canParallel, icon: 'git-branch' },
  ]

  return `
    <section class="rounded-lg border bg-white p-6">
      <div class="mb-4 flex items-center gap-2">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">二</span>
        <h2 class="text-lg font-semibold text-slate-900">工作项能力定义</h2>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${capabilityItems
          .map(
            (item) => `
              <article class="flex items-center gap-3 rounded-lg border px-4 py-4 ${item.enabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}">
                <span class="${toClassName('inline-flex h-10 w-10 items-center justify-center rounded-full', item.enabled ? 'bg-white text-emerald-600' : 'bg-white text-slate-400')}">
                  <i data-lucide="${item.icon}" class="h-4 w-4"></i>
                </span>
                <div>
                  <p class="text-sm text-slate-500">${escapeHtml(item.label)}</p>
                  <p class="mt-1 text-sm font-medium text-slate-900">${item.enabled ? '是' : '否'}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderFieldGroups(groups: PcsProjectNodeFieldGroupDefinition[]): string {
  return `
    <section class="rounded-lg border bg-white p-6">
      <div class="mb-4 flex items-center gap-2">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">三</span>
        <h2 class="text-lg font-semibold text-slate-900">字段定义</h2>
      </div>
      <div class="space-y-6">
        ${groups
          .map(
            (group, groupIndex) => `
              <article class="space-y-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-semibold text-blue-700">${groupIndex + 1}</span>
                    <h3 class="text-base font-semibold text-slate-900">${escapeHtml(group.groupTitle)}</h3>
                  </div>
                  <p class="mt-1 text-sm text-slate-500">${escapeHtml(group.groupDescription)}</p>
                </div>
                <div class="overflow-x-auto rounded-lg border">
                  <table class="min-w-full text-sm">
                    <thead class="bg-slate-50 text-left text-slate-600">
                      <tr class="border-b border-slate-200">
                        <th class="px-4 py-3 font-medium">字段名称</th>
                        <th class="px-4 py-3 font-medium">字段类型</th>
                        <th class="px-4 py-3 font-medium">必填</th>
                        <th class="px-4 py-3 font-medium">来源与规则</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                      ${group.fields
                        .map(
                          (field) => `
                            <tr class="align-top">
                              <td class="px-4 py-3">
                                <div class="flex flex-wrap items-center gap-2">
                                  <span class="font-medium text-slate-900">${escapeHtml(field.label)}</span>
                                  ${field.readonly ? '<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">只读</span>' : ''}
                                  ${field.conditionalRequired ? '<span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">条件必填</span>' : ''}
                                </div>
                                <p class="mt-1 text-xs font-mono text-slate-400">${escapeHtml(field.fieldKey)}</p>
                              </td>
                              <td class="px-4 py-3 text-slate-700">${escapeHtml(FIELD_TYPE_LABELS[field.type] ?? field.type)}</td>
                              <td class="px-4 py-3">
                                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${field.required ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">${field.required ? '必填' : '选填'}</span>
                              </td>
                              <td class="space-y-1 px-4 py-3 text-slate-600">
                                <p>来源：${escapeHtml(field.sourceKind)} / ${escapeHtml(field.sourceRef)}</p>
                                <p>业务含义：${escapeHtml(field.meaning)}</p>
                                <p>业务逻辑：${escapeHtml(field.businessLogic)}</p>
                                ${field.placeholder ? `<p class="text-xs text-slate-500">占位提示：${escapeHtml(field.placeholder)}</p>` : ''}
                                ${field.conditionalRequired ? `<p class="text-xs text-amber-700">条件必填：${escapeHtml(field.conditionalRequired)}</p>` : ''}
                                ${
                                  field.options && field.options.length > 0
                                    ? `<div class="flex flex-wrap gap-1 pt-1">${field.options
                                        .map(
                                          (option) =>
                                            `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(option.label)}</span>`,
                                        )
                                        .join('')}</div>`
                                    : ''
                                }
                              </td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderStatusDefinitions(statusDefinitions: PcsProjectNodeStatusDefinition[]): string {
  if (statusDefinitions.length === 0) return ''
  return `
    <section class="rounded-lg border bg-white p-6">
      <div class="mb-4 flex items-center gap-2">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">四</span>
        <h2 class="text-lg font-semibold text-slate-900">状态定义</h2>
      </div>
      <div class="grid gap-3 lg:grid-cols-2">
        ${statusDefinitions
          .map(
            (status) => `
              <article class="rounded-lg border bg-slate-50 p-4">
                <div class="flex items-center gap-2">
                  <span class="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(status.statusName)}</span>
                </div>
                <p class="mt-3 text-sm leading-6 text-slate-700">${escapeHtml(status.businessMeaning)}</p>
                <div class="mt-3 space-y-2 text-xs text-slate-500">
                  <p><span class="font-medium text-slate-700">进入条件：</span>${escapeHtml(status.entryConditions.join('；') || '-')}</p>
                  <p><span class="font-medium text-slate-700">退出条件：</span>${escapeHtml(status.exitConditions.join('；') || '-')}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderOperationDefinitions(operationDefinitions: PcsProjectNodeOperationDefinition[]): string {
  if (operationDefinitions.length === 0) return ''
  return `
    <section class="rounded-lg border bg-white p-6">
      <div class="mb-4 flex items-center gap-2">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">五</span>
        <h2 class="text-lg font-semibold text-slate-900">操作定义</h2>
      </div>
      <div class="space-y-4">
        ${operationDefinitions
          .map(
            (operation) => `
              <article class="rounded-lg border p-4">
                <div>
                  <h3 class="text-base font-semibold text-slate-900">${escapeHtml(operation.actionName)}</h3>
                  <p class="mt-1 text-xs font-mono text-slate-400">${escapeHtml(operation.actionKey)}</p>
                </div>
                <div class="mt-4 grid gap-3 xl:grid-cols-3">
                  <div class="rounded-lg bg-slate-50 p-3">
                    <p class="text-xs font-medium text-slate-700">触发前提</p>
                    <ul class="mt-2 space-y-1 text-sm text-slate-600">
                      ${operation.preconditions.map((item) => `<li>• ${escapeHtml(item)}</li>`).join('') || '<li>• -</li>'}
                    </ul>
                  </div>
                  <div class="rounded-lg bg-slate-50 p-3">
                    <p class="text-xs font-medium text-slate-700">动作结果</p>
                    <ul class="mt-2 space-y-1 text-sm text-slate-600">
                      ${operation.effects.map((item) => `<li>• ${escapeHtml(item)}</li>`).join('') || '<li>• -</li>'}
                    </ul>
                  </div>
                  <div class="rounded-lg bg-slate-50 p-3">
                    <p class="text-xs font-medium text-slate-700">回写规则</p>
                    <ul class="mt-2 space-y-1 text-sm text-slate-600">
                      ${operation.writebackRules.map((item) => `<li>• ${escapeHtml(item)}</li>`).join('') || '<li>• -</li>'}
                    </ul>
                  </div>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderBulletSection(indexLabel: string, title: string, items: string[], tone: 'blue' | 'red' | 'violet' = 'blue'): string {
  if (items.length === 0) return ''
  const toneMap = {
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-rose-100 text-rose-700',
    violet: 'bg-violet-100 text-violet-700',
  }
  return `
    <section class="rounded-lg border bg-white p-6">
      <div class="mb-4 flex items-center gap-2">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">${escapeHtml(indexLabel)}</span>
        <h2 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
      </div>
      <ul class="space-y-3">
        ${items
          .map(
            (item) => `
              <li class="flex items-start gap-3">
                <span class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${toneMap[tone]}">•</span>
                <span class="flex-1 text-sm leading-6 text-slate-700">${escapeHtml(item)}</span>
              </li>
            `,
          )
          .join('')}
      </ul>
    </section>
  `
}

function renderRuntimeSection(indexLabel: string, workItemId: string): string {
  const meta = getPcsWorkItemLibraryMeta(workItemId)
  if (!meta) return ''
  return `
    <section class="rounded-lg border bg-white p-6">
      <div class="mb-4 flex items-center gap-2">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">${escapeHtml(indexLabel)}</span>
        <h2 class="text-lg font-semibold text-slate-900">运行时承载方式</h2>
      </div>
      <div class="grid gap-3 xl:grid-cols-3">
        ${renderKeyValueCard('承载方式', meta.runtimeCarrierLabel, meta.carrierReason)}
        ${renderKeyValueCard('项目内展示方式', meta.projectDisplayRequirementLabel, meta.projectDisplayMode)}
        ${renderKeyValueCard('承载模块', meta.moduleName, meta.listRoute ? `可跳转到 ${meta.listRoute}` : '当前不单独维护独立实例列表')}
      </div>
      ${
        meta.listRoute
          ? `<div class="mt-4"><button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(meta.listRoute)}"><i data-lucide="external-link" class="h-4 w-4"></i>打开承载模块</button></div>`
          : ''
      }
    </section>
  `
}

function renderLegacySection(indexLabel: string, workItemId: string): string {
  const meta = getPcsWorkItemLibraryMeta(workItemId)
  if (!meta || (meta.legacyReferenceCodes.length === 0 && meta.legacyReferenceNames.length === 0)) return ''
  return `
    <section class="rounded-lg border bg-white p-6">
      <div class="mb-4 flex items-center gap-2">
        <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">${escapeHtml(indexLabel)}</span>
        <h2 class="text-lg font-semibold text-slate-900">旧版映射参考</h2>
      </div>
      <div class="space-y-4">
        <article class="rounded-lg border bg-slate-50 p-4">
          <p class="text-xs text-slate-500">引用方式</p>
          <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(meta.legacyReferenceUseMode ?? '无')}</p>
        </article>
        <article class="rounded-lg border p-4">
          <p class="text-sm font-medium text-slate-900">旧版编码 / 名称</p>
          <div class="mt-3 flex flex-wrap gap-2">
            ${[...meta.legacyReferenceCodes, ...meta.legacyReferenceNames]
              .map(
                (item) =>
                  `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(item)}</span>`,
              )
              .join('')}
          </div>
        </article>
      </div>
    </section>
  `
}

export function renderPcsWorkItemLibraryPage(): string {
  return `
    <div class="space-y-6 p-6">
      ${renderLibraryHeader()}
      ${renderLibraryFilters()}
      ${renderLibraryTable()}
    </div>
  `
}

export function renderPcsWorkItemDetailPage(workItemId: string): string {
  const definition = getPcsWorkItemDefinition(workItemId)
  const contract = getProjectWorkItemContractById(workItemId)

  if (!definition || !contract) {
    return `
      <div class="space-y-4 p-6">
        <section class="rounded-lg border bg-white p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 class="text-xl font-semibold text-slate-900">工作项不存在</h1>
              <p class="mt-1 text-sm text-slate-500">未找到对应的 PCS 标准工作项定义，请返回列表重新选择。</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/work-items">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>返回工作项库
            </button>
          </div>
        </section>
      </div>
    `
  }

  const meta = getPcsWorkItemLibraryMeta(workItemId)
  const fieldGroups = listProjectWorkItemFieldGroups(contract.workItemTypeCode)
  const headerBadges = [
    `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${getNatureBadgeClass(definition.workItemNature)}">${escapeHtml(definition.workItemNature)}</span>`,
    definition.isBuiltin
      ? '<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">系统内置</span>'
      : '',
    `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getStatusBadgeClass(definition.enabledFlag === false ? '停用' : '启用')}">${definition.enabledFlag === false ? '停用' : '启用'}</span>`,
  ]
    .filter(Boolean)
    .join('')

  let sectionNumber = 7
  const nextSectionLabel = () => {
    sectionNumber += 1
    return String(sectionNumber)
  }

  return `
    <div class="space-y-6 p-6">
      <section class="rounded-lg border bg-white p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/work-items">
                <i data-lucide="arrow-left" class="h-4 w-4"></i>返回工作项库
              </button>
              ${meta?.listRoute ? `<button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(meta.listRoute)}"><i data-lucide="external-link" class="h-4 w-4"></i>查看承载模块</button>` : ''}
            </div>
            <div>
              <p class="text-xs text-slate-500">工作项库 / 详情</p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(definition.name)}</h1>
                ${headerBadges}
              </div>
              <p class="mt-2 text-sm text-slate-500">${escapeHtml(definition.description)}</p>
            </div>
          </div>
          <div class="rounded-lg border bg-slate-50 px-4 py-3 text-right">
            <p class="text-xs text-slate-500">工作项编码</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(definition.code)}</p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-6">
        <div class="mb-4 flex items-center gap-2">
          <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">一</span>
          <h2 class="text-lg font-semibold text-slate-900">基础信息</h2>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderKeyValueCard('工作项名称', definition.name)}
          ${renderKeyValueCard('工作项编码', definition.code)}
          ${renderKeyValueCard('所属阶段', definition.defaultPhaseName, contract.scenario)}
          ${renderKeyValueCard('工作项分类', definition.categoryName)}
          ${renderKeyValueCard('默认执行角色', definition.role)}
          ${renderKeyValueCard('字段 / 状态 / 操作', `${fieldGroups.reduce((sum, group) => sum + group.fields.length, 0)} / ${contract.statusDefinitions.length} / ${contract.operationDefinitions.length}`)}
          ${renderKeyValueCard('可用于模板', definition.isSelectableForTemplate ? '是' : '否')}
          ${renderKeyValueCard('最近更新', formatDateTime(definition.updatedAt), contract.keepReason)}
        </div>
      </section>

      ${renderCapabilityCards(definition)}
      ${renderFieldGroups(fieldGroups)}
      ${renderStatusDefinitions(contract.statusDefinitions)}
      ${renderOperationDefinitions(contract.operationDefinitions)}
      ${renderBulletSection('六', '业务规则', definition.businessRules)}
      ${renderBulletSection('七', '系统约束说明', definition.systemConstraints, 'red')}
      ${renderRuntimeSection(nextSectionLabel(), workItemId)}
      ${renderLegacySection(nextSectionLabel(), workItemId)}
    </div>
  `
}

export function handlePcsWorkItemsInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-work-item-field]')
  if (!fieldNode) return false

  const field = fieldNode.dataset.pcsWorkItemField
  if (!field) return false

  if (field === 'search' && fieldNode instanceof HTMLInputElement) {
    state.search = fieldNode.value
    state.currentPage = 1
    return true
  }

  if (field === 'nature' && fieldNode instanceof HTMLSelectElement) {
    state.nature = fieldNode.value
    state.currentPage = 1
    return true
  }

  if (field === 'role' && fieldNode instanceof HTMLSelectElement) {
    state.role = fieldNode.value
    state.currentPage = 1
    return true
  }

  if (field === 'status' && fieldNode instanceof HTMLSelectElement) {
    state.status = fieldNode.value as WorkItemStatusFilter
    state.currentPage = 1
    return true
  }

  if (field === 'pageSize' && fieldNode instanceof HTMLSelectElement) {
    const nextSize = Number.parseInt(fieldNode.value, 10)
    if (Number.isFinite(nextSize) && nextSize > 0) {
      state.itemsPerPage = nextSize
      state.currentPage = 1
    }
    return true
  }

  if (field === 'jumpPage' && fieldNode instanceof HTMLInputElement) {
    state.jumpPage = fieldNode.value.replaceAll(/[^\d]/g, '')
    return true
  }

  return false
}

export function handlePcsWorkItemsEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-work-item-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsWorkItemAction
  if (!action) return false

  if (action === 'reset') {
    resetState()
    return true
  }

  if (action === 'query') {
    state.currentPage = 1
    return true
  }

  if (action === 'set-page') {
    const page = Number.parseInt(actionNode.dataset.pcsWorkItemPage ?? '', 10)
    if (Number.isFinite(page) && page > 0) {
      state.currentPage = page
      state.jumpPage = ''
    }
    return true
  }

  if (action === 'jump-page') {
    const targetPage = Number.parseInt(state.jumpPage, 10)
    const totalPages = Math.max(1, Math.ceil(getFilteredWorkItems().length / state.itemsPerPage))
    if (Number.isFinite(targetPage) && targetPage >= 1) {
      state.currentPage = Math.min(targetPage, totalPages)
      state.jumpPage = ''
    }
    return true
  }

  return false
}

export function isPcsWorkItemsDialogOpen(): boolean {
  return false
}
