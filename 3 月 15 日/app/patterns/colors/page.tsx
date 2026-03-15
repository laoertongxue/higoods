"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
  Search,
  Plus,
  Download,
  Eye,
  Play,
  Send,
  CheckCircle,
  XCircle,
  GitBranch,
  CheckSquare,
  Ban,
  XIcon,
  MoreHorizontal,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  COMPLETED: "COMPLETED",
  BLOCKED: "BLOCKED",
  CANCELLED: "CANCELLED",
} as const

const STATUS_LABELS: Record<keyof typeof STATUS, string> = {
  NOT_STARTED: "未开始",
  IN_PROGRESS: "进行中",
  PENDING_REVIEW: "待评审",
  APPROVED: "已确认",
  COMPLETED: "已完成",
  BLOCKED: "阻塞",
  CANCELLED: "已取消",
}

const mockTasks = [
  {
    id: "AT-20260109-001",
    instance_code: "AT-20260109-001",
    title: "花型-印尼碎花连衣裙（定位印 A1）",
    status: STATUS.APPROVED,
    project_ref: { id: "PRJ-20251216-001", name: "印尼风格碎花连衣裙" },
    source_type: "改版任务",
    upstream_instance_ref: { id: "RT-20260109-003", name: "改版任务-印尼碎花" },
    product_ref: { id: "SPU-001", name: "印尼碎花连衣裙" },
    artwork_type: "印花",
    pattern_mode: "定位印",
    artwork_name: "Bunga Tropis A1",
    color_scheme: "Pantone 17-1937 主花 + 11-0608 底色",
    color_card_status: "已确认",
    owner: "林小美",
    due_at: "2025-12-25",
    artwork_version: "A1",
    frozen_at: "2025-12-20",
    downstream_count: 1,
    updated_at: "2025-12-20 14:30",
  },
  {
    id: "AT-20260109-002",
    instance_code: "AT-20260109-002",
    title: "花型-波西米亚风长裙（满印）",
    status: STATUS.IN_PROGRESS,
    project_ref: { id: "PRJ-20251218-002", name: "波西米亚风长裙" },
    source_type: "项目模板阶段",
    upstream_instance_ref: null,
    product_ref: { id: "SPU-002", name: "波西米亚风长裙" },
    artwork_type: "印花",
    pattern_mode: "满印",
    artwork_name: "Bohemian Paisley",
    color_scheme: "多色-渐变",
    color_card_status: "已做未确认",
    owner: "王设计",
    due_at: "2025-12-30",
    artwork_version: "-",
    frozen_at: null,
    downstream_count: 0,
    updated_at: "2025-12-22 10:15",
  },
  {
    id: "AT-20260108-003",
    instance_code: "AT-20260108-003",
    title: "花型-民族风刺绣上衣（绣花）",
    status: STATUS.PENDING_REVIEW,
    project_ref: { id: "PRJ-20251215-003", name: "民族风刺绣上衣" },
    source_type: "改版任务",
    upstream_instance_ref: { id: "RT-20260108-005", name: "改版任务-民族风刺绣" },
    product_ref: { id: "SPU-003", name: "民族风刺绣上衣" },
    artwork_type: "绣花",
    pattern_mode: "局部",
    artwork_name: "Ethnic Embroidery V2",
    color_scheme: "金线+红线",
    color_card_status: "未做",
    owner: "张设计",
    due_at: "2025-12-28",
    artwork_version: "-",
    frozen_at: null,
    downstream_count: 0,
    updated_at: "2025-12-21 16:45",
  },
  {
    id: "AT-20260107-004",
    instance_code: "AT-20260107-004",
    title: "花型-运动风卫衣（烫画）",
    status: STATUS.COMPLETED,
    project_ref: { id: "PRJ-20251210-004", name: "运动休闲卫衣" },
    source_type: "花型复用调色",
    upstream_instance_ref: null,
    product_ref: { id: "SPU-004", name: "运动休闲卫衣" },
    artwork_type: "烫画",
    pattern_mode: "定位印",
    artwork_name: "Sport Logo Heat Transfer",
    color_scheme: "黑白双色",
    color_card_status: "已确认",
    owner: "林小美",
    due_at: "2025-12-18",
    artwork_version: "A2",
    frozen_at: "2025-12-17",
    downstream_count: 2,
    updated_at: "2025-12-18 09:20",
  },
  {
    id: "AT-20260107-005",
    instance_code: "AT-20260107-005",
    title: "花型-复古皮衣夹克（贴布）",
    status: STATUS.BLOCKED,
    project_ref: { id: "PRJ-20251208-005", name: "复古皮衣夹克" },
    source_type: "项目模板阶段",
    upstream_instance_ref: null,
    product_ref: { id: "SPU-005", name: "复古皮衣夹克" },
    artwork_type: "贴布",
    pattern_mode: "局部",
    artwork_name: "Vintage Patch Set",
    color_scheme: "多色贴布",
    color_card_status: "未做",
    owner: "王设计",
    due_at: "2025-12-15",
    artwork_version: "-",
    frozen_at: null,
    downstream_count: 0,
    updated_at: "2025-12-14 11:30",
  },
  {
    id: "AT-20260106-006",
    instance_code: "AT-20260106-006",
    title: "花型-夏日沙滩裙（印花）",
    status: STATUS.NOT_STARTED,
    project_ref: { id: "PRJ-20251205-006", name: "夏日沙滩裙" },
    source_type: "改版任务",
    upstream_instance_ref: { id: "RT-20260106-010", name: "改版任务-夏日沙滩" },
    product_ref: { id: "SPU-006", name: "夏日沙滩裙" },
    artwork_type: "印花",
    pattern_mode: "满印",
    artwork_name: "Tropical Beach",
    color_scheme: "待定",
    color_card_status: "未做",
    owner: "张设计",
    due_at: "2026-01-05",
    artwork_version: "-",
    frozen_at: null,
    downstream_count: 0,
    updated_at: "2025-12-20 08:00",
  },
]

