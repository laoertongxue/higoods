import {
  state,
  currentUser,
  closeAllProductionDialogs,
  showPlanMessage,
  toTimestamp,
  nextLocalEntityId,
  type ProductionDemand,
  type ProductionOrder,
  type ProductionOrderStatus,
  type ProductionChangeType,
  type ProductionChangeStatus,
  type ProductionOrderChange,
  type ProductionState,
  type FactoryTier,
  type FactoryType,
  type DemandOwnerPartyType,
  type AssignmentModeFilter,
  type BiddingRiskFilter,
  type LifecycleStatus,
  type OrderViewMode,
  type OrderDetailTab,
  type MaterialMode,
  type AuditLog,
  productionOrderStatusConfig,
  changeAllowedNext,
  lifecycleAllowedNext,
  getFilteredDemands,
  listOrdersFromDemandGeneratableDemands,
  getFilteredOrders,
  getPaginatedOrders,
  getPlanFactoryOptions,
  deriveLifecycleStatus,
  getOrderById,
  openAppRoute,
  indonesiaFactories,
  PAGE_SIZE,
  PLAN_EMPTY_FORM,
  DELIVERY_EMPTY_FORM,
  CHANGE_CREATE_EMPTY_FORM,
  CHANGE_STATUS_EMPTY_FORM,
  nextChangeId,
  addMaterialToDraft,
  restoreMaterialDraftSuggestion,
  confirmMaterialRequestDraft,
  setMaterialDraftNeedMaterial,
  toggleMaterialDraftLine,
  setMaterialDraftMode,
  setMaterialDraftRemark,
  setMaterialDraftLineConfirmedQty,
} from './context'
import { getDemandCurrentTechPackInfo } from '../../data/fcs/production-tech-pack-snapshot-builder.ts'
import {
  openDemandBatchGenerate,
  openDemandSingleGenerate,
  openOrdersFromDemandGenerateDialog,
  performDemandGenerate,
  performOrdersFromDemandGenerate,
} from './demand-domain'

function openCurrentTechPackEntry(spuCode: string): void {
  const info = getDemandCurrentTechPackInfo({ spuCode })
  const deferOpenAppRoute = (pathname: string, key?: string, title?: string): void => {
    window.setTimeout(() => {
      openAppRoute(pathname, key, title)
    }, 0)
  }

  if (info.styleId && info.currentTechPackVersionId) {
    deferOpenAppRoute(
      `/pcs/products/styles/${encodeURIComponent(info.styleId)}/technical-data/${encodeURIComponent(info.currentTechPackVersionId)}`,
      `pcs-tech-pack-${info.currentTechPackVersionId}`,
      `技术包版本 ${info.currentTechPackVersionCode || spuCode}`,
    )
    return
  }

  if (info.styleId) {
    deferOpenAppRoute(
      `/pcs/products/styles/${encodeURIComponent(info.styleId)}?tab=technical`,
      `pcs-style-${info.styleId}`,
      `款式档案 ${info.styleCode || spuCode}`,
    )
    return
  }

  deferOpenAppRoute('/pcs/products/styles', 'pcs-style-archives', '款式档案')
}

function openOrderTechPackSnapshot(productionOrderId: string): void {
  openAppRoute(
    `/fcs/production/orders/${encodeURIComponent(productionOrderId)}/tech-pack`,
    `order-tech-pack-${productionOrderId}`,
    `技术包快照 ${productionOrderId}`,
  )
}

