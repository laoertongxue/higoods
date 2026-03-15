"use client"

import { useState } from "react"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  Download,
  Plus,
  Eye,
  X,
  Clock,
  FileText,
  Package,
  User,
  Calendar,
  Building,
  ChevronLeft,
  ChevronRight,
  Check,
  Undo,
  Send,
  Inbox,
} from "lucide-react"
import Image from "next/image"

// 状态枚举
type RequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "ACTIVE"
  | "RETURNING"
  | "COMPLETED"

// 使用场景枚举
const SCENARIOS = ["直播测款", "短视频测款", "版房制版", "工厂打样", "外协加工", "主播家播", "拍摄", "其他"]

// 取样方式枚举
const PICKUP_METHODS = ["仓库自取", "仓管交接", "快递寄送"]

// 责任站点
const SITES = ["深圳", "雅加达"]

// Mock项目数据
const PROJECTS = [
  { id: "prj_001", code: "PRJ-20251216-001", name: "印尼风格碎花连衣裙" },
  { id: "prj_002", code: "PRJ-20251216-002", name: "波西米亚风半身裙" },
  { id: "prj_003", code: "PRJ-20251216-003", name: "基础款白色T恤" },
  { id: "prj_004", code: "PRJ-20251216-004", name: "夏季牛仔短裤" },
]

// Mock工作项实例数据
const WORK_ITEMS = [
  { id: "wi_001", code: "WI-001-001", name: "直播测款-场次1", projectId: "prj_001" },
  { id: "wi_002", code: "WI-001-002", name: "短视频测款-批次A", projectId: "prj_001" },
  { id: "wi_003", code: "WI-002-001", name: "样衣拍摄", projectId: "prj_002" },
  { id: "wi_004", code: "WI-003-001", name: "版房打版", projectId: "prj_003" },
]

// Mock样衣数据
const SAMPLES = [
  {
    id: "smp_001",
    code: "SMP-20251201-001",
    name: "红色碎花连衣裙-M",
    img: "/red-floral-dress.png",
    site: "深圳",
    status: "在库",
    availability: "可用",
    location: "A-01-01",
  },
  {
    id: "smp_002",
    code: "SMP-20251201-002",
    name: "蓝色波西米亚半身裙-S",
    img: "/blue-bohemian-skirt.jpg",
    site: "深圳",
    status: "在库",
    availability: "可用",
    location: "A-01-02",
  },
  {
    id: "smp_003",
    code: "SMP-20251202-001",
    name: "白色基础T恤-L",
    img: "/white-tshirt.png",
    site: "深圳",
    status: "预占",
    availability: "不可用",
    unavailableReason: "已被申请单UR-001预占",
    location: "A-02-01",
  },
  {
    id: "smp_004",
    code: "SMP-20251203-001",
    name: "牛仔短裤-M",
    img: "/denim-shorts.png",
    site: "雅加达",
    status: "在库",
    availability: "可用",
    location: "B-01-01",
  },
  {
    id: "smp_005",
    code: "SMP-20251204-001",
    name: "米色开衫-M",
    img: "/beige-cardigan.jpg",
    site: "深圳",
    status: "借出",
    availability: "不可用",
    unavailableReason: "已借出使用中",
    location: "A-03-01",
  },
  {
    id: "smp_006",
    code: "SMP-20251205-001",
    name: "黑色西装外套-L",
    img: "/black-blazer.jpg",
    site: "雅加达",
    status: "在库",
    availability: "可用",
    location: "B-02-01",
  },
  {
    id: "smp_007",
    code: "SMP-20251206-001",
    name: "灰色卫衣-XL",
    img: "/gray-hoodie.png",
    site: "深圳",
    status: "在库",
    availability: "可用",
    location: "A-04-01",
  },
  {
    id: "smp_008",
    code: "SMP-20251207-001",
    name: "粉色雪纺衫-S",
    img: "/pink-chiffon-blouse.jpg",
    site: "深圳",
    status: "在库",
    availability: "可用",
    location: "A-05-01",
  },
]

// Mock申请单数据
interface UseRequest {
  id: string
  code: string
  status: RequestStatus
  responsibleSite: string
  sampleCount: number
  sampleIds: string[]
  expectedReturnAt: string
  projectId: string
  projectCode: string
  projectName: string
  workItemId: string
  workItemCode: string
  workItemName: string
  requesterId: string
  requesterName: string
  requesterRole: string
  approverId?: string
  approverName?: string
  scenario: string
  pickupMethod: string
  custodianType: "internal" | "external"
  custodianName: string
  remark?: string
  attachments?: string[]
  createdAt: string
  updatedAt: string
  submittedAt?: string
  approvedAt?: string
  checkoutAt?: string
  returnRequestedAt?: string
  completedAt?: string
  logs: { time: string; action: string; operator: string; remark?: string }[]
}

