"use client"

import { useState } from "react"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Filter, ExternalLink, Package, CheckCircle, AlertTriangle, Clock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

// Mock data
const mockTasks = [
  {
    id: "FS-20260109-005",
    title: "首单打样-碎花连衣裙",
    status: "IN_QC",
    milestone: "验收中",
    project: { code: "PRJ-20260105-001", name: "印尼风格碎花连衣裙" },
    source: { type: "制版", code: "PT-20260109-002", version: "P1" },
    factory: "JKT-Factory-03",
    targetSite: "雅加达",
    expectedArrival: "2026-01-12",
    trackingNo: "JNE-884392001",
    arrivedAt: "2026-01-12 15:20",
    stockedInAt: "2026-01-12 17:05",
    sample: { code: "SY-JKT-00021", name: "碎花连衣裙-P1A1" },
    acceptanceResult: "需改版",
    owner: "王版师",
    isOverdue: false,
  },
  {
    id: "FS-20260108-003",
    title: "首单打样-基础白T恤",
    status: "ARRIVED",
    milestone: "已到样待入库",
    project: { code: "PRJ-20260103-008", name: "基础款白色T恤" },
    source: { type: "制版", code: "PT-20260108-001", version: "P2" },
    factory: "SZ-Factory-01",
    targetSite: "深圳",
    expectedArrival: "2026-01-10",
    trackingNo: "SF-772819340",
    arrivedAt: "2026-01-10 09:15",
    stockedInAt: null,
    sample: null,
    acceptanceResult: null,
    owner: "李版师",
    isOverdue: false,
  },
  {
    id: "FS-20260107-001",
    title: "首单打样-波西米亚半身裙",
    status: "IN_PROGRESS",
    milestone: "在途",
    project: { code: "PRJ-20260105-002", name: "波西米亚风格半身裙" },
    source: { type: "花型", code: "AT-20260106-005", version: "A3" },
    factory: "JKT-Factory-02",
    targetSite: "雅加达",
    expectedArrival: "2026-01-11",
    trackingNo: "JNE-991024832",
    arrivedAt: null,
    stockedInAt: null,
    sample: null,
    acceptanceResult: null,
    owner: "张花型师",
    isOverdue: true,
  },
  {
    id: "FS-20260106-012",
    title: "首单打样-牛仔夹克",
    status: "COMPLETED",
    milestone: "已完成",
    project: { code: "PRJ-20260102-005", name: "复古牛仔夹克" },
    source: { type: "制版", code: "PT-20260105-008", version: "P1" },
    factory: "SZ-Factory-02",
    targetSite: "深圳",
    expectedArrival: "2026-01-08",
    trackingNo: "SF-661728492",
    arrivedAt: "2026-01-08 14:30",
    stockedInAt: "2026-01-08 16:20",
    sample: { code: "SY-SZ-00157", name: "牛仔夹克-P1" },
    acceptanceResult: "通过",
    owner: "赵版师",
    isOverdue: false,
  },
]

