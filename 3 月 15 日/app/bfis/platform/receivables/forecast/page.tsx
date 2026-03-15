"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target } from "lucide-react"

// AR3｜预测误差与规则效果页（P1，给财务调参用）

interface ForecastAccuracy {
  store: string
  period: string
  totalOrders: number
  predictedAmount: number
  actualAmount: number
  errorAmount: number
  errorPercent: number
  mapeScore: number
}

const mockAccuracy: ForecastAccuracy[] = [
  {
    store: "TikTok ID Main Store",
    period: "2025-12",
    totalOrders: 1250,
    predictedAmount: 285000000,
    actualAmount: 278500000,
    errorAmount: 6500000,
    errorPercent: 2.3,
    mapeScore: 3.1,
  },
  {
    store: "TikTok ID Fashion Outlet",
    period: "2025-12",
    totalOrders: 680,
    predictedAmount: 145000000,
    actualAmount: 152000000,
    errorAmount: -7000000,
    errorPercent: -4.6,
    mapeScore: 5.2,
  },
  {
    store: "Shopee ID Fashion Store",
    period: "2025-12",
    totalOrders: 890,
    predictedAmount: 178000000,
    actualAmount: 175200000,
    errorAmount: 2800000,
    errorPercent: 1.6,
    mapeScore: 2.8,
  },
]

export default function ForecastAccuracyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">预测误差与规则效果</h1>
        <p className="text-muted-foreground">
          按店铺/国家/周期输出预测误差分布，指导财务校准费率/假设集规则
        </p>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">3.7%</div>
                <div className="text-sm text-muted-foreground">平均绝对误差</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">85%</div>
                <div className="text-sm text-muted-foreground">预测准确率</div>
                <div className="text-xs text-muted-foreground">误差&lt;5%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">2,820</div>
                <div className="text-sm text-muted-foreground">已验证订单</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">15</div>
                <div className="text-sm text-muted-foreground">需调参店铺</div>
                <div className="text-xs text-muted-foreground">误差&gt;10%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">账期</label>
              <Select defaultValue="2025-12">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-12">2025-12</SelectItem>
                  <SelectItem value="2025-11">2025-11</SelectItem>
                  <SelectItem value="2025-10">2025-10</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">平台</label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部平台</SelectItem>
                  <SelectItem value="TIKTOK">TikTok</SelectItem>
                  <SelectItem value="SHOPEE">Shopee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">误差筛选</label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="good">优秀 (&lt;5%)</SelectItem>
                  <SelectItem value="medium">可接受 (5-10%)</SelectItem>
                  <SelectItem value="poor">需改进 (&gt;10%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accuracy Table */}
      <Card>
        <CardHeader>
          <CardTitle>按店铺预测准确率</CardTitle>
          <CardDescription>对比预测金额与实际确认金额，计算MAPE误差</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>店铺</TableHead>
                <TableHead>账期</TableHead>
                <TableHead className="text-right">订单数</TableHead>
                <TableHead className="text-right">预测金额</TableHead>
                <TableHead className="text-right">实际金额</TableHead>
                <TableHead className="text-right">误差金额</TableHead>
                <TableHead className="text-right">误差率</TableHead>
                <TableHead className="text-right">MAPE得分</TableHead>
                <TableHead>评级</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAccuracy.map((item, i) => {
                const isGood = Math.abs(item.errorPercent) < 5
                const isMedium = Math.abs(item.errorPercent) >= 5 && Math.abs(item.errorPercent) < 10
                const isPoor = Math.abs(item.errorPercent) >= 10

                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.store}</TableCell>
                    <TableCell>{item.period}</TableCell>
                    <TableCell className="text-right">{item.totalOrders.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">
                      IDR {(item.predictedAmount / 1000000).toFixed(1)}M
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      IDR {(item.actualAmount / 1000000).toFixed(1)}M
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={item.errorAmount > 0 ? "text-red-600" : "text-green-600"}>
                        {item.errorAmount > 0 ? "+" : ""}
                        {(item.errorAmount / 1000000).toFixed(1)}M
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.errorPercent > 0 ? (
                          <TrendingUp className="h-3 w-3 text-red-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-green-600" />
                        )}
                        <span
                          className={
                            item.errorPercent > 0 ? "text-red-600" : "text-green-600"
                          }
                        >
                          {Math.abs(item.errorPercent).toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{item.mapeScore.toFixed(1)}%</TableCell>
                    <TableCell>
                      {isGood && (
                        <Badge className="bg-green-100 text-green-700">优秀</Badge>
                      )}
                      {isMedium && (
                        <Badge className="bg-yellow-100 text-yellow-700">可接受</Badge>
                      )}
                      {isPoor && (
                        <Badge className="bg-red-100 text-red-700">需改进</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>改进建议</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-900">
                    TikTok ID Main Store 和 Shopee ID Fashion Store 预测准确率优秀
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    误差率均在3%以内，当前费率假设和履约时长配置合理，建议保持
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-yellow-900">
                    TikTok ID Fashion Outlet 持续低估实际回款
                  </div>
                  <div className="text-xs text-yellow-700 mt-1">
                    建议：检查该店铺的历史费率均值配置（当前可能偏高），或考虑该店铺是否有特殊促销/费率优惠
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Target className="h-4 w-4 text-purple-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-purple-900">
                    整体预测准确率达到85%
                  </div>
                  <div className="text-xs text-purple-700 mt-1">
                    当前规则集对COD主链路的覆盖良好，继续优化履约事件接入可进一步提升置信度
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
