"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  MoreVertical,
  Eye,
  XCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Info,
  ArrowUpDown,
  Archive,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"

interface Project {
  id: string
  code: string
  name: string
  coverUrl: string
  styleType: string
  category: string
  tags: string[]
  status: "进行中" | "已终止" | "已归档"
  spuCode?: string
  phaseName: string
  progressDone: number
  progressTotal: number
  nextWorkItemName: string
  nextWorkItemStatus: "未开始" | "进行中" | "待决策" | "已完成"
  hasPendingDecision: boolean
  isBlocked: boolean
  gateReason?: string
  riskStatus: "正常" | "延期"
  riskReason?: string
  riskWorkItem?: string
  riskDurationDays?: number
  owner: string
  updatedAt: string
}

const mockProjects: Project[] = [
  {
    id: "prj_20251216_001",
    code: "PRJ-20251216-001",
    name: "印尼风格碎花连衣裙",
    coverUrl: "/elegant-floral-dress.png",
    styleType: "基础款",
    category: "裙装 / 连衣裙",
    tags: ["休闲", "甜美"],
    status: "进行中",
    spuCode: "SPU-2025-0891",
    phaseName: "测款阶段",
    progressDone: 7,
    progressTotal: 10,
    nextWorkItemName: "测款结论判定",
    nextWorkItemStatus: "待决策",
    hasPendingDecision: true,
    isBlocked: false,
    riskStatus: "正常",
    owner: "张丽",
    updatedAt: "2025-12-16 14:30",
  },
  {
    id: "prj_20251216_002",
    code: "PRJ-20251216-002",
    name: "百搭纯色基础T恤",
    coverUrl: "/basic-white-tshirt.jpg",
    styleType: "快时尚款",
    category: "上衣 / T恤",
    tags: ["极简", "通勤"],
    status: "进行中",
    spuCode: "SPU-2025-0892",
    phaseName: "工程准备",
    progressDone: 8,
    progressTotal: 8,
    nextWorkItemName: "首单样衣打样",
    nextWorkItemStatus: "进行中",
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: "正常",
    owner: "王明",
    updatedAt: "2025-12-16 12:00",
  },
  {
    id: "prj_20251216_003",
    code: "PRJ-20251216-003",
    name: "夏日休闲牛仔短裤",
    coverUrl: "/summer-shorts-denim.jpg",
    styleType: "设计款",
    category: "裤装 / 短裤",
    tags: ["休闲", "运动"],
    status: "进行中",
    phaseName: "打样阶段",
    progressDone: 3,
    progressTotal: 12,
    nextWorkItemName: "样衣评审",
    nextWorkItemStatus: "未开始",
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: "延期",
    riskReason: "供应商交付延迟",
    riskWorkItem: "外采样品采购",
    riskDurationDays: 5,
    owner: "李娜",
    updatedAt: "2025-12-15 18:45",
  },
  {
    id: "prj_20251216_004",
    code: "PRJ-20251216-004",
    name: "复古皮质机车夹克",
    coverUrl: "/vintage-jacket-leather.jpg",
    styleType: "改版款",
    category: "外套 / 夹克",
    tags: ["复古", "街头"],
    status: "进行中",
    phaseName: "立项阶段",
    progressDone: 2,
    progressTotal: 7,
    nextWorkItemName: "初步可行性判断",
    nextWorkItemStatus: "待决策",
    hasPendingDecision: true,
    isBlocked: true,
    gateReason: "初步可行性判断待决策",
    riskStatus: "正常",
    owner: "赵云",
    updatedAt: "2025-12-15 16:20",
  },
  {
    id: "prj_20251216_005",
    code: "PRJ-20251216-005",
    name: "法式优雅衬衫连衣裙",
    coverUrl: "/elegant-floral-dress.png",
    styleType: "设计款",
    category: "裙装 / 连衣裙",
    tags: ["优雅", "通勤"],
    status: "进行中",
    spuCode: "SPU-2025-0895",
    phaseName: "测款阶段",
    progressDone: 6,
    progressTotal: 10,
    nextWorkItemName: "直播测款",
    nextWorkItemStatus: "进行中",
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: "延期",
    riskReason: "直播场次安排冲突",
    riskWorkItem: "直播测款",
    riskDurationDays: 3,
    owner: "周芳",
    updatedAt: "2025-12-15 14:10",
  },
  {
    id: "prj_20251216_006",
    code: "PRJ-20251216-006",
    name: "运动休闲卫衣套装",
    coverUrl: "/basic-white-tshirt.jpg",
    styleType: "快时尚款",
    category: "套装 / 运动套装",
    tags: ["运动", "休闲"],
    status: "进行中",
    phaseName: "工程准备",
    progressDone: 7,
    progressTotal: 8,
    nextWorkItemName: "制版任务",
    nextWorkItemStatus: "已完成",
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: "正常",
    owner: "陈刚",
    updatedAt: "2025-12-14 20:30",
  },
  {
    id: "prj_20251216_007",
    code: "PRJ-20251216-007",
    name: "碎花雪纺半身裙",
    coverUrl: "/elegant-floral-dress.png",
    styleType: "基础款",
    category: "裙装 / 半身裙",
    tags: ["甜美", "清新"],
    status: "已归档",
    spuCode: "SPU-2025-0788",
    phaseName: "已归档",
    progressDone: 10,
    progressTotal: 10,
    nextWorkItemName: "-",
    nextWorkItemStatus: "已完成",
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: "正常",
    owner: "张丽",
    updatedAt: "2025-12-10 10:00",
  },
  {
    id: "prj_20251216_008",
    code: "PRJ-20251216-008",
    name: "商务休闲西装外套",
    coverUrl: "/vintage-jacket-leather.jpg",
    styleType: "改版款",
    category: "外套 / 西装",
    tags: ["商务", "通勤"],
    status: "已终止",
    phaseName: "已终止",
    progressDone: 4,
    progressTotal: 12,
    nextWorkItemName: "-",
    nextWorkItemStatus: "已完成",
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: "正常",
    owner: "王明",
    updatedAt: "2025-12-08 15:00",
  },
  {
    id: "prj_20251216_009",
    code: "PRJ-20251216-009",
    name: "高腰阔腿牛仔裤",
    coverUrl: "/summer-shorts-denim.jpg",
    styleType: "基础款",
    category: "裤装 / 长裤",
    tags: ["休闲", "百搭"],
    status: "进行中",
    phaseName: "打样阶段",
    progressDone: 4,
    progressTotal: 12,
    nextWorkItemName: "样衣拍摄试穿",
    nextWorkItemStatus: "进行中",
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: "正常",
    owner: "李娜",
    updatedAt: "2025-12-14 11:20",
  },
  {
    id: "prj_20251216_010",
    code: "PRJ-20251216-010",
    name: "波西米亚印花长裙",
    coverUrl: "/elegant-floral-dress.png",
    styleType: "设计款",
    category: "裙装 / 长裙",
    tags: ["度假", "波西米亚"],
    status: "进行中",
    phaseName: "立项阶段",
    progressDone: 1,
    progressTotal: 12,
    nextWorkItemName: "商品项目立项",
    nextWorkItemStatus: "进行中",
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: "正常",
    owner: "周芳",
    updatedAt: "2025-12-16 09:00",
  },
]

