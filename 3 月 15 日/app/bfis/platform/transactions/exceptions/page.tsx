"use client"

import { useState } from "react"
import {
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  FileText,
  Eye,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// TX4｜异常与重复处理页

type ExceptionType = "PAYOUT_MISSING" | "DUPLICATE_SUSPECT" | "CURRENCY_MISMATCH" | "ASSIGNMENT_FAILED" | "LARGE_ADJUSTMENT"
type ExceptionStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "IGNORED"

interface ExceptionRecord {
  exception_id: string
  txn_id: string
  exception_type: ExceptionType
  severity: "HIGH" | "MEDIUM" | "LOW"
  platform: string
  store_id: string
  store_name: string
  txn_time: string
  amount: number
  currency: string
  description: string
  status: ExceptionStatus
  assigned_to: string | null
  created_at: string
  resolved_at: string | null
  resolution_note: string | null
}

// Mock data
const mockExceptions: ExceptionRecord[] = [
  {
    exception_id: "exc_001",
    txn_id: "tx_01H9K8ABCD126",
    exception_type: "PAYOUT_MISSING",
    severity: "HIGH",
    platform: "SHOPEE",
    store_id: "st_shopee_id_002",
    store_name: "Shopee ID Official",
    txn_time: "2026-01-18 16:45:00",
    amount: -450000,
    currency: "IDR",
    description: "该流水在发生时点无有效提现绑定，无法确定收单主体归属",
    status: "OPEN",
    assigned_to: null,
    created_at: "2026-01-18 17:00:00",
    resolved_at: null,
    resolution_note: null,
  },
  {
    exception_id: "exc_002",
    txn_id: "tx_01H9K8ABCD128",
    exception_type: "DUPLICATE_SUSPECT",
    severity: "MEDIUM",
    platform: "SHOPEE",
    store_id: "st_shopee_id_003",
    store_name: "Shopee ID Store 2",
    txn_time: "2026-01-21 11:30:00",
    amount: 680000,
    currency: "IDR",
    description: "系统检测到相似流水记录，疑似重复导入",
    status: "OPEN",
    assigned_to: null,
    created_at: "2026-01-21 12:00:00",
    resolved_at: null,
    resolution_note: null,
  },
  {
    exception_id: "exc_003",
    txn_id: "tx_01H9K8ABCD130",
    exception_type: "CURRENCY_MISMATCH",
    severity: "MEDIUM",
    platform: "TIKTOK",
    store_id: "st_tiktok_id_001",
    store_name: "ID-直播主店",
    txn_time: "2026-01-19 14:20:00",
    amount: 250000,
    currency: "USD",
    description: "流水币种（USD）与店铺结算币种（IDR）不一致",
    status: "IN_PROGRESS",
    assigned_to: "财务团队",
    created_at: "2026-01-19 15:00:00",
    resolved_at: null,
    resolution_note: null,
  },
  {
    exception_id: "exc_004",
    txn_id: "tx_01H9K8ABCD132",
    exception_type: "ASSIGNMENT_FAILED",
    severity: "MEDIUM",
    platform: "SHOPEE",
    store_id: "st_shopee_id_002",
    store_name: "Shopee ID Official",
    txn_time: "2026-01-20 10:15:00",
    amount: 380000,
    currency: "IDR",
    description: "未匹配到平台账单周期，流水暂未归集",
    status: "RESOLVED",
    assigned_to: "财务团队",
    created_at: "2026-01-20 11:00:00",
    resolved_at: "2026-01-20 14:30:00",
    resolution_note: "已补充导入对应账单周期，流水归集成功",
  },
  {
    exception_id: "exc_005",
    txn_id: "tx_01H9K8ABCD135",
    exception_type: "LARGE_ADJUSTMENT",
    severity: "HIGH",
    platform: "TIKTOK",
    store_id: "st_tiktok_id_001",
    store_name: "ID-直播主店",
    txn_time: "2026-01-17 08:00:00",
    amount: -5800000,
    currency: "IDR",
    description: "大额调账超过阈值（500万IDR），需财务复核",
    status: "RESOLVED",
    assigned_to: "财务主管",
    created_at: "2026-01-17 09:00:00",
    resolved_at: "2026-01-17 16:00:00",
    resolution_note: "已与平台确认为正常的月度调账，属实",
  },
]

const exceptionTypeConfig: Record<
  ExceptionType,
  { label: string; code: string; color: string; icon: typeof XCircle }
> = {
  PAYOUT_MISSING: {
    label: "归属缺失",
    code: "TX_AL_8001",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  DUPLICATE_SUSPECT: {
    label: "疑似重复",
    code: "TX_AL_8002",
    color: "bg-yellow-100 text-yellow-700",
    icon: AlertTriangle,
  },
  CURRENCY_MISMATCH: {
    label: "币种异常",
    code: "TX_AL_8003",
    color: "bg-orange-100 text-orange-700",
    icon: AlertCircle,
  },
  ASSIGNMENT_FAILED: {
    label: "归集失败",
    code: "TX_AL_8004",
    color: "bg-blue-100 text-blue-700",
    icon: AlertTriangle,
  },
  LARGE_ADJUSTMENT: {
    label: "异常调账",
    code: "TX_AL_8005",
    color: "bg-purple-100 text-purple-700",
    icon: AlertTriangle,
  },
}

const statusConfig: Record<ExceptionStatus, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "待处理", color: "bg-red-100 text-red-700", icon: Clock },
  IN_PROGRESS: { label: "处理中", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  RESOLVED: { label: "已解决", color: "bg-green-100 text-green-700", icon: CheckCircle },
  IGNORED: { label: "已忽略", color: "bg-gray-100 text-gray-700", icon: XCircle },
}

const severityConfig = {
  HIGH: { label: "高", color: "bg-red-100 text-red-700" },
  MEDIUM: { label: "中", color: "bg-yellow-100 text-yellow-700" },
  LOW: { label: "低", color: "bg-blue-100 text-blue-700" },
}

export default function TransactionsExceptionsPage() {
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterSeverity, setFilterSeverity] = useState("all")

  const filteredExceptions = mockExceptions.filter((exc) => {
    if (filterType !== "all" && exc.exception_type !== filterType) return false
    if (filterStatus !== "all" && exc.status !== filterStatus) return false
    if (filterSeverity !== "all" && exc.severity !== filterSeverity) return false
    return true
  })

  const stats = {
    total: mockExceptions.length,
    open: mockExceptions.filter((e) => e.status === "OPEN").length,
    inProgress: mockExceptions.filter((e) => e.status === "IN_PROGRESS").length,
    resolved: mockExceptions.filter((e) => e.status === "RESOLVED").length,
    high: mockExceptions.filter((e) => e.severity === "HIGH" && e.status === "OPEN").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">异常与重复处理</h1>
          <p className="text-muted-foreground">管理交易流水的异常记录，跟踪处理进度与解决方案</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            导出异常清单
          </Button>
          <Button size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            批量重跑
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">异常总数</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.open}</div>
            <div className="text-sm text-red-600">待处理</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-sm text-muted-foreground">处理中</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            <div className="text-sm text-muted-foreground">已解决</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.high}</div>
            <div className="text-sm text-red-600">高优先级</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="异常类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="PAYOUT_MISSING">归属缺失</SelectItem>
                <SelectItem value="DUPLICATE_SUSPECT">疑似重复</SelectItem>
                <SelectItem value="CURRENCY_MISMATCH">币种异常</SelectItem>
                <SelectItem value="ASSIGNMENT_FAILED">归集失败</SelectItem>
                <SelectItem value="LARGE_ADJUSTMENT">异常调账</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="OPEN">待处理</SelectItem>
                <SelectItem value="IN_PROGRESS">处理中</SelectItem>
                <SelectItem value="RESOLVED">已解决</SelectItem>
                <SelectItem value="IGNORED">已忽略</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="严重级别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部级别</SelectItem>
                <SelectItem value="HIGH">高</SelectItem>
                <SelectItem value="MEDIUM">中</SelectItem>
                <SelectItem value="LOW">低</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Exceptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>异常记录列表</CardTitle>
          <CardDescription>按创建时间倒序展示所有异常</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>异常ID</TableHead>
                <TableHead>异常类型</TableHead>
                <TableHead>严重级别</TableHead>
                <TableHead>平台/店铺</TableHead>
                <TableHead>流水时间</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExceptions.map((exc) => {
                const typeConfig = exceptionTypeConfig[exc.exception_type]
                const statusCfg = statusConfig[exc.status]
                const TypeIcon = typeConfig.icon
                const StatusIcon = statusCfg.icon
                const severityCfg = severityConfig[exc.severity]

                return (
                  <TableRow key={exc.exception_id}>
                    <TableCell className="font-mono text-sm">{exc.exception_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4" />
                        <div>
                          <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                          <div className="text-xs text-muted-foreground mt-1">{typeConfig.code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={severityCfg.color}>{severityCfg.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="mb-1">
                          {exc.platform}
                        </Badge>
                        <div className="text-sm">{exc.store_name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{exc.txn_time}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={exc.amount >= 0 ? "text-green-600" : "text-red-600"}>
                        {exc.amount >= 0 ? "+" : ""}
                        {exc.amount.toLocaleString()}
                      </span>
                      <div className="text-xs text-muted-foreground">{exc.currency}</div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="text-sm text-muted-foreground truncate">{exc.description}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-4 w-4" />
                        <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {exc.assigned_to ? (
                        <div className="text-sm">{exc.assigned_to}</div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{exc.created_at}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {exc.status === "OPEN" && (
                          <Button variant="outline" size="sm">
                            处理
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Exception Type Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle>异常类型说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(exceptionTypeConfig).map(([type, config]) => {
              const Icon = config.icon
              return (
                <div key={type} className="flex items-start gap-3">
                  <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={config.color}>{config.label}</Badge>
                      <span className="text-xs text-muted-foreground">{config.code}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {type === "PAYOUT_MISSING" &&
                        "该流水在发生时点无有效提现绑定，无法确定收单主体归属。建议补录绑定关系后重新解析。"}
                      {type === "DUPLICATE_SUSPECT" && "系统检测到相似流水记录，疑似重复导入。建议核查原始数据后决定保留或删除。"}
                      {type === "CURRENCY_MISMATCH" && "流水币种与店铺结算币种不一致，可能导致汇率折算错误。需核查平台数据。"}
                      {type === "ASSIGNMENT_FAILED" && "未匹配到平台账单周期，流水暂未归集。建议检查账单是否已导入。"}
                      {type === "LARGE_ADJUSTMENT" && "大额调账超过阈值，需财务复核确认是否属实。"}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
