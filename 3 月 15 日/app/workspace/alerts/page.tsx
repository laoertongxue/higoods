"use client"

import { useState } from "react"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  Download,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  ExternalLink,
  UserPlus,
  BellOff,
  TrendingUp,
  Package,
  Store,
  ShoppingCart,
  Link2,
  Video,
  User,
  Users,
  ArrowUpRight,
  AlertCircle,
  XCircle,
  Settings,
} from "lucide-react"
import Link from "next/link"

// 风险类型枚举
const riskTypeEnum = {
  WORKITEM_OVERDUE: { label: "工作项超期", icon: Clock, color: "text-red-600", bgColor: "bg-red-50" },
  WORKITEM_BLOCKED: { label: "工作项阻塞", icon: AlertCircle, color: "text-orange-600", bgColor: "bg-orange-50" },
  SAMPLE_OVERDUE_RETURN: { label: "样衣超期未归还", icon: Package, color: "text-red-600", bgColor: "bg-red-50" },
  SAMPLE_IN_TRANSIT_UNRECEIVED: { label: "在途未签收", icon: Package, color: "text-amber-600", bgColor: "bg-amber-50" },
  SAMPLE_STOCK_MISMATCH: { label: "账实不一致", icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-50" },
  STORE_AUTH_EXPIRED: { label: "店铺授权过期", icon: Store, color: "text-red-600", bgColor: "bg-red-50" },
  STORE_AUTH_EXPIRING: { label: "店铺授权将过期", icon: Store, color: "text-amber-600", bgColor: "bg-amber-50" },
  LISTING_FAILED: { label: "上架失败", icon: ShoppingCart, color: "text-red-600", bgColor: "bg-red-50" },
  LISTING_TIMEOUT: { label: "上架超时", icon: ShoppingCart, color: "text-amber-600", bgColor: "bg-amber-50" },
  MAPPING_CONFLICT: { label: "映射冲突", icon: Link2, color: "text-red-600", bgColor: "bg-red-50" },
  MAPPING_MISSING_SKU: { label: "缺SKU映射", icon: Link2, color: "text-amber-600", bgColor: "bg-amber-50" },
  TEST_ACCOUNTING_PENDING: { label: "测款待入账", icon: Video, color: "text-amber-600", bgColor: "bg-amber-50" },
}

// 严重等级
const severityEnum = {
  P0: { label: "P0 致命", color: "bg-red-600 text-white", description: "立即处理，业务中断风险" },
  P1: { label: "P1 高", color: "bg-orange-500 text-white", description: "当日处理，明显损失风险" },
  P2: { label: "P2 中", color: "bg-amber-500 text-white", description: "本周处理" },
  P3: { label: "P3 低", color: "bg-slate-400 text-white", description: "建议关注" },
}

// 状态枚举
const statusEnum = {
  OPEN: { label: "待处理", color: "text-red-600 bg-red-50" },
  ACKED: { label: "已确认", color: "text-blue-600 bg-blue-50" },
  IN_PROGRESS: { label: "处理中", color: "text-amber-600 bg-amber-50" },
  RESOLVED: { label: "已解决", color: "text-green-600 bg-green-50" },
  SUPPRESSED: { label: "已抑制", color: "text-slate-600 bg-slate-50" },
}

// Mock风险数据
const mockRisks = [
  {
    id: "RSK-20260114-001",
    risk_type: "WORKITEM_OVERDUE",
    severity: "P0",
    status: "OPEN",
    title: "制版任务超期3天未完成",
    description: "印尼风格碎花连衣裙制版任务已超期3天，阻塞后续打样流程",
    source_type: "WorkItemInstance",
    source_id: "WI-PRJ001-005",
    source_name: "制版准备",
    project_id: "PRJ-20251216-001",
    project_name: "印尼风格碎花连衣裙",
    owner: "王版师",
    owner_id: "user_003",
    collaborators: ["李打样"],
    escalation_to: "张经理",
    detected_at: "2026-01-14 08:00",
    due_at: "2026-01-14 18:00",
    last_notified_at: "2026-01-14 10:00",
    escalation_eta: "2小时",
    site: "深圳",
    evidence_refs: [{ type: "工作项状态", content: "状态=进行中，截止=2026-01-11" }],
  },
  {
    id: "RSK-20260114-002",
    risk_type: "SAMPLE_OVERDUE_RETURN",
    severity: "P1",
    status: "ACKED",
    title: "样衣超期未归还5天",
    description: "SPL-20260108-001 印尼碎花裙样衣A已超期5天未归还",
    source_type: "SampleUseRequest",
    source_id: "SUR-20260103-001",
    source_name: "样衣使用申请#SUR-001",
    project_id: "PRJ-20251216-001",
    project_name: "印尼风格碎花连衣裙",
    owner: "陈测款",
    owner_id: "user_005",
    collaborators: ["深圳仓管"],
    escalation_to: "运营主管",
    detected_at: "2026-01-13 09:00",
    due_at: "2026-01-14 12:00",
    last_notified_at: "2026-01-14 09:00",
    escalation_eta: "已确认",
    site: "深圳",
    acked_at: "2026-01-14 09:30",
    acked_by: "陈测款",
    ack_note: "已联系测款团队，今日归还",
    evidence_refs: [
      { type: "申请单", content: "预计归还2026-01-09，实际未归还" },
      { type: "样衣", content: "SPL-20260108-001，当前位置=测款间" },
    ],
  },
  {
    id: "RSK-20260114-003",
    risk_type: "STORE_AUTH_EXPIRING",
    severity: "P2",
    status: "OPEN",
    title: "TikTok店铺授权将于5天后过期",
    description: "TikTok印尼站-HiGood旗舰店授权将于2026-01-19过期",
    source_type: "ChannelStore",
    source_id: "STORE-TK-ID-001",
    source_name: "TikTok印尼站-HiGood旗舰店",
    project_id: null,
    project_name: null,
    owner: "王渠道",
    owner_id: "user_007",
    collaborators: [],
    escalation_to: "渠道主管",
    detected_at: "2026-01-14 06:00",
    due_at: "2026-01-17 18:00",
    last_notified_at: "2026-01-14 06:00",
    escalation_eta: "3天",
    site: null,
    channel: "TikTok",
    store: "HiGood旗舰店",
    evidence_refs: [{ type: "授权状态", content: "token_expires_at=2026-01-19 00:00" }],
  },
  {
    id: "RSK-20260114-004",
    risk_type: "LISTING_FAILED",
    severity: "P1",
    status: "IN_PROGRESS",
    title: "商品上架失败-缺少必填属性",
    description: "印尼碎花裙TikTok上架失败：缺少颜色、尺码属性",
    source_type: "ListingInstance",
    source_id: "LST-20260113-001",
    source_name: "商品上架#LST-001",
    project_id: "PRJ-20251216-001",
    project_name: "印尼风格碎花连衣裙",
    owner: "李运营",
    owner_id: "user_008",
    collaborators: ["王渠道"],
    escalation_to: "运营主管",
    detected_at: "2026-01-13 16:00",
    due_at: "2026-01-14 16:00",
    last_notified_at: "2026-01-14 08:00",
    escalation_eta: "6小时",
    site: null,
    channel: "TikTok",
    store: "HiGood旗舰店",
    progress_note: "正在补充商品属性",
    evidence_refs: [{ type: "平台回执", content: "error_code=MISSING_ATTR, fields=[color,size]" }],
  },
  {
    id: "RSK-20260114-005",
    risk_type: "MAPPING_CONFLICT",
    severity: "P1",
    status: "OPEN",
    title: "SKU映射冲突-重复绑定",
    description: "渠道商品CP-TK-001的SKU映射与CP-TK-003冲突",
    source_type: "CodeMapping",
    source_id: "MAP-20260114-001",
    source_name: "SKU映射#MAP-001",
    project_id: null,
    project_name: null,
    owner: "张数据",
    owner_id: "user_009",
    collaborators: ["王渠道"],
    escalation_to: "数据主管",
    detected_at: "2026-01-14 07:00",
    due_at: "2026-01-14 18:00",
    last_notified_at: "2026-01-14 07:00",
    escalation_eta: "8小时",
    site: null,
    channel: "TikTok",
    evidence_refs: [{ type: "冲突详情", content: "internal_sku=SKU-001 被 CP-TK-001 和 CP-TK-003 同时映射" }],
  },
  {
    id: "RSK-20260114-006",
    risk_type: "TEST_ACCOUNTING_PENDING",
    severity: "P2",
    status: "OPEN",
    title: "直播测款入账待处理超48小时",
    description: "直播场次LS-20260112-001存在3个TEST条目超48小时未入账",
    source_type: "LiveSession",
    source_id: "LS-20260112-001",
    source_name: "直播场次#LS-001",
    project_id: null,
    project_name: null,
    owner: "刘测款",
    owner_id: "user_010",
    collaborators: ["测款主管"],
    escalation_to: "测款主管",
    detected_at: "2026-01-14 06:00",
    due_at: "2026-01-16 18:00",
    last_notified_at: "2026-01-14 06:00",
    escalation_eta: "2天",
    site: null,
    evidence_refs: [{ type: "待入账条目", content: "3个TEST条目，总GMV=¥12,500" }],
  },
  {
    id: "RSK-20260114-007",
    risk_type: "WORKITEM_BLOCKED",
    severity: "P1",
    status: "OPEN",
    title: "花型任务阻塞-等待面料确认",
    description: "花型调色任务因面料供应商未确认色卡而阻塞2天",
    source_type: "WorkItemInstance",
    source_id: "WI-PRJ001-008",
    source_name: "花型调色",
    project_id: "PRJ-20251216-001",
    project_name: "印尼风格碎花连衣裙",
    owner: "赵花型",
    owner_id: "user_011",
    collaborators: ["采购"],
    escalation_to: "设计主管",
    detected_at: "2026-01-12 14:00",
    due_at: "2026-01-14 14:00",
    last_notified_at: "2026-01-14 08:00",
    escalation_eta: "4小时",
    site: "深圳",
    blocker: "等待面料供应商确认色卡",
    evidence_refs: [{ type: "阻塞原因", content: "blocker=等待面料供应商确认色卡" }],
  },
  {
    id: "RSK-20260113-008",
    risk_type: "SAMPLE_IN_TRANSIT_UNRECEIVED",
    severity: "P2",
    status: "RESOLVED",
    title: "样衣在途超时未签收",
    description: "SPL-20260105-002寄往雅加达超过5天未签收",
    source_type: "SampleTransfer",
    source_id: "TRF-20260108-001",
    source_name: "样衣流转#TRF-001",
    project_id: "PRJ-20251216-001",
    project_name: "印尼风格碎花连衣裙",
    owner: "雅加达仓管",
    owner_id: "user_012",
    collaborators: ["深圳仓管"],
    escalation_to: "仓管主管",
    detected_at: "2026-01-13 09:00",
    due_at: "2026-01-13 18:00",
    last_notified_at: "2026-01-13 09:00",
    escalation_eta: null,
    site: "雅加达",
    resolved_at: "2026-01-13 15:00",
    resolved_by: "雅加达仓管",
    resolution_note: "已签收入库，物流延误导致",
    evidence_refs: [{ type: "运单", content: "SF1234567890，状态=已签收" }],
  },
]

// 去处理跳转规则
const getProcessUrl = (risk: (typeof mockRisks)[0]) => {
  switch (risk.risk_type) {
    case "WORKITEM_OVERDUE":
    case "WORKITEM_BLOCKED":
      return `/projects/${risk.project_id}/work-items/${risk.source_id}`
    case "SAMPLE_OVERDUE_RETURN":
      return `/samples/application`
    case "SAMPLE_IN_TRANSIT_UNRECEIVED":
      return `/samples/transfer`
    case "SAMPLE_STOCK_MISMATCH":
      return `/samples/inventory`
    case "STORE_AUTH_EXPIRED":
    case "STORE_AUTH_EXPIRING":
      return `/channels/stores/${risk.source_id}`
    case "LISTING_FAILED":
    case "LISTING_TIMEOUT":
      return `/channels/products/${risk.source_id}`
    case "MAPPING_CONFLICT":
    case "MAPPING_MISSING_SKU":
      return `/channels/products/mapping`
    case "TEST_ACCOUNTING_PENDING":
      return risk.source_type === "LiveSession" ? `/testing/live/${risk.source_id}` : `/testing/video/${risk.source_id}`
    default:
      return "#"
  }
}

export default function RiskAlertsPage() {
  const { toast } = useToast()
  const [risks, setRisks] = useState(mockRisks)
  const [selectedRisk, setSelectedRisk] = useState<(typeof mockRisks)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [ackDialogOpen, setAckDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [suppressDialogOpen, setSuppressDialogOpen] = useState(false)
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)

  // 筛选状态
  const [viewFilter, setViewFilter] = useState("mine")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [siteFilter, setSiteFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // 表单状态
  const [ackNote, setAckNote] = useState("")
  const [ackEta, setAckEta] = useState("")
  const [assignTo, setAssignTo] = useState("")
  const [assignNote, setAssignNote] = useState("")
  const [suppressReason, setSuppressReason] = useState("")
  const [suppressDuration, setSuppressDuration] = useState("1")
  const [resolveNote, setResolveNote] = useState("")

  // KPI计算
  const openCount = risks.filter((r) => r.status === "OPEN").length
  const p0Count = risks.filter(
    (r) => r.severity === "P0" && r.status !== "RESOLVED" && r.status !== "SUPPRESSED",
  ).length
  const todayNewCount = risks.filter((r) => r.detected_at.startsWith("2026-01-14")).length
  const escalatedCount = risks.filter((r) => r.escalation_eta === "已升级").length

  // 筛选逻辑
  const filteredRisks = risks
    .filter((r) => {
      if (viewFilter === "mine" && r.owner !== "王版师" && !r.collaborators?.includes("王版师")) return false
      if (viewFilter === "collab" && !r.collaborators?.includes("王版师")) return false
      if (severityFilter !== "all" && r.severity !== severityFilter) return false
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (typeFilter.length > 0 && !typeFilter.includes(r.risk_type)) return false
      if (siteFilter !== "all" && r.site !== siteFilter) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        if (
          !r.title.toLowerCase().includes(term) &&
          !r.id.toLowerCase().includes(term) &&
          !r.source_name?.toLowerCase().includes(term)
        )
          return false
      }
      return true
    })
    .sort((a, b) => {
      // P0→P3排序，然后按升级倒计时
      const severityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 }
      const statusOrder = { OPEN: 0, ACKED: 1, IN_PROGRESS: 2, RESOLVED: 3, SUPPRESSED: 4 }
      if (
        severityOrder[a.severity as keyof typeof severityOrder] !==
        severityOrder[b.severity as keyof typeof severityOrder]
      ) {
        return (
          severityOrder[a.severity as keyof typeof severityOrder] -
          severityOrder[b.severity as keyof typeof severityOrder]
        )
      }
      return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]
    })

  const handleAck = () => {
    if (!selectedRisk) return
    setRisks((prev) =>
      prev.map((r) =>
        r.id === selectedRisk.id
          ? { ...r, status: "ACKED", acked_at: new Date().toISOString(), acked_by: "当前用户", ack_note: ackNote }
          : r,
      ),
    )
    toast({ title: "已确认风险", description: `风险 ${selectedRisk.id} 已确认` })
    setAckDialogOpen(false)
    setAckNote("")
    setAckEta("")
  }

  const handleAssign = () => {
    if (!selectedRisk || !assignTo || !assignNote) return
    setRisks((prev) => prev.map((r) => (r.id === selectedRisk.id ? { ...r, owner: assignTo } : r)))
    toast({ title: "已分派风险", description: `风险已分派给 ${assignTo}` })
    setAssignDialogOpen(false)
    setAssignTo("")
    setAssignNote("")
  }

  const handleSuppress = () => {
    if (!selectedRisk || !suppressReason) return
    setRisks((prev) => prev.map((r) => (r.id === selectedRisk.id ? { ...r, status: "SUPPRESSED" } : r)))
    toast({ title: "已抑制风险", description: `风险将在 ${suppressDuration} 天后恢复检测` })
    setSuppressDialogOpen(false)
    setSuppressReason("")
    setSuppressDuration("1")
  }

  const handleResolve = () => {
    if (!selectedRisk || !resolveNote) return
    setRisks((prev) =>
      prev.map((r) =>
        r.id === selectedRisk.id
          ? {
              ...r,
              status: "RESOLVED",
              resolved_at: new Date().toISOString(),
              resolved_by: "当前用户",
              resolution_note: resolveNote,
            }
          : r,
      ),
    )
    toast({ title: "风险已解决", description: `风险 ${selectedRisk.id} 已标记为已解决` })
    setResolveDialogOpen(false)
    setResolveNote("")
    setDetailOpen(false)
  }

  const openDetail = (risk: (typeof mockRisks)[0]) => {
    setSelectedRisk(risk)
    setDetailOpen(true)
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
              <h1 className="text-2xl font-bold text-foreground">风险提醒</h1>
              <p className="text-sm text-muted-foreground mt-1">跨域风控与异常处置聚合中心</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toast({ title: "刷新成功" })}>
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                导出
              </Button>
              <Link href="/workspace/alerts/settings">
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  规则配置
                </Button>
              </Link>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("OPEN")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-red-50">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <span className="text-2xl font-bold text-red-600">{openCount}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">待处理</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSeverityFilter("P0")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-red-100">
                    <XCircle className="w-5 h-5 text-red-700" />
                  </div>
                  <span className="text-2xl font-bold text-red-700">{p0Count}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">P0 致命</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-2xl font-bold text-foreground">{todayNewCount}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">今日新增</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-orange-50">
                    <ArrowUpRight className="w-5 h-5 text-orange-600" />
                  </div>
                  <span className="text-2xl font-bold text-foreground">{escalatedCount}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">已升级</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* 视角切换 */}
                <Tabs value={viewFilter} onValueChange={setViewFilter} className="w-auto">
                  <TabsList>
                    <TabsTrigger value="mine">我负责</TabsTrigger>
                    <TabsTrigger value="collab">我协同</TabsTrigger>
                    <TabsTrigger value="all">全部可见</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="h-6 w-px bg-border" />

                {/* 搜索 */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索风险标题/编号/来源..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* 严重等级 */}
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="严重等级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部等级</SelectItem>
                    <SelectItem value="P0">P0 致命</SelectItem>
                    <SelectItem value="P1">P1 高</SelectItem>
                    <SelectItem value="P2">P2 中</SelectItem>
                    <SelectItem value="P3">P3 低</SelectItem>
                  </SelectContent>
                </Select>

                {/* 状态 */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="OPEN">待处理</SelectItem>
                    <SelectItem value="ACKED">已确认</SelectItem>
                    <SelectItem value="IN_PROGRESS">处理中</SelectItem>
                    <SelectItem value="RESOLVED">已解决</SelectItem>
                    <SelectItem value="SUPPRESSED">已抑制</SelectItem>
                  </SelectContent>
                </Select>

                {/* 站点 */}
                <Select value={siteFilter} onValueChange={setSiteFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="站点" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部站点</SelectItem>
                    <SelectItem value="深圳">深圳</SelectItem>
                    <SelectItem value="雅加达">雅加达</SelectItem>
                  </SelectContent>
                </Select>

                {(severityFilter !== "all" ||
                  statusFilter !== "all" ||
                  siteFilter !== "all" ||
                  typeFilter.length > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSeverityFilter("all")
                      setStatusFilter("all")
                      setSiteFilter("all")
                      setTypeFilter([])
                    }}
                  >
                    清除筛选
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Risk List Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                风险列表
                <span className="ml-2 text-sm font-normal text-muted-foreground">({filteredRisks.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">严重度</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead>风险标题</TableHead>
                    <TableHead className="w-32">风险类型</TableHead>
                    <TableHead className="w-40">来源对象</TableHead>
                    <TableHead className="w-24">责任人</TableHead>
                    <TableHead className="w-32">建议截止</TableHead>
                    <TableHead className="w-28">升级倒计时</TableHead>
                    <TableHead className="w-36">最近提醒</TableHead>
                    <TableHead className="w-28">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRisks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>暂无风险提醒</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRisks.map((risk) => {
                      const typeInfo = riskTypeEnum[risk.risk_type as keyof typeof riskTypeEnum]
                      const severityInfo = severityEnum[risk.severity as keyof typeof severityEnum]
                      const statusInfo = statusEnum[risk.status as keyof typeof statusEnum]
                      const TypeIcon = typeInfo?.icon || AlertTriangle
                      return (
                        <TableRow
                          key={risk.id}
                          className={risk.status === "RESOLVED" || risk.status === "SUPPRESSED" ? "opacity-60" : ""}
                        >
                          <TableCell>
                            <Badge className={severityInfo?.color}>{risk.severity}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded-full ${statusInfo?.color}`}>
                              {statusInfo?.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <button
                              className="text-left hover:text-primary font-medium"
                              onClick={() => openDetail(risk)}
                            >
                              {risk.title}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <TypeIcon className={`w-4 h-4 ${typeInfo?.color}`} />
                              <span className="text-sm">{typeInfo?.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={getProcessUrl(risk)} className="text-primary hover:underline text-sm">
                              {risk.source_name}
                            </Link>
                          </TableCell>
                          <TableCell>{risk.owner}</TableCell>
                          <TableCell className="text-sm">{risk.due_at}</TableCell>
                          <TableCell>
                            {risk.status === "RESOLVED" || risk.status === "SUPPRESSED" ? (
                              <span className="text-muted-foreground">-</span>
                            ) : risk.escalation_eta === "已升级" ? (
                              <Badge variant="destructive">已升级</Badge>
                            ) : (
                              <span
                                className={
                                  risk.escalation_eta?.includes("小时") && Number.parseInt(risk.escalation_eta) <= 2
                                    ? "text-red-600 font-medium"
                                    : ""
                                }
                              >
                                {risk.escalation_eta}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{risk.last_notified_at}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openDetail(risk)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  打开详情
                                </DropdownMenuItem>
                                {risk.status === "OPEN" && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedRisk(risk)
                                      setAckDialogOpen(true)
                                    }}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    确认(ACK)
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => window.open(getProcessUrl(risk), "_blank")}>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  去处理
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedRisk(risk)
                                    setAssignDialogOpen(true)
                                  }}
                                >
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  分派
                                </DropdownMenuItem>
                                {risk.status !== "SUPPRESSED" && risk.status !== "RESOLVED" && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedRisk(risk)
                                      setSuppressDialogOpen(true)
                                    }}
                                  >
                                    <BellOff className="w-4 h-4 mr-2" />
                                    抑制
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* RK2: 风险详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedRisk && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={severityEnum[selectedRisk.severity as keyof typeof severityEnum]?.color}>
                    {selectedRisk.severity}
                  </Badge>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${statusEnum[selectedRisk.status as keyof typeof statusEnum]?.color}`}
                  >
                    {statusEnum[selectedRisk.status as keyof typeof statusEnum]?.label}
                  </span>
                </div>
                <SheetTitle>{selectedRisk.title}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* 操作按钮 */}
                {selectedRisk.status !== "RESOLVED" && selectedRisk.status !== "SUPPRESSED" && (
                  <div className="flex flex-wrap gap-2">
                    {selectedRisk.status === "OPEN" && (
                      <Button size="sm" onClick={() => setAckDialogOpen(true)}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        确认
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => window.open(getProcessUrl(selectedRisk), "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      去处理
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAssignDialogOpen(true)}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      分派
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSuppressDialogOpen(true)}>
                      <BellOff className="w-4 h-4 mr-2" />
                      抑制
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setResolveDialogOpen(true)}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      标记已解决
                    </Button>
                  </div>
                )}

                {/* 风险摘要 */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">风险摘要</h4>
                  <p className="text-sm text-muted-foreground">{selectedRisk.description}</p>
                </div>

                {/* 影响范围 */}
                <div>
                  <h4 className="font-medium mb-3">影响范围</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedRisk.project_name && (
                      <div>
                        <span className="text-muted-foreground">关联项目：</span>
                        <Link
                          href={`/projects/${selectedRisk.project_id}`}
                          className="text-primary hover:underline ml-1"
                        >
                          {selectedRisk.project_name}
                        </Link>
                      </div>
                    )}
                    {selectedRisk.site && (
                      <div>
                        <span className="text-muted-foreground">站点：</span>
                        <span className="ml-1">{selectedRisk.site}</span>
                      </div>
                    )}
                    {selectedRisk.channel && (
                      <div>
                        <span className="text-muted-foreground">渠道：</span>
                        <span className="ml-1">{selectedRisk.channel}</span>
                      </div>
                    )}
                    {selectedRisk.store && (
                      <div>
                        <span className="text-muted-foreground">店铺：</span>
                        <span className="ml-1">{selectedRisk.store}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 证据与日志 */}
                <div>
                  <h4 className="font-medium mb-3">证据与日志</h4>
                  <div className="space-y-2">
                    {selectedRisk.evidence_refs?.map((ev, idx) => (
                      <div key={idx} className="p-3 border border-border rounded-lg text-sm">
                        <span className="font-medium">{ev.type}：</span>
                        <span className="text-muted-foreground ml-1">{ev.content}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 责任链 */}
                <div>
                  <h4 className="font-medium mb-3">责任链</h4>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">责任人：</span>
                      <span className="font-medium">{selectedRisk.owner}</span>
                    </div>
                    {selectedRisk.collaborators && selectedRisk.collaborators.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">协同人：</span>
                        <span>{selectedRisk.collaborators.join(", ")}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">升级对象：</span>
                      <span>{selectedRisk.escalation_to}</span>
                    </div>
                  </div>
                </div>

                {/* 处置记录 */}
                <div>
                  <h4 className="font-medium mb-3">处置记录</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                      <div>
                        <p className="font-medium">发现风险</p>
                        <p className="text-muted-foreground">{selectedRisk.detected_at} · 系统检测</p>
                      </div>
                    </div>
                    {selectedRisk.acked_at && (
                      <div className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                        <div>
                          <p className="font-medium">已确认</p>
                          <p className="text-muted-foreground">
                            {selectedRisk.acked_at} · {selectedRisk.acked_by}
                          </p>
                          {selectedRisk.ack_note && (
                            <p className="text-muted-foreground mt-1">"{selectedRisk.ack_note}"</p>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedRisk.progress_note && (
                      <div className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                        <div>
                          <p className="font-medium">处理中</p>
                          <p className="text-muted-foreground">{selectedRisk.progress_note}</p>
                        </div>
                      </div>
                    )}
                    {selectedRisk.resolved_at && (
                      <div className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5" />
                        <div>
                          <p className="font-medium">已解决</p>
                          <p className="text-muted-foreground">
                            {selectedRisk.resolved_at} · {selectedRisk.resolved_by}
                          </p>
                          {selectedRisk.resolution_note && (
                            <p className="text-muted-foreground mt-1">"{selectedRisk.resolution_note}"</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 基本信息 */}
                <div className="pt-4 border-t border-border">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">风险编号：</span>
                      <span className="ml-1">{selectedRisk.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">风险类型：</span>
                      <span className="ml-1">
                        {riskTypeEnum[selectedRisk.risk_type as keyof typeof riskTypeEnum]?.label}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">发现时间：</span>
                      <span className="ml-1">{selectedRisk.detected_at}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">建议截止：</span>
                      <span className="ml-1">{selectedRisk.due_at}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 确认(ACK)弹窗 */}
      <Dialog open={ackDialogOpen} onOpenChange={setAckDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认风险</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>预计处理时间 (可选)</Label>
              <Input
                type="datetime-local"
                value={ackEta}
                onChange={(e) => setAckEta(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>备注 (可选)</Label>
              <Textarea
                placeholder="填写处理计划或备注..."
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAckDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAck}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分派弹窗 */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分派风险</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>分派给 *</Label>
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择责任人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="王版师">王版师</SelectItem>
                  <SelectItem value="李打样">李打样</SelectItem>
                  <SelectItem value="陈测款">陈测款</SelectItem>
                  <SelectItem value="张经理">张经理</SelectItem>
                  <SelectItem value="王渠道">王渠道</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>分派原因 *</Label>
              <Textarea
                placeholder="填写分派原因..."
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAssign} disabled={!assignTo || !assignNote}>
              分派
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 抑制弹窗 */}
      <Dialog open={suppressDialogOpen} onOpenChange={setSuppressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>抑制风险</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>抑制原因 *</Label>
              <Select value={suppressReason} onValueChange={setSuppressReason}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择抑制原因" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="known_issue">已知问题</SelectItem>
                  <SelectItem value="no_action_needed">无需处理</SelectItem>
                  <SelectItem value="false_positive">误报</SelectItem>
                  <SelectItem value="external_reason">外部原因</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>抑制期限 *</Label>
              <Select value={suppressDuration} onValueChange={setSuppressDuration}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择抑制期限" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1天</SelectItem>
                  <SelectItem value="3">3天</SelectItem>
                  <SelectItem value="7">7天</SelectItem>
                  <SelectItem value="30">30天</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">到期后自动恢复检测</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuppressDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSuppress} disabled={!suppressReason}>
              抑制
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 标记已解决弹窗 */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>标记已解决</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>处理结论 *</Label>
              <Textarea
                placeholder="填写处理结论..."
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleResolve} disabled={!resolveNote}>
              确认解决
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
