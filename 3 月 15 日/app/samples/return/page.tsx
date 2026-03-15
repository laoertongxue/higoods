"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Search,
  RotateCcw,
  Plus,
  Download,
  MoreHorizontal,
  Eye,
  Package,
  FileText,
  Bell,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
} from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"

// 时间常量
const NOW_ISO = "2025-12-16T12:30:30+08:00"

// 案件类型枚举
type CaseType = "RETURN" | "DISPOSITION"

// 案件状态枚举
type CaseStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "RETURNING"
  | "CONFIRMED"
  | "EXECUTING"
  | "CLOSED"
  | "REJECTED"
  | "CANCELLED"

// 原因分类枚举
type ReasonCategory =
  | "QUALITY_FAIL"
  | "DAMAGED"
  | "MISSING_PARTS"
  | "WRONG_SIZE_COLOR"
  | "OVERDUE_RETURN"
  | "INVENTORY_DIFF"
  | "SUPPLIER_ISSUE"
  | "OTHER"

// 处置结果枚举
type DispositionResult = "SCRAP" | "RETAIN" | "INTERNAL_USE" | "DONATE" | "OTHER"

// 责任站点枚举
type ResponsibleSite = "SHENZHEN" | "JAKARTA"

// 案件接口
interface ReturnCase {
  id: string
  case_code: string
  case_type: CaseType
  case_status: CaseStatus
  responsible_site: ResponsibleSite
  sample_id: string
  sample_code: string
  sample_name: string
  sample_image: string
  inventory_status_snapshot: string
  reason_category: ReasonCategory
  reason_detail: string
  evidence_attachments: string[]
  project_ref: { code: string; name: string } | null
  work_item_ref: { code: string; name: string } | null
  requester: { role: string; name: string }
  handler: { role: string; name: string } | null
  return_target?: string
  return_method?: string
  tracking_no?: string
  disposition_result?: DispositionResult
  disposition_location?: string
  executor?: string
  priority: "LOW" | "MEDIUM" | "HIGH"
  sla_deadline: string
  created_at: string
  updated_at: string
  closed_at?: string
  case_logs: Array<{
    id: string
    action: string
    operator: string
    time: string
    comment?: string
  }>
}

// 案件类型映射
const caseTypeMap: Record<CaseType, string> = {
  RETURN: "退货",
  DISPOSITION: "处置",
}

// 案件状态映射
const caseStatusMap: Record<CaseStatus, { label: string; color: string }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  SUBMITTED: { label: "已提交", color: "bg-blue-100 text-blue-700" },
  APPROVED: { label: "已批准", color: "bg-green-100 text-green-700" },
  RETURNING: { label: "退货中", color: "bg-yellow-100 text-yellow-700" },
  CONFIRMED: { label: "已确认", color: "bg-emerald-100 text-emerald-700" },
  EXECUTING: { label: "执行中", color: "bg-orange-100 text-orange-700" },
  CLOSED: { label: "已结案", color: "bg-gray-100 text-gray-700" },
  REJECTED: { label: "已驳回", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已取消", color: "bg-gray-100 text-gray-500" },
}

// 原因分类映射
const reasonCategoryMap: Record<ReasonCategory, string> = {
  QUALITY_FAIL: "质检不合格",
  DAMAGED: "破损",
  MISSING_PARTS: "缺件",
  WRONG_SIZE_COLOR: "错码错色",
  OVERDUE_RETURN: "超期未归还",
  INVENTORY_DIFF: "盘点差异",
  SUPPLIER_ISSUE: "供应商问题",
  OTHER: "其它",
}

// 处置结果映射
const dispositionResultMap: Record<DispositionResult, string> = {
  SCRAP: "报废/销毁",
  RETAIN: "留存归档",
  INTERNAL_USE: "转内部使用",
  DONATE: "捐赠",
  OTHER: "其他",
}

// 责任站点映射
const responsibleSiteMap: Record<ResponsibleSite, string> = {
  SHENZHEN: "深圳",
  JAKARTA: "雅加达",
}

