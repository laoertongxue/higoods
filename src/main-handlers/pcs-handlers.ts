import { handlePcsOverviewEvent } from '../pages/pcs-workspace-overview'
import {
  handlePcsTodosEvent,
  isPcsTodosDialogOpen,
} from '../pages/pcs-workspace-todos'
import {
  handlePcsAlertsEvent,
  isPcsAlertsDialogOpen,
} from '../pages/pcs-workspace-alerts'
import {
  handlePcsProjectsEvent,
  isPcsProjectsDialogOpen,
} from '../pages/pcs-projects'
import {
  handlePcsTemplatesEvent,
  isPcsTemplatesDialogOpen,
} from '../pages/pcs-templates'
import {
  handlePcsWorkItemsEvent,
  isPcsWorkItemsDialogOpen,
} from '../pages/pcs-work-items'
import {
  handlePcsTemplateDetailEvent,
  isPcsTemplateDetailDialogOpen,
} from '../pages/pcs-template-detail'
import {
  handlePcsTemplateEditorEvent,
  isPcsTemplateEditorDialogOpen,
} from '../pages/pcs-template-editor'
import { handlePcsWorkItemDetailEvent } from '../pages/pcs-work-item-detail'
import {
  handlePcsWorkItemEditorEvent,
  isPcsWorkItemEditorDialogOpen,
} from '../pages/pcs-work-item-editor'
import {
  handlePcsProjectDetailEvent,
  isPcsProjectDetailDialogOpen,
} from '../pages/pcs-project-detail'
import {
  handlePcsProjectWorkItemDetailEvent,
  isPcsProjectWorkItemDetailDialogOpen,
} from '../pages/pcs-project-work-item-detail'
import {
  handlePcsLiveSessionsEvent,
  isPcsLiveSessionsDialogOpen,
} from '../pages/pcs-testing-live'
import {
  handlePcsLiveSessionDetailEvent,
  isPcsLiveSessionDetailDialogOpen,
} from '../pages/pcs-testing-live-detail'
import {
  handlePcsVideoRecordsEvent,
  isPcsVideoRecordsDialogOpen,
} from '../pages/pcs-testing-video'
import {
  handlePcsVideoRecordDetailEvent,
  isPcsVideoRecordDetailDialogOpen,
} from '../pages/pcs-testing-video-detail'
import {
  handlePcsChannelProductsEvent,
  isPcsChannelProductsDialogOpen,
} from '../pages/pcs-channel-products'
import {
  handlePcsChannelProductDetailEvent,
  isPcsChannelProductDetailDialogOpen,
} from '../pages/pcs-channel-product-detail'
import {
  handlePcsChannelProductMappingEvent,
  isPcsChannelProductMappingDialogOpen,
} from '../pages/pcs-channel-product-mapping'
import { handlePcsChannelProductStoreViewEvent } from '../pages/pcs-channel-product-store'
import {
  handlePcsChannelStoresEvent,
  isPcsChannelStoresDialogOpen,
} from '../pages/pcs-channel-stores'
import {
  handlePcsChannelStoreDetailEvent,
  isPcsChannelStoreDetailDialogOpen,
} from '../pages/pcs-channel-store-detail'
import {
  handlePcsChannelStoreSyncEvent,
  isPcsChannelStoreSyncDialogOpen,
} from '../pages/pcs-channel-store-sync'
import {
  handlePcsChannelStorePayoutAccountsEvent,
  isPcsChannelStorePayoutAccountsDialogOpen,
} from '../pages/pcs-channel-store-payout-accounts'
import {
  handleSampleLedgerEvent,
  handleSampleLedgerInput,
  isSampleLedgerDialogOpen,
} from '../pages/pcs-sample-ledger'
import {
  handleSampleInventoryEvent,
  isSampleInventoryDialogOpen,
} from '../pages/pcs-sample-inventory'
import {
  handleSampleTransferEvent,
  isSampleTransferDialogOpen,
} from '../pages/pcs-sample-transfer'
import {
  handleSampleReturnEvent,
  isSampleReturnDialogOpen,
} from '../pages/pcs-sample-return'
import {
  handleSampleApplicationEvent,
  handleSampleApplicationInput,
  isSampleApplicationDialogOpen,
} from '../pages/pcs-sample-application'
import {
  handleSampleViewEvent,
  handleSampleViewInput,
  isSampleViewDialogOpen,
} from '../pages/pcs-sample-view'
import {
  handleRevisionTaskEvent,
  handleRevisionTaskInput,
  isRevisionTaskDialogOpen,
} from '../pages/pcs-revision-task'
import {
  handlePlateMakingEvent,
  handlePlateMakingInput,
  isPlateMakingDialogOpen,
} from '../pages/pcs-plate-making'
import {
  handlePatternTaskEvent,
  handlePatternTaskInput,
  isPatternTaskDialogOpen,
} from '../pages/pcs-pattern-task'
import {
  handleFirstOrderSampleEvent,
  handleFirstOrderSampleInput,
  isFirstOrderSampleDialogOpen,
} from '../pages/pcs-first-order-sample'
import {
  handlePreProductionSampleEvent,
  handlePreProductionSampleInput,
  isPreProductionSampleDialogOpen,
} from '../pages/pcs-pre-production-sample'
import {
  handleProductSpuEvent,
  handleProductSpuInput,
  isProductSpuDialogOpen,
} from '../pages/pcs-product-spu'
import {
  handleProductSkuEvent,
  handleProductSkuInput,
  isProductSkuDialogOpen,
} from '../pages/pcs-product-sku'
import {
  handleProductYarnEvent,
  handleProductYarnInput,
  isProductYarnDialogOpen,
} from '../pages/pcs-product-yarn'
import {
  handleConfigWorkspaceEvent,
  handleConfigWorkspaceInput,
  isConfigWorkspaceDialogOpen,
} from '../pages/pcs-config-workspace'
import {
  handlePlatformConfigEvent,
  handlePlatformConfigInput,
  isPlatformConfigDialogOpen,
} from '../pages/pcs-platform-config'

