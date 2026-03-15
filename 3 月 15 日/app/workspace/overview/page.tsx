"use client"

import { useState, useMemo } from "react"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import {
  FolderKanban,
  AlertTriangle,
  Clock,
  RefreshCw,
  Video,
  Shirt,
  Ban,
  ChevronRight,
  Settings,
  Download,
  Plus,
  FileText,
  CheckSquare,
  Package,
  Store,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Upload,
  Link2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2,
  Users,
  Tv,
  MapPin,
  AlertCircle,
  Warehouse,
  Timer,
  FileWarning,
  Layers,
  BarChart3,
} from "lucide-react"

// ==================== Mock Data ====================
const NOW_ISO = "2026-01-13T10:30:00+08:00"

// 角色枚举
type RoleView = "my" | "manager" | "warehouse" | "channel" | "testing"

// Mock 项目数据
const mockProjects = [
  {
    id: "PRJ-001",
    name: "印尼风格碎花连衣裙",
    phase: "测款中",
    status: "进行中",
    owner: "张丽",
    blockedCount: 1,
    overdueCount: 0,
  },
  {
    id: "PRJ-002",
    name: "Y2K银色亮片短裙",
    phase: "首单样衣打样",
    status: "进行中",
    owner: "张丽",
    blockedCount: 0,
    overdueCount: 1,
  },
  {
    id: "PRJ-003",
    name: "基础打底针织上衣",
    phase: "制版准备",
    status: "进行中",
    owner: "王强",
    blockedCount: 0,
    overdueCount: 0,
  },
  {
    id: "PRJ-004",
    name: "腰围放量短裙",
    phase: "产前版样衣",
    status: "进行中",
    owner: "李娜",
    blockedCount: 0,
    overdueCount: 2,
  },
  {
    id: "PRJ-005",
    name: "立体花朵上衣",
    phase: "商品上架",
    status: "进行中",
    owner: "陈杰",
    blockedCount: 1,
    overdueCount: 0,
  },
  {
    id: "PRJ-006",
    name: "夏日清凉吊带",
    phase: "在售",
    status: "已完成",
    owner: "张丽",
    blockedCount: 0,
    overdueCount: 0,
  },
]

// 项目阶段漏斗
const projectFunnel = [
  { phase: "测款中", count: 8, blocked: 2 },
  { phase: "制版准备", count: 5, blocked: 1 },
  { phase: "首单样衣打样", count: 4, blocked: 0 },
  { phase: "产前版样衣", count: 3, blocked: 1 },
  { phase: "商品上架", count: 6, blocked: 2 },
  { phase: "在售", count: 12, blocked: 0 },
]

// 工作项看板数据
const workItemKanban = {
  NOT_STARTED: { 改版任务: 3, 制版任务: 2, 花型任务: 1, 首单打样: 2, 产前版: 1, 商品上架: 4 },
  IN_PROGRESS: { 改版任务: 5, 制版任务: 4, 花型任务: 3, 首单打样: 3, 产前版: 2, 商品上架: 6 },
  BLOCKED: { 改版任务: 1, 制版任务: 0, 花型任务: 1, 首单打样: 0, 产前版: 1, 商品上架: 2 },
  COMPLETED: { 改版任务: 12, 制版任务: 15, 花型任务: 10, 首单打样: 8, 产前版: 6, 商品上架: 20 },
}

// 异常数据
const mockExceptions = [
  {
    type: "工作项超期",
    count: 5,
    items: [
      { id: "WI-001", title: "制版任务-连衣裙", owner: "王版师", overdueDays: 3, projectName: "印尼风格碎花连衣裙" },
      { id: "WI-002", title: "花型任务-印花设计", owner: "陈设计", overdueDays: 2, projectName: "Y2K银色亮片短裙" },
      { id: "WI-003", title: "商品上架-TikTok", owner: "李运营", overdueDays: 1, projectName: "基础打底针织上衣" },
    ],
  },
  {
    type: "样衣超期未归还",
    count: 3,
    items: [
      { id: "SMP-001", sampleCode: "SY-QF-102", borrower: "直播团队", overdueDays: 5, projectName: "Y2K银色亮片短裙" },
      { id: "SMP-002", sampleCode: "SY-HX-089", borrower: "摄影棚", overdueDays: 2, projectName: "立体花朵上衣" },
    ],
  },
  {
    type: "店铺授权过期",
    count: 2,
    items: [
      { id: "ST-001", storeName: "TikTok印尼旗舰店", channel: "TikTok", expiredDays: 3 },
      { id: "ST-002", storeName: "Shopee主店", channel: "Shopee", expiredDays: 1 },
    ],
  },
  {
    type: "映射异常",
    count: 4,
    items: [
      { id: "MAP-001", productName: "碎花连衣裙-S码", store: "TikTok印尼店", issue: "缺SKU映射" },
      { id: "MAP-002", productName: "亮片短裙-M码", store: "Shopee主店", issue: "编码冲突" },
    ],
  },
  {
    type: "上架失败",
    count: 3,
    items: [
      { id: "LST-001", productName: "针织上衣", store: "TikTok印尼店", reason: "图片不合规" },
      { id: "LST-002", productName: "吊带背心", store: "Shopee主店", reason: "类目错误" },
    ],
  },
  {
    type: "测款待入账",
    count: 6,
    items: [
      { id: "TEST-001", type: "直播场次", name: "LS-20260112-001", testItems: 8, owner: "测款组" },
      { id: "TEST-002", type: "短视频", name: "SV-20260111-003", testItems: 3, owner: "测款组" },
    ],
  },
]

