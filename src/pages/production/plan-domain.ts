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
  tierLabels,
  getLegacyLikeDyePrintOrders,
  listRuntimeTasksByOrder,
  keyProcessKeywords,
  getPlanFactoryOptions,
  getPlanWeekRange,
  getOrderById,
} from './context'

function getPlanDownstreamMap(): Map<
  string,
  {
    taskCount: number
    keyProcessCount: number
    hasDyePrint: boolean
    readyStatus: '未准备' | '部分准备' | '已准备'
  }
> {
  const legacyLikeDyePrintOrders = getLegacyLikeDyePrintOrders()
  const map = new Map<
    string,
    {
      taskCount: number
      keyProcessCount: number
      hasDyePrint: boolean
      readyStatus: '未准备' | '部分准备' | '已准备'
    }
  >()

  for (const order of state.orders) {
    const tasks = listRuntimeTasksByOrder(order.productionOrderId)
    const dyes = legacyLikeDyePrintOrders.filter((dye) => dye.productionOrderId === order.productionOrderId)

    const taskCount = tasks.length
    const keyProcessCount = tasks.filter((task) =>
      keyProcessKeywords.some((keyword) => task.processNameZh.includes(keyword)),
    ).length
    const hasDyePrint = dyes.length > 0

    let readyStatus: '未准备' | '部分准备' | '已准备' = '未准备'
    if (taskCount === 0) {
      readyStatus = '未准备'
    } else if (!hasDyePrint) {
      readyStatus = '已准备'
    } else if (dyes.some((dye) => dye.availableQty > 0)) {
      readyStatus = '已准备'
    } else {
      readyStatus = '部分准备'
    }

    map.set(order.productionOrderId, {
      taskCount,
      keyProcessCount,
      hasDyePrint,
      readyStatus,
    })
  }

  return map
}

