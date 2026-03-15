"use client"

import { useState } from "react"
import Link from "next/link"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  Info,
  ChevronRight,
  Download,
  RefreshCw,
  Calendar,
  Building2,
  FileText,
  Lock,
  ArrowRightLeft,
  Layers,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// MS0｜简化三表总览页（入口，Tabs）
// 目标用户：老板（主）、财务（辅）
// 核心能力：一眼看经营结果与资产/现金安全感，并能解释"为什么变了"

// Mock 版本数据
const versions = [
  { id: "v_daily_20260122", type: "DAILY", period: "2026-01", asOfDate: "2026-01-22", status: "PUBLISHED" },
  { id: "v_daily_20260121", type: "DAILY", period: "2026-01", asOfDate: "2026-01-21", status: "PUBLISHED" },
  { id: "v_monthly_202601", type: "MONTHLY", period: "2026-01", asOfDate: null, status: "PUBLISHED" },
  { id: "v_close_202512", type: "CLOSE", period: "2025-12", asOfDate: null, status: "LOCKED" },
]

// Mock KPI 数据
const kpiData = {
  gmvNet: { value: 2850000, change: 12.5, label: "有效GMV（净额）", currency: "USD" },
  grossMargin: { value: 38.5, change: 2.1, label: "毛利率", unit: "%" },
  operatingProfit: { value: 456000, change: 8.3, label: "经营利润", currency: "USD" },
  cashBalance: { value: 1234567, change: 5.2, label: "期末现金", currency: "USD" },
  arBalance: { value: 567890, change: -3.1, label: "应收余额", currency: "USD" },
  apBalance: { value: 345678, change: 1.8, label: "应付余额", currency: "USD" },
}

// Mock 利润表数据
const plData = [
  { lineCode: "PL_GMV_NET", lineName: "有效GMV（净额）", amountUsd: 2850000, compareUsd: 2533333, dqFlags: [], drillable: true },
  { lineCode: "PL_PLATFORM_FEE", lineName: "平台手续费/交易费", amountUsd: -171000, compareUsd: -152000, dqFlags: [], drillable: true },
  { lineCode: "PL_USER_SHIPPING", lineName: "用户运费（抵减项）", amountUsd: -85500, compareUsd: -76000, dqFlags: [], drillable: true },
  { lineCode: "PL_COGS", lineName: "销售成本（COGS）", amountUsd: -1596000, compareUsd: -1444000, dqFlags: ["DQ_COST_ESTIMATED"], drillable: true },
  { lineCode: "PL_GROSS_PROFIT", lineName: "毛利（Gross Profit）", amountUsd: 997500, compareUsd: 861333, dqFlags: [], drillable: false, isFormula: true },
  { lineCode: "PL_STORE_FEE", lineName: "平台店铺费用", amountUsd: -142500, compareUsd: -126667, dqFlags: [], drillable: true },
  { lineCode: "PL_AD_EXPENSE", lineName: "推流/广告投放费用", amountUsd: -228000, compareUsd: -202667, dqFlags: [], drillable: true },
  { lineCode: "PL_ANCHOR_SETTLE", lineName: "主播结算（薪资/提成）", amountUsd: -114000, compareUsd: -101333, dqFlags: ["DQ_STATEMENT_PENDING"], drillable: true },
  { lineCode: "PL_FACTORY_FEE", lineName: "外协工厂加工费", amountUsd: -28500, compareUsd: -25333, dqFlags: [], drillable: true },
  { lineCode: "PL_OTHER_OPEX", lineName: "其他经营费用", amountUsd: -28500, compareUsd: -25333, dqFlags: [], drillable: true },
  { lineCode: "PL_OPERATING_PROFIT", lineName: "经营利润（EBIT-like）", amountUsd: 456000, compareUsd: 380000, dqFlags: [], drillable: false, isFormula: true },
]

