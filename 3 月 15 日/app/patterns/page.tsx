"use client"

import { useState } from "react"
import Link from "next/link"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, Download, Plus, Eye, Play, Send, LinkIcon, Upload, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const mockTasks = [
  {
    id: "PT-20260109-002",
    instance_code: "PT-20260109-002",
    title: "制版-印尼碎花连衣裙(P1)",
    status: "APPROVED",
    project_ref: { id: "PRJ-20251216-001", name: "印尼风格碎花连衣裙" },
    source_type: "改版任务",
    upstream_instance_ref: { id: "RT-20260109-003", title: "V领印花改版" },
    product_ref: { id: "SPU-001", name: "碎花连衣裙", spu: "DRS-001" },
    pattern_type: "连衣裙",
    size_range: "S-XL",
    owner: "王版师",
    due_at: "2026-01-15",
    pattern_version: "P1",
    downstream_count: 2,
    updated_at: "2026-01-09 14:30",
    priority: "高",
    participants: ["张工", "李工"],
  },
  {
    id: "PT-20260109-001",
    instance_code: "PT-20260109-001",
    title: "制版-基础款白T恤",
    status: "IN_PROGRESS",
    project_ref: { id: "PRJ-20251216-002", name: "基础款白色T恤" },
    source_type: "项目模板阶段",
    product_ref: { id: "SPU-002", name: "白T恤", spu: "TSH-001" },
    pattern_type: "上衣",
    size_range: "XS-XXL",
    owner: "李版师",
    due_at: "2026-01-12",
    pattern_version: "-",
    downstream_count: 0,
    updated_at: "2026-01-09 10:00",
    priority: "中",
    participants: [],
  },
  {
    id: "PT-20260108-005",
    instance_code: "PT-20260108-005",
    title: "制版-牛仔短裤放码",
    status: "PENDING_REVIEW",
    project_ref: { id: "PRJ-20251215-003", name: "夏季牛仔短裤" },
    source_type: "既有商品二次开发",
    product_ref: { id: "SPU-003", name: "牛仔短裤", spu: "SHO-003" },
    pattern_type: "裤装",
    size_range: "26-34",
    owner: "张版师",
    due_at: "2026-01-10",
    pattern_version: "-",
    downstream_count: 0,
    updated_at: "2026-01-08 16:45",
    priority: "高",
    participants: ["王工"],
  },
  {
    id: "PT-20260107-012",
    instance_code: "PT-20260107-012",
    title: "制版-羽绒外套(P2)",
    status: "APPROVED",
    project_ref: { id: "PRJ-20251210-008", name: "冬季羽绒外套" },
    source_type: "改版任务",
    upstream_instance_ref: { id: "RT-20260105-008", title: "袖长调整" },
    product_ref: { id: "SPU-008", name: "羽绒外套", spu: "JKT-008" },
    pattern_type: "外套",
    size_range: "S-XXXL",
    owner: "陈版师",
    due_at: "2026-01-08",
    pattern_version: "P2",
    downstream_count: 3,
    updated_at: "2026-01-07 18:00",
    priority: "中",
    participants: ["李工", "赵工"],
  },
  {
    id: "PT-20260106-008",
    instance_code: "PT-20260106-008",
    title: "制版-休闲衬衫",
    status: "NOT_STARTED",
    project_ref: { id: "PRJ-20251212-006", name: "商务休闲衬衫" },
    source_type: "项目模板阶段",
    product_ref: null,
    pattern_type: "上衣",
    size_range: "38-44",
    owner: "赵版师",
    due_at: "2026-01-18",
    pattern_version: "-",
    downstream_count: 0,
    updated_at: "2026-01-06 09:15",
    priority: "低",
    participants: [],
  },
  {
    id: "PT-20260105-003",
    instance_code: "PT-20260105-003",
    title: "制版-波西米亚长裙",
    status: "BLOCKED",
    project_ref: { id: "PRJ-20251213-005", name: "波西米亚风长裙" },
    source_type: "改版任务",
    upstream_instance_ref: { id: "RT-20260103-015", title: "腰线调整" },
    product_ref: { id: "SPU-005", name: "波西米亚长裙", spu: "DRS-005" },
    pattern_type: "连衣裙",
    size_range: "S-L",
    owner: "刘版师",
    due_at: "2026-01-09",
    pattern_version: "-",
    downstream_count: 0,
    updated_at: "2026-01-05 14:20",
    priority: "高",
    participants: ["王工"],
  },
]

