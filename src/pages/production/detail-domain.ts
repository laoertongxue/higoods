import {
  escapeHtml,
  state,
  renderBadge,
  renderEmptyRow,
  renderConfirmDialog,
  renderFormDialog,
  safeText,
  type ProductionOrder,
  type ProductionOrderStatus,
  type FactoryTier,
  type FactoryType,
  type OrderDetailTab,
  type AuditLog,
  type AssignmentProgressStatus,
  type LifecycleStatus,
  tierLabels,
  typeLabels,
  riskFlagConfig,
  productionOrderStatusConfig,
  assignmentProgressStatusConfig,
  demandTechPackStatusConfig,
  taskStatusLabel,
  legalEntities,
  lifecycleStatusLabel,
  getOrderById,
  getOrderTechPackInfo,
  getOrderRuntimeAssignmentSnapshot,
  getOrderStandardTimeSnapshot,
  getOrderTaskBreakdownSnapshot,
  getOrderMaterialIndicators,
  getMaterialRequestDraftSummaryByOrder,
  getOrderBusinessTechPackStatus,
  formatStandardTimeMinutes,
  formatStandardTimePerUnit,
  renderSplitEventList,
  listMaterialRequestDraftsByOrder,
  getTaskTypeLabel,
  currentUser,
  nextLocalEntityId,
  openAppRoute,
} from './context'
import {
  getOrderMergedAuditLogs,
  renderMaterialDraftDrawer,
} from './orders-domain'

function renderDetailLogsDialog(order: ProductionOrder): string {
  if (!state.detailLogsOpen) return ''

  const logs = [...order.auditLogs].reverse()

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-3xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-center justify-between border-b px-6 py-4">
          <h3 class="text-lg font-semibold">操作日志</h3>
          <button class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-prod-action="detail-close-logs">关闭</button>
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
                    ? renderEmptyRow(4, '暂无日志')
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

function renderDetailSimulateDialog(order: ProductionOrder): string {
  if (!state.detailSimulateOpen) return ''

  const formContent = `
    <div class="space-y-3">
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">选择目标状态</span>
        <select data-prod-field="detailSimulateStatus" class="w-full rounded-md border px-3 py-2 text-sm">
          ${(Object.keys(productionOrderStatusConfig) as ProductionOrderStatus[]).map((status) => `<option value="${status}" ${state.detailSimulateStatus === status ? 'selected' : ''}>${escapeHtml(productionOrderStatusConfig[status].label)}</option>`).join('')}
        </select>
      </div>
      <p class="text-xs text-muted-foreground">当状态为 生产执行中/已完成/已取消 时，订单将被锁定</p>
    </div>
  `

  return renderFormDialog(
    {
      title: '模拟状态流转',
      description: '仅限管理员使用，用于测试不同状态下的页面表现',
      closeAction: { prefix: 'prod', action: 'detail-close-simulate' },
      submitAction: { prefix: 'prod', action: 'detail-open-simulate-confirm', label: '确认变更' },
      width: 'md',
    },
    formContent
  )
}

function renderDetailSimulateConfirmDialog(order: ProductionOrder): string {
  if (!state.detailConfirmSimulateOpen) return ''

  const description = `确定将状态从「${escapeHtml(productionOrderStatusConfig[order.status].label)}」变更为「${escapeHtml(productionOrderStatusConfig[state.detailSimulateStatus].label)}」吗？此操作将记录到审计日志。`

  return renderConfirmDialog(
    {
      title: '确认状态变更',
      closeAction: { prefix: 'prod', action: 'detail-close-simulate-confirm' },
      confirmAction: { prefix: 'prod', action: 'detail-apply-simulate', label: '确认' },
      width: 'sm',
    },
    `<p class="text-sm text-muted-foreground">${description}</p>`
  )
}

function renderOrderDetailTabButtons(activeTab: OrderDetailTab): string {
  const tabs: Array<{ key: OrderDetailTab; label: string }> = [
    { key: 'overview', label: '概览' },
    { key: 'demand-snapshot', label: '需求快照' },
    { key: 'tech-pack', label: '技术资料快照' },
    { key: 'assignment', label: '分配概览' },
    { key: 'handover', label: '交接链路' },
    { key: 'logs', label: '日志' },
  ]

  return `
    <div class="inline-flex rounded-md border bg-muted/30 p-1">
      ${tabs
        .map(
          (tab) => `
            <button class="rounded px-3 py-1.5 text-sm ${
              tab.key === activeTab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }" data-prod-action="detail-switch-tab" data-tab="${tab.key}">${tab.label}</button>
          `,
        )
        .join('')}
    </div>
  `
}