// Mock 资产负债表数据
const bsData = {
  assets: [
    { lineCode: "BS_CASH", lineName: "货币资金", amountUsd: 1234567, compareUsd: 1173874, dqFlags: [], drillable: true, children: [
      { lineCode: "BS_CASH_BANK", lineName: "银行余额", amountUsd: 834567, compareUsd: 793874, dqFlags: [], drillable: true },
      { lineCode: "BS_CASH_PLATFORM", lineName: "平台待回款", amountUsd: 400000, compareUsd: 380000, dqFlags: [], drillable: true },
    ]},
    { lineCode: "BS_AR_PLATFORM", lineName: "平台结算应收", amountUsd: 567890, compareUsd: 585364, dqFlags: [], drillable: true },
    { lineCode: "BS_INVENTORY", lineName: "存货", amountUsd: 890123, compareUsd: 845617, dqFlags: ["DQ_COST_ESTIMATED"], drillable: true },
    { lineCode: "BS_SAMPLE_ASSET", lineName: "样衣资产", amountUsd: 123456, compareUsd: 117283, dqFlags: [], drillable: true },
    { lineCode: "BS_FIXED_ASSET", lineName: "固定资产净值", amountUsd: 234567, compareUsd: 246295, dqFlags: [], drillable: true },
    { lineCode: "BS_OTHER_ASSET", lineName: "其他资产", amountUsd: 45678, compareUsd: 43394, dqFlags: [], drillable: true },
  ],
  liabilities: [
    { lineCode: "BS_AP", lineName: "应付账款", amountUsd: 345678, compareUsd: 339539, dqFlags: [], drillable: true },
    { lineCode: "BS_ADVANCE_RECEIPT", lineName: "预收/待履约", amountUsd: 89012, compareUsd: 84561, dqFlags: [], drillable: true },
    { lineCode: "BS_OTHER_LIAB", lineName: "其他负债", amountUsd: 56789, compareUsd: 53950, dqFlags: [], drillable: true },
  ],
  equity: [
    { lineCode: "BS_RETAINED", lineName: "累计经营结果", amountUsd: 2548824, compareUsd: 2478800, dqFlags: [], drillable: true },
    { lineCode: "BS_FX_REVAL", lineName: "汇兑及重估差额", amountUsd: 45678, compareUsd: 43394, dqFlags: ["DQ_REVAL_NOT_RUN"], drillable: true },
    { lineCode: "BS_OTHER_EQUITY", lineName: "其他权益调整", amountUsd: 9800, compareUsd: 9533, dqFlags: [], drillable: true },
  ],
}

// Mock 现金流量表数据
const cfData = [
  { lineCode: "CF_OP_INFLOW", lineName: "经营活动现金流入", amountUsd: 2680000, compareUsd: 2382222, dqFlags: [], drillable: true },
  { lineCode: "CF_OP_OUTFLOW", lineName: "经营活动现金流出", amountUsd: -2320000, compareUsd: -2062222, dqFlags: [], drillable: true },
  { lineCode: "CF_OP_NET", lineName: "经营活动净现金流", amountUsd: 360000, compareUsd: 320000, dqFlags: [], drillable: false, isFormula: true },
  { lineCode: "CF_INV_INFLOW", lineName: "投资活动现金流入", amountUsd: 0, compareUsd: 0, dqFlags: [], drillable: true },
  { lineCode: "CF_INV_OUTFLOW", lineName: "投资活动现金流出", amountUsd: -45000, compareUsd: -40000, dqFlags: [], drillable: true },
  { lineCode: "CF_INV_NET", lineName: "投资活动净现金流", amountUsd: -45000, compareUsd: -40000, dqFlags: [], drillable: false, isFormula: true },
  { lineCode: "CF_FIN_INFLOW", lineName: "筹资活动现金流入", amountUsd: 0, compareUsd: 0, dqFlags: [], drillable: true },
  { lineCode: "CF_FIN_OUTFLOW", lineName: "筹资活动现金流出", amountUsd: 0, compareUsd: 0, dqFlags: [], drillable: true },
  { lineCode: "CF_FIN_NET", lineName: "筹资活动净现金流", amountUsd: 0, compareUsd: 0, dqFlags: [], drillable: false, isFormula: true },
  { lineCode: "CF_CASH_BEGIN", lineName: "期初现金余额", amountUsd: 919567, compareUsd: 893874, dqFlags: [], drillable: true },
  { lineCode: "CF_CASH_END", lineName: "期末现金余额", amountUsd: 1234567, compareUsd: 1173874, dqFlags: ["DQ_CASH_RECON_DIFF"], drillable: true },
]

