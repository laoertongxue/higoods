"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  CheckSquare,
  AlertTriangle,
  FolderKanban,
  FileText,
  Scissors,
  Droplet,
  Palette,
  TestTube,
  Store,
  ShoppingCart,
  Archive,
  Package,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shirt,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MenuItem {
  id: string
  label: string
  icon: any
  href?: string
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  {
    id: "workspace",
    label: "工作台",
    icon: LayoutDashboard,
    children: [
      { id: "overview", label: "概览看板", icon: LayoutDashboard, href: "/workspace/overview" },
      { id: "todos", label: "我的待办", icon: CheckSquare, href: "/workspace/todos" },
      { id: "alerts", label: "风险提醒", icon: AlertTriangle, href: "/workspace/alerts" },
    ],
  },
  {
    id: "project",
    label: "商品项目管理",
    icon: FolderKanban,
    children: [
      { id: "project-list", label: "商品项目列表", icon: FolderKanban, href: "/" },
      { id: "template", label: "项目模板管理", icon: FileText, href: "/templates" },
      { id: "work-items", label: "工作项库", icon: CheckSquare, href: "/work-items" },
    ],
  },
  {
    id: "testing-channel",
    label: "测款与渠道管理",
    icon: TestTube,
    children: [
      { id: "live-testing", label: "直播场次", icon: TestTube, href: "/testing/live" },
      { id: "video-testing", label: "短视频记录", icon: TestTube, href: "/testing/video" },
      { id: "channel-products", label: "渠道商品管理", icon: ShoppingCart, href: "/channels/products" },
      { id: "channel-stores", label: "渠道店铺管理", icon: Store, href: "/channels/stores" },
    ],
  },
  {
    id: "sample-asset",
    label: "样衣资产管理",
    icon: Shirt,
    children: [
      { id: "sample-ledger", label: "样衣台账", icon: Archive, href: "/samples/ledger" },
      { id: "sample-inventory", label: "样衣库存", icon: Package, href: "/samples/inventory" },
      { id: "sample-transfer", label: "样衣流转记录", icon: Layers, href: "/samples/transfer" },
      { id: "sample-return", label: "样衣退货与处理", icon: AlertTriangle, href: "/samples/return" },
      { id: "sample-application", label: "样衣使用申请", icon: CheckSquare, href: "/samples/application" },
      { id: "sample-view", label: "样衣视图", icon: Palette, href: "/samples/view" },
    ],
  },
  {
    id: "pattern-production",
    label: "制版与生产准备",
    icon: Scissors,
    children: [
      { id: "revision-tasks", label: "改版任务", icon: FileText, href: "/patterns/revision" },
      { id: "pattern-tasks", label: "制版任务", icon: Scissors, href: "/patterns" },
      { id: "color-tasks", label: "花型任务", icon: Palette, href: "/patterns/colors" },
      { id: "first-sample", label: "首单样衣打样", icon: Droplet, href: "/samples/first-order" },
      { id: "pre-production", label: "产前版样衣", icon: CheckSquare, href: "/production/pre-check" },
    ],
  },
  {
    id: "product-archive",
    label: "商品档案",
    icon: Archive,
    children: [
      { id: "spu-list", label: "商品档案 - SPU", icon: Archive, href: "/products/spu" },
      { id: "sku-list", label: "商品档案 - SKU", icon: Package, href: "/products/sku" },
      { id: "yarn-list", label: "原料档案 - 纱线", icon: Layers, href: "/products/yarn" },
    ],
  },
  {
    id: "system-settings",
    label: "系统设置",
    icon: Settings,
    children: [
      { id: "config-workspace", label: "配置工作台", icon: Settings, href: "/settings/config-workspace" },
      { id: "template-center", label: "模板中心", icon: FileText, href: "/settings/template-center" },
      { id: "platform-config", label: "平台对接配置", icon: Settings, href: "/settings/platforms" },
    ],
  },
]

export function SidebarNav() {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([
    "workspace",
    "project",
    "testing-channel",
    "sample-asset",
    "pattern-production",
    "product-archive",
    "system-settings",
  ])
  const pathname = usePathname()

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  return (
    <div
      className={cn(
        "border-r border-border bg-card transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex flex-col h-full">
        {/* Toggle Button */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          {!collapsed && <span className="text-sm font-semibold text-foreground">商品中心系统</span>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn("p-1.5", collapsed && "mx-auto")}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isExpanded = expandedItems.includes(item.id)
              const hasActiveChild = item.children?.some((child) => child.href === pathname)

              return (
                <div key={item.id}>
                  {/* Parent Item */}
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                      "hover:bg-muted/50 text-foreground",
                      hasActiveChild && "bg-primary/10 text-primary",
                      collapsed && "justify-center",
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="text-sm flex-1 text-left">{item.label}</span>}
                  </button>

                  {/* Child Items */}
                  {!collapsed && isExpanded && item.children && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-border pl-3">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon
                        const isActive = child.href === pathname
                        return (
                          <Link
                            key={child.id}
                            href={child.href || "#"}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                            )}
                          >
                            <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{child.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
