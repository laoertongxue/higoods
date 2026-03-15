"use client"

import { useState, useMemo } from "react"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  RefreshCw,
  Download,
  Settings2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Shield,
  Package,
  Store,
  GitBranch,
  Receipt,
  User,
  Calendar,
  FolderKanban,
  ExternalLink,
  Copy,
  Inbox,
  AlertCircle,
  Timer,
  XCircle,
  ArrowRight,
  MoreHorizontal,
  GripVertical,
} from "lucide-react"
import Link from "next/link"

// 待办类型枚举
const TODO_TYPES = {
  WORK_ITEM: { label: "工作项", icon: FileText, color: "bg-blue-100 text-blue-700" },
  APPROVAL: { label: "审核", icon: Shield, color: "bg-purple-100 text-purple-700" },
  SAMPLE: { label: "样衣", icon: Package, color: "bg-amber-100 text-amber-700" },
  LISTING: { label: "上架", icon: Store, color: "bg-green-100 text-green-700" },
  STORE_AUTH: { label: "店铺授权", icon: Store, color: "bg-red-100 text-red-700" },
  MAPPING: { label: "映射", icon: GitBranch, color: "bg-cyan-100 text-cyan-700" },
  TEST_ACCOUNTING: { label: "入账", icon: Receipt, color: "bg-pink-100 text-pink-700" },
}

// 优先级枚举
const PRIORITIES = {
  P0: { label: "P0 紧急", color: "bg-red-500 text-white", description: "已逾期/阻塞/失败/授权过期" },
  P1: { label: "P1 高", color: "bg-orange-500 text-white", description: "今天到期/授权将过期" },
  P2: { label: "P2 中", color: "bg-yellow-500 text-white", description: "本周到期" },
  P3: { label: "P3 低", color: "bg-gray-400 text-white", description: "普通待处理" },
}

// 角色枚举
const ROLES = {
  PM: { label: "项目负责人", defaultTab: "all", defaultQueue: "today" },
  TESTING: { label: "测款团队", defaultTab: "accounting", defaultQueue: "accounting_pending" },
  PATTERN: { label: "版房/制版/花型", defaultTab: "mine", defaultQueue: "work_items" },
  CHANNEL: { label: "渠道运营", defaultTab: "channel", defaultQueue: "auth_error" },
  WAREHOUSE: { label: "仓管", defaultTab: "warehouse", defaultQueue: "to_receive" },
  MANAGER: { label: "管理层", defaultTab: "approval", defaultQueue: "urgent" },
}

// 队列定义
const QUEUES = {
  // 通用队列
  urgent: { label: "P0 紧急", icon: AlertCircle, roles: ["all"] },
  today: { label: "今日到期", icon: Timer, roles: ["all"] },
  this_week: { label: "本周到期", icon: Calendar, roles: ["all"] },
  approval: { label: "待我审核", icon: Shield, roles: ["all"] },
  // 仓管队列
  to_receive: { label: "待到样签收", icon: Package, roles: ["WAREHOUSE"] },
  to_stock_in: { label: "待核对入库", icon: Package, roles: ["WAREHOUSE"] },
  to_ship: { label: "待寄出", icon: Package, roles: ["WAREHOUSE"] },
  to_confirm: { label: "待签收", icon: Package, roles: ["WAREHOUSE"] },
  to_dispose: { label: "待处置", icon: Package, roles: ["WAREHOUSE"] },
  return_processing: { label: "退货处理中", icon: Package, roles: ["WAREHOUSE"] },
  // 渠道队列
  auth_error: { label: "店铺授权异常", icon: AlertTriangle, roles: ["CHANNEL"] },
  listing_failed: { label: "上架失败", icon: XCircle, roles: ["CHANNEL"] },
  listing_pending: { label: "上架中待跟进", icon: Clock, roles: ["CHANNEL"] },
  mapping_error: { label: "映射异常", icon: GitBranch, roles: ["CHANNEL"] },
  // 测款队列
  live_accounting: { label: "直播待入账", icon: Receipt, roles: ["TESTING"] },
  video_accounting: { label: "短视频待入账", icon: Receipt, roles: ["TESTING"] },
  test_decision: { label: "测款结论待决策", icon: FileText, roles: ["TESTING"] },
}