export default function ArtworkTaskListPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState({
    status: "all",
    owner: "all",
    source_type: "all",
    artwork_type: "all",
  })
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [quickFilter, setQuickFilter] = useState<string>("all")

  const filteredTasks = mockTasks.filter((task) => {
    const matchSearch =
      searchQuery === "" ||
      task.instance_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.project_ref.name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchStatus = filters.status === "all" || task.status === filters.status
    const matchOwner = filters.owner === "all" || task.owner === filters.owner
    const matchSource = filters.source_type === "all" || task.source_type === filters.source_type
    const matchType = filters.artwork_type === "all" || task.artwork_type === filters.artwork_type

    // Quick filters
    if (quickFilter === "my")
      return matchSearch && matchStatus && matchOwner && matchSource && matchType && task.owner === "林小美"
    if (quickFilter === "pending_review")
      return (
        matchSearch && matchStatus && matchOwner && matchSource && matchType && task.status === STATUS.PENDING_REVIEW
      )
    if (quickFilter === "frozen_no_downstream")
      return (
        matchSearch &&
        matchStatus &&
        matchOwner &&
        matchSource &&
        matchType &&
        task.status === STATUS.APPROVED &&
        task.downstream_count === 0
      )
    if (quickFilter === "blocked")
      return matchSearch && matchStatus && matchOwner && matchSource && matchType && task.status === STATUS.BLOCKED
    if (quickFilter === "overdue") {
      const now = new Date()
      const dueDate = new Date(task.due_at)
      return (
        matchSearch &&
        matchStatus &&
        matchOwner &&
        matchSource &&
        matchType &&
        dueDate < now &&
        task.status !== STATUS.COMPLETED
      )
    }

    return matchSearch && matchStatus && matchOwner && matchSource && matchType
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case STATUS.NOT_STARTED:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
      case STATUS.IN_PROGRESS:
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case STATUS.PENDING_REVIEW:
        return "bg-orange-500/20 text-orange-400 border-orange-500/30"
      case STATUS.APPROVED:
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case STATUS.COMPLETED:
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      case STATUS.BLOCKED:
        return "bg-red-500/20 text-red-400 border-red-500/30"
      case STATUS.CANCELLED:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getActionButtons = (task: (typeof mockTasks)[0]) => {
    const actions = []

    // 查看 - always visible
    actions.push(
      <DropdownMenuItem key="view" onClick={() => router.push(`/patterns/colors/${task.id}`)}>
        <Eye className="h-4 w-4 mr-2" />
        查看
      </DropdownMenuItem>,
    )

    // 开始/继续
    if (task.status === STATUS.NOT_STARTED || task.status === STATUS.IN_PROGRESS || task.status === STATUS.BLOCKED) {
      actions.push(
        <DropdownMenuItem key="start" onClick={() => toast.success("已开始任务")}>
          <Play className="h-4 w-4 mr-2" />
          {task.status === STATUS.NOT_STARTED ? "开始" : "继续"}
        </DropdownMenuItem>,
      )
    }

    // 提交评审
    if (task.status === STATUS.IN_PROGRESS) {
      actions.push(
        <DropdownMenuItem key="submit" onClick={() => toast.success("已提交评审")}>
          <Send className="h-4 w-4 mr-2" />
          提交评审
        </DropdownMenuItem>,
      )
    }

    // 冻结通过
    if (task.status === STATUS.PENDING_REVIEW) {
      actions.push(
        <DropdownMenuItem key="approve" onClick={() => toast.success("已通过冻结")}>
          <CheckCircle className="h-4 w-4 mr-2" />
          冻结通过
        </DropdownMenuItem>,
      )
    }

    // 驳回
    if (task.status === STATUS.PENDING_REVIEW) {
      actions.push(
        <DropdownMenuItem key="reject" onClick={() => toast.info("已驳回")}>
          <XCircle className="h-4 w-4 mr-2" />
          驳回
        </DropdownMenuItem>,
      )
    }

    // 创建下游
    if (task.status === STATUS.APPROVED || task.status === STATUS.COMPLETED) {
      actions.push(
        <DropdownMenuItem key="downstream" onClick={() => toast.success("创建下游任务")}>
          <GitBranch className="h-4 w-4 mr-2" />
          创建下游
        </DropdownMenuItem>,
      )
    }

    // 完成
    if (task.status === STATUS.APPROVED) {
      actions.push(
        <DropdownMenuItem key="complete" onClick={() => toast.success("已完成")}>
          <CheckSquare className="h-4 w-4 mr-2" />
          完成
        </DropdownMenuItem>,
      )
    }

    // 阻塞/解除
    if (task.status !== STATUS.COMPLETED && task.status !== STATUS.CANCELLED) {
      actions.push(
        <DropdownMenuSeparator key="sep1" />,
        <DropdownMenuItem
          key="block"
          onClick={() => toast.info(task.status === STATUS.BLOCKED ? "已解除阻塞" : "已标记阻塞")}
        >
          <Ban className="h-4 w-4 mr-2" />
          {task.status === STATUS.BLOCKED ? "解除阻塞" : "阻塞"}
        </DropdownMenuItem>,
      )
    }

    // 取消
    if (task.status === STATUS.NOT_STARTED || task.status === STATUS.IN_PROGRESS) {
      actions.push(
        <DropdownMenuItem key="cancel" onClick={() => toast.info("已取消")}>
          <XIcon className="h-4 w-4 mr-2" />
          取消
        </DropdownMenuItem>,
      )
    }

    return actions
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">花型任务</h1>
                <p className="text-sm text-muted-foreground mt-1">管理花型设计、印花、绣花、烫画等图案资产交付</p>
              </div>
              <Button onClick={() => setCreateDrawerOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                新建花型任务
              </Button>
            </div>

            {/* Filter Bar */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索任务编号/标题/项目..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.owner} onValueChange={(value) => setFilters({ ...filters, owner: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="负责人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="林小美">林小美</SelectItem>
                    <SelectItem value="王设计">王设计</SelectItem>
                    <SelectItem value="张设计">张设计</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.source_type}
                  onValueChange={(value) => setFilters({ ...filters, source_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="来源" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部来源</SelectItem>
                    <SelectItem value="改版任务">改版任务</SelectItem>
                    <SelectItem value="项目模板阶段">项目模板阶段</SelectItem>
                    <SelectItem value="花型复用调色">花型复用调色</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.artwork_type}
                  onValueChange={(value) => setFilters({ ...filters, artwork_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="花型类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="印花">印花</SelectItem>
                    <SelectItem value="绣花">绣花</SelectItem>
                    <SelectItem value="烫画">烫画</SelectItem>
                    <SelectItem value="贴布">贴布</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* KPI Quick Filters */}
              <div className="flex items-center gap-2">
                <Button
                  variant={quickFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("all")}
                >
                  全部 ({mockTasks.length})
                </Button>
                <Button
                  variant={quickFilter === "my" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("my")}
                >
                  我的 ({mockTasks.filter((t) => t.owner === "林小美").length})
                </Button>
                <Button
                  variant={quickFilter === "pending_review" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("pending_review")}
                >
                  待评审 ({mockTasks.filter((t) => t.status === STATUS.PENDING_REVIEW).length})
                </Button>
                <Button
                  variant={quickFilter === "frozen_no_downstream" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("frozen_no_downstream")}
                >
                  已冻结未建下游 (
                  {mockTasks.filter((t) => t.status === STATUS.APPROVED && t.downstream_count === 0).length})
                </Button>
                <Button
                  variant={quickFilter === "blocked" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("blocked")}
                >
                  阻塞 ({mockTasks.filter((t) => t.status === STATUS.BLOCKED).length})
                </Button>
                <Button
                  variant={quickFilter === "overdue" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter("overdue")}
                >
                  超期 (1)
                </Button>
              </div>
            </div>

            {/* Toolbar */}
            {selectedTasks.length > 0 && (
              <div className="bg-muted/50 border border-border rounded-lg p-3 flex items-center gap-3">
                <span className="text-sm text-muted-foreground">已选 {selectedTasks.length} 项</span>
                <Button variant="outline" size="sm">
                  批量分派
                </Button>
                <Button variant="outline" size="sm">
                  批量截止
                </Button>
                <Button variant="outline" size="sm">
                  批量阻塞
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  导出
                </Button>
              </div>
            )}

            {/* Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                        onCheckedChange={(checked) => {
                          setSelectedTasks(checked ? filteredTasks.map((t) => t.id) : [])
                        }}
                      />
                    </TableHead>
                    <TableHead>任务</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead>花型类型</TableHead>
                    <TableHead>花型名称</TableHead>
                    <TableHead>色彩方案</TableHead>
                    <TableHead>负责人</TableHead>
                    <TableHead>截止时间</TableHead>
                    <TableHead>花型版本</TableHead>
                    <TableHead>下游任务</TableHead>
                    <TableHead>最近更新</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-12 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task) => (
                      <TableRow key={task.id} className="border-border hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={(checked) => {
                              setSelectedTasks(
                                checked ? [...selectedTasks, task.id] : selectedTasks.filter((id) => id !== task.id),
                              )
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/patterns/colors/${task.id}`}
                            className="text-primary font-medium hover:underline"
                          >
                            {task.instance_code}
                          </Link>
                          <div className="text-xs text-muted-foreground mt-0.5">{task.title}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusBadge(task.status)} border`}>
                            {STATUS_LABELS[task.status as keyof typeof STATUS]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/projects/${task.project_ref.id}`}
                            className="text-primary hover:underline text-sm"
                          >
                            {task.project_ref.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{task.source_type}</span>
                        </TableCell>
                        <TableCell>
                          {task.product_ref ? (
                            <div>
                              <span className="text-sm">{task.product_ref.name}</span>
                              <div className="text-xs text-muted-foreground">{task.product_ref.id}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {task.artwork_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{task.artwork_name}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{task.color_scheme}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{task.owner}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{task.due_at}</span>
                        </TableCell>
                        <TableCell>
                          {task.artwork_version === "-" ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-400">
                              {task.artwork_version}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{task.downstream_count}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{task.updated_at}</span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">{getActionButtons(task)}</DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </main>
      </div>

      {/* AT2: Create/Edit Drawer */}
      <Sheet open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>新建花型任务</SheetTitle>
            <SheetDescription>填写花型任务基本信息、来源、需求和关联样衣</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 py-6">
            {/* Section 1: Basic Info */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">一、基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>标题 *</Label>
                  <Input placeholder="花型-{{款号/项目名}}" />
                </div>
                <div className="space-y-2">
                  <Label>优先级 *</Label>
                  <Select defaultValue="medium">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>负责人 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择负责人" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="林小美">林小美</SelectItem>
                      <SelectItem value="王设计">王设计</SelectItem>
                      <SelectItem value="张设计">张设计</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>截止时间</Label>
                  <Input type="date" />
                </div>
              </div>
            </div>

            {/* Section 2: Source & Binding */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">二、来源与绑定</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>source_type *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择来源" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="改版任务">改版任务</SelectItem>
                      <SelectItem value="项目模板阶段">项目模板阶段</SelectItem>
                      <SelectItem value="花型复用调色">花型复用调色</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>project *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择项目" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRJ-20251216-001">印尼风格碎花连衣裙</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>上游实例 (条件必填)</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择上游实例" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RT-20260109-003">改版任务-印尼碎花</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 3: Artwork Requirements */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">三、花型需求</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>花型类型 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="印花">印花</SelectItem>
                      <SelectItem value="绣花">绣花</SelectItem>
                      <SelectItem value="烫画">烫画</SelectItem>
                      <SelectItem value="贴布">贴布</SelectItem>
                      <SelectItem value="其他">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>图案方式 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="定位印">定位印</SelectItem>
                      <SelectItem value="满印">满印</SelectItem>
                      <SelectItem value="局部">局部</SelectItem>
                      <SelectItem value="拼版">拼版</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>色彩方案</Label>
                  <Textarea placeholder="描述色彩方案" />
                </div>
              </div>
            </div>

            {/* Section 4: Reference Samples */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">四、参考资料与关联样衣</h3>
              <div className="space-y-2">
                <Label>关联样衣 (可选，多选)</Label>
                <div className="border border-border rounded-lg p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">选择需要参考的样衣</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>备注</Label>
                <Textarea placeholder="其他说明" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setCreateDrawerOpen(false)}>
              保存草稿
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                toast.success("任务已创建")
                setCreateDrawerOpen(false)
              }}
            >
              创建并开始
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
