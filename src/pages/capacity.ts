import { productionOrders } from '../data/fcs/production-orders'
import {
  listLegacyLikeDeductionBasisForTailPages,
  listLegacyLikeDyePrintOrdersForTailPages,
  listLegacyLikeExceptionsForTailPages,
  listLegacyLikeProcessTasksForTailPages,
  listLegacyLikeQualityInspectionsForTailPages,
} from '../data/fcs/page-adapters/long-tail-pages-adapter'
import { escapeHtml, toClassName } from '../utils'

const processTasks = listLegacyLikeProcessTasksForTailPages()
const legacyLikeQualityInspections = listLegacyLikeQualityInspectionsForTailPages()
const legacyLikeDeductionBasisItems = listLegacyLikeDeductionBasisForTailPages()
const legacyLikeDyePrintOrders = listLegacyLikeDyePrintOrdersForTailPages()
const legacyLikeExceptions = listLegacyLikeExceptionsForTailPages()

type Tone = 'default' | 'secondary' | 'destructive' | 'outline'

type OverviewTab = 'factory' | 'order'
type RiskTab = 'task' | 'order'
type BottleneckTab = 'factory' | 'order' | 'task'
type ConstraintsTab = 'task' | 'factory'
type PoliciesTab = 'order' | 'task'

interface CapacityState {
  overviewKeyword: string
  overviewTab: OverviewTab
  riskKeyword: string
  riskTab: RiskTab
  bottleneckKeyword: string
  bottleneckTab: BottleneckTab
  constraintsKeyword: string
  constraintsTab: ConstraintsTab
  policiesKeyword: string
  policiesTab: PoliciesTab
}

const state: CapacityState = {
  overviewKeyword: '',
  overviewTab: 'factory',
  riskKeyword: '',
  riskTab: 'task',
  bottleneckKeyword: '',
  bottleneckTab: 'factory',
  constraintsKeyword: '',
  constraintsTab: 'task',
  policiesKeyword: '',
  policiesTab: 'order',
}

const TASK_STATUS_ZH: Record<string, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '生产暂停',
  CANCELLED: '已取消',
}

const toneClassMap: Record<Tone, string> = {
  default: 'border-blue-200 bg-blue-50 text-blue-700',
  secondary: 'border-slate-200 bg-slate-100 text-slate-700',
  destructive: 'border-red-200 bg-red-50 text-red-700',
  outline: 'border-slate-300 bg-transparent text-slate-600',
}

function renderBadge(text: string, tone: Tone = 'secondary', className = ''): string {
  return `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${toneClassMap[tone]} ${className}">${escapeHtml(text)}</span>`
}

function renderStatCard(label: string, value: number, valueClass = ''): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="px-4 pb-4 pt-4">
        <p class="text-xs font-medium leading-snug text-muted-foreground">${escapeHtml(label)}</p>
        <p class="mt-1 text-2xl font-bold ${valueClass}">${value}</p>
      </div>
    </article>
  `
}

function renderPageHint(text: string): string {
  return `<div class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">${escapeHtml(text)}</div>`
}

function renderTabButton(page: string, tab: string, current: string, label: string): string {
  const active = current === tab
  return `
    <button
      data-capacity-action="switch-tab"
      data-page="${page}"
      data-tab="${tab}"
      class="rounded-md border px-3 py-1.5 text-sm transition ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-muted-foreground hover:bg-muted'
      }"
    >
      ${escapeHtml(label)}
    </button>
  `
}

function taskStatusText(status: string): string {
  return TASK_STATUS_ZH[status] ?? status
}

function orderFactoryName(orderId: string): string {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  return order?.mainFactorySnapshot?.name ?? order?.mainFactoryId ?? '—'
}

function getOrderDyeStatus(orderId: string): string {
  const orderDyes = legacyLikeDyePrintOrders.filter((item) => item.productionOrderId === orderId)
  if (orderDyes.length === 0) return '无染印'
  if (orderDyes.some((item) => item.availableQty > 0)) return '可继续'
  return '生产暂停'
}

function getOrderQcPendingCount(orderId: string): number {
  return legacyLikeQualityInspections.filter(
    (item) => item.productionOrderId === orderId && item.status !== 'CLOSED',
  ).length
}

function getOrderOpenExceptionCount(orderId: string): number {
  return legacyLikeExceptions.filter(
    (item) => item.relatedOrderIds.includes(orderId) && item.caseStatus !== 'CLOSED',
  ).length
}

function includesKeyword(value: string, keyword: string): boolean {
  return value.toLowerCase().includes(keyword)
}

function toLower(value: string | undefined | null): string {
  return (value ?? '').toLowerCase()
}

function getOverviewStats() {
  const orders = productionOrders.length
  const tasks = processTasks.length
  const blocked = processTasks.filter((task) => task.status === 'BLOCKED').length
  const dyePending = legacyLikeDyePrintOrders.filter((dpo) => dpo.availableQty <= 0).length
  const qcPending = legacyLikeQualityInspections.filter((item) => item.status !== 'CLOSED').length
  const settlementReady = legacyLikeDeductionBasisItems.filter((item) => item.settlementReady === true).length

  return { orders, tasks, blocked, dyePending, qcPending, settlementReady }
}

function getOverviewFactoryRows() {
  const map = new Map<
    string,
    {
      factoryId: string
      taskCount: number
      blockedCount: number
      orderIds: Set<string>
      dyeCount: number
      qcPendingCount: number
    }
  >()

  for (const task of processTasks) {
    const factoryId =
      task.assignedFactoryId ??
      productionOrders.find((order) => order.productionOrderId === task.productionOrderId)?.mainFactoryId ??
      '未知工厂'

    if (!map.has(factoryId)) {
      map.set(factoryId, {
        factoryId,
        taskCount: 0,
        blockedCount: 0,
        orderIds: new Set<string>(),
        dyeCount: 0,
        qcPendingCount: 0,
      })
    }

    const row = map.get(factoryId)
    if (!row) continue
    row.taskCount += 1
    row.orderIds.add(task.productionOrderId)
    if (task.status === 'BLOCKED') row.blockedCount += 1
  }

  for (const dpo of legacyLikeDyePrintOrders) {
    const factoryId = dpo.processorFactoryId ?? '未知工厂'
    if (!map.has(factoryId)) {
      map.set(factoryId, {
        factoryId,
        taskCount: 0,
        blockedCount: 0,
        orderIds: new Set<string>(),
        dyeCount: 0,
        qcPendingCount: 0,
      })
    }

    const row = map.get(factoryId)
    if (!row) continue
    row.dyeCount += 1
  }

  for (const qc of legacyLikeQualityInspections.filter((item) => item.status !== 'CLOSED')) {
    const basis = legacyLikeDeductionBasisItems.find(
      (item) => item.sourceRefId === qc.qcId || item.sourceId === qc.qcId,
    )
    const factoryId =
      basis?.factoryId ??
      productionOrders.find((order) => order.productionOrderId === qc.productionOrderId)?.mainFactoryId ??
      '未知工厂'

    if (!map.has(factoryId)) {
      map.set(factoryId, {
        factoryId,
        taskCount: 0,
        blockedCount: 0,
        orderIds: new Set<string>(),
        dyeCount: 0,
        qcPendingCount: 0,
      })
    }

    const row = map.get(factoryId)
    if (!row) continue
    row.qcPendingCount += 1
  }

  return [...map.values()].map((item) => {
    const loadStatus =
      item.blockedCount > 0 ? '存在生产暂停' : item.taskCount >= 10 ? '高占用' : item.taskCount >= 1 ? '正常' : '空闲'

    return {
      factoryId: item.factoryId,
      taskCount: item.taskCount,
      blockedCount: item.blockedCount,
      orderCount: item.orderIds.size,
      dyeCount: item.dyeCount,
      qcPendingCount: item.qcPendingCount,
      loadStatus,
    }
  })
}

function getOverviewOrderRows() {
  return productionOrders.map((order) => {
    const tasks = processTasks.filter((task) => task.productionOrderId === order.productionOrderId)
    const blockedCount = tasks.filter((task) => task.status === 'BLOCKED').length
    const taskCount = tasks.length
    const dyeStatus = getOrderDyeStatus(order.productionOrderId)
    const qcPending = getOrderQcPendingCount(order.productionOrderId)

    const pressure =
      blockedCount > 0
        ? '高风险'
        : qcPending > 0
          ? '待质检'
          : dyeStatus === '生产暂停'
            ? '待进入下一步'
            : taskCount > 0
              ? '可推进'
              : '未启动'

    return {
      productionOrderId: order.productionOrderId,
      mainFactory: order.mainFactorySnapshot?.name ?? order.mainFactoryId ?? '—',
      taskCount,
      blockedCount,
      dyeStatus,
      qcPending,
      pressure,
    }
  })
}

