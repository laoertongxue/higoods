"use client"

import { useState } from "react"
import Link from "next/link"
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  PieChart,
  BarChart3,
  Calendar,
  Download,
  Settings,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// FC2｜现金曲线与结构分析页
// 展示未来30天每日现金余额曲线、流动性结构（现金+1天+3天+7天+30天可用）、币种结构

// Mock 现金曲线数据（未来30天）
const cashCurveData = [
  { date: "2026-01-22", balance: 125000, minSafe: 50000, comfortZone: 80000, inflow: 45000, outflow: 38000 },
  { date: "2026-01-23", balance: 132000, minSafe: 50000, comfortZone: 80000, inflow: 52000, outflow: 45000 },
  { date: "2026-01-24", balance: 128000, minSafe: 50000, comfortZone: 80000, inflow: 38000, outflow: 42000 },
  { date: "2026-01-25", balance: 118000, minSafe: 50000, comfortZone: 80000, inflow: 35000, outflow: 45000 },
  { date: "2026-01-26", balance: 108000, minSafe: 50000, comfortZone: 80000, inflow: 28000, outflow: 38000 },
  { date: "2026-01-27", balance: 98000, minSafe: 50000, comfortZone: 80000, inflow: 25000, outflow: 35000 },
  { date: "2026-01-28", balance: 85000, minSafe: 50000, comfortZone: 80000, inflow: 22000, outflow: 35000 },
  { date: "2026-01-29", balance: 72000, minSafe: 50000, comfortZone: 80000, inflow: 18000, outflow: 31000 },
  { date: "2026-01-30", balance: 58000, minSafe: 50000, comfortZone: 80000, inflow: 15000, outflow: 29000 },
  { date: "2026-01-31", balance: 48000, minSafe: 50000, comfortZone: 80000, inflow: 12000, outflow: 22000 },
]

// Mock 流动性结构数据
const liquidityStructure = {
  cashNow: 125000,
  available1Day: 135000,
  available3Day: 145000,
  available7Day: 152000,
  available30Day: 168000,
}

// Mock 币种结构数据
const currencyStructure = [
  { currency: "USD", balance: 62500, percent: 50, inflow7d: 85000, outflow7d: 78000 },
  { currency: "IDR", balance: 37500, percent: 30, inflow7d: 125000000, outflow7d: 118000000 },
  { currency: "CNY", balance: 25000, percent: 20, inflow7d: 180000, outflow7d: 165000 },
]

// Mock 流入流出结构（按类型）
const inflowStructure = [
  { type: "平台到账", amount: 85000, percent: 45 },
  { type: "客户回款", amount: 52000, percent: 28 },
  { type: "供应商退款", amount: 28000, percent: 15 },
  { type: "其他收入", amount: 22000, percent: 12 },
]

const outflowStructure = [
  { type: "供应商付款", amount: 95000, percent: 48 },
  { type: "薪资社保", amount: 45000, percent: 23 },
  { type: "营销费用", amount: 32000, percent: 16 },
  { type: "租金水电", amount: 18000, percent: 9 },
  { type: "其他支出", amount: 8000, percent: 4 },
]

