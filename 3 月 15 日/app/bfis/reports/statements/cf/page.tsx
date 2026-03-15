"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import {
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  Calendar,
  Building2,
  FileText,
  ChevronLeft,
  ExternalLink,
  Info,
  AlertTriangle,
  Banknote,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// CF1｜简化现金流量表页

// Mock 现金流量表数据
const cfData = {
  operating: {
    label: "经营活动",
    inflows: [
      { lineCode: "CF_OP_IN_PLATFORM", lineName: "平台提现到账", amountUsd: 2450000, compareUsd: 2178889, dqFlags: [], drillable: true, tooltip: "来自提现与到账" },
      { lineCode: "CF_OP_IN_BANK", lineName: "银行收款", amountUsd: 230000, compareUsd: 203333, dqFlags: [], drillable: true, tooltip: "来自银行流水/收款登记" },
    ],
    outflows: [
      { lineCode: "CF_OP_OUT_SUPPLIER", lineName: "供应商付款", amountUsd: -1200000, compareUsd: -1066667, dqFlags: [], drillable: true, tooltip: "来自付款申请/银行流水" },
      { lineCode: "CF_OP_OUT_FACTORY", lineName: "工厂付款", amountUsd: -600000, compareUsd: -533333, dqFlags: [], drillable: true, tooltip: "来自付款申请/银行流水" },
      { lineCode: "CF_OP_OUT_ANCHOR", lineName: "主播结算付款", amountUsd: -280000, compareUsd: -248889, dqFlags: ["DQ_STATEMENT_PENDING"], drillable: true },
      { lineCode: "CF_OP_OUT_OTHER", lineName: "其他经营支出", amountUsd: -240000, compareUsd: -213333, dqFlags: [], drillable: true },
    ],
  },
  investing: {
    label: "投资活动",
    inflows: [
      { lineCode: "CF_INV_IN_DISPOSAL", lineName: "资产处置收入", amountUsd: 0, compareUsd: 0, dqFlags: [], drillable: true },
    ],
    outflows: [
      { lineCode: "CF_INV_OUT_FIXED", lineName: "固定资产购置", amountUsd: -35000, compareUsd: -31111, dqFlags: [], drillable: true },
      { lineCode: "CF_INV_OUT_SAMPLE", lineName: "样衣投入", amountUsd: -10000, compareUsd: -8889, dqFlags: [], drillable: true },
    ],
  },
  financing: {
    label: "筹资活动",
    inflows: [
      { lineCode: "CF_FIN_IN_LOAN", lineName: "借款收入", amountUsd: 0, compareUsd: 0, dqFlags: [], drillable: true },
    ],
    outflows: [
      { lineCode: "CF_FIN_OUT_REPAY", lineName: "还款支出", amountUsd: 0, compareUsd: 0, dqFlags: [], drillable: true },
    ],
  },
  summary: {
    cashBegin: { lineCode: "CF_CASH_BEGIN", lineName: "期初现金余额", amountUsd: 919567, compareUsd: 893874, dqFlags: [], drillable: true },
    cashEnd: { lineCode: "CF_CASH_END", lineName: "期末现金余额", amountUsd: 1234567, compareUsd: 1173874, dqFlags: ["DQ_CASH_RECON_DIFF"], drillable: true },
  },
}

// 数据质量标记配置
const dqFlagConfig: Record<string, { label: string; color: string; description: string }> = {
  DQ_CASH_RECON_DIFF: { label: "现金差异", color: "bg-purple-100 text-purple-700", description: "期末现金与账户/流水不一致" },
  DQ_STATEMENT_PENDING: { label: "待结算", color: "bg-orange-100 text-orange-700", description: "结算未完结" },
}

// 格式化金额
function formatFullCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

// 计算变动
function calcChange(current: number, compare: number): { amount: number; percent: number } {
  const amount = current - compare
  const percent = compare !== 0 ? ((current - compare) / Math.abs(compare)) * 100 : 0
  return { amount, percent }
}