// 数据质量标记配置
const dqFlagConfig: Record<string, { label: string; color: string; description: string }> = {
  DQ_FX_MISSING: { label: "汇率缺失", color: "bg-red-100 text-red-700", description: "汇率集或明细缺失" },
  DQ_COST_ESTIMATED: { label: "成本暂估", color: "bg-yellow-100 text-yellow-700", description: "成本暂估（预售/未回写）" },
  DQ_STATEMENT_PENDING: { label: "账单待定", color: "bg-orange-100 text-orange-700", description: "平台账单未完结（争议/退款未闭环）" },
  DQ_CASH_RECON_DIFF: { label: "现金差异", color: "bg-purple-100 text-purple-700", description: "期末现金与账户/流水不一致" },
  DQ_INTERCO_PENDING: { label: "内部待处理", color: "bg-blue-100 text-blue-700", description: "内部交易/抵消未完成" },
  DQ_REVAL_NOT_RUN: { label: "未重估", color: "bg-gray-100 text-gray-700", description: "本期重估未执行" },
}

const versionTypeConfig: Record<string, { label: string; color: string }> = {
  DAILY: { label: "日报", color: "bg-blue-100 text-blue-700" },
  MONTHLY: { label: "月报", color: "bg-green-100 text-green-700" },
  CLOSE: { label: "关账", color: "bg-purple-100 text-purple-700" },
}

// 格式化金额
function formatCurrency(amount: number, currency = "USD"): string {
  const absAmount = Math.abs(amount)
  if (absAmount >= 1000000) {
    return `${amount < 0 ? "-" : ""}$${(absAmount / 1000000).toFixed(2)}M`
  }
  if (absAmount >= 1000) {
    return `${amount < 0 ? "-" : ""}$${(absAmount / 1000).toFixed(0)}K`
  }
  return `${amount < 0 ? "-" : ""}$${absAmount.toFixed(0)}`
}

// 格式化完整金额
function formatFullCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

// 计算变动
function calcChange(current: number, compare: number): { amount: number; percent: number } {
  const amount = current - compare
  const percent = compare !== 0 ? ((current - compare) / Math.abs(compare)) * 100 : 0
  return { amount, percent }
}

