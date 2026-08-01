import type { EngineeringBomResolvedDraft } from '../../data/pcs-engineering-bom-types.ts'
import { getTechnicalDataVersionBomWorkspace } from '../../data/pcs-engineering-bom-pricing.ts'
import { getTechnicalDataVersionContent } from '../../data/pcs-technical-data-version-repository.ts'
import { getTechPackReviewerById } from '../../data/pcs-tech-pack-reviewer-directory.ts'
import {
  currentUser,
  escapeHtml,
  isTechPackModuleReadOnly,
  state,
} from './context.ts'

const DEFAULT_PAGE_SIZE = 5
let materialPage = 1
let customCostPage = 1

function clampPage(value: number, totalPages: number): number {
  return Math.min(Math.max(1, value), Math.max(1, totalPages))
}

function formatCny(value: number | null): string {
  return value === null ? '-' : `¥ ${value.toFixed(2)}`
}

function formatIdr(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}

type BomPricingLocalRefreshRoot = Pick<ParentNode, 'querySelectorAll'>

function updateBomPricingSummary(
  root: BomPricingLocalRefreshRoot,
  values: Record<string, string>,
): void {
  root.querySelectorAll<HTMLElement>('[data-bom-pricing-summary]').forEach((node) => {
    const key = node.dataset.bomPricingSummary
    if (key && Object.hasOwn(values, key)) node.textContent = values[key] ?? ''
  })
}

export function refreshBomPricingWorkspaceLocally(input: {
  root: BomPricingLocalRefreshRoot
  workspace: EngineeringBomResolvedDraft
  technicalVersionId: string
}): void {
  const content = getTechnicalDataVersionContent(input.technicalVersionId)
  const lineByBomItemId = new Map(
    (content?.bomItems ?? []).map((item, index) => [item.id, input.workspace.materialLines[index]] as const),
  )

  input.root.querySelectorAll<HTMLElement>('[data-bom-pricing-row-cost]').forEach((node) => {
    const line = lineByBomItemId.get(node.dataset.bomPricingRowCost || '')
    if (line) node.textContent = formatCny(line.materialCostCny)
  })
  input.root.querySelectorAll<HTMLElement>('[data-bom-pricing-row-status]').forEach((node) => {
    const line = lineByBomItemId.get(node.dataset.bomPricingRowStatus || '')
    if (!line) return
    node.textContent = line.priceStatus
    node.className = `rounded-full px-2 py-1 text-xs ${line.priceStatus === '有效' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`
  })
  updateBomPricingSummary(input.root, {
    'material-cost-cny': formatCny(input.workspace.cost.materialCostCny),
    'custom-cost-idr': formatIdr(input.workspace.cost.customCostIdr),
    'exchange-rate': `1 CNY = ${input.workspace.cost.exchangeRateIdrPerCny.toLocaleString('id-ID')} IDR`,
    'comprehensive-cost-cny': formatCny(input.workspace.cost.comprehensiveCostCny),
    'comprehensive-cost-idr': formatIdr(input.workspace.cost.comprehensiveCostIdr),
  })
}

function renderPager(input: {
  page: number
  total: number
  pageSize: number
  actionPrefix: 'bom-material' | 'bom-custom-cost'
}): string {
  const totalPages = Math.max(1, Math.ceil(input.total / input.pageSize))
  const page = clampPage(input.page, totalPages)
  return `
    <div class="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
      <span>共 ${input.total} 条，第 ${page} 页 / 共 ${totalPages} 页，每页 ${input.pageSize} 条</span>
      <div class="flex gap-2">
        <button type="button" class="rounded border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50" data-tech-action="${input.actionPrefix}-previous-page" ${page <= 1 ? 'disabled' : ''}>上一页</button>
        <button type="button" class="rounded border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50" data-tech-action="${input.actionPrefix}-next-page" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `
}

export function setBomPricingPage(target: 'material' | 'customCost', nextPage: number): void {
  if (target === 'material') materialPage = Math.max(1, nextPage)
  else customCostPage = Math.max(1, nextPage)
}

export function getBomPricingPage(target: 'material' | 'customCost'): number {
  return target === 'material' ? materialPage : customCostPage
}

