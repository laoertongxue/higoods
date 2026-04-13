import { menusBySystem } from '../data/app-shell-config'
import type { MenuGroup, MenuItem } from '../data/app-shell-types'
import type { RouteRegistry } from './route-types'
import { normalizePathname, renderRouteRedirect } from './route-utils'

function createAsyncRenderer<TArgs extends unknown[]>(
  importModule: () => Promise<Record<string, unknown>>,
  exportName: string,
): (...args: TArgs) => Promise<string> {
  let modulePromise: Promise<Record<string, unknown>> | null = null

  return async (...args: TArgs): Promise<string> => {
    if (!modulePromise) {
      modulePromise = importModule()
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

const exactBaseRoutes: Record<string, () => Promise<string>> = {
  '/': async () => {
    return renderFcsWorkbenchOverviewPage()
  },
  '/pcs': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
  '/pcs/workspace': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
  '/fcs/workspace': () => renderRouteRedirect('/fcs/workbench/overview', '正在跳转到工厂生产协同工作台'),
  '/fcs': () => renderRouteRedirect('/fcs/workbench/overview', '正在跳转到工厂生产协同工作台'),
}

let fcsRoutesPromise: Promise<RouteRegistry> | null = null
let pcsRoutesPromise: Promise<RouteRegistry> | null = null
let pdaRoutesPromise: Promise<RouteRegistry> | null = null

function getFcsRoutes(): Promise<RouteRegistry> {
  if (!fcsRoutesPromise) {
    // FCS 子路由包含按生产单查看的技术包快照页。
    fcsRoutesPromise = import('./routes-fcs').then((module) => module.routes)
  }
  return fcsRoutesPromise
}

function getPcsRoutes(): Promise<RouteRegistry> {
  if (!pcsRoutesPromise) {
    pcsRoutesPromise = import('./routes-pcs').then((module) => module.routes)
  }
  return pcsRoutesPromise
}

function getPdaRoutes(): Promise<RouteRegistry> {
  if (!pdaRoutesPromise) {
    pdaRoutesPromise = import('./routes-pda').then((module) => module.routes)
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

function findMenuByPath(pathname: string): { group: MenuGroup; item: MenuItem } | null {
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
    return directRenderer(normalizedPathname)
  }

  for (const route of registry.dynamicRoutes) {
    const matched = route.pattern.exec(normalizedPathname)
    if (matched) {
      return route.render(matched)
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

  const menu = findMenuByPath(normalizedPathname)
  if (menu) {
    return renderPlaceholderPage(
      menu.item.title,
      `${menu.item.title} 页面已接入路由与菜单联动，待迁移完整 UI 与交互。`,
      menu.group.title,
    )
  }

  return renderRouteNotFound(pathname)
}
