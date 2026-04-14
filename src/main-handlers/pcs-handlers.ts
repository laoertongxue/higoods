import {
  handlePcsPartTemplateLibraryEvent,
  handlePcsPartTemplateLibraryInput,
  isPcsPartTemplateLibraryDialogOpen,
} from '../pages/pcs-part-template-library'
import {
  handlePcsPatternLibraryEvent,
  handlePcsPatternLibraryInput,
  isPcsPatternLibraryDialogOpen,
} from '../pages/pcs-pattern-library'
import {
  handlePcsPatternLibraryCreateEvent,
  handlePcsPatternLibraryCreateInput,
  isPcsPatternLibraryCreateDialogOpen,
} from '../pages/pcs-pattern-library-create'
import {
  handlePcsPatternLibraryDetailEvent,
  handlePcsPatternLibraryDetailInput,
  isPcsPatternLibraryDetailDialogOpen,
} from '../pages/pcs-pattern-library-detail'
import {
  handlePcsPatternLibraryConfigEvent,
  handlePcsPatternLibraryConfigInput,
  isPcsPatternLibraryConfigDialogOpen,
} from '../pages/pcs-pattern-library-config'
import {
  handlePcsLiveTestingEvent,
  handlePcsLiveTestingInput,
  isPcsLiveTestingDialogOpen,
} from '../pages/pcs-live-testing'
import {
  handlePcsVideoTestingEvent,
  handlePcsVideoTestingInput,
  isPcsVideoTestingDialogOpen,
} from '../pages/pcs-video-testing'
import {
  handlePcsChannelStoresEvent,
  handlePcsChannelStoresInput,
  isPcsChannelStoresDialogOpen,
} from '../pages/pcs-channel-stores'
import {
  handlePcsSampleLedgerEvent,
  handlePcsSampleLedgerInput,
  isPcsSampleLedgerDialogOpen,
} from '../pages/pcs-sample-ledger'
import {
  handlePcsSampleInventoryEvent,
  handlePcsSampleInventoryInput,
  isPcsSampleInventoryDialogOpen,
} from '../pages/pcs-sample-inventory'
import {
  handlePcsSampleTransferEvent,
  handlePcsSampleTransferInput,
  isPcsSampleTransferDialogOpen,
} from '../pages/pcs-sample-transfer'
import {
  handlePcsSampleReturnEvent,
  handlePcsSampleReturnInput,
  isPcsSampleReturnDialogOpen,
} from '../pages/pcs-sample-return'
import {
  handlePcsSampleApplicationEvent,
  handlePcsSampleApplicationInput,
  isPcsSampleApplicationDialogOpen,
} from '../pages/pcs-sample-application'
import {
  handlePcsSampleViewEvent,
  handlePcsSampleViewInput,
  isPcsSampleViewDialogOpen,
} from '../pages/pcs-sample-view'
import {
  handlePcsProductArchiveEvent,
  handlePcsProductArchiveInput,
  isPcsProductArchiveDialogOpen,
} from '../pages/pcs-product-archives'
import {
  handlePcsProjectsEvent,
  handlePcsProjectsInput,
  isPcsProjectsDialogOpen,
} from '../pages/pcs-projects'
import {
  handlePcsConfigWorkspaceEvent,
  handlePcsConfigWorkspaceInput,
  isPcsConfigWorkspaceDialogOpen,
} from '../pages/pcs-config-workspace'
import {
  handlePcsTemplatesEvent,
  handlePcsTemplatesInput,
  isPcsTemplatesDialogOpen,
} from '../pages/pcs-templates'
import {
  handlePcsWorkItemsEvent,
  handlePcsWorkItemsInput,
} from '../pages/pcs-work-items'
import {
  handlePcsEngineeringTaskEvent,
  handlePcsEngineeringTaskInput,
  isPcsEngineeringTaskDialogOpen,
} from '../pages/pcs-engineering-tasks'
import {
  handleTechPackEvent,
  isTechPackDialogOpen,
} from '../pages/tech-pack'

export function dispatchPcsPageEvent(target: HTMLElement): boolean {
  return (
    handlePcsConfigWorkspaceEvent(target) ||
    handlePcsEngineeringTaskEvent(target) ||
    handleTechPackEvent(target) ||
    handlePcsLiveTestingEvent(target) ||
    handlePcsVideoTestingEvent(target) ||
    handlePcsChannelStoresEvent(target) ||
    handlePcsSampleLedgerEvent(target) ||
    handlePcsSampleInventoryEvent(target) ||
    handlePcsSampleTransferEvent(target) ||
    handlePcsSampleReturnEvent(target) ||
    handlePcsSampleApplicationEvent(target) ||
    handlePcsSampleViewEvent(target) ||
    handlePcsProductArchiveEvent(target) ||
    handlePcsProjectsEvent(target) ||
    handlePcsTemplatesEvent(target) ||
    handlePcsWorkItemsEvent(target) ||
    handlePcsPartTemplateLibraryEvent(target) ||
    handlePcsPatternLibraryEvent(target) ||
    handlePcsPatternLibraryCreateEvent(target) ||
    handlePcsPatternLibraryDetailEvent(target) ||
    handlePcsPatternLibraryConfigEvent(target)
  )
}

