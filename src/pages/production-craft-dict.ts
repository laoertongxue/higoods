import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  craftStageDict,
  getProcessCraftDictRowByCode,
  processCraftDictRows,
  type CraftStageCode,
  type ProcessCraftDictRow,
} from '../data/fcs/process-craft-dict'
import { type ProcessAssignmentGranularity } from '../data/fcs/process-types'

type CraftDictState = {
  keyword: string
  filterStage: 'ALL' | CraftStageCode
  filterGranularity: 'ALL' | ProcessAssignmentGranularity
  viewCraftCode: string
}

const state: CraftDictState = {
  keyword: '',
  filterStage: 'ALL',
  filterGranularity: 'ALL',
  viewCraftCode: '',
}

function filteredCraftRows(): ProcessCraftDictRow[] {
  const keyword = state.keyword.trim().toLowerCase()

  return processCraftDictRows.filter((row) => {
    if (state.filterStage !== 'ALL' && row.stageCode !== state.filterStage) return false
    if (state.filterGranularity !== 'ALL' && row.assignmentGranularity !== state.filterGranularity) {
      return false
    }

    if (!keyword) return true

    return (
      row.craftCode.toLowerCase().includes(keyword) ||
      row.craftName.toLowerCase().includes(keyword) ||
      row.processName.toLowerCase().includes(keyword) ||
      row.stageName.toLowerCase().includes(keyword)
    )
  })
}

