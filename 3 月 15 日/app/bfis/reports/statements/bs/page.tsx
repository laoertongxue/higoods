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
  DollarSign,
  CreditCard,
  Wallet,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// BS1｜简化资产负债表页

// Mock 资产负债表数据
const bsData = {
  assets: [
    { lineCode: "BS_CASH", lineName: "货币资金", amountUsd: 1234567, compareUsd: 1173874, dqFlags: [], drillable: true, tooltip: "银行余额+平台待回款", children: [
      { lineCode: "BS_CASH_BANK", lineName: "银行余额", amountUsd: 834567, compareUsd: 793874, dqFlags: [], drillable: true, tooltip: "来自资金账户余额" },
      { lineCode: "BS_CASH_PLATFORM", lineName: "平台待回款", amountUsd: 400000, compareUsd: 380000, dqFlags: [], drillable: true, tooltip: "来自平台结算应收台账中的待回款部分" },
    ]},
    { lineCode: "BS_AR_PLATFORM", lineName: "平台结算应收", amountUsd: 567890, compareUsd: 585364, dqFlags: [], drillable: true, tooltip: "来自平台结算应收台账（期末四态余额）" },
    { lineCode: "BS_INVENTORY", lineName: "存货", amountUsd: 890123, compareUsd: 845617, dqFlags: ["DQ_COST_ESTIMATED"], drillable: true, tooltip: "来自存货价值台账（期末）" },
    { lineCode: "BS_SAMPLE_ASSET", lineName: "样衣资产", amountUsd: 123456, compareUsd: 117283, dqFlags: [], drillable: true, tooltip: "来自样衣资产台账（未摊销余额）" },
    { lineCode: "BS_FIXED_ASSET", lineName: "固定资产净值", amountUsd: 234567, compareUsd: 246295, dqFlags: [], drillable: true, tooltip: "原值-累计折旧" },
    { lineCode: "BS_OTHER_ASSET", lineName: "其他资产", amountUsd: 45678, compareUsd: 43394, dqFlags: [], drillable: true, tooltip: "预付等可收敛项目" },
  ],
  liabilities: [
    { lineCode: "BS_AP", lineName: "应付账款", amountUsd: 345678, compareUsd: 339539, dqFlags: [], drillable: true, tooltip: "来自往来台账（期末）", children: [
      { lineCode: "BS_AP_SUPPLIER", lineName: "供应商应付", amountUsd: 200000, compareUsd: 196500, dqFlags: [], drillable: true },
      { lineCode: "BS_AP_FACTORY", lineName: "工厂应付", amountUsd: 100000, compareUsd: 98250, dqFlags: [], drillable: true },
      { lineCode: "BS_AP_ANCHOR", lineName: "主播应付", amountUsd: 45678, compareUsd: 44789, dqFlags: ["DQ_STATEMENT_PENDING"], drillable: true },
    ]},
    { lineCode: "BS_ADVANCE_RECEIPT", lineName: "预收/待履约", amountUsd: 89012, compareUsd: 84561, dqFlags: [], drillable: true, tooltip: "预售未发货义务" },
    { lineCode: "BS_OTHER_LIAB", lineName: "其他负债", amountUsd: 56789, compareUsd: 53950, dqFlags: [], drillable: true, tooltip: "税费/暂估等" },
  ],
  equity: [
    { lineCode: "BS_RETAINED", lineName: "累计经营结果", amountUsd: 2548824, compareUsd: 2478800, dqFlags: [], drillable: true, tooltip: "期初+本期经营利润-分配等" },
    { lineCode: "BS_FX_REVAL", lineName: "汇兑及重估差额", amountUsd: 45678, compareUsd: 43394, dqFlags: ["DQ_REVAL_NOT_RUN"], drillable: true, tooltip: "来自月末重估（revaluation）结果" },
    { lineCode: "BS_OTHER_EQUITY", lineName: "其他权益调整", amountUsd: 9800, compareUsd: 9533, dqFlags: [], drillable: true },
  ],
}

