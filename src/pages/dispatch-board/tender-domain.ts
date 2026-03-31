import {
  state,
  candidateFactories,
  getTaskById,
  getTaskAllocatableGroups,
  supportsDetailAssignment,
  hasTender,
  getEffectiveTender,
  getStandardPrice,
  formatScopeLabel,
  formatTaskNo,
  fromDateTimeLocal,
  nowTimestamp,
  createRuntimeTaskTenderByDetailGroups,
  upsertRuntimeTaskTender,
  getCreateTenderTask,
  getViewTenderTask,
  getPriceSnapshotTask,
  priceStatusLabel,
  priceStatusClass,
  getPriceStatus,
  emptyCreateTenderForm,
  escapeHtml,
  type DispatchTask,
} from './context'
function openCreateTender(taskId: string): void {
  const task = getTaskById(taskId)
  if (!task) return

  const normalizedTaskId = task.taskId.replace(/[^A-Za-z0-9]/g, '')
  const detailSupported = supportsDetailAssignment(task)

  state.createTenderTaskId = task.taskId
  state.createTenderForm = {
    mode: detailSupported ? 'DETAIL' : 'TASK',
    tenderId: `TENDER-${normalizedTaskId.slice(-8)}-${String(Date.now()).slice(-4)}`,
    minPrice: '',
    maxPrice: '',
    biddingDeadline: '',
    taskDeadline: '',
    remark: '',
    selectedPool: new Set<string>(),
  }
  state.actionMenuTaskId = null
}

function closeCreateTender(): void {
  state.createTenderTaskId = null
  state.createTenderForm = emptyCreateTenderForm()
}

function openViewTender(taskId: string): void {
  const task = getTaskById(taskId)
  if (!task) return

  if (!hasTender(task)) return

  state.viewTenderTaskId = task.taskId
  state.actionMenuTaskId = null
}

function closeViewTender(): void {
  state.viewTenderTaskId = null
}

