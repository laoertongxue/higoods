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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Upload,
  CheckCircle,
  Calculator,
  XCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
} from "lucide-react"

// 记录状态枚举
const RECORD_STATUS = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  RECONCILING: { label: "核对中", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "已关账", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "已取消", color: "bg-red-100 text-red-700" },
}

// 测款入账状态枚举
const TEST_ACCOUNTING_STATUS = {
  NONE: { label: "无测款", color: "bg-gray-100 text-gray-600" },
  PENDING: { label: "待入账", color: "bg-yellow-100 text-yellow-700" },
  ACCOUNTED: { label: "已入账", color: "bg-green-100 text-green-700" },
}

// 记录用途枚举
const RECORD_PURPOSE = {
  TEST: { label: "测款", color: "bg-purple-100 text-purple-700" },
  PROMOTION: { label: "推广", color: "bg-blue-100 text-blue-700" },
  TEASER: { label: "活动预热", color: "bg-cyan-100 text-cyan-700" },
  SALES: { label: "销售转化", color: "bg-orange-100 text-orange-700" },
  SEEDING: { label: "内容种草", color: "bg-pink-100 text-pink-700" },
  SOFT_LAUNCH: { label: "上新试水", color: "bg-indigo-100 text-indigo-700" },
  OTHER: { label: "其他", color: "bg-gray-100 text-gray-700" },
}

// 平台枚举
const PLATFORMS = {
  TIKTOK: { label: "TikTok", color: "bg-black text-white" },
  DOUYIN: { label: "抖音", color: "bg-gray-800 text-white" },
  KUAISHOU: { label: "快手", color: "bg-orange-500 text-white" },
  OTHER: { label: "其他", color: "bg-gray-100 text-gray-700" },
}

// Mock数据
const mockRecords = [
  {
    id: "SV-20260123-012",
    title: "春季新款印花裙穿搭分享",
    status: "COMPLETED",
    purposes: ["PROMOTION", "SALES"],
    platform: "TIKTOK",
    account: "IDN-Store-A",
    creator: "KOL-Blue",
    publishedAt: "2026-01-23 11:30",
    owner: "张三",
    itemCount: 3,
    testItemCount: 1,
    testAccountingStatus: "ACCOUNTED",
    sampleCount: 2,
    views: 125000,
    likes: 8500,
    gmv: 12680,
    updatedAt: "2026-01-23 15:30",
    isTestAccountingEnabled: true,
  },
  {
    id: "SV-20260122-008",
    title: "办公室穿搭OOTD分享",
    status: "RECONCILING",
    purposes: ["SEEDING", "TEST"],
    platform: "DOUYIN",
    account: "CN-Brand-Official",
    creator: "达人-小美",
    publishedAt: "2026-01-22 18:00",
    owner: "李四",
    itemCount: 5,
    testItemCount: 2,
    testAccountingStatus: "PENDING",
    sampleCount: 4,
    views: 89000,
    likes: 5200,
    gmv: 8900,
    updatedAt: "2026-01-22 20:45",
    isTestAccountingEnabled: true,
  },
  {
    id: "SV-20260121-005",
    title: "夏季清凉穿搭推荐",
    status: "RECONCILING",
    purposes: ["TEST"],
    platform: "TIKTOK",
    account: "IDN-Store-B",
    creator: "KOL-Sunny",
    publishedAt: "2026-01-21 14:30",
    owner: "王五",
    itemCount: 2,
    testItemCount: 2,
    testAccountingStatus: "PENDING",
    sampleCount: 2,
    views: 45000,
    likes: 2800,
    gmv: 3200,
    updatedAt: "2026-01-21 16:00",
    isTestAccountingEnabled: true,
  },
  {
    id: "SV-20260120-003",
    title: "年货节预热视频",
    status: "COMPLETED",
    purposes: ["TEASER", "PROMOTION"],
    platform: "KUAISHOU",
    account: "KS-Official",
    creator: "运营-小张",
    publishedAt: "2026-01-20 10:00",
    owner: "赵六",
    itemCount: 8,
    testItemCount: 0,
    testAccountingStatus: "NONE",
    sampleCount: 6,
    views: 230000,
    likes: 15000,
    gmv: 45600,
    updatedAt: "2026-01-20 18:30",
    isTestAccountingEnabled: false,
  },
  {
    id: "SV-20260119-001",
    title: "新品上架试水",
    status: "DRAFT",
    purposes: ["SOFT_LAUNCH"],
    platform: "TIKTOK",
    account: "IDN-Store-A",
    creator: "KOL-Blue",
    publishedAt: null,
    owner: "张三",
    itemCount: 1,
    testItemCount: 0,
    testAccountingStatus: "NONE",
    sampleCount: 1,
    views: 0,
    likes: 0,
    gmv: 0,
    updatedAt: "2026-01-19 09:00",
    isTestAccountingEnabled: false,
  },
]

