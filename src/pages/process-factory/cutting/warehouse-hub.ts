import {
  listCuttingSpecialCraftDispatchViews,
  listCuttingSpecialCraftReturnViews,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { getCuttingSewingDispatchSummary } from '../../../data/fcs/cutting/sewing-dispatch.ts'
import { escapeHtml } from '../../../utils.ts'
import { buildCutPieceWarehouseProjection } from './cut-piece-warehouse-projection.ts'
import { buildFabricWarehouseProjection } from './fabric-warehouse-projection.ts'
import { renderCompactKpiCard } from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta.ts'
import { getWarehouseSearchParams } from './warehouse-shared.ts'

type WaitProcessTabKey = 'overview' | 'fabric-warehouse' | 'special-craft-dispatch'
type WaitHandoverTabKey = 'overview' | 'cut-piece-warehouse' | 'special-craft-return' | 'sewing-dispatch'

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
}

function uniqueCount(values: Array<string | undefined>): number {
  return new Set(values.filter(Boolean)).size
}

function renderHubActionCard(options: {
  title: string
  description: string
  rows: Array<[string, string | number]>
  href: string
  actionLabel: string
}): string {
  return `
    <article class="rounded-xl border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-base font-semibold">${escapeHtml(options.title)}</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(options.description)}</p>
        </div>
        <button type="button" class="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(options.href)}">
          ${escapeHtml(options.actionLabel)}
        </button>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        ${options.rows
          .map(
            ([label, value]) => `
              <div class="rounded-lg border bg-background px-3 py-2">
                <dt class="text-xs text-muted-foreground">${escapeHtml(label)}</dt>
                <dd class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(String(value))}</dd>
              </div>
            `,
          )
          .join('')}
      </dl>
    </article>
  `
}

function renderHubGuideCard(title: string, lines: string[]): string {
  return `
    <article class="rounded-xl border border-dashed bg-muted/20 p-4 xl:col-span-2">
      <h2 class="text-base font-semibold">${escapeHtml(title)}</h2>
      <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
        ${lines
          .map(
            (line) => `
              <li class="flex gap-2">
                <span class="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                <span>${escapeHtml(line)}</span>
              </li>
            `,
          )
          .join('')}
      </ul>
    </article>
  `
}

function readTabKey<T extends string>(fallback: T, supportedTabs: readonly T[]): T {
  const raw = getWarehouseSearchParams().get('tab')
  return supportedTabs.includes(raw as T) ? (raw as T) : fallback
}

function buildHubTabHref(
  pageKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover',
  tabKey: string,
): string {
  const basePath = getCanonicalCuttingPath(pageKey)
  return tabKey === 'overview' ? basePath : `${basePath}?tab=${encodeURIComponent(tabKey)}`
}

function renderHubTabs(
  pageKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover',
  activeTab: string,
  tabs: Array<{ key: string; label: string }>,
): string {
  return `
    <section class="rounded-xl border bg-card p-2">
      <div class="flex flex-wrap gap-2">
        ${tabs
          .map((tab) => {
            const isActive = tab.key === activeTab
            return `
              <button
                type="button"
                class="rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'border bg-background text-slate-700 hover:bg-muted'}"
                data-nav="${escapeHtml(buildHubTabHref(pageKey, tab.key))}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderHubShell(options: {
  metaKey: 'warehouse-management-wait-process' | 'warehouse-management-wait-handover'
  description: string
  kpis: string
  tabs: string
  content: string
}): string {
  const meta = getCanonicalCuttingMeta('', options.metaKey)
  return `
    <div class="space-y-5">
      ${renderCuttingPageHeader(meta)}
      <section class="rounded-xl border bg-card p-4">
        <p class="text-sm text-muted-foreground">${escapeHtml(options.description)}</p>
      </section>
      ${options.tabs}
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${options.kpis}
      </section>
      <section class="grid gap-4 xl:grid-cols-2">
        ${options.content}
      </section>
    </div>
  `
}

