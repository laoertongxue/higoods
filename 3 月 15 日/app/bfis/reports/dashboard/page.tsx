"use client"

import { useState } from "react"
import Link from "next/link"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  ShoppingCart,
  Package,
  AlertTriangle,
  ChevronRight,
  Info,
  RefreshCw,
  Settings,
  Calendar,
  Building2,
  Store,
  Globe,
  ArrowRightLeft,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

// GD1｜集团驾驶舱（主页面）
// 面向老板与管理层的"集团管理口径一屏总览"，以集团本位币 USD 为统一视角

// Mock 数据
const dashboardData = {
  // 经营结果
  operating: {
    netGMV: { usd: 2850000, native: { IDR: 44775000000, CNY: 20662500 }, mom: 0.125, confidence: 95, freshness: "2026-01-25 09:00" },
    grossProfit: { usd: 985000, native: { IDR: 15471500000, CNY: 7141250 }, mom: 0.08, confidence: 92, freshness: "2026-01-25 08:30" },
    grossMargin: { value: 34.6, mom: -0.8, confidence: 92, freshness: "2026-01-25 08:30" },
    marketingSpend: { usd: 285000, native: { IDR: 4477500000, CNY: 2066250 }, mom: 0.15, confidence: 90, freshness: "2026-01-24 18:00" },
    contributionProfit: { usd: 700000, native: { IDR: 10994000000, CNY: 5075000 }, mom: 0.06, confidence: 88, freshness: "2026-01-25 08:30" },
    operatingHealth: { score: 85, status: "GOOD", freshness: "2026-01-25 09:00" },
  },
  // 现金安全
  cashSafety: {
    bankCash: { usd: 1250000, native: { IDR: 19637500000, CNY: 9062500, USD: 150000 }, confidence: 98, freshness: "2026-01-25 10:00" },
    systemCash: { usd: 1248500, native: { IDR: 19614000000, CNY: 9051875, USD: 150000 }, confidence: 95, freshness: "2026-01-25 10:00" },
    delta: { usd: 1500, native: { IDR: 23500000, CNY: 10625 }, status: "OK", freshness: "2026-01-25 10:00" },
    lowestPoint: { usd: 850000, date: "2026-02-15", confidence: 78, freshness: "2026-01-25 09:00" },
    next30DaysInflow: { usd: 1850000, confidence: 82, freshness: "2026-01-25 09:00" },
    next30DaysOutflow: { usd: 2250000, confidence: 85, freshness: "2026-01-25 09:00" },
  },
  // 平台回款态势
  platformCollection: {
    forecast: { usd: 450000, count: 1250, confidence: 75 },
    pending: { usd: 680000, count: 850, confidence: 88 },
    withdrawable: { usd: 320000, count: 420, confidence: 95 },
    cashed: { usd: 1850000, count: 3200, confidence: 98 },
    inTransit: { usd: 280000, count: 180, confidence: 92 },
    overdue: [
      { store: "TK_ID_MAIN", entity: "ID_JKT_HIGOOD_LIVE", amount: 45000, days: 12, count: 15 },
      { store: "SP_ID_FASHION", entity: "ID_BDG_FADFAD", amount: 32000, days: 8, count: 8 },
      { store: "LZ_ID_OUTLET", entity: "ID_JKT_HIGOOD_LIVE", amount: 18000, days: 5, count: 5 },
    ],
  },
  // 资产与占用
  assets: {
    inventory: { usd: 850000, native: { IDR: 13357500000, CNY: 6162500 }, confidence: 90, freshness: "2026-01-24 20:00" },
    fixedAssets: { usd: 450000, native: { IDR: 7072500000, CNY: 3262500 }, confidence: 95, freshness: "2026-01-01 00:00" },
    sampleAssets: { usd: 120000, native: { IDR: 1884000000, CNY: 870000 }, confidence: 92, freshness: "2026-01-24 18:00" },
    receivables: { usd: 1450000, confidence: 88, freshness: "2026-01-25 09:00" },
  },
  // 风险与待办
  risks: {
    overdueCollection: { count: 28, severity: "HIGH" },
    cashDelta: { count: 3, severity: "MEDIUM" },
    marginMissing: { count: 2, severity: "LOW" },
    attributionMissing: { count: 15, severity: "HIGH" },
    rateVersionOutdated: { count: 0, severity: "LOW" },
  },
}

