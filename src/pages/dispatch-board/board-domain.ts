import {
  state,
  pathZh,
  resultZh,
  resultBadgeClass,
  colLabel,
  colHeaderColor,
  colBg,
  priceStatusLabel,
  priceStatusClass,
  productionOrders,
  deriveAssignPath,
  deriveAssignResult,
  deriveKanbanCol,
  getEffectiveTender,
  formatDeadlineBadge,
  getDeadlineStatus,
  currentCheckpoint,
  isAffectedByTaskSet,
  formatScopeLabel,
  formatTaskNo,
  hasTender,
  getPriceStatus,
  getStandardPrice,
  formatRemainingTime,
  taskStatusZh,
  calcRemaining,
  escapeHtml,
  type DispatchTask,
  type KanbanCol,
} from './context'
function renderKanbanCard(
  task: DispatchTask,
  dyePendingTaskIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  exceptionTaskIds: Set<string>,
): string {
  const hasException = isAffectedByTaskSet(task, exceptionTaskIds)
  const assignPath = deriveAssignPath(task)
  const assignResult = deriveAssignResult(task, hasException)
  const tender = getEffectiveTender(task)
  const deadlineBadge = formatDeadlineBadge(getDeadlineStatus(task), task)
  const checkpoint = currentCheckpoint(
    task,
    assignResult,
    tender,
    dyePendingTaskIds,
    qcPendingOrderIds,
    hasException,
  )
  const isBid = assignResult === 'BIDDING' || assignResult === 'AWAIT_AWARD' || assignResult === 'AWARDED'
  const alreadyHasTender = hasTender(task)
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)

  const tenderSummary = (() => {
    if (!isBid) return ''
    if (!tender) {
      return '<p class="text-[10px] text-amber-600">未创建招标单</p>'
    }

    const poolCount = 'factoryPoolCount' in tender ? tender.factoryPoolCount : tender.factoryPool.length
    const quotedCount = 'quotedCount' in tender ? (tender.quotedCount ?? 0) : (tender.quotedCount ?? 0)
    const maxPrice = 'currentMaxPrice' in tender ? tender.currentMaxPrice : tender.currentMaxPrice
    const minPrice = 'currentMinPrice' in tender ? tender.currentMinPrice : tender.currentMinPrice
    const currency = tender.currency ?? 'IDR'
    const unit = tender.unit ?? '件'
    const biddingDeadline = tender.biddingDeadline ?? ''
    const taskDeadline = tender.taskDeadline ?? ''
    const remaining = biddingDeadline ? calcRemaining(biddingDeadline) : '—'
    const awardedFactory = 'awardedFactoryName' in tender ? tender.awardedFactoryName : undefined
    const awardedPrice = 'awardedPrice' in tender ? tender.awardedPrice : undefined

    return `
      <p class="text-[10px] font-mono text-muted-foreground">${escapeHtml(tender.tenderId)}</p>
      <p class="text-[10px] text-muted-foreground">工厂池：${poolCount} 家 · 报价进度：<span class="font-medium text-blue-700">${quotedCount} / ${poolCount}</span></p>
      <p class="text-[10px] text-muted-foreground">最高：${
        maxPrice != null
          ? `<span class="text-red-700">${maxPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</span>`
          : '暂无报价'
      } · 最低：${
        minPrice != null
          ? `<span class="text-blue-700">${minPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</span>`
          : '暂无报价'
      }</p>
      <p class="text-[10px]"><span class="${remaining === '已截止' ? 'font-medium text-red-600' : 'text-orange-700'}">${remaining}</span><span class="text-muted-foreground"> · 任务截止 ${escapeHtml(taskDeadline.slice(0, 10))}</span></p>
      ${
        assignResult === 'AWARDED' && awardedFactory
          ? `<p class="text-[10px] font-medium text-green-700">中标：${escapeHtml(awardedFactory)}</p>
             ${
               awardedPrice != null
                 ? `<p class="text-[10px] tabular-nums">中标价：${awardedPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</p>`
                 : ''
             }`
          : ''
      }
    `
  })()

  const directSummary = (() => {
    if (assignResult !== 'DIRECT_ASSIGNED') return ''

    const priceStatus = getPriceStatus(task)

    return `
      ${task.assignedFactoryName ? `<p class="text-[10px] font-medium text-green-700">${escapeHtml(task.assignedFactoryName)}</p>` : ''}
      ${task.acceptDeadline ? `<p class="text-[10px] text-muted-foreground">接单截止：${escapeHtml(task.acceptDeadline.slice(0, 16))}</p>` : ''}
      ${task.taskDeadline ? `<p class="text-[10px] text-muted-foreground">任务截止：${escapeHtml(task.taskDeadline.slice(0, 10))}</p>` : ''}
      ${
        task.dispatchPrice != null
          ? `<p class="text-[10px] tabular-nums">派单价：${task.dispatchPrice.toLocaleString()} ${escapeHtml(task.dispatchPriceCurrency ?? 'IDR')}/${escapeHtml(task.dispatchPriceUnit ?? '件')}</p>
             ${
               priceStatus !== 'NO_STANDARD'
                 ? `<span class="inline-flex rounded border px-1 py-0 text-[10px] font-medium ${priceStatusClass[priceStatus]}">${priceStatusLabel[priceStatus]}</span>`
                 : ''
             }`
          : ''
      }
    `
  })()

  const holdReason = (() => {
    if (assignResult !== 'HOLD') return ''

    const lastLog = task.auditLogs[task.auditLogs.length - 1]
    const reason = lastLog?.detail ?? '—'
    return `<p class="text-[10px] text-slate-500">原因：${escapeHtml(reason)}</p>`
  })()

  return `
    <article class="rounded-md border bg-card text-sm ${hasException ? 'border-red-200' : ''}">
      <div class="space-y-1.5 p-3">
        <div class="flex items-start justify-between gap-1">
          <span class="font-mono text-xs text-muted-foreground">${escapeHtml(formatTaskNo(task))}</span>
          ${hasException ? '<i data-lucide="alert-triangle" class="h-3.5 w-3.5 shrink-0 text-red-500"></i>' : ''}
        </div>

        <p class="font-medium leading-tight">${escapeHtml(task.processNameZh)}</p>
        <p class="text-xs text-muted-foreground">${escapeHtml(task.productionOrderId)} · ${task.scopeQty} 件</p>
        <p class="text-xs text-muted-foreground">执行范围：${escapeHtml(formatScopeLabel(task))}</p>

        <div class="flex flex-wrap items-center gap-1.5">
          ${
            assignPath !== 'NONE'
              ? `<span class="inline-flex rounded border px-1.5 py-0 text-[10px]">${pathZh[assignPath]}</span>`
              : ''
          }
          <span class="inline-flex rounded border px-1.5 py-0 text-[10px] font-medium ${resultBadgeClass[assignResult]}">${resultZh[assignResult]}</span>
          ${
            deadlineBadge
              ? `<span class="inline-flex items-center gap-0.5 rounded border px-1.5 py-0 text-[10px] font-medium ${deadlineBadge.className}"><i data-lucide="clock" class="h-2.5 w-2.5"></i>${deadlineBadge.label}</span>`
              : ''
          }
        </div>

        ${
          assignResult === 'DIRECT_ASSIGNED'
            ? `<div class="space-y-0.5 rounded border bg-background px-2 py-1">${directSummary}</div>`
            : ''
        }

        ${
          isBid
            ? `<div class="space-y-0.5 rounded border bg-background px-2 py-1">${tenderSummary}</div>`
            : ''
        }

        ${holdReason}

        <p class="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">${escapeHtml(checkpoint)}</p>

        <div class="flex flex-wrap gap-1 pt-1">
          <button class="h-6 rounded border px-2 text-[10px] hover:bg-muted" data-dispatch-action="open-direct-dispatch" data-task-id="${escapeHtml(task.taskId)}">直接派单</button>

          ${
            isBid && alreadyHasTender
              ? `<button class="h-6 rounded border border-orange-200 px-2 text-[10px] text-orange-700 hover:bg-orange-50" data-dispatch-action="open-view-tender" data-task-id="${escapeHtml(task.taskId)}"><i data-lucide="file-text" class="mr-0.5 inline h-3 w-3"></i>查看招标单</button>`
              : `<button class="h-6 rounded border px-2 text-[10px] hover:bg-muted" data-dispatch-action="open-create-tender" data-task-id="${escapeHtml(task.taskId)}"><i data-lucide="plus" class="mr-0.5 inline h-3 w-3"></i>创建招标单</button>`
          }

          ${
            assignResult === 'AWAIT_AWARD'
              ? '<button class="h-6 rounded border border-purple-200 px-2 text-[10px] text-purple-700 hover:bg-purple-50" data-nav="/fcs/dispatch/tenders">招标单管理</button>'
              : ''
          }

          <button class="h-6 rounded px-2 text-[10px] hover:bg-muted" data-dispatch-action="set-hold" data-task-id="${escapeHtml(task.taskId)}">暂不分配</button>

          ${
            order
              ? `<button class="h-6 rounded px-1 text-[10px] hover:bg-muted" data-dispatch-action="open-order" data-order-id="${escapeHtml(task.productionOrderId)}"><i data-lucide="eye" class="h-3 w-3"></i></button>`
              : ''
          }
        </div>
      </div>
    </article>
  `
}

function renderKanbanView(
  rows: DispatchTask[],
  dyePendingTaskIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  exceptionTaskIds: Set<string>,
): string {
  const cols: Record<KanbanCol, DispatchTask[]> = {
    UNASSIGNED: [],
    BIDDING: [],
    AWAIT_AWARD: [],
    AWARDED: [],
    DIRECT_ASSIGNED: [],
    HOLD: [],
    EXCEPTION: [],
  }

  for (const task of rows) {
    const col = deriveKanbanCol(task, isAffectedByTaskSet(task, exceptionTaskIds))
    cols[col].push(task)
  }

  const colOrder: KanbanCol[] = [
    'UNASSIGNED',
    'DIRECT_ASSIGNED',
    'BIDDING',
    'AWAIT_AWARD',
    'AWARDED',
    'HOLD',
    'EXCEPTION',
  ]

  return `
    <div class="flex gap-3 overflow-x-auto pb-4 pt-2">
      ${colOrder
        .map((col) => {
          return `
            <section class="w-[230px] flex-none rounded-lg border ${colBg[col]}" data-dispatch-kanban-column="${col}">
              <header class="flex items-center justify-between border-b px-3 py-2">
                <span class="text-sm font-medium ${colHeaderColor[col]}">${colLabel[col]}</span>
                <span class="inline-flex rounded bg-secondary px-1.5 py-0.5 text-xs">${cols[col].length}</span>
              </header>

              <div class="h-[calc(100vh-440px)] overflow-y-auto p-2">
                <div class="space-y-2">
                  ${
                    cols[col].length === 0
                      ? '<p class="py-3 text-center text-xs text-muted-foreground">暂无任务</p>'
                      : cols[col]
                          .map((task) =>
                            renderKanbanCard(task, dyePendingTaskIds, qcPendingOrderIds, exceptionTaskIds),
                          )
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

function renderListView(
  rows: DispatchTask[],
  dyePendingTaskIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  exceptionTaskIds: Set<string>,
): string {
  return `
    <div class="space-y-3 pt-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted-foreground">已选 ${state.selectedIds.size} 条</span>
        <button class="h-8 rounded-md border px-3 text-xs hover:bg-muted ${state.selectedIds.size === 0 ? 'pointer-events-none opacity-50' : ''}" data-dispatch-action="batch-direct-dispatch">批量直接派单</button>
        <button class="h-8 rounded-md border px-3 text-xs hover:bg-muted ${state.selectedIds.size === 0 ? 'pointer-events-none opacity-50' : ''}" data-dispatch-action="batch-bidding">批量发起竞价</button>
        <button class="h-8 rounded-md px-3 text-xs hover:bg-muted ${state.selectedIds.size === 0 ? 'pointer-events-none opacity-50' : ''}" data-dispatch-action="batch-hold">批量设为暂不分配</button>
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1880px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-xs">
              <th class="w-10 px-3 py-2 text-left"><input type="checkbox" data-dispatch-field="list.selectAll" ${rows.length > 0 && state.selectedIds.size === rows.length ? 'checked' : ''} /></th>
              <th class="px-3 py-2 text-left font-medium">任务ID</th>
              <th class="px-3 py-2 text-left font-medium">任务名称</th>
              <th class="px-3 py-2 text-left font-medium">执行范围</th>
              <th class="px-3 py-2 text-left font-medium">生产单号</th>
              <th class="px-3 py-2 text-left font-medium">分配路径</th>
              <th class="px-3 py-2 text-left font-medium">分配结果</th>
              <th class="px-3 py-2 text-left font-medium">承接工厂</th>
              <th class="px-3 py-2 text-left font-medium">接单截止</th>
              <th class="px-3 py-2 text-left font-medium">任务截止</th>
              <th class="px-3 py-2 text-left font-medium">时限状态</th>
              <th class="px-3 py-2 text-left font-medium">剩余/逾期</th>
              <th class="px-3 py-2 text-left font-medium">工序标准价</th>
              <th class="px-3 py-2 text-left font-medium">直接派单价</th>
              <th class="px-3 py-2 text-left font-medium">价格状态</th>
              <th class="px-3 py-2 text-left font-medium">招标单号</th>
              <th class="px-3 py-2 text-left font-medium">工厂池</th>
              <th class="px-3 py-2 text-left font-medium">竞价截止</th>
              <th class="px-3 py-2 text-left font-medium">任务截止（招标）</th>
              <th class="px-3 py-2 text-left font-medium">中标工厂</th>
              <th class="px-3 py-2 text-left font-medium">中标价</th>
              <th class="px-3 py-2 text-left font-medium">当前卡点</th>
              <th class="px-3 py-2 text-left font-medium">任务状态</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>

          <tbody>
            ${
              rows.length === 0
                ? '<tr><td colspan="24" class="py-8 text-center text-sm text-muted-foreground">暂无任务数据</td></tr>'
                : rows
                    .map((task) => {
                      const hasException = isAffectedByTaskSet(task, exceptionTaskIds)
                      const assignPath = deriveAssignPath(task)
                      const assignResult = deriveAssignResult(task, hasException)
                      const tender = getEffectiveTender(task)
                      const deadlineBadge = formatDeadlineBadge(getDeadlineStatus(task), task)
                      const checkpoint = currentCheckpoint(
                        task,
                        assignResult,
                        tender,
                        dyePendingTaskIds,
                        qcPendingOrderIds,
                        hasException,
                      )
                      const std = getStandardPrice(task)
                      const isDirect = assignResult === 'DIRECT_ASSIGNED'
                      const isBid =
                        assignResult === 'BIDDING' || assignResult === 'AWAIT_AWARD' || assignResult === 'AWARDED'
                      const alreadyHasTender = hasTender(task)
                      const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)

                      const tenderBiddingDeadline = tender?.biddingDeadline ?? ''
                      const tenderTaskDeadline = tender?.taskDeadline ?? ''
                      const tenderPoolCount = tender
                        ? 'factoryPoolCount' in tender
                          ? tender.factoryPoolCount
                          : tender.factoryPool.length
                        : 0
                      const awardedFactory = tender?.awardedFactoryName
                      const awardedPrice = tender?.awardedPrice

                      return `
                        <tr class="border-b last:border-b-0 ${hasException ? 'bg-red-50' : ''}">
                          <td class="px-3 py-3"><input type="checkbox" data-dispatch-field="list.selectTask" data-task-id="${escapeHtml(task.taskId)}" ${state.selectedIds.has(task.taskId) ? 'checked' : ''} /></td>
                          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(formatTaskNo(task))}</td>
                          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(task.processNameZh)}</td>
                          <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(formatScopeLabel(task))}</td>
                          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(task.productionOrderId)}</td>

                          <td class="px-3 py-3">
                            ${
                              assignPath !== 'NONE'
                                ? `<span class="inline-flex rounded border px-1.5 py-0.5 text-xs">${pathZh[assignPath]}</span>`
                                : '<span class="text-xs text-muted-foreground">—</span>'
                            }
                          </td>

                          <td class="px-3 py-3"><span class="inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${resultBadgeClass[assignResult]}">${resultZh[assignResult]}</span></td>

                          <td class="px-3 py-3 text-xs">${
                            isDirect && task.assignedFactoryName
                              ? `<span class="font-medium text-green-700">${escapeHtml(task.assignedFactoryName)}</span>`
                              : '<span class="text-muted-foreground">—</span>'
                          }</td>

                          <td class="px-3 py-3 text-xs text-muted-foreground">${
                            isDirect && task.acceptDeadline ? escapeHtml(task.acceptDeadline.slice(0, 16).replace('T', ' ')) : '—'
                          }</td>

                          <td class="px-3 py-3 text-xs text-muted-foreground">${
                            isDirect && task.taskDeadline ? escapeHtml(task.taskDeadline.slice(0, 16).replace('T', ' ')) : '—'
                          }</td>

                          <td class="px-3 py-3">
                            ${
                              isDirect && deadlineBadge
                                ? `<span class="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs font-medium ${deadlineBadge.className}"><i data-lucide="clock" class="h-3 w-3"></i>${deadlineBadge.label}</span>`
                                : `<span class="text-xs text-muted-foreground">${isDirect ? '正常' : '—'}</span>`
                            }
                          </td>

                          <td class="px-3 py-3 text-xs text-muted-foreground">${isDirect ? formatRemainingTime(task.taskDeadline) : '—'}</td>

                          <td class="px-3 py-3 text-xs tabular-nums text-muted-foreground">${
                            isDirect ? `${std.price.toLocaleString()} ${escapeHtml(std.currency)}/${escapeHtml(std.unit)}` : '—'
                          }</td>

                          <td class="px-3 py-3 text-xs tabular-nums">${
                            isDirect && task.dispatchPrice != null
                              ? `<span class="font-medium">${task.dispatchPrice.toLocaleString()} ${escapeHtml(task.dispatchPriceCurrency ?? 'IDR')}/${escapeHtml(task.dispatchPriceUnit ?? '件')}</span>`
                              : '<span class="text-muted-foreground">—</span>'
                          }</td>

                          <td class="px-3 py-3">
                            ${
                              isDirect && task.dispatchPrice != null
                                ? (() => {
                                    const ps = getPriceStatus(task)
                                    return `<span class="inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${priceStatusClass[ps]}">${priceStatusLabel[ps]}</span>`
                                  })()
                                : '<span class="text-xs text-muted-foreground">—</span>'
                            }
                          </td>

                          <td class="px-3 py-3 font-mono text-xs">${
                            isBid && tender ? `<span class="text-orange-700">${escapeHtml(tender.tenderId)}</span>` : '<span class="text-muted-foreground">—</span>'
                          }</td>

                          <td class="px-3 py-3 text-xs text-muted-foreground">${isBid && tender ? `${tenderPoolCount} 家` : '—'}</td>
                          <td class="px-3 py-3 text-xs text-muted-foreground">${isBid && tender ? escapeHtml(tenderBiddingDeadline.slice(0, 16)) : '—'}</td>
                          <td class="px-3 py-3 text-xs text-muted-foreground">${isBid && tender ? escapeHtml(tenderTaskDeadline.slice(0, 10)) : '—'}</td>

                          <td class="px-3 py-3 text-xs">${
                            assignResult === 'AWARDED' && awardedFactory
                              ? `<span class="font-medium text-green-700">${escapeHtml(awardedFactory)}</span>`
                              : '<span class="text-muted-foreground">—</span>'
                          }</td>

                          <td class="px-3 py-3 text-xs tabular-nums">${
                            assignResult === 'AWARDED' && awardedPrice != null
                              ? `<span class="font-medium">${awardedPrice.toLocaleString()} ${escapeHtml(tender?.currency ?? 'IDR')}/${escapeHtml(tender?.unit ?? '件')}</span>`
                              : '<span class="text-muted-foreground">—</span>'
                          }</td>

                          <td class="max-w-[160px] px-3 py-3 text-xs"><span class="text-amber-700">${escapeHtml(checkpoint)}</span></td>

                          <td class="px-3 py-3"><span class="inline-flex rounded border px-1.5 py-0.5 text-xs ${task.status === 'BLOCKED' ? 'border-red-200 bg-red-100 text-red-700' : ''}">${escapeHtml(taskStatusZh[task.status] ?? task.status)}</span></td>

                          <td class="px-3 py-3" data-dispatch-action="noop">
                            <div class="relative" data-dispatch-menu-root="true">
                              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-dispatch-action="toggle-row-menu" data-task-id="${escapeHtml(task.taskId)}">操作 <i data-lucide="chevron-right" class="ml-1 h-3 w-3"></i></button>
                              ${
                                state.actionMenuTaskId === task.taskId
                                  ? `<div class="absolute right-0 z-20 mt-1 min-w-[156px] rounded-md border bg-background p-1 shadow-lg">
                                      <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="open-direct-dispatch" data-task-id="${escapeHtml(task.taskId)}">直接派单</button>
                                      ${
                                        isBid && alreadyHasTender
                                          ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="open-view-tender" data-task-id="${escapeHtml(task.taskId)}"><i data-lucide="file-text" class="mr-1.5 h-3.5 w-3.5"></i>查看招标单</button>`
                                          : `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="open-create-tender" data-task-id="${escapeHtml(task.taskId)}"><i data-lucide="plus" class="mr-1.5 h-3.5 w-3.5"></i>创建招标单</button>`
                                      }
                                      <div class="my-1 h-px bg-border"></div>
                                      <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="set-hold" data-task-id="${escapeHtml(task.taskId)}">设为暂不分配</button>
                                      ${
                                        task.dispatchPrice != null
                                          ? `<div class="my-1 h-px bg-border"></div><button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="open-price-snapshot" data-task-id="${escapeHtml(task.taskId)}">查看价格快照</button>`
                                          : ''
                                      }
                                      ${
                                        order
                                          ? `<div class="my-1 h-px bg-border"></div><button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="open-order" data-order-id="${escapeHtml(task.productionOrderId)}"><i data-lucide="external-link" class="mr-1 h-3 w-3"></i>查看生产单</button>`
                                          : ''
                                      }
                                    </div>`
                                  : ''
                              }
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
  `
}

export { renderKanbanView, renderListView }