function closePriceSnapshot(): void {
  state.priceSnapshotTaskId = null
}
function renderCreateTenderSheet(task: DispatchTask | null): string {
  if (!task || !state.createTenderTaskId) return ''

  const std = getStandardPrice(task)
  const minPrice = Number(state.createTenderForm.minPrice)
  const maxPrice = Number(state.createTenderForm.maxPrice)
  const detailSupported = supportsDetailAssignment(task)
  const detailGroups = detailSupported ? getTaskAllocatableGroups(task) : []
  const detailMode = detailSupported && state.createTenderForm.mode === 'DETAIL'

  const minValid = state.createTenderForm.minPrice !== '' && Number.isFinite(minPrice) && minPrice > 0
  const maxValid =
    state.createTenderForm.maxPrice !== '' &&
    Number.isFinite(maxPrice) &&
    maxPrice >= (minValid ? minPrice : 0)

  const valid =
    state.createTenderForm.selectedPool.size > 0 &&
    minValid &&
    maxValid &&
    state.createTenderForm.biddingDeadline !== '' &&
    state.createTenderForm.taskDeadline !== ''

  const selectedPoolIds = Array.from(state.createTenderForm.selectedPool)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-create-tender" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[560px]" data-tender-sheet="true">
        <header class="border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold">创建招标单</h3>
              <p class="text-xs text-muted-foreground">${
                detailSupported
                  ? '支持整任务创建招标单，也支持按明细分配单元拆成多个招标对象。'
                  : '当前任务仅支持整任务创建招标单。'
              }</p>
            </div>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-dispatch-action="close-create-tender">关闭</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div class="space-y-1">
            <label class="text-sm font-medium">招标单号</label>
            <div class="rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono text-muted-foreground">${escapeHtml(state.createTenderForm.tenderId)}</div>
          </div>

          ${
            detailSupported
              ? `<div class="space-y-1.5">
                  <label class="text-sm font-medium">创建模式</label>
                  <div class="inline-flex rounded-md bg-muted p-1 text-sm">
                    <button class="rounded-md px-3 py-1.5 ${state.createTenderForm.mode === 'TASK' ? 'bg-background shadow-sm' : 'text-muted-foreground'}" data-dispatch-action="switch-tender-mode" data-mode="TASK" data-tender-mode="TASK">整任务创建招标单</button>
                    <button class="rounded-md px-3 py-1.5 ${state.createTenderForm.mode === 'DETAIL' ? 'bg-background shadow-sm' : 'text-muted-foreground'}" data-dispatch-action="switch-tender-mode" data-mode="DETAIL" data-tender-mode="DETAIL">按明细创建招标单</button>
                  </div>
                </div>`
              : ''
          }

          <div class="rounded-md border bg-muted/20 p-3 space-y-1.5">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">任务基础信息</p>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">任务编号</span><span class="font-mono text-xs">${escapeHtml(formatTaskNo(task))}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">生产单号</span><span class="font-mono text-xs">${escapeHtml(task.productionOrderId)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">工序</span><span class="font-mono text-xs">${escapeHtml(task.processNameZh)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">执行范围</span><span class="font-mono text-xs">${escapeHtml(formatScopeLabel(task))}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">数量</span><span class="font-mono text-xs">${task.scopeQty} ${escapeHtml(task.qtyUnit === 'PIECE' ? '件' : task.qtyUnit)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">工序标准价</span><span class="font-mono text-xs">${std.price.toLocaleString()} ${escapeHtml(std.currency)}/${escapeHtml(std.unit)}</span></div>
          </div>

          ${
            detailMode
              ? `<div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <p class="text-sm font-semibold">按明细分配单元</p>
                    <span class="text-xs text-muted-foreground">将按下列单元拆成多个招标对象</span>
                  </div>
                  <div class="overflow-x-auto rounded-md border">
                    <table class="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr class="border-b bg-muted/40 text-xs">
                          <th class="px-3 py-2 text-left font-medium">分配单元</th>
                          <th class="px-3 py-2 text-left font-medium">数量</th>
                          <th class="px-3 py-2 text-left font-medium">维度说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${detailGroups
                          .map((group) => {
                            const dimensionsText = Object.entries(group.dimensions)
                              .map(([key, value]) => `${key}:${value}`)
                              .join('；')
                            return `
                              <tr class="border-b last:border-b-0" data-tender-group="${escapeHtml(group.groupKey)}">
                                <td class="px-3 py-2">${escapeHtml(group.groupLabel)}</td>
                                <td class="px-3 py-2 font-mono text-xs">${group.qty} 件</td>
                                <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(dimensionsText || '-')}</td>
                              </tr>
                            `
                          })
                          .join('')}
                      </tbody>
                    </table>
                  </div>
                </div>`
              : ''
          }

          <div class="h-px bg-border"></div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold">工厂池</p>
              <div class="flex gap-1">
                <button class="h-6 rounded px-2 text-[10px] hover:bg-muted" data-dispatch-action="select-all-pool">全选</button>
                <button class="h-6 rounded px-2 text-[10px] hover:bg-muted" data-dispatch-action="clear-all-pool">清空</button>
              </div>
            </div>

            <div class="rounded-md border divide-y max-h-56 overflow-y-auto">
              ${candidateFactories
                .map((factory) => {
                  const selected = state.createTenderForm.selectedPool.has(factory.id)

                  return `
                    <button class="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${selected ? 'bg-orange-50' : 'hover:bg-muted/40'}" data-dispatch-action="toggle-pool" data-factory-id="${escapeHtml(factory.id)}">
                      <span class="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-muted-foreground/40 text-transparent'}">✓</span>
                      <span class="flex-1 min-w-0 space-y-0.5">
                        <span class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-sm font-medium">${escapeHtml(factory.name)}</span>
                          ${factory.processTags
                            .map(
                              (tag) =>
                                `<span class="inline-flex rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">${escapeHtml(tag)}</span>`,
                            )
                            .join('')}
                        </span>
                        <span class="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                          <span>${escapeHtml(factory.currentStatus)}</span>
                          <span>${escapeHtml(factory.capacitySummary)}</span>
                          <span>${escapeHtml(factory.performanceSummary)}</span>
                          <span class="${factory.settlementStatus !== '结算正常' ? 'text-amber-600' : ''}">${escapeHtml(factory.settlementStatus)}</span>
                        </span>
                      </span>
                    </button>
                  `
                })
                .join('')}
            </div>

            <div class="space-y-1.5">
              <p class="text-xs font-medium text-muted-foreground">本次招标工厂池 <span class="text-red-500">*</span><span class="ml-1 text-muted-foreground">（已选 ${state.createTenderForm.selectedPool.size} 家）</span></p>
              ${
                selectedPoolIds.length === 0
                  ? '<p class="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">请在上方勾选工厂加入招标工厂池</p>'
                  : `<div class="flex flex-wrap gap-1.5 rounded-md border px-3 py-2">${selectedPoolIds
                      .map((factoryId) => {
                        const item = candidateFactories.find((factory) => factory.id === factoryId)
                        return `<span class="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs text-orange-800">${escapeHtml(item?.name ?? factoryId)}<button class="hover:text-red-600" data-dispatch-action="toggle-pool" data-factory-id="${escapeHtml(factoryId)}"><i data-lucide="x" class="h-3 w-3"></i></button></span>`
                      })
                      .join('')}</div>`
              }
            </div>
          </div>

          <div class="h-px bg-border"></div>

          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold">价格参考区</p>
              <span class="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">以下价格信息仅供平台定标参考，工厂不可见</span>
            </div>

            <div class="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <span class="text-muted-foreground">工序标准价</span>
              <span class="font-medium tabular-nums">${std.price.toLocaleString()} ${escapeHtml(std.currency)}/${escapeHtml(std.unit)}</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-sm font-medium">最低限价 <span class="text-red-500">*</span></label>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" step="100" data-dispatch-field="tender.minPrice" placeholder="最低限价" value="${escapeHtml(state.createTenderForm.minPrice)}" />
                <p class="text-[10px] text-muted-foreground">${escapeHtml(std.currency)}/${escapeHtml(std.unit)}</p>
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-medium">最高限价 <span class="text-red-500">*</span></label>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" step="100" data-dispatch-field="tender.maxPrice" placeholder="最高限价" value="${escapeHtml(state.createTenderForm.maxPrice)}" />
                <p class="text-[10px] text-muted-foreground">${escapeHtml(std.currency)}/${escapeHtml(std.unit)}</p>
              </div>
            </div>

            ${
              state.createTenderForm.minPrice !== '' &&
              state.createTenderForm.maxPrice !== '' &&
              Number.isFinite(minPrice) &&
              Number.isFinite(maxPrice) &&
              maxPrice < minPrice
                ? '<p class="text-xs text-red-600">最高限价不得低于最低限价</p>'
                : ''
            }
          </div>

          <div class="h-px bg-border"></div>

          <div class="space-y-3">
            <p class="text-sm font-semibold">时间要求</p>

            <div class="space-y-1.5">
              <label class="text-sm font-medium">竞价截止时间 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-dispatch-field="tender.biddingDeadline" value="${escapeHtml(state.createTenderForm.biddingDeadline)}" />
            </div>

            <div class="space-y-1.5">
              <label class="text-sm font-medium">任务截止时间 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-dispatch-field="tender.taskDeadline" value="${escapeHtml(state.createTenderForm.taskDeadline)}" />
            </div>
          </div>

          <div class="h-px bg-border"></div>

          <div class="space-y-1.5 pb-4">
            <label class="text-sm font-medium">招标备注 <span class="text-xs text-muted-foreground">（选填）</span></label>
            <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="2" data-dispatch-field="tender.remark" placeholder="填写招标说明、特殊要求等...">${escapeHtml(state.createTenderForm.remark)}</textarea>
          </div>
        </div>

        <footer class="border-t px-6 py-4">
          <div class="flex justify-end gap-2">
            <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dispatch-action="close-create-tender">取消</button>
            <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
              valid ? '' : 'pointer-events-none opacity-50'
            }" data-dispatch-action="confirm-create-tender">确认创建招标单</button>
          </div>
        </footer>
      </section>
    </div>
  `
}

function renderViewTenderSheet(task: DispatchTask | null): string {
  if (!task || !state.viewTenderTaskId) return ''

  const tender = getEffectiveTender(task)
  if (!tender) return ''

  const std = getStandardPrice(task)

  const tenderId = tender.tenderId
  const biddingDeadline = tender.biddingDeadline
  const tenderTaskDeadline = tender.taskDeadline
  const factoryPoolCount = 'factoryPoolCount' in tender ? tender.factoryPoolCount : tender.factoryPool.length
  const minPrice = tender.minPrice
  const maxPrice = tender.maxPrice
  const currency = tender.currency ?? 'IDR'
  const unit = tender.unit ?? '件'
  const status = 'tenderStatus' in tender ? tender.tenderStatus : tender.status
  const awardedFactory = 'awardedFactoryName' in tender ? tender.awardedFactoryName : undefined
  const awardedPrice = 'awardedPrice' in tender ? tender.awardedPrice : undefined

  const poolNames = 'factoryPoolNames' in tender ? tender.factoryPoolNames : []

  const statusZh: Record<string, string> = {
    BIDDING: '招标中',
    AWAIT_AWARD: '待定标',
    AWARDED: '已定标',
  }

  const statusClass: Record<string, string> = {
    BIDDING: 'bg-orange-100 text-orange-700 border-orange-200',
    AWAIT_AWARD: 'bg-purple-100 text-purple-700 border-purple-200',
    AWARDED: 'bg-green-100 text-green-700 border-green-200',
  }

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-view-tender" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[480px]">
        <header class="border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">招标单详情</h3>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-dispatch-action="close-view-tender">关闭</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div class="flex items-center justify-between">
            <span class="font-mono text-sm font-semibold">${escapeHtml(tenderId)}</span>
            <span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium ${statusClass[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}">${statusZh[status] ?? escapeHtml(status)}</span>
          </div>

          <div class="rounded-md border bg-muted/20 p-3 space-y-1.5">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">关联任务</p>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">任务编号</span><span class="font-mono text-xs">${escapeHtml(formatTaskNo(task))}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">生产单号</span><span class="font-mono text-xs">${escapeHtml(task.productionOrderId)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">工序</span><span class="font-mono text-xs">${escapeHtml(task.processNameZh)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">执行范围</span><span class="font-mono text-xs">${escapeHtml(formatScopeLabel(task))}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">数量</span><span class="font-mono text-xs">${task.scopeQty} 件</span></div>
          </div>

          <div class="space-y-1.5">
            <p class="text-sm font-semibold">工厂池（${factoryPoolCount} 家）</p>
            ${
              poolNames.length > 0
                ? `<div class="flex flex-wrap gap-1.5 rounded-md border px-3 py-2">${poolNames
                    .map(
                      (name) =>
                        `<span class="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-800">${escapeHtml(name)}</span>`,
                    )
                    .join('')}</div>`
                : `<p class="text-xs text-muted-foreground">（Mock 数据，共 ${factoryPoolCount} 家）</p>`
            }
          </div>

          <div class="rounded-md border bg-amber-50/60 p-3 space-y-1.5">
            <p class="mb-1 text-xs font-semibold text-amber-800">价格参考区（仅平台可见，工厂不可见）</p>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">工序标准价</span><span class="font-medium tabular-nums">${std.price.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">最低限价</span><span class="font-medium tabular-nums">${minPrice != null ? `${minPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}` : '—'}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">最高限价</span><span class="font-medium tabular-nums">${maxPrice != null ? `${maxPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}` : '—'}</span></div>
          </div>

          <div class="rounded-md border p-3 space-y-1.5">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">时间要求</p>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">竞价截止时间</span><span class="font-mono text-xs">${escapeHtml(biddingDeadline ?? '—')}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">任务截止时间</span><span class="font-mono text-xs">${escapeHtml(tenderTaskDeadline ?? '—')}</span></div>
          </div>

          ${
            awardedFactory
              ? `<div class="rounded-md border border-green-200 bg-green-50 p-3 space-y-1.5">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-green-800">定标结果</p>
                  <div class="flex items-center justify-between text-sm"><span class="text-muted-foreground">中标工厂</span><span class="font-medium text-green-700">${escapeHtml(awardedFactory)}</span></div>
                  ${
                    awardedPrice != null
                      ? `<div class="flex items-center justify-between text-sm"><span class="text-muted-foreground">中标价</span><span class="font-medium tabular-nums">${awardedPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</span></div>`
                      : ''
                  }
                </div>`
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function renderPriceSnapshotSheet(task: DispatchTask | null): string {
  if (!task || !state.priceSnapshotTaskId) return ''

  const std = getStandardPrice(task)
  const ps = task.dispatchPrice != null ? getPriceStatus(task) : 'NO_STANDARD'
  const diff = task.dispatchPrice != null ? task.dispatchPrice - std.price : null
  const diffPct = diff != null && std.price !== 0 ? ((diff / std.price) * 100).toFixed(2) : null

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-price-snapshot" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[360px]">
        <header class="border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">价格快照</h3>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-dispatch-action="close-price-snapshot">关闭</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div class="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div class="flex justify-between gap-2"><span class="text-muted-foreground">任务编号</span><span class="font-mono text-xs">${escapeHtml(formatTaskNo(task))}</span></div>
            <div class="flex justify-between gap-2"><span class="text-muted-foreground">工序</span><span class="font-mono text-xs">${escapeHtml(task.processNameZh)}</span></div>
            <div class="flex justify-between gap-2"><span class="text-muted-foreground">承接工厂</span><span class="font-medium text-green-700">${escapeHtml(task.assignedFactoryName ?? '—')}</span></div>
          </div>

          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">工序标准价</p>
            <p class="text-lg font-semibold tabular-nums">${std.price.toLocaleString()} <span class="text-sm font-normal text-muted-foreground">${escapeHtml(std.currency)}/${escapeHtml(std.unit)}</span></p>
            <p class="text-xs text-muted-foreground">来源：生产需求接收对应工序标准价快照</p>
          </div>

          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">直接派单价</p>
            ${
              task.dispatchPrice != null
                ? `<p class="text-lg font-semibold tabular-nums">${task.dispatchPrice.toLocaleString()} <span class="text-sm font-normal text-muted-foreground">${escapeHtml(task.dispatchPriceCurrency ?? 'IDR')}/${escapeHtml(task.dispatchPriceUnit ?? '件')}</span></p>`
                : '<p class="text-sm text-muted-foreground">暂未录入</p>'
            }
          </div>

          ${
            diff != null
              ? `<div class="space-y-1">
                  <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">价格偏差</p>
                  <div class="flex flex-wrap items-center gap-2">
                    ${
                      ps !== 'NO_STANDARD'
                        ? `<span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium ${priceStatusClass[ps]}">${priceStatusLabel[ps]}</span>`
                        : ''
                    }
                    <span class="text-sm font-medium tabular-nums ${
                      diff === 0 ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-blue-700'
                    }">${
                      diff === 0
                        ? '0（0%）'
                        : `${diff > 0 ? '+' : ''}${diff.toLocaleString()} ${escapeHtml(std.currency)}/${escapeHtml(std.unit)}（${diff > 0 ? '+' : ''}${diffPct}%）`
                    }</span>
                  </div>
                </div>`
              : ''
          }

          ${
            task.priceDiffReason
              ? `<div class="space-y-1">
                  <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">价格偏差原因</p>
                  <p class="rounded-md border bg-muted/30 px-3 py-2 text-sm">${escapeHtml(task.priceDiffReason)}</p>
                </div>`
              : ''
          }

          ${
            task.dispatchRemark
              ? `<div class="space-y-1">
                  <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">派单备注</p>
                  <p class="rounded-md border bg-muted/30 px-3 py-2 text-sm">${escapeHtml(task.dispatchRemark)}</p>
                </div>`
              : ''
          }
        </div>
      </section>
    </div>
  `
}
function confirmCreateTender(): void {
  const task = getCreateTenderTask()
  if (!task) return

  const minPrice = Number(state.createTenderForm.minPrice)
  const maxPrice = Number(state.createTenderForm.maxPrice)

  const valid =
    state.createTenderForm.selectedPool.size > 0 &&
    state.createTenderForm.minPrice !== '' &&
    Number.isFinite(minPrice) &&
    minPrice > 0 &&
    state.createTenderForm.maxPrice !== '' &&
    Number.isFinite(maxPrice) &&
    maxPrice >= minPrice &&
    state.createTenderForm.biddingDeadline !== '' &&
    state.createTenderForm.taskDeadline !== ''

  if (!valid) return

  const std = getStandardPrice(task)
  const selectedPoolIds = Array.from(state.createTenderForm.selectedPool)
  const poolNames = selectedPoolIds.map((factoryId) => {
    const factory = candidateFactories.find((item) => item.id === factoryId)
    return factory?.name ?? factoryId
  })

  if (state.createTenderForm.mode === 'DETAIL' && supportsDetailAssignment(task)) {
    const result = createRuntimeTaskTenderByDetailGroups({
      taskId: task.taskId,
      by: '跟单A',
    })
    if (!result.ok || !result.createdTaskIds) return

    result.createdTaskIds.forEach((childTaskId, index) => {
      const childTenderId = `${state.createTenderForm.tenderId}-${String(index + 1).padStart(2, '0')}`
      const biddingDeadline = fromDateTimeLocal(state.createTenderForm.biddingDeadline)
      const taskDeadline = fromDateTimeLocal(state.createTenderForm.taskDeadline)

      state.tenderState[childTaskId] = {
        tenderId: childTenderId,
        tenderStatus: 'BIDDING',
        factoryPool: selectedPoolIds,
        factoryPoolNames: poolNames,
        minPrice,
        maxPrice,
        currency: std.currency,
        unit: std.unit,
        biddingDeadline,
        taskDeadline,
        standardPrice: std.price,
        remark: state.createTenderForm.remark,
        createdAt: nowTimestamp(),
        quotedCount: 0,
      }

      upsertRuntimeTaskTender(
        childTaskId,
        {
          tenderId: childTenderId,
          biddingDeadline,
          taskDeadline,
        },
        '跟单A',
      )
    })

    closeCreateTender()
    return
  }

  state.tenderState[task.taskId] = {
    tenderId: state.createTenderForm.tenderId,
    tenderStatus: 'BIDDING',
    factoryPool: selectedPoolIds,
    factoryPoolNames: poolNames,
    minPrice,
    maxPrice,
    currency: std.currency,
    unit: std.unit,
    biddingDeadline: fromDateTimeLocal(state.createTenderForm.biddingDeadline),
    taskDeadline: fromDateTimeLocal(state.createTenderForm.taskDeadline),
    standardPrice: std.price,
    remark: state.createTenderForm.remark,
    createdAt: nowTimestamp(),
    quotedCount: 0,
  }

  upsertRuntimeTaskTender(
    task.taskId,
    {
      tenderId: state.createTenderForm.tenderId,
      biddingDeadline: fromDateTimeLocal(state.createTenderForm.biddingDeadline),
      taskDeadline: fromDateTimeLocal(state.createTenderForm.taskDeadline),
    },
    '跟单A',
  )
  closeCreateTender()
}

export {
  openCreateTender,
  closeCreateTender,
  openViewTender,
  closeViewTender,
  closePriceSnapshot,
  renderCreateTenderSheet,
  renderViewTenderSheet,
  renderPriceSnapshotSheet,
  confirmCreateTender,
}
