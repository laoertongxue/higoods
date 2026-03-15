"use client"

import Link from "next/link"
import {
  Coins,
  ArrowRightLeft,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
  Upload,
  ChevronRight,
  RefreshCw,
  Globe,
  Layers,
  Lock,
  Unlock,
  BookOpen,
  Calendar,
  Database,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"

// FX0｜币种与汇率中心总览页（健康度/缺失/波动/锁定状态）
// 核心模式：期间固定汇率 + 月末重估（revaluation）

// Mock 健康度数据
const healthStats = {
  totalCurrencies: 3,
  totalRateSets: 14,
  lockedRateSets: 10,
  activeRateSets: 2,
  draftRateSets: 2,
  missingAlerts: 2,
  volatilityAlerts: 1,
  overrideCount: 3,
  unlockCount: 1,
  coveragePercent: 92,
}

// Mock 当期各账本汇率集状态
const ledgerRateSetStatus = [
  { ledger: "GL_MGMT_USD", ledgerName: "集团管理账本", periodFixed: "LOCKED", endPeriod: "LOCKED", currency: "USD" },
  { ledger: "GL_ID_BDG_IDR", ledgerName: "BDG法定账本", periodFixed: "LOCKED", endPeriod: "ACTIVE", currency: "IDR" },
  { ledger: "GL_ID_JKT_IDR", ledgerName: "JKT法定账本", periodFixed: "LOCKED", endPeriod: "DRAFT", currency: "IDR" },
  { ledger: "GL_CN_BJ_CNY", ledgerName: "BJ法定账本", periodFixed: "ACTIVE", endPeriod: "DRAFT", currency: "CNY" },
  { ledger: "GL_CN_SZ_CNY", ledgerName: "SZ法定账本", periodFixed: "LOCKED", endPeriod: "LOCKED", currency: "CNY" },
  { ledger: "GL_HK_USD", ledgerName: "HK法定账本", periodFixed: "LOCKED", endPeriod: "LOCKED", currency: "USD" },
]

// Mock 预警数据
const recentAlerts = [
  { id: "AL001", type: "MISSING", message: "GL_CN_BJ_CNY 2026-01 PERIOD_FIXED 汇率集缺失 USD/CNY", severity: "high", createdAt: "2026-01-21 08:00" },
  { id: "AL002", type: "VOLATILITY", message: "USD/IDR 期间固定汇率较上期波动 3.5%，超过阈值", severity: "medium", createdAt: "2026-01-21 07:30" },
  { id: "AL003", type: "OVERRIDE", message: "GL_MGMT_USD 2026-01 期间固定汇率集 USD/IDR 被手工覆盖", severity: "low", createdAt: "2026-01-20 16:00" },
  { id: "AL004", type: "UNLOCK", message: "GL_ID_BDG_IDR 2025-12 END_PERIOD 汇率集被解锁", severity: "high", createdAt: "2026-01-19 10:00" },
]

// Mock 策略使用情况
const policyUsage = [
  { code: "POLICY_REPORT_PL_PERIOD_FIXED_USD", name: "报表利润-期间固定", domain: "REPORT", rateType: "PERIOD_FIXED", usedBy: 45 },
  { code: "POLICY_REPORT_BS_END_PERIOD_USD", name: "报表资产负债-期末", domain: "REPORT", rateType: "END_PERIOD", usedBy: 30 },
  { code: "POLICY_MARGIN_PERIOD_FIXED_USD", name: "毛利核算-期间固定", domain: "COST", rateType: "PERIOD_FIXED", usedBy: 28 },
  { code: "POLICY_BANK_SPOT_USD", name: "银行流水-即期", domain: "BANK", rateType: "SPOT", usedBy: 12 },
]

const alertTypeConfig: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  MISSING: { label: "缺失", color: "bg-red-100 text-red-700", icon: XCircle },
  VOLATILITY: { label: "波动", color: "bg-yellow-100 text-yellow-700", icon: TrendingUp },
  SYNC_FAIL: { label: "同步失败", color: "bg-orange-100 text-orange-700", icon: RefreshCw },
  OVERRIDE: { label: "覆盖", color: "bg-blue-100 text-blue-700", icon: FileText },
  UNLOCK: { label: "解锁", color: "bg-purple-100 text-purple-700", icon: Unlock },
}

const severityConfig: Record<string, string> = {
  high: "border-l-4 border-l-red-500 bg-red-50",
  medium: "border-l-4 border-l-yellow-500 bg-yellow-50",
  low: "border-l-4 border-l-blue-500 bg-blue-50",
}

