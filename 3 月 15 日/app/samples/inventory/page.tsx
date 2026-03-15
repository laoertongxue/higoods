"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Search,
  Package,
  Lock,
  Users,
  Truck,
  AlertTriangle,
  Eye,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  Unlock,
  RotateCcw,
  Wrench,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"

// Types
interface Sample {
  sampleId: string
  sampleCode: string
  name: string
  category: string
  size: string
  color: string
  material: string
  templateType: string
  projectId: string | null
  projectName: string | null
  status: string
  currentLocation: string
  locationDetail: string
  occupancyType: "无" | "预占" | "占用"
  occupiedBy: string | null
  occupiedFor: string | null
  occupiedUntil: string | null
  inTransit: boolean
  transit: {
    from: string
    to: string
    carrier: string
    trackingNo: string
    eta: string
    transitSlaHours: number
    transitStartedAt: string
  } | null
  anomalyFlag: boolean
  anomaly: {
    type: string
    level: string
    since: string
    note: string
  } | null
  relatedWorkItem: {
    name: string
    instanceId: string
  } | null
  updatedAt: string
  updatedBy: string
}

interface LedgerEvent {
  eventId: string
  sampleCode: string
  time: string
  type: string
  summary: string
  by: string
}

interface MockDB {
  samples: Sample[]
  ledgerEvents: LedgerEvent[]
}

// Create mock database
function createMockDB(): MockDB {
  const templates = ["基础款", "快时尚款", "改版款", "设计款"]
  const locations = ["深圳仓", "摄影棚", "雅加达直播间", "在途"]
  const projects = [
    { id: "PRJ-20251216-001", name: "印度尼西亚碎花连衣裙", template: "基础款" },
    { id: "PRJ-20251218-007", name: "Y2K银色亮片短裙", template: "快时尚款" },
    { id: "PRJ-20251212-004", name: "老款SPU改版-腰围放量短裙", template: "改版款" },
    { id: "PRJ-20251205-009", name: "原创设计-立体花朵上衣", template: "设计款" },
  ]

  const samples: Sample[] = []
  const ledgerEvents: LedgerEvent[] = []

  // Generate 60+ samples with various statuses
  for (let i = 1; i <= 65; i++) {
    const code = `SY-INA-${String(i).padStart(3, "0")}`
    const statusIndex = i % 8
    const locationIndex = i % 4
    const projectIndex = i % 5

    let status = "在库可用"
    let occupancyType: "无" | "预占" | "占用" = "无"
    let inTransit = false
    let anomalyFlag = false
    let transit = null
    let anomaly = null
    let occupiedBy = null
    let occupiedFor = null
    let occupiedUntil = null

    // Distribute statuses
    if (statusIndex === 0) {
      status = "在库可用"
    } else if (statusIndex === 1) {
      status = "预占锁定"
      occupancyType = "预占"
      occupiedBy = "李明"
      occupiedFor = "拍摄"
      occupiedUntil = "2025-12-20"
    } else if (statusIndex === 2) {
      status = "借出占用"
      occupancyType = "占用"
      occupiedBy = "王芳"
      occupiedFor = "直播"
      occupiedUntil = "2025-12-18"
    } else if (statusIndex === 3) {
      status = "在途待签收"
      inTransit = true
      const now = new Date()
      const startDate = new Date(now.getTime() - (i % 3 === 0 ? 50 : 10) * 3600000)
      transit = {
        from: "深圳仓",
        to: "雅加达直播间",
        carrier: "顺丰国际",
        trackingNo: `SF${1000000000 + i}`,
        eta: "2025-12-19",
        transitSlaHours: 48,
        transitStartedAt: startDate.toISOString(),
      }
      // Mark some as overdue
      if (i % 3 === 0) {
        anomalyFlag = true
        anomaly = {
          type: "在途超时",
          level: "高",
          since: startDate.toISOString(),
          note: "已超过SLA 48小时",
        }
      }
    } else if (statusIndex === 4) {
      status = "维修中"
      anomalyFlag = true
      anomaly = {
        type: "破损",
        level: "中",
        since: "2025-12-10T10:00:00Z",
        note: "拉链损坏，需要更换",
      }
    } else if (statusIndex === 5) {
      status = "待处置"
      anomalyFlag = true
      anomaly = {
        type: "质量问题",
        level: "高",
        since: "2025-12-08T15:00:00Z",
        note: "面料色差严重，待退货",
      }
    } else if (statusIndex === 6) {
      status = "借出占用"
      occupancyType = "占用"
      occupiedBy = "赵敏"
      occupiedFor = "试穿"
      occupiedUntil = "2025-12-15" // Overdue
      anomalyFlag = true
      anomaly = {
        type: "归还超期",
        level: "中",
        since: "2025-12-15T00:00:00Z",
        note: "超期1天未归还",
      }
    } else {
      status = "已退货"
    }

    const project = projectIndex < 4 ? projects[projectIndex] : null

    samples.push({
      sampleId: `sample_${i}`,
      sampleCode: code,
      name: `${project?.name || "公共样衣"}${i > 50 ? "-副本" : ""}`,
      category: i % 2 === 0 ? "裙装" : "上衣",
      size: ["S", "M", "L", "XL"][i % 4],
      color: ["红色", "蓝色", "白色", "黑色", "碎花"][i % 5],
      material: ["棉", "涤纶", "混纺", "丝绸"][i % 4],
      templateType: project?.template || templates[i % 4],
      projectId: project?.id || null,
      projectName: project?.name || null,
      status,
      currentLocation: inTransit ? "在途" : locations[locationIndex],
      locationDetail: inTransit ? "深圳→雅加达" : `${locations[locationIndex]}-A${(i % 10) + 1}区`,
      occupancyType,
      occupiedBy,
      occupiedFor,
      occupiedUntil,
      inTransit,
      transit,
      anomalyFlag,
      anomaly,
      relatedWorkItem: project
        ? {
            name: "到样样衣管理",
            instanceId: `wi_${i}`,
          }
        : null,
      updatedAt: `2025-12-${String(15 + (i % 3)).padStart(2, "0")} ${String(10 + (i % 14)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`,
      updatedBy: ["张三", "李四", "王五", "赵六"][i % 4],
    })

    // Generate ledger events
    for (let j = 0; j < 3; j++) {
      ledgerEvents.push({
        eventId: `evt_${i}_${j}`,
        sampleCode: code,
        time: `2025-12-${String(10 + j).padStart(2, "0")} ${String(9 + j).padStart(2, "0")}:00`,
        type: ["入库", "出库", "在途", "签收", "借出", "归还"][j % 6],
        summary: `${["入库", "出库", "在途", "签收", "借出", "归还"][j % 6]}操作 - ${code}`,
        by: ["系统", "张三", "李四"][j % 3],
      })
    }
  }

  return { samples, ledgerEvents }
}

