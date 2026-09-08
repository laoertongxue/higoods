import type { MenuGroup, MenuItem } from '../data/app-shell-types'
import type { RouteRegistry } from './route-types'
import { renderWlsFabricDemandBoardPage, renderWlsInboundPage, renderWlsFinishedInboundPage } from './route-renderers'
import { normalizePathname, renderRouteRedirect } from './route-utils'

function createAsyncRenderer<TArgs extends unknown[]>(
  importModule: () => Promise<Record<string, unknown>>,
  exportName: string,
): (...args: TArgs) => Promise<string> {
  let modulePromise: Promise<Record<string, unknown>> | null = null

  return async (...args: TArgs): Promise<string> => {
    if (!modulePromise) {
      modulePromise = importModule().catch((error) => {
        modulePromise = null
        throw error
      })
    }

    const module = await modulePromise
    const renderer = module[exportName]

    if (typeof renderer !== 'function') {
      throw new Error(`页面渲染函数不存在: ${exportName}`)
    }

    return (renderer as (...rendererArgs: unknown[]) => Promise<string>)(...args)
  }
}

const renderFcsWorkbenchOverviewPage = createAsyncRenderer(
  () => import('../pages/workbench'),
  'renderOverviewPage',
)

const renderPlaceholderPage = createAsyncRenderer(
  () => import('../pages/placeholder'),
  'renderPlaceholderPage',
)
const renderRouteNotFound = createAsyncRenderer(() => import('../pages/placeholder'), 'renderRouteNotFound')
const renderWlsAccessoryReceiptsPage = createAsyncRenderer(
  () => import('../pages/wls-accessory-receipts'),
  'renderWlsAccessoryReceiptsPage',
)
const renderPmsPurchaseOrdersPage = createAsyncRenderer(
  () => import('../pages/pms-purchase-orders'),
  'renderPmsPurchaseOrdersPage',
)
const renderWlsGarmentSpuReplacementsPage = createAsyncRenderer(
  () => import('../pages/garment-spu-replacements'),
  'renderWlsGarmentSpuReplacementsPage',
)
const renderWlsGarmentRelabelTasksPage = createAsyncRenderer(
  () => import('../pages/wls-garment-relabel-tasks'),
  'renderWlsGarmentRelabelTasksPage',
)
const renderSewingOutsourcingWorkbenchPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/workbench'),
  'renderSewingOutsourcingWorkbenchPage',
)
const renderSewingOutsourcingTeamWorkbenchPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/workbench'),
  'renderSewingOutsourcingTeamWorkbenchPage',
)
const renderSewingOutsourcingTasksPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/tasks'),
  'renderSewingOutsourcingTasksPage',
)
const renderSewingCutPieceHandoverPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/cut-piece-handover'),
  'renderSewingCutPieceHandoverPage',
)
const renderSampleApprovalSuggestionsPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/sample-approval-suggestions'),
  'renderSampleApprovalSuggestionsPage',
)
const renderSewingMaterialHandoverPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/material-handover'),
  'renderSewingMaterialHandoverPage',
)
const renderSewingOutsourcingSupplementsPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/supplements'),
  'renderSewingOutsourcingSupplementsPage',
)
const renderSewingOutsourcingCutPieceReturnsPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/cut-piece-returns'),
  'renderSewingOutsourcingCutPieceReturnsPage',
)
const renderSewingOutsourcingReturnsPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/returns'),
  'renderSewingOutsourcingReturnsPage',
)
const renderSewingOutsourcingResponsibilityTransfersPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/responsibility-transfers'),
  'renderSewingOutsourcingResponsibilityTransfersPage',
)
const renderSewingOutsourcingMigrationAuditPage = createAsyncRenderer(
  () => import('../pages/sewing-outsourcing/migration-audit'),
  'renderSewingOutsourcingMigrationAuditPage',
)

const exactBaseRoutes: Record<string, () => string | Promise<string>> = {
  '/': async () => {
    return renderFcsWorkbenchOverviewPage()
  },
  '/pcs': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
  '/pcs/workspace': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
  '/fcs/workspace': () => renderRouteRedirect('/fcs/workbench/overview', '正在跳转到工厂生产协同工作台'),
  '/fcs': () => renderRouteRedirect('/fcs/workbench/overview', '正在跳转到工厂生产协同工作台'),
  '/pms/purchase-order': () => renderPmsPurchaseOrdersPage(),
  '/wls': () => renderRouteRedirect('/wls/fabric-demand-board', '正在跳转到面料需求看板'),
  '/wls/fabric-demand-board': () => renderWlsFabricDemandBoardPage(),
  '/wls/inbound': () => renderWlsInboundPage(),
  '/wls/finished-inbound': () => renderWlsFinishedInboundPage(),
  '/wls/accessory-receipts': () => renderWlsAccessoryReceiptsPage(),
  '/wls/garment-spu-replacements': () => renderWlsGarmentSpuReplacementsPage(),
  '/wls/garment-relabel-tasks': () => renderWlsGarmentRelabelTasksPage(),
  // PPIC 是独立且高频的协同入口，直接按页面懒加载，避免先加载整套 FCS 路由及其无关业务依赖。
  '/fcs/sewing-outsourcing/workbench': () => renderSewingOutsourcingWorkbenchPage(),
  '/fcs/sewing-outsourcing/team-workbench': () => renderSewingOutsourcingTeamWorkbenchPage(),
  '/fcs/sewing-outsourcing/tasks': () => renderSewingOutsourcingTasksPage(),
  '/fcs/sewing-outsourcing/cut-piece-handover': () => renderSewingCutPieceHandoverPage(),
  '/fcs/sewing-outsourcing/sample-approval-suggestions': () => renderSampleApprovalSuggestionsPage(),
  '/fcs/sewing-outsourcing/material-handover': () => renderSewingMaterialHandoverPage(),
  '/fcs/sewing-outsourcing/supplements': () => renderSewingOutsourcingSupplementsPage(),
  '/fcs/sewing-outsourcing/cut-piece-returns': () => renderSewingOutsourcingCutPieceReturnsPage(),
  '/fcs/sewing-outsourcing/returns': () => renderSewingOutsourcingReturnsPage(),
  '/fcs/sewing-outsourcing/responsibility-transfers': () => renderSewingOutsourcingResponsibilityTransfersPage(),
  '/fcs/sewing-outsourcing/migration-audit': () => renderSewingOutsourcingMigrationAuditPage(),
}