export default function ForecastCurvePage() {
  const [viewRange, setViewRange] = useState<"7d" | "14d" | "30d">("30d")

  const minBalance = Math.min(...cashCurveData.map((d) => d.balance))
  const maxBalance = Math.max(...cashCurveData.map((d) => d.balance))
  const criticalDays = cashCurveData.filter((d) => d.balance < 50000)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">现金曲线与结构分析</h1>
          <p className="text-muted-foreground">
            未来30天逐日现金余额曲线、流动性结构与币种分布
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出报告
          </Button>
          <Link href="/bfis/reports/forecast/rules">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              调整规则
            </Button>
          </Link>
        </div>
      </div>

      {/* 时间范围切换 */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewRange === "7d" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewRange("7d")}
        >
          7天
        </Button>
        <Button
          variant={viewRange === "14d" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewRange("14d")}
        >
          14天
        </Button>
        <Button
          variant={viewRange === "30d" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewRange("30d")}
        >
          30天
        </Button>
      </div>

      {/* 关键指标 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">当前余额</div>
            <div className="text-2xl font-bold mt-1">${liquidityStructure.cashNow.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">最低余额</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">${minBalance.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">最高余额</div>
            <div className="text-2xl font-bold text-green-600 mt-1">${maxBalance.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className={criticalDays.length > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className={`text-sm ${criticalDays.length > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              预警天数
            </div>
            <div className={`text-2xl font-bold mt-1 ${criticalDays.length > 0 ? "text-red-600" : ""}`}>
              {criticalDays.length}天
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">30日可用</div>
            <div className="text-2xl font-bold mt-1">${liquidityStructure.available30Day.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* 现金曲线图（模拟） */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            现金余额曲线（未来{viewRange === "7d" ? "7" : viewRange === "14d" ? "14" : "30"}天）
          </CardTitle>
          <CardDescription>
            绿色区域：舒适区 ($80k+) | 黄色区域：安全区 ($50k-$80k) | 红色区域：预警区 (&lt;$50k)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* 简化的曲线展示 */}
            {cashCurveData.slice(0, viewRange === "7d" ? 7 : viewRange === "14d" ? 14 : 30).map((day, i) => {
              const isLow = day.balance < 50000
              const isMedium = day.balance >= 50000 && day.balance < 80000
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground w-20">{day.date}</div>
                  <div className="flex-1 relative h-8 bg-muted rounded">
                    <div
                      className={`h-full rounded transition-all ${
                        isLow ? "bg-red-400" : isMedium ? "bg-yellow-400" : "bg-green-400"
                      }`}
                      style={{ width: `${(day.balance / maxBalance) * 100}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                      <span className="text-xs font-medium">${day.balance.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 w-32">
                    <ArrowUp className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600">${(day.inflow / 1000).toFixed(0)}k</span>
                    <ArrowDown className="h-3 w-3 text-red-600 ml-2" />
                    <span className="text-xs text-red-600">${(day.outflow / 1000).toFixed(0)}k</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 流动性结构与币种结构 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 流动性结构 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              流动性结构
            </CardTitle>
            <CardDescription>按可用时间窗口的资金可用性</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>时间窗口</TableHead>
                  <TableHead className="text-right">可用金额</TableHead>
                  <TableHead className="text-right">增量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>当前现金</TableCell>
                  <TableCell className="text-right font-mono">
                    ${liquidityStructure.cashNow.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>1天内可用</TableCell>
                  <TableCell className="text-right font-mono">
                    ${liquidityStructure.available1Day.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    +${(liquidityStructure.available1Day - liquidityStructure.cashNow).toLocaleString()}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>3天内可用</TableCell>
                  <TableCell className="text-right font-mono">
                    ${liquidityStructure.available3Day.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    +${(liquidityStructure.available3Day - liquidityStructure.available1Day).toLocaleString()}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>7天内可用</TableCell>
                  <TableCell className="text-right font-mono">
                    ${liquidityStructure.available7Day.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    +${(liquidityStructure.available7Day - liquidityStructure.available3Day).toLocaleString()}
                  </TableCell>
                </TableRow>
                <TableRow className="font-medium bg-muted/30">
                  <TableCell>30天内可用</TableCell>
                  <TableCell className="text-right font-mono">
                    ${liquidityStructure.available30Day.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    +${(liquidityStructure.available30Day - liquidityStructure.available7Day).toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 币种结构 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              币种结构
            </CardTitle>
            <CardDescription>当前余额与未来7天流入流出</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>币种</TableHead>
                  <TableHead className="text-right">当前余额</TableHead>
                  <TableHead className="text-right">占比</TableHead>
                  <TableHead className="text-right">7日净流入</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencyStructure.map((curr) => {
                  const netFlow = curr.inflow7d - curr.outflow7d
                  return (
                    <TableRow key={curr.currency}>
                      <TableCell>
                        <Badge variant="outline">{curr.currency}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">${curr.balance.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{curr.percent}%</TableCell>
                      <TableCell className={`text-right font-mono ${netFlow > 0 ? "text-green-600" : "text-red-600"}`}>
                        {netFlow > 0 ? "+" : ""}${netFlow.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 流入流出结构 */}
      <Tabs defaultValue="inflow">
        <TabsList>
          <TabsTrigger value="inflow">流入结构</TabsTrigger>
          <TabsTrigger value="outflow">流出结构</TabsTrigger>
        </TabsList>
        <TabsContent value="inflow">
          <Card>
            <CardHeader>
              <CardTitle>未来7天流入结构</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>流入类型</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead className="text-right">占比</TableHead>
                    <TableHead className="w-[200px]">占比条</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inflowStructure.map((item) => (
                    <TableRow key={item.type}>
                      <TableCell>{item.type}</TableCell>
                      <TableCell className="text-right font-mono">${item.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.percent}%</TableCell>
                      <TableCell>
                        <div className="h-4 bg-muted rounded">
                          <div
                            className="h-full bg-green-400 rounded"
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="outflow">
          <Card>
            <CardHeader>
              <CardTitle>未来7天流出结构</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>流出类型</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead className="text-right">占比</TableHead>
                    <TableHead className="w-[200px]">占比条</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outflowStructure.map((item) => (
                    <TableRow key={item.type}>
                      <TableCell>{item.type}</TableCell>
                      <TableCell className="text-right font-mono">${item.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.percent}%</TableCell>
                      <TableCell>
                        <div className="h-4 bg-muted rounded">
                          <div
                            className="h-full bg-red-400 rounded"
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
