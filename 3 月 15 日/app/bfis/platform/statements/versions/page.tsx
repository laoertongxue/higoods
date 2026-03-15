"use client"

import { useState } from "react"
import {
  FileText,
  GitCompare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Minus,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// PS4｜版本与差异对比页

interface VersionComparison {
  metric: string
  v1_value: number
  v2_value: number
  delta: number
  delta_pct: number
}

const mockVersionComparison: VersionComparison[] = [
  { metric: "Total settlement amount", v1_value: 52050000, v2_value: 52138291, delta: 88291, delta_pct: 0.17 },
  { metric: "Total Revenue", v1_value: 66500000, v2_value: 66588910, delta: 88910, delta_pct: 0.13 },
  { metric: "Total Fees", v1_value: -14450000, v2_value: -14629619, delta: -179619, delta_pct: 1.24 },
  { metric: "Total adjustments", v1_value: 0, v2_value: 179000, delta: 179000, delta_pct: 100 },
]

const mockOrderDiffs = [
  { order_id: "581398744289062", field: "Ajustment amount", v1: "0", v2: "179000", reason: "平台补发调整" },
  { order_id: "581395820550726", field: "Platform commission fee", v1: "-17840", v2: "-18050", reason: "费率调整" },
]

export default function VersionsPage() {
  const [selectedStore, setSelectedStore] = useState("st_tiktok_jkt_01")
  const [selectedPeriod, setSelectedPeriod] = useState("2025-11")
  const [v1, setV1] = useState("v1")
  const [v2, setV2] = useState("v2")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">版本与差异对比</h1>
          <p className="text-muted-foreground">
            对比同一账期不同版本的账单数据，识别平台补发/调整导致的差异
          </p>
        </div>
      </div>

      {/* 选择对比版本 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">选择对比版本</CardTitle>
          <CardDescription>选择店铺、账期和要对比的两个版本</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">店铺</label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="st_tiktok_jkt_01">HiGOOD TikTok JKT</SelectItem>
                  <SelectItem value="st_shopee_jkt_01">HiGOOD Shopee JKT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">账期</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-11">2025-11</SelectItem>
                  <SelectItem value="2025-10">2025-10</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">版本1</label>
              <Select value={v1} onValueChange={setV1}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1">v1</SelectItem>
                  <SelectItem value="v2">v2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center mt-7">
              <GitCompare className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">版本2</label>
              <Select value={v2} onValueChange={setV2}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1">v1</SelectItem>
                  <SelectItem value="v2">v2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="mt-7">
              开始对比
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 差异摘要 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">4</div>
                <div className="text-sm text-muted-foreground">指标差异项</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FileText className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">2</div>
                <div className="text-sm text-muted-foreground">订单明细差异</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">+88K</div>
                <div className="text-sm text-muted-foreground">结算金额变化（IDR）</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 差异详情 Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="metrics" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="metrics">指标差异</TabsTrigger>
              <TabsTrigger value="orders">订单明细差异</TabsTrigger>
              <TabsTrigger value="summary">差异摘要</TabsTrigger>
            </TabsList>

            <TabsContent value="metrics" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>指标</TableHead>
                    <TableHead className="text-right">v1 值</TableHead>
                    <TableHead className="text-right">v2 值</TableHead>
                    <TableHead className="text-right">差异</TableHead>
                    <TableHead className="text-right">变化率</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockVersionComparison.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.metric}</TableCell>
                      <TableCell className="text-right font-mono">
                        {item.v1_value.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.v2_value.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={item.delta > 0 ? "text-green-600" : item.delta < 0 ? "text-red-600" : ""}>
                          {item.delta > 0 ? "+" : ""}{item.delta.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={item.delta_pct > 0 ? "text-green-600" : item.delta_pct < 0 ? "text-red-600" : ""}>
                          {item.delta_pct > 0 ? "+" : ""}{item.delta_pct}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {Math.abs(item.delta_pct) > 5 ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            显著变化
                          </Badge>
                        ) : item.delta !== 0 ? (
                          <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            轻微变化
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-700 border-green-300">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            无差异
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>订单ID</TableHead>
                    <TableHead>字段</TableHead>
                    <TableHead>v1 值</TableHead>
                    <TableHead>v2 值</TableHead>
                    <TableHead>可能原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockOrderDiffs.map((diff, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{diff.order_id}</TableCell>
                      <TableCell className="text-sm">{diff.field}</TableCell>
                      <TableCell className="font-mono text-sm">{diff.v1}</TableCell>
                      <TableCell className="font-mono text-sm">{diff.v2}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{diff.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="summary" className="mt-4">
              <div className="space-y-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900 mb-2">差异摘要</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>• v2 结算入账金额较 v1 增加 88,291 IDR（+0.17%）</li>
                          <li>• 主要变化来自新增调整金额 179,000 IDR</li>
                          <li>• 2 个订单的费用项存在微调（费率变更）</li>
                          <li>• 建议原因：平台月末补发调整单</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">处理建议</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="text-sm space-y-2 list-decimal list-inside">
                      <li>确认 v2 为平台最新官方版本</li>
                      <li>将 v1 状态更新为 SUPERSEDED（已替代）</li>
                      <li>更新 3.4 平台结算应收台账对应账期的金额</li>
                      <li>若已生成会计凭证，需评估是否需要冲销/调整凭证</li>
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
