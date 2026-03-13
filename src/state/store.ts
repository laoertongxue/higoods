import { menusBySystem, systems } from '../data/app-shell-config'
import type { AllSystemTabs, MenuGroup, MenuItem, Tab } from '../data/app-shell-types'

export interface AppState {
  pathname: string
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  allTabs: AllSystemTabs
  expandedGroups: Record<string, boolean>
  expandedItems: Record<string, boolean>
}

type Listener = () => void

const TABS_STORAGE_KEY = 'higood-tabs'
const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed'

function createEmptyTabs(): AllSystemTabs {
  const tabs: AllSystemTabs = {}
  for (const system of systems) {
    tabs[system.id] = {
      systemId: system.id,
      tabs: [],
      activeKey: '',
    }
  }
  return tabs
}

function getStoredTabs(): AllSystemTabs {
  const emptyTabs = createEmptyTabs()

  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY)
    if (!raw) return emptyTabs

    const parsed = JSON.parse(raw) as AllSystemTabs
    for (const system of systems) {
      if (!parsed[system.id]) {
        parsed[system.id] = emptyTabs[system.id]
      }
    }

    return parsed
  } catch {
    return emptyTabs
  }
}

function saveTabs(allTabs: AllSystemTabs): void {
  try {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(allTabs))
  } catch {
    // ignore storage errors
  }
}

function getCurrentSystemId(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  const candidate = segments[0]
  const matched = systems.find((system) => system.id === candidate)
  return matched?.id ?? 'fcs'
}

function flattenMenus(groups: MenuGroup[]): MenuItem[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => [item, ...(item.children ?? [])]),
  )
}

function normalizePathname(pathname: string): string {
  return pathname.split('#')[0].split('?')[0] || '/'
}

function findMenuItemByPath(pathname: string): MenuItem | null {
  const normalizedPathname = normalizePathname(pathname)
  const systemId = getCurrentSystemId(normalizedPathname)
  const groups = menusBySystem[systemId] ?? []
  const item = flattenMenus(groups).find((menu) => menu.href === normalizedPathname)
  return item ?? null
}

function readSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
}

const defaultPath = '/fcs/workbench/overview'

class AppStore {
  private state: AppState = {
    pathname: defaultPath,
    sidebarOpen: false,
    sidebarCollapsed: false,
    allTabs: createEmptyTabs(),
    expandedGroups: {},
    expandedItems: {},
  }

  private listeners = new Set<Listener>()

  init(): void {
    this.state.allTabs = getStoredTabs()
    this.state.sidebarCollapsed = readSidebarCollapsed()

    const systemId = getCurrentSystemId(this.state.pathname)
    const systemTabs = this.state.allTabs[systemId]
    const hasValidActiveTab =
      !!systemTabs?.activeKey &&
      systemTabs.tabs.some((tab) => tab.key === systemTabs.activeKey)

    if (!hasValidActiveTab) {
      const fallback = systems.find((item) => item.id === systemId)?.defaultPage ?? defaultPath
      this.state.pathname = fallback
    }

    this.syncTabWithPath(this.state.pathname)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): AppState {
    return this.state
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }

  private patch(next: Partial<AppState>): void {
    this.state = { ...this.state, ...next }
    this.emit()
  }

  private syncTabWithPath(pathname: string): void {
    const systemId = getCurrentSystemId(pathname)
    const item = findMenuItemByPath(pathname)
    if (!item?.href) {
      return
    }

    const systemTabs = this.state.allTabs[systemId] ?? {
      systemId,
      tabs: [],
      activeKey: '',
    }

    const exists = systemTabs.tabs.find((tab) => tab.key === item.key)
    const nextTabs = exists
      ? systemTabs.tabs
      : [...systemTabs.tabs, { key: item.key, title: item.title, href: item.href, closable: true }]

    const nextAllTabs: AllSystemTabs = {
      ...this.state.allTabs,
      [systemId]: {
        ...systemTabs,
        tabs: nextTabs,
        activeKey: item.key,
      },
    }

    this.state.allTabs = nextAllTabs
    saveTabs(nextAllTabs)
  }

  navigate(pathname: string): void {
    if (this.state.pathname === pathname) return

    this.state.pathname = pathname
    this.syncTabWithPath(pathname)
    this.patch({ pathname })
  }

