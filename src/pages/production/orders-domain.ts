import {
  escapeHtml,
  state,
  renderBadge,
  renderEmptyRow,
  renderStatCard,
  safeText,
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
  getOrderStandardTimeSnapshot,
  getOrderMaterialDisplaySummary,
  getOrderMaterialIndicators,
  getOrderTechPackSnapshotDisplay,
  formatStandardTimeMinutes,
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
} from './context.ts'
import {
  renderOrdersFromDemandDialog,
  renderDemandConfirmDialog,
} from './demand-domain.ts'

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
  if (total === 0) return '<span class="text-muted-foreground">-</span>'

  if (assignment.assignmentProgress.status === 'PENDING') {
    return `
      <div class="space-y-0.5 text-xs">
        <p>任务 ${total} / 待分配</p>
      </div>
    `
  }

  if (assignment.assignmentProgress.status === 'DONE') {
    return `
      <div class="space-y-0.5 text-xs">
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
      `竞价 ${assignment.assignmentSummary.biddingCount} / 已发起 ${assignment.assignmentProgress.biddingLaunchedCount} / 待定标 ${Math.max(0, assignment.assignmentSummary.biddingCount - assignment.assignmentProgress.biddingAwardedCount)}`,
    )
  }
  lines.push(`总计 ${total}`)

  return `
    <div class="space-y-0.5 text-xs">
      ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
    </div>
  `
}

function getOrderListStatusDisplay(order: ProductionOrder): { label: string; color: string } {
  if (order.status === 'READY_FOR_BREAKDOWN') {
    return productionOrderStatusConfig.WAIT_ASSIGNMENT
  }
  return productionOrderStatusConfig[order.status] ?? { label: order.status, color: 'bg-slate-100 text-slate-700' }
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
            <div>
              <p class="text-xs text-muted-foreground">需求编号</p>
              <p class="font-mono">${escapeHtml(order.demandSnapshot.demandId)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">SPU编码</p>
              <p class="font-mono">${escapeHtml(order.demandSnapshot.spuCode)}</p>
            </div>
            <div class="col-span-2">
              <p class="text-xs text-muted-foreground">SPU名称</p>
              <p>${escapeHtml(order.demandSnapshot.spuName)}</p>
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

function renderOrderMaterialSummary(order: ProductionOrder): string {
  const summary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId)
  const display = getOrderMaterialDisplaySummary(order)

  return `
    <button
      class="w-full rounded-md border border-transparent px-1 py-1 text-left hover:border-border hover:bg-muted/40"
      data-prod-action="open-material-draft-drawer"
      data-order-id="${order.productionOrderId}"
    >
      ${renderBadge(display.badgeLabel, display.badgeClassName)}
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(display.summaryText)}</div>
      ${
        summary.notApplicableCount > 0
          ? `<div class="text-xs text-muted-foreground">不涉及 ${summary.notApplicableCount}</div>`
          : ''
      }
    </button>
  `
}

function renderOrderMainFactory(order: ProductionOrder): string {
  const materialDisplay = getOrderMaterialDisplaySummary(order)
  const factoryRoleLabel =
    materialDisplay.stage === 'PREVIEW' || materialDisplay.stage === 'NOT_READY'
      ? '预设主工厂'
      : '实际主工厂'

  return `
    <div class="text-sm">
      <div class="max-w-[150px] truncate font-medium" title="${escapeHtml(order.mainFactorySnapshot.name)}">
        ${escapeHtml(order.mainFactorySnapshot.name)}
      </div>
      <div class="mt-0.5 text-xs text-muted-foreground">${factoryRoleLabel}</div>
      <div class="mt-1 flex items-center gap-1">
        ${renderBadge(tierLabels[order.mainFactorySnapshot.tier as FactoryTier] ?? order.mainFactorySnapshot.tier, 'bg-slate-100 text-slate-700')}
        ${renderBadge(typeLabels[order.mainFactorySnapshot.type as FactoryType] ?? order.mainFactorySnapshot.type, 'bg-slate-100 text-slate-700')}
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
        <table class="w-full min-w-[920px] text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">是否领用</th>
              <th class="px-3 py-2 text-left font-medium">物料来源</th>
              <th class="px-3 py-2 text-left font-medium">物料编码</th>
              <th class="px-3 py-2 text-left font-medium">物料名称</th>
              <th class="px-3 py-2 text-left font-medium">规格/属性</th>
              <th class="px-3 py-2 text-right font-medium">建议数量</th>
              <th class="px-3 py-2 text-right font-medium">确认数量</th>
              <th class="px-3 py-2 text-left font-medium">单位</th>
              <th class="px-3 py-2 text-left font-medium">说明/来源说明</th>
            </tr>
          </thead>
          <tbody>
            ${
              draft.lines.length === 0
                ? renderEmptyRow(9, '当前任务暂无自动建议物料，可点击“补充物料”添加')
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
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(line.materialCode)}</td>
                          <td class="px-3 py-2">${escapeHtml(line.materialName)}</td>
                          <td class="px-3 py-2">${escapeHtml(line.materialSpec)}</td>
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
              <div>正式领料需求编号：<span class="font-mono">${escapeHtml(draft.createdMaterialRequestNo)}</span></div>
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
            <table class="w-full min-w-[820px] text-sm">
              <thead class="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">勾选</th>
                  <th class="px-3 py-2 text-left font-medium">来源类型</th>
                  <th class="px-3 py-2 text-left font-medium">物料编码</th>
                  <th class="px-3 py-2 text-left font-medium">物料名称</th>
                  <th class="px-3 py-2 text-left font-medium">规格</th>
                  <th class="px-3 py-2 text-right font-medium">建议数量</th>
                  <th class="px-3 py-2 text-left font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                ${
                  candidates.length === 0
                    ? renderEmptyRow(7, '当前无可补充物料')
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
                              <td class="px-3 py-2 font-mono text-xs">${escapeHtml(option.materialCode)}</td>
                              <td class="px-3 py-2">${escapeHtml(option.materialName)}</td>
                              <td class="px-3 py-2">${escapeHtml(option.materialSpec)}</td>
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
              <h3 class="text-lg font-semibold">领料需求草稿</h3>
              <p class="mt-1 text-xs text-muted-foreground">按任务生成系统建议草稿，确认后创建正式领料需求并挂接到任务</p>
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
                <div class="font-mono text-sm">${escapeHtml(order.productionOrderId)}</div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">SPU</div>
                <div class="font-mono text-sm">${escapeHtml(order.demandSnapshot.spuCode)}</div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">款名</div>
                <div class="truncate text-sm" title="${escapeHtml(order.demandSnapshot.spuName)}">${escapeHtml(order.demandSnapshot.spuName)}</div>
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
                <div class="truncate text-sm" title="${escapeHtml(order.mainFactorySnapshot.name)}">${escapeHtml(order.mainFactorySnapshot.name)}</div>
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
                  当前生产单暂无可识别领料任务，进入分配后会自动生成建议草稿。
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
  const materialReminderStats = filteredOrders.reduce(
    (acc, order) => {
      const indicators = getOrderMaterialDisplaySummary(order)
      if (indicators.stage === 'PREVIEW') acc.preview += 1
      if (indicators.stage === 'ACTUAL_PENDING' || indicators.stage === 'ACTUAL_PARTIAL') acc.pendingOnly += 1
      if (indicators.stage === 'ACTUAL_CONFIRMED') acc.confirmed += 1
      return acc
    },
    { preview: 0, pendingOnly: 0, confirmed: 0 },
  )
  const ordersFromDemandDialog = renderOrdersFromDemandDialog()
  const confirmDialog = renderDemandConfirmDialog()

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">生产单管理</h1>
        <div class="flex flex-wrap items-center gap-2">
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="orders-from-demand">
            <i data-lucide="file-text" class="mr-1 h-4 w-4"></i>
            从需求生成
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
                placeholder="单号/旧单号/SPU/工厂"
                class="h-9 w-full rounded-md border pl-8 pr-3 text-sm"
              />
            </div>
          </div>

          <div>
            <span class="text-xs text-muted-foreground">生产单状态</span>
            <select data-prod-field="ordersStatusFilter" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">
              <option value="ALL" ${state.ordersStatusFilter.length === 0 ? 'selected' : ''}>全部</option>
              ${(Object.keys(productionOrderStatusConfig) as ProductionOrderStatus[])
                .filter((status) => status !== 'READY_FOR_BREAKDOWN')
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
              <option value="PENDING" ${state.ordersBreakdownFilter === 'PENDING' ? 'selected' : ''}>待分配</option>
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
            <span class="text-xs text-muted-foreground">主工厂层级</span>
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

      <section class="rounded-lg border bg-card px-4 py-3">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="text-muted-foreground">领料待处理提示：</span>
          <button
            class="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
            data-prod-action="apply-material-reminder-filter"
            data-target="preview"
          >
            预览草稿：${materialReminderStats.preview} 单
          </button>
          <button
            class="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100"
            data-prod-action="apply-material-reminder-filter"
            data-target="pending"
          >
            实际草稿待确认：${materialReminderStats.pendingOnly} 单
          </button>
          <button
            class="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs text-green-700 hover:bg-green-100"
            data-prod-action="apply-material-reminder-filter"
            data-target="confirmed"
          >
            已确认领料：${materialReminderStats.confirmed} 单
          </button>
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
                <th class="min-w-[140px] px-3 py-3 text-left font-medium">生产单号</th>
                <th class="min-w-[80px] px-3 py-3 text-left font-medium">旧单号</th>
                <th class="min-w-[180px] px-3 py-3 text-left font-medium">SPU</th>
                <th class="min-w-[100px] px-3 py-3 text-left font-medium">状态</th>
                <th class="min-w-[180px] px-3 py-3 text-left font-medium">技术包快照版本</th>
                <th class="min-w-[120px] px-3 py-3 text-left font-medium">任务准备</th>
                <th class="min-w-[120px] px-3 py-3 text-left font-medium">总标准工时</th>
                <th class="min-w-[100px] px-3 py-3 text-left font-medium">分配概览</th>
                <th class="min-w-[90px] px-3 py-3 text-left font-medium">分配进度</th>
                <th class="min-w-[170px] px-3 py-3 text-left font-medium">领料情况</th>
                <th class="min-w-[180px] px-3 py-3 text-left font-medium">主工厂</th>
                <th class="min-w-[150px] px-3 py-3 text-left font-medium">风险</th>
                <th class="min-w-[100px] px-3 py-3 text-left font-medium">最近更新</th>
                <th class="sticky right-0 z-20 min-w-[160px] bg-muted/50 px-3 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                pagedOrders.length === 0
                  ? renderEmptyRow(15, '暂无数据')
                  : pagedOrders
                    .map((order) => {
                        const assignment = getOrderDisplayAssignmentSnapshot(order)
                        const breakdown = getOrderDisplayBreakdownSnapshot(order)
                        const standardTime = getOrderStandardTimeSnapshot(order)
                        const techPackSnapshotDisplay = getOrderTechPackSnapshotDisplay(order)
                        const mergedLogs = getOrderMergedAuditLogs(order)
                        const lastLog = mergedLogs[mergedLogs.length - 1]

                        return `
                          <tr class="cursor-pointer border-b last:border-0 hover:bg-muted/30" data-prod-action="open-order-detail" data-order-id="${order.productionOrderId}">
                            <td class="px-3 py-3" data-prod-action="noop">
                              <input type="checkbox" data-prod-action="toggle-orders-select" data-order-id="${
                                order.productionOrderId
                              }" ${state.ordersSelectedIds.has(order.productionOrderId) ? 'checked' : ''} />
                            </td>
                            <td class="px-3 py-3">
                              <button class="h-auto p-0 font-mono text-sm text-blue-600 hover:underline" data-prod-action="open-order-detail" data-order-id="${
                                order.productionOrderId
                              }">${escapeHtml(order.productionOrderId)}</button>
                            </td>
                            <td class="px-3 py-3 font-mono text-sm text-muted-foreground">${escapeHtml(order.legacyOrderNo)}</td>
                            <td class="px-3 py-3">
                              <div class="text-sm">
                                <div class="font-mono">${escapeHtml(order.demandSnapshot.spuCode)}</div>
                                <div class="max-w-[150px] truncate text-xs text-muted-foreground" title="${escapeHtml(order.demandSnapshot.spuName)}">
                                  ${escapeHtml(order.demandSnapshot.spuName)}
                                </div>
                              </div>
                            </td>
                            <td class="px-3 py-3">
                              ${renderBadge(getOrderListStatusDisplay(order).label, getOrderListStatusDisplay(order).color)}
                            </td>
                            <td class="px-3 py-3">
                              <div class="space-y-1">
                                <div class="text-sm text-muted-foreground">${escapeHtml(
                                  techPackSnapshotDisplay.techPackVersionText,
                                )}</div>
                                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                                  ${renderBadge(
                                    techPackSnapshotDisplay.techPackReadyStatus,
                                    techPackSnapshotDisplay.techPackReadyClassName,
                                  )}
                                  <span>冻结时间 ${escapeHtml(techPackSnapshotDisplay.techPackSnapshotAt)}</span>
                                </div>
                              </div>
                            </td>
                            <td class="px-3 py-3">
                              <div class="text-sm">
                                ${renderBadge(breakdown.label, breakdown.badgeClassName)}
                                <div class="mt-0.5 text-xs text-muted-foreground">
                                  ${escapeHtml(breakdown.detailText)}
                                </div>
                              </div>
                            </td>
                            <td class="px-3 py-3">
                              <div class="text-sm">
                                <div class="font-medium">${escapeHtml(formatStandardTimeMinutes(standardTime.totalStandardTime))}</div>
                                <div class="mt-0.5 text-xs text-muted-foreground">执行任务 ${standardTime.taskCount} 条</div>
                              </div>
                            </td>
                            <td class="px-3 py-3">${renderOrderAssignmentOverview(order)}</td>
                            <td class="px-3 py-3">
                              ${renderBadge(
                                assignmentProgressStatusConfig[assignment.assignmentProgress.status]?.label ?? assignment.assignmentProgress.status,
                                assignmentProgressStatusConfig[assignment.assignmentProgress.status]?.color ?? 'bg-slate-100 text-slate-700',
                              )}
                            </td>
                            <td class="px-3 py-3">
                              ${renderOrderMaterialSummary(order)}
                            </td>
                            <td class="px-3 py-3">${renderOrderMainFactory(order)}</td>
                            <td class="px-3 py-3">${renderOrderRiskFlags(order.riskFlags)}</td>
                            <td class="px-3 py-3 text-sm text-muted-foreground">
                              ${escapeHtml(safeText(lastLog?.at.split(' ')[0] ?? order.updatedAt.split(' ')[0]))}
                            </td>
                            <td class="sticky right-0 ${state.ordersActionMenuId === order.productionOrderId ? 'z-40' : 'z-10'} bg-background px-3 py-3" data-prod-action="noop">
                              <div class="flex items-center gap-1">
                                <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="open-order-detail" data-order-id="${order.productionOrderId}">
                                  <i data-lucide="eye" class="h-4 w-4"></i>
                                </button>
                                <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="open-orders-demand-snapshot" data-order-id="${order.productionOrderId}">
                                  <i data-lucide="file-text" class="h-4 w-4"></i>
                                </button>
                                <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="open-orders-logs" data-order-id="${order.productionOrderId}">
                                  <i data-lucide="history" class="h-4 w-4"></i>
                                </button>
                                <div class="relative" data-prod-orders-menu-root="true">
                                  <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-prod-action="toggle-orders-more-menu" data-order-id="${order.productionOrderId}">
                                    <i data-lucide="more-horizontal" class="h-4 w-4"></i>
                                  </button>
                                  ${
                                    state.ordersActionMenuId === order.productionOrderId
                                      ? `
                                        <div class="absolute right-0 z-50 mt-1 min-w-[150px] rounded-md border bg-background p-1 shadow-lg">
                                          <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-prod-action="open-order-tech-pack-snapshot" data-order-id="${escapeHtml(order.productionOrderId)}">
                                            <i data-lucide="file-text" class="mr-2 h-4 w-4"></i>
                                            查看技术包快照
                                          </button>
                                          <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-prod-action="open-orders-dispatch-center" data-order-id="${order.productionOrderId}">
                                            <i data-lucide="send" class="mr-2 h-4 w-4"></i>
                                            去分配中心
                                          </button>
                                          <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-prod-action="open-orders-dispatch-board" data-order-id="${order.productionOrderId}">
                                            <i data-lucide="layout-grid" class="mr-2 h-4 w-4"></i>
                                            去分配看板
                                          </button>
                                          <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-prod-action="open-material-draft-drawer" data-order-id="${order.productionOrderId}">
                                            <i data-lucide="boxes" class="mr-2 h-4 w-4"></i>
                                            领料需求草稿
                                          </button>
                                        </div>
                                      `
                                      : ''
                                  }
                                </div>
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

      ${renderMaterialDraftDrawer()}
      ${renderOrderDemandSnapshotDrawer()}
      ${renderOrderLogsDialog()}
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
  getOrderMaterialIndicators,
  getOrderSplitAuditLogs,
  getOrderMergedAuditLogs,
  renderOrderMaterialSummary,
  renderMaterialDraftTaskCard,
  renderAddDraftMaterialsDialog,
  renderMaterialDraftDrawer,
}
