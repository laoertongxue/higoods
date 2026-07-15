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
  getPaginatedDemands,
  getBatchSelectedDemandIds,
  getTechPackSnapshotForDemand,
  renderDemandOperations,
  resolveProductionSpuImageUrl,
  renderProductionImageThumb,
  listOrdersFromDemandGeneratableDemands,
  getOrdersFromDemandSelectedIds,
  listPublishedTechPackVersionOptionsForDemand,
  toTimestamp,
  nextLocalEntityId,
  nextProductionOrderId,
  openAppRoute,
  renderStatCard,
  demandPriorityConfig,
  demandStatusConfig,
  PAGE_SIZE,
} from './context.ts'
import {
  buildProductionOrderFromDemand,
  buildProductionOrderFromDemands,
  PENDING_MAIN_FACTORY_ID,
} from '../../data/fcs/production-orders'
import type {
  DemandPublishedTechPackVersionOption,
} from '../../data/fcs/production-tech-pack-snapshot-builder.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionObjectCodeButton,
  renderProductionOrderIdentityCell,
} from '../../data/fcs/production-order-identity'
import {
  buildFormalProductionOrderProcessSnapshots,
  ensureProcessWorkOrdersForFormalProductionOrder,
} from '../../data/fcs/production-process-work-order-service.ts'

const PRODUCTION_DEMAND_IDENTITY_COLUMN_TITLE = '需求单号 / ID商品采购单单号 / 售卖类型'

function renderDemandCodeButton(demand: ProductionDemand, className = 'font-mono text-blue-600 hover:underline'): string {
  return `<span data-object-type="DEMAND">${renderProductionObjectCodeButton({
      objectType: 'DEMAND',
      objectId: demand.demandId,
      relatedProductionOrderNo: demand.productionOrderId,
      className,
    })}</span>`
}

function renderProductionDemandIdentityCell(demand: ProductionDemand): string {
  return `
    <div class="min-w-[13rem] space-y-2 text-sm leading-5">
      <div>
        <span class="text-xs text-muted-foreground">需求单号</span>
        ${renderDemandCodeButton(demand, 'font-mono font-medium text-blue-600 hover:underline')}
      </div>
      <div>
        <span class="text-xs text-muted-foreground">ID商品采购单单号</span>
        <div class="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          <span>${escapeHtml(demand.legacyOrderNo)}</span>
          <button class="inline-flex h-5 w-5 items-center justify-center rounded opacity-60 hover:bg-muted hover:opacity-100" data-prod-action="copy-demand-legacy" data-legacy-no="${escapeHtml(
            demand.legacyOrderNo,
          )}" aria-label="复制ID商品采购单单号">
            <i data-lucide="copy" class="h-3 w-3"></i>
          </button>
        </div>
      </div>
      <div>
        <span class="text-xs text-muted-foreground">售卖类型</span>
        <div class="text-xs font-medium text-foreground">${escapeHtml(demand.saleType)}</div>
      </div>
    </div>
  `
}

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
              <div class="col-span-2">
                <p class="text-xs text-muted-foreground">SPU信息</p>
                <div class="mt-1">${renderDemandSpuInfo(demand)}</div>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">需求单号</p>
                <p class="font-mono">${renderDemandCodeButton(demand)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">ID商品采购单单号</p>
                <p class="font-mono">${escapeHtml(demand.legacyOrderNo)}</p>
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

function getDemandBatchGenerateValidation(targetDemands: ProductionDemand[]): {
  canGenerate: boolean
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
    return { canGenerate: false, reason: '请先选择需要生成的生产需求单。', generatableIds }
  }

  if (generatableIds.size !== targetDemands.length) {
    return { canGenerate: false, reason: '所选生产需求单中存在未启用技术包、已生成生产单或非待转单需求，不能生成。', generatableIds }
  }

  return { canGenerate: true, reason: '', generatableIds }
}