// Mock待办数据
const mockTodos = [
  // 工作项类型
  {
    id: "TD-001",
    todo_type: "WORK_ITEM",
    title: "改版任务：V领印花连衣裙-袖笼弧线优化",
    source_type: "RevisionTask",
    source_id: "RT-20260115-001",
    source_code: "RT-20260115-001",
    source_status: "进行中",
    priority: "P1",
    due_at: "2026-01-14",
    overdue_days: 0,
    owner: "王版师",
    assignee: "王版师",
    project: "印尼风格碎花连衣裙",
    project_id: "PRJ-20251216-001",
    phase: "制版与生产准备",
    site: "深圳",
    primary_action: { label: "去处理", url: "/patterns/revision" },
    secondary_actions: [{ label: "提交评审", code: "submit_review" }],
    created_at: "2026-01-10 09:00",
    tags: ["改版", "制版"],
  },
  {
    id: "TD-002",
    todo_type: "WORK_ITEM",
    title: "花型任务：热带花卉印花-色彩方案确认",
    source_type: "ArtworkTask",
    source_id: "AT-20260112-001",
    source_code: "AT-20260112-001",
    source_status: "待评审",
    priority: "P0",
    due_at: "2026-01-13",
    overdue_days: 1,
    owner: "花型设计师",
    assignee: "花型设计师",
    project: "印尼风格碎花连衣裙",
    project_id: "PRJ-20251216-001",
    phase: "制版与生产准备",
    site: "深圳",
    primary_action: { label: "去处理", url: "/patterns/colors" },
    secondary_actions: [{ label: "冻结通过", code: "freeze" }],
    created_at: "2026-01-08 10:30",
    tags: ["花型", "设计"],
  },
  // 审核类型
  {
    id: "TD-003",
    todo_type: "APPROVAL",
    title: "审核：首单样衣打样-FS-20260110-001",
    source_type: "FirstSampleTask",
    source_id: "FS-20260110-001",
    source_code: "FS-20260110-001",
    source_status: "待审核",
    priority: "P1",
    due_at: "2026-01-14",
    overdue_days: 0,
    owner: "李明",
    reviewer: "张经理",
    project: "基础款白色T恤",
    project_id: "PRJ-20251218-002",
    phase: "制版与生产准备",
    site: "深圳",
    primary_action: { label: "去审核", url: "/samples/first-order/FS-20260110-001" },
    secondary_actions: [
      { label: "同意", code: "approve" },
      { label: "驳回", code: "reject" },
    ],
    created_at: "2026-01-12 14:00",
    tags: ["审核", "打样"],
  },
  // 样衣类型 - 仓管
  {
    id: "TD-004",
    todo_type: "SAMPLE",
    title: "待到样签收：样衣 SMP-20260108-001",
    source_type: "SampleAsset",
    source_id: "SMP-20260108-001",
    source_code: "SMP-20260108-001",
    source_status: "在途",
    priority: "P1",
    due_at: "2026-01-14",
    overdue_days: 0,
    owner: "仓管员A",
    handler: "仓管员A",
    site: "深圳",
    warehouse: "深圳样衣仓",
    sample_count: 3,
    primary_action: { label: "到样签收", url: "/samples/inventory" },
    secondary_actions: [],
    created_at: "2026-01-10 08:00",
    tags: ["样衣", "签收"],
  },
  {
    id: "TD-005",
    todo_type: "SAMPLE",
    title: "待核对入库：样衣 SMP-20260105-002",
    source_type: "SampleAsset",
    source_id: "SMP-20260105-002",
    source_code: "SMP-20260105-002",
    source_status: "已签收待入库",
    priority: "P2",
    due_at: "2026-01-15",
    overdue_days: 0,
    owner: "仓管员A",
    handler: "仓管员A",
    site: "深圳",
    warehouse: "深圳样衣仓",
    sample_count: 2,
    primary_action: { label: "核对入库", url: "/samples/inventory" },
    secondary_actions: [],
    created_at: "2026-01-08 16:00",
    tags: ["样衣", "入库"],
  },
  {
    id: "TD-006",
    todo_type: "SAMPLE",
    title: "超期未归还：样衣 SMP-20251220-003",
    source_type: "SampleAsset",
    source_id: "SMP-20251220-003",
    source_code: "SMP-20251220-003",
    source_status: "使用中",
    priority: "P0",
    due_at: "2026-01-10",
    overdue_days: 4,
    owner: "测款团队A",
    handler: "测款团队A",
    site: "雅加达",
    expected_return: "2026-01-10",
    primary_action: { label: "发起归还", url: "/samples/application" },
    secondary_actions: [],
    created_at: "2025-12-20 10:00",
    tags: ["样衣", "逾期"],
  },
  // 测款入账类型
  {
    id: "TD-007",
    todo_type: "TEST_ACCOUNTING",
    title: "直播待入账：LS-20260112-001 印尼专场",
    source_type: "LiveSession",
    source_id: "LS-20260112-001",
    source_code: "LS-20260112-001",
    source_status: "已关账",
    priority: "P1",
    due_at: "2026-01-14",
    overdue_days: 0,
    owner: "直播运营A",
    account: "@indo_fashion",
    host: "小美",
    test_items: 5,
    accounting_status: "PENDING",
    primary_action: { label: "去入账", url: "/testing/live/LS-20260112-001" },
    secondary_actions: [],
    created_at: "2026-01-12 22:00",
    tags: ["直播", "入账"],
  },
  {
    id: "TD-008",
    todo_type: "TEST_ACCOUNTING",
    title: "短视频待入账：SV-20260111-002 穿搭分享",
    source_type: "ShortVideoRecord",
    source_id: "SV-20260111-002",
    source_code: "SV-20260111-002",
    source_status: "已关账",
    priority: "P2",
    due_at: "2026-01-16",
    overdue_days: 0,
    owner: "短视频运营B",
    account: "@fashion_daily",
    test_items: 3,
    accounting_status: "PENDING",
    primary_action: { label: "去入账", url: "/testing/video/SV-20260111-002" },
    secondary_actions: [],
    created_at: "2026-01-11 18:00",
    tags: ["短视频", "入账"],
  },
  // 店铺授权类型
  {
    id: "TD-009",
    todo_type: "STORE_AUTH",
    title: "授权将过期：TikTok Shop Indo-01",
    source_type: "ChannelStore",
    source_id: "STORE-TK-001",
    source_code: "STORE-TK-001",
    source_status: "授权将过期",
    priority: "P1",
    due_at: "2026-01-20",
    overdue_days: 0,
    owner: "渠道运营A",
    channel: "TikTok",
    store_name: "Indo Fashion Official",
    expire_in_days: 6,
    primary_action: { label: "去授权", url: "/channels/stores/STORE-TK-001" },
    secondary_actions: [{ label: "刷新授权", code: "refresh" }],
    created_at: "2026-01-10 09:00",
    tags: ["店铺", "授权"],
  },
  {
    id: "TD-010",
    todo_type: "STORE_AUTH",
    title: "授权已过期：Shopee MY-02",
    source_type: "ChannelStore",
    source_id: "STORE-SP-002",
    source_code: "STORE-SP-002",
    source_status: "授权已过期",
    priority: "P0",
    due_at: "2026-01-12",
    overdue_days: 2,
    owner: "渠道运营B",
    channel: "Shopee",
    store_name: "Fashion Hub MY",
    primary_action: { label: "去授权", url: "/channels/stores/STORE-SP-002" },
    secondary_actions: [],
    created_at: "2026-01-08 10:00",
    tags: ["店铺", "过期"],
  },
  // 映射异常类型
  {
    id: "TD-011",
    todo_type: "MAPPING",
    title: "映射异常：SKU缺失 - CP-20260110-001",
    source_type: "ChannelProduct",
    source_id: "CP-20260110-001",
    source_code: "CP-20260110-001",
    source_status: "映射不完整",
    priority: "P2",
    due_at: null,
    overdue_days: 0,
    owner: "渠道运营A",
    channel: "TikTok",
    store: "Indo Fashion Official",
    platform_id: "TK-12345678",
    missing_skus: 2,
    primary_action: { label: "去修复", url: "/channels/products/mapping" },
    secondary_actions: [],
    created_at: "2026-01-10 14:00",
    tags: ["映射", "SKU"],
  },
  {
    id: "TD-012",
    todo_type: "MAPPING",
    title: "映射冲突：编码重复 - CP-20260109-003",
    source_type: "CodeMapping",
    source_id: "MAP-CONFLICT-001",
    source_code: "MAP-CONFLICT-001",
    source_status: "冲突待处理",
    priority: "P1",
    due_at: "2026-01-14",
    overdue_days: 0,
    owner: "渠道运营B",
    channel: "Shopee",
    conflict_type: "duplicate_barcode",
    primary_action: { label: "去修复", url: "/channels/products/mapping" },
    secondary_actions: [],
    created_at: "2026-01-09 11:00",
    tags: ["映射", "冲突"],
  },
  // 更多工作项
  {
    id: "TD-013",
    todo_type: "WORK_ITEM",
    title: "制版任务：夏季牛仔短裤-初版制版",
    source_type: "PatternTask",
    source_id: "PT-20260108-001",
    source_code: "PT-20260108-001",
    source_status: "未开始",
    priority: "P3",
    due_at: "2026-01-18",
    overdue_days: 0,
    owner: "王版师",
    assignee: "王版师",
    project: "夏季牛仔短裤",
    project_id: "PRJ-20251215-003",
    phase: "制版与生产准备",
    site: "深圳",
    primary_action: { label: "去处理", url: "/patterns" },
    secondary_actions: [{ label: "开始", code: "start" }],
    created_at: "2026-01-08 09:00",
    tags: ["制版"],
  },
  {
    id: "TD-014",
    todo_type: "WORK_ITEM",
    title: "产前版样衣：复古风皮夹克-产前验收",
    source_type: "PreProductionSample",
    source_id: "PP-20260105-001",
    source_code: "PP-20260105-001",
    source_status: "验收中",
    priority: "P2",
    due_at: "2026-01-16",
    overdue_days: 0,
    owner: "李品控",
    assignee: "李品控",
    project: "复古风皮夹克",
    project_id: "PRJ-20251210-004",
    phase: "制版与生产准备",
    site: "深圳",
    primary_action: { label: "去处理", url: "/production/pre-check/PP-20260105-001" },
    secondary_actions: [{ label: "填写结论", code: "conclusion" }],
    created_at: "2026-01-05 14:00",
    tags: ["产前", "验收"],
  },
  // 上架类型
  {
    id: "TD-015",
    todo_type: "LISTING",
    title: "上架失败：基础款白色T恤-TikTok",
    source_type: "ListingTask",
    source_id: "LT-20260112-001",
    source_code: "LT-20260112-001",
    source_status: "上架失败",
    priority: "P0",
    due_at: "2026-01-14",
    overdue_days: 0,
    owner: "渠道运营A",
    channel: "TikTok",
    store: "Indo Fashion Official",
    fail_reason: "图片尺寸不符合要求",
    primary_action: { label: "去处理", url: "/channels/products/CP-20260112-001" },
    secondary_actions: [{ label: "重新上架", code: "retry" }],
    created_at: "2026-01-12 16:00",
    tags: ["上架", "失败"],
  },
]

