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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// PL1｜简化利润表页

// Mock 利润表数据
const plData = [
  { lineCode: "PL_GMV_NET", lineName: "有效GMV（净额）", amountUsd: 2850000, compareUsd: 2533333, budgetUsd: 2800000, dqFlags: [], drillable: true, tooltip: "来自平台账单/结算单（已剔除退款/争议/调账后的净额）" },
  { lineCode: "PL_PLATFORM_FEE", lineName: "平台手续费/交易费", amountUsd: -171000, compareUsd: -152000, budgetUsd: -168000, dqFlags: [], drillable: true, tooltip: "来自平台账单费用项" },
  { lineCode: "PL_USER_SHIPPING", lineName: "用户运费（抵减项）", amountUsd: -85500, compareUsd: -76000, budgetUsd: -84000, dqFlags: [], drillable: true, tooltip: "来自订单/平台账单" },
  { lineCode: "PL_COGS", lineName: "销售成本（COGS）", amountUsd: -1596000, compareUsd: -1444000, budgetUsd: -1540000, dqFlags: ["DQ_COST_ESTIMATED"], drillable: true, tooltip: "来自销售成本结转+预售成本处理+成本版本回写差异" },
  { lineCode: "PL_GROSS_PROFIT", lineName: "毛利（Gross Profit）", amountUsd: 997500, compareUsd: 861333, budgetUsd: 1008000, dqFlags: [], drillable: false, isFormula: true, formula: "= GMV - 平台费 - 运费 - COGS" },
  { lineCode: "PL_GROSS_MARGIN", lineName: "毛利率", amountUsd: 35.0, compareUsd: 34.0, budgetUsd: 36.0, dqFlags: [], drillable: false, isFormula: true, isPercent: true, formula: "= 毛利 / GMV" },
  { lineCode: "PL_STORE_FEE", lineName: "平台店铺费用", amountUsd: -142500, compareUsd: -126667, budgetUsd: -140000, dqFlags: [], drillable: true, tooltip: "店铺服务费/佣金补扣等" },
  { lineCode: "PL_AD_EXPENSE", lineName: "推流/广告投放费用", amountUsd: -228000, compareUsd: -202667, budgetUsd: -224000, dqFlags: [], drillable: true, tooltip: "来自营销费用归集" },
  { lineCode: "PL_ANCHOR_SETTLE", lineName: "主播结算（薪资/提成）", amountUsd: -114000, compareUsd: -101333, budgetUsd: -112000, dqFlags: ["DQ_STATEMENT_PENDING"], drillable: true, tooltip: "来自结算与往来（已确认/已核销状态）" },
  { lineCode: "PL_FACTORY_FEE", lineName: "外协工厂加工费", amountUsd: -28500, compareUsd: -25333, budgetUsd: -28000, dqFlags: [], drillable: true, tooltip: "来自工厂结算" },
  { lineCode: "PL_LOGISTICS", lineName: "物流与履约成本", amountUsd: -57000, compareUsd: -50667, budgetUsd: -56000, dqFlags: [], drillable: true, tooltip: "来自物流费用归集" },
  { lineCode: "PL_OTHER_OPEX", lineName: "其他经营费用", amountUsd: -28500, compareUsd: -25333, budgetUsd: -28000, dqFlags: [], drillable: true, tooltip: "可收敛的其他费用项" },
  { lineCode: "PL_OPERATING_PROFIT", lineName: "经营利润（EBIT-like）", amountUsd: 399000, compareUsd: 329333, budgetUsd: 420000, dqFlags: [], drillable: false, isFormula: true, formula: "= 毛利 - 店铺费 - 广告费 - 主播 - 工厂 - 物流 - 其他" },
  { lineCode: "PL_OPERATING_MARGIN", lineName: "经营利润率", amountUsd: 14.0, compareUsd: 13.0, budgetUsd: 15.0, dqFlags: [], drillable: false, isFormula: true, isPercent: true, formula: "= 经营利润 / GMV" },
]