function renderOverviewFactoryTable(keyword: string): string {
  const rows = getOverviewFactoryRows().filter((row) => {
    if (!keyword) return true
    return includesKeyword(toLower(row.factoryId), keyword)
  })

  if (rows.length === 0) {
    return '<tr><td colspan="8" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无工厂产能占用数据</td></tr>'
  }

  return rows
    .map((row) => {
      const loadTone: Tone =
        row.loadStatus === '存在生产暂停'
          ? 'destructive'
          : row.loadStatus === '高占用'
            ? 'default'
            : row.loadStatus === '空闲'
              ? 'outline'
              : 'secondary'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 text-sm font-mono">${escapeHtml(row.factoryId)}</td>
          <td class="px-3 py-3 text-center text-sm">${row.taskCount}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.blockedCount > 0 ? renderBadge(String(row.blockedCount), 'destructive') : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3 text-center text-sm">${row.orderCount}</td>
          <td class="px-3 py-3 text-center text-sm">${row.dyeCount}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.qcPendingCount > 0 ? renderBadge(String(row.qcPendingCount), 'default') : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.loadStatus, loadTone)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/production/orders" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderOverviewOrderTable(keyword: string): string {
  const rows = getOverviewOrderRows().filter((row) => {
    if (!keyword) return true
    return (
      includesKeyword(toLower(row.productionOrderId), keyword) || includesKeyword(toLower(row.mainFactory), keyword)
    )
  })

  if (rows.length === 0) {
    return '<tr><td colspan="8" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无生产单交付压力数据</td></tr>'
  }

  return rows
    .map((row) => {
      const dyeTone: Tone =
        row.dyeStatus === '生产暂停'
          ? 'destructive'
          : row.dyeStatus === '可继续'
            ? 'default'
            : 'outline'

      const pressureTone: Tone =
        row.pressure === '高风险'
          ? 'destructive'
          : row.pressure === '待质检' || row.pressure === '待进入下一步'
            ? 'default'
            : row.pressure === '可推进'
              ? 'secondary'
              : 'outline'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.productionOrderId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.mainFactory)}</td>
          <td class="px-3 py-3 text-center text-sm">${row.taskCount}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.blockedCount > 0 ? renderBadge(String(row.blockedCount), 'destructive') : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.dyeStatus, dyeTone)}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.qcPending > 0 ? renderBadge(String(row.qcPending), 'default') : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.pressure, pressureTone)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/production/orders/${row.productionOrderId}" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/process/dye-orders" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看染印</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

export function renderCapacityOverviewPage(): string {
  const stats = getOverviewStats()
  const keyword = state.overviewKeyword.trim().toLowerCase()

  return `
    <div class="space-y-6">
      <header class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">产能汇总看板</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">共 ${getOverviewFactoryRows().length} 个工厂 / ${productionOrders.length} 张生产单</p>
        </div>
      </header>

      ${renderPageHint('产能汇总看板用于从任务占用、生产暂停、染印、质检等维度观察当前生产负载；原型阶段采用轻量聚合口径，不做真实工时测算')}

      <section class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        ${renderStatCard('生产单总数', stats.orders)}
        ${renderStatCard('任务总数', stats.tasks)}
        ${renderStatCard('生产暂停任务数', stats.blocked)}
        ${renderStatCard('染印生产暂停工单数', stats.dyePending)}
        ${renderStatCard('待质检数', stats.qcPending)}
        ${renderStatCard('可进入结算扣款依据数', stats.settlementReady)}
      </section>

      <section class="flex max-w-sm items-center gap-2">
        <input
          data-capacity-filter="overview-keyword"
          value="${escapeHtml(state.overviewKeyword)}"
          placeholder="关键词（生产单号 / 工厂 / 任务ID）"
          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
      </section>

      <section class="space-y-4">
        <div class="inline-flex rounded-md bg-muted p-1">
          <button
            data-capacity-action="switch-tab"
            data-page="overview"
            data-tab="factory"
            class="${
              state.overviewTab === 'factory'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
          >
            工厂产能占用
          </button>
          <button
            data-capacity-action="switch-tab"
            data-page="overview"
            data-tab="order"
            class="${
              state.overviewTab === 'order'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
          >
            生产单交付压力
          </button>
        </div>

        ${
          state.overviewTab === 'factory'
            ? `
              <div class="rounded-md border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">工厂</th>
                      <th class="px-3 py-2 text-center font-medium">关联任务数</th>
                      <th class="px-3 py-2 text-center font-medium">生产暂停任务数</th>
                      <th class="px-3 py-2 text-center font-medium">关联生产单数</th>
                      <th class="px-3 py-2 text-center font-medium">染印工单数</th>
                      <th class="px-3 py-2 text-center font-medium">待质检数</th>
                      <th class="px-3 py-2 text-left font-medium">产能占用状态</th>
                      <th class="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>${renderOverviewFactoryTable(keyword)}</tbody>
                </table>
              </div>
            `
            : `
              <div class="rounded-md border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">生产单号</th>
                      <th class="px-3 py-2 text-left font-medium">主工厂</th>
                      <th class="px-3 py-2 text-center font-medium">关联任务数</th>
                      <th class="px-3 py-2 text-center font-medium">生产暂停任务数</th>
                      <th class="px-3 py-2 text-left font-medium">染印状态</th>
                      <th class="px-3 py-2 text-center font-medium">待质检数</th>
                      <th class="px-3 py-2 text-left font-medium">交付压力摘要</th>
                      <th class="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>${renderOverviewOrderTable(keyword)}</tbody>
                </table>
              </div>
            `
        }
      </section>
    </div>
  `
}

function getRiskTaskRows() {
  return processTasks.map((task) => {
    const orderDyes = legacyLikeDyePrintOrders.filter((dpo) => dpo.productionOrderId === task.productionOrderId)
    const orderQcs = legacyLikeQualityInspections.filter((qc) => qc.productionOrderId === task.productionOrderId)

    const dyeRiskZh =
      orderDyes.length === 0
        ? '无染印风险'
        : orderDyes.every((dpo) => dpo.availableQty <= 0)
          ? '染印生产暂停'
          : '染印可继续'

    const qcRiskZh = orderQcs.some((qc) => qc.status !== 'CLOSED') ? '待质检' : '无质检风险'

    const deliveryRiskZh =
      task.status === 'BLOCKED'
        ? '高风险'
        : qcRiskZh === '待质检' || dyeRiskZh === '染印生产暂停'
          ? '中风险'
          : task.status === 'IN_PROGRESS'
            ? '可推进'
            : '低风险'

    return {
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      factorySummaryZh: task.assignedFactoryId ?? '—',
      taskStatusZh: taskStatusText(task.status),
      blockedFlag: task.status === 'BLOCKED' ? '是' : '否',
      dyeRiskZh,
      qcRiskZh,
      deliveryRiskZh,
    }
  })
}

function getRiskOrderRows() {
  return productionOrders.map((order) => {
    const tasks = processTasks.filter((task) => task.productionOrderId === order.productionOrderId)
    const blockedTaskCount = tasks.filter((task) => task.status === 'BLOCKED').length
    const qcPendingCount = getOrderQcPendingCount(order.productionOrderId)
    const dyeStatusZh = getOrderDyeStatus(order.productionOrderId)

    const riskSummaryZh =
      blockedTaskCount > 0
        ? '高风险'
        : qcPendingCount > 0
          ? '待质检风险'
          : dyeStatusZh === '生产暂停'
            ? '待进入下一步风险'
            : tasks.length > 0
              ? '可推进'
              : '未启动'

    return {
      productionOrderId: order.productionOrderId,
      factorySummaryZh: order.mainFactorySnapshot?.name ?? order.mainFactoryId ?? '—',
      taskCount: tasks.length,
      blockedTaskCount,
      qcPendingCount,
      dyeStatusZh,
      riskSummaryZh,
    }
  })
}

