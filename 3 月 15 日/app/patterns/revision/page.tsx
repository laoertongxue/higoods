"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  Search,
  RefreshCw,
  Plus,
  Eye,
  Play,
  Send,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  FileText,
  Package,
  Shirt,
  Upload,
  Paperclip,
  ImageIcon,
  Download,
  ExternalLink,
  Target,
  History,
  Ban,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Clock,
  Snowflake,
  Trash2,
  Edit,
  ListChecks,
  FolderOutput,
  ClipboardList,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// 状态枚举
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: "未开始", color: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "进行中", color: "bg-blue-100 text-blue-700" },
  PENDING_REVIEW: { label: "待评审", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "已确认", color: "bg-green-100 text-green-700" },
  COMPLETED: { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  BLOCKED: { label: "阻塞", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已取消", color: "bg-gray-100 text-gray-500" },
}

// 来源类型
const SOURCE_TYPE_MAP: Record<string, { label: string; color: string }> = {
  TEST_TRIGGER: { label: "测款触发", color: "bg-purple-100 text-purple-700" },
  EXISTING_PRODUCT: { label: "既有商品改款", color: "bg-orange-100 text-orange-700" },
  MANUAL: { label: "人工创建", color: "bg-gray-100 text-gray-700" },
}

// 改版范围选项
const REVISION_SCOPE_OPTIONS = [
  { value: "PATTERN", label: "版型结构" },
  { value: "SIZE", label: "尺码规格" },
  { value: "FABRIC", label: "面料" },
  { value: "ACCESSORIES", label: "辅料" },
  { value: "CRAFT", label: "工艺" },
  { value: "PRINT", label: "花型" },
  { value: "COLOR", label: "颜色" },
  { value: "PACKAGE", label: "包装标识" },
]

// 问题来源选项
const ISSUE_SOURCE_OPTIONS = ["测款反馈", "售后数据", "仓管质检", "版房评审", "其他"]

// 问题分类选项
const ISSUE_CATEGORY_OPTIONS = ["版型", "尺码", "面料", "工艺", "花型", "其他"]

// 下游任务类型
const DOWNSTREAM_TASK_TYPES = [
  { value: "PATTERN", label: "打版任务", icon: FileText },
  { value: "PRINT", label: "花型任务", icon: ImageIcon },
  { value: "SAMPLE", label: "打样任务", icon: Shirt },
  { value: "PRE_PRODUCTION", label: "产前版任务", icon: Package },
]

// Mock数据 - 按照PRD Section 22
const mockRevisionTasks = [
  {
    id: "RT-20260109-003",
    code: "RT-20260109-003",
    title: "印尼风格碎花连衣裙改版（领口+腰节+面料克重）",
    projectId: "PRJ-20260105-001",
    projectName: "印尼风格碎花连衣裙",
    sourceType: "TEST_TRIGGER",
    upstreamInstance: "WI-20260108-011",
    upstreamTitle: "测款结论判定",
    productRef: "SPU-LY-2401",
    status: "IN_PROGRESS",
    owner: "李版师",
    participants: ["王测款", "张仓管"],
    priority: "高",
    dueAt: "2026-01-15",
    revisionScope: ["PATTERN", "SIZE", "FABRIC"],
    sampleCount: 2,
    sampleSites: ["深圳", "雅加达"],
    revisionVersion: null,
    frozenAt: null,
    frozenBy: null,
    downstreamCount: 0,
    riskFlags: [],
    createdAt: "2026-01-09 09:30",
    updatedAt: "2026-01-09 14:30",
  },
  {
    id: "RT-20260108-002",
    code: "RT-20260108-002",
    title: "波西米亚风半身裙花型调整",
    projectId: "PRJ-20260103-002",
    projectName: "波西米亚风半身裙",
    sourceType: "EXISTING_PRODUCT",
    upstreamInstance: null,
    upstreamTitle: null,
    productRef: "SPU-BX-2402",
    status: "PENDING_REVIEW",
    owner: "王版师",
    participants: ["李设计"],
    priority: "中",
    dueAt: "2026-01-18",
    revisionScope: ["PRINT", "COLOR"],
    sampleCount: 1,
    sampleSites: ["深圳"],
    revisionVersion: "R1",
    frozenAt: null,
    frozenBy: null,
    downstreamCount: 0,
    riskFlags: [],
    createdAt: "2026-01-08 10:00",
    updatedAt: "2026-01-09 11:00",
  },
  {
    id: "RT-20260105-001",
    code: "RT-20260105-001",
    title: "休闲运动套装面料与工艺优化",
    projectId: "PRJ-20260101-003",
    projectName: "休闲运动套装",
    sourceType: "TEST_TRIGGER",
    upstreamInstance: "WI-20260104-008",
    upstreamTitle: "测款结论判定",
    productRef: "SPU-YD-2403",
    status: "APPROVED",
    owner: "张版师",
    participants: ["陈采购", "刘仓管"],
    priority: "高",
    dueAt: "2026-01-12",
    revisionScope: ["FABRIC", "ACCESSORIES", "CRAFT"],
    sampleCount: 2,
    sampleSites: ["深圳"],
    revisionVersion: "R2",
    frozenAt: "2026-01-08 16:00",
    frozenBy: "制版负责人",
    downstreamCount: 0,
    riskFlags: ["已冻结未建下游"],
    createdAt: "2026-01-05 14:00",
    updatedAt: "2026-01-08 16:00",
  },
  {
    id: "RT-20260107-004",
    code: "RT-20260107-004",
    title: "丝绸印花连衣裙尺码优化",
    projectId: "PRJ-20260102-004",
    projectName: "丝绸印花连衣裙",
    sourceType: "MANUAL",
    upstreamInstance: null,
    upstreamTitle: null,
    productRef: "SPU-SC-2404",
    status: "NOT_STARTED",
    owner: "赵版师",
    participants: [],
    priority: "低",
    dueAt: "2026-01-20",
    revisionScope: ["SIZE"],
    sampleCount: 1,
    sampleSites: ["深圳"],
    revisionVersion: null,
    frozenAt: null,
    frozenBy: null,
    downstreamCount: 0,
    riskFlags: [],
    createdAt: "2026-01-07 16:00",
    updatedAt: "2026-01-07 16:00",
  },
  {
    id: "RT-20260106-005",
    code: "RT-20260106-005",
    title: "格纹羊毛大衣面料与工艺调整",
    projectId: "PRJ-20251228-005",
    projectName: "格纹羊毛大衣",
    sourceType: "TEST_TRIGGER",
    upstreamInstance: "WI-20260105-012",
    upstreamTitle: "测款结论判定",
    productRef: "SPU-DY-2405",
    status: "BLOCKED",
    owner: "钱版师",
    participants: ["孙采购"],
    priority: "高",
    dueAt: "2026-01-10",
    revisionScope: ["FABRIC", "CRAFT"],
    sampleCount: 1,
    sampleSites: ["深圳"],
    revisionVersion: "R1",
    frozenAt: null,
    frozenBy: null,
    downstreamCount: 0,
    riskFlags: ["阻塞", "超期"],
    blockedReason: "缺样衣：SMP-SZ-006 当前被占用",
    createdAt: "2026-01-06 09:00",
    updatedAt: "2026-01-09 08:00",
  },
  {
    id: "RT-20260102-006",
    code: "RT-20260102-006",
    title: "条纹休闲衬衫版型与工艺改版",
    projectId: "PRJ-20251225-006",
    projectName: "条纹休闲衬衫",
    sourceType: "EXISTING_PRODUCT",
    upstreamInstance: null,
    upstreamTitle: null,
    productRef: "SPU-CS-2406",
    status: "COMPLETED",
    owner: "周版师",
    participants: ["吴设计", "郑仓管"],
    priority: "中",
    dueAt: "2026-01-08",
    revisionScope: ["PATTERN", "SIZE", "CRAFT"],
    sampleCount: 2,
    sampleSites: ["深圳"],
    revisionVersion: "R1",
    frozenAt: "2026-01-06 14:00",
    frozenBy: "制版负责人",
    downstreamCount: 2,
    riskFlags: [],
    createdAt: "2026-01-02 10:00",
    updatedAt: "2026-01-08 17:00",
  },
]

// 详情数据 - 按照PRD Mock数据
const mockTaskDetail = {
  id: "RT-20260109-003",
  code: "RT-20260109-003",
  title: "印尼风格碎花连衣裙改版（领口+腰节+面料克重）",
  projectId: "PRJ-20260105-001",
  projectName: "印尼风格碎花连衣裙",
  sourceType: "TEST_TRIGGER",
  upstreamInstance: "WI-20260108-011",
  upstreamTitle: "测款结论判定",
  productRef: "SPU-LY-2401",
  status: "IN_PROGRESS",
  owner: "李版师",
  participants: ["王测款", "张仓管"],
  priority: "高",
  dueAt: "2026-01-15",
  revisionVersion: null,
  frozenAt: null,
  frozenBy: null,
  createdAt: "2026-01-09 09:30",
  updatedAt: "2026-01-09 14:30",
  // 改版方案
  revisionGoal: "降低退货率，从12%降至6%以下；提升直播转化",
  revisionScope: ["PATTERN", "SIZE", "FABRIC"],
  constraints: {
    maxCost: 85,
    maxDeliveryDays: 15,
    unchangeable: ["面料花色", "整体风格"],
  },
  // 改版清单 - 按照PRD示例
  changeList: [
    {
      id: 1,
      category: "版型结构",
      changePoint: "领口开深-1.5cm",
      before: "领口开深18cm",
      after: "领口开深16.5cm",
      reason: "测款反馈领口过深",
      risk: "中",
      verification: "打样验证",
      recommendedDownstream: ["PATTERN", "SAMPLE"],
      owner: "李版师",
    },
    {
      id: 2,
      category: "尺码规格",
      changePoint: "腰围放量+2cm",
      before: "M码腰围68cm",
      after: "M码腰围70cm",
      reason: "退货数据显示腰围偏紧",
      risk: "低",
      verification: "测量",
      recommendedDownstream: ["PATTERN"],
      owner: "李版师",
    },
    {
      id: 3,
      category: "面料",
      changePoint: "克重从120→140",
      before: "面料克重120g/m²",
      after: "面料克重140g/m²",
      reason: "提升垂感和品质感",
      risk: "中",
      verification: "打样验证",
      recommendedDownstream: ["SAMPLE"],
      owner: "李版师",
    },
  ],
  // 验收标准
  acceptanceCriteria: [
    { id: 1, content: "领口开深实测值在16-17cm范围内", required: true, checked: false },
    { id: 2, content: "M码腰围实测值在69-71cm范围内", required: true, checked: false },
    { id: 3, content: "面料克重在135-145g/m²范围内", required: true, checked: false },
    { id: 4, content: "上身试穿领口不过深", required: true, checked: false },
    { id: 5, content: "关键围度误差≤1cm", required: false, checked: false },
  ],
  // 问题点列表
  issues: [
    {
      id: 1,
      source: "测款反馈",
      category: "版型",
      description: "直播间反馈领口过深，不够保守，不适合印尼市场审美",
      severity: "严重",
      attachments: [
        { type: "image", name: "直播截图-领口问题.jpg", url: "#" },
        { type: "video", name: "用户试穿反馈.mp4", url: "#" },
      ],
    },
    {
      id: 2,
      source: "售后数据",
      category: "尺码",
      description: "M码腰围偏紧投诉占总退货的28%",
      severity: "严重",
      attachments: [{ type: "file", name: "退货原因分析.xlsx", url: "#" }],
    },
    {
      id: 3,
      source: "版房评审",
      category: "面料",
      description: "当前面料克重偏轻，垂感不足，影响整体品质感",
      severity: "一般",
      attachments: [{ type: "image", name: "面料对比照片.jpg", url: "#" }],
    },
  ],
  // 关联样衣 - 按照PRD
  relatedSamples: [
    {
      code: "SY-LED-002",
      name: "印尼碎花连衣裙-红色M",
      site: "深圳",
      status: "可用",
      location: "A区-3排-12号",
      keeper: "张仓管",
      available: true,
      expectedReturn: null,
    },
    {
      code: "SY-LED-003",
      name: "印尼碎花连衣裙-红色L",
      site: "雅加达",
      status: "借出",
      location: "使用中",
      keeper: "印尼仓管",
      available: false,
      expectedReturn: "2026-01-12",
    },
  ],
  // 产出物
  outputPack: {
    version: null,
    frozenAt: null,
    frozenBy: null,
    diffSummary: null,
    attachments: [{ name: "改版清单-草稿.xlsx", type: "file", uploadedAt: "2026-01-09 14:00", uploadedBy: "李版师" }],
  },
  // 下游任务
  downstreamTasks: [],
  // 日志
  logs: [
    { time: "2026-01-09 14:30", action: "更新改版清单", user: "李版师", detail: "新增变更点：面料克重调整" },
    { time: "2026-01-09 14:00", action: "上传附件", user: "李版师", detail: "上传改版清单-草稿.xlsx" },
    { time: "2026-01-09 10:00", action: "领取任务", user: "李版师", detail: "状态变更：未开始 → 进行中" },
    {
      time: "2026-01-09 09:30",
      action: "创建任务",
      user: "系统",
      detail: "由测款结论判定(WI-20260108-011)自动触发创建",
    },
  ],
}

// 可选样衣列表
const availableSamples = [
  {
    code: "SY-LED-001",
    name: "印尼碎花连衣裙-蓝色S",
    site: "深圳",
    status: "可用",
    location: "A区-2排-08号",
    keeper: "张仓管",
    available: true,
  },
  {
    code: "SY-LED-002",
    name: "印尼碎花连衣裙-红色M",
    site: "深圳",
    status: "可用",
    location: "A区-3排-12号",
    keeper: "张仓管",
    available: true,
  },
  {
    code: "SY-LED-003",
    name: "印尼碎花连衣裙-红色L",
    site: "雅加达",
    status: "借出",
    location: "使用中",
    keeper: "印尼仓管",
    available: false,
  },
  {
    code: "SY-BXQ-001",
    name: "波西米亚半身裙-米色M",
    site: "深圳",
    status: "可用",
    location: "B区-1排-05号",
    keeper: "李仓管",
    available: true,
  },
  {
    code: "SY-YDT-001",
    name: "休闲运动套装-黑色L",
    site: "深圳",
    status: "维修中",
    location: "维修区",
    keeper: "王仓管",
    available: false,
  },
]

// 项目列表
const projectOptions = [
  { id: "PRJ-20260105-001", name: "印尼风格碎花连衣裙" },
  { id: "PRJ-20260103-002", name: "波西米亚风半身裙" },
  { id: "PRJ-20260101-003", name: "休闲运动套装" },
  { id: "PRJ-20260102-004", name: "丝绸印花连衣裙" },
  { id: "PRJ-20251228-005", name: "格纹羊毛大衣" },
]

export default function RevisionTaskPage() {
  const router = useRouter()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [ownerFilter, setOwnerFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [siteFilter, setSiteFilter] = useState("all")
  const [quickFilter, setQuickFilter] = useState<string | null>(null)

  // 选中行
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  // 详情抽屉
  const [selectedTask, setSelectedTask] = useState<typeof mockTaskDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("plan")

  // 新建/编辑抽屉
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: "",
    priority: "中",
    owner: "",
    participants: [] as string[],
    dueAt: "",
    sourceType: "",
    project: "",
    upstreamInstance: "",
    productRef: "",
    selectedSamples: [] as string[],
    issues: [] as { category: string; description: string; severity: string }[],
  })

  // 创建下游任务弹窗
  const [createDownstreamOpen, setCreateDownstreamOpen] = useState(false)
  const [downstreamSelections, setDownstreamSelections] = useState<string[]>([])

  // 审批弹窗
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  // 阻塞弹窗
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockReason, setBlockReason] = useState("")

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // 统计数据
  const stats = {
    total: mockRevisionTasks.length,
    mine: mockRevisionTasks.filter((t) => t.owner === "李版师").length,
    pendingReview: mockRevisionTasks.filter((t) => t.status === "PENDING_REVIEW").length,
    frozenNoDownstream: mockRevisionTasks.filter((t) => t.status === "APPROVED" && t.downstreamCount === 0).length,
    blocked: mockRevisionTasks.filter((t) => t.status === "BLOCKED").length,
    overdue: mockRevisionTasks.filter((t) => t.riskFlags.includes("超期")).length,
  }

  // 筛选数据
  const filteredTasks = mockRevisionTasks.filter((task) => {
    if (
      searchKeyword &&
      !task.code.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !task.title.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !task.projectName.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !(task.productRef && task.productRef.toLowerCase().includes(searchKeyword.toLowerCase()))
    ) {
      return false
    }
    if (statusFilter !== "all" && task.status !== statusFilter) return false
    if (ownerFilter === "mine" && task.owner !== "李版师") return false
    if (sourceFilter !== "all" && task.sourceType !== sourceFilter) return false
    if (siteFilter !== "all" && !task.sampleSites.includes(siteFilter)) return false

    // 快捷筛选
    if (quickFilter === "mine" && task.owner !== "李版师") return false
    if (quickFilter === "pendingReview" && task.status !== "PENDING_REVIEW") return false
    if (quickFilter === "frozenNoDownstream" && !(task.status === "APPROVED" && task.downstreamCount === 0))
      return false
    if (quickFilter === "blocked" && task.status !== "BLOCKED") return false
    if (quickFilter === "overdue" && !task.riskFlags.includes("超期")) return false

    return true
  })

  const handleViewDetail = (task: (typeof mockRevisionTasks)[0]) => {
    setSelectedTask(mockTaskDetail)
    setDetailOpen(true)
    setActiveTab("plan")
  }

  const handleQuickFilter = (filter: string) => {
    if (quickFilter === filter) {
      setQuickFilter(null)
    } else {
      setQuickFilter(filter)
      setStatusFilter("all")
      setOwnerFilter("all")
    }
  }

  // 行操作按钮显隐逻辑 - 按照PRD表A
  const getRowActions = (task: (typeof mockRevisionTasks)[0]) => {
    const actions: { key: string; label: string; icon: React.ReactNode; show: boolean; variant?: string }[] = []

    // 查看 - 所有状态可见
    actions.push({ key: "view", label: "查看", icon: <Eye className="h-4 w-4" />, show: true })

    // 开始/继续
    if (["NOT_STARTED", "BLOCKED"].includes(task.status)) {
      actions.push({
        key: "start",
        label: task.status === "NOT_STARTED" ? "开始" : "继续",
        icon: <Play className="h-4 w-4" />,
        show: true,
      })
    }
    if (task.status === "IN_PROGRESS") {
      actions.push({ key: "continue", label: "继续", icon: <Play className="h-4 w-4" />, show: true })
    }

    // 提交评审
    if (task.status === "IN_PROGRESS") {
      actions.push({ key: "submit", label: "提交评审", icon: <Send className="h-4 w-4" />, show: true })
    }

    // 冻结通过
    if (task.status === "PENDING_REVIEW") {
      actions.push({ key: "approve", label: "通过冻结", icon: <Snowflake className="h-4 w-4" />, show: true })
    }

    // 驳回
    if (task.status === "PENDING_REVIEW") {
      actions.push({
        key: "reject",
        label: "驳回",
        icon: <XCircle className="h-4 w-4" />,
        show: true,
        variant: "destructive",
      })
    }

    // 创建下游任务
    if (["APPROVED", "COMPLETED"].includes(task.status)) {
      actions.push({
        key: "createDownstream",
        label: "创建下游任务",
        icon: <FolderOutput className="h-4 w-4" />,
        show: true,
      })
    }

    // 完成
    if (task.status === "APPROVED") {
      actions.push({ key: "complete", label: "完成", icon: <CheckCircle className="h-4 w-4" />, show: true })
    }

    // 阻塞/解除阻塞
    if (!["COMPLETED", "CANCELLED"].includes(task.status)) {
      if (task.status === "BLOCKED") {
        actions.push({ key: "unblock", label: "解除阻塞", icon: <Play className="h-4 w-4" />, show: true })
      } else {
        actions.push({
          key: "block",
          label: "标记阻塞",
          icon: <Ban className="h-4 w-4" />,
          show: true,
          variant: "destructive",
        })
      }
    }

    // 取消
    if (["NOT_STARTED", "IN_PROGRESS"].includes(task.status)) {
      actions.push({
        key: "cancel",
        label: "取消",
        icon: <XCircle className="h-4 w-4" />,
        show: true,
        variant: "destructive",
      })
    }

    return actions.filter((a) => a.show)
  }

  const handleAction = (action: string, task: (typeof mockRevisionTasks)[0]) => {
    switch (action) {
      case "view":
        handleViewDetail(task)
        break
      case "start":
      case "continue":
        toast.success(`已领取任务 ${task.code}，状态变更为进行中`)
        break
      case "submit":
        toast.success(`已提交评审 ${task.code}`)
        break
      case "approve":
        setApproveDialogOpen(true)
        break
      case "reject":
        setRejectDialogOpen(true)
        break
      case "complete":
        toast.success(`任务 ${task.code} 已完成`)
        break
      case "block":
        setBlockDialogOpen(true)
        break
      case "unblock":
        toast.success(`任务 ${task.code} 已解除阻塞`)
        break
      case "cancel":
        toast.info(`任务 ${task.code} 已取消`)
        break
      case "createDownstream":
        // 自动从改版清单汇总推荐下游
        const recommended = new Set<string>()
        mockTaskDetail.changeList.forEach((item) => {
          item.recommendedDownstream.forEach((d) => recommended.add(d))
        })
        setDownstreamSelections(Array.from(recommended))
        setCreateDownstreamOpen(true)
        break
    }
  }

  const handleCreateDownstream = () => {
    if (downstreamSelections.length === 0) {
      toast.error("请至少选择一个下游任务类型")
      return
    }
    const labels = downstreamSelections.map((s) => DOWNSTREAM_TASK_TYPES.find((t) => t.value === s)?.label).join("、")
    toast.success(`已创建下游任务：${labels}`)
    setCreateDownstreamOpen(false)
    setDownstreamSelections([])
  }

  const handleCreateTask = (saveAsDraft: boolean) => {
    if (!createForm.project || !createForm.sourceType || !createForm.title || !createForm.owner) {
      toast.error("请填写必填字段：项目、来源类型、任务标题、负责人")
      return
    }
    if (createForm.sourceType === "TEST_TRIGGER" && !createForm.upstreamInstance) {
      toast.error("测款触发来源必须填写上游工作项实例")
      return
    }
    if (createForm.sourceType === "EXISTING_PRODUCT" && !createForm.productRef) {
      toast.error("既有商品改款来源必须填写商品引用")
      return
    }

    if (saveAsDraft) {
      toast.success("已保存草稿")
    } else {
      toast.success("已创建并开始任务")
    }
    setCreateOpen(false)
    // Reset form
    setCreateForm({
      title: "",
      priority: "中",
      owner: "",
      participants: [],
      dueAt: "",
      sourceType: "",
      project: "",
      upstreamInstance: "",
      productRef: "",
      selectedSamples: [],
      issues: [],
    })
  }

  const handleSelectAll = () => {
    if (selectedRows.length === filteredTasks.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(filteredTasks.map((t) => t.id))
    }
  }

  const handleSelectRow = (id: string) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter((r) => r !== id))
    } else {
      setSelectedRows([...selectedRows, id])
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6">
          {/* 页面标题 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">改版任务</h1>
              <p className="text-sm text-muted-foreground mt-1">
                基于测款反馈/样衣评审/既有商品问题点，输出改版方案与改版包，驱动打版/花型/打样等下游任务
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建改版任务
            </Button>
          </div>

          {/* 筛选栏 */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="任务编号/标题/项目/款号/SPU/样衣编号"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v)
                    setQuickFilter(null)
                  }}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={ownerFilter}
                  onValueChange={(v) => {
                    setOwnerFilter(v)
                    setQuickFilter(null)
                  }}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="负责人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="mine">我负责的</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="来源" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部来源</SelectItem>
                    {Object.entries(SOURCE_TYPE_MAP).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
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
                  onClick={() => {
                    setSearchKeyword("")
                    setStatusFilter("all")
                    setOwnerFilter("all")
                    setSourceFilter("all")
                    setSiteFilter("all")
                    setQuickFilter(null)
                  }}
                >
                  重置
                </Button>
                <Button variant="outline" size="icon" onClick={() => toast.info("刷新成功")}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* KPI快捷筛选条 */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Button
              variant={quickFilter === null && statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setQuickFilter(null)
                setStatusFilter("all")
                setOwnerFilter("all")
              }}
            >
              全部 ({stats.total})
            </Button>
            <Button
              variant={quickFilter === "mine" ? "default" : "outline"}
              size="sm"
              onClick={() => handleQuickFilter("mine")}
            >
              我的 ({stats.mine})
            </Button>
            <Button
              variant={quickFilter === "pendingReview" ? "default" : "outline"}
              size="sm"
              onClick={() => handleQuickFilter("pendingReview")}
              className={quickFilter !== "pendingReview" ? "text-yellow-600 border-yellow-300 hover:bg-yellow-50" : ""}
            >
              待评审 ({stats.pendingReview})
            </Button>
            <Button
              variant={quickFilter === "frozenNoDownstream" ? "default" : "outline"}
              size="sm"
              onClick={() => handleQuickFilter("frozenNoDownstream")}
              className={
                quickFilter !== "frozenNoDownstream" ? "text-orange-600 border-orange-300 hover:bg-orange-50" : ""
              }
            >
              已冻结未建下游 ({stats.frozenNoDownstream})
            </Button>
            <Button
              variant={quickFilter === "blocked" ? "default" : "outline"}
              size="sm"
              onClick={() => handleQuickFilter("blocked")}
              className={quickFilter !== "blocked" ? "text-red-600 border-red-300 hover:bg-red-50" : ""}
            >
              阻塞 ({stats.blocked})
            </Button>
            <Button
              variant={quickFilter === "overdue" ? "default" : "outline"}
              size="sm"
              onClick={() => handleQuickFilter("overdue")}
              className={quickFilter !== "overdue" ? "text-red-600 border-red-300 hover:bg-red-50" : ""}
            >
              超期 ({stats.overdue})
            </Button>
          </div>

          {/* 批量操作工具栏 */}
          {selectedRows.length > 0 && (
            <Card className="mb-4">
              <CardContent className="p-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">已选择 {selectedRows.length} 项</span>
                  <Button variant="outline" size="sm" onClick={() => toast.info("批量分派功能")}>
                    批量分派负责人
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast.info("批量设置截止时间")}>
                    批量设置截止时间
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast.info("批量标记阻塞")}>
                    批量标记阻塞
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast.info("批量导出")}>
                    <Download className="h-4 w-4 mr-1" />
                    导出
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRows([])}>
                    取消选择
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 数据表格 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedRows.length === filteredTasks.length && filteredTasks.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="min-w-[280px]">任务</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead className="w-[140px]">项目</TableHead>
                    <TableHead className="w-28">来源</TableHead>
                    <TableHead className="w-[100px]">商品</TableHead>
                    <TableHead className="w-[160px]">改版范围</TableHead>
                    <TableHead className="w-[100px]">样衣</TableHead>
                    <TableHead className="w-20">负责人</TableHead>
                    <TableHead className="w-24">截止时间</TableHead>
                    <TableHead className="w-20">冻结版本</TableHead>
                    <TableHead className="w-24">下游任务</TableHead>
                    <TableHead className="w-[100px]">风险</TableHead>
                    <TableHead className="w-[140px]">最近更新</TableHead>
                    <TableHead className="w-[100px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-12">
                        <div className="text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>无符合条件的任务</p>
                          <Button variant="link" onClick={() => setCreateOpen(true)} className="mt-2">
                            新建改版任务
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task) => (
                      <TableRow
                        key={task.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetail(task)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedRows.includes(task.id)}
                            onCheckedChange={() => handleSelectRow(task.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-primary hover:underline">{task.code}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-[260px]">{task.title}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_MAP[task.status]?.color}>{STATUS_MAP[task.status]?.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{task.projectId}</div>
                            <div className="text-muted-foreground truncate max-w-[120px]">{task.projectName}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={SOURCE_TYPE_MAP[task.sourceType]?.color}>
                            {SOURCE_TYPE_MAP[task.sourceType]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{task.productRef || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {task.revisionScope.slice(0, 3).map((scope) => (
                              <Badge key={scope} variant="outline" className="text-xs">
                                {REVISION_SCOPE_OPTIONS.find((o) => o.value === scope)?.label}
                              </Badge>
                            ))}
                            {task.revisionScope.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{task.revisionScope.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{task.sampleCount} 件</div>
                            <div className="text-xs text-muted-foreground">{task.sampleSites.join("/")}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{task.owner}</span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-sm ${task.riskFlags.includes("超期") ? "text-red-600 font-medium" : ""}`}
                          >
                            {task.dueAt}
                          </span>
                        </TableCell>
                        <TableCell>
                          {task.revisionVersion ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              {task.revisionVersion}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.downstreamCount > 0 ? (
                            <span className="text-sm">{task.downstreamCount} 个</span>
                          ) : task.status === "APPROVED" ? (
                            <Badge variant="destructive" className="text-xs">
                              未创建
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {task.riskFlags.length > 0 ? (
                              task.riskFlags.map((flag) => (
                                <Badge key={flag} variant="destructive" className="text-xs">
                                  {flag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{task.updatedAt}</span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleViewDetail(task)}>
                              查看
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getRowActions(task)
                                  .filter((a) => a.key !== "view")
                                  .map((action, idx) => (
                                    <DropdownMenuItem
                                      key={action.key}
                                      onClick={() => handleAction(action.key, task)}
                                      className={action.variant === "destructive" ? "text-red-600" : ""}
                                    >
                                      {action.icon}
                                      <span className="ml-2">{action.label}</span>
                                    </DropdownMenuItem>
                                  ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 分页 */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">共 {filteredTasks.length} 条</div>
            <div className="flex items-center gap-2">
              <Select defaultValue="10">
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 条/页</SelectItem>
                  <SelectItem value="20">20 条/页</SelectItem>
                  <SelectItem value="50">50 条/页</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" disabled>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="default" size="sm" className="h-8 w-8">
                  1
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" disabled>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 新建/编辑改版任务抽屉 - RT2 */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>新建改版任务</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                  1
                </span>
                基本信息
              </h3>
              <div className="grid gap-4 pl-8">
                <div className="grid gap-2">
                  <Label>
                    任务标题 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="例：印尼风格碎花连衣裙改版（领口+腰节）"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>优先级</Label>
                    <Select
                      value={createForm.priority}
                      onValueChange={(v) => setCreateForm({ ...createForm, priority: v })}
                    >
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
                  <div className="grid gap-2">
                    <Label>截止时间</Label>
                    <Input
                      type="date"
                      value={createForm.dueAt}
                      onChange={(e) => setCreateForm({ ...createForm, dueAt: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>
                      负责人 <span className="text-red-500">*</span>
                    </Label>
                    <Select value={createForm.owner} onValueChange={(v) => setCreateForm({ ...createForm, owner: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择负责人" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="李版师">李版师</SelectItem>
                        <SelectItem value="王版师">王版师</SelectItem>
                        <SelectItem value="张版师">张版师</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>参与人</Label>
                    <Input placeholder="可多选，用逗号分隔" />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* 绑定与来源 */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                  2
                </span>
                绑定与来源
              </h3>
              <div className="grid gap-4 pl-8">
                <div className="grid gap-2">
                  <Label>
                    来源类型 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={createForm.sourceType}
                    onValueChange={(v) => setCreateForm({ ...createForm, sourceType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择来源类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEST_TRIGGER">测款触发</SelectItem>
                      <SelectItem value="EXISTING_PRODUCT">既有商品改款</SelectItem>
                      <SelectItem value="MANUAL">人工创建</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>
                    关联项目 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={createForm.project}
                    onValueChange={(v) => setCreateForm({ ...createForm, project: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.id} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {createForm.sourceType === "TEST_TRIGGER" && (
                  <div className="grid gap-2">
                    <Label>
                      上游工作项实例 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="例：WI-20260108-011"
                      value={createForm.upstreamInstance}
                      onChange={(e) => setCreateForm({ ...createForm, upstreamInstance: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">测款触发来源必填上游工作项实例</p>
                  </div>
                )}
                {createForm.sourceType === "EXISTING_PRODUCT" && (
                  <div className="grid gap-2">
                    <Label>
                      商品引用 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="例：SPU-LY-2401"
                      value={createForm.productRef}
                      onChange={(e) => setCreateForm({ ...createForm, productRef: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">既有商品改款必填商品引用</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* 关联样衣 */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                  3
                </span>
                关联样衣（可选）
              </h3>
              <div className="pl-8">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12"></TableHead>
                        <TableHead>样衣编号</TableHead>
                        <TableHead>站点</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>位置</TableHead>
                        <TableHead>保管人</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableSamples.map((sample) => (
                        <TableRow key={sample.code}>
                          <TableCell>
                            <Checkbox
                              checked={createForm.selectedSamples.includes(sample.code)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCreateForm({
                                    ...createForm,
                                    selectedSamples: [...createForm.selectedSamples, sample.code],
                                  })
                                } else {
                                  setCreateForm({
                                    ...createForm,
                                    selectedSamples: createForm.selectedSamples.filter((s) => s !== sample.code),
                                  })
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{sample.code}</div>
                              <div className="text-xs text-muted-foreground">{sample.name}</div>
                            </div>
                          </TableCell>
                          <TableCell>{sample.site}</TableCell>
                          <TableCell>
                            <Badge
                              variant={sample.available ? "outline" : "secondary"}
                              className={sample.available ? "bg-green-50 text-green-700" : ""}
                            >
                              {sample.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{sample.location}</TableCell>
                          <TableCell className="text-sm">{sample.keeper}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">已选择 {createForm.selectedSamples.length} 件样衣</p>
              </div>
            </div>

            <Separator />

            {/* 初始问题点 */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                  4
                </span>
                初始问题点与附件（可选）
              </h3>
              <div className="pl-8 space-y-4">
                {createForm.issues.map((issue, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">问题点 {idx + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setCreateForm({ ...createForm, issues: createForm.issues.filter((_, i) => i !== idx) })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          value={issue.category}
                          onValueChange={(v) => {
                            const newIssues = [...createForm.issues]
                            newIssues[idx].category = v
                            setCreateForm({ ...createForm, issues: newIssues })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="分类" />
                          </SelectTrigger>
                          <SelectContent>
                            {ISSUE_CATEGORY_OPTIONS.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={issue.severity}
                          onValueChange={(v) => {
                            const newIssues = [...createForm.issues]
                            newIssues[idx].severity = v
                            setCreateForm({ ...createForm, issues: newIssues })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="严重度" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="一般">一般</SelectItem>
                            <SelectItem value="严重">严重</SelectItem>
                            <SelectItem value="紧急">紧急</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        placeholder="问题描述"
                        value={issue.description}
                        onChange={(e) => {
                          const newIssues = [...createForm.issues]
                          newIssues[idx].description = e.target.value
                          setCreateForm({ ...createForm, issues: newIssues })
                        }}
                      />
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() =>
                    setCreateForm({
                      ...createForm,
                      issues: [...createForm.issues, { category: "", description: "", severity: "" }],
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加问题点
                </Button>
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => handleCreateTask(true)}>
              保存草稿
            </Button>
            <Button onClick={() => handleCreateTask(false)}>创建并开始</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 详情抽屉 - RT3 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[900px] sm:max-w-[900px] p-0 overflow-hidden">
          {selectedTask && (
            <div className="flex flex-col h-full">
              {/* 头部 */}
              <div className="p-6 border-b bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-lg font-bold">{selectedTask.code}</h2>
                      <Badge className={STATUS_MAP[selectedTask.status]?.color}>
                        {STATUS_MAP[selectedTask.status]?.label}
                      </Badge>
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        {selectedTask.priority}
                      </Badge>
                      {selectedTask.revisionVersion && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          <Snowflake className="h-3 w-3 mr-1" />
                          {selectedTask.revisionVersion}
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-base text-muted-foreground mb-3">{selectedTask.title}</h3>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {selectedTask.owner}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        截止：{selectedTask.dueAt}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        更新：{selectedTask.updatedAt}
                      </span>
                    </div>
                  </div>
                  {/* 操作按钮 - 按照PRD表B */}
                  <div className="flex items-center gap-2">
                    {selectedTask.status === "IN_PROGRESS" && (
                      <>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-1" />
                          编辑方案
                        </Button>
                        <Button size="sm" onClick={() => toast.success("已提交评审")}>
                          <Send className="h-4 w-4 mr-1" />
                          提交评审
                        </Button>
                      </>
                    )}
                    {selectedTask.status === "PENDING_REVIEW" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setRejectDialogOpen(true)}>
                          <XCircle className="h-4 w-4 mr-1" />
                          驳回
                        </Button>
                        <Button size="sm" onClick={() => setApproveDialogOpen(true)}>
                          <Snowflake className="h-4 w-4 mr-1" />
                          通过冻结
                        </Button>
                      </>
                    )}
                    {selectedTask.status === "APPROVED" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const recommended = new Set<string>()
                            selectedTask.changeList.forEach((item) => {
                              item.recommendedDownstream.forEach((d) => recommended.add(d))
                            })
                            setDownstreamSelections(Array.from(recommended))
                            setCreateDownstreamOpen(true)
                          }}
                        >
                          <FolderOutput className="h-4 w-4 mr-1" />
                          创建下游任务
                        </Button>
                        <Button size="sm" onClick={() => toast.success("任务已完成")}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          完成
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 主体两栏布局 */}
              <div className="flex flex-1 overflow-hidden">
                {/* 左侧Tabs */}
                <div className="flex-1 overflow-y-auto">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                    <div className="border-b bg-white sticky top-0 z-10">
                      <TabsList className="px-6">
                        <TabsTrigger value="plan">改版方案</TabsTrigger>
                        <TabsTrigger value="issues">问题点与证据</TabsTrigger>
                        <TabsTrigger value="samples">关联样衣</TabsTrigger>
                        <TabsTrigger value="output">产出物</TabsTrigger>
                        <TabsTrigger value="downstream">下游任务</TabsTrigger>
                        <TabsTrigger value="logs">日志与审批</TabsTrigger>
                      </TabsList>
                    </div>

                    {/* Tab1: 改版方案 */}
                    <TabsContent value="plan" className="p-6 space-y-6 m-0">
                      {/* 目标与范围 */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            目标与范围
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label className="text-muted-foreground">改版目标</Label>
                            <p className="mt-1">{selectedTask.revisionGoal}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">改版范围</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {selectedTask.revisionScope.map((scope) => (
                                <Badge key={scope} variant="outline">
                                  {REVISION_SCOPE_OPTIONS.find((o) => o.value === scope)?.label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">约束条件</Label>
                            <div className="mt-1 text-sm space-y-1">
                              <p>成本上限：¥{selectedTask.constraints.maxCost}</p>
                              <p>交期上限：{selectedTask.constraints.maxDeliveryDays} 天</p>
                              <p>不可改项：{selectedTask.constraints.unchangeable.join("、")}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* 改版清单 */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            改版清单
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>分类</TableHead>
                                <TableHead>变更点</TableHead>
                                <TableHead>变更前</TableHead>
                                <TableHead>变更后</TableHead>
                                <TableHead>原因</TableHead>
                                <TableHead>风险</TableHead>
                                <TableHead>验证方式</TableHead>
                                <TableHead>推荐下游</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedTask.changeList.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <Badge variant="outline">{item.category}</Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">{item.changePoint}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{item.before}</TableCell>
                                  <TableCell className="text-sm">{item.after}</TableCell>
                                  <TableCell className="text-sm max-w-[150px] truncate">{item.reason}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        item.risk === "高"
                                          ? "destructive"
                                          : item.risk === "中"
                                            ? "secondary"
                                            : "outline"
                                      }
                                    >
                                      {item.risk}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">{item.verification}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {item.recommendedDownstream.map((d) => (
                                        <Badge key={d} variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                          {DOWNSTREAM_TASK_TYPES.find((t) => t.value === d)?.label}
                                        </Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>

                      {/* 验收标准 */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ListChecks className="h-4 w-4" />
                            验收标准
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {selectedTask.acceptanceCriteria.map((item) => (
                              <div key={item.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                                <Checkbox checked={item.checked} />
                                <span className={item.checked ? "line-through text-muted-foreground" : ""}>
                                  {item.content}
                                </span>
                                {item.required && (
                                  <Badge variant="destructive" className="text-xs">
                                    必须
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Tab2: 问题点与证据 */}
                    <TabsContent value="issues" className="p-6 space-y-4 m-0">
                      {selectedTask.issues.map((issue) => (
                        <Card key={issue.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{issue.source}</Badge>
                                <Badge variant="outline">{issue.category}</Badge>
                                <Badge variant={issue.severity === "严重" ? "destructive" : "secondary"}>
                                  {issue.severity}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm mb-3">{issue.description}</p>
                            <div className="flex flex-wrap gap-2">
                              {issue.attachments.map((att, idx) => (
                                <Button key={idx} variant="outline" size="sm" className="h-8 bg-transparent">
                                  {att.type === "image" && <ImageIcon className="h-4 w-4 mr-1" />}
                                  {att.type === "video" && <FileText className="h-4 w-4 mr-1" />}
                                  {att.type === "file" && <Paperclip className="h-4 w-4 mr-1" />}
                                  {att.name}
                                </Button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </TabsContent>

                    {/* Tab3: 关联样衣 */}
                    <TabsContent value="samples" className="p-6 m-0">
                      <Card>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>样衣编号</TableHead>
                                <TableHead>站点</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>位置</TableHead>
                                <TableHead>保管人</TableHead>
                                <TableHead>预计归还</TableHead>
                                <TableHead>操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedTask.relatedSamples.map((sample) => (
                                <TableRow key={sample.code}>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">{sample.code}</div>
                                      <div className="text-xs text-muted-foreground">{sample.name}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell>{sample.site}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={sample.available ? "outline" : "secondary"}
                                      className={sample.available ? "bg-green-50 text-green-700" : ""}
                                    >
                                      {sample.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">{sample.location}</TableCell>
                                  <TableCell className="text-sm">{sample.keeper}</TableCell>
                                  <TableCell className="text-sm">{sample.expectedReturn || "-"}</TableCell>
                                  <TableCell>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                          操作
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => toast.info("打开样衣详情")}>
                                          <Eye className="h-4 w-4 mr-2" />
                                          查看详情
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast.info("查看台账")}>
                                          <History className="h-4 w-4 mr-2" />
                                          查看台账
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast.info("发起使用申请")}>
                                          <FileText className="h-4 w-4 mr-2" />
                                          发起使用申请
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Tab4: 产出物 */}
                    <TabsContent value="output" className="p-6 space-y-4 m-0">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">改版包</CardTitle>
                            <div className="flex items-center gap-2 text-sm">
                              {selectedTask.outputPack.version ? (
                                <>
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                    <Snowflake className="h-3 w-3 mr-1" />
                                    {selectedTask.outputPack.version}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    冻结于 {selectedTask.outputPack.frozenAt} by {selectedTask.outputPack.frozenBy}
                                  </span>
                                </>
                              ) : (
                                <Badge variant="secondary">未冻结</Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {selectedTask.outputPack.attachments.map((att, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="font-medium">{att.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {att.uploadedAt} · {att.uploadedBy}
                                    </div>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          <Button variant="outline" className="w-full mt-4 bg-transparent">
                            <Upload className="h-4 w-4 mr-2" />
                            上传附件
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Tab5: 下游任务 */}
                    <TabsContent value="downstream" className="p-6 m-0">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">下游任务</CardTitle>
                            {["APPROVED", "COMPLETED"].includes(selectedTask.status) && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  const recommended = new Set<string>()
                                  selectedTask.changeList.forEach((item) => {
                                    item.recommendedDownstream.forEach((d) => recommended.add(d))
                                  })
                                  setDownstreamSelections(Array.from(recommended))
                                  setCreateDownstreamOpen(true)
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                创建下游任务
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {selectedTask.downstreamTasks.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <FolderOutput className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p>暂无下游任务</p>
                              {selectedTask.status === "APPROVED" && (
                                <p className="text-sm mt-2 text-orange-600">方案已冻结，建议创建下游任务</p>
                              )}
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>类型</TableHead>
                                  <TableHead>编号</TableHead>
                                  <TableHead>标题</TableHead>
                                  <TableHead>状态</TableHead>
                                  <TableHead>负责人</TableHead>
                                  <TableHead>操作</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>{/* 下游任务列表 */}</TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Tab6: 日志与审批 */}
                    <TabsContent value="logs" className="p-6 m-0">
                      <Card>
                        <CardContent className="p-4">
                          <div className="space-y-4">
                            {selectedTask.logs.map((log, idx) => (
                              <div key={idx} className="flex gap-4">
                                <div className="w-[140px] text-sm text-muted-foreground flex-shrink-0">{log.time}</div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{log.action}</span>
                                    <span className="text-sm text-muted-foreground">by {log.user}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{log.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* 右侧关联信息卡 */}
                <div className="w-[280px] border-l bg-muted/30 p-4 overflow-y-auto">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm">关联项目</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <Button
                          variant="link"
                          className="p-0 h-auto text-left"
                          onClick={() => toast.info("打开项目详情")}
                        >
                          <div>
                            <div className="font-medium">{selectedTask.projectId}</div>
                            <div className="text-xs text-muted-foreground">{selectedTask.projectName}</div>
                          </div>
                        </Button>
                      </CardContent>
                    </Card>

                    {selectedTask.upstreamInstance && (
                      <Card>
                        <CardHeader className="p-3 pb-2">
                          <CardTitle className="text-sm">上游实例</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <Button
                            variant="link"
                            className="p-0 h-auto text-left"
                            onClick={() => toast.info("打开上游实例")}
                          >
                            <div>
                              <div className="font-medium">{selectedTask.upstreamInstance}</div>
                              <div className="text-xs text-muted-foreground">{selectedTask.upstreamTitle}</div>
                            </div>
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {selectedTask.productRef && (
                      <Card>
                        <CardHeader className="p-3 pb-2">
                          <CardTitle className="text-sm">关联商品</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <Button variant="link" className="p-0 h-auto" onClick={() => toast.info("打开商品详情")}>
                            {selectedTask.productRef}
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm">快捷入口</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start bg-transparent"
                          onClick={() => toast.info("打开项目")}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          打开项目
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start bg-transparent"
                          onClick={() => toast.info("打开样衣库存")}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          打开样衣库存
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start bg-transparent"
                          onClick={() => toast.info("打开样衣台账")}
                        >
                          <History className="h-4 w-4 mr-2" />
                          打开样衣台账
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start bg-transparent"
                          onClick={() => toast.info("打开使用申请")}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          打开使用申请
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 创建下游任务弹窗 - RT4 */}
      <Dialog open={createDownstreamOpen} onOpenChange={setCreateDownstreamOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>创建下游任务</DialogTitle>
            <DialogDescription>根据改版清单自动推荐下游任务类型，您也可以手动调整</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">从改版清单推荐</Label>
              <div className="mt-2 space-y-2">
                {DOWNSTREAM_TASK_TYPES.map((type) => (
                  <div key={type.value} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={downstreamSelections.includes(type.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setDownstreamSelections([...downstreamSelections, type.value])
                        } else {
                          setDownstreamSelections(downstreamSelections.filter((s) => s !== type.value))
                        }
                      }}
                    />
                    <type.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{type.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>创建后将自动：</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>继承当前项目关联</li>
                <li>设置上游引用为当前改版任务</li>
                <li>可选继承关联样衣</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDownstreamOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateDownstream}>创建 ({downstreamSelections.length})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 通过冻结确认弹窗 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认通过并冻结方案？</DialogTitle>
            <DialogDescription>
              冻结后，改版方案的关键内容（目标、范围、清单、验收标准）将变为只读。如需修改，需创建新版本或走解冻流程。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast.success("已通过并冻结方案，版本号：R1")
                setApproveDialogOpen(false)
              }}
            >
              <Snowflake className="h-4 w-4 mr-1" />
              确认冻结
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 驳回弹窗 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回改版方案</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>
                驳回原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="请填写驳回原因，便于负责人修改"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectReason) {
                  toast.error("请填写驳回原因")
                  return
                }
                toast.info("已驳回，任务状态变更为进行中")
                setRejectDialogOpen(false)
                setRejectReason("")
              }}
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 标记阻塞弹窗 */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>标记任务阻塞</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>
                阻塞原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="请填写阻塞原因，例如：缺样衣、等待审批、依赖其他任务等"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!blockReason) {
                  toast.error("请填写阻塞原因")
                  return
                }
                toast.warning("任务已标记为阻塞")
                setBlockDialogOpen(false)
                setBlockReason("")
              }}
            >
              确认阻塞
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
