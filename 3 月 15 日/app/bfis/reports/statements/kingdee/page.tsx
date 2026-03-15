"use client"

import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  ExternalLink,
  DollarSign,
  Calendar,
  Building2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// MS5｜与金蝶差异入口页（跳转 2.5 或嵌入摘要）

// Mock 差异摘要
const differenceSummary = {
  period: "2026-01",
  version: "MONTHLY",
  managementRevenue: 2840000,
  kingdeeRevenue: 2860000,
  revenueDiff: -20000,
  managementProfit: 650000,
  kingdeeProfit: 640000,
  profitDiff: 10000,
  totalDiffCount: 15,
  majorDiffCount: 3,
}

// Mock 主要差异项
const majorDifferences = [
  {
    category: "收入确认",
    line: "PL.R1010",
    management: 2840000,
    kingdee: 2860000,
    diff: -20000,
    diffPercent: -0.7,
    reason: "管理口径按平台结算，金蝶按发货确认，时点差异1-2天",
    status: "EXPLAINED",
  },
  {
    category: "成本结转",
    line: "PL.R1020",
    management: 1515000,
    kingdee: 1520000,
    diff: -5000,
    diffPercent: -0.33,
    reason: "汇率折算差异，管理口径统一USD期间固定汇率",
    status: "EXPLAINED",
  },
  {
    category: "费用归集",
    line: "PL.R2010",
    management: 380000,
    kingdee: 365000,
    diff: 15000,
    diffPercent: 4.11,
    reason: "管理口径跨主体费用已归集，金蝶按法人主体入账",
    status: "EXPLAINED",
  },
]

// Mock 差异趋势
const differenceTrends = [
  { period: "2025-10", revenueDiff: -18000, profitDiff: 8000 },
  { period: "2025-11", revenueDiff: -22000, profitDiff: 12000 },
  { period: "2025-12", revenueDiff: -15000, profitDiff: 9000 },
  { period: "2026-01", revenueDiff: -20000, profitDiff: 10000 },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  EXPLAINED: { label: "已解释", color: "bg-green-100 text-green-700" },
  INVESTIGATING: { label: "调查中", color: "bg-yellow-100 text-yellow-700" },
  UNRESOLVED: { label: "待解决", color: "bg-red-100 text-red-700" },
}

