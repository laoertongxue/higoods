"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import Link from "next/link"
import { ArrowLeft, FileText, GitBranch, Calendar, DollarSign, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"

// FC7｜预测条目详情页（追溯与规则命中）
// 展示单个流入/流出条目的完整追溯链：源单据 → 规则匹配 → 日期计算 → 金额折算 → 最终预测

function DetailPageContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") || ""
  const type = searchParams.get("type") || "inflow"

  // Mock 详情数据
  const detailData = {
    id: "INF001",
    type: "PLATFORM_SETTLEMENT",
    inflowDate: "2026-01-22",
    amount: 250000000,
    currency: "IDR",
    amountUsd: 15800,
    source: "TikTok Shop",
    ruleCode: "RULE_TIKTOK_T0",
    ruleName: "TikTok T+0 推算",
    confidence: "HIGH",
    sourceDoc: {
      id: "PLT_TKT_20260120_001",
      type: "PLATFORM_ORDER",
      createdAt: "2026-01-20 14:30:00",
      amount: 250000000,
      currency: "IDR",
      platformOrderId: "TKT20260120145632",
    },
    traceSteps: [
      {
        step: 1,
        name: "源单据识别",
        description: "识别平台订单 TKT20260120145632",
        timestamp: "2026-01-20 14:30:00",
        result: "成功匹配 TikTok Shop 订单",
      },
      {
        step: 2,
        name: "规则匹配",
        description: "匹配规则 RULE_TIKTOK_T0",
        timestamp: "2026-01-21 08:00:00",
        result: "命中规则：T+0 到账，跳过周末",
      },
      {
        step: 3,
        name: "日期计算",
        description: "基于 created_at 2026-01-20 计算 expected_settlement_at",
        timestamp: "2026-01-21 08:00:01",
        result: "T+0 = 2026-01-20（周一，工作日）→ 2026-01-20",
      },
      {
        step: 4,
        name: "银行到账日推算",
        description: "expected_settlement_at → bank_receipt_at",
        timestamp: "2026-01-21 08:00:02",
        result: "TikTok 一般延迟2天 → 2026-01-22",
      },
      {
        step: 5,
        name: "金额折算",
        description: "IDR 250,000,000 → USD",
        timestamp: "2026-01-21 08:00:03",
        result: "使用汇率 15,820 IDR/USD → $15,800",
      },
      {
        step: 6,
        name: "生成预测条目",
        description: "创建流入预测记录",
        timestamp: "2026-01-21 08:00:04",
        result: "INF001 已生成，置信度 HIGH",
      },
    ],
    ruleDetails: {
      code: "RULE_TIKTOK_T0",
      name: "TikTok Shop T+0 推算",
      platform: "TikTok Shop",
      t_days: 0,
      skip_weekend: true,
      skip_holiday: true,
      bank_delay_days: 2,
      confidence_base: 0.95,
    },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/bfis/reports/forecast/${type === "inflow" ? "inflow" : "outflow"}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">预测条目详情</h1>
          <p className="text-muted-foreground">完整追溯链：源单据 → 规则匹配 → 日期计算 → 金额折算</p>
        </div>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            预测条目基本信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-muted-foreground">条目ID</div>
              <div className="font-mono font-medium mt-1">{detailData.id}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">预测日期</div>
              <div className="font-medium mt-1">{detailData.inflowDate}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">原币金额</div>
              <div className="font-mono font-medium mt-1">
                {detailData.currency} {detailData.amount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">USD金额</div>
              <div className="font-mono font-medium text-lg mt-1">${detailData.amountUsd.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">来源</div>
              <div className="font-medium mt-1">{detailData.source}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">规则</div>
              <div className="font-mono text-sm mt-1">{detailData.ruleCode}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">置信度</div>
              <Badge className="mt-1 bg-green-100 text-green-700">高</Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">源单据</div>
              <div className="font-mono text-sm mt-1">{detailData.sourceDoc.id}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 源单据信息 */}
      <Card>
        <CardHeader>
          <CardTitle>源单据信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">单据ID</div>
              <div className="font-mono mt-1">{detailData.sourceDoc.id}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">平台订单号</div>
              <div className="font-mono mt-1">{detailData.sourceDoc.platformOrderId}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">创建时间</div>
              <div className="font-medium mt-1">{detailData.sourceDoc.createdAt}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">单据金额</div>
              <div className="font-mono mt-1">
                {detailData.sourceDoc.currency} {detailData.sourceDoc.amount.toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 规则详情 */}
      <Card>
        <CardHeader>
          <CardTitle>命中规则详情</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium w-[200px]">规则编码</TableCell>
                <TableCell className="font-mono">{detailData.ruleDetails.code}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">规则名称</TableCell>
                <TableCell>{detailData.ruleDetails.name}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">平台</TableCell>
                <TableCell>{detailData.ruleDetails.platform}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">T+天数</TableCell>
                <TableCell>
                  <Badge variant="outline">T+{detailData.ruleDetails.t_days}</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">跳过周末</TableCell>
                <TableCell>{detailData.ruleDetails.skip_weekend ? "是" : "否"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">跳过假日</TableCell>
                <TableCell>{detailData.ruleDetails.skip_holiday ? "是" : "否"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">银行延迟天数</TableCell>
                <TableCell>{detailData.ruleDetails.bank_delay_days} 天</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">基础置信度</TableCell>
                <TableCell>{(detailData.ruleDetails.confidence_base * 100).toFixed(0)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 追溯链 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            完整追溯链
          </CardTitle>
          <CardDescription>展示从源单据到最终预测的完整计算过程</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {detailData.traceSteps.map((step, i) => (
              <div key={i}>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{step.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">{step.description}</div>
                    <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm font-medium">结果：{step.result}</div>
                      <div className="text-xs text-muted-foreground mt-1">时间戳：{step.timestamp}</div>
                    </div>
                  </div>
                </div>
                {i < detailData.traceSteps.length - 1 && (
                  <div className="ml-4 h-8 w-0.5 bg-border" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline">导出追溯链</Button>
        <Button variant="outline">调整规则</Button>
        <Button>重新计算</Button>
      </div>
    </div>
  )
}

export default function ForecastDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DetailPageContent />
    </Suspense>
  )
}