function getDemandMergeGenerateValidation(targetDemands: ProductionDemand[]): {
  canGenerate: boolean
  reason: string
  generatableIds: Set<string>
} {
  const baseValidation = getDemandBatchGenerateValidation(targetDemands)
  if (!baseValidation.canGenerate) return baseValidation

  if (targetDemands.length < 2) {
    return {
      canGenerate: false,
      reason: '合并生成至少需要选择 2 条可生成的生产需求单。',
      generatableIds: baseValidation.generatableIds,
    }
  }

  const firstSpuCode = targetDemands[0]?.spuCode || ''
  const sameSpu = targetDemands.every((demand) => demand.spuCode === firstSpuCode)
  if (!sameSpu) {
    return {
      canGenerate: false,
      reason: '合并生成只支持同一 SPU 的生产需求单。',
      generatableIds: baseValidation.generatableIds,
    }
  }

  return baseValidation
}

function isDemandMergeGenerateMode(): boolean {
  return state.demandBatchDialogOpen && state.demandBatchGenerateMode === 'merge'
}

function getDemandDialogValidation(targetDemands: ProductionDemand[]) {
  return isDemandMergeGenerateMode()
    ? getDemandMergeGenerateValidation(targetDemands)
    : getDemandBatchGenerateValidation(targetDemands)
}

function getVersionTargetDemandsForCurrentMode(targetDemands: ProductionDemand[]): ProductionDemand[] {
  return isDemandMergeGenerateMode()
    ? targetDemands.slice(0, 1)
    : targetDemands
}

function getOrdersFromDemandSelectedTargetDemands(): ProductionDemand[] {
  return getOrdersFromDemandSelectedIds()
    .map((demandId) => state.demands.find((item) => item.demandId === demandId) ?? null)
    .filter((item): item is ProductionDemand => item !== null)
}

function getCurrentGenerateTargetDemands(): ProductionDemand[] {
  if (state.ordersFromDemandDialogOpen) return getOrdersFromDemandSelectedTargetDemands()
  if (state.demandSingleGenerateId) {
    const demand = getDemandById(state.demandSingleGenerateId)
    return demand ? [demand] : []
  }
  return getSelectedBatchTargetDemands()
}

interface DemandGenerateVersionSelection {
  demand: ProductionDemand
  options: DemandPublishedTechPackVersionOption[]
  selectedOption: DemandPublishedTechPackVersionOption | null
  canGenerate: boolean
  reason: string
}

function syncDemandGenerateTechPackSelections(targetDemands: ProductionDemand[]): DemandGenerateVersionSelection[] {
  return targetDemands.map((demand) => {
    const info = getTechPackSnapshotForDemand(demand)
    const options = listPublishedTechPackVersionOptionsForDemand(demand)
    const selectedId = state.demandGenerateTechPackVersionIds[demand.demandId] || state.demandGenerateTechPackVersionId
    const selected = options.find((option) => option.technicalVersionId === selectedId)
    const fallback = selected || options.find((option) => option.isDefaultVersion) || options[0] || null

    if (fallback) {
      state.demandGenerateTechPackVersionIds = {
        ...state.demandGenerateTechPackVersionIds,
        [demand.demandId]: fallback.technicalVersionId,
      }
    }

    return {
      demand,
      options,
      selectedOption: fallback,
      canGenerate: demand.demandStatus === 'PENDING_CONVERT' && !demand.hasProductionOrder && info.canGenerate,
      reason: demand.hasProductionOrder
        ? '已生成生产单'
        : demand.demandStatus !== 'PENDING_CONVERT'
        ? demandStatusConfig[demand.demandStatus].label
        : info.blockReason || (fallback ? '可生成' : '暂无已发布版本'),
    }
  })
}

function syncDemandGenerateTechPackSelection(targetDemands: ProductionDemand[]): {
  options: DemandPublishedTechPackVersionOption[]
  selectedOption: DemandPublishedTechPackVersionOption | null
} {
  const row = syncDemandGenerateTechPackSelections(targetDemands)[0]
  state.demandGenerateTechPackVersionId = row?.selectedOption?.technicalVersionId || ''
  return { options: row?.options ?? [], selectedOption: row?.selectedOption ?? null }
}

function renderTechPackVersionOptionLabel(option: DemandPublishedTechPackVersionOption): string {
  return [
    option.technicalVersionCode,
    option.versionLabel,
    option.isDefaultVersion ? '默认最新' : '',
    option.isCurrentTechPackVersion ? '当前生效' : '',
  ].filter(Boolean).join(' / ')
}

