"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingCart,
  Warehouse,
  Users,
  DollarSign,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const menuItems = [
  {
    title: "工作台",
    icon: LayoutDashboard,
    children: [
      { title: "采购看板", href: "/pms/dashboard" },
      { title: "待办任务", href: "/pms/todos" },
      { title: "费用价格", href: "/pms/pricing" },
    ],
  },
  {
    title: "采购需求",
    icon: ClipboardList,
    children: [
      { title: "采购需求列表", href: "/pms/requirements" },
      { title: "测款采购需求", href: "/pms/requirements/testing" },
      { title: "备货采购需求", href: "/pms/requirements/stocking" },
    ],
  },
  {
    title: "采购订单",
    icon: ShoppingCart,
    children: [
      { title: "采购订单列表", href: "/pms/orders" },
      { title: "订单执行跟踪", href: "/pms/orders/tracking" },
      { title: "订单变更与异常", href: "/pms/orders/changes" },
    ],
  },
  {
    title: "到货与入库",
    icon: Warehouse,
    children: [
      { title: "到货管理", href: "/pms/arrivals" },
      { title: "验收与退货", href: "/pms/inspection" },
      { title: "入库记录", href: "/pms/inventory" },
    ],
  },
  {
    title: "供应商管理",
    icon: Users,
    children: [
      { title: "供应商档案", href: "/pms/suppliers" },
      { title: "价格与协议", href: "/pms/suppliers/pricing" },
      { title: "绩效与分级", href: "/pms/suppliers/performance" },
    ],
  },
  {
    title: "结算与成本",
    icon: DollarSign,
    children: [
      { title: "采购对账", href: "/pms/settlement/reconciliation" },
      { title: "费用管理", href: "/pms/settlement/expenses" },
      { title: "付款管理", href: "/pms/settlement/payments" },
    ],
  },
  {
    title: "系统设置",
    icon: Settings,
    children: [
      { title: "采购分类", href: "/pms/settings/categories" },
      { title: "审批流程", href: "/pms/settings/approval" },
      { title: "采购规则", href: "/pms/settings/rules" },
    ],
  },
]

export function PmsSidebarNav() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "flex flex-col bg-slate-900 text-white transition-all duration-300 h-full",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        {!collapsed && <span className="font-semibold text-sm">采购管理系统</span>}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => (
          <MenuGroup key={item.title} item={item} collapsed={collapsed} pathname={pathname} />
        ))}
      </nav>
    </aside>
  )
}

function MenuGroup({
  item,
  collapsed,
  pathname,
}: {
  item: (typeof menuItems)[0]
  collapsed: boolean
  pathname: string
}) {
  const [expanded, setExpanded] = useState(true)
  const Icon = item.icon
  const isActive = item.children.some((child) => pathname === child.href)

  if (collapsed) {
    return (
      <div className="px-2 mb-1">
        <div
          className={cn(
            "flex items-center justify-center p-2 rounded-md",
            isActive ? "bg-primary text-primary-foreground" : "text-slate-400 hover:bg-slate-800 hover:text-white",
          )}
          title={item.title}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    )
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2 text-sm",
          isActive ? "text-white" : "text-slate-400 hover:text-white",
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4" />
          <span>{item.title}</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="ml-4 pl-4 border-l border-slate-700">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "block px-3 py-2 text-sm rounded-md transition-colors",
                pathname === child.href
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-400 hover:text-white hover:bg-slate-800",
              )}
            >
              {child.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