// 我的待办
const mockTodos = [
  {
    id: "TD-001",
    type: "工作项",
    title: "测款结论判定",
    projectName: "Y2K银色亮片短裙",
    dueAt: "2026-01-13 18:00",
    status: "待处理",
    isOverdue: false,
  },
  {
    id: "TD-002",
    type: "上架",
    title: "商品上架审核",
    projectName: "基础打底针织上衣",
    dueAt: "2026-01-13 14:00",
    status: "需审核",
    isOverdue: true,
  },
  {
    id: "TD-003",
    type: "入账",
    title: "直播测款入账确认",
    projectName: "印尼风格碎花连衣裙",
    dueAt: "2026-01-14 12:00",
    status: "待处理",
    isOverdue: false,
  },
  {
    id: "TD-004",
    type: "样衣",
    title: "样衣归还确认",
    projectName: "立体花朵上衣",
    dueAt: "2026-01-13 17:00",
    status: "待处理",
    isOverdue: false,
  },
  {
    id: "TD-005",
    type: "工作项",
    title: "制版评审",
    projectName: "腰围放量短裙",
    dueAt: "2026-01-15 10:00",
    status: "待处理",
    isOverdue: false,
  },
]

// 样衣资产分布（双站点）
const sampleDistribution = {
  shenzhen: { onHand: 156, reserved: 23, borrowed: 18, inTransit: 8, disposal: 3 },
  jakarta: { onHand: 89, reserved: 12, borrowed: 25, inTransit: 5, disposal: 2 },
}

// 仓管待处理
const warehouseTodos = {
  pendingReceipt: [
    { id: "WH-001", source: "首单打样", trackingNo: "SF998877", expectedAt: "2026-01-13 14:00", site: "深圳" },
    { id: "WH-002", source: "产前版", trackingNo: "JD123456", expectedAt: "2026-01-13 16:00", site: "深圳" },
    { id: "WH-003", source: "寄回归还", trackingNo: "YT789012", expectedAt: "2026-01-14 10:00", site: "雅加达" },
  ],
  pendingStockIn: [
    { id: "WH-004", source: "首单打样", receivedAt: "2026-01-12 15:30", site: "深圳", sampleCount: 3 },
    { id: "WH-005", source: "产前版", receivedAt: "2026-01-13 09:00", site: "雅加达", sampleCount: 2 },
  ],
}

// 超期未归还样衣
const overdueReturns = [
  {
    id: "OR-001",
    sampleCode: "SY-QF-102",
    borrower: "直播团队-Fiona",
    expectedReturn: "2026-01-08",
    overdueDays: 5,
    location: "雅加达直播间",
  },
  {
    id: "OR-002",
    sampleCode: "SY-HX-089",
    borrower: "摄影棚-阿杰",
    expectedReturn: "2026-01-11",
    overdueDays: 2,
    location: "深圳摄影棚",
  },
  {
    id: "OR-003",
    sampleCode: "SY-JK-045",
    borrower: "外部达人-小美",
    expectedReturn: "2026-01-10",
    overdueDays: 3,
    location: "外借",
  },
]

// 店铺健康
const storeHealth = [
  {
    id: "ST-001",
    channel: "TikTok",
    store: "印尼旗舰店",
    authStatus: "EXPIRING",
    expireAt: "2026-01-20",
    successRate: 95.2,
  },
  {
    id: "ST-002",
    channel: "TikTok",
    store: "马来主店",
    authStatus: "CONNECTED",
    expireAt: "2026-03-15",
    successRate: 98.1,
  },
  { id: "ST-003", channel: "Shopee", store: "印尼主店", authStatus: "EXPIRED", expireAt: "2026-01-10", successRate: 0 },
  {
    id: "ST-004",
    channel: "Shopee",
    store: "菲律宾店",
    authStatus: "CONNECTED",
    expireAt: "2026-04-20",
    successRate: 92.5,
  },
  { id: "ST-005", channel: "Lazada", store: "印尼店", authStatus: "FAILED", expireAt: "-", successRate: 0 },
]