// Mock数据 - 案件列表
const mockCases: ReturnCase[] = [
  {
    id: "case_001",
    case_code: "RC-20251216-001",
    case_type: "RETURN",
    case_status: "SUBMITTED",
    responsible_site: "SHENZHEN",
    sample_id: "smp_001",
    sample_code: "SMP-20251210-001",
    sample_name: "印尼风格碎花连衣裙",
    sample_image: "/red-floral-dress.png",
    inventory_status_snapshot: "异常-待处理",
    reason_category: "QUALITY_FAIL",
    reason_detail: "面料起球严重，不符合质检标准",
    evidence_attachments: ["evidence_001.jpg", "evidence_002.jpg"],
    project_ref: { code: "PRJ-20251216-001", name: "印尼风格碎花连衣裙" },
    work_item_ref: { code: "WI-INS-001", name: "样衣质检" },
    requester: { role: "质检员", name: "李明" },
    handler: { role: "仓管", name: "王华" },
    return_target: "东莞服装厂",
    return_method: "快递",
    priority: "HIGH",
    sla_deadline: "2025-12-18T18:00:00+08:00",
    created_at: "2025-12-16T09:00:00+08:00",
    updated_at: "2025-12-16T10:30:00+08:00",
    case_logs: [
      {
        id: "log_001",
        action: "创建案件",
        operator: "李明",
        time: "2025-12-16 09:00",
        comment: "发起质检不合格退货申请",
      },
      { id: "log_002", action: "提交审批", operator: "李明", time: "2025-12-16 09:15" },
    ],
  },
  {
    id: "case_002",
    case_code: "RC-20251216-002",
    case_type: "DISPOSITION",
    case_status: "APPROVED",
    responsible_site: "SHENZHEN",
    sample_id: "smp_002",
    sample_code: "SMP-20251210-002",
    sample_name: "蓝色波西米亚半裙",
    sample_image: "/blue-bohemian-skirt.jpg",
    inventory_status_snapshot: "异常-破损",
    reason_category: "DAMAGED",
    reason_detail: "拉链损坏无法修复，建议报废处理",
    evidence_attachments: ["evidence_003.jpg"],
    project_ref: { code: "PRJ-20251216-002", name: "波西米亚系列" },
    work_item_ref: null,
    requester: { role: "仓管", name: "王华" },
    handler: { role: "仓管", name: "王华" },
    disposition_result: "SCRAP",
    disposition_location: "深圳报废区",
    executor: "王华",
    priority: "MEDIUM",
    sla_deadline: "2025-12-20T18:00:00+08:00",
    created_at: "2025-12-15T14:00:00+08:00",
    updated_at: "2025-12-16T11:00:00+08:00",
    case_logs: [
      { id: "log_003", action: "创建案件", operator: "王华", time: "2025-12-15 14:00" },
      { id: "log_004", action: "提交审批", operator: "王华", time: "2025-12-15 14:30" },
      { id: "log_005", action: "审批通过", operator: "张经理", time: "2025-12-16 11:00", comment: "同意报废处理" },
    ],
  },
  {
    id: "case_003",
    case_code: "RC-20251215-003",
    case_type: "RETURN",
    case_status: "RETURNING",
    responsible_site: "SHENZHEN",
    sample_id: "smp_003",
    sample_code: "SMP-20251208-003",
    sample_name: "白色基础T恤",
    sample_image: "/white-tshirt.png",
    inventory_status_snapshot: "在途",
    reason_category: "WRONG_SIZE_COLOR",
    reason_detail: "实际收到L码，订单为M码",
    evidence_attachments: ["evidence_004.jpg", "evidence_005.jpg"],
    project_ref: { code: "PRJ-20251215-003", name: "基础款T恤系列" },
    work_item_ref: { code: "WI-ACQ-003", name: "样衣获取" },
    requester: { role: "采购", name: "赵敏" },
    handler: { role: "仓管", name: "王华" },
    return_target: "广州针织厂",
    return_method: "快递",
    tracking_no: "SF1234567890",
    priority: "MEDIUM",
    sla_deadline: "2025-12-19T18:00:00+08:00",
    created_at: "2025-12-14T10:00:00+08:00",
    updated_at: "2025-12-16T08:00:00+08:00",
    case_logs: [
      { id: "log_006", action: "创建案件", operator: "赵敏", time: "2025-12-14 10:00" },
      { id: "log_007", action: "提交审批", operator: "赵敏", time: "2025-12-14 10:30" },
      { id: "log_008", action: "审批通过", operator: "王华", time: "2025-12-14 14:00" },
      {
        id: "log_009",
        action: "执行退货",
        operator: "王华",
        time: "2025-12-15 09:00",
        comment: "已寄出，运单号SF1234567890",
      },
    ],
  },
  {
    id: "case_004",
    case_code: "RC-20251214-004",
    case_type: "RETURN",
    case_status: "CLOSED",
    responsible_site: "JAKARTA",
    sample_id: "smp_004",
    sample_code: "SMP-20251205-004",
    sample_name: "牛仔短裤",
    sample_image: "/denim-shorts.png",
    inventory_status_snapshot: "已退货",
    reason_category: "SUPPLIER_ISSUE",
    reason_detail: "供应商发错货，需退回更换",
    evidence_attachments: ["evidence_006.jpg"],
    project_ref: { code: "PRJ-20251214-004", name: "夏季牛仔系列" },
    work_item_ref: null,
    requester: { role: "采购", name: "Andi" },
    handler: { role: "仓管", name: "Budi" },
    return_target: "Jakarta Textile Co.",
    return_method: "自送",
    priority: "LOW",
    sla_deadline: "2025-12-18T18:00:00+08:00",
    created_at: "2025-12-10T09:00:00+08:00",
    updated_at: "2025-12-14T16:00:00+08:00",
    closed_at: "2025-12-14T16:00:00+08:00",
    case_logs: [
      { id: "log_010", action: "创建案件", operator: "Andi", time: "2025-12-10 09:00" },
      { id: "log_011", action: "提交审批", operator: "Andi", time: "2025-12-10 09:30" },
      { id: "log_012", action: "审批通过", operator: "Budi", time: "2025-12-10 14:00" },
      { id: "log_013", action: "执行退货", operator: "Budi", time: "2025-12-12 10:00" },
      { id: "log_014", action: "确认签收", operator: "Budi", time: "2025-12-14 14:00", comment: "供应商已签收" },
      { id: "log_015", action: "结案", operator: "Budi", time: "2025-12-14 16:00", comment: "写入台账退货事件" },
    ],
  },
  {
    id: "case_005",
    case_code: "RC-20251213-005",
    case_type: "DISPOSITION",
    case_status: "EXECUTING",
    responsible_site: "SHENZHEN",
    sample_id: "smp_005",
    sample_code: "SMP-20251201-005",
    sample_name: "米色针织开衫",
    sample_image: "/beige-cardigan.jpg",
    inventory_status_snapshot: "待处置",
    reason_category: "OVERDUE_RETURN",
    reason_detail: "借出超过90天未归还，已联系无果，转内部留存",
    evidence_attachments: [],
    project_ref: { code: "PRJ-20251201-005", name: "秋冬针织系列" },
    work_item_ref: { code: "WI-USE-005", name: "样衣使用" },
    requester: { role: "仓管", name: "王华" },
    handler: { role: "仓管", name: "王华" },
    disposition_result: "INTERNAL_USE",
    disposition_location: "深圳陈列区",
    executor: "王华",
    priority: "LOW",
    sla_deadline: "2025-12-25T18:00:00+08:00",
    created_at: "2025-12-13T11:00:00+08:00",
    updated_at: "2025-12-16T09:30:00+08:00",
    case_logs: [
      { id: "log_016", action: "创建案件", operator: "王华", time: "2025-12-13 11:00" },
      { id: "log_017", action: "提交审批", operator: "王华", time: "2025-12-13 11:30" },
      { id: "log_018", action: "审批通过", operator: "张经理", time: "2025-12-14 09:00" },
      { id: "log_019", action: "执行处置", operator: "王华", time: "2025-12-16 09:30", comment: "移至陈列区" },
    ],
  },
  {
    id: "case_006",
    case_code: "RC-20251216-006",
    case_type: "RETURN",
    case_status: "DRAFT",
    responsible_site: "SHENZHEN",
    sample_id: "smp_006",
    sample_code: "SMP-20251212-006",
    sample_name: "黑色西装外套",
    sample_image: "/black-blazer.jpg",
    inventory_status_snapshot: "异常-缺件",
    reason_category: "MISSING_PARTS",
    reason_detail: "缺少配套纽扣",
    evidence_attachments: ["evidence_007.jpg"],
    project_ref: null,
    work_item_ref: null,
    requester: { role: "质检员", name: "李明" },
    handler: null,
    return_target: "",
    return_method: "",
    priority: "MEDIUM",
    sla_deadline: "2025-12-20T18:00:00+08:00",
    created_at: "2025-12-16T11:00:00+08:00",
    updated_at: "2025-12-16T11:00:00+08:00",
    case_logs: [{ id: "log_020", action: "创建案件", operator: "李明", time: "2025-12-16 11:00" }],
  },
  {
    id: "case_007",
    case_code: "RC-20251212-007",
    case_type: "DISPOSITION",
    case_status: "CLOSED",
    responsible_site: "SHENZHEN",
    sample_id: "smp_007",
    sample_code: "SMP-20251128-007",
    sample_name: "灰色连帽卫衣",
    sample_image: "/gray-hoodie.png",
    inventory_status_snapshot: "已处置",
    reason_category: "INVENTORY_DIFF",
    reason_detail: "盘点发现实物与系统不符，确认报废",
    evidence_attachments: ["evidence_008.jpg", "evidence_009.jpg"],
    project_ref: { code: "PRJ-20251128-007", name: "休闲卫衣系列" },
    work_item_ref: null,
    requester: { role: "仓管", name: "王华" },
    handler: { role: "仓管", name: "王华" },
    disposition_result: "SCRAP",
    disposition_location: "深圳报废区",
    executor: "王华",
    priority: "LOW",
    sla_deadline: "2025-12-15T18:00:00+08:00",
    created_at: "2025-12-08T10:00:00+08:00",
    updated_at: "2025-12-12T15:00:00+08:00",
    closed_at: "2025-12-12T15:00:00+08:00",
    case_logs: [
      { id: "log_021", action: "创建案件", operator: "王华", time: "2025-12-08 10:00" },
      { id: "log_022", action: "提交审批", operator: "王华", time: "2025-12-08 10:30" },
      { id: "log_023", action: "审批通过", operator: "张经理", time: "2025-12-09 09:00" },
      { id: "log_024", action: "执行处置", operator: "王华", time: "2025-12-12 10:00" },
      { id: "log_025", action: "结案", operator: "王华", time: "2025-12-12 15:00", comment: "写入台账处置事件" },
    ],
  },
  {
    id: "case_008",
    case_code: "RC-20251215-008",
    case_type: "RETURN",
    case_status: "REJECTED",
    responsible_site: "JAKARTA",
    sample_id: "smp_008",
    sample_code: "SMP-20251210-008",
    sample_name: "粉色雪纺上衣",
    sample_image: "/pink-chiffon-blouse.jpg",
    inventory_status_snapshot: "在库-可用",
    reason_category: "OTHER",
    reason_detail: "款式不符合市场需求，申请退回",
    evidence_attachments: [],
    project_ref: { code: "PRJ-20251210-008", name: "春季雪纺系列" },
    work_item_ref: null,
    requester: { role: "设计师", name: "Maya" },
    handler: { role: "仓管", name: "Budi" },
    return_target: "Surabaya Factory",
    return_method: "快递",
    priority: "LOW",
    sla_deadline: "2025-12-22T18:00:00+08:00",
    created_at: "2025-12-15T08:00:00+08:00",
    updated_at: "2025-12-15T14:00:00+08:00",
    case_logs: [
      { id: "log_026", action: "创建案件", operator: "Maya", time: "2025-12-15 08:00" },
      { id: "log_027", action: "提交审批", operator: "Maya", time: "2025-12-15 08:30" },
      {
        id: "log_028",
        action: "驳回",
        operator: "Budi",
        time: "2025-12-15 14:00",
        comment: "样衣状态正常，不符合退货条件",
      },
    ],
  },
]