export default function ShortVideoRecordPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [purposeFilter, setPurposeFilter] = useState("all")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [accountingFilter, setAccountingFilter] = useState("all")
  const [quickFilter, setQuickFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [closeAccountDialogOpen, setCloseAccountDialogOpen] = useState(false)
  const [testAccountingDialogOpen, setTestAccountingDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any>(null)

  // 新建表单状态
  const [newRecord, setNewRecord] = useState({
    title: "",
    owner: "",
    recorder: "",
    platform: "",
    account: "",
    creator: "",
    publishedAt: "",
    videoUrl: "",
    purposes: [] as string[],
    isTestAccountingEnabled: false,
    sampleRefs: [] as string[],
    note: "",
  })

  // 关账表单状态
  const [closeAccountForm, setCloseAccountForm] = useState({
    completionNote: "",
    unpublishedReason: "",
  })

  // 入账表单状态
  const [testAccountingForm, setTestAccountingForm] = useState({
    accountedNote: "",
    confirmed: false,
  })

  // 筛选数据
  const filteredRecords = mockRecords.filter((record) => {
    if (
      searchKeyword &&
      !record.id.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !record.title.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !record.account.toLowerCase().includes(searchKeyword.toLowerCase())
    ) {
      return false
    }
    if (statusFilter !== "all" && record.status !== statusFilter) return false
    if (purposeFilter !== "all" && !record.purposes.includes(purposeFilter)) return false
    if (platformFilter !== "all" && record.platform !== platformFilter) return false
    if (accountingFilter !== "all" && record.testAccountingStatus !== accountingFilter) return false
    if (quickFilter === "reconciling" && record.status !== "RECONCILING") return false
    if (quickFilter === "canClose" && (record.status !== "RECONCILING" || record.itemCount === 0)) return false
    if (quickFilter === "pendingAccounting" && record.testAccountingStatus !== "PENDING") return false
    if (quickFilter === "accounted" && record.testAccountingStatus !== "ACCOUNTED") return false
    return true
  })

  // KPI统计
  const kpiStats = {
    reconciling: mockRecords.filter((r) => r.status === "RECONCILING").length,
    canClose: mockRecords.filter((r) => r.status === "RECONCILING" && r.itemCount > 0).length,
    pendingAccounting: mockRecords.filter((r) => r.testAccountingStatus === "PENDING").length,
    accounted: mockRecords.filter((r) => r.testAccountingStatus === "ACCOUNTED").length,
  }

  const handlePurposeToggle = (purpose: string) => {
    setNewRecord((prev) => ({
      ...prev,
      purposes: prev.purposes.includes(purpose)
        ? prev.purposes.filter((p) => p !== purpose)
        : [...prev.purposes, purpose],
      isTestAccountingEnabled: purpose === "TEST" ? !prev.purposes.includes(purpose) : prev.isTestAccountingEnabled,
    }))
  }

  const handleSaveDraft = () => {
    toast({ title: "保存成功", description: "记录已保存为草稿" })
    setCreateDrawerOpen(false)
  }

  const handleSaveAndReconcile = () => {
    toast({ title: "创建成功", description: "记录已创建并进入核对状态" })
    setCreateDrawerOpen(false)
  }

  const handleCloseAccount = () => {
    if (!closeAccountForm.completionNote) {
      toast({ title: "校验失败", description: "请填写关账备注", variant: "destructive" })
      return
    }
    toast({ title: "关账成功", description: `记录 ${selectedRecord?.id} 已完成关账` })
    setCloseAccountDialogOpen(false)
    setCloseAccountForm({ completionNote: "", unpublishedReason: "" })
  }

  const handleTestAccounting = () => {
    if (!testAccountingForm.accountedNote) {
      toast({ title: "校验失败", description: "请填写入账备注", variant: "destructive" })
      return
    }
    if (!testAccountingForm.confirmed) {
      toast({ title: "校验失败", description: "请确认入账信息", variant: "destructive" })
      return
    }
    toast({ title: "入账成功", description: `记录 ${selectedRecord?.id} 测款数据已入账` })
    setTestAccountingDialogOpen(false)
    setTestAccountingForm({ accountedNote: "", confirmed: false })
  }

  const handleViewDetail = (record: any) => {
    router.push(`/testing/video/${record.id}`)
  }

  const handleOpenCloseAccount = (record: any) => {
    setSelectedRecord(record)
    setCloseAccountDialogOpen(true)
  }

  const handleOpenTestAccounting = (record: any) => {
    setSelectedRecord(record)
    setTestAccountingDialogOpen(true)
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
              <h1 className="text-2xl font-bold text-foreground">短视频记录</h1>
              <p className="text-muted-foreground text-sm mt-1">管理短视频内容资产与测款数据沉淀</p>
            </div>
            <Button onClick={() => setCreateDrawerOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              新建记录
            </Button>
          </div>

          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="搜索记录编号/标题/账号/达人/项目/款号"
                      className="pl-9"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="DRAFT">草稿</SelectItem>
                    <SelectItem value="RECONCILING">核对中</SelectItem>
                    <SelectItem value="COMPLETED">已关账</SelectItem>
                    <SelectItem value="CANCELLED">已取消</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="用途" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部用途</SelectItem>
                    <SelectItem value="TEST">测款</SelectItem>
                    <SelectItem value="PROMOTION">推广</SelectItem>
                    <SelectItem value="TEASER">活动预热</SelectItem>
                    <SelectItem value="SALES">销售转化</SelectItem>
                    <SelectItem value="SEEDING">内容种草</SelectItem>
                    <SelectItem value="SOFT_LAUNCH">上新试水</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="平台" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部平台</SelectItem>
                    <SelectItem value="TIKTOK">TikTok</SelectItem>
                    <SelectItem value="DOUYIN">抖音</SelectItem>
                    <SelectItem value="KUAISHOU">快手</SelectItem>
                    <SelectItem value="OTHER">其他</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={accountingFilter} onValueChange={setAccountingFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="入账状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部入账状态</SelectItem>
                    <SelectItem value="NONE">无测款</SelectItem>
                    <SelectItem value="PENDING">待入账</SelectItem>
                    <SelectItem value="ACCOUNTED">已入账</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchKeyword("")
                    setStatusFilter("all")
                    setPurposeFilter("all")
                    setPlatformFilter("all")
                    setAccountingFilter("all")
                    setQuickFilter("all")
                  }}
                >
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* KPI Quick Filter Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card
              className={`cursor-pointer transition-all ${quickFilter === "reconciling" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setQuickFilter(quickFilter === "reconciling" ? "all" : "reconciling")}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">待核对</p>
                    <p className="text-2xl font-bold text-blue-600">{kpiStats.reconciling}</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${quickFilter === "canClose" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setQuickFilter(quickFilter === "canClose" ? "all" : "canClose")}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">可关账</p>
                    <p className="text-2xl font-bold text-green-600">{kpiStats.canClose}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-200" />
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${quickFilter === "pendingAccounting" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setQuickFilter(quickFilter === "pendingAccounting" ? "all" : "pendingAccounting")}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">TEST待入账</p>
                    <p className="text-2xl font-bold text-yellow-600">{kpiStats.pendingAccounting}</p>
                  </div>
                  <Calculator className="w-8 h-8 text-yellow-200" />
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${quickFilter === "accounted" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setQuickFilter(quickFilter === "accounted" ? "all" : "accounted")}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">已入账</p>
                    <p className="text-2xl font-bold text-green-600">{kpiStats.accounted}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[180px]">记录</TableHead>
                    <TableHead className="w-[80px]">状态</TableHead>
                    <TableHead className="w-[120px]">用途</TableHead>
                    <TableHead className="w-[120px]">平台/账号</TableHead>
                    <TableHead className="w-[100px]">发布人/达人</TableHead>
                    <TableHead className="w-[140px]">发布时间</TableHead>
                    <TableHead className="w-[60px] text-center">条目数</TableHead>
                    <TableHead className="w-[80px] text-center">TEST条目</TableHead>
                    <TableHead className="w-[80px]">测款入账</TableHead>
                    <TableHead className="w-[100px] text-right">播放/点赞</TableHead>
                    <TableHead className="w-[60px] text-center">样衣</TableHead>
                    <TableHead className="w-[140px]">最近更新</TableHead>
                    <TableHead className="w-[100px] text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <button
                            className="text-primary hover:underline font-medium text-left"
                            onClick={() => handleViewDetail(record)}
                          >
                            {record.id}
                          </button>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{record.title}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={RECORD_STATUS[record.status as keyof typeof RECORD_STATUS]?.color}>
                          {RECORD_STATUS[record.status as keyof typeof RECORD_STATUS]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {record.purposes.map((purpose) => (
                            <Badge
                              key={purpose}
                              variant="outline"
                              className={`text-xs ${RECORD_PURPOSE[purpose as keyof typeof RECORD_PURPOSE]?.color}`}
                            >
                              {RECORD_PURPOSE[purpose as keyof typeof RECORD_PURPOSE]?.label}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge
                            variant="outline"
                            className={`text-xs ${PLATFORMS[record.platform as keyof typeof PLATFORMS]?.color}`}
                          >
                            {PLATFORMS[record.platform as keyof typeof PLATFORMS]?.label}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">{record.account}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{record.creator}</TableCell>
                      <TableCell className="text-sm">{record.publishedAt || "-"}</TableCell>
                      <TableCell className="text-center">{record.itemCount}</TableCell>
                      <TableCell className="text-center">
                        {record.testItemCount > 0 ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            {record.testItemCount}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            TEST_ACCOUNTING_STATUS[record.testAccountingStatus as keyof typeof TEST_ACCOUNTING_STATUS]
                              ?.color
                          }
                        >
                          {
                            TEST_ACCOUNTING_STATUS[record.testAccountingStatus as keyof typeof TEST_ACCOUNTING_STATUS]
                              ?.label
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <div>{(record.views / 1000).toFixed(1)}k</div>
                        <div className="text-xs text-muted-foreground">{(record.likes / 1000).toFixed(1)}k</div>
                      </TableCell>
                      <TableCell className="text-center">{record.sampleCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{record.updatedAt}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetail(record)}>
                              <Eye className="w-4 h-4 mr-2" />
                              查看
                            </DropdownMenuItem>
                            {(record.status === "DRAFT" || record.status === "RECONCILING") && (
                              <DropdownMenuItem
                                onClick={() => toast({ title: "编辑", description: `编辑记录 ${record.id}` })}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                编辑
                              </DropdownMenuItem>
                            )}
                            {(record.status === "DRAFT" || record.status === "RECONCILING") && (
                              <DropdownMenuItem
                                onClick={() => toast({ title: "导入数据", description: `导入数据到 ${record.id}` })}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                导入数据
                              </DropdownMenuItem>
                            )}
                            {record.status === "RECONCILING" && record.itemCount > 0 && (
                              <DropdownMenuItem onClick={() => handleOpenCloseAccount(record)}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                完成关账
                              </DropdownMenuItem>
                            )}
                            {(record.status === "RECONCILING" || record.status === "COMPLETED") &&
                              record.testAccountingStatus === "PENDING" && (
                                <DropdownMenuItem onClick={() => handleOpenTestAccounting(record)}>
                                  <Calculator className="w-4 h-4 mr-2" />
                                  完成测款入账
                                </DropdownMenuItem>
                              )}
                            {(record.status === "DRAFT" || record.status === "RECONCILING") && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => toast({ title: "取消", description: `记录 ${record.id} 已取消` })}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                取消
                              </DropdownMenuItem>
                            )}
                            {record.status === "COMPLETED" && (
                              <DropdownMenuItem
                                onClick={() => toast({ title: "导出", description: `导出记录 ${record.id}` })}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                导出
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">共 {filteredRecords.length} 条记录</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">第 {currentPage} 页</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* SV2: Create/Edit Drawer */}
          <Sheet open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
            <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>新建短视频记录</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                {/* A 基础信息 */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">基础信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>标题 *</Label>
                      <Input
                        placeholder="短视频-{{日期}}-{{账号}}"
                        value={newRecord.title}
                        onChange={(e) => setNewRecord({ ...newRecord, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>负责人 *</Label>
                      <Select value={newRecord.owner} onValueChange={(v) => setNewRecord({ ...newRecord, owner: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择负责人" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="张三">张三</SelectItem>
                          <SelectItem value="李四">李四</SelectItem>
                          <SelectItem value="王五">王五</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>录入人</Label>
                      <Select
                        value={newRecord.recorder}
                        onValueChange={(v) => setNewRecord({ ...newRecord, recorder: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择录入人" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="张三">张三</SelectItem>
                          <SelectItem value="李四">李四</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* B 发布信息 */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">发布信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>平台 *</Label>
                      <Select
                        value={newRecord.platform}
                        onValueChange={(v) => setNewRecord({ ...newRecord, platform: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择平台" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TIKTOK">TikTok</SelectItem>
                          <SelectItem value="DOUYIN">抖音</SelectItem>
                          <SelectItem value="KUAISHOU">快手</SelectItem>
                          <SelectItem value="OTHER">其他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>发布账号 *</Label>
                      <Select
                        value={newRecord.account}
                        onValueChange={(v) => setNewRecord({ ...newRecord, account: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择账号" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IDN-Store-A">IDN-Store-A</SelectItem>
                          <SelectItem value="IDN-Store-B">IDN-Store-B</SelectItem>
                          <SelectItem value="CN-Brand-Official">CN-Brand-Official</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>达人/运营 *</Label>
                      <Input
                        placeholder="输入达人或运营人员"
                        value={newRecord.creator}
                        onChange={(e) => setNewRecord({ ...newRecord, creator: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>发布时间</Label>
                      <Input
                        type="datetime-local"
                        value={newRecord.publishedAt}
                        onChange={(e) => setNewRecord({ ...newRecord, publishedAt: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>视频链接</Label>
                      <Input
                        placeholder="输入视频链接"
                        value={newRecord.videoUrl}
                        onChange={(e) => setNewRecord({ ...newRecord, videoUrl: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* C 用途与测款 */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">用途与测款</h3>
                  <div>
                    <Label>记录用途 * (至少选择1项)</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(RECORD_PURPOSE).map(([key, value]) => (
                        <Badge
                          key={key}
                          variant={newRecord.purposes.includes(key) ? "default" : "outline"}
                          className={`cursor-pointer ${newRecord.purposes.includes(key) ? value.color : ""}`}
                          onClick={() => handlePurposeToggle(key)}
                        >
                          {value.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="testAccountingEnabled"
                      checked={newRecord.isTestAccountingEnabled}
                      onCheckedChange={(checked) => setNewRecord({ ...newRecord, isTestAccountingEnabled: !!checked })}
                    />
                    <Label htmlFor="testAccountingEnabled">启用测款入账（允许产生测款核对入账）</Label>
                  </div>
                </div>

                {/* D 关联 */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">关联样衣与备注</h3>
                  <div>
                    <Label>关联样衣</Label>
                    <p className="text-xs text-muted-foreground mb-2">可选择本视频使用的样衣</p>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      添加样衣
                    </Button>
                  </div>
                  <div>
                    <Label>备注</Label>
                    <Textarea
                      placeholder="输入备注信息"
                      value={newRecord.note}
                      onChange={(e) => setNewRecord({ ...newRecord, note: e.target.value })}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setCreateDrawerOpen(false)}>
                    取消
                  </Button>
                  <Button variant="outline" onClick={handleSaveDraft}>
                    保存草稿
                  </Button>
                  <Button onClick={handleSaveAndReconcile}>保存并进入核对</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* SV4: Close Account Dialog */}
          <Dialog open={closeAccountDialogOpen} onOpenChange={setCloseAccountDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>完成记录（关账）</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">记录编号：</span>
                    {selectedRecord?.id}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">标题：</span>
                    {selectedRecord?.title}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">条目数：</span>
                    {selectedRecord?.itemCount}
                  </p>
                </div>

                {!selectedRecord?.publishedAt && (
                  <div className="space-y-2">
                    <Label>未发布原因 *</Label>
                    <Textarea
                      placeholder="请说明未发布原因"
                      value={closeAccountForm.unpublishedReason}
                      onChange={(e) => setCloseAccountForm({ ...closeAccountForm, unpublishedReason: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>关账备注 *</Label>
                  <Textarea
                    placeholder="请输入关账备注"
                    value={closeAccountForm.completionNote}
                    onChange={(e) => setCloseAccountForm({ ...closeAccountForm, completionNote: e.target.value })}
                  />
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <p className="text-sm text-yellow-800">关账后记录将只读，仅可补充证据</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCloseAccountDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCloseAccount}>确认关账</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* SV5: Test Accounting Dialog */}
          <Dialog open={testAccountingDialogOpen} onOpenChange={setTestAccountingDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>完成测款核对（入账）</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">记录编号：</span>
                    {selectedRecord?.id}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">TEST条目数：</span>
                    {selectedRecord?.testItemCount}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="font-medium">入账预览</Label>
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-sm">将为以下对象生成/更新"测款结论判定"实例：</p>
                    <div className="bg-blue-50 p-2 rounded text-sm">
                      <p>• 商品维度：SPU-XXXX（1条TEST条目）</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>入账备注 *</Label>
                  <Textarea
                    placeholder="请输入入账备注"
                    value={testAccountingForm.accountedNote}
                    onChange={(e) => setTestAccountingForm({ ...testAccountingForm, accountedNote: e.target.value })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confirmAccounting"
                    checked={testAccountingForm.confirmed}
                    onCheckedChange={(checked) =>
                      setTestAccountingForm({ ...testAccountingForm, confirmed: !!checked })
                    }
                  />
                  <Label htmlFor="confirmAccounting">我已确认TEST条目绑定正确，数据完整</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTestAccountingDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleTestAccounting}>确认入账</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
