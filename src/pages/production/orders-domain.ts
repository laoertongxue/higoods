import {
  escapeHtml,
  state,
  renderBadge,
  renderEmptyRow,
  renderStatCard,
  safeText,
  resolveProductionSpuImageUrl,
  resolveMaterialImageUrl,
  renderProductionImageThumb,
  type ProductionOrder,
  type RiskFlag,
  type AuditLog,
  type FactoryTier,
  type FactoryType,
  type MaterialRequestDraft,
  tierLabels,
  typeLabels,
  riskFlagConfig,
  assignmentProgressStatusConfig,
  taskStatusLabel,
  taskStatusClass,
  getOrderById,
  getRuntimeTaskTypeLabel,
  getTaskDetailRows,
  getOrderDisplayBreakdownSnapshot,
  getOrderDisplayAssignmentSnapshot,
  getOrderMaterialDisplaySummary,
  getOrderMaterialIndicators,
  getOrderTechPackSnapshotDisplay,
  canOrderStartTaskBreakdown,
  getOrderTaskBreakdownDisabledReason,
  getMaterialPrepBreakdownReadinessForOrder,
  getFilteredOrders,
  getPaginatedOrders,
  getProcessTaskById,
  getDraftStatusLabel,
  getMaterialRequestDraftById,
  getMaterialRequestDraftSummaryByOrder,
  listMaterialDraftOperationLogsByOrder,
  getSupplementOptionDisplayRows,
  getTaskTypeLabel,
  listMaterialRequestDraftsByOrder,
  addMaterialToDraft,
  restoreMaterialDraftSuggestion,
  renderSplitEventList,
  listRuntimeTaskSplitGroupsByOrder,
  PAGE_SIZE,
  productionOrderStatusConfig,
  formatProductionOrderMainFactoryName,
  isProductionOrderMainFactoryPending,
} from './context.ts'
import {
  renderOrdersFromDemandDialog,
  renderDemandConfirmDialog,
} from './demand-domain.ts'
import {
  getProductionConfirmationByOrderId,
  isProductionConfirmationPrintable,
} from '../../data/fcs/production-confirmation.ts'
import {
  buildProductionConfirmationPrintLink,
} from '../../data/fcs/fcs-route-links.ts'
import {
  type MaterialPrepBreakdownLineCheck,
  type MaterialPrepLine,
  listMaterialPrepOrderProjections,
} from '../../data/fcs/cutting/production-material-prep.ts'
import {
  getProductionOrderTechPackSnapshot,
} from '../../data/fcs/production-order-tech-pack-runtime.ts'
import {
  listMaterialRequestsByOrder,
} from '../../data/fcs/material-request-drafts.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionObjectCodeButton,
  renderProductionOrderIdentityCell,
} from '../../data/fcs/production-order-identity.ts'

function getOrderConfirmationPreviewState(order: ProductionOrder): {
  available: boolean
  href: string
  title: string
} {
  const href = buildProductionConfirmationPrintLink(order.productionOrderId)
  if (!order.taskBreakdownSummary.isBrokenDown || order.status === 'READY_FOR_BREAKDOWN') {
    return {
      available: false,
      href,
      title: '未拆解任务，不能打印生产确认单',
    }
  }

  const confirmation = getProductionConfirmationByOrderId(order.productionOrderId)
  const printable = isProductionConfirmationPrintable(order.productionOrderId)

  if (confirmation || printable.printable) {
    return {
      available: true,
      href,
      title: '打印预览',
    }
  }

  return {
    available: false,
    href,
    title: printable.reason
      ? `${printable.reason}，不能打印生产确认单`
      : '工厂分配完成后可打印',
  }
}

function renderOrderTextActionButton(options: {
  label: string
  orderId?: string
  action?: string
  nav?: string
  disabled?: boolean
  title?: string
}): string {
  const disabled = Boolean(options.disabled)
  return `
    <button
      type="button"
      class="inline-flex min-h-8 items-center justify-center rounded-md border px-2.5 py-1 text-xs ${
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted'
      }"
      ${options.action ? `data-prod-action="${escapeHtml(options.action)}"` : ''}
      ${options.orderId ? `data-order-id="${escapeHtml(options.orderId)}"` : ''}
      ${options.nav ? `data-nav="${escapeHtml(options.nav)}"` : ''}
      ${options.title ? `title="${escapeHtml(options.title)}"` : ''}
      ${disabled ? 'disabled aria-disabled="true"' : ''}
    >
      ${escapeHtml(options.label)}
    </button>
  `
}

function formatBreakdownQty(value: number, unit: string): string {
  return `${Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${unit}`
}

type QtyBucket = Map<string, number>
type ProductionOrderTechPackSnapshot = NonNullable<ReturnType<typeof getProductionOrderTechPackSnapshot>>
type ProductionOrderTechPackBomItem = ProductionOrderTechPackSnapshot['bomItems'][number]

function createQtyBucket(): QtyBucket {
  return new Map<string, number>()
}

function addQtyToBucket(bucket: QtyBucket, unit: string, qty: number): void {
  if (!Number.isFinite(qty) || qty <= 0) return
  const key = unit || '件'
  bucket.set(key, Number(((bucket.get(key) || 0) + qty).toFixed(2)))
}

function subtractQtyBucket(left: QtyBucket, right: QtyBucket): QtyBucket {
  const result = createQtyBucket()
  left.forEach((qty, unit) => {
    const remain = Math.max(0, qty - (right.get(unit) || 0))
    if (remain > 0) result.set(unit, Number(remain.toFixed(2)))
  })
  return result
}

function sumQtyBucket(bucket: QtyBucket): number {
  return Array.from(bucket.values()).reduce((sum, qty) => sum + qty, 0)
}

function formatQtyBucket(bucket: QtyBucket): string {
  const entries = Array.from(bucket.entries()).filter(([, qty]) => qty > 0)
  if (entries.length === 0) return '0'
  return entries
    .map(([unit, qty]) => formatBreakdownQty(qty, unit))
    .join('、')
}

function renderMaterialIdentity(input: {
  materialName: string
  materialSku?: string
  materialCode?: string
  materialSpec?: string
  color?: string
  materialCategory?: string
  materialImageUrl?: string | null
  relatedProductionOrderNo?: string
}, compact = false): string {
  const imageUrl = resolveMaterialImageUrl(input)
  const code = input.materialSku || input.materialCode || '-'
  const codeEntry = input.materialSku
    ? renderProductionObjectCodeButton({
        objectType: 'MATERIAL',
        objectId: input.materialSku,
        label: code,
        relatedProductionOrderNo: input.relatedProductionOrderNo,
        defaultTab: 'materials',
      })
    : escapeHtml(code)
  const specText = [input.color, input.materialSpec].filter(Boolean).join(' / ') || input.materialCategory || '-'
  return `
    <div class="flex min-w-0 items-center gap-3">
      ${renderProductionImageThumb(imageUrl, input.materialName, compact ? 'h-10 w-10' : 'h-12 w-12')}
      <div class="min-w-0">
        <div class="truncate font-medium" title="${escapeHtml(input.materialName)}">${escapeHtml(input.materialName)}</div>
        <div class="font-mono text-xs text-muted-foreground">${codeEntry}</div>
        <div class="truncate text-xs text-muted-foreground" title="${escapeHtml(specText)}">${escapeHtml(specText)}</div>
      </div>
    </div>
  `
}

function formatTechPackVersionLabel(label: string): string {
  return label.replace(/^v/i, 'V')
}

function renderOrderTechPackVersionLink(order: ProductionOrder): string {
  const display = getOrderTechPackSnapshotDisplay(order)
  const label = formatTechPackVersionLabel(display.techPackVersionLabelText)
  if (!order.techPackSnapshot) {
    return '<div class="mt-1 text-xs text-muted-foreground">技术包版本：-</div>'
  }

  return `
    <div class="mt-1 text-xs text-muted-foreground">
      技术包版本：<button
        type="button"
        class="font-mono text-blue-600 hover:underline"
        data-prod-action="open-orders-tech-pack-snapshot-dialog"
        data-order-id="${escapeHtml(order.productionOrderId)}"
      >${escapeHtml(label)}</button>
    </div>
  `
}

