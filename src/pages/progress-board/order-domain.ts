import {
  state,
  LIFECYCLE_LABEL,
  LIFECYCLE_COLOR_CLASS,
  LIFECYCLE_ICON,
  getFactoryById,
  getPoKanbanGroups,
  getPoKpiStats,
  getFilteredPoRows,
  listBoardTasks,
  getTaskById,
  getTaskDisplayName,
  getOrderSpuCode,
  getOrderById,
  getOrderSpuName,
  getTaskHandoverSummary,
  TASK_STATUS_LABEL,
  STATUS_COLOR_CLASS,
  renderBadge,
  escapeAttr,
  escapeHtml,
  type PoLifecycle,
  type PoViewRow,
} from './context.ts'

function renderOrderActionMenu(row: PoViewRow): string {
  const isOpen = state.orderActionMenuId === row.orderId

  return `
    <div class="relative inline-flex" data-progress-order-menu="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-progress-action="toggle-order-menu" data-order-id="${escapeAttr(row.orderId)}" data-progress-stop="true">
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      ${
        isOpen
          ? `
            <div class="absolute right-0 top-9 z-30 w-44 rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="order-action-detail" data-order-id="${escapeAttr(row.orderId)}" data-progress-stop="true">
                <i data-lucide="layers" class="mr-2 h-4 w-4"></i>查看生命周期
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="order-action-exception" data-order-id="${escapeAttr(row.orderId)}" data-progress-stop="true">
                <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>异常定位与处理
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="order-action-dispatch" data-order-id="${escapeAttr(row.orderId)}" data-progress-stop="true">
                <i data-lucide="send" class="mr-2 h-4 w-4"></i>去任务分配
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="order-action-handover" data-order-id="${escapeAttr(row.orderId)}" data-progress-stop="true">
                <i data-lucide="scan-line" class="mr-2 h-4 w-4"></i>交接链路
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderOrderListView(rows: PoViewRow[]): string {
  return `
    <section class="rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1520px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-3 py-2 font-medium">生产单号</th>
              <th class="px-3 py-2 font-medium">SPU</th>
              <th class="px-3 py-2 font-medium">主工厂</th>
              <th class="px-3 py-2 font-medium">生命周期</th>
              <th class="px-3 py-2 font-medium">任务进度</th>
              <th class="px-3 py-2 font-medium">执行情况</th>
              <th class="px-3 py-2 font-medium">风险</th>
              <th class="px-3 py-2 font-medium">当前卡点</th>
              <th class="px-3 py-2 font-medium">下一动作</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `
                  <tr>
                    <td colspan="10" class="px-3 py-10 text-center text-muted-foreground">暂无数据</td>
                  </tr>
                `
                : rows
                    .map((row) => {
                      const progress = row.totalTasks > 0 ? Math.round((row.doneTasks / row.totalTasks) * 100) : 0

                      return `
                        <tr class="cursor-pointer border-b hover:bg-muted/50" data-progress-action="open-order-detail" data-order-id="${escapeAttr(row.orderId)}">
                          <td class="px-3 py-2"><span class="font-mono text-xs">${escapeHtml(row.orderId)}</span></td>
                          <td class="px-3 py-2">
                            <div class="text-xs">
                              <div class="font-medium">${escapeHtml(row.spuCode)}</div>
                              <div class="max-w-[160px] truncate text-muted-foreground">${escapeHtml(row.spuName || '-')}</div>
                            </div>
                          </td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(row.mainFactory)}</td>
                          <td class="px-3 py-2">${renderBadge(LIFECYCLE_LABEL[row.lifecycle], LIFECYCLE_COLOR_CLASS[row.lifecycle])}</td>
                          <td class="px-3 py-2">
                            <div class="space-y-1 text-xs">
                              <div class="text-muted-foreground">${row.doneTasks}/${row.totalTasks} 已完成</div>
                              <div class="h-1.5 w-36 overflow-hidden rounded-full bg-muted">
                                <span class="block h-full rounded-full bg-green-500" style="width:${progress}%"></span>
                              </div>
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <div class="flex flex-wrap gap-1">
                              ${row.inProgressTasks > 0 ? renderBadge(`进行中 ${row.inProgressTasks}`, 'border-blue-200 bg-blue-100 text-blue-700') : ''}
                              ${row.blockedTasks > 0 ? renderBadge(`生产暂停 ${row.blockedTasks}`, 'border-red-200 bg-red-100 text-red-700') : ''}
                              ${row.unassignedTasks > 0 ? renderBadge(`待分配 ${row.unassignedTasks}`, 'border-orange-200 bg-orange-100 text-orange-700') : ''}
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <div class="flex flex-wrap gap-1">
                              ${
                                row.risks.length === 0
                                  ? '<span class="text-xs text-muted-foreground">—</span>'
                                  : `${row.risks
                                      .slice(0, 2)
                                      .map((risk) => renderBadge(risk, 'border-red-200 bg-red-100 text-red-700'))
                                      .join('')}${
                                      row.risks.length > 2
                                        ? renderBadge(`+${row.risks.length - 2}`, 'border-border bg-background text-foreground')
                                        : ''
                                    }`
                              }
                            </div>
                          </td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">
                            <div>${escapeHtml(row.blockpoint)}</div>
                            <div class="text-blue-600">交接卡点：${escapeHtml(row.handoverStatusLabel)}</div>
                          </td>
                          <td class="px-3 py-2 text-xs font-medium text-foreground">
                            <div>${escapeHtml(row.nextAction)}</div>
                            <div class="text-blue-600">交接下一步：${escapeHtml(row.handoverNextAction)}</div>
                          </td>
                          <td class="px-3 py-2 text-right" data-progress-stop="true">${renderOrderActionMenu(row)}</td>
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

function renderOrderKanbanView(rows: PoViewRow[]): string {
  const groups = getPoKanbanGroups(rows)

  return `
    <div class="grid grid-cols-6 gap-3">
      ${(Object.keys(LIFECYCLE_LABEL) as PoLifecycle[])
        .map((lifecycle) => {
          const items = groups[lifecycle]

          return `
            <section class="space-y-3">
              <div class="flex items-center justify-between px-1">
                <h3 class="flex items-center gap-1.5 text-sm font-medium">
                  <i data-lucide="${LIFECYCLE_ICON[lifecycle]}" class="h-4 w-4"></i>
                  ${LIFECYCLE_LABEL[lifecycle]}
                </h3>
                ${renderBadge(String(items.length), 'border-border bg-background text-foreground')}
              </div>
              <div class="h-[calc(100vh-390px)] overflow-y-auto pr-1">
                <div class="space-y-2">
                  ${
                    items.length === 0
                      ? '<div class="rounded-md border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">暂无</div>'
                      : items
                          .map((row) => {
                            const progress = row.totalTasks > 0 ? Math.round((row.doneTasks / row.totalTasks) * 100) : 0

                            return `
                              <article class="cursor-pointer rounded-lg border bg-background p-3 shadow-sm transition hover:shadow-md" data-progress-action="open-order-detail" data-order-id="${escapeAttr(row.orderId)}">
                                <div class="font-mono text-xs text-muted-foreground">${escapeHtml(row.orderId)}</div>
                                <div class="mt-1 truncate text-sm font-medium">${escapeHtml(row.spuName || row.spuCode)}</div>
                                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.mainFactory)}</div>
                                <div class="mt-1 text-xs text-muted-foreground">${row.qty} 件</div>
                                <div class="mt-2 space-y-1">
                                  <div class="flex justify-between text-xs text-muted-foreground">
                                    <span>任务进度</span>
                                    <span>${row.doneTasks}/${row.totalTasks}</span>
                                  </div>
                                  <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <span class="block h-full rounded-full bg-green-500" style="width:${progress}%"></span>
                                  </div>
                                </div>
                                ${
                                  row.blockpoint !== '—'
                                    ? `<div class="mt-2 rounded bg-orange-50 px-1.5 py-1 text-xs text-orange-700">卡点：${escapeHtml(row.blockpoint)}</div>`
                                    : ''
                                }
                                <div class="mt-2 rounded bg-blue-50 px-1.5 py-1 text-xs text-blue-700">交接：${escapeHtml(row.handoverStatusLabel)}</div>
                                ${
                                  row.risks.length > 0
                                    ? `<div class="mt-2 flex flex-wrap gap-1">${row.risks
                                        .slice(0, 2)
                                        .map((risk) => renderBadge(risk, 'border-red-200 bg-red-100 text-red-700'))
                                        .join('')}</div>`
                                    : ''
                                }
                                <div class="mt-2 text-xs font-medium text-blue-600">${escapeHtml(row.nextAction)}</div>
                                <div class="mt-1 text-xs text-blue-600">交接下一步：${escapeHtml(row.handoverNextAction)}</div>
                              </article>
                            `
                          })
                          .join('')
                  }
                </div>
              </div>
            </section>
          `
        })
        .join('')}
    </div>
  `
}

function renderOrderDimension(rows: PoViewRow[]): string {
  const kpi = getPoKpiStats(rows)
  const filteredRows = getFilteredPoRows(rows)

  return `
    <section class="space-y-4">
      <div class="grid grid-cols-6 gap-4">
        ${[
          { key: 'PREPARING', value: kpi.preparing, label: '准备中' },
          { key: 'PENDING_ASSIGN', value: kpi.pendingAssign, label: '待分配' },
          { key: 'IN_EXECUTION', value: kpi.inExecution, label: '执行中' },
          { key: 'PENDING_QC', value: kpi.pendingQc, label: '待质检' },
          { key: 'PENDING_SETTLEMENT', value: kpi.pendingSettlement, label: '待结算' },
          { key: 'CLOSED', value: kpi.closed, label: '已结案' },
        ]
          .map((item) => {
            const lifecycle = item.key as PoLifecycle
            return `
              <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="po-kpi-filter" data-lifecycle="${item.key}">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted-foreground">${item.label}</span>
                  <i data-lucide="${LIFECYCLE_ICON[lifecycle]}" class="h-4 w-4"></i>
                </div>
                <div class="mt-1 text-2xl font-bold">${item.value}</div>
              </button>
            `
          })
          .join('')}
      </div>

      <section class="rounded-lg border bg-card p-4">
        <div class="flex gap-3">
          <div class="w-full max-w-sm">
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="搜索生产单号 / SPU / 工厂"
              value="${escapeAttr(state.poKeyword)}"
              data-progress-field="poKeyword"
            />
          </div>
          <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-progress-field="poLifecycleFilter">
            <option value="ALL" ${state.poLifecycleFilter === 'ALL' ? 'selected' : ''}>全部阶段</option>
            ${(Object.keys(LIFECYCLE_LABEL) as PoLifecycle[])
              .map((lifecycle) => `<option value="${lifecycle}" ${state.poLifecycleFilter === lifecycle ? 'selected' : ''}>${LIFECYCLE_LABEL[lifecycle]}</option>`)
              .join('')}
          </select>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="reset-order-filters">重置</button>
        </div>
      </section>

      ${state.viewMode === 'list' ? renderOrderListView(filteredRows) : renderOrderKanbanView(filteredRows)}
    </section>
  `
}

function renderOrderDrawer(rows: PoViewRow[]): string {
  if (!state.detailOrderId) return ''

  const row = rows.find((item) => item.orderId === state.detailOrderId)
  if (!row) return ''

  const orderTasks = listBoardTasks().filter((task) => task.productionOrderId === row.orderId)
  const progress = row.totalTasks > 0 ? Math.round((row.doneTasks / row.totalTasks) * 100) : 0

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-progress-action="close-order-drawer" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[560px] overflow-y-auto border-l bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur">
          <div class="flex items-center justify-between">
            <h3 class="flex items-center gap-2 text-lg font-semibold">
              <i data-lucide="layers" class="h-5 w-5"></i>
              生产单生命周期详情
              ${renderBadge(LIFECYCLE_LABEL[row.lifecycle], LIFECYCLE_COLOR_CLASS[row.lifecycle])}
            </h3>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-progress-action="close-order-drawer" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </div>

        <div class="space-y-5 px-6 py-5">
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-xs text-muted-foreground">生产单号</p>
              <p class="mt-0.5 font-mono">${escapeHtml(row.orderId)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">SPU</p>
              <p class="mt-0.5">${escapeHtml(row.spuCode)}</p>
              <p class="text-xs text-muted-foreground">${escapeHtml(row.spuName || '-')}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">主工厂</p>
              <p class="mt-0.5">${escapeHtml(row.mainFactory)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">数量</p>
              <p class="mt-0.5">${row.qty} 件</p>
            </div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">任务进度</p>
            <div class="mt-1.5 space-y-1.5 text-sm">
              <div class="flex justify-between">
                <span>${row.doneTasks}/${row.totalTasks} 已完成</span>
                <span class="text-muted-foreground">${progress}%</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                <span class="block h-full rounded-full bg-green-500" style="width:${progress}%"></span>
              </div>
              <div class="flex gap-3 text-xs text-muted-foreground">
                ${row.inProgressTasks > 0 ? `<span class="text-blue-600">进行中 ${row.inProgressTasks}</span>` : ''}
                ${row.blockedTasks > 0 ? `<span class="text-red-600">生产暂停 ${row.blockedTasks}</span>` : ''}
                ${row.unassignedTasks > 0 ? `<span class="text-orange-600">待分配 ${row.unassignedTasks}</span>` : ''}
              </div>
            </div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">风险情况</p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              ${
                row.risks.length === 0
                  ? '<span class="text-sm text-muted-foreground">无风险</span>'
                  : row.risks.map((risk) => renderBadge(risk, 'border-red-200 bg-red-100 text-red-700')).join('')
              }
            </div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">当前卡点</p>
            <div class="mt-1.5 rounded px-3 py-2 text-sm ${row.blockpoint === '—' ? 'text-muted-foreground' : 'bg-orange-50 text-orange-700'}">${escapeHtml(row.blockpoint)}</div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">下一步动作</p>
            <div class="mt-1.5 rounded bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600">${escapeHtml(row.nextAction)}</div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">交接状态</p>
            <div class="mt-1.5 rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">${escapeHtml(row.handoverStatusLabel)}</div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">交接下一步</p>
            <div class="mt-1.5 rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">${escapeHtml(row.handoverNextAction)}</div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">任务概况</p>
            <div class="mt-1.5 space-y-1">
              ${orderTasks
                .slice(0, 6)
                .map((task) => {
                  const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null

                  return `
                    <div class="flex items-center justify-between border-b py-1 text-xs last:border-0">
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-muted-foreground">${escapeHtml(task.taskId)}</span>
                        <span>${escapeHtml(getTaskDisplayName(task))}</span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <span class="text-muted-foreground">${escapeHtml(factory?.name ?? '未分配')}</span>
                        ${renderBadge(TASK_STATUS_LABEL[task.status], STATUS_COLOR_CLASS[task.status])}
                      </div>
                    </div>
                  `
                })
                .join('')}
              ${
                orderTasks.length > 6
                  ? `<div class="pt-1 text-xs text-muted-foreground">... 共 ${orderTasks.length} 个任务</div>`
                  : ''
              }
            </div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">相关入口</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="order-view-tasks" data-order-id="${escapeAttr(row.orderId)}">
                <i data-lucide="clipboard-list" class="mr-1.5 h-4 w-4"></i>查看任务清单
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="order-action-exception" data-order-id="${escapeAttr(row.orderId)}">
                <i data-lucide="alert-triangle" class="mr-1.5 h-4 w-4"></i>异常定位与处理
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="order-action-dispatch" data-order-id="${escapeAttr(row.orderId)}">
                <i data-lucide="send" class="mr-1.5 h-4 w-4"></i>去任务分配
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="order-action-handover" data-order-id="${escapeAttr(row.orderId)}">
                <i data-lucide="scan-line" class="mr-1.5 h-4 w-4"></i>交接链路
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
}

export { renderOrderDimension, renderOrderDrawer }