function getOrderMaterialStatusDisplay(order: ProductionOrder): {
  label: '未建草稿' | '待确认' | '部分确认' | '已确认'
  badgeClass: string
  hint: string
} {
  const indicators = getOrderMaterialIndicators(order)
  if (indicators.materialDraftSummaryStatus === 'pending') {
    return {
      label: '待确认',
      badgeClass: 'bg-amber-100 text-amber-700',
      hint: indicators.materialDraftHintText,
    }
  }
  if (indicators.materialDraftSummaryStatus === 'partial_confirmed') {
    return {
      label: '部分确认',
      badgeClass: 'bg-blue-100 text-blue-700',
      hint: indicators.materialDraftHintText,
    }
  }
  if (indicators.materialDraftSummaryStatus === 'confirmed') {
    return {
      label: '已确认',
      badgeClass: 'bg-green-100 text-green-700',
      hint: indicators.materialDraftHintText,
    }
  }
  if (indicators.hasMaterialDraft) {
    return {
      label: '已确认',
      badgeClass: 'bg-slate-100 text-slate-700',
      hint: indicators.materialDraftHintText,
    }
  }
  return {
    label: '未建草稿',
    badgeClass: 'bg-slate-100 text-slate-700',
    hint: indicators.materialDraftHintText,
  }
}