export default function StatementsOverviewPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("2026-01")
  const [selectedVersion, setSelectedVersion] = useState("DAILY")
  const [selectedScope, setSelectedScope] = useState("GROUP")
  const [showCompare, setShowCompare] = useState(true)
  const [showDqHints, setShowDqHints] = useState(true)
  const [activeTab, setActiveTab] = useState("pl")

  // 统计数据质量问题
  const allDqFlags = [
    ...plData.flatMap(r => r.dqFlags),
    ...bsData.assets.flatMap(r => r.dqFlags),
    ...bsData.liabilities.flatMap(r => r.dqFlags),
    ...bsData.equity.flatMap(r => r.dqFlags),
    ...cfData.flatMap(r => r.dqFlags),
  ]
  const uniqueDqFlags = [...new Set(allDqFlags)]
  const hasDqIssues = uniqueDqFlags.length > 0

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">简化三表（管理口径）</h1>
            <p className="text-muted-foreground">
              面向老板的管理口径三大报表，以期间固定汇率+月末重估为汇率基座，统一展示币种 USD
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Link href="/bfis/reports/bridge">
              <Button size="sm">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                差异桥
              </Button>
            </Link>
          </div>
        </div>

        {/* 数据质量提示 */}
        {hasDqIssues && showDqHints && (
          <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="flex-1">
              <span className="text-sm text-yellow-800">
                本期报表存在 {uniqueDqFlags.length} 类数据质量问题，请关注标记行项目
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {uniqueDqFlags.map(flag => {
                  const config = dqFlagConfig[flag]
                  return config ? (
                    <Badge key={flag} className={config.color}>{config.label}</Badge>
                  ) : null
                })}
              </div>
            </div>
            <Link href="/bfis/reports/statements/quality">
              <Button variant="outline" size="sm">
                查看详情
              </Button>
            </Link>
          </div>
        )}

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026-01">2026-01</SelectItem>
                    <SelectItem value="2025-12">2025-12</SelectItem>
                    <SelectItem value="2025-11">2025-11</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">日报（最新）</SelectItem>
                    <SelectItem value="MONTHLY">月报滚动</SelectItem>
                    <SelectItem value="CLOSE">关账版本</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedScope} onValueChange={setSelectedScope}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GROUP">集团合并</SelectItem>
                    <SelectItem value="HK_HIGOOD_PROC">HK-采购出口</SelectItem>
                    <SelectItem value="ID_BDG_FADFAD">BDG-生产</SelectItem>
                    <SelectItem value="ID_JKT_HIGOOD_LIVE">JKT-直播</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex items-center gap-2">
                  <Switch id="compare" checked={showCompare} onCheckedChange={setShowCompare} />
                  <Label htmlFor="compare" className="text-sm">环比对比</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="dqhints" checked={showDqHints} onCheckedChange={setShowDqHints} />
                  <Label htmlFor="dqhints" className="text-sm">口径提示</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(kpiData).map(([key, data]) => (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">{data.label}</div>
                <div className="text-xl font-bold">
                  {data.currency ? formatCurrency(data.value) : `${data.value}${data.unit || ""}`}
                </div>
                {showCompare && (
                  <div className={`text-sm flex items-center gap-1 mt-1 ${data.change > 0 ? "text-green-600" : data.change < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                    {data.change > 0 ? <TrendingUp className="h-3 w-3" /> : data.change < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {data.change > 0 ? "+" : ""}{data.change}%
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="pl">利润表</TabsTrigger>
            <TabsTrigger value="bs">资产负债表</TabsTrigger>
            <TabsTrigger value="cf">现金流量表</TabsTrigger>
          </TabsList>

          {/* 利润表 Tab */}
          <TabsContent value="pl" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>简化利润表</CardTitle>
                    <CardDescription>期间: {selectedPeriod} | 汇率: 期间固定汇率（PERIOD_FIXED）</CardDescription>
                  </div>
                  <Link href="/bfis/reports/statements/pl">
                    <Button variant="outline" size="sm">
                      查看完整 <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[300px]">行项目</TableHead>
                      <TableHead className="text-right">本期（USD）</TableHead>
                      {showCompare && <TableHead className="text-right">上期（USD）</TableHead>}
                      {showCompare && <TableHead className="text-right">变动</TableHead>}
                      <TableHead className="w-[100px]">标记</TableHead>
                      <TableHead className="w-[80px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plData.map((row) => {
                      const change = calcChange(row.amountUsd, row.compareUsd)
                      return (
                        <TableRow key={row.lineCode} className={row.isFormula ? "bg-muted/30 font-medium" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {row.isFormula && <Badge variant="outline" className="text-xs">公式</Badge>}
                              {row.lineName}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-mono ${row.amountUsd < 0 ? "text-red-600" : ""}`}>
                            {formatFullCurrency(row.amountUsd)}
                          </TableCell>
                          {showCompare && (
                            <TableCell className={`text-right font-mono text-muted-foreground ${row.compareUsd < 0 ? "text-red-400" : ""}`}>
                              {formatFullCurrency(row.compareUsd)}
                            </TableCell>
                          )}
                          {showCompare && (
                            <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                              {change.percent > 0 ? "+" : ""}{change.percent.toFixed(1)}%
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex gap-1">
                              {row.dqFlags.map(flag => {
                                const config = dqFlagConfig[flag]
                                return config ? (
                                  <Tooltip key={flag}>
                                    <TooltipTrigger>
                                      <Badge className={`${config.color} text-xs`}>{config.label}</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{config.description}</TooltipContent>
                                  </Tooltip>
                                ) : null
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.drillable && (
                              <Link href={`/bfis/reports/statements/drilldown?line=${row.lineCode}&period=${selectedPeriod}`}>
                                <Button variant="ghost" size="sm">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 资产负债表 Tab */}
          <TabsContent value="bs" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>简化资产负债表</CardTitle>
                    <CardDescription>期末: {selectedPeriod} | 汇率: 期末汇率（END_PERIOD）</CardDescription>
                  </div>
                  <Link href="/bfis/reports/statements/bs">
                    <Button variant="outline" size="sm">
                      查看完整 <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 资产 */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> 资产
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>项目</TableHead>
                          <TableHead className="text-right">期末（USD）</TableHead>
                          {showCompare && <TableHead className="text-right">变动%</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bsData.assets.map((row) => {
                          const change = calcChange(row.amountUsd, row.compareUsd)
                          return (
                            <TableRow key={row.lineCode}>
                              <TableCell>
                                <Link href={`/bfis/reports/statements/drilldown?line=${row.lineCode}&period=${selectedPeriod}`} className="hover:underline">
                                  {row.lineName}
                                </Link>
                                {row.dqFlags.length > 0 && (
                                  <span className="ml-2">
                                    {row.dqFlags.map(flag => {
                                      const config = dqFlagConfig[flag]
                                      return config ? (
                                        <Badge key={flag} className={`${config.color} text-xs ml-1`}>{config.label}</Badge>
                                      ) : null
                                    })}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono">{formatFullCurrency(row.amountUsd)}</TableCell>
                              {showCompare && (
                                <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                                  {change.percent > 0 ? "+" : ""}{change.percent.toFixed(1)}%
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell>资产合计</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatFullCurrency(bsData.assets.reduce((sum, r) => sum + r.amountUsd, 0))}
                          </TableCell>
                          {showCompare && <TableCell></TableCell>}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* 负债与权益 */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> 负债与权益
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>项目</TableHead>
                          <TableHead className="text-right">期末（USD）</TableHead>
                          {showCompare && <TableHead className="text-right">变动%</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* 负债 */}
                        {bsData.liabilities.map((row) => {
                          const change = calcChange(row.amountUsd, row.compareUsd)
                          return (
                            <TableRow key={row.lineCode}>
                              <TableCell>
                                <Link href={`/bfis/reports/statements/drilldown?line=${row.lineCode}&period=${selectedPeriod}`} className="hover:underline">
                                  {row.lineName}
                                </Link>
                              </TableCell>
                              <TableCell className="text-right font-mono">{formatFullCurrency(row.amountUsd)}</TableCell>
                              {showCompare && (
                                <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                                  {change.percent > 0 ? "+" : ""}{change.percent.toFixed(1)}%
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })}
                        <TableRow className="bg-muted/20">
                          <TableCell className="font-medium">负债小计</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatFullCurrency(bsData.liabilities.reduce((sum, r) => sum + r.amountUsd, 0))}
                          </TableCell>
                          {showCompare && <TableCell></TableCell>}
                        </TableRow>
                        {/* 权益 */}
                        {bsData.equity.map((row) => {
                          const change = calcChange(row.amountUsd, row.compareUsd)
                          return (
                            <TableRow key={row.lineCode}>
                              <TableCell>
                                <Link href={`/bfis/reports/statements/drilldown?line=${row.lineCode}&period=${selectedPeriod}`} className="hover:underline">
                                  {row.lineName}
                                </Link>
                                {row.dqFlags.length > 0 && (
                                  <span className="ml-2">
                                    {row.dqFlags.map(flag => {
                                      const config = dqFlagConfig[flag]
                                      return config ? (
                                        <Badge key={flag} className={`${config.color} text-xs ml-1`}>{config.label}</Badge>
                                      ) : null
                                    })}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono">{formatFullCurrency(row.amountUsd)}</TableCell>
                              {showCompare && (
                                <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                                  {change.percent > 0 ? "+" : ""}{change.percent.toFixed(1)}%
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell>负债与权益合计</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatFullCurrency(
                              bsData.liabilities.reduce((sum, r) => sum + r.amountUsd, 0) +
                              bsData.equity.reduce((sum, r) => sum + r.amountUsd, 0)
                            )}
                          </TableCell>
                          {showCompare && <TableCell></TableCell>}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 现金流量表 Tab */}
          <TabsContent value="cf" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>简化现金流量表</CardTitle>
                    <CardDescription>期间: {selectedPeriod} | 汇率: 期间固定汇率（管理稳定）</CardDescription>
                  </div>
                  <Link href="/bfis/reports/statements/cf">
                    <Button variant="outline" size="sm">
                      查看完整 <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[300px]">行项目</TableHead>
                      <TableHead className="text-right">本期（USD）</TableHead>
                      {showCompare && <TableHead className="text-right">上期（USD）</TableHead>}
                      {showCompare && <TableHead className="text-right">变动</TableHead>}
                      <TableHead className="w-[100px]">标记</TableHead>
                      <TableHead className="w-[80px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cfData.map((row) => {
                      const change = calcChange(row.amountUsd, row.compareUsd)
                      const isSection = row.lineCode.endsWith("_NET") || row.lineCode.includes("CASH")
                      return (
                        <TableRow key={row.lineCode} className={isSection ? "bg-muted/30 font-medium" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {row.isFormula && <Badge variant="outline" className="text-xs">净额</Badge>}
                              {row.lineName}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-mono ${row.amountUsd < 0 ? "text-red-600" : ""}`}>
                            {formatFullCurrency(row.amountUsd)}
                          </TableCell>
                          {showCompare && (
                            <TableCell className={`text-right font-mono text-muted-foreground ${row.compareUsd < 0 ? "text-red-400" : ""}`}>
                              {formatFullCurrency(row.compareUsd)}
                            </TableCell>
                          )}
                          {showCompare && (
                            <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                              {change.percent !== 0 ? `${change.percent > 0 ? "+" : ""}${change.percent.toFixed(1)}%` : "-"}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex gap-1">
                              {row.dqFlags.map(flag => {
                                const config = dqFlagConfig[flag]
                                return config ? (
                                  <Tooltip key={flag}>
                                    <TooltipTrigger>
                                      <Badge className={`${config.color} text-xs`}>{config.label}</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{config.description}</TooltipContent>
                                  </Tooltip>
                                ) : null
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.drillable && (
                              <Link href={`/bfis/reports/statements/drilldown?line=${row.lineCode}&period=${selectedPeriod}`}>
                                <Button variant="ghost" size="sm">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 底部链接 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/bfis/reports/statements/versions">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Layers className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-medium">版本管理</div>
                  <div className="text-sm text-muted-foreground">DAILY/MONTHLY/CLOSE 版本</div>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/bfis/reports/statements/quality">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="font-medium">口径与数据质量</div>
                  <div className="text-sm text-muted-foreground">管理口径说明与标记解释</div>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/bfis/reports/bridge">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium">口径差异桥（对金蝶）</div>
                  <div className="text-sm text-muted-foreground">与金蝶勾稽与差异解释</div>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </TooltipProvider>
  )
}