function renderOrderDemandInfo(order: ProductionOrder): string {
  if (order.demandSnapshot.skuLines.length === 0) return '<span class="text-xs text-muted-foreground">暂无SKU需求</span>'

  return `
    <div class="space-y-1 text-xs">
      ${order.demandSnapshot.skuLines
        .map(
          (sku) => `
            <div class="rounded-md border bg-background/70 px-2 py-1">
              <div class="text-muted-foreground">${escapeHtml(sku.color)}&${escapeHtml(sku.size)}：${Number(sku.qty || 0).toLocaleString('zh-CN')}件</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderOrderSpuInfo(order: ProductionOrder, options: { garmentDifficultyGrade?: string; showTechPackVersion?: boolean } = {}): string {
  const imageUrl = resolveProductionSpuImageUrl(order.demandSnapshot)
  return `
    <div class="flex min-w-0 items-center gap-3">
      ${renderProductionImageThumb(imageUrl, order.demandSnapshot.spuName, 'h-12 w-12')}
      <div class="min-w-0 text-sm">
        <div>${renderProductionObjectCodeButton({
          objectType: 'PRODUCTION_ORDER',
          objectId: order.productionOrderNo,
          label: order.demandSnapshot.spuCode,
          relatedProductionOrderNo: order.productionOrderNo,
          className: 'font-mono text-blue-600 hover:underline',
        })}</div>
        <div class="max-w-[180px] truncate text-xs text-muted-foreground" title="${escapeHtml(order.demandSnapshot.spuName)}">
          ${escapeHtml(order.demandSnapshot.spuName)}
        </div>
        <div class="mt-1 truncate text-xs text-muted-foreground">
          买手：${escapeHtml(order.demandSnapshot.buyerName)} · 跟单：${escapeHtml(order.demandSnapshot.merchandiserName)}
        </div>
        ${
          options.garmentDifficultyGrade
            ? `<div class="mt-1 flex items-center gap-1">
                <span class="text-xs text-muted-foreground">做货难度</span>
                ${renderGarmentDifficultyBadge(options.garmentDifficultyGrade)}
              </div>`
            : ''
        }
        ${options.showTechPackVersion ? renderOrderTechPackVersionLink(order) : ''}
      </div>
    </div>
  `
}

function getBreakdownLineGapQty(line: MaterialPrepBreakdownLineCheck): number {
  return Math.max(0, line.requiredQty - line.availableStockQty)
}

function getMaterialLineStockGapQty(line: MaterialPrepLine): number {
  return Math.max(0, line.requiredQty - line.confirmedPrepQty - line.availableStockQty)
}

function normalizeMaterialToken(value: string | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '')
}

function getOrderMaterialPrepLines(order: ProductionOrder): MaterialPrepLine[] {
  return listMaterialPrepOrderProjections()
    .filter((projection) =>
      projection.order.productionOrderId === order.productionOrderId ||
      projection.order.productionOrderNo === order.productionOrderId,
    )
    .flatMap((projection) => projection.lines)
}

function getPatternLinkedBomItems(order: ProductionOrder): ProductionOrderTechPackBomItem[] {
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  if (!snapshot) return []

  const patternLinkedBomIds = new Set(
    snapshot.patternFiles
      .map((pattern) => pattern.linkedBomItemId)
      .filter((id): id is string => Boolean(id)),
  )

  return snapshot.bomItems.filter((item) =>
    (item.linkedPatternIds ?? []).length > 0 || patternLinkedBomIds.has(item.id),
  )
}

function isPrepLineLinkedToPatternBom(line: MaterialPrepLine, bomItem: ProductionOrderTechPackBomItem): boolean {
  const bomId = normalizeMaterialToken(bomItem.id)
  const bomName = normalizeMaterialToken(bomItem.name)
  const lineSku = normalizeMaterialToken(line.materialSku)
  const lineName = normalizeMaterialToken(line.materialName)
  const lineCutOrder = normalizeMaterialToken(line.cutOrderId)

  if (bomId && (lineSku.includes(bomId) || lineCutOrder.includes(bomId))) return true
  return Boolean(bomName && lineName.includes(bomName))
}

function getOrderCuttingMaterialLines(order: ProductionOrder, lines: MaterialPrepLine[]): MaterialPrepLine[] {
  const patternLinkedBomItems = getPatternLinkedBomItems(order)
  if (patternLinkedBomItems.length === 0 || lines.length === 0) return []

  return lines
    .filter((line) => patternLinkedBomItems.some((bomItem) => isPrepLineLinkedToPatternBom(line, bomItem)))
    .sort((left, right) => {
      const leftStockGap = getMaterialLineStockGapQty(left)
      const rightStockGap = getMaterialLineStockGapQty(right)
      if (leftStockGap !== rightStockGap) return rightStockGap - leftStockGap
      return Math.max(0, right.requiredQty - right.confirmedPrepQty) - Math.max(0, left.requiredQty - left.confirmedPrepQty)
    })
}

function getUpstreamProgressNav(line: MaterialPrepBreakdownLineCheck): string {
  if (line.upstreamSourceType === '印花' || line.upstreamProgressStatus === '印花中') return '/fcs/process/print-orders'
  if (line.upstreamSourceType === '染色' || line.upstreamProgressStatus === '染色中') return '/fcs/process/dye-orders'
  if (line.upstreamSourceType === '采购' || line.upstreamProgressStatus === '采购中') return '/pms/purchase-order'
  return ''
}

function renderBreakdownLineStatus(line: MaterialPrepBreakdownLineCheck): string {
  if (line.ready) return renderBadge('可拆解', 'bg-green-100 text-green-700')
  return renderBadge('暂不可拆解', 'bg-amber-100 text-amber-700')
}

function renderBreakdownReadinessRows(lines: MaterialPrepBreakdownLineCheck[]): string {
  if (lines.length === 0) return renderEmptyRow(8, '暂无 BOM 物料明细')

  return lines
    .map((line) => {
      const gapQty = getBreakdownLineGapQty(line)
      const upstreamNav = getUpstreamProgressNav(line)
      return `
        <tr class="border-b last:border-0 align-top">
          <td class="px-3 py-2">
            ${renderMaterialIdentity({
              materialName: line.materialName,
              materialSku: line.materialSku,
              materialSpec: line.spec,
              color: line.color,
              materialImageUrl: line.materialImageUrl,
              relatedProductionOrderNo: line.productionOrderNo,
            }, true)}
          </td>
          <td class="px-3 py-2 text-right">${escapeHtml(formatBreakdownQty(line.requiredQty, line.unit))}</td>
          <td class="px-3 py-2">
            <div class="text-right font-medium">${escapeHtml(formatBreakdownQty(line.availableStockQty, line.unit))}</div>
            <div class="text-right text-xs text-muted-foreground">${escapeHtml(line.stockWarehouseName)}</div>
          </td>
          <td class="px-3 py-2 text-right ${gapQty > 0 ? 'text-amber-700' : 'text-green-700'}">${escapeHtml(formatBreakdownQty(gapQty, line.unit))}</td>
          <td class="px-3 py-2">
            <div>${escapeHtml(line.upstreamSourceType)}</div>
            <div class="font-mono text-xs text-muted-foreground">${renderProductionObjectCodeButton({
              objectType: line.upstreamSourceType === '采购' ? 'PURCHASE_ORDER' : 'WAREHOUSE_DOC',
              objectId: line.upstreamDocumentNo,
              relatedProductionOrderNo: line.productionOrderNo,
              defaultTab: 'materials',
              highlightKey: `${line.upstreamSourceType === '采购' ? 'PURCHASE_ORDER' : 'WAREHOUSE_DOC'}:${line.upstreamDocumentNo}`,
            })}</div>
          </td>
          <td class="px-3 py-2">
            <div>${renderBadge(line.upstreamProgressStatus, line.upstreamProgressStatus === '已到仓可配' || line.upstreamProgressStatus === '无需跟进' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}</div>
            ${
              upstreamNav
                ? `<button class="mt-2 rounded border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(upstreamNav)}">查看进度</button>`
                : ''
            }
          </td>
          <td class="px-3 py-2">${renderBreakdownLineStatus(line)}</td>
          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(line.blockingReason || '库存和上游状态满足拆解前置条件')}</td>
        </tr>
      `
    })
    .join('')
}

