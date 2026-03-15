"use client"

import Link from "next/link"
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ArrowRight,
  ChevronRight,
  Target,
  Activity,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"

// FC0｜资金预测总览页（老板首屏）
// 核心定位：老板资金安全感四问（现在有多少/未来何时进出/最低点/会不会穿透）

const currentCash = {
  total_usd: 2450000,
  by_currency: [
    { currency: "USD", amount: 1200000, amount_usd: 1200000 },
    { currency: "IDR", amount: 18500000000, amount_usd: 1180000 },
    { currency: "CNY", amount: 500000, amount_usd: 70000 },
  ],
  as_of_date: "2026-01-22",
}

const keyMilestones = [
  { date: "2026-01-24", label: "流入高峰", amount_usd: 850000, type: "peak_in", desc: "TikTok ID 多店铺结算到账" },
  { date: "2026-01-27", label: "流出高峰", amount_usd: -620000, type: "peak_out", desc: "工厂付款日" },
  { date: "2026-02-03", label: "现金最低点", amount_usd: 1680000, type: "trough", desc: "预计余额最低点" },
  { date: "2026-02-10", label: "回升点", amount_usd: 2200000, type: "recovery", desc: "平台回款恢复" },
]

const alerts = [
  { id: "AL001", severity: "high", type: "TROUGH_RISK", message: "2026-02-03 预计现金最低点 $1.68M，接近安全线 $1.5M", action: "加速提现" },
  { id: "AL002", severity: "medium", type: "DELAYED_ARRIVAL", message: "TikTok ID JKT 店铺提现已超 SLA 2天未到账", action: "联系平台" },
  { id: "AL003", severity: "low", type: "RULE_MISSING", message: "Shopee MY 新店铺缺少回款规则配置", action: "补充规则" },
]

const top5Inflows = [
  { source: "TikTok ID", amount_usd: 1250000, pct: 45, expected_date: "2026-01-24" },
  { source: "Shopee ID", amount_usd: 680000, pct: 24, expected_date: "2026-01-26" },
  { source: "TikTok US", amount_usd: 420000, pct: 15, expected_date: "2026-01-25" },
  { source: "Shopee MY", amount_usd: 280000, pct: 10, expected_date: "2026-01-28" },
  { source: "其他", amount_usd: 170000, pct: 6, expected_date: "-" },
]

const top5Outflows = [
  { dest: "工厂货款", amount_usd: 980000, pct: 42, expected_date: "2026-01-27" },
  { dest: "主播结算", amount_usd: 520000, pct: 22, expected_date: "2026-01-25" },
  { dest: "物流费用", amount_usd: 380000, pct: 16, expected_date: "2026-01-26" },
  { dest: "跨主体往来", amount_usd: 280000, pct: 12, expected_date: "2026-01-29" },
  { dest: "其他", amount_usd: 180000, pct: 8, expected_date: "-" },
]

const severityConfig: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  high: { label: "高", color: "bg-red-100 text-red-700 border-red-300", icon: AlertTriangle },
  medium: { label: "中", color: "bg-yellow-100 text-yellow-700 border-yellow-300", icon: AlertTriangle },
  low: { label: "低", color: "bg-blue-100 text-blue-700 border-blue-300", icon: AlertTriangle },
}