export default function FirstSampleMakingPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [siteFilter, setSiteFilter] = useState("all")
  const [ownerFilter, setOwnerFilter] = useState("all")
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [stockInDialogOpen, setStockInDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<(typeof mockTasks)[0] | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  // KPI statistics
  const kpiStats = {
    inTransit: mockTasks.filter((t) => t.milestone === "在途").length,
    arrivedPending: mockTasks.filter((t) => t.milestone === "已到样待入库").length,
    inQc: mockTasks.filter((t) => t.milestone === "验收中").length,
    overdue: mockTasks.filter((t) => t.isOverdue).length,
  }

  const filteredTasks = mockTasks.filter((task) => {
    if (searchTerm && !task.id.includes(searchTerm) && !task.title.includes(searchTerm)) return false
    if (statusFilter !== "all" && task.status !== statusFilter) return false
    if (siteFilter !== "all" && task.targetSite !== siteFilter) return false
    if (ownerFilter !== "all" && task.owner !== ownerFilter) return false
    if (activeKpiFilter === "inTransit" && task.milestone !== "在途") return false
    if (activeKpiFilter === "arrivedPending" && task.milestone !== "已到样待入库") return false
    if (activeKpiFilter === "inQc" && task.milestone !== "验收中") return false
    if (activeKpiFilter === "overdue" && !task.isOverdue) return false
    return true
  })

  const handleReceipt = (task: (typeof mockTasks)[0]) => {
    setSelectedTask(task)
    setReceiptDialogOpen(true)
  }

  const handleStockIn = (task: (typeof mockTasks)[0]) => {
    setSelectedTask(task)
    setStockInDialogOpen(true)
  }

  const handleSubmitReceipt = () => {
    toast({ title: "到样签收成功", description: "已写入台账事件：到样签收" })
    setReceiptDialogOpen(false)
  }

  const handleSubmitStockIn = () => {
    toast({ title: "核对入库成功", description: "已创建样衣资产并写入台账事件：核对入库" })
    setStockInDialogOpen(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="border-b bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">首单样衣打样</h1>
                <p className="text-sm text-gray-500 mt-1">管理首单样衣打样任务，跟踪物流与验收闭环</p>
              </div>
              <Button onClick={() => setCreateDrawerOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                新建首单打样
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Filter Bar */}
            <div className="bg-white rounded-lg border p-4 space-y-4">
              <div className="grid grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索任务编号/项目/款号/工厂/运单号..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="IN_PROGRESS">进行中</SelectItem>
                    <SelectItem value="ARRIVED">已到样待入库</SelectItem>
                    <SelectItem value="IN_QC">验收中</SelectItem>
                    <SelectItem value="COMPLETED">已完成</SelectItem>
                    <SelectItem value="BLOCKED">阻塞</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={siteFilter} onValueChange={setSiteFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="目标站点" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部站点</SelectItem>
                    <SelectItem value="深圳">深圳</SelectItem>
                    <SelectItem value="雅加达">雅加达</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="负责人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="王版师">王版师</SelectItem>
                    <SelectItem value="李版师">李版师</SelectItem>
                    <SelectItem value="张花型师">张花型师</SelectItem>
                    <SelectItem value="赵版师">赵版师</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("")
                      setStatusFilter("all")
                      setSiteFilter("all")
                      setOwnerFilter("all")
                      setActiveKpiFilter(null)
                    }}
                  >
                    重置
                  </Button>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    高级
                  </Button>
                </div>
              </div>
            </div>

            {/* KPI Quick Filters */}
            <div className="grid grid-cols-4 gap-4">
              <button
                onClick={() => setActiveKpiFilter(activeKpiFilter === "inTransit" ? null : "inTransit")}
                className={`bg-white rounded-lg border p-4 text-left hover:shadow-md transition-shadow ${activeKpiFilter === "inTransit" ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">在途</span>
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiStats.inTransit}</div>
              </button>
              <button
                onClick={() => setActiveKpiFilter(activeKpiFilter === "arrivedPending" ? null : "arrivedPending")}
                className={`bg-white rounded-lg border p-4 text-left hover:shadow-md transition-shadow ${activeKpiFilter === "arrivedPending" ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">已到样待入库</span>
                  <Package className="h-4 w-4 text-orange-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiStats.arrivedPending}</div>
              </button>
              <button
                onClick={() => setActiveKpiFilter(activeKpiFilter === "inQc" ? null : "inQc")}
                className={`bg-white rounded-lg border p-4 text-left hover:shadow-md transition-shadow ${activeKpiFilter === "inQc" ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">验收中</span>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiStats.inQc}</div>
              </button>
              <button
                onClick={() => setActiveKpiFilter(activeKpiFilter === "overdue" ? null : "overdue")}
                className={`bg-white rounded-lg border p-4 text-left hover:shadow-md transition-shadow ${activeKpiFilter === "overdue" ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">超期</span>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiStats.overdue}</div>
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">任务</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态/里程碑</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">项目</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">工厂/外协</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">目标站点</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">预计到样</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">运单</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">到样时间</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">入库时间</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">样衣</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">验收结论</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => router.push(`/samples/first-order/${task.id}`)}
                            className="font-medium text-blue-600 hover:text-blue-800 text-sm"
                          >
                            {task.id}
                          </button>
                          <div className="text-xs text-gray-600 mt-0.5">{task.title}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              task.milestone === "在途"
                                ? "bg-blue-100 text-blue-800"
                                : task.milestone === "已到样待入库"
                                  ? "bg-orange-100 text-orange-800"
                                  : task.milestone === "验收中"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : task.milestone === "已完成"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                            }
                          >
                            {task.milestone}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{task.project.code}</div>
                          <div className="text-xs text-gray-500">{task.project.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{task.source.type}</div>
                          <div className="text-xs text-blue-600">
                            {task.source.code} ({task.source.version})
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{task.factory}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{task.targetSite}</td>
                        <td className="px-4 py-3">
                          <div className={`text-sm ${task.isOverdue ? "text-red-600 font-medium" : "text-gray-900"}`}>
                            {task.expectedArrival}
                          </div>
                          {task.isOverdue && (
                            <Badge variant="destructive" className="text-xs mt-1">
                              超期
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {task.trackingNo ? (
                            <button className="text-sm text-blue-600 hover:text-blue-800 font-mono">
                              {task.trackingNo}
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{task.arrivedAt || "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{task.stockedInAt || "-"}</td>
                        <td className="px-4 py-3">
                          {task.sample ? (
                            <button className="text-sm text-blue-600 hover:text-blue-800">{task.sample.code}</button>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {task.acceptanceResult ? (
                            <Badge
                              className={
                                task.acceptanceResult === "通过"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-orange-100 text-orange-800"
                              }
                            >
                              {task.acceptanceResult}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/samples/first-order/${task.id}`)}
                            >
                              查看
                            </Button>
                            {task.milestone === "在途" && (
                              <Button size="sm" variant="outline" onClick={() => handleReceipt(task)}>
                                到样签收
                              </Button>
                            )}
                            {task.milestone === "已到样待入库" && (
                              <Button size="sm" variant="outline" onClick={() => handleStockIn(task)}>
                                核对入库
                              </Button>
                            )}
                            {task.sample && (
                              <Button size="sm" variant="ghost">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <div className="text-sm text-gray-500">共 {filteredTasks.length} 条</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled>
                    上一页
                  </Button>
                  <Button variant="outline" size="sm" className="bg-blue-600 text-white">
                    1
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    下一页
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Create Drawer */}
      <Sheet open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>新建首单样衣打样</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>标题 *</Label>
                  <Input placeholder="首单打样-款号/项目名" />
                </div>
                <div>
                  <Label>负责人 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择负责人" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wang">王版师</SelectItem>
                      <SelectItem value="li">李版师</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>优先级</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择优先级" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>预计到样</Label>
                  <Input type="date" />
                </div>
              </div>
            </div>

            {/* 来源与绑定 */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">来源与绑定</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>项目 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择项目" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prj1">PRJ-20260105-001 印尼风格碎花连衣裙</SelectItem>
                      <SelectItem value="prj2">PRJ-20260103-008 基础款白色T恤</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>来源类型 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择来源" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pattern">来自制版</SelectItem>
                      <SelectItem value="artwork">来自花型</SelectItem>
                      <SelectItem value="revision">来自改版</SelectItem>
                      <SelectItem value="manual">人工创建</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>上游实例（条件必填）</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择上游实例" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt1">PT-20260109-002 制版-印尼碎花连衣裙(P1)</SelectItem>
                      <SelectItem value="at1">AT-20260106-005 花型-波西米亚印花(A3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 打样对象与交期 */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">打样对象与交期</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>工厂/外协 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择工厂" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jkt1">JKT-Factory-01</SelectItem>
                      <SelectItem value="jkt2">JKT-Factory-02</SelectItem>
                      <SelectItem value="jkt3">JKT-Factory-03</SelectItem>
                      <SelectItem value="sz1">SZ-Factory-01</SelectItem>
                      <SelectItem value="sz2">SZ-Factory-02</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>期望发货时间</Label>
                  <Input type="date" />
                </div>
                <div className="col-span-2">
                  <Label>打样要求</Label>
                  <Textarea placeholder="面料、工艺、注意事项等" />
                </div>
              </div>
            </div>

            {/* 输入包 */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">输入包（至少一个）</h3>
              <div className="space-y-2">
                <div>
                  <Label>制版包</Label>
                  <div className="flex gap-2 mt-1">
                    <Input placeholder="引用制版包" className="flex-1" />
                    <Button variant="outline" size="sm">
                      选择
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>花型包</Label>
                  <div className="flex gap-2 mt-1">
                    <Input placeholder="引用花型包" className="flex-1" />
                    <Button variant="outline" size="sm">
                      选择
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>其他附件</Label>
                  <Button variant="outline" size="sm" className="mt-1 bg-transparent">
                    上传附件
                  </Button>
                </div>
              </div>
            </div>

            {/* 目标站点与收货信息 */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">目标站点与收货信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>目标站点 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择站点" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sz">深圳</SelectItem>
                      <SelectItem value="jkt">雅加达</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>收货联系人</Label>
                  <Input placeholder="默认：站点仓管" />
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setCreateDrawerOpen(false)}>
                取消
              </Button>
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => {
                  toast({ title: "已保存草稿" })
                  setCreateDrawerOpen(false)
                }}
              >
                保存草稿
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  toast({ title: "创建成功", description: "首单打样任务已创建并开始" })
                  setCreateDrawerOpen(false)
                }}
              >
                创建并开始
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Receipt Dialog (FS4-A) */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>到样签收</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>签收站点（只读）</Label>
              <Input value={selectedTask?.targetSite || ""} disabled />
            </div>
            <div>
              <Label>签收时间 *</Label>
              <Input type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
            </div>
            <div>
              <Label>包裹照片/回执附件</Label>
              <Button variant="outline" size="sm">
                上传附件
              </Button>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setReceiptDialogOpen(false)}>
                取消
              </Button>
              <Button className="flex-1" onClick={handleSubmitReceipt}>
                确认签收
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock-in Dialog (FS4-B) */}
      <Dialog open={stockInDialogOpen} onOpenChange={setStockInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>核对入库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>仓库 *</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择仓库" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sz-main">深圳主仓</SelectItem>
                  <SelectItem value="jkt-main">雅加达主仓</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>库位 *</Label>
              <Input placeholder="输入库位编号" />
            </div>
            <div>
              <Label>样衣编号（系统生成）</Label>
              <Input value="SY-SZ-00158" disabled />
            </div>
            <div>
              <Label>初检结果</Label>
              <Select defaultValue="pass">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">合格</SelectItem>
                  <SelectItem value="fail">不合格</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>入库照片</Label>
              <Button variant="outline" size="sm">
                上传照片
              </Button>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStockInDialogOpen(false)}>
                取消
              </Button>
              <Button className="flex-1" onClick={handleSubmitStockIn}>
                提交入库
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
