// 系统类型
export interface System {
  id: string
  name: string
  shortName: string
  defaultPage: string
}

// 菜单项类型
export interface MenuItem {
  key: string
  title: string
  icon?: string
  href?: string
  children?: MenuItem[]
}

// 菜单分组类型
export interface MenuGroup {
  title: string
  items: MenuItem[]
}

// Tab 类型
export interface Tab {
  key: string
  title: string
  href: string
  closable: boolean
}

// 系统 Tabs 状态
export interface SystemTabs {
  systemId: string
  tabs: Tab[]
  activeKey: string
}

// 全部系统的 Tabs 映射
export type AllSystemTabs = Record<string, SystemTabs>