export default function SampleInventoryPage() {
  const [db, setDb] = useState<MockDB>(createMockDB())
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("全部")
  const [locationFilter, setLocationFilter] = useState("全部")
  const [templateFilter, setTemplateFilter] = useState("全部")
  const [showAnomalyOnly, setShowAnomalyOnly] = useState(false)
  const [showTransitOverdueOnly, setShowTransitOverdueOnly] = useState(false)
  const [showTodayReturnOnly, setShowTodayReturnOnly] = useState(false)
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Filter samples
  const filteredSamples = useMemo(() => {
    return db.samples.filter((sample) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesSearch =
          sample.sampleCode.toLowerCase().includes(term) ||
          sample.name.toLowerCase().includes(term) ||
          sample.projectName?.toLowerCase().includes(term) ||
          sample.transit?.trackingNo.toLowerCase().includes(term)
        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== "全部" && sample.status !== statusFilter) return false

      // Location filter
      if (locationFilter !== "全部" && sample.currentLocation !== locationFilter) return false

      // Template filter
      if (templateFilter !== "全部" && sample.templateType !== templateFilter) return false

      // Anomaly filter
      if (showAnomalyOnly && !sample.anomalyFlag) return false

      // Transit overdue filter
      if (showTransitOverdueOnly) {
        if (!sample.inTransit || !sample.transit) return false
        const now = new Date()
        const started = new Date(sample.transit.transitStartedAt)
        const hoursElapsed = (now.getTime() - started.getTime()) / (1000 * 3600)
        if (hoursElapsed <= sample.transit.transitSlaHours) return false
      }

      // Today return filter
      if (showTodayReturnOnly) {
        if (sample.occupancyType !== "占用" || !sample.occupiedUntil) return false
        const today = new Date().toISOString().split("T")[0]
        if (sample.occupiedUntil !== today) return false
      }

      return true
    })
  }, [
    db.samples,
    searchTerm,
    statusFilter,
    locationFilter,
    templateFilter,
    showAnomalyOnly,
    showTransitOverdueOnly,
    showTodayReturnOnly,
  ])

  // Calculate summary
  const summary = useMemo(() => {
    const all = db.samples
    return {
      total: all.length,
      available: all.filter((s) => s.status === "在库可用").length,
      reserved: all.filter((s) => s.status === "预占锁定").length,
      occupied: all.filter((s) => s.status === "借出占用").length,
      inTransit: all.filter((s) => s.inTransit).length,
      anomaly: all.filter((s) => s.anomalyFlag).length,
    }
  }, [db.samples])

  const handleRefresh = () => {
    setDb((prev) => {
      const newSamples = [...prev.samples]
      // Update a few samples
      if (newSamples.length > 0) {
        newSamples[0] = {
          ...newSamples[0],
          status: "在库可用",
          inTransit: false,
          updatedAt: new Date().toLocaleString(),
        }
      }
      if (newSamples.length > 5) {
        newSamples[5] = { ...newSamples[5], anomalyFlag: !newSamples[5].anomalyFlag }
      }
      return { ...prev, samples: newSamples }
    })
    toast.success("已刷新库存数据")
  }

  const handleReset = () => {
    setSearchTerm("")
    setStatusFilter("全部")
    setLocationFilter("全部")
    setTemplateFilter("全部")
    setShowAnomalyOnly(false)
    setShowTransitOverdueOnly(false)
    setShowTodayReturnOnly(false)
    toast.info("已重置筛选条件")
  }

  const handleRowClick = (sample: Sample) => {
    setSelectedSample(sample)
    setDrawerOpen(true)
  }

  const handleSignReceive = () => {
    if (selectedSample && selectedSample.inTransit) {
      toast.success(`已标记签收: ${selectedSample.sampleCode}`)
      setDrawerOpen(false)
    }
  }

  const handleReleaseReserve = () => {
    if (selectedSample && selectedSample.occupancyType === "预占") {
      toast.success(`已释放预占: ${selectedSample.sampleCode}`)
      setDrawerOpen(false)
    }
  }

  const handleMarkReturn = () => {
    if (selectedSample && selectedSample.occupancyType === "占用") {
      toast.success(`已标记归还: ${selectedSample.sampleCode}`)
      setDrawerOpen(false)
    }
  }

  const handleInitMaintenance = () => {
    if (selectedSample) {
      toast.success(`已发起维修申请: ${selectedSample.sampleCode}`)
      setDrawerOpen(false)
    }
  }

  const getLedgerEvents = (sampleCode: string) => {
    return db.ledgerEvents.filter((e) => e.sampleCode === sampleCode).slice(0, 8)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <SystemNav />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <div className="text-sm text-muted-foreground mb-2">样衣资产管理 / 样衣库存</div>
              <h1 className="text-2xl font-semibold">样衣库存</h1>
            </div>

            {/* Filter Bar */}
            <Card className="p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索样衣编号/名称/项目/运单号"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="全部">全部状态</SelectItem>
                      <SelectItem value="在库可用">在库可用</SelectItem>
                      <SelectItem value="预占锁定">预占锁定</SelectItem>
                      <SelectItem value="借出占用">借出占用</SelectItem>
                      <SelectItem value="在途待签收">在途待签收</SelectItem>
                      <SelectItem value="维修中">维修中</SelectItem>
                      <SelectItem value="待处置">待处置</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="位置" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="全部">全部位置</SelectItem>
                      <SelectItem value="深圳仓">深圳仓</SelectItem>
                      <SelectItem value="摄影棚">摄影棚</SelectItem>
                      <SelectItem value="雅加达直播间">雅加达直播间</SelectItem>
                      <SelectItem value="在途">在途</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={templateFilter} onValueChange={setTemplateFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="模板类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="全部">全部类型</SelectItem>
                      <SelectItem value="基础款">基础款</SelectItem>
                      <SelectItem value="快时尚款">快时尚款</SelectItem>
                      <SelectItem value="改版款">改版款</SelectItem>
                      <SelectItem value="设计款">设计款</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch id="anomaly-only" checked={showAnomalyOnly} onCheckedChange={setShowAnomalyOnly} />
                      <Label htmlFor="anomaly-only" className="cursor-pointer">
                        只看异常
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="transit-overdue"
                        checked={showTransitOverdueOnly}
                        onCheckedChange={setShowTransitOverdueOnly}
                      />
                      <Label htmlFor="transit-overdue" className="cursor-pointer">
                        只看在途超时
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="today-return"
                        checked={showTodayReturnOnly}
                        onCheckedChange={setShowTodayReturnOnly}
                      />
                      <Label htmlFor="today-return" className="cursor-pointer">
                        今日需归还
                      </Label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReset}>
                      重置
                    </Button>
                    <Button variant="outline" onClick={handleRefresh}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      刷新
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <Card
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setStatusFilter("全部")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.total}</p>
                    <p className="text-sm text-muted-foreground">总量</p>
                  </div>
                </div>
              </Card>
              <Card
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setStatusFilter("在库可用")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.available}</p>
                    <p className="text-sm text-muted-foreground">在库可用</p>
                  </div>
                </div>
              </Card>
              <Card
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setStatusFilter("预占锁定")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.reserved}</p>
                    <p className="text-sm text-muted-foreground">预占</p>
                  </div>
                </div>
              </Card>
              <Card
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setStatusFilter("借出占用")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.occupied}</p>
                    <p className="text-sm text-muted-foreground">占用</p>
                  </div>
                </div>
              </Card>
              <Card
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setStatusFilter("在途待签收")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.inTransit}</p>
                    <p className="text-sm text-muted-foreground">在途</p>
                  </div>
                </div>
              </Card>
              <Card
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setShowAnomalyOnly(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.anomaly}</p>
                    <p className="text-sm text-muted-foreground">异常</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium text-sm">样衣编号/名称</th>
                      <th className="text-left p-4 font-medium text-sm">所属项目</th>
                      <th className="text-left p-4 font-medium text-sm">状态</th>
                      <th className="text-left p-4 font-medium text-sm">当前位置</th>
                      <th className="text-left p-4 font-medium text-sm">占用/预占</th>
                      <th className="text-left p-4 font-medium text-sm">在途信息</th>
                      <th className="text-left p-4 font-medium text-sm">异常</th>
                      <th className="text-left p-4 font-medium text-sm">最近更新</th>
                      <th className="text-left p-4 font-medium text-sm">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSamples.map((sample) => (
                      <tr
                        key={sample.sampleId}
                        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleRowClick(sample)}
                      >
                        <td className="p-4">
                          <div>
                            <div className="font-medium">{sample.sampleCode}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                              {sample.name}
                              <Badge variant="outline" className="text-xs">
                                {sample.templateType}
                              </Badge>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            {sample.projectName || <span className="text-muted-foreground">公共样衣</span>}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={
                              sample.status === "在库可用"
                                ? "default"
                                : sample.status === "预占锁定"
                                  ? "secondary"
                                  : sample.status === "借出占用"
                                    ? "default"
                                    : sample.status === "在途待签收"
                                      ? "default"
                                      : "destructive"
                            }
                            className={
                              sample.status === "在库可用"
                                ? "bg-green-500"
                                : sample.status === "预占锁定"
                                  ? "bg-purple-500"
                                  : sample.status === "借出占用"
                                    ? "bg-orange-500"
                                    : sample.status === "在途待签收"
                                      ? "bg-blue-500"
                                      : ""
                            }
                          >
                            {sample.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            <div>{sample.currentLocation}</div>
                            <div className="text-xs text-muted-foreground">{sample.locationDetail}</div>
                          </div>
                        </td>
                        <td className="p-4">
                          {sample.occupancyType !== "无" ? (
                            <div className="text-sm">
                              <div className="font-medium">{sample.occupiedBy}</div>
                              <div className="text-xs text-muted-foreground">
                                {sample.occupiedFor} · 至 {sample.occupiedUntil}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          {sample.inTransit && sample.transit ? (
                            <div className="text-sm">
                              <div className="font-medium">{sample.transit.trackingNo}</div>
                              <div className="text-xs text-muted-foreground">
                                ETA: {sample.transit.eta}
                                {sample.anomaly?.type === "在途超时" && (
                                  <Badge variant="destructive" className="ml-2 text-xs">
                                    超时
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          {sample.anomalyFlag && sample.anomaly ? (
                            <div className="text-sm">
                              <Badge variant="destructive" className="text-xs">
                                {sample.anomaly.type}
                              </Badge>
                              <div className="text-xs text-muted-foreground mt-1">{sample.anomaly.level}级</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-muted-foreground">{sample.updatedAt}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRowClick(sample)
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                toast.info("打开样衣台账")
                              }}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredSamples.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">暂无符合条件的样衣库存</div>
              )}
            </Card>
          </div>
        </main>
      </div>

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedSample && (
            <>
              <SheetHeader>
                <SheetTitle>样衣详情(快照)</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="font-semibold mb-3">基本信息</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">样衣编号: </span>
                      <span className="font-medium">{selectedSample.sampleCode}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">名称: </span>
                      <span>{selectedSample.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">尺码: </span>
                      <span>{selectedSample.size}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">颜色: </span>
                      <span>{selectedSample.color}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Snapshot Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">状态</div>
                    <Badge
                      className={
                        selectedSample.status === "在库可用"
                          ? "bg-green-500"
                          : selectedSample.status === "预占锁定"
                            ? "bg-purple-500"
                            : selectedSample.status === "借出占用"
                              ? "bg-orange-500"
                              : "bg-blue-500"
                      }
                    >
                      {selectedSample.status}
                    </Badge>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">位置</div>
                    <div className="font-medium">{selectedSample.currentLocation}</div>
                    <div className="text-xs text-muted-foreground">{selectedSample.locationDetail}</div>
                  </Card>
                  {selectedSample.occupancyType !== "无" && (
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">占用信息</div>
                      <div className="font-medium">{selectedSample.occupiedBy}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedSample.occupiedFor} · 至 {selectedSample.occupiedUntil}
                      </div>
                    </Card>
                  )}
                  {selectedSample.inTransit && selectedSample.transit && (
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">在途信息</div>
                      <div className="font-medium">{selectedSample.transit.trackingNo}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedSample.transit.from} → {selectedSample.transit.to}
                      </div>
                      <div className="text-xs text-muted-foreground">ETA: {selectedSample.transit.eta}</div>
                    </Card>
                  )}
                  {selectedSample.anomalyFlag && selectedSample.anomaly && (
                    <Card className="p-4 border-red-200 bg-red-50">
                      <div className="text-sm text-red-600 mb-1">异常</div>
                      <Badge variant="destructive">{selectedSample.anomaly.type}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">{selectedSample.anomaly.note}</div>
                    </Card>
                  )}
                </div>

                <Separator />

                {/* Action Buttons */}
                <div>
                  <h3 className="font-semibold mb-3">快捷操作</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedSample.inTransit && (
                      <Button onClick={handleSignReceive} className="w-full">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        标记签收
                      </Button>
                    )}
                    {selectedSample.occupancyType === "预占" && (
                      <Button onClick={handleReleaseReserve} variant="outline" className="w-full bg-transparent">
                        <Unlock className="w-4 h-4 mr-2" />
                        释放预占
                      </Button>
                    )}
                    {selectedSample.occupancyType === "占用" && (
                      <Button onClick={handleMarkReturn} variant="outline" className="w-full bg-transparent">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        标记归还
                      </Button>
                    )}
                    <Button onClick={handleInitMaintenance} variant="outline" className="w-full bg-transparent">
                      <Wrench className="w-4 h-4 mr-2" />
                      发起维修
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Recent Ledger Events */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">最近台账事件 (8条)</h3>
                    <Button size="sm" variant="link" onClick={() => toast.info("打开完整台账")}>
                      查看完整台账
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {getLedgerEvents(selectedSample.sampleCode).map((event) => (
                      <div key={event.eventId} className="flex gap-3 text-sm">
                        <div className="flex-shrink-0">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{event.summary}</div>
                          <div className="text-xs text-muted-foreground">
                            {event.time} · {event.by}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {event.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
