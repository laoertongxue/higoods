"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  Search,
  Download,
  Plus,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Play,
  Pause,
  FileText,
  TrendingUp,
  Package,
  DollarSign,
  ChevronRight,
  ArrowRight,
  RotateCcw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// CG1 COGS结转任务列表页 + CG2 COGS结转结果详情页

type TaskStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"
type TaskType = "DAILY" | "MONTHLY" | "ADJUSTMENT" | "REVERSAL"

const taskStatusConfig: Record<TaskStatus, { label: string; color: string }> = {
  PENDING: { label: "待执行", color: "bg-gray-100 text-gray-700" },
  RUNNING: { label: "执行中", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "已完成", color: "bg-green-100 text-green-700" },
  FAILED: { label: "失败", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已取消", color: "bg-yellow-100 text-yellow-700" },
}

const taskTypeConfig: Record<TaskType, { label: string; color: string }> = {
  DAILY: { label: "日结转", color: "bg-blue-100 text-blue-700" },
  MONTHLY: { label: "月结转", color: "bg-purple-100 text-purple-700" },
  ADJUSTMENT: { label: "调整结转", color: "bg-yellow-100 text-yellow-700" },
  REVERSAL: { label: "冲回结转", color: "bg-orange-100 text-orange-700" },
}

// Mock COGS结转任务数据
const mockCOGSTasks = [
  {
    id: "COGS-2026-0116-001",
    taskType: "DAILY" as TaskType,
    targetDate: "2026-01-16",
    legalEntity: "印尼法人",
    storeCount: 3,
    orderLineCount: 1256,
    totalCOGS: 45680,
    currency: "USD",
    status: "COMPLETED" as TaskStatus,
    progress: 100,
    startedAt: "2026-01-17 06:00",
    completedAt: "2026-01-17 06:15",
    executedBy: "系统",
    journalNo: "JE-2026-0117-COGS-001",
  },
  {
    id: "COGS-2026-0115-001",
    taskType: "DAILY" as TaskType,
    targetDate: "2026-01-15",
    legalEntity: "印尼法人",
    storeCount: 3,
    orderLineCount: 1180,
    totalCOGS: 42350,
    currency: "USD",
    status: "COMPLETED" as TaskStatus,
    progress: 100,
    startedAt: "2026-01-16 06:00",
    completedAt: "2026-01-16 06:12",
    executedBy: "系统",
    journalNo: "JE-2026-0116-COGS-001",
  },
  {
    id: "COGS-2026-0117-001",
    taskType: "DAILY" as TaskType,
    targetDate: "2026-01-17",
    legalEntity: "印尼法人",
    storeCount: 3,
    orderLineCount: 0,
    totalCOGS: 0,
    currency: "USD",
    status: "PENDING" as TaskStatus,
    progress: 0,
    startedAt: null,
    completedAt: null,
    executedBy: null,
    journalNo: null,
  },
  {
    id: "COGS-2026-01-M001",
    taskType: "MONTHLY" as TaskType,
    targetDate: "2026-01",
    legalEntity: "印尼法人",
    storeCount: 3,
    orderLineCount: 35680,
    totalCOGS: 1256800,
    currency: "USD",
    status: "RUNNING" as TaskStatus,
    progress: 45,
    startedAt: "2026-01-18 02:00",
    completedAt: null,
    executedBy: "系统",
    journalNo: null,
  },
  {
    id: "COGS-2026-0114-ADJ",
    taskType: "ADJUSTMENT" as TaskType,
    targetDate: "2026-01-14",
    legalEntity: "印尼法人",
    storeCount: 1,
    orderLineCount: 45,
    totalCOGS: 1850,
    currency: "USD",
    status: "COMPLETED" as TaskStatus,
    progress: 100,
    startedAt: "2026-01-15 10:30",
    completedAt: "2026-01-15 10:32",
    executedBy: "张三",
    journalNo: "JE-2026-0115-COGS-ADJ-001",
    adjustmentReason: "实际成本回写后调整",
  },
  {
    id: "COGS-2026-0113-REV",
    taskType: "REVERSAL" as TaskType,
    targetDate: "2026-01-13",
    legalEntity: "印尼法人",
    storeCount: 1,
    orderLineCount: 12,
    totalCOGS: -560,
    currency: "USD",
    status: "FAILED" as TaskStatus,
    progress: 0,
    startedAt: "2026-01-14 09:00",
    completedAt: "2026-01-14 09:01",
    executedBy: "系统",
    journalNo: null,
    errorMessage: "关联订单数据不完整",
  },
]

// Mock 结转明细
const mockCOGSDetails = [
  { orderId: "ORD-2026-0116-001", sku: "SKU-001", skuName: "连衣裙-红色-S", qty: 10, unitCost: 45.00, totalCost: 450.00, costType: "ACTUAL", account: "5001-主营业务成本" },
  { orderId: "ORD-2026-0116-002", sku: "SKU-002", skuName: "T恤-白色-M", qty: 15, unitCost: 12.00, totalCost: 180.00, costType: "STANDARD", account: "5001-主营业务成本" },
  { orderId: "ORD-2026-0116-003", sku: "SKU-003", skuName: "牛仔裤-蓝色-L", qty: 8, unitCost: 38.00, totalCost: 304.00, costType: "ESTIMATE", account: "5001-主营业务成本" },
  { orderId: "ORD-2026-0116-004", sku: "SKU-004", skuName: "外套-黑色-M", qty: 5, unitCost: 68.00, totalCost: 340.00, costType: "ACTUAL", account: "5001-主营业务成本" },
]

// Mock 凭证分录
const mockJournalEntries = [
  { lineNo: 1, account: "5001-主营业务成本", accountName: "主营业务成本", debit: 45680, credit: 0, dimension: "TikTok印尼主店" },
  { lineNo: 2, account: "1405-库存商品", accountName: "库存商品", debit: 0, credit: 45680, dimension: "TikTok印尼主店" },
]

const LoadingComponent = () => null;

export default function COGSPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [selectedTask, setSelectedTask] = useState<(typeof mockCOGSTasks)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  const searchParams = useSearchParams();

  // KPI统计
  const stats = {
    total: mockCOGSTasks.length,
    completed: mockCOGSTasks.filter((t) => t.status === "COMPLETED").length,
    running: mockCOGSTasks.filter((t) => t.status === "RUNNING").length,
    pending: mockCOGSTasks.filter((t) => t.status === "PENDING").length,
    failed: mockCOGSTasks.filter((t) => t.status === "FAILED").length,
    totalCOGS: mockCOGSTasks.filter((t) => t.status === "COMPLETED").reduce((sum, t) => sum + t.totalCOGS, 0),
  }

  // 筛选
  const filteredTasks = mockCOGSTasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false
    if (filterType !== "all" && t.taskType !== filterType) return false
    if (searchKeyword && !t.id.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !t.targetDate.includes(searchKeyword)) return false
    return true
  })

  const openDetail = (task: typeof mockCOGSTasks[0]) => {
    setSelectedTask(task)
    setDetailOpen(true)
    setActiveTab("overview")
  }

  const handleExecute = (taskId: string) => {
    toast.success(`任务 ${taskId} 已开始执行`)
  }

  const handleRetry = (taskId: string) => {
    toast.success(`任务 ${taskId} 已重新提交`)
  }

  const handleCancel = (taskId: string) => {
    toast.success(`任务 ${taskId} 已取消`)
  }

  const handleCreateTask = () => {
    toast.success("COGS结转任务已创建")
    setCreateOpen(false)
  }

  return (
    <Suspense fallback={<LoadingComponent />}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">销售成本结转 (COGS)</h1>
            <p className="text-muted-foreground">管理每日/月度销售成本结转任务，自动生成会计凭证</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建结转任务
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">任务总数</span>
              </div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">已完成</span>
              </div>
              <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card className={stats.running > 0 ? "border-blue-200 bg-blue-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className={`h-4 w-4 ${stats.running > 0 ? "text-blue-600 animate-spin" : "text-muted-foreground"}`} />
                <span className={`text-sm ${stats.running > 0 ? "text-blue-600" : "text-muted-foreground"}`}>执行中</span>
              </div>
              <div className={`text-2xl font-bold ${stats.running > 0 ? "text-blue-700" : ""}`}>{stats.running}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">待执行</span>
              </div>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className={stats.failed > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className={`h-4 w-4 ${stats.failed > 0 ? "text-red-600" : "text-muted-foreground"}`} />
                <span className={`text-sm ${stats.failed > 0 ? "text-red-600" : "text-muted-foreground"}`}>失败</span>
              </div>
              <div className={`text-2xl font-bold ${stats.failed > 0 ? "text-red-700" : ""}`}>{stats.failed}</div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-600">累计结转 (USD)</span>
              </div>
              <div className="text-2xl font-bold text-orange-700">${stats.totalCOGS.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">目标日期:</Label>
                <Input type="date" className="w-[140px]" defaultValue="2026-01-01" />
                <span>~</span>
                <Input type="date" className="w-[140px]" defaultValue="2026-01-17" />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="任务类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="DAILY">日结转</SelectItem>
                  <SelectItem value="MONTHLY">月结转</SelectItem>
                  <SelectItem value="ADJUSTMENT">调整结转</SelectItem>
                  <SelectItem value="REVERSAL">冲回结转</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="PENDING">待执行</SelectItem>
                  <SelectItem value="RUNNING">执行中</SelectItem>
                  <SelectItem value="COMPLETED">已完成</SelectItem>
                  <SelectItem value="FAILED">失败</SelectItem>
                  <SelectItem value="CANCELLED">已取消</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索任务号/目标日期..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
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
                  <TableHead>类型</TableHead>
                  <TableHead>目标日期</TableHead>
                  <TableHead>法人</TableHead>
                  <TableHead className="text-right">店铺数</TableHead>
                  <TableHead className="text-right">订单行数</TableHead>
                  <TableHead className="text-right">COGS金额 (USD)</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>进度</TableHead>
                  <TableHead>凭证号</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id} className={task.status === "FAILED" ? "bg-red-50/30" : ""}>
                    <TableCell className="font-mono text-sm">{task.id}</TableCell>
                    <TableCell>
                      <Badge className={taskTypeConfig[task.taskType].color}>
                        {taskTypeConfig[task.taskType].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{task.targetDate}</TableCell>
                    <TableCell>{task.legalEntity}</TableCell>
                    <TableCell className="text-right">{task.storeCount}</TableCell>
                    <TableCell className="text-right font-mono">{task.orderLineCount.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-mono font-bold ${task.totalCOGS < 0 ? "text-red-600" : "text-orange-600"}`}>
                      {task.totalCOGS < 0 ? "-" : ""}${Math.abs(task.totalCOGS).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={taskStatusConfig[task.status].color}>
                        {taskStatusConfig[task.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.status === "RUNNING" ? (
                        <div className="w-20">
                          <Progress value={task.progress} className="h-2" />
                          <span className="text-xs text-muted-foreground">{task.progress}%</span>
                        </div>
                      ) : task.status === "COMPLETED" ? (
                        <span className="text-green-600 text-sm">100%</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.journalNo ? (
                        <Button variant="link" className="p-0 h-auto text-blue-600 text-sm">
                          {task.journalNo}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
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
                        {task.status === "FAILED" && (
                          <Button variant="ghost" size="sm" onClick={() => handleRetry(task.id)}>
                            <RotateCcw className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {task.status === "RUNNING" && (
                          <Button variant="ghost" size="sm" onClick={() => handleCancel(task.id)}>
                            <Pause className="h-4 w-4 text-yellow-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* CG2 COGS结转结果详情抽屉 */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {selectedTask?.id}
                {selectedTask && (
                  <>
                    <Badge className={taskTypeConfig[selectedTask.taskType].color}>
                      {taskTypeConfig[selectedTask.taskType].label}
                    </Badge>
                    <Badge className={taskStatusConfig[selectedTask.status].color}>
                      {taskStatusConfig[selectedTask.status].label}
                    </Badge>
                  </>
                )}
              </SheetTitle>
              <SheetDescription>
                目标日期: {selectedTask?.targetDate} | 法人: {selectedTask?.legalEntity}
              </SheetDescription>
            </SheetHeader>

            {selectedTask && (
              <div className="mt-6">
                {/* Progress (for running tasks) */}
                {selectedTask.status === "RUNNING" && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">执行进度</span>
                      <span className="text-sm font-bold">{selectedTask.progress}%</span>
                    </div>
                    <Progress value={selectedTask.progress} className="h-3" />
                  </div>
                )}

                {/* Error Message (for failed tasks) */}
                {selectedTask.status === "FAILED" && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">执行失败</span>
                    </div>
                    <p className="text-sm text-red-700">{(selectedTask as typeof selectedTask & { errorMessage?: string }).errorMessage || "未知错误"}</p>
                    <Button size="sm" variant="outline" className="mt-2 bg-transparent" onClick={() => handleRetry(selectedTask.id)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      重试
                    </Button>
                  </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <div className="text-sm text-blue-600 mb-1">订单行数</div>
                    <div className="text-xl font-bold text-blue-700">{selectedTask.orderLineCount.toLocaleString()}</div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg text-center">
                    <div className="text-sm text-orange-600 mb-1">COGS金额</div>
                    <div className={`text-xl font-bold ${selectedTask.totalCOGS < 0 ? "text-red-700" : "text-orange-700"}`}>
                      ${Math.abs(selectedTask.totalCOGS).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <div className="text-sm text-green-600 mb-1">店铺数</div>
                    <div className="text-xl font-bold text-green-700">{selectedTask.storeCount}</div>
                  </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="overview">概览</TabsTrigger>
                    <TabsTrigger value="details">结转明细</TabsTrigger>
                    <TabsTrigger value="journal">凭证分录</TabsTrigger>
                    <TabsTrigger value="logs">执行日志</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">任务类型</div>
                        <div className="font-medium mt-1">{taskTypeConfig[selectedTask.taskType].label}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">目标日期</div>
                        <div className="font-medium mt-1">{selectedTask.targetDate}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">开始时间</div>
                        <div className="font-medium mt-1">{selectedTask.startedAt || "-"}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">完成时间</div>
                        <div className="font-medium mt-1">{selectedTask.completedAt || "-"}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">执行人</div>
                        <div className="font-medium mt-1">{selectedTask.executedBy || "-"}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">凭证号</div>
                        <div className="font-medium mt-1">
                          {selectedTask.journalNo ? (
                            <Button variant="link" className="p-0 h-auto text-blue-600">
                              {selectedTask.journalNo}
                            </Button>
                          ) : "-"}
                        </div>
                      </div>
                    </div>

                    {/* 结转规则说明 */}
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <h4 className="font-medium mb-3">COGS结转规则</h4>
                      <div className="text-sm space-y-2">
                        <p><strong>借:</strong> 主营业务成本 (5001)</p>
                        <p><strong>贷:</strong> 库存商品 (1405)</p>
                        <Separator className="my-2" />
                        <p><strong>成本取值:</strong> 优先实际成本 &gt; 暂估成本 &gt; 标准成本</p>
                        <p><strong>汇率:</strong> 使用结转日汇率转换为法人本位币</p>
                      </div>
                    </div>

                    {/* 调整原因（如有） */}
                    {(selectedTask as typeof selectedTask & { adjustmentReason?: string }).adjustmentReason && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-medium text-yellow-800 mb-2">调整原因</h4>
                        <p className="text-sm text-yellow-700">{(selectedTask as typeof selectedTask & { adjustmentReason?: string }).adjustmentReason}</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="details" className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Select defaultValue="all">
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="成本类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          <SelectItem value="ACTUAL">实际成本</SelectItem>
                          <SelectItem value="ESTIMATE">暂估成本</SelectItem>
                          <SelectItem value="STANDARD">标准成本</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        导出明细
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>订单号</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>商品名称</TableHead>
                          <TableHead className="text-right">数量</TableHead>
                          <TableHead className="text-right">单位成本</TableHead>
                          <TableHead className="text-right">成本金额</TableHead>
                          <TableHead>成本类型</TableHead>
                          <TableHead>科目</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockCOGSDetails.map((detail) => (
                          <TableRow key={detail.orderId + detail.sku}>
                            <TableCell className="font-mono text-sm">{detail.orderId}</TableCell>
                            <TableCell className="font-mono text-sm">{detail.sku}</TableCell>
                            <TableCell>{detail.skuName}</TableCell>
                            <TableCell className="text-right">{detail.qty}</TableCell>
                            <TableCell className="text-right font-mono">${detail.unitCost.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-orange-600">${detail.totalCost.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {detail.costType === "ACTUAL" ? "实际" : detail.costType === "ESTIMATE" ? "暂估" : "标准"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{detail.account}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="journal" className="space-y-4">
                    {selectedTask.journalNo ? (
                      <>
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm text-blue-600">凭证号</span>
                              <p className="font-medium text-blue-800">{selectedTask.journalNo}</p>
                            </div>
                            <Button variant="outline" size="sm">
                              查看凭证详情
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-[60px]">行号</TableHead>
                              <TableHead>科目编码</TableHead>
                              <TableHead>科目名称</TableHead>
                              <TableHead className="text-right">借方 (USD)</TableHead>
                              <TableHead className="text-right">贷方 (USD)</TableHead>
                              <TableHead>辅助核算</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mockJournalEntries.map((entry) => (
                              <TableRow key={entry.lineNo}>
                                <TableCell className="font-mono">{entry.lineNo}</TableCell>
                                <TableCell className="font-mono">{entry.account}</TableCell>
                                <TableCell>{entry.accountName}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {entry.debit > 0 ? `$${entry.debit.toLocaleString()}` : "-"}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {entry.credit > 0 ? `$${entry.credit.toLocaleString()}` : "-"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{entry.dimension}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold bg-muted/30">
                              <TableCell colSpan={3}>合计</TableCell>
                              <TableCell className="text-right font-mono">
                                ${mockJournalEntries.reduce((sum, e) => sum + e.debit, 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${mockJournalEntries.reduce((sum, e) => sum + e.credit, 0).toLocaleString()}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        任务未完成，暂无凭证信息
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="logs" className="space-y-4">
                    <div className="space-y-3">
                      {[
                        { time: selectedTask.startedAt || "待执行", action: "任务开始", detail: "开始执行COGS结转" },
                        ...(selectedTask.status === "COMPLETED" ? [
                          { time: selectedTask.completedAt!, action: "任务完成", detail: `成功结转 ${selectedTask.orderLineCount} 行订单，金额 $${selectedTask.totalCOGS.toLocaleString()}` },
                          { time: selectedTask.completedAt!, action: "凭证生成", detail: `生成凭证 ${selectedTask.journalNo}` },
                        ] : []),
                        ...(selectedTask.status === "FAILED" ? [
                          { time: selectedTask.completedAt!, action: "任务失败", detail: (selectedTask as typeof selectedTask & { errorMessage?: string }).errorMessage || "未知错误" },
                        ] : []),
                      ].filter(log => log.time !== "待执行").map((log, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="text-sm text-muted-foreground w-36">{log.time}</div>
                          <div className="flex-1">
                            <div className="font-medium">{log.action}</div>
                            <div className="text-sm text-muted-foreground">{log.detail}</div>
                          </div>
                        </div>
                      ))}
                      {selectedTask.status === "PENDING" && (
                        <p className="text-center text-muted-foreground py-4">任务尚未执行，暂无日志</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* 新建COGS结转任务抽屉 */}
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px]">
            <SheetHeader>
              <SheetTitle>新建COGS结转任务</SheetTitle>
              <SheetDescription>创建销售成本结转任务，支持日结转、月结转和调整结转</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label>任务类型 *</Label>
                <Select defaultValue="DAILY">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">日结转（单日）</SelectItem>
                    <SelectItem value="MONTHLY">月结转（整月汇总）</SelectItem>
                    <SelectItem value="ADJUSTMENT">调整结转（成本回写后）</SelectItem>
                    <SelectItem value="REVERSAL">冲回结转（订单取消）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>目标日期开始 *</Label>
                  <Input type="date" defaultValue="2026-01-17" />
                </div>
                <div className="space-y-2">
                  <Label>目标日期结束</Label>
                  <Input type="date" defaultValue="2026-01-17" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>法人 *</Label>
                <Select defaultValue="ID">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ID">印尼法人</SelectItem>
                    <SelectItem value="MY">马来西亚法人</SelectItem>
                    <SelectItem value="PH">菲律宾法人</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>店铺范围</Label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部店铺</SelectItem>
                    <SelectItem value="STORE-TT-001">TikTok印尼主店</SelectItem>
                    <SelectItem value="STORE-SP-001">Shopee印尼店</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>成本取值策略</Label>
                <Select defaultValue="priority">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">优先级取值（实际&gt;暂估&gt;标准）</SelectItem>
                    <SelectItem value="actual_only">仅实际成本（跳过无实际成本订单）</SelectItem>
                    <SelectItem value="standard_only">仅标准成本</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>执行方式</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="exec-now" defaultChecked />
                    <Label htmlFor="exec-now" className="text-sm">立即执行</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="exec-schedule" />
                    <Label htmlFor="exec-schedule" className="text-sm">定时执行</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>备注（调整/冲回必填）</Label>
                <Textarea placeholder="说明结转原因..." rows={2} />
              </div>

              {/* 预估影响 */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">预估影响（确认前）</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">预计订单行数</span>
                    <p className="font-mono font-medium">1,350</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">预计COGS金额</span>
                    <p className="font-mono font-medium text-orange-600">$48,500</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">涉及店铺数</span>
                    <p className="font-mono font-medium">3</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setCreateOpen(false)}>
                  取消
                </Button>
                <Button variant="outline" className="flex-1 bg-transparent">
                  预览
                </Button>
                <Button className="flex-1" onClick={handleCreateTask}>
                  确认创建
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Suspense>
  )
}