function renderRiskTaskTable(keyword: string): string {
  const rows = getRiskTaskRows().filter((row) => {
    if (!keyword) return true
    return (
      includesKeyword(toLower(row.taskId), keyword) ||
      includesKeyword(toLower(row.productionOrderId), keyword) ||
      includesKeyword(toLower(row.factorySummaryZh), keyword)
    )
  })

  if (rows.length === 0) {
    return '<tr><td colspan="9" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无任务占用数据</td></tr>'
  }

  return rows
    .map((row) => {
      const blockedTone: Tone = row.blockedFlag === '是' ? 'destructive' : 'outline'
      const dyeTone: Tone = row.dyeRiskZh === '染印生产暂停' ? 'default' : row.dyeRiskZh === '染印可继续' ? 'secondary' : 'outline'
      const qcTone: Tone = row.qcRiskZh === '待质检' ? 'default' : 'outline'
      const deliveryTone: Tone =
        row.deliveryRiskZh === '高风险'
          ? 'destructive'
          : row.deliveryRiskZh === '中风险'
            ? 'default'
            : row.deliveryRiskZh === '可推进'
              ? 'secondary'
              : 'outline'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.taskId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.productionOrderId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.factorySummaryZh)}</td>
          <td class="px-3 py-3">${renderBadge(row.taskStatusZh)}</td>
          <td class="px-3 py-3">${renderBadge(row.blockedFlag, blockedTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.dyeRiskZh, dyeTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.qcRiskZh, qcTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.deliveryRiskZh, deliveryTone)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/production/orders/${row.productionOrderId}" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
              <button data-nav="/fcs/process/dye-orders" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看染印</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderRiskOrderTable(keyword: string): string {
  const rows = getRiskOrderRows().filter((row) => {
    if (!keyword) return true
    return (
      includesKeyword(toLower(row.productionOrderId), keyword) ||
      includesKeyword(toLower(row.factorySummaryZh), keyword)
    )
  })

  if (rows.length === 0) {
    return '<tr><td colspan="8" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无生产单交付风险数据</td></tr>'
  }

  return rows
    .map((row) => {
      const dyeTone: Tone = row.dyeStatusZh === '生产暂停' ? 'default' : row.dyeStatusZh === '可继续' ? 'secondary' : 'outline'
      const riskTone: Tone =
        row.riskSummaryZh === '高风险'
          ? 'destructive'
          : row.riskSummaryZh === '待质检风险' || row.riskSummaryZh === '待进入下一步风险'
            ? 'default'
            : row.riskSummaryZh === '可推进'
              ? 'secondary'
              : 'outline'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(row.productionOrderId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.factorySummaryZh)}</td>
          <td class="px-3 py-3 text-center text-sm">${row.taskCount}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.blockedTaskCount > 0
              ? renderBadge(String(row.blockedTaskCount), 'destructive')
              : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.qcPendingCount > 0
              ? renderBadge(String(row.qcPendingCount), 'default')
              : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.dyeStatusZh, dyeTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.riskSummaryZh, riskTone)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/production/orders/${row.productionOrderId}" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/quality/qc-records" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看质检</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

export function renderCapacityRiskPage(): string {
  const orderRows = getRiskOrderRows()
  const stats = {
    taskTotal: processTasks.length,
    blocked: processTasks.filter((task) => task.status === 'BLOCKED').length,
    qcPending: orderRows.filter((row) => row.qcPendingCount > 0).length,
    dyePending: orderRows.filter((row) => row.dyeStatusZh === '生产暂停').length,
    highRisk: orderRows.filter((row) => row.riskSummaryZh === '高风险').length,
    ok: orderRows.filter((row) => row.riskSummaryZh === '可推进').length,
  }

  const keyword = state.riskKeyword.trim().toLowerCase()

  return `
    <div class="space-y-6">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold tracking-tight text-balance">任务占用与交付风险</h1>
        <p class="text-sm text-muted-foreground">共 ${processTasks.length} 条任务 / ${productionOrders.length} 张生产单</p>
      </header>

      ${renderPageHint('任务占用与交付风险用于识别当前生产暂停任务、染印是否可继续、待质检等交付压力；原型阶段采用轻量聚合口径')}

      <section class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        ${renderStatCard('任务总数', stats.taskTotal)}
        ${renderStatCard('生产暂停任务数', stats.blocked)}
        ${renderStatCard('待质检生产单数', stats.qcPending)}
        ${renderStatCard('染印生产暂停生产单数', stats.dyePending)}
        ${renderStatCard('高风险生产单数', stats.highRisk)}
        ${renderStatCard('可推进生产单数', stats.ok)}
      </section>

      <section class="flex items-center gap-3">
        <input
          data-capacity-filter="risk-keyword"
          value="${escapeHtml(state.riskKeyword)}"
          placeholder="关键词（生产单号 / 任务ID / 工厂）"
          class="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
        />
      </section>

      <section class="space-y-4">
        <div class="inline-flex rounded-md bg-muted p-1">
          <button
            data-capacity-action="switch-tab"
            data-page="risk"
            data-tab="task"
            class="${
              state.riskTab === 'task'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
          >
            任务占用明细
          </button>
          <button
            data-capacity-action="switch-tab"
            data-page="risk"
            data-tab="order"
            class="${
              state.riskTab === 'order'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
          >
            生产单交付风险
          </button>
        </div>

        ${
          state.riskTab === 'task'
            ? `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">任务ID</th>
                      <th class="px-3 py-2 text-left font-medium">生产单号</th>
                      <th class="px-3 py-2 text-left font-medium">工厂</th>
                      <th class="px-3 py-2 text-left font-medium">任务状态</th>
                      <th class="px-3 py-2 text-left font-medium">是否生产暂停</th>
                      <th class="px-3 py-2 text-left font-medium">染印风险</th>
                      <th class="px-3 py-2 text-left font-medium">质检风险</th>
                      <th class="px-3 py-2 text-left font-medium">交付风险</th>
                      <th class="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>${renderRiskTaskTable(keyword)}</tbody>
                </table>
              </div>
            `
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">生产单号</th>
                      <th class="px-3 py-2 text-left font-medium">主工厂</th>
                      <th class="px-3 py-2 text-center font-medium">关联任务数</th>
                      <th class="px-3 py-2 text-center font-medium">生产暂停任务数</th>
                      <th class="px-3 py-2 text-center font-medium">待质检数</th>
                      <th class="px-3 py-2 text-left font-medium">染印状态</th>
                      <th class="px-3 py-2 text-left font-medium">风险摘要</th>
                      <th class="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>${renderRiskOrderTable(keyword)}</tbody>
                </table>
              </div>
            `
        }
      </section>
    </div>
  `
}

function getBottleneckFactoryRows() {
  const map = new Map<
    string,
    {
      factorySummaryZh: string
      taskIds: Set<string>
      orderIds: Set<string>
    }
  >()

  for (const task of processTasks) {
    const key = task.assignedFactoryId ?? '未识别工厂'
    if (!map.has(key)) {
      map.set(key, {
        factorySummaryZh: key,
        taskIds: new Set<string>(),
        orderIds: new Set<string>(),
      })
    }

    const target = map.get(key)
    if (!target) continue
    target.taskIds.add(task.taskId)
    target.orderIds.add(task.productionOrderId)
  }

  return [...map.values()].map((item) => {
    const tasks = processTasks.filter((task) => item.taskIds.has(task.taskId))
    const taskCount = tasks.length
    const blockedTaskCount = tasks.filter((task) => task.status === 'BLOCKED').length

    const qcPendingCount = legacyLikeQualityInspections.filter(
      (qc) => item.orderIds.has(qc.productionOrderId) && qc.status !== 'CLOSED',
    ).length

    const dyePendingCount = legacyLikeDyePrintOrders.filter(
      (dpo) => item.orderIds.has(dpo.productionOrderId) && dpo.availableQty <= 0,
    ).length

    const bottleneckLevelZh =
      blockedTaskCount >= 3
        ? '高'
        : qcPendingCount >= 2 || dyePendingCount >= 2 || taskCount >= 8
          ? '中'
          : '低'

    const bottleneckReasonZh =
      blockedTaskCount > 0
        ? '生产暂停任务偏多'
        : qcPendingCount > 0
          ? '待质检积压'
          : dyePendingCount > 0
            ? '染印生产暂停'
            : taskCount >= 8
              ? '任务占用偏高'
              : '无明显瓶颈'

    return {
      factorySummaryZh: item.factorySummaryZh,
      taskCount,
      blockedTaskCount,
      qcPendingCount,
      dyePendingCount,
      bottleneckLevelZh,
      bottleneckReasonZh,
    }
  })
}

function getBottleneckOrderRows() {
  return productionOrders.map((order) => {
    const tasks = processTasks.filter((task) => task.productionOrderId === order.productionOrderId)
    const taskCount = tasks.length
    const blockedTaskCount = tasks.filter((task) => task.status === 'BLOCKED').length
    const qcPendingCount = getOrderQcPendingCount(order.productionOrderId)
    const dyeStatusZh = getOrderDyeStatus(order.productionOrderId)

    const bottleneckLevelZh =
      blockedTaskCount > 0
        ? '高'
        : qcPendingCount > 0 || dyeStatusZh === '生产暂停' || taskCount >= 6
          ? '中'
          : '低'

    const bottleneckReasonZh =
      blockedTaskCount > 0
        ? '生产暂停任务未解除'
        : qcPendingCount > 0
          ? '待质检未清'
          : dyeStatusZh === '生产暂停'
            ? '染印待进入下一步'
            : taskCount >= 6
              ? '任务链较长'
              : '无明显瓶颈'

    return {
      productionOrderId: order.productionOrderId,
      factorySummaryZh: order.mainFactorySnapshot?.name ?? order.mainFactoryId ?? '—',
      taskCount,
      blockedTaskCount,
      qcPendingCount,
      dyeStatusZh,
      bottleneckLevelZh,
      bottleneckReasonZh,
    }
  })
}

function getBottleneckTaskRows() {
  const orderQcPending = new Map<string, boolean>()
  const orderDyePending = new Map<string, boolean>()

  for (const order of productionOrders) {
    orderQcPending.set(order.productionOrderId, getOrderQcPendingCount(order.productionOrderId) > 0)
    orderDyePending.set(order.productionOrderId, getOrderDyeStatus(order.productionOrderId) === '生产暂停')
  }

  return processTasks.map((task) => {
    const hasQcPending = orderQcPending.get(task.productionOrderId) ?? false
    const hasDyePending = orderDyePending.get(task.productionOrderId) ?? false

    const bottleneckLevelZh =
      task.status === 'BLOCKED' ? '高' : hasQcPending || hasDyePending ? '中' : '低'

    const bottleneckReasonZh =
      task.status === 'BLOCKED'
        ? '任务生产暂停'
        : hasQcPending
          ? '所属生产单待质检'
          : hasDyePending
            ? '所属生产单染印生产暂停'
            : task.status === 'IN_PROGRESS'
              ? '正常推进中'
              : '无明显瓶颈'

    return {
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      factorySummaryZh: task.assignedFactoryId ?? '未识别工厂',
      taskStatusZh: taskStatusText(task.status),
      bottleneckLevelZh,
      bottleneckReasonZh,
    }
  })
}

function renderBottleneckFactoryTable(keyword: string): string {
  const rows = getBottleneckFactoryRows().filter((row) => {
    if (!keyword) return true
    return includesKeyword(toLower(row.factorySummaryZh), keyword)
  })

  if (rows.length === 0) {
    return '<tr><td colspan="8" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无工厂瓶颈数据</td></tr>'
  }

  return rows
    .map((row) => {
      const levelTone: Tone = row.bottleneckLevelZh === '高' ? 'destructive' : row.bottleneckLevelZh === '中' ? 'default' : 'outline'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(row.factorySummaryZh)}</td>
          <td class="px-3 py-3 text-center text-sm">${row.taskCount}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.blockedTaskCount > 0
              ? renderBadge(String(row.blockedTaskCount), 'destructive')
              : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.qcPendingCount > 0
              ? renderBadge(String(row.qcPendingCount), 'default')
              : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.dyePendingCount > 0
              ? renderBadge(String(row.dyePendingCount), 'default')
              : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.bottleneckLevelZh, levelTone)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.bottleneckReasonZh)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/production/orders" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderBottleneckOrderTable(keyword: string): string {
  const rows = getBottleneckOrderRows().filter((row) => {
    if (!keyword) return true
    return (
      includesKeyword(toLower(row.productionOrderId), keyword) ||
      includesKeyword(toLower(row.factorySummaryZh), keyword)
    )
  })

  if (rows.length === 0) {
    return '<tr><td colspan="9" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无生产单瓶颈数据</td></tr>'
  }

  return rows
    .map((row) => {
      const levelTone: Tone = row.bottleneckLevelZh === '高' ? 'destructive' : row.bottleneckLevelZh === '中' ? 'default' : 'outline'
      const dyeTone: Tone = row.dyeStatusZh === '生产暂停' ? 'destructive' : row.dyeStatusZh === '可继续' ? 'secondary' : 'outline'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.productionOrderId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.factorySummaryZh)}</td>
          <td class="px-3 py-3 text-center text-sm">${row.taskCount}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.blockedTaskCount > 0
              ? renderBadge(String(row.blockedTaskCount), 'destructive')
              : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.qcPendingCount > 0
              ? renderBadge(String(row.qcPendingCount), 'default')
              : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.dyeStatusZh, dyeTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.bottleneckLevelZh, levelTone)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.bottleneckReasonZh)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/production/orders/${row.productionOrderId}" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/process/dye-orders" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看染印</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderBottleneckTaskTable(keyword: string): string {
  const rows = getBottleneckTaskRows().filter((row) => {
    if (!keyword) return true
    return (
      includesKeyword(toLower(row.taskId), keyword) ||
      includesKeyword(toLower(row.productionOrderId), keyword) ||
      includesKeyword(toLower(row.factorySummaryZh), keyword)
    )
  })

  if (rows.length === 0) {
    return '<tr><td colspan="7" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无任务瓶颈数据</td></tr>'
  }

  return rows
    .map((row) => {
      const statusTone: Tone =
        row.taskStatusZh === '生产暂停'
          ? 'destructive'
          : row.taskStatusZh === '进行中'
            ? 'default'
            : row.taskStatusZh === '已完成'
              ? 'secondary'
              : 'outline'

      const levelTone: Tone = row.bottleneckLevelZh === '高' ? 'destructive' : row.bottleneckLevelZh === '中' ? 'default' : 'outline'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.taskId)}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.productionOrderId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.factorySummaryZh)}</td>
          <td class="px-3 py-3">${renderBadge(row.taskStatusZh, statusTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.bottleneckLevelZh, levelTone)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.bottleneckReasonZh)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/production/orders/${row.productionOrderId}" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
              <button data-nav="/fcs/quality/qc-records" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看质检</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

export function renderCapacityBottleneckPage(): string {
  const factoryRows = getBottleneckFactoryRows()
  const orderRows = getBottleneckOrderRows()
  const taskRows = getBottleneckTaskRows()

  const stats = {
    factoryHigh: factoryRows.filter((row) => row.bottleneckLevelZh === '高').length,
    orderHigh: orderRows.filter((row) => row.bottleneckLevelZh === '高').length,
    taskHigh: taskRows.filter((row) => row.bottleneckLevelZh === '高').length,
    blocked: processTasks.filter((task) => task.status === 'BLOCKED').length,
    qcPending: new Set(
      legacyLikeQualityInspections
        .filter((item) => item.status !== 'CLOSED')
        .map((item) => item.productionOrderId),
    ).size,
    dyePending: orderRows.filter((row) => row.dyeStatusZh === '生产暂停').length,
  }

  const keyword = state.bottleneckKeyword.trim().toLowerCase()

  return `
    <div class="space-y-6">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">瓶颈预警</h1>
        <span class="text-sm text-muted-foreground">高瓶颈工厂 ${stats.factoryHigh} 个 / 高瓶颈生产单 ${stats.orderHigh} 张</span>
      </header>

      ${renderPageHint('瓶颈预警用于识别生产暂停、待质检、染印生产暂停等造成的当前生产瓶颈；原型阶段采用规则型识别，不做预测模型')}

      <section class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        ${renderStatCard('高瓶颈工厂数', stats.factoryHigh)}
        ${renderStatCard('高瓶颈生产单数', stats.orderHigh)}
        ${renderStatCard('高瓶颈任务数', stats.taskHigh)}
        ${renderStatCard('生产暂停任务总数', stats.blocked)}
        ${renderStatCard('待质检生产单数', stats.qcPending)}
        ${renderStatCard('染印生产暂停生产单数', stats.dyePending)}
      </section>

      <section class="flex items-center gap-3">
        <input
          data-capacity-filter="bottleneck-keyword"
          value="${escapeHtml(state.bottleneckKeyword)}"
          placeholder="关键词（工厂 / 生产单号 / 任务ID）"
          class="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
        />
      </section>

      <section class="space-y-4">
        <div class="inline-flex rounded-md bg-muted p-1">
          <button
            data-capacity-action="switch-tab"
            data-page="bottleneck"
            data-tab="factory"
            class="${
              state.bottleneckTab === 'factory'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
          >
            工厂瓶颈
          </button>
          <button
            data-capacity-action="switch-tab"
            data-page="bottleneck"
            data-tab="order"
            class="${
              state.bottleneckTab === 'order'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
          >
            生产单瓶颈
          </button>
          <button
            data-capacity-action="switch-tab"
            data-page="bottleneck"
            data-tab="task"
            class="${
              state.bottleneckTab === 'task'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
          >
            任务瓶颈
          </button>
        </div>

        ${
          state.bottleneckTab === 'factory'
            ? `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">工厂</th>
                      <th class="px-3 py-2 text-center font-medium">关联任务数</th>
                      <th class="px-3 py-2 text-center font-medium">生产暂停任务数</th>
                      <th class="px-3 py-2 text-center font-medium">待质检数</th>
                      <th class="px-3 py-2 text-center font-medium">染印生产暂停数</th>
                      <th class="px-3 py-2 text-left font-medium">瓶颈等级</th>
                      <th class="px-3 py-2 text-left font-medium">瓶颈原因</th>
                      <th class="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>${renderBottleneckFactoryTable(keyword)}</tbody>
                </table>
              </div>
            `
            : state.bottleneckTab === 'order'
              ? `
                <div class="overflow-x-auto rounded-md border">
                  <table class="w-full text-sm">
                    <thead class="border-b bg-muted/40 text-muted-foreground">
                      <tr>
                        <th class="px-3 py-2 text-left font-medium">生产单号</th>
                        <th class="px-3 py-2 text-left font-medium">主工厂</th>
                        <th class="px-3 py-2 text-center font-medium">关联任务数</th>
                        <th class="px-3 py-2 text-center font-medium">生产暂停任务数</th>
                        <th class="px-3 py-2 text-center font-medium">待质检数</th>
                        <th class="px-3 py-2 text-left font-medium">染印状态</th>
                        <th class="px-3 py-2 text-left font-medium">瓶颈等级</th>
                        <th class="px-3 py-2 text-left font-medium">瓶颈原因</th>
                        <th class="px-3 py-2 text-left font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>${renderBottleneckOrderTable(keyword)}</tbody>
                  </table>
                </div>
              `
              : `
                <div class="overflow-x-auto rounded-md border">
                  <table class="w-full text-sm">
                    <thead class="border-b bg-muted/40 text-muted-foreground">
                      <tr>
                        <th class="px-3 py-2 text-left font-medium">任务ID</th>
                        <th class="px-3 py-2 text-left font-medium">生产单号</th>
                        <th class="px-3 py-2 text-left font-medium">工厂</th>
                        <th class="px-3 py-2 text-left font-medium">任务状态</th>
                        <th class="px-3 py-2 text-left font-medium">瓶颈等级</th>
                        <th class="px-3 py-2 text-left font-medium">瓶颈原因</th>
                        <th class="px-3 py-2 text-left font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>${renderBottleneckTaskTable(keyword)}</tbody>
                  </table>
                </div>
              `
        }
      </section>
    </div>
  `
}

interface TaskConstraint {
  taskId: string
  productionOrderId: string
  factorySummaryZh: string
  taskStatusZh: string
  isBlocked: boolean
  dyeConstraintZh: string
  qcConstraintZh: string
  exceptionConstraintZh: string
  allocationConstraintZh: string
  dispatchConstraintLevelZh: string
  recommendedAssignModeZh: string
  constraintReasonZh: string
}

function getTaskConstraints(): TaskConstraint[] {
  return processTasks.map((task) => {
    const orderId = task.productionOrderId

    const factorySummaryZh =
      (task as { factoryName?: string }).factoryName ??
      (task as { processorFactoryName?: string }).processorFactoryName ??
      (task as { assigneeFactoryName?: string }).assigneeFactoryName ??
      task.assignedFactoryId ??
      '—'
    const taskStatusZh = taskStatusText(task.status)
    const isBlocked = task.status === 'BLOCKED'

    const dyeStatus = getOrderDyeStatus(orderId)
    const dyeConstraintZh =
      dyeStatus === '无染印' ? '无染印约束' : dyeStatus === '生产暂停' ? '染印生产暂停' : '染印可继续'

    const qcConstraintZh = getOrderQcPendingCount(orderId) > 0 ? '存在待质检' : '无质检约束'

    const taskException = legacyLikeExceptions.find(
      (item) => item.sourceType === 'TASK' && item.sourceId === task.taskId && item.caseStatus !== 'CLOSED',
    )
    const orderException = legacyLikeExceptions.find(
      (item) => item.relatedOrderIds.includes(orderId) && item.caseStatus !== 'CLOSED',
    )

    const exceptionConstraintZh = taskException
      ? '存在派单异常'
      : orderException
        ? '存在关联异常'
        : '无异常约束'

    const allocationConstraintZh = isBlocked ? '开始条件未满足' : '无可用量约束'

    const dispatchConstraintLevelZh =
      task.status === 'DONE' || task.status === 'CANCELLED'
        ? '不可分配'
        : isBlocked || exceptionConstraintZh !== '无异常约束'
          ? '强约束'
          : dyeConstraintZh === '染印生产暂停' || qcConstraintZh === '存在待质检'
            ? '中约束'
            : '低约束'

    const recommendedAssignModeZh =
      task.status === 'DONE' || task.status === 'CANCELLED'
        ? '暂不分配'
        : dispatchConstraintLevelZh === '强约束'
          ? '暂不分配'
          : dispatchConstraintLevelZh === '中约束'
            ? '竞价'
            : '直接派单'

    const constraintReasonZh =
      task.status === 'DONE' || task.status === 'CANCELLED'
        ? '任务已结束，不再参与分配'
        : isBlocked
          ? '任务生产暂停，当前不宜分配'
          : exceptionConstraintZh !== '无异常约束'
            ? '存在派单异常，需先处理'
            : dyeConstraintZh === '染印生产暂停'
              ? '染印生产暂停，建议先等待回货'
              : qcConstraintZh === '存在待质检'
                ? '存在待质检事项，建议谨慎分配'
                : '当前可进入分配'

    return {
      taskId: task.taskId,
      productionOrderId: orderId,
      factorySummaryZh,
      taskStatusZh,
      isBlocked,
      dyeConstraintZh,
      qcConstraintZh,
      exceptionConstraintZh,
      allocationConstraintZh,
      dispatchConstraintLevelZh,
      recommendedAssignModeZh,
      constraintReasonZh,
    }
  })
}

function getFactoryConstraints(taskConstraints: TaskConstraint[]) {
  const map = new Map<
    string,
    {
      factorySummaryZh: string
      taskCount: number
      strongConstraintCount: number
      mediumConstraintCount: number
      lowConstraintCount: number
      recommendedModeSummaryZh: string
    }
  >()

  for (const task of taskConstraints) {
    const key = task.factorySummaryZh
    if (!map.has(key)) {
      map.set(key, {
        factorySummaryZh: key,
        taskCount: 0,
        strongConstraintCount: 0,
        mediumConstraintCount: 0,
        lowConstraintCount: 0,
        recommendedModeSummaryZh: '',
      })
    }

    const row = map.get(key)
    if (!row) continue

    row.taskCount += 1
    if (task.dispatchConstraintLevelZh === '强约束') row.strongConstraintCount += 1
    if (task.dispatchConstraintLevelZh === '中约束') row.mediumConstraintCount += 1
    if (task.dispatchConstraintLevelZh === '低约束') row.lowConstraintCount += 1
  }

  for (const row of map.values()) {
    row.recommendedModeSummaryZh =
      row.strongConstraintCount > 0
        ? '优先清约束'
        : row.mediumConstraintCount > row.lowConstraintCount
          ? '以竞价为主'
          : '可直接派单为主'
  }

  return [...map.values()]
}

function renderConstraintsTaskTable(keyword: string): string {
  const rows = getTaskConstraints().filter((row) => {
    if (!keyword) return true
    return (
      includesKeyword(toLower(row.taskId), keyword) ||
      includesKeyword(toLower(row.productionOrderId), keyword) ||
      includesKeyword(toLower(row.factorySummaryZh), keyword)
    )
  })

  if (rows.length === 0) {
    return '<tr><td colspan="12" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无任务约束数据</td></tr>'
  }

  return rows
    .map((row) => {
      const levelTone: Tone =
        row.dispatchConstraintLevelZh === '强约束'
          ? 'destructive'
          : row.dispatchConstraintLevelZh === '中约束'
            ? 'default'
            : row.dispatchConstraintLevelZh === '低约束'
              ? 'secondary'
              : 'outline'

      const modeTone: Tone =
        row.recommendedAssignModeZh === '暂不分配'
          ? 'destructive'
          : row.recommendedAssignModeZh === '竞价'
            ? 'default'
            : 'secondary'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.taskId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.productionOrderId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.factorySummaryZh)}</td>
          <td class="px-3 py-3">${renderBadge(row.taskStatusZh, row.isBlocked ? 'destructive' : 'secondary')}</td>
          <td class="px-3 py-3">${renderBadge(row.dyeConstraintZh, row.dyeConstraintZh === '染印生产暂停' ? 'destructive' : 'secondary')}</td>
          <td class="px-3 py-3">${renderBadge(row.qcConstraintZh, row.qcConstraintZh === '存在待质检' ? 'default' : 'secondary')}</td>
          <td class="px-3 py-3">${renderBadge(row.exceptionConstraintZh, row.exceptionConstraintZh !== '无异常约束' ? 'destructive' : 'secondary')}</td>
          <td class="px-3 py-3">${renderBadge(row.allocationConstraintZh, row.allocationConstraintZh !== '无可用量约束' ? 'default' : 'secondary')}</td>
          <td class="px-3 py-3">${renderBadge(row.dispatchConstraintLevelZh, levelTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.recommendedAssignModeZh, modeTone)}</td>
          <td class="max-w-[200px] px-3 py-3 text-sm text-muted-foreground">${escapeHtml(row.constraintReasonZh)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/production/orders/${row.productionOrderId}" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
              <button data-nav="/fcs/dispatch/board" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看派单</button>
              <button data-nav="/fcs/progress/exceptions" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看异常</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderConstraintsFactoryTable(keyword: string): string {
  const rows = getFactoryConstraints(getTaskConstraints()).filter((row) => {
    if (!keyword) return true
    return includesKeyword(toLower(row.factorySummaryZh), keyword)
  })

  if (rows.length === 0) {
    return '<tr><td colspan="7" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无工厂约束概览数据</td></tr>'
  }

  return rows
    .map((row) => {
      const summaryTone: Tone =
        row.recommendedModeSummaryZh === '优先清约束'
          ? 'destructive'
          : row.recommendedModeSummaryZh === '以竞价为主'
            ? 'default'
            : 'secondary'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(row.factorySummaryZh)}</td>
          <td class="px-3 py-3 text-sm">${row.taskCount}</td>
          <td class="px-3 py-3">${
            row.strongConstraintCount > 0
              ? renderBadge(String(row.strongConstraintCount), 'destructive')
              : '<span class="text-sm text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${
            row.mediumConstraintCount > 0
              ? renderBadge(String(row.mediumConstraintCount), 'default')
              : '<span class="text-sm text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${
            row.lowConstraintCount > 0
              ? renderBadge(String(row.lowConstraintCount), 'secondary')
              : '<span class="text-sm text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.recommendedModeSummaryZh, summaryTone)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/dispatch/board" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看派单</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

export function renderCapacityConstraintsPage(): string {
  const taskConstraints = getTaskConstraints()
  const stats = {
    total: taskConstraints.length,
    strong: taskConstraints.filter((item) => item.dispatchConstraintLevelZh === '强约束').length,
    medium: taskConstraints.filter((item) => item.dispatchConstraintLevelZh === '中约束').length,
    low: taskConstraints.filter((item) => item.dispatchConstraintLevelZh === '低约束').length,
    direct: taskConstraints.filter((item) => item.recommendedAssignModeZh === '直接派单').length,
    bid: taskConstraints.filter((item) => item.recommendedAssignModeZh === '竞价').length,
    noAssign: taskConstraints.filter((item) => item.recommendedAssignModeZh === '暂不分配').length,
  }

  const keyword = state.constraintsKeyword.trim().toLowerCase()

  return `
    <div class="space-y-6">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-2xl font-bold tracking-tight">派单/竞价约束</h1>
        <div class="flex items-center gap-3 text-sm text-muted-foreground">
          <span>强约束任务 <strong class="text-destructive">${stats.strong}</strong> 条</span>
          <span>暂不分配 <strong class="text-destructive">${stats.noAssign}</strong> 条</span>
        </div>
      </header>

      ${renderPageHint('派单/竞价约束用于识别任务当前是否适合分配；原型阶段采用规则型判断，不做智能派单与复杂评分')}

      <section class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        ${renderStatCard('任务总数', stats.total)}
        ${renderStatCard('强约束任务数', stats.strong, 'text-destructive')}
        ${renderStatCard('中约束任务数', stats.medium, 'text-orange-500')}
        ${renderStatCard('低约束任务数', stats.low, 'text-green-600')}
        ${renderStatCard('建议直接派单数', stats.direct)}
        ${renderStatCard('建议竞价数', stats.bid)}
      </section>

      <section class="flex flex-wrap items-center gap-3">
        <input
          data-capacity-filter="constraints-keyword"
          value="${escapeHtml(state.constraintsKeyword)}"
          placeholder="关键词（任务ID / 生产单号 / 工厂）"
          class="h-9 w-72 rounded-md border bg-background px-3 text-sm"
        />
      </section>

      <section class="space-y-4">
        <div class="inline-flex rounded-md bg-muted p-1">
          <button
            data-capacity-action="switch-tab"
            data-page="constraints"
            data-tab="task"
            class="${
              state.constraintsTab === 'task'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
          >
            任务约束明细
          </button>
          <button
            data-capacity-action="switch-tab"
            data-page="constraints"
            data-tab="factory"
            class="${
              state.constraintsTab === 'factory'
                ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }"
          >
            工厂约束概览
          </button>
        </div>

        ${
          state.constraintsTab === 'task'
            ? `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">任务ID</th>
                      <th class="px-3 py-2 text-left font-medium">生产单号</th>
                      <th class="px-3 py-2 text-left font-medium">工厂</th>
                      <th class="px-3 py-2 text-left font-medium">任务状态</th>
                      <th class="px-3 py-2 text-left font-medium">染印约束</th>
                      <th class="px-3 py-2 text-left font-medium">质检约束</th>
                      <th class="px-3 py-2 text-left font-medium">异常约束</th>
                      <th class="px-3 py-2 text-left font-medium">可用量约束</th>
                      <th class="px-3 py-2 text-left font-medium">约束等级</th>
                      <th class="px-3 py-2 text-left font-medium">建议分配方式</th>
                      <th class="px-3 py-2 text-left font-medium">主原因</th>
                      <th class="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>${renderConstraintsTaskTable(keyword)}</tbody>
                </table>
              </div>
            `
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">工厂</th>
                      <th class="px-3 py-2 text-left font-medium">任务总数</th>
                      <th class="px-3 py-2 text-left font-medium">强约束任务数</th>
                      <th class="px-3 py-2 text-left font-medium">中约束任务数</th>
                      <th class="px-3 py-2 text-left font-medium">低约束任务数</th>
                      <th class="px-3 py-2 text-left font-medium">分配建议摘要</th>
                      <th class="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>${renderConstraintsFactoryTable(keyword)}</tbody>
                </table>
              </div>
            `
        }
      </section>
    </div>
  `
}

function getOrderPolicies() {
  return productionOrders.map((order) => {
    const orderId = order.productionOrderId
    const tasks = processTasks.filter((task) => task.productionOrderId === orderId)
    const blockedTaskCount = tasks.filter((task) => task.status === 'BLOCKED').length
    const qcPendingCount = getOrderQcPendingCount(orderId)
    const dyeStatusZh = getOrderDyeStatus(orderId)
    const exceptionCount = getOrderOpenExceptionCount(orderId)

    const policyLevelZh =
      blockedTaskCount > 0 || exceptionCount > 0
        ? '优先处理'
        : qcPendingCount > 0
          ? '尽快处理'
          : dyeStatusZh === '生产暂停'
            ? '等待进入下一步'
            : tasks.length > 0
              ? '可推进'
              : '待启动'

    const recommendedPolicyZh =
      blockedTaskCount > 0
        ? '优先处理生产暂停'
        : exceptionCount > 0
          ? '优先处理异常'
          : qcPendingCount > 0
            ? '优先待质检'
            : dyeStatusZh === '生产暂停'
              ? '优先等待染印完成'
              : tasks.length > 0
                ? '可直接推进'
                : '等待任务启动'

    const policyReasonZh =
      blockedTaskCount > 0
        ? '当前存在生产暂停任务，先完成开始条件或处理异常'
        : exceptionCount > 0
          ? '当前存在派单/竞价异常，需先处理'
          : qcPendingCount > 0
            ? '当前存在未结案质检事项'
            : dyeStatusZh === '生产暂停'
              ? '当前染印尚生产暂停，建议等待回货'
              : tasks.length > 0
                ? '当前链路具备继续推进条件'
                : '当前生产单尚未形成有效任务链'

    return {
      productionOrderId: orderId,
      factorySummaryZh: order.mainFactorySnapshot?.name ?? order.mainFactoryId ?? '—',
      taskCount: tasks.length,
      blockedTaskCount,
      qcPendingCount,
      dyeStatusZh,
      exceptionCount,
      policyLevelZh,
      recommendedPolicyZh,
      policyReasonZh,
    }
  })
}

function getTaskPolicies() {
  const orderDyeMap = new Map<string, string>()
  const orderQcMap = new Map<string, boolean>()
  const orderExceptionMap = new Map<string, boolean>()

  for (const order of productionOrders) {
    orderDyeMap.set(order.productionOrderId, getOrderDyeStatus(order.productionOrderId))
    orderQcMap.set(order.productionOrderId, getOrderQcPendingCount(order.productionOrderId) > 0)
    orderExceptionMap.set(order.productionOrderId, getOrderOpenExceptionCount(order.productionOrderId) > 0)
  }

  return processTasks.map((task) => {
    const orderId = task.productionOrderId
    const order = productionOrders.find((item) => item.productionOrderId === orderId)

    const factorySummaryZh =
      task.assignedFactoryId ??
      order?.mainFactorySnapshot?.name ??
      order?.mainFactoryId ??
      '—'

    const taskStatusZh = taskStatusText(task.status)
    const blockedFlagZh = task.status === 'BLOCKED' ? '是' : '否'

    const dyeStatus = orderDyeMap.get(orderId) ?? '无染印'
    const dyeConstraintZh =
      dyeStatus === '无染印' ? '无染印约束' : dyeStatus === '生产暂停' ? '染印生产暂停' : '染印可继续'

    const qcConstraintZh = orderQcMap.get(orderId) ? '存在待质检' : '无质检约束'

    const taskHasException = legacyLikeExceptions.some(
      (item) => item.sourceType === 'TASK' && item.sourceId === task.taskId && item.caseStatus !== 'CLOSED',
    )
    const orderHasException = orderExceptionMap.get(orderId)

    const exceptionConstraintZh = taskHasException
      ? '存在派单异常'
      : orderHasException
        ? '存在关联异常'
        : '无异常约束'

    const recommendedAssignModeZh =
      task.status === 'DONE' || task.status === 'CANCELLED'
        ? '暂不分配'
        : task.status === 'BLOCKED' || exceptionConstraintZh !== '无异常约束'
          ? '暂不分配'
          : dyeConstraintZh === '染印生产暂停' || qcConstraintZh === '存在待质检'
            ? '竞价'
            : '直接派单'

    const recommendedPolicyZh =
      task.status === 'DONE' || task.status === 'CANCELLED'
        ? '结束归档'
        : task.status === 'BLOCKED'
          ? '优先处理生产暂停'
          : exceptionConstraintZh !== '无异常约束'
            ? '优先处理异常'
            : dyeConstraintZh === '染印生产暂停'
              ? '等待进入下一步'
              : qcConstraintZh === '存在待质检'
                ? '关注质检'
                : task.status === 'IN_PROGRESS'
                  ? '持续推进'
                  : '进入分配'

    const policyReasonZh =
      task.status === 'DONE' || task.status === 'CANCELLED'
        ? '任务已结束，无需继续调度'
        : task.status === 'BLOCKED'
          ? '任务生产暂停，当前不宜推进'
          : exceptionConstraintZh !== '无异常约束'
            ? '存在派单/竞价异常，建议先处理'
            : dyeConstraintZh === '染印生产暂停'
              ? '染印生产暂停，建议等待后再分配'
              : qcConstraintZh === '存在待质检'
                ? '存在待质检事项，建议谨慎推进'
                : task.status === 'IN_PROGRESS'
                  ? '任务已进入执行，可持续跟进'
                  : '当前任务可进入分配或启动'

    return {
      taskId: task.taskId,
      productionOrderId: orderId,
      factorySummaryZh,
      taskStatusZh,
      blockedFlagZh,
      dyeConstraintZh,
      qcConstraintZh,
      exceptionConstraintZh,
      recommendedAssignModeZh,
      recommendedPolicyZh,
      policyReasonZh,
    }
  })
}

function renderPoliciesOrderTable(keyword: string): string {
  const rows = getOrderPolicies().filter((row) => {
    if (!keyword) return true
    return (
      includesKeyword(toLower(row.productionOrderId), keyword) ||
      includesKeyword(toLower(row.factorySummaryZh), keyword)
    )
  })

  if (rows.length === 0) {
    return '<tr><td colspan="11" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无生产单策略数据</td></tr>'
  }

  return rows
    .map((row) => {
      const levelTone: Tone =
        row.policyLevelZh === '优先处理'
          ? 'destructive'
          : row.policyLevelZh === '尽快处理'
            ? 'default'
            : row.policyLevelZh === '等待进入下一步'
              ? 'secondary'
              : 'outline'

      const policyTone: Tone =
        row.recommendedPolicyZh === '优先处理生产暂停' || row.recommendedPolicyZh === '优先处理异常'
          ? 'destructive'
          : row.recommendedPolicyZh === '优先待质检' ||
              row.recommendedPolicyZh === '等待进入下一步' ||
              row.recommendedPolicyZh === '关注质检'
            ? 'default'
            : row.recommendedPolicyZh === '可直接推进' ||
                row.recommendedPolicyZh === '持续推进' ||
                row.recommendedPolicyZh === '进入分配'
              ? 'secondary'
              : row.recommendedPolicyZh === '结束归档'
                ? 'outline'
                : 'secondary'

      const dyeTone: Tone = row.dyeStatusZh === '生产暂停' ? 'destructive' : row.dyeStatusZh === '可继续' ? 'secondary' : 'outline'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.productionOrderId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.factorySummaryZh)}</td>
          <td class="px-3 py-3 text-sm">${row.taskCount}</td>
          <td class="px-3 py-3">${
            row.blockedTaskCount > 0
              ? renderBadge(String(row.blockedTaskCount), 'destructive')
              : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${
            row.qcPendingCount > 0
              ? renderBadge(String(row.qcPendingCount), 'default')
              : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.dyeStatusZh, dyeTone)}</td>
          <td class="px-3 py-3">${
            row.exceptionCount > 0
              ? renderBadge(String(row.exceptionCount), 'destructive')
              : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.policyLevelZh, levelTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.recommendedPolicyZh, policyTone)}</td>
          <td class="max-w-[200px] px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.policyReasonZh)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/production/orders/${row.productionOrderId}" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/process/dye-orders" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看染印</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderPoliciesTaskTable(keyword: string): string {
  const rows = getTaskPolicies().filter((row) => {
    if (!keyword) return true
    return (
      includesKeyword(toLower(row.taskId), keyword) ||
      includesKeyword(toLower(row.productionOrderId), keyword) ||
      includesKeyword(toLower(row.factorySummaryZh), keyword)
    )
  })

  if (rows.length === 0) {
    return '<tr><td colspan="12" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无任务策略数据</td></tr>'
  }

  return rows
    .map((row) => {
      const statusTone: Tone =
        row.taskStatusZh === '生产暂停'
          ? 'destructive'
          : row.taskStatusZh === '进行中'
            ? 'default'
            : row.taskStatusZh === '已完成'
              ? 'secondary'
              : 'outline'

      const blockedTone: Tone = row.blockedFlagZh === '是' ? 'destructive' : 'outline'
      const dyeTone: Tone = row.dyeConstraintZh === '染印生产暂停' ? 'destructive' : row.dyeConstraintZh === '染印可继续' ? 'secondary' : 'outline'
      const qcTone: Tone = row.qcConstraintZh === '存在待质检' ? 'default' : 'outline'
      const exTone: Tone =
        row.exceptionConstraintZh === '存在派单异常'
          ? 'destructive'
          : row.exceptionConstraintZh === '存在关联异常'
            ? 'default'
            : 'outline'

      const modeTone: Tone =
        row.recommendedAssignModeZh === '暂不分配'
          ? 'destructive'
          : row.recommendedAssignModeZh === '竞价'
            ? 'default'
            : 'secondary'

      const policyTone: Tone =
        row.recommendedPolicyZh === '优先处理生产暂停' || row.recommendedPolicyZh === '优先处理异常'
          ? 'destructive'
          : row.recommendedPolicyZh === '等待进入下一步' || row.recommendedPolicyZh === '关注质检'
            ? 'default'
            : row.recommendedPolicyZh === '持续推进' || row.recommendedPolicyZh === '进入分配'
              ? 'secondary'
              : row.recommendedPolicyZh === '结束归档'
                ? 'outline'
                : 'secondary'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.taskId)}</td>
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.productionOrderId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.factorySummaryZh)}</td>
          <td class="px-3 py-3">${renderBadge(row.taskStatusZh, statusTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.blockedFlagZh, blockedTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.dyeConstraintZh, dyeTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.qcConstraintZh, qcTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.exceptionConstraintZh, exTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.recommendedAssignModeZh, modeTone)}</td>
          <td class="px-3 py-3">${renderBadge(row.recommendedPolicyZh, policyTone)}</td>
          <td class="max-w-[200px] px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.policyReasonZh)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/production/orders/${row.productionOrderId}" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
              <button data-nav="/fcs/dispatch/board" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看派单</button>
              <button data-nav="/fcs/progress/exceptions" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看异常</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