function renderOrderBreakdownReadinessDialog(): string {
  const order = getOrderById(state.ordersBreakdownReadinessOrderId)
  if (!order) return ''

  const readiness = getMaterialPrepBreakdownReadinessForOrder(order.productionOrderId)
  const readyCount = readiness.lines.filter((line) => line.ready).length
  const blockingCount = readiness.lines.length - readyCount

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-6xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold">拆解前物料库存检查</h3>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(order.productionOrderId)} · ${escapeHtml(order.demandSnapshot.spuCode)} · ${escapeHtml(order.demandSnapshot.spuName)}</p>
          </div>
          <button class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-prod-action="close-breakdown-readiness">关闭</button>
        </header>
        <div class="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
          <div class="grid gap-3 md:grid-cols-4">
            ${renderStatCard('BOM物料行', readiness.lines.length)}
            ${renderStatCard('可拆解物料行', readyCount, 'text-green-600')}
            ${renderStatCard('不足/待上游', blockingCount, blockingCount > 0 ? 'text-amber-600' : 'text-green-600')}
            ${renderStatCard('检查结果', readiness.ready ? '可拆解' : '暂不可拆解', readiness.ready ? 'text-green-600' : 'text-amber-600')}
          </div>
          <section class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            ${escapeHtml(readiness.summaryText)}
          </section>
          <section class="overflow-hidden rounded-md border">
            <div class="max-h-[420px] overflow-auto">
              <table class="w-full min-w-[1080px] text-sm">
                <thead class="sticky top-0 z-10 border-b bg-muted/80 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">物料</th>
                    <th class="px-3 py-2 text-right font-medium">需求数量</th>
                    <th class="px-3 py-2 text-right font-medium">仓库库存</th>
                    <th class="px-3 py-2 text-right font-medium">缺口</th>
                    <th class="px-3 py-2 text-left font-medium">上游单据</th>
                    <th class="px-3 py-2 text-left font-medium">上游进度</th>
                    <th class="px-3 py-2 text-left font-medium">结论</th>
                    <th class="px-3 py-2 text-left font-medium">原因</th>
                  </tr>
                </thead>
                <tbody>${renderBreakdownReadinessRows(readiness.lines)}</tbody>
              </table>
            </div>
          </section>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-breakdown-readiness">关闭</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white ${
            readiness.ready && canOrderStartTaskBreakdown(order) ? 'hover:bg-blue-700' : 'pointer-events-none opacity-50'
          }" title="${escapeHtml(readiness.ready ? '' : readiness.summaryText)}" data-prod-action="breakdown-order" data-order-id="${escapeHtml(order.productionOrderId)}">确认拆解任务</button>
        </footer>
      </section>
    </div>
  `
}

function renderOrderRiskFlags(flags: RiskFlag[]): string {
  if (flags.length === 0) {
    return '<span class="text-muted-foreground">-</span>'
  }

  const primary = flags.slice(0, 3)
  const overflow = flags.length - primary.length

  return `
    <div class="flex flex-wrap gap-1">
      ${primary
        .map((flag) => renderBadge(riskFlagConfig[flag]?.label ?? flag, riskFlagConfig[flag]?.color ?? 'bg-slate-100 text-slate-700'))
        .join('')}
      ${
        overflow > 0
          ? `
            <div class="group relative">
              <span class="inline-flex rounded border px-2 py-0.5 text-xs text-muted-foreground">+${overflow}</span>
              <div class="invisible absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-md border bg-background p-2 text-xs shadow-lg group-hover:visible">
                ${flags
                  .slice(3)
                  .map((flag) => `<div>${escapeHtml(riskFlagConfig[flag]?.label ?? flag)}</div>`)
                  .join('')}
              </div>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderOrderAssignmentOverview(order: ProductionOrder): string {
  const assignment = getOrderDisplayAssignmentSnapshot(order)
  const total = assignment.assignmentSummary.totalTasks
  const progressMeta = assignmentProgressStatusConfig[assignment.assignmentProgress.status] ?? {
    label: assignment.assignmentProgress.status,
    color: 'bg-slate-100 text-slate-700',
  }
  if (total === 0) {
    return `
      <div class="space-y-1 text-xs">
        ${renderBadge(progressMeta.label, progressMeta.color)}
        <p class="text-muted-foreground">待拆解后开放分配</p>
      </div>
    `
  }

  if (assignment.assignmentProgress.status === 'PENDING') {
    return `
      <div class="space-y-1 text-xs">
        ${renderBadge(progressMeta.label, progressMeta.color)}
        <p>任务 ${total} / 待分配</p>
      </div>
    `
  }

  if (assignment.assignmentProgress.status === 'DONE') {
    return `
      <div class="space-y-1 text-xs">
        ${renderBadge(progressMeta.label, progressMeta.color)}
        <p>已分配 ${total} / 总计 ${total}</p>
      </div>
    `
  }

  const lines: string[] = []
  if (assignment.assignmentSummary.directCount > 0) {
    lines.push(
      `派单 ${assignment.assignmentSummary.directCount} / 已确认 ${assignment.directDispatchSummary.assignedFactoryCount} / 待确认 ${Math.max(0, assignment.assignmentSummary.directCount - assignment.directDispatchSummary.assignedFactoryCount)}`,
    )
  }
  if (assignment.assignmentSummary.biddingCount > 0) {
    lines.push(
      `竞价 ${assignment.assignmentSummary.biddingCount} / 已发起 ${assignment.assignmentProgress.biddingLaunchedCount} / 已定标 ${assignment.assignmentProgress.biddingAwardedCount}`,
    )
  }
  if (assignment.assignmentSummary.unassignedCount > 0) {
    lines.push(`待分配 ${assignment.assignmentSummary.unassignedCount}`)
  }

  return `
    <div class="space-y-1 text-xs">
      ${renderBadge(progressMeta.label, progressMeta.color)}
      ${
        lines.length > 0
          ? lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')
          : `<p>任务 ${total} 条</p>`
      }
    </div>
  `
}

function renderOrderTaskGenerationSummary(order: ProductionOrder): string {
  const summary = order.taskBreakdownSummary
  if (!summary.isBrokenDown) {
    return `
      <div class="space-y-1 text-xs">
        ${renderBadge('待确认生成', 'bg-gray-100 text-gray-700')}
        <p class="text-muted-foreground">确认拆解后生成任务单元</p>
      </div>
    `
  }

  const method =
    (summary.wholeOrderTaskCount ?? 0) > 0
      ? '整单承接'
      : (summary.combinedProcessTaskCount ?? 0) > 0
        ? '连续工序承接'
        : (summary.independentWorkOrderTaskCount ?? 0) > 0
          ? '独立工艺单 + 单工序'
          : '单工序承接'
  const taskUnitCount =
    summary.generatedTaskUnitCount ??
    Math.max(0, summary.singleProcessTaskCount ?? 0) +
      Math.max(0, summary.combinedProcessTaskCount ?? 0) +
      Math.max(0, summary.wholeOrderTaskCount ?? 0)
  const coveredText =
    summary.coveredProcessNames?.length
      ? summary.coveredProcessNames.slice(0, 4).join('、')
      : summary.taskTypesTop3.join('、') || '按工序生成'

  return `
    <div class="space-y-1 text-xs">
      <div class="font-medium text-foreground">任务生成规则：${escapeHtml(summary.generationRuleName || '默认按工序生成规则')}</div>
      <p>任务生成方式：${escapeHtml(method)}</p>
      <p>任务单元数：${taskUnitCount}</p>
      <p class="max-w-[220px] truncate text-muted-foreground" title="${escapeHtml(coveredText)}">覆盖：${escapeHtml(coveredText)}</p>
    </div>
  `
}

function renderTaskGenerationPreviewDialog(): string {
  const previewState = state.taskGenerationPreview
  if (!previewState) return ''
  const title = previewState.mode === 'batch' ? '批量任务拆解预览' : '任务拆解预览'
  const canConfirm = previewState.previews.some((preview) =>
    preview.status === 'READY' || preview.status === 'NEED_CONFIRM' || preview.status === 'NO_MATCH_USE_DEFAULT',
  )

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-task-generation-preview" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[88vh] w-[min(1180px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">${title}</h2>
            <p class="mt-1 text-sm text-muted-foreground">先按生产单任务生成规则预览，确认后才正式生成任务单元。</p>
          </div>
          <button class="rounded-md p-1 text-muted-foreground hover:bg-muted" data-prod-action="close-task-generation-preview" aria-label="关闭">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </header>
        <div class="max-h-[calc(88vh-142px)] space-y-4 overflow-auto p-5">
          ${previewState.previews.map((preview) => `
            <article class="rounded-lg border bg-card">
              <div class="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
                <div>
                  <div class="font-medium">${escapeHtml(preview.productionOrderNo)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">售卖类型：${escapeHtml(preview.saleType)} / 命中规则：${escapeHtml(preview.matchedRuleName || '未命中')}</div>
                </div>
                <span class="inline-flex rounded border px-2 py-0.5 text-xs ${
                  preview.status === 'BLOCKED'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : preview.status === 'NO_MATCH_USE_DEFAULT'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-green-200 bg-green-50 text-green-700'
                }">${escapeHtml(preview.statusReason)}</span>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[900px] text-sm">
                  <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">生成对象</th>
                      <th class="px-3 py-2 text-left font-medium">类型</th>
                      <th class="px-3 py-2 text-left font-medium">覆盖工序</th>
                      <th class="px-3 py-2 text-left font-medium">承接工厂</th>
                      <th class="px-3 py-2 text-left font-medium">自动分配</th>
                      <th class="px-3 py-2 text-left font-medium">PDA步骤</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[
                      ...preview.independentDemandObjects.map((item) => `
                        <tr class="border-b">
                          <td class="px-3 py-2 font-medium">${escapeHtml(item.objectName)}</td>
                          <td class="px-3 py-2">独立需求</td>
                          <td class="px-3 py-2">${escapeHtml(item.processCode === 'PRINT' ? '印花' : '染色')}</td>
                          <td class="px-3 py-2">后续创建加工单</td>
                          <td class="px-3 py-2">进入独立任务分配</td>
                          <td class="px-3 py-2">按加工单流程</td>
                        </tr>
                      `),
                      ...preview.generatedUnits.map((unit) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(unit.taskName)}</td>
                          <td class="px-3 py-2">${escapeHtml(unit.taskUnitType)}</td>
                          <td class="px-3 py-2">${escapeHtml(unit.coveredProcesses.map((item) => item.craftName || item.processName).join('、') || '—')}</td>
                          <td class="px-3 py-2">${escapeHtml(unit.assignmentTargetFactoryName || '后续分配')}</td>
                          <td class="px-3 py-2">${escapeHtml(unit.allowAutoDispatch ? '进入' : '不进入')}</td>
                          <td class="px-3 py-2">${escapeHtml(unit.pdaSteps.join(' → '))}</td>
                        </tr>
                      `),
                    ].join('')}
                    ${preview.generatedUnits.length === 0 && preview.independentDemandObjects.length === 0
                      ? `<tr><td colspan="6" class="px-3 py-6 text-center text-sm text-muted-foreground">${escapeHtml(preview.blockedReasons.join('、') || '暂无可生成对象')}</td></tr>`
                      : ''}
                  </tbody>
                </table>
              </div>
            </article>
          `).join('')}
        </div>
        <footer class="flex justify-end gap-2 border-t px-5 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-task-generation-preview">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${canConfirm ? '' : 'pointer-events-none opacity-50'}" data-prod-action="confirm-task-generation-preview">确认生成任务</button>
        </footer>
      </section>
    </div>
  `
}
function getOrderListStatusDisplay(order: ProductionOrder): { label: string; color: string } {
  return productionOrderStatusConfig[order.status] ?? { label: order.status, color: 'bg-slate-100 text-slate-700' }
}

function renderGarmentDifficultyBadge(grade: string): string {
  if (!grade || grade === '-') return '<span class="text-muted-foreground">-</span>'
  const classMap: Record<string, string> = {
    'A++': 'bg-red-100 text-red-700',
    'A+': 'bg-orange-100 text-orange-700',
    A: 'bg-amber-100 text-amber-700',
    B: 'bg-blue-100 text-blue-700',
    C: 'bg-slate-100 text-slate-700',
    D: 'bg-zinc-100 text-zinc-700',
  }
  return renderBadge(grade, classMap[grade] ?? 'bg-slate-100 text-slate-700')
}

function renderOrderDemandSnapshotDrawer(): string {
  const order = getOrderById(state.ordersDemandSnapshotId)
  if (!order) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-orders-demand-snapshot" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[520px]" data-dialog-panel="true">
        <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-5 py-4">
          <h3 class="text-lg font-semibold">需求快照</h3>
          <button class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-prod-action="close-orders-demand-snapshot">关闭</button>
        </header>
        <div class="h-full space-y-5 overflow-y-auto px-5 py-4 pb-12">
          <section class="grid grid-cols-2 gap-3 text-sm">
            <div class="col-span-2">
              <p class="text-xs text-muted-foreground">SPU信息</p>
              <div class="mt-1">${renderOrderSpuInfo(order)}</div>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">需求编号</p>
              <p class="font-mono">${escapeHtml(order.demandSnapshot.demandId)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">款式买手</p>
              <p>${escapeHtml(order.demandSnapshot.buyerName)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">生产跟单</p>
              <p>${escapeHtml(order.demandSnapshot.merchandiserName)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">优先级</p>
              <p>${escapeHtml(order.demandSnapshot.priority)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">交付日期</p>
              <p>${escapeHtml(safeText(order.demandSnapshot.requiredDeliveryDate))}</p>
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-semibold">SKU明细</h4>
            <div class="overflow-x-auto rounded-md border">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-2 py-2 text-left font-medium">SKU</th>
                    <th class="px-2 py-2 text-left font-medium">尺码</th>
                    <th class="px-2 py-2 text-left font-medium">颜色</th>
                    <th class="px-2 py-2 text-right font-medium">数量</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.demandSnapshot.skuLines
                    .map(
                      (sku) => `
                        <tr class="border-b last:border-0">
                          <td class="px-2 py-2 font-mono text-xs">${escapeHtml(sku.skuCode)}</td>
                          <td class="px-2 py-2">${escapeHtml(sku.size)}</td>
                          <td class="px-2 py-2">${escapeHtml(sku.color)}</td>
                          <td class="px-2 py-2 text-right">${sku.qty.toLocaleString()}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>

          ${
            order.demandSnapshot.constraintsNote
              ? `<section class="space-y-2 border-t pt-4">
                  <h4 class="text-sm font-semibold">约束条件</h4>
                  <p class="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">${escapeHtml(
                    order.demandSnapshot.constraintsNote,
                  )}</p>
                </section>`
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function renderOrderTechPackSnapshotDialog(): string {
  const order = getOrderById(state.ordersTechPackSnapshotDialogId)
  if (!order) return ''

  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  const display = getOrderTechPackSnapshotDisplay(order)
  const versionLabel = formatTechPackVersionLabel(display.techPackVersionLabelText)
  const sourceTaskText = [
    snapshot?.linkedRevisionTaskIds.length ? `改版任务 ${snapshot.linkedRevisionTaskIds.length}` : '',
    snapshot?.linkedPatternTaskIds.length ? `制版任务 ${snapshot.linkedPatternTaskIds.length}` : '',
    snapshot?.linkedArtworkTaskIds.length ? `花型任务 ${snapshot.linkedArtworkTaskIds.length}` : '',
  ].filter(Boolean).join(' / ') || '暂无来源任务链'

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-orders-tech-pack-snapshot-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 class="text-base font-semibold">技术包版本快照</h3>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.productionOrderNo)} · ${escapeHtml(order.demandSnapshot.spuName)}</p>
          </div>
          <button class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-prod-action="close-orders-tech-pack-snapshot-dialog">关闭</button>
        </header>
        <div class="space-y-4 px-5 py-4">
          <section class="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div class="text-xs text-muted-foreground">技术包版本</div>
              <div class="font-mono">${escapeHtml(versionLabel)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">快照状态</div>
              <div>${renderBadge(display.techPackReadyStatus, display.techPackReadyClassName)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">冻结时间</div>
              <div>${escapeHtml(display.techPackSnapshotAt)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">完整度</div>
              <div>${Number(snapshot?.completenessScore ?? 0)}%</div>
            </div>
          </section>
          <section class="rounded-md border bg-muted/30 p-3 text-sm">
            <div class="text-xs text-muted-foreground">快照内容</div>
            <div class="mt-2 grid gap-2 sm:grid-cols-3">
              <div>BOM ${snapshot?.bomItems.length ?? 0} 行</div>
              <div>工序 ${snapshot?.processEntries.length ?? 0} 项</div>
              <div>SKU ${order.demandSnapshot.skuLines.length} 个</div>
            </div>
            <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(sourceTaskText)}</div>
          </section>
        </div>
      </section>
    </div>
  `
}

function renderOrderLogsDialog(): string {
  const order = getOrderById(state.ordersLogsId)
  if (!order) return ''
  const logs = getOrderMergedAuditLogs(order).slice().reverse()

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-3xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-center justify-between border-b px-6 py-4">
          <h3 class="text-lg font-semibold">操作日志</h3>
          <button class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-prod-action="close-orders-logs">关闭</button>
        </header>
        <div class="max-h-[60vh] overflow-y-auto px-6 py-4">
          <div class="overflow-x-auto rounded-md border">
            <table class="w-full text-sm">
              <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">时间</th>
                  <th class="px-3 py-2 text-left font-medium">操作</th>
                  <th class="px-3 py-2 text-left font-medium">详情</th>
                  <th class="px-3 py-2 text-left font-medium">操作人</th>
                </tr>
              </thead>
              <tbody>
                ${
                  logs.length === 0
                    ? renderEmptyRow(4, '暂无数据')
                    : logs
                        .map(
                          (log) => `
                            <tr class="border-b last:border-0">
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(log.at)}</td>
                              <td class="px-3 py-2">${renderBadge(log.action, 'bg-slate-100 text-slate-700')}</td>
                              <td class="px-3 py-2">${escapeHtml(log.detail)}</td>
                              <td class="px-3 py-2">${escapeHtml(log.by)}</td>
                            </tr>
                          `,
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
}

function getOrderSplitAuditLogs(order: ProductionOrder): AuditLog[] {
  const splitEvents = listRuntimeTaskSplitGroupsByOrder(order.productionOrderId)
  if (splitEvents.length === 0) return []

  return splitEvents.flatMap((event) => {
    const splitLog: AuditLog = {
      id: `LOG-SPLIT-${order.productionOrderId}-${event.splitGroupId}`,
      action: 'TASK_SPLIT',
      detail: `任务 ${event.sourceTaskNo} 按明细分配拆分为 ${event.resultTasks.length} 条平级任务（${event.statusSummary}）`,
      at: event.eventAt,
      by: '系统',
    }

    const resultLog: AuditLog = {
      id: `LOG-SPLIT-RESULT-${order.productionOrderId}-${event.splitGroupId}`,
      action: 'TASK_SPLIT_RESULT',
      detail: `拆分结果：${event.resultTasks.map((task) => `${task.taskNo}(${task.assignedFactoryName || '-'}，${taskStatusLabel[task.status]})`).join('；')}`,
      at: event.eventAt,
      by: '系统',
    }

    return [splitLog, resultLog]
  })
}

function getOrderMergedAuditLogs(order: ProductionOrder): AuditLog[] {
  const materialLogs = listMaterialDraftOperationLogsByOrder(order.productionOrderId).map((log) => ({
    id: log.id,
    action: log.action,
    detail: log.detail,
    at: log.at,
    by: log.by,
  }))
  const splitLogs = getOrderSplitAuditLogs(order)
  return [...order.auditLogs, ...materialLogs, ...splitLogs].sort((a, b) => a.at.localeCompare(b.at))
}

function collectDraftLineQty(drafts: MaterialRequestDraft[]): QtyBucket {
  const bucket = createQtyBucket()
  drafts.forEach((draft) => {
    if (!draft.needMaterial) return
    draft.lines
      .filter((line) => line.selected && line.confirmedQty > 0)
      .forEach((line) => addQtyToBucket(bucket, line.unit, line.confirmedQty))
  })
  return bucket
}

function getOrderIssueProgress(order: ProductionOrder, prepLines: MaterialPrepLine[]): {
  badgeLabel: string
  badgeClassName: string
  mainText: string
  pickupText: string
  extraText: string
} {
  const hasConfirmedPrepRecord = prepLines.some((line) => line.confirmedPrepQty > 0)
  if (!hasConfirmedPrepRecord) {
    return {
      badgeLabel: '领料未开放',
      badgeClassName: 'bg-slate-100 text-slate-700',
      mainText: '待配料记录形成',
      pickupText: '仓库拣货：未开放',
      extraText: '',
    }
  }

  const drafts = listMaterialRequestDraftsByOrder(order.productionOrderId)
    .filter((draft) => draft.needMaterial && draft.draftStatus !== 'not_applicable')
  const pendingDrafts = drafts.filter((draft) => draft.draftStatus === 'pending')
  const createdDrafts = drafts.filter((draft) => draft.draftStatus === 'created')

  if (createdDrafts.length === 0) {
    const pendingQty = collectDraftLineQty(pendingDrafts)
    const pendingText = formatQtyBucket(pendingQty)
    return {
      badgeLabel: pendingDrafts.length > 0 ? '待确认领料' : '待生成领料',
      badgeClassName: 'bg-amber-100 text-amber-700',
      mainText: pendingDrafts.length > 0
        ? `草稿应领 ${pendingText} / 已领 0 / 待确认 ${pendingText}`
        : '应领 0 / 已领 0 / 待领 0',
      pickupText: pendingDrafts.length > 0 ? '仓库拣货：待领料草稿确认' : '仓库拣货：待生成领料草稿',
      extraText: pendingDrafts.length > 0 ? `草稿 ${pendingDrafts.length} / 待确认 ${pendingDrafts.length}` : '',
    }
  }

  const requestsByNo = new Map(
    listMaterialRequestsByOrder(order.productionOrderId)
      .map((request) => [request.materialRequestNo, request.requestStatus]),
  )
  const expectedQty = collectDraftLineQty(createdDrafts)
  const issuedQty = createQtyBucket()
  const pickedQty = createQtyBucket()

  createdDrafts.forEach((draft) => {
    const requestStatus = requestsByNo.get(draft.createdMaterialRequestNo) || (draft.materialMode === 'factory_pickup' ? '待自提' : '待配料')
    const selectedLines = draft.lines.filter((line) => line.selected && line.confirmedQty > 0)
    selectedLines.forEach((line) => {
      if (requestStatus === '待配送' || requestStatus === '待自提' || requestStatus === '已完成') {
        addQtyToBucket(pickedQty, line.unit, line.confirmedQty)
      }
      if (requestStatus === '已完成') {
        addQtyToBucket(issuedQty, line.unit, line.confirmedQty)
      }
    })
  })

  const pendingIssueQty = subtractQtyBucket(expectedQty, issuedQty)
  const pendingPickQty = subtractQtyBucket(expectedQty, pickedQty)
  const expectedTotal = sumQtyBucket(expectedQty)
  const issuedTotal = sumQtyBucket(issuedQty)
  const pickedTotal = sumQtyBucket(pickedQty)
  const hasPendingDrafts = pendingDrafts.length > 0
  const badge =
    expectedTotal <= 0
      ? { label: '待生成领料', className: 'bg-amber-100 text-amber-700' }
      : issuedTotal >= expectedTotal
      ? { label: '已领齐', className: 'bg-green-100 text-green-700' }
      : issuedTotal > 0
      ? { label: '部分领料', className: 'bg-blue-100 text-blue-700' }
      : pickedTotal > 0
      ? { label: '可领未领', className: 'bg-cyan-100 text-cyan-700' }
      : { label: '待仓库拣货', className: 'bg-amber-100 text-amber-700' }

  let pickupText = '仓库拣货：待开始'
  if (expectedTotal > 0 && issuedTotal >= expectedTotal) {
    pickupText = '仓库拣货：已完成'
  } else if (expectedTotal > 0 && pickedTotal >= expectedTotal) {
    pickupText = '仓库拣货：已拣齐，待工厂签收'
  } else if (pickedTotal > 0) {
    pickupText = `仓库拣货：已拣 ${formatQtyBucket(pickedQty)} / 待拣 ${formatQtyBucket(pendingPickQty)}`
  }

  return {
    badgeLabel: badge.label,
    badgeClassName: badge.className,
    mainText: `应领 ${formatQtyBucket(expectedQty)} / 已领 ${formatQtyBucket(issuedQty)} / 待领 ${formatQtyBucket(pendingIssueQty)}`,
    pickupText,
    extraText: hasPendingDrafts ? `另有草稿 ${pendingDrafts.length} / 待确认 ${pendingDrafts.length}` : '',
  }
}

function renderCuttingMaterialLines(lines: MaterialPrepLine[], relatedProductionOrderNo: string): string {
  if (lines.length === 0) {
    return '<div class="mt-2 text-xs text-muted-foreground">裁片物料：技术包未识别到关联纸样的物料</div>'
  }

  const hasStockGap = lines.some((line) => getMaterialLineStockGapQty(line) > 0)
  return `
    <div class="mt-2 space-y-1.5">
      <div class="text-xs font-medium text-muted-foreground">
        裁片物料（已关联纸样）${hasStockGap ? '' : ' · 库存满足'}
      </div>
      ${lines
        .map((line) => {
          const stockGapQty = getMaterialLineStockGapQty(line)
          return `
            <div class="rounded-md border bg-background/70 p-1.5">
              <div class="flex min-w-0 items-start gap-2">
                ${renderProductionImageThumb(line.materialImageUrl, line.materialName, 'h-8 w-8')}
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-medium" title="${escapeHtml(line.materialName)}">${escapeHtml(line.materialName)}</div>
                  <div class="font-mono text-[11px] text-muted-foreground">${renderProductionObjectCodeButton({
                    objectType: 'MATERIAL',
                    objectId: line.materialSku,
                    label: line.materialSku,
                    relatedProductionOrderNo,
                    defaultTab: 'materials',
                  })}</div>
                  <div class="text-[11px] ${stockGapQty > 0 ? 'text-amber-700' : 'text-muted-foreground'}">
                    需 ${escapeHtml(formatBreakdownQty(line.requiredQty, line.unit))}
                    / 已配 ${escapeHtml(formatBreakdownQty(line.confirmedPrepQty, line.unit))}
                    / 库 ${escapeHtml(formatBreakdownQty(line.availableStockQty, line.unit))}
                    / 缺 ${escapeHtml(formatBreakdownQty(stockGapQty, line.unit))}
                  </div>
                </div>
              </div>
            </div>
          `
        })
        .join('')}
    </div>
  `
}

function renderOrderMaterialSummary(order: ProductionOrder): string {
  const draftSummary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId)
  const prepLines = getOrderMaterialPrepLines(order)
  const cuttingMaterialLines = getOrderCuttingMaterialLines(order, prepLines)
  const preparedLineCount = prepLines.filter((line) => line.confirmedPrepQty >= line.requiredQty).length
  const prepBadge = prepLines.length === 0
    ? { label: '待建配料', className: 'bg-slate-100 text-slate-700' }
    : preparedLineCount === prepLines.length
    ? { label: '配料已满足', className: 'bg-green-100 text-green-700' }
    : { label: '配料有缺口', className: 'bg-amber-100 text-amber-700' }
  const prepSummary = prepLines.length > 0
    ? `配料 ${preparedLineCount}/${prepLines.length} 行满足`
    : '未生成配料库存投影'
  const issueProgress = getOrderIssueProgress(order, prepLines)

  return `
    <div
      class="w-full cursor-pointer rounded-md border border-transparent px-1 py-1 text-left hover:border-border hover:bg-muted/40"
      data-prod-action="open-material-draft-drawer"
      data-order-id="${order.productionOrderId}"
    >
      <div class="flex flex-wrap items-center gap-1">
        ${renderBadge(prepBadge.label, prepBadge.className)}
      </div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(prepSummary)}</div>
      ${renderCuttingMaterialLines(cuttingMaterialLines, order.productionOrderNo)}
      <div class="mt-2 border-t pt-2">
        <div>${renderBadge(issueProgress.badgeLabel, issueProgress.badgeClassName)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(issueProgress.mainText)}</div>
        <div class="text-xs text-muted-foreground">${escapeHtml(issueProgress.pickupText)}</div>
        ${issueProgress.extraText ? `<div class="text-xs text-muted-foreground">${escapeHtml(issueProgress.extraText)}</div>` : ''}
      </div>
      ${
        draftSummary.notApplicableCount > 0
          ? `<div class="text-xs text-muted-foreground">不涉及 ${draftSummary.notApplicableCount}</div>`
          : ''
      }
    </div>
  `
}

function renderOrderMainFactory(order: ProductionOrder): string {
  const materialDisplay = getOrderMaterialDisplaySummary(order)
  const pending = isProductionOrderMainFactoryPending(order)
  const factoryRoleLabel =
    pending
      ? '车缝分配后确认'
      : materialDisplay.stage === 'PREVIEW' || materialDisplay.stage === 'NOT_READY'
      ? '预设主工厂'
      : '实际主工厂'
  const factoryName = formatProductionOrderMainFactoryName(order)

  return `
    <div class="text-sm">
      <div class="max-w-[150px] truncate font-medium" title="${escapeHtml(factoryName)}">
        ${escapeHtml(factoryName)}
      </div>
      <div class="mt-0.5 text-xs text-muted-foreground">${factoryRoleLabel}</div>
      <div class="mt-1 flex items-center gap-1">
        ${
          pending
            ? renderBadge('待同步', 'bg-amber-100 text-amber-700')
            : `${renderBadge(tierLabels[order.mainFactorySnapshot.tier as FactoryTier] ?? order.mainFactorySnapshot.tier, 'bg-slate-100 text-slate-700')}
               ${renderBadge(typeLabels[order.mainFactorySnapshot.type as FactoryType] ?? order.mainFactorySnapshot.type, 'bg-slate-100 text-slate-700')}`
        }
      </div>
    </div>
  `
}

function renderMaterialDraftTaskCard(draft: MaterialRequestDraft): string {
  const task = getProcessTaskById(draft.taskId)
  const isCreated = draft.draftStatus === 'created'
  const isNotApplicable = draft.draftStatus === 'not_applicable'

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="text-sm font-semibold">${escapeHtml(draft.taskName)}</h4>
            ${renderBadge(getTaskTypeLabel(draft.taskType), 'bg-slate-100 text-slate-700')}
            ${renderBadge(getDraftStatusLabel(draft.draftStatus), isCreated ? 'bg-green-100 text-green-700' : isNotApplicable ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700')}
            ${
              task
                ? renderBadge(taskStatusLabel[task.status], taskStatusClass[task.status])
                : ''
            }
          </div>
          <div class="text-xs text-muted-foreground">
            任务编号：${escapeHtml(draft.taskNo)} · 任务类型：${escapeHtml(getTaskTypeLabel(draft.taskType))}
          </div>
        </div>
      </div>

      <div class="mt-3 grid gap-3 md:grid-cols-3">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">是否需要领料</span>
          <label class="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-prod-action="toggle-material-draft-needed"
              data-draft-id="${escapeHtml(draft.draftId)}"
              ${draft.needMaterial ? 'checked' : ''}
              ${isCreated ? 'disabled' : ''}
            />
            需要领料
          </label>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">领料方式</span>
          <select
            data-prod-field="materialDraftMode:${escapeHtml(draft.draftId)}"
            class="h-9 w-full rounded-md border px-3 text-sm"
            ${isCreated || !draft.needMaterial ? 'disabled' : ''}
          >
            <option value="warehouse_delivery" ${draft.materialMode === 'warehouse_delivery' ? 'selected' : ''}>仓库配送到厂</option>
            <option value="factory_pickup" ${draft.materialMode === 'factory_pickup' ? 'selected' : ''}>工厂到仓自提</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">备注</span>
          <input
            data-prod-field="materialDraftRemark:${escapeHtml(draft.draftId)}"
            value="${escapeHtml(draft.remark)}"
            class="h-9 w-full rounded-md border px-3 text-sm"
            ${isCreated ? 'disabled' : ''}
            placeholder="可填写领料说明"
          />
        </label>
      </div>

      <div class="mt-3 overflow-x-auto rounded-md border">
        <table class="w-full min-w-[860px] text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">是否领用</th>
              <th class="px-3 py-2 text-left font-medium">物料来源</th>
              <th class="px-3 py-2 text-left font-medium">物料信息</th>
              <th class="px-3 py-2 text-right font-medium">建议数量</th>
              <th class="px-3 py-2 text-right font-medium">确认数量</th>
              <th class="px-3 py-2 text-left font-medium">单位</th>
              <th class="px-3 py-2 text-left font-medium">说明/来源说明</th>
            </tr>
          </thead>
          <tbody>
            ${
              draft.lines.length === 0
                ? renderEmptyRow(7, '当前任务暂无自动建议物料，可点击“补充物料”添加')
                : draft.lines
                    .map(
                      (line) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2">
                            <input
                              type="checkbox"
                              data-prod-action="toggle-material-draft-line"
                              data-draft-id="${escapeHtml(draft.draftId)}"
                              data-line-id="${escapeHtml(line.lineId)}"
                              ${line.selected ? 'checked' : ''}
                              ${isCreated || !draft.needMaterial ? 'disabled' : ''}
                            />
	                          </td>
	                          <td class="px-3 py-2">${renderBadge(line.sourceTypeLabel, line.sourceType === 'bom' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700')}</td>
	                          <td class="px-3 py-2">
                              ${renderMaterialIdentity({
                                materialName: line.materialName,
                                materialCode: line.materialCode,
                                materialSpec: line.materialSpec,
                                materialCategory: line.materialCategory,
                              }, true)}
                            </td>
                          <td class="px-3 py-2 text-right">${line.suggestedQty}</td>
                          <td class="px-3 py-2 text-right">
                            <input
                              data-prod-field="materialDraftLineQty:${escapeHtml(draft.draftId)}:${escapeHtml(line.lineId)}"
                              value="${line.confirmedQty}"
                              class="h-8 w-20 rounded-md border px-2 text-right text-sm"
                              ${isCreated || !draft.needMaterial || !line.selected ? 'disabled' : ''}
                            />
                          </td>
                          <td class="px-3 py-2">${escapeHtml(line.unit)}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(line.note)}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>

      ${
        isCreated
          ? `
            <div class="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <div>正式领料需求编号：${renderProductionObjectCodeButton({
                objectType: 'MATERIAL_PREP_ORDER',
                objectId: draft.createdMaterialRequestNo,
                label: draft.createdMaterialRequestNo,
                relatedProductionOrderNo: draft.productionOrderNo,
                defaultTab: 'materials',
              })}</div>
              <div class="mt-0.5 text-xs">创建人：${escapeHtml(draft.createdBy || '-')} · 创建时间：${escapeHtml(draft.createdAt || '-')}</div>
            </div>
          `
          : `
            <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
                data-prod-action="open-add-draft-materials"
                data-draft-id="${escapeHtml(draft.draftId)}"
                ${!draft.needMaterial ? 'disabled' : ''}
              >
                <i data-lucide="plus" class="mr-1 h-4 w-4"></i>
                补充物料
              </button>
              <div class="flex flex-wrap items-center gap-2">
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-prod-action="restore-material-draft-suggestion" data-draft-id="${escapeHtml(draft.draftId)}">
                  恢复系统建议
                </button>
                <button
                  class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
                  data-prod-action="confirm-material-request-draft"
                  data-draft-id="${escapeHtml(draft.draftId)}"
                >
                  确认创建
                </button>
              </div>
            </div>
          `
      }
    </section>
  `
}

