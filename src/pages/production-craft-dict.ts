import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  craftStageDict,
  getProcessCraftDictRowByCode,
  SAM_FACTORY_FIELD_GROUP_LABEL,
  listSamFactoryFieldDefinitions,
  processCraftDictRows,
  type CraftStageCode,
  type ProcessCraftDictRow,
} from '../data/fcs/process-craft-dict'
import { getFactorySupplyFormulaGuide } from '../data/fcs/process-craft-sam-explainer'
import { getSamBusinessFieldDescription, getSamBusinessFieldLabel } from '../data/fcs/sam-field-display'
import { type ProcessAssignmentGranularity } from '../data/fcs/process-types'

const PAGE_SIZE_OPTIONS = [10, 20, 50]

type CraftDictState = {
  keyword: string
  filterStage: 'ALL' | CraftStageCode
  filterGranularity: 'ALL' | ProcessAssignmentGranularity
  viewCraftCode: string
  detailTab: 'IDEAL' | 'CURRENT' | 'BASIC'
  page: number
  pageSize: number
}

const state: CraftDictState = {
  keyword: '',
  filterStage: 'ALL',
  filterGranularity: 'ALL',
  viewCraftCode: '',
  detailTab: 'CURRENT',
  page: 1,
  pageSize: 10,
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

function renderCompactDetailFields(fields: Array<[string, string]>): string {
  return `
    <div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      ${fields
        .map(
          ([label, value]) => `
            <div class="min-w-0">
              <p class="text-[11px] font-medium text-muted-foreground">${escapeHtml(label)}</p>
              <p class="mt-1 break-words text-sm leading-5 text-slate-700">${escapeHtml(value)}</p>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSamFieldGroups(fieldKeys: ProcessCraftDictRow['samIdealFieldKeys']): string {
  const groups = ['DEVICE', 'STAFF', 'ADJUSTMENT'].map((group) => ({
    group,
    label: SAM_FACTORY_FIELD_GROUP_LABEL[group as keyof typeof SAM_FACTORY_FIELD_GROUP_LABEL],
    fields: listSamFactoryFieldDefinitions(fieldKeys).filter((field) => field.group === group),
  }))

  return `
    <div class="grid gap-3 lg:grid-cols-3">
      ${groups
        .filter((group) => group.fields.length > 0)
        .map(
          (group) => `
            <div class="rounded-md border bg-muted/20 px-3 py-2" data-testid="sam-field-group">
              <p class="text-xs font-semibold text-slate-700">${escapeHtml(group.label)}</p>
              <div class="mt-2 space-y-1.5">
                ${group.fields
                  .map(
                    (field) => `
                      <p class="text-[11px] leading-4 text-slate-700" data-testid="sam-field-item">
                        <span class="font-medium">${escapeHtml(getSamBusinessFieldLabel(field.key))}：</span>
                        <span class="text-muted-foreground">${escapeHtml(getSamBusinessFieldDescription(field.key))}</span>
                      </p>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderCraftBasicPanel(row: ProcessCraftDictRow): string {
  return `
    <section class="space-y-3" data-testid="craft-basic-section">
      <p class="text-sm font-semibold">基础信息</p>
      ${renderCompactDetailFields([
        ['老系统值', String(row.legacyValue)],
        ['老系统工艺名称', row.legacyCraftName],
        ['工艺规则来源', row.ruleSourceLabel],
        [
          '规则继承说明',
          row.ruleSource === 'INHERIT_PROCESS' ? '当前工艺继承工序默认规则' : '当前工艺使用工艺级覆盖规则',
        ],
        ['工艺规则拆分方式', row.detailSplitModeLabel],
        ['工艺规则拆分维度', row.detailSplitDimensionsText],
        ['工序默认可分配粒度', row.processAssignmentGranularityLabel],
        ['工序默认拆分方式', row.processDetailSplitModeLabel],
        ['工序默认拆分维度', row.processDetailSplitDimensionsText],
        ['是否特殊工艺', row.isSpecialCraft ? '是' : '否'],
        ['工艺任务模式', row.taskTypeMode === 'CRAFT' ? '按工艺任务执行' : '按工序任务执行'],
      ])}
    </section>
  `
}

function renderIdealSamPanel(row: ProcessCraftDictRow): string {
  const formulaGuide = getFactorySupplyFormulaGuide(row.craftName)

  return `
    <section class="space-y-4" data-testid="craft-ideal-section">
      <p class="text-sm font-semibold">标准完整口径</p>
      <div class="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        ${[
          ['是否纳入产能管理', row.samEnabled ? '是' : '否'],
          ['SAM 核算方式', row.samCalcModeLabel],
          ['默认录入口径', row.samDefaultInputUnitLabel],
          ['能力约束来源', row.samConstraintSourceLabel],
        ]
          .map(
            ([label, value]) => `
              <div class="min-w-0">
                <p class="text-[11px] font-medium text-muted-foreground">${escapeHtml(label)}</p>
                <p class="mt-1 break-words text-sm leading-5 text-slate-700">${escapeHtml(value)}</p>
              </div>
            `,
          )
          .join('')}
      </div>

      <div class="rounded-md bg-slate-50 px-3 py-3">
        <p class="text-xs font-medium text-muted-foreground">工厂供给侧公式</p>
        <div class="mt-1 space-y-1 text-sm font-medium leading-6 text-slate-800">
          ${formulaGuide.idealFormulaLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground">理想完整字段</p>
        ${renderSamFieldGroups(row.samIdealFieldKeys)}
      </div>

      <div class="rounded-md bg-muted/20 px-3 py-2">
        <p class="text-xs font-medium text-muted-foreground">理想完整说明</p>
        <p class="mt-1 text-xs leading-5 text-slate-700">${escapeHtml(row.samIdealReason)}</p>
        <p class="mt-2 text-xs leading-5 text-slate-600">
          当前阶段口径不是另一套独立规则，而是从这套完整口径里收敛出来的最小必要字段集合。
        </p>
      </div>
    </section>
  `
}

function renderCurrentStagePanel(row: ProcessCraftDictRow): string {
  const formulaGuide = getFactorySupplyFormulaGuide(row.craftName)

  return `
    <section class="space-y-4" data-testid="craft-current-section">
      <p class="text-sm font-semibold">当前阶段口径</p>
      <div class="rounded-md bg-amber-50 px-3 py-3">
        <p class="text-xs font-medium text-amber-700">当前阶段最小必要字段</p>
        <p class="mt-1 text-xs leading-5 text-slate-700">${escapeHtml(row.samCurrentReason)}</p>
      </div>

      <div class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground">当前阶段最小必要字段</p>
        ${renderSamFieldGroups(row.samCurrentFieldKeys)}
      </div>

      <div class="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div class="space-y-3">
          <div class="rounded-md bg-slate-50 px-3 py-3">
            <p class="text-xs font-medium text-muted-foreground">当前阶段公式</p>
            <div class="mt-1 space-y-1 text-sm font-medium leading-6 text-slate-800">
              ${row.samCurrentFormulaLines
                .map(
                  (line) => `
                    <p>${escapeHtml(line)}</p>
                  `,
                )
                .join('')}
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-xs font-medium text-muted-foreground">当前阶段说明</p>
            <div class="grid gap-x-4 gap-y-1 text-xs leading-5 text-slate-700 sm:grid-cols-2">
              ${row.samCurrentExplanationLines
                .map(
                  (line) => `
                    <p>${escapeHtml(line)}</p>
                  `,
                )
                .join('')}
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div class="rounded-md bg-blue-50 px-3 py-3">
            <p class="text-xs font-medium text-blue-700">当前阶段示例</p>
            <div class="mt-2 space-y-1 text-sm leading-6 text-slate-800">
              ${row.samCurrentExampleLines
                .map(
                  (line) => `
                    <p>${escapeHtml(line)}</p>
                  `,
                )
                .join('')}
            </div>
          </div>

          <div class="rounded-md bg-amber-50 px-3 py-3">
            <p class="text-xs font-medium text-amber-700">结果字段说明</p>
            <p class="mt-1 text-xs leading-5 text-slate-700">
              默认日可供给发布工时 SAM 是系统根据当前阶段字段自动算出来的结果字段，不是工厂人工录入字段。
            </p>
            <p class="mt-2 text-xs leading-5 text-slate-700">
              ${escapeHtml(formulaGuide.currentReason)}
            </p>
          </div>
        </div>
      </div>
    </section>
  `
}

function renderCraftReferenceSamPanel(row: ProcessCraftDictRow): string {
  return `
    <section class="rounded-md border bg-blue-50/60 p-4" data-testid="craft-reference-sam-section">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-slate-900">工艺理论标准（参考）</p>
          <p class="mt-1 text-xs leading-5 text-slate-600">
            这里给的是平台参考值，用于技术包维护当前款发布工时 SAM 基线，不代表当前款最终值。
          </p>
        </div>
        <span class="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-medium text-blue-700">
          参考口径
        </span>
      </div>

      <div class="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-3">
        <div class="min-w-0">
          <p class="text-[11px] font-medium text-muted-foreground">理论参考发布工时</p>
          <p class="mt-1 break-words text-sm leading-5 text-slate-700">
            ${escapeHtml(`${row.referencePublishedSamValue} ${row.referencePublishedSamUnitLabel}`)}
          </p>
        </div>
        <div class="min-w-0">
          <p class="text-[11px] font-medium text-muted-foreground">默认推荐发布工时单位</p>
          <p class="mt-1 break-words text-sm leading-5 text-slate-700">
            ${escapeHtml(row.referencePublishedSamUnitLabel)}
          </p>
        </div>
        <div class="min-w-0">
          <p class="text-[11px] font-medium text-muted-foreground">参考说明</p>
          <p class="mt-1 break-words text-sm leading-5 text-slate-700">
            ${escapeHtml(row.referencePublishedSamNote)}
          </p>
        </div>
      </div>
    </section>
  `
}

function renderCraftDetailSheet(row: ProcessCraftDictRow): string {
  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-craft-dict-action="close-sheet"></div>
    <aside class="fixed inset-y-0 right-0 z-[121] w-full max-w-[960px] overflow-y-auto border-l bg-background shadow-xl" data-testid="craft-dict-detail-sheet">
      <header class="sticky top-0 border-b bg-background px-5 py-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">工艺详情</h3>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-craft-dict-action="close-sheet">关闭</button>
        </div>
      </header>

      <div class="space-y-4 p-5" data-testid="craft-dict-detail-body">
        <section class="rounded-md border bg-muted/20 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-lg font-semibold text-slate-900">${escapeHtml(row.craftName)}</p>
              <p class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(row.craftCode)}</p>
            </div>
            <div class="flex flex-wrap gap-1.5 text-[11px]">
              <span class="rounded border border-slate-200 bg-background px-2 py-0.5 font-medium text-slate-700">${escapeHtml(row.processName)}</span>
              <span class="rounded border border-slate-200 bg-background px-2 py-0.5 font-medium text-slate-700">${escapeHtml(row.stageName)}</span>
              <span class="rounded border border-slate-200 bg-background px-2 py-0.5 font-medium text-slate-700">${escapeHtml(row.assignmentGranularityLabel)}</span>
              <span class="rounded border border-slate-200 bg-background px-2 py-0.5 font-medium text-slate-700">${escapeHtml(row.defaultDocument)}</span>
            </div>
          </div>

          <div class="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            ${[
              ['老系统值', String(row.legacyValue)],
              ['老系统工艺名称', row.legacyCraftName],
              ['工艺规则来源', row.ruleSourceLabel],
              ['是否特殊工艺', row.isSpecialCraft ? '是' : '否'],
            ]
              .map(
                ([label, value]) => `
                  <div class="min-w-0">
                    <p class="text-[11px] font-medium text-muted-foreground">${escapeHtml(label)}</p>
                    <p class="mt-1 break-words text-sm leading-5 text-slate-700">${escapeHtml(value)}</p>
                  </div>
                `,
              )
              .join('')}
          </div>
        </section>

        ${renderCraftReferenceSamPanel(row)}

        <section class="rounded-md border bg-background" data-testid="craft-dict-detail-panel">
          <div class="flex flex-wrap gap-2 border-b px-4 py-3" data-testid="craft-dict-detail-tabs">
            ${[
              ['BASIC', '基础信息'],
              ['IDEAL', '标准完整口径'],
              ['CURRENT', '当前阶段口径'],
            ]
              .map(
                ([tab, label]) => `
                  <button
                    class="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium ${
                      state.detailTab === tab
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }"
                    data-craft-dict-action="switch-detail-tab"
                    data-detail-tab="${tab}"
                  >
                    ${escapeHtml(label)}
                  </button>
                `,
              )
              .join('')}
          </div>

          <div class="p-4" data-testid="craft-dict-detail-grid">
            ${
              state.detailTab === 'BASIC'
                ? renderCraftBasicPanel(row)
                : state.detailTab === 'IDEAL'
                  ? renderIdealSamPanel(row)
                  : renderCurrentStagePanel(row)
            }
          </div>
        </section>
      </div>
    </aside>
  `
}

function getPagination(rows: ProcessCraftDictRow[]) {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
  const currentPage = Math.min(Math.max(1, state.page), totalPages)
  const start = (currentPage - 1) * state.pageSize
  const end = start + state.pageSize

  return {
    rows: rows.slice(start, end),
    total,
    totalPages,
    currentPage,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : Math.min(end, total),
  }
}

export function renderProductionCraftDictPage(): string {
  const filtered = filteredCraftRows()
  const paging = getPagination(filtered)
  state.page = paging.currentPage
  const selected = getProcessCraftDictRowByCode(state.viewCraftCode)
  const hasFilters = state.keyword || state.filterStage !== 'ALL' || state.filterGranularity !== 'ALL'

  return `
    <div class="space-y-4">
      <header class="flex items-center" data-testid="craft-dict-page-header">
        <h1 class="text-xl font-semibold">工序工艺字典</h1>
      </header>

      <div class="space-y-4">
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
        </div>

        <section class="overflow-hidden rounded-md border bg-background" data-testid="craft-dict-table-section">
          <div class="overflow-x-auto">
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
                  paging.rows.length === 0
                    ? '<tr><td class="py-10 text-center text-sm text-muted-foreground" colspan="6">暂无数据，请调整筛选条件</td></tr>'
                    : paging.rows
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
          <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3" data-testid="craft-dict-pagination">
            <p class="text-xs text-muted-foreground">共 ${paging.total} 条${paging.total > 0 ? `，当前 ${paging.from}-${paging.to}` : ''}</p>
            <div class="flex flex-wrap items-center gap-2">
              <select class="h-8 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="pageSize">
                ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size} 条/页</option>`).join('')}
              </select>
              <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-craft-dict-action="prev-page" ${paging.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
              <span class="text-xs text-muted-foreground" data-testid="craft-dict-page-indicator">${paging.currentPage} / ${paging.totalPages}</span>
              <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage >= paging.totalPages ? 'cursor-not-allowed opacity-60' : ''}" data-craft-dict-action="next-page" ${paging.currentPage >= paging.totalPages ? 'disabled' : ''}>下一页</button>
            </div>
          </footer>
        </section>
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
      state.page = 1
      return true
    }
    if (field === 'filterStage') {
      state.filterStage = fieldNode.value as CraftDictState['filterStage']
      state.page = 1
      return true
    }
    if (field === 'filterGranularity') {
      state.filterGranularity = fieldNode.value as CraftDictState['filterGranularity']
      state.page = 1
      return true
    }
    if (field === 'pageSize' && fieldNode instanceof HTMLSelectElement) {
      state.pageSize = Number(fieldNode.value) || 10
      state.page = 1
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-craft-dict-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.craftDictAction
  if (!action) return false

  if (action === 'clear-filters') {
    state.keyword = ''
    state.filterStage = 'ALL'
    state.filterGranularity = 'ALL'
    state.page = 1
    return true
  }

    if (action === 'open-detail') {
      const craftCode = actionNode.dataset.craftCode
      if (craftCode) {
        state.viewCraftCode = craftCode
        state.detailTab = 'CURRENT'
      }
      return true
    }

  if (action === 'switch-detail-tab') {
    const tab = actionNode.dataset.detailTab as CraftDictState['detailTab'] | undefined
    if (tab) {
      state.detailTab = tab
    }
    return true
  }

  if (action === 'close-sheet') {
    state.viewCraftCode = ''
    state.detailTab = 'CURRENT'
    return true
  }

  if (action === 'prev-page') {
    state.page = Math.max(1, state.page - 1)
    return true
  }

  if (action === 'next-page') {
    const totalPages = Math.max(1, Math.ceil(filteredCraftRows().length / state.pageSize))
    state.page = Math.min(totalPages, state.page + 1)
    return true
  }

  return false
}

export function isProductionCraftDictDialogOpen(): boolean {
  return Boolean(state.viewCraftCode)
}

export function closeProductionCraftDictDialog(): void {
  state.viewCraftCode = ''
  state.detailTab = 'CURRENT'
  appStore.navigate('/fcs/production/craft-dict')
}