function updateProductionField(
  field: string,
  node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): void {
  const value = node.value
  const checked = node instanceof HTMLInputElement ? node.checked : false

  if (field.startsWith('materialDraftMode:')) {
    const [, draftId] = field.split(':')
    if (draftId && (value === 'warehouse_delivery' || value === 'factory_pickup')) {
      setMaterialDraftMode(draftId, value as MaterialMode, currentUser.name)
    }
    return
  }

  if (field.startsWith('materialDraftRemark:')) {
    const [, draftId] = field.split(':')
    if (draftId) {
      setMaterialDraftRemark(draftId, value, currentUser.name)
    }
    return
  }

  if (field.startsWith('materialDraftLineQty:')) {
    const [, draftId, lineId] = field.split(':')
    if (draftId && lineId) {
      const qty = Number(value)
      setMaterialDraftLineConfirmedQty(draftId, lineId, Number.isFinite(qty) ? qty : 0, currentUser.name)
    }
    return
  }

  if (field === 'demandKeyword') {
    state.demandKeyword = value
    return
  }

  if (field === 'demandStatusFilter') {
    state.demandStatusFilter = value as ProductionDemand['demandStatus'] | 'ALL'
    return
  }

  if (field === 'demandTechPackFilter') {
    state.demandTechPackFilter = value as ProductionDemand['techPackStatus'] | 'ALL'
    return
  }

  if (field === 'demandHasOrderFilter') {
    state.demandHasOrderFilter = value as 'ALL' | 'YES' | 'NO'
    return
  }

  if (field === 'demandPriorityFilter') {
    state.demandPriorityFilter = value as ProductionDemand['priority'] | 'ALL'
    return
  }

  if (field === 'demandOnlyUngenerated') {
    state.demandOnlyUngenerated = checked
    return
  }

  if (field === 'demandTierFilter') {
    state.demandTierFilter = value as FactoryTier | 'ALL'
    state.demandTypeFilter = 'ALL'
    state.demandSelectedFactoryId = ''
    return
  }

  if (field === 'demandTypeFilter') {
    state.demandTypeFilter = value as FactoryType | 'ALL'
    state.demandSelectedFactoryId = ''
    return
  }

  if (field === 'demandFactorySearch') {
    state.demandFactorySearch = value
    return
  }

  if (field === 'demandSelectedFactoryId') {
    state.demandSelectedFactoryId = value
    return
  }

  if (field === 'demandOwnerPartyManual') {
    state.demandOwnerPartyManual = checked
    return
  }

  if (field === 'demandOwnerPartyType') {
    state.demandOwnerPartyManual = true
    state.demandOwnerPartyType = value as DemandOwnerPartyType
    return
  }

  if (field === 'demandOwnerPartyId') {
    state.demandOwnerPartyId = value
    return
  }

  if (field === 'demandOwnerReason') {
    state.demandOwnerReason = value
    return
  }

  if (field === 'ordersKeyword') {
    state.ordersKeyword = value
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersStatusFilter') {
    state.ordersStatusFilter = value === 'ALL' ? [] : [value as ProductionOrderStatus]
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersTechPackFilter') {
    state.ordersTechPackFilter = value as ProductionState['ordersTechPackFilter']
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersBreakdownFilter') {
    state.ordersBreakdownFilter = value as ProductionState['ordersBreakdownFilter']
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersAssignmentProgressFilter') {
    state.ordersAssignmentProgressFilter = value as ProductionState['ordersAssignmentProgressFilter']
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersAssignmentModeFilter') {
    state.ordersAssignmentModeFilter = value as AssignmentModeFilter
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersBiddingRiskFilter') {
    state.ordersBiddingRiskFilter = value as BiddingRiskFilter
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersTierFilter') {
    state.ordersTierFilter = value as FactoryTier | 'ALL'
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersHasMaterialDraftFilter') {
    state.ordersHasMaterialDraftFilter = value as 'ALL' | 'YES' | 'NO'
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'ordersHasConfirmedMaterialRequestFilter') {
    state.ordersHasConfirmedMaterialRequestFilter = value as 'ALL' | 'YES' | 'NO'
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return
  }

  if (field === 'planKeyword') {
    state.planKeyword = value
    return
  }

  if (field === 'planStatusFilter') {
    state.planStatusFilter = value as ProductionState['planStatusFilter']
    return
  }

  if (field === 'planFactoryFilter') {
    state.planFactoryFilter = value
    return
  }

  if (field === 'planFormStartDate') {
    state.planForm.planStartDate = value
    return
  }

  if (field === 'planFormEndDate') {
    state.planForm.planEndDate = value
    return
  }

  if (field === 'planFormQty') {
    state.planForm.planQty = value
    return
  }

  if (field === 'planFormFactoryId') {
    state.planForm.planFactoryId = value
    const option = getPlanFactoryOptions().find((item) => item.id === value)
    state.planForm.planFactoryName = option?.name ?? ''
    return
  }

  if (field === 'planFormRemark') {
    state.planForm.planRemark = value
    return
  }

  if (field === 'deliveryKeyword') {
    state.deliveryKeyword = value
    return
  }

  if (field === 'deliveryStatusFilter') {
    state.deliveryStatusFilter = value as ProductionState['deliveryStatusFilter']
    return
  }

  if (field === 'deliveryFormWarehouseId') {
    state.deliveryForm.deliveryWarehouseId = value
    return
  }

  if (field === 'deliveryFormWarehouseName') {
    state.deliveryForm.deliveryWarehouseName = value
    return
  }

  if (field === 'deliveryFormWarehouseRemark') {
    state.deliveryForm.deliveryWarehouseRemark = value
    return
  }

  if (field === 'changesKeyword') {
    state.changesKeyword = value
    return
  }

  if (field === 'changesTypeFilter') {
    state.changesTypeFilter = value as 'ALL' | ProductionChangeType
    return
  }

  if (field === 'changesStatusFilter') {
    state.changesStatusFilter = value as 'ALL' | ProductionChangeStatus
    return
  }

  if (field === 'changesCreateProductionOrderId') {
    state.changesCreateForm.productionOrderId = value
    return
  }

  if (field === 'changesCreateType') {
    state.changesCreateForm.changeType = value as ProductionChangeType | ''
    return
  }

  if (field === 'changesCreateBeforeValue') {
    state.changesCreateForm.beforeValue = value
    return
  }

  if (field === 'changesCreateAfterValue') {
    state.changesCreateForm.afterValue = value
    return
  }

  if (field === 'changesCreateImpactScope') {
    state.changesCreateForm.impactScopeZh = value
    return
  }

  if (field === 'changesCreateReason') {
    state.changesCreateForm.reason = value
    return
  }

  if (field === 'changesCreateRemark') {
    state.changesCreateForm.remark = value
    return
  }

  if (field === 'changesStatusNext') {
    state.changesStatusForm.nextStatus = value as ProductionChangeStatus | ''
    state.changesStatusError = ''
    return
  }

  if (field === 'changesStatusRemark') {
    state.changesStatusForm.remark = value
    return
  }

  if (field === 'statusKeyword') {
    state.statusKeyword = value
    return
  }

  if (field === 'statusFilter') {
    state.statusFilter = value as 'ALL' | LifecycleStatus
    return
  }

  if (field === 'statusNext') {
    state.statusNext = value as '' | LifecycleStatus
    return
  }

  if (field === 'statusRemark') {
    state.statusRemark = value
    return
  }

  if (field === 'detailSimulateStatus') {
    state.detailSimulateStatus = value as ProductionOrderStatus
  }
}

