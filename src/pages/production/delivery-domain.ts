import {
  escapeHtml,
  state,
  renderBadge,
  renderStatCard,
  renderEmptyRow,
  safeText,
  includesKeyword,
  type ProductionOrder,
  type FactoryTier,
  type FactoryType,
  tierLabels,
  typeLabels,
  lifecycleStatusLabel,
  getOrderById,
  listRuntimeTasksByOrder,
  getOrderRuntimeAssignmentSnapshot,
  getOrderTaskBreakdownSnapshot,
  getLegacyLikeQualityInspections,
  initialAllocationByTaskId,
} from './context'

function getDeliverySummaryMap(): Map<
  string,
  {
    planStatus: string
    lifecycleStatus: string
    taskSummary: string
    deliverableStatus: '未配置交付仓' | '未准备' | '待质检' | '部分可交付' | '可交付'
    deliverableQty: number
  }
> {
  const legacyLikeQualityInspections = getLegacyLikeQualityInspections()
  const map = new Map<
    string,
    {
      planStatus: string
      lifecycleStatus: string
      taskSummary: string
      deliverableStatus: '未配置交付仓' | '未准备' | '待质检' | '部分可交付' | '可交付'
      deliverableQty: number
    }
  >()

  for (const order of state.orders) {
    const orderId = order.productionOrderId
    const tasks = listRuntimeTasksByOrder(order.productionOrderId)

    const doneCount = tasks.filter((task) => task.status === 'DONE').length
    const taskSummary = tasks.length === 0 ? '未拆解' : `已完成 ${doneCount}/${tasks.length}`

    let deliverableStatus: '未配置交付仓' | '未准备' | '待质检' | '部分可交付' | '可交付' =
      '未配置交付仓'

    if (order.deliveryWarehouseStatus === 'SET') {
      if (tasks.length === 0) {
        deliverableStatus = '未准备'
      } else {
        const openQcCount = legacyLikeQualityInspections.filter(
          (inspection) =>
            inspection.productionOrderId === orderId && inspection.status !== 'CLOSED',
        ).length

        if (openQcCount > 0) {
          deliverableStatus = '待质检'
        } else if (tasks.every((task) => task.status === 'DONE')) {
          deliverableStatus = '可交付'
        } else {
          deliverableStatus = '部分可交付'
        }
      }
    }

    const deliverableQty = tasks.reduce((sum, task) => {
      return sum + (initialAllocationByTaskId[task.taskId]?.availableQty ?? 0)
    }, 0)

    const lifecycle = order.lifecycleStatus ?? 'DRAFT'

    map.set(order.productionOrderId, {
      planStatus:
        order.planStatus === 'RELEASED'
          ? '计划已下发'
          : order.planStatus === 'PLANNED'
            ? '已计划'
            : '未计划',
      lifecycleStatus: lifecycleStatusLabel[lifecycle],
      taskSummary,
      deliverableStatus,
      deliverableQty,
    })
  }

  return map
}

