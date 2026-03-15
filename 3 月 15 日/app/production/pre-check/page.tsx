"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Search,
  RotateCcw,
  Eye,
  Truck,
  PackageCheck,
  Warehouse,
  ClipboardCheck,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  AlertTriangle,
  Clock,
  Package,
  FileCheck,
  Lock,
  Unlock,
} from "lucide-react"

// 状态枚举
const STATUS = {
  NOT_STARTED: { label: "未开始", color: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "进行中", color: "bg-blue-100 text-blue-700" },
  IN_TRANSIT: { label: "在途", color: "bg-yellow-100 text-yellow-700" },
  ARRIVED: { label: "已到样", color: "bg-orange-100 text-orange-700" },
  IN_QC: { label: "验收中", color: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "已完成", color: "bg-green-100 text-green-700" },
  BLOCKED: { label: "阻塞", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已取消", color: "bg-gray-100 text-gray-500" },
}

// 产前结论枚举
const PREPROD_RESULT = {
  PASS: { label: "通过", color: "bg-green-100 text-green-700" },
  FAIL: { label: "不通过", color: "bg-red-100 text-red-700" },
  NEED_RETRY: { label: "需补产前", color: "bg-orange-100 text-orange-700" },
  NEED_REVISION: { label: "需改版", color: "bg-yellow-100 text-yellow-700" },
}

// 门禁状态
const GATE_STATUS = {
  NOT_MET: { label: "未满足", color: "bg-red-100 text-red-700", icon: Lock },
  MET: { label: "已满足", color: "bg-green-100 text-green-700", icon: Unlock },
}

// Mock数据
const mockTasks = [
  {
    id: "PP-20260115-001",
    title: "产前版-碎花连衣裙",
    status: "COMPLETED",
    projectRef: "PRJ-20260105-001",
    projectName: "印尼风格碎花连衣裙",
    sourceType: "首单",
    sourceRef: "FS-20260109-005",
    factoryRef: "JKT-Factory-03",
    factoryName: "雅加达工厂03",
    targetSite: "雅加达",
    patternRef: "PT-20260112-004",
    patternVersion: "P2",
    artworkRef: "AT-20260109-001",
    artworkVersion: "A1",
    expectedArrival: "2026-01-17",
    trackingNo: "JNE-99230018",
    arrivedAt: "2026-01-18 14:10",
    stockedInAt: "2026-01-18 16:00",
    sampleRef: "SY-JKT-00045",
    sampleName: "碎花连衣裙-产前版",
    preprodResult: "PASS",
    gateStatus: "MET",
    owner: "王版师",
    updatedAt: "2026-01-18 16:30",
  },
  {
    id: "PP-20260116-002",
    title: "产前版-条纹T恤",
    status: "IN_QC",
    projectRef: "PRJ-20260108-003",
    projectName: "基础款条纹T恤",
    sourceType: "制版",
    sourceRef: "PT-20260110-002",
    factoryRef: "SZ-Factory-01",
    factoryName: "深圳工厂01",
    targetSite: "深圳",
    patternRef: "PT-20260110-002",
    patternVersion: "P3",
    artworkRef: null,
    artworkVersion: null,
    expectedArrival: "2026-01-15",
    trackingNo: "SF-1234567890",
    arrivedAt: "2026-01-16 09:30",
    stockedInAt: "2026-01-16 11:00",
    sampleRef: "SY-SZ-00123",
    sampleName: "条纹T恤-产前版",
    preprodResult: null,
    gateStatus: "NOT_MET",
    owner: "李版师",
    updatedAt: "2026-01-16 11:00",
  },
  {
    id: "PP-20260117-003",
    title: "产前版-牛仔短裤",
    status: "ARRIVED",
    projectRef: "PRJ-20260110-005",
    projectName: "夏季牛仔短裤",
    sourceType: "改版",
    sourceRef: "RT-20260112-001",
    factoryRef: "SZ-Factory-02",
    factoryName: "深圳工厂02",
    targetSite: "深圳",
    patternRef: "PT-20260114-003",
    patternVersion: "P2",
    artworkRef: null,
    artworkVersion: null,
    expectedArrival: "2026-01-16",
    trackingNo: "YT-9876543210",
    arrivedAt: "2026-01-17 15:20",
    stockedInAt: null,
    sampleRef: null,
    sampleName: null,
    preprodResult: null,
    gateStatus: "NOT_MET",
    owner: "张版师",
    updatedAt: "2026-01-17 15:20",
  },
  {
    id: "PP-20260118-004",
    title: "产前版-印花衬衫",
    status: "IN_TRANSIT",
    projectRef: "PRJ-20260112-007",
    projectName: "热带印花衬衫",
    sourceType: "花型",
    sourceRef: "AT-20260115-003",
    factoryRef: "JKT-Factory-01",
    factoryName: "雅加达工厂01",
    targetSite: "雅加达",
    patternRef: "PT-20260116-005",
    patternVersion: "P1",
    artworkRef: "AT-20260115-003",
    artworkVersion: "A2",
    expectedArrival: "2026-01-20",
    trackingNo: "JNE-88120045",
    arrivedAt: null,
    stockedInAt: null,
    sampleRef: null,
    sampleName: null,
    preprodResult: null,
    gateStatus: "NOT_MET",
    owner: "陈版师",
    updatedAt: "2026-01-18 10:00",
  },
  {
    id: "PP-20260119-005",
    title: "产前版-针织开衫",
    status: "IN_PROGRESS",
    projectRef: "PRJ-20260115-009",
    projectName: "秋季针织开衫",
    sourceType: "首单",
    sourceRef: "FS-20260117-008",
    factoryRef: "SZ-Factory-03",
    factoryName: "深圳工厂03",
    targetSite: "深圳",
    patternRef: "PT-20260118-006",
    patternVersion: "P2",
    artworkRef: null,
    artworkVersion: null,
    expectedArrival: "2026-01-22",
    trackingNo: null,
    arrivedAt: null,
    stockedInAt: null,
    sampleRef: null,
    sampleName: null,
    preprodResult: null,
    gateStatus: "NOT_MET",
    owner: "王版师",
    updatedAt: "2026-01-19 09:00",
  },
  {
    id: "PP-20260120-006",
    title: "产前版-波点连衣裙",
    status: "COMPLETED",
    projectRef: "PRJ-20260113-006",
    projectName: "复古波点连衣裙",
    sourceType: "改版",
    sourceRef: "RT-20260115-004",
    factoryRef: "JKT-Factory-02",
    factoryName: "雅加达工厂02",
    targetSite: "雅加达",
    patternRef: "PT-20260117-007",
    patternVersion: "P3",
    artworkRef: "AT-20260116-005",
    artworkVersion: "A1",
    expectedArrival: "2026-01-19",
    trackingNo: "JNE-77890123",
    arrivedAt: "2026-01-19 11:30",
    stockedInAt: "2026-01-19 14:00",
    sampleRef: "SY-JKT-00052",
    sampleName: "波点连衣裙-产前版",
    preprodResult: "FAIL",
    gateStatus: "NOT_MET",
    owner: "李版师",
    updatedAt: "2026-01-20 10:00",
  },
]

export default function PreProductionSamplePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [siteFilter, setSiteFilter] = useState("all")
  const [ownerFilter, setOwnerFilter] = useState("all")
  const [kpiFilter, setKpiFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [stockInDialogOpen, setStockInDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<(typeof mockTasks)[0] | null>(null)

  // 新建表单状态
  const [newTask, setNewTask] = useState({
    title: "",
    owner: "",
    participants: "",
    expectedArrival: "",
    projectRef: "",
    sourceType: "",
    upstreamRef: "",
    patternRef: "",
    patternVersion: "",
    artworkRef: "",
    artworkVersion: "",
    factoryRef: "",
    requirements: "",
    targetSite: "",
  })

  // KPI统计
  const kpiStats = {
    inTransit: mockTasks.filter((t) => t.status === "IN_TRANSIT").length,
    arrived: mockTasks.filter((t) => t.status === "ARRIVED").length,
    inQc: mockTasks.filter((t) => t.status === "IN_QC").length,
    passed: mockTasks.filter((t) => t.preprodResult === "PASS").length,
    failed: mockTasks.filter((t) => t.preprodResult === "FAIL" || t.preprodResult === "NEED_REVISION").length,
    overdue: mockTasks.filter(
      (t) => t.status !== "COMPLETED" && t.status !== "CANCELLED" && new Date(t.expectedArrival) < new Date(),
    ).length,
  }

  // 筛选数据
  const filteredTasks = mockTasks.filter((task) => {
    if (
      searchKeyword &&
      !task.id.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !task.title.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !task.projectName.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !task.trackingNo?.toLowerCase().includes(searchKeyword.toLowerCase())
    )
      return false
    if (statusFilter !== "all" && task.status !== statusFilter) return false
    if (siteFilter !== "all" && task.targetSite !== siteFilter) return false
    if (ownerFilter !== "all" && task.owner !== ownerFilter) return false
    if (kpiFilter === "inTransit" && task.status !== "IN_TRANSIT") return false
    if (kpiFilter === "arrived" && task.status !== "ARRIVED") return false
    if (kpiFilter === "inQc" && task.status !== "IN_QC") return false
    if (kpiFilter === "passed" && task.preprodResult !== "PASS") return false
    if (kpiFilter === "failed" && task.preprodResult !== "FAIL" && task.preprodResult !== "NEED_REVISION") return false
    if (
      kpiFilter === "overdue" &&
      (task.status === "COMPLETED" || task.status === "CANCELLED" || new Date(task.expectedArrival) >= new Date())
    )
      return false
    return true
  })

  const handleCopyTrackingNo = (trackingNo: string) => {
    navigator.clipboard.writeText(trackingNo)
    toast({ title: "已复制运单号", description: trackingNo })
  }

  const handleReceipt = (task: (typeof mockTasks)[0]) => {
    setSelectedTask(task)
    setReceiptDialogOpen(true)
  }

  const handleStockIn = (task: (typeof mockTasks)[0]) => {
    setSelectedTask(task)
    setStockInDialogOpen(true)
  }

  const handleSubmitReceipt = () => {
    toast({ title: "到样签收成功", description: `任务 ${selectedTask?.id} 已签收，台账事件已写入` })
    setReceiptDialogOpen(false)
  }

  const handleSubmitStockIn = () => {
    toast({ title: "核对入库成功", description: `任务 ${selectedTask?.id} 已入库，样衣资产已创建` })
    setStockInDialogOpen(false)
  }

  const handleCreateTask = (startImmediately: boolean) => {
    toast({
      title: startImmediately ? "产前版样衣已创建并开始" : "产前版样衣已保存草稿",
      description: `标题: ${newTask.title}`,
    })
    setCreateDrawerOpen(false)
    setNewTask({
      title: "",
      owner: "",
      participants: "",
      expectedArrival: "",
      projectRef: "",
      sourceType: "",
      upstreamRef: "",
      patternRef: "",
      patternVersion: "",
      artworkRef: "",
      artworkVersion: "",
      factoryRef: "",
      requirements: "",
      targetSite: "",
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">产前版样衣</h1>
              <p className="text-sm text-muted-foreground mt-1">
                基于已冻结的制版/花型版本与首单验证结论，完成产前版样衣制作与回收，作为进入量产的关键门槛
              </p>
            </div>
            <Sheet open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
              <SheetTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  新建产前版样衣
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[600px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>新建产前版样衣</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  {/* 基本信息 */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground">基本信息</h3>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>
                          标题 <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder="产前版-{{款号/项目名}}"
                          value={newTask.title}
                          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>
                            负责人 <span className="text-red-500">*</span>
                          </Label>
                          <Select value={newTask.owner} onValueChange={(v) => setNewTask({ ...newTask, owner: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="选择负责人" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="王版师">王版师</SelectItem>
                              <SelectItem value="李版师">李版师</SelectItem>
                              <SelectItem value="张版师">张版师</SelectItem>
                              <SelectItem value="陈版师">陈版师</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>预计到样</Label>
                          <Input
                            type="date"
                            value={newTask.expectedArrival}
                            onChange={(e) => setNewTask({ ...newTask, expectedArrival: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>参与人</Label>
                        <Input
                          placeholder="多人用逗号分隔"
                          value={newTask.participants}
                          onChange={(e) => setNewTask({ ...newTask, participants: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 来源与绑定 */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground">来源与绑定</h3>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>
                          项目 <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={newTask.projectRef}
                          onValueChange={(v) => setNewTask({ ...newTask, projectRef: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择项目" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRJ-20260105-001">PRJ-20260105-001 印尼风格碎花连衣裙</SelectItem>
                            <SelectItem value="PRJ-20260108-003">PRJ-20260108-003 基础款条纹T恤</SelectItem>
                            <SelectItem value="PRJ-20260110-005">PRJ-20260110-005 夏季牛仔短裤</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>
                            来源类型 <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={newTask.sourceType}
                            onValueChange={(v) => setNewTask({ ...newTask, sourceType: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择来源" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="首单">来自首单</SelectItem>
                              <SelectItem value="制版">来自制版</SelectItem>
                              <SelectItem value="花型">来自花型</SelectItem>
                              <SelectItem value="改版">来自改版</SelectItem>
                              <SelectItem value="人工">人工创建</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            上游实例引用 {newTask.sourceType === "首单" && <span className="text-red-500">*</span>}
                          </Label>
                          <Input
                            placeholder="上游任务编号"
                            value={newTask.upstreamRef}
                            onChange={(e) => setNewTask({ ...newTask, upstreamRef: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 版本输入（强校验） */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground">版本输入（必须为冻结版本）</h3>
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>
                            制版任务引用 <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={newTask.patternRef}
                            onValueChange={(v) => setNewTask({ ...newTask, patternRef: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择制版任务" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PT-20260112-004">PT-20260112-004（已冻结）</SelectItem>
                              <SelectItem value="PT-20260110-002">PT-20260110-002（已冻结）</SelectItem>
                              <SelectItem value="PT-20260114-003">PT-20260114-003（已冻结）</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            制版版本 <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={newTask.patternVersion}
                            onValueChange={(v) => setNewTask({ ...newTask, patternVersion: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="P?" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="P1">P1</SelectItem>
                              <SelectItem value="P2">P2</SelectItem>
                              <SelectItem value="P3">P3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>花型任务引用</Label>
                          <Select
                            value={newTask.artworkRef}
                            onValueChange={(v) => setNewTask({ ...newTask, artworkRef: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择花型任务（若有）" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AT-20260109-001">AT-20260109-001（已冻结）</SelectItem>
                              <SelectItem value="AT-20260115-003">AT-20260115-003（已冻结）</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>花型版本</Label>
                          <Select
                            value={newTask.artworkVersion}
                            onValueChange={(v) => setNewTask({ ...newTask, artworkVersion: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="A?" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A1">A1</SelectItem>
                              <SelectItem value="A2">A2</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <AlertTriangle className="w-3 h-3 inline mr-1 text-yellow-500" />
                        只能选择状态为"已冻结/已完成"的制版/花型任务版本
                      </p>
                    </div>
                  </div>

                  {/* 打样对象与交期 */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground">打样对象与交期</h3>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>
                          工厂/外协 <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={newTask.factoryRef}
                          onValueChange={(v) => setNewTask({ ...newTask, factoryRef: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择工厂" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SZ-Factory-01">深圳工厂01</SelectItem>
                            <SelectItem value="SZ-Factory-02">深圳工厂02</SelectItem>
                            <SelectItem value="SZ-Factory-03">深圳工厂03</SelectItem>
                            <SelectItem value="JKT-Factory-01">雅加达工厂01</SelectItem>
                            <SelectItem value="JKT-Factory-02">雅加达工厂02</SelectItem>
                            <SelectItem value="JKT-Factory-03">雅加达工厂03</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>打样要求</Label>
                        <Textarea
                          placeholder="面料/工艺/注意事项等"
                          value={newTask.requirements}
                          onChange={(e) => setNewTask({ ...newTask, requirements: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 目标站点与收货信息 */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground">目标站点与收货信息</h3>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>
                          目标站点 <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={newTask.targetSite}
                          onValueChange={(v) => setNewTask({ ...newTask, targetSite: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择站点" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="深圳">深圳</SelectItem>
                            <SelectItem value="雅加达">雅加达</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
                        收货地址将根据站点配置自动填充，收货联系人默认为站点仓管
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button variant="outline" className="flex-1 bg-transparent" onClick={() => handleCreateTask(false)}>
                      保存草稿
                    </Button>
                    <Button className="flex-1" onClick={() => handleCreateTask(true)}>
                      创建并开始
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* 筛选栏 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="任务编号/项目/款号/运单号/样衣编号"
                    className="pl-9"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="NOT_STARTED">未开始</SelectItem>
                    <SelectItem value="IN_PROGRESS">进行中</SelectItem>
                    <SelectItem value="IN_TRANSIT">在途</SelectItem>
                    <SelectItem value="ARRIVED">已到样待入库</SelectItem>
                    <SelectItem value="IN_QC">验收中</SelectItem>
                    <SelectItem value="COMPLETED">已完成</SelectItem>
                    <SelectItem value="BLOCKED">阻塞</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={siteFilter} onValueChange={setSiteFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="站点" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部站点</SelectItem>
                    <SelectItem value="深圳">深圳</SelectItem>
                    <SelectItem value="雅加达">雅加达</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="负责人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="王版师">王版师</SelectItem>
                    <SelectItem value="李版师">李版师</SelectItem>
                    <SelectItem value="张版师">张版师</SelectItem>
                    <SelectItem value="陈版师">陈版师</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchKeyword("")
                    setStatusFilter("all")
                    setSiteFilter("all")
                    setOwnerFilter("all")
                    setKpiFilter("all")
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* KPI快捷筛选 */}
          <div className="grid grid-cols-6 gap-4">
            <Card
              className={`cursor-pointer transition-colors ${kpiFilter === "inTransit" ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}
              onClick={() => setKpiFilter(kpiFilter === "inTransit" ? "all" : "inTransit")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.inTransit}</p>
                  <p className="text-xs text-muted-foreground">在途</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors ${kpiFilter === "arrived" ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}
              onClick={() => setKpiFilter(kpiFilter === "arrived" ? "all" : "arrived")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <PackageCheck className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.arrived}</p>
                  <p className="text-xs text-muted-foreground">已到样待入库</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors ${kpiFilter === "inQc" ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}
              onClick={() => setKpiFilter(kpiFilter === "inQc" ? "all" : "inQc")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.inQc}</p>
                  <p className="text-xs text-muted-foreground">验收中</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors ${kpiFilter === "passed" ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}
              onClick={() => setKpiFilter(kpiFilter === "passed" ? "all" : "passed")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.passed}</p>
                  <p className="text-xs text-muted-foreground">已通过产前</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors ${kpiFilter === "failed" ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}
              onClick={() => setKpiFilter(kpiFilter === "failed" ? "all" : "failed")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.failed}</p>
                  <p className="text-xs text-muted-foreground">未通过</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors ${kpiFilter === "overdue" ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}
              onClick={() => setKpiFilter(kpiFilter === "overdue" ? "all" : "overdue")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.overdue}</p>
                  <p className="text-xs text-muted-foreground">超期</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 数据表格 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[180px]">任务</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>工厂</TableHead>
                    <TableHead>站点</TableHead>
                    <TableHead>制版版本</TableHead>
                    <TableHead>花型版本</TableHead>
                    <TableHead>预计到样</TableHead>
                    <TableHead>运单</TableHead>
                    <TableHead>到样时间</TableHead>
                    <TableHead>入库时间</TableHead>
                    <TableHead>样衣</TableHead>
                    <TableHead>产前结论</TableHead>
                    <TableHead>门禁</TableHead>
                    <TableHead className="w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => {
                    const statusInfo = STATUS[task.status as keyof typeof STATUS]
                    const resultInfo = task.preprodResult
                      ? PREPROD_RESULT[task.preprodResult as keyof typeof PREPROD_RESULT]
                      : null
                    const gateInfo = GATE_STATUS[task.gateStatus as keyof typeof GATE_STATUS]
                    const GateIcon = gateInfo.icon
                    const isOverdue =
                      task.status !== "COMPLETED" &&
                      task.status !== "CANCELLED" &&
                      new Date(task.expectedArrival) < new Date()

                    return (
                      <TableRow key={task.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div>
                            <button
                              className="text-sm font-medium text-primary hover:underline"
                              onClick={() => router.push(`/production/pre-check/${task.id}`)}
                            >
                              {task.id}
                            </button>
                            <p className="text-xs text-muted-foreground">{task.title}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <button className="text-xs text-primary hover:underline">{task.projectRef}</button>
                          <p className="text-xs text-muted-foreground truncate max-w-[120px]">{task.projectName}</p>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <span className="text-muted-foreground">{task.sourceType}</span>
                            <button className="block text-primary hover:underline">{task.sourceRef}</button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{task.factoryName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{task.targetSite}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono">
                            {task.patternVersion}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {task.artworkVersion ? (
                            <Badge variant="secondary" className="font-mono">
                              {task.artworkVersion}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>
                          <div className="flex items-center gap-1 text-xs">
                            {isOverdue && <AlertTriangle className="w-3 h-3" />}
                            {task.expectedArrival}
                          </div>
                        </TableCell>
                        <TableCell>
                          {task.trackingNo ? (
                            <button
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                              onClick={() => handleCopyTrackingNo(task.trackingNo!)}
                            >
                              {task.trackingNo}
                              <Copy className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{task.arrivedAt || "-"}</TableCell>
                        <TableCell className="text-xs">{task.stockedInAt || "-"}</TableCell>
                        <TableCell>
                          {task.sampleRef ? (
                            <button className="text-xs text-primary hover:underline">{task.sampleRef}</button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {resultInfo ? (
                            <Badge className={resultInfo.color}>{resultInfo.label}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={gateInfo.color}>
                            <GateIcon className="w-3 h-3 mr-1" />
                            {gateInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => router.push(`/production/pre-check/${task.id}`)}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            {(task.status === "IN_TRANSIT" || task.status === "IN_PROGRESS") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => handleReceipt(task)}
                              >
                                <PackageCheck className="w-3 h-3" />
                              </Button>
                            )}
                            {task.status === "ARRIVED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => handleStockIn(task)}
                              >
                                <Warehouse className="w-3 h-3" />
                              </Button>
                            )}
                            {(task.status === "IN_QC" || task.status === "COMPLETED") && task.sampleRef && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => toast({ title: "打开样衣库存", description: task.sampleRef })}
                              >
                                <Package className="w-3 h-3" />
                              </Button>
                            )}
                            {task.status === "IN_QC" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => toast({ title: "填写产前结论", description: task.id })}
                              >
                                <FileCheck className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* 分页 */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">共 {filteredTasks.length} 条</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">第 {currentPage} 页</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* 到样签收弹窗 */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>到样签收</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                签收时间 <span className="text-red-500">*</span>
              </Label>
              <Input type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
            </div>
            <div className="space-y-2">
              <Label>回执/包裹照片</Label>
              <Input type="file" accept="image/*" />
              <p className="text-xs text-muted-foreground">建议上传签收凭证</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitReceipt}>确认签收</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 核对入库弹窗 */}
      <Dialog open={stockInDialogOpen} onOpenChange={setStockInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>核对入库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  仓库 <span className="text-red-500">*</span>
                </Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="选择仓库" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SZ-WH-01">深圳仓库01</SelectItem>
                    <SelectItem value="JKT-WH-01">雅加达仓库01</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  库位 <span className="text-red-500">*</span>
                </Label>
                <Input placeholder="A-01-02" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                样衣编号 <span className="text-red-500">*</span>
              </Label>
              <Input
                defaultValue={`SY-${selectedTask?.targetSite === "深圳" ? "SZ" : "JKT"}-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`}
              />
              <p className="text-xs text-muted-foreground">系统自动生成，可修改确认</p>
            </div>
            <div className="space-y-2">
              <Label>
                初检结果 <span className="text-red-500">*</span>
              </Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择初检结果" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">合格</SelectItem>
                  <SelectItem value="fail">不合格</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>入库照片</Label>
              <Input type="file" accept="image/*" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockInDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitStockIn}>确认入库</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
