"use client"

import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Building2,
  ArrowLeft,
  FileText,
  HelpCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// MS3｜口径说明与数据质量页（管理口径说明/标记解释）

// Mock 数据质量指标
const qualityMetrics = {
  completeness: 98,
  timeliness: 95,
  accuracy: 97,
  consistency: 96,
  totalIssues: 5,
  criticalIssues: 1,
  warningIssues: 3,
  infoIssues: 1,
}

// Mock 数据质量问题
const qualityIssues = [
  { id: "Q001", type: "CRITICAL", category: "COMPLETENESS", message: "ID_JKT_HIGOOD_LIVE 2026-01 期末应收账款余额缺失", affectedRows: ["BS.R2020"], createdAt: "2026-01-21 08:00" },
  { id: "Q002", type: "WARNING", category: "TIMELINESS", message: "CN_BJ_FANDE 2026-01 银行流水同步延迟", affectedRows: ["CF.R3010"], createdAt: "2026-01-20 18:00" },
  { id: "Q003", type: "WARNING", category: "ACCURACY", message: "HK_HIGOOD_PROC 期间固定汇率与上期波动超过3%", affectedRows: ["PL.R1010", "PL.R1020"], createdAt: "2026-01-19 10:00" },
  { id: "Q004", type: "INFO", category: "CONSISTENCY", message: "管理口径毛利 vs 金蝶毛利差异 2.3%，已标记", affectedRows: ["PL.R1030"], createdAt: "2026-01-18 15:00" },
  { id: "Q005", type: "WARNING", category: "COMPLETENESS", message: "ID_BDG_FADFAD 2026-01 部分费用归集未完成", affectedRows: ["PL.R2010"], createdAt: "2026-01-17 12:00" },
]

// Mock 管理口径说明
const managementCalibrations = [
  {
    category: "收入确认",
    rule: "按平台结算时点确认",
    difference: "vs 金蝶：金蝶按发货确认，管理口径按平台结算确认（更贴近现金流）",
    impact: "可能导致收入时点差异1-3天",
  },
  {
    category: "成本结转",
    rule: "按COGS已结转订单加权平均",
    difference: "vs 金蝶：金蝶按法定账本本位币，管理口径统一折算USD",
    impact: "汇率差异体现在汇兑损益中",
  },
  {
    category: "费用归集",
    rule: "按实际业务归属分摊",
    difference: "vs 金蝶：金蝶按法人主体，管理口径按店铺/SKU维度归集",
    impact: "费用分摊更精细，但需等归集完成",
  },
  {
    category: "汇率折算",
    rule: "期间固定汇率（PL）+ 期末汇率（BS）",
    difference: "vs 金蝶：金蝶各法人本位币，管理口径统一USD",
    impact: "汇兑损益单独列示，不混入经营损益",
  },
]

// Mock 标记解释
const labelExplanations = [
  {
    label: "EST",
    meaning: "估算值（Estimated）",
    usage: "数据未完成归集时使用历史均值或预估",
    example: "费用归集未完成时使用上期比例估算",
    color: "bg-yellow-100 text-yellow-700",
  },
  {
    label: "PROV",
    meaning: "暂估值（Provisional）",
    usage: "成本未最终结转时使用暂估成本",
    example: "当期订单未完成COGS结转时使用临时成本",
    color: "bg-orange-100 text-orange-700",
  },
  {
    label: "ADJ",
    meaning: "调整值（Adjusted）",
    usage: "管理口径与法定口径差异调整",
    example: "收入确认时点差异、跨期调整等",
    color: "bg-blue-100 text-blue-700",
  },
  {
    label: "REVAL",
    meaning: "重估值（Revaluation）",
    usage: "外币资产负债期末重估",
    example: "应收应付款项、现金余额期末汇率重估",
    color: "bg-purple-100 text-purple-700",
  },
  {
    label: "FINAL",
    meaning: "最终值（Finalized）",
    usage: "数据已锁定，不再变动",
    example: "月结完成、审计通过的数据",
    color: "bg-green-100 text-green-700",
  },
]

const issueTypeConfig: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { label: "严重", color: "bg-red-100 text-red-700", icon: XCircle },
  WARNING: { label: "警告", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  INFO: { label: "提示", color: "bg-blue-100 text-blue-700", icon: Info },
}

const categoryLabels: Record<string, string> = {
  COMPLETENESS: "完整性",
  TIMELINESS: "及时性",
  ACCURACY: "准确性",
  CONSISTENCY: "一致性",
}

