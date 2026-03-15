"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  ArrowRightLeft,
  Landmark,
  Calculator,
  Building,
  BookOpen,
  Settings,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export type OFARole = "boss" | "finance" | "business"

interface OFASidebarProps {
  role: OFARole
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

interface MenuItem {
  id: string
  name: string
  icon: React.ElementType
  children: {
    id: string
    name: string
    href: string
  }[]
  visibleRoles: OFARole[]
}

const menuItems: MenuItem[] = [
  {
    id: "product-settings",
    name: "系统设置",
    icon: Settings,
    visibleRoles: ["boss", "finance", "business"],
    children: [
      { id: "config-workspace", name: "配置工作台", href: "/settings/config-workspace" },
      { id: "template-center", name: "模板中心", href: "/settings/template-center" },
      { id: "platform-integration", name: "平台对接配置", href: "/settings/integration" },
    ],
  },
  {
    id: "workspace",
    name: "工作台",
    icon: LayoutDashboard,
    visibleRoles: ["boss", "finance", "business"],
    children: [
      { id: "overview", name: "集团总览（USD）", href: "/bfis/workspace/overview" },
      { id: "todo", name: "我的待办", href: "/bfis/workspace/todo" },
      { id: "alerts", name: "异常与预警", href: "/bfis/workspace/alerts" },
      { id: "tickets", name: "工单中心", href: "/bfis/workspace/tickets" },
      { id: "search", name: "快捷查询", href: "/bfis/workspace/search" },
    ],
  },
  {
    id: "reports",
    name: "经营与报表（集团 USD）",
    icon: TrendingUp,
    visibleRoles: ["boss", "finance", "business"],
    children: [
      { id: "dashboard", name: "2.1 集团驾驶舱", href: "/bfis/reports/dashboard" },
      { id: "dashboard-config", name: "2.1 驾驶舱配置", href: "/bfis/reports/dashboard/config" },
      { id: "forecast", name: "2.2 资金预测（7/14/30 天）", href: "/bfis/reports/forecast" },
      { id: "forecast-versions", name: "2.2 预测版本与情景", href: "/bfis/reports/forecast/versions" },
      { id: "forecast-curve", name: "2.2 现金曲线与结构", href: "/bfis/reports/forecast/curve" },
      { id: "forecast-inflow", name: "2.2 未来流入明细", href: "/bfis/reports/forecast/inflow" },
      { id: "forecast-outflow", name: "2.2 未来流出明细", href: "/bfis/reports/forecast/outflow" },
      { id: "forecast-rules", name: "2.2 规则与假设集", href: "/bfis/reports/forecast/rules" },
      { id: "forecast-alerts", name: "2.2 资金预警", href: "/bfis/reports/forecast/alerts" },
      { id: "statements", name: "2.3 简化三表（管理口径）", href: "/bfis/reports/statements" },
      { id: "statements-pl", name: "2.3 简化利润表", href: "/bfis/reports/statements/pl" },
      { id: "statements-bs", name: "2.3 简化资产负债表", href: "/bfis/reports/statements/bs" },
      { id: "statements-cf", name: "2.3 简化现金流量表", href: "/bfis/reports/statements/cf" },
      { id: "statements-versions", name: "2.3 版本管理", href: "/bfis/reports/statements/versions" },
      { id: "statements-quality", name: "2.3 口径与质量", href: "/bfis/reports/statements/quality" },
      { id: "analysis", name: "经营分析", href: "/bfis/reports/analysis" },
      { id: "bridge", name: "口径差异桥（对金蝶）", href: "/bfis/reports/bridge" },
    ],
  },
  {
    id: "platform",
    name: "平台收单（TikTok / Shopee）",
    icon: CreditCard,
    visibleRoles: ["boss", "finance", "business"],
    children: [
      { id: "stores", name: "3.1 店铺与收单主体", href: "/bfis/platform/stores" },
      { id: "payout-accounts", name: "3.1 提现银行账号", href: "/bfis/platform/stores/accounts" },
      { id: "stores-test", name: "3.1 收单主体解析测试", href: "/bfis/platform/stores/test" },
      { id: "transactions", name: "3.2 交易流水", href: "/bfis/platform/transactions" },
      { id: "transactions-import", name: "3.2 导入/同步任务", href: "/bfis/platform/transactions/import" },
      { id: "transactions-exceptions", name: "3.2 异常与重复处理", href: "/bfis/platform/transactions/exceptions" },
      { id: "statements", name: "3.3 平台账单/结算单", href: "/bfis/platform/statements" },
      { id: "statements-versions", name: "3.3 版本与差异对比", href: "/bfis/platform/statements/versions" },
      { id: "receivables", name: "3.4 平台结算应收台账", href: "/bfis/platform/receivables" },
      { id: "receivables-forecast", name: "3.4 预测误差与规则效果", href: "/bfis/platform/receivables/forecast" },
      { id: "withdraw", name: "3.5 提现与到账", href: "/bfis/platform/withdraw" },
      { id: "withdraw-match", name: "3.5 到账匹配中心", href: "/bfis/platform/withdraw/match" },
      { id: "adjustments", name: "退款/争议/调账", href: "/bfis/platform/adjustments" },
      { id: "reconcile", name: "平台对账", href: "/bfis/platform/reconcile" },
    ],
  },
  {
    id: "settlement",
    name: "结算与往来",
    icon: ArrowRightLeft,
    visibleRoles: ["boss", "finance", "business"],
    children: [
      { id: "consignment", name: "代销结算（JKT）", href: "/bfis/settlement/consignment" },
      { id: "factory", name: "4.2 工厂结算（BDG/外协）", href: "/bfis/settlement/factory" },
      { id: "factory-payments", name: "4.2 工厂付款申请", href: "/bfis/settlement/factory/payments" },
      { id: "factory-sync", name: "4.2 同步批次与对账", href: "/bfis/settlement/factory/sync" },
      { id: "supplier", name: "4.3 供应商结算（HK/BDG）", href: "/bfis/settlement/supplier" },
      { id: "supplier-payments", name: "4.3 供应商付款申请", href: "/bfis/settlement/supplier/payments" },
      { id: "host", name: "4.4 主播结算", href: "/bfis/settlement/host" },
      { id: "host-payments", name: "4.4 主播付款申请", href: "/bfis/settlement/host/payments" },
      { id: "host-sync", name: "4.4 同步与回传日志", href: "/bfis/settlement/host/sync" },
      { id: "ledger", name: "往来台账", href: "/bfis/settlement/ledger" },
      { id: "writeoff", name: "核销中心", href: "/bfis/settlement/writeoff" },
      { id: "confirm", name: "结算单确认", href: "/bfis/settlement/confirm" },
    ],
  },
  {
    id: "funds",
    name: "资金与银行",
    icon: Landmark,
    visibleRoles: ["boss", "finance"],
    children: [
      { id: "accounts", name: "5.1 资金账户", href: "/bfis/funds/accounts" },
      { id: "accounts-snapshots", name: "5.1 余额快照与对账", href: "/bfis/funds/accounts/snapshots" },
      { id: "plan", name: "资金计划/调拨", href: "/bfis/funds/plan" },
      { id: "receipts", name: "收款登记", href: "/bfis/funds/receipts" },
      { id: "bank", name: "银行流水/回单", href: "/bfis/funds/bank" },
      { id: "reconcile", name: "银行对账", href: "/bfis/funds/reconcile" },
      { id: "payment", name: "付款申请", href: "/bfis/funds/payment" },
    ],
  },
  {
    id: "cost",
    name: "成本、存货与毛利",
    icon: Calculator,
    visibleRoles: ["boss", "finance"],
    children: [
      { id: "fees", name: "6.2 费用分摊", href: "/bfis/cost/fees" },
      { id: "collection", name: "6.3 成本归集与版本", href: "/bfis/cost/collection" },
      { id: "backfill", name: "6.3 成本回写任务", href: "/bfis/cost/backfill" },
      { id: "cogs", name: "6.4 销售成本结转", href: "/bfis/cost/cogs" },
      { id: "presale-rules", name: "6.5 预售规则配置", href: "/bfis/cost/presale/rules" },
      { id: "presale", name: "6.5 预售批次监控", href: "/bfis/cost/presale" },
      { id: "presale-reversal", name: "6.5 预售取消冲回", href: "/bfis/cost/presale/reversal" },
      { id: "margin", name: "6.6 毛利核算快照", href: "/bfis/cost/margin" },
      { id: "margin-quality", name: "6.6 毛利差异与质量", href: "/bfis/cost/margin/quality" },
    ],
  },
  {
    id: "assets",
    name: "资产管理",
    icon: Building,
    visibleRoles: ["finance"],
    children: [
      { id: "fixed", name: "固定资产", href: "/bfis/assets/fixed" },
      { id: "depreciation", name: "折旧计提", href: "/bfis/assets/depreciation" },
    ],
  },
  {
    id: "accounting",
    name: "会计与关账",
    icon: BookOpen,
    visibleRoles: ["finance"],
    children: [
      { id: "vouchers", name: "凭证草稿", href: "/bfis/accounting/vouchers" },
      { id: "engine", name: "会计事件引擎", href: "/bfis/accounting/engine" },
      { id: "reconcile", name: "账账核对", href: "/bfis/accounting/reconcile" },
      { id: "close", name: "关账中心", href: "/bfis/accounting/close" },
    ],
  },
  {
    id: "settings",
    name: "基础与集成",
    icon: Settings,
    visibleRoles: ["finance"],
    children: [
      { id: "org", name: "9.1 组织与账本", href: "/bfis/settings/org" },
      { id: "org-entities", name: "9.1 法人主体", href: "/bfis/settings/org/entities" },
      { id: "org-ledgers", name: "9.1 账本管理", href: "/bfis/settings/org/ledgers" },
      { id: "org-periods", name: "9.1 会计期间", href: "/bfis/settings/org/periods" },
      { id: "org-relations", name: "9.1 跨主体关系", href: "/bfis/settings/org/relations" },
      { id: "accounts", name: "科目体系", href: "/bfis/settings/accounts" },
      { id: "currency", name: "9.2 币种与汇率中心", href: "/bfis/settings/currency" },
      { id: "currency-list", name: "9.2 币种管理", href: "/bfis/settings/currency/currencies" },
      { id: "fx-sources", name: "9.2 汇率来源", href: "/bfis/settings/currency/sources" },
      { id: "fx-rate-sets", name: "9.2 期间汇率集", href: "/bfis/settings/currency/rate-sets" },
      { id: "fx-rates", name: "9.2 原子汇率", href: "/bfis/settings/currency/rates" },
      { id: "fx-import", name: "9.2 汇率导入", href: "/bfis/settings/currency/import" },
      { id: "fx-policy", name: "9.2 汇率策略", href: "/bfis/settings/currency/policy" },
      { id: "fx-compare", name: "9.2 对照与差异", href: "/bfis/settings/currency/compare" },
      { id: "fx-alerts", name: "9.2 汇率预警", href: "/bfis/settings/currency/alerts" },
      { id: "master", name: "主数据", href: "/bfis/settings/master" },
      { id: "permission", name: "权限与角色", href: "/bfis/settings/permission" },
      { id: "integration", name: "接口与集成", href: "/bfis/settings/integration" },
    ],
  },
]

export function OFASidebar({ role, collapsed, onCollapsedChange }: OFASidebarProps) {
  const pathname = usePathname()
  const [openMenus, setOpenMenus] = useState<string[]>(["workspace", "platform", "funds"])

  const toggleMenu = (menuId: string) => {
    setOpenMenus((prev) => (prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]))
  }

