// @page-pattern: dashboard
import { renderPrimaryButton } from '../../components/ui/button.ts'
import { renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { getPmsWorkbenchOverview, type PmsWorkbenchRisk } from '../../data/pms/workbench.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface } from './shared.ts'

const ROOT_SELECTOR = '[data-pms-workbench-root]'

const QUICK_ENTRIES = [
  { title: '商品采购建议', description: '按履约缺口与折扣生成采购单', href: '/pms/purchase-suggestions', icon: 'Lightbulb' },
  { title: '商品采购单', description: '维护采购单并生成面辅料需求', href: '/pms/product-purchase-orders', icon: 'FileText' },
  { title: 'KOL 采购需求', description: '入库、驳回与备注直播运营需求', href: '/pms/kol-demands', icon: 'Megaphone' },
  { title: '采购订单（花边）', description: '查看辅料工厂花边采购订单', href: '/pms/purchase-order', icon: 'Flower2' },
]

function renderRiskCard(risk: PmsWorkbenchRisk): string {
  const toneClass = {
    red: 'border-red-200 bg-red-50',
    yellow: 'border-amber-200 bg-amber-50',
    blue: 'border-blue-200 bg-blue-50',
  }[risk.tone]
  const toneText = {
    red: 'text-red-800',
    yellow: 'text-amber-800',
    blue: 'text-blue-800',
  }[risk.tone]
  return `<article class="rounded-lg border ${toneClass} p-4">
    <h3 class="text-sm font-semibold ${toneText}">${escapeHtml(risk.title)}</h3>
    <p class="mt-1 text-xs leading-5 text-slate-600">${escapeHtml(risk.detail)}</p>
    <button type="button" class="mt-3 h-8 rounded-md border bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(risk.href)}">${escapeHtml(risk.actionLabel)}</button>
  </article>`
}

export function renderPmsWorkbenchPage(): string {
  const overview = getPmsWorkbenchOverview()
  const statItems = overview.stats.map((stat) => ({ label: stat.label, value: stat.value }))
  const riskHtml = overview.risks.length
    ? `<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">${overview.risks.map(renderRiskCard).join('')}</div>`
    : '<p class="rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">当前没有需要处理的采购风险，采购链路运行正常。</p>'
  const entriesHtml = QUICK_ENTRIES.map(
    (entry) => `<button type="button" class="flex items-start gap-3 rounded-lg border bg-card p-4 text-left hover:border-blue-300 hover:bg-blue-50/40" data-nav="${escapeHtml(entry.href)}">
      <i data-lucide="${entry.icon}" class="mt-0.5 h-5 w-5 text-blue-600"></i>
      <span><span class="block text-sm font-semibold">${escapeHtml(entry.title)}</span><span class="mt-1 block text-xs text-slate-500">${escapeHtml(entry.description)}</span></span>
    </button>`,
  ).join('')

  return `<div ${ROOT_SELECTOR.slice(1, -1)} data-skip-page-rerender="true" class="space-y-4 p-4">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">采购管理工作台</h1>
        <p class="mt-1 text-sm text-muted-foreground">印尼工厂采购链路 · 建议、采购、面辅料、对账一页总览</p>
      </div>
      ${renderPrimaryButton('查看商品采购单', undefined, 'arrow-right').replace('<button', '<button data-nav="/pms/product-purchase-orders"')}
    </header>
    ${renderProcessOrderStats(statItems)}
    <section class="space-y-3">
      <h2 class="text-base font-semibold">需要处理</h2>
      ${riskHtml}
    </section>
    <section class="space-y-3">
      <h2 class="text-base font-semibold">快捷入口</h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">${entriesHtml}</div>
    </section>
    <section class="rounded-lg border bg-card p-4">
      <h2 class="text-base font-semibold">当前演示数据概览</h2>
      <dl class="mt-3 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div><dt class="text-xs text-muted-foreground">商品采购建议款式</dt><dd class="mt-1 text-lg font-semibold tabular-nums">${overview.suggestionStyleCount}</dd></div>
        <div><dt class="text-xs text-muted-foreground">有效商品采购单</dt><dd class="mt-1 text-lg font-semibold tabular-nums">${overview.purchaseOrderCount}</dd></div>
        <div><dt class="text-xs text-muted-foreground">面辅料需求单</dt><dd class="mt-1 text-lg font-semibold tabular-nums">${overview.materialRequirementCount}</dd></div>
        <div><dt class="text-xs text-muted-foreground">KOL 采购需求单</dt><dd class="mt-1 text-lg font-semibold tabular-nums">${overview.kolDemandCount}</dd></div>
      </dl>
      <p class="mt-3 text-xs text-muted-foreground">演示数据来自原 SRM 原型 Mock，代表原型演示场景，不代表真实工厂已发生业务。</p>
    </section>
  </div>`
}

export function handlePmsWorkbenchEvent(): boolean {
  return false
}

export function hydratePmsWorkbenchSurface(): void {
  hydratePmsSurface(document.querySelector(ROOT_SELECTOR))
}