export default function StatementsQualityPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/bfis/reports/statements">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">口径说明与数据质量</h1>
            <p className="text-muted-foreground">管理口径说明、标记解释、数据质量监控</p>
          </div>
        </div>
      </div>

      {/* 数据质量概览 */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            数据质量健康度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="p-3 bg-background rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{qualityMetrics.completeness}%</div>
              <div className="text-xs text-muted-foreground">完整性</div>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{qualityMetrics.timeliness}%</div>
              <div className="text-xs text-muted-foreground">及时性</div>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{qualityMetrics.accuracy}%</div>
              <div className="text-xs text-muted-foreground">准确性</div>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{qualityMetrics.consistency}%</div>
              <div className="text-xs text-muted-foreground">一致性</div>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <div className="text-2xl font-bold">{qualityMetrics.totalIssues}</div>
              <div className="text-xs text-muted-foreground">问题总数</div>
            </div>
            <div className={`p-3 rounded-lg text-center ${qualityMetrics.criticalIssues > 0 ? "bg-red-100" : "bg-background"}`}>
              <div className={`text-2xl font-bold ${qualityMetrics.criticalIssues > 0 ? "text-red-600" : ""}`}>
                {qualityMetrics.criticalIssues}
              </div>
              <div className={`text-xs ${qualityMetrics.criticalIssues > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                严重问题
              </div>
            </div>
            <div className={`p-3 rounded-lg text-center ${qualityMetrics.warningIssues > 0 ? "bg-yellow-100" : "bg-background"}`}>
              <div className={`text-2xl font-bold ${qualityMetrics.warningIssues > 0 ? "text-yellow-600" : ""}`}>
                {qualityMetrics.warningIssues}
              </div>
              <div className={`text-xs ${qualityMetrics.warningIssues > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                警告问题
              </div>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{qualityMetrics.infoIssues}</div>
              <div className="text-xs text-muted-foreground">提示信息</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="calibration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calibration">管理口径说明</TabsTrigger>
          <TabsTrigger value="labels">标记解释</TabsTrigger>
          <TabsTrigger value="quality">数据质量问题</TabsTrigger>
        </TabsList>

        {/* Tab 1: 管理口径说明 */}
        <TabsContent value="calibration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>管理口径 vs 法定口径（金蝶）差异说明</CardTitle>
              <CardDescription>
                管理口径以业务视角展示经营结果，法定口径满足合规要求。两者差异体现在确认时点、归集维度、折算口径等方面。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[120px]">类别</TableHead>
                    <TableHead>管理口径规则</TableHead>
                    <TableHead>vs 金蝶差异</TableHead>
                    <TableHead>影响</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managementCalibrations.map((cal, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{cal.category}</TableCell>
                      <TableCell>{cal.rule}</TableCell>
                      <TableCell className="text-muted-foreground">{cal.difference}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cal.impact}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>核心差异项说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">1. 收入确认时点</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  管理口径：按平台结算时点确认（Platform Settlement），更贴近现金流实现。
                </p>
                <p className="text-sm text-muted-foreground">
                  金蝶口径：按发货确认（Shipment），符合会计准则要求。
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">2. 汇率折算</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  管理口径：统一USD折算，期间固定汇率（PL）+ 期末汇率（BS），汇兑损益单独列示。
                </p>
                <p className="text-sm text-muted-foreground">
                  金蝶口径：各法人主体按本位币（IDR/CNY/USD）记账。
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">3. 费用归集</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  管理口径：按实际业务归属（店铺/SKU维度）分摊，需等归集完成。
                </p>
                <p className="text-sm text-muted-foreground">
                  金蝶口径：按法人主体入账，可能存在跨主体费用需手工分摊。
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: 标记解释 */}
        <TabsContent value="labels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>报表行标记解释</CardTitle>
              <CardDescription>
                报表中带标记的数据表示特殊状态或估算值，鼠标悬停可查看详细说明
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {labelExplanations.map((label, i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className={label.color}>{label.label}</Badge>
                    <span className="font-medium">{label.meaning}</span>
                  </div>
                  <div className="ml-2 space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">使用场景：</span>
                      <span className="ml-2">{label.usage}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">举例：</span>
                      <span className="ml-2 text-muted-foreground italic">{label.example}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>标记优先级与处理建议</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="font-medium text-red-700 mb-1">PROV（暂估）- 高优先级</div>
                  <p className="text-red-600">
                    成本暂估可能导致毛利偏差，需尽快完成COGS结转。建议3个工作日内完成。
                  </p>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="font-medium text-yellow-700 mb-1">EST（估算）- 中优先级</div>
                  <p className="text-yellow-600">
                    费用估算影响当期利润准确性，需完成费用归集。建议5个工作日内完成。
                  </p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="font-medium text-blue-700 mb-1">ADJ（调整）- 低优先级</div>
                  <p className="text-blue-600">
                    管理调整项已标记，供审计追溯。月结前需确认调整依据。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: 数据质量问题 */}
        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>当前数据质量问题</CardTitle>
              <CardDescription>按严重程度排序，优先处理严重问题</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {qualityIssues.map((issue) => {
                const config = issueTypeConfig[issue.type]
                const Icon = config.icon
                return (
                  <div
                    key={issue.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      issue.type === "CRITICAL"
                        ? "border-l-red-500 bg-red-50"
                        : issue.type === "WARNING"
                          ? "border-l-yellow-500 bg-yellow-50"
                          : "border-l-blue-500 bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={config.color}>{config.label}</Badge>
                          <Badge variant="outline">{categoryLabels[issue.category]}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">{issue.createdAt}</span>
                        </div>
                        <p className="text-sm font-medium mb-2">{issue.message}</p>
                        <div className="text-xs text-muted-foreground">
                          影响报表行：{issue.affectedRows.join(", ")}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