function CFPageContent() {
  const searchParams = useSearchParams()
  const [selectedPeriod, setSelectedPeriod] = useState(searchParams.get("period") || "2026-01")
  const [selectedVersion, setSelectedVersion] = useState("DAILY")
  const [selectedScope, setSelectedScope] = useState("GROUP")
  const [showCompare, setShowCompare] = useState(true)

  // 计算各活动净额
  const opInflow = cfData.operating.inflows.reduce((sum, r) => sum + r.amountUsd, 0)
  const opOutflow = cfData.operating.outflows.reduce((sum, r) => sum + r.amountUsd, 0)
  const opNet = opInflow + opOutflow

  const invInflow = cfData.investing.inflows.reduce((sum, r) => sum + r.amountUsd, 0)
  const invOutflow = cfData.investing.outflows.reduce((sum, r) => sum + r.amountUsd, 0)
  const invNet = invInflow + invOutflow

  const finInflow = cfData.financing.inflows.reduce((sum, r) => sum + r.amountUsd, 0)
  const finOutflow = cfData.financing.outflows.reduce((sum, r) => sum + r.amountUsd, 0)
  const finNet = finInflow + finOutflow

  const totalNet = opNet + invNet + finNet
  const calculatedEnd = cfData.summary.cashBegin.amountUsd + totalNet
  const cashDiff = cfData.summary.cashEnd.amountUsd - calculatedEnd

  // 统计数据质量问题
  const allDqFlags = [
    ...cfData.operating.inflows.flatMap(r => r.dqFlags),
    ...cfData.operating.outflows.flatMap(r => r.dqFlags),
    ...cfData.investing.inflows.flatMap(r => r.dqFlags),
    ...cfData.investing.outflows.flatMap(r => r.dqFlags),
    ...cfData.financing.inflows.flatMap(r => r.dqFlags),
    ...cfData.financing.outflows.flatMap(r => r.dqFlags),
    ...cfData.summary.cashEnd.dqFlags,
  ]
  const uniqueDqFlags = [...new Set(allDqFlags)]

  const renderActivitySection = (
    activity: { label: string; inflows: typeof cfData.operating.inflows; outflows: typeof cfData.operating.outflows },
    netAmount: number
  ) => (
    <>
      <TableRow className="bg-muted/50 font-medium">
        <TableCell colSpan={showCompare ? 5 : 3}>{activity.label}</TableCell>
      </TableRow>
      <TableRow className="bg-green-50/50">
        <TableCell className="pl-6 font-medium text-green-700">现金流入</TableCell>
        <TableCell></TableCell>
        {showCompare && <TableCell></TableCell>}
        {showCompare && <TableCell></TableCell>}
        <TableCell></TableCell>
      </TableRow>
      {activity.inflows.map((row) => {
        const change = calcChange(row.amountUsd, row.compareUsd)
        return (
          <TableRow key={row.lineCode}>
            <TableCell className="pl-10">
              <div className="flex items-center gap-2">
                {row.lineName}
                {row.tooltip && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>{row.tooltip}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right font-mono text-green-600">{formatFullCurrency(row.amountUsd)}</TableCell>
            {showCompare && <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(row.compareUsd)}</TableCell>}
            {showCompare && (
              <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                {row.compareUsd !== 0 ? `${change.percent > 0 ? "+" : ""}${change.percent.toFixed(1)}%` : "-"}
              </TableCell>
            )}
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
      <TableRow className="bg-red-50/50">
        <TableCell className="pl-6 font-medium text-red-700">现金流出</TableCell>
        <TableCell></TableCell>
        {showCompare && <TableCell></TableCell>}
        {showCompare && <TableCell></TableCell>}
        <TableCell></TableCell>
      </TableRow>
      {activity.outflows.map((row) => {
        const change = calcChange(row.amountUsd, row.compareUsd)
        return (
          <TableRow key={row.lineCode}>
            <TableCell className="pl-10">
              <div className="flex items-center gap-2">
                {row.lineName}
                {row.dqFlags.map(flag => {
                  const config = dqFlagConfig[flag]
                  return config ? (
                    <Badge key={flag} className={`${config.color} text-xs`}>{config.label}</Badge>
                  ) : null
                })}
              </div>
            </TableCell>
            <TableCell className="text-right font-mono text-red-600">{formatFullCurrency(row.amountUsd)}</TableCell>
            {showCompare && <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(row.compareUsd)}</TableCell>}
            {showCompare && (
              <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                {row.compareUsd !== 0 ? `${change.percent > 0 ? "+" : ""}${change.percent.toFixed(1)}%` : "-"}
              </TableCell>
            )}
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
      <TableRow className="bg-muted/30 font-medium">
        <TableCell className="pl-6">{activity.label}净现金流</TableCell>
        <TableCell className={`text-right font-mono ${netAmount >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatFullCurrency(netAmount)}
        </TableCell>
        {showCompare && <TableCell></TableCell>}
        {showCompare && <TableCell></TableCell>}
        <TableCell></TableCell>
      </TableRow>
    </>
  )

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/bfis/reports/statements">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">简化现金流量表</h1>
              <p className="text-muted-foreground">
                管理口径现金流量表，以现金事实为主，使用期间固定汇率折算
              </p>
            </div>
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
          </div>
        </div>

        {/* 现金差异提示 */}
        {Math.abs(cashDiff) > 1 && (
          <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-purple-600 shrink-0" />
            <div className="flex-1">
              <span className="text-sm text-purple-800">
                期末现金余额与计算值存在差异: {formatFullCurrency(cashDiff)}，可能存在未达账项
              </span>
            </div>
            <Link href="/bfis/funds/reconcile">
              <Button variant="outline" size="sm">
                银行对账
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
                <Switch id="compare" checked={showCompare} onCheckedChange={setShowCompare} />
                <Label htmlFor="compare" className="text-sm">环比对比</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">经营净现金流</span>
              </div>
              <div className={`text-xl font-bold ${opNet >= 0 ? "text-green-800" : "text-red-800"}`}>
                {formatFullCurrency(opNet)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700">投资净现金流</span>
              </div>
              <div className={`text-xl font-bold ${invNet >= 0 ? "text-green-800" : "text-red-800"}`}>
                {formatFullCurrency(invNet)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">期初现金</span>
              </div>
              <div className="text-xl font-bold">{formatFullCurrency(cfData.summary.cashBegin.amountUsd)}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary">期末现金</span>
              </div>
              <div className="text-xl font-bold text-primary">{formatFullCurrency(cfData.summary.cashEnd.amountUsd)}</div>
            </CardContent>
          </Card>
        </div>

        {/* 现金流量表主体 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>简化现金流量表</CardTitle>
                <CardDescription>
                  期间: {selectedPeriod} | 版本: {selectedVersion} | 范围: {selectedScope === "GROUP" ? "集团合并" : selectedScope}
                </CardDescription>
              </div>
              <Badge variant="outline">汇率: PERIOD_FIXED</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[350px]">行项目</TableHead>
                  <TableHead className="text-right">本期（USD）</TableHead>
                  {showCompare && <TableHead className="text-right">上期（USD）</TableHead>}
                  {showCompare && <TableHead className="text-right">变动%</TableHead>}
                  <TableHead className="w-[80px]">下钻</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 期初现金 */}
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium">{cfData.summary.cashBegin.lineName}</TableCell>
                  <TableCell className="text-right font-mono">{formatFullCurrency(cfData.summary.cashBegin.amountUsd)}</TableCell>
                  {showCompare && <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(cfData.summary.cashBegin.compareUsd)}</TableCell>}
                  {showCompare && <TableCell></TableCell>}
                  <TableCell>
                    <Link href={`/bfis/reports/statements/drilldown?line=${cfData.summary.cashBegin.lineCode}&period=${selectedPeriod}`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>

                {/* 经营活动 */}
                {renderActivitySection(cfData.operating, opNet)}

                {/* 投资活动 */}
                {renderActivitySection(cfData.investing, invNet)}

                {/* 筹资活动 */}
                {renderActivitySection(cfData.financing, finNet)}

                {/* 现金净变动 */}
                <TableRow className="bg-primary/10 font-bold">
                  <TableCell>现金净变动</TableCell>
                  <TableCell className={`text-right font-mono ${totalNet >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatFullCurrency(totalNet)}
                  </TableCell>
                  {showCompare && <TableCell></TableCell>}
                  {showCompare && <TableCell></TableCell>}
                  <TableCell></TableCell>
                </TableRow>

                {/* 期末现金 */}
                <TableRow className="bg-primary/10 font-bold">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {cfData.summary.cashEnd.lineName}
                      {cfData.summary.cashEnd.dqFlags.map(flag => {
                        const config = dqFlagConfig[flag]
                        return config ? (
                          <Badge key={flag} className={`${config.color} text-xs`}>{config.label}</Badge>
                        ) : null
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatFullCurrency(cfData.summary.cashEnd.amountUsd)}</TableCell>
                  {showCompare && <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(cfData.summary.cashEnd.compareUsd)}</TableCell>}
                  {showCompare && <TableCell></TableCell>}
                  <TableCell>
                    <Link href={`/bfis/reports/statements/drilldown?line=${cfData.summary.cashEnd.lineCode}&period=${selectedPeriod}`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 口径说明 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">口径说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">数据来源</h4>
                <p className="text-muted-foreground">
                  以现金事实为主（银行流水/平台提现到账），按经营/投资/筹资三类汇总，不追求法定现金流量表的严格科目法。
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">对账要求</h4>
                <p className="text-muted-foreground">
                  期末现金必须能对上银行流水净变动（允许存在少量未达账项，需标注）。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

export default function CFPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CFPageContent />
    </Suspense>
  )
}