export default function MyInboxPage() {
  const { toast } = useToast()
  const [currentRole, setCurrentRole] = useState<keyof typeof ROLES>("PM")
  const [activeTab, setActiveTab] = useState("all")
  const [activeQueue, setActiveQueue] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [siteFilter, setSiteFilter] = useState("all")
  const [selectedTodos, setSelectedTodos] = useState<string[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<(typeof mockTodos)[0] | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // 视图配置
  const [viewConfig, setViewConfig] = useState({
    showQueue: true,
    components: [
      { id: "kpi", label: "KPI统计", enabled: true },
      { id: "queue", label: "队列导航", enabled: true },
      { id: "list", label: "待办列表", enabled: true },
    ],
    defaultFilters: {
      site: "all",
      priority: "all",
    },
  })

  // 获取当前角色可见的队列
  const visibleQueues = useMemo(() => {
    return Object.entries(QUEUES).filter(
      ([_, queue]) => queue.roles.includes("all") || queue.roles.includes(currentRole),
    )
  }, [currentRole])

  // 筛选待办
  const filteredTodos = useMemo(() => {
    let result = [...mockTodos]

    // Tab筛选
    if (activeTab === "mine") {
      result = result.filter((t) => t.todo_type === "WORK_ITEM")
    } else if (activeTab === "approval") {
      result = result.filter((t) => t.todo_type === "APPROVAL")
    } else if (activeTab === "overdue") {
      result = result.filter((t) => t.overdue_days > 0)
    } else if (activeTab === "blocked") {
      result = result.filter((t) => t.source_status === "阻塞" || t.source_status === "上架失败")
    } else if (activeTab === "warehouse") {
      result = result.filter((t) => t.todo_type === "SAMPLE")
    } else if (activeTab === "channel") {
      result = result.filter((t) => ["STORE_AUTH", "MAPPING", "LISTING"].includes(t.todo_type))
    } else if (activeTab === "accounting") {
      result = result.filter((t) => t.todo_type === "TEST_ACCOUNTING")
    }

    // 队列筛选
    if (activeQueue) {
      if (activeQueue === "urgent") {
        result = result.filter((t) => t.priority === "P0")
      } else if (activeQueue === "today") {
        result = result.filter((t) => t.due_at === "2026-01-14")
      } else if (activeQueue === "this_week") {
        result = result.filter((t) => t.due_at && t.due_at >= "2026-01-14" && t.due_at <= "2026-01-20")
      } else if (activeQueue === "approval") {
        result = result.filter((t) => t.todo_type === "APPROVAL")
      } else if (activeQueue === "to_receive") {
        result = result.filter((t) => t.title.includes("待到样签收"))
      } else if (activeQueue === "to_stock_in") {
        result = result.filter((t) => t.title.includes("待核对入库"))
      } else if (activeQueue === "auth_error") {
        result = result.filter((t) => t.todo_type === "STORE_AUTH")
      } else if (activeQueue === "listing_failed") {
        result = result.filter((t) => t.source_status === "上架失败")
      } else if (activeQueue === "mapping_error") {
        result = result.filter((t) => t.todo_type === "MAPPING")
      } else if (activeQueue === "live_accounting") {
        result = result.filter((t) => t.source_type === "LiveSession")
      } else if (activeQueue === "video_accounting") {
        result = result.filter((t) => t.source_type === "ShortVideoRecord")
      }
    }

    // 搜索筛选
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.source_code.toLowerCase().includes(term) ||
          (t.project && t.project.toLowerCase().includes(term)),
      )
    }

    // 类型筛选
    if (typeFilter !== "all") {
      result = result.filter((t) => t.todo_type === typeFilter)
    }

    // 优先级筛选
    if (priorityFilter !== "all") {
      result = result.filter((t) => t.priority === priorityFilter)
    }

    // 站点筛选
    if (siteFilter !== "all") {
      result = result.filter((t) => t.site === siteFilter)
    }

    // 排序：优先级 > 截止时间 > 创建时间
    result.sort((a, b) => {
      const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 }
      if (
        priorityOrder[a.priority as keyof typeof priorityOrder] !==
        priorityOrder[b.priority as keyof typeof priorityOrder]
      ) {
        return (
          priorityOrder[a.priority as keyof typeof priorityOrder] -
          priorityOrder[b.priority as keyof typeof priorityOrder]
        )
      }
      if (a.due_at && b.due_at) {
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    return result
  }, [activeTab, activeQueue, searchTerm, typeFilter, priorityFilter, siteFilter])

  // 统计
  const stats = useMemo(
    () => ({
      total: mockTodos.length,
      p0: mockTodos.filter((t) => t.priority === "P0").length,
      p1: mockTodos.filter((t) => t.priority === "P1").length,
      overdue: mockTodos.filter((t) => t.overdue_days > 0).length,
      approval: mockTodos.filter((t) => t.todo_type === "APPROVAL").length,
      sample: mockTodos.filter((t) => t.todo_type === "SAMPLE").length,
      accounting: mockTodos.filter((t) => t.todo_type === "TEST_ACCOUNTING").length,
      channel: mockTodos.filter((t) => ["STORE_AUTH", "MAPPING", "LISTING"].includes(t.todo_type)).length,
    }),
    [],
  )

  const handleRefresh = () => {
    setLastRefresh(new Date())
    toast({ title: "刷新成功", description: "待办列表已更新" })
  }

  const handleOpenDetail = (todo: (typeof mockTodos)[0]) => {
    setSelectedTodo(todo)
    setDetailOpen(true)
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast({ title: "已复制", description: code })
  }

  const toggleSelectTodo = (id: string) => {
    setSelectedTodos((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (selectedTodos.length === filteredTodos.length) {
      setSelectedTodos([])
    } else {
      setSelectedTodos(filteredTodos.map((t) => t.id))
    }
  }

  // 获取Tab列表（根据角色）
  const getTabs = () => {
    const baseTabs = [
      { id: "all", label: "全部待办" },
      { id: "mine", label: "我负责" },
      { id: "approval", label: "待我审核" },
      { id: "overdue", label: "即将逾期/已逾期" },
      { id: "blocked", label: "阻塞我" },
    ]
    if (currentRole === "WAREHOUSE") {
      baseTabs.push({ id: "warehouse", label: "仓管队列" })
    }
    if (currentRole === "CHANNEL") {
      baseTabs.push({ id: "channel", label: "渠道队列" })
    }
    if (currentRole === "TESTING") {
      baseTabs.push({ id: "accounting", label: "测款入账" })
    }
    return baseTabs
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
              <h1 className="text-2xl font-bold text-foreground">我的待办</h1>
              <p className="text-sm text-muted-foreground mt-1">上次刷新：{lastRefresh.toLocaleTimeString()}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* 角色切换 */}
              <Select value={currentRole} onValueChange={(v) => setCurrentRole(v as keyof typeof ROLES)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([key, role]) => (
                    <SelectItem key={key} value={key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-1" />
                刷新
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" />
                导出
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
                <Settings2 className="w-4 h-4 mr-1" />
                视图配置
              </Button>
            </div>
          </div>

          {/* 视图切换Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v)
              setActiveQueue(null)
            }}
          >
            <TabsList className="flex-wrap h-auto gap-1">
              {getTabs().map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-sm">
                  {tab.label}
                  {tab.id === "overdue" && stats.overdue > 0 && (
                    <Badge variant="destructive" className="ml-1 text-xs">
                      {stats.overdue}
                    </Badge>
                  )}
                  {tab.id === "approval" && stats.approval > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {stats.approval}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* 筛选栏 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索标题、编号、项目..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="待办类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    {Object.entries(TODO_TYPES).map(([key, type]) => (
                      <SelectItem key={key} value={key}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="优先级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {Object.entries(PRIORITIES).map(([key, p]) => (
                      <SelectItem key={key} value={key}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={siteFilter} onValueChange={setSiteFilter}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="站点" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部站点</SelectItem>
                    <SelectItem value="深圳">深圳</SelectItem>
                    <SelectItem value="雅加达">雅加达</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("")
                    setTypeFilter("all")
                    setPriorityFilter("all")
                    setSiteFilter("all")
                  }}
                >
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 主体区：队列导航 + 列表 */}
          <div className="flex gap-6">
            {/* 左侧队列导航 */}
            {viewConfig.showQueue && (
              <Card className="w-56 shrink-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">队列</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="space-y-1">
                    <Button
                      variant={activeQueue === null ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm h-8"
                      onClick={() => setActiveQueue(null)}
                    >
                      <Inbox className="w-4 h-4 mr-2" />
                      全部
                      <Badge variant="secondary" className="ml-auto">
                        {mockTodos.length}
                      </Badge>
                    </Button>
                    {visibleQueues.map(([key, queue]) => {
                      const Icon = queue.icon
                      const count =
                        key === "urgent"
                          ? stats.p0
                          : key === "approval"
                            ? stats.approval
                            : key === "to_receive"
                              ? 1
                              : key === "to_stock_in"
                                ? 1
                                : key === "auth_error"
                                  ? 2
                                  : key === "mapping_error"
                                    ? 2
                                    : key === "live_accounting"
                                      ? 1
                                      : key === "video_accounting"
                                        ? 1
                                        : 0
                      return (
                        <Button
                          key={key}
                          variant={activeQueue === key ? "secondary" : "ghost"}
                          className="w-full justify-start text-sm h-8"
                          onClick={() => setActiveQueue(key)}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {queue.label}
                          {count > 0 && (
                            <Badge variant={key === "urgent" ? "destructive" : "secondary"} className="ml-auto">
                              {count}
                            </Badge>
                          )}
                        </Button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 右侧待办列表 */}
            <Card className="flex-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    待办列表
                    <span className="ml-2 text-sm font-normal text-muted-foreground">({filteredTodos.length})</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedTodos.length === filteredTodos.length && filteredTodos.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">全选</span>
                    {selectedTodos.length > 0 && (
                      <Button variant="outline" size="sm" className="ml-2 bg-transparent">
                        批量导出 ({selectedTodos.length})
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredTodos.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-4">当前没有待办</p>
                    <div className="flex justify-center gap-2">
                      <Link href="/testing/live">
                        <Button variant="outline" size="sm">
                          新建直播场次
                        </Button>
                      </Link>
                      <Link href="/channels/products">
                        <Button variant="outline" size="sm">
                          发起上架
                        </Button>
                      </Link>
                      <Link href="/">
                        <Button variant="outline" size="sm">
                          查看项目
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTodos.map((todo) => {
                      const typeInfo = TODO_TYPES[todo.todo_type as keyof typeof TODO_TYPES]
                      const TypeIcon = typeInfo.icon
                      const priorityInfo = PRIORITIES[todo.priority as keyof typeof PRIORITIES]
                      return (
                        <div
                          key={todo.id}
                          className={`p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer ${
                            selectedTodos.includes(todo.id) ? "bg-primary/5 border-primary/30" : ""
                          }`}
                          onClick={() => handleOpenDetail(todo)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedTodos.includes(todo.id)}
                              onCheckedChange={(e) => {
                                e.stopPropagation?.()
                                toggleSelectTodo(todo.id)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge className={priorityInfo.color + " text-xs"}>{todo.priority}</Badge>
                                <Badge variant="outline" className={typeInfo.color + " text-xs border-0"}>
                                  <TypeIcon className="w-3 h-3 mr-1" />
                                  {typeInfo.label}
                                </Badge>
                                <span className="font-medium text-foreground truncate">{todo.title}</span>
                                {todo.overdue_days > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    逾期{todo.overdue_days}天
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {todo.source_code}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {todo.source_status}
                                </Badge>
                                {todo.due_at && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    截止：{todo.due_at}
                                  </span>
                                )}
                                {todo.project && (
                                  <span className="flex items-center gap-1">
                                    <FolderKanban className="w-3 h-3" />
                                    {todo.project}
                                  </span>
                                )}
                                {todo.owner && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {todo.owner}
                                  </span>
                                )}
                                {todo.site && <span>{todo.site}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Link href={todo.primary_action.url} onClick={(e) => e.stopPropagation()}>
                                <Button size="sm">
                                  {todo.primary_action.label}
                                  <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                              </Link>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* TD2: 待办详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          {selectedTodo && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge className={PRIORITIES[selectedTodo.priority as keyof typeof PRIORITIES].color}>
                    {selectedTodo.priority}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={TODO_TYPES[selectedTodo.todo_type as keyof typeof TODO_TYPES].color + " border-0"}
                  >
                    {TODO_TYPES[selectedTodo.todo_type as keyof typeof TODO_TYPES].label}
                  </Badge>
                </div>
                <SheetTitle className="text-left mt-2">{selectedTodo.title}</SheetTitle>
                <SheetDescription className="text-left">
                  {selectedTodo.source_code}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1"
                    onClick={() => handleCopyCode(selectedTodo.source_code)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* 关键字段摘要 */}
                <div>
                  <h4 className="text-sm font-medium mb-3">关键信息</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">状态</span>
                      <p className="font-medium">{selectedTodo.source_status}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">截止时间</span>
                      <p className="font-medium">{selectedTodo.due_at || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">负责人</span>
                      <p className="font-medium">{selectedTodo.owner || selectedTodo.assignee || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">站点</span>
                      <p className="font-medium">{selectedTodo.site || "-"}</p>
                    </div>
                    {selectedTodo.overdue_days > 0 && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">逾期</span>
                        <p className="font-medium text-red-600">{selectedTodo.overdue_days}天</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* 关联对象 */}
                <div>
                  <h4 className="text-sm font-medium mb-3">关联对象</h4>
                  <div className="space-y-2 text-sm">
                    {selectedTodo.project && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">关联项目</span>
                        <Link href={`/projects/${selectedTodo.project_id}`} className="text-primary hover:underline">
                          {selectedTodo.project}
                        </Link>
                      </div>
                    )}
                    {selectedTodo.channel && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">渠道</span>
                        <span>{selectedTodo.channel}</span>
                      </div>
                    )}
                    {selectedTodo.store && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">店铺</span>
                        <span>{selectedTodo.store}</span>
                      </div>
                    )}
                    {selectedTodo.account && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">账号</span>
                        <span>{selectedTodo.account}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* 标签 */}
                <div>
                  <h4 className="text-sm font-medium mb-3">标签</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTodo.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* 最近日志 */}
                <div>
                  <h4 className="text-sm font-medium mb-3">最近动态</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                      <div>
                        <p>创建待办</p>
                        <p className="text-xs text-muted-foreground">{selectedTodo.created_at}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-6">
                <Button variant="outline" onClick={() => handleCopyCode(selectedTodo.source_code)}>
                  <Copy className="w-4 h-4 mr-1" />
                  复制编号
                </Button>
                <Link href={selectedTodo.primary_action.url}>
                  <Button>
                    {selectedTodo.primary_action.label}
                    <ExternalLink className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* TD3: 视图配置抽屉 */}
      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent className="w-[400px] sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle>视图配置</SheetTitle>
            <SheetDescription>自定义待办看板的显示方式</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* 组件开关 */}
            <div>
              <h4 className="text-sm font-medium mb-3">组件显示</h4>
              <div className="space-y-3">
                {viewConfig.components.map((comp) => (
                  <div key={comp.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <Label>{comp.label}</Label>
                    </div>
                    <Switch
                      checked={comp.enabled}
                      onCheckedChange={(checked) => {
                        setViewConfig((prev) => ({
                          ...prev,
                          components: prev.components.map((c) => (c.id === comp.id ? { ...c, enabled: checked } : c)),
                        }))
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* 队列导航开关 */}
            <div className="flex items-center justify-between">
              <Label>显示队列导航</Label>
              <Switch
                checked={viewConfig.showQueue}
                onCheckedChange={(checked) => setViewConfig((prev) => ({ ...prev, showQueue: checked }))}
              />
            </div>

            <Separator />

            {/* 默认筛选 */}
            <div>
              <h4 className="text-sm font-medium mb-3">默认筛选条件</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">默认站点</Label>
                  <Select
                    value={viewConfig.defaultFilters.site}
                    onValueChange={(v) =>
                      setViewConfig((prev) => ({
                        ...prev,
                        defaultFilters: { ...prev.defaultFilters, site: v },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部站点</SelectItem>
                      <SelectItem value="深圳">深圳</SelectItem>
                      <SelectItem value="雅加达">雅加达</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">默认优先级</Label>
                  <Select
                    value={viewConfig.defaultFilters.priority}
                    onValueChange={(v) =>
                      setViewConfig((prev) => ({
                        ...prev,
                        defaultFilters: { ...prev.defaultFilters, priority: v },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="P0">P0 紧急</SelectItem>
                      <SelectItem value="P1">P1 高</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() =>
                setViewConfig({
                  showQueue: true,
                  components: [
                    { id: "kpi", label: "KPI统计", enabled: true },
                    { id: "queue", label: "队列导航", enabled: true },
                    { id: "list", label: "待办列表", enabled: true },
                  ],
                  defaultFilters: { site: "all", priority: "all" },
                })
              }
            >
              恢复默认
            </Button>
            <Button
              onClick={() => {
                setConfigOpen(false)
                toast({ title: "保存成功", description: "视图配置已保存" })
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