const initialRequests: UseRequest[] = [
  {
    id: "ur_001",
    code: "UR-20251216-001",
    status: "ACTIVE",
    responsibleSite: "深圳",
    sampleCount: 2,
    sampleIds: ["smp_001", "smp_002"],
    expectedReturnAt: "2025-12-20 18:00",
    projectId: "prj_001",
    projectCode: "PRJ-20251216-001",
    projectName: "印尼风格碎花连衣裙",
    workItemId: "wi_001",
    workItemCode: "WI-001-001",
    workItemName: "直播测款-场次1",
    requesterId: "user_001",
    requesterName: "张丽",
    requesterRole: "测款运营",
    approverId: "user_wh_001",
    approverName: "李仓管",
    scenario: "直播测款",
    pickupMethod: "仓管交接",
    custodianType: "internal",
    custodianName: "张丽",
    createdAt: "2025-12-15 09:00",
    updatedAt: "2025-12-16 10:30",
    submittedAt: "2025-12-15 09:30",
    approvedAt: "2025-12-15 14:00",
    checkoutAt: "2025-12-16 10:30",
    logs: [
      { time: "2025-12-16 10:30", action: "确认领用", operator: "李仓管", remark: "已完成交接" },
      { time: "2025-12-15 14:00", action: "审批通过", operator: "李仓管" },
      { time: "2025-12-15 09:30", action: "提交申请", operator: "张丽" },
      { time: "2025-12-15 09:00", action: "创建草稿", operator: "张丽" },
    ],
  },
  {
    id: "ur_002",
    code: "UR-20251216-002",
    status: "SUBMITTED",
    responsibleSite: "深圳",
    sampleCount: 1,
    sampleIds: ["smp_007"],
    expectedReturnAt: "2025-12-22 18:00",
    projectId: "prj_002",
    projectCode: "PRJ-20251216-002",
    projectName: "波西米亚风半身裙",
    workItemId: "wi_003",
    workItemCode: "WI-002-001",
    workItemName: "样衣拍摄",
    requesterId: "user_002",
    requesterName: "王芳",
    requesterRole: "内容运营",
    scenario: "拍摄",
    pickupMethod: "仓库自取",
    custodianType: "internal",
    custodianName: "王芳",
    createdAt: "2025-12-16 08:00",
    updatedAt: "2025-12-16 08:30",
    submittedAt: "2025-12-16 08:30",
    logs: [
      { time: "2025-12-16 08:30", action: "提交申请", operator: "王芳" },
      { time: "2025-12-16 08:00", action: "创建草稿", operator: "王芳" },
    ],
  },
  {
    id: "ur_003",
    code: "UR-20251216-003",
    status: "APPROVED",
    responsibleSite: "深圳",
    sampleCount: 1,
    sampleIds: ["smp_008"],
    expectedReturnAt: "2025-12-25 18:00",
    projectId: "prj_001",
    projectCode: "PRJ-20251216-001",
    projectName: "印尼风格碎花连衣裙",
    workItemId: "wi_002",
    workItemCode: "WI-001-002",
    workItemName: "短视频测款-批次A",
    requesterId: "user_003",
    requesterName: "陈明",
    requesterRole: "短视频运营",
    approverId: "user_wh_001",
    approverName: "李仓管",
    scenario: "短视频测款",
    pickupMethod: "仓管交接",
    custodianType: "internal",
    custodianName: "陈明",
    createdAt: "2025-12-15 14:00",
    updatedAt: "2025-12-16 09:00",
    submittedAt: "2025-12-15 14:30",
    approvedAt: "2025-12-16 09:00",
    logs: [
      { time: "2025-12-16 09:00", action: "审批通过", operator: "李仓管" },
      { time: "2025-12-15 14:30", action: "提交申请", operator: "陈明" },
      { time: "2025-12-15 14:00", action: "创建草稿", operator: "陈明" },
    ],
  },
  {
    id: "ur_004",
    code: "UR-20251215-001",
    status: "RETURNING",
    responsibleSite: "深圳",
    sampleCount: 1,
    sampleIds: ["smp_005"],
    expectedReturnAt: "2025-12-16 18:00",
    projectId: "prj_003",
    projectCode: "PRJ-20251216-003",
    projectName: "基础款白色T恤",
    workItemId: "wi_004",
    workItemCode: "WI-003-001",
    workItemName: "版房打版",
    requesterId: "user_004",
    requesterName: "赵强",
    requesterRole: "版房主管",
    approverId: "user_wh_001",
    approverName: "李仓管",
    scenario: "版房制版",
    pickupMethod: "仓库自取",
    custodianType: "internal",
    custodianName: "赵强",
    createdAt: "2025-12-10 10:00",
    updatedAt: "2025-12-16 11:00",
    submittedAt: "2025-12-10 10:30",
    approvedAt: "2025-12-10 14:00",
    checkoutAt: "2025-12-10 16:00",
    returnRequestedAt: "2025-12-16 11:00",
    logs: [
      { time: "2025-12-16 11:00", action: "发起归还", operator: "赵强", remark: "样衣已打包准备归还" },
      { time: "2025-12-10 16:00", action: "确认领用", operator: "李仓管" },
      { time: "2025-12-10 14:00", action: "审批通过", operator: "李仓管" },
      { time: "2025-12-10 10:30", action: "提交申请", operator: "赵强" },
      { time: "2025-12-10 10:00", action: "创建草稿", operator: "赵强" },
    ],
  },
  {
    id: "ur_005",
    code: "UR-20251214-001",
    status: "COMPLETED",
    responsibleSite: "雅加达",
    sampleCount: 1,
    sampleIds: ["smp_004"],
    expectedReturnAt: "2025-12-15 18:00",
    projectId: "prj_004",
    projectCode: "PRJ-20251216-004",
    projectName: "夏季牛仔短裤",
    workItemId: "wi_001",
    workItemCode: "WI-001-001",
    workItemName: "直播测款-场次1",
    requesterId: "user_005",
    requesterName: "林小红",
    requesterRole: "雅加达运营",
    approverId: "user_wh_002",
    approverName: "Budi",
    scenario: "直播测款",
    pickupMethod: "仓管交接",
    custodianType: "external",
    custodianName: "主播Siti",
    createdAt: "2025-12-12 09:00",
    updatedAt: "2025-12-15 16:00",
    submittedAt: "2025-12-12 09:30",
    approvedAt: "2025-12-12 11:00",
    checkoutAt: "2025-12-12 14:00",
    returnRequestedAt: "2025-12-15 10:00",
    completedAt: "2025-12-15 16:00",
    logs: [
      { time: "2025-12-15 16:00", action: "确认归还入库", operator: "Budi" },
      { time: "2025-12-15 10:00", action: "发起归还", operator: "林小红" },
      { time: "2025-12-12 14:00", action: "确认领用", operator: "Budi" },
      { time: "2025-12-12 11:00", action: "审批通过", operator: "Budi" },
      { time: "2025-12-12 09:30", action: "提交申请", operator: "林小红" },
      { time: "2025-12-12 09:00", action: "创建草稿", operator: "林小红" },
    ],
  },
  {
    id: "ur_006",
    code: "UR-20251213-001",
    status: "REJECTED",
    responsibleSite: "深圳",
    sampleCount: 2,
    sampleIds: ["smp_001", "smp_007"],
    expectedReturnAt: "2025-12-18 18:00",
    projectId: "prj_001",
    projectCode: "PRJ-20251216-001",
    projectName: "印尼风格碎花连衣裙",
    workItemId: "wi_001",
    workItemCode: "WI-001-001",
    workItemName: "直播测款-场次1",
    requesterId: "user_006",
    requesterName: "周杰",
    requesterRole: "实习运营",
    scenario: "主播家播",
    pickupMethod: "快递寄送",
    custodianType: "external",
    custodianName: "家播主播小美",
    remark: "需要寄送到主播家中",
    createdAt: "2025-12-13 15:00",
    updatedAt: "2025-12-14 10:00",
    submittedAt: "2025-12-13 15:30",
    logs: [
      { time: "2025-12-14 10:00", action: "驳回", operator: "李仓管", remark: "外寄主播需提供押金协议" },
      { time: "2025-12-13 15:30", action: "提交申请", operator: "周杰" },
      { time: "2025-12-13 15:00", action: "创建草稿", operator: "周杰" },
    ],
  },
  {
    id: "ur_007",
    code: "UR-20251216-004",
    status: "DRAFT",
    responsibleSite: "深圳",
    sampleCount: 1,
    sampleIds: ["smp_001"],
    expectedReturnAt: "2025-12-23 18:00",
    projectId: "prj_001",
    projectCode: "PRJ-20251216-001",
    projectName: "印尼风格碎花连衣裙",
    workItemId: "wi_001",
    workItemCode: "WI-001-001",
    workItemName: "直播测款-场次1",
    requesterId: "user_001",
    requesterName: "张丽",
    requesterRole: "测款运营",
    scenario: "直播测款",
    pickupMethod: "仓管交接",
    custodianType: "internal",
    custodianName: "张丽",
    createdAt: "2025-12-16 14:00",
    updatedAt: "2025-12-16 14:00",
    logs: [{ time: "2025-12-16 14:00", action: "创建草稿", operator: "张丽" }],
  },
  {
    id: "ur_008",
    code: "UR-20251210-001",
    status: "CANCELLED",
    responsibleSite: "雅加达",
    sampleCount: 1,
    sampleIds: ["smp_006"],
    expectedReturnAt: "2025-12-15 18:00",
    projectId: "prj_004",
    projectCode: "PRJ-20251216-004",
    projectName: "夏季牛仔短裤",
    workItemId: "wi_001",
    workItemCode: "WI-001-001",
    workItemName: "直播测款-场次1",
    requesterId: "user_005",
    requesterName: "林小红",
    requesterRole: "雅加达运营",
    scenario: "拍摄",
    pickupMethod: "仓库自取",
    custodianType: "internal",
    custodianName: "林小红",
    createdAt: "2025-12-10 08:00",
    updatedAt: "2025-12-11 09:00",
    submittedAt: "2025-12-10 08:30",
    logs: [
      { time: "2025-12-11 09:00", action: "取消申请", operator: "林小红", remark: "拍摄计划取消" },
      { time: "2025-12-10 08:30", action: "提交申请", operator: "林小红" },
      { time: "2025-12-10 08:00", action: "创建草稿", operator: "林小红" },
    ],
  },
]