// 上架推进
const listingPipeline = {
  inProgress: 12,
  pendingReview: 5,
  failed: 3,
  recentFailed: [
    {
      id: "LST-001",
      product: "针织上衣-白色",
      store: "TikTok印尼店",
      reason: "图片尺寸不合规",
      createdAt: "2026-01-12",
    },
    { id: "LST-002", product: "吊带背心-黑色", store: "Shopee主店", reason: "类目选择错误", createdAt: "2026-01-11" },
    { id: "LST-003", product: "短裙-蓝色", store: "TikTok马来店", reason: "价格超出范围", createdAt: "2026-01-10" },
  ],
}

// 映射健康
const mappingHealth = {
  total: 245,
  abnormal: 8,
  items: [
    {
      id: "MAP-001",
      platformId: "TK-12345",
      store: "TikTok印尼店",
      internalBinding: "碎花连衣裙-SPU001",
      issue: "缺SKU映射",
      skuMissing: 2,
    },
    {
      id: "MAP-002",
      platformId: "SP-67890",
      store: "Shopee主店",
      internalBinding: "亮片短裙-SPU002",
      issue: "编码冲突",
      conflict: true,
    },
    {
      id: "MAP-003",
      platformId: "TK-11111",
      store: "TikTok马来店",
      internalBinding: "针织上衣-SPU003",
      issue: "未知SKU",
      skuMissing: 1,
    },
  ],
}

// 内容与入账
const contentAccounting = {
  liveSessions: { total7d: 15, pendingAccounting: 4 },
  shortVideos: { total7d: 28, pendingAccounting: 6 },
  pendingItems: [
    {
      id: "LS-001",
      type: "直播场次",
      name: "LS-20260112-001",
      account: "Fiona直播间",
      testItems: 8,
      owner: "测款组-小王",
    },
    {
      id: "LS-002",
      type: "直播场次",
      name: "LS-20260111-002",
      account: "印尼主播间",
      testItems: 5,
      owner: "测款组-小李",
    },
    {
      id: "SV-001",
      type: "短视频",
      name: "SV-20260112-003",
      account: "抖音达人-小美",
      testItems: 3,
      owner: "测款组-小王",
    },
    {
      id: "SV-002",
      type: "短视频",
      name: "SV-20260110-005",
      account: "TikTok红人-Rina",
      testItems: 4,
      owner: "测款组-小李",
    },
  ],
}

// Top风险项目
const topRiskProjects = [
  {
    id: "PRJ-004",
    name: "腰围放量短裙",
    phase: "产前版样衣",
    riskTags: ["超期", "缺样衣"],
    owner: "李娜",
    riskScore: 15,
  },
  {
    id: "PRJ-002",
    name: "Y2K银色亮片短裙",
    phase: "首单样衣打样",
    riskTags: ["阻塞", "映射异常"],
    owner: "张丽",
    riskScore: 12,
  },
  { id: "PRJ-005", name: "立体花朵上衣", phase: "商品上架", riskTags: ["上架失败"], owner: "陈杰", riskScore: 8 },
]

// 看板配置
interface DashboardConfig {
  components: {
    id: string
    label: string
    enabled: boolean
    order: number
  }[]
  defaultFilters: {
    dateRange: string
    site: string
    team: string
  }
}

const defaultConfig: DashboardConfig = {
  components: [
    { id: "kpi", label: "KPI总览", enabled: true, order: 1 },
    { id: "exceptions", label: "异常与待办", enabled: true, order: 2 },
    { id: "projects", label: "项目推进", enabled: true, order: 3 },
    { id: "samples", label: "样衣资产", enabled: true, order: 4 },
    { id: "channels", label: "渠道与内容", enabled: true, order: 5 },
  ],
  defaultFilters: {
    dateRange: "近7天",
    site: "全部",
    team: "全部",
  },
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]

