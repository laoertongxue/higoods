"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading" // Import the Loading component
import {
  Search,
  Download,
  Eye,
  Play,
  RotateCcw,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

// CV4 成本回写任务列表页 + CV5 详情页

type BackfillStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "NEED_REVIEW"
type BackfillType = "COST_BACKFILL" | "COST_CORRECTION"

const statusConfig: Record<BackfillStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "待执行", color: "bg-gray-100 text-gray-700", icon: Clock },
  RUNNING: { label: "执行中", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  SUCCESS: { label: "已完成", color: "bg-green-100 text-green-700", icon: CheckCircle },
  FAILED: { label: "执行失败", color: "bg-red-100 text-red-700", icon: XCircle },
  NEED_REVIEW: { label: "需复核", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
}

const typeConfig: Record<BackfillType, { label: string }> = {
  COST_BACKFILL: { label: "成本回写" },
  COST_CORRECTION: { label: "成本更正" },
}

// Mock 回写任务数据
const mockBackfillTasks = [
  {
    id: "BF-2026-001",
    triggerSource: "成本版本 ACT-BATCH-001",
    costVersionId: "CV-2026-003",
    type: "COST_BACKFILL" as BackfillType,
    status: "PENDING" as BackfillStatus,
    affectedStores: 2,
    affectedOrderLines: 1256,
    affectedDateRange: "2026-01-10 ~ 2026-01-15",
    estimatedImpactUSD: 15680,
    createdAt: "2026-01-16 10:00",
    createdBy: "系统",
    executedAt: null,
  },
  {
    id: "BF-2026-002",
    triggerSource: "工单 WO-2026-088",
    costVersionId: "CV-2026-002",
    type: "COST_CORRECTION" as BackfillType,
    status: "SUCCESS" as BackfillStatus,
    affectedStores: 1,
    affectedOrderLines: 456,
    affectedDateRange: "2026-01-05 ~ 2026-01-08",
    estimatedImpactUSD: 3200,
    createdAt: "2026-01-14 14:30",
    createdBy: "张三",
    executedAt: "2026-01-14 14:35",
  },
  {
    id: "BF-2026-003",
    triggerSource: "成本版本 ACT-BATCH-002",
    costVersionId: "CV-2026-005",
    type: "COST_BACKFILL" as BackfillType,
    status: "FAILED" as BackfillStatus,
    affectedStores: 3,
    affectedOrderLines: 2100,
    affectedDateRange: "2026-01-01 ~ 2026-01-10",
    estimatedImpactUSD: 28500,
    createdAt: "2026-01-13 09:00",
    createdBy: "系统",
    executedAt: "2026-01-13 09:05",
    errorMsg: "部分快照已锁定，无法回写",
  },
  {
    id: "BF-2026-004",
    triggerSource: "导入批次 IMP-2026-012",
    costVersionId: "CV-2026-006",
    type: "COST_BACKFILL" as BackfillType,
    status: "NEED_REVIEW" as BackfillStatus,
    affectedStores: 1,
    affectedOrderLines: 89,
    affectedDateRange: "2026-01-12 ~ 2026-01-12",
    estimatedImpactUSD: 1200,
    createdAt: "2026-01-12 16:00",
    createdBy: "李四",
    executedAt: "2026-01-12 16:02",
    reviewReason: "成本变动超过10%阈值，需人工复核",
  },
]

export default function CostBackfillPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [selectedTask, setSelectedTask] = useState<(typeof mockBackfillTasks)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const searchParams = useSearchParams()

  // KPI统计
  const stats = {
    total: mockBackfillTasks.length,
    pending: mockBackfillTasks.filter((t) => t.status === "PENDING").length,
    running: mockBackfillTasks.filter((t) => t.status === "RUNNING").length,
    success: mockBackfillTasks.filter((t) => t.status === "SUCCESS").length,
    failed: mockBackfillTasks.filter((t) => t.status === "FAILED").length,
    needReview: mockBackfillTasks.filter((t) => t.status === "NEED_REVIEW").length,
  }

  // 筛选
  const filteredTasks = mockBackfillTasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false
    if (filterType !== "all" && t.type !== filterType) return false
    if (searchKeyword && !t.id.toLowerCase().includes(searchKeyword.toLowerCase()) && 
        !t.triggerSource.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (task: typeof mockBackfillTasks[0]) => {
    setSelectedTask(task)
    setDetailOpen(true)
  }

  const handleExecute = (taskId: string) => {
    toast.success(`回写任务 ${taskId} 已开始执行`)
  }

  const handleRollback = (taskId: string) => {
    toast.success(`回写任务 ${taskId} 已发起回滚`)
  }

  return (
    <Suspense fallback={<Loading />}> {/* Wrap the main content in a Suspense boundary */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">成本回写任务</h1>
            <p className="text-muted-foreground">管理实际成本到位后的毛利快照回写批处理</p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">任务总数</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className={stats.pending > 0 ? "border-gray-300 bg-gray-50" : ""}>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">待执行</div>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className={stats.running > 0 ? "border-blue-200 bg-blue-50" : ""}>
            <CardContent className="p-4">
              <div className={`text-sm mb-1 ${stats.running > 0 ? "text-blue-600" : "text-muted-foreground"}`}>执行中</div>
              <div className={`text-2xl font-bold ${stats.running > 0 ? "text-blue-700" : ""}`}>{stats.running}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="text-sm text-green-600 mb-1">已完成</div>
              <div className="text-2xl font-bold text-green-700">{stats.success}</div>
            </CardContent>
          </Card>
          <Card className={stats.failed > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="p-4">
              <div className={`text-sm mb-1 ${stats.failed > 0 ? "text-red-600" : "text-muted-foreground"}`}>执行失败</div>
              <div className={`text-2xl font-bold ${stats.failed > 0 ? "text-red-700" : ""}`}>{stats.failed}</div>
            </CardContent>
          </Card>
          <Card className={stats.needReview > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
            <CardContent className="p-4">
              <div className={`text-sm mb-1 ${stats.needReview > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>需复核</div>
              <div className={`text-2xl font-bold ${stats.needReview > 0 ? "text-yellow-700" : ""}`}>{stats.needReview}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索任务号/成本版本/触发来源..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="任务状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="PENDING">待执行</SelectItem>
                  <SelectItem value="RUNNING">执行中</SelectItem>
                  <SelectItem value="SUCCESS">已完成</SelectItem>
                  <SelectItem value="FAILED">执行失败</SelectItem>
                  <SelectItem value="NEED_REVIEW">需复核</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="回写类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="COST_BACKFILL">成本回写</SelectItem>
                  <SelectItem value="COST_CORRECTION">成本更正</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>任务号</TableHead>
                  <TableHead>触发来源</TableHead>
                  <TableHead>回写类型</TableHead>
                  <TableHead>影响范围</TableHead>
                  <TableHead className="text-right">预计影响毛利 (USD)</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const StatusIcon = statusConfig[task.status].icon
                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.id}</TableCell>
                      <TableCell>
                        <Button variant="link" className="p-0 h-auto text-blue-600">
                          {task.triggerSource}
                        </Button>
                      </TableCell>
                      <TableCell>{typeConfig[task.type].label}</TableCell>
                      <TableCell className="text-sm">
                        <div>{task.affectedStores} 店铺 / {task.affectedOrderLines.toLocaleString()} 订单行</div>
                        <div className="text-muted-foreground">{task.affectedDateRange}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${task.estimatedImpactUSD.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[task.status].color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[task.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{task.createdAt}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(task)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {task.status === "PENDING" && (
                            <Button variant="ghost" size="sm" onClick={() => handleExecute(task.id)}>
                              <Play className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {task.status === "SUCCESS" && (
                            <Button variant="ghost" size="sm" onClick={() => handleRollback(task.id)}>
                              <RotateCcw className="h-4 w-4 text-orange-600" />
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

        {/* CV5 回写任务详情抽屉 */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-[600px] sm:max-w-[600px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {selectedTask?.id}
                {selectedTask && (
                  <Badge className={statusConfig[selectedTask.status].color}>
                    {statusConfig[selectedTask.status].label}
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription>
                {selectedTask && typeConfig[selectedTask.type].label} | 创建于 {selectedTask?.createdAt}
              </SheetDescription>
            </SheetHeader>

            {selectedTask && (
              <div className="mt-6 space-y-6">
                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  {selectedTask.status === "PENDING" && (
                    <Button size="sm" onClick={() => handleExecute(selectedTask.id)}>
                      <Play className="h-4 w-4 mr-2" />
                      执行回写
                    </Button>
                  )}
                  {selectedTask.status === "NEED_REVIEW" && (
                    <>
                      <Button size="sm" variant="outline">
                        驳回
                      </Button>
                      <Button size="sm">
                        确认执行
                      </Button>
                    </>
                  )}
                  {selectedTask.status === "SUCCESS" && (
                    <Button variant="outline" size="sm" onClick={() => handleRollback(selectedTask.id)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      回滚
                    </Button>
                  )}
                  {selectedTask.status === "FAILED" && (
                    <Button size="sm" onClick={() => handleExecute(selectedTask.id)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      重试
                    </Button>
                  )}
                </div>

                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">触发来源</div>
                    <div className="font-medium mt-1">{selectedTask.triggerSource}</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">成本版本</div>
                    <div className="font-medium mt-1">{selectedTask.costVersionId}</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">影响店铺数</div>
                    <div className="font-medium mt-1">{selectedTask.affectedStores}</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">影响订单行数</div>
                    <div className="font-medium mt-1">{selectedTask.affectedOrderLines.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg col-span-2">
                    <div className="text-sm text-muted-foreground">影响日期范围</div>
                    <div className="font-medium mt-1">{selectedTask.affectedDateRange}</div>
                  </div>
                </div>

                {/* 预计影响 */}
                <div className="p-4 bg-primary/5 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">预计影响毛利 (USD)</div>
                  <div className="text-3xl font-bold">${selectedTask.estimatedImpactUSD.toLocaleString()}</div>
                </div>

                {/* 错误/复核信息 */}
                {selectedTask.status === "FAILED" && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-red-800">执行失败</div>
                        <div className="text-sm text-red-700 mt-1">{(selectedTask as typeof selectedTask & { errorMsg?: string }).errorMsg}</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedTask.status === "NEED_REVIEW" && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-yellow-800">需要人工复核</div>
                        <div className="text-sm text-yellow-700 mt-1">{(selectedTask as typeof selectedTask & { reviewReason?: string }).reviewReason}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 执行时间线 */}
                <div className="space-y-3">
                  <h4 className="font-medium">执行时间线</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                      <div className="text-sm text-muted-foreground w-36">{selectedTask.createdAt}</div>
                      <div className="text-sm">任务创建</div>
                      <div className="text-sm text-muted-foreground ml-auto">{selectedTask.createdBy}</div>
                    </div>
                    {selectedTask.executedAt && (
                      <div className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                        <div className="text-sm text-muted-foreground w-36">{selectedTask.executedAt}</div>
                        <div className="text-sm">开始执行</div>
                        <div className="text-sm text-muted-foreground ml-auto">系统</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Suspense>
  )
}
