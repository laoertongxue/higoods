import {
  escapeHtml,
  state,
  renderBadge,
  renderStatCard,
  renderEmptyRow,
  includesKeyword,
  renderFormDialog,
  type ProductionOrder,
  type LifecycleStatus,
  lifecycleStatusLabel,
  lifecycleAllowedNext,
  initialDeductionBasisItems,
  initialStatementDrafts,
  initialSettlementBatches,
  getLegacyLikeQualityInspections,
  getLegacyLikeDyePrintOrders,
  listRuntimeTasksByOrder,
  deriveLifecycleStatus,
  getOrderById,
} from './context'

function getOrdersWithLifecycleSummary(): Array<
  ProductionOrder & {
    _lifecycleStatus: LifecycleStatus
    _planStatusZh: string
    _deliveryStatusZh: string
    _taskCount: number
    _blockedTaskCount: number
    _dyePrintStatusZh: string
    _settlementStatusZh: string
  }
> {
  const legacyLikeQualityInspections = getLegacyLikeQualityInspections()
  const legacyLikeDyePrintOrders = getLegacyLikeDyePrintOrders()
  const basisToStatement = new Map<string, string>()
  for (const statement of initialStatementDrafts) {
    for (const basisId of statement.itemBasisIds) {
      basisToStatement.set(basisId, statement.statementId)
    }
  }

  const statementToBatch = new Map<string, string>()
  for (const batch of initialSettlementBatches) {
    for (const statementId of batch.statementIds) {
      statementToBatch.set(statementId, batch.batchId)
    }
  }

  return state.orders.map((order) => {
    const lifecycle = deriveLifecycleStatus(order)
    const planStatus =
      order.planStatus === 'RELEASED'
        ? '计划已下发'
        : order.planStatus === 'PLANNED'
          ? '已计划'
          : '未计划'

    const deliveryStatus = order.deliveryWarehouseStatus === 'SET' ? '已配置' : '未配置'

    const tasks = listRuntimeTasksByOrder(order.productionOrderId)
    const blockedTaskCount = tasks.filter((task) => task.status === 'BLOCKED').length

    const relatedDyes = legacyLikeDyePrintOrders.filter(
      (dye) => dye.productionOrderId === order.productionOrderId,
    )

    let dyeStatus = '无染印'
    if (relatedDyes.length > 0) {
      const hasFailInProcess = relatedDyes.some((dye) => {
        const failBatches = dye.returnBatches.filter((batch) => {
          const linkedQcId = batch.qcId ?? (batch as { linkedQcId?: string }).linkedQcId
          return batch.result === 'FAIL' && Boolean(linkedQcId)
        })

        return failBatches.some((batch) => {
          const linkedQcId = batch.qcId ?? (batch as { linkedQcId?: string }).linkedQcId
          if (!linkedQcId) return false
          const qc = legacyLikeQualityInspections.find((inspection) => inspection.qcId === linkedQcId)
          return Boolean(qc && qc.status !== 'CLOSED')
        })
      })

      if (hasFailInProcess) {
        dyeStatus = '不合格处理中'
      } else if (relatedDyes.some((dye) => dye.availableQty > 0)) {
        dyeStatus = '可继续'
      } else {
        dyeStatus = '生产暂停'
      }
    }

    const basisItems = initialDeductionBasisItems.filter(
      (basis) => basis.productionOrderId === order.productionOrderId,
    )

    let settlement = '无扣款'
    if (basisItems.length > 0) {
      const hasInBatch = basisItems.some((basis) => {
        const statementId = basisToStatement.get(basis.basisId)
        if (!statementId) return false
        return statementToBatch.has(statementId)
      })

      const hasReady = basisItems.some((basis) => basis.status === 'CONFIRMED')
      const hasFrozen = basisItems.some((basis) => basis.status === 'DISPUTED')

      if (hasInBatch) {
        settlement = '已进入批次'
      } else if (hasReady) {
        settlement = '可进入结算'
      } else if (hasFrozen) {
        settlement = '冻结中'
      } else {
        settlement = '有扣款依据'
      }
    }

    return {
      ...order,
      _lifecycleStatus: lifecycle,
      _planStatusZh: planStatus,
      _deliveryStatusZh: deliveryStatus,
      _taskCount: tasks.length,
      _blockedTaskCount: blockedTaskCount,
      _dyePrintStatusZh: dyeStatus,
      _settlementStatusZh: settlement,
    }
  })
}

