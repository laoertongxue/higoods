type HandlerModule = Record<string, unknown>

interface PcsCloseAction {
  datasetKey: string
  value: string
}

interface PcsHandlerSpec {
  cacheKey: string
  matches: (pathname: string) => boolean
  importModule: () => Promise<HandlerModule>
  eventExport?: string
  inputExport?: string
  dialogExport?: string
  closeActions?: PcsCloseAction[]
}

const handlerModuleCache = new Map<string, Promise<HandlerModule>>()

function isExactOrNestedPath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}

function isAnyExactOrNestedPath(pathname: string, basePaths: string[]): boolean {
  return basePaths.some((basePath) => isExactOrNestedPath(pathname, basePath))
}

function getCurrentPathname(): string {
  return window.location.pathname || ''
}

const PCS_HANDLER_SPECS: PcsHandlerSpec[] = [
  {
    cacheKey: 'pcs-projects-list',
    matches: (pathname) => pathname === '/pcs/projects',
    importModule: () => import('../pages/pcs-projects-list'),
    eventExport: 'handlePcsProjectListEvent',
    inputExport: 'handlePcsProjectListInput',
    dialogExport: 'isPcsProjectListDialogOpen',
  },
  {
    cacheKey: 'pcs-config-workspace',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/settings/config-workspace'),
    importModule: () => import('../pages/pcs-config-workspace'),
    eventExport: 'handlePcsConfigWorkspaceEvent',
    inputExport: 'handlePcsConfigWorkspaceInput',
    dialogExport: 'isPcsConfigWorkspaceDialogOpen',
    closeActions: [{ datasetKey: 'pcsConfigWorkspaceAction', value: 'close-all-dialogs' }],
  },
  {
    cacheKey: 'tech-pack',
    matches: (pathname) => /^\/pcs\/products\/styles\/[^/]+\/technical-data\/[^/]+$/.test(pathname),
    importModule: () => import('../pages/tech-pack'),
    eventExport: 'handleTechPackEvent',
    dialogExport: 'isTechPackDialogOpen',
    closeActions: [{ datasetKey: 'techAction', value: 'close-dialog' }],
  },
  {
    cacheKey: 'pcs-part-template-library',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/patterns/part-templates'),
    importModule: () => import('../pages/pcs-part-template-library'),
    eventExport: 'handlePcsPartTemplateLibraryEvent',
    inputExport: 'handlePcsPartTemplateLibraryInput',
    dialogExport: 'isPcsPartTemplateLibraryDialogOpen',
    closeActions: [
      { datasetKey: 'partTemplateAction', value: 'close-detail-drawer' },
      { datasetKey: 'partTemplateAction', value: 'close-create-drawer' },
    ],
  },
  {
    cacheKey: 'pcs-pattern-library-create',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/pattern-library/create'),
    importModule: () => import('../pages/pcs-pattern-library-create'),
    eventExport: 'handlePcsPatternLibraryCreateEvent',
    inputExport: 'handlePcsPatternLibraryCreateInput',
  },
  {
    cacheKey: 'pcs-pattern-library-config',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/pattern-library/config'),
    importModule: () => import('../pages/pcs-pattern-library-config'),
    eventExport: 'handlePcsPatternLibraryConfigEvent',
    inputExport: 'handlePcsPatternLibraryConfigInput',
  },
  {
    cacheKey: 'pcs-pattern-library-detail',
    matches: (pathname) => /^\/pcs\/pattern-library\/[^/]+$/.test(pathname),
    importModule: () => import('../pages/pcs-pattern-library-detail'),
    eventExport: 'handlePcsPatternLibraryDetailEvent',
    inputExport: 'handlePcsPatternLibraryDetailInput',
  },
  {
    cacheKey: 'pcs-pattern-library',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/pattern-library'),
    importModule: () => import('../pages/pcs-pattern-library'),
    eventExport: 'handlePcsPatternLibraryEvent',
    inputExport: 'handlePcsPatternLibraryInput',
    dialogExport: 'isPcsPatternLibraryDialogOpen',
    closeActions: [
      { datasetKey: 'patternLibraryAction', value: 'close-preview' },
      { datasetKey: 'patternLibraryAction', value: 'close-batch-drawer' },
    ],
  },
  {
    cacheKey: 'pcs-live-testing',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/testing/live'),
    importModule: () => import('../pages/pcs-live-testing'),
    eventExport: 'handlePcsLiveTestingEvent',
    inputExport: 'handlePcsLiveTestingInput',
    dialogExport: 'isPcsLiveTestingDialogOpen',
    closeActions: [{ datasetKey: 'pcsLiveTestingAction', value: 'close-dialogs' }],
  },
  {
    cacheKey: 'pcs-video-testing',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/testing/video'),
    importModule: () => import('../pages/pcs-video-testing'),
    eventExport: 'handlePcsVideoTestingEvent',
    inputExport: 'handlePcsVideoTestingInput',
    dialogExport: 'isPcsVideoTestingDialogOpen',
    closeActions: [{ datasetKey: 'pcsVideoTestingAction', value: 'close-dialogs' }],
  },
  {
    cacheKey: 'pcs-channel-stores',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/channels/stores'),
    importModule: () => import('../pages/pcs-channel-stores'),
    eventExport: 'handlePcsChannelStoresEvent',
    inputExport: 'handlePcsChannelStoresInput',
    dialogExport: 'isPcsChannelStoresDialogOpen',
    closeActions: [{ datasetKey: 'pcsChannelStoreAction', value: 'close-dialogs' }],
  },
  {
    cacheKey: 'pcs-product-archives',
    matches: (pathname) =>
      isAnyExactOrNestedPath(pathname, [
        '/pcs/products/styles',
        '/pcs/products/specifications',
        '/pcs/products/spu',
        '/pcs/products/sku',
      ]),
    importModule: () => import('../pages/pcs-product-archives'),
    eventExport: 'handlePcsProductArchiveEvent',
    inputExport: 'handlePcsProductArchiveInput',
    dialogExport: 'isPcsProductArchiveDialogOpen',
    closeActions: [{ datasetKey: 'pcsProductArchiveAction', value: 'close-drawers' }],
  },
  {
    cacheKey: 'pcs-material-archives',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/materials'),
    importModule: () => import('../pages/pcs-material-archives'),
    eventExport: 'handlePcsMaterialArchiveEvent',
    inputExport: 'handlePcsMaterialArchiveInput',
    dialogExport: 'isPcsMaterialArchiveDialogOpen',
    closeActions: [{ datasetKey: 'pcsMaterialArchiveAction', value: 'close-drawers' }],
  },
  {
    cacheKey: 'pcs-templates',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/templates'),
    importModule: () => import('../pages/pcs-templates'),
    eventExport: 'handlePcsTemplatesEvent',
    inputExport: 'handlePcsTemplatesInput',
    dialogExport: 'isPcsTemplatesDialogOpen',
    closeActions: [{ datasetKey: 'pcsTemplateAction', value: 'close-dialogs' }],
  },
  {
    cacheKey: 'pcs-work-items',
    matches: (pathname) => isExactOrNestedPath(pathname, '/pcs/work-items'),
    importModule: () => import('../pages/pcs-work-items'),
    eventExport: 'handlePcsWorkItemsEvent',
    inputExport: 'handlePcsWorkItemsInput',
  },
  {
    cacheKey: 'pcs-projects',
    matches: (pathname) => pathname.startsWith('/pcs/projects/'),
    importModule: () => import('../pages/pcs-projects'),
    eventExport: 'handlePcsProjectsEvent',
    inputExport: 'handlePcsProjectsInput',
    dialogExport: 'isPcsProjectsDialogOpen',
    closeActions: [{ datasetKey: 'pcsProjectAction', value: 'close-dialogs' }],
  },
  {
    cacheKey: 'pcs-engineering-tasks',
    matches: (pathname) =>
      isAnyExactOrNestedPath(pathname, [
        '/pcs/patterns',
        '/pcs/samples/first-sample',
        '/pcs/samples/first-order',
      ]),
    importModule: () => import('../pages/pcs-engineering-tasks'),
    eventExport: 'handlePcsEngineeringTaskEvent',
    inputExport: 'handlePcsEngineeringTaskInput',
    dialogExport: 'isPcsEngineeringTaskDialogOpen',
    closeActions: [{ datasetKey: 'pcsEngineeringAction', value: 'close-all-engineering-dialogs' }],
  },
]

