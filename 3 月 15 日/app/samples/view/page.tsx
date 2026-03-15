"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  Search,
  RefreshCw,
  LayoutGrid,
  Columns3,
  List,
  MoreHorizontal,
  FileText,
  Package,
  Send,
  Download,
  Printer,
  Eye,
  Copy,
  AlertTriangle,
  Clock,
  MapPin,
  User,
  Calendar,
  Truck,
} from "lucide-react"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"

// Mock数据 - 12个样衣
const mockSamples = [
  {
    id: "SA-2025-00001",
    code: "SA-2025-00001",
    name: "印尼风格碎花连衣裙",
    coverImage: "/red-floral-dress.png",
    responsibleSite: "深圳",
    inventoryStatus: "在库",
    availability: "可用",
    availabilityReason: null,
    locationType: "warehouse",
    locationDisplay: "深圳仓-A区-01-03",
    custodianDisplay: null,
    expectedReturnAt: null,
    eta: null,
    riskFlags: [],
    projectRef: "PRJ-20251216-001",
    workItemRef: "WI-立项-001",
    lastEventTime: "2025-01-08 14:30:00",
    lastEventType: "入库",
  },
  {
    id: "SA-2025-00002",
    code: "SA-2025-00002",
    name: "波西米亚风蓝色半裙",
    coverImage: "/blue-bohemian-skirt.jpg",
    responsibleSite: "深圳",
    inventoryStatus: "预占",
    availability: "不可用",
    availabilityReason: "已被直播测款预占",
    locationType: "warehouse",
    locationDisplay: "深圳仓-A区-02-05",
    custodianDisplay: null,
    expectedReturnAt: "2025-01-15",
    eta: null,
    riskFlags: [],
    projectRef: "PRJ-20251216-002",
    workItemRef: "WI-测款-002",
    lastEventTime: "2025-01-07 10:20:00",
    lastEventType: "预占",
  },
  {
    id: "SA-2025-00003",
    code: "SA-2025-00003",
    name: "基础款白色T恤",
    coverImage: "/white-tshirt.png",
    responsibleSite: "深圳",
    inventoryStatus: "借出",
    availability: "不可用",
    availabilityReason: "已借出给主播A",
    locationType: "external",
    locationDisplay: "外部保管-主播A",
    custodianDisplay: "主播A（张丽）",
    expectedReturnAt: "2025-01-10",
    eta: null,
    riskFlags: ["超期未归还"],
    projectRef: "PRJ-20251216-003",
    workItemRef: "WI-直播-003",
    lastEventTime: "2025-01-05 09:00:00",
    lastEventType: "借出",
  },
  {
    id: "SA-2025-00004",
    code: "SA-2025-00004",
    name: "牛仔短裤夏季款",
    coverImage: "/denim-shorts.png",
    responsibleSite: "雅加达",
    inventoryStatus: "在途",
    availability: "不可用",
    availabilityReason: "在途中",
    locationType: "in_transit",
    locationDisplay: "深圳→雅加达",
    custodianDisplay: null,
    expectedReturnAt: null,
    eta: "2025-01-12",
    riskFlags: ["在途超时"],
    projectRef: "PRJ-20251216-004",
    workItemRef: null,
    lastEventTime: "2025-01-06 16:45:00",
    lastEventType: "发出",
  },
  {
    id: "SA-2025-00005",
    code: "SA-2025-00005",
    name: "米色针织开衫",
    coverImage: "/beige-cardigan.jpg",
    responsibleSite: "深圳",
    inventoryStatus: "冻结",
    availability: "不可用",
    availabilityReason: "质量问题冻结",
    locationType: "warehouse",
    locationDisplay: "深圳仓-B区-03-01",
    custodianDisplay: null,
    expectedReturnAt: null,
    eta: null,
    riskFlags: ["冻结"],
    projectRef: "PRJ-20251216-005",
    workItemRef: "WI-质检-005",
    lastEventTime: "2025-01-04 11:30:00",
    lastEventType: "冻结",
  },
  {
    id: "SA-2025-00006",
    code: "SA-2025-00006",
    name: "黑色西装外套",
    coverImage: "/black-blazer.jpg",
    responsibleSite: "深圳",
    inventoryStatus: "待处置",
    availability: "不可用",
    availabilityReason: "待报废处置",
    locationType: "warehouse",
    locationDisplay: "深圳仓-C区-待处置区",
    custodianDisplay: null,
    expectedReturnAt: null,
    eta: null,
    riskFlags: ["待处置"],
    projectRef: null,
    workItemRef: null,
    lastEventTime: "2025-01-03 14:00:00",
    lastEventType: "标记待处置",
  },
  {
    id: "SA-2025-00007",
    code: "SA-2025-00007",
    name: "灰色连帽卫衣",
    coverImage: "/gray-hoodie.png",
    responsibleSite: "深圳",
    inventoryStatus: "在库",
    availability: "可用",
    availabilityReason: null,
    locationType: "warehouse",
    locationDisplay: "深圳仓-A区-04-02",
    custodianDisplay: null,
    expectedReturnAt: null,
    eta: null,
    riskFlags: [],
    projectRef: "PRJ-20251216-007",
    workItemRef: "WI-拍摄-007",
    lastEventTime: "2025-01-08 09:15:00",
    lastEventType: "归还入库",
  },
  {
    id: "SA-2025-00008",
    code: "SA-2025-00008",
    name: "粉色雪纺上衣",
    coverImage: "/pink-chiffon-blouse.jpg",
    responsibleSite: "雅加达",
    inventoryStatus: "在库",
    availability: "可用",
    availabilityReason: null,
    locationType: "warehouse",
    locationDisplay: "雅加达仓-A区-01-01",
    custodianDisplay: null,
    expectedReturnAt: null,
    eta: null,
    riskFlags: [],
    projectRef: "PRJ-20251216-008",
    workItemRef: null,
    lastEventTime: "2025-01-07 15:30:00",
    lastEventType: "入库",
  },
  {
    id: "SA-2025-00009",
    code: "SA-2025-00009",
    name: "条纹休闲衬衫",
    coverImage: "/striped-casual-shirt.jpg",
    responsibleSite: "深圳",
    inventoryStatus: "借出",
    availability: "不可用",
    availabilityReason: "已借出给短视频团队",
    locationType: "external",
    locationDisplay: "外部保管-短视频团队",
    custodianDisplay: "短视频团队（李明）",
    expectedReturnAt: "2025-01-20",
    eta: null,
    riskFlags: [],
    projectRef: "PRJ-20251216-009",
    workItemRef: "WI-短视频-009",
    lastEventTime: "2025-01-06 10:00:00",
    lastEventType: "借出",
  },
  {
    id: "SA-2025-00010",
    code: "SA-2025-00010",
    name: "格子呢大衣",
    coverImage: "/plaid-wool-coat.jpg",
    responsibleSite: "深圳",
    inventoryStatus: "在途",
    availability: "不可用",
    availabilityReason: "在途中",
    locationType: "in_transit",
    locationDisplay: "工厂→深圳",
    custodianDisplay: null,
    expectedReturnAt: null,
    eta: "2025-01-11",
    riskFlags: [],
    projectRef: "PRJ-20251216-010",
    workItemRef: "WI-打样-010",
    lastEventTime: "2025-01-08 08:00:00",
    lastEventType: "发出",
  },
  {
    id: "SA-2025-00011",
    code: "SA-2025-00011",
    name: "丝绸印花裙",
    coverImage: "/silk-printed-dress.jpg",
    responsibleSite: "深圳",
    inventoryStatus: "已退货",
    availability: "不可用",
    availabilityReason: "已退货",
    locationType: "warehouse",
    locationDisplay: "深圳仓-退货区",
    custodianDisplay: null,
    expectedReturnAt: null,
    eta: null,
    riskFlags: [],
    projectRef: null,
    workItemRef: null,
    lastEventTime: "2025-01-02 16:00:00",
    lastEventType: "退货入库",
  },
  {
    id: "SA-2025-00012",
    code: "SA-2025-00012",
    name: "运动休闲套装",
    coverImage: "/sports-casual-set.jpg",
    responsibleSite: "雅加达",
    inventoryStatus: "预占",
    availability: "不可用",
    availabilityReason: "已被直播场次预占",
    locationType: "warehouse",
    locationDisplay: "雅加达仓-B区-02-03",
    custodianDisplay: null,
    expectedReturnAt: "2025-01-18",
    eta: null,
    riskFlags: [],
    projectRef: "PRJ-20251216-012",
    workItemRef: "WI-直播-012",
    lastEventTime: "2025-01-08 11:00:00",
    lastEventType: "预占",
  },
]