function renderPlanEditDialog(): string {
  if (!getOrderById(state.planEditOrderId)) return ''

  const factoryOptions = getPlanFactoryOptions()

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-plan-edit" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">编辑生产单计划</h3>
        </header>

        <div class="space-y-4 px-6 py-5">
          <label class="space-y-1">
            <span class="text-sm">计划开始日期 <span class="text-destructive">*</span></span>
            <input type="date" data-prod-field="planFormStartDate" value="${escapeHtml(
              state.planForm.planStartDate,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">计划结束日期 <span class="text-destructive">*</span></span>
            <input type="date" data-prod-field="planFormEndDate" value="${escapeHtml(
              state.planForm.planEndDate,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">计划数量 <span class="text-destructive">*</span></span>
            <input type="number" min="1" data-prod-field="planFormQty" value="${escapeHtml(
              state.planForm.planQty,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入计划数量" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">计划工厂 <span class="text-destructive">*</span></span>
            <select data-prod-field="planFormFactoryId" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="" ${state.planForm.planFactoryId ? '' : 'selected'}>请选择计划工厂</option>
              ${factoryOptions
                .map(
                  (factory) =>
                    `<option value="${factory.id}" ${
                      state.planForm.planFactoryId === factory.id ? 'selected' : ''
                    }>${escapeHtml(factory.name)}</option>`,
                )
                .join('')}
            </select>
          </label>

          <label class="space-y-1">
            <span class="text-sm">备注</span>
            <input data-prod-field="planFormRemark" value="${escapeHtml(
              state.planForm.planRemark,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选备注" />
          </label>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-plan-edit">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="save-plan-edit">保存</button>
        </footer>
      </div>
    </div>
  `
}

export function renderProductionPlanPage(): string {
  const downstreamMap = getPlanDownstreamMap()
  const { weekStart, weekEnd } = getPlanWeekRange()

  const filteredOrders = state.orders.filter((order) => {
    const keyword = state.planKeyword.trim().toLowerCase()
    if (keyword) {
      const matched =
        includesKeyword(order.productionOrderId.toLowerCase(), keyword) ||
        includesKeyword(order.demandSnapshot.spuCode.toLowerCase(), keyword) ||
        includesKeyword(order.mainFactorySnapshot.name.toLowerCase(), keyword) ||
        includesKeyword((order.planFactoryName ?? '').toLowerCase(), keyword)
      if (!matched) return false
    }

    const planStatus = order.planStatus ?? 'UNPLANNED'
    if (state.planStatusFilter !== 'ALL' && planStatus !== state.planStatusFilter) {
      return false
    }

    if (state.planFactoryFilter !== 'ALL' && order.planFactoryId !== state.planFactoryFilter) {
      return false
    }

    return true
  })

  const stats = {
    unplanned: state.orders.filter((order) => (order.planStatus ?? 'UNPLANNED') === 'UNPLANNED').length,
    planned: state.orders.filter((order) => (order.planStatus ?? 'UNPLANNED') === 'PLANNED').length,
    released: state.orders.filter((order) => (order.planStatus ?? 'UNPLANNED') === 'RELEASED').length,
    weekQty: filteredOrders
      .filter((order) => order.planStartDate && order.planStartDate >= weekStart && order.planStartDate <= weekEnd)
      .reduce((sum, order) => sum + (order.planQty ?? 0), 0),
    decomposed: state.orders.filter((order) => (downstreamMap.get(order.productionOrderId)?.taskCount ?? 0) > 0)
      .length,
    withDyePrint: state.orders.filter((order) => downstreamMap.get(order.productionOrderId)?.hasDyePrint).length,
    ready: state.orders.filter((order) => downstreamMap.get(order.productionOrderId)?.readyStatus === '已准备').length,
    partialReady: state.orders.filter(
      (order) => downstreamMap.get(order.productionOrderId)?.readyStatus === '部分准备',
    ).length,
  }

  const planFactoryOptions = getPlanFactoryOptions()

  return `
    <div class="flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">生产单计划</h1>
          <p class="mt-1 text-sm text-muted-foreground">共 ${state.orders.length} 条</p>
        </div>
      </header>

      <div class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">生产单计划用于明确计划时间、数量与计划工厂；本页同步展示任务拆解、染印需求与下一步准备情况</div>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">未计划数</p>
            <p class="text-2xl font-bold">${stats.unplanned}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已计划数</p>
            <p class="text-2xl font-bold">${stats.planned}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">计划已下发数</p>
            <p class="text-2xl font-bold">${stats.released}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">本周计划数量合计</p>
            <p class="text-2xl font-bold">${stats.weekQty.toLocaleString()}</p>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已拆解生产单数</p>
            <p class="text-2xl font-bold">${stats.decomposed}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">涉及染印生产单数</p>
            <p class="text-2xl font-bold">${stats.withDyePrint}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">已准备生产单数</p>
            <p class="text-2xl font-bold">${stats.ready}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <div class="px-4 pb-4 pt-4">
            <p class="text-sm font-medium text-muted-foreground">部分准备生产单数</p>
            <p class="text-2xl font-bold">${stats.partialReady}</p>
          </div>
        </article>
      </section>

      <section class="flex flex-wrap gap-3">
        <input data-prod-field="planKeyword" value="${escapeHtml(
          state.planKeyword,
        )}" class="w-60 rounded-md border px-3 py-2 text-sm" placeholder="关键词（生产单号 / 款号 / 工厂）" />

        <select data-prod-field="planStatusFilter" class="w-40 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.planStatusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
          <option value="UNPLANNED" ${state.planStatusFilter === 'UNPLANNED' ? 'selected' : ''}>未计划</option>
          <option value="PLANNED" ${state.planStatusFilter === 'PLANNED' ? 'selected' : ''}>已计划</option>
          <option value="RELEASED" ${state.planStatusFilter === 'RELEASED' ? 'selected' : ''}>计划已下发</option>
        </select>

        <select data-prod-field="planFactoryFilter" class="w-48 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.planFactoryFilter === 'ALL' ? 'selected' : ''}>全部工厂</option>
          ${planFactoryOptions
            .map(
              (factory) =>
                `<option value="${factory.id}" ${
                  state.planFactoryFilter === factory.id ? 'selected' : ''
                }>${escapeHtml(factory.name)}</option>`,
            )
            .join('')}
        </select>
      </section>

      <section class="overflow-hidden rounded-lg border bg-card">
        ${
          filteredOrders.length === 0
            ? `<div class="flex items-center justify-center py-16 text-sm text-muted-foreground">暂无生产单计划数据</div>`
            : `
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="border-b">
                    <tr>
                      <th class="px-3 py-3 text-left font-medium">生产单号</th>
                      <th class="px-3 py-3 text-left font-medium">商品/款号</th>
                      <th class="px-3 py-3 text-left font-medium">主工厂</th>
                      <th class="px-3 py-3 text-left font-medium">计划工厂</th>
                      <th class="px-3 py-3 text-left font-medium">计划数量</th>
                      <th class="px-3 py-3 text-left font-medium">计划开始</th>
                      <th class="px-3 py-3 text-left font-medium">计划结束</th>
                      <th class="px-3 py-3 text-left font-medium">计划状态</th>
                      <th class="px-3 py-3 text-left font-medium">是否已拆解</th>
                      <th class="px-3 py-3 text-left font-medium">关联任务数</th>
                      <th class="px-3 py-3 text-left font-medium">关键工序数</th>
                      <th class="px-3 py-3 text-left font-medium">染印需求</th>
                      <th class="px-3 py-3 text-left font-medium">下一步准备状态</th>
                      <th class="px-3 py-3 text-left font-medium">更新时间</th>
                      <th class="px-3 py-3 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredOrders
                      .map((order) => {
                        const planStatus = order.planStatus ?? 'UNPLANNED'
                        const downstream = downstreamMap.get(order.productionOrderId)
                        const isBrokenDown = (downstream?.taskCount ?? 0) > 0

                        const planStatusView: Record<'UNPLANNED' | 'PLANNED' | 'RELEASED', string> = {
                          UNPLANNED: 'bg-slate-100 text-slate-700',
                          PLANNED: 'bg-blue-100 text-blue-700',
                          RELEASED: 'bg-white text-slate-700',
                        }

                        const readyClass: Record<'未准备' | '部分准备' | '已准备', string> = {
                          未准备: 'bg-slate-100 text-slate-700',
                          部分准备: 'bg-white text-slate-700',
                          已准备: 'bg-blue-100 text-blue-700',
                        }

                        return `
                          <tr class="border-b last:border-0">
                            <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.productionOrderId)}</td>
                            <td class="px-3 py-3">${escapeHtml(order.demandSnapshot.spuCode)}</td>
                            <td class="px-3 py-3">${escapeHtml(order.mainFactorySnapshot.name)}</td>
                            <td class="px-3 py-3">${escapeHtml(order.planFactoryName ?? '—')}</td>
                            <td class="px-3 py-3">${order.planQty != null ? order.planQty.toLocaleString() : '—'}</td>
                            <td class="px-3 py-3">${escapeHtml(order.planStartDate ?? '—')}</td>
                            <td class="px-3 py-3">${escapeHtml(order.planEndDate ?? '—')}</td>
                            <td class="px-3 py-3">${renderBadge(
                              planStatus === 'UNPLANNED' ? '未计划' : planStatus === 'PLANNED' ? '已计划' : '计划已下发',
                              planStatusView[planStatus],
                            )}</td>
                            <td class="px-3 py-3">${renderBadge(
                              isBrokenDown ? '已拆解' : '未拆解',
                              isBrokenDown ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700',
                            )}</td>
                            <td class="px-3 py-3 text-center">${downstream?.taskCount ?? 0}</td>
                            <td class="px-3 py-3 text-center">${downstream?.keyProcessCount ?? 0}</td>
                            <td class="px-3 py-3">${renderBadge(
                              downstream?.hasDyePrint ? '有' : '无',
                              downstream?.hasDyePrint ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700',
                            )}</td>
                            <td class="px-3 py-3">${renderBadge(
                              downstream?.readyStatus ?? '未准备',
                              readyClass[downstream?.readyStatus ?? '未准备'],
                            )}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(order.planUpdatedAt ?? '—')}</td>
                            <td class="px-3 py-3">
                              <div class="flex flex-wrap gap-1">
                                <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-prod-action="open-plan-edit" data-order-id="${
                                  order.productionOrderId
                                }">编辑计划</button>
                                ${
                                  planStatus !== 'RELEASED'
                                    ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-prod-action="release-plan" data-order-id="${
                                        order.productionOrderId
                                      }">下发计划</button>`
                                    : ''
                                }
                                <button class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted" data-prod-action="open-order-detail" data-order-id="${
                                  order.productionOrderId
                                }">查看生产单</button>
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

      ${renderPlanEditDialog()}
    </div>
  `
}


export {
  getPlanDownstreamMap,
  renderPlanEditDialog,
}