let fcsRoutesPromise: Promise<RouteRegistry> | null = null
let pcsRoutesPromise: Promise<RouteRegistry> | null = null
let pdaRoutesPromise: Promise<RouteRegistry> | null = null

function getFcsRoutes(): Promise<RouteRegistry> {
  if (!fcsRoutesPromise) {
    fcsRoutesPromise = import('./routes-fcs')
      .then((module) => module.routes)
      .catch((error) => {
        fcsRoutesPromise = null
        throw error
      })
  }
  return fcsRoutesPromise
}

function getPcsRoutes(): Promise<RouteRegistry> {
  if (!pcsRoutesPromise) {
    pcsRoutesPromise = import('./routes-pcs')
      .then((module) => module.routes)
      .catch((error) => {
        pcsRoutesPromise = null
        throw error
      })
  }
  return pcsRoutesPromise
}

function getPdaRoutes(): Promise<RouteRegistry> {
  if (!pdaRoutesPromise) {
    pdaRoutesPromise = import('./routes-pda')
      .then((module) => module.routes)
      .catch((error) => {
        pdaRoutesPromise = null
        throw error
      })
  }
  return pdaRoutesPromise
}

function getRoutesByPathname(normalizedPathname: string): Promise<RouteRegistry | null> {
  if (normalizedPathname.startsWith('/fcs/pda')) {
    return getPdaRoutes()
  }

  if (normalizedPathname.startsWith('/fcs')) {
    return getFcsRoutes()
  }

  if (normalizedPathname.startsWith('/pcs')) {
    return getPcsRoutes()
  }

  return Promise.resolve(null)
}

async function findMenuByPath(pathname: string): Promise<{ group: MenuGroup; item: MenuItem } | null> {
  // 路由模块由主入口按系统懒加载。这里若静态反向引用 AppShell 配置，
  // 生产构建会形成 main -> routes -> main 的 chunk 循环，刷新时可能拿到未完成的模块。
  // 只有正式路由未命中、需要查菜单兜底页时才读取菜单配置。
  const { menusBySystem } = await import('../data/app-shell-config')
  const normalizedPathname = normalizePathname(pathname)
  const allGroups = Object.values(menusBySystem).flat()

  for (const group of allGroups) {
    for (const item of group.items) {
      if (item.href === normalizedPathname) {
        return { group, item }
      }

      if (item.children) {
        const child = item.children.find((childItem) => childItem.href === normalizedPathname)
        if (child) {
          return { group, item: child }
        }
      }
    }
  }

  return null
}

function resolveFromRegistry(
  registry: RouteRegistry,
  normalizedPathname: string,
): Promise<string | null> {
  const directRenderer = registry.exactRoutes[normalizedPathname]
  if (directRenderer) {
    return Promise.resolve(directRenderer(normalizedPathname))
  }

  for (const route of registry.dynamicRoutes) {
    const matched = route.pattern.exec(normalizedPathname)
    if (matched) {
      return Promise.resolve(route.render(matched))
    }
  }

  return Promise.resolve(null)
}

export async function resolvePage(pathname: string): Promise<string> {
  const normalizedPathname = normalizePathname(pathname)

  const baseRenderer = exactBaseRoutes[normalizedPathname]
  if (baseRenderer) {
    return baseRenderer()
  }

  const registry = await getRoutesByPathname(normalizedPathname)
  if (registry) {
    const matchedContent = await resolveFromRegistry(registry, normalizedPathname)
    if (matchedContent !== null) {
      return matchedContent
    }
  }

  const menu = await findMenuByPath(normalizedPathname)
  if (menu) {
    return renderPlaceholderPage(
      menu.item.title,
      `${menu.item.title} 页面已接入路由与菜单联动，待迁移完整 UI 与交互。`,
      menu.group.title,
    )
  }

  return renderRouteNotFound(pathname)
}
