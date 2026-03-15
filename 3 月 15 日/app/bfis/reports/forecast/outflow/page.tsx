"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import Link from "next/link"
import {
  ArrowUpFromLine,
  Search,
  Filter,
  Download,
  Calendar,
  AlertTriangle,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// FC4｜未来流出明细页
// 列表：流出日期、流出类型、金额、目标、规则、紧急度、币种

type OutflowType =
  | "SUPPLIER_PAYMENT"
  | "SALARY_SOCIAL"
  | "MARKETING_EXPENSE"
  | "RENT_UTILITY"
  | "TAX_PAYMENT"
  | "OTHER_EXPENSE"
type UrgencyLevel = "HIGH" | "MEDIUM" | "LOW"

interface OutflowItem {
  id: string
  outflowDate: string
  type: OutflowType
  amount: number
  currency: string
  amountUsd: number
  target: string
  ruleCode: string
  ruleName: string
  urgency: UrgencyLevel
  isFixed: boolean
  sourceDocId?: string
  remark?: string
}

const outflowTypeConfig: Record<OutflowType, { label: string; color: string }> = {
  SUPPLIER_PAYMENT: { label: "供应商付款", color: "bg-purple-100 text-purple-700" },
  SALARY_SOCIAL: { label: "薪资社保", color: "bg-blue-100 text-blue-700" },
  MARKETING_EXPENSE: { label: "营销费用", color: "bg-pink-100 text-pink-700" },
  RENT_UTILITY: { label: "租金水电", color: "bg-green-100 text-green-700" },
  TAX_PAYMENT: { label: "税费支付", color: "bg-orange-100 text-orange-700" },
  OTHER_EXPENSE: { label: "其他支出", color: "bg-gray-100 text-gray-700" },
}

const urgencyConfig: Record<UrgencyLevel, { label: string; color: string }> = {
  HIGH: { label: "高", color: "bg-red-100 text-red-700" },
  MEDIUM: { label: "中", color: "bg-yellow-100 text-yellow-700" },
  LOW: { label: "低", color: "bg-green-100 text-green-700" },
}

// Mock 数据
const mockOutflowData: OutflowItem[] = [
  {
    id: "OUT001",
    outflowDate: "2026-01-22",
    type: "SUPPLIER_PAYMENT",
    amount: 180000,
    currency: "CNY",
    amountUsd: 24840,
    target: "供应商A",
    ruleCode: "RULE_AP_DUE",
    ruleName: "应付账款到期",
    urgency: "HIGH",
    isFixed: true,
    sourceDocId: "AP_20251222_A001",
  },
  {
    id: "OUT002",
    outflowDate: "2026-01-25",
    type: "SALARY_SOCIAL",
    amount: 12500,
    currency: "USD",
    amountUsd: 12500,
    target: "员工工资",
    ruleCode: "RULE_SALARY_MONTHLY",
    ruleName: "月度工资发放",
    urgency: "HIGH",
    isFixed: true,
    remark: "每月25日固定发放",
  },
  {
    id: "OUT003",
    outflowDate: "2026-01-23",
    type: "MARKETING_EXPENSE",
    amount: 450000000,
    currency: "IDR",
    amountUsd: 28440,
    target: "TikTok广告",
    ruleCode: "RULE_AD_AUTO",
    ruleName: "广告自动扣费",
    urgency: "MEDIUM",
    isFixed: false,
  },
  {
    id: "OUT004",
    outflowDate: "2026-01-26",
    type: "RENT_UTILITY",
    amount: 3200,
    currency: "USD",
    amountUsd: 3200,
    target: "办公室租金",
    ruleCode: "RULE_RENT_MONTHLY",
    ruleName: "月度租金",
    urgency: "MEDIUM",
    isFixed: true,
  },
  {
    id: "OUT005",
    outflowDate: "2026-01-28",
    type: "SUPPLIER_PAYMENT",
    amount: 85000,
    currency: "CNY",
    amountUsd: 11730,
    target: "供应商B",
    ruleCode: "RULE_AP_DUE",
    ruleName: "应付账款到期",
    urgency: "HIGH",
    isFixed: true,
    sourceDocId: "AP_20251228_B002",
  },
  {
    id: "OUT006",
    outflowDate: "2026-01-30",
    type: "TAX_PAYMENT",
    amount: 8500,
    currency: "USD",
    amountUsd: 8500,
    target: "增值税",
    ruleCode: "RULE_TAX_MONTHLY",
    ruleName: "月度税费",
    urgency: "HIGH",
    isFixed: true,
    remark: "每月月底缴纳",
  },
]

function OutflowPageContent() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterUrgency, setFilterUrgency] = useState<string>("all")
  const [filterFixed, setFilterFixed] = useState<string>("all")

  const filteredData = mockOutflowData.filter((item) => {
    const matchSearch =
      searchQuery === "" ||
      item.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ruleName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchType = filterType === "all" || item.type === filterType
    const matchUrgency = filterUrgency === "all" || item.urgency === filterUrgency
    const matchFixed = filterFixed === "all" || (filterFixed === "fixed" ? item.isFixed : !item.isFixed)
    return matchSearch && matchType && matchUrgency && matchFixed
  })

  const totalAmount = filteredData.reduce((sum, item) => sum + item.amountUsd, 0)
  const highUrgencyAmount = filteredData
    .filter((item) => item.urgency === "HIGH")
    .reduce((sum, item) => sum + item.amountUsd, 0)
  const fixedAmount = filteredData.filter((item) => item.isFixed).reduce((sum, item) => sum + item.amountUsd, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">未来流出明细</h1>
          <p className="text-muted-foreground">未来30天预测流出明细，按日期、类型、紧急度查看</p>
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
            <div className="text-sm text-muted-foreground">流出条目数</div>
            <div className="text-2xl font-bold mt-1">{filteredData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">流出总额（USD）</div>
            <div className="text-2xl font-bold mt-1">${totalAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-sm text-red-600">高紧急度金额</div>
            <div className="text-2xl font-bold text-red-600 mt-1">${highUrgencyAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">固定支出</div>
            <div className="text-2xl font-bold mt-1">${fixedAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索目标、规则..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="流出类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="SUPPLIER_PAYMENT">供应商付款</SelectItem>
            <SelectItem value="SALARY_SOCIAL">薪资社保</SelectItem>
            <SelectItem value="MARKETING_EXPENSE">营销费用</SelectItem>
            <SelectItem value="RENT_UTILITY">租金水电</SelectItem>
            <SelectItem value="TAX_PAYMENT">税费支付</SelectItem>
            <SelectItem value="OTHER_EXPENSE">其他支出</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterUrgency} onValueChange={setFilterUrgency}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="紧急度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部紧急度</SelectItem>
            <SelectItem value="HIGH">高</SelectItem>
            <SelectItem value="MEDIUM">中</SelectItem>
            <SelectItem value="LOW">低</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterFixed} onValueChange={setFilterFixed}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="固定/可调" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="fixed">固定支出</SelectItem>
            <SelectItem value="variable">可调支出</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>流出日期</TableHead>
                <TableHead>流出类型</TableHead>
                <TableHead>目标</TableHead>
                <TableHead className="text-right">原币金额</TableHead>
                <TableHead className="text-right">USD金额</TableHead>
                <TableHead>规则</TableHead>
                <TableHead>紧急度</TableHead>
                <TableHead>属性</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.outflowDate}</TableCell>
                  <TableCell>
                    <Badge className={outflowTypeConfig[item.type].color}>
                      {outflowTypeConfig[item.type].label}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.target}</TableCell>
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
                    <Badge variant="outline" className={urgencyConfig[item.urgency].color}>
                      {urgencyConfig[item.urgency].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.isFixed ? (
                      <Badge variant="outline">固定</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        可调
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/bfis/reports/forecast/detail?id=${item.id}&type=outflow`}
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

export default function OutflowPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OutflowPageContent />
    </Suspense>
  )
}