function renderStatusChangeDialog(): string {
  const order = getOrderById(state.statusSelectedOrderId)
  if (!state.statusDialogOpen || !order) return ''

  const currentStatus = deriveLifecycleStatus(order)
  const nextStatuses = lifecycleAllowedNext[currentStatus]

  const formContent = `
    <div class="space-y-4">
      <div class="space-y-1">
        <span class="text-sm font-medium">当前状态</span>
        <div class="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">${escapeHtml(lifecycleStatusLabel[currentStatus])}</div>
      </div>
      <div class="space-y-1">
        <span class="text-sm font-medium">目标状态 <span class="text-destructive">*</span></span>
        ${
          nextStatuses.length === 0
            ? `<p class="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">已关闭，不可变更</p>`
            : `<select data-prod-field="statusNext" class="w-full rounded-md border px-3 py-2 text-sm">
                 <option value="" ${state.statusNext ? '' : 'selected'}>请选择目标状态</option>
                 ${nextStatuses.map((status) => `<option value="${status}" ${state.statusNext === status ? 'selected' : ''}>${escapeHtml(lifecycleStatusLabel[status])}</option>`).join('')}
               </select>`
        }
      </div>
      <div class="space-y-1">
        <span class="text-sm font-medium">说明（可选）</span>
        <textarea data-prod-field="statusRemark" class="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入状态变更说明">${escapeHtml(state.statusRemark)}</textarea>
      </div>
    </div>
  `

  return renderFormDialog(
    {
      title: '变更生产单状态',
      closeAction: { prefix: 'prod', action: 'close-status-change' },
      submitAction: { prefix: 'prod', action: 'save-status-change', label: '保存' },
      width: 'sm',
      submitDisabled: !state.statusNext,
    },
    formContent
  )
}

