"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import Link from "next/link"
import {
  ArrowDownToLine,
  Search,
  Filter,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// FC3｜未来流入明细页
// 列表：流入日期、流入类型、金额、来源、规则、置信度、币种

type InflowType = "PLATFORM_SETTLEMENT" | "CUSTOMER_RECEIVABLE" | "SUPPLIER_REFUND" | "OTHER_INCOME"
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW"

interface InflowItem {
  id: string
  inflowDate: string
  type: InflowType
  amount: number
  currency: string
  amountUsd: number
  source: string
  ruleCode: string
  ruleName: string
  confidence: ConfidenceLevel
  sourceDocId?: string
  remark?: string
}

const inflowTypeConfig: Record<InflowType, { label: string; color: string }> = {
  PLATFORM_SETTLEMENT: { label: "平台到账", color: "bg-blue-100 text-blue-700" },
  CUSTOMER_RECEIVABLE: { label: "客户回款", color: "bg-green-100 text-green-700" },
  SUPPLIER_REFUND: { label: "供应商退款", color: "bg-purple-100 text-purple-700" },
  OTHER_INCOME: { label: "其他收入", color: "bg-gray-100 text-gray-700" },
}

const confidenceConfig: Record<ConfidenceLevel, { label: string; color: string }> = {
  HIGH: { label: "高", color: "bg-green-100 text-green-700" },
  MEDIUM: { label: "中", color: "bg-yellow-100 text-yellow-700" },
  LOW: { label: "低", color: "bg-orange-100 text-orange-700" },
}

// Mock 数据
const mockInflowData: InflowItem[] = [
  {
    id: "INF001",
    inflowDate: "2026-01-22",
    type: "PLATFORM_SETTLEMENT",
    amount: 250000000,
    currency: "IDR",
    amountUsd: 15800,
    source: "TikTok Shop",
    ruleCode: "RULE_TIKTOK_T0",
    ruleName: "TikTok T+0 推算",
    confidence: "HIGH",
    sourceDocId: "PLT_TKT_20260120_001",
  },
  {
    id: "INF002",
    inflowDate: "2026-01-23",
    type: "PLATFORM_SETTLEMENT",
    amount: 180000000,
    currency: "IDR",
    amountUsd: 11400,
    source: "Shopee",
    ruleCode: "RULE_SHOPEE_T3",
    ruleName: "Shopee T+3 推算",
    confidence: "HIGH",
    sourceDocId: "PLT_SPE_20260119_002",
  },
  {
    id: "INF003",
    inflowDate: "2026-01-24",
    type: "CUSTOMER_RECEIVABLE",
    amount: 8500,
    currency: "USD",
    amountUsd: 8500,
    source: "客户A",
    ruleCode: "RULE_AR_DUE",
    ruleName: "应收账款到期",
    confidence: "MEDIUM",
    sourceDocId: "AR_20251224_A001",
  },
  {
    id: "INF004",
    inflowDate: "2026-01-25",
    type: "PLATFORM_SETTLEMENT",
    amount: 320000000,
    currency: "IDR",
    amountUsd: 20250,
    source: "TikTok Shop",
    ruleCode: "RULE_TIKTOK_T0",
    ruleName: "TikTok T+0 推算",
    confidence: "MEDIUM",
  },
  {
    id: "INF005",
    inflowDate: "2026-01-26",
    type: "SUPPLIER_REFUND",
    amount: 52000,
    currency: "CNY",
    amountUsd: 7170,
    source: "供应商B",
    ruleCode: "RULE_REFUND_EST",
    ruleName: "退款预估",
    confidence: "LOW",
    remark: "样品质量问题退款",
  },
]

function InflowPageContent() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterConfidence, setFilterConfidence] = useState<string>("all")

  const filteredData = mockInflowData.filter((item) => {
    const matchSearch =
      searchQuery === "" ||
      item.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ruleName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchType = filterType === "all" || item.type === filterType
    const matchConfidence = filterConfidence === "all" || item.confidence === filterConfidence
    return matchSearch && matchType && matchConfidence
  })

  const totalAmount = filteredData.reduce((sum, item) => sum + item.amountUsd, 0)
  const highConfidenceAmount = filteredData
    .filter((item) => item.confidence === "HIGH")
    .reduce((sum, item) => sum + item.amountUsd, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">未来流入明细</h1>
          <p className="text-muted-foreground">未来30天预测流入明细，按日期、类型、规则查看</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Link href="/bfis/reports/forecast/rules">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              调整规则
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">流入条目数</div>
            <div className="text-2xl font-bold mt-1">{filteredData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">流入总额（USD）</div>
            <div className="text-2xl font-bold mt-1">${totalAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">高置信度金额</div>
            <div className="text-2xl font-bold text-green-600 mt-1">${highConfidenceAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">日均流入</div>
            <div className="text-2xl font-bold mt-1">${(totalAmount / 30).toFixed(0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索来源、规则..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="流入类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="PLATFORM_SETTLEMENT">平台到账</SelectItem>
            <SelectItem value="CUSTOMER_RECEIVABLE">客户回款</SelectItem>
            <SelectItem value="SUPPLIER_REFUND">供应商退款</SelectItem>
            <SelectItem value="OTHER_INCOME">其他收入</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterConfidence} onValueChange={setFilterConfidence}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="置信度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部置信度</SelectItem>
            <SelectItem value="HIGH">高</SelectItem>
            <SelectItem value="MEDIUM">中</SelectItem>
            <SelectItem value="LOW">低</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>流入日期</TableHead>
                <TableHead>流入类型</TableHead>
                <TableHead>来源</TableHead>
                <TableHead className="text-right">原币金额</TableHead>
                <TableHead className="text-right">USD金额</TableHead>
                <TableHead>规则</TableHead>
                <TableHead>置信度</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.inflowDate}</TableCell>
                  <TableCell>
                    <Badge className={inflowTypeConfig[item.type].color}>
                      {inflowTypeConfig[item.type].label}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.source}</TableCell>
                  <TableCell className="text-right font-mono">
                    {item.currency} {item.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    ${item.amountUsd.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-mono text-muted-foreground">{item.ruleCode}</span>
                      <span className="text-sm">{item.ruleName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={confidenceConfig[item.confidence].color}>
                      {confidenceConfig[item.confidence].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/bfis/reports/forecast/detail?id=${item.id}&type=inflow`}
                      className="text-primary hover:underline text-sm flex items-center gap-1"
                    >
                      详情
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function InflowPage() {
  return (
    <Suspense fallback={<Loading />}>
      <InflowPageContent />
    </Suspense>
  )
}
