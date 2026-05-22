import {
  listCuttingSpecialCraftDispatchViews,
  listCuttingSpecialCraftReturnViews,
} from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import {
  getCuttingSewingDispatchBatchHandoverSummary,
  getCuttingSewingDispatchSummary,
  listAvailableCutPieceInventoryForSewingDispatch,
  listAvailableSkuInventoryForSewingDispatch,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingDispatchValidationResults,
  listCuttingSewingTransferBags,
} from '../../../data/fcs/cutting/sewing-dispatch.ts'
import { getHandoverOrderById } from '../../../data/fcs/pda-handover-events.ts'
import { getHandoverOrderStatusLabel } from '../../../data/fcs/task-handover-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import { buildCutPieceWarehouseProjection } from './cut-piece-warehouse-projection.ts'
import { buildFabricWarehouseProjection } from './fabric-warehouse-projection.ts'
import { renderCompactKpiCard, renderStickyTableScroller } from './layout.helpers.ts'
import { buildMaterialPrepProjection } from './material-prep-projection.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta.ts'
import { buildTransferBagsProjection } from './transfer-bags-projection.ts'
import { getWarehouseSearchParams } from './warehouse-shared.ts'
import {
  renderFactoryWarehouseStandardTabs,
  renderWarehouseLocationActions,
  renderWarehouseLocationToolbar,
  type FactoryWarehouseStandardTab,
} from '../shared/warehouse-standard.ts'

type WaitProcessTabKey = 'inventory' | 'receipts' | 'usage' | 'locations'
type WaitHandoverTabKey = 'inventory' | 'assignment' | 'sorting' | 'handoverOrders' | 'handoverRecords' | 'locations'

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
}

function formatLength(value: number): string {
  return `${formatNumber(value)} m`
}

function uniqueCount(values: Array<string | undefined>): number {
  return new Set(values.filter(Boolean)).size
}

function buildWaitProcessMaterialLedgerSummary() {
  const projection = buildMaterialPrepProjection()
  const lineItems = projection.rows.flatMap((row) => row.materialLineItems)
  const requiredQty = lineItems.reduce((sum, item) => sum + Number(item.requiredQty || 0), 0)
  const configuredQty = lineItems.reduce((sum, item) => sum + Number(item.configuredQty || 0), 0)
  const claimedQty = lineItems.reduce((sum, item) => sum + Number(item.claimedQty || 0), 0)
  const lockedQty = projection.rows
    .filter((row) => row.latestMarkerPlanNo || row.markerPlanNos.length > 0)
    .flatMap((row) => row.materialLineItems)
    .reduce((sum, item) => sum + Number(item.claimedQty || 0), 0)
  const availableQty = Math.min(
    claimedQty,
    buildFabricWarehouseProjection().viewModel.summary.remainingLengthTotal,
  )
  const consumedQty = Math.max(claimedQty - lockedQty - availableQty, 0)

  return {
    requiredQty,
    configuredQty,
    claimedQty,
    lockedQty,
    consumedQty,
    availableQty,
  }
}

function getSafeCuttingSewingDispatchSummary(): ReturnType<typeof getCuttingSewingDispatchSummary> {
  try {
    return getCuttingSewingDispatchSummary()
  } catch {
    return {
      waitingCompleteOrderCount: 0,
      readyBatchCount: 0,
      handedOverBatchCount: 0,
      writtenBackBatchCount: 0,
      differenceBatchCount: 0,
      objectionBatchCount: 0,
      remainingGarmentQty: 0,
    }
  }
}