export function handleProductionEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-prod-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.prodField
    if (!field) return true
    updateProductionField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-prod-action]')
  if (!actionNode) {
    if (state.ordersActionMenuId && !target.closest('[data-prod-orders-menu-root]')) {
      state.ordersActionMenuId = null
      return true
    }
    return false
  }

  const action = actionNode.dataset.prodAction
  if (!action) return false

  if (action === 'close-dialog') {
    closeAllProductionDialogs()
    return true
  }

  if (action === 'noop') {
    return true
  }

  if (action === 'open-order-tech-pack-snapshot') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.ordersActionMenuId = null
    openOrderTechPackSnapshot(orderId)
    return true
  }

  if (action === 'open-current-tech-pack') {
    const spuCode = actionNode.dataset.spuCode
    if (!spuCode) return true

    state.ordersActionMenuId = null
    openCurrentTechPackEntry(spuCode)
    return true
  }

  if (action === 'open-current-tech-pack-from-demand-detail') {
    const spuCode = actionNode.dataset.spuCode
    if (!spuCode) return true

    openCurrentTechPackEntry(spuCode)
    state.demandDetailId = null
    return true
  }

  if (action === 'open-order-detail') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.ordersActionMenuId = null
    openAppRoute(`/fcs/production/orders/${orderId}`, `po-${orderId}`, `生产单管理 ${orderId}`)
    return true
  }

  if (action === 'open-material-draft-drawer') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.materialDraftOrderId = orderId
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'close-material-draft-drawer') {
    state.materialDraftOrderId = null
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'toggle-material-draft-needed') {
    const draftId = actionNode.dataset.draftId
    if (!draftId || !(actionNode instanceof HTMLInputElement)) return true
    setMaterialDraftNeedMaterial(draftId, actionNode.checked, currentUser.name)
    return true
  }

  if (action === 'toggle-material-draft-line') {
    const draftId = actionNode.dataset.draftId
    const lineId = actionNode.dataset.lineId
    if (!draftId || !lineId || !(actionNode instanceof HTMLInputElement)) return true
    toggleMaterialDraftLine(draftId, lineId, actionNode.checked, currentUser.name)
    return true
  }

  if (action === 'open-add-draft-materials') {
    const draftId = actionNode.dataset.draftId
    if (!draftId) return true
    state.materialDraftAddDraftId = draftId
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'close-add-draft-materials') {
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'toggle-add-draft-material') {
    const optionKey = actionNode.dataset.optionKey
    if (!optionKey) return true
    const next = new Set(state.materialDraftAddSelections)
    if (next.has(optionKey)) {
      next.delete(optionKey)
    } else {
      next.add(optionKey)
    }
    state.materialDraftAddSelections = next
    return true
  }

  if (action === 'add-draft-materials') {
    const draftId = state.materialDraftAddDraftId
    if (!draftId) return true
    const added = addMaterialToDraft(draftId, [...state.materialDraftAddSelections], currentUser.name)
    if (added <= 0) {
      showPlanMessage('未选择可补充物料', 'error')
      return true
    }
    showPlanMessage(`已补充 ${added} 条物料`)
    state.materialDraftAddDraftId = null
    state.materialDraftAddSelections = new Set<string>()
    return true
  }

  if (action === 'restore-material-draft-suggestion') {
    const draftId = actionNode.dataset.draftId
    if (!draftId) return true
    restoreMaterialDraftSuggestion(draftId, currentUser.name)
    showPlanMessage('已恢复系统建议')
    return true
  }

  if (action === 'confirm-material-request-draft') {
    const draftId = actionNode.dataset.draftId
    if (!draftId) return true

    const result = confirmMaterialRequestDraft(draftId, { id: currentUser.id, name: currentUser.name })
    if (!result.ok) {
      showPlanMessage(`创建失败：${result.reason}`, 'error')
      return true
    }

    showPlanMessage(`领料需求已创建：${result.request.materialRequestNo}`)
    return true
  }

  if (action === 'copy-demand-legacy') {
    const legacyNo = actionNode.dataset.legacyNo
    if (!legacyNo) return true

    try {
      if (navigator?.clipboard?.writeText) {
        void navigator.clipboard.writeText(legacyNo)
      }
    } catch {
      // ignore clipboard errors
    }

    return true
  }

  if (action === 'toggle-demand-only-ungenerated') {
    state.demandOnlyUngenerated = !state.demandOnlyUngenerated
    return true
  }

  if (action === 'query-demand') {
    return true
  }

  if (action === 'toggle-demand-select-all') {
    const filteredDemands = getFilteredDemands()
    const shouldClear =
      filteredDemands.length > 0 &&
      filteredDemands.every((demand) => state.demandSelectedIds.has(demand.demandId))

    if (shouldClear) {
      state.demandSelectedIds = new Set()
    } else {
      state.demandSelectedIds = new Set(filteredDemands.map((demand) => demand.demandId))
    }
    return true
  }

  if (action === 'toggle-demand-select') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true

    const next = new Set(state.demandSelectedIds)
    if (next.has(demandId)) {
      next.delete(demandId)
    } else {
      next.add(demandId)
    }
    state.demandSelectedIds = next
    return true
  }

  if (action === 'open-demand-detail') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    state.demandDetailId = demandId
    return true
  }

  if (action === 'close-demand-detail') {
    state.demandDetailId = null
    return true
  }

  if (action === 'open-demand-batch') {
    openDemandBatchGenerate()
    return true
  }

  if (action === 'open-demand-single') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    openDemandSingleGenerate(demandId)
    return true
  }

  if (action === 'close-demand-generate') {
    state.demandBatchDialogOpen = false
    state.demandSingleGenerateId = null
    state.demandGenerateConfirmOpen = false
    return true
  }

  if (action === 'toggle-demand-advanced') {
    state.demandShowAdvanced = !state.demandShowAdvanced
    return true
  }

  if (action === 'open-demand-generate-confirm') {
    state.demandGenerateConfirmOpen = true
    return true
  }

  if (action === 'close-demand-generate-confirm') {
    state.demandGenerateConfirmOpen = false
    return true
  }

  if (action === 'confirm-demand-generate') {
    if (state.ordersFromDemandDialogOpen) {
      performOrdersFromDemandGenerate()
    } else {
      performDemandGenerate()
    }
    return true
  }

  if (action === 'toggle-orders-demand-select-all') {
    const demands = listOrdersFromDemandGeneratableDemands()
    const shouldClear = demands.length > 0 && demands.every((demand) => state.ordersFromDemandSelectedIds.has(demand.demandId))
    if (shouldClear) {
      state.ordersFromDemandSelectedIds = new Set<string>()
    } else {
      state.ordersFromDemandSelectedIds = new Set<string>(demands.map((demand) => demand.demandId))
    }
    return true
  }

  if (action === 'toggle-orders-demand-select') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true
    const next = new Set(state.ordersFromDemandSelectedIds)
    if (next.has(demandId)) next.delete(demandId)
    else next.add(demandId)
    state.ordersFromDemandSelectedIds = next
    return true
  }

  if (action === 'open-orders-demand-generate-confirm') {
    state.demandGenerateConfirmOpen = true
    return true
  }

  if (action === 'close-orders-from-demand') {
    state.ordersFromDemandDialogOpen = false
    state.ordersFromDemandSelectedIds = new Set<string>()
    state.demandGenerateConfirmOpen = false
    return true
  }

  if (action === 'reset-demand-filters') {
    state.demandKeyword = ''
    state.demandStatusFilter = 'ALL'
    state.demandTechPackFilter = 'ALL'
    state.demandHasOrderFilter = 'ALL'
    state.demandPriorityFilter = 'ALL'
    state.demandOnlyUngenerated = false
    return true
  }

  if (action === 'hold-demand' || action === 'unhold-demand' || action === 'cancel-demand') {
    const demandId = actionNode.dataset.demandId
    if (!demandId) return true

    const targetStatus: ProductionDemand['demandStatus'] =
      action === 'hold-demand' ? 'HOLD' : action === 'unhold-demand' ? 'PENDING_CONVERT' : 'CANCELLED'

    state.demands = state.demands.map((demand) => {
      if (demand.demandId !== demandId) return demand
      return {
        ...demand,
        demandStatus: targetStatus,
        updatedAt: toTimestamp(),
      }
    })

    return true
  }

  if (action === 'refresh-demand') {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
    return true
  }

  if (action === 'reset-orders-filters') {
    state.ordersKeyword = ''
    state.ordersStatusFilter = []
    state.ordersTechPackFilter = 'ALL'
    state.ordersBreakdownFilter = 'ALL'
    state.ordersAssignmentProgressFilter = 'ALL'
    state.ordersAssignmentModeFilter = 'ALL'
    state.ordersBiddingRiskFilter = 'ALL'
    state.ordersTierFilter = 'ALL'
    state.ordersHasMaterialDraftFilter = 'ALL'
    state.ordersHasConfirmedMaterialRequestFilter = 'ALL'
    state.ordersMaterialStageFilter = 'ALL'
    state.ordersCurrentPage = 1
    state.ordersSelectedIds = new Set()
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'query-orders') {
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'apply-material-reminder-filter') {
    const targetFilter = actionNode.dataset.target
    state.ordersHasMaterialDraftFilter = 'ALL'
    state.ordersHasConfirmedMaterialRequestFilter = 'ALL'
    state.ordersMaterialStageFilter = 'ALL'

    if (targetFilter === 'preview') {
      state.ordersMaterialStageFilter = 'PREVIEW'
    } else if (targetFilter === 'pending') {
      state.ordersMaterialStageFilter = 'ACTUAL_PENDING'
    } else if (targetFilter === 'confirmed') {
      state.ordersMaterialStageFilter = 'ACTUAL_CONFIRMED'
    }
    state.ordersCurrentPage = 1
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'switch-orders-view') {
    const view = actionNode.dataset.view as OrderViewMode | undefined
    if (view === 'table' || view === 'board') {
      state.ordersViewMode = view
      state.ordersActionMenuId = null

      if (view === 'board' && typeof window !== 'undefined') {
        window.alert('Board视图 - 占位')
      }
    }
    return true
  }

  if (action === 'toggle-orders-more-menu') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId =
      state.ordersActionMenuId === orderId ? null : orderId
    return true
  }

  if (action === 'orders-prev-page') {
    state.ordersCurrentPage = Math.max(1, state.ordersCurrentPage - 1)
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'orders-next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredOrders().length / PAGE_SIZE))
    state.ordersCurrentPage = Math.min(totalPages, state.ordersCurrentPage + 1)
    state.ordersActionMenuId = null
    return true
  }

  if (action === 'toggle-orders-select-all') {
    const paged = getPaginatedOrders(getFilteredOrders())
    const shouldClear = paged.length > 0 && paged.every((order) => state.ordersSelectedIds.has(order.productionOrderId))

    if (shouldClear) {
      state.ordersSelectedIds = new Set()
    } else {
      state.ordersSelectedIds = new Set(paged.map((order) => order.productionOrderId))
    }

    return true
  }

  if (action === 'toggle-orders-select') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    const next = new Set(state.ordersSelectedIds)
    if (next.has(orderId)) next.delete(orderId)
    else next.add(orderId)
    state.ordersSelectedIds = next
    return true
  }

  if (action === 'open-orders-demand-snapshot') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.ordersDemandSnapshotId = orderId
    return true
  }

  if (action === 'close-orders-demand-snapshot') {
    state.ordersDemandSnapshotId = null
    return true
  }

  if (action === 'open-orders-logs') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    state.ordersLogsId = orderId
    return true
  }

  if (action === 'close-orders-logs') {
    state.ordersLogsId = null
    return true
  }

  if (action === 'open-orders-dispatch-center') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    openAppRoute(`/fcs/dispatch/board?po=${orderId}`, `dispatch-center-${orderId}`, '任务分配')
    return true
  }

  if (action === 'open-orders-dispatch-board') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true
    state.ordersActionMenuId = null
    openAppRoute(`/fcs/dispatch/board?po=${orderId}`, `dispatch-board-${orderId}`, '分配看板')
    return true
  }

  if (action === 'orders-refresh') {
    state.ordersActionMenuId = null
    if (typeof window !== 'undefined') window.location.reload()
    return true
  }

  if (action === 'orders-export') {
    state.ordersActionMenuId = null
    if (typeof window !== 'undefined') window.alert('导出 - 占位')
    return true
  }

  if (action === 'orders-from-demand') {
    state.ordersActionMenuId = null
    openOrdersFromDemandGenerateDialog()
    return true
  }

  if (action === 'open-plan-edit') {
    const orderId = actionNode.dataset.orderId
    const order = state.orders.find((item) => item.productionOrderId === orderId)
    if (!order) return true

    state.planEditOrderId = order.productionOrderId
    state.planForm = {
      planStartDate: order.planStartDate ?? '',
      planEndDate: order.planEndDate ?? '',
      planQty: order.planQty != null ? String(order.planQty) : '',
      planFactoryId: order.planFactoryId ?? '',
      planFactoryName: order.planFactoryName ?? '',
      planRemark: order.planRemark ?? '',
    }

    return true
  }

  if (action === 'close-plan-edit') {
    state.planEditOrderId = null
    state.planForm = { ...PLAN_EMPTY_FORM }
    return true
  }

  if (action === 'save-plan-edit') {
    const orderId = state.planEditOrderId
    if (!orderId) return true

    if (!state.planForm.planStartDate) {
      showPlanMessage('保存失败：计划开始日期不能为空', 'error')
      return true
    }

    if (!state.planForm.planEndDate) {
      showPlanMessage('保存失败：计划结束日期不能为空', 'error')
      return true
    }

    const qty = Number(state.planForm.planQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      showPlanMessage('保存失败：计划数量必须大于 0', 'error')
      return true
    }

    if (!state.planForm.planFactoryId) {
      showPlanMessage('保存失败：计划工厂不能为空', 'error')
      return true
    }

    if (state.planForm.planEndDate < state.planForm.planStartDate) {
      showPlanMessage('保存失败：计划结束日期不能早于开始日期', 'error')
      return true
    }

    const now = toTimestamp()

    state.orders = state.orders.map((order) => {
      if (order.productionOrderId !== orderId) return order
      const selectedFactory = getPlanFactoryOptions().find((item) => item.id === state.planForm.planFactoryId)
      return {
        ...order,
        planStartDate: state.planForm.planStartDate,
        planEndDate: state.planForm.planEndDate,
        planQty: qty,
        planFactoryId: state.planForm.planFactoryId,
        planFactoryName: state.planForm.planFactoryName || selectedFactory?.name || state.planForm.planFactoryId,
        planRemark: state.planForm.planRemark || undefined,
        planStatus: 'PLANNED',
        planUpdatedAt: now,
        planUpdatedBy: currentUser.name,
        updatedAt: now,
      }
    })

    state.planEditOrderId = null
    state.planForm = { ...PLAN_EMPTY_FORM }
    showPlanMessage('生产单计划已保存')
    return true
  }

  if (action === 'release-plan') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    const order = state.orders.find((item) => item.productionOrderId === orderId)
    if (!order) {
      showPlanMessage(`下发失败：生产单 ${orderId} 不存在`, 'error')
      return true
    }

    if (!order.planStartDate || !order.planEndDate || !order.planQty || !order.planFactoryId) {
      showPlanMessage('下发失败：请先完成生产单计划后再下发', 'error')
      return true
    }

    const now = toTimestamp()
    state.orders = state.orders.map((order) => {
      if (order.productionOrderId !== orderId) return order

      return {
        ...order,
        planStatus: 'RELEASED',
        planUpdatedAt: now,
        planUpdatedBy: currentUser.name,
        updatedAt: now,
      }
    })

    showPlanMessage('生产单计划已下发')
    return true
  }

  if (action === 'open-delivery-edit') {
    const orderId = actionNode.dataset.orderId
    const order = state.orders.find((item) => item.productionOrderId === orderId)
    if (!order) return true

    state.deliveryEditOrderId = order.productionOrderId
    state.deliveryForm = {
      productionOrderId: order.productionOrderId,
      deliveryWarehouseId: order.deliveryWarehouseId ?? '',
      deliveryWarehouseName: order.deliveryWarehouseName ?? '',
      deliveryWarehouseRemark: order.deliveryWarehouseRemark ?? '',
    }

    return true
  }

  if (action === 'close-delivery-edit') {
    state.deliveryEditOrderId = null
    state.deliveryForm = { ...DELIVERY_EMPTY_FORM }
    return true
  }

  if (action === 'save-delivery-edit') {
    const orderId = state.deliveryEditOrderId
    if (!orderId) return true

    const warehouseId = state.deliveryForm.deliveryWarehouseId.trim()
    if (!warehouseId) {
      showPlanMessage('交付仓ID不能为空', 'error')
      return true
    }

    const targetOrder = state.orders.find((item) => item.productionOrderId === orderId)
    if (!targetOrder) {
      showPlanMessage(`保存失败：生产单 ${orderId} 不存在`, 'error')
      return true
    }

    const now = toTimestamp()
    const warehouseName = state.deliveryForm.deliveryWarehouseName.trim() || warehouseId
    const warehouseRemark = state.deliveryForm.deliveryWarehouseRemark.trim() || undefined

    state.orders = state.orders.map((order) => {
      if (order.productionOrderId !== orderId) return order
      return {
        ...order,
        deliveryWarehouseId: warehouseId,
        deliveryWarehouseName: warehouseName,
        deliveryWarehouseRemark: warehouseRemark,
        deliveryWarehouseStatus: 'SET',
        deliveryWarehouseUpdatedAt: now,
        deliveryWarehouseUpdatedBy: currentUser.name,
        updatedAt: now,
      }
    })

    state.deliveryEditOrderId = null
    state.deliveryForm = { ...DELIVERY_EMPTY_FORM }
    showPlanMessage('交付仓配置已保存')
    return true
  }

  if (action === 'open-changes-create') {
    state.changesCreateOpen = true
    return true
  }

  if (action === 'close-changes-create') {
    state.changesCreateOpen = false
    return true
  }

  if (action === 'save-changes-create') {
    const errors: Record<string, string> = {}

    if (!state.changesCreateForm.productionOrderId) {
      errors.productionOrderId = '请选择生产单'
    }
    if (!state.changesCreateForm.changeType) {
      errors.changeType = '请选择变更类型'
    }
    if (!state.changesCreateForm.reason.trim()) {
      errors.reason = '变更原因不能为空'
    }

    state.changesCreateErrors = errors
    if (Object.keys(errors).length > 0) return true

    const targetOrder = state.orders.find(
      (order) => order.productionOrderId === state.changesCreateForm.productionOrderId,
    )
    if (!targetOrder) {
      showPlanMessage(`创建失败：生产单 ${state.changesCreateForm.productionOrderId} 不存在`, 'error')
      return true
    }

    const now = toTimestamp()
    const month = now.slice(0, 7).replace('-', '')
    const existingIds = new Set(state.changes.map((change) => change.changeId))
    const changeId = nextChangeId(month, existingIds)

    const changeType = state.changesCreateForm.changeType as ProductionChangeType

    const newChange: ProductionOrderChange = {
      changeId,
      productionOrderId: state.changesCreateForm.productionOrderId,
      changeType,
      beforeValue: state.changesCreateForm.beforeValue || undefined,
      afterValue: state.changesCreateForm.afterValue || undefined,
      impactScopeZh: state.changesCreateForm.impactScopeZh || undefined,
      reason: state.changesCreateForm.reason,
      remark: state.changesCreateForm.remark || undefined,
      status: 'DRAFT',
      createdAt: now,
      createdBy: currentUser.name,
    }

    state.changes = [...state.changes, newChange]
    state.changesCreateOpen = false
    state.changesCreateForm = { ...CHANGE_CREATE_EMPTY_FORM }
    state.changesCreateErrors = {}
    showPlanMessage(`生产单变更已创建：${changeId}`)
    return true
  }

  if (action === 'open-changes-status') {
    const changeId = actionNode.dataset.changeId
    const currentStatus = actionNode.dataset.currentStatus as ProductionChangeStatus | undefined

    if (!changeId || !currentStatus) return true

    state.changesStatusOpen = true
    state.changesStatusTarget = { changeId, currentStatus }
    state.changesStatusForm = { ...CHANGE_STATUS_EMPTY_FORM }
    state.changesStatusError = ''
    return true
  }

  if (action === 'close-changes-status') {
    state.changesStatusOpen = false
    return true
  }

  if (action === 'save-changes-status') {
    if (!state.changesStatusTarget || !state.changesStatusForm.nextStatus) {
      state.changesStatusError = '请选择目标状态'
      return true
    }

    const target = state.changes.find((change) => change.changeId === state.changesStatusTarget?.changeId)
    if (!target) {
      state.changesStatusError = `变更单 ${state.changesStatusTarget.changeId} 不存在`
      return true
    }

    const allowed = changeAllowedNext[target.status]
    if (!allowed.includes(state.changesStatusForm.nextStatus)) {
      state.changesStatusError = '当前变更状态不允许切换到目标状态'
      return true
    }

    const now = toTimestamp()

    state.changes = state.changes.map((change) => {
      if (change.changeId !== state.changesStatusTarget?.changeId) return change
      return {
        ...change,
        status: state.changesStatusForm.nextStatus as ProductionChangeStatus,
        remark: state.changesStatusForm.remark || change.remark,
        updatedAt: now,
        updatedBy: currentUser.name,
      }
    })

    state.changesStatusOpen = false
    state.changesStatusTarget = null
    state.changesStatusForm = { ...CHANGE_STATUS_EMPTY_FORM }
    state.changesStatusError = ''
    showPlanMessage('变更状态已更新')
    return true
  }

  if (action === 'open-status-change') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.statusDialogOpen = true
    state.statusSelectedOrderId = orderId
    state.statusNext = ''
    state.statusRemark = ''
    return true
  }

  if (action === 'close-status-change') {
    state.statusDialogOpen = false
    state.statusSelectedOrderId = null
    state.statusNext = ''
    state.statusRemark = ''
    return true
  }

  if (action === 'save-status-change') {
    if (!state.statusSelectedOrderId || !state.statusNext) {
      showPlanMessage('请选择目标状态', 'error')
      return true
    }

    const order = state.orders.find((item) => item.productionOrderId === state.statusSelectedOrderId)
    if (!order) {
      showPlanMessage(`变更失败：生产单 ${state.statusSelectedOrderId} 不存在`, 'error')
      return true
    }

    const currentLifecycle = deriveLifecycleStatus(order)
    if (!lifecycleAllowedNext[currentLifecycle].includes(state.statusNext)) {
      showPlanMessage('当前状态不允许切换到目标状态', 'error')
      return true
    }

    const now = toTimestamp()
    const nextStatus = state.statusNext as LifecycleStatus

    state.orders = state.orders.map((item) => {
      if (item.productionOrderId !== state.statusSelectedOrderId) return item

      return {
        ...item,
        lifecycleStatus: nextStatus,
        lifecycleStatusRemark: state.statusRemark.trim() || undefined,
        lifecycleUpdatedAt: now,
        lifecycleUpdatedBy: currentUser.name,
        updatedAt: now,
      }
    })

    state.statusDialogOpen = false
    state.statusSelectedOrderId = null
    state.statusNext = ''
    state.statusRemark = ''
    showPlanMessage('生产单状态已更新')
    return true
  }

  if (action === 'detail-switch-tab') {
    const tab = actionNode.dataset.tab as OrderDetailTab | undefined
    if (!tab) return true
    state.detailTab = tab
    return true
  }

  if (action === 'detail-open-logs') {
    state.detailLogsOpen = true
    return true
  }

  if (action === 'detail-close-logs') {
    state.detailLogsOpen = false
    return true
  }

  if (action === 'detail-open-simulate') {
    const order = getOrderById(state.detailCurrentOrderId)
    if (!order) return true
    state.detailSimulateStatus = order.status
    state.detailSimulateOpen = true
    return true
  }

  if (action === 'detail-close-simulate') {
    state.detailSimulateOpen = false
    return true
  }

  if (action === 'detail-open-simulate-confirm') {
    state.detailConfirmSimulateOpen = true
    return true
  }

  if (action === 'detail-close-simulate-confirm') {
    state.detailConfirmSimulateOpen = false
    return true
  }

  if (action === 'detail-apply-simulate') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    const now = toTimestamp()
    const targetStatus = state.detailSimulateStatus
    const lockedStatuses: ProductionOrderStatus[] = ['EXECUTING', 'COMPLETED', 'CANCELLED']

    state.orders = state.orders.map((order) => {
      if (order.productionOrderId !== orderId) return order

      const auditLog: AuditLog = {
        id: nextLocalEntityId('LOG', 4),
        action: 'STATUS_SIMULATE',
        detail: `状态模拟从 ${productionOrderStatusConfig[order.status].label} 变更为 ${productionOrderStatusConfig[targetStatus].label}`,
        at: now,
        by: currentUser.name,
      }

      return {
        ...order,
        status: targetStatus,
        lockedLegacy: lockedStatuses.includes(targetStatus),
        updatedAt: now,
        auditLogs: [...order.auditLogs, auditLog],
      }
    })

    state.detailConfirmSimulateOpen = false
    state.detailSimulateOpen = false
    return true
  }

  return false
}

export function handleProductionSubmit(_form: HTMLFormElement): boolean {
  return false
}

export function isProductionDialogOpen(): boolean {
  return (
    state.demandDetailId !== null ||
    state.demandBatchDialogOpen ||
    state.demandSingleGenerateId !== null ||
    state.demandGenerateConfirmOpen ||
    state.ordersDemandSnapshotId !== null ||
    state.ordersLogsId !== null ||
    state.materialDraftOrderId !== null ||
    state.materialDraftAddDraftId !== null ||
    state.planEditOrderId !== null ||
    state.deliveryEditOrderId !== null ||
    state.changesCreateOpen ||
    state.changesStatusOpen ||
    state.statusDialogOpen ||
    state.detailLogsOpen ||
    state.detailSimulateOpen ||
    state.detailConfirmSimulateOpen
  )
}
