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
  handlePcsProjectsEvent,
  handlePcsProjectsInput,
  isPcsProjectsDialogOpen,
} from '../pages/pcs-projects'
import {
  handlePcsTemplatesEvent,
  handlePcsTemplatesInput,
  isPcsTemplatesDialogOpen,
} from '../pages/pcs-templates'
import {
  handlePcsWorkItemsEvent,
  handlePcsWorkItemsInput,
} from '../pages/pcs-work-items'

export function dispatchPcsPageEvent(target: HTMLElement): boolean {
  return (
    handlePcsLiveTestingEvent(target) ||
    handlePcsVideoTestingEvent(target) ||
    handlePcsChannelStoresEvent(target) ||
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
    handlePcsLiveTestingInput(target) ||
    handlePcsVideoTestingInput(target) ||
    handlePcsChannelStoresInput(target) ||
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