// 状态颜色映射
const statusColors: Record<string, string> = {
  在库: "bg-green-100 text-green-700",
  预占: "bg-blue-100 text-blue-700",
  借出: "bg-orange-100 text-orange-700",
  在途: "bg-purple-100 text-purple-700",
  冻结: "bg-red-100 text-red-700",
  待处置: "bg-gray-100 text-gray-700",
  已退货: "bg-gray-100 text-gray-500",
  已处置: "bg-gray-100 text-gray-500",
}

// 风险颜色映射
const riskColors: Record<string, string> = {
  超期未归还: "bg-red-500 text-white",
  在途超时: "bg-orange-500 text-white",
  冻结: "bg-red-100 text-red-700",
  待处置: "bg-gray-500 text-white",
}

export default function SampleViewPage() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"card" | "kanban" | "list">("card")
  const [keyword, setKeyword] = useState("")
  const [responsibleSite, setResponsibleSite] = useState("深圳")
  const [inventoryStatus, setInventoryStatus] = useState("all")
  const [availability, setAvailability] = useState("all")
  const [locationType, setLocationType] = useState("all")
  const [riskFilter, setRiskFilter] = useState("all")
  const [batchMode, setBatchMode] = useState(false)
  const [selectedSamples, setSelectedSamples] = useState<string[]>([])
  const [sortBy, setSortBy] = useState("lastEventTime")
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedSample, setSelectedSample] = useState<(typeof mockSamples)[0] | null>(null)

  // 筛选逻辑
  const filteredSamples = useMemo(() => {
    return mockSamples.filter((sample) => {
      // 关键词搜索
      if (keyword) {
        const kw = keyword.toLowerCase()
        const match =
          sample.code.toLowerCase().includes(kw) ||
          sample.name.toLowerCase().includes(kw) ||
          sample.projectRef?.toLowerCase().includes(kw) ||
          sample.workItemRef?.toLowerCase().includes(kw) ||
          sample.custodianDisplay?.toLowerCase().includes(kw)
        if (!match) return false
      }
      // 责任站点
      if (responsibleSite !== "all" && sample.responsibleSite !== responsibleSite) return false
      // 库存状态
      if (inventoryStatus !== "all" && sample.inventoryStatus !== inventoryStatus) return false
      // 可用性
      if (availability !== "all") {
        if (availability === "可用" && sample.availability !== "可用") return false
        if (availability === "不可用" && sample.availability !== "不可用") return false
      }
      // 位置类型
      if (locationType !== "all" && sample.locationType !== locationType) return false
      // 风险筛选
      if (riskFilter !== "all" && !sample.riskFlags.includes(riskFilter)) return false
      return true
    })
  }, [keyword, responsibleSite, inventoryStatus, availability, locationType, riskFilter])

  // 排序逻辑
  const sortedSamples = useMemo(() => {
    return [...filteredSamples].sort((a, b) => {
      if (sortBy === "lastEventTime") {
        return new Date(b.lastEventTime).getTime() - new Date(a.lastEventTime).getTime()
      }
      if (sortBy === "expectedReturnAt") {
        const aDate = a.expectedReturnAt || a.eta || "9999-12-31"
        const bDate = b.expectedReturnAt || b.eta || "9999-12-31"
        return new Date(aDate).getTime() - new Date(bDate).getTime()
      }
      if (sortBy === "riskFirst") {
        return b.riskFlags.length - a.riskFlags.length
      }
      return 0
    })
  }, [filteredSamples, sortBy])

  // KPI统计
  const kpiStats = useMemo(() => {
    const all = mockSamples.filter((s) => responsibleSite === "all" || s.responsibleSite === responsibleSite)
    return {
      total: all.length,
      available: all.filter((s) => s.availability === "可用").length,
      inStock: all.filter((s) => s.inventoryStatus === "在库").length,
      reserved: all.filter((s) => s.inventoryStatus === "预占").length,
      borrowed: all.filter((s) => s.inventoryStatus === "借出").length,
      inTransit: all.filter((s) => s.inventoryStatus === "在途").length,
      frozen: all.filter((s) => s.inventoryStatus === "冻结" || s.inventoryStatus === "待处置").length,
      overdue: all.filter((s) => s.riskFlags.includes("超期未归还")).length,
    }
  }, [responsibleSite])

  // 看板分组
  const kanbanGroups = useMemo(() => {
    const groups: Record<string, typeof mockSamples> = {
      "在库（可用）": [],
      预占: [],
      借出: [],
      在途: [],
      "冻结/待处置": [],
    }
    sortedSamples.forEach((sample) => {
      if (sample.inventoryStatus === "在库" && sample.availability === "可用") {
        groups["在库（可用）"].push(sample)
      } else if (sample.inventoryStatus === "预占") {
        groups["预占"].push(sample)
      } else if (sample.inventoryStatus === "借出") {
        groups["借出"].push(sample)
      } else if (sample.inventoryStatus === "在途") {
        groups["在途"].push(sample)
      } else if (sample.inventoryStatus === "冻结" || sample.inventoryStatus === "待处置") {
        groups["冻结/待处置"].push(sample)
      }
    })
    return groups
  }, [sortedSamples])

  // 批量选择
  const toggleSelect = (id: string) => {
    setSelectedSamples((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  const handleBatchApply = () => {
    if (selectedSamples.length === 0) {
      toast.error("请至少选择一个样衣")
      return
    }
    const selectedItems = mockSamples.filter((s) => selectedSamples.includes(s.id))
    const sites = new Set(selectedItems.map((s) => s.responsibleSite))
    if (sites.size > 1) {
      toast.error("批量申请需要同一责任站点，请拆分申请")
      return
    }
    toast.success(`已为 ${selectedSamples.length} 件样衣发起使用申请`)
    setSelectedSamples([])
    setBatchMode(false)
  }

  const openDetail = (sample: (typeof mockSamples)[0]) => {
    setSelectedSample(sample)
    setDetailOpen(true)
  }

  const handleReset = () => {
    setKeyword("")
    setResponsibleSite("深圳")
    setInventoryStatus("all")
    setAvailability("all")
    setLocationType("all")
    setRiskFilter("all")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">样衣视图</h1>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList>
                <TabsTrigger value="card" className="gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  卡片
                </TabsTrigger>
                <TabsTrigger value="kanban" className="gap-2">
                  <Columns3 className="w-4 h-4" />
                  看板
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-2">
                  <List className="w-4 h-4" />
                  列表
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* FilterBar */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="样衣编号/款号/SPU/项目/保管人"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={responsibleSite} onValueChange={setResponsibleSite}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="责任站点" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部站点</SelectItem>
                    <SelectItem value="深圳">深圳</SelectItem>
                    <SelectItem value="雅加达">雅加达</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={inventoryStatus} onValueChange={setInventoryStatus}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="库存状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="在库">在库</SelectItem>
                    <SelectItem value="预占">预占</SelectItem>
                    <SelectItem value="借出">借出</SelectItem>
                    <SelectItem value="在途">在途</SelectItem>
                    <SelectItem value="冻结">冻结</SelectItem>
                    <SelectItem value="待处置">待处置</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={availability} onValueChange={setAvailability}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="可用性" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="可用">可用</SelectItem>
                    <SelectItem value="不可用">不可用</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={locationType} onValueChange={setLocationType}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="位置类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部位置</SelectItem>
                    <SelectItem value="warehouse">在库</SelectItem>
                    <SelectItem value="external">外部保管</SelectItem>
                    <SelectItem value="in_transit">在途</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="风险筛选" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="超期未归还">超期未归还</SelectItem>
                    <SelectItem value="在途超时">在途超时</SelectItem>
                    <SelectItem value="冻结">冻结</SelectItem>
                    <SelectItem value="待处置">待处置</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleReset}>
                  重置
                </Button>
                <Button variant="ghost" size="icon" onClick={() => toast.info("已刷新")}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* KPI概览条 */}
          <div className="grid grid-cols-8 gap-3 mb-4">
            {[
              { label: "总样衣数", value: kpiStats.total, filter: null },
              { label: "可用", value: kpiStats.available, filter: () => setAvailability("可用") },
              { label: "在库", value: kpiStats.inStock, filter: () => setInventoryStatus("在库") },
              { label: "预占", value: kpiStats.reserved, filter: () => setInventoryStatus("预占") },
              { label: "借出", value: kpiStats.borrowed, filter: () => setInventoryStatus("借出") },
              { label: "在途", value: kpiStats.inTransit, filter: () => setInventoryStatus("在途") },
              { label: "冻结/待处置", value: kpiStats.frozen, filter: () => setInventoryStatus("冻结") },
              {
                label: "超期未归还",
                value: kpiStats.overdue,
                filter: () => setRiskFilter("超期未归还"),
                highlight: true,
              },
            ].map((item, idx) => (
              <Card
                key={idx}
                className={`cursor-pointer hover:shadow-md transition-shadow ${item.highlight && item.value > 0 ? "border-red-300 bg-red-50" : ""}`}
                onClick={() => item.filter?.()}
              >
                <CardContent className="p-3 text-center">
                  <div className={`text-2xl font-bold ${item.highlight && item.value > 0 ? "text-red-600" : ""}`}>
                    {item.value}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ViewToolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant={batchMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setBatchMode(!batchMode)
                  setSelectedSamples([])
                }}
              >
                {batchMode ? "取消批量" : "批量选择"}
              </Button>
              {batchMode && selectedSamples.length > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">已选 {selectedSamples.length} 件</span>
                  <Button size="sm" onClick={handleBatchApply}>
                    <Send className="w-4 h-4 mr-1" />
                    发起使用申请
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast.info("导出功能开发中")}>
                    <Download className="w-4 h-4 mr-1" />
                    导出
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast.info("打印标签功能开发中")}>
                    <Printer className="w-4 h-4 mr-1" />
                    打印标签
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">排序：</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lastEventTime">最近变更</SelectItem>
                  <SelectItem value="expectedReturnAt">预计归还时间</SelectItem>
                  <SelectItem value="riskFirst">风险优先</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Main View Area */}
          {viewMode === "card" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedSamples.map((sample) => (
                <Card
                  key={sample.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer relative"
                  onClick={() => !batchMode && openDetail(sample)}
                >
                  {batchMode && (
                    <div
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(sample.id)
                      }}
                    >
                      <Checkbox checked={selectedSamples.includes(sample.id)} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {sample.availability === "可用" && (
                          <DropdownMenuItem onClick={() => toast.success("已跳转到使用申请页面")}>
                            <Send className="w-4 h-4 mr-2" />
                            发起使用申请
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => router.push("/samples/ledger")}>
                          <FileText className="w-4 h-4 mr-2" />
                          查看台账
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/samples/inventory")}>
                          <Package className="w-4 h-4 mr-2" />
                          打开库存
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {/* 主图 */}
                  <div className="aspect-square bg-muted relative">
                    <img
                      src={sample.coverImage || "/placeholder.svg"}
                      alt={sample.name}
                      className="w-full h-full object-cover"
                    />
                    {sample.riskFlags.length > 0 && (
                      <div className="absolute bottom-2 right-2">
                        <Badge className={riskColors[sample.riskFlags[0]]}>
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {sample.riskFlags[0]}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    {/* 编号可复制 */}
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{sample.code}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(sample.code)
                          toast.success("已复制编号")
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    {/* 名称 */}
                    <div className="font-medium text-sm truncate mb-2">{sample.name}</div>
                    {/* Badge组 */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      <Badge variant="outline" className={statusColors[sample.inventoryStatus]}>
                        {sample.inventoryStatus}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          sample.availability === "可用" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                        }
                      >
                        {sample.availability}
                      </Badge>
                      <Badge variant="outline">{sample.responsibleSite}</Badge>
                    </div>
                    {/* 关键摘要 */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{sample.locationDisplay}</span>
                      </div>
                      {(sample.expectedReturnAt || sample.eta) && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className={sample.riskFlags.includes("超期未归还") ? "text-red-500" : ""}>
                            {sample.expectedReturnAt ? `预计归还: ${sample.expectedReturnAt}` : `ETA: ${sample.eta}`}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* 关联标签 */}
                    {(sample.projectRef || sample.workItemRef) && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
                        {sample.projectRef && (
                          <Badge variant="secondary" className="text-xs">
                            {sample.projectRef}
                          </Badge>
                        )}
                        {sample.workItemRef && (
                          <Badge variant="secondary" className="text-xs">
                            {sample.workItemRef}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {viewMode === "kanban" && (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {Object.entries(kanbanGroups).map(([status, samples]) => (
                <div key={status} className="flex-shrink-0 w-[280px]">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">{status}</span>
                      <Badge variant="secondary">{samples.length}</Badge>
                    </div>
                    <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                      {samples.map((sample) => (
                        <Card
                          key={sample.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => openDetail(sample)}
                        >
                          <CardContent className="p-3">
                            <div className="flex gap-3">
                              <img
                                src={sample.coverImage || "/placeholder.svg"}
                                alt={sample.name}
                                className="w-16 h-16 object-cover rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-mono text-muted-foreground">{sample.code}</div>
                                <div className="text-sm font-medium truncate">{sample.name}</div>
                                <div className="text-xs text-muted-foreground truncate mt-1">
                                  {sample.locationDisplay}
                                </div>
                                {sample.riskFlags.length > 0 && (
                                  <Badge className={`${riskColors[sample.riskFlags[0]]} text-xs mt-1`}>
                                    {sample.riskFlags[0]}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {samples.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground py-8">暂无数据</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === "list" && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    {batchMode && <TableHead className="w-10"></TableHead>}
                    <TableHead className="w-[200px]">样衣</TableHead>
                    <TableHead>库存状态</TableHead>
                    <TableHead>可用性</TableHead>
                    <TableHead>责任站点</TableHead>
                    <TableHead>当前位置</TableHead>
                    <TableHead>预计归还/ETA</TableHead>
                    <TableHead>风险</TableHead>
                    <TableHead>关联项目/工作项</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSamples.map((sample) => (
                    <TableRow
                      key={sample.id}
                      className="cursor-pointer"
                      onClick={() => !batchMode && openDetail(sample)}
                    >
                      {batchMode && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedSamples.includes(sample.id)}
                            onCheckedChange={() => toggleSelect(sample.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={sample.coverImage || "/placeholder.svg"}
                            alt=""
                            className="w-10 h-10 object-cover rounded"
                          />
                          <div>
                            <div className="text-xs font-mono text-muted-foreground">{sample.code}</div>
                            <div className="text-sm font-medium truncate max-w-[120px]">{sample.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[sample.inventoryStatus]}>
                          {sample.inventoryStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            sample.availability === "可用" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                          }
                        >
                          {sample.availability}
                        </Badge>
                      </TableCell>
                      <TableCell>{sample.responsibleSite}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{sample.locationDisplay}</TableCell>
                      <TableCell className={sample.riskFlags.includes("超期未归还") ? "text-red-500" : ""}>
                        {sample.expectedReturnAt || sample.eta || "-"}
                      </TableCell>
                      <TableCell>
                        {sample.riskFlags.length > 0 ? (
                          <Badge className={riskColors[sample.riskFlags[0]]}>{sample.riskFlags[0]}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {sample.projectRef && <div>{sample.projectRef}</div>}
                          {sample.workItemRef && <div className="text-muted-foreground">{sample.workItemRef}</div>}
                          {!sample.projectRef && !sample.workItemRef && "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(sample)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {sample.availability === "可用" && (
                            <Button variant="ghost" size="sm" onClick={() => toast.success("已跳转到使用申请")}>
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => router.push("/samples/ledger")}>
                            <FileText className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {sortedSamples.length === 0 && (
            <Card className="p-12 text-center">
              <div className="text-muted-foreground">无匹配数据，请调整筛选条件</div>
              <Button variant="link" onClick={handleReset}>
                重置筛选
              </Button>
            </Card>
          )}
        </main>
      </div>

      {/* 样衣详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          {selectedSample && (
            <>
              <SheetHeader>
                <SheetTitle>样衣详情</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* 主图 */}
                <div className="aspect-[4/5] bg-muted rounded-lg overflow-hidden">
                  <img
                    src={selectedSample.coverImage || "/placeholder.svg"}
                    alt={selectedSample.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 基本信息 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-sm">{selectedSample.code}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedSample.code)
                        toast.success("已复制编号")
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <h3 className="text-lg font-semibold">{selectedSample.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge className={statusColors[selectedSample.inventoryStatus]}>
                      {selectedSample.inventoryStatus}
                    </Badge>
                    <Badge
                      className={
                        selectedSample.availability === "可用"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }
                    >
                      {selectedSample.availability}
                    </Badge>
                    <Badge variant="outline">{selectedSample.responsibleSite}</Badge>
                  </div>
                </div>

                {/* 状态卡片 */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <MapPin className="w-4 h-4" />
                      当前位置
                    </div>
                    <div className="font-medium">{selectedSample.locationDisplay}</div>
                  </Card>
                  {selectedSample.custodianDisplay && (
                    <Card className="p-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <User className="w-4 h-4" />
                        保管人
                      </div>
                      <div className="font-medium">{selectedSample.custodianDisplay}</div>
                    </Card>
                  )}
                  {selectedSample.expectedReturnAt && (
                    <Card
                      className={`p-3 ${selectedSample.riskFlags.includes("超期未归还") ? "border-red-300 bg-red-50" : ""}`}
                    >
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="w-4 h-4" />
                        预计归还
                      </div>
                      <div
                        className={`font-medium ${selectedSample.riskFlags.includes("超期未归还") ? "text-red-600" : ""}`}
                      >
                        {selectedSample.expectedReturnAt}
                      </div>
                    </Card>
                  )}
                  {selectedSample.eta && (
                    <Card
                      className={`p-3 ${selectedSample.riskFlags.includes("在途超时") ? "border-orange-300 bg-orange-50" : ""}`}
                    >
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Truck className="w-4 h-4" />
                        预计到达
                      </div>
                      <div
                        className={`font-medium ${selectedSample.riskFlags.includes("在途超时") ? "text-orange-600" : ""}`}
                      >
                        {selectedSample.eta}
                      </div>
                    </Card>
                  )}
                </div>

                {/* 风险提示 */}
                {selectedSample.riskFlags.length > 0 && (
                  <Card className="p-3 border-red-300 bg-red-50">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">风险提示</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {selectedSample.riskFlags.map((risk, idx) => (
                        <Badge key={idx} className={riskColors[risk]}>
                          {risk}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}

                {/* 关联信息 */}
                {(selectedSample.projectRef || selectedSample.workItemRef) && (
                  <div>
                    <h4 className="font-medium mb-2">关联信息</h4>
                    <div className="space-y-2">
                      {selectedSample.projectRef && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">关联项目</span>
                          <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => router.push("/projects/prj_20251216_001")}
                          >
                            {selectedSample.projectRef}
                          </Button>
                        </div>
                      )}
                      {selectedSample.workItemRef && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">关联工作项</span>
                          <span>{selectedSample.workItemRef}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 最近事件 */}
                <div>
                  <h4 className="font-medium mb-2">最近事件</h4>
                  <div className="text-sm">
                    <span className="text-muted-foreground">{selectedSample.lastEventTime}</span>
                    <span className="mx-2">·</span>
                    <span>{selectedSample.lastEventType}</span>
                  </div>
                </div>

                {/* 快捷操作 */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {selectedSample.availability === "可用" && (
                    <Button
                      onClick={() => {
                        router.push("/samples/application")
                        toast.success("已跳转到使用申请页面")
                      }}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      发起使用申请
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => router.push("/samples/ledger")}>
                    <FileText className="w-4 h-4 mr-2" />
                    查看台账
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/samples/inventory")}>
                    <Package className="w-4 h-4 mr-2" />
                    打开库存
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