export default function OverviewDashboard() {
  const { toast } = useToast()

  // 状态
  const [roleView, setRoleView] = useState<RoleView>("my")
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(NOW_ISO)

  // 筛选条
  const [dateRange, setDateRange] = useState("近7天")
  const [site, setSite] = useState("全部")
  const [team, setTeam] = useState("全部")
  const [channel, setChannel] = useState("全部")
  const [store, setStore] = useState("全部")
  const [projectPhase, setProjectPhase] = useState("全部")
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  // 抽屉/弹窗
  const [configOpen, setConfigOpen] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(defaultConfig)

  // 待办筛选
  const [todoFilter, setTodoFilter] = useState("全部")

  // 刷新
  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      setLastRefresh(new Date().toISOString())
      toast({ title: "刷新成功", description: "数据已更新" })
    }, 1000)
  }

  // 导出
  const handleExport = () => {
    toast({ title: "导出中", description: "正在生成报表..." })
  }

  // 钻取
  const handleDrillDown = (module: string, filter?: string) => {
    toast({ title: `跳转到 ${module}`, description: filter ? `筛选条件: ${filter}` : "查看全部" })
  }

  // 快捷操作
  const handleQuickCreate = (type: string) => {
    setQuickCreateOpen(false)
    toast({ title: `新建${type}`, description: "打开创建抽屉" })
  }

  // KPI 数据（根据角色动态调整）
  const kpiCards = useMemo(() => {
    const baseCards = [
      {
        id: "projects",
        label: "进行中项目",
        value: 24,
        icon: FolderKanban,
        color: "text-blue-600",
        trend: "+3",
        trendUp: true,
      },
      {
        id: "workitems",
        label: "关键工作项待处理",
        value: 18,
        icon: CheckSquare,
        color: "text-purple-600",
        trend: "-2",
        trendUp: false,
      },
      {
        id: "overdue",
        label: "超期工作项",
        value: 5,
        icon: Clock,
        color: "text-red-600",
        trend: "+1",
        trendUp: true,
        isWarning: true,
      },
      {
        id: "blocked",
        label: "阻塞工作项",
        value: 3,
        icon: Ban,
        color: "text-orange-600",
        trend: "0",
        trendUp: false,
        isWarning: true,
      },
    ]

    const sampleCards = [
      {
        id: "onhand",
        label: "在库样衣总数",
        value: sampleDistribution.shenzhen.onHand + sampleDistribution.jakarta.onHand,
        icon: Shirt,
        color: "text-green-600",
        trend: "+12",
        trendUp: true,
      },
      {
        id: "borrowed",
        label: "领用/外借中",
        value: sampleDistribution.shenzhen.borrowed + sampleDistribution.jakarta.borrowed,
        icon: Package,
        color: "text-cyan-600",
        trend: "+5",
        trendUp: true,
      },
      {
        id: "overdueReturn",
        label: "超期未归还",
        value: overdueReturns.length,
        icon: Timer,
        color: "text-red-600",
        trend: "+1",
        trendUp: true,
        isWarning: true,
      },
    ]

    const channelCards = [
      {
        id: "listing",
        label: "上架中任务",
        value: listingPipeline.inProgress,
        icon: Upload,
        color: "text-blue-600",
        trend: "+4",
        trendUp: true,
      },
      {
        id: "listingFailed",
        label: "上架失败/受限",
        value: listingPipeline.failed,
        icon: FileWarning,
        color: "text-red-600",
        trend: "-1",
        trendUp: false,
        isWarning: true,
      },
      {
        id: "storeExpiring",
        label: "店铺授权将过期",
        value: storeHealth.filter((s) => s.authStatus === "EXPIRING" || s.authStatus === "EXPIRED").length,
        icon: Store,
        color: "text-orange-600",
        trend: "+1",
        trendUp: true,
        isWarning: true,
      },
    ]

    // 根据角色调整顺序和内容
    if (roleView === "warehouse") {
      return [
        ...sampleCards,
        {
          id: "pendingReceipt",
          label: "待到样签收",
          value: warehouseTodos.pendingReceipt.length,
          icon: Package,
          color: "text-amber-600",
          trend: "+2",
          trendUp: true,
        },
        {
          id: "pendingStockIn",
          label: "待核对入库",
          value: warehouseTodos.pendingStockIn.length,
          icon: Warehouse,
          color: "text-purple-600",
          trend: "+1",
          trendUp: true,
        },
        ...baseCards.slice(0, 2),
      ]
    }

    if (roleView === "channel") {
      return [
        ...channelCards,
        {
          id: "mappingError",
          label: "映射异常数",
          value: mappingHealth.abnormal,
          icon: Link2,
          color: "text-red-600",
          trend: "+2",
          trendUp: true,
          isWarning: true,
        },
        ...baseCards.slice(0, 2),
        ...sampleCards.slice(0, 1),
      ]
    }

    if (roleView === "testing") {
      return [
        {
          id: "livePending",
          label: "直播待入账",
          value: contentAccounting.liveSessions.pendingAccounting,
          icon: Video,
          color: "text-pink-600",
          trend: "+1",
          trendUp: true,
        },
        {
          id: "videoPending",
          label: "短视频待入账",
          value: contentAccounting.shortVideos.pendingAccounting,
          icon: Tv,
          color: "text-purple-600",
          trend: "+2",
          trendUp: true,
        },
        {
          id: "testItems",
          label: "TEST条目数",
          value: 45,
          icon: FileText,
          color: "text-blue-600",
          trend: "+8",
          trendUp: true,
        },
        ...baseCards.slice(0, 2),
        ...sampleCards.slice(0, 2),
      ]
    }

    if (roleView === "manager") {
      return [
        ...baseCards,
        ...sampleCards.slice(0, 2),
        ...channelCards.slice(0, 2),
        {
          id: "gmv7d",
          label: "近7天GMV",
          value: "¥125,890",
          icon: TrendingUp,
          color: "text-green-600",
          trend: "+15%",
          trendUp: true,
        },
        {
          id: "orders7d",
          label: "近7天订单",
          value: 1256,
          icon: ShoppingCart,
          color: "text-blue-600",
          trend: "+8%",
          trendUp: true,
        },
      ]
    }

    // 默认：我的概览
    return [...baseCards, ...sampleCards.slice(0, 2), ...channelCards.slice(0, 2)]
  }, [roleView])

  // 过滤待办
  const filteredTodos = useMemo(() => {
    if (todoFilter === "全部") return mockTodos
    if (todoFilter === "仅超期") return mockTodos.filter((t) => t.isOverdue)
    if (todoFilter === "今日到期") return mockTodos.filter((t) => t.dueAt.startsWith("2026-01-13"))
    if (todoFilter === "需审核") return mockTodos.filter((t) => t.status === "需审核")
    return mockTodos
  }, [todoFilter])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold">概览看板</h1>
                {/* 视图选择 */}
                <Tabs value={roleView} onValueChange={(v) => setRoleView(v as RoleView)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="my" className="text-xs px-3 h-7">
                      我的概览
                    </TabsTrigger>
                    <TabsTrigger value="manager" className="text-xs px-3 h-7">
                      管理概览
                    </TabsTrigger>
                    <TabsTrigger value="warehouse" className="text-xs px-3 h-7">
                      仓管概览
                    </TabsTrigger>
                    <TabsTrigger value="channel" className="text-xs px-3 h-7">
                      渠道概览
                    </TabsTrigger>
                    <TabsTrigger value="testing" className="text-xs px-3 h-7">
                      测款概览
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  上次刷新: {new Date(lastRefresh).toLocaleTimeString()}
                </span>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                  刷新
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-1" />
                  导出
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
                  <Settings className="w-4 h-4 mr-1" />
                  配置
                </Button>
                <Popover open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      快捷创建
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleQuickCreate("直播场次")}
                      >
                        <Video className="w-4 h-4 mr-2" />
                        新建直播场次
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleQuickCreate("短视频记录")}
                      >
                        <Tv className="w-4 h-4 mr-2" />
                        新建短视频记录
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleQuickCreate("商品上架")}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        发起商品上架
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleQuickCreate("样衣使用申请")}
                      >
                        <Shirt className="w-4 h-4 mr-2" />
                        发起样衣申请
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleQuickCreate("工作项实例")}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        新建工作项
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* 全局筛选条 */}
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="今天">今天</SelectItem>
                  <SelectItem value="近7天">近7天</SelectItem>
                  <SelectItem value="近30天">近30天</SelectItem>
                  <SelectItem value="自定义">自定义</SelectItem>
                </SelectContent>
              </Select>
              <Select value={site} onValueChange={setSite}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <MapPin className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="全部">全部站点</SelectItem>
                  <SelectItem value="深圳">深圳</SelectItem>
                  <SelectItem value="雅加达">雅加达</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <Store className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="全部">全部渠道</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="Shopee">Shopee</SelectItem>
                  <SelectItem value="Lazada">Lazada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={store} onValueChange={setStore}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <Building2 className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="全部">全部店铺</SelectItem>
                  <SelectItem value="印尼旗舰店">印尼旗舰店</SelectItem>
                  <SelectItem value="马来主店">马来主店</SelectItem>
                  <SelectItem value="菲律宾店">菲律宾店</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setShowMoreFilters(!showMoreFilters)}
              >
                {showMoreFilters ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                {showMoreFilters ? "收起" : "更多筛选"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-transparent"
                onClick={() => {
                  setDateRange("近7天")
                  setSite("全部")
                  setTeam("全部")
                  setChannel("全部")
                  setStore("全部")
                  setProjectPhase("全部")
                }}
              >
                重置
              </Button>
            </div>
            {showMoreFilters && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <Select value={team} onValueChange={setTeam}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部团队</SelectItem>
                    <SelectItem value="测款">测款</SelectItem>
                    <SelectItem value="版房">版房</SelectItem>
                    <SelectItem value="渠道">渠道</SelectItem>
                    <SelectItem value="仓库">仓库</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={projectPhase} onValueChange={setProjectPhase}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <Layers className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部阶段</SelectItem>
                    <SelectItem value="测款中">测款中</SelectItem>
                    <SelectItem value="制版准备">制版准备</SelectItem>
                    <SelectItem value="首单">首单</SelectItem>
                    <SelectItem value="产前">产前</SelectItem>
                    <SelectItem value="上架">上架</SelectItem>
                    <SelectItem value="在售">在售</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* 主体内容 */}
          <div className="p-6 space-y-6">
            {/* KPI 总览区 */}
            {dashboardConfig.components.find((c) => c.id === "kpi")?.enabled && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {kpiCards.map((card) => (
                  <Card
                    key={card.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${card.isWarning ? "border-red-200 bg-red-50/30" : ""}`}
                    onClick={() => handleDrillDown(card.label)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <card.icon className={`w-5 h-5 ${card.color}`} />
                        <div className="flex items-center gap-1 text-xs">
                          {card.trendUp ? (
                            <TrendingUp className="w-3 h-3 text-green-600" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-600" />
                          )}
                          <span className={card.trendUp ? "text-green-600" : "text-red-600"}>{card.trend}</span>
                        </div>
                      </div>
                      <p className="text-2xl font-bold">{typeof card.value === "number" ? card.value : card.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* 异常与待办区 */}
            {dashboardConfig.components.find((c) => c.id === "exceptions")?.enabled && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 异常 TopN */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        异常监控
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleDrillDown("异常中心")}
                      >
                        查看全部 <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {mockExceptions.slice(0, 4).map((exc) => (
                      <div key={exc.type} className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={exc.count > 3 ? "destructive" : "secondary"} className="text-xs">
                              {exc.type}
                            </Badge>
                            <span className="text-sm font-medium">{exc.count}项</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => handleDrillDown(exc.type)}
                          >
                            处理
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {exc.items.slice(0, 2).map((item: any, idx) => (
                            <p key={idx} className="text-xs text-muted-foreground truncate">
                              • {item.title || item.sampleCode || item.storeName || item.productName || item.name}
                              {item.overdueDays && <span className="text-red-600 ml-1">逾期{item.overdueDays}天</span>}
                            </p>
                          ))}
                          {exc.items.length > 2 && (
                            <p className="text-xs text-muted-foreground">...还有{exc.items.length - 2}项</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* 我的待办 */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                        我的待办
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Select value={todoFilter} onValueChange={setTodoFilter}>
                          <SelectTrigger className="w-24 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="全部">全部</SelectItem>
                            <SelectItem value="仅超期">仅超期</SelectItem>
                            <SelectItem value="今日到期">今日到期</SelectItem>
                            <SelectItem value="需审核">需审核</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-16">类型</TableHead>
                          <TableHead className="text-xs">标题</TableHead>
                          <TableHead className="text-xs w-28">截止时间</TableHead>
                          <TableHead className="text-xs w-16">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTodos.map((todo) => (
                          <TableRow key={todo.id} className={todo.isOverdue ? "bg-red-50/50" : ""}>
                            <TableCell className="py-2">
                              <Badge variant="outline" className="text-[10px]">
                                {todo.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2">
                              <div>
                                <p className="text-sm font-medium">{todo.title}</p>
                                <p className="text-xs text-muted-foreground">{todo.projectName}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              <span
                                className={`text-xs ${todo.isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}
                              >
                                {todo.dueAt}
                              </span>
                            </TableCell>
                            <TableCell className="py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => handleDrillDown(todo.title)}
                              >
                                打开
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 项目与工作项推进区 */}
            {dashboardConfig.components.find((c) => c.id === "projects")?.enabled && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 项目阶段漏斗 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      项目阶段分布
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {projectFunnel.map((stage, idx) => (
                        <div
                          key={stage.phase}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleDrillDown("商品项目列表", `阶段=${stage.phase}`)}
                        >
                          <div
                            className="h-8 rounded flex items-center justify-center text-white text-xs font-medium"
                            style={{
                              width: `${Math.max(30, (stage.count / 15) * 100)}%`,
                              backgroundColor: COLORS[idx % COLORS.length],
                            }}
                          >
                            {stage.count}
                          </div>
                          <div className="flex-1 flex items-center justify-between">
                            <span className="text-xs">{stage.phase}</span>
                            {stage.blocked > 0 && (
                              <Badge variant="destructive" className="text-[10px]">
                                阻塞{stage.blocked}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 工作项看板 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-600" />
                      工作项状态分布
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] w-20">类型</TableHead>
                            <TableHead className="text-[10px] text-center">未开始</TableHead>
                            <TableHead className="text-[10px] text-center">进行中</TableHead>
                            <TableHead className="text-[10px] text-center">阻塞</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.keys(workItemKanban.NOT_STARTED)
                            .slice(0, 5)
                            .map((type) => (
                              <TableRow key={type}>
                                <TableCell className="py-1 text-xs">{type}</TableCell>
                                <TableCell className="py-1 text-center">
                                  <Badge variant="outline" className="text-[10px]">
                                    {workItemKanban.NOT_STARTED[type as keyof typeof workItemKanban.NOT_STARTED]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-1 text-center">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {workItemKanban.IN_PROGRESS[type as keyof typeof workItemKanban.IN_PROGRESS]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-1 text-center">
                                  {workItemKanban.BLOCKED[type as keyof typeof workItemKanban.BLOCKED] > 0 ? (
                                    <Badge variant="destructive" className="text-[10px]">
                                      {workItemKanban.BLOCKED[type as keyof typeof workItemKanban.BLOCKED]}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Top风险项目 */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        风险项目
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleDrillDown("商品项目列表", "风险项目")}
                      >
                        查看全部
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {topRiskProjects.map((project) => (
                      <div
                        key={project.id}
                        className="p-3 rounded-lg border border-red-200 bg-red-50/30 cursor-pointer hover:bg-red-50/50"
                        onClick={() => handleDrillDown("项目详情", project.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{project.name}</span>
                          <span className="text-xs text-muted-foreground">风险分: {project.riskScore}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          阶段: {project.phase} | 负责人: {project.owner}
                        </p>
                        <div className="flex items-center gap-1">
                          {project.riskTags.map((tag) => (
                            <Badge key={tag} variant="destructive" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 样衣资产与流转区 */}
            {dashboardConfig.components.find((c) => c.id === "samples")?.enabled && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 样衣资产分布（双站点） */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Shirt className="w-4 h-4 text-green-600" />
                        样衣资产分布
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleDrillDown("样衣库存")}
                      >
                        查看全部
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {/* 深圳 */}
                      <div className="p-3 rounded-lg border">
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          深圳
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>在库</span>
                            <span className="font-medium">{sampleDistribution.shenzhen.onHand}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>预占</span>
                            <span className="font-medium">{sampleDistribution.shenzhen.reserved}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>领用中</span>
                            <span className="font-medium">{sampleDistribution.shenzhen.borrowed}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>在途</span>
                            <span className="font-medium">{sampleDistribution.shenzhen.inTransit}</span>
                          </div>
                        </div>
                      </div>
                      {/* 雅加达 */}
                      <div className="p-3 rounded-lg border">
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          雅加达
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>在库</span>
                            <span className="font-medium">{sampleDistribution.jakarta.onHand}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>预占</span>
                            <span className="font-medium">{sampleDistribution.jakarta.reserved}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>领用中</span>
                            <span className="font-medium">{sampleDistribution.jakarta.borrowed}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>在途</span>
                            <span className="font-medium">{sampleDistribution.jakarta.inTransit}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 仓管待处理（仓管视图置顶） */}
                <Card className={roleView === "warehouse" ? "border-amber-300 bg-amber-50/30" : ""}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-amber-600" />
                      仓管待处理
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        待到样签收 ({warehouseTodos.pendingReceipt.length})
                      </p>
                      {warehouseTodos.pendingReceipt.slice(0, 2).map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <div>
                            <p className="text-xs">
                              {item.source} - {item.trackingNo}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              预计: {item.expectedAt} | {item.site}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs bg-transparent"
                            onClick={() => handleDrillDown("到样签收", item.id)}
                          >
                            签收
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        待核对入库 ({warehouseTodos.pendingStockIn.length})
                      </p>
                      {warehouseTodos.pendingStockIn.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <div>
                            <p className="text-xs">
                              {item.source} - {item.sampleCount}件
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              签收: {item.receivedAt} | {item.site}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs bg-transparent"
                            onClick={() => handleDrillDown("核对入库", item.id)}
                          >
                            入库
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 超期未归还样衣 */}
                <Card className="border-red-200 bg-red-50/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Timer className="w-4 h-4 text-red-600" />
                        超期未归还
                      </CardTitle>
                      <Badge variant="destructive" className="text-xs">
                        {overdueReturns.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {overdueReturns.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded border border-red-200 bg-white cursor-pointer hover:bg-red-50/50"
                        onClick={() => handleDrillDown("样衣使用申请", item.sampleCode)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{item.sampleCode}</span>
                          <Badge variant="destructive" className="text-[10px]">
                            逾期{item.overdueDays}天
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">领用人: {item.borrower}</p>
                        <p className="text-xs text-muted-foreground">当前位置: {item.location}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 渠道与内容区 */}
            {dashboardConfig.components.find((c) => c.id === "channels")?.enabled && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* 店铺健康 */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Store className="w-4 h-4 text-blue-600" />
                        店铺授权
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleDrillDown("渠道店铺管理")}
                      >
                        全部
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {storeHealth
                      .filter((s) => s.authStatus !== "CONNECTED")
                      .slice(0, 3)
                      .map((store) => (
                        <div
                          key={store.id}
                          className="p-2 rounded border cursor-pointer hover:bg-muted/50"
                          onClick={() => handleDrillDown("店铺详情", store.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{store.store}</span>
                            <Badge
                              variant={
                                store.authStatus === "EXPIRED" || store.authStatus === "FAILED"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {store.authStatus === "EXPIRING"
                                ? "即将过期"
                                : store.authStatus === "EXPIRED"
                                  ? "已过期"
                                  : "连接失败"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {store.channel} | 到期: {store.expireAt}
                          </p>
                        </div>
                      ))}
                  </CardContent>
                </Card>

                {/* 上架推进 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Upload className="w-4 h-4 text-purple-600" />
                      上架推进
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center p-2 rounded bg-blue-50">
                        <p className="text-lg font-bold text-blue-600">{listingPipeline.inProgress}</p>
                        <p className="text-[10px] text-muted-foreground">上架中</p>
                      </div>
                      <div className="text-center p-2 rounded bg-amber-50">
                        <p className="text-lg font-bold text-amber-600">{listingPipeline.pendingReview}</p>
                        <p className="text-[10px] text-muted-foreground">待审核</p>
                      </div>
                      <div className="text-center p-2 rounded bg-red-50">
                        <p className="text-lg font-bold text-red-600">{listingPipeline.failed}</p>
                        <p className="text-[10px] text-muted-foreground">失败</p>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">最近失败</p>
                    {listingPipeline.recentFailed.slice(0, 2).map((item) => (
                      <div key={item.id} className="py-1.5 border-b last:border-0">
                        <p className="text-xs">{item.product}</p>
                        <p className="text-[10px] text-red-600">{item.reason}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* 映射健康 */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-orange-600" />
                        映射健康
                      </CardTitle>
                      <Badge variant={mappingHealth.abnormal > 0 ? "destructive" : "secondary"} className="text-xs">
                        异常 {mappingHealth.abnormal}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {mappingHealth.items.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded border border-orange-200 bg-orange-50/30 cursor-pointer hover:bg-orange-50/50"
                        onClick={() => handleDrillDown("映射管理", item.platformId)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium truncate">{item.platformId}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {item.issue}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{item.store}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* 内容与入账 */}
                <Card className={roleView === "testing" ? "border-pink-300 bg-pink-50/30" : ""}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Video className="w-4 h-4 text-pink-600" />
                      测款入账
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="text-center p-2 rounded bg-pink-50">
                        <p className="text-lg font-bold text-pink-600">
                          {contentAccounting.liveSessions.pendingAccounting}
                        </p>
                        <p className="text-[10px] text-muted-foreground">直播待入账</p>
                      </div>
                      <div className="text-center p-2 rounded bg-purple-50">
                        <p className="text-lg font-bold text-purple-600">
                          {contentAccounting.shortVideos.pendingAccounting}
                        </p>
                        <p className="text-[10px] text-muted-foreground">短视频待入账</p>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">待处理</p>
                    {contentAccounting.pendingItems.slice(0, 2).map((item) => (
                      <div
                        key={item.id}
                        className="py-1.5 border-b last:border-0 cursor-pointer hover:bg-muted/50"
                        onClick={() => handleDrillDown("入账面板", item.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs">{item.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {item.type}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          TEST条目: {item.testItems} | {item.owner}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* DB2: 看板配置抽屉 */}
      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent className="w-[400px]">
          <SheetHeader>
            <SheetTitle>看板配置</SheetTitle>
            <SheetDescription>自定义看板组件显示和默认筛选条件</SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-6">
            <div>
              <Label className="text-sm font-medium">组件开关与排序</Label>
              <div className="mt-3 space-y-2">
                {dashboardConfig.components.map((comp) => (
                  <div key={comp.id} className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">{comp.label}</span>
                    <Switch
                      checked={comp.enabled}
                      onCheckedChange={(checked) => {
                        setDashboardConfig((prev) => ({
                          ...prev,
                          components: prev.components.map((c) => (c.id === comp.id ? { ...c, enabled: checked } : c)),
                        }))
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">默认筛选条件</Label>
              <div className="mt-3 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">日期范围</Label>
                  <Select
                    value={dashboardConfig.defaultFilters.dateRange}
                    onValueChange={(v) =>
                      setDashboardConfig((prev) => ({
                        ...prev,
                        defaultFilters: { ...prev.defaultFilters, dateRange: v },
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="今天">今天</SelectItem>
                      <SelectItem value="近7天">近7天</SelectItem>
                      <SelectItem value="近30天">近30天</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">默认站点</Label>
                  <Select
                    value={dashboardConfig.defaultFilters.site}
                    onValueChange={(v) =>
                      setDashboardConfig((prev) => ({
                        ...prev,
                        defaultFilters: { ...prev.defaultFilters, site: v },
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="全部">全部</SelectItem>
                      <SelectItem value="深圳">深圳</SelectItem>
                      <SelectItem value="雅加达">雅加达</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setDashboardConfig(defaultConfig)}>
              恢复默认
            </Button>
            <Button
              onClick={() => {
                setConfigOpen(false)
                toast({ title: "配置已保存" })
              }}
            >
              保存配置
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
