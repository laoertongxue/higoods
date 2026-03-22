import {
  escapeHtml,
  state,
  renderBadge,
  renderStatCard,
  renderEmptyRow,
  includesKeyword,
  safeText,
  renderFormDialog,
  type ProductionOrder,
  type ProductionOrderChange,
  type ProductionChangeType,
  type ProductionChangeStatus,
  changeTypeLabels,
  changeStatusLabels,
  changeStatusClass,
  changeAllowedNext,
  currentUser,
  getChangeById,
  getOrderById,
  nextChangeId,
  toTimestamp,
  getLegacyLikeQualityInspections,
  getLegacyLikeDyePrintOrders,
  listRuntimeTasksByOrder,
  initialDeductionBasisItems,
  initialStatementDrafts,
  initialSettlementBatches,
  buildSettlementSummary,
} from './context'

function getChangeSummaryMap(): Map<
  string,
  {
    taskCount: number
    dyePrintCount: number
    openQcCount: number
    basisCount: number
    statementCount: number
    batchCount: number
  }
> {
  const legacyLikeQualityInspections = getLegacyLikeQualityInspections()
  const legacyLikeDyePrintOrders = getLegacyLikeDyePrintOrders()
  const map = new Map<
    string,
    {
      taskCount: number
      dyePrintCount: number
      openQcCount: number
      basisCount: number
      statementCount: number
      batchCount: number
    }
  >()

  for (const change of state.changes) {
    const orderId = change.productionOrderId

    const taskCount = listRuntimeTasksByOrder(orderId).length
    const dyePrintCount = legacyLikeDyePrintOrders.filter((dye) => dye.productionOrderId === orderId).length
    const openQcCount = legacyLikeQualityInspections.filter(
      (inspection) => inspection.productionOrderId === orderId && inspection.status !== 'CLOSED',
    ).length
    const basisCount = initialDeductionBasisItems.filter(
      (basis) => basis.productionOrderId === orderId || basis.sourceOrderId === orderId,
    ).length

    const relatedStatements = initialStatementDrafts.filter((statement) => {
      return statement.items.some(
        (item) => item.productionOrderId === orderId || item.sourceOrderId === orderId,
      )
    })

    const statementCount = relatedStatements.length
    const statementIds = new Set(relatedStatements.map((statement) => statement.statementId))

    const batchCount = initialSettlementBatches.filter((batch) =>
      batch.statementIds.some((statementId) => statementIds.has(statementId)),
    ).length

    map.set(change.changeId, {
      taskCount,
      dyePrintCount,
      openQcCount,
      basisCount,
      statementCount,
      batchCount,
    })
  }

  return map
}