// 统计数据
const statsData = {
  total: mockCases.length,
  pending: mockCases.filter((c) => c.case_status === "SUBMITTED").length,
  processing: mockCases.filter((c) => ["APPROVED", "RETURNING", "EXECUTING"].includes(c.case_status)).length,
  closed: mockCases.filter((c) => c.case_status === "CLOSED").length,
  overdue: mockCases.filter(
    (c) => new Date(c.sla_deadline) < new Date(NOW_ISO) && !["CLOSED", "CANCELLED", "REJECTED"].includes(c.case_status),
  ).length,
}

export default function SampleReturnPage() {
  const router = useRouter()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>("all")
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>("all")
  const [responsibleSiteFilter, setResponsibleSiteFilter] = useState<string>("all")
  const [reasonFilter, setReasonFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCase, setSelectedCase] = useState<ReturnCase | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [newCaseDialogOpen, setNewCaseDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [approveComment, setApproveComment] = useState("")
  const [closeComment, setCloseComment] = useState("")
  const pageSize = 10

  // 筛选案件
  const filteredCases = mockCases.filter((c) => {
    if (
      searchKeyword &&
      !c.case_code.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !c.sample_code.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !c.sample_name.toLowerCase().includes(searchKeyword.toLowerCase())
    ) {
      return false
    }
    if (caseTypeFilter !== "all" && c.case_type !== caseTypeFilter) return false
    if (caseStatusFilter !== "all" && c.case_status !== caseStatusFilter) return false
    if (responsibleSiteFilter !== "all" && c.responsible_site !== responsibleSiteFilter) return false
    if (reasonFilter !== "all" && c.reason_category !== reasonFilter) return false
    return true
  })

  const totalPages = Math.ceil(filteredCases.length / pageSize)
  const paginatedCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // 打开案件详情抽屉
  const openCaseDrawer = (caseItem: ReturnCase) => {
    setSelectedCase(caseItem)
    setDrawerOpen(true)
  }

  // 重置筛选
  const resetFilters = () => {
    setSearchKeyword("")
    setCaseTypeFilter("all")
    setCaseStatusFilter("all")
    setResponsibleSiteFilter("all")
    setReasonFilter("all")
    setCurrentPage(1)
  }

  // 处理提交
  const handleSubmit = () => {
    if (!selectedCase) return
    toast.success(`案件 ${selectedCase.case_code} 已提交审批`)
    setDrawerOpen(false)
  }

  // 处理审批
  const handleApprove = (approved: boolean) => {
    if (!selectedCase) return
    if (approved) {
      toast.success(`案件 ${selectedCase.case_code} 已审批通过`)
    } else {
      toast.info(`案件 ${selectedCase.case_code} 已驳回`)
    }
    setApproveDialogOpen(false)
    setApproveComment("")
    setDrawerOpen(false)
  }

  // 处理执行
  const handleExecute = () => {
    if (!selectedCase) return
    if (selectedCase.case_type === "RETURN") {
      toast.success(`案件 ${selectedCase.case_code} 已执行退货寄出`)
    } else {
      toast.success(`案件 ${selectedCase.case_code} 已执行处置`)
    }
    setDrawerOpen(false)
  }

  // 处理结案
  const handleClose = () => {
    if (!selectedCase) return
    const eventType = selectedCase.case_type === "RETURN" ? "退货" : "处置"
    toast.success(`案件 ${selectedCase.case_code} 已结案，已写入台账${eventType}事件`)
    setCloseDialogOpen(false)
    setCloseComment("")
    setDrawerOpen(false)
  }

  // 获取可用操作按钮
  const getAvailableActions = (caseItem: ReturnCase) => {
    const actions: string[] = []
    switch (caseItem.case_status) {
      case "DRAFT":
        actions.push("submit", "cancel")
        break
      case "SUBMITTED":
        actions.push("approve", "reject", "withdraw")
        break
      case "APPROVED":
        actions.push("execute")
        break
      case "RETURNING":
        actions.push("confirm")
        break
      case "CONFIRMED":
        actions.push("close")
        break
      case "EXECUTING":
        actions.push("close")
        break
    }
    return actions
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">样衣退货与处理</h1>
              <Button onClick={() => setNewCaseDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                新建案件
              </Button>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-5 gap-4">
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setCaseStatusFilter("all")
                  setCurrentPage(1)
                }}
              >
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">全部案件</div>
                  <div className="text-2xl font-bold">{statsData.total}</div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setCaseStatusFilter("SUBMITTED")
                  setCurrentPage(1)
                }}
              >
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-4 w-4 text-blue-500" />
                    待审批
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{statsData.pending}</div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setCaseStatusFilter("APPROVED")
                  setCurrentPage(1)
                }}
              >
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <ArrowRight className="h-4 w-4 text-orange-500" />
                    处理中
                  </div>
                  <div className="text-2xl font-bold text-orange-600">{statsData.processing}</div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setCaseStatusFilter("CLOSED")
                  setCurrentPage(1)
                }}
              >
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    已结案
                  </div>
                  <div className="text-2xl font-bold text-green-600">{statsData.closed}</div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow border-red-200"
                onClick={() => toast.info("筛选超期案件")}
              >
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    超期未处理
                  </div>
                  <div className="text-2xl font-bold text-red-600">{statsData.overdue}</div>
                </CardContent>
              </Card>
            </div>

            {/* 筛选栏 */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[200px] max-w-[300px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="搜索案件编号/样衣编号/名称"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <Select value={caseTypeFilter} onValueChange={setCaseTypeFilter}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="案件类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      <SelectItem value="RETURN">退货</SelectItem>
                      <SelectItem value="DISPOSITION">处置</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={caseStatusFilter} onValueChange={setCaseStatusFilter}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="案件状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="DRAFT">草稿</SelectItem>
                      <SelectItem value="SUBMITTED">已提交</SelectItem>
                      <SelectItem value="APPROVED">已批准</SelectItem>
                      <SelectItem value="RETURNING">退货中</SelectItem>
                      <SelectItem value="CONFIRMED">已确认</SelectItem>
                      <SelectItem value="EXECUTING">执行中</SelectItem>
                      <SelectItem value="CLOSED">已结案</SelectItem>
                      <SelectItem value="REJECTED">已驳回</SelectItem>
                      <SelectItem value="CANCELLED">已取消</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={responsibleSiteFilter} onValueChange={setResponsibleSiteFilter}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="责任站点" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部站点</SelectItem>
                      <SelectItem value="SHENZHEN">深圳</SelectItem>
                      <SelectItem value="JAKARTA">雅加达</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={reasonFilter} onValueChange={setReasonFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="原因分类" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部原因</SelectItem>
                      {Object.entries(reasonCategoryMap).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={resetFilters}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    重置
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    导出
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 案件列表 */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[140px]">案件编号</TableHead>
                      <TableHead className="w-[80px]">类型</TableHead>
                      <TableHead className="w-[90px]">状态</TableHead>
                      <TableHead className="w-[80px]">责任站点</TableHead>
                      <TableHead className="w-[200px]">样衣</TableHead>
                      <TableHead className="w-[100px]">样衣状态</TableHead>
                      <TableHead className="w-[100px]">原因</TableHead>
                      <TableHead className="w-[140px]">关联项目</TableHead>
                      <TableHead className="w-[100px]">发起人</TableHead>
                      <TableHead className="w-[100px]">受理人</TableHead>
                      <TableHead className="w-[100px]">更新时间</TableHead>
                      <TableHead className="w-[60px]">风险</TableHead>
                      <TableHead className="w-[80px] text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCases.map((caseItem) => {
                      const isOverdue =
                        new Date(caseItem.sla_deadline) < new Date(NOW_ISO) &&
                        !["CLOSED", "CANCELLED", "REJECTED"].includes(caseItem.case_status)
                      return (
                        <TableRow
                          key={caseItem.id}
                          className={`cursor-pointer hover:bg-muted/50 ${isOverdue ? "bg-red-50" : ""}`}
                          onClick={() => openCaseDrawer(caseItem)}
                        >
                          <TableCell className="font-medium text-blue-600">{caseItem.case_code}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                caseItem.case_type === "RETURN"
                                  ? "border-blue-500 text-blue-600"
                                  : "border-purple-500 text-purple-600"
                              }
                            >
                              {caseTypeMap[caseItem.case_type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={caseStatusMap[caseItem.case_status].color}>
                              {caseStatusMap[caseItem.case_status].label}
                            </Badge>
                          </TableCell>
                          <TableCell>{responsibleSiteMap[caseItem.responsible_site]}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Image
                                src={caseItem.sample_image || "/placeholder.svg"}
                                alt={caseItem.sample_name}
                                width={32}
                                height={32}
                                className="rounded object-cover"
                              />
                              <div>
                                <div className="font-medium text-sm">{caseItem.sample_code}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                                  {caseItem.sample_name}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {caseItem.inventory_status_snapshot}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{reasonCategoryMap[caseItem.reason_category]}</span>
                          </TableCell>
                          <TableCell>
                            {caseItem.project_ref ? (
                              <div>
                                <div className="text-sm">{caseItem.project_ref.code}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[100px]">
                                  {caseItem.project_ref.name}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{caseItem.requester.role}</div>
                            <div className="text-xs text-muted-foreground">{caseItem.requester.name}</div>
                          </TableCell>
                          <TableCell>
                            {caseItem.handler ? (
                              <div>
                                <div className="text-sm">{caseItem.handler.role}</div>
                                <div className="text-xs text-muted-foreground">{caseItem.handler.name}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">待受理</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(caseItem.updated_at).toLocaleDateString("zh-CN")}
                          </TableCell>
                          <TableCell>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-xs">
                                超期
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openCaseDrawer(caseItem)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  查看详情
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.info(`打开样衣库存 ${caseItem.sample_code}`)}>
                                  <Package className="h-4 w-4 mr-2" />
                                  打开库存
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.info(`打开样衣台账 ${caseItem.sample_code}`)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  打开台账
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.info(`催办案件 ${caseItem.case_code}`)}>
                                  <Bell className="h-4 w-4 mr-2" />
                                  催办
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                {/* 分页 */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">共 {filteredCases.length} 条</div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      {currentPage} / {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* 案件详情抽屉 */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedCase && (
            <>
              <SheetHeader className="sticky top-0 bg-background z-10 pb-4 border-b">
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2">
                    {caseTypeMap[selectedCase.case_type]} · {selectedCase.case_code}
                  </SheetTitle>
                  <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={caseStatusMap[selectedCase.case_status].color}>
                    {caseStatusMap[selectedCase.case_status].label}
                  </Badge>
                  <Badge variant="outline">{responsibleSiteMap[selectedCase.responsible_site]}</Badge>
                  <Badge variant="outline">{selectedCase.inventory_status_snapshot}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {getAvailableActions(selectedCase).includes("submit") && (
                    <Button size="sm" onClick={handleSubmit}>
                      提交审批
                    </Button>
                  )}
                  {getAvailableActions(selectedCase).includes("withdraw") && (
                    <Button size="sm" variant="outline" onClick={() => toast.info("已撤回")}>
                      撤回
                    </Button>
                  )}
                  {getAvailableActions(selectedCase).includes("approve") && (
                    <Button size="sm" onClick={() => setApproveDialogOpen(true)}>
                      审批
                    </Button>
                  )}
                  {getAvailableActions(selectedCase).includes("execute") && (
                    <Button size="sm" onClick={handleExecute}>
                      {selectedCase.case_type === "RETURN" ? "执行退货" : "执行处置"}
                    </Button>
                  )}
                  {getAvailableActions(selectedCase).includes("confirm") && (
                    <Button size="sm" onClick={() => toast.success("已确认签收")}>
                      确认签收
                    </Button>
                  )}
                  {getAvailableActions(selectedCase).includes("close") && (
                    <Button size="sm" onClick={() => setCloseDialogOpen(true)}>
                      结案
                    </Button>
                  )}
                  {getAvailableActions(selectedCase).includes("cancel") && (
                    <Button size="sm" variant="destructive" onClick={() => toast.info("已取消")}>
                      取消
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(`打开库存 ${selectedCase.sample_code}`)}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    打开库存
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(`打开台账 ${selectedCase.sample_code}`)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    打开台账
                  </Button>
                </div>
              </SheetHeader>

              <div className="py-6 space-y-6">
                {/* Section A: 案件概览 */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">A. 案件概览</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">案件类型：</span>
                      <span className="font-medium">{caseTypeMap[selectedCase.case_type]}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">责任站点：</span>
                      <span className="font-medium">{responsibleSiteMap[selectedCase.responsible_site]}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">发起人：</span>
                      <span className="font-medium">
                        {selectedCase.requester.role} - {selectedCase.requester.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">发起时间：</span>
                      <span className="font-medium">{new Date(selectedCase.created_at).toLocaleString("zh-CN")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">受理人：</span>
                      <span className="font-medium">
                        {selectedCase.handler
                          ? `${selectedCase.handler.role} - ${selectedCase.handler.name}`
                          : "待受理"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">优先级：</span>
                      <Badge
                        variant={
                          selectedCase.priority === "HIGH"
                            ? "destructive"
                            : selectedCase.priority === "MEDIUM"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {selectedCase.priority === "HIGH" ? "高" : selectedCase.priority === "MEDIUM" ? "中" : "低"}
                      </Badge>
                    </div>
                    {selectedCase.project_ref && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">关联项目：</span>
                        <span className="font-medium text-blue-600 cursor-pointer">
                          {selectedCase.project_ref.code} - {selectedCase.project_ref.name}
                        </span>
                      </div>
                    )}
                    {selectedCase.work_item_ref && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">关联工作项：</span>
                        <span className="font-medium text-blue-600 cursor-pointer">
                          {selectedCase.work_item_ref.code} - {selectedCase.work_item_ref.name}
                        </span>
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="text-muted-foreground">SLA到期：</span>
                      <span
                        className={`font-medium ${new Date(selectedCase.sla_deadline) < new Date(NOW_ISO) ? "text-red-600" : ""}`}
                      >
                        {new Date(selectedCase.sla_deadline).toLocaleString("zh-CN")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section B: 样衣信息 */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">B. 样衣信息（只读快照）</h3>
                  <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                    <Image
                      src={selectedCase.sample_image || "/placeholder.svg"}
                      alt={selectedCase.sample_name}
                      width={80}
                      height={80}
                      className="rounded object-cover"
                    />
                    <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">样衣编号：</span>
                        <span className="font-medium">{selectedCase.sample_code}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">样衣名称：</span>
                        <span className="font-medium">{selectedCase.sample_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">当前状态：</span>
                        <Badge variant="outline">{selectedCase.inventory_status_snapshot}</Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">责任站点：</span>
                        <span className="font-medium">{responsibleSiteMap[selectedCase.responsible_site]}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section C: 原因与证据 */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">C. 原因与证据</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">原因大类：</span>
                      <Badge variant="outline">{reasonCategoryMap[selectedCase.reason_category]}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">原因详情：</span>
                      <p className="mt-1 p-3 bg-muted/50 rounded">{selectedCase.reason_detail}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">证据附件：</span>
                      {selectedCase.evidence_attachments.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedCase.evidence_attachments.map((file, idx) => (
                            <Badge key={idx} variant="secondary" className="cursor-pointer">
                              {file}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground ml-2">暂无</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section D: 处理方案 */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">D. 处理方案</h3>
                  {selectedCase.case_type === "RETURN" ? (
                    <div className="grid grid-cols-2 gap-4 text-sm p-4 bg-blue-50 rounded-lg">
                      <div>
                        <span className="text-muted-foreground">退货对象：</span>
                        <span className="font-medium">{selectedCase.return_target || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">退货方式：</span>
                        <span className="font-medium">{selectedCase.return_method || "-"}</span>
                      </div>
                      {selectedCase.tracking_no && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">运单号：</span>
                          <span className="font-medium text-blue-600">{selectedCase.tracking_no}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-sm p-4 bg-purple-50 rounded-lg">
                      <div>
                        <span className="text-muted-foreground">处置结果：</span>
                        <span className="font-medium">
                          {selectedCase.disposition_result
                            ? dispositionResultMap[selectedCase.disposition_result]
                            : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">处置地点：</span>
                        <span className="font-medium">{selectedCase.disposition_location || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">执行人：</span>
                        <span className="font-medium">{selectedCase.executor || "-"}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section E: 审批与案件日志 */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">E. 审批与案件日志</h3>
                  <div className="space-y-3">
                    {selectedCase.case_logs.map((log, idx) => (
                      <div key={log.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-2 h-2 rounded-full ${idx === selectedCase.case_logs.length - 1 ? "bg-blue-500" : "bg-gray-300"}`}
                          />
                          {idx < selectedCase.case_logs.length - 1 && <div className="w-0.5 h-full bg-gray-200" />}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{log.action}</span>
                            <span className="text-xs text-muted-foreground">{log.operator}</span>
                            <span className="text-xs text-muted-foreground">{log.time}</span>
                          </div>
                          {log.comment && <p className="text-sm text-muted-foreground mt-1">{log.comment}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section F: 结案信息 */}
                {selectedCase.case_status === "CLOSED" && selectedCase.closed_at && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground">F. 结案信息</h3>
                    <div className="p-4 bg-green-50 rounded-lg text-sm space-y-2">
                      <div>
                        <span className="text-muted-foreground">结案时间：</span>
                        <span className="font-medium">{new Date(selectedCase.closed_at).toLocaleString("zh-CN")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">落账回执：</span>
                        <span className="font-medium text-green-600">
                          已写入台账{selectedCase.case_type === "RETURN" ? "退货" : "处置"}事件
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">库存状态更新：</span>
                        <Badge className="bg-green-100 text-green-700">{selectedCase.inventory_status_snapshot}</Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 新建案件对话框 */}
      <Dialog open={newCaseDialogOpen} onOpenChange={setNewCaseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建退货与处理案件</DialogTitle>
            <DialogDescription>请填写案件基本信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>案件类型</Label>
              <Select defaultValue="RETURN">
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETURN">退货</SelectItem>
                  <SelectItem value="DISPOSITION">处置</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>关联样衣</Label>
              <Input placeholder="输入样衣编号或选择" />
            </div>
            <div className="space-y-2">
              <Label>原因分类</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择原因" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reasonCategoryMap).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>原因详情</Label>
              <Textarea placeholder="请描述详细原因..." />
            </div>
            <div className="space-y-2">
              <Label>证据附件</Label>
              <Button variant="outline" className="w-full bg-transparent">
                <Upload className="h-4 w-4 mr-2" />
                上传附件
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCaseDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast.success("案件创建成功")
                setNewCaseDialogOpen(false)
              }}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 审批对话框 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审批案件</DialogTitle>
            <DialogDescription>请审批案件 {selectedCase?.case_code}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>审批意见</Label>
              <Textarea
                placeholder="请输入审批意见..."
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleApprove(false)}>
              <XCircle className="h-4 w-4 mr-2" />
              驳回
            </Button>
            <Button onClick={() => handleApprove(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 结案对话框 */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>结案确认</DialogTitle>
            <DialogDescription>
              结案后将写入台账{selectedCase?.case_type === "RETURN" ? "退货" : "处置"}事件，此操作不可撤销
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>结案备注</Label>
              <Textarea
                placeholder="请输入结案备注..."
                value={closeComment}
                onChange={(e) => setCloseComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleClose}>确认结案</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