  const filteredMenus = menuItems.filter((item) => item.visibleRoles.includes(role))

  if (collapsed) {
    return (
      <div className="w-16 border-r bg-background flex flex-col">
        <div className="p-2 border-b">
          <Button variant="ghost" size="icon" onClick={() => onCollapsedChange(false)}>
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="py-2 space-y-1">
            {filteredMenus.map((menu) => {
              const Icon = menu.icon
              const isActive = menu.children.some((child) => pathname === child.href)
              return (
                <div key={menu.id} className="px-2">
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="icon"
                    className="w-full"
                    title={menu.name}
                    onClick={() => {
                      onCollapsedChange(false)
                      setOpenMenus((prev) => [...prev, menu.id])
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="w-60 border-r bg-background flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <span className="font-semibold text-sm">业财一体化</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCollapsedChange(true)}>
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {filteredMenus.map((menu) => {
            const Icon = menu.icon
            const isOpen = openMenus.includes(menu.id)
            const isActive = menu.children.some((child) => pathname === child.href)

            return (
              <Collapsible key={menu.id} open={isOpen} onOpenChange={() => toggleMenu(menu.id)}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start px-3 py-2 h-auto",
                      isActive && "bg-accent text-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 mr-2 shrink-0" />
                    <span className="text-sm truncate flex-1 text-left">{menu.name}</span>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 border-l pl-2 py-1 space-y-1">
                    {menu.children.map((child) => {
                      const isChildActive = pathname === child.href
                      return (
                        <Link key={child.id} href={child.href}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "w-full justify-start h-8 text-sm",
                              isChildActive && "bg-primary/10 text-primary font-medium",
                            )}
                          >
                            {child.name}
                          </Button>
                        </Link>
                      )
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
