import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  getProcessAssignmentGranularity,
  processTypes,
  stageLabels,
  type ProcessAssignmentGranularity,
  type ProcessStage,
  type ProcessType,
} from '../data/fcs/process-types'

type CraftDictState = {
  keyword: string
  filterStage: 'ALL' | ProcessStage
  filterGranularity: 'ALL' | ProcessAssignmentGranularity
  viewProcessCode: string
}

const state: CraftDictState = {
  keyword: '',
  filterStage: 'ALL',
  filterGranularity: 'ALL',
  viewProcessCode: '',
}

const GRANULARITY_LABEL: Record<ProcessAssignmentGranularity, string> = {
  ORDER: '按生产单',
  COLOR: '按颜色',
  SKU: '按SKU',
}

function getProcessOverview(process: ProcessType): string {
  const ownerTypes = process.recommendedOwnerTypes.length > 0 ? process.recommendedOwnerTypes.join('、') : '-'
  return `推荐分配：${process.recommendedAssignmentMode === 'DIRECT' ? '直接派单' : '竞价'}；推荐承接方：${ownerTypes}`
}

function filteredProcesses(): ProcessType[] {
  const keyword = state.keyword.trim().toLowerCase()

  return processTypes.filter((process) => {
    if (state.filterStage !== 'ALL' && process.stage !== state.filterStage) return false

    if (state.filterGranularity !== 'ALL') {
      const granularity = getProcessAssignmentGranularity(process.code)
      if (granularity !== state.filterGranularity) return false
    }

    if (!keyword) return true

    return (
      process.code.toLowerCase().includes(keyword) ||
      process.nameZh.toLowerCase().includes(keyword) ||
      stageLabels[process.stage].toLowerCase().includes(keyword)
    )
  })
}

function getProcessByCode(code: string): ProcessType | undefined {
  return processTypes.find((process) => process.code === code)
}

function renderSummaryCards(): string {
  const total = processTypes.length
  const orderCount = processTypes.filter((process) => getProcessAssignmentGranularity(process.code) === 'ORDER').length
  const colorCount = processTypes.filter((process) => getProcessAssignmentGranularity(process.code) === 'COLOR').length
  const skuCount = processTypes.filter((process) => getProcessAssignmentGranularity(process.code) === 'SKU').length

  return `
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      ${[
        { label: '工序总数', value: total, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
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

function renderProcessDetailSheet(process: ProcessType): string {
  const granularity = getProcessAssignmentGranularity(process.code)

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
              ['工序编码', process.code],
              ['工序名称', process.nameZh],
              ['所属阶段', stageLabels[process.stage]],
              ['分配粒度', GRANULARITY_LABEL[granularity]],
              ['推荐分配方式', process.recommendedAssignmentMode === 'DIRECT' ? '直接派单' : '竞价分配'],
              ['可外协', process.canOutsource ? '可外协' : '不可外协'],
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

        <div class="space-y-2 rounded-md border p-4">
          <p class="text-sm font-semibold">默认质检点</p>
          <div class="flex flex-wrap gap-1.5">
            ${process.defaultQcPoints.length === 0
              ? '<span class="text-sm text-muted-foreground">-</span>'
              : process.defaultQcPoints
                  .map(
                    (item) => `<span class="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">${escapeHtml(item)}</span>`,
                  )
                  .join('')}
          </div>
        </div>

        <div class="space-y-2 rounded-md border p-4">
          <p class="text-sm font-semibold">默认参数</p>
          <div class="flex flex-wrap gap-1.5">
            ${process.defaultParamKeys.length === 0
              ? '<span class="text-sm text-muted-foreground">-</span>'
              : process.defaultParamKeys
                  .map(
                    (item) => `<span class="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">${escapeHtml(item)}</span>`,
                  )
                  .join('')}
          </div>
        </div>

        <div class="space-y-2 rounded-md border p-4">
          <p class="text-sm font-semibold">承接建议</p>
          <p class="text-sm text-muted-foreground">推荐承接方类型：${escapeHtml(process.recommendedOwnerTypes.join('、') || '-')}；推荐层级：${escapeHtml(process.recommendedOwnerTier)}</p>
          <p class="text-xs text-muted-foreground">工艺详情仅通过总览页 + 侧边弹窗查看，不在本页新增额外 Tab。</p>
        </div>
      </div>
    </aside>
  `
}

