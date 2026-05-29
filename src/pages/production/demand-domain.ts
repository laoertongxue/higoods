import {
  escapeHtml,
  type ProductionDemand,
  type ProductionOrder,
  currentUser,
  state,
  renderBadge,
  renderEmptyRow,
  safeText,
  getDemandById,
  getFilteredDemands,
  getBatchSelectedDemandIds,
  getTechPackSnapshotForDemand,
  renderDemandOperations,
  listOrdersFromDemandGeneratableDemands,
  getOrdersFromDemandSelectedIds,
  toTimestamp,
  nextLocalEntityId,
  nextProductionOrderId,
  openAppRoute,
  renderStatCard,
  demandPriorityConfig,
  demandStatusConfig,
} from './context.ts'
import {
  buildProductionOrderFromDemands,
  PENDING_MAIN_FACTORY_ID,
} from '../../data/fcs/production-orders'

function renderDemandDetailDrawer(): string {
  const demand = getDemandById(state.demandDetailId)
  if (!demand) return ''

  const techPackInfo = getTechPackSnapshotForDemand(demand)
  const detailActions = renderDemandOperations(demand, techPackInfo.status, {
    compact: false,
    techPackAction: 'open-current-tech-pack-from-demand-detail',
    allowGenerate: techPackInfo.canGenerate,
  })

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-demand-detail" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[500px]" data-dialog-panel="true">
        <header class="border-b px-5 py-4">
          <h3 class="text-lg font-semibold">需求详情</h3>
        </header>
        <div class="mt-6 space-y-6 overflow-y-auto px-5 pb-8">
          <section>
            <h4 class="mb-3 font-medium">基本信息</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">需求编号</p>
                <p class="font-mono">${escapeHtml(demand.demandId)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">旧单号</p>
                <p class="font-mono">${escapeHtml(demand.legacyOrderNo)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">SPU编码</p>
                <p class="font-mono">${escapeHtml(demand.spuCode)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">SPU名称</p>
                <p>${escapeHtml(demand.spuName)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">款式买手</p>
                <p>${escapeHtml(demand.buyerName)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">生产跟单</p>
                <p>${escapeHtml(demand.merchandiserName)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">需求总量</p>
                <p class="font-medium">${demand.requiredQtyTotal.toLocaleString()}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">交付日期</p>
                <p>${escapeHtml(safeText(demand.requiredDeliveryDate))}</p>
              </div>
            </div>
          </section>

          <div class="h-px bg-border"></div>

          <section>
            <h4 class="mb-3 font-medium">当前生效技术包版本</h4>
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                ${renderBadge(
                  techPackInfo.displayStatusLabel,
                  techPackInfo.displayStatusClassName,
                )}
                <span class="text-sm">版本编号：${escapeHtml(techPackInfo.versionCode || '-')}</span>
                <span class="text-sm">版本标签：${escapeHtml(techPackInfo.versionLabel || '暂无当前生效版本')}</span>
              </div>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p class="text-xs text-muted-foreground">发布时间</p>
                  <p>${escapeHtml(techPackInfo.publishedAt || '-')}</p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">是否可转生产单</p>
                  <p>${escapeHtml(techPackInfo.canGenerate ? '可转单' : '不可转单')}</p>
                </div>
                <div class="col-span-2">
                  <p class="text-xs text-muted-foreground">当前说明</p>
                  <p>${escapeHtml(techPackInfo.blockReason || '当前技术包版本已满足转单条件')}</p>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                ${detailActions}
              </div>
            </div>
          </section>

          <div class="h-px bg-border"></div>

          <section>
            <h4 class="mb-3 font-medium">SKU明细</h4>
            <div class="rounded-md border">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="px-3 py-2 text-left">SKU</th>
                    <th class="px-3 py-2 text-left">尺码</th>
                    <th class="px-3 py-2 text-left">颜色</th>
                    <th class="px-3 py-2 text-right">数量</th>
                  </tr>
                </thead>
                <tbody>
                  ${demand.skuLines
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
                </tbody>
              </table>
            </div>
          </section>

          ${
            demand.constraintsNote
              ? `
                <div class="h-px bg-border"></div>
                <section>
                  <h4 class="mb-3 font-medium">约束条件</h4>
                  <p class="text-sm text-muted-foreground">${escapeHtml(demand.constraintsNote)}</p>
                </section>
              `
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function getSelectedBatchTargetDemands(): ProductionDemand[] {
  return getBatchSelectedDemandIds()
    .map((demandId) => state.demands.find((item) => item.demandId === demandId) ?? null)
    .filter((item): item is ProductionDemand => item !== null)
}

function getDemandMergeValidation(targetDemands: ProductionDemand[]): {
  canMerge: boolean
  reason: string
  generatableIds: Set<string>
} {
  const generatableIds = new Set(
    targetDemands
      .filter((demand) => {
        const info = getTechPackSnapshotForDemand(demand)
        return demand.demandStatus === 'PENDING_CONVERT' && !demand.hasProductionOrder && info.canGenerate
      })
      .map((demand) => demand.demandId),
  )

  if (targetDemands.length === 0) {
    return { canMerge: false, reason: '请先选择需要合并生成的生产需求单。', generatableIds }
  }

  const spuCodes = Array.from(new Set(targetDemands.map((demand) => demand.spuCode)))
  if (spuCodes.length > 1) {
    return { canMerge: false, reason: '所选生产需求单不是同一个 SPU，不能合并生成一张生产单。', generatableIds }
  }

  if (generatableIds.size !== targetDemands.length) {
    return { canMerge: false, reason: '所选生产需求单中存在未启用技术包、已生成生产单或非待转单需求，不能合并生成。', generatableIds }
  }

  return { canMerge: true, reason: '', generatableIds }
}

function renderDemandBatchGenerateDialog(): string {
  if (!state.demandBatchDialogOpen) return ''

  const targetDemands = getSelectedBatchTargetDemands()
  const selectedDemandIds = targetDemands.map((demand) => demand.demandId)
  const mergeValidation = getDemandMergeValidation(targetDemands)
  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-demand-generate" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">合并生成生产单</h3>
          <p class="mt-1 text-sm text-muted-foreground">当前列表已选 ${selectedDemandIds.length} 条需求，满足同一 SPU 且均有生效技术包后会合并为 1 张生产单。</p>
        </header>

        <div class="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
          ${
            !mergeValidation.canMerge
              ? `
                <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  ${escapeHtml(mergeValidation.reason)}
                </div>
              `
              : ''
          }
          <section class="rounded-md border">
            <div class="max-h-[200px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="px-3 py-2 text-left">需求编号</th>
                    <th class="px-3 py-2 text-left">SPU</th>
                    <th class="px-3 py-2 text-left">当前生效技术包</th>
                    <th class="px-3 py-2 text-left">生成状态</th>
                    <th class="px-3 py-2 text-right">数量</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    targetDemands.length === 0
                      ? renderEmptyRow(5, '暂无已选需求')
                      : targetDemands
                          .map((demand) => {
                            const info = getTechPackSnapshotForDemand(demand)
                            const generationReason = info.canGenerate
                              ? '可合并生成'
                              : demand.hasProductionOrder
                              ? '已生成生产单'
                              : demand.demandStatus !== 'PENDING_CONVERT'
                              ? demandStatusConfig[demand.demandStatus].label
                              : info.blockReason || '当前不可生成'
                            return `
                              <tr class="border-b last:border-0">
                                <td class="px-3 py-2 font-mono text-sm">${escapeHtml(demand.demandId)}</td>
                                <td class="px-3 py-2 font-mono text-sm">${escapeHtml(demand.spuCode)}</td>
                                <td class="px-3 py-2">
                                  <div class="flex flex-wrap items-center gap-1">
                                    ${renderBadge(
                                      info.displayStatusLabel,
                                      info.displayStatusClassName,
                                    )}
                                    <span class="text-xs text-muted-foreground">${escapeHtml(
                                      info.versionCode || '-',
                                    )}</span>
                                    <span class="text-xs text-muted-foreground">${escapeHtml(
                                      info.versionLabel || '暂无当前生效版本',
                                    )}</span>
                                  </div>
                                </td>
                                <td class="px-3 py-2">
                                  ${
                                    mergeValidation.generatableIds.has(demand.demandId)
                                      ? renderBadge('可生成', 'bg-green-100 text-green-700')
                                      : `<span class="text-xs text-amber-700">${escapeHtml(generationReason)}</span>`
                                  }
                                </td>
                                <td class="px-3 py-2 text-right">${demand.requiredQtyTotal.toLocaleString()}</td>
                              </tr>
                            `
                          })
                          .join('')
                  }
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            mergeValidation.canMerge ? '' : 'pointer-events-none opacity-50'
          }" data-prod-action="open-demand-generate-confirm">确认合并生成</button>
        </footer>
      </section>
    </div>
  `
}

function renderDemandSingleGenerateDialog(singleDemand: ProductionDemand | null): string {
  if (!singleDemand) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-demand-generate" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">生成生产单</h3>
          <p class="mt-1 text-sm text-muted-foreground">为需求 ${escapeHtml(singleDemand.demandId)} (${escapeHtml(singleDemand.spuCode)}) 生成生产单</p>
        </header>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="open-demand-generate-confirm">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderOrdersFromDemandDialog(): string {
  if (!state.ordersFromDemandDialogOpen) return ''

  const demands = listOrdersFromDemandGeneratableDemands()
  const selectedIds = getOrdersFromDemandSelectedIds()
  const selectedAll = demands.length > 0 && demands.every((demand) => state.ordersFromDemandSelectedIds.has(demand.demandId))

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-orders-from-demand" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">从需求生成</h3>
          <p class="mt-1 text-sm text-muted-foreground">仅支持已启用且已发布的当前生效技术包版本生成生产单；可多条需求合并生成一张生产单</p>
        </header>

        <div class="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
          <section class="rounded-md border">
            <div class="max-h-[220px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="w-10 px-3 py-2 text-left">
                      <input type="checkbox" data-prod-action="toggle-orders-demand-select-all" ${selectedAll ? 'checked' : ''} />
                    </th>
                    <th class="px-3 py-2 text-left">需求编号</th>
                    <th class="px-3 py-2 text-left">SPU</th>
                    <th class="px-3 py-2 text-left">当前生效技术包</th>
                    <th class="px-3 py-2 text-right">数量</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    demands.length === 0
                      ? renderEmptyRow(5, '暂无可生成需求')
                      : demands
                          .map((demand) => {
                            const selected = state.ordersFromDemandSelectedIds.has(demand.demandId)
                            const techPack = getTechPackSnapshotForDemand(demand)
                            return `
                              <tr class="border-b last:border-0">
                                <td class="px-3 py-2">
                                  <input type="checkbox" data-prod-action="toggle-orders-demand-select" data-demand-id="${
                                    demand.demandId
                                  }" ${selected ? 'checked' : ''} />
                                </td>
                                <td class="px-3 py-2 font-mono">${escapeHtml(demand.demandId)}</td>
                                <td class="px-3 py-2">
                                  <div class="font-mono text-xs text-muted-foreground">${escapeHtml(demand.spuCode)}</div>
                                  <div class="truncate" title="${escapeHtml(demand.spuName)}">${escapeHtml(demand.spuName)}</div>
                                </td>
                                <td class="px-3 py-2">
                                  <div class="flex flex-wrap items-center gap-1">
                                    ${renderBadge(
                                      techPack.displayStatusLabel,
                                      techPack.displayStatusClassName,
                                    )}
                                    <span class="text-xs text-muted-foreground">${escapeHtml(
                                      techPack.versionCode || '-',
                                    )}</span>
                                    <span class="text-xs text-muted-foreground">${escapeHtml(
                                      techPack.versionLabel || '暂无当前生效版本',
                                    )}</span>
                                  </div>
                                </td>
                                <td class="px-3 py-2 text-right">${demand.requiredQtyTotal.toLocaleString()}</td>
                              </tr>
                            `
                          })
                          .join('')
                  }
                </tbody>
              </table>
            </div>
          </section>

          <p class="text-xs text-muted-foreground">已选 ${selectedIds.length} 条需求，将生成 1 张生产单</p>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-orders-from-demand">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            selectedIds.length === 0 ? 'pointer-events-none opacity-50' : ''
          }" data-prod-action="open-orders-demand-generate-confirm">确认生成</button>
        </footer>
      </section>
    </div>
  `
}

function renderDemandConfirmDialog(): string {
  if (!state.demandGenerateConfirmOpen) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">确认生成</h3>
          <p class="mt-1 text-sm text-muted-foreground">仅已启用且已发布的当前生效技术包版本可生成生产单，未满足时请先在商品中心完成启用。</p>
        </header>
        <footer class="flex items-center justify-end gap-2 px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate-confirm">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-prod-action="confirm-demand-generate">确认</button>
        </footer>
      </div>
    </div>
  `
}

export function renderProductionDemandInboxPage(): string {
  const filteredDemands = getFilteredDemands()
  const selectedVisibleDemandIds = getBatchSelectedDemandIds()
  const selectedAll = filteredDemands.length > 0 && filteredDemands.every((demand) => state.demandSelectedIds.has(demand.demandId))
  const batchMergeValidation = getDemandMergeValidation(getSelectedBatchTargetDemands())
  const demandDetailDrawer = renderDemandDetailDrawer()
  const singleGenerateDemand = getDemandById(state.demandSingleGenerateId)
  const batchGenerateDialog = renderDemandBatchGenerateDialog()
  const singleGenerateDialog = renderDemandSingleGenerateDialog(singleGenerateDemand)
  const confirmDialog = renderDemandConfirmDialog()

  return `
    <div class="space-y-4">
      <header class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">生产需求接收</h1>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <button
              class="relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
                state.demandOnlyUngenerated ? 'border-blue-600 bg-blue-600' : 'bg-muted'
              }"
              data-prod-action="toggle-demand-only-ungenerated"
              aria-pressed="${state.demandOnlyUngenerated ? 'true' : 'false'}"
            >
              <span class="inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${
                state.demandOnlyUngenerated ? 'translate-x-4' : 'translate-x-0.5'
              }"></span>
            </button>
            <span class="text-sm">只看未生成</span>
          </div>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted ${
            selectedVisibleDemandIds.length === 0 ? 'pointer-events-none opacity-50' : ''
          }" data-prod-action="open-demand-batch">
            <i data-lucide="plus" class="mr-1 h-4 w-4"></i>
            合并生成生产单 (${selectedVisibleDemandIds.length})
          </button>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="refresh-demand">
            <i data-lucide="refresh-cw" class="mr-1 h-4 w-4"></i>
            重置
          </button>
        </div>
      </header>

      <section class="grid grid-cols-1 gap-3 md:grid-cols-3">
        ${renderStatCard(
          '待转单',
          state.demands.filter((demand) => demand.demandStatus === 'PENDING_CONVERT').length,
        )}
        ${renderStatCard(
          '已转单',
          state.demands.filter((demand) => demand.demandStatus === 'CONVERTED').length,
        )}
        ${renderStatCard(
          '已挂起',
          state.demands.filter((demand) => demand.demandStatus === 'HOLD').length,
        )}
      </section>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">关键词</span>
            <div class="relative mt-1">
              <i data-lucide="search" class="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"></i>
              <input
                data-prod-field="demandKeyword"
                value="${escapeHtml(state.demandKeyword)}"
                placeholder="需求号/SPU/旧单号"
                class="w-full rounded-md border py-2 pl-8 pr-3 text-sm"
              />
            </div>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">需求状态</span>
            <select data-prod-field="demandStatusFilter" class="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="ALL" ${state.demandStatusFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="PENDING_CONVERT" ${
                state.demandStatusFilter === 'PENDING_CONVERT' ? 'selected' : ''
              }>待转单</option>
              <option value="CONVERTED" ${state.demandStatusFilter === 'CONVERTED' ? 'selected' : ''}>已转单</option>
              <option value="HOLD" ${state.demandStatusFilter === 'HOLD' ? 'selected' : ''}>已挂起</option>
              <option value="CANCELLED" ${state.demandStatusFilter === 'CANCELLED' ? 'selected' : ''}>已取消</option>
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">当前技术包状态</span>
            <select data-prod-field="demandTechPackFilter" class="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="ALL" ${state.demandTechPackFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="INCOMPLETE" ${
                state.demandTechPackFilter === 'INCOMPLETE' ? 'selected' : ''
              }>不可转单</option>
              <option value="RELEASED" ${state.demandTechPackFilter === 'RELEASED' ? 'selected' : ''}>可转单</option>
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">是否已生成</span>
            <select data-prod-field="demandHasOrderFilter" class="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="ALL" ${state.demandHasOrderFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="YES" ${state.demandHasOrderFilter === 'YES' ? 'selected' : ''}>已生成</option>
              <option value="NO" ${state.demandHasOrderFilter === 'NO' ? 'selected' : ''}>未生成</option>
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">优先级</span>
            <select data-prod-field="demandPriorityFilter" class="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="ALL" ${state.demandPriorityFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="URGENT" ${state.demandPriorityFilter === 'URGENT' ? 'selected' : ''}>紧急</option>
              <option value="HIGH" ${state.demandPriorityFilter === 'HIGH' ? 'selected' : ''}>高</option>
              <option value="NORMAL" ${state.demandPriorityFilter === 'NORMAL' ? 'selected' : ''}>普通</option>
            </select>
          </label>
          <div class="flex items-end gap-2">
            <button class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700" data-prod-action="query-demand">查询</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="reset-demand-filters">重置</button>
          </div>
        </div>
      </section>

      ${
        selectedVisibleDemandIds.length > 0
          ? `<p class="text-sm text-muted-foreground">当前列表已选 ${selectedVisibleDemandIds.length} 项，${batchMergeValidation.canMerge ? '符合合并生成条件' : escapeHtml(batchMergeValidation.reason)}</p>`
          : ''
      }

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[1200px] text-sm">
          <thead>
            <tr>
              <th class="w-10 bg-muted/50 px-3 py-3 text-left text-xs text-muted-foreground"><input type="checkbox" data-prod-action="toggle-demand-select-all" ${
                selectedAll ? 'checked' : ''
              } /></th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">需求编号</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">来源单号</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">SPU</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">优先级</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">当前生效技术包</th>
              <th class="bg-muted/50 px-3 py-3 text-right text-xs font-medium text-muted-foreground">数量</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">交付日期</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">生产单</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredDemands.length === 0
                ? `<tr><td colspan="11" class="h-32 px-3 text-center text-muted-foreground">暂无数据</td></tr>`
                : filteredDemands
                    .map((demand) => {
                      const selected = state.demandSelectedIds.has(demand.demandId)
                      const techPack = getTechPackSnapshotForDemand(demand)

                      return `
                        <tr class="border-b last:border-0 ${selected ? 'bg-muted/30' : ''}">
                          <td class="px-3 py-3"><input type="checkbox" data-prod-action="toggle-demand-select" data-demand-id="${
                            demand.demandId
                          }" ${selected ? 'checked' : ''} /></td>
                          <td class="px-3 py-3 font-mono text-sm">${escapeHtml(demand.demandId)}</td>
                          <td class="px-3 py-3 font-mono text-sm">
                            <div class="flex items-center gap-1">
                              <span>${escapeHtml(demand.legacyOrderNo)}</span>
                              <button class="inline-flex h-5 w-5 items-center justify-center rounded opacity-50 hover:bg-muted hover:opacity-100" data-prod-action="copy-demand-legacy" data-legacy-no="${escapeHtml(
                                demand.legacyOrderNo,
                              )}">
                                <i data-lucide="copy" class="h-3 w-3"></i>
                              </button>
                            </div>
                          </td>
                          <td class="px-3 py-3">
                            <p class="font-mono text-xs text-muted-foreground">${escapeHtml(demand.spuCode)}</p>
                            <p class="max-w-[160px] truncate" title="${escapeHtml(demand.spuName)}">${escapeHtml(
                              demand.spuName,
                            )}</p>
                            <p class="mt-1 text-xs text-muted-foreground">买手：${escapeHtml(
                              demand.buyerName,
                            )} · 跟单：${escapeHtml(demand.merchandiserName)}</p>
                          </td>
                          <td class="px-3 py-3">${renderBadge(
                            demandPriorityConfig[demand.priority].label,
                            demandPriorityConfig[demand.priority].className,
                          )}</td>
                          <td class="px-3 py-3">${renderBadge(
                            demandStatusConfig[demand.demandStatus].label,
                            demandStatusConfig[demand.demandStatus].className,
                          )}</td>
                          <td class="px-3 py-3">
                            <div class="space-y-1">
                              <div class="flex items-center gap-1">
                                ${renderBadge(
                                  techPack.displayStatusLabel,
                                  techPack.displayStatusClassName,
                                )}
                                <span class="text-xs text-muted-foreground">${escapeHtml(
                                  techPack.versionCode || '-',
                                )}</span>
                              </div>
                              <div class="text-xs text-muted-foreground">${escapeHtml(
                                techPack.versionLabel || '暂无当前生效版本',
                              )}</div>
                            </div>
                          </td>
                          <td class="px-3 py-3 text-right font-mono">${demand.requiredQtyTotal.toLocaleString()}</td>
                          <td class="px-3 py-3">${escapeHtml(safeText(demand.requiredDeliveryDate))}</td>
                          <td class="px-3 py-3">
                            ${
                              demand.productionOrderId
                                ? `<button class="h-auto p-0 font-mono text-sm text-blue-600 hover:underline" data-prod-action="open-order-detail" data-order-id="${
                                    demand.productionOrderId
                                  }">${escapeHtml(demand.productionOrderId)}</button>`
                                : '<span class="text-muted-foreground">—</span>'
                            }
                          </td>
                          <td class="px-3 py-3">
                            <div class="flex flex-wrap items-center gap-1">
                              ${renderDemandOperations(demand, techPack.status, { allowGenerate: techPack.canGenerate })}
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

      <p class="text-sm text-muted-foreground">共 ${filteredDemands.length} 条记录</p>

      ${demandDetailDrawer}
      ${batchGenerateDialog}
      ${singleGenerateDialog}
      ${confirmDialog}
    </div>
  `
}

function resetDemandGenerateForm(): void {
  state.demandSelectedFactoryId = ''
  state.demandTierFilter = 'ALL'
  state.demandTypeFilter = 'ALL'
  state.demandFactorySearch = ''
  state.demandShowAdvanced = false
  state.demandOwnerPartyManual = false
  state.demandOwnerPartyType = 'FACTORY'
  state.demandOwnerPartyId = ''
  state.demandOwnerReason = ''
}

function openDemandBatchGenerate(): void {
  resetDemandGenerateForm()
  state.demandSelectedIds = new Set(getBatchSelectedDemandIds())
  state.demandBatchDialogOpen = true
  state.demandSingleGenerateId = null
}

function openOrdersFromDemandGenerateDialog(): void {
  resetDemandGenerateForm()
  const ids = listOrdersFromDemandGeneratableDemands().map((item) => item.demandId)
  state.ordersFromDemandSelectedIds = new Set(ids)
  state.ordersFromDemandDialogOpen = true
}

function openDemandSingleGenerate(demandId: string): void {
  resetDemandGenerateForm()
  state.demandSingleGenerateId = demandId
  state.demandBatchDialogOpen = false
}

function performDemandGenerate(): void {
  const demandIds = (() => {
    if (state.demandSingleGenerateId) return [state.demandSingleGenerateId]
    const targetDemands = getSelectedBatchTargetDemands()
    const validation = getDemandMergeValidation(targetDemands)
    return validation.canMerge ? targetDemands.map((demand) => demand.demandId) : []
  })()

  if (demandIds.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const now = toTimestamp()
  const targetDemands = demandIds
    .map((demandId) => state.demands.find((item) => item.demandId === demandId) ?? null)
    .filter((demand): demand is ProductionDemand => {
      if (!demand) return false
      const techPack = getTechPackSnapshotForDemand(demand)
      return !demand.hasProductionOrder && demand.demandStatus === 'PENDING_CONVERT' && techPack.canGenerate
    })

  if (targetDemands.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  let createdOrder: ProductionOrder | null = null
  try {
    createdOrder = buildProductionOrderFromDemands({
      productionOrderId: nextProductionOrderId(state.orders),
      demandId: targetDemands[0].demandId,
      sourceDemandIds: targetDemands.map((demand) => demand.demandId),
      status: 'READY_FOR_BREAKDOWN',
      mainFactoryId: PENDING_MAIN_FACTORY_ID,
      mainFactoryStatus: 'PENDING_SEWING_ASSIGNMENT',
      mainFactorySource: 'SEWING_TASK_ASSIGNMENT',
      ownerPartyType: 'FACTORY',
      ownerPartyId: PENDING_MAIN_FACTORY_ID,
      ownerReason: '待车缝任务分配确认主工厂。',
      assignmentSummary: {
        directCount: 0,
        biddingCount: 0,
        totalTasks: 0,
        unassignedCount: 0,
      },
      assignmentProgress: {
        status: 'NOT_READY',
        directAssignedCount: 0,
        biddingLaunchedCount: 0,
        biddingAwardedCount: 0,
      },
      biddingSummary: {
        activeTenderCount: 0,
        overdueTenderCount: 0,
      },
      directDispatchSummary: {
        assignedFactoryCount: 0,
        rejectedCount: 0,
        overdueAckCount: 0,
      },
      taskBreakdownSummary: {
        isBrokenDown: false,
        taskTypesTop3: [],
      },
      riskFlags: [],
      planStatus: 'UNPLANNED',
      deliveryWarehouseStatus: 'UNSET',
      lifecycleStatus: 'PLANNED',
      lifecycleUpdatedAt: now,
      lifecycleUpdatedBy: currentUser.name,
      auditLogs: [
        {
          id: nextLocalEntityId('LOG'),
          action: 'CREATE',
          detail: `合并需求 ${targetDemands.map((demand) => demand.demandId).join('、')} 生成生产单，主工厂待车缝任务分配确定`,
          at: now,
          by: currentUser.name,
        },
      ],
      createdAt: now,
      updatedAt: now,
      snapshotAt: now,
    }, targetDemands, currentUser.name)
  } catch {
    state.demandGenerateConfirmOpen = false
    return
  }

  if (!createdOrder) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const generatedDemandIds = new Set(targetDemands.map((demand) => demand.demandId))
  state.orders = [...state.orders, createdOrder]
  state.demands = state.demands.map((demand) => {
    if (!generatedDemandIds.has(demand.demandId)) return demand

    return {
      ...demand,
      hasProductionOrder: true,
      productionOrderId: createdOrder.productionOrderId,
      demandStatus: 'CONVERTED',
      updatedAt: now,
    }
  })

  state.demandSelectedIds = new Set()
  state.demandGenerateConfirmOpen = false
  state.demandBatchDialogOpen = false
  state.demandSingleGenerateId = null
  resetDemandGenerateForm()

  openAppRoute(
    `/fcs/production/orders/${createdOrder.productionOrderId}`,
    `po-${createdOrder.productionOrderId}`,
    `生产单管理 ${createdOrder.productionOrderId}`,
  )
}

function performOrdersFromDemandGenerate(): void {
  const demandIds = getOrdersFromDemandSelectedIds()
  if (demandIds.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const now = toTimestamp()
  const targetDemands = demandIds
    .map((demandId) => state.demands.find((item) => item.demandId === demandId) ?? null)
    .filter((demand): demand is ProductionDemand => {
      if (!demand) return false
      const techPack = getTechPackSnapshotForDemand(demand)
      return (
        !demand.hasProductionOrder &&
        demand.productionOrderId === null &&
        demand.demandStatus === 'PENDING_CONVERT' &&
        techPack.canGenerate
      )
    })

  if (targetDemands.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  let createdOrder: ProductionOrder | null = null
  try {
    createdOrder = buildProductionOrderFromDemands({
      productionOrderId: nextProductionOrderId(state.orders),
      demandId: targetDemands[0].demandId,
      sourceDemandIds: targetDemands.map((demand) => demand.demandId),
      status: 'READY_FOR_BREAKDOWN',
      mainFactoryId: PENDING_MAIN_FACTORY_ID,
      mainFactoryStatus: 'PENDING_SEWING_ASSIGNMENT',
      mainFactorySource: 'SEWING_TASK_ASSIGNMENT',
      ownerPartyType: 'FACTORY',
      ownerPartyId: PENDING_MAIN_FACTORY_ID,
      ownerReason: '待车缝任务分配确认主工厂。',
      assignmentSummary: {
        directCount: 0,
        biddingCount: 0,
        totalTasks: 0,
        unassignedCount: 0,
      },
      assignmentProgress: {
        status: 'NOT_READY',
        directAssignedCount: 0,
        biddingLaunchedCount: 0,
        biddingAwardedCount: 0,
      },
      biddingSummary: {
        activeTenderCount: 0,
        overdueTenderCount: 0,
      },
      directDispatchSummary: {
        assignedFactoryCount: 0,
        rejectedCount: 0,
        overdueAckCount: 0,
      },
      taskBreakdownSummary: {
        isBrokenDown: false,
        taskTypesTop3: [],
      },
      riskFlags: [],
      planStatus: 'UNPLANNED',
      deliveryWarehouseStatus: 'UNSET',
      lifecycleStatus: 'PLANNED',
      lifecycleUpdatedAt: now,
      lifecycleUpdatedBy: currentUser.name,
      auditLogs: [
        {
          id: nextLocalEntityId('LOG'),
          action: 'CREATE',
          detail: `合并需求 ${targetDemands.map((demand) => demand.demandId).join('、')} 生成生产单，主工厂待车缝任务分配确定`,
          at: now,
          by: currentUser.name,
        },
      ],
      createdAt: now,
      updatedAt: now,
      snapshotAt: now,
    }, targetDemands, currentUser.name)
  } catch {
    state.demandGenerateConfirmOpen = false
    return
  }

  if (!createdOrder) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const generatedDemandIds = new Set(targetDemands.map((demand) => demand.demandId))
  state.orders = [...state.orders, createdOrder]
  state.demands = state.demands.map((demand) => {
    if (!generatedDemandIds.has(demand.demandId)) return demand
    return {
      ...demand,
      hasProductionOrder: true,
      productionOrderId: createdOrder.productionOrderId,
      demandStatus: 'CONVERTED',
      updatedAt: now,
    }
  })

  state.demandGenerateConfirmOpen = false
  state.ordersFromDemandDialogOpen = false
  state.ordersFromDemandSelectedIds = new Set<string>()
  resetDemandGenerateForm()

  openAppRoute(
    `/fcs/production/orders/${createdOrder.productionOrderId}`,
    `po-${createdOrder.productionOrderId}`,
    `生产单管理 ${createdOrder.productionOrderId}`,
  )
}


export {
  renderDemandDetailDrawer,
  renderDemandBatchGenerateDialog,
  renderDemandSingleGenerateDialog,
  renderOrdersFromDemandDialog,
  renderDemandConfirmDialog,
  resetDemandGenerateForm,
  openDemandBatchGenerate,
  openOrdersFromDemandGenerateDialog,
  openDemandSingleGenerate,
  performDemandGenerate,
  performOrdersFromDemandGenerate,
}