export function renderCapacityPoliciesPage(): string {
  const orderPolicies = getOrderPolicies()
  const taskPolicies = getTaskPolicies()

  const stats = {
    orderPriority: orderPolicies.filter((item) => item.policyLevelZh === '优先处理').length,
    orderSoon: orderPolicies.filter((item) => item.policyLevelZh === '尽快处理').length,
    orderWait: orderPolicies.filter((item) => item.policyLevelZh === '等待进入下一步').length,
    taskBlocked: taskPolicies.filter((item) => item.recommendedPolicyZh === '优先处理生产暂停').length,
    taskException: taskPolicies.filter((item) => item.recommendedPolicyZh === '优先处理异常').length,
    taskDirect: taskPolicies.filter(
      (item) => item.recommendedPolicyZh === '持续推进' || item.recommendedPolicyZh === '进入分配',
    ).length,
  }

  const keyword = state.policiesKeyword.trim().toLowerCase()

  return `
    <div class="space-y-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">调度策略</h1>
          <p class="mt-1 text-sm text-muted-foreground">调度策略用于基于当前生产暂停、质检、染印、异常等状态给出轻量处理建议；原型阶段采用规则型建议，不自动执行调度</p>
        </div>
        <div class="flex gap-3 text-sm text-muted-foreground">
          <span>优先处理生产单 <strong class="text-foreground">${stats.orderPriority}</strong> 张</span>
          <span>/</span>
          <span>优先处理生产暂停任务 <strong class="text-foreground">${stats.taskBlocked}</strong> 条</span>
        </div>
      </header>

      <section class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        ${renderStatCard('优先处理生产单数', stats.orderPriority)}
        ${renderStatCard('尽快处理生产单数', stats.orderSoon)}
        ${renderStatCard('等待进入下一步生产单数', stats.orderWait)}
        ${renderStatCard('优先处理生产暂停任务数', stats.taskBlocked)}
        ${renderStatCard('优先处理异常任务数', stats.taskException)}
        ${renderStatCard('可直接推进任务数', stats.taskDirect)}
      </section>

      <section class="space-y-4">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div class="inline-flex rounded-md bg-muted p-1">
            <button
              data-capacity-action="switch-tab"
              data-page="policies"
              data-tab="order"
              class="${
                state.policiesTab === 'order'
                  ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
              }"
            >
              生产单策略
            </button>
            <button
              data-capacity-action="switch-tab"
              data-page="policies"
              data-tab="task"
              class="${
                state.policiesTab === 'task'
                  ? 'rounded-md bg-background px-3 py-1.5 text-sm shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
              }"
            >
              任务策略
            </button>
          </div>
          <input
            data-capacity-filter="policies-keyword"
            value="${escapeHtml(state.policiesKeyword)}"
            placeholder="关键词（生产单号 / 任务ID / 工厂）"
            class="h-9 w-72 rounded-md border bg-background px-3 text-sm"
          />
        </div>

        ${
          state.policiesTab === 'order'
            ? `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">生产单号</th>
                      <th class="px-3 py-2 text-left font-medium">主工厂</th>
                      <th class="px-3 py-2 text-left font-medium">关联任务数</th>
                      <th class="px-3 py-2 text-left font-medium">生产暂停任务数</th>
                      <th class="px-3 py-2 text-left font-medium">待质检数</th>
                      <th class="px-3 py-2 text-left font-medium">染印状态</th>
                      <th class="px-3 py-2 text-left font-medium">异常数</th>
                      <th class="px-3 py-2 text-left font-medium">策略等级</th>
                      <th class="px-3 py-2 text-left font-medium">建议策略</th>
                      <th class="min-w-[180px] px-3 py-2 text-left font-medium">原因说明</th>
                      <th class="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>${renderPoliciesOrderTable(keyword)}</tbody>
                </table>
              </div>
            `
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">任务ID</th>
                      <th class="px-3 py-2 text-left font-medium">生产单号</th>
                      <th class="px-3 py-2 text-left font-medium">工厂</th>
                      <th class="px-3 py-2 text-left font-medium">任务状态</th>
                      <th class="px-3 py-2 text-left font-medium">是否生产暂停</th>
                      <th class="px-3 py-2 text-left font-medium">染印约束</th>
                      <th class="px-3 py-2 text-left font-medium">质检约束</th>
                      <th class="px-3 py-2 text-left font-medium">异常约束</th>
                      <th class="px-3 py-2 text-left font-medium">建议分配方式</th>
                      <th class="px-3 py-2 text-left font-medium">建议策略</th>
                      <th class="min-w-[180px] px-3 py-2 text-left font-medium">原因说明</th>
                      <th class="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>${renderPoliciesTaskTable(keyword)}</tbody>
                </table>
              </div>
            `
        }
      </section>
    </div>
  `
}

export function handleCapacityEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-capacity-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const filter = filterNode.dataset.capacityFilter
    const value = filterNode.value

    if (filter === 'overview-keyword') state.overviewKeyword = value
    if (filter === 'risk-keyword') state.riskKeyword = value
    if (filter === 'bottleneck-keyword') state.bottleneckKeyword = value
    if (filter === 'constraints-keyword') state.constraintsKeyword = value
    if (filter === 'policies-keyword') state.policiesKeyword = value

    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-capacity-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.capacityAction
  if (!action) return false

  if (action === 'switch-tab') {
    const page = actionNode.dataset.page
    const tab = actionNode.dataset.tab

    if (page === 'overview' && (tab === 'factory' || tab === 'order')) {
      state.overviewTab = tab
      return true
    }

    if (page === 'risk' && (tab === 'task' || tab === 'order')) {
      state.riskTab = tab
      return true
    }

    if (page === 'bottleneck' && (tab === 'factory' || tab === 'order' || tab === 'task')) {
      state.bottleneckTab = tab
      return true
    }

    if (page === 'constraints' && (tab === 'task' || tab === 'factory')) {
      state.constraintsTab = tab
      return true
    }

    if (page === 'policies' && (tab === 'order' || tab === 'task')) {
      state.policiesTab = tab
      return true
    }

    return true
  }

  return false
}