export function renderBomPricingWorkspace(input: {
  workspace: EngineeringBomResolvedDraft
  editable: boolean
  materialPage?: number
  customCostPage?: number
  pageSize?: number
  bomItemIds?: string[]
}): string {
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE
  const materialTotalPages = Math.max(1, Math.ceil(input.workspace.materialLines.length / pageSize))
  const currentMaterialPage = clampPage(input.materialPage ?? 1, materialTotalPages)
  const customCostTotalPages = Math.max(1, Math.ceil(input.workspace.customCosts.length / pageSize))
  const currentCustomCostPage = clampPage(input.customCostPage ?? 1, customCostTotalPages)
  const materialStart = (currentMaterialPage - 1) * pageSize
  const customCostStart = (currentCustomCostPage - 1) * pageSize
  const visibleMaterials = input.workspace.materialLines.slice(materialStart, materialStart + pageSize)
  const visibleCustomCosts = input.workspace.customCosts.slice(customCostStart, customCostStart + pageSize)

  return `
    <div class="space-y-5" data-testid="bom-pricing-workspace">
      <section class="rounded-lg border bg-card">
        <header class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h3 class="text-base font-semibold">BOM 与价格</h3>
            <p class="mt-1 text-xs text-muted-foreground">物料标准单价取自物料档案；自定义费用统一按印尼盾维护。</p>
          </div>
          ${input.editable ? '<span class="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">买手维护</span>' : '<span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">只读</span>'}
        </header>
        <div class="overflow-x-auto">
          <table class="min-w-[1180px] w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/30">
                <th class="px-3 py-2 text-left">物料</th>
                <th class="px-3 py-2 text-right">单位用量</th>
                <th class="px-3 py-2 text-right">打样数量</th>
                <th class="px-3 py-2 text-right">损耗率</th>
                <th class="px-3 py-2 text-left">用量单位</th>
                <th class="px-3 py-2 text-left">计价单位</th>
                <th class="px-3 py-2 text-right">换算系数</th>
                <th class="px-3 py-2 text-right">标准单价（CNY）</th>
                <th class="px-3 py-2 text-right">物料成本（CNY）</th>
                <th class="sticky right-0 z-10 bg-muted/30 px-3 py-2 text-left">状态</th>
              </tr>
            </thead>
            <tbody>
              ${visibleMaterials.length === 0
                ? '<tr><td colspan="10" class="px-3 py-8 text-center text-muted-foreground">暂无已关联物料 SKU 的 BOM 行</td></tr>'
                : visibleMaterials.map((line, visibleIndex) => {
                    const absoluteIndex = materialStart + visibleIndex
                    const bomItemId = input.bomItemIds?.[absoluteIndex] ?? line.materialSkuId
                    const editor = input.editable
                      ? {
                          usage: `<input class="h-8 w-24 rounded border px-2 text-right" type="number" min="0.0001" step="0.0001" value="${line.usage}" data-tech-field="bom-pricing-usage" data-bom-item-id="${escapeHtml(bomItemId)}" data-skip-input-rerender="true" />`,
                          quantity: `<input class="h-8 w-20 rounded border px-2 text-right" type="number" min="1" step="1" value="${line.sampleQuantity}" data-tech-field="bom-pricing-sample-quantity" data-bom-item-id="${escapeHtml(bomItemId)}" data-skip-input-rerender="true" />`,
                          loss: `<input class="h-8 w-20 rounded border px-2 text-right" type="number" min="0" max="99.99" step="0.01" value="${(line.lossRate * 100).toFixed(2)}" data-tech-field="bom-pricing-loss-rate" data-bom-item-id="${escapeHtml(bomItemId)}" data-skip-input-rerender="true" />`,
                          unit: `<input class="h-8 w-20 rounded border px-2" value="${escapeHtml(line.usageUnit)}" data-tech-field="bom-pricing-usage-unit" data-bom-item-id="${escapeHtml(bomItemId)}" data-skip-input-rerender="true" />`,
                        }
                      : { usage: line.usage, quantity: line.sampleQuantity, loss: `${(line.lossRate * 100).toFixed(2)}%`, unit: escapeHtml(line.usageUnit) }
                    return `
                      <tr class="border-b last:border-0" data-bom-pricing-row="${escapeHtml(bomItemId)}">
                        <td class="px-3 py-2"><div class="font-medium">${escapeHtml(line.materialName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.materialSkuCode)}</div></td>
                        <td class="px-3 py-2 text-right">${editor.usage}</td>
                        <td class="px-3 py-2 text-right">${editor.quantity}</td>
                        <td class="px-3 py-2 text-right">${editor.loss}</td>
                        <td class="px-3 py-2">${editor.unit}</td>
                        <td class="px-3 py-2">${escapeHtml(line.pricingUnit)}</td>
                        <td class="px-3 py-2 text-right">${line.conversionToPricingUnit > 0 ? line.conversionToPricingUnit.toFixed(4) : '-'}</td>
                        <td class="px-3 py-2 text-right font-mono">${line.standardUnitPriceCny === null ? '-' : line.standardUnitPriceCny.toFixed(4)}</td>
                        <td class="px-3 py-2 text-right font-medium" data-bom-pricing-row-cost="${escapeHtml(bomItemId)}">${formatCny(line.materialCostCny)}</td>
                        <td class="sticky right-0 bg-card px-3 py-2"><span class="rounded-full px-2 py-1 text-xs ${line.priceStatus === '有效' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}" data-bom-pricing-row-status="${escapeHtml(bomItemId)}">${escapeHtml(line.priceStatus)}</span></td>
                      </tr>
                    `
                  }).join('')}
            </tbody>
          </table>
        </div>
        ${renderPager({ page: currentMaterialPage, total: input.workspace.materialLines.length, pageSize, actionPrefix: 'bom-material' })}
      </section>

      <section class="rounded-lg border bg-card">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h3 class="text-base font-semibold">自定义费用（IDR）</h3>
          ${input.editable ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="add-bom-custom-cost">添加费用</button>' : ''}
        </header>
        <div class="overflow-x-auto">
          <table class="min-w-[720px] w-full text-sm">
            <thead><tr class="border-b bg-muted/30"><th class="px-3 py-2 text-left">费用名称</th><th class="px-3 py-2 text-right">金额（IDR）</th><th class="px-3 py-2 text-left">币种</th><th class="sticky right-0 bg-muted/30 px-3 py-2 text-left">操作</th></tr></thead>
            <tbody>
              ${visibleCustomCosts.length === 0
                ? '<tr><td colspan="4" class="px-3 py-8 text-center text-muted-foreground">暂无自定义费用</td></tr>'
                : visibleCustomCosts.map((cost, visibleIndex) => {
                    const index = customCostStart + visibleIndex
                    return `<tr class="border-b last:border-0">
                      <td class="px-3 py-2">${input.editable ? `<input class="h-8 w-full min-w-48 rounded border px-2" value="${escapeHtml(cost.title)}" data-tech-field="bom-custom-cost-title" data-cost-index="${index}" data-skip-input-rerender="true" />` : escapeHtml(cost.title)}</td>
                      <td class="px-3 py-2 text-right">${input.editable ? `<input class="h-8 w-36 rounded border px-2 text-right" type="number" min="0" step="1" value="${cost.amountIdr}" data-tech-field="bom-custom-cost-amount-idr" data-cost-index="${index}" data-skip-input-rerender="true" />` : formatIdr(cost.amountIdr)}</td>
                      <td class="px-3 py-2">IDR</td>
                      <td class="sticky right-0 bg-card px-3 py-2">${input.editable ? `<button type="button" class="text-red-600" data-tech-action="delete-bom-custom-cost" data-cost-index="${index}">删除</button>` : '-'}</td>
                    </tr>`
                  }).join('')}
            </tbody>
          </table>
        </div>
        ${renderPager({ page: currentCustomCostPage, total: input.workspace.customCosts.length, pageSize, actionPrefix: 'bom-custom-cost' })}
      </section>

      <section class="grid grid-cols-1 gap-3 md:grid-cols-5">
        <article class="rounded-lg border bg-card p-4"><p class="text-xs text-muted-foreground">物料成本</p><p class="mt-2 text-lg font-semibold" data-bom-pricing-summary="material-cost-cny">${formatCny(input.workspace.cost.materialCostCny)}</p></article>
        <article class="rounded-lg border bg-card p-4"><p class="text-xs text-muted-foreground">自定义费用</p><p class="mt-2 text-lg font-semibold" data-bom-pricing-summary="custom-cost-idr">${formatIdr(input.workspace.cost.customCostIdr)}</p></article>
        <article class="rounded-lg border bg-card p-4"><p class="text-xs text-muted-foreground">人民币/印尼盾汇率</p><p class="mt-2 text-lg font-semibold" data-bom-pricing-summary="exchange-rate">1 CNY = ${input.workspace.cost.exchangeRateIdrPerCny.toLocaleString('id-ID')} IDR</p></article>
        <article class="rounded-lg border bg-card p-4"><p class="text-xs text-muted-foreground">综合成本（CNY）</p><p class="mt-2 text-lg font-semibold text-blue-700" data-bom-pricing-summary="comprehensive-cost-cny">${formatCny(input.workspace.cost.comprehensiveCostCny)}</p></article>
        <article class="rounded-lg border bg-card p-4"><p class="text-xs text-muted-foreground">综合成本（IDR）</p><p class="mt-2 text-lg font-semibold text-blue-700" data-bom-pricing-summary="comprehensive-cost-idr">${formatIdr(input.workspace.cost.comprehensiveCostIdr)}</p></article>
      </section>
    </div>
  `
}

export function renderCostTab(): string {
  if (!state.currentTechnicalVersionId) {
    return '<div class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">未找到当前技术资料版本。</div>'
  }
  const reviewer = getTechPackReviewerById(currentUser.id)
  const editable = !isTechPackModuleReadOnly('COST') && Boolean(reviewer?.roles.includes('买手'))
  try {
    const workspace = getTechnicalDataVersionBomWorkspace(state.currentTechnicalVersionId)
    const content = getTechnicalDataVersionContent(state.currentTechnicalVersionId)
    return renderBomPricingWorkspace({
      workspace,
      editable,
      materialPage,
      customCostPage,
      pageSize: DEFAULT_PAGE_SIZE,
      bomItemIds: content?.bomItems.map((item) => item.id),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取 BOM 与价格失败。'
    return `<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">${escapeHtml(message)}</div>`
  }
}
