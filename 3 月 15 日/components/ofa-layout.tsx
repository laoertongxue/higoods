"use client"

import type React from "react"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Bell, ChevronRight, User } from "lucide-react"
import { OFASidebar, type OFARole } from "./ofa-sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface OFALayoutProps {
  children: React.ReactNode
}

const roleLabels: Record<OFARole, string> = {
  boss: "老板",
  finance: "财务",
  business: "业务",
}

// 面包屑映射
const breadcrumbMap: Record<string, string> = {
  workspace: "工作台",
  overview: "集团总览（USD）",
  todo: "我的待办",
  alerts: "异常与预警",
  tickets: "工单中心",
  search: "快捷查询",
  reports: "经营与报表（集团 USD）",
  dashboard: "集团驾驶舱",
  forecast: "资金预测（7/14/30 天）",
  statements: "简化三表（管理口径）",
  analysis: "经营分析",
  bridge: "口径差异桥（对金蝶）",
  platform: "平台收单（TikTok / Shopee）",
  stores: "店铺与收单主体",
  transactions: "交易流水",
  bills: "平台账单/结算单",
  receivables: "平台结算应收台账（四态）",
  withdraw: "提现与到账",
  reconcile: "对账",
  settlement: "结算与往来",
  consignment: "代销结算（JKT）",
  factory: "工厂结算（BDG/外协）",
  supplier: "供应商结算（HK/BDG）",
  ledger: "往来台账",
  writeoff: "核销中心",
  confirm: "对账确认",
  funds: "资金与银行",
  accounts: "资金账户",
  payment: "付款管理（飞书）",
  bank: "银行流水/回单",
  plan: "资金计划",
  cost: "成本、存货与毛利",
  collection: "成本归集与版本",
  presale: "预售成本处理",
  margin: "毛利核算快照",
  assets: "资产管理",
  fixed: "固定资产台账",
  depreciation: "资本化与折旧",
  accounting: "会计与关账",
  engine: "会计引擎（规则与映射）",
  vouchers: "凭证中心",
  close: "关账管理",
  settings: "基础与集成",
  org: "组织与账本",
  currency: "币种与汇率中心",
  master: "主数据与映射",
  integration: "集成中心",
  permission: "权限与审计",
}

export function OFALayout({ children }: OFALayoutProps) {
  const [role, setRole] = useState<OFARole>("finance")
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  // 生成面包屑
  const generateBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean)
    // 移除 'bfis' 前缀
    const relevantPaths = paths.slice(1)

    return relevantPaths.map((path, index) => ({
      name: breadcrumbMap[path] || path,
      href: `/bfis/${relevantPaths.slice(0, index + 1).join("/")}`,
      isLast: index === relevantPaths.length - 1,
    }))
  }

  const breadcrumbs = generateBreadcrumbs()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 顶部导航 */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/bfis/workspace/overview" className="text-xl font-bold text-primary">
            HiGood OFA
          </Link>
          <span className="text-sm text-muted-foreground">业财一体化系统</span>
        </div>

        <div className="flex items-center gap-4">
          {/* 角色切换 */}
          <Select value={role} onValueChange={(v) => setRole(v as OFARole)}>
            <SelectTrigger className="w-[120px] h-9">
              <User className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="boss">老板</SelectItem>
              <SelectItem value="finance">财务</SelectItem>
              <SelectItem value="business">业务</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" />
                  <AvatarFallback>财务</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{roleLabels[role]}用户</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>个人设置</DropdownMenuItem>
              <DropdownMenuItem>退出登录</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <OFASidebar role={role} collapsed={collapsed} onCollapsedChange={setCollapsed} />

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto">
          {/* 面包屑 */}
          <div className="border-b border-border bg-muted/30 px-6 py-2">
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/bfis/workspace/overview" className="text-muted-foreground hover:text-foreground">
                首页
              </Link>
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.href} className="flex items-center gap-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  {crumb.isLast ? (
                    <span className="text-foreground font-medium">{crumb.name}</span>
                  ) : (
                    <Link href={crumb.href} className="text-muted-foreground hover:text-foreground">
                      {crumb.name}
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </div>

          {/* 页面内容 */}
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
