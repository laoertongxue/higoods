'use client'

import type { Tab, AllSystemTabs } from './types'
import { systems } from './mock-data'

const STORAGE_KEY = 'higood-tabs'

// 获取初始 tabs 状态
export function getInitialTabs(): AllSystemTabs {
  if (typeof window === 'undefined') {
    return createEmptyTabs()
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // ignore
  }
  
  return createEmptyTabs()
}

// 创建空的 tabs 状态
function createEmptyTabs(): AllSystemTabs {
  const tabs: AllSystemTabs = {}
  systems.forEach(system => {
    tabs[system.id] = {
      systemId: system.id,
      tabs: [],
      activeKey: '',
    }
  })
  return tabs
}

// 保存到 localStorage
export function saveTabs(tabs: AllSystemTabs) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
  } catch {
    // ignore
  }
}

// 打开或激活 tab
export function openTab(
  allTabs: AllSystemTabs,
  systemId: string,
  tab: Tab
): AllSystemTabs {
  const systemTabs = allTabs[systemId] || { systemId, tabs: [], activeKey: '' }
  const existingTab = systemTabs.tabs.find(t => t.key === tab.key)
  
  let newTabs: Tab[]
  if (existingTab) {
    newTabs = systemTabs.tabs
  } else {
    newTabs = [...systemTabs.tabs, tab]
  }
  
  const result = {
    ...allTabs,
    [systemId]: {
      ...systemTabs,
      tabs: newTabs,
      activeKey: tab.key,
    },
  }
  
  saveTabs(result)
  return result
}

// 关闭 tab
export function closeTab(
  allTabs: AllSystemTabs,
  systemId: string,
  tabKey: string,
  defaultHref: string
): { tabs: AllSystemTabs; nextHref: string | null } {
  const systemTabs = allTabs[systemId]
  if (!systemTabs) {
    return { tabs: allTabs, nextHref: null }
  }
  
  const tabIndex = systemTabs.tabs.findIndex(t => t.key === tabKey)
  if (tabIndex === -1) {
    return { tabs: allTabs, nextHref: null }
  }
  
  const newTabsList = systemTabs.tabs.filter(t => t.key !== tabKey)
  let nextHref: string | null = null
  let newActiveKey = systemTabs.activeKey
  
  // 如果关闭的是当前激活的 tab
  if (systemTabs.activeKey === tabKey) {
    if (newTabsList.length > 0) {
      // 切换到相邻的 tab
      const nextIndex = Math.min(tabIndex, newTabsList.length - 1)
      newActiveKey = newTabsList[nextIndex].key
      nextHref = newTabsList[nextIndex].href
    } else {
      // 没有 tab 了，回到默认首页
      newActiveKey = ''
      nextHref = defaultHref
    }
  }
  
  const result = {
    ...allTabs,
    [systemId]: {
      ...systemTabs,
      tabs: newTabsList,
      activeKey: newActiveKey,
    },
  }
  
  saveTabs(result)
  return { tabs: result, nextHref }
}

// 激活 tab
export function activateTab(
  allTabs: AllSystemTabs,
  systemId: string,
  tabKey: string
): AllSystemTabs {
  const systemTabs = allTabs[systemId]
  if (!systemTabs) return allTabs
  
  const result = {
    ...allTabs,
    [systemId]: {
      ...systemTabs,
      activeKey: tabKey,
    },
  }
  
  saveTabs(result)
  return result
}