const statusColors: Record<string, string> = {
  进行中: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  已终止: "bg-red-500/10 text-red-600 border-red-500/20",
  已归档: "bg-gray-500/10 text-gray-600 border-gray-500/20",
}

const styleTypeColors: Record<string, string> = {
  基础款: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  快时尚款: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  改版款: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  设计款: "bg-purple-500/10 text-purple-600 border-purple-500/20",
}

export default function ProjectListPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [searchTerm, setSearchTerm] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [terminateDialog, setTerminateDialog] = useState<{ open: boolean; projectId: string | null }>({
    open: false,
    projectId: null,
  })
  const [terminateReason, setTerminateReason] = useState("")

  const [sortBy, setSortBy] = useState<string>("updatedAt")

  const [quickFilters, setQuickFilters] = useState({
    styleType: "全部",
    status: "全部",
    pendingDecision: false,
    riskStatus: "全部",
  })

  const [advancedFilters, setAdvancedFilters] = useState({
    owner: "all",
    phase: "all",
    dateRange: "all",
  })

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredProjects = mockProjects
    .filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
        project.owner.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStyleType = quickFilters.styleType === "全部" || project.styleType === quickFilters.styleType
      const matchesStatus = quickFilters.status === "全部" || project.status === quickFilters.status
      const matchesPendingDecision = !quickFilters.pendingDecision || project.hasPendingDecision
      const matchesRisk = quickFilters.riskStatus === "全部" || project.riskStatus === quickFilters.riskStatus

      const matchesOwner = advancedFilters.owner === "all" || project.owner === advancedFilters.owner
      const matchesPhase = advancedFilters.phase === "all" || project.phaseName === advancedFilters.phase

      return (
        matchesSearch &&
        matchesStyleType &&
        matchesStatus &&
        matchesPendingDecision &&
        matchesRisk &&
        matchesOwner &&
        matchesPhase
      )
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "updatedAt":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case "pendingDecision":
          return (b.hasPendingDecision ? 1 : 0) - (a.hasPendingDecision ? 1 : 0)
        case "risk":
          return (b.riskStatus === "延期" ? 1 : 0) - (a.riskStatus === "延期" ? 1 : 0)
        case "progressLow":
          return a.progressDone / a.progressTotal - b.progressDone / b.progressTotal
        default:
          return 0
      }
    })

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage)
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const resetFilters = () => {
    setSearchTerm("")
    setQuickFilters({
      styleType: "全部",
      status: "全部",
      pendingDecision: false,
      riskStatus: "全部",
    })
    setAdvancedFilters({
      owner: "all",
      phase: "all",
      dateRange: "all",
    })
    setSortBy("updatedAt")
  }

  const toggleProjectSelection = (id: string) => {
    setSelectedProjects((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const handleTerminate = (projectId: string) => {
    setTerminateDialog({ open: true, projectId })
    setTerminateReason("")
  }

  const confirmTerminate = () => {
    toast.success("项目已终止")
    setTerminateDialog({ open: false, projectId: null })
    setTerminateReason("")
  }

  const copyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(code)
    toast.success("项目编码已复制")
  }

  const handleRowClick = (project: Project) => {
    toast.info(`正在跳转到项目详情: ${project.name}`)
    window.location.href = `/projects/${project.id}`
  }

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages)
      }
    }
    return pages
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <SystemNav />

        <div className="flex flex-1">
          <SidebarNav />

          <div className="flex-1 p-6 space-y-4">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">商品项目列表</h1>
                <p className="text-sm text-muted-foreground mt-1">管理所有商品立项与执行</p>
              </div>
              <div className="flex items-center gap-3">
                {selectedProjects.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">批量操作 ({selectedProjects.length})</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>批量导出</DropdownMenuItem>
                      <DropdownMenuItem>批量复制</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">批量删除</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Link href="/projects/new">
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    新建商品项目
                  </Button>
                </Link>
              </div>
            </div>

            {/* Toolbar Card */}
            <Card className="p-4">
              {/* Search row with sort dropdown */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索项目名称、编码或关键词"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="default" size="sm">
                  查询
                </Button>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px]">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updatedAt">最近更新</SelectItem>
                    <SelectItem value="pendingDecision">待决策优先</SelectItem>
                    <SelectItem value="risk">风险优先</SelectItem>
                    <SelectItem value="progressLow">进度最低优先</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    重置筛选
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="gap-1"
                  >
                    {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    高级筛选
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-6 flex-wrap">
                {/* Style Type */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">款式类型:</span>
                  <div className="flex gap-1">
                    {["全部", "基础款", "快时尚款", "改版款", "设计款"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setQuickFilters((prev) => ({ ...prev, styleType: type }))}
                        className={`px-3 py-1 rounded-md text-xs transition-all ${
                          quickFilters.styleType === type
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">状态:</span>
                  <div className="flex gap-1">
                    {["全部", "进行中", "已终止", "已归档"].map((status) => (
                      <button
                        key={status}
                        onClick={() => setQuickFilters((prev) => ({ ...prev, status: status }))}
                        className={`px-3 py-1 rounded-md text-xs transition-all ${
                          quickFilters.status === status
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pending Decision Toggle */}
                <button
                  onClick={() => setQuickFilters((prev) => ({ ...prev, pendingDecision: !prev.pendingDecision }))}
                  className={`px-3 py-1 rounded-md text-xs transition-all ${
                    quickFilters.pendingDecision
                      ? "bg-orange-500 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  待决策
                </button>

                {/* Risk Status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">风险:</span>
                  <div className="flex gap-1">
                    {["全部", "正常", "延期"].map((risk) => (
                      <button
                        key={risk}
                        onClick={() => setQuickFilters((prev) => ({ ...prev, riskStatus: risk }))}
                        className={`px-3 py-1 rounded-md text-xs transition-all ${
                          quickFilters.riskStatus === risk
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        }`}
                      >
                        {risk}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Advanced Filters Dialog-like section */}
              {showAdvancedFilters && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">负责人</Label>
                      <Select
                        value={advancedFilters.owner}
                        onValueChange={(value) => setAdvancedFilters({ ...advancedFilters, owner: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择负责人" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          <SelectItem value="张丽">张丽</SelectItem>
                          <SelectItem value="王明">王明</SelectItem>
                          <SelectItem value="李娜">李娜</SelectItem>
                          <SelectItem value="赵云">赵云</SelectItem>
                          <SelectItem value="周芳">周芳</SelectItem>
                          <SelectItem value="陈刚">陈刚</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">当前阶段</Label>
                      <Select
                        value={advancedFilters.phase}
                        onValueChange={(value) => setAdvancedFilters({ ...advancedFilters, phase: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择阶段" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          <SelectItem value="立项阶段">立项阶段</SelectItem>
                          <SelectItem value="打样阶段">打样阶段</SelectItem>
                          <SelectItem value="测款阶段">测款阶段</SelectItem>
                          <SelectItem value="工程准备">工程准备</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">最近更新范围</Label>
                      <Select
                        value={advancedFilters.dateRange}
                        onValueChange={(value) => setAdvancedFilters({ ...advancedFilters, dateRange: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择时间范围" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          <SelectItem value="today">今天</SelectItem>
                          <SelectItem value="week">最近一周</SelectItem>
                          <SelectItem value="month">最近一月</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* View Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                共 {filteredProjects.length} 个项目
                {filteredProjects.length > 0 &&
                  ` · 显示第 ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredProjects.length)} 项`}
              </div>
              <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-7 w-7 p-0"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-7 w-7 p-0"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-card border border-border rounded-lg shadow-sm">
              {viewMode === "list" ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground w-10">操作</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground min-w-[280px]">
                          项目名称
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">项目编码</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">款式类型</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">分类</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">风格</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">当前阶段</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground min-w-[180px]">
                          <div className="flex items-center gap-1">
                            项目进度
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="w-3 h-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>分母为该模板关键工作项总数（含决策闸口）</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">风险</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground">负责人</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                          <div className="flex items-center gap-1">
                            最近更新
                            <ArrowUpDown className="w-3 h-3" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProjects.map((project) => (
                        <tr
                          key={project.id}
                          className="border-b border-border hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => handleRowClick(project)}
                        >
                          {/* 操作列 */}
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/projects/${project.id}`} className="flex items-center">
                                      <Eye className="h-4 w-4 mr-2" />
                                      查看详情
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Copy className="h-4 w-4 mr-2" />
                                    复制项目
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleTerminate(project.id)}
                                    disabled={project.status !== "进行中"}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    终止项目
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled={project.status !== "进行中"}>
                                    <Archive className="h-4 w-4 mr-2" />
                                    归档项目
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <Image
                                src={project.coverUrl || "/placeholder.svg"}
                                alt={project.name}
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded object-cover"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground hover:underline truncate">
                                    {project.name}
                                  </span>
                                  <Badge variant="outline" className={`text-xs ${statusColors[project.status]}`}>
                                    {project.status}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {project.spuCode && `SPU: ${project.spuCode}  |  `}
                                  标签: {project.tags.join("、")}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 项目编码 + 复制按钮 */}
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-muted-foreground">{project.code}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => copyCode(project.code, e)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>

                          {/* 款式类型 */}
                          <td className="p-3">
                            <Badge variant="outline" className={`text-xs ${styleTypeColors[project.styleType]}`}>
                              {project.styleType}
                            </Badge>
                          </td>

                          {/* 分类 */}
                          <td className="p-3 text-sm text-foreground">{project.category}</td>

                          {/* 风格 */}
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {project.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{project.phaseName}</span>
                              {project.hasPendingDecision && (
                                <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
                                  待决策
                                </Badge>
                              )}
                              {project.isBlocked && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">阻塞</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{project.gateReason}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-muted rounded-full h-2">
                                  <div
                                    className="bg-primary h-2 rounded-full"
                                    style={{
                                      width: `${Math.round((project.progressDone / project.progressTotal) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {project.progressDone}/{project.progressTotal}
                                </span>
                              </div>
                              {project.nextWorkItemName !== "-" && (
                                <div className="text-xs text-muted-foreground">
                                  下一步: {project.nextWorkItemName}
                                  <span
                                    className={`ml-1 ${
                                      project.nextWorkItemStatus === "待决策"
                                        ? "text-orange-500"
                                        : project.nextWorkItemStatus === "进行中"
                                          ? "text-blue-500"
                                          : "text-muted-foreground"
                                    }`}
                                  >
                                    ({project.nextWorkItemStatus})
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            {project.riskStatus === "延期" ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="flex items-center gap-1 text-orange-500 hover:underline text-sm">
                                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                                    延期
                                    <span className="text-xs text-muted-foreground ml-1">查看</span>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64">
                                  <div className="space-y-2 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">延期原因: </span>
                                      <span>{project.riskReason}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">关联工作项: </span>
                                      <span>{project.riskWorkItem}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">已持续: </span>
                                      <span className="text-orange-500">{project.riskDurationDays}天</span>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <div className="flex items-center gap-1 text-green-500 text-sm">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                正常
                              </div>
                            )}
                          </td>

                          {/* 负责人 */}
                          <td className="p-3 text-sm text-foreground">{project.owner}</td>

                          {/* 最近更新 */}
                          <td className="p-3 text-sm text-muted-foreground">{project.updatedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Grid view (simplified)
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                  {paginatedProjects.map((project) => (
                    <Card
                      key={project.id}
                      className="overflow-hidden border-border hover:border-primary/50 transition-all cursor-pointer"
                      onClick={() => handleRowClick(project)}
                    >
                      <div className="relative">
                        <Image
                          src={project.coverUrl || "/placeholder.svg"}
                          alt={project.name}
                          width={300}
                          height={200}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <Badge className={`absolute top-3 left-3 ${statusColors[project.status]}`}>
                          {project.status}
                        </Badge>
                        {project.hasPendingDecision && (
                          <Badge className="absolute top-3 right-3 bg-orange-500 text-white">待决策</Badge>
                        )}
                        <div className="absolute bottom-3 left-3 right-3 text-white">
                          <h3 className="font-semibold text-lg">{project.name}</h3>
                          <p className="text-xs opacity-90">{project.code}</p>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-xs ${styleTypeColors[project.styleType]}`}>
                            {project.styleType}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {project.category}
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center justify-between mb-1">
                            <span>当前阶段</span>
                            <span className="text-foreground font-medium">{project.phaseName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>项目进度</span>
                            <span className="text-foreground font-medium">
                              {project.progressDone}/{project.progressTotal}
                            </span>
                          </div>
                        </div>

                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.round((project.progressDone / project.progressTotal) * 100)}%`,
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                          <div className="flex items-center gap-2">
                            {project.riskStatus === "延期" && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                            <span className="text-muted-foreground">{project.owner}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{project.updatedAt}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  显示 {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, filteredProjects.length)} 条，共 {filteredProjects.length} 条
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {getPageNumbers().map((page, index) =>
                    typeof page === "number" ? (
                      <Button
                        key={index}
                        variant={currentPage === page ? "default" : "outline"}
                        size="icon"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ) : (
                      <span key={index} className="px-2 text-muted-foreground">
                        {page}
                      </span>
                    ),
                  )}

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terminate Dialog */}
        <Dialog open={terminateDialog.open} onOpenChange={(open) => setTerminateDialog({ open, projectId: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>终止项目</DialogTitle>
              <DialogDescription>请说明终止项目的原因，此操作将记录在项目日志中。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="请输入终止原因..."
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTerminateDialog({ open: false, projectId: null })}>
                取消
              </Button>
              <Button variant="destructive" onClick={confirmTerminate} disabled={!terminateReason.trim()}>
                确认终止
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