const rateSetStatusConfig: Record<string, { label: string; color: string; icon: typeof Lock }> = {
  LOCKED: { label: "已锁定", color: "bg-green-100 text-green-700", icon: Lock },
  ACTIVE: { label: "生效中", color: "bg-blue-100 text-blue-700", icon: CheckCircle },
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700", icon: Clock },
}

const rateTypeLabels: Record<string, string> = {
  PERIOD_FIXED: "期间固定",
  END_PERIOD: "期末",
  SPOT: "即期",
}

export default function CurrencyOverviewPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">币种与汇率中心</h1>
          <p className="text-muted-foreground">
            以"期间固定汇率 + 月末重估"为主模式，统一维护汇率来源、按账本/期间的汇率集与解析策略
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/bfis/settings/currency/rate-sets">
            <Button variant="outline" size="sm">
              <Database className="h-4 w-4 mr-2" />
              生成汇率集
            </Button>
          </Link>
          <Link href="/bfis/settings/currency/import">
            <Button size="sm">
              <Upload className="h-4 w-4 mr-2" />
              导入汇率
            </Button>
          </Link>
        </div>
      </div>

      {/* 健康度概览 */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                汇率健康度
              </CardTitle>
              <CardDescription className="mt-1">集团报告币: USD | 当前期间: 2026-01 | 主模式: 期间固定 + 月末重估</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">汇率集完整度</span>
              <div className="w-32">
                <Progress value={healthStats.coveragePercent} className="h-2" />
              </div>
              <span className="text-sm font-bold">{healthStats.coveragePercent}%</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
            <div className="p-3 bg-background rounded-lg text-center">
              <div className="text-2xl font-bold">{healthStats.totalCurrencies}</div>
              <div className="text-xs text-muted-foreground">启用币种</div>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <div className="text-2xl font-bold">{healthStats.totalRateSets}</div>
              <div className="text-xs text-muted-foreground">汇率集总数</div>
            </div>
            <div className="p-3 bg-green-100 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">{healthStats.lockedRateSets}</div>
              <div className="text-xs text-green-600">已锁定</div>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">{healthStats.activeRateSets}</div>
              <div className="text-xs text-blue-600">生效中</div>
            </div>
            <div className={`p-3 rounded-lg text-center ${healthStats.draftRateSets > 0 ? "bg-gray-100" : "bg-background"}`}>
              <div className={`text-2xl font-bold ${healthStats.draftRateSets > 0 ? "text-gray-700" : ""}`}>
                {healthStats.draftRateSets}
              </div>
              <div className="text-xs text-gray-600">草稿</div>
            </div>
            <div className={`p-3 rounded-lg text-center ${healthStats.missingAlerts > 0 ? "bg-red-100" : "bg-background"}`}>
              <div className={`text-2xl font-bold ${healthStats.missingAlerts > 0 ? "text-red-600" : ""}`}>
                {healthStats.missingAlerts}
              </div>
              <div className={`text-xs ${healthStats.missingAlerts > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                缺失预警
              </div>
            </div>
            <div className={`p-3 rounded-lg text-center ${healthStats.volatilityAlerts > 0 ? "bg-yellow-100" : "bg-background"}`}>
              <div className={`text-2xl font-bold ${healthStats.volatilityAlerts > 0 ? "text-yellow-600" : ""}`}>
                {healthStats.volatilityAlerts}
              </div>
              <div className={`text-xs ${healthStats.volatilityAlerts > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                波动预警
              </div>
            </div>
            <div className={`p-3 rounded-lg text-center ${healthStats.overrideCount > 0 ? "bg-blue-100" : "bg-background"}`}>
              <div className={`text-2xl font-bold ${healthStats.overrideCount > 0 ? "text-blue-600" : ""}`}>
                {healthStats.overrideCount}
              </div>
              <div className={`text-xs ${healthStats.overrideCount > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
                手工覆盖
              </div>
            </div>
            <div className={`p-3 rounded-lg text-center ${healthStats.unlockCount > 0 ? "bg-purple-100" : "bg-background"}`}>
              <div className={`text-2xl font-bold ${healthStats.unlockCount > 0 ? "text-purple-600" : ""}`}>
                {healthStats.unlockCount}
              </div>
              <div className={`text-xs ${healthStats.unlockCount > 0 ? "text-purple-600" : "text-muted-foreground"}`}>
                解锁次数
              </div>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <div className="text-2xl font-bold">{policyUsage.length}</div>
              <div className="text-xs text-muted-foreground">策略数</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Link href="/bfis/settings/currency/currencies">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Coins className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">币种管理</div>
                <div className="text-xs text-muted-foreground">USD/CNY/IDR</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bfis/settings/currency/rate-sets">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full border-primary/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Database className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">期间汇率集</div>
                <div className="text-xs text-muted-foreground">核心功能</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bfis/settings/currency/rates">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ArrowRightLeft className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">原子汇率</div>
                <div className="text-xs text-muted-foreground">补录/审计</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bfis/settings/currency/policy">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Layers className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">汇率策略</div>
                <div className="text-xs text-muted-foreground">解析规则</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bfis/settings/currency/alerts">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">汇率预警</div>
                <div className="text-xs text-muted-foreground">{healthStats.missingAlerts + healthStats.volatilityAlerts}条待处理</div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 当期各账本汇率集状态 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                当期汇率集状态 (2026-01)
              </CardTitle>
              <CardDescription>各账本 PERIOD_FIXED / END_PERIOD 汇率集的锁定状态</CardDescription>
            </div>
            <Link href="/bfis/settings/currency/rate-sets">
              <Button variant="ghost" size="sm">
                查看全部 <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>账本</TableHead>
                <TableHead>账本名称</TableHead>
                <TableHead>本位币</TableHead>
                <TableHead className="text-center">期间固定 (PERIOD_FIXED)</TableHead>
                <TableHead className="text-center">期末 (END_PERIOD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerRateSetStatus.map((item) => (
                <TableRow key={item.ledger}>
                  <TableCell className="font-mono text-sm">{item.ledger}</TableCell>
                  <TableCell>{item.ledgerName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.currency}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={rateSetStatusConfig[item.periodFixed].color}>
                      {rateSetStatusConfig[item.periodFixed].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={rateSetStatusConfig[item.endPeriod].color}>
                      {rateSetStatusConfig[item.endPeriod].label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 预警列表 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">最新预警</CardTitle>
              <Link href="/bfis/settings/currency/alerts">
                <Button variant="ghost" size="sm">
                  查看全部 <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAlerts.map((alert) => {
              const config = alertTypeConfig[alert.type]
              const Icon = config.icon
              return (
                <div key={alert.id} className={`p-3 rounded-lg ${severityConfig[alert.severity]}`}>
                  <div className="flex items-start gap-3">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={config.color}>{config.label}</Badge>
                        <span className="text-xs text-muted-foreground">{alert.createdAt}</span>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* 策略使用情况 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">汇率策略</CardTitle>
              <Link href="/bfis/settings/currency/policy">
                <Button variant="ghost" size="sm">
                  查看全部 <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>策略名称</TableHead>
                  <TableHead>场景域</TableHead>
                  <TableHead>默认类型</TableHead>
                  <TableHead className="text-right">引用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policyUsage.map((policy) => (
                  <TableRow key={policy.code}>
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{policy.domain}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={policy.rateType === "PERIOD_FIXED" ? "bg-green-100 text-green-700" : policy.rateType === "END_PERIOD" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}>
                        {rateTypeLabels[policy.rateType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{policy.usedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 口径说明 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">汇率类型与口径说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Badge className="bg-green-100 text-green-700">PERIOD_FIXED</Badge> 期间固定汇率
              </h4>
              <p className="text-muted-foreground">
                期间内台账/报表/核算默认折算口径。某账本某期间内，对币对使用同一套汇率集进行折算，避免日波动造成报表不稳定。
              </p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-700">END_PERIOD</Badge> 期末汇率
              </h4>
              <p className="text-muted-foreground">
                期末余额折算与月末重估输入。用于资产负债类指标（现金余额、应收应付余额、存货余额）在期末的折算。
              </p>
            </div>
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Badge className="bg-orange-100 text-orange-700">SPOT</Badge> 即期汇率（可选兼容）
              </h4>
              <p className="text-muted-foreground">
                现金事实层（银行流水/到账日分析）或特定分析看板可使用。主模式下为可选兼容，非默认口径。
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">报价约定（统一，消除歧义）</h4>
            <p className="text-sm text-muted-foreground">
              采用 Base → Quote 报价：1 base = rate quote。例：USD→IDR = 15600 表示 1 USD = 15600 IDR。
              换算：base→quote: amount_quote = amount_base * rate；quote→base: amount_base = amount_quote / rate
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