const statusOptions = [
  { value: "all", label: "全部" },
  { value: "NOT_STARTED", label: "未开始" },
  { value: "IN_PROGRESS", label: "进行中" },
  { value: "PENDING_REVIEW", label: "待评审" },
  { value: "APPROVED", label: "已确认" },
  { value: "COMPLETED", label: "已完成" },
  { value: "BLOCKED", label: "阻塞" },
  { value: "CANCELLED", label: "已取消" },
]

const sourceTypeOptions = [
  { value: "all", label: "全部" },
  { value: "改版任务", label: "改版任务" },
  { value: "项目模板阶段", label: "项目模板阶段" },
  { value: "既有商品二次开发", label: "既有商品二次开发" },
]

const siteOptions = [
  { value: "all", label: "全部" },
  { value: "深圳", label: "深圳" },
  { value: "雅加达", label: "雅加达" },
]

export default function PatternTaskListPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [ownerFilter, setOwnerFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [siteFilter, setSiteFilter] = useState("all")
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [kpiFilter, setKpiFilter] = useState("all")
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [downstreamDialogOpen, setDownstreamDialogOpen] = useState(false)
  const pageSize = 10

  const filteredTasks = mockTasks.filter((task) => {
    const matchSearch =
      searchQuery === "" ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.instance_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.project_ref.name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchStatus = statusFilter === "all" || task.status === statusFilter
    const matchOwner = ownerFilter === "all" || task.owner === ownerFilter
    const matchSource = sourceFilter === "all" || task.source_type === sourceFilter
    const matchSite = siteFilter === "all"

    // KPI filters
    if (kpiFilter === "mine") return task.owner === "王版师" && matchSearch && matchStatus
    if (kpiFilter === "pending_review") return task.status === "PENDING_REVIEW" && matchSearch
    if (kpiFilter === "frozen_no_downstream")
      return task.status === "APPROVED" && task.downstream_count === 0 && matchSearch
    if (kpiFilter === "blocked") return task.status === "BLOCKED" && matchSearch
    if (kpiFilter === "overdue") {
      const dueDate = new Date(task.due_at)
      const today = new Date()
      return dueDate < today && task.status !== "COMPLETED" && matchSearch
    }

    return matchSearch && matchStatus && matchOwner && matchSource && matchSite
  })

  const totalPages = Math.ceil(filteredTasks.length / pageSize)
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      NOT_STARTED: { label: "未开始", className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
      IN_PROGRESS: { label: "进行中", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      PENDING_REVIEW: { label: "待评审", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
      APPROVED: { label: "已确认", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      COMPLETED: { label: "已完成", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
      BLOCKED: { label: "阻塞", className: "bg-red-500/20 text-red-400 border-red-500/30" },
      CANCELLED: { label: "已取消", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    }
    return map[status] || { label: status, className: "bg-muted text-muted-foreground" }
  }

  const getRowActions = (status: string) => {
    const actions = {
      view: true,
      start: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"].includes(status),
      submit_review: status === "IN_PROGRESS",
      approve: status === "PENDING_REVIEW",
      reject: status === "PENDING_REVIEW",
      create_downstream: ["APPROVED", "COMPLETED"].includes(status),
      complete: status === "APPROVED",
      block: !["COMPLETED", "CANCELLED"].includes(status),
      cancel: ["NOT_STARTED", "IN_PROGRESS"].includes(status),
    }
    return actions
  }

  const handleAction = (action: string, taskId: string) => {
    toast({ title: `执行操作: ${action}`, description: `任务ID: ${taskId}` })
  }

  const handleBatchAction = (action: string) => {
    toast({ title: `批量操作: ${action}`, description: `已选择 ${selectedTasks.length} 个任务` })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">制版任务</h1>
              <p className="text-sm text-muted-foreground mt-1">
                将设计/改版方案转化为可生产的纸样/版型/规格成果，输出制版包并驱动下游打样/放码/工艺/BOM等工作
              </p>
            </div>
            <Sheet open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
              <SheetTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  新建制版任务
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[600px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>新建制版任务</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  {/* Section 1: Basic Info */}
                  <div className="space-y-4">
                    <h3 className="font-medium">基本信息</h3>
                    <div className="space-y-2">
                      <Label>标题 *</Label>
                      <Input placeholder="制版-{{款号/项目名}}" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>优先级</Label>
                        <Select defaultValue="中">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="低">低</SelectItem>
                            <SelectItem value="中">中</SelectItem>
                            <SelectItem value="高">高</SelectItem>
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
                            <SelectItem value="王版师">王版师</SelectItem>
                            <SelectItem value="李版师">李版师</SelectItem>
                            <SelectItem value="张版师">张版师</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>参与人</Label>
                        <Input placeholder="多人用逗号分隔" />
                      </div>
                      <div className="space-y-2">
                        <Label>截止时间</Label>
                        <Input type="date" />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Source & Binding */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium">来源与绑定</h3>
                    <div className="space-y-2">
                      <Label>来源类型 *</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="选择来源" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="改版任务">改版任务</SelectItem>
                          <SelectItem value="项目模板阶段">项目模板阶段</SelectItem>
                          <SelectItem value="既有商品二次开发">既有商品二次开发</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>商品项目 *</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="选择项目" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRJ-001">印尼风格碎花连衣裙</SelectItem>
                          <SelectItem value="PRJ-002">基础款白色T恤</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>上游实例 (条件必填)</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="改版来源建议必填" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RT-001">V领印花改版</SelectItem>
                          <SelectItem value="RT-002">袖长调整</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>商品引用 (可选)</Label>
                      <Input placeholder="款号/SPU (既有商品二次开发时建议必填)" />
                    </div>
                  </div>

                  {/* Section 3: Pattern Input */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium">制版输入（参考资料）</h3>
                    <div className="space-y-2">
                      <Label>设计稿/改版包/尺寸意向</Label>
                      <div className="border-2 border-dashed rounded-lg p-4 text-center">
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">点击或拖拽上传附件</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>参考版型</Label>
                      <Input placeholder="引用历史纸样/历史商品" />
                    </div>
                    <div className="space-y-2">
                      <Label>约束条件</Label>
                      <Textarea placeholder="目标成本/面料限制/工艺限制" rows={3} />
                    </div>
                  </div>

                  {/* Section 4: Related Samples */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium">关联样衣（可选）</h3>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">选择需要测量/试穿的样衣</p>
                      <Button variant="outline" size="sm">
                        选择样衣
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="measure" />
                      <Label htmlFor="measure" className="font-normal">
                        需要测量/试穿
                      </Label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1 bg-transparent"
                      onClick={() => setCreateDrawerOpen(false)}
                    >
                      保存草稿
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        toast({ title: "创建成功", description: "制版任务已创建并开始" })
                        setCreateDrawerOpen(false)
                      }}
                    >
                      创建并开始
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="bg-card border rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="任务编号/标题/项目/款号/SPU/SKU/样衣编号"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="负责人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="me">我</SelectItem>
                  <SelectItem value="王版师">王版师</SelectItem>
                  <SelectItem value="李版师">李版师</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="来源" />
                </SelectTrigger>
                <SelectContent>
                  {sourceTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="站点" />
                </SelectTrigger>
                <SelectContent>
                  {siteOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("all")
                  setOwnerFilter("all")
                  setSourceFilter("all")
                  setSiteFilter("all")
                  setKpiFilter("all")
                }}
              >
                重置
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {[
              { value: "all", label: "全部", count: mockTasks.length },
              { value: "mine", label: "我的", count: mockTasks.filter((t) => t.owner === "王版师").length },
              {
                value: "pending_review",
                label: "待评审",
                count: mockTasks.filter((t) => t.status === "PENDING_REVIEW").length,
              },
              {
                value: "frozen_no_downstream",
                label: "已冻结未建下游",
                count: mockTasks.filter((t) => t.status === "APPROVED" && t.downstream_count === 0).length,
              },
              { value: "blocked", label: "阻塞", count: mockTasks.filter((t) => t.status === "BLOCKED").length },
              { value: "overdue", label: "超期", count: 1 },
            ].map((kpi) => (
              <Button
                key={kpi.value}
                size="sm"
                variant={kpiFilter === kpi.value ? "default" : "outline"}
                onClick={() => setKpiFilter(kpi.value)}
                className="gap-2"
              >
                {kpi.label}
                <Badge variant="secondary" className="ml-1">
                  {kpi.count}
                </Badge>
              </Button>
            ))}
          </div>

          {selectedTasks.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-foreground">已选择 {selectedTasks.length} 个任务</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBatchAction("批量分派")}>
                  批量分派
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBatchAction("批量设置截止")}>
                  批量截止
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBatchAction("批量阻塞")}>
                  批量阻塞
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBatchAction("导出")}>
                  <Download className="w-4 h-4 mr-1" />
                  导出
                </Button>
              </div>
            </div>
          )}

          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTasks.length === paginatedTasks.length && paginatedTasks.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTasks(paginatedTasks.map((t) => t.id))
                          } else {
                            setSelectedTasks([])
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>任务</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead>版型类型</TableHead>
                    <TableHead>目标尺码段</TableHead>
                    <TableHead>负责人</TableHead>
                    <TableHead>截止时间</TableHead>
                    <TableHead>制版版本</TableHead>
                    <TableHead>下游任务</TableHead>
                    <TableHead>最近更新</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTasks.map((task) => {
                    const statusInfo = getStatusBadge(task.status)
                    const actions = getRowActions(task.status)
                    return (
                      <TableRow key={task.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Checkbox
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTasks([...selectedTasks, task.id])
                              } else {
                                setSelectedTasks(selectedTasks.filter((id) => id !== task.id))
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/patterns/detail/${task.id}`}
                            className="text-primary hover:underline font-medium text-sm"
                          >
                            {task.instance_code}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">{task.title}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusInfo.className} border`}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/projects/${task.project_ref.id}`}
                            className="text-primary hover:underline text-sm"
                          >
                            {task.project_ref.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{task.source_type}</TableCell>
                        <TableCell>
                          {task.product_ref ? (
                            <div>
                              <p className="text-sm">{task.product_ref.name}</p>
                              <p className="text-xs text-muted-foreground">{task.product_ref.spu}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{task.pattern_type}</TableCell>
                        <TableCell className="text-sm">{task.size_range}</TableCell>
                        <TableCell className="text-sm">{task.owner}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{task.due_at}</TableCell>
                        <TableCell>
                          {task.pattern_version === "-" ? (
                            <span className="text-muted-foreground text-sm">-</span>
                          ) : (
                            <Badge variant="secondary" className="font-mono">
                              {task.pattern_version}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.downstream_count > 0 ? (
                            <Badge variant="outline">{task.downstream_count}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{task.updated_at}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {actions.view && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => (window.location.href = `/patterns/detail/${task.id}`)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            {actions.start && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleAction("开始", task.id)}
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                            )}
                            {actions.submit_review && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleAction("提交评审", task.id)}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                            {actions.create_downstream && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setDownstreamDialogOpen(true)
                                }}
                              >
                                <LinkIcon className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="border-t p-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                共 {filteredTasks.length} 条，当前第 {currentPage} / {totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    size="sm"
                    variant={currentPage === page ? "default" : "outline"}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={downstreamDialogOpen} onOpenChange={setDownstreamDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>创建下游任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">根据验收标准/规格表/放码需求，系统建议创建以下下游任务：</p>
            <div className="space-y-2">
              {[
                { value: "sample_order", label: "首单样衣打样", recommended: true },
                { value: "grading", label: "放码任务", recommended: true },
                { value: "process", label: "工艺单任务", recommended: false },
                { value: "bom", label: "BOM任务", recommended: false },
                { value: "pattern_design", label: "花型任务", recommended: false },
              ].map((task) => (
                <div key={task.value} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Checkbox id={task.value} defaultChecked={task.recommended} />
                  <Label htmlFor={task.value} className="flex-1 font-normal">
                    {task.label}
                    {task.recommended && (
                      <Badge variant="secondary" className="ml-2">
                        建议
                      </Badge>
                    )}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => setDownstreamDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  toast({
                    title: "下游任务已创建",
                    description: "已自动关联项目和上游实例，默认负责人已配置",
                  })
                  setDownstreamDialogOpen(false)
                }}
              >
                确认创建
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