function getActiveHandlerSpec(pathname = getCurrentPathname()): PcsHandlerSpec | null {
  return PCS_HANDLER_SPECS.find((spec) => spec.matches(pathname)) ?? null
}

function invokeBooleanExport<TArg>(module: HandlerModule, exportName: string | undefined, arg: TArg): boolean {
  if (!exportName) {
    return false
  }

  const handler = module[exportName]
  if (typeof handler !== 'function') {
    return false
  }

  return Boolean((handler as (value: TArg) => unknown)(arg))
}

function invokeDialogStateExport(module: HandlerModule, exportName: string | undefined): boolean {
  if (!exportName) {
    return false
  }

  const getter = module[exportName]
  if (typeof getter !== 'function') {
    return false
  }

  return Boolean((getter as () => unknown)())
}

async function loadHandlerModule(spec: PcsHandlerSpec): Promise<HandlerModule> {
  const cached = handlerModuleCache.get(spec.cacheKey)
  if (cached) {
    return cached
  }

  const modulePromise = spec.importModule().catch((error) => {
    handlerModuleCache.delete(spec.cacheKey)
    throw error
  })

  handlerModuleCache.set(spec.cacheKey, modulePromise)
  return modulePromise
}

export async function dispatchPcsPageEvent(target: HTMLElement): Promise<boolean> {
  const spec = getActiveHandlerSpec()
  if (!spec?.eventExport) {
    return false
  }

  const module = await loadHandlerModule(spec)
  return invokeBooleanExport(module, spec.eventExport, target)
}

export async function dispatchPcsInputEvent(target: Element): Promise<boolean> {
  const spec = getActiveHandlerSpec()
  if (!spec?.inputExport) {
    return false
  }

  const module = await loadHandlerModule(spec)
  return invokeBooleanExport(module, spec.inputExport, target)
}

export async function closePcsDialogsOnEscape(): Promise<boolean> {
  const spec = getActiveHandlerSpec()
  if (!spec?.eventExport || !spec.dialogExport || !spec.closeActions?.length) {
    return false
  }

  const module = await loadHandlerModule(spec)
  if (!invokeDialogStateExport(module, spec.dialogExport)) {
    return false
  }

  for (const closeAction of spec.closeActions) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset[closeAction.datasetKey] = closeAction.value
    invokeBooleanExport(module, spec.eventExport, fakeButton)
  }

  return true
}