const metricDefinitions: Record<string, { name: string; formula: string; source: string; rateVersion: string; updateFrequency: string; commonDifferences: string }> = {
  NET_GMV: {
    name: "有效 GMV（Net GMV）",
    formula: "订单实收金额 - 退款 - 平台调整",
    source: "3.3 平台账单/结算单 + 3.4 平台结算应收台账",
    rateVersion: "9.2 期间固定汇率（2026-01）",
    updateFrequency: "T+0~T+1（取决于导入/同步）",
    commonDifferences: "与金蝶差异：时间口径（权责发生制 vs 收付实现制）、退款处理时点",
  },
  GROSS_PROFIT: {
    name: "销售毛利（Gross Profit）",
    formula: "有效 GMV - 销售成本（含运费成本）",
    source: "6.6 毛利核算快照（管理口径）",
    rateVersion: "9.2 期间固定汇率（2026-01）",
    updateFrequency: "T+1 或按核算批次",
    commonDifferences: "与金蝶差异：成本归集口径、费用分摊规则、内部交易处理",
  },
  BANK_CASH: {
    name: "银行现金余额（Bank Cash）",
    formula: "各银行账户余额快照合计（按 USD 折算）",
    source: "5.1 资金账户 - 银行余额快照",
    rateVersion: "9.2 期末汇率（2026-01）",
    updateFrequency: "取决于快照/对账（可为手工或导入）",
    commonDifferences: "与银行对账单差异：在途款项、未达账项、汇率差异",
  },
  RECEIVABLES_4STATE: {
    name: "平台应收四态",
    formula: "FORECAST（预计应收）+ PENDING（待结算）+ WITHDRAWABLE（可提现）+ CASHED（已回款）",
    source: "3.4 平台结算应收台账",
    rateVersion: "9.2 期间固定汇率 + 即期汇率",
    updateFrequency: "T+0~T+1",
    commonDifferences: "与金蝶应收账款差异：确认时点、币种折算、坏账准备",
  },
}