export function renderCraftCuttingWarehouseManagementWaitProcessPage(): string {
  const fabricSummary = buildFabricWarehouseProjection().viewModel.summary
  const dispatchRows = listCuttingSpecialCraftDispatchViews()
  const generatedDispatchCount = dispatchRows.filter((row) => row.handoverRecordNo && row.handoverRecordNo !== '未创建').length
  const operationCount = uniqueCount(dispatchRows.map((row) => row.operationName))
  const factoryCount = uniqueCount(dispatchRows.map((row) => row.targetFactoryName))
  const activeTab = readTabKey<WaitProcessTabKey>('overview', ['overview', 'fabric-warehouse', 'special-craft-dispatch'])

  const fabricWarehouseCard = renderHubActionCard({
    title: '裁床仓',
    description: '查看裁床仓面料、卷号、长度和低余量状态。',
    href: getCanonicalCuttingPath('fabric-warehouse'),
    actionLabel: '进入裁床仓',
    rows: [
      ['面料 SKU 数', fabricSummary.stockItemCount],
      ['卷数', fabricSummary.rollCount],
      ['配置长度总量', `${formatNumber(fabricSummary.configuredLengthTotal)} m`],
      ['剩余长度总量', `${formatNumber(fabricSummary.remainingLengthTotal)} m`],
      ['低余量项数', fabricSummary.lowRemainingItemCount],
    ],
  })

  const specialCraftDispatchCard = renderHubActionCard({
    title: '特殊工艺待加工 / 发料',
    description: '查看待发特殊工艺菲票、发料单与接收状态。',
    href: getCanonicalCuttingPath('special-craft-dispatch'),
    actionLabel: '进入特殊工艺发料',
    rows: [
      ['待发记录数', dispatchRows.length],
      ['已生成发料单数', generatedDispatchCount],
      ['涉及工艺数', operationCount],
      ['涉及工厂数', factoryCount],
    ],
  })

  const contentByTab: Record<WaitProcessTabKey, string> = {
    overview: [
      fabricWarehouseCard,
      specialCraftDispatchCard,
      renderHubGuideCard('待加工仓层级说明', [
        '侧边栏仍只保留待加工仓入口，裁床仓与特殊工艺待加工 / 发料收在页内 Tab。',
        '发料单详情、扫码确认、异常处理和打印单据继续走列表行操作或次级页面，不提升为侧边栏菜单。',
      ]),
    ].join(''),
    'fabric-warehouse': [
      fabricWarehouseCard,
      renderHubGuideCard('裁床仓承接范围', [
        '继续承接原裁床仓的库存、卷号、长度、低余量和定位视角。',
        '配料、入仓明细和异常提示继续在裁床仓列表、详情抽屉或次级页面处理。',
      ]),
    ].join(''),
    'special-craft-dispatch': [
      specialCraftDispatchCard,
      renderHubGuideCard('特殊工艺待加工 / 发料承接范围', [
        '继续承接发往特殊工艺前的待加工与发料视角。',
        '发料单详情、异常处理、打印单据和扫码确认继续在列表行操作或次级页面处理。',
      ]),
    ].join(''),
  }

  return renderHubShell({
    metaKey: 'warehouse-management-wait-process',
    description: '在待加工总览、裁床仓和特殊工艺待加工 / 发料之间切换，旧能力继续通过页内 Tab、行操作和次级页面承接。',
    kpis: [
      renderCompactKpiCard('面料 SKU 数', fabricSummary.stockItemCount, '裁床仓', 'text-blue-600'),
      renderCompactKpiCard('卷数', fabricSummary.rollCount, '裁床仓', 'text-slate-700'),
      renderCompactKpiCard('配置长度总量', `${formatNumber(fabricSummary.configuredLengthTotal)} m`, '裁床仓', 'text-blue-600'),
      renderCompactKpiCard('待发特殊工艺记录数', dispatchRows.length, '特殊工艺发料', 'text-amber-600'),
    ].join(''),
    tabs: renderHubTabs('warehouse-management-wait-process', activeTab, [
      { key: 'overview', label: '待加工总览' },
      { key: 'fabric-warehouse', label: '裁床仓' },
      { key: 'special-craft-dispatch', label: '特殊工艺待加工 / 发料' },
    ]),
    content: contentByTab[activeTab],
  })
}