function renderChangeCreateDialog(): string {
  if (!state.changesCreateOpen) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-changes-create" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">新建生产单变更</h3>
        </header>

        <div class="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <label class="space-y-1">
            <span class="text-sm">生产单 <span class="text-destructive">*</span></span>
            <select data-prod-field="changesCreateProductionOrderId" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="" ${state.changesCreateForm.productionOrderId ? '' : 'selected'}>请选择生产单</option>
              ${state.orders
                .map((order) => {
                  const styleNo = (order as unknown as { styleNo?: string }).styleNo
                  return `<option value="${order.productionOrderId}" ${
                    state.changesCreateForm.productionOrderId === order.productionOrderId
                      ? 'selected'
                      : ''
                  }>${escapeHtml(order.productionOrderId)}${
                    styleNo ? ` · ${escapeHtml(styleNo)}` : ''
                  }</option>`
                })
                .join('')}
            </select>
            ${
              state.changesCreateErrors.productionOrderId
                ? `<p class="text-xs text-red-600">${escapeHtml(state.changesCreateErrors.productionOrderId)}</p>`
                : ''
            }
          </label>

          <label class="space-y-1">
            <span class="text-sm">变更类型 <span class="text-destructive">*</span></span>
            <select data-prod-field="changesCreateType" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="" ${state.changesCreateForm.changeType ? '' : 'selected'}>请选择变更类型</option>
              ${(Object.keys(changeTypeLabels) as ProductionChangeType[])
                .map(
                  (type) =>
                    `<option value="${type}" ${
                      state.changesCreateForm.changeType === type ? 'selected' : ''
                    }>${escapeHtml(changeTypeLabels[type])}</option>`,
                )
                .join('')}
            </select>
            ${
              state.changesCreateErrors.changeType
                ? `<p class="text-xs text-red-600">${escapeHtml(state.changesCreateErrors.changeType)}</p>`
                : ''
            }
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="space-y-1">
              <span class="text-sm">变更前</span>
              <input data-prod-field="changesCreateBeforeValue" value="${escapeHtml(
                state.changesCreateForm.beforeValue,
              )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">变更后</span>
              <input data-prod-field="changesCreateAfterValue" value="${escapeHtml(
                state.changesCreateForm.afterValue,
              )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选" />
            </label>
          </div>

          <label class="space-y-1">
            <span class="text-sm">影响范围</span>
            <input data-prod-field="changesCreateImpactScope" value="${escapeHtml(
              state.changesCreateForm.impactScopeZh,
            )}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="可选，如：生产排程、结算对象" />
          </label>

          <label class="space-y-1">
            <span class="text-sm">变更原因 <span class="text-destructive">*</span></span>
            <textarea data-prod-field="changesCreateReason" class="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" placeholder="请填写变更原因">${escapeHtml(
              state.changesCreateForm.reason,
            )}</textarea>
            ${
              state.changesCreateErrors.reason
                ? `<p class="text-xs text-red-600">${escapeHtml(state.changesCreateErrors.reason)}</p>`
                : ''
            }
          </label>

          <label class="space-y-1">
            <span class="text-sm">备注</span>
            <textarea data-prod-field="changesCreateRemark" class="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" placeholder="可选">${escapeHtml(
              state.changesCreateForm.remark,
            )}</textarea>
          </label>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-changes-create">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="save-changes-create">保存草稿</button>
        </footer>
      </div>
    </div>
  `
}

function renderChangeStatusDialog(): string {
  if (!state.changesStatusOpen || !state.changesStatusTarget) return ''

  const currentStatus = state.changesStatusTarget.currentStatus

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-changes-status" aria-label="关闭"></button>
      <div class="absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">变更状态</h3>
        </header>

        <div class="space-y-4 px-6 py-5">
          <label class="space-y-1">
            <span class="text-sm">当前状态</span>
            <div class="rounded-md border bg-muted/40 px-3 py-2 text-sm">${escapeHtml(
              changeStatusLabels[currentStatus],
            )}</div>
          </label>

          <label class="space-y-1">
            <span class="text-sm">目标状态 <span class="text-destructive">*</span></span>
            <select data-prod-field="changesStatusNext" class="w-full rounded-md border px-3 py-2 text-sm">
              <option value="" ${state.changesStatusForm.nextStatus ? '' : 'selected'}>请选择目标状态</option>
              ${changeAllowedNext[currentStatus]
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      state.changesStatusForm.nextStatus === status ? 'selected' : ''
                    }>${escapeHtml(changeStatusLabels[status])}</option>`,
                )
                .join('')}
            </select>
            ${
              state.changesStatusError
                ? `<p class="text-xs text-red-600">${escapeHtml(state.changesStatusError)}</p>`
                : ''
            }
          </label>

          <label class="space-y-1">
            <span class="text-sm">备注</span>
            <textarea data-prod-field="changesStatusRemark" class="min-h-[70px] w-full rounded-md border px-3 py-2 text-sm" placeholder="可选">${escapeHtml(
              state.changesStatusForm.remark,
            )}</textarea>
          </label>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-changes-status">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="save-changes-status">确认变更</button>
        </footer>
      </div>
    </div>
  `
}

export function renderProductionChangesPage(): string {
  const summaryMap = getChangeSummaryMap()

  const filteredChanges = state.changes.filter((change) => {
    if (state.changesTypeFilter !== 'ALL' && change.changeType !== state.changesTypeFilter) return false
    if (state.changesStatusFilter !== 'ALL' && change.status !== state.changesStatusFilter) return false

    const keyword = state.changesKeyword.trim().toLowerCase()
    if (!keyword) return true

    return [change.changeId, change.productionOrderId, change.reason]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })

  const stats = {
    draft: state.changes.filter((change) => change.status === 'DRAFT').length,
    pending: state.changes.filter((change) => change.status === 'PENDING').length,
    done: state.changes.filter((change) => change.status === 'DONE').length,
    cancelled: state.changes.filter((change) => change.status === 'CANCELLED').length,
    withTask: state.changes.filter((change) => (summaryMap.get(change.changeId)?.taskCount ?? 0) > 0).length,
    withDyePrint: state.changes.filter(
      (change) => (summaryMap.get(change.changeId)?.dyePrintCount ?? 0) > 0,
    ).length,
    withOpenQc: state.changes.filter(
      (change) => (summaryMap.get(change.changeId)?.openQcCount ?? 0) > 0,
    ).length,
    withSettlement: state.changes.filter((change) => {
      const summary = summaryMap.get(change.changeId)
      return (summary?.statementCount ?? 0) > 0 || (summary?.batchCount ?? 0) > 0
    }).length,
  }

  const statusStats: Array<{ label: string; value: number }> = [
    { label: '草稿变更数', value: stats.draft },
    { label: '待处理变更数', value: stats.pending },
    { label: '已完成变更数', value: stats.done },
    { label: '已取消变更数', value: stats.cancelled },
  ]

  const impactStats: Array<{ label: string; value: number }> = [
    { label: '涉及任务变更数', value: stats.withTask },
    { label: '涉及染印变更数', value: stats.withDyePrint },
    { label: '涉及未结案 QC 变更数', value: stats.withOpenQc },
    { label: '涉及结算变更数', value: stats.withSettlement },
  ]

  return `
    <div class="flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">生产单变更管理</h1>
          <p class="mt-1 text-sm text-muted-foreground">共 ${state.changes.length} 条</p>
        </div>
        <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="open-changes-create">新建变更</button>
      </header>

      <div class="rounded-md border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">生产单变更用于记录数量、日期、工厂等关键信息调整；本页同步展示该变更对任务、染印、质检、扣款与结算影响范围</div>

      <section class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        ${statusStats
          .map(
            (item) => `
              <article class="rounded-lg border bg-card">
                <div class="px-4 pb-4 pt-4">
                  <p class="text-xs font-normal text-muted-foreground">${escapeHtml(item.label)}</p>
                  <p class="text-2xl font-semibold">${item.value}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </section>

      <section class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        ${impactStats
          .map(
            (item) => `
              <article class="rounded-lg border bg-card">
                <div class="px-4 pb-4 pt-4">
                  <p class="text-xs font-normal text-muted-foreground">${escapeHtml(item.label)}</p>
                  <p class="text-2xl font-semibold">${item.value}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </section>

      <section class="flex flex-wrap gap-3">
        <input data-prod-field="changesKeyword" value="${escapeHtml(
          state.changesKeyword,
        )}" class="w-72 rounded-md border px-3 py-2 text-sm" placeholder="关键词（变更单号 / 生产单号 / 变更原因）" />

        <select data-prod-field="changesTypeFilter" class="w-40 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.changesTypeFilter === 'ALL' ? 'selected' : ''}>全部类型</option>
          ${(Object.keys(changeTypeLabels) as ProductionChangeType[])
            .map(
              (type) =>
                `<option value="${type}" ${
                  state.changesTypeFilter === type ? 'selected' : ''
                }>${escapeHtml(changeTypeLabels[type])}</option>`,
            )
            .join('')}
        </select>

        <select data-prod-field="changesStatusFilter" class="w-36 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.changesStatusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
          ${(Object.keys(changeStatusLabels) as ProductionChangeStatus[])
            .map(
              (status) =>
                `<option value="${status}" ${
                  state.changesStatusFilter === status ? 'selected' : ''
                }>${escapeHtml(changeStatusLabels[status])}</option>`,
            )
            .join('')}
        </select>
      </section>

      <section class="rounded-lg border bg-card">
        ${
          filteredChanges.length === 0
            ? `<div class="flex items-center justify-center py-16 text-sm text-muted-foreground">暂无生产单变更数据</div>`
            : `
              <div class="overflow-x-auto">
                <table class="w-full min-w-[1700px] text-sm">
                  <thead>
                    <tr class="border-b">
                      <th class="px-3 py-3 text-left font-medium">变更单号</th>
                      <th class="px-3 py-3 text-left font-medium">生产单号</th>
                      <th class="px-3 py-3 text-left font-medium">变更类型</th>
                      <th class="px-3 py-3 text-left font-medium">变更前</th>
                      <th class="px-3 py-3 text-left font-medium">变更后</th>
                      <th class="px-3 py-3 text-left font-medium">影响范围</th>
                      <th class="px-3 py-3 text-left font-medium">变更原因</th>
                      <th class="px-3 py-3 text-left font-medium">状态</th>
                      <th class="px-3 py-3 text-center font-medium">影响任务数</th>
                      <th class="px-3 py-3 text-center font-medium">影响染印工单数</th>
                      <th class="px-3 py-3 text-center font-medium">影响未结案 QC 数</th>
                      <th class="px-3 py-3 text-center font-medium">影响扣款依据数</th>
                      <th class="px-3 py-3 text-left font-medium">结算影响</th>
                      <th class="px-3 py-3 text-left font-medium">更新时间</th>
                      <th class="px-3 py-3 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredChanges
                      .map((change) => {
                        const summary = summaryMap.get(change.changeId) ?? {
                          taskCount: 0,
                          dyePrintCount: 0,
                          openQcCount: 0,
                          basisCount: 0,
                          statementCount: 0,
                          batchCount: 0,
                        }

                        return `
                          <tr class="border-b last:border-0">
                            <td class="whitespace-nowrap px-3 py-3 font-mono text-xs">${escapeHtml(change.changeId)}</td>
                            <td class="whitespace-nowrap px-3 py-3 font-mono text-xs">${escapeHtml(change.productionOrderId)}</td>
                            <td class="whitespace-nowrap px-3 py-3">${escapeHtml(changeTypeLabels[change.changeType])}</td>
                            <td class="max-w-[100px] truncate px-3 py-3" title="${escapeHtml(
                              safeText(change.beforeValue),
                            )}">${escapeHtml(safeText(change.beforeValue))}</td>
                            <td class="max-w-[100px] truncate px-3 py-3" title="${escapeHtml(
                              safeText(change.afterValue),
                            )}">${escapeHtml(safeText(change.afterValue))}</td>
                            <td class="max-w-[120px] truncate px-3 py-3" title="${escapeHtml(
                              safeText(change.impactScopeZh),
                            )}">${escapeHtml(safeText(change.impactScopeZh))}</td>
                            <td class="max-w-[140px] truncate px-3 py-3" title="${escapeHtml(change.reason)}">${escapeHtml(
                              change.reason,
                            )}</td>
                            <td class="px-3 py-3">${renderBadge(
                              changeStatusLabels[change.status],
                              changeStatusClass[change.status],
                            )}</td>
                            <td class="px-3 py-3 text-center tabular-nums">${summary.taskCount}</td>
                            <td class="px-3 py-3 text-center tabular-nums">${summary.dyePrintCount}</td>
                            <td class="px-3 py-3 text-center tabular-nums">${summary.openQcCount}</td>
                            <td class="px-3 py-3 text-center tabular-nums">${summary.basisCount}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground">${escapeHtml(
                              buildSettlementSummary(summary.statementCount, summary.batchCount),
                            )}</td>
                            <td class="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">${escapeHtml(
                              safeText(change.updatedAt ?? change.createdAt),
                            )}</td>
                            <td class="px-3 py-3">
                              <div class="flex items-center gap-1 flex-wrap">
                                ${
                                  changeAllowedNext[change.status].length > 0
                                    ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-prod-action="open-changes-status" data-change-id="${
                                        change.changeId
                                      }" data-current-status="${change.status}">状态变更</button>`
                                    : ''
                                }
                                <button class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted" data-prod-action="open-order-detail" data-order-id="${
                                  change.productionOrderId
                                }">查看生产单</button>
                                <button class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted" data-nav="/fcs/production/plan">查看计划</button>
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

      ${renderChangeCreateDialog()}
      ${renderChangeStatusDialog()}
    </div>
  `
}


export {
  getChangeSummaryMap,
  renderChangeCreateDialog,
  renderChangeStatusDialog,
}