export function dispatchPcsPageEvent(target: HTMLElement): boolean {
  return (
    handlePcsOverviewEvent(target) ||
    handlePcsTodosEvent(target) ||
    handlePcsAlertsEvent(target) ||
    handlePcsProjectsEvent(target) ||
    handlePcsTemplatesEvent(target) ||
    handlePcsWorkItemsEvent(target) ||
    handlePcsTemplateDetailEvent(target) ||
    handlePcsTemplateEditorEvent(target) ||
    handlePcsWorkItemDetailEvent(target) ||
    handlePcsWorkItemEditorEvent(target) ||
    handlePcsProjectDetailEvent(target) ||
    handlePcsProjectWorkItemDetailEvent(target) ||
    handlePcsLiveSessionsEvent(target) ||
    handlePcsLiveSessionDetailEvent(target) ||
    handlePcsVideoRecordsEvent(target) ||
    handlePcsVideoRecordDetailEvent(target) ||
    handlePcsChannelProductsEvent(target) ||
    handlePcsChannelProductDetailEvent(target) ||
    handlePcsChannelProductMappingEvent(target) ||
    handlePcsChannelProductStoreViewEvent(target) ||
    handlePcsChannelStoresEvent(target) ||
    handlePcsChannelStoreDetailEvent(target) ||
    handlePcsChannelStoreSyncEvent(target) ||
    handlePcsChannelStorePayoutAccountsEvent(target) ||
    handleSampleLedgerEvent(target) ||
    handleSampleInventoryEvent(target) ||
    handleSampleTransferEvent(target) ||
    handleSampleReturnEvent(target) ||
    handleSampleApplicationEvent(target) ||
    handleSampleViewEvent(target) ||
    handleRevisionTaskEvent(target) ||
    handlePlateMakingEvent(target) ||
    handlePatternTaskEvent(target) ||
    handleFirstOrderSampleEvent(target) ||
    handlePreProductionSampleEvent(target) ||
    handleProductSpuEvent(target) ||
    handleProductSkuEvent(target) ||
    handleProductYarnEvent(target) ||
    handleConfigWorkspaceEvent(target) ||
    handlePlatformConfigEvent(target)
  )
}