// 数据质量标记配置
const dqFlagConfig: Record<string, { label: string; color: string; description: string }> = {
  DQ_FX_MISSING: { label: "汇率缺失", color: "bg-red-100 text-red-700", description: "汇率集或明细缺失" },
  DQ_COST_ESTIMATED: { label: "成本暂估", color: "bg-yellow-100 text-yellow-700", description: "成本暂估（预售/未回写）" },
  DQ_STATEMENT_PENDING: { label: "待结算", color: "bg-orange-100 text-orange-700", description: "结算未完结" },
  DQ_REVAL_NOT_RUN: { label: "未重估", color: "bg-gray-100 text-gray-700", description: "本期重估未执行" },
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

function BSPageContent() {
  const searchParams = useSearchParams()
  const [selectedPeriod, setSelectedPeriod] = useState(searchParams.get("period") || "2026-01")
  const [selectedVersion, setSelectedVersion] = useState("DAILY")
  const [selectedScope, setSelectedScope] = useState("GROUP")
  const [showCompare, setShowCompare] = useState(true)
  const [expandChildren, setExpandChildren] = useState(true)

  // 计算合计
  const totalAssets = bsData.assets.reduce((sum, r) => sum + r.amountUsd, 0)
  const totalLiabilities = bsData.liabilities.reduce((sum, r) => sum + r.amountUsd, 0)
  const totalEquity = bsData.equity.reduce((sum, r) => sum + r.amountUsd, 0)
  const totalLiabEquity = totalLiabilities + totalEquity

  // 统计数据质量问题
  const allDqFlags = [
    ...bsData.assets.flatMap(r => r.dqFlags),
    ...bsData.liabilities.flatMap(r => r.dqFlags),
    ...bsData.equity.flatMap(r => r.dqFlags),
  ]
  const uniqueDqFlags = [...new Set(allDqFlags)]

  // 检查平衡
  const isBalanced = Math.abs(totalAssets - totalLiabEquity) < 1

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
              <h1 className="text-2xl font-bold">简化资产负债表</h1>
              <p className="text-muted-foreground">
                管理口径资产负债表，使用期末汇率（END_PERIOD）折算到 USD
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

        {/* 平衡检查提示 */}
        {!isBalanced && (
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="flex-1">
              <span className="text-sm text-red-800">
                资产合计与负债权益合计不平衡，差额: {formatFullCurrency(totalAssets - totalLiabEquity)}
              </span>
            </div>
            <Link href="/bfis/reports/statements/quality">
              <Button variant="outline" size="sm">
                查看原因
              </Button>
            </Link>
          </div>
        )}

        {/* 数据质量提示 */}
        {uniqueDqFlags.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="flex-1">
              <span className="text-sm text-yellow-800">
                本期资产负债表存在 {uniqueDqFlags.length} 类数据质量问题
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
              <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-2">
                  <Switch id="compare" checked={showCompare} onCheckedChange={setShowCompare} />
                  <Label htmlFor="compare" className="text-sm">期初对比</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="expand" checked={expandChildren} onCheckedChange={setExpandChildren} />
                  <Label htmlFor="expand" className="text-sm">展开明细</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700">总资产</span>
              </div>
              <div className="text-xl font-bold text-blue-800">{formatFullCurrency(totalAssets)}</div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700">总负债</span>
              </div>
              <div className="text-xl font-bold text-red-800">{formatFullCurrency(totalLiabilities)}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">净资产/权益</span>
              </div>
              <div className="text-xl font-bold text-green-800">{formatFullCurrency(totalEquity)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">资产负债率</span>
              </div>
              <div className="text-xl font-bold">{((totalLiabilities / totalAssets) * 100).toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        {/* 资产负债表主体 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 资产 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" /> 资产
                </CardTitle>
                <Badge variant="outline">汇率: END_PERIOD</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>项目</TableHead>
                    <TableHead className="text-right">期末（USD）</TableHead>
                    {showCompare && <TableHead className="text-right">期初（USD）</TableHead>}
                    {showCompare && <TableHead className="text-right">变动%</TableHead>}
                    <TableHead className="w-[60px]">下钻</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bsData.assets.map((row) => {
                    const change = calcChange(row.amountUsd, row.compareUsd)
                    return (
                      <>
                        <TableRow key={row.lineCode}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{row.lineName}</span>
                              {row.tooltip && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>{row.tooltip}</TooltipContent>
                                </Tooltip>
                              )}
                              {row.dqFlags.map(flag => {
                                const config = dqFlagConfig[flag]
                                return config ? (
                                  <Badge key={flag} className={`${config.color} text-xs`}>{config.label}</Badge>
                                ) : null
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatFullCurrency(row.amountUsd)}</TableCell>
                          {showCompare && <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(row.compareUsd)}</TableCell>}
                          {showCompare && (
                            <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                              {change.percent > 0 ? "+" : ""}{change.percent.toFixed(1)}%
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
                        {expandChildren && row.children?.map((child) => {
                          const childChange = calcChange(child.amountUsd, child.compareUsd)
                          return (
                            <TableRow key={child.lineCode} className="bg-muted/20">
                              <TableCell className="pl-8 text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  {child.lineName}
                                  {child.dqFlags?.map(flag => {
                                    const config = dqFlagConfig[flag]
                                    return config ? (
                                      <Badge key={flag} className={`${config.color} text-xs`}>{config.label}</Badge>
                                    ) : null
                                  })}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(child.amountUsd)}</TableCell>
                              {showCompare && <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(child.compareUsd)}</TableCell>}
                              {showCompare && (
                                <TableCell className={`text-right text-sm ${childChange.percent > 0 ? "text-green-600" : childChange.percent < 0 ? "text-red-600" : ""}`}>
                                  {childChange.percent > 0 ? "+" : ""}{childChange.percent.toFixed(1)}%
                                </TableCell>
                              )}
                              <TableCell>
                                {child.drillable && (
                                  <Link href={`/bfis/reports/statements/drilldown?line=${child.lineCode}&period=${selectedPeriod}`}>
                                    <Button variant="ghost" size="sm">
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  </Link>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </>
                    )
                  })}
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell>资产合计</TableCell>
                    <TableCell className="text-right font-mono">{formatFullCurrency(totalAssets)}</TableCell>
                    {showCompare && <TableCell className="text-right font-mono">{formatFullCurrency(bsData.assets.reduce((sum, r) => sum + r.compareUsd, 0))}</TableCell>}
                    {showCompare && <TableCell></TableCell>}
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 负债与权益 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> 负债与权益
                </CardTitle>
                <Badge variant="outline">汇率: END_PERIOD</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>项目</TableHead>
                    <TableHead className="text-right">期末（USD）</TableHead>
                    {showCompare && <TableHead className="text-right">期初（USD）</TableHead>}
                    {showCompare && <TableHead className="text-right">变动%</TableHead>}
                    <TableHead className="w-[60px]">下钻</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 负债 */}
                  {bsData.liabilities.map((row) => {
                    const change = calcChange(row.amountUsd, row.compareUsd)
                    return (
                      <>
                        <TableRow key={row.lineCode}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{row.lineName}</span>
                              {row.tooltip && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>{row.tooltip}</TooltipContent>
                                </Tooltip>
                              )}
                              {row.dqFlags.map(flag => {
                                const config = dqFlagConfig[flag]
                                return config ? (
                                  <Badge key={flag} className={`${config.color} text-xs`}>{config.label}</Badge>
                                ) : null
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatFullCurrency(row.amountUsd)}</TableCell>
                          {showCompare && <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(row.compareUsd)}</TableCell>}
                          {showCompare && (
                            <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                              {change.percent > 0 ? "+" : ""}{change.percent.toFixed(1)}%
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
                        {expandChildren && row.children?.map((child) => {
                          const childChange = calcChange(child.amountUsd, child.compareUsd)
                          return (
                            <TableRow key={child.lineCode} className="bg-muted/20">
                              <TableCell className="pl-8 text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  {child.lineName}
                                  {child.dqFlags?.map(flag => {
                                    const config = dqFlagConfig[flag]
                                    return config ? (
                                      <Badge key={flag} className={`${config.color} text-xs`}>{config.label}</Badge>
                                    ) : null
                                  })}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(child.amountUsd)}</TableCell>
                              {showCompare && <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(child.compareUsd)}</TableCell>}
                              {showCompare && (
                                <TableCell className={`text-right text-sm ${childChange.percent > 0 ? "text-green-600" : childChange.percent < 0 ? "text-red-600" : ""}`}>
                                  {childChange.percent > 0 ? "+" : ""}{childChange.percent.toFixed(1)}%
                                </TableCell>
                              )}
                              <TableCell>
                                {child.drillable && (
                                  <Link href={`/bfis/reports/statements/drilldown?line=${child.lineCode}&period=${selectedPeriod}`}>
                                    <Button variant="ghost" size="sm">
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  </Link>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </>
                    )
                  })}
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-medium">负债小计</TableCell>
                    <TableCell className="text-right font-mono">{formatFullCurrency(totalLiabilities)}</TableCell>
                    {showCompare && <TableCell className="text-right font-mono">{formatFullCurrency(bsData.liabilities.reduce((sum, r) => sum + r.compareUsd, 0))}</TableCell>}
                    {showCompare && <TableCell></TableCell>}
                    <TableCell></TableCell>
                  </TableRow>
                  {/* 权益 */}
                  {bsData.equity.map((row) => {
                    const change = calcChange(row.amountUsd, row.compareUsd)
                    return (
                      <TableRow key={row.lineCode}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{row.lineName}</span>
                            {row.tooltip && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>{row.tooltip}</TooltipContent>
                              </Tooltip>
                            )}
                            {row.dqFlags.map(flag => {
                              const config = dqFlagConfig[flag]
                              return config ? (
                                <Badge key={flag} className={`${config.color} text-xs`}>{config.label}</Badge>
                              ) : null
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatFullCurrency(row.amountUsd)}</TableCell>
                        {showCompare && <TableCell className="text-right font-mono text-muted-foreground">{formatFullCurrency(row.compareUsd)}</TableCell>}
                        {showCompare && (
                          <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                            {change.percent > 0 ? "+" : ""}{change.percent.toFixed(1)}%
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
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell>负债与权益合计</TableCell>
                    <TableCell className="text-right font-mono">{formatFullCurrency(totalLiabEquity)}</TableCell>
                    {showCompare && <TableCell className="text-right font-mono">{formatFullCurrency(
                      bsData.liabilities.reduce((sum, r) => sum + r.compareUsd, 0) +
                      bsData.equity.reduce((sum, r) => sum + r.compareUsd, 0)
                    )}</TableCell>}
                    {showCompare && <TableCell></TableCell>}
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* 口径说明 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">口径说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">汇率口径</h4>
                <p className="text-muted-foreground">
                  资产负债表使用期末汇率（END_PERIOD）折算到 USD。
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">权益定义</h4>
                <p className="text-muted-foreground">
                  权益为管理口径，= 期初权益 + 本期经营利润 + 调整/抵消/重估影响。
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">平衡校验</h4>
                <p className="text-muted-foreground">
                  资产合计 = 负债合计 + 权益合计，存在差额时显示"未归类差额"。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

export default function BSPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BSPageContent />
    </Suspense>
  )
}