export default function GroupDashboardPage() {
  const [timeRange, setTimeRange] = useState("month")
  const [perspective, setPerspective] = useState("group")
  const [platform, setPlatform] = useState("all")
  const [currencyView, setCurrencyView] = useState("USD")
  const [consolidationMode, setConsolidationMode] = useState("management")
  const [showMetricDetail, setShowMetricDetail] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)

  const formatCurrency = (amount: number, currency: string = "USD") => {
    if (currency === "USD") {
      return `$${amount.toLocaleString()}`
    }
    return `${amount.toLocaleString()} ${currency}`
  }

  const formatChange = (change: number) => {
    const isPositive = change > 0
    return (
      <span className={`flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isPositive ? "+" : ""}{(change * 100).toFixed(1)}%
      </span>
    )
  }

  const openMetricDetail = (metricCode: string) => {
    setSelectedMetric(metricCode)
    setShowMetricDetail(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">集团驾驶舱</h1>
          <p className="text-muted-foreground">
            集团管理口径一屏总览 | 集团本位币: USD | 口径版本: 2026-01-MGMT-v1.2
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Link href="/bfis/reports/dashboard/config">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              配置
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">时间范围</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">今日</SelectItem>
                  <SelectItem value="week">本周</SelectItem>
                  <SelectItem value="month">本月</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">视角</label>
              <Select value={perspective} onValueChange={setPerspective}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">集团</SelectItem>
                  <SelectItem value="entity">按法人主体</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">平台</label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部平台</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="shopee">Shopee</SelectItem>
                  <SelectItem value="lazada">Lazada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">币种视图</label>
              <Select value={currencyView} onValueChange={setCurrencyView}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD（集团）</SelectItem>
                  <SelectItem value="native">原币</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">合并口径</label>
              <Select value={consolidationMode} onValueChange={setConsolidationMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="management">管理合并</SelectItem>
                  <SelectItem value="excluding_internal">不含内部</SelectItem>
                  <SelectItem value="legal_entity">法人视角</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" className="w-full bg-transparent">
                <Calendar className="h-4 w-4 mr-2" />
                应用筛选
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Operating Result */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">经营结果（Operating Result）</h2>
          <Link href="/bfis/reports/analysis">
            <Button variant="ghost" size="sm">
              查看详情 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openMetricDetail("NET_GMV")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">有效 GMV</div>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold mb-1">{formatCurrency(dashboardData.operating.netGMV.usd)}</div>
              <div className="flex items-center justify-between">
                {formatChange(dashboardData.operating.netGMV.mom)}
                <Badge variant="outline" className="text-xs">MoM</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {dashboardData.operating.netGMV.freshness}
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openMetricDetail("GROSS_PROFIT")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">毛利</div>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold mb-1">{formatCurrency(dashboardData.operating.grossProfit.usd)}</div>
              <div className="flex items-center justify-between">
                {formatChange(dashboardData.operating.grossProfit.mom)}
                <Badge variant="outline" className="text-xs">MoM</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {dashboardData.operating.grossProfit.freshness}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">毛利率</div>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold mb-1">{dashboardData.operating.grossMargin.value}%</div>
              <div className="flex items-center justify-between">
                {formatChange(dashboardData.operating.grossMargin.mom / 100)}
                <Badge variant="outline" className="text-xs">MoM</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {dashboardData.operating.grossMargin.freshness}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">营销费用</div>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold mb-1">{formatCurrency(dashboardData.operating.marketingSpend.usd)}</div>
              <div className="flex items-center justify-between">
                {formatChange(dashboardData.operating.marketingSpend.mom)}
                <Badge variant="outline" className="text-xs">MoM</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {dashboardData.operating.marketingSpend.freshness}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">贡献毛利</div>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold mb-1">{formatCurrency(dashboardData.operating.contributionProfit.usd)}</div>
              <div className="flex items-center justify-between">
                {formatChange(dashboardData.operating.contributionProfit.mom)}
                <Badge variant="outline" className="text-xs">MoM</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {dashboardData.operating.contributionProfit.freshness}
              </div>
            </CardContent>
          </Card>

          <Card className={dashboardData.operating.operatingHealth.status === "GOOD" ? "border-green-200 bg-green-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">经营健康度</div>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold mb-1">{dashboardData.operating.operatingHealth.score}</div>
              <div className="flex items-center justify-between">
                <Badge className="bg-green-100 text-green-700">{dashboardData.operating.operatingHealth.status}</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {dashboardData.operating.operatingHealth.freshness}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2: Cash Safety */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">现金安全（Cash Safety）</h2>
          <div className="flex gap-2">
            <Link href="/bfis/funds/accounts">
              <Button variant="ghost" size="sm">
                资金账户 <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <Link href="/bfis/reports/forecast">
              <Button variant="ghost" size="sm">
                资金预测 <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card onClick={() => openMetricDetail("BANK_CASH")} className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Wallet className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">银行现金余额</div>
                  <div className="text-xs text-muted-foreground">{dashboardData.cashSafety.bankCash.freshness}</div>
                </div>
              </div>
              <div className="text-2xl font-bold mb-2">{formatCurrency(dashboardData.cashSafety.bankCash.usd)}</div>
              <Progress value={dashboardData.cashSafety.bankCash.confidence} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">置信度: {dashboardData.cashSafety.bankCash.confidence}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">系统现金余额</div>
                  <div className="text-xs text-muted-foreground">{dashboardData.cashSafety.systemCash.freshness}</div>
                </div>
              </div>
              <div className="text-2xl font-bold mb-2">{formatCurrency(dashboardData.cashSafety.systemCash.usd)}</div>
              <Progress value={dashboardData.cashSafety.systemCash.confidence} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">置信度: {dashboardData.cashSafety.systemCash.confidence}%</div>
            </CardContent>
          </Card>

          <Card className={dashboardData.cashSafety.delta.status === "OK" ? "border-yellow-200 bg-yellow-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ArrowRightLeft className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">余额差异</div>
                  <div className="text-xs text-muted-foreground">{dashboardData.cashSafety.delta.freshness}</div>
                </div>
              </div>
              <div className="text-2xl font-bold mb-2">{formatCurrency(dashboardData.cashSafety.delta.usd)}</div>
              <Badge className="bg-yellow-100 text-yellow-700">{dashboardData.cashSafety.delta.status}</Badge>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-sm text-red-700 font-medium">预计最低现金点</div>
                  <div className="text-xs text-red-600">{dashboardData.cashSafety.lowestPoint.date}</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-red-700 mb-2">{formatCurrency(dashboardData.cashSafety.lowestPoint.usd)}</div>
              <Progress value={dashboardData.cashSafety.lowestPoint.confidence} className="h-2" />
              <div className="text-xs text-red-600 mt-1">置信度: {dashboardData.cashSafety.lowestPoint.confidence}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">未来 30 天净流入</div>
                  <div className="text-xs text-muted-foreground">{dashboardData.cashSafety.next30DaysInflow.freshness}</div>
                </div>
              </div>
              <div className="text-2xl font-bold mb-2 text-green-600">{formatCurrency(dashboardData.cashSafety.next30DaysInflow.usd)}</div>
              <Progress value={dashboardData.cashSafety.next30DaysInflow.confidence} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">置信度: {dashboardData.cashSafety.next30DaysInflow.confidence}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">未来 30 天净流出</div>
                  <div className="text-xs text-muted-foreground">{dashboardData.cashSafety.next30DaysOutflow.freshness}</div>
                </div>
              </div>
              <div className="text-2xl font-bold mb-2 text-red-600">{formatCurrency(dashboardData.cashSafety.next30DaysOutflow.usd)}</div>
              <Progress value={dashboardData.cashSafety.next30DaysOutflow.confidence} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">置信度: {dashboardData.cashSafety.next30DaysOutflow.confidence}%</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 3: Platform Collection */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">平台回款态势（Platform Collection）</h2>
          <Link href="/bfis/platform/receivables">
            <Button variant="ghost" size="sm">
              查看详情 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card onClick={() => openMetricDetail("RECEIVABLES_4STATE")} className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">应收四态</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="text-sm">预计应收（FORECAST）</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(dashboardData.platformCollection.forecast.usd)}</div>
                    <div className="text-xs text-muted-foreground">{dashboardData.platformCollection.forecast.count} 笔</div>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm">待结算（PENDING）</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(dashboardData.platformCollection.pending.usd)}</div>
                    <div className="text-xs text-muted-foreground">{dashboardData.platformCollection.pending.count} 笔</div>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">可提现（WITHDRAWABLE）</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(dashboardData.platformCollection.withdrawable.usd)}</div>
                    <div className="text-xs text-muted-foreground">{dashboardData.platformCollection.withdrawable.count} 笔</div>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">已回款（CASHED）</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(dashboardData.platformCollection.cashed.usd)}</div>
                    <div className="text-xs text-muted-foreground">{dashboardData.platformCollection.cashed.count} 笔</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">提现与超期</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">提现中待到账</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(dashboardData.platformCollection.inTransit.usd)}</div>
                    <div className="text-xs text-muted-foreground">{dashboardData.platformCollection.inTransit.count} 笔</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-red-600 mb-2">超期未到账 Top 3</div>
                {dashboardData.platformCollection.overdue.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-red-50 rounded">
                    <div>
                      <div className="text-sm font-medium">{item.store}</div>
                      <div className="text-xs text-muted-foreground">{item.entity}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-600">{formatCurrency(item.amount)}</div>
                      <div className="text-xs text-red-600">{item.days} 天 | {item.count} 笔</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 4: Assets & Inventory */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">资产与占用（Inventory & Assets）</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/bfis/cost/inventory/value">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Package className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">存货价值</div>
                    <div className="text-xs text-muted-foreground">{dashboardData.assets.inventory.freshness}</div>
                  </div>
                </div>
                <div className="text-2xl font-bold mb-2">{formatCurrency(dashboardData.assets.inventory.usd)}</div>
                <Progress value={dashboardData.assets.inventory.confidence} className="h-2" />
                <div className="text-xs text-muted-foreground mt-1">置信度: {dashboardData.assets.inventory.confidence}%</div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/bfis/assets/fixed">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">固定资产净值</div>
                    <div className="text-xs text-muted-foreground">{dashboardData.assets.fixedAssets.freshness}</div>
                  </div>
                </div>
                <div className="text-2xl font-bold mb-2">{formatCurrency(dashboardData.assets.fixedAssets.usd)}</div>
                <Progress value={dashboardData.assets.fixedAssets.confidence} className="h-2" />
                <div className="text-xs text-muted-foreground mt-1">置信度: {dashboardData.assets.fixedAssets.confidence}%</div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/bfis/assets/samples">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <ShoppingCart className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">样衣资产余额</div>
                    <div className="text-xs text-muted-foreground">{dashboardData.assets.sampleAssets.freshness}</div>
                  </div>
                </div>
                <div className="text-2xl font-bold mb-2">{formatCurrency(dashboardData.assets.sampleAssets.usd)}</div>
                <Progress value={dashboardData.assets.sampleAssets.confidence} className="h-2" />
                <div className="text-xs text-muted-foreground mt-1">置信度: {dashboardData.assets.sampleAssets.confidence}%</div>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">往来占用</div>
                  <div className="text-xs text-muted-foreground">{dashboardData.assets.receivables.freshness}</div>
                </div>
              </div>
              <div className="text-2xl font-bold mb-2">{formatCurrency(dashboardData.assets.receivables.usd)}</div>
              <Progress value={dashboardData.assets.receivables.confidence} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">置信度: {dashboardData.assets.receivables.confidence}%</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 5: Risk & To-do */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">风险与待办（Risk & To-do）</h2>
          <Link href="/bfis/workspace/alerts">
            <Button variant="ghost" size="sm">
              查看全部 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link href="/bfis/platform/withdraw?filter=overdue">
            <Card className={dashboardData.risks.overdueCollection.severity === "HIGH" ? "border-red-200 bg-red-50 cursor-pointer hover:border-red-300" : "cursor-pointer hover:border-primary/50"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div className="text-sm font-medium">回款超期未到账</div>
                </div>
                <div className="text-2xl font-bold text-red-600">{dashboardData.risks.overdueCollection.count}</div>
                <Badge className="mt-2 bg-red-100 text-red-700">{dashboardData.risks.overdueCollection.severity}</Badge>
              </CardContent>
            </Card>
          </Link>

          <Link href="/bfis/funds/accounts?filter=delta">
            <Card className={dashboardData.risks.cashDelta.severity === "MEDIUM" ? "border-yellow-200 bg-yellow-50 cursor-pointer hover:border-yellow-300" : "cursor-pointer hover:border-primary/50"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <div className="text-sm font-medium">资金账户余额差异</div>
                </div>
                <div className="text-2xl font-bold text-yellow-600">{dashboardData.risks.cashDelta.count}</div>
                <Badge className="mt-2 bg-yellow-100 text-yellow-700">{dashboardData.risks.cashDelta.severity}</Badge>
              </CardContent>
            </Card>
          </Link>

          <Link href="/bfis/cost/margin/snapshot?filter=missing">
            <Card className={dashboardData.risks.marginMissing.severity === "LOW" ? "border-gray-200 bg-gray-50 cursor-pointer hover:border-gray-300" : "cursor-pointer hover:border-primary/50"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-gray-600" />
                  <div className="text-sm font-medium">毛利快照缺失</div>
                </div>
                <div className="text-2xl font-bold text-gray-600">{dashboardData.risks.marginMissing.count}</div>
                <Badge className="mt-2 bg-gray-100 text-gray-700">{dashboardData.risks.marginMissing.severity}</Badge>
              </CardContent>
            </Card>
          </Link>

          <Link href="/bfis/platform/receivables?filter=missing_attribution">
            <Card className={dashboardData.risks.attributionMissing.severity === "HIGH" ? "border-red-200 bg-red-50 cursor-pointer hover:border-red-300" : "cursor-pointer hover:border-primary/50"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div className="text-sm font-medium">应收归属缺失</div>
                </div>
                <div className="text-2xl font-bold text-red-600">{dashboardData.risks.attributionMissing.count}</div>
                <Badge className="mt-2 bg-red-100 text-red-700">{dashboardData.risks.attributionMissing.severity}</Badge>
              </CardContent>
            </Card>
          </Link>

          <Link href="/bfis/settings/currency/rate-sets">
            <Card className="cursor-pointer hover:border-primary/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div className="text-sm font-medium">汇率口径版本</div>
                </div>
                <div className="text-2xl font-bold text-green-600">{dashboardData.risks.rateVersionOutdated.count}</div>
                <Badge className="mt-2 bg-green-100 text-green-700">OK</Badge>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* GD2: Metric Definition Sheet */}
      <Sheet open={showMetricDetail} onOpenChange={setShowMetricDetail}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>指标口径说明与数据血缘</SheetTitle>
            <SheetDescription>
              完整的指标定义、计算规则和数据来源追溯
            </SheetDescription>
          </SheetHeader>

          {selectedMetric && metricDefinitions[selectedMetric] && (
            <div className="space-y-6 mt-6">
              <div>
                <h3 className="font-medium mb-2">指标名称</h3>
                <p className="text-sm text-muted-foreground">{metricDefinitions[selectedMetric].name}</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">计算公式</h3>
                <div className="p-3 bg-muted rounded-lg">
                  <code className="text-sm">{metricDefinitions[selectedMetric].formula}</code>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">数据来源</h3>
                <p className="text-sm text-muted-foreground">{metricDefinitions[selectedMetric].source}</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">汇率口径</h3>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{metricDefinitions[selectedMetric].rateVersion}</span>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">更新频率</h3>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{metricDefinitions[selectedMetric].updateFrequency}</span>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">常见差异原因</h3>
                <p className="text-sm text-muted-foreground">{metricDefinitions[selectedMetric].commonDifferences}</p>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Link href="/bfis/reports/bridge" className="flex-1">
                  <Button variant="outline" className="w-full bg-transparent">
                    查看口径差异桥
                  </Button>
                </Link>
                <Button variant="default" onClick={() => setShowMetricDetail(false)}>
                  关闭
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