function renderDemandSpuInfo(demand: ProductionDemand, compact = false): string {
  const imageUrl = resolveProductionSpuImageUrl(demand)
  return `
    <div class="flex min-w-0 items-center gap-3">
      ${renderProductionImageThumb(imageUrl, demand.spuName, compact ? 'h-10 w-10' : 'h-12 w-12')}
      <div class="min-w-0">
        <div class="text-xs">${renderProductionObjectCodeButton({
          objectType: 'DEMAND',
          objectId: demand.demandId,
          label: demand.spuCode,
          relatedProductionOrderNo: demand.productionOrderId,
          className: 'font-mono text-blue-600 hover:underline',
        })}</div>
        <div class="truncate font-medium" title="${escapeHtml(demand.spuName)}">${escapeHtml(demand.spuName)}</div>
        <div class="mt-0.5 truncate text-xs text-muted-foreground">买手：${escapeHtml(demand.buyerName)} · 跟单：${escapeHtml(demand.merchandiserName)}</div>
      </div>
    </div>
  `
}

function renderDemandVersionSelect(selection: DemandGenerateVersionSelection): string {
  const selectedId = state.demandGenerateTechPackVersionIds[selection.demand.demandId] || selection.selectedOption?.technicalVersionId || ''
  return `
    <select data-prod-field="demandGenerateTechPackVersion:${escapeHtml(selection.demand.demandId)}" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
      ${selection.options
        .map((option) => `
          <option value="${escapeHtml(option.technicalVersionId)}" ${option.technicalVersionId === selectedId ? 'selected' : ''}>
            ${escapeHtml(renderTechPackVersionOptionLabel(option))}
          </option>
        `)
        .join('')}
    </select>
  `
}

function renderDemandGenerateTechPackVersionSelector(targetDemands: ProductionDemand[]): string {
  const selections = syncDemandGenerateTechPackSelections(targetDemands)
  if (selections.length === 0 || selections.every((selection) => selection.options.length === 0)) {
    return `
      <section class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        当前选择的需求没有可用于生成生产单的已发布技术包版本。
      </section>
    `
  }

  if (selections.length === 1) {
    const selection = selections[0]
    return `
      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h4 class="text-sm font-medium">技术包版本</h4>
          ${renderBadge(selection.selectedOption?.isDefaultVersion ? '默认最新' : '手动选择', selection.selectedOption?.isDefaultVersion ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700')}
        </div>
        ${renderDemandVersionSelect(selection)}
      </section>
    `
  }

  return `
    <section class="space-y-3">
      <h4 class="text-sm font-medium">技术包版本</h4>
      <div class="overflow-hidden rounded-md border">
        <div class="max-h-[280px] overflow-auto">
          <table class="w-full min-w-[620px] text-sm">
            <thead class="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">生产需求 / SPU</th>
                <th class="px-3 py-2 text-left font-medium">生成技术包版本</th>
                <th class="px-3 py-2 text-left font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              ${selections
                .map((selection) => `
                  <tr class="border-b last:border-0 align-top">
                    <td class="px-3 py-2">
                      <div class="font-mono text-xs text-muted-foreground">${renderDemandCodeButton(selection.demand)}</div>
                      ${renderDemandSpuInfo(selection.demand, true)}
                    </td>
                    <td class="px-3 py-2">${selection.options.length > 0 ? renderDemandVersionSelect(selection) : '<span class="text-xs text-amber-700">暂无已发布版本</span>'}</td>
                    <td class="px-3 py-2">
                      ${
                        selection.canGenerate && selection.selectedOption
                          ? renderBadge('可生成', 'bg-green-100 text-green-700')
                          : `<span class="text-xs text-amber-700">${escapeHtml(selection.reason)}</span>`
                      }
                    </td>
                  </tr>
                `)
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `
}