function renderHubActionCard(options: {
  title: string
  rows: Array<[string, string | number]>
}): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-base font-semibold">${escapeHtml(options.title)}</h2>
        </div>
      </div>
      <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        ${options.rows
          .map(
            ([label, value]) => `
              <div class="rounded-md border bg-background px-3 py-2">
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
    <article class="rounded-lg border border-dashed bg-muted/20 p-4 xl:col-span-2">
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

function renderHubTable(headers: string[], rows: string[][], emptyText = '暂无数据'): string {
  if (!rows.length) {
    return `<div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }
  const tableHtml = `
    <table class="min-w-[960px] w-full text-left text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
        <tr>
          ${headers.map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => `
            <tr class="border-b last:border-b-0">
              ${row.map((cell) => `<td class="px-3 py-3 align-top">${escapeHtml(cell)}</td>`).join('')}
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `
  return `
    <div class="rounded-lg border bg-card">
      ${renderStickyTableScroller(tableHtml, 'max-h-[28rem]')}
    </div>
  `
}

function renderLocationRows(scopeLabel: string, rows: Array<[string, string, string, string]>): string {
  const tableHtml = `
    <table class="min-w-[960px] w-full text-left text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground">
        <tr>
          <th class="px-3 py-2 font-medium">仓库</th>
          <th class="px-3 py-2 font-medium">库区</th>
          <th class="px-3 py-2 font-medium">库位</th>
          <th class="px-3 py-2 font-medium">承载对象</th>
          <th class="px-3 py-2 font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(([warehouse, area, location, object]) => `
            <tr class="border-b last:border-b-0">
              <td class="px-3 py-3">${escapeHtml(warehouse)}</td>
              <td class="px-3 py-3">${escapeHtml(area)}</td>
              <td class="px-3 py-3">${escapeHtml(location)}</td>
              <td class="px-3 py-3">${escapeHtml(object)}</td>
              <td class="px-3 py-3">${renderWarehouseLocationActions(scopeLabel, `${area}/${location}`)}</td>
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `
  return `
    <div class="rounded-lg border bg-card">
      ${renderStickyTableScroller(tableHtml, 'max-h-[28rem]')}
    </div>
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
    <section class="rounded-lg border bg-card p-2">
      <div class="flex flex-wrap gap-2">
        ${tabs
          .map((tab) => {
            const isActive = tab.key === activeTab
            return `
              <button
                type="button"
                class="rounded-md px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'border bg-background text-slate-700 hover:bg-muted'}"
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
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${options.kpis}
      </section>
      ${options.tabs}
      ${options.content}
    </div>
  `
}

export function renderCraftCuttingWarehouseManagementWaitProcessPage(): string {
  const fabricSummary = buildFabricWarehouseProjection().viewModel.summary
  const materialLedgerSummary = buildWaitProcessMaterialLedgerSummary()
  const dispatchRows = listCuttingSpecialCraftDispatchViews()
  const generatedDispatchCount = dispatchRows.filter((row) => row.handoverRecordNo && row.handoverRecordNo !== '未创建').length
  const operationCount = uniqueCount(dispatchRows.map((row) => row.operationName))
  const factoryCount = uniqueCount(dispatchRows.map((row) => row.targetFactoryName))
  const activeTab = readTabKey<WaitProcessTabKey>('inventory', ['inventory', 'receipts', 'usage', 'locations'])

  const fabricWarehouseCard = renderHubActionCard({
    title: '待加工仓面料数量账',
    rows: [
      ['需求用量', formatLength(materialLedgerSummary.requiredQty)],
      ['中转仓已配', formatLength(materialLedgerSummary.configuredQty)],
      ['裁床已领', formatLength(materialLedgerSummary.claimedQty)],
      ['已锁定', formatLength(materialLedgerSummary.lockedQty)],
      ['已消耗', formatLength(materialLedgerSummary.consumedQty)],
      ['可用余额', formatLength(materialLedgerSummary.availableQty)],
    ],
  })

  const specialCraftDispatchCard = renderHubActionCard({
    title: '特殊工艺待加工 / 交出',
    rows: [
      ['待发记录数', dispatchRows.length],
      ['已生成交出单数', generatedDispatchCount],
      ['涉及工艺数', operationCount],
      ['涉及工厂数', factoryCount],
    ],
  })

  const standardTabs: FactoryWarehouseStandardTab[] = [
    {
      key: 'inventory',
      label: '库存',
      count: fabricSummary.stockItemCount + dispatchRows.length,
      content: `<section class="grid gap-4 xl:grid-cols-2">${fabricWarehouseCard}${specialCraftDispatchCard}</section>`,
    },
    {
      key: 'receipts',
      label: '领料记录',
      count: fabricSummary.rollCount + generatedDispatchCount,
      content: `<section class="grid gap-4 xl:grid-cols-2">
        ${renderHubActionCard({
          title: '面料领料记录',
          rows: [
            ['领料卷数', fabricSummary.rollCount],
            ['面料 SKU 数', fabricSummary.stockItemCount],
            ['裁床已领', formatLength(materialLedgerSummary.claimedQty)],
            ['可用余额', formatLength(materialLedgerSummary.availableQty)],
          ],
        })}
        ${renderHubActionCard({
          title: '特殊工艺交出记录',
          rows: [
            ['待发记录数', dispatchRows.length],
            ['已生成交出单数', generatedDispatchCount],
            ['涉及工艺数', operationCount],
            ['涉及工厂数', factoryCount],
          ],
        })}
      </section>`,
    },
    {
      key: 'usage',
      label: '加工用料记录',
      count: fabricSummary.stockItemCount,
      content: `<section class="grid gap-4 xl:grid-cols-2">
        ${renderHubActionCard({
          title: '铺布裁剪用料',
          rows: [
            ['配置长度总量', `${formatNumber(fabricSummary.configuredLengthTotal)} m`],
            ['剩余长度总量', `${formatNumber(fabricSummary.remainingLengthTotal)} m`],
            ['已消耗', formatLength(materialLedgerSummary.consumedQty)],
            ['低余量项数', fabricSummary.lowRemainingItemCount],
          ],
        })}
        ${renderHubGuideCard('用料口径', ['待加工仓库存由领料形成。', '铺布、裁剪、特殊工艺交出会扣减待加工仓库存。'])}
      </section>`,
    },
    {
      key: 'locations',
      label: '库区库位',
      count: 3,
      content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('裁床待加工仓')}</div>${renderLocationRows('裁床待加工仓', [
        ['裁床待加工仓', '面料 A 区', 'FAB-A-01', '待裁面料'],
        ['裁床待加工仓', '面料 B 区', 'FAB-B-02', '补料 / 余料'],
        ['特殊工艺待交出区', '交出暂存区', 'SP-DISPATCH-01', '待交出特殊工艺裁片'],
      ])}`,
    },
  ]

  return renderHubShell({
    metaKey: 'warehouse-management-wait-process',
    description: '查看领料接收后的待加工仓、裁床仓和特殊工艺待加工。',
    kpis: [
      renderCompactKpiCard('面料 SKU 数', fabricSummary.stockItemCount, '裁床仓', 'text-blue-600'),
      renderCompactKpiCard('中转仓已配', formatLength(materialLedgerSummary.configuredQty), '待加工仓面料数量账', 'text-blue-600'),
      renderCompactKpiCard('裁床已领', formatLength(materialLedgerSummary.claimedQty), '待加工仓面料数量账', 'text-slate-700'),
      renderCompactKpiCard('可用余额', formatLength(materialLedgerSummary.availableQty), '待加工仓面料数量账', 'text-emerald-600'),
      renderCompactKpiCard('待交出特殊工艺记录数', dispatchRows.length, '特殊工艺交出', 'text-amber-600'),
    ].join(''),
    tabs: '',
    content: renderFactoryWarehouseStandardTabs(
      standardTabs.sort((a, b) => Number(b.key === activeTab) - Number(a.key === activeTab)),
      'cutting-wait-process-standard-tabs',
    ),
  })
}

export function renderCraftCuttingWarehouseManagementWaitHandoverPage(): string {
  const cutPieceViewModel = buildCutPieceWarehouseProjection().viewModel
  const cutPieceSummary = cutPieceViewModel.summary
  const transferBagViewModel = buildTransferBagsProjection().viewModel
  const dispatchOrders = listCuttingSewingDispatchOrders()
  const dispatchBatches = listCuttingSewingDispatchBatches()
  const transferBags = listCuttingSewingTransferBags()
  const validationResults = listCuttingSewingDispatchValidationResults()
  const availableSewingPieceInventory = listAvailableCutPieceInventoryForSewingDispatch()
  const availableSewingSkuInventory = listAvailableSkuInventoryForSewingDispatch()
  const returnRows = listCuttingSpecialCraftReturnViews()
  const sewingSummary = getSafeCuttingSewingDispatchSummary()
  const completedReturnCount = returnRows.filter((row) => row.returnStatus === '已回仓').length
  const returnDifferenceCount = returnRows.filter((row) => row.returnStatus === '差异' || row.differenceQty > 0).length
  const activeTab = readTabKey<WaitHandoverTabKey>('inventory', ['inventory', 'assignment', 'sorting', 'handoverOrders', 'handoverRecords', 'locations'])
  const assignedTaskCount = dispatchBatches.length
  const availableSewingFeiTicketCount = availableSewingPieceInventory.reduce((total, line) => total + line.availableFeiTicketCount, 0)
  const availableSewingPieceQty = availableSewingPieceInventory.reduce((total, line) => total + line.availablePieceQty, 0)
  const sortingTaskSummary = transferBagViewModel.sortingTaskSummary
  const pendingSortingUsageCount = sortingTaskSummary.pendingCount + sortingTaskSummary.sortingCount
  const sortedUsageCount = sortingTaskSummary.packedCount + sortingTaskSummary.handedOverCount
  const handoverRecordCount = dispatchBatches.filter((batch) => batch.handoverRecordNo).length
  const exceptionValidationCount = validationResults.filter((result) => result.validationType !== '通过').length

  const cutPieceWarehouseCard = renderHubActionCard({
    title: '裁片库存',
    rows: [
      ['记录数', cutPieceSummary.totalItemCount],
      ['裁片总数量', cutPieceSummary.totalQuantity],
      ['菲票库存', transferBagViewModel.ticketCandidates.length],
      ['已入仓数量', cutPieceSummary.inWarehouseCount],
      ['待交出数量', cutPieceSummary.waitingHandoffCount],
    ],
  })

  const specialCraftReturnCard = renderHubActionCard({
    title: '特殊工艺回仓补入库存',
    rows: [
      ['回仓记录数', returnRows.length],
      ['已完成回仓数', completedReturnCount],
      ['差异数', returnDifferenceCount],
    ],
  })

  const sewingAssignmentCard = renderHubActionCard({
    title: '车缝任务分配',
    rows: [
      ['可分配菲票数', availableSewingFeiTicketCount],
      ['可分配裁片数量', availableSewingPieceQty],
      ['已创建分配批次', dispatchBatches.length],
      ['涉及交出单数', dispatchOrders.length],
      ['涉及生产单数', uniqueCount(availableSewingSkuInventory.map((line) => line.productionOrderNo))],
    ],
  })

  const sortingCard = renderHubActionCard({
    title: '待交出仓配料',
    rows: [
      ['裁片配料任务', sortingTaskSummary.taskCount],
      ['待分拣 / 分拣中', pendingSortingUsageCount],
      ['已装袋 / 已交出', sortedUsageCount],
      ['来源暂存袋数', sortingTaskSummary.sourceTempBagCount],
      ['目标中转袋数', sortingTaskSummary.targetTransferBagCount],
      ['校验异常数', exceptionValidationCount],
    ],
  })

  const sewingDispatchCard = renderHubActionCard({
    title: '交出单',
    rows: [
      ['交出单数', dispatchOrders.length],
      ['待核对 / 待扫码', sewingSummary.waitingCompleteOrderCount],
      ['可新增交出记录', sewingSummary.readyBatchCount],
      ['已交出记录', handoverRecordCount],
      ['差异记录', sewingSummary.differenceBatchCount],
    ],
  })

  const cutPieceInventoryRows = cutPieceViewModel.items.slice(0, 8).map((item) => [
    item.cutOrderNo,
    item.productionOrderNo,
    item.materialSku,
    `${item.quantity} 片`,
    item.warehouseStatus.label.replace('交接', '交出'),
    item.bagCode ? `${item.bagCode}${item.bagUsageStageLabel ? ` / ${item.bagUsageStageLabel}` : ''}` : '未入暂存袋',
  ])
  const sewingInventoryRows = availableSewingSkuInventory.slice(0, 8).map((line) => [
    line.productionOrderNo,
    `${line.colorName} / ${line.sizeCode}`,
    line.partNames.join('、') || '未汇总',
    `${line.availableFeiTicketCount} 张`,
    `${line.availablePieceQty} 片`,
    line.cutOrderNos.join('、') || '未关联裁片单',
  ])
  const sewingDispatchBatchRows = dispatchBatches.slice(0, 8).map((batch) => [
    batch.dispatchBatchNo,
    batch.productionOrderNo,
    batch.plannedSkuQtyLines.map((line) => `${line.colorName}/${line.sizeCode}`).join('、'),
    `${batch.plannedGarmentQty} 件`,
    `${batch.feiTicketNos.length} 张`,
    batch.status,
  ])
  const sortingRows = transferBagViewModel.sortingTasks.slice(0, 8).map((task) => [
    task.sortingTaskNo,
    task.dispatchBatchNo,
    task.sourceTempBagNos.join('、') || '待从暂存袋拣货',
    task.targetTransferBagNos.join('、') || '待生成',
    `${task.pickedTicketCount}/${task.expectedTicketCount} 张`,
    task.targetFactoryName,
    task.status,
  ])
  const handoverOrderRows = dispatchOrders.slice(0, 8).map((order) => {
    const handoverHead = order.handoverOrderId ? getHandoverOrderById(order.handoverOrderId) : undefined
    return [
      handoverHead?.handoverOrderNo || order.handoverOrderNo || order.dispatchOrderNo,
      order.productionOrderNo,
      handoverHead?.receiverName || order.sewingFactoryName,
      `${order.plannedDispatchGarmentQty} 件`,
      `${handoverHead?.recordCount ?? order.handoverRecordIds.length} 条记录`,
      handoverHead ? getHandoverOrderStatusLabel(handoverHead.handoverOrderStatus) : '待生成',
    ]
  })
  const handoverRecordRows = dispatchBatches.slice(0, 8).map((batch) => {
    const summary = getCuttingSewingDispatchBatchHandoverSummary(batch.dispatchBatchId)
    const gapPreview = summary?.gapLines
      .slice(0, 2)
      .map((line) =>
        `${line.colorName}/${line.sizeCode}/${line.partName}${
          line.missingPieceQty > 0
            ? `缺 ${line.missingPieceQty} 片`
            : line.overPieceQty > 0
              ? `多 ${line.overPieceQty} 片`
              : line.statusLabel
        }`,
      )
      .join('；')
    return [
      batch.dispatchBatchNo,
      batch.productionOrderNo,
      batch.handoverRecordNo || '待新增',
      `${summary?.previousSubmittedPieceQty ?? 0} 片`,
      `${summary?.currentSubmittedPieceQty ?? 0} 片`,
      `${summary?.cumulativeSubmittedPieceQty ?? 0} 片`,
      summary?.completeAfterSubmit ? '交出后齐套' : gapPreview || '交出后仍有缺口',
      `${batch.transferBagIds.length} 袋`,
      batch.status,
    ]
  })

  const standardTabs: FactoryWarehouseStandardTab[] = [
    {
      key: 'inventory',
      label: '裁片库存',
      count: cutPieceSummary.totalItemCount,
      content: `<section class="space-y-4">
        <div class="grid gap-4 xl:grid-cols-2">${cutPieceWarehouseCard}${specialCraftReturnCard}</div>
        ${renderHubTable(['裁片单', '生产单', '面料', '库存数量', '库存状态', '入仓暂存袋'], cutPieceInventoryRows)}
      </section>`,
    },
    {
      key: 'assignment',
      label: '车缝任务分配',
      count: assignedTaskCount,
      content: `<section class="space-y-4">
        ${sewingAssignmentCard}
        ${renderHubTable(['生产单', '颜色 / 尺码', '可分配部位', '可分配菲票', '可分配裁片', '裁片单'], sewingInventoryRows)}
        ${renderHubTable(['交出记录', '生产单', '颜色 / 尺码', '本次分配', '已装袋菲票', '状态'], sewingDispatchBatchRows)}
      </section>`,
    },
    {
      key: 'sorting',
      label: '待交出仓配料',
      count: pendingSortingUsageCount,
      content: `<section class="space-y-4">
        ${sortingCard}
        ${renderHubTable(['配料任务', '交出记录', '来源暂存袋', '目标中转袋', '已分拣菲票', '接收对象', '状态'], sortingRows)}
      </section>`,
    },
    {
      key: 'handoverOrders',
      label: '交出单',
      count: dispatchOrders.length,
      content: `<section class="space-y-4">
        ${sewingDispatchCard}
        ${renderHubTable(['交出单', '生产单', '接收对象', '计划交出', '交出记录', '状态'], handoverOrderRows)}
      </section>`,
    },
    {
      key: 'handoverRecords',
      label: '交出记录',
      count: handoverRecordCount,
      content: `<section class="space-y-4">
        ${renderHubActionCard({
          title: '交出记录',
          rows: [
            ['已生成记录数', handoverRecordCount],
            ['已交出批次', sewingSummary.handedOverBatchCount],
            ['已回写批次', sewingSummary.writtenBackBatchCount],
            ['差异 / 异议批次', sewingSummary.differenceBatchCount + sewingSummary.objectionBatchCount],
          ],
        })}
        ${renderHubTable(['交出记录来源', '生产单', '交出记录', '之前已交', '本次交出', '累计交出', '交出后结果', '中转袋', '状态'], handoverRecordRows)}
      </section>`,
    },
    {
      key: 'locations',
      label: '库区库位',
      count: 3,
      content: `<div class="border-b px-4 py-3">${renderWarehouseLocationToolbar('裁床待交出仓')}</div>${renderLocationRows('裁床待交出仓', [
        ['裁床待交出仓', '裁片 A 区', 'CUT-A-01', '待交出裁片'],
        ['裁床待交出仓', '特殊工艺回仓区', 'SP-RETURN-01', '回仓裁片'],
        ['裁床待交出仓', '中转袋暂存区', 'BAG-A-01', '待交出中转袋'],
      ])}`,
    },
  ]

  return renderHubShell({
    metaKey: 'warehouse-management-wait-handover',
    description: '查看铺布裁剪后的裁片库存、任务分配、二次分拣、交出单和交出记录。',
    kpis: [
      renderCompactKpiCard('菲票库存', transferBagViewModel.ticketCandidates.length, '裁片库存', 'text-blue-600'),
      renderCompactKpiCard('入仓暂存袋 / 中转袋', transferBagViewModel.summary.bagCount, '待交出仓配料', 'text-slate-700'),
      renderCompactKpiCard('已创建交出记录', assignedTaskCount, '车缝任务分配', 'text-emerald-600'),
      renderCompactKpiCard('待分拣', pendingSortingUsageCount, '待交出仓配料', 'text-amber-600'),
      renderCompactKpiCard('交出记录', handoverRecordCount, '交出单下挂记录', 'text-blue-600'),
    ].join(''),
    tabs: '',
    content: renderFactoryWarehouseStandardTabs(
      standardTabs.sort((a, b) => Number(b.key === activeTab) - Number(a.key === activeTab)),
      'cutting-wait-handover-standard-tabs',
    ),
  })
}