export function dispatchPcsInputEvent(target: Element): boolean {
  return (
    handlePcsConfigWorkspaceInput(target) ||
    handlePcsEngineeringTaskInput(target) ||
    handlePcsLiveTestingInput(target) ||
    handlePcsVideoTestingInput(target) ||
    handlePcsChannelStoresInput(target) ||
    handlePcsSampleLedgerInput(target) ||
    handlePcsSampleInventoryInput(target) ||
    handlePcsSampleTransferInput(target) ||
    handlePcsSampleReturnInput(target) ||
    handlePcsSampleApplicationInput(target) ||
    handlePcsSampleViewInput(target) ||
    handlePcsProductArchiveInput(target) ||
    handlePcsProjectsInput(target) ||
    handlePcsTemplatesInput(target) ||
    handlePcsWorkItemsInput(target) ||
    handlePcsPartTemplateLibraryInput(target) ||
    handlePcsPatternLibraryInput(target) ||
    handlePcsPatternLibraryCreateInput(target) ||
    handlePcsPatternLibraryDetailInput(target) ||
    handlePcsPatternLibraryConfigInput(target)
  )
}

export function closePcsDialogsOnEscape(): boolean {
  if (isPcsConfigWorkspaceDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsConfigWorkspaceAction = 'close-all-dialogs'
    handlePcsConfigWorkspaceEvent(fakeButton)
    return true
  }

  if (isPcsEngineeringTaskDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsEngineeringAction = 'close-all-engineering-dialogs'
    handlePcsEngineeringTaskEvent(fakeButton)
    return true
  }

  if (isTechPackDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.techAction = 'close-dialog'
    handleTechPackEvent(fakeButton)
    return true
  }

  if (isPcsProjectsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsProjectAction = 'close-dialogs'
    handlePcsProjectsEvent(fakeButton)
    return true
  }

  if (isPcsLiveTestingDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsLiveTestingAction = 'close-dialogs'
    handlePcsLiveTestingEvent(fakeButton)
    return true
  }

  if (isPcsVideoTestingDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsVideoTestingAction = 'close-dialogs'
    handlePcsVideoTestingEvent(fakeButton)
    return true
  }

  if (isPcsChannelStoresDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsChannelStoreAction = 'close-dialogs'
    handlePcsChannelStoresEvent(fakeButton)
    return true
  }

  if (isPcsSampleLedgerDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsSampleLedgerAction = 'close-detail'
    handlePcsSampleLedgerEvent(fakeButton)
    return true
  }

  if (isPcsSampleInventoryDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsSampleInventoryAction = 'close-detail'
    handlePcsSampleInventoryEvent(fakeButton)
    return true
  }

  if (isPcsSampleTransferDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsSampleTransferAction = 'close-detail'
    handlePcsSampleTransferEvent(fakeButton)
    return true
  }

  if (isPcsSampleReturnDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsSampleReturnAction = 'close-detail'
    handlePcsSampleReturnEvent(fakeButton)
    fakeButton.dataset.pcsSampleReturnAction = 'close-create-drawer'
    handlePcsSampleReturnEvent(fakeButton)
    return true
  }

  if (isPcsSampleApplicationDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsSampleApplicationAction = 'close-detail'
    handlePcsSampleApplicationEvent(fakeButton)
    fakeButton.dataset.pcsSampleApplicationAction = 'close-create-drawer'
    handlePcsSampleApplicationEvent(fakeButton)
    return true
  }

  if (isPcsSampleViewDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsSampleViewAction = 'close-detail'
    handlePcsSampleViewEvent(fakeButton)
    return true
  }

  if (isPcsProductArchiveDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsProductArchiveAction = 'close-drawers'
    handlePcsProductArchiveEvent(fakeButton)
    return true
  }

  if (isPcsTemplatesDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.pcsTemplateAction = 'close-dialogs'
    handlePcsTemplatesEvent(fakeButton)
    return true
  }

  if (isPcsPatternLibraryDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.patternLibraryAction = 'close-preview'
    handlePcsPatternLibraryEvent(fakeButton)
    fakeButton.dataset.patternLibraryAction = 'close-batch-drawer'
    handlePcsPatternLibraryEvent(fakeButton)
    return true
  }

  if (isPcsPartTemplateLibraryDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.partTemplateAction = 'close-detail-drawer'
    handlePcsPartTemplateLibraryEvent(fakeButton)
    fakeButton.dataset.partTemplateAction = 'close-create-drawer'
    handlePcsPartTemplateLibraryEvent(fakeButton)
    return true
  }

  if (isPcsPatternLibraryCreateDialogOpen()) {
    return false
  }

  if (isPcsPatternLibraryDetailDialogOpen()) {
    return false
  }

  if (isPcsPatternLibraryConfigDialogOpen()) {
    return false
  }

  return false
}
