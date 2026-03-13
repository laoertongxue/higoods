'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import type { System, MenuGroup, Tab, AllSystemTabs } from '@/lib/types'
import { getInitialTabs, openTab, closeTab, activateTab } from '@/lib/tabs-store'

// ---- Pure in-memory page path store ----
// Never touches window.location or history.pushState to avoid v0 runtime RSC interception.
let _currentPath = '/fcs/factories/profile'
const _listeners = new Set<() => void>()

/** Navigate to a path — pure React state, no URL change, no RSC fetch. */
export function spaNavigate(href: string) {
  if (_currentPath === href) return
  _currentPath = href
  _listeners.forEach(l => l())
}

function _subscribe(cb: () => void) {
  _listeners.add(cb)
  return () => { _listeners.delete(cb) }
}
function _getSnapshot() { return _currentPath }
function _getServerSnapshot() { return '/fcs/factories/profile' }

export function useSpaPathname() {
  return useSyncExternalStore(_subscribe, _getSnapshot, _getServerSnapshot)
}

interface AppShellContextType {
  // 系统相关
  systems: System[]
  currentSystem: System | null
  switchSystem: (systemId: string) => void
  
  // 菜单相关
  menusBySystem: Record<string, MenuGroup[]>
  currentMenus: MenuGroup[]
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  
  // Tabs 相关
  allTabs: AllSystemTabs
  currentTabs: Tab[]
  currentActiveKey: string
  handleOpenTab: (tab: Tab) => void
  handleCloseTab: (tabKey: string) => void
  handleActivateTab: (tabKey: string) => void
  // Aliases for convenience
  addTab: (tab: Tab) => void
  closeTab: (tabKey: string) => void
}

const AppShellContext = createContext<AppShellContextType | null>(null)

export function useAppShell() {
  const context = useContext(AppShellContext)
  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider')
  }
  return context
}

interface AppShellProviderProps {
  children: React.ReactNode
  systems: System[]
  menusBySystem: Record<string, MenuGroup[]>
  initialSystemId?: string
}

export function AppShellProvider({
  children,
  systems,
  menusBySystem,
  initialSystemId,
}: AppShellProviderProps) {
  const [allTabs, setAllTabs] = useState<AllSystemTabs>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = useSpaPathname()
  
  // 持久化侧边栏折叠状态
  const handleSetSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-collapsed', String(collapsed))
    }
  }, [])
  
  // 从路径解析当前系统，如果路径不匹配则使用 initialSystemId
  const currentSystem = React.useMemo(() => {
    const pathParts = pathname.split('/')
    const systemId = pathParts[1]
    const matched = systems.find(s => s.id === systemId)
    if (matched) return matched
    if (initialSystemId) return systems.find(s => s.id === initialSystemId) || systems[0]
    return systems[0]
  }, [pathname, systems, initialSystemId])
  
  // 当前系统的菜单
  const currentMenus = currentSystem ? menusBySystem[currentSystem.id] || [] : []
  
  // 当前系统的 tabs
  const currentTabs = (currentSystem && allTabs[currentSystem.id]?.tabs) || []
  const currentActiveKey = (currentSystem && allTabs[currentSystem.id]?.activeKey) || ''
  
  // 初始化 tabs 和侧边栏状态
  useEffect(() => {
    setAllTabs(getInitialTabs())
    // 从 localStorage 恢复侧边栏折叠状态
    const savedCollapsed = localStorage.getItem('sidebar-collapsed')
    if (savedCollapsed === 'true') {
      setSidebarCollapsed(true)
    }
    setMounted(true)
  }, [])
  
  // 导航辅助：PDA 路径使用真实页面跳转，其他路径使用内存 SPA 导航
  const navigate = useCallback((href: string) => {
    if (href.startsWith('/fcs/pda/') || href === '/fcs/pda') {
      window.location.href = href
    } else {
      spaNavigate(href)
    }
  }, [])

  // 切换系统
  const switchSystem = useCallback((systemId: string) => {
    const system = systems.find(s => s.id === systemId)
    if (system) {
      navigate(system.defaultPage)
    }
  }, [systems, navigate])
  
  // 打开 tab
  const handleOpenTab = useCallback((tab: Tab) => {
    if (!currentSystem) return
    setAllTabs(prev => openTab(prev, currentSystem.id, tab))
    navigate(tab.href)
  }, [currentSystem, navigate])
  
  // 关闭 tab
  const handleCloseTab = useCallback((tabKey: string) => {
    if (!currentSystem) return
    const { tabs: newTabs, nextHref } = closeTab(
      allTabs,
      currentSystem.id,
      tabKey,
      currentSystem.defaultPage
    )
    setAllTabs(newTabs)
    if (nextHref) {
      navigate(nextHref)
    }
  }, [currentSystem, allTabs, navigate])
  
  // 激活 tab
  const handleActivateTab = useCallback((tabKey: string) => {
    if (!currentSystem) return
    const tab = currentTabs.find(t => t.key === tabKey)
    if (tab) {
      setAllTabs(prev => activateTab(prev, currentSystem.id, tabKey))
      navigate(tab.href)
    }
  }, [currentSystem, currentTabs, navigate])
  
  // 同步 URL 和 tabs
  useEffect(() => {
    if (!mounted || !currentSystem) return
    
    // 从 URL 解析当前页面
    const pathParts = pathname.split('/')
    if (pathParts.length >= 3) {
      const pageKey = pathParts.slice(2).join('/')
      
      // 查找对应的菜单项
      let menuItem: { key: string; title: string; href: string } | null = null
      for (const group of currentMenus) {
        for (const item of group.items) {
          if (item.href === pathname) {
            menuItem = { key: item.key, title: item.title, href: item.href }
            break
          }
          if (item.children) {
            for (const child of item.children) {
              if (child.href === pathname) {
                menuItem = { key: child.key, title: child.title, href: child.href }
                break
              }
            }
          }
        }
        if (menuItem) break
      }
      
      // 如果找到菜单项，打开对应的 tab
      if (menuItem) {
        const existingTab = currentTabs.find(t => t.key === menuItem!.key)
        if (!existingTab) {
          setAllTabs(prev => openTab(prev, currentSystem.id, {
            key: menuItem!.key,
            title: menuItem!.title,
            href: menuItem!.href,
            closable: true,
          }))
        } else if (currentActiveKey !== menuItem.key) {
          setAllTabs(prev => activateTab(prev, currentSystem.id, menuItem!.key))
        }
      }
    }
  }, [pathname, mounted, currentSystem, currentMenus, currentTabs, currentActiveKey])
  
  return (
    <AppShellContext.Provider
      value={{
        systems,
        currentSystem,
        switchSystem,
        menusBySystem,
        currentMenus,
        sidebarOpen,
        setSidebarOpen,
        sidebarCollapsed,
        setSidebarCollapsed: handleSetSidebarCollapsed,
        allTabs,
        currentTabs,
        currentActiveKey,
        handleOpenTab,
        handleCloseTab,
        handleActivateTab,
        // Aliases
        addTab: handleOpenTab,
        closeTab: handleCloseTab,
      }}
    >
      {children}
    </AppShellContext.Provider>
  )
}