function renderAddDraftMaterialsDialog(): string {
  const draftId = state.materialDraftAddDraftId
  if (!draftId) return ''

  const draft = getMaterialRequestDraftById(draftId)
  if (!draft) return ''

  const candidates = getSupplementOptionDisplayRows(draftId)

  return `
    <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-3xl rounded-lg border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 class="text-base font-semibold">补充物料</h3>
            <p class="text-xs text-muted-foreground">${escapeHtml(draft.taskName)} · ${escapeHtml(draft.taskNo)}</p>
          </div>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="close-add-draft-materials" aria-label="关闭">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </header>
        <div class="max-h-[60vh] overflow-y-auto p-4">
          <div class="overflow-x-auto rounded-md border">
            <table class="w-full min-w-[760px] text-sm">
              <thead class="bg-muted/40 text-xs text-muted-foreground">
                <tr>
	                  <th class="px-3 py-2 text-left font-medium">勾选</th>
	                  <th class="px-3 py-2 text-left font-medium">来源类型</th>
	                  <th class="px-3 py-2 text-left font-medium">物料信息</th>
	                  <th class="px-3 py-2 text-right font-medium">建议数量</th>
	                  <th class="px-3 py-2 text-left font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                ${
	                  candidates.length === 0
	                    ? renderEmptyRow(5, '当前无可补充物料')
                    : candidates
                        .map(
                          (option) => `
                            <tr class="border-b last:border-0">
                              <td class="px-3 py-2">
                                <input
                                  type="checkbox"
                                  data-prod-action="toggle-add-draft-material"
                                  data-option-key="${escapeHtml(option.optionKey)}"
                                  ${state.materialDraftAddSelections.has(option.optionKey) ? 'checked' : ''}
                                />
	                              </td>
	                              <td class="px-3 py-2">${renderBadge(option.sourceTypeLabel, option.sourceTypeLabel === 'BOM物料' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700')}</td>
	                              <td class="px-3 py-2">
                                  ${renderMaterialIdentity({
                                    materialName: option.materialName,
                                    materialCode: option.materialCode,
                                    materialSpec: option.materialSpec,
                                  }, true)}
                                </td>
                              <td class="px-3 py-2 text-right">${option.suggestedQty}${escapeHtml(option.unit)}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(option.note)}</td>
                            </tr>
                          `,
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-prod-action="close-add-draft-materials">取消</button>
          <button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90" data-prod-action="add-draft-materials">加入当前任务</button>
        </footer>
      </section>
    </div>
  `
}

function renderMaterialDraftDrawer(): string {
  const order = getOrderById(state.materialDraftOrderId)
  if (!order) return ''

  const drafts = listMaterialRequestDraftsByOrder(order.productionOrderId)
  const summary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId)
  const breakdown = getOrderDisplayBreakdownSnapshot(order)
  const techPackSnapshotDisplay = getOrderTechPackSnapshotDisplay(order)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-material-draft-drawer" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl xl:max-w-[980px]" data-dialog-panel="true">
        <header class="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold">配料 / 领料草稿</h3>
              <p class="mt-1 text-xs text-muted-foreground">按配料记录和任务生成系统建议草稿，确认后创建正式领料需求并挂接到任务</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="close-material-draft-drawer" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>
        <div class="h-[calc(100vh-73px)] space-y-4 overflow-y-auto p-5">
          <section class="rounded-lg border bg-card p-4">
            <div class="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <div class="text-xs text-muted-foreground">生产单号</div>
                <div class="font-mono text-sm">${renderProductionObjectCodeButton({
                  objectType: 'PRODUCTION_ORDER',
                  objectId: order.productionOrderNo,
                  relatedProductionOrderNo: order.productionOrderNo,
                })}</div>
              </div>
              <div class="md:col-span-2">
                <div class="text-xs text-muted-foreground">SPU信息</div>
                <div class="mt-1">${renderOrderSpuInfo(order)}</div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">技术包快照</div>
                <div class="text-sm">${escapeHtml(techPackSnapshotDisplay.techPackVersionText)}</div>
                <div class="text-xs text-muted-foreground">冻结时间 ${escapeHtml(techPackSnapshotDisplay.techPackSnapshotAt)}</div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">任务准备</div>
                <div class="text-sm">${escapeHtml(breakdown.label)}</div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">主工厂</div>
                <div class="truncate text-sm" title="${escapeHtml(formatProductionOrderMainFactoryName(order))}">${escapeHtml(formatProductionOrderMainFactoryName(order))}</div>
              </div>
            </div>
          </section>

          <section class="grid gap-3 md:grid-cols-4">
            ${renderStatCard('草稿总数', summary.totalDraftCount)}
            ${renderStatCard('待确认', summary.pendingCount)}
            ${renderStatCard('已创建', summary.createdCount)}
            ${renderStatCard('不涉及', summary.notApplicableCount)}
          </section>

          ${
            drafts.length === 0
              ? `
                <section class="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                  当前生产单暂无可识别领料任务，配料记录形成并进入分配后会自动生成建议草稿。
                </section>
              `
              : drafts.map((draft) => renderMaterialDraftTaskCard(draft)).join('')
          }
        </div>
      </section>
      ${renderAddDraftMaterialsDialog()}
    </div>
  `
}

export function renderProductionOrdersPage(): string {
  const filteredOrders = getFilteredOrders()
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))

  if (state.ordersCurrentPage > totalPages) {
    state.ordersCurrentPage = totalPages
  }

  const pagedOrders = getPaginatedOrders(filteredOrders)
  const selectedAll =
    state.ordersSelectedIds.size === pagedOrders.length && pagedOrders.length > 0
  const selectedOrderIds = [...state.ordersSelectedIds]
  const selectedBreakdownEligibleIds = selectedOrderIds.filter((orderId) => {
    const order = state.orders.find((item) => item.productionOrderId === orderId)
    return Boolean(order && canOrderStartTaskBreakdown(order))
  })
  const batchBreakdownDisabledReason =
    selectedOrderIds.length === 0
      ? '请先勾选生产单'
      : selectedBreakdownEligibleIds.length === 0
        ? '所选生产单没有可拆解任务'
        : ''
  const ordersFromDemandDialog = renderOrdersFromDemandDialog()
  const confirmDialog = renderDemandConfirmDialog()
  const breakdownReadinessDialog = renderOrderBreakdownReadinessDialog()
  const taskGenerationPreviewDialog = renderTaskGenerationPreviewDialog()

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">生产单管理</h1>
        <div class="flex flex-wrap items-center gap-2">
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="orders-from-demand">
            <i data-lucide="file-text" class="mr-1 h-4 w-4"></i>
            从需求生成
          </button>
          <button
            class="inline-flex items-center rounded-md border px-3 py-2 text-sm ${
              selectedBreakdownEligibleIds.length > 0 ? 'hover:bg-muted' : 'pointer-events-none opacity-50'
            }"
            title="${escapeHtml(batchBreakdownDisabledReason)}"
            data-prod-action="batch-breakdown-orders"
          >
            <i data-lucide="split" class="mr-1 h-4 w-4"></i>
            批量拆解任务 (${selectedBreakdownEligibleIds.length})
          </button>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="orders-export">
            <i data-lucide="download" class="mr-1 h-4 w-4"></i>
            导出
          </button>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="orders-refresh">
            <i data-lucide="refresh-cw" class="mr-1 h-4 w-4"></i>
            刷新
          </button>
          <div class="inline-flex overflow-hidden rounded-md border">
            <button
              class="inline-flex items-center px-3 py-2 text-sm ${state.ordersViewMode === 'table' ? 'bg-muted' : 'hover:bg-muted'}"
              data-prod-action="switch-orders-view"
              data-view="table"
              aria-label="表格视图"
            >
              <i data-lucide="table" class="h-4 w-4"></i>
            </button>
            <button
              class="inline-flex items-center px-3 py-2 text-sm ${state.ordersViewMode === 'board' ? 'bg-muted' : 'hover:bg-muted'}"
              data-prod-action="switch-orders-view"
              data-view="board"
              aria-label="看板视图"
            >
              <i data-lucide="layout-grid" class="h-4 w-4"></i>
            </button>
          </div>
        </div>
      </header>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <div>
            <span class="text-xs text-muted-foreground">关键词</span>
            <div class="relative mt-1">
              <i data-lucide="search" class="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"></i>
              <input
                data-prod-field="ordersKeyword"
                value="${escapeHtml(state.ordersKeyword)}"
                placeholder="生产单号/需求单号/售卖类型/SPU/工厂"
                class="h-9 w-full rounded-md border pl-8 pr-3 text-sm"
              />
            </div>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">生产单状态</span>
            <select data-prod-field="ordersStatusFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersStatusFilter.length === 0 ? 'selected' : ''}>全部</option>
              ${(Object.keys(productionOrderStatusConfig) as ProductionOrderStatus[])
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      state.ordersStatusFilter.length === 1 && state.ordersStatusFilter[0] === status
                        ? 'selected'
                        : ''
                    }>${escapeHtml(productionOrderStatusConfig[status].label)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">任务准备</span>
            <select data-prod-field="ordersBreakdownFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersBreakdownFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="PENDING" ${state.ordersBreakdownFilter === 'PENDING' ? 'selected' : ''}>未拆解</option>
              <option value="ACTIVE" ${state.ordersBreakdownFilter === 'ACTIVE' ? 'selected' : ''}>已进入分配</option>
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">分配进度</span>
            <select data-prod-field="ordersAssignmentProgressFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersAssignmentProgressFilter === 'ALL' ? 'selected' : ''}>全部</option>
              ${(Object.keys(assignmentProgressStatusConfig) as AssignmentProgressStatus[])
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      state.ordersAssignmentProgressFilter === status ? 'selected' : ''
                    }>${escapeHtml(assignmentProgressStatusConfig[status].label)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">分配模式</span>
            <select data-prod-field="ordersAssignmentModeFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersAssignmentModeFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="DIRECT_ONLY" ${
                state.ordersAssignmentModeFilter === 'DIRECT_ONLY' ? 'selected' : ''
              }>仅派单</option>
              <option value="BIDDING_ONLY" ${
                state.ordersAssignmentModeFilter === 'BIDDING_ONLY' ? 'selected' : ''
              }>仅竞价</option>
              <option value="MIXED" ${state.ordersAssignmentModeFilter === 'MIXED' ? 'selected' : ''}>混合模式</option>
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">竞价风险</span>
            <select data-prod-field="ordersBiddingRiskFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersBiddingRiskFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="OVERDUE" ${state.ordersBiddingRiskFilter === 'OVERDUE' ? 'selected' : ''}>有过期</option>
              <option value="NEAR_DEADLINE" ${
                state.ordersBiddingRiskFilter === 'NEAR_DEADLINE' ? 'selected' : ''
              }>临近截止(&lt;24h)</option>
              <option value="NONE" ${state.ordersBiddingRiskFilter === 'NONE' ? 'selected' : ''}>无竞价</option>
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">主工厂层级（已指定）</span>
            <select data-prod-field="ordersTierFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersTierFilter === 'ALL' ? 'selected' : ''}>全部</option>
              ${(Object.keys(tierLabels) as FactoryTier[])
                .map(
                  (tier) =>
                    `<option value="${tier}" ${
                      state.ordersTierFilter === tier ? 'selected' : ''
                    }>${escapeHtml(tierLabels[tier])}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">是否创建领料草稿</span>
            <select data-prod-field="ordersHasMaterialDraftFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersHasMaterialDraftFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="YES" ${state.ordersHasMaterialDraftFilter === 'YES' ? 'selected' : ''}>是</option>
              <option value="NO" ${state.ordersHasMaterialDraftFilter === 'NO' ? 'selected' : ''}>否</option>
            </select>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">是否确认领料</span>
            <select data-prod-field="ordersHasConfirmedMaterialRequestFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersHasConfirmedMaterialRequestFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="YES" ${state.ordersHasConfirmedMaterialRequestFilter === 'YES' ? 'selected' : ''}>是</option>
              <option value="NO" ${state.ordersHasConfirmedMaterialRequestFilter === 'NO' ? 'selected' : ''}>否</option>
            </select>
          </div>

          <div class="flex items-end gap-2">
            <button class="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90" data-prod-action="query-orders">查询</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="reset-orders-filters">重置</button>
          </div>
        </div>
      </section>

      <div class="rounded-lg border">
        <div class="overflow-x-auto overflow-y-visible">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-muted/50">
                <th class="w-10 px-3 py-3 text-left">
                  <input type="checkbox" data-prod-action="toggle-orders-select-all" ${
                    selectedAll ? 'checked' : ''
                  } />
                </th>
                <th class="min-w-[190px] px-3 py-3 text-left font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
                <th class="min-w-[260px] px-3 py-3 text-left font-medium">SPU信息</th>
                <th class="min-w-[100px] px-3 py-3 text-left font-medium">状态</th>
                <th class="min-w-[220px] px-3 py-3 text-left font-medium">需求信息</th>
                <th class="min-w-[170px] px-3 py-3 text-left font-medium">任务分配</th>
                <th class="min-w-[250px] px-3 py-3 text-left font-medium">任务生成</th>
                <th class="min-w-[180px] px-3 py-3 text-left font-medium">主工厂</th>
                <th class="min-w-[150px] px-3 py-3 text-left font-medium">风险</th>
                <th class="min-w-[100px] px-3 py-3 text-left font-medium">最近更新</th>
                <th class="sticky right-0 z-20 min-w-[360px] bg-muted/50 px-3 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                pagedOrders.length === 0
                  ? renderEmptyRow(11, '暂无数据')
                  : pagedOrders
                    .map((order) => {
                        const techPackSnapshotDisplay = getOrderTechPackSnapshotDisplay(order)
                        const mergedLogs = getOrderMergedAuditLogs(order)
                        const lastLog = mergedLogs[mergedLogs.length - 1]
                        const confirmationPreviewState = getOrderConfirmationPreviewState(order)
                        const breakdownDisabledReason = getOrderTaskBreakdownDisabledReason(order)
                        const canBreakdownOrder = canOrderStartTaskBreakdown(order)
                        const orderActionButtons = [
                          renderOrderTextActionButton({
                            label: '详情',
                            action: 'open-order-detail',
                            orderId: order.productionOrderId,
                          }),
                          renderOrderTextActionButton({
                            label: '日志',
                            action: 'open-orders-logs',
                            orderId: order.productionOrderId,
                          }),
                          renderOrderTextActionButton({
                            label: '物料检查',
                            action: 'open-breakdown-readiness',
                            orderId: order.productionOrderId,
                          }),
                          renderOrderTextActionButton({
                            label: '拆解任务',
                            action: 'breakdown-order',
                            orderId: order.productionOrderId,
                            disabled: !canBreakdownOrder,
                            title: breakdownDisabledReason,
                          }),
                          renderOrderTextActionButton({
                            label: '打印确认单',
                            nav: confirmationPreviewState.href,
                            disabled: !confirmationPreviewState.available,
                            title: confirmationPreviewState.title,
                          }),
                          renderOrderTextActionButton({
                            label: '领料草稿',
                            action: 'open-material-draft-drawer',
                            orderId: order.productionOrderId,
                          }),
                        ].join('')

                        return `
                          <tr class="cursor-pointer border-b last:border-0 hover:bg-muted/30" data-prod-action="open-order-detail" data-order-id="${order.productionOrderId}">
                            <td class="px-3 py-3" data-prod-action="noop">
                              <input type="checkbox" data-prod-action="toggle-orders-select" data-order-id="${
                                order.productionOrderId
                              }" ${state.ordersSelectedIds.has(order.productionOrderId) ? 'checked' : ''} />
                            </td>
                            <td class="px-3 py-3">
                              <div class="space-y-1">
                                ${renderProductionOrderIdentityCell(order.productionOrderId)}
                                <div class="font-mono text-xs text-muted-foreground">旧单号：${escapeHtml(order.legacyOrderNo)}</div>
                              </div>
                            </td>
                            <td class="px-3 py-3">${renderOrderSpuInfo(order, {
                              garmentDifficultyGrade: techPackSnapshotDisplay.garmentDifficultyGrade,
                              showTechPackVersion: true,
                            })}</td>
                            <td class="px-3 py-3">
                              ${renderBadge(getOrderListStatusDisplay(order).label, getOrderListStatusDisplay(order).color)}
                            </td>
                            <td class="px-3 py-3">${renderOrderDemandInfo(order)}</td>
                            <td class="px-3 py-3">${renderOrderAssignmentOverview(order)}</td>
                            <td class="px-3 py-3">${renderOrderTaskGenerationSummary(order)}</td>
                            <td class="px-3 py-3">${renderOrderMainFactory(order)}</td>
                            <td class="px-3 py-3">${renderOrderRiskFlags(order.riskFlags)}</td>
                            <td class="px-3 py-3 text-sm text-muted-foreground">
                              ${escapeHtml(safeText(lastLog?.at.split(' ')[0] ?? order.updatedAt.split(' ')[0]))}
                            </td>
                            <td class="sticky right-0 z-10 min-w-[360px] bg-background px-3 py-4 align-top" data-prod-action="noop">
                              <div class="flex max-w-[360px] flex-wrap items-center gap-2">
                                ${orderActionButtons}
                              </div>
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

      <footer class="flex items-center justify-between text-sm">
        <p class="text-muted-foreground">共 ${filteredOrders.length} 条记录${
          state.ordersSelectedIds.size > 0 ? `，已选 ${state.ordersSelectedIds.size} 项` : ''
        }</p>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border ${
            state.ordersCurrentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'
          }" data-prod-action="orders-prev-page" aria-label="上一页">
            <i data-lucide="chevron-left" class="h-4 w-4"></i>
          </button>
          <span>${state.ordersCurrentPage} / ${totalPages || 1}</span>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border ${
            state.ordersCurrentPage >= totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'
          }" data-prod-action="orders-next-page" aria-label="下一页">
            <i data-lucide="chevron-right" class="h-4 w-4"></i>
          </button>
        </div>
      </footer>

      <div data-production-orders-overlay-root="true">${renderMaterialDraftDrawer()}</div>
      ${renderOrderDemandSnapshotDrawer()}
      ${renderOrderTechPackSnapshotDialog()}
      ${renderOrderLogsDialog()}
      ${breakdownReadinessDialog}
      ${taskGenerationPreviewDialog}
      ${ordersFromDemandDialog}
      ${confirmDialog}
    </div>
  `
}

export {
  renderOrderRiskFlags,
  renderOrderAssignmentOverview,
  renderOrderDemandSnapshotDrawer,
  renderOrderLogsDialog,
  renderOrderBreakdownReadinessDialog,
  getOrderMaterialIndicators,
  getOrderSplitAuditLogs,
  getOrderMergedAuditLogs,
  renderOrderMaterialSummary,
  renderMaterialDraftTaskCard,
  renderAddDraftMaterialsDialog,
  renderMaterialDraftDrawer,
}
