import {
  escapeHtml,
  indonesiaFactories,
  type ProductionDemand,
  type ProductionOrder,
  type ProductionOrderStatus,
  type AuditLog,
  type RiskFlag,
  type DemandOwnerPartyType,
  type FactoryTier,
  type FactoryType,
  currentUser,
  state,
  renderBadge,
  renderEmptyRow,
  safeText,
  demandTechPackStatusConfig,
  tierLabels,
  typeLabels,
  legalEntities,
  getDemandById,
  getFilteredDemands,
  getBatchGeneratableDemandIds,
  getTechPackSnapshotForDemand,
  renderDemandOperations,
  getDemandFactoryOptions,
  getAvailableDemandTypes,
  listOrdersFromDemandGeneratableDemands,
  getOrdersFromDemandSelectedIds,
  toTimestamp,
  nextLocalEntityId,
  nextProductionOrderId,
  toOrderTechPackStatus,
  normalizeTechPackVersionLabel,
  deriveLifecycleStatus,
  openAppRoute,
  productionOrders,
  renderStatCard,
  demandPriorityConfig,
  demandStatusConfig,
} from './context'

function renderDemandDetailDrawer(): string {
  const demand = getDemandById(state.demandDetailId)
  if (!demand) return ''

  const techPackInfo = getTechPackSnapshotForDemand(demand)
  const detailActions = renderDemandOperations(demand, techPackInfo.status, {
    compact: false,
    techPackAction: 'open-tech-pack-from-demand-detail',
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
            <h4 class="mb-3 font-medium">技术包信息</h4>
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                ${renderBadge(
                  demandTechPackStatusConfig[techPackInfo.status].label,
                  demandTechPackStatusConfig[techPackInfo.status].className,
                )}
                <span class="text-sm">版本: ${escapeHtml(techPackInfo.versionLabel || '-')}</span>
              </div>
              ${
                techPackInfo.missingChecklist.length > 0
                  ? `
                    <div>
                      <p class="text-xs text-muted-foreground">缺失项</p>
                      <div class="mt-1 space-y-1">
                        ${techPackInfo.missingChecklist
                          .map(
                            (item) =>
                              `<div class="flex items-center gap-2 text-sm text-orange-600"><i data-lucide="alert-triangle" class="h-3 w-3"></i><span>${escapeHtml(item)}</span></div>`,
                          )
                          .join('')}
                      </div>
                    </div>
                  `
                  : ''
              }
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

function renderDemandFactorySelectorFields(): string {
  const factories = getDemandFactoryOptions()
  const availableTypes = getAvailableDemandTypes()

  return `
    <div class="space-y-2">
      <p class="text-sm font-medium">选择主工厂 <span class="text-red-500">*</span></p>
      <div class="grid grid-cols-2 gap-2">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">组织层级</span>
          <select data-prod-field="demandTierFilter" class="w-full rounded-md border px-3 py-2 text-sm">
            <option value="ALL" ${state.demandTierFilter === 'ALL' ? 'selected' : ''}>全部层级</option>
            ${(Object.keys(tierLabels) as FactoryTier[])
              .map(
                (tier) =>
                  `<option value="${tier}" ${state.demandTierFilter === tier ? 'selected' : ''}>${escapeHtml(
                    tierLabels[tier],
                  )}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">工厂类型</span>
          <select data-prod-field="demandTypeFilter" class="w-full rounded-md border px-3 py-2 text-sm">
            <option value="ALL" ${state.demandTypeFilter === 'ALL' ? 'selected' : ''}>全部类型</option>
            ${availableTypes
              .map(
                (type) =>
                  `<option value="${type}" ${state.demandTypeFilter === type ? 'selected' : ''}>${escapeHtml(
                    typeLabels[type],
                  )}</option>`,
              )
              .join('')}
          </select>
        </label>
      </div>

      <label class="space-y-1">
        <span class="text-xs text-muted-foreground">搜索工厂</span>
        <div class="relative">
          <i data-lucide="search" class="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input data-prod-field="demandFactorySearch" value="${escapeHtml(
            state.demandFactorySearch,
          )}" class="w-full rounded-md border py-2 pl-8 pr-3 text-sm" placeholder="输入工厂代码或名称搜索" />
        </div>
      </label>

      <select data-prod-field="demandSelectedFactoryId" class="w-full rounded-md border px-3 py-2 text-sm">
        <option value="" ${state.demandSelectedFactoryId ? '' : 'selected'}>请选择主工厂</option>
        ${factories
          .map(
            (factory) =>
              `<option value="${factory.id}" ${
                state.demandSelectedFactoryId === factory.id ? 'selected' : ''
              }>[${escapeHtml(tierLabels[factory.tier])}] ${escapeHtml(factory.code)} - ${escapeHtml(factory.name)}</option>`,
          )
          .join('')}
      </select>
    </div>
  `
}

function renderDemandBatchGenerateDialog(): string {
  if (!state.demandBatchDialogOpen) return ''

  const demandIds = getBatchGeneratableDemandIds()
  const targetDemands = demandIds
    .map((demandId) => state.demands.find((item) => item.demandId === demandId) ?? null)
    .filter((item): item is ProductionDemand => item !== null)
  const ownerPartyTypeValue = state.demandOwnerPartyManual ? state.demandOwnerPartyType : 'FACTORY'

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-prod-action="close-demand-generate" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">批量生成生产单</h3>
          <p class="mt-1 text-sm text-muted-foreground">批量为所选需求生成生产单</p>
        </header>

        <div class="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5">
          <section class="rounded-md border">
            <div class="max-h-[200px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="px-3 py-2 text-left">需求编号</th>
                    <th class="px-3 py-2 text-left">SPU</th>
                    <th class="px-3 py-2 text-left">技术包</th>
                    <th class="px-3 py-2 text-right">数量</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    targetDemands.length === 0
                      ? renderEmptyRow(4, '暂无数据')
                      : targetDemands
                          .map((demand) => {
                            const info = getTechPackSnapshotForDemand(demand)
                            return `
                              <tr class="border-b last:border-0">
                                <td class="px-3 py-2 font-mono text-sm">${escapeHtml(demand.demandId)}</td>
                                <td class="px-3 py-2 font-mono text-sm">${escapeHtml(demand.spuCode)}</td>
                                <td class="px-3 py-2">${renderBadge(
                                  demandTechPackStatusConfig[info.status].label,
                                  demandTechPackStatusConfig[info.status].className,
                                )}</td>
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

          ${renderDemandFactorySelectorFields()}

          <section>
            <button class="rounded-md px-2 py-1 text-xs hover:bg-muted" data-prod-action="toggle-demand-advanced">${
              state.demandShowAdvanced ? '收起高级设置' : '展开高级设置'
            }</button>
            ${
              state.demandShowAdvanced
                ? `
                  <div class="mt-2 space-y-3 rounded border bg-muted/30 p-3">
                    <div class="grid grid-cols-2 gap-3">
                      <label class="space-y-1">
                        <span class="text-xs">货权主体类型</span>
                        <select data-prod-field="demandOwnerPartyType" class="w-full rounded-md border px-3 py-2 text-sm">
                          <option value="FACTORY" ${ownerPartyTypeValue === 'FACTORY' ? 'selected' : ''}>工厂（默认）</option>
                          <option value="LEGAL_ENTITY" ${ownerPartyTypeValue === 'LEGAL_ENTITY' ? 'selected' : ''}>法务主体</option>
                        </select>
                      </label>
                      ${
                        state.demandOwnerPartyManual && state.demandOwnerPartyType === 'LEGAL_ENTITY'
                          ? `
                            <label class="space-y-1">
                              <span class="text-xs">法务主体</span>
                              <select data-prod-field="demandOwnerPartyId" class="w-full rounded-md border px-3 py-2 text-sm">
                                <option value="" ${state.demandOwnerPartyId ? '' : 'selected'}>选择法务主体</option>
                                ${legalEntities
                                  .map(
                                    (entity) =>
                                      `<option value="${entity.id}" ${
                                        state.demandOwnerPartyId === entity.id ? 'selected' : ''
                                      }>${escapeHtml(entity.name)}</option>`,
                                  )
                                  .join('')}
                              </select>
                            </label>
                          `
                          : ''
                      }
                    </div>
                    <label class="space-y-1">
                      <span class="text-xs">变更原因</span>
                      <textarea data-prod-field="demandOwnerReason" rows="2" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="如需变更货权主体，请填写原因">${escapeHtml(
                        state.demandOwnerReason,
                      )}</textarea>
                    </label>
                  </div>
                `
                : ''
            }
          </section>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            !state.demandSelectedFactoryId || targetDemands.length === 0 ? 'pointer-events-none opacity-50' : ''
          }" data-prod-action="open-demand-generate-confirm">确认生成</button>
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

        <div class="space-y-4 px-6 py-5">
          ${renderDemandFactorySelectorFields()}
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-demand-generate">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            !state.demandSelectedFactoryId ? 'pointer-events-none opacity-50' : ''
          }" data-prod-action="open-demand-generate-confirm">确认</button>
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
          <p class="mt-1 text-sm text-muted-foreground">仅支持已发布技术包且状态为待转单的需求</p>
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
                    <th class="px-3 py-2 text-left">技术包</th>
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
                                <td class="px-3 py-2">${renderBadge(
                                  demandTechPackStatusConfig[techPack.status].label,
                                  demandTechPackStatusConfig[techPack.status].className,
                                )}</td>
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

          ${renderDemandFactorySelectorFields()}
          <p class="text-xs text-muted-foreground">已选 ${selectedIds.length} 条需求</p>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-prod-action="close-orders-from-demand">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            selectedIds.length === 0 || !state.demandSelectedFactoryId ? 'pointer-events-none opacity-50' : ''
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
          <p class="mt-1 text-sm text-muted-foreground">仅已发布技术包的需求可生成生产单，待完善技术包请先完善并发布。</p>
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
  const selectedAll = filteredDemands.length > 0 && filteredDemands.every((demand) => state.demandSelectedIds.has(demand.demandId))
  const batchGeneratable = getBatchGeneratableDemandIds()
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
            batchGeneratable.length === 0 ? 'pointer-events-none opacity-50' : ''
          }" data-prod-action="open-demand-batch">
            <i data-lucide="plus" class="mr-1 h-4 w-4"></i>
            批量生成 (${batchGeneratable.length})
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
            <span class="text-xs text-muted-foreground">技术包状态</span>
            <select data-prod-field="demandTechPackFilter" class="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="ALL" ${state.demandTechPackFilter === 'ALL' ? 'selected' : ''}>全部</option>
              <option value="INCOMPLETE" ${
                state.demandTechPackFilter === 'INCOMPLETE' ? 'selected' : ''
              }>待完善</option>
              <option value="RELEASED" ${state.demandTechPackFilter === 'RELEASED' ? 'selected' : ''}>已发布</option>
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
        state.demandSelectedIds.size > 0
          ? `<p class="text-sm text-muted-foreground">已选 ${state.demandSelectedIds.size} 项，可生成 ${batchGeneratable.length} 项</p>`
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
              <th class="bg-muted/50 px-3 py-3 text-left text-xs font-medium text-muted-foreground">技术包</th>
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
                            <div class="flex items-center gap-1">
                              ${renderBadge(
                                demandTechPackStatusConfig[techPack.status].label,
                                demandTechPackStatusConfig[techPack.status].className,
                              )}
                              <span class="text-xs text-muted-foreground">(${escapeHtml(techPack.versionLabel || '-')})</span>
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
                              ${renderDemandOperations(demand, techPack.status)}
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
  const factory = indonesiaFactories.find((item) => item.id === state.demandSelectedFactoryId)
  if (!factory) return

  const demandIds = state.demandSingleGenerateId
    ? [state.demandSingleGenerateId]
    : getBatchGeneratableDemandIds()

  if (demandIds.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const now = toTimestamp()
  const newOrders: ProductionOrder[] = []

  for (const demandId of demandIds) {
    const demand = state.demands.find((item) => item.demandId === demandId)
    if (!demand) continue
    const techPack = getTechPackSnapshotForDemand(demand)
    if (
      demand.hasProductionOrder ||
      demand.demandStatus !== 'PENDING_CONVERT' ||
      techPack.status !== 'RELEASED'
    ) {
      continue
    }

    const orderId = nextProductionOrderId([...state.orders, ...newOrders])
    const initialStatus: ProductionOrderStatus = 'READY_FOR_BREAKDOWN'

    const ownerPartyType: DemandOwnerPartyType = state.demandOwnerPartyManual
      ? state.demandOwnerPartyType
      : 'FACTORY'

    const ownerPartyId =
      state.demandOwnerPartyManual && state.demandOwnerPartyType === 'LEGAL_ENTITY'
        ? state.demandOwnerPartyId
        : factory.id

    const riskFlags: RiskFlag[] = []
    if (ownerPartyType !== 'FACTORY' || ownerPartyId !== factory.id) {
      riskFlags.push('OWNER_ADJUSTED')
    }

    const auditLogs: AuditLog[] = [
      {
        id: nextLocalEntityId('LOG'),
        action: 'CREATE',
        detail: `从需求 ${demand.demandId} 生成生产单`,
        at: now,
        by: currentUser.name,
      },
    ]

    const order: ProductionOrder = {
      productionOrderId: orderId,
      demandId: demand.demandId,
      legacyOrderNo: demand.legacyOrderNo,
      status: initialStatus,
      lockedLegacy: false,
      mainFactoryId: factory.id,
      mainFactorySnapshot: {
        id: factory.id,
        code: factory.code,
        name: factory.name,
        tier: factory.tier,
        type: factory.type,
        status: factory.status,
        province: factory.province,
        city: factory.city,
        tags: [...factory.tags],
      },
      ownerPartyType,
      ownerPartyId: ownerPartyId || factory.id,
      ownerReason: state.demandOwnerReason.trim() || undefined,
      techPackSnapshot: {
        status: toOrderTechPackStatus(techPack.status),
        versionLabel: normalizeTechPackVersionLabel(techPack.status, techPack.versionLabel),
        snapshotAt: now,
      },
      demandSnapshot: {
        demandId: demand.demandId,
        spuCode: demand.spuCode,
        spuName: demand.spuName,
        priority: demand.priority,
        requiredDeliveryDate: demand.requiredDeliveryDate,
        constraintsNote: demand.constraintsNote,
        skuLines: demand.skuLines.map((sku) => ({ ...sku })),
      },
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
      riskFlags,
      planStatus: 'UNPLANNED',
      deliveryWarehouseStatus: 'UNSET',
      lifecycleStatus: deriveLifecycleStatus({
        ...productionOrders[0],
        status: initialStatus,
        lifecycleStatus: undefined,
      }),
      lifecycleUpdatedAt: now,
      lifecycleUpdatedBy: currentUser.name,
      auditLogs,
      createdAt: now,
      updatedAt: now,
    }

    newOrders.push(order)
  }

  if (newOrders.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const generatedMap = new Map(newOrders.map((order) => [order.demandId, order.productionOrderId]))

  state.orders = [...state.orders, ...newOrders]
  state.demands = state.demands.map((demand) => {
    const orderId = generatedMap.get(demand.demandId)
    if (!orderId) return demand

    return {
      ...demand,
      hasProductionOrder: true,
      productionOrderId: orderId,
      demandStatus: 'CONVERTED',
      updatedAt: now,
    }
  })

  state.demandSelectedIds = new Set()
  state.demandGenerateConfirmOpen = false
  state.demandBatchDialogOpen = false
  state.demandSingleGenerateId = null
  resetDemandGenerateForm()

  if (newOrders.length === 1) {
    const created = newOrders[0]
    openAppRoute(
      `/fcs/production/orders/${created.productionOrderId}`,
      `po-${created.productionOrderId}`,
      `生产单管理 ${created.productionOrderId}`,
    )
  }
}

function performOrdersFromDemandGenerate(): void {
  const factory = indonesiaFactories.find((item) => item.id === state.demandSelectedFactoryId)
  if (!factory) return

  const demandIds = getOrdersFromDemandSelectedIds()
  if (demandIds.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const now = toTimestamp()
  const newOrders: ProductionOrder[] = []

  for (const demandId of demandIds) {
    const demand = state.demands.find((item) => item.demandId === demandId)
    if (!demand) continue
    const techPack = getTechPackSnapshotForDemand(demand)
    if (
      demand.hasProductionOrder ||
      demand.productionOrderId !== null ||
      demand.demandStatus !== 'PENDING_CONVERT' ||
      techPack.status !== 'RELEASED'
    ) {
      continue
    }

    const orderId = nextProductionOrderId([...state.orders, ...newOrders])

    const order: ProductionOrder = {
      productionOrderId: orderId,
      demandId: demand.demandId,
      legacyOrderNo: demand.legacyOrderNo,
      status: 'READY_FOR_BREAKDOWN',
      lockedLegacy: false,
      mainFactoryId: factory.id,
      mainFactorySnapshot: {
        id: factory.id,
        code: factory.code,
        name: factory.name,
        tier: factory.tier,
        type: factory.type,
        status: factory.status,
        province: factory.province,
        city: factory.city,
        tags: [...factory.tags],
      },
      ownerPartyType: 'FACTORY',
      ownerPartyId: factory.id,
      techPackSnapshot: {
        status: toOrderTechPackStatus(techPack.status),
        versionLabel: normalizeTechPackVersionLabel(techPack.status, techPack.versionLabel),
        snapshotAt: now,
      },
      demandSnapshot: {
        demandId: demand.demandId,
        spuCode: demand.spuCode,
        spuName: demand.spuName,
        priority: demand.priority,
        requiredDeliveryDate: demand.requiredDeliveryDate,
        constraintsNote: demand.constraintsNote,
        skuLines: demand.skuLines.map((sku) => ({ ...sku })),
      },
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
      lifecycleStatus: deriveLifecycleStatus({
        ...productionOrders[0],
        status: 'READY_FOR_BREAKDOWN',
        lifecycleStatus: undefined,
      }),
      lifecycleUpdatedAt: now,
      lifecycleUpdatedBy: currentUser.name,
      auditLogs: [
        {
          id: nextLocalEntityId('LOG'),
          action: 'CREATE',
          detail: `从需求 ${demand.demandId} 生成生产单`,
          at: now,
          by: currentUser.name,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }

    newOrders.push(order)
  }

  if (newOrders.length === 0) {
    state.demandGenerateConfirmOpen = false
    return
  }

  const generatedMap = new Map(newOrders.map((order) => [order.demandId, order.productionOrderId]))
  state.orders = [...state.orders, ...newOrders]
  state.demands = state.demands.map((demand) => {
    const orderId = generatedMap.get(demand.demandId)
    if (!orderId) return demand
    return {
      ...demand,
      hasProductionOrder: true,
      productionOrderId: orderId,
      demandStatus: 'CONVERTED',
      updatedAt: now,
    }
  })

  state.demandGenerateConfirmOpen = false
  state.ordersFromDemandDialogOpen = false
  state.ordersFromDemandSelectedIds = new Set<string>()
  resetDemandGenerateForm()
}


export {
  renderDemandDetailDrawer,
  renderDemandFactorySelectorFields,
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