function renderOrderMaterialInfoSection(order: ProductionOrder): string {
  const summary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId)
  const drafts = listMaterialRequestDraftsByOrder(order.productionOrderId)
  const statusDisplay = getOrderMaterialStatusDisplay(order)
  const actionLabel =
    summary.pendingCount > 0
      ? '去确认领料'
      : summary.createdCount > 0
        ? '查看领料详情'
        : '查看领料草稿'

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-base font-semibold">领料信息</h3>
          <p class="mt-1 text-xs text-muted-foreground">按任务查看领料草稿与确认创建情况</p>
        </div>
        <button
          class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
          data-prod-action="open-material-draft-drawer"
          data-order-id="${escapeHtml(order.productionOrderId)}"
        >${actionLabel}</button>
      </div>

      <div class="mt-3 grid gap-3 md:grid-cols-5">
        <article class="rounded-md border bg-muted/20 px-3 py-2">
          <p class="text-xs text-muted-foreground">领料状态</p>
          <div class="mt-1">${renderBadge(statusDisplay.label, statusDisplay.badgeClass)}</div>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(statusDisplay.hint)}</p>
        </article>
        <article class="rounded-md border bg-muted/20 px-3 py-2"><p class="text-xs text-muted-foreground">草稿数</p><p class="mt-1 text-lg font-semibold">${summary.totalDraftCount}</p></article>
        <article class="rounded-md border bg-muted/20 px-3 py-2"><p class="text-xs text-muted-foreground">已确认需求数</p><p class="mt-1 text-lg font-semibold">${summary.createdCount}</p></article>
        <article class="rounded-md border bg-muted/20 px-3 py-2"><p class="text-xs text-muted-foreground">待确认数</p><p class="mt-1 text-lg font-semibold">${summary.pendingCount}</p></article>
        <article class="rounded-md border bg-muted/20 px-3 py-2"><p class="text-xs text-muted-foreground">不涉及数</p><p class="mt-1 text-lg font-semibold">${summary.notApplicableCount}</p></article>
      </div>

      <div class="mt-3 overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">任务名称</th>
              <th class="px-3 py-2 text-left font-medium">任务类型</th>
              <th class="px-3 py-2 text-left font-medium">草稿状态</th>
              <th class="px-3 py-2 text-left font-medium">确认状态</th>
              <th class="px-3 py-2 text-left font-medium">领料方式</th>
              <th class="px-3 py-2 text-left font-medium">领料需求编号</th>
              <th class="px-3 py-2 text-left font-medium">最近操作时间</th>
            </tr>
          </thead>
          <tbody>
            ${
              drafts.length === 0
                ? renderEmptyRow(7, '未建草稿，可进入领料需求草稿处理视图')
                : drafts
                    .map((draft) => {
                      const isConfirmed = draft.draftStatus === 'created'
                      const draftStatusLabel =
                        draft.draftStatus === 'created'
                          ? '已建草稿'
                          : draft.draftStatus === 'not_applicable'
                            ? '不涉及'
                            : '待确认'

                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2">${escapeHtml(draft.taskName)}</td>
                          <td class="px-3 py-2">${renderBadge(getTaskTypeLabel(draft.taskType), 'bg-slate-100 text-slate-700')}</td>
                          <td class="px-3 py-2">${renderBadge(
                            draftStatusLabel,
                            draft.draftStatus === 'created'
                              ? 'bg-green-100 text-green-700'
                              : draft.draftStatus === 'not_applicable'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-100 text-amber-700',
                          )}</td>
                          <td class="px-3 py-2">${renderBadge(
                            isConfirmed ? '已确认' : draft.draftStatus === 'not_applicable' ? '不涉及' : '待确认',
                            isConfirmed
                              ? 'bg-green-100 text-green-700'
                              : draft.draftStatus === 'not_applicable'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-100 text-amber-700',
                          )}</td>
                          <td class="px-3 py-2">${escapeHtml(isConfirmed ? draft.materialModeLabel : '-')}</td>
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(isConfirmed ? draft.createdMaterialRequestNo : '-')}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(draft.updatedAt || draft.createdAt || '-')}</td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderOrderDetailTabContent(order: ProductionOrder): string {
  const techPack = getOrderTechPackInfo(order)
  const totalQty = order.demandSnapshot.skuLines.reduce((sum, sku) => sum + sku.qty, 0)
  const standardTime = getOrderStandardTimeSnapshot(order)

  if (state.detailTab === 'overview') {
    const ownerDisplay = (() => {
      if (order.ownerPartyType === 'FACTORY') {
        if (order.ownerPartyId === order.mainFactoryId) {
          return { text: '主工厂', detail: order.mainFactorySnapshot.name, adjusted: false }
        }
        return { text: '工厂（已调整）', detail: order.ownerPartyId, adjusted: true }
      }

      const entity = legalEntities.find((item) => item.id === order.ownerPartyId)
      return {
        text: entity?.name ?? '法人实体',
        detail: order.ownerReason ?? '',
        adjusted: true,
      }
    })()

    return `
      <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <section class="rounded-lg border bg-card p-4">
          <h3 class="mb-3 text-base font-semibold">基本信息</h3>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div><p class="text-xs text-muted-foreground">生产单号</p><p class="font-mono">${escapeHtml(
              order.productionOrderId,
            )}</p></div>
            <div><p class="text-xs text-muted-foreground">需求编号</p><p class="font-mono">${escapeHtml(
              order.demandId,
            )}</p></div>
            <div><p class="text-xs text-muted-foreground">旧单号</p><p class="font-mono">${escapeHtml(
              order.legacyOrderNo,
            )}</p></div>
            <div><p class="text-xs text-muted-foreground">SPU编码</p><p class="font-mono">${escapeHtml(
              order.demandSnapshot.spuCode,
            )}</p></div>
            <div class="col-span-2"><p class="text-xs text-muted-foreground">SPU名称</p><p>${escapeHtml(
              order.demandSnapshot.spuName,
            )}</p></div>
            <div><p class="text-xs text-muted-foreground">总数量</p><p>${totalQty.toLocaleString()}</p></div>
            <div><p class="text-xs text-muted-foreground">交付日期</p><p>${escapeHtml(
              safeText(order.demandSnapshot.requiredDeliveryDate),
            )}</p></div>
            <div><p class="text-xs text-muted-foreground">创建时间</p><p>${escapeHtml(order.createdAt)}</p></div>
            <div><p class="text-xs text-muted-foreground">最后更新</p><p>${escapeHtml(order.updatedAt)}</p></div>
          </div>
        </section>

        <section class="rounded-lg border bg-card p-4">
          <h3 class="mb-3 text-base font-semibold">货权与工厂</h3>
          <div class="space-y-3 text-sm">
            <div>
              <p class="text-xs text-muted-foreground">货权主体</p>
              <p class="${ownerDisplay.adjusted ? 'font-medium text-orange-700' : ''}">${escapeHtml(
                ownerDisplay.text,
              )}</p>
              ${ownerDisplay.detail ? `<p class="text-xs text-muted-foreground">${escapeHtml(ownerDisplay.detail)}</p>` : ''}
              ${order.ownerReason ? `<p class="text-xs text-muted-foreground">原因：${escapeHtml(order.ownerReason)}</p>` : ''}
            </div>
            <div class="grid grid-cols-2 gap-3 border-t pt-3">
              <div><p class="text-xs text-muted-foreground">工厂名称</p><p>${escapeHtml(order.mainFactorySnapshot.name)}</p></div>
              <div><p class="text-xs text-muted-foreground">工厂编码</p><p class="font-mono">${escapeHtml(
                order.mainFactorySnapshot.code,
              )}</p></div>
              <div><p class="text-xs text-muted-foreground">层级</p><p>${escapeHtml(
                tierLabels[order.mainFactorySnapshot.tier as FactoryTier] ?? order.mainFactorySnapshot.tier,
              )}</p></div>
              <div><p class="text-xs text-muted-foreground">类型</p><p>${escapeHtml(
                typeLabels[order.mainFactorySnapshot.type as FactoryType] ?? order.mainFactorySnapshot.type,
              )}</p></div>
              <div><p class="text-xs text-muted-foreground">位置</p><p>${escapeHtml(
                `${order.mainFactorySnapshot.city}, ${order.mainFactorySnapshot.province}`,
              )}</p></div>
              <div><p class="text-xs text-muted-foreground">状态</p><p>${renderBadge(
                order.mainFactorySnapshot.status,
                'bg-slate-100 text-slate-700',
              )}</p></div>
            </div>
          </div>
        </section>
      </div>
      ${renderOrderMaterialInfoSection(order)}
      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-base font-semibold">标准工时构成</h3>
            <p class="mt-1 text-xs text-muted-foreground">生产单总标准工时来自当前生产单下最终执行任务的任务总标准工时聚合结果</p>
          </div>
          <div class="rounded-md bg-muted/40 px-3 py-2 text-right">
            <p class="text-xs text-muted-foreground">生产单总标准工时</p>
            <p class="text-sm font-semibold">${escapeHtml(formatStandardTimeMinutes(standardTime.totalStandardTime))}</p>
          </div>
        </div>

        <div class="mt-3 overflow-x-auto rounded-md border">
          <table class="w-full text-sm">
            <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">任务 / 工序工艺</th>
                <th class="px-3 py-2 text-right font-medium">数量</th>
                <th class="px-3 py-2 text-right font-medium">单位标准工时</th>
                <th class="px-3 py-2 text-left font-medium">工时单位</th>
                <th class="px-3 py-2 text-right font-medium">小计总标准工时</th>
              </tr>
            </thead>
            <tbody>
              ${
                standardTime.breakdownRows.length === 0
                  ? renderEmptyRow(5, '暂无可用标准工时')
                  : standardTime.breakdownRows
                      .map(
                        (row) => `
                          <tr class="border-b last:border-0">
                            <td class="px-3 py-2">
                              <div class="text-sm">
                                <div class="font-medium">${escapeHtml(row.taskLabel)}</div>
                                <div class="text-xs text-muted-foreground">${escapeHtml(row.processLabel)}</div>
                                <div class="text-[11px] text-muted-foreground">
                                  ${escapeHtml(row.taskNo)}
                                  ${row.isSplitResult ? ' · 拆分结果任务' : ''}
                                  ${row.detailRowCount > 0 ? ` · 明细 ${row.detailRowCount} 行` : ''}
                                </div>
                              </div>
                            </td>
                            <td class="px-3 py-2 text-right">${row.qty.toLocaleString()}</td>
                            <td class="px-3 py-2 text-right">${escapeHtml(formatStandardTimePerUnit(row.standardTimePerUnit))}</td>
                            <td class="px-3 py-2">${escapeHtml(row.standardTimeUnit || '--')}</td>
                            <td class="px-3 py-2 text-right font-medium">${escapeHtml(formatStandardTimeMinutes(row.totalStandardTime))}</td>
                          </tr>
                        `,
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </section>
      </div>
    `
  }

  if (state.detailTab === 'demand-snapshot') {
    return `
      <section class="rounded-lg border bg-card p-4 space-y-4">
        <h3 class="text-base font-semibold">需求快照</h3>
        <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><p class="text-xs text-muted-foreground">需求编号</p><p class="font-mono">${escapeHtml(
            order.demandSnapshot.demandId,
          )}</p></div>
          <div><p class="text-xs text-muted-foreground">SPU编码</p><p class="font-mono">${escapeHtml(
            order.demandSnapshot.spuCode,
          )}</p></div>
          <div><p class="text-xs text-muted-foreground">优先级</p><p>${escapeHtml(
            order.demandSnapshot.priority,
          )}</p></div>
          <div><p class="text-xs text-muted-foreground">交付日期</p><p>${escapeHtml(
            safeText(order.demandSnapshot.requiredDeliveryDate),
          )}</p></div>
        </div>

        <div class="overflow-x-auto rounded-md border">
          <table class="w-full text-sm">
            <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">SKU编码</th>
                <th class="px-3 py-2 text-left font-medium">尺码</th>
                <th class="px-3 py-2 text-left font-medium">颜色</th>
                <th class="px-3 py-2 text-right font-medium">数量</th>
              </tr>
            </thead>
            <tbody>
              ${order.demandSnapshot.skuLines
                .map(
                  (sku) => `
                    <tr class="border-b last:border-0">
                      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(sku.skuCode)}</td>
                      <td class="px-3 py-2">${escapeHtml(sku.size)}</td>
                      <td class="px-3 py-2">${escapeHtml(sku.color)}</td>
                      <td class="px-3 py-2 text-right">${sku.qty.toLocaleString()}</td>
                    </tr>
                  `,
                )
                .join('')}
              <tr>
                <td colspan="3" class="px-3 py-2 font-medium">合计</td>
                <td class="px-3 py-2 text-right font-medium">${totalQty.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${
          order.demandSnapshot.constraintsNote
            ? `<div class="border-t pt-3"><p class="text-xs text-muted-foreground">约束条件</p><p class="text-sm">${escapeHtml(
                order.demandSnapshot.constraintsNote,
              )}</p></div>`
            : ''
        }
      </section>
    `
  }

  if (state.detailTab === 'tech-pack') {
    return `
      <section class="rounded-lg border bg-card p-4 space-y-4">
        <h3 class="text-base font-semibold">技术资料快照</h3>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <h4 class="text-sm font-medium">快照信息</h4>
            <p class="text-xs text-muted-foreground">状态</p>
            <div>${renderBadge(
              demandTechPackStatusConfig[techPack.snapshotStatus].label,
              demandTechPackStatusConfig[techPack.snapshotStatus].className,
            )}</div>
            <p class="text-xs text-muted-foreground">版本 ${escapeHtml(techPack.snapshotVersion)}</p>
            <p class="text-xs text-muted-foreground">快照时间 ${escapeHtml(order.techPackSnapshot.snapshotAt)}</p>
          </div>

          <div class="space-y-2">
            <h4 class="text-sm font-medium">当前信息</h4>
            <p class="text-xs text-muted-foreground">状态</p>
            <div class="flex items-center gap-2">
              ${renderBadge(
                demandTechPackStatusConfig[techPack.currentStatus].label,
                demandTechPackStatusConfig[techPack.currentStatus].className,
              )}
              ${techPack.isOutOfSync ? renderBadge('不一致', 'bg-orange-100 text-orange-700') : ''}
            </div>
            <p class="text-xs text-muted-foreground">版本 ${escapeHtml(techPack.currentVersion)}</p>
            <p class="text-xs text-muted-foreground">完整度 ${techPack.completenessScore}%</p>
          </div>
        </div>

        ${
          techPack.missingChecklist.length > 0
            ? `<div class="space-y-2 border-t pt-3"><p class="text-sm font-medium">缺口清单</p>${techPack.missingChecklist
                .map(
                  (item) => `<p class="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">${escapeHtml(item)}</p>`,
                )
                .join('')}</div>`
            : ''
        }

        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-tech-pack" data-spu-code="${escapeHtml(
          order.demandSnapshot.spuCode,
        )}">去商品中心维护</button>
      </section>
    `
  }

  if (state.detailTab === 'assignment') {
    const runtime = getOrderRuntimeAssignmentSnapshot(order)
    const breakdown = getOrderTaskBreakdownSnapshot(order)
    return `
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-3">
          <section class="rounded-lg border bg-card p-4 space-y-2">
            <h3 class="text-base font-semibold">分配情况</h3>
            <p class="text-sm">派单任务: ${runtime.assignmentSummary.directCount}</p>
            <p class="text-sm">竞价任务: ${runtime.assignmentSummary.biddingCount}</p>
            <p class="text-sm">总任务数: ${runtime.assignmentSummary.totalTasks}</p>
            <p class="text-sm text-orange-700">未分配: ${runtime.assignmentSummary.unassignedCount}</p>
            <p class="text-sm text-muted-foreground">任务明细行: ${breakdown.detailRowCount} 条</p>
            <p class="text-xs text-muted-foreground">原始任务 ${breakdown.sourceTaskCount} · 执行任务 ${breakdown.executionTaskCount}</p>
            <p class="text-xs text-muted-foreground">拆分来源 ${breakdown.splitSourceCount} · 拆分结果 ${breakdown.splitResultCount} · 拆分组 ${breakdown.splitGroupCount}</p>
          </section>

          <section class="rounded-lg border bg-card p-4 space-y-2">
            <h3 class="text-base font-semibold">竞价情况</h3>
            <p class="text-sm">活跃竞价: ${runtime.biddingSummary.activeTenderCount}</p>
            <p class="text-sm">最近截止: ${escapeHtml(safeText(runtime.biddingSummary.nearestDeadline?.slice(0, 10)))}</p>
            <p class="text-sm text-red-700">已过期: ${runtime.biddingSummary.overdueTenderCount}</p>
          </section>

          <section class="rounded-lg border bg-card p-4 space-y-2">
            <h3 class="text-base font-semibold">派单情况</h3>
            <p class="text-sm">已分配工厂: ${runtime.directDispatchSummary.assignedFactoryCount}</p>
            <p class="text-sm text-orange-700">拒单数: ${runtime.directDispatchSummary.rejectedCount}</p>
            <p class="text-sm text-red-700">确认超时: ${runtime.directDispatchSummary.overdueAckCount}</p>
          </section>
        </div>

        <section class="rounded-lg border bg-card p-4 space-y-2">
          <h3 class="text-base font-semibold">拆分事件与结果</h3>
          ${renderSplitEventList(breakdown.splitEvents, 6)}
        </section>
      </div>
    `
  }

  if (state.detailTab === 'handover') {
    return `
      <section class="rounded-lg border bg-card p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">交接链路</h3>
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="/fcs/progress/handover?po=${escapeHtml(
            order.productionOrderId,
          )}">打开交接页面</button>
        </div>

        <div class="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          <p>待确认: -</p>
          <p>争议/差异: -</p>
          <p>已确认: -</p>
        </div>

        ${
          order.riskFlags.includes('HANDOVER_DIFF')
            ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">该生产单存在交接差异异常，请查看交接链路追踪处理。</div>`
            : ''
        }

        <div class="flex flex-wrap gap-2">
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="/fcs/progress/handover?po=${escapeHtml(
            order.productionOrderId,
          )}">查看完整交接链路</button>
          <button class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="/fcs/progress/exceptions?po=${escapeHtml(
            order.productionOrderId,
          )}&reasonCode=HANDOVER_DIFF">查看交接异常</button>
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="mb-3 text-base font-semibold">操作日志</h3>
      ${
        (() => {
          const mergedLogs = getOrderMergedAuditLogs(order).slice().reverse()
          return `
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
              mergedLogs.length === 0
                ? renderEmptyRow(4, '暂无日志')
                : mergedLogs
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
          `
        })()
      }
    </section>
  `
}

export function renderProductionOrderDetailPage(orderId: string): string {
  if (state.detailCurrentOrderId !== orderId) {
    state.detailCurrentOrderId = orderId
    state.detailTab = 'overview'
    state.detailLogsOpen = false
    state.detailSimulateOpen = false
    state.detailConfirmSimulateOpen = false
  }

  const order = state.orders.find((item) => item.productionOrderId === orderId) ?? null

  if (!order) {
    return `
      <div class="flex min-h-[240px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>未找到生产单：${escapeHtml(orderId)}</p>
        <button class="rounded-md border px-4 py-2 hover:bg-muted" data-nav="/fcs/production/orders">返回生产单台账</button>
      </div>
    `
  }

  const techPack = getOrderTechPackInfo(order)
  const runtime = getOrderRuntimeAssignmentSnapshot(order)
  const breakdown = getOrderTaskBreakdownSnapshot(order)
  const standardTime = getOrderStandardTimeSnapshot(order)

  const canBreakdown =
    getOrderBusinessTechPackStatus(order.techPackSnapshot.status) === 'RELEASED' &&
    order.status === 'READY_FOR_BREAKDOWN'
  const canAssign =
    breakdown.isBrokenDown &&
    (order.status === 'WAIT_ASSIGNMENT' || order.status === 'ASSIGNING')

  const breakdownDisabledReason =
    getOrderBusinessTechPackStatus(order.techPackSnapshot.status) !== 'RELEASED'
      ? '技术资料版本未发布，无法拆解'
      : order.status !== 'READY_FOR_BREAKDOWN'
        ? '当前状态不支持拆解'
        : ''

  const assignDisabledReason =
    !breakdown.isBrokenDown
      ? '请先完成工艺任务拆解'
      : order.status !== 'WAIT_ASSIGNMENT' && order.status !== 'ASSIGNING'
        ? '当前状态不支持分配'
        : ''
  const detailMaterialSummary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId)
  const detailMaterialStatus = getOrderMaterialStatusDisplay(order)

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="mb-1 flex items-center gap-2">
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/production/orders">返回</button>
            <h1 class="font-mono text-xl font-semibold">${escapeHtml(order.productionOrderId)}</h1>
            ${renderBadge(
              productionOrderStatusConfig[order.status].label,
              productionOrderStatusConfig[order.status].color,
            )}
            ${order.lockedLegacy ? renderBadge('已锁单', 'bg-red-100 text-red-700') : ''}
          </div>
          <p class="text-sm text-muted-foreground">关联需求：${escapeHtml(order.demandId)} | 旧单号：${escapeHtml(
            order.legacyOrderNo,
          )}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button class="rounded-md border px-3 py-2 text-sm ${
            canBreakdown ? 'hover:bg-muted' : 'pointer-events-none opacity-50'
          }" title="${escapeHtml(breakdownDisabledReason)}" data-nav="/fcs/process/task-breakdown?po=${escapeHtml(
            order.productionOrderId,
          )}">拆解任务</button>
          <button class="rounded-md border px-3 py-2 text-sm ${
            canAssign ? 'hover:bg-muted' : 'pointer-events-none opacity-50'
          }" title="${escapeHtml(assignDisabledReason)}" data-nav="/fcs/dispatch/board?po=${escapeHtml(
            order.productionOrderId,
          )}">去分配</button>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="open-tech-pack" data-spu-code="${escapeHtml(
            order.demandSnapshot.spuCode,
          )}">去商品中心维护</button>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="detail-open-logs">查看日志</button>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/progress/urge?po=${escapeHtml(
            order.productionOrderId,
          )}">催办通知</button>
          <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="detail-open-simulate">模拟状态流转</button>
        </div>
      </header>

      ${
        techPack.isOutOfSync
          ? `<section class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
               <p class="font-medium">技术资料快照与当前版本不一致</p>
               <p class="mt-1">快照版本：${escapeHtml(techPack.snapshotVersion)} (${escapeHtml(
                 demandTechPackStatusConfig[techPack.snapshotStatus].label,
               )}) | 当前版本：${escapeHtml(techPack.currentVersion)} (${escapeHtml(
                 demandTechPackStatusConfig[techPack.currentStatus].label,
               )})</p>
             </section>`
          : ''
      }

      ${
        getOrderBusinessTechPackStatus(order.techPackSnapshot.status) !== 'RELEASED'
          ? `<section class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
               <p class="font-medium">技术资料版本未发布，无法拆解</p>
               <p class="mt-1">当前技术资料状态为 ${escapeHtml(
                 demandTechPackStatusConfig[getOrderBusinessTechPackStatus(order.techPackSnapshot.status)].label,
               )}，请先完善并发布。</p>
             </section>`
          : ''
      }

      ${
        order.riskFlags.length > 0
          ? `<section class="rounded-lg border border-orange-200 bg-orange-50 p-4">
               <h3 class="mb-2 text-sm font-semibold text-orange-800">风险提示</h3>
               <div class="flex flex-wrap gap-2">
                 ${order.riskFlags
                   .map((flag) => renderBadge(riskFlagConfig[flag].label, riskFlagConfig[flag].color))
                   .join('')}
               </div>
             </section>`
          : ''
      }

      <section class="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">主工厂</h3>
          <p class="font-medium">${escapeHtml(order.mainFactorySnapshot.name)}</p>
          <p class="text-xs text-muted-foreground">${escapeHtml(order.mainFactorySnapshot.code)}</p>
          <div class="mt-2 flex flex-wrap gap-1">
            ${renderBadge(tierLabels[order.mainFactorySnapshot.tier as FactoryTier] ?? order.mainFactorySnapshot.tier, 'bg-slate-100 text-slate-700')}
            ${renderBadge(typeLabels[order.mainFactorySnapshot.type as FactoryType] ?? order.mainFactorySnapshot.type, 'bg-slate-100 text-slate-700')}
          </div>
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">拆解结果</h3>
          ${
            breakdown.isBrokenDown
              ? `${renderBadge('已拆解', 'bg-green-100 text-green-700')}
                 <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(
                   breakdown.taskTypesTop3.join('、') || '-',
                 )}</p>
                 <p class="text-xs text-muted-foreground">任务明细行 ${breakdown.detailRowCount} 条 · 合计 ${breakdown.detailRowTotalQty}件</p>
                 <p class="text-xs text-muted-foreground">原始任务 ${breakdown.sourceTaskCount} · 执行任务 ${breakdown.executionTaskCount}</p>
                 <p class="text-xs text-muted-foreground">拆分来源 ${breakdown.splitSourceCount} · 拆分结果 ${breakdown.splitResultCount} · 拆分组 ${breakdown.splitGroupCount}</p>
                 <p class="text-xs text-muted-foreground">${escapeHtml(breakdown.detailRowPreview)}</p>
                 <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(
                   safeText(breakdown.lastBreakdownAt),
                 )} by ${escapeHtml(safeText(breakdown.lastBreakdownBy))}</p>
                 ${
                   breakdown.splitEvents.length > 0
                     ? `<div class="mt-2">${renderSplitEventList(breakdown.splitEvents, 1)}</div>`
                     : ''
                 }`
              : renderBadge('未拆解', 'bg-slate-100 text-slate-700')
          }
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">分配情况</h3>
          <p class="text-sm">派单: ${runtime.assignmentSummary.directCount}</p>
          <p class="text-sm">竞价: ${runtime.assignmentSummary.biddingCount}</p>
          <p class="text-sm">总任务: ${runtime.assignmentSummary.totalTasks}</p>
          <p class="text-sm text-orange-700">未分配: ${runtime.assignmentSummary.unassignedCount}</p>
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">总标准工时</h3>
          <p class="text-lg font-semibold">${escapeHtml(formatStandardTimeMinutes(standardTime.totalStandardTime))}</p>
          <p class="mt-2 text-xs text-muted-foreground">执行任务 ${standardTime.taskCount} 条</p>
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">分配进度</h3>
          ${renderBadge(
            assignmentProgressStatusConfig[runtime.assignmentProgress.status].label,
            assignmentProgressStatusConfig[runtime.assignmentProgress.status].color,
          )}
          <p class="mt-2 text-xs text-muted-foreground">已派单: ${runtime.assignmentProgress.directAssignedCount}</p>
          <p class="text-xs text-muted-foreground">已发起竞价: ${runtime.assignmentProgress.biddingLaunchedCount}</p>
          <p class="text-xs text-muted-foreground">已中标: ${runtime.assignmentProgress.biddingAwardedCount}</p>
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">领料状态</h3>
          ${renderBadge(detailMaterialStatus.label, detailMaterialStatus.badgeClass)}
          <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(detailMaterialStatus.hint)}</p>
          <p class="text-xs text-muted-foreground">草稿 ${detailMaterialSummary.totalDraftCount} · 已确认 ${detailMaterialSummary.createdCount}</p>
          <button
            class="mt-2 inline-flex h-7 items-center rounded-md border px-2.5 text-xs hover:bg-muted"
            data-prod-action="open-material-draft-drawer"
            data-order-id="${escapeHtml(order.productionOrderId)}"
          >${detailMaterialSummary.pendingCount > 0 ? '去确认领料' : '查看领料草稿'}</button>
        </article>
      </section>

      ${renderOrderDetailTabButtons(state.detailTab)}
      ${renderOrderDetailTabContent(order)}

      ${renderMaterialDraftDrawer()}
      ${renderDetailLogsDialog(order)}
      ${renderDetailSimulateDialog(order)}
      ${renderDetailSimulateConfirmDialog(order)}
    </div>
  `
}

export {
  renderDetailLogsDialog,
  renderDetailSimulateDialog,
  renderDetailSimulateConfirmDialog,
  renderOrderDetailTabButtons,
  getOrderMaterialStatusDisplay,
  renderOrderMaterialInfoSection,
  renderOrderDetailTabContent,
}