  switchSystem(systemId: string): void {
    const system = systems.find((item) => item.id === systemId)
    if (!system) return
    this.navigate(system.defaultPage)
  }

  openTab(tab: Tab): void {
    const systemId = getCurrentSystemId(tab.href)
    const systemTabs = this.state.allTabs[systemId] ?? {
      systemId,
      tabs: [],
      activeKey: '',
    }

    const exists = systemTabs.tabs.find((item) => item.key === tab.key)
    const tabs = exists ? systemTabs.tabs : [...systemTabs.tabs, tab]

    const nextAllTabs: AllSystemTabs = {
      ...this.state.allTabs,
      [systemId]: {
        ...systemTabs,
        tabs,
        activeKey: tab.key,
      },
    }

    this.state.allTabs = nextAllTabs
    saveTabs(nextAllTabs)
    this.patch({ allTabs: nextAllTabs, pathname: tab.href })
  }

  activateTab(tabKey: string): void {
    const systemId = getCurrentSystemId(this.state.pathname)
    const systemTabs = this.state.allTabs[systemId]
    if (!systemTabs) return

    const tab = systemTabs.tabs.find((item) => item.key === tabKey)
    if (!tab) return

    const nextAllTabs: AllSystemTabs = {
      ...this.state.allTabs,
      [systemId]: {
        ...systemTabs,
        activeKey: tabKey,
      },
    }

    this.state.allTabs = nextAllTabs
    saveTabs(nextAllTabs)
    this.patch({ allTabs: nextAllTabs, pathname: tab.href })
  }

  closeTab(tabKey: string): void {
    const systemId = getCurrentSystemId(this.state.pathname)
    const systemTabs = this.state.allTabs[systemId]
    if (!systemTabs) return

    const tabIndex = systemTabs.tabs.findIndex((item) => item.key === tabKey)
    if (tabIndex < 0) return

    const nextTabs = systemTabs.tabs.filter((item) => item.key !== tabKey)
    let nextActiveKey = systemTabs.activeKey
    let nextPath = this.state.pathname

    if (systemTabs.activeKey === tabKey) {
      if (nextTabs.length > 0) {
        const nextIndex = Math.min(tabIndex, nextTabs.length - 1)
        const nextTab = nextTabs[nextIndex]
        nextActiveKey = nextTab.key
        nextPath = nextTab.href
      } else {
        const fallback = systems.find((item) => item.id === systemId)?.defaultPage ?? defaultPath
        nextActiveKey = ''
        nextPath = fallback
      }
    }

    const nextAllTabs: AllSystemTabs = {
      ...this.state.allTabs,
      [systemId]: {
        ...systemTabs,
        tabs: nextTabs,
        activeKey: nextActiveKey,
      },
    }

    this.state.allTabs = nextAllTabs
    saveTabs(nextAllTabs)
    this.patch({ allTabs: nextAllTabs, pathname: nextPath })
  }

  setSidebarOpen(open: boolean): void {
    this.patch({ sidebarOpen: open })
  }

  toggleSidebarCollapsed(): void {
    const next = !this.state.sidebarCollapsed
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
    } catch {
      // ignore storage errors
    }
    this.patch({ sidebarCollapsed: next })
  }

  toggleGroup(groupKey: string): void {
    const nextValue = !this.state.expandedGroups[groupKey]
    this.patch({
      expandedGroups: {
        ...this.state.expandedGroups,
        [groupKey]: nextValue,
      },
    })
  }

  toggleItem(itemKey: string): void {
    const nextValue = !this.state.expandedItems[itemKey]
    this.patch({
      expandedItems: {
        ...this.state.expandedItems,
        [itemKey]: nextValue,
      },
    })
  }
}

export const appStore = new AppStore()

export function getCurrentSystem(pathname: string) {
  const systemId = getCurrentSystemId(pathname)
  return systems.find((system) => system.id === systemId) ?? systems[0]
}

export function getCurrentMenus(pathname: string): MenuGroup[] {
  const system = getCurrentSystem(pathname)
  return menusBySystem[system.id] ?? []
}

export function getCurrentTabs(pathname: string, allTabs: AllSystemTabs): {
  tabs: Tab[]
  activeKey: string
} {
  const system = getCurrentSystem(pathname)
  const systemTabs = allTabs[system.id]
  return {
    tabs: systemTabs?.tabs ?? [],
    activeKey: systemTabs?.activeKey ?? '',
  }
}