function renderDemandBatchGenerateDialog(): string {
  if (!state.demandBatchDialogOpen) return ''

  const isMergeMode = isDemandMergeGenerateMode()
  const targetDemands = getSelectedBatchTargetDemands()
  const selectedDemandIds = targetDemands.map((demand) => demand.demandId)
  const batchValidation = getDemandDialogValidation(targetDemands)
  const versionTargetDemands = getVersionTargetDemandsForCurrentMode(targetDemands)
  const versionSelections = syncDemandGenerateTechPackSelections(versionTargetDemands)
  const canConfirm =
    batchValidation.canGenerate &&
    versionSelections.length > 0 &&
    versionSelections.every((selection) => selection.canGenerate && Boolean(selection.selectedOption))
  const title = isMergeMode ? '合并生成生产单' : '批量生成生产单'
  const description = isMergeMode
    ? `当前列表已选 ${selectedDemandIds.length} 条同 SPU 需求，将合并生成 1 张生产单，生成后需手动拆解任务。`
    : `当前列表已选 ${selectedDemandIds.length} 条需求，将分别生成 ${selectedDemandIds.length} 张生产单，生成后需手动拆解任务。`
  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-demand-generate" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${title}</h3>
          <p class="mt-1 text-sm text-muted-foreground">${description}</p>
        </header>

        <div class="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
          ${
            !batchValidation.canGenerate
              ? `
                <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  ${escapeHtml(batchValidation.reason)}
                </div>
              `
              : ''
          }
          <section class="rounded-md border">
            <div class="max-h-[200px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="px-3 py-2 text-left">需求单号</th>
                    <th class="px-3 py-2 text-left">SPU信息</th>
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
                              ? '可生成'
                              : demand.hasProductionOrder
                              ? '已生成生产单'
                              : demand.demandStatus !== 'PENDING_CONVERT'
                              ? demandStatusConfig[demand.demandStatus].label
                              : info.blockReason || '当前不可生成'
                            return `
                              <tr class="border-b last:border-0">
                                <td class="px-3 py-2 font-mono text-sm">${renderDemandCodeButton(demand)}</td>
                                <td class="px-3 py-2">${renderDemandSpuInfo(demand, true)}</td>
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
                                    batchValidation.generatableIds.has(demand.demandId)
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
          ${renderDemandGenerateTechPackVersionSelector(versionTargetDemands)}
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            canConfirm ? '' : 'pointer-events-none opacity-50'
          }" data-prod-action="open-demand-generate-confirm">确认${isMergeMode ? '合并生成' : '批量生成'}</button>
        </footer>
      </section>
      <div data-production-demand-confirm-root="true">${renderDemandConfirmDialog()}</div>
    </div>
  `
}

function renderDemandSingleGenerateDialog(singleDemand: ProductionDemand | null): string {
  if (!singleDemand) return ''
  const versionSelection = syncDemandGenerateTechPackSelection([singleDemand])

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-demand-generate" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">生成生产单</h3>
          <p class="mt-1 text-sm text-muted-foreground">为需求 ${renderDemandCodeButton(singleDemand)} (${escapeHtml(singleDemand.spuCode)}) 生成生产单，生成后需手动拆解任务。</p>
        </header>
        <div class="px-6 py-5">
          ${renderDemandGenerateTechPackVersionSelector([singleDemand])}
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            versionSelection.selectedOption ? '' : 'pointer-events-none opacity-50'
          }" data-prod-action="open-demand-generate-confirm">确认</button>
        </footer>
      </section>
      <div data-production-demand-confirm-root="true">${renderDemandConfirmDialog()}</div>
    </div>
  `
}

function renderOrdersFromDemandDialog(): string {
  if (!state.ordersFromDemandDialogOpen) return ''

  const demands = listOrdersFromDemandGeneratableDemands()
  const selectedIds = getOrdersFromDemandSelectedIds()
  const selectedAll = demands.length > 0 && demands.every((demand) => state.ordersFromDemandSelectedIds.has(demand.demandId))
  const selectedTargetDemands = getOrdersFromDemandSelectedTargetDemands()
  const batchValidation = getDemandBatchGenerateValidation(selectedTargetDemands)
  const versionSelections = syncDemandGenerateTechPackSelections(selectedTargetDemands)
  const canConfirm =
    batchValidation.canGenerate &&
    versionSelections.length > 0 &&
    versionSelections.every((selection) => selection.canGenerate && Boolean(selection.selectedOption))

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-orders-from-demand" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">从需求批量生成</h3>
          <p class="mt-1 text-sm text-muted-foreground">每条需求将生成独立生产单，生成后不自动拆解任务。</p>
        </header>

        <div class="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
          ${
            selectedIds.length > 0 && !batchValidation.canGenerate
              ? `
                <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  ${escapeHtml(batchValidation.reason)}
                </div>
              `
              : ''
          }
          <section class="rounded-md border">
            <div class="max-h-[220px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="w-10 px-3 py-2 text-left">
                      <input type="checkbox" data-prod-action="toggle-orders-demand-select-all" ${selectedAll ? 'checked' : ''} />
                    </th>
                    <th class="px-3 py-2 text-left">需求单号</th>
                    <th class="px-3 py-2 text-left">SPU信息</th>
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
                                <td class="px-3 py-2 font-mono">${renderDemandCodeButton(demand)}</td>
                                <td class="px-3 py-2">${renderDemandSpuInfo(demand, true)}</td>
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

          ${selectedIds.length > 0 ? renderDemandGenerateTechPackVersionSelector(selectedTargetDemands) : ''}
          <p class="text-xs text-muted-foreground">已选 ${selectedIds.length} 条需求，将生成 ${selectedIds.length} 张生产单</p>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-orders-from-demand">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            canConfirm ? '' : 'pointer-events-none opacity-50'
          }" data-prod-action="open-orders-demand-generate-confirm">确认生成</button>
        </footer>
      </section>
    </div>
  `
}

