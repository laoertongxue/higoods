'use client'

import { useState } from 'react'
import { usePathname } from '@/lib/navigation'
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Package,
  Boxes,
  Shirt,
  FolderTree,
  Settings,
  FileText,
  Building2,
  FileSignature,
  Calendar,
  ClipboardList,
  ShieldCheck,
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Video,
  Tv,
  Users,
  ShoppingCart,
  RotateCcw,
  Headphones,
  BarChart3,
  PieChart,
  Wallet,
  LayoutDashboard,
  FileBarChart,
  TrendingUp,
  PanelLeftClose,
  PanelLeft,
  // FCS icons
  ListTodo,
  AlertTriangle,
  Factory,
  Tags,
  Receipt,
  ToggleLeft,
  Inbox,
  FilePlus2,
  CalendarClock,
  Warehouse,
  GitPullRequest,
  Workflow,
  Route,
  Split,
  Network,
  CheckSquare,
  Shuffle,
  Gavel,
  BadgeCheck,
  Siren,
  KanbanSquare,
  Search,
  BellRing,
  ScanLine,
  PackageSearch,
  RefreshCw,
  ClipboardCheck,
  Repeat2,
  Calculator,
  Scale,
  FileDown,
  SlidersHorizontal,
  ClipboardSignature,
  ArrowLeftRight,
  History,
  Fingerprint,
  Merge,
  SearchCheck,
  LineChart,
  AlertOctagon,
  Filter,
  Settings2,
  Smartphone,
  LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useAppShell } from './app-shell-context'
import type { MenuItem } from '@/lib/types'

// 图标映射
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Layers,
  Package,
  Boxes,
  Shirt,
  FolderTree,
  Settings,
  FileText,
  Building2,
  FileSignature,
  Calendar,
  ClipboardList,
  ShieldCheck,
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Video,
  Tv,
  Users,
  ShoppingCart,
  RotateCcw,
  Headphones,
  BarChart3,
  PieChart,
  Wallet,
  LayoutDashboard,
  FileBarChart,
  TrendingUp,
  // FCS icons
  ListTodo,
  AlertTriangle,
  Factory,
  Tags,
  Receipt,
  ToggleLeft,
  Inbox,
  FilePlus2,
  CalendarClock,
  Warehouse,
  GitPullRequest,
  Workflow,
  Route,
  Split,
  Network,
  CheckSquare,
  Shuffle,
  Gavel,
  BadgeCheck,
  Siren,
  KanbanSquare,
  Search,
  BellRing,
  ScanLine,
  PackageSearch,
  RefreshCw,
  ClipboardCheck,
  Repeat2,
  Calculator,
  Scale,
  FileDown,
  SlidersHorizontal,
  ClipboardSignature,
  ArrowLeftRight,
  History,
  Fingerprint,
  Merge,
  SearchCheck,
  LineChart,
  AlertOctagon,
  Filter,
  Settings2,
  Smartphone,
  LayoutGrid,
}

function getIcon(iconName?: string) {
  if (!iconName) return null
  const Icon = iconMap[iconName]
  return Icon ? <Icon className="h-4 w-4" /> : null
}

function MenuItemComponent({ item, collapsed }: { item: MenuItem; collapsed: boolean }) {
  const pathname = usePathname()
  const { handleOpenTab } = useAppShell()
  const [expanded, setExpanded] = useState(false)
  
  const isActive = item.href === pathname
  const hasChildren = item.children && item.children.length > 0
  const isChildActive = hasChildren && item.children?.some(child => child.href === pathname)
  
  const handleClick = () => {
    if (hasChildren) {
      setExpanded(!expanded)
    } else if (item.href) {
      handleOpenTab({
        key: item.key,
        title: item.title,
        href: item.href,
        closable: true,
      })
    }
  }
  
  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          (isActive || isChildActive) && 'bg-blue-50 text-blue-600',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? item.title : undefined}
      >
        {getIcon(item.icon)}
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.title}</span>
            {hasChildren && (
              expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            )}
          </>
        )}
      </button>
      
      {/* 子菜单 */}
      {hasChildren && expanded && !collapsed && (
        <div className="ml-4 mt-1 space-y-1 border-l pl-3">
          {item.children!.map((child) => (
            <button
              key={child.key}
              onClick={() => {
                if (child.href) {
                  handleOpenTab({
                    key: child.key,
                    title: child.title,
                    href: child.href,
                    closable: true,
                  })
                }
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                child.href === pathname && 'bg-blue-50 text-blue-600'
              )}
            >
              {getIcon(child.icon)}
              {child.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MenuGroupComponent({ 
  group, 
  index, 
  collapsed 
}: { 
  group: { title: string; items: MenuItem[] }; 
  index: number; 
  collapsed: boolean 
}) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(true)
  
  // 检查当前分组是否有活跃菜单项
  const hasActiveItem = group.items.some(item => item.href === pathname)
  
  if (collapsed) {
    return (
      <div>
        {index > 0 && <div className="my-2 border-t" />}
        <div className="space-y-1">
          {group.items.map((item) => (
            <MenuItemComponent key={item.key} item={item} collapsed={collapsed} />
          ))}
        </div>
      </div>
    )
  }
  
  return (
    <div>
      {/* 可点击的分组标题 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors rounded-md',
          'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          hasActiveItem && 'text-primary'
        )}
      >
        <span>{group.title}</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
      
      {/* 菜单项列表 */}
      {expanded && (
        <div className="mt-1 space-y-1">
          {group.items.map((item) => (
            <MenuItemComponent key={item.key} item={item} collapsed={collapsed} />
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarContent({ collapsed, showCollapseButton = true }: { collapsed: boolean; showCollapseButton?: boolean }) {
  const { currentMenus, currentSystem, sidebarCollapsed, setSidebarCollapsed } = useAppShell()
  
  return (
    <div className="flex h-full flex-col min-h-0">
      {/* 头部：系统名称 + 折叠按钮 */}
      <div className={cn(
        'flex items-center border-b h-14 shrink-0',
        collapsed ? 'justify-center px-2' : 'justify-between px-4'
      )}>
        {!collapsed && currentSystem && (
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold truncate">{currentSystem.name}</h2>
            <p className="text-xs text-muted-foreground">{currentSystem.shortName}</p>
          </div>
        )}
        {showCollapseButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={collapsed ? '展开菜单' : '收起菜单'}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        )}
      </div>
      
      {/* 菜单列表 - 可滚动区域 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={cn('space-y-3 py-3', collapsed ? 'px-2' : 'px-3')}>
          {currentMenus.map((group, index) => (
            <MenuGroupComponent 
              key={index} 
              group={group} 
              index={index} 
              collapsed={collapsed} 
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function LeftSidebar() {
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed } = useAppShell()
  
  return (
    <>
      {/* 桌面端侧边栏 */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r bg-background transition-all duration-300 min-h-0',
          sidebarCollapsed ? 'w-16' : 'w-60'
        )}
      >
        <SidebarContent collapsed={sidebarCollapsed} />
      </aside>
      
      {/* 移动端 Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent collapsed={false} showCollapseButton={false} />
        </SheetContent>
      </Sheet>
    </>
  )
}