const milestoneConfig: Record<string, { color: string; icon: typeof TrendingUp }> = {
  peak_in: { color: "bg-green-100 text-green-700", icon: TrendingUp },
  peak_out: { color: "bg-red-100 text-red-700", icon: TrendingDown },
  trough: { color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
  recovery: { color: "bg-blue-100 text-blue-700", icon: TrendingUp },
}

export default function ForecastOverviewPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">资金预测（集团 USD）</h1>
          <p className="text-muted-foreground">
            滚动 90 天资金安全看板 | 基于期初现金 + 确定性收支 + 规则化预估 | 数据截至：{currentCash.as_of_date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/bfis/reports/forecast/versions">
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              版本与情景
            </Button>
          </Link>
          <Link href="/bfis/reports/forecast/rules">
            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              规则配置
            </Button>
          </Link>
        </div>
      </div>

      {/* 核心预警 */}
      {alerts.filter((a) => a.severity === "high").length > 0 && (
        <div className="space-y-2">
          {alerts
            .filter((a) => a.severity === "high")
            .map((alert) => (
              <div key={alert.id} className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-red-800">{alert.message}</span>
                </div>
                <Badge variant="outline" className="text-red-700 border-red-300">
                  {alert.type}
                </Badge>
                <Button size="sm" variant="outline" className="border-red-300 text-red-700 bg-transparent">
                  {alert.action}
                </Button>
              </div>
            ))}
        </div>
      )}

      {/* 资金安全四问 KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Wallet className="h-6 w-6 text-blue-600" />
              </div>
              <Badge className="bg-blue-100 text-blue-700">截至今日</Badge>
            </div>
            <div className="text-3xl font-bold text-blue-900">
              ${(currentCash.total_usd / 1000000).toFixed(2)}M
            </div>
            <div className="text-sm text-blue-700 mt-1">当前可用现金（USD）</div>
            <div className="text-xs text-blue-600 mt-2">
              {currentCash.by_currency.map((c) => `${c.currency}: $${(c.amount_usd / 1000).toFixed(0)}K`).join(" | ")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <Badge className="bg-green-100 text-green-700">未来30天</Badge>
            </div>
            <div className="text-3xl font-bold">+$2.78M</div>
            <div className="text-sm text-muted-foreground mt-1">预计流入总额</div>
            <div className="text-xs text-green-600 mt-2">确定性: $1.95M (70%) | 预估: $0.83M</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
              <Badge className="bg-red-100 text-red-700">未来30天</Badge>
            </div>
            <div className="text-3xl font-bold text-red-600">-$2.34M</div>
            <div className="text-sm text-muted-foreground mt-1">预计流出总额</div>
            <div className="text-xs text-red-600 mt-2">确定性: $1.62M (69%) | 预估: $0.72M</div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Target className="h-6 w-6 text-orange-600" />
              </div>
              <Badge className="bg-orange-100 text-orange-700">2026-02-03</Badge>
            </div>
            <div className="text-3xl font-bold text-orange-900">$1.68M</div>
            <div className="text-sm text-orange-700 mt-1">现金最低点（Cash Trough）</div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={89} className="h-2 flex-1" />
              <span className="text-xs text-orange-600">安全线 $1.5M</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 关键时间点 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">关键时间点</CardTitle>
            <Link href="/bfis/reports/forecast/curve">
              <Button variant="ghost" size="sm">
                查看完整曲线 <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {keyMilestones.map((milestone) => {
              const config = milestoneConfig[milestone.type]
              const Icon = config.icon
              return (
                <div key={milestone.date} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{milestone.label}</div>
                    <div className="text-sm text-muted-foreground">{milestone.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">{milestone.date}</div>
                    <div className={`font-mono font-bold ${milestone.amount_usd > 0 ? "text-green-600" : "text-red-600"}`}>
                      {milestone.amount_usd > 0 ? "+" : ""}${(Math.abs(milestone.amount_usd) / 1000).toFixed(0)}K
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top5 流入 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Top5 流入来源（未来30天）</CardTitle>
              <Link href="/bfis/reports/forecast/inflow">
                <Button variant="ghost" size="sm">
                  查看明细 <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>来源</TableHead>
                  <TableHead className="text-right">金额（USD）</TableHead>
                  <TableHead className="text-right">占比</TableHead>
                  <TableHead>预计日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top5Inflows.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.source}</TableCell>
                    <TableCell className="text-right font-mono">${(item.amount_usd / 1000).toFixed(0)}K</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{item.pct}%</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.expected_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top5 流出 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Top5 流出去向（未来30天）</CardTitle>
              <Link href="/bfis/reports/forecast/outflow">
                <Button variant="ghost" size="sm">
                  查看明细 <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>去向</TableHead>
                  <TableHead className="text-right">金额（USD）</TableHead>
                  <TableHead className="text-right">占比</TableHead>
                  <TableHead>预计日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top5Outflows.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.dest}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      ${(item.amount_usd / 1000).toFixed(0)}K
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{item.pct}%</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.expected_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 预警与建议动作 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">资金预警与建议动作</CardTitle>
            <Link href="/bfis/reports/forecast/alerts">
              <Button variant="ghost" size="sm">
                查看全部 <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.map((alert) => {
            const config = severityConfig[alert.severity]
            const Icon = config.icon
            return (
              <div
                key={alert.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${config.color}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{alert.type}</span>
                  </div>
                  <p className="text-sm">{alert.message}</p>
                </div>
                <Button size="sm" variant="outline">
                  {alert.action}
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/bfis/reports/forecast/curve">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium">现金曲线</div>
                <div className="text-xs text-muted-foreground">三层叠加</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bfis/reports/forecast/inflow">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium">流入明细</div>
                <div className="text-xs text-muted-foreground">平台回款</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bfis/reports/forecast/outflow">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <div>
                <div className="font-medium">流出明细</div>
                <div className="text-xs text-muted-foreground">付款计划</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bfis/reports/forecast/rules">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-5 w-5 text-purple-600" />
              <div>
                <div className="font-medium">规则配置</div>
                <div className="text-xs text-muted-foreground">SLA维护</div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