export function renderProductionStatusPage(): string {
  const summarizedOrders = getOrdersWithLifecycleSummary()

  const filteredOrders = summarizedOrders.filter((order) => {
    const keyword = state.statusKeyword.trim().toLowerCase()
    if (keyword) {
      const matched =
        includesKeyword(order.productionOrderId.toLowerCase(), keyword) ||
        includesKeyword(order.demandSnapshot.spuCode.toLowerCase(), keyword) ||
        includesKeyword(order.mainFactorySnapshot.name.toLowerCase(), keyword)
      if (!matched) return false
    }

    if (state.statusFilter !== 'ALL' && order._lifecycleStatus !== state.statusFilter) return false

    return true
  })

  const countBy = (status: LifecycleStatus) =>
    summarizedOrders.filter((order) => order._lifecycleStatus === status).length

  const stats = {
    draft: countBy('DRAFT'),
    planned: countBy('PLANNED'),
    released: countBy('RELEASED'),
    inProduction: countBy('IN_PRODUCTION'),
    qcPending: countBy('QC_PENDING'),
    doneClosed: countBy('COMPLETED') + countBy('CLOSED'),
    hasPlanned: summarizedOrders.filter((order) => order._planStatusZh !== '未计划').length,
    hasDelivery: summarizedOrders.filter((order) => order._deliveryStatusZh === '已配置').length,
    hasBlocked: summarizedOrders.filter((order) => order._blockedTaskCount > 0).length,
    settlementReady: summarizedOrders.filter((order) =>
      ['可进入结算', '已进入批次'].includes(order._settlementStatusZh),
    ).length,
  }

  const lifecycleClass = (status: LifecycleStatus): string => {
    if (status === 'DRAFT' || status === 'CLOSED') return 'bg-white text-slate-700'
    if (status === 'PLANNED' || status === 'RELEASED') return 'bg-slate-100 text-slate-700'
    return 'bg-blue-100 text-blue-700'
  }

  const planClass = (value: string): string =>
    value === '未计划' ? 'bg-white text-slate-700' : 'bg-slate-100 text-slate-700'

  const deliveryClass = (value: string): string =>
    value === '已配置' ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-700'

  const dyeStatusClass = (value: string): string => {
    if (value === '可继续') return 'bg-blue-100 text-blue-700'
    if (value === '不合格处理中') return 'bg-red-100 text-red-700'
    if (value === '生产暂停') return 'bg-slate-100 text-slate-700'
    return 'bg-white text-slate-700'
  }

  const settlementClass = (value: string): string => {
    if (value === '已进入批次' || value === '可进入结算') return 'bg-blue-100 text-blue-700'
    if (value === '冻结中') return 'bg-red-100 text-red-700'
    if (value === '有扣款依据') return 'bg-slate-100 text-slate-700'
    return 'bg-white text-slate-700'
  }

  return `
    <div class="flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">生产单当前生产流程状态总览</h1>
          <p class="mt-1 text-sm text-muted-foreground">汇总每张生产单的执行状态、计划、交付仓配置、任务、染印与结算情况；原型阶段支持人工状态推进与有限回退</p>
        </div>
        <span class="text-sm text-muted-foreground">共 ${filteredOrders.length} 条</span>
      </header>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        ${renderStatCard('草稿数', stats.draft)}
        ${renderStatCard('已计划数', stats.planned)}
        ${renderStatCard('已下发数', stats.released)}
        ${renderStatCard('生产中数', stats.inProduction)}
        ${renderStatCard('待质检数', stats.qcPending)}
        ${renderStatCard('已完成/已关闭', stats.doneClosed)}
      </section>

      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${[
          { label: '已计划数', value: stats.hasPlanned, desc: '计划状态 != 未计划' },
          { label: '已配置交付仓数', value: stats.hasDelivery, desc: '交付仓状态 = 已配置' },
          { label: '有生产暂停任务的生产单数', value: stats.hasBlocked, desc: '存在生产暂停任务' },
          { label: '可结算/已进入批次数', value: stats.settlementReady, desc: '可进入结算或已进入批次' },
        ]
          .map(
            (item) => `
              <article class="rounded-lg border bg-card">
                <div class="px-4 pb-1 pt-4">
                  <p class="text-xs font-medium leading-snug text-muted-foreground">${escapeHtml(
                    item.label,
                  )}</p>
                  <p class="mt-1 text-2xl font-bold">${item.value}</p>
                </div>
                <div class="px-4 pb-4 text-xs text-muted-foreground">${escapeHtml(item.desc)}</div>
              </article>
            `,
          )
          .join('')}
      </section>

      <section class="flex flex-wrap gap-3">
        <input data-prod-field="statusKeyword" value="${escapeHtml(
          state.statusKeyword,
        )}" class="w-64 rounded-md border px-3 py-2 text-sm" placeholder="关键词（生产单号 / 款号 / 工厂）" />
        <select data-prod-field="statusFilter" class="w-40 rounded-md border px-3 py-2 text-sm">
          <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部</option>
          ${(Object.keys(lifecycleStatusLabel) as LifecycleStatus[])
            .map(
              (status) =>
                `<option value="${status}" ${
                  state.statusFilter === status ? 'selected' : ''
                }>${escapeHtml(lifecycleStatusLabel[status])}</option>`,
            )
            .join('')}
        </select>
      </section>

      ${
        filteredOrders.length === 0
          ? `<div class="flex h-40 items-center justify-center text-sm text-muted-foreground">暂无生产单状态数据</div>`
          : `
            <div class="rounded-md border overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-3 text-left font-medium">生产单号</th>
                    <th class="px-3 py-3 text-left font-medium">商品/款号</th>
                    <th class="px-3 py-3 text-left font-medium">主工厂</th>
                    <th class="px-3 py-3 text-left font-medium">当前状态</th>
                    <th class="px-3 py-3 text-left font-medium">计划状态</th>
                    <th class="px-3 py-3 text-left font-medium">交付仓</th>
                    <th class="px-3 py-3 text-left font-medium">关联任务</th>
                    <th class="px-3 py-3 text-left font-medium">生产暂停任务</th>
                    <th class="px-3 py-3 text-left font-medium">染印状态</th>
                    <th class="px-3 py-3 text-left font-medium">结算情况</th>
                    <th class="px-3 py-3 text-left font-medium">状态说明</th>
                    <th class="px-3 py-3 text-left font-medium">状态更新时间</th>
                    <th class="px-3 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredOrders
                    .map((order) => {
                      const remarkText = order.lifecycleStatusRemark ?? '—'
                      const updatedAt = order.lifecycleUpdatedAt ?? '—'

                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.productionOrderId)}</td>
                          <td class="px-3 py-3">${escapeHtml(order.demandSnapshot.spuCode)}</td>
                          <td class="px-3 py-3">${escapeHtml(order.mainFactorySnapshot.name)}</td>
                          <td class="px-3 py-3">${renderBadge(
                            lifecycleStatusLabel[order._lifecycleStatus],
                            lifecycleClass(order._lifecycleStatus),
                          )}</td>
                          <td class="px-3 py-3">${renderBadge(order._planStatusZh, planClass(order._planStatusZh))}</td>
                          <td class="px-3 py-3">${renderBadge(
                            order._deliveryStatusZh,
                            deliveryClass(order._deliveryStatusZh),
                          )}</td>
                          <td class="px-3 py-3 text-center">${order._taskCount > 0 ? order._taskCount : '—'}</td>
                          <td class="px-3 py-3 text-center">${
                            order._blockedTaskCount > 0
                              ? renderBadge(String(order._blockedTaskCount), 'bg-red-100 text-red-700')
                              : '—'
                          }</td>
                          <td class="px-3 py-3">${renderBadge(
                            order._dyePrintStatusZh,
                            dyeStatusClass(order._dyePrintStatusZh),
                          )}</td>
                          <td class="px-3 py-3">${renderBadge(
                            order._settlementStatusZh,
                            settlementClass(order._settlementStatusZh),
                          )}</td>
                          <td class="max-w-[140px] truncate px-3 py-3 text-xs text-muted-foreground" title="${escapeHtml(
                            remarkText,
                          )}">${escapeHtml(remarkText)}</td>
                          <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(updatedAt)}</td>
                          <td class="px-3 py-3 text-right">
                            <div class="flex justify-end gap-1 flex-wrap">
                              <button class="rounded border px-2 py-1 text-xs hover:bg-muted ${
                                order._lifecycleStatus === 'CLOSED' ? 'pointer-events-none opacity-50' : ''
                              }" data-prod-action="open-status-change" data-order-id="${order.productionOrderId}">状态变更</button>
                              <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="open-order-detail" data-order-id="${
                                order.productionOrderId
                              }">生产单</button>
                              <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/production/plan">计划</button>
                              <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/process/task-breakdown">任务</button>
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

      ${renderStatusChangeDialog()}
    </div>
  `
}

export {
  getOrdersWithLifecycleSummary,
  renderStatusChangeDialog,
}