export function renderCraftCuttingWarehouseManagementWaitHandoverPage(): string {
  const cutPieceSummary = buildCutPieceWarehouseProjection().viewModel.summary
  const returnRows = listCuttingSpecialCraftReturnViews()
  const sewingSummary = getCuttingSewingDispatchSummary()
  const completedReturnCount = returnRows.filter((row) => row.returnStatus === '已回仓').length
  const returnDifferenceCount = returnRows.filter((row) => row.returnStatus === '差异' || row.differenceQty > 0).length
  const activeTab = readTabKey<WaitHandoverTabKey>('overview', [
    'overview',
    'cut-piece-warehouse',
    'special-craft-return',
    'sewing-dispatch',
  ])

  const cutPieceWarehouseCard = renderHubActionCard({
    title: '裁片仓',
    description: '查看裁片入仓、待交和库区位置。',
    href: getCanonicalCuttingPath('cut-piece-warehouse'),
    actionLabel: '进入裁片仓',
    rows: [
      ['记录数', cutPieceSummary.totalItemCount],
      ['裁片总数量', cutPieceSummary.totalQuantity],
      ['待交数量', cutPieceSummary.waitingHandoffCount],
      ['已入仓数量', cutPieceSummary.inWarehouseCount],
    ],
  })

  const specialCraftReturnCard = renderHubActionCard({
    title: '特殊工艺回仓',
    description: '查看特殊工艺回裁床后的回仓与差异。',
    href: getCanonicalCuttingPath('special-craft-return'),
    actionLabel: '进入特殊工艺回仓',
    rows: [
      ['回仓记录数', returnRows.length],
      ['已完成回仓数', completedReturnCount],
      ['差异数', returnDifferenceCount],
    ],
  })

  const sewingDispatchCard = renderHubActionCard({
    title: '裁片发料',
    description: '查看裁片发车缝前的齐套、交出和回写差异。',
    href: getCanonicalCuttingPath('sewing-dispatch'),
    actionLabel: '进入裁片发料',
    rows: [
      ['待配齐发料单数', sewingSummary.waitingCompleteOrderCount],
      ['可交出批次', sewingSummary.readyBatchCount],
      ['已交出批次', sewingSummary.handedOverBatchCount],
      ['差异批次', sewingSummary.differenceBatchCount],
    ],
  })

  const contentByTab: Record<WaitHandoverTabKey, string> = {
    overview: [
      cutPieceWarehouseCard,
      specialCraftReturnCard,
      sewingDispatchCard,
      renderHubGuideCard('待交出仓层级说明', [
        '侧边栏仍只保留待交出仓入口，裁片仓、特殊工艺回仓和裁片发料收在页内 Tab。',
        '交出详情、回仓确认、差异处理和打印单据继续走列表行操作或次级页面，不提升为侧边栏菜单。',
      ]),
    ].join(''),
    'cut-piece-warehouse': [
      cutPieceWarehouseCard,
      renderHubGuideCard('裁片仓承接范围', [
        '继续承接原裁片仓的入仓、待交出、库区位置和齐套状态视角。',
        '单据详情、入库确认和差异处理继续在列表行操作或详情抽屉中处理。',
      ]),
    ].join(''),
    'special-craft-return': [
      specialCraftReturnCard,
      renderHubGuideCard('特殊工艺回仓承接范围', [
        '继续承接特殊工艺完成后的回仓、差异和回流状态视角。',
        '回仓单详情、差异确认和打印单据继续在列表行操作或次级页面处理。',
      ]),
    ].join(''),
    'sewing-dispatch': [
      sewingDispatchCard,
      renderHubGuideCard('裁片发料承接范围', [
        '继续承接裁片齐套后发往车缝厂的配齐、交出和回写差异视角。',
        '裁片发料单详情、交出单详情、差异处理和打印单据继续在列表行操作或次级页面处理。',
      ]),
    ].join(''),
  }

  return renderHubShell({
    metaKey: 'warehouse-management-wait-handover',
    description: '在待交出总览、裁片仓、特殊工艺回仓和裁片发料之间切换，旧能力继续通过页内 Tab、行操作和次级页面承接。',
    kpis: [
      renderCompactKpiCard('裁片仓记录数', cutPieceSummary.totalItemCount, '裁片仓', 'text-blue-600'),
      renderCompactKpiCard('裁片总数量', cutPieceSummary.totalQuantity, '裁片仓', 'text-slate-700'),
      renderCompactKpiCard('待交数量', cutPieceSummary.waitingHandoffCount, '裁片仓', 'text-amber-600'),
      renderCompactKpiCard('特殊工艺回仓记录数', returnRows.length, '特殊工艺回仓', 'text-blue-600'),
      renderCompactKpiCard('可交出批次数', sewingSummary.readyBatchCount, '裁片发料', 'text-emerald-600'),
    ].join(''),
    tabs: renderHubTabs('warehouse-management-wait-handover', activeTab, [
      { key: 'overview', label: '待交出总览' },
      { key: 'cut-piece-warehouse', label: '裁片仓' },
      { key: 'special-craft-return', label: '特殊工艺回仓' },
      { key: 'sewing-dispatch', label: '裁片发料' },
    ]),
    content: contentByTab[activeTab],
  })
}
