import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  craftStageDict,
  getDefaultProcessRouteOrder,
  getProcessCraftDictRowByCode,
  listProcessCraftDictRows,
  processDefinitions,
  type CraftStageCode,
  type ProcessAssignmentGranularity,
} from '../data/fcs/process-craft-dict'

type CraftDictState = {
  keyword: string
  stage: 'ALL' | CraftStageCode
  status: 'ACTIVE' | 'HISTORICAL' | 'ALL'
  detailCraftCode: string
  showRouteOrder: boolean
}

const state: CraftDictState = {
  keyword: '',
  stage: 'ALL',
  status: 'ACTIVE',
  detailCraftCode: '',
  showRouteOrder: false,
}

function listVisibleRows() {
  const keyword = state.keyword.trim().toLowerCase()
  return listProcessCraftDictRows(state.status === 'ALL' || state.status === 'HISTORICAL')
    .filter((row) => state.status === 'ALL' || (state.status === 'ACTIVE' ? row.isActive : !row.isActive))
    .filter((row) => state.stage === 'ALL' || row.stageCode === state.stage)
    .filter((row) => {
      if (!keyword) return true
      return [row.craftCode, row.craftName, row.processCode, row.processName, row.stageName]
        .some((value) => value.toLowerCase().includes(keyword))
    })
    .sort((left, right) => {
      const stageSort = (craftStageDict.find((item) => item.stageCode === left.stageCode)?.sort ?? 999)
        - (craftStageDict.find((item) => item.stageCode === right.stageCode)?.sort ?? 999)
      if (stageSort !== 0) return stageSort
      const routeSort = getDefaultProcessRouteOrder(left.processCode) - getDefaultProcessRouteOrder(right.processCode)
      if (routeSort !== 0) return routeSort
      return left.craftName.localeCompare(right.craftName, 'zh-CN')
    })
}

function renderSummary(): string {
  const stages = craftStageDict
    .slice()
    .sort((left, right) => left.sort - right.sort)
    .map((stage) => {
      const processes = processDefinitions
        .filter((process) => process.stageCode === stage.stageCode && process.isActive)
        .sort((left, right) => left.sort - right.sort)
      return `
        <article class="rounded-md border bg-background p-4" data-stage-code="${stage.stageCode}">
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-semibold">${escapeHtml(stage.stageName)}</h2>
            <span class="rounded-full bg-muted px-2 py-0.5 text-xs">${processes.length} 个工序</span>
          </div>
          <p class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(stage.description)}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            ${processes.map((process) => `<span class="rounded border bg-muted/20 px-2 py-1 text-xs">${escapeHtml(process.processName)}</span>`).join('')}
          </div>
          ${stage.stageCode === 'PREP' ? '<p class="mt-3 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">准备阶段只生成对应加工单，不进入生产任务清单、任务分配或合并任务。</p>' : ''}
          ${stage.stageCode === 'POST' ? '<p class="mt-3 rounded bg-blue-50 px-2 py-1.5 text-xs text-blue-800">质检、复检是回货流程节点，不是工序；后道阶段仅包含开扣眼、装扣子、烫包。</p>' : ''}
        </article>
      `
    })
    .join('')
  return `<section class="grid gap-3 lg:grid-cols-3" data-testid="process-stage-summary">${stages}</section>`
}

function renderRouteDialog(): string {
  if (!state.showRouteOrder) return ''
  const rows = processDefinitions
    .filter((process) => process.isActive)
    .sort((left, right) => getDefaultProcessRouteOrder(left.processCode) - getDefaultProcessRouteOrder(right.processCode))
  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-craft-dict-action="close-route-order"></div>
    <section class="fixed left-1/2 top-1/2 z-[121] max-h-[80vh] w-[680px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-background shadow-xl">
      <header class="flex items-center justify-between border-b px-5 py-4">
        <div><h2 class="text-lg font-semibold">基础工序顺序</h2><p class="mt-1 text-xs text-muted-foreground">仅用于技术包展示和业务追溯，不作为任务合并判断条件。</p></div>
        <button class="rounded-md border px-3 py-1.5 text-sm" data-craft-dict-action="close-route-order">关闭</button>
      </header>
      <div class="space-y-2 p-5">
        ${rows.map((row) => `<div class="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"><span class="w-14 text-muted-foreground">第 ${getDefaultProcessRouteOrder(row.processCode)} 位</span><span class="w-24">${escapeHtml(craftStageDict.find((stage) => stage.stageCode === row.stageCode)?.stageName ?? row.stageCode)}</span><strong>${escapeHtml(row.processName)}</strong></div>`).join('')}
      </div>
    </section>
  `
}

function renderDetailDialog(): string {
  const row = getProcessCraftDictRowByCode(state.detailCraftCode)
  if (!row) return ''
  const granularityLabels: Record<ProcessAssignmentGranularity, string> = {
    ORDER: '按生产单',
    COLOR: '按颜色',
    SKU: '按 SKU',
    DETAIL: '按明细行',
  }
  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-craft-dict-action="close-detail"></div>
    <section class="fixed right-0 top-0 z-[121] h-full w-[560px] max-w-[92vw] overflow-auto border-l bg-background shadow-xl">
      <header class="flex items-start justify-between border-b px-5 py-4">
        <div><h2 class="text-lg font-semibold">${escapeHtml(row.craftName)}</h2><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.craftCode)}</p></div>
        <button class="rounded-md border px-3 py-1.5 text-sm" data-craft-dict-action="close-detail">关闭</button>
      </header>
      <div class="grid grid-cols-2 gap-3 p-5 text-sm">
        ${[
          ['所属阶段', row.stageName],
          ['所属工序', row.processName],
          ['作用对象', row.targetObjectName],
          ['任务口径', row.taskScopeLabel],
          ['分配粒度', granularityLabels[row.assignmentGranularity]],
          ['是否生成生产任务', row.generatesExternalTaskLabel],
          ['默认单据', row.defaultDocument],
          ['状态', row.statusLabel],
        ].map(([label, value]) => `<div class="rounded-md border p-3"><p class="text-xs text-muted-foreground">${escapeHtml(label)}</p><p class="mt-1 font-medium">${escapeHtml(value)}</p></div>`).join('')}
        <div class="col-span-2 rounded-md border p-3"><p class="text-xs text-muted-foreground">业务说明</p><p class="mt-1 leading-6">${escapeHtml(row.remark || row.processNote || '按当前工序工艺字典执行。')}</p></div>
      </div>
    </section>
  `
}