// 状态配置
const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  SUBMITTED: { label: "待审批", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "已批准", color: "bg-blue-100 text-blue-700" },
  REJECTED: { label: "已驳回", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "已取消", color: "bg-gray-100 text-gray-500" },
  ACTIVE: { label: "使用中", color: "bg-green-100 text-green-700" },
  RETURNING: { label: "归还中", color: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
}

export default function SampleUseRequestPage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<UseRequest[]>(initialRequests)

  // 筛选状态
  const [searchKeyword, setSearchKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [siteFilter, setSiteFilter] = useState("all")
  const [dateType, setDateType] = useState("apply") // apply | return

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // 抽屉状态
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<UseRequest | null>(null)

  // 对话框状态
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [cancelReason, setCancelReason] = useState("")

  // 新建申请表单状态
  const [newRequest, setNewRequest] = useState({
    projectId: "",
    workItemId: "",
    expectedReturnAt: "",
    scenario: "",
    pickupMethod: "",
    custodianType: "internal" as "internal" | "external",
    custodianName: "",
    selectedSampleIds: [] as string[],
    remark: "",
  })

  // 筛选逻辑
  const filteredRequests = requests.filter((req) => {
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      const match =
        req.code.toLowerCase().includes(keyword) ||
        req.projectName.toLowerCase().includes(keyword) ||
        req.workItemName.toLowerCase().includes(keyword) ||
        req.requesterName.toLowerCase().includes(keyword)
      if (!match) return false
    }
    if (statusFilter !== "all" && req.status !== statusFilter) return false
    if (siteFilter !== "all" && req.responsibleSite !== siteFilter) return false
    return true
  })

  // 分页数据
  const totalPages = Math.ceil(filteredRequests.length / pageSize)
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // 统计数据
  const stats = {
    total: requests.length,
    draft: requests.filter((r) => r.status === "DRAFT").length,
    submitted: requests.filter((r) => r.status === "SUBMITTED").length,
    approved: requests.filter((r) => r.status === "APPROVED").length,
    active: requests.filter((r) => r.status === "ACTIVE").length,
    returning: requests.filter((r) => r.status === "RETURNING").length,
    completed: requests.filter((r) => r.status === "COMPLETED").length,
    overdue: requests.filter(
      (r) => (r.status === "ACTIVE" || r.status === "RETURNING") && new Date(r.expectedReturnAt) < new Date(),
    ).length,
  }

  // 打开详情抽屉
  const openDetailDrawer = (request: UseRequest) => {
    setSelectedRequest(request)
    setDetailDrawerOpen(true)
  }

  // 获取样衣信息
  const getSampleById = (id: string) => SAMPLES.find((s) => s.id === id)

  // 判断是否超期
  const isOverdue = (request: UseRequest) => {
    if (request.status !== "ACTIVE" && request.status !== "RETURNING") return false
    return new Date(request.expectedReturnAt) < new Date()
  }

  // 审批通过
  const handleApprove = () => {
    if (!selectedRequest) return
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: "APPROVED" as RequestStatus,
              approverId: "user_wh_001",
              approverName: "李仓管",
              approvedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              updatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              logs: [
                {
                  time: new Date().toISOString().replace("T", " ").slice(0, 16),
                  action: "审批通过",
                  operator: "李仓管",
                },
                ...r.logs,
              ],
            }
          : r,
      ),
    )
    setSelectedRequest((prev) => (prev ? { ...prev, status: "APPROVED" as RequestStatus } : null))
    setApproveDialogOpen(false)
    toast({ title: "审批成功", description: "申请单已批准，样衣已预占锁定" })
  }

  // 驳回
  const handleReject = () => {
    if (!selectedRequest || !rejectReason) return
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: "REJECTED" as RequestStatus,
              updatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              logs: [
                {
                  time: new Date().toISOString().replace("T", " ").slice(0, 16),
                  action: "驳回",
                  operator: "李仓管",
                  remark: rejectReason,
                },
                ...r.logs,
              ],
            }
          : r,
      ),
    )
    setSelectedRequest((prev) => (prev ? { ...prev, status: "REJECTED" as RequestStatus } : null))
    setRejectDialogOpen(false)
    setRejectReason("")
    toast({ title: "已驳回", description: "申请单已驳回" })
  }

  // 取消申请
  const handleCancel = () => {
    if (!selectedRequest) return
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: "CANCELLED" as RequestStatus,
              updatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              logs: [
                {
                  time: new Date().toISOString().replace("T", " ").slice(0, 16),
                  action: "取消申请",
                  operator: "当前用户",
                  remark: cancelReason || undefined,
                },
                ...r.logs,
              ],
            }
          : r,
      ),
    )
    setSelectedRequest((prev) => (prev ? { ...prev, status: "CANCELLED" as RequestStatus } : null))
    setCancelDialogOpen(false)
    setCancelReason("")
    toast({ title: "已取消", description: "申请单已取消" })
  }

  // 确认领用
  const handleCheckout = () => {
    if (!selectedRequest) return
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: "ACTIVE" as RequestStatus,
              checkoutAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              updatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              logs: [
                {
                  time: new Date().toISOString().replace("T", " ").slice(0, 16),
                  action: "确认领用",
                  operator: "李仓管",
                },
                ...r.logs,
              ],
            }
          : r,
      ),
    )
    setSelectedRequest((prev) => (prev ? { ...prev, status: "ACTIVE" as RequestStatus } : null))
    toast({ title: "领用成功", description: "样衣已出库，申请单进入使用中状态" })
  }

  // 发起归还
  const handleRequestReturn = () => {
    if (!selectedRequest) return
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: "RETURNING" as RequestStatus,
              returnRequestedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              updatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              logs: [
                {
                  time: new Date().toISOString().replace("T", " ").slice(0, 16),
                  action: "发起归还",
                  operator: "当前用户",
                },
                ...r.logs,
              ],
            }
          : r,
      ),
    )
    setSelectedRequest((prev) => (prev ? { ...prev, status: "RETURNING" as RequestStatus } : null))
    toast({ title: "已发起归还", description: "请等待仓管确认归还入库" })
  }

  // 确认归还入库
  const handleConfirmReturn = () => {
    if (!selectedRequest) return
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: "COMPLETED" as RequestStatus,
              completedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              updatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              logs: [
                {
                  time: new Date().toISOString().replace("T", " ").slice(0, 16),
                  action: "确认归还入库",
                  operator: "李仓管",
                },
                ...r.logs,
              ],
            }
          : r,
      ),
    )
    setSelectedRequest((prev) => (prev ? { ...prev, status: "COMPLETED" as RequestStatus } : null))
    toast({ title: "归还完成", description: "样衣已入库，申请单已完成" })
  }

  // 新建申请
  const handleCreateRequest = () => {
    // 校验
    if (!newRequest.projectId) {
      toast({ title: "请选择项目", variant: "destructive" })
      return
    }
    if (!newRequest.workItemId) {
      toast({ title: "请选择工作项实例", variant: "destructive" })
      return
    }
    if (!newRequest.expectedReturnAt) {
      toast({ title: "请选择预计归还时间", variant: "destructive" })
      return
    }
    if (newRequest.selectedSampleIds.length === 0) {
      toast({ title: "请选择至少一件样衣", variant: "destructive" })
      return
    }

    // 校验样衣可用性
    const unavailableSamples = newRequest.selectedSampleIds
      .map((id) => getSampleById(id))
      .filter((s) => s && s.availability !== "可用")
    if (unavailableSamples.length > 0) {
      toast({
        title: "存在不可用样衣",
        description: "请移除不可用的样衣后重试",
        variant: "destructive",
      })
      return
    }

    // 校验责任站点一致性
    const sites = new Set(newRequest.selectedSampleIds.map((id) => getSampleById(id)?.site))
    if (sites.size > 1) {
      toast({
        title: "责任站点不一致",
        description: "所选样衣的责任站点必须相同，请拆分为多张申请",
        variant: "destructive",
      })
      return
    }

    const project = PROJECTS.find((p) => p.id === newRequest.projectId)
    const workItem = WORK_ITEMS.find((w) => w.id === newRequest.workItemId)
    const firstSample = getSampleById(newRequest.selectedSampleIds[0])

    const newReq: UseRequest = {
      id: `ur_${Date.now()}`,
      code: `UR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(requests.length + 1).padStart(3, "0")}`,
      status: "DRAFT",
      responsibleSite: firstSample?.site || "深圳",
      sampleCount: newRequest.selectedSampleIds.length,
      sampleIds: newRequest.selectedSampleIds,
      expectedReturnAt: newRequest.expectedReturnAt,
      projectId: newRequest.projectId,
      projectCode: project?.code || "",
      projectName: project?.name || "",
      workItemId: newRequest.workItemId,
      workItemCode: workItem?.code || "",
      workItemName: workItem?.name || "",
      requesterId: "user_current",
      requesterName: "当前用户",
      requesterRole: "运营",
      scenario: newRequest.scenario || "其他",
      pickupMethod: newRequest.pickupMethod || "仓管交接",
      custodianType: newRequest.custodianType,
      custodianName: newRequest.custodianName || "当前用户",
      remark: newRequest.remark,
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      updatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      logs: [
        {
          time: new Date().toISOString().replace("T", " ").slice(0, 16),
          action: "创建草稿",
          operator: "当前用户",
        },
      ],
    }

    setRequests((prev) => [newReq, ...prev])
    setCreateDrawerOpen(false)
    setNewRequest({
      projectId: "",
      workItemId: "",
      expectedReturnAt: "",
      scenario: "",
      pickupMethod: "",
      custodianType: "internal",
      custodianName: "",
      selectedSampleIds: [],
      remark: "",
    })
    toast({ title: "创建成功", description: "申请单已保存为草稿" })
  }

  // 提交申请
  const handleSubmitRequest = () => {
    if (!selectedRequest) return
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: "SUBMITTED" as RequestStatus,
              submittedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              updatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              logs: [
                {
                  time: new Date().toISOString().replace("T", " ").slice(0, 16),
                  action: "提交申请",
                  operator: "当前用户",
                },
                ...r.logs,
              ],
            }
          : r,
      ),
    )
    setSelectedRequest((prev) => (prev ? { ...prev, status: "SUBMITTED" as RequestStatus } : null))
    toast({ title: "提交成功", description: "申请单已提交，等待审批" })
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6">
          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">样衣使用申请</h1>
            <p className="text-sm text-muted-foreground mt-1">管理样衣借用申请流程，驱动预占/领用/归还台账事件</p>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-8 gap-4 mb-6">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("all")}>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">全部申请</div>
                <div className="text-2xl font-bold mt-1">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("DRAFT")}>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">草稿</div>
                <div className="text-2xl font-bold mt-1 text-gray-600">{stats.draft}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setStatusFilter("SUBMITTED")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">待审批</div>
                <div className="text-2xl font-bold mt-1 text-yellow-600">{stats.submitted}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setStatusFilter("APPROVED")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">已批准</div>
                <div className="text-2xl font-bold mt-1 text-blue-600">{stats.approved}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setStatusFilter("ACTIVE")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">使用中</div>
                <div className="text-2xl font-bold mt-1 text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setStatusFilter("RETURNING")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">归还中</div>
                <div className="text-2xl font-bold mt-1 text-purple-600">{stats.returning}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setStatusFilter("COMPLETED")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">已完成</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600">{stats.completed}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="text-sm text-red-600">超期未归还</div>
                <div className="text-2xl font-bold mt-1 text-red-600">{stats.overdue}</div>
              </CardContent>
            </Card>
          </div>

          {/* 筛选栏 */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">关键词</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="申请单号/样衣编号/项目/工作项/申请人"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-[140px]">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">状态</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="DRAFT">草稿</SelectItem>
                      <SelectItem value="SUBMITTED">待审批</SelectItem>
                      <SelectItem value="APPROVED">已批准</SelectItem>
                      <SelectItem value="ACTIVE">使用中</SelectItem>
                      <SelectItem value="RETURNING">归还中</SelectItem>
                      <SelectItem value="COMPLETED">已完成</SelectItem>
                      <SelectItem value="REJECTED">已驳回</SelectItem>
                      <SelectItem value="CANCELLED">已取消</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[120px]">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">责任站点</Label>
                  <Select value={siteFilter} onValueChange={setSiteFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部站点</SelectItem>
                      <SelectItem value="深圳">深圳</SelectItem>
                      <SelectItem value="雅加达">雅加达</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchKeyword("")
                      setStatusFilter("all")
                      setSiteFilter("all")
                    }}
                  >
                    重置
                  </Button>
                  <Button>查询</Button>
                </div>
                <div className="flex-1" />
                <Button onClick={() => setCreateDrawerOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  新建申请
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-1" />
                  导出
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 数据表格 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[140px]">申请单号</TableHead>
                    <TableHead className="w-[90px]">状态</TableHead>
                    <TableHead className="w-[80px]">责任站点</TableHead>
                    <TableHead className="w-[80px]">样衣数量</TableHead>
                    <TableHead className="w-[140px]">预计归还时间</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>工作项实例</TableHead>
                    <TableHead className="w-[100px]">申请人</TableHead>
                    <TableHead className="w-[100px]">审批人/仓管</TableHead>
                    <TableHead className="w-[140px]">更新时间</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRequests.map((req) => (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetailDrawer(req)}
                    >
                      <TableCell className="font-medium text-primary">{req.code}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_CONFIG[req.status].color}>{STATUS_CONFIG[req.status].label}</Badge>
                      </TableCell>
                      <TableCell>{req.responsibleSite}</TableCell>
                      <TableCell>{req.sampleCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {req.expectedReturnAt.slice(0, 10)}
                          {isOverdue(req) && (
                            <Badge variant="destructive" className="text-xs">
                              超期
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">{req.projectCode}</div>
                        <div className="truncate max-w-[150px]">{req.projectName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">{req.workItemCode}</div>
                        <div className="truncate max-w-[150px]">{req.workItemName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">{req.requesterRole}</div>
                        <div>{req.requesterName}</div>
                      </TableCell>
                      <TableCell>{req.approverName || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{req.updatedAt}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDetailDrawer(req)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分页 */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-muted-foreground">共 {filteredRequests.length} 条</div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {currentPage} / {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* 详情抽屉 */}
      <Sheet open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedRequest && (
            <>
              <SheetHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="flex items-center gap-2">
                      {selectedRequest.code}
                      <Badge className={STATUS_CONFIG[selectedRequest.status].color}>
                        {STATUS_CONFIG[selectedRequest.status].label}
                      </Badge>
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{selectedRequest.responsibleSite}</Badge>
                      {isOverdue(selectedRequest) && <Badge variant="destructive">超期风险</Badge>}
                    </div>
                  </div>
                </div>
                {/* 操作按钮 */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {selectedRequest.status === "DRAFT" && (
                    <Button size="sm" onClick={handleSubmitRequest}>
                      <Send className="h-4 w-4 mr-1" />
                      提交申请
                    </Button>
                  )}
                  {selectedRequest.status === "SUBMITTED" && (
                    <>
                      <Button size="sm" onClick={() => setApproveDialogOpen(true)}>
                        <Check className="h-4 w-4 mr-1" />
                        审批通过
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)}>
                        <X className="h-4 w-4 mr-1" />
                        驳回
                      </Button>
                    </>
                  )}
                  {selectedRequest.status === "APPROVED" && (
                    <Button size="sm" onClick={handleCheckout}>
                      <Package className="h-4 w-4 mr-1" />
                      确认领用
                    </Button>
                  )}
                  {selectedRequest.status === "ACTIVE" && (
                    <Button size="sm" onClick={handleRequestReturn}>
                      <Undo className="h-4 w-4 mr-1" />
                      发起归还
                    </Button>
                  )}
                  {selectedRequest.status === "RETURNING" && (
                    <Button size="sm" onClick={handleConfirmReturn}>
                      <Inbox className="h-4 w-4 mr-1" />
                      确认归还入库
                    </Button>
                  )}
                  {(selectedRequest.status === "DRAFT" ||
                    selectedRequest.status === "SUBMITTED" ||
                    selectedRequest.status === "APPROVED") && (
                    <Button size="sm" variant="outline" onClick={() => setCancelDialogOpen(true)}>
                      取消申请
                    </Button>
                  )}
                </div>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* 绑定信息 */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    绑定信息
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">项目</div>
                      <div>{selectedRequest.projectCode}</div>
                      <div className="font-medium">{selectedRequest.projectName}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">工作项实例</div>
                      <div>{selectedRequest.workItemCode}</div>
                      <div className="font-medium">{selectedRequest.workItemName}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">预计归还时间</div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {selectedRequest.expectedReturnAt}
                        {isOverdue(selectedRequest) && (
                          <Badge variant="destructive" className="text-xs">
                            超期
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">责任站点</div>
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        {selectedRequest.responsibleSite}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 使用信息 */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    使用信息
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">使用场景</div>
                      <div>{selectedRequest.scenario}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">取样方式</div>
                      <div>{selectedRequest.pickupMethod}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">保管人类型</div>
                      <div>{selectedRequest.custodianType === "internal" ? "内部人员" : "外部主体"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">保管人</div>
                      <div>{selectedRequest.custodianName}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">申请人</div>
                      <div>
                        {selectedRequest.requesterName}（{selectedRequest.requesterRole}）
                      </div>
                    </div>
                    {selectedRequest.approverName && (
                      <div>
                        <div className="text-muted-foreground">审批人</div>
                        <div>{selectedRequest.approverName}</div>
                      </div>
                    )}
                  </div>
                  {selectedRequest.remark && (
                    <div className="mt-3">
                      <div className="text-muted-foreground text-sm">备注</div>
                      <div className="text-sm bg-muted p-2 rounded mt-1">{selectedRequest.remark}</div>
                    </div>
                  )}
                </div>

                {/* 样衣清单 */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    样衣清单（{selectedRequest.sampleCount}件）
                  </h3>
                  <div className="space-y-2">
                    {selectedRequest.sampleIds.map((sampleId) => {
                      const sample = getSampleById(sampleId)
                      if (!sample) return null
                      return (
                        <div key={sampleId} className="flex items-center gap-3 p-3 border rounded-lg">
                          <div className="w-12 h-12 relative rounded overflow-hidden bg-muted">
                            <Image
                              src={sample.img || "/placeholder.svg"}
                              alt={sample.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{sample.name}</div>
                            <div className="text-xs text-muted-foreground">{sample.code}</div>
                          </div>
                          <div className="text-right text-sm">
                            <div>{sample.site}</div>
                            <div className="text-xs text-muted-foreground">{sample.location}</div>
                          </div>
                          <Badge
                            className={
                              sample.availability === "可用" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }
                          >
                            {sample.availability}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 审批与操作日志 */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    审批与操作日志
                  </h3>
                  <div className="space-y-3">
                    {selectedRequest.logs.map((log, idx) => (
                      <div key={idx} className="flex gap-3 text-sm">
                        <div className="w-[130px] text-muted-foreground shrink-0">{log.time}</div>
                        <div className="flex-1">
                          <span className="font-medium">{log.action}</span>
                          <span className="text-muted-foreground ml-2">by {log.operator}</span>
                          {log.remark && <div className="text-muted-foreground mt-0.5">{log.remark}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 新建申请抽屉 */}
      <Sheet open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>新建样衣使用申请</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* A. 绑定信息 */}
            <div>
              <h3 className="font-semibold mb-3">绑定信息（必填）</h3>
              <div className="space-y-4">
                <div>
                  <Label>项目 *</Label>
                  <Select
                    value={newRequest.projectId}
                    onValueChange={(v) => setNewRequest((prev) => ({ ...prev, projectId: v, workItemId: "" }))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="选择项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECTS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>工作项实例 *</Label>
                  <Select
                    value={newRequest.workItemId}
                    onValueChange={(v) => setNewRequest((prev) => ({ ...prev, workItemId: v }))}
                    disabled={!newRequest.projectId}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="选择工作项实例" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_ITEMS.filter((w) => w.projectId === newRequest.projectId).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.code} - {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>预计归还时间 *</Label>
                  <Input
                    type="datetime-local"
                    className="mt-1.5"
                    value={newRequest.expectedReturnAt}
                    onChange={(e) =>
                      setNewRequest((prev) => ({
                        ...prev,
                        expectedReturnAt: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* B. 使用信息 */}
            <div>
              <h3 className="font-semibold mb-3">使用信息</h3>
              <div className="space-y-4">
                <div>
                  <Label>使用场景</Label>
                  <Select
                    value={newRequest.scenario}
                    onValueChange={(v) => setNewRequest((prev) => ({ ...prev, scenario: v }))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="选择使用场景" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCENARIOS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>取样方式</Label>
                  <Select
                    value={newRequest.pickupMethod}
                    onValueChange={(v) => setNewRequest((prev) => ({ ...prev, pickupMethod: v }))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="选择取样方式" />
                    </SelectTrigger>
                    <SelectContent>
                      {PICKUP_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>保管人类型</Label>
                  <Select
                    value={newRequest.custodianType}
                    onValueChange={(v) =>
                      setNewRequest((prev) => ({
                        ...prev,
                        custodianType: v as "internal" | "external",
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">内部人员</SelectItem>
                      <SelectItem value="external">外部主体</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>保管人姓名</Label>
                  <Input
                    className="mt-1.5"
                    value={newRequest.custodianName}
                    onChange={(e) =>
                      setNewRequest((prev) => ({
                        ...prev,
                        custodianName: e.target.value,
                      }))
                    }
                    placeholder="输入保管人姓名"
                  />
                </div>
              </div>
            </div>

            {/* C. 样衣清单 */}
            <div>
              <h3 className="font-semibold mb-3">样衣清单 *</h3>
              <div className="space-y-2">
                {SAMPLES.map((sample) => {
                  const isSelected = newRequest.selectedSampleIds.includes(sample.id)
                  const isUnavailable = sample.availability !== "可用"
                  return (
                    <div
                      key={sample.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg ${
                        isUnavailable ? "opacity-50 bg-muted" : ""
                      } ${isSelected ? "border-primary bg-primary/5" : ""}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isUnavailable}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewRequest((prev) => ({
                              ...prev,
                              selectedSampleIds: [...prev.selectedSampleIds, sample.id],
                            }))
                          } else {
                            setNewRequest((prev) => ({
                              ...prev,
                              selectedSampleIds: prev.selectedSampleIds.filter((id) => id !== sample.id),
                            }))
                          }
                        }}
                      />
                      <div className="w-10 h-10 relative rounded overflow-hidden bg-muted">
                        <Image src={sample.img || "/placeholder.svg"} alt={sample.name} fill className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{sample.name}</div>
                        <div className="text-xs text-muted-foreground">{sample.code}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div>{sample.site}</div>
                        <div className="text-muted-foreground">{sample.location}</div>
                      </div>
                      <Badge
                        className={
                          sample.availability === "可用" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }
                      >
                        {sample.availability}
                      </Badge>
                    </div>
                  )
                })}
              </div>
              {newRequest.selectedSampleIds.length > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  已选择 {newRequest.selectedSampleIds.length} 件样衣
                </div>
              )}
            </div>

            {/* D. 附件与备注 */}
            <div>
              <h3 className="font-semibold mb-3">附件与备注</h3>
              <div>
                <Label>补充说明</Label>
                <Textarea
                  className="mt-1.5"
                  value={newRequest.remark}
                  onChange={(e) => setNewRequest((prev) => ({ ...prev, remark: e.target.value }))}
                  placeholder="输入补充说明..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setCreateDrawerOpen(false)}>
              取消
            </Button>
            <Button variant="outline" onClick={handleCreateRequest}>
              保存草稿
            </Button>
            <Button
              onClick={() => {
                handleCreateRequest()
                // 创建后自动提交
              }}
            >
              提交申请
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 审批通过对话框 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认审批通过</DialogTitle>
            <DialogDescription>审批通过后，所选样衣将被预占锁定，申请人可以进行领用操作。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleApprove}>确认通过</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 驳回对话框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回申请</DialogTitle>
            <DialogDescription>请填写驳回原因</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入驳回原因..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason}>
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 取消申请对话框 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消申请</DialogTitle>
            <DialogDescription>确定要取消此申请吗？如果样衣已被预占，将自动释放预占。</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="取消原因（可选）..."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              返回
            </Button>
            <Button variant="destructive" onClick={handleCancel}>
              确认取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
