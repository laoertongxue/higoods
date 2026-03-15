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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
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

// 场次状态枚举
const SESSION_STATUS = {
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

// 场次用途枚举
const SESSION_PURPOSE = {
  TEST: { label: "测款", color: "bg-purple-100 text-purple-700" },
  SELL: { label: "带货", color: "bg-blue-100 text-blue-700" },
  RESTOCK: { label: "复播", color: "bg-cyan-100 text-cyan-700" },
  CLEARANCE: { label: "清仓", color: "bg-orange-100 text-orange-700" },
  SOFT_LAUNCH: { label: "上新", color: "bg-pink-100 text-pink-700" },
  CONTENT: { label: "内容", color: "bg-indigo-100 text-indigo-700" },
}

// Mock数据
const mockSessions = [
  {
    id: "LS-20260122-001",
    title: "TikTok IDN 新款测试专场",
    status: "RECONCILING",
    purposes: ["TEST", "SELL"],
    liveAccount: "TikTok IDN Store-A",
    anchor: "家播-小N",
    startAt: "2026-01-22 19:00",
    endAt: "2026-01-22 22:30",
    owner: "张三",
    itemCount: 12,
    testItemCount: 3,
    testAccountingStatus: "PENDING",
    sampleCount: 5,
    gmvTotal: 45680,
    orderTotal: 156,
    updatedAt: "2026-01-22 23:15",
    isTestAccountingEnabled: true,
  },
  {
    id: "LS-20260121-002",
    title: "周末清仓专场",
    status: "COMPLETED",
    purposes: ["CLEARANCE", "SELL"],
    liveAccount: "Shopee MY Store-B",
    anchor: "达人-Lily",
    startAt: "2026-01-21 14:00",
    endAt: "2026-01-21 18:00",
    owner: "李四",
    itemCount: 25,
    testItemCount: 0,
    testAccountingStatus: "NONE",
    sampleCount: 8,
    gmvTotal: 89200,
    orderTotal: 312,
    updatedAt: "2026-01-21 19:30",
    isTestAccountingEnabled: false,
  },
  {
    id: "LS-20260120-003",
    title: "春季新款首播",
    status: "COMPLETED",
    purposes: ["SOFT_LAUNCH", "TEST"],
    liveAccount: "TikTok IDN Store-A",
    anchor: "家播-小美",
    startAt: "2026-01-20 20:00",
    endAt: "2026-01-20 23:00",
    owner: "王五",
    itemCount: 18,
    testItemCount: 5,
    testAccountingStatus: "ACCOUNTED",
    sampleCount: 6,
    gmvTotal: 67500,
    orderTotal: 234,
    updatedAt: "2026-01-21 10:00",
    isTestAccountingEnabled: true,
  },
  {
    id: "LS-20260119-004",
    title: "日常带货场",
    status: "DRAFT",
    purposes: ["SELL"],
    liveAccount: "TikTok VN Store-C",
    anchor: "家播-阿强",
    startAt: "2026-01-23 19:00",
    endAt: null,
    owner: "赵六",
    itemCount: 8,
    testItemCount: 0,
    testAccountingStatus: "NONE",
    sampleCount: 3,
    gmvTotal: null,
    orderTotal: null,
    updatedAt: "2026-01-19 15:00",
    isTestAccountingEnabled: false,
  },
  {
    id: "LS-20260118-005",
    title: "复播追单专场",
    status: "RECONCILING",
    purposes: ["RESTOCK", "SELL"],
    liveAccount: "Shopee ID Store-D",
    anchor: "达人-Mike",
    startAt: "2026-01-18 15:00",
    endAt: "2026-01-18 19:00",
    owner: "钱七",
    itemCount: 15,
    testItemCount: 2,
    testAccountingStatus: "PENDING",
    sampleCount: 4,
    gmvTotal: 52300,
    orderTotal: 178,
    updatedAt: "2026-01-18 20:30",
    isTestAccountingEnabled: true,
  },
  {
    id: "LS-20260117-006",
    title: "内容种草场",
    status: "COMPLETED",
    purposes: ["CONTENT"],
    liveAccount: "TikTok IDN Store-A",
    anchor: "达人-Sarah",
    startAt: "2026-01-17 14:00",
    endAt: "2026-01-17 16:00",
    owner: "孙八",
    itemCount: 6,
    testItemCount: 0,
    testAccountingStatus: "NONE",
    sampleCount: 6,
    gmvTotal: 12500,
    orderTotal: 45,
    updatedAt: "2026-01-17 17:00",
    isTestAccountingEnabled: false,
  },
]

export default function LiveSessionListPage() {
  const { toast } = useToast()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [purposeFilter, setPurposeFilter] = useState("all")
  const [accountingFilter, setAccountingFilter] = useState("all")
  const [quickFilter, setQuickFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [closeAccountDialogOpen, setCloseAccountDialogOpen] = useState(false)
  const [testAccountingDialogOpen, setTestAccountingDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<any>(null)

  // 新建场次表单状态
  const [newSession, setNewSession] = useState({
    title: "",
    owner: "",
    site: "",
    liveAccount: "",
    anchor: "",
    startAt: "",
    endAt: "",
    operator: "",
    recorder: "",
    reviewer: "",
    purposes: [] as string[],
    isTestAccountingEnabled: false,
    note: "",
  })

  // KPI统计
  const kpiStats = {
    reconciling: mockSessions.filter((s) => s.status === "RECONCILING").length,
    readyToClose: mockSessions.filter((s) => s.status === "RECONCILING" && s.endAt).length,
    pendingAccounting: mockSessions.filter((s) => s.testAccountingStatus === "PENDING").length,
    accounted: mockSessions.filter((s) => s.testAccountingStatus === "ACCOUNTED").length,
    abnormal: mockSessions.filter((s) => !s.endAt && s.status !== "DRAFT").length,
  }

  // 筛选逻辑
  const filteredSessions = mockSessions.filter((session) => {
    if (searchKeyword && !session.title.includes(searchKeyword) && !session.id.includes(searchKeyword)) return false
    if (statusFilter !== "all" && session.status !== statusFilter) return false
    if (purposeFilter !== "all" && !session.purposes.includes(purposeFilter)) return false
    if (accountingFilter !== "all" && session.testAccountingStatus !== accountingFilter) return false
    if (quickFilter === "reconciling" && session.status !== "RECONCILING") return false
    if (quickFilter === "readyToClose" && !(session.status === "RECONCILING" && session.endAt)) return false
    if (quickFilter === "pendingAccounting" && session.testAccountingStatus !== "PENDING") return false
    if (quickFilter === "accounted" && session.testAccountingStatus !== "ACCOUNTED") return false
    if (quickFilter === "abnormal" && !(!session.endAt && session.status !== "DRAFT")) return false
    return true
  })

  const handleAction = (action: string, session: any) => {
    setSelectedSession(session)
    if (action === "closeAccount") {
      setCloseAccountDialogOpen(true)
    } else if (action === "testAccounting") {
      setTestAccountingDialogOpen(true)
    } else {
      toast({ title: `执行操作: ${action}`, description: `场次: ${session.id}` })
    }
  }

  const handlePurposeToggle = (purpose: string) => {
    setNewSession((prev) => ({
      ...prev,
      purposes: prev.purposes.includes(purpose)
        ? prev.purposes.filter((p) => p !== purpose)
        : [...prev.purposes, purpose],
      isTestAccountingEnabled: prev.purposes.includes("TEST")
        ? prev.purposes.filter((p) => p !== purpose).includes("TEST")
        : [...prev.purposes, purpose].includes("TEST"),
    }))
  }

  const handleCreateSession = (saveType: "draft" | "reconciling") => {
    toast({
      title: saveType === "draft" ? "保存草稿成功" : "创建并进入核对",
      description: `场次: ${newSession.title || "新直播场次"}`,
    })
    setCreateDrawerOpen(false)
  }

  // 根据状态返回可用操作
  const getRowActions = (session: any) => {
    const actions = []
    actions.push({ key: "view", label: "查看", icon: Eye })

    if (session.status === "DRAFT" || session.status === "RECONCILING") {
      actions.push({ key: "edit", label: "编辑", icon: Edit })
      actions.push({ key: "import", label: "导入数据", icon: Upload })
    }
    if (session.status === "RECONCILING") {
      actions.push({ key: "closeAccount", label: "完成关账", icon: CheckCircle })
    }
    if (
      (session.status === "RECONCILING" || session.status === "COMPLETED") &&
      session.testAccountingStatus === "PENDING"
    ) {
      actions.push({ key: "testAccounting", label: "完成测款入账", icon: Calculator })
    }
    if (session.status === "DRAFT" || session.status === "RECONCILING") {
      actions.push({ key: "cancel", label: "取消场次", icon: XCircle })
    }
    if (session.status === "COMPLETED") {
      actions.push({ key: "export", label: "导出报告", icon: Download })
    }
    return actions
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
              <h1 className="text-2xl font-bold text-foreground">直播场次</h1>
              <p className="text-sm text-muted-foreground mt-1">
                统一管理所有直播场次，支持带货、测款、复播、清仓等多种用途，关账与测款入账分离
              </p>
            </div>
            <Sheet open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
              <SheetTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  新建场次
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[600px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>新建场次</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  {/* A. 基础信息 */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm border-b pb-2">A. 基础信息</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>场次标题 *</Label>
                        <Input
                          value={newSession.title}
                          onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                          placeholder="直播-2026-01-22-TikTok IDN"
                        />
                      </div>
                      <div>
                        <Label>负责人 *</Label>
                        <Select
                          value={newSession.owner}
                          onValueChange={(v) => setNewSession({ ...newSession, owner: v })}
                        >
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
                        <Label>站点</Label>
                        <Select
                          value={newSession.site}
                          onValueChange={(v) => setNewSession({ ...newSession, site: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择站点" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="深圳">深圳</SelectItem>
                            <SelectItem value="雅加达">雅加达</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* B. 直播信息 */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm border-b pb-2">B. 直播信息</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>直播账号 *</Label>
                        <Select
                          value={newSession.liveAccount}
                          onValueChange={(v) => setNewSession({ ...newSession, liveAccount: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择账号" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TikTok IDN Store-A">TikTok IDN Store-A</SelectItem>
                            <SelectItem value="Shopee MY Store-B">Shopee MY Store-B</SelectItem>
                            <SelectItem value="TikTok VN Store-C">TikTok VN Store-C</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>主播 *</Label>
                        <Select
                          value={newSession.anchor}
                          onValueChange={(v) => setNewSession({ ...newSession, anchor: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择主播" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="家播-小N">家播-小N</SelectItem>
                            <SelectItem value="家播-小美">家播-小美</SelectItem>
                            <SelectItem value="达人-Lily">达人-Lily</SelectItem>
                            <SelectItem value="达人-Mike">达人-Mike</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>开播时间 *</Label>
                        <Input
                          type="datetime-local"
                          value={newSession.startAt}
                          onChange={(e) => setNewSession({ ...newSession, startAt: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>下播时间</Label>
                        <Input
                          type="datetime-local"
                          value={newSession.endAt}
                          onChange={(e) => setNewSession({ ...newSession, endAt: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* C. 团队分工 */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm border-b pb-2">C. 团队分工</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>场控/运营</Label>
                        <Input
                          value={newSession.operator}
                          onChange={(e) => setNewSession({ ...newSession, operator: e.target.value })}
                          placeholder="可选"
                        />
                      </div>
                      <div>
                        <Label>录入人</Label>
                        <Input
                          value={newSession.recorder}
                          onChange={(e) => setNewSession({ ...newSession, recorder: e.target.value })}
                          placeholder="可选"
                        />
                      </div>
                      <div>
                        <Label>审核人</Label>
                        <Input
                          value={newSession.reviewer}
                          onChange={(e) => setNewSession({ ...newSession, reviewer: e.target.value })}
                          placeholder="建议填写"
                        />
                      </div>
                    </div>
                  </div>

                  {/* D. 用途与测款开关 */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm border-b pb-2">D. 用途与测款开关</h3>
                    <div>
                      <Label>场次用途 * (可多选)</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(SESSION_PURPOSE).map(([key, value]) => (
                          <Badge
                            key={key}
                            variant={newSession.purposes.includes(key) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => handlePurposeToggle(key)}
                          >
                            {value.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="testAccounting"
                        checked={newSession.isTestAccountingEnabled}
                        onCheckedChange={(checked) =>
                          setNewSession({ ...newSession, isTestAccountingEnabled: checked as boolean })
                        }
                      />
                      <Label htmlFor="testAccounting" className="text-sm">
                        启用测款入账（勾选后需要对TEST行完成核对入账）
                      </Label>
                    </div>
                  </div>

                  {/* E. 备注 */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm border-b pb-2">E. 备注</h3>
                    <Textarea
                      value={newSession.note}
                      onChange={(e) => setNewSession({ ...newSession, note: e.target.value })}
                      placeholder="场次备注..."
                      rows={3}
                    />
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1 bg-transparent"
                      onClick={() => handleCreateSession("draft")}
                    >
                      保存草稿
                    </Button>
                    <Button className="flex-1" onClick={() => handleCreateSession("reconciling")}>
                      保存并进入核对
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* 筛选栏 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索场次编号/标题/账号/主播..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="场次状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    {Object.entries(SESSION_STATUS).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="场次用途" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部用途</SelectItem>
                    {Object.entries(SESSION_PURPOSE).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={accountingFilter} onValueChange={setAccountingFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="入账状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部入账</SelectItem>
                    {Object.entries(TEST_ACCOUNTING_STATUS).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchKeyword("")
                    setStatusFilter("all")
                    setPurposeFilter("all")
                    setAccountingFilter("all")
                    setQuickFilter("all")
                  }}
                >
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* KPI快捷筛选 */}
          <div className="grid grid-cols-5 gap-4">
            <Card
              className={`cursor-pointer transition-all ${quickFilter === "reconciling" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setQuickFilter(quickFilter === "reconciling" ? "all" : "reconciling")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.reconciling}</p>
                  <p className="text-xs text-muted-foreground">待核对</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${quickFilter === "readyToClose" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setQuickFilter(quickFilter === "readyToClose" ? "all" : "readyToClose")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.readyToClose}</p>
                  <p className="text-xs text-muted-foreground">可关账</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${quickFilter === "pendingAccounting" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setQuickFilter(quickFilter === "pendingAccounting" ? "all" : "pendingAccounting")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.pendingAccounting}</p>
                  <p className="text-xs text-muted-foreground">TEST待入账</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${quickFilter === "accounted" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setQuickFilter(quickFilter === "accounted" ? "all" : "accounted")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.accounted}</p>
                  <p className="text-xs text-muted-foreground">已入账</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${quickFilter === "abnormal" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setQuickFilter(quickFilter === "abnormal" ? "all" : "abnormal")}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpiStats.abnormal}</p>
                  <p className="text-xs text-muted-foreground">异常</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 数据表格 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[180px]">场次</TableHead>
                    <TableHead className="w-[80px]">状态</TableHead>
                    <TableHead className="w-[120px]">用途</TableHead>
                    <TableHead>账号/主播</TableHead>
                    <TableHead>开播-下播</TableHead>
                    <TableHead>负责人</TableHead>
                    <TableHead className="text-center">明细数</TableHead>
                    <TableHead className="text-center">TEST行</TableHead>
                    <TableHead className="w-[80px]">测款入账</TableHead>
                    <TableHead className="text-center">样衣</TableHead>
                    <TableHead className="text-right">GMV</TableHead>
                    <TableHead className="text-right">订单</TableHead>
                    <TableHead>最近更新</TableHead>
                    <TableHead className="w-[80px] text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session) => (
                    <TableRow key={session.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div
                          className="cursor-pointer hover:text-primary"
                          onClick={() => (window.location.href = `/testing/live/${session.id}`)}
                        >
                          <p className="font-medium text-primary">{session.id}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{session.title}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={SESSION_STATUS[session.status as keyof typeof SESSION_STATUS]?.color}>
                          {SESSION_STATUS[session.status as keyof typeof SESSION_STATUS]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {session.purposes.slice(0, 2).map((p) => (
                            <Badge key={p} variant="outline" className="text-xs">
                              {SESSION_PURPOSE[p as keyof typeof SESSION_PURPOSE]?.label}
                            </Badge>
                          ))}
                          {session.purposes.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{session.purposes.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{session.liveAccount}</p>
                        <p className="text-xs text-muted-foreground">{session.anchor}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{session.startAt?.slice(5, 16)}</p>
                        <p
                          className={`text-xs ${session.endAt ? "text-muted-foreground" : "text-red-500 font-medium"}`}
                        >
                          {session.endAt ? session.endAt.slice(5, 16) : "未填写"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{session.owner}</TableCell>
                      <TableCell className="text-center">{session.itemCount}</TableCell>
                      <TableCell className="text-center">
                        {session.testItemCount > 0 ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            {session.testItemCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            TEST_ACCOUNTING_STATUS[session.testAccountingStatus as keyof typeof TEST_ACCOUNTING_STATUS]
                              ?.color
                          }
                        >
                          {
                            TEST_ACCOUNTING_STATUS[session.testAccountingStatus as keyof typeof TEST_ACCOUNTING_STATUS]
                              ?.label
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{session.sampleCount}</TableCell>
                      <TableCell className="text-right font-medium">
                        {session.gmvTotal ? `¥${session.gmvTotal.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">{session.orderTotal ?? "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{session.updatedAt?.slice(5, 16)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {getRowActions(session).map((action) => (
                              <DropdownMenuItem key={action.key} onClick={() => handleAction(action.key, session)}>
                                <action.icon className="w-4 h-4 mr-2" />
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 分页 */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">共 {filteredSessions.length} 条</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm px-3">{currentPage}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* 完成关账弹窗 (LS4) */}
      <Dialog open={closeAccountDialogOpen} onOpenChange={setCloseAccountDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>完成场次（关账）</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">场次: {selectedSession?.id}</p>
              <p className="text-xs text-muted-foreground">{selectedSession?.title}</p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Step1 完成前检查</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {selectedSession?.endAt ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>下播时间已填写</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {selectedSession?.itemCount > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>明细行数 ≥ 1</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Step2 关账信息</h4>
              <div>
                <Label>完成类型 *</Label>
                <Select defaultValue="normal">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">正常完成</SelectItem>
                    <SelectItem value="abnormal">异常完成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>关账备注 *</Label>
                <Textarea placeholder="填写关账说明..." rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseAccountDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast({ title: "关账成功", description: `场次 ${selectedSession?.id} 已完成关账` })
                setCloseAccountDialogOpen(false)
              }}
            >
              确认关账
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 完成测款核对入账弹窗 (LS5) */}
      <Dialog open={testAccountingDialogOpen} onOpenChange={setTestAccountingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>完成测款核对（入账）</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">场次: {selectedSession?.id}</p>
              <p className="text-xs text-muted-foreground">TEST行数: {selectedSession?.testItemCount}</p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Step1 TEST行校验</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {selectedSession?.testItemCount > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>至少存在1条TEST行</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>每条TEST行已绑定项目/商品</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>每条TEST行有最小指标数据</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Step2 入账预览</h4>
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <p>将生成/更新的"测款结论判定"实例:</p>
                <ul className="list-disc list-inside mt-2 text-muted-foreground">
                  <li>项目维度: PRJ-20260115-001 (追加2条证据)</li>
                  <li>商品维度: SPU-A001 (新建实例)</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Step3 入账确认</h4>
              <div>
                <Label>入账备注 *</Label>
                <Textarea placeholder="填写入账说明..." rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestAccountingDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast({ title: "入账成功", description: `场次 ${selectedSession?.id} 测款核对已完成` })
                setTestAccountingDialogOpen(false)
              }}
            >
              确认入账
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