export function renderProductionCraftDictPage(): string {
  const rows = listVisibleRows()
  return `
    <div class="space-y-4" data-production-craft-dict-page>
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">工序工艺字典</h1>
          <p class="mt-1 text-sm text-muted-foreground">展示阶段、工序、工艺及任务边界；任务合并在任务分配页处理。</p>
        </div>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-craft-dict-action="open-route-order">查看基础工序顺序</button>
      </header>
      ${renderSummary()}
      <section class="rounded-md border bg-background">
        <div class="flex flex-wrap items-center gap-2 border-b p-3">
          <input class="h-9 w-64 rounded-md border px-3 text-sm" placeholder="搜索编码 / 工序 / 工艺" value="${escapeHtml(state.keyword)}" data-craft-dict-field="keyword" />
          <select class="h-9 rounded-md border bg-background px-2 text-sm" data-craft-dict-field="stage">
            <option value="ALL">全部阶段</option>
            ${craftStageDict.map((stage) => `<option value="${stage.stageCode}" ${state.stage === stage.stageCode ? 'selected' : ''}>${escapeHtml(stage.stageName)}</option>`).join('')}
          </select>
          <select class="h-9 rounded-md border bg-background px-2 text-sm" data-craft-dict-field="status">
            <option value="ACTIVE" ${state.status === 'ACTIVE' ? 'selected' : ''}>可用</option>
            <option value="HISTORICAL" ${state.status === 'HISTORICAL' ? 'selected' : ''}>历史停用</option>
            <option value="ALL" ${state.status === 'ALL' ? 'selected' : ''}>全部状态</option>
          </select>
          <span class="ml-auto text-xs text-muted-foreground">共 ${rows.length} 条</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[980px] text-sm">
            <thead class="bg-muted/30 text-xs"><tr><th class="px-3 py-2 text-left">阶段</th><th class="px-3 py-2 text-left">工序</th><th class="px-3 py-2 text-left">工艺</th><th class="px-3 py-2 text-left">作用对象</th><th class="px-3 py-2 text-left">任务口径</th><th class="px-3 py-2 text-left">是否出生产任务</th><th class="px-3 py-2 text-left">状态</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((row) => `<tr class="border-t hover:bg-muted/20"><td class="px-3 py-2">${escapeHtml(row.stageName)}</td><td class="px-3 py-2 font-medium">${escapeHtml(row.processName)}</td><td class="px-3 py-2"><button class="text-primary hover:underline" data-craft-dict-action="open-detail" data-craft-code="${escapeHtml(row.craftCode)}">${escapeHtml(row.craftName)}</button><p class="text-[11px] text-muted-foreground">${escapeHtml(row.craftCode)}</p></td><td class="px-3 py-2">${escapeHtml(row.targetObjectName)}</td><td class="px-3 py-2">${escapeHtml(row.taskScopeLabel)}</td><td class="px-3 py-2">${escapeHtml(row.generatesExternalTaskLabel)}</td><td class="px-3 py-2">${escapeHtml(row.statusLabel)}</td></tr>`).join('') : '<tr><td colspan="7" class="py-10 text-center text-muted-foreground">暂无符合条件的数据</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
      ${renderDetailDialog()}
      ${renderRouteDialog()}
    </div>
  `
}

export function handleProductionCraftDictEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-craft-dict-field]')
  if (field) {
    const key = field.dataset.craftDictField
    if (key === 'keyword') state.keyword = field.value
    if (key === 'stage') state.stage = field.value as CraftDictState['stage']
    if (key === 'status') state.status = field.value as CraftDictState['status']
    return true
  }
  const action = target.closest<HTMLElement>('[data-craft-dict-action]')
  if (!action) return false
  if (action.dataset.craftDictAction === 'open-detail') state.detailCraftCode = action.dataset.craftCode || ''
  if (action.dataset.craftDictAction === 'close-detail') state.detailCraftCode = ''
  if (action.dataset.craftDictAction === 'open-route-order') state.showRouteOrder = true
  if (action.dataset.craftDictAction === 'close-route-order') state.showRouteOrder = false
  return true
}

export function isProductionCraftDictDialogOpen(): boolean {
  return Boolean(state.detailCraftCode || state.showRouteOrder)
}

export function closeProductionCraftDictDialog(): void {
  state.detailCraftCode = ''
  state.showRouteOrder = false
  appStore.navigate('/fcs/production/craft-dict')
}