export default function StatementsKingdeeDiffPage() {
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
            <h1 className="text-2xl font-bold">管理口径 vs 金蝶差异</h1>
            <p className="text-muted-foreground">快速查看关键差异项，详细分析跳转 2.5 对照表</p>
          </div>
        </div>
        <Link href="/bfis/reports/kingdee-comparison">
          <Button>
            查看详细对照表 <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* 差异摘要卡片 */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>差异摘要 - {differenceSummary.period}</CardTitle>
            <Badge variant="outline">{differenceSummary.version}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">管理口径收入</div>
              <div className="text-2xl font-bold">${(differenceSummary.managementRevenue / 1000).toFixed(0)}K</div>
            </div>
            <div className="p-4 bg-background rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">金蝶收入</div>
              <div className="text-2xl font-bold">${(differenceSummary.kingdeeRevenue / 1000).toFixed(0)}K</div>
            </div>
            <div className={`p-4 rounded-lg ${differenceSummary.revenueDiff < 0 ? "bg-red-50" : "bg-green-50"}`}>
              <div className="text-sm text-muted-foreground mb-1">收入差异</div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${differenceSummary.revenueDiff < 0 ? "text-red-600" : "text-green-600"}`}>
                {differenceSummary.revenueDiff < 0 ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                ${Math.abs(differenceSummary.revenueDiff / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {((differenceSummary.revenueDiff / differenceSummary.kingdeeRevenue) * 100).toFixed(2)}%
              </div>
            </div>
            <div className={`p-4 rounded-lg ${differenceSummary.profitDiff > 0 ? "bg-green-50" : "bg-red-50"}`}>
              <div className="text-sm text-muted-foreground mb-1">利润差异</div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${differenceSummary.profitDiff > 0 ? "text-green-600" : "text-red-600"}`}>
                {differenceSummary.profitDiff > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                ${Math.abs(differenceSummary.profitDiff / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {((differenceSummary.profitDiff / differenceSummary.kingdeeProfit) * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主要差异项 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>主要差异项</CardTitle>
              <CardDescription>差异金额较大或占比超过2%的项目</CardDescription>
            </div>
            <Badge variant="outline">
              {differenceSummary.majorDiffCount} / {differenceSummary.totalDiffCount} 项
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>类别</TableHead>
                <TableHead>报表行</TableHead>
                <TableHead className="text-right">管理口径</TableHead>
                <TableHead className="text-right">金蝶</TableHead>
                <TableHead className="text-right">差异</TableHead>
                <TableHead className="text-right">差异率</TableHead>
                <TableHead>原因说明</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {majorDifferences.map((diff, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{diff.category}</TableCell>
                  <TableCell className="font-mono text-sm">{diff.line}</TableCell>
                  <TableCell className="text-right font-mono">${(diff.management / 1000).toFixed(0)}K</TableCell>
                  <TableCell className="text-right font-mono">${(diff.kingdee / 1000).toFixed(0)}K</TableCell>
                  <TableCell className={`text-right font-mono ${diff.diff > 0 ? "text-green-600" : "text-red-600"}`}>
                    {diff.diff > 0 ? "+" : ""}${(diff.diff / 1000).toFixed(0)}K
                  </TableCell>
                  <TableCell className={`text-right ${Math.abs(diff.diffPercent) > 2 ? "font-bold" : ""}`}>
                    {diff.diffPercent > 0 ? "+" : ""}{diff.diffPercent.toFixed(2)}%
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <p className="text-sm text-muted-foreground">{diff.reason}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[diff.status].color}>{statusConfig[diff.status].label}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 差异趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>差异趋势（近4期）</CardTitle>
          <CardDescription>跟踪差异变化，识别异常波动</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {differenceTrends.map((trend, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-24 font-mono text-sm">{trend.period}</div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-20">收入差异:</span>
                    <div className="flex-1 bg-muted rounded-full h-2 relative">
                      <div
                        className={`absolute h-full rounded-full ${trend.revenueDiff < 0 ? "bg-red-500" : "bg-green-500"}`}
                        style={{ width: `${Math.abs((trend.revenueDiff / 25000) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-mono w-20 text-right ${trend.revenueDiff < 0 ? "text-red-600" : "text-green-600"}`}>
                      ${(trend.revenueDiff / 1000).toFixed(0)}K
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-20">利润差异:</span>
                    <div className="flex-1 bg-muted rounded-full h-2 relative">
                      <div
                        className={`absolute h-full rounded-full ${trend.profitDiff < 0 ? "bg-red-500" : "bg-green-500"}`}
                        style={{ width: `${Math.abs((trend.profitDiff / 15000) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-mono w-20 text-right ${trend.profitDiff < 0 ? "text-red-600" : "text-green-600"}`}>
                      ${(trend.profitDiff / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 差异原因汇总 */}
      <Card>
        <CardHeader>
          <CardTitle>差异原因汇总</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">1. 收入确认时点差异（-$20K）</h4>
            <p className="text-muted-foreground">
              管理口径按平台结算时点确认，金蝶按发货确认。差异通常在1-3天内自然消除。
            </p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">2. 汇率折算差异（-$5K）</h4>
            <p className="text-muted-foreground">
              管理口径统一USD期间固定汇率，金蝶各法人主体按本位币记账。汇兑损益单独列示。
            </p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">3. 费用归集维度差异（+$15K）</h4>
            <p className="text-muted-foreground">
              管理口径按店铺/SKU维度归集跨主体费用，金蝶按法人主体入账。体现业务实质。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