function renderDemandConfirmDialog(): string {
  if (!state.demandGenerateConfirmOpen) return ''
  const targetDemands = getCurrentGenerateTargetDemands()
  const isMergeMode = isDemandMergeGenerateMode()
  const versionTargetDemands = getVersionTargetDemandsForCurrentMode(targetDemands)
  const selections = syncDemandGenerateTechPackSelections(versionTargetDemands)
  const canConfirm = selections.length > 0 && selections.every((selection) => selection.canGenerate && Boolean(selection.selectedOption))
  const versionSummary = selections
    .slice(0, 4)
    .map((selection) =>
      `${selection.demand.demandId}：${selection.selectedOption ? renderTechPackVersionOptionLabel(selection.selectedOption) : '未选择可用版本'}`,
    )
    .join('；')
  const overflowCount = Math.max(0, selections.length - 4)

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <div class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">确认生成</h3>
          <p class="mt-1 text-sm text-muted-foreground">将按所选已发布技术包版本生成生产单，并固化为生产单技术包快照。</p>
          <div class="mt-3 rounded-md bg-muted px-3 py-2 text-sm">
            <p>需求数量：${targetDemands.length} 条</p>
            <p>生成数量：${isMergeMode ? 1 : targetDemands.length} 张生产单</p>
            ${isMergeMode ? '<p class="text-xs text-muted-foreground">合并模式：所选需求将共用同一生产单和同一技术包快照。</p>' : ''}
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(versionSummary || '未选择可用版本')}${overflowCount > 0 ? `；另 ${overflowCount} 条` : ''}</p>
          </div>
        </header>
        <footer class="flex items-center justify-end gap-2 px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate-confirm">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            canConfirm ? '' : 'pointer-events-none opacity-50'
          }" data-prod-action="confirm-demand-generate">确认</button>
        </footer>
      </div>
    </div>
  `
}

function renderProductionDemandOverlays(): string {
  const singleGenerateDemand = getDemandById(state.demandSingleGenerateId)
  return `
    ${renderDemandDetailDrawer()}
    ${renderDemandBatchGenerateDialog()}
    ${renderDemandSingleGenerateDialog(singleGenerateDemand)}
  `
}

export function renderProductionDemandInboxPage(): string {
  const filteredDemands = getFilteredDemands()
  const totalPages = Math.max(1, Math.ceil(filteredDemands.length / PAGE_SIZE))
  if (state.demandCurrentPage > totalPages) {
    state.demandCurrentPage = totalPages
  }
  const pagedDemands = getPaginatedDemands(filteredDemands)
  const selectedVisibleDemandIds = getBatchSelectedDemandIds()
  const selectedAll = pagedDemands.length > 0 && pagedDemands.every((demand) => state.demandSelectedIds.has(demand.demandId))
  const batchGenerateValidation = getDemandBatchGenerateValidation(getSelectedBatchTargetDemands())
  return `
    <div class="space-y-4">
      <header class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">生产需求单</h1>
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
            批量生成生产单 (${selectedVisibleDemandIds.length})
          </button>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted ${
            selectedVisibleDemandIds.length === 0 ? 'pointer-events-none opacity-50' : ''
          }" data-prod-action="open-demand-merge">
            <i data-lucide="combine" class="mr-1 h-4 w-4"></i>
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
                placeholder="需求单号/ID商品采购单单号/售卖类型/SPU"
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
          ? `<p class="text-sm text-muted-foreground">当前列表已选 ${selectedVisibleDemandIds.length} 项，批量生成会生成 ${selectedVisibleDemandIds.length} 张生产单；合并生成需选择同一 SPU，确认后生成 1 张生产单。${batchGenerateValidation.canGenerate ? '' : ` ${escapeHtml(batchGenerateValidation.reason)}`}</p>`
          : ''
      }

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[1200px] text-sm">
          <thead>
            <tr>
              <th class="w-10 bg-muted/50 px-3 py-3 text-left text-xs text-muted-foreground"><input type="checkbox" data-prod-action="toggle-demand-select-all" ${
                selectedAll ? 'checked' : ''
              } /></th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">${PRODUCTION_DEMAND_IDENTITY_COLUMN_TITLE}</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">SPU</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">优先级</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">当前生效技术包</th>
              <th class="bg-muted/50 px-3 py-3 text-right text-xs font-medium text-muted-foreground">数量</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">交付日期</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              pagedDemands.length === 0
                ? `<tr><td colspan="10" class="h-32 px-3 text-center text-muted-foreground">暂无数据</td></tr>`
                : pagedDemands
                    .map((demand) => {
                      const selected = state.demandSelectedIds.has(demand.demandId)
                      const techPack = getTechPackSnapshotForDemand(demand)

                      return `
                        <tr class="border-b last:border-0 ${selected ? 'bg-muted/30' : ''}">
                          <td class="px-3 py-3"><input type="checkbox" data-prod-action="toggle-demand-select" data-demand-id="${
                            demand.demandId
                          }" ${selected ? 'checked' : ''} /></td>
                          <td class="px-3 py-3">${renderProductionDemandIdentityCell(demand)}</td>
                          <td class="px-3 py-3">${renderDemandSpuInfo(demand)}</td>
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
                                ? `<div class="cursor-pointer hover:underline" data-prod-action="open-order-detail" data-order-id="${
                                    demand.productionOrderId
                                  }">${renderProductionOrderIdentityCell({ productionOrderNo: demand.productionOrderId, demandNo: demand.demandId, saleType: demand.saleType })}</div>`
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

      <footer class="flex items-center justify-between text-sm">
        <p class="text-muted-foreground">共 ${filteredDemands.length} 条记录${
          state.demandSelectedIds.size > 0 ? `，已选 ${state.demandSelectedIds.size} 项` : ''
        }</p>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border ${
            state.demandCurrentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'
          }" data-prod-action="demand-prev-page" aria-label="上一页">
            <i data-lucide="chevron-left" class="h-4 w-4"></i>
          </button>
          <span>${state.demandCurrentPage} / ${totalPages || 1}</span>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border ${
            state.demandCurrentPage >= totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'
          }" data-prod-action="demand-next-page" aria-label="下一页">
            <i data-lucide="chevron-right" class="h-4 w-4"></i>
          </button>
        </div>
      </footer>

      <div data-production-demand-overlay-root="true">${renderProductionDemandOverlays()}</div>
    </div>
  `
}

function resetDemandGenerateForm(): void {
  state.demandGenerateTechPackVersionId = ''
  state.demandGenerateTechPackVersionIds = {}
  state.demandBatchGenerateMode = 'batch'
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

function openDemandBatchGenerate(mode: 'batch' | 'merge' = 'batch'): void {
  resetDemandGenerateForm()
  state.demandBatchGenerateMode = mode
  state.demandSelectedIds = new Set(getBatchSelectedDemandIds())
  state.demandBatchDialogOpen = true
  state.demandSingleGenerateId = null
  const targetDemands = getSelectedBatchTargetDemands()
  syncDemandGenerateTechPackSelection(mode === 'merge' ? targetDemands.slice(0, 1) : targetDemands)
}

function openDemandMergeGenerate(): void {
  openDemandBatchGenerate('merge')
}

function openOrdersFromDemandGenerateDialog(): void {
  resetDemandGenerateForm()
  const ids = listOrdersFromDemandGeneratableDemands().map((item) => item.demandId)
  state.ordersFromDemandSelectedIds = new Set(ids)
  state.ordersFromDemandDialogOpen = true
  syncDemandGenerateTechPackSelection(getOrdersFromDemandSelectedTargetDemands())
}

function openDemandSingleGenerate(demandId: string): void {
  resetDemandGenerateForm()
  state.demandBatchGenerateMode = 'batch'
  state.demandSingleGenerateId = demandId
  state.demandBatchDialogOpen = false
  const demand = getDemandById(demandId)
  syncDemandGenerateTechPackSelection(demand ? [demand] : [])
}

function createProductionOrdersForDemands(
  targetDemands: ProductionDemand[],
  now: string,
): Array<{ demand: ProductionDemand; order: ProductionOrder }> {
  const selections = new Map(
    syncDemandGenerateTechPackSelections(targetDemands).map((selection) => [selection.demand.demandId, selection]),
  )
  const created: Array<{ demand: ProductionDemand; order: ProductionOrder }> = []

  for (const demand of targetDemands) {
    const selection = selections.get(demand.demandId)
    if (!selection?.canGenerate || !selection.selectedOption) continue

    const productionOrderId = nextProductionOrderId([
      ...state.orders,
      ...created.map((item) => item.order),
    ])
    const createdOrder = buildProductionOrderFromDemand({
      productionOrderId,
      demandId: demand.demandId,
      sourceDemandIds: [demand.demandId],
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
      auditLogs: [
        {
          id: nextLocalEntityId('LOG'),
          action: 'CREATE',
          detail: `从需求 ${demand.demandId} 生成生产单，待手动拆解任务，主工厂待车缝任务分配确定；技术包版本 ${selection.selectedOption.technicalVersionCode} ${selection.selectedOption.versionLabel}`,
          at: now,
          by: currentUser.name,
        },
      ],
      createdAt: now,
      updatedAt: now,
      snapshotAt: now,
      selectedTechPackVersionId: selection.selectedOption.technicalVersionId,
    }, demand, currentUser.name)

    created.push({ demand, order: createdOrder })
  }

  return created
}

type CreatedProductionOrderGroup = {
  demands: ProductionDemand[]
  order: ProductionOrder
}

function toCreatedProductionOrderGroups(created: Array<{ demand: ProductionDemand; order: ProductionOrder }>): CreatedProductionOrderGroup[] {
  return created.map((item) => ({ demands: [item.demand], order: item.order }))
}

function createMergedProductionOrderForDemands(
  targetDemands: ProductionDemand[],
  now: string,
): CreatedProductionOrderGroup | null {
  const validation = getDemandMergeGenerateValidation(targetDemands)
  if (!validation.canGenerate) return null

  const primaryDemand = targetDemands[0]
  const selection = syncDemandGenerateTechPackSelections([primaryDemand])[0]
  if (!selection?.canGenerate || !selection.selectedOption) return null

  const productionOrderId = nextProductionOrderId(state.orders)
  const createdOrder = buildProductionOrderFromDemands({
    productionOrderId,
    demandId: primaryDemand.demandId,
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
    auditLogs: [
      {
        id: nextLocalEntityId('LOG'),
        action: 'CREATE',
        detail: `合并需求 ${targetDemands.map((demand) => demand.demandId).join('、')} 生成生产单，待手动拆解任务，主工厂待车缝任务分配确定；技术包版本 ${selection.selectedOption.technicalVersionCode} ${selection.selectedOption.versionLabel}`,
        at: now,
        by: currentUser.name,
      },
    ],
    createdAt: now,
    updatedAt: now,
    snapshotAt: now,
    selectedTechPackVersionId: selection.selectedOption.technicalVersionId,
  }, targetDemands, currentUser.name)

  return { demands: targetDemands, order: createdOrder }
}

function closeDemandGenerateFlow(): void {
  state.demandGenerateConfirmOpen = false
  state.demandBatchDialogOpen = false
  state.demandSingleGenerateId = null
  state.ordersFromDemandDialogOpen = false
  state.ordersFromDemandSelectedIds = new Set<string>()
  state.demandSelectedIds = new Set<string>()
  resetDemandGenerateForm()
}

function applyCreatedProductionOrderGroups(created: CreatedProductionOrderGroup[], now: string): void {
  if (created.length === 0) return

  const orderIdByDemandId = new Map<string, string>()
  for (const item of created) {
    for (const demand of item.demands) {
      orderIdByDemandId.set(demand.demandId, item.order.productionOrderId)
    }
  }
  state.orders = [...state.orders, ...created.map((item) => item.order)]
  for (const item of created) {
    for (const snapshot of buildFormalProductionOrderProcessSnapshots(item.order)) {
      ensureProcessWorkOrdersForFormalProductionOrder(snapshot)
    }
  }
  state.demands = state.demands.map((demand) => {
    const productionOrderId = orderIdByDemandId.get(demand.demandId)
    if (!productionOrderId) return demand
    return {
      ...demand,
      hasProductionOrder: true,
      productionOrderId,
      demandStatus: 'CONVERTED',
      updatedAt: now,
    }
  })
}

function openCreatedProductionOrders(created: CreatedProductionOrderGroup[]): void {
  if (created.length === 1) {
    const createdOrder = created[0].order
    openAppRoute(
      `/fcs/production/orders/${createdOrder.productionOrderId}`,
      `po-${createdOrder.productionOrderId}`,
      `生产单管理 ${createdOrder.productionOrderId}`,
    )
    return
  }

  openAppRoute('/fcs/production/orders', 'fcs-production-orders', '生产单管理')
}

function getValidatedGenerateTargetDemands(targetDemands: ProductionDemand[]): ProductionDemand[] {
  const validation = getDemandBatchGenerateValidation(targetDemands)
  if (!validation.canGenerate) return []
  return targetDemands.filter((demand) => validation.generatableIds.has(demand.demandId))
}

function performDemandGenerate(): void {
  const targetDemands = state.demandSingleGenerateId
    ? [getDemandById(state.demandSingleGenerateId)].filter((demand): demand is ProductionDemand => Boolean(demand))
    : getSelectedBatchTargetDemands()
  const mergeValidation = state.demandBatchGenerateMode === 'merge' && !state.demandSingleGenerateId
    ? getDemandMergeGenerateValidation(targetDemands)
    : null
  if (mergeValidation && !mergeValidation.canGenerate) {
    state.demandGenerateConfirmOpen = false
    return
  }
  const validatedDemands = mergeValidation
    ? targetDemands.filter((demand) => mergeValidation.generatableIds.has(demand.demandId))
    : getValidatedGenerateTargetDemands(targetDemands)
  if (validatedDemands.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const now = toTimestamp()
  const created = state.demandBatchGenerateMode === 'merge' && !state.demandSingleGenerateId
    ? [createMergedProductionOrderForDemands(validatedDemands, now)].filter((item): item is CreatedProductionOrderGroup => Boolean(item))
    : toCreatedProductionOrderGroups(createProductionOrdersForDemands(validatedDemands, now))
  if (created.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  applyCreatedProductionOrderGroups(created, now)
  closeDemandGenerateFlow()
  openCreatedProductionOrders(created)
}

function performOrdersFromDemandGenerate(): void {
  const demandIds = getOrdersFromDemandSelectedIds()
  const targetDemands = demandIds
    .map((demandId) => state.demands.find((item) => item.demandId === demandId) ?? null)
    .filter((demand): demand is ProductionDemand => Boolean(demand))
  const validatedDemands = getValidatedGenerateTargetDemands(targetDemands)
  if (validatedDemands.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const now = toTimestamp()
  const created = toCreatedProductionOrderGroups(createProductionOrdersForDemands(validatedDemands, now))
  if (created.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  applyCreatedProductionOrderGroups(created, now)
  closeDemandGenerateFlow()
  openCreatedProductionOrders(created)
}


export {
  renderDemandDetailDrawer,
  renderDemandBatchGenerateDialog,
  renderDemandSingleGenerateDialog,
  renderOrdersFromDemandDialog,
  renderDemandConfirmDialog,
  renderProductionDemandOverlays,
  resetDemandGenerateForm,
  openDemandBatchGenerate,
  openDemandMergeGenerate,
  openOrdersFromDemandGenerateDialog,
  openDemandSingleGenerate,
  performDemandGenerate,
  performOrdersFromDemandGenerate,
}