export function dispatchPcsInputEvent(target: Element): boolean {
  return (
    handleSampleLedgerInput(target) ||
    handleSampleApplicationInput(target) ||
    handleSampleViewInput(target) ||
    handleRevisionTaskInput(target) ||
    handlePlateMakingInput(target) ||
    handlePatternTaskInput(target) ||
    handleFirstOrderSampleInput(target) ||
    handlePreProductionSampleInput(target) ||
    handleProductSpuInput(target) ||
    handleProductSkuInput(target) ||
    handleProductYarnInput(target) ||
    handleConfigWorkspaceInput(target) ||
    handlePlatformConfigInput(target)
  )
}

export function closePcsDialogsOnEscape(): boolean {
  if (isPcsTodosDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsTodoAction = 'close-dialog'
    handlePcsTodosEvent(fakeButton)
    return true
  }

  if (isPcsAlertsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsAlertAction = 'close-all'
    handlePcsAlertsEvent(fakeButton)
    return true
  }

  if (isPcsProjectsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsProjectAction = 'close-dialog'
    handlePcsProjectsEvent(fakeButton)
    return true
  }

  if (isPcsTemplatesDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsTemplateAction = 'close-dialog'
    handlePcsTemplatesEvent(fakeButton)
    return true
  }

  if (isPcsWorkItemsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsWorkLibraryAction = 'close-dialog'
    handlePcsWorkItemsEvent(fakeButton)
    return true
  }

  if (isPcsTemplateDetailDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsTemplateDetailAction = 'close-dialog'
    handlePcsTemplateDetailEvent(fakeButton)
    return true
  }

  if (isPcsTemplateEditorDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsTemplateEditorAction = 'close-library'
    handlePcsTemplateEditorEvent(fakeButton)
    fakeButton.dataset.pcsTemplateEditorAction = 'close-cancel-dialog'
    handlePcsTemplateEditorEvent(fakeButton)
    return true
  }

  if (isPcsWorkItemEditorDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsWorkItemEditorAction = 'close-cancel-dialog'
    handlePcsWorkItemEditorEvent(fakeButton)
    return true
  }

  if (isPcsProjectDetailDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsProjectDetailAction = 'close-dialog'
    handlePcsProjectDetailEvent(fakeButton)
    return true
  }

  if (isPcsProjectWorkItemDetailDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsWorkItemAction = 'close-dialog'
    handlePcsProjectWorkItemDetailEvent(fakeButton)
    return true
  }

  if (isPcsLiveSessionsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsLiveAction = 'close-dialog'
    handlePcsLiveSessionsEvent(fakeButton)
    return true
  }

  if (isPcsLiveSessionDetailDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsLiveDetailAction = 'close-dialog'
    handlePcsLiveSessionDetailEvent(fakeButton)
    return true
  }

  if (isPcsVideoRecordsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsVideoAction = 'close-dialog'
    handlePcsVideoRecordsEvent(fakeButton)
    return true
  }

  if (isPcsVideoRecordDetailDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsVideoDetailAction = 'close-dialog'
    handlePcsVideoRecordDetailEvent(fakeButton)
    return true
  }

  if (isPcsChannelProductsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsChannelGroupAction = 'close-dialog'
    handlePcsChannelProductsEvent(fakeButton)
    return true
  }

  if (isPcsChannelProductDetailDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsChannelProductDetailAction = 'close-dialog'
    handlePcsChannelProductDetailEvent(fakeButton)
    return true
  }

  if (isPcsChannelProductMappingDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsChannelMappingAction = 'close-dialog'
    handlePcsChannelProductMappingEvent(fakeButton)
    return true
  }

  if (isPcsChannelStoresDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsChannelStoreAction = 'close-dialog'
    handlePcsChannelStoresEvent(fakeButton)
    return true
  }

  if (isPcsChannelStoreDetailDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsChannelStoreDetailAction = 'close-dialog'
    handlePcsChannelStoreDetailEvent(fakeButton)
    return true
  }

  if (isPcsChannelStoreSyncDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsStoreSyncAction = 'close-dialog'
    handlePcsChannelStoreSyncEvent(fakeButton)
    return true
  }

  if (isPcsChannelStorePayoutAccountsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsPayoutAction = 'close-dialog'
    handlePcsChannelStorePayoutAccountsEvent(fakeButton)
    return true
  }

  if (isSampleLedgerDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.ledgerAction = 'close-detail-drawer'
    handleSampleLedgerEvent(fakeButton)
    return true
  }

  if (isSampleInventoryDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.inventoryAction = 'close-drawer'
    handleSampleInventoryEvent(fakeButton)
    return true
  }

  if (isSampleTransferDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.transferAction = 'close-drawer'
    handleSampleTransferEvent(fakeButton)
    fakeButton.dataset.transferAction = 'close-advanced-filter'
    handleSampleTransferEvent(fakeButton)
    return true
  }

  if (isSampleReturnDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.returnAction = 'close-drawer'
    handleSampleReturnEvent(fakeButton)
    fakeButton.dataset.returnAction = 'close-new-case-dialog'
    handleSampleReturnEvent(fakeButton)
    fakeButton.dataset.returnAction = 'close-approve-dialog'
    handleSampleReturnEvent(fakeButton)
    fakeButton.dataset.returnAction = 'close-close-dialog'
    handleSampleReturnEvent(fakeButton)
    return true
  }

  if (isSampleApplicationDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.appAction = 'close-drawer'
    handleSampleApplicationEvent(fakeButton)
    return true
  }

  if (isSampleViewDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.viewAction = 'close-drawer'
    handleSampleViewEvent(fakeButton)
    return true
  }

  if (isRevisionTaskDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.revisionAction = 'close-drawer'
    handleRevisionTaskEvent(fakeButton)
    return true
  }

  if (isPlateMakingDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.plateAction = 'close-drawer'
    handlePlateMakingEvent(fakeButton)
    fakeButton.dataset.plateAction = 'close-downstream-dialog'
    handlePlateMakingEvent(fakeButton)
    return true
  }

  if (isPatternTaskDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.patternAction = 'close-drawer'
    handlePatternTaskEvent(fakeButton)
    return true
  }

  if (isFirstOrderSampleDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.firstOrderAction = 'close-drawer'
    handleFirstOrderSampleEvent(fakeButton)
    fakeButton.dataset.firstOrderAction = 'close-sign-dialog'
    handleFirstOrderSampleEvent(fakeButton)
    fakeButton.dataset.firstOrderAction = 'close-stock-dialog'
    handleFirstOrderSampleEvent(fakeButton)
    return true
  }

  if (isPreProductionSampleDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.preprodAction = 'close-drawer'
    handlePreProductionSampleEvent(fakeButton)
    fakeButton.dataset.preprodAction = 'close-sign-dialog'
    handlePreProductionSampleEvent(fakeButton)
    fakeButton.dataset.preprodAction = 'close-stock-dialog'
    handlePreProductionSampleEvent(fakeButton)
    return true
  }

  if (isProductSpuDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.spuAction = 'close-drawer'
    handleProductSpuEvent(fakeButton)
    return true
  }

  if (isProductSkuDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.skuAction = 'close-drawer'
    handleProductSkuEvent(fakeButton)
    fakeButton.dataset.skuAction = 'close-batch-dialog'
    handleProductSkuEvent(fakeButton)
    return true
  }

  if (isProductYarnDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.yarnAction = 'close-drawer'
    handleProductYarnEvent(fakeButton)
    return true
  }

  if (isConfigWorkspaceDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.configAction = 'close-dialog'
    handleConfigWorkspaceEvent(fakeButton)
    return true
  }

  if (isPlatformConfigDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.platformAction = 'close-drawer'
    handlePlatformConfigEvent(fakeButton)
    return true
  }

  return false
}