export function renderProductionCraftDictPage(): string {
  const list = filteredProcesses()
  const stageOptions = Array.from(new Set(processTypes.map((process) => process.stage)))
  const selectedProcess = getProcessByCode(state.viewProcessCode)
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
            <p class="text-sm text-muted-foreground">按工序展示标准母本，并明确每道工序的分配粒度（按生产单 / 按颜色 / 按SKU）</p>
          </div>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-craft-dict-action="refresh">
            <i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>刷新
          </button>
        </div>
      </div>

      <div class="flex-1 space-y-4 p-6">
        <div class="flex items-center gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <i data-lucide="info" class="h-3.5 w-3.5 shrink-0"></i>
          <span>字典详情只通过右侧弹窗展示，不新增页签；列表直接展示工序分配粒度，便于和运行时任务拆分规则对齐。</span>
        </div>

        ${renderSummaryCards()}

        <div class="flex flex-wrap items-center gap-2">
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"></i>
            <input
              class="h-8 w-64 rounded-md border bg-background pl-8 pr-3 text-xs"
              placeholder="搜索工序编码 / 工序名称 / 阶段"
              value="${escapeHtml(state.keyword)}"
              data-craft-dict-field="keyword"
            />
          </div>
          <select class="h-8 w-32 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="filterStage">
            <option value="ALL" ${state.filterStage === 'ALL' ? 'selected' : ''}>全部阶段</option>
            ${stageOptions
              .map((stage) => `<option value="${stage}" ${state.filterStage === stage ? 'selected' : ''}>${stageLabels[stage]}</option>`)
              .join('')}
          </select>
          <select class="h-8 w-32 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="filterGranularity">
            <option value="ALL" ${state.filterGranularity === 'ALL' ? 'selected' : ''}>全部粒度</option>
            <option value="ORDER" ${state.filterGranularity === 'ORDER' ? 'selected' : ''}>按生产单</option>
            <option value="COLOR" ${state.filterGranularity === 'COLOR' ? 'selected' : ''}>按颜色</option>
            <option value="SKU" ${state.filterGranularity === 'SKU' ? 'selected' : ''}>按SKU</option>
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
                <th class="px-3 py-2 text-left">工序编码</th>
                <th class="px-3 py-2 text-left">工序名称</th>
                <th class="px-3 py-2 text-left">所属阶段</th>
                <th class="px-3 py-2 text-left">分配粒度</th>
                <th class="px-3 py-2 text-left">简要说明</th>
                <th class="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                list.length === 0
                  ? '<tr><td class="py-10 text-center text-sm text-muted-foreground" colspan="6">暂无数据，请调整筛选条件</td></tr>'
                  : list
                      .map((process) => {
                        const granularity = getProcessAssignmentGranularity(process.code)
                        return `
                          <tr class="border-t text-xs hover:bg-muted/30">
                            <td class="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">${escapeHtml(process.code)}</td>
                            <td class="whitespace-nowrap px-3 py-2 font-medium">${escapeHtml(process.nameZh)}</td>
                            <td class="whitespace-nowrap px-3 py-2">${escapeHtml(stageLabels[process.stage])}</td>
                            <td class="whitespace-nowrap px-3 py-2">
                              <span class="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">${GRANULARITY_LABEL[granularity]}</span>
                            </td>
                            <td class="max-w-[420px] px-3 py-2 text-muted-foreground">
                              <p class="truncate" title="${escapeHtml(getProcessOverview(process))}">${escapeHtml(getProcessOverview(process))}</p>
                            </td>
                            <td class="whitespace-nowrap px-3 py-2 text-right">
                              <button
                                class="inline-flex h-6 items-center rounded-md px-2 text-[11px] hover:bg-muted"
                                data-craft-dict-action="open-detail"
                                data-process-code="${escapeHtml(process.code)}"
                              >
                                <i data-lucide="eye" class="mr-0.5 h-3 w-3"></i>查看详情
                              </button>
                            </td>
                          </tr>
                        `
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      ${selectedProcess ? renderProcessDetailSheet(selectedProcess) : ''}
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
    const processCode = actionNode.dataset.processCode
    if (processCode) {
      state.viewProcessCode = processCode
    }
    return true
  }

  if (action === 'close-sheet') {
    state.viewProcessCode = ''
    return true
  }

  return false
}

export function isProductionCraftDictDialogOpen(): boolean {
  return Boolean(state.viewProcessCode)
}

export function closeProductionCraftDictDialog(): void {
  state.viewProcessCode = ''
  appStore.navigate('/fcs/production/craft-dict')
}