function renderSummaryCards(): string {
  const total = processCraftDictRows.length
  const orderCount = processCraftDictRows.filter((row) => row.assignmentGranularity === 'ORDER').length
  const colorCount = processCraftDictRows.filter((row) => row.assignmentGranularity === 'COLOR').length
  const skuCount = processCraftDictRows.filter((row) => row.assignmentGranularity === 'SKU').length

  return `
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      ${[
        { label: '工艺映射总数', value: total, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
        { label: '按生产单', value: orderCount, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
        { label: '按颜色', value: colorCount, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
        { label: '按SKU', value: skuCount, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
      ]
        .map(
          (item) => `
            <article class="rounded-lg border ${item.border} ${item.bg}">
              <div class="p-3">
                <p class="text-2xl font-bold tabular-nums ${item.color}">${item.value}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">${item.label}</p>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderCraftDetailSheet(row: ProcessCraftDictRow): string {
  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-craft-dict-action="close-sheet"></div>
    <aside class="fixed inset-y-0 right-0 z-[121] w-full max-w-[560px] overflow-y-auto border-l bg-background shadow-xl">
      <header class="sticky top-0 border-b bg-background px-4 py-3">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">工艺详情</h3>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-craft-dict-action="close-sheet">关闭</button>
        </div>
      </header>

      <div class="space-y-5 p-4">
        <div class="space-y-2.5 rounded-md border bg-muted/20 p-4">
          <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">基础信息</p>
          ${(
            [
              ['工序工艺编码', row.craftCode],
              ['工艺名称', row.craftName],
              ['老系统值', String(row.legacyValue)],
              ['老系统工艺名称', row.legacyCraftName],
              ['所属工序', row.processName],
              ['所属阶段', row.stageName],
              ['分配粒度', row.assignmentGranularityLabel],
              ['工艺规则来源', row.ruleSourceLabel],
              [
                '规则继承说明',
                row.ruleSource === 'INHERIT_PROCESS'
                  ? '当前工艺继承工序默认规则'
                  : '当前工艺使用工艺级覆盖规则',
              ],
              ['工艺规则拆分方式', row.detailSplitModeLabel],
              ['工艺规则拆分维度', row.detailSplitDimensionsText],
              ['工序默认可分配粒度', row.processAssignmentGranularityLabel],
              ['工序默认拆分方式', row.processDetailSplitModeLabel],
              ['工序默认拆分维度', row.processDetailSplitDimensionsText],
              ['是否特殊工艺', row.isSpecialCraft ? '是' : '否'],
              ['默认生成单据', row.defaultDocument],
            ] as Array<[string, string]>
          )
            .map(
              ([label, value]) => `
                <div class="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0">
                  <span class="text-muted-foreground">${escapeHtml(label)}</span>
                  <span class="text-right font-medium">${escapeHtml(value)}</span>
                </div>
              `,
            )
            .join('')}
        </div>

      </div>
    </aside>
  `
}

export function renderProductionCraftDictPage(): string {
  const list = filteredCraftRows()
  const selected = getProcessCraftDictRowByCode(state.viewCraftCode)
  const hasFilters = state.keyword || state.filterStage !== 'ALL' || state.filterGranularity !== 'ALL'

  return `
    <div class="flex min-h-[760px] flex-col bg-muted/20">
      <div class="border-b bg-background px-6 py-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="mb-0.5 flex items-center gap-2">
              <i data-lucide="book-open" class="h-5 w-5 text-primary"></i>
              <h1 class="text-lg font-semibold">工序工艺字典</h1>
              <span class="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">总览页</span>
              <span class="rounded border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">详情侧边弹窗</span>
            </div>
            <p class="text-sm text-muted-foreground">列表主数据来自老系统工艺映射，字段收敛为编码、工艺、工序、阶段、粒度、工艺规则拆分维度。</p>
          </div>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-craft-dict-action="refresh">
            <i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>刷新
          </button>
        </div>
      </div>

      <div class="flex-1 space-y-4 p-6">
        <div class="flex items-center gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <i data-lucide="info" class="h-3.5 w-3.5 shrink-0"></i>
          <span>准备阶段仅维护印花/染色工序字典项，不强行新增工艺映射行；分配粒度按现有工序规则计算。</span>
        </div>

        ${renderSummaryCards()}

        <div class="flex flex-wrap items-center gap-2">
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"></i>
            <input
              class="h-8 w-64 rounded-md border bg-background pl-8 pr-3 text-xs"
              placeholder="搜索编码 / 工艺 / 工序 / 阶段"
              value="${escapeHtml(state.keyword)}"
              data-craft-dict-field="keyword"
            />
          </div>
          <select class="h-8 w-32 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="filterStage">
            <option value="ALL" ${state.filterStage === 'ALL' ? 'selected' : ''}>全部阶段</option>
            ${craftStageDict
              .slice()
              .sort((a, b) => a.sort - b.sort)
              .map(
                (item) =>
                  `<option value="${item.stageCode}" ${state.filterStage === item.stageCode ? 'selected' : ''}>${escapeHtml(item.stageName)}</option>`,
              )
              .join('')}
          </select>
          <select class="h-8 w-32 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="filterGranularity">
            <option value="ALL" ${state.filterGranularity === 'ALL' ? 'selected' : ''}>全部粒度</option>
            <option value="ORDER" ${state.filterGranularity === 'ORDER' ? 'selected' : ''}>按生产单</option>
            <option value="COLOR" ${state.filterGranularity === 'COLOR' ? 'selected' : ''}>按颜色</option>
            <option value="SKU" ${state.filterGranularity === 'SKU' ? 'selected' : ''}>按SKU</option>
            <option value="DETAIL" ${state.filterGranularity === 'DETAIL' ? 'selected' : ''}>按明细行</option>
          </select>
          ${
            hasFilters
              ? '<button class="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted" data-craft-dict-action="clear-filters">清除筛选</button>'
              : ''
          }
          <span class="ml-auto text-xs text-muted-foreground">共 ${list.length} 条</span>
        </div>

        <div class="overflow-x-auto rounded-md border bg-background">
          <table class="w-full min-w-[980px] border-collapse">
            <thead>
              <tr class="bg-muted/30 text-xs">
                <th class="px-3 py-2 text-left">工序工艺编码</th>
                <th class="px-3 py-2 text-left">工艺名称</th>
                <th class="px-3 py-2 text-left">所属工序</th>
                <th class="px-3 py-2 text-left">所属阶段</th>
                <th class="px-3 py-2 text-left">分配粒度</th>
                <th class="px-3 py-2 text-left">工艺规则拆分维度</th>
              </tr>
            </thead>
            <tbody>
              ${
                list.length === 0
                  ? '<tr><td class="py-10 text-center text-sm text-muted-foreground" colspan="6">暂无数据，请调整筛选条件</td></tr>'
                  : list
                      .map(
                        (row) => `
                          <tr class="border-t text-xs hover:bg-muted/30">
                            <td class="whitespace-nowrap px-3 py-2 font-mono">
                              <button
                                class="rounded px-1 text-left text-primary hover:bg-muted"
                                data-craft-dict-action="open-detail"
                                data-craft-code="${escapeHtml(row.craftCode)}"
                              >
                                ${escapeHtml(row.craftCode)}
                              </button>
                            </td>
                            <td class="whitespace-nowrap px-3 py-2 font-medium">${escapeHtml(row.craftName)}</td>
                            <td class="whitespace-nowrap px-3 py-2">${escapeHtml(row.processName)}</td>
                            <td class="whitespace-nowrap px-3 py-2">${escapeHtml(row.stageName)}</td>
                            <td class="whitespace-nowrap px-3 py-2">
                              <span class="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">${escapeHtml(row.assignmentGranularityLabel)}</span>
                            </td>
                            <td class="max-w-[360px] px-3 py-2 text-muted-foreground">${escapeHtml(row.detailSplitDimensionsText)}</td>
                          </tr>
                        `,
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      ${selected ? renderCraftDetailSheet(selected) : ''}
    </div>
  `
}

export function handleProductionCraftDictEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-craft-dict-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.craftDictField
    if (!field) return true

    if (field === 'keyword') {
      state.keyword = fieldNode.value
      return true
    }
    if (field === 'filterStage') {
      state.filterStage = fieldNode.value as CraftDictState['filterStage']
      return true
    }
    if (field === 'filterGranularity') {
      state.filterGranularity = fieldNode.value as CraftDictState['filterGranularity']
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-craft-dict-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.craftDictAction
  if (!action) return false

  if (action === 'refresh') {
    return true
  }

  if (action === 'clear-filters') {
    state.keyword = ''
    state.filterStage = 'ALL'
    state.filterGranularity = 'ALL'
    return true
  }

  if (action === 'open-detail') {
    const craftCode = actionNode.dataset.craftCode
    if (craftCode) {
      state.viewCraftCode = craftCode
    }
    return true
  }

  if (action === 'close-sheet') {
    state.viewCraftCode = ''
    return true
  }

  return false
}

export function isProductionCraftDictDialogOpen(): boolean {
  return Boolean(state.viewCraftCode)
}

export function closeProductionCraftDictDialog(): void {
  state.viewCraftCode = ''
  appStore.navigate('/fcs/production/craft-dict')
}