// 数据质量标记配置
const dqFlagConfig: Record<string, { label: string; color: string; description: string }> = {
  DQ_FX_MISSING: { label: "汇率缺失", color: "bg-red-100 text-red-700", description: "汇率集或明细缺失" },
  DQ_COST_ESTIMATED: { label: "成本暂估", color: "bg-yellow-100 text-yellow-700", description: "成本暂估（预售/未回写）" },
  DQ_STATEMENT_PENDING: { label: "账单待定", color: "bg-orange-100 text-orange-700", description: "平台账单未完结（争议/退款未闭环）" },
  DQ_COST_BACKFILL: { label: "成本回写", color: "bg-blue-100 text-blue-700", description: "成本版本后续回写导致历史毛利变动" },
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

function PLPageContent() {
  const searchParams = useSearchParams()
  const [selectedPeriod, setSelectedPeriod] = useState(searchParams.get("period") || "2026-01")
  const [selectedVersion, setSelectedVersion] = useState("DAILY")
  const [selectedScope, setSelectedScope] = useState("GROUP")
  const [showCompare, setShowCompare] = useState(true)
  const [showBudget, setShowBudget] = useState(false)
  const [compareType, setCompareType] = useState("MOM") // MOM: 环比, YOY: 同比

  const allDqFlags = plData.flatMap(r => r.dqFlags)
  const uniqueDqFlags = [...new Set(allDqFlags)]

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
              <h1 className="text-2xl font-bold">简化利润表</h1>
              <p className="text-muted-foreground">
                管理口径利润表，使用期间固定汇率（PERIOD_FIXED）折算到 USD
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

        {/* 数据质量提示 */}
        {uniqueDqFlags.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="flex-1">
              <span className="text-sm text-yellow-800">
                本期利润表存在 {uniqueDqFlags.length} 类数据质量问题
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
                  <Label htmlFor="compare" className="text-sm">对比分析</Label>
                </div>
                {showCompare && (
                  <Select value={compareType} onValueChange={setCompareType}>
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MOM">环比</SelectItem>
                      <SelectItem value="YOY">同比</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center gap-2">
                  <Switch id="budget" checked={showBudget} onCheckedChange={setShowBudget} />
                  <Label htmlFor="budget" className="text-sm">预算对比</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 利润表主体 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>简化利润表</CardTitle>
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
                  <TableHead className="w-[300px]">行项目</TableHead>
                  <TableHead className="text-right">本期（USD）</TableHead>
                  {showCompare && <TableHead className="text-right">{compareType === "MOM" ? "上期" : "去年同期"}（USD）</TableHead>}
                  {showCompare && <TableHead className="text-right">变动%</TableHead>}
                  {showBudget && <TableHead className="text-right">预算（USD）</TableHead>}
                  {showBudget && <TableHead className="text-right">预算达成%</TableHead>}
                  <TableHead className="w-[100px]">标记</TableHead>
                  <TableHead className="w-[80px]">下钻</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plData.map((row) => {
                  const change = calcChange(row.amountUsd, row.compareUsd)
                  const budgetChange = calcChange(row.amountUsd, row.budgetUsd)
                  const isHighlight = row.lineCode.includes("PROFIT") || row.lineCode.includes("MARGIN")
                  return (
                    <TableRow key={row.lineCode} className={isHighlight ? "bg-primary/5 font-medium" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {row.isFormula && <Badge variant="outline" className="text-xs">公式</Badge>}
                          <span>{row.lineName}</span>
                          {row.tooltip && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[300px]">
                                <p>{row.tooltip}</p>
                                {row.formula && <p className="mt-1 font-mono text-xs">{row.formula}</p>}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${!row.isPercent && row.amountUsd < 0 ? "text-red-600" : ""}`}>
                        {row.isPercent ? `${row.amountUsd.toFixed(1)}%` : formatFullCurrency(row.amountUsd)}
                      </TableCell>
                      {showCompare && (
                        <TableCell className={`text-right font-mono text-muted-foreground ${!row.isPercent && row.compareUsd < 0 ? "text-red-400" : ""}`}>
                          {row.isPercent ? `${row.compareUsd.toFixed(1)}%` : formatFullCurrency(row.compareUsd)}
                        </TableCell>
                      )}
                      {showCompare && (
                        <TableCell className={`text-right ${change.percent > 0 ? "text-green-600" : change.percent < 0 ? "text-red-600" : ""}`}>
                          <span className="flex items-center justify-end gap-1">
                            {change.percent > 0 ? <TrendingUp className="h-3 w-3" /> : change.percent < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                            {change.percent > 0 ? "+" : ""}{change.percent.toFixed(1)}%
                          </span>
                        </TableCell>
                      )}
                      {showBudget && (
                        <TableCell className={`text-right font-mono text-muted-foreground ${!row.isPercent && row.budgetUsd < 0 ? "text-red-400" : ""}`}>
                          {row.isPercent ? `${row.budgetUsd.toFixed(1)}%` : formatFullCurrency(row.budgetUsd)}
                        </TableCell>
                      )}
                      {showBudget && (
                        <TableCell className={`text-right ${budgetChange.percent >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {row.amountUsd > 0 
                            ? `${((row.amountUsd / row.budgetUsd) * 100).toFixed(1)}%`
                            : `${((row.budgetUsd / row.amountUsd) * 100).toFixed(1)}%`
                          }
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
                          <Link href={`/bfis/reports/statements/drilldown?line=${row.lineCode}&period=${selectedPeriod}&scope=${selectedScope}`}>
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

        {/* 口径说明 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">口径说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">汇率口径</h4>
                <p className="text-muted-foreground">
                  利润表使用期间固定汇率（PERIOD_FIXED）折算到 USD，确保同一期间内汇率稳定，便于经营分析。
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">数据来源</h4>
                <p className="text-muted-foreground">
                  GMV来自平台账单；COGS来自销售成本结转；费用来自费用归集与结算模块；可通过下钻查看明细。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

export default function PLPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PLPageContent />
    </Suspense>
  )
}