function renderDeliveryEditDialog(): string {
  if (!getOrderById(state.deliveryEditOrderId)) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-delivery-edit" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">配置交付仓</h3>
        </header>

        <div class="space-y-4 px-6 py-5">
          <label class="space-y-1">
            <span class="text-sm">生产单号</span>
            <input value="${escapeHtml(
              state.deliveryForm.productionOrderId,
            )}" disabled class="w-full rounded-md border px-3 py-2 font-mono text-sm" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">交付仓ID <span class="text-destructive">*</span></span>
            <input data-prod-field="deliveryFormWarehouseId" value="${escapeHtml(
              state.deliveryForm.deliveryWarehouseId,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入交付仓ID" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">交付仓名称</span>
            <input data-prod-field="deliveryFormWarehouseName" value="${escapeHtml(
              state.deliveryForm.deliveryWarehouseName,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选，留空则以仓库ID显示" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">配置说明</span>
            <textarea data-prod-field="deliveryFormWarehouseRemark" rows="3" class="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm" placeholder="可选备注">${escapeHtml(
              state.deliveryForm.deliveryWarehouseRemark,
            )}</textarea>
          </label>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-delivery-edit">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="save-delivery-edit">保存</button>
        </footer>
      </div>
    </div>
  `
}

export function renderProductionDeliveryWarehousePage(): string {
  const summaryMap = getDeliverySummaryMap()

  const rows = state.orders.filter((order) => {
    if (state.deliveryStatusFilter !== 'ALL') {
      const status = order.deliveryWarehouseStatus ?? 'UNSET'
      if (status !== state.deliveryStatusFilter) return false
    }

    const keyword = state.deliveryKeyword.trim().toLowerCase()
    if (!keyword) return true

    const styleCode =
      (order as unknown as { styleCode?: string }).styleCode ?? order.demandSnapshot.spuCode

    return (
      order.productionOrderId.toLowerCase().includes(keyword) ||
      styleCode.toLowerCase().includes(keyword) ||
      (order.deliveryWarehouseName ?? '').toLowerCase().includes(keyword) ||
      (order.deliveryWarehouseId ?? '').toLowerCase().includes(keyword)
    )
  })

  const today = new Date().toISOString().slice(0, 10)
  const stats = {
    unset: state.orders.filter(
      (order) => !order.deliveryWarehouseStatus || order.deliveryWarehouseStatus === 'UNSET',
    ).length,
    set: state.orders.filter((order) => order.deliveryWarehouseStatus === 'SET').length,
    updatedToday: state.orders.filter((order) => order.deliveryWarehouseUpdatedAt?.slice(0, 10) === today)
      .length,
    planned: state.orders.filter((order) => (order.planStatus ?? 'UNPLANNED') !== 'UNPLANNED').length,
    deliverable: state.orders.filter(
      (order) => summaryMap.get(order.productionOrderId)?.deliverableStatus === '可交付',
    ).length,
    deliverableQtyTotal: state.orders.reduce(
      (sum, order) => sum + (summaryMap.get(order.productionOrderId)?.deliverableQty ?? 0),
      0,
    ),
  }

  const statusClass: Record<'UNSET' | 'SET', string> = {
    UNSET: 'bg-slate-100 text-slate-700',
    SET: 'bg-blue-100 text-blue-700',
  }

  const deliverableClass: Record<'未配置交付仓' | '未准备' | '待质检' | '部分可交付' | '可交付', string> = {
    未配置交付仓: 'bg-slate-100 text-slate-700',
    未准备: 'bg-slate-100 text-slate-700',
    待质检: 'bg-white text-slate-700',
    部分可交付: 'bg-white text-slate-700',
    可交付: 'bg-blue-100 text-blue-700',
  }

  const planClass: Record<'未计划' | '已计划' | '计划已下发', string> = {
    未计划: 'bg-slate-100 text-slate-700',
    已计划: 'bg-white text-slate-700',
    计划已下发: 'bg-blue-100 text-blue-700',
  }

  const lifecycleClass: Record<string, string> = {
    草稿: 'bg-slate-100 text-slate-700',
    已计划: 'bg-slate-100 text-slate-700',
    已下发: 'bg-white text-slate-700',
    生产中: 'bg-blue-100 text-blue-700',
    待质检: 'bg-white text-slate-700',
    已完成: 'bg-blue-100 text-blue-700',
    已关闭: 'bg-slate-100 text-slate-700',
  }

  return `
    <div class="flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">交付仓配置</h1>
          <p class="mt-1 text-sm text-muted-foreground">共 ${state.orders.length} 条</p>
        </div>
      </header>

      <div class="rounded-md border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">交付仓配置用于明确生产单成品交付去向；本页同步展示计划状态、任务完成度与交付承接情况</div>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">未配置数</p>
            <p class="text-3xl font-bold">${stats.unset}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已配置数</p>
            <p class="text-3xl font-bold">${stats.set}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">今日更新数</p>
            <p class="text-3xl font-bold">${stats.updatedToday}</p>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已计划数</p>
            <p class="text-3xl font-bold">${stats.planned}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已配置交付仓数</p>
            <p class="text-3xl font-bold">${stats.set}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">可交付生产单数</p>
            <p class="text-3xl font-bold">${stats.deliverable}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">可交付数量合计</p>
            <p class="text-3xl font-bold">${stats.deliverableQtyTotal.toLocaleString()}</p>
          </div>
        </article>
      </section>

      <section class="flex flex-wrap items-center gap-3">
        <input data-prod-field="deliveryKeyword" value="${escapeHtml(
          state.deliveryKeyword,
        )}" class="w-72 rounded-md border px-3 py-2 text-sm" placeholder="关键词（生产单号 / 款号 / 仓库名称）" />

        <select data-prod-field="deliveryStatusFilter" class="w-36 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.deliveryStatusFilter === 'ALL' ? 'selected' : ''}>全部</option>
          <option value="UNSET" ${state.deliveryStatusFilter === 'UNSET' ? 'selected' : ''}>未配置</option>
          <option value="SET" ${state.deliveryStatusFilter === 'SET' ? 'selected' : ''}>已配置</option>
        </select>
      </section>

      <section class="rounded-lg border bg-card">
        ${
          rows.length === 0
            ? `<div class="flex h-40 items-center justify-center text-sm text-muted-foreground">暂无交付仓配置数据</div>`
            : `
              <div class="overflow-x-auto">
                <table class="w-full min-w-[1450px] text-sm">
                  <thead>
                    <tr class="border-b">
                      <th class="px-3 py-3 text-left font-medium">生产单号</th>
                      <th class="px-3 py-3 text-left font-medium">商品/款号</th>
                      <th class="px-3 py-3 text-left font-medium">主工厂</th>
                      <th class="px-3 py-3 text-left font-medium">交付仓</th>
                      <th class="px-3 py-3 text-left font-medium">配置状态</th>
                      <th class="px-3 py-3 text-left font-medium">计划状态</th>
                      <th class="px-3 py-3 text-left font-medium">生产单状态</th>
                      <th class="px-3 py-3 text-left font-medium">任务完成度</th>
                      <th class="px-3 py-3 text-left font-medium">可交付状态</th>
                      <th class="px-3 py-3 text-right font-medium">可交付数量</th>
                      <th class="px-3 py-3 text-left font-medium">配置说明</th>
                      <th class="px-3 py-3 text-left font-medium">更新时间</th>
                      <th class="px-3 py-3 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map((order) => {
                        const styleCode =
                          (order as unknown as { styleCode?: string }).styleCode ?? order.demandSnapshot.spuCode
                        const factoryName =
                          (order as unknown as { factoryName?: string }).factoryName ??
                          (order as unknown as { factoryId?: string }).factoryId ??
                          order.mainFactorySnapshot.name

                        const status = order.deliveryWarehouseStatus ?? 'UNSET'
                        const summary = summaryMap.get(order.productionOrderId)
                        const planStatus = (summary?.planStatus ?? '未计划') as '未计划' | '已计划' | '计划已下发'
                        const lifecycleStatus = summary?.lifecycleStatus ?? '草稿'

                        return `
                          <tr class="border-b last:border-0">
                            <td class="whitespace-nowrap px-3 py-3 font-mono text-sm">${escapeHtml(order.productionOrderId)}</td>
                            <td class="px-3 py-3 text-sm">${escapeHtml(styleCode ?? '—')}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-sm">${escapeHtml(factoryName ?? '—')}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-sm">
                              ${
                                order.deliveryWarehouseName
                                  ? `${escapeHtml(order.deliveryWarehouseName)}${
                                      order.deliveryWarehouseId ? ` (${escapeHtml(order.deliveryWarehouseId)})` : ''
                                    }`
                                  : order.deliveryWarehouseId
                                    ? escapeHtml(order.deliveryWarehouseId)
                                    : '—'
                              }
                            </td>
                            <td class="px-3 py-3">${renderBadge(status === 'SET' ? '已配置' : '未配置', statusClass[status])}</td>
                            <td class="px-3 py-3">${renderBadge(planStatus, planClass[planStatus])}</td>
                            <td class="px-3 py-3">${renderBadge(
                              lifecycleStatus,
                              lifecycleClass[lifecycleStatus] ?? 'bg-slate-100 text-slate-700',
                            )}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-sm">${escapeHtml(summary?.taskSummary ?? '未拆解')}</td>
                            <td class="px-3 py-3">${renderBadge(
                              summary?.deliverableStatus ?? '未配置交付仓',
                              deliverableClass[summary?.deliverableStatus ?? '未配置交付仓'],
                            )}</td>
                            <td class="px-3 py-3 text-right text-sm">${(summary?.deliverableQty ?? 0).toLocaleString()}</td>
                            <td class="max-w-40 truncate px-3 py-3 text-sm text-muted-foreground" title="${escapeHtml(
                              safeText(order.deliveryWarehouseRemark),
                            )}">${escapeHtml(safeText(order.deliveryWarehouseRemark))}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground">${escapeHtml(
                              safeText(order.deliveryWarehouseUpdatedAt),
                            )}</td>
                            <td class="px-3 py-3">
                              <div class="flex gap-2 whitespace-nowrap">
                                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-prod-action="open-delivery-edit" data-order-id="${
                                  order.productionOrderId
                                }">配置交付仓</button>
                                <button class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted" data-prod-action="open-order-detail" data-order-id="${
                                  order.productionOrderId
                                }">查看生产单</button>
                                <button class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted" data-nav="/fcs/production/plan">查看计划</button>
                              </div>
                            </td>
                          </tr>
                        `
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
        }
      </section>

      ${renderDeliveryEditDialog()}
    </div>
  `
}

export {
  getDeliverySummaryMap,
  renderDeliveryEditDialog,
}
