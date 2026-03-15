"use client"

import { useState } from "react"
import {
  Upload,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  FileText,
  PlayCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// TX3｜导入/同步任务页

type TaskStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL"
type TaskType = "API_SYNC" | "FILE_IMPORT"

interface ImportTask {
  task_id: string
  task_type: TaskType
  platform: string
  store_id: string
  store_name: string
  period_start: string
  period_end: string
  status: TaskStatus
  total_rows: number
  success_count: number
  failed_count: number
  duplicate_count: number
  progress: number
  created_at: string
  completed_at: string | null
  error_message: string | null
}

interface FailedRow {
  row_number: number
  txn_time: string
  amount: number
  currency: string
  txn_type: string
  order_id: string | null
  error_code: string
  error_message: string
}

// Mock data
const mockTasks: ImportTask[] = [
  {
    task_id: "task_202601_001",
    task_type: "API_SYNC",
    platform: "TIKTOK",
    store_id: "st_tiktok_id_001",
    store_name: "ID-直播主店",
    period_start: "2026-01-01",
    period_end: "2026-01-21",
    status: "COMPLETED",
    total_rows: 1250,
    success_count: 1248,
    failed_count: 2,
    duplicate_count: 0,
    progress: 100,
    created_at: "2026-01-21 08:00:00",
    completed_at: "2026-01-21 08:05:30",
    error_message: null,
  },
  {
    task_id: "task_202601_002",
    task_type: "FILE_IMPORT",
    platform: "SHOPEE",
    store_id: "st_shopee_id_002",
    store_name: "Shopee ID Official",
    period_start: "2026-01-01",
    period_end: "2026-01-20",
    status: "COMPLETED",
    total_rows: 856,
    success_count: 850,
    failed_count: 3,
    duplicate_count: 3,
    progress: 100,
    created_at: "2026-01-20 15:30:00",
    completed_at: "2026-01-20 15:32:15",
    error_message: null,
  },
  {
    task_id: "task_202601_003",
    task_type: "API_SYNC",
    platform: "TIKTOK",
    store_id: "st_tiktok_id_001",
    store_name: "ID-直播主店",
    period_start: "2026-01-21",
    period_end: "2026-01-22",
    status: "RUNNING",
    total_rows: 0,
    success_count: 0,
    failed_count: 0,
    duplicate_count: 0,
    progress: 45,
    created_at: "2026-01-22 09:00:00",
    completed_at: null,
    error_message: null,
  },
  {
    task_id: "task_202601_004",
    task_type: "FILE_IMPORT",
    platform: "SHOPEE",
    store_id: "st_shopee_id_003",
    store_name: "Shopee ID Store 2",
    period_start: "2026-01-15",
    period_end: "2026-01-20",
    status: "FAILED",
    total_rows: 0,
    success_count: 0,
    failed_count: 0,
    duplicate_count: 0,
    progress: 0,
    created_at: "2026-01-20 10:00:00",
    completed_at: "2026-01-20 10:00:15",
    error_message: "文件格式错误：缺少必填列 'amount'",
  },
]

const mockFailedRows: FailedRow[] = [
  {
    row_number: 125,
    txn_time: "2026-01-15 14:23:00",
    amount: 850000,
    currency: "IDR",
    txn_type: "ORDER_REVENUE",
    order_id: "TT20260115125",
    error_code: "TX_1002",
    error_message: "缺少必填字段：txn_type",
  },
  {
    row_number: 340,
    txn_time: "2026-01-18 09:45:00",
    amount: -120000,
    currency: "IDR",
    txn_type: "PLATFORM_FEE",
    order_id: "TT20260118340",
    error_code: "TX_1005",
    error_message: "币种与店铺结算币种不一致",
  },
]

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING: { label: "待执行", color: "bg-gray-100 text-gray-700", icon: Clock },
  RUNNING: { label: "执行中", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  COMPLETED: { label: "已完成", color: "bg-green-100 text-green-700", icon: CheckCircle },
  FAILED: { label: "失败", color: "bg-red-100 text-red-700", icon: XCircle },
  PARTIAL: { label: "部分成功", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
}

export default function TransactionsImportPage() {
  const [selectedTask, setSelectedTask] = useState<ImportTask | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">导入/同步任务</h1>
          <p className="text-muted-foreground">管理平台交易流水的API同步与文件导入任务</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            下载模板
          </Button>
          <Button size="sm">
            <Upload className="h-4 w-4 mr-2" />
            上传文件
          </Button>
          <Button size="sm">
            <PlayCircle className="h-4 w-4 mr-2" />
            新建API同步
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{mockTasks.length}</div>
            <div className="text-sm text-muted-foreground">任务总数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{mockTasks.filter((t) => t.status === "COMPLETED").length}</div>
            <div className="text-sm text-muted-foreground">已完成</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{mockTasks.filter((t) => t.status === "RUNNING").length}</div>
            <div className="text-sm text-muted-foreground">执行中</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{mockTasks.filter((t) => t.status === "FAILED").length}</div>
            <div className="text-sm text-muted-foreground">失败</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{mockTasks.reduce((sum, t) => sum + t.success_count, 0)}</div>
            <div className="text-sm text-muted-foreground">累计成功数</div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>同步任务列表</CardTitle>
          <CardDescription>按时间倒序展示最近的导入与同步任务</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>任务ID</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>平台/店铺</TableHead>
                <TableHead>期间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>进度</TableHead>
                <TableHead className="text-right">成功</TableHead>
                <TableHead className="text-right">失败</TableHead>
                <TableHead className="text-right">重复</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTasks.map((task) => {
                const statusCfg = statusConfig[task.status]
                const StatusIcon = statusCfg.icon

                return (
                  <TableRow key={task.task_id}>
                    <TableCell className="font-mono text-sm">{task.task_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{task.task_type === "API_SYNC" ? "API同步" : "文件导入"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="mb-1">
                          {task.platform}
                        </Badge>
                        <div className="text-sm">{task.store_name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {task.period_start} ~ {task.period_end}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-4 w-4" />
                        <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.status === "RUNNING" ? (
                        <div className="w-24">
                          <Progress value={task.progress} className="h-2" />
                          <div className="text-xs text-muted-foreground mt-1">{task.progress}%</div>
                        </div>
                      ) : task.status === "COMPLETED" || task.status === "PARTIAL" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : task.status === "FAILED" ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">{task.success_count}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{task.failed_count}</TableCell>
                    <TableCell className="text-right font-mono text-yellow-600">{task.duplicate_count}</TableCell>
                    <TableCell className="text-sm">{task.created_at}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {task.status === "FAILED" && (
                          <Button variant="ghost" size="sm">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        {task.failed_count > 0 && (
                          <Button variant="ghost" size="sm" onClick={() => setSelectedTask(task)}>
                            查看失败
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

      {/* Failed Rows Detail */}
      {selectedTask && selectedTask.failed_count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>失败明细 - {selectedTask.task_id}</CardTitle>
            <CardDescription>
              共 {selectedTask.failed_count} 条记录导入失败，请修正后重新导入
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>行号</TableHead>
                  <TableHead>发生时间</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>错误码</TableHead>
                  <TableHead>错误信息</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockFailedRows.map((row) => (
                  <TableRow key={row.row_number}>
                    <TableCell className="font-mono">#{row.row_number}</TableCell>
                    <TableCell className="font-mono text-sm">{row.txn_time}</TableCell>
                    <TableCell className="text-right font-mono">
                      {row.amount.toLocaleString()} {row.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.txn_type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.order_id || "-"}</TableCell>
                    <TableCell>
                      <Badge className="bg-red-100 text-red-700">{row.error_code}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-red-700">{row.error_message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Import Template Info */}
      <Card>
        <CardHeader>
          <CardTitle>导入模板说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">必填字段</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>• platform（平台：TIKTOK/SHOPEE）</div>
                <div>• store_id（店铺ID）</div>
                <div>• txn_time（发生时间，格式：YYYY-MM-DD HH:mm:ss）</div>
                <div>• currency（币种：IDR/CNY/USD等）</div>
                <div>• amount（金额，正负号按规则）</div>
                <div>• txn_type（流水类型，参考枚举）</div>
                <div>• source_ref（来源引用，唯一标识）</div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">可选字段</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>• order_id（平台订单号）</div>
                <div>• order_line_id（订单明细行）</div>
                <div>• fee_category（费用类别）</div>
                <div>• direction（方向：IN/OUT）</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
