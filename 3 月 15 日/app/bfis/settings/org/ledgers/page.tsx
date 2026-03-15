"use client"

import { useState } from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Search,
  Download,
  Plus,
  Eye,
  Edit,
  BookOpen,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Building2,
  Globe,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// LD1｜账本列表页 + LD2｜账本详情页 + LD3｜新建/编辑账本抽屉

type LedgerType = "MANAGEMENT" | "STATUTORY"
type LedgerStatus = "ACTIVE" | "INACTIVE"
type OwnerScope = "GROUP" | "LEGAL_ENTITY"
type PeriodStatus = "OPEN" | "CLOSING" | "CLOSED"

const ledgerTypeConfig: Record<LedgerType, { label: string; color: string }> = {
  MANAGEMENT: { label: "管理账本", color: "bg-blue-100 text-blue-700" },
  STATUTORY: { label: "法定账本", color: "bg-green-100 text-green-700" },
}

const statusConfig: Record<LedgerStatus, { label: string; color: string }> = {
  ACTIVE: { label: "启用", color: "bg-green-100 text-green-700" },
  INACTIVE: { label: "停用", color: "bg-gray-100 text-gray-700" },
}

const periodStatusConfig: Record<PeriodStatus, { label: string; color: string }> = {
  OPEN: { label: "开放", color: "bg-green-100 text-green-700" },
  CLOSING: { label: "关闭中", color: "bg-yellow-100 text-yellow-700" },
  CLOSED: { label: "已关闭", color: "bg-gray-100 text-gray-700" },
}

// Mock 账本数据
const mockLedgers = [
  {
    id: "l_01H001",
    code: "GL_MGMT_USD",
    name: "HiGood 管理账本（USD）",
    type: "MANAGEMENT" as LedgerType,
    ownerScope: "GROUP" as OwnerScope,
    ownerId: "g_01H001",
    ownerName: "HiGood Group",
    functionalCurrency: "USD",
    reportingCurrency: "USD",
    accountingCalendarId: "MONTHLY_GREGORIAN",
    openPeriodId: "p_2026_01",
    openPeriodCode: "2026-01",
    status: "ACTIVE" as LedgerStatus,
    externalIds: { kingdee_book_id: "KD_BOOK_2001" },
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-15 14:30",
    updatedBy: "finance_admin",
  },
  {
    id: "l_01H002",
    code: "SL_HK_HIGOOD_USD",
    name: "香港采购主体法定账本",
    type: "STATUTORY" as LedgerType,
    ownerScope: "LEGAL_ENTITY" as OwnerScope,
    ownerId: "le_01H001",
    ownerName: "HK_HIGOOD_PROC",
    functionalCurrency: "USD",
    reportingCurrency: null,
    accountingCalendarId: "MONTHLY_GREGORIAN",
    openPeriodId: "p_2026_01",
    openPeriodCode: "2026-01",
    status: "ACTIVE" as LedgerStatus,
    externalIds: { kingdee_book_id: "KD_BOOK_2002" },
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-10 09:00",
    updatedBy: "admin",
  },
  {
    id: "l_01H003",
    code: "SL_KY_HOLD_USD",
    name: "开曼控股法定账本",
    type: "STATUTORY" as LedgerType,
    ownerScope: "LEGAL_ENTITY" as OwnerScope,
    ownerId: "le_01H002",
    ownerName: "KY_HIGOOD_HOLD",
    functionalCurrency: "USD",
    reportingCurrency: null,
    accountingCalendarId: "MONTHLY_GREGORIAN",
    openPeriodId: "p_2026_01",
    openPeriodCode: "2026-01",
    status: "ACTIVE" as LedgerStatus,
    externalIds: {},
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-05 15:00",
    updatedBy: "admin",
  },
  {
    id: "l_01H004",
    code: "SL_ID_BDG_IDR",
    name: "印尼BDG生产主体法定账本",
    type: "STATUTORY" as LedgerType,
    ownerScope: "LEGAL_ENTITY" as OwnerScope,
    ownerId: "le_01H003",
    ownerName: "ID_BDG_FADFAD",
    functionalCurrency: "IDR",
    reportingCurrency: null,
    accountingCalendarId: "MONTHLY_GREGORIAN",
    openPeriodId: "p_2026_01",
    openPeriodCode: "2026-01",
    status: "ACTIVE" as LedgerStatus,
    externalIds: { kingdee_book_id: "KD_BOOK_2003" },
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-12 16:00",
    updatedBy: "finance_admin",
  },
  {
    id: "l_01H005",
    code: "SL_ID_JKT_IDR",
    name: "印尼JKT直播主体法定账本",
    type: "STATUTORY" as LedgerType,
    ownerScope: "LEGAL_ENTITY" as OwnerScope,
    ownerId: "le_01H004",
    ownerName: "ID_JKT_HIGOOD_LIVE",
    functionalCurrency: "IDR",
    reportingCurrency: null,
    accountingCalendarId: "MONTHLY_GREGORIAN",
    openPeriodId: "p_2026_01",
    openPeriodCode: "2026-01",
    status: "ACTIVE" as LedgerStatus,
    externalIds: { kingdee_book_id: "KD_BOOK_2004" },
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-11 11:00",
    updatedBy: "admin",
  },
  {
    id: "l_01H006",
    code: "SL_CN_BJ_CNY",
    name: "北京范得法定账本",
    type: "STATUTORY" as LedgerType,
    ownerScope: "LEGAL_ENTITY" as OwnerScope,
    ownerId: "le_01H005",
    ownerName: "CN_BJ_FANDE",
    functionalCurrency: "CNY",
    reportingCurrency: null,
    accountingCalendarId: "MONTHLY_GREGORIAN",
    openPeriodId: "p_2026_01",
    openPeriodCode: "2026-01",
    status: "ACTIVE" as LedgerStatus,
    externalIds: { kingdee_book_id: "KD_BOOK_2005" },
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-08 10:00",
    updatedBy: "admin",
  },
  {
    id: "l_01H007",
    code: "SL_CN_SZ_CNY",
    name: "深圳嗨好法定账本",
    type: "STATUTORY" as LedgerType,
    ownerScope: "LEGAL_ENTITY" as OwnerScope,
    ownerId: "le_01H006",
    ownerName: "CN_SZ_HIGOOD_OPS",
    functionalCurrency: "CNY",
    reportingCurrency: null,
    accountingCalendarId: "MONTHLY_GREGORIAN",
    openPeriodId: "p_2026_01",
    openPeriodCode: "2026-01",
    status: "ACTIVE" as LedgerStatus,
    externalIds: { kingdee_book_id: "KD_BOOK_2006" },
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-05 15:00",
    updatedBy: "admin",
  },
]

// Mock 期间数据
const mockPeriods = [
  { code: "2026-01", status: "OPEN" as PeriodStatus, startDate: "2026-01-01", endDate: "2026-01-31" },
  { code: "2025-12", status: "CLOSED" as PeriodStatus, startDate: "2025-12-01", endDate: "2025-12-31" },
  { code: "2025-11", status: "CLOSED" as PeriodStatus, startDate: "2025-11-01", endDate: "2025-11-30" },
]

function LedgersContent() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedLedger, setSelectedLedger] = useState<(typeof mockLedgers)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState("info")
  const searchParams = useSearchParams()

  // KPI 统计
  const stats = {
    total: mockLedgers.length,
    management: mockLedgers.filter((l) => l.type === "MANAGEMENT").length,
    statutory: mockLedgers.filter((l) => l.type === "STATUTORY").length,
    active: mockLedgers.filter((l) => l.status === "ACTIVE").length,
  }

  // 筛选
  const filteredLedgers = mockLedgers.filter((l) => {
    if (filterType !== "all" && l.type !== filterType) return false
    if (filterStatus !== "all" && l.status !== filterStatus) return false
    if (searchKeyword && 
        !l.code.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !l.name.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (ledger: typeof mockLedgers[0]) => {
    setSelectedLedger(ledger)
    setDetailOpen(true)
    setEditMode(false)
    setActiveTab("info")
  }

  const openCreate = () => {
    setSelectedLedger(null)
    setCreateOpen(true)
    setEditMode(false)
  }

  const openEdit = (ledger: typeof mockLedgers[0]) => {
    setSelectedLedger(ledger)
    setCreateOpen(true)
    setEditMode(true)
  }

  const handleSave = () => {
    toast.success(editMode ? "账本已更新" : "账本已创建")
    setCreateOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">账本管理</h1>
          <p className="text-muted-foreground">管理集团管理账本与各法人法定账本，账本编码唯一且创建后不可变更</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新建账本
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">账本总数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-700">{stats.management}</div>
                <div className="text-sm text-blue-600">管理账本</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Building2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">{stats.statutory}</div>
                <div className="text-sm text-green-600">法定账本</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.active}</div>
                <div className="text-sm text-muted-foreground">已启用</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索账本编码/名称..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="账本类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="MANAGEMENT">管理账本</SelectItem>
                <SelectItem value="STATUTORY">法定账本</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="ACTIVE">启用</SelectItem>
                <SelectItem value="INACTIVE">停用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>账本编码</TableHead>
                <TableHead>账本名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>所属</TableHead>
                <TableHead>本位币</TableHead>
                <TableHead>报告币</TableHead>
                <TableHead>当前期间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLedgers.map((ledger) => (
                <TableRow key={ledger.id}>
                  <TableCell className="font-mono text-sm">{ledger.code}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{ledger.name}</TableCell>
                  <TableCell>
                    <Badge className={ledgerTypeConfig[ledger.type].color}>
                      {ledgerTypeConfig[ledger.type].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {ledger.ownerScope === "GROUP" ? (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" /> 集团
                        </span>
                      ) : (
                        <span className="font-mono text-muted-foreground">{ledger.ownerName}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ledger.functionalCurrency}</Badge>
                  </TableCell>
                  <TableCell>
                    {ledger.reportingCurrency ? (
                      <Badge variant="outline">{ledger.reportingCurrency}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-700">{ledger.openPeriodCode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[ledger.status].color}>
                      {statusConfig[ledger.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(ledger)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(ledger)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* LD2 账本详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[650px] sm:max-w-[650px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedLedger?.name}
              {selectedLedger && (
                <>
                  <Badge className={ledgerTypeConfig[selectedLedger.type].color}>
                    {ledgerTypeConfig[selectedLedger.type].label}
                  </Badge>
                  <Badge className={statusConfig[selectedLedger.status].color}>
                    {statusConfig[selectedLedger.status].label}
                  </Badge>
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              账本编码: {selectedLedger?.code}
            </SheetDescription>
          </SheetHeader>

          {selectedLedger && (
            <div className="mt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="info">基本信息</TabsTrigger>
                  <TabsTrigger value="periods">会计期间</TabsTrigger>
                  <TabsTrigger value="audit">审计日志</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">账本编码</div>
                      <div className="font-mono font-medium mt-1">{selectedLedger.code}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">账本名称</div>
                      <div className="font-medium mt-1">{selectedLedger.name}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">账本类型</div>
                      <div className="mt-1">
                        <Badge className={ledgerTypeConfig[selectedLedger.type].color}>
                          {ledgerTypeConfig[selectedLedger.type].label}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">所属范围</div>
                      <div className="font-medium mt-1">
                        {selectedLedger.ownerScope === "GROUP" ? "集团" : "法人主体"}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">所属主体</div>
                      <div className="font-mono font-medium mt-1">{selectedLedger.ownerName}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">本位币</div>
                      <div className="font-medium mt-1">{selectedLedger.functionalCurrency}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">报告币</div>
                      <div className="font-medium mt-1">{selectedLedger.reportingCurrency || "-"}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">会计日历</div>
                      <div className="font-medium mt-1">{selectedLedger.accountingCalendarId}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">当前开放期间</div>
                      <div className="mt-1">
                        <Badge className="bg-green-100 text-green-700">{selectedLedger.openPeriodCode}</Badge>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">金蝶账本ID</div>
                      <div className="font-mono font-medium mt-1">
                        {selectedLedger.externalIds.kingdee_book_id || "-"}
                      </div>
                    </div>
                  </div>

                  {selectedLedger.type === "MANAGEMENT" && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">管理账本说明</h4>
                      <p className="text-sm text-blue-700">
                        管理账本归属集团，报告币必须为 USD，用于跨主体汇总与集团层抵消调整。
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-4">
                    <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(selectedLedger); }}>
                      <Edit className="h-4 w-4 mr-2" />
                      编辑
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="periods" className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>期间编码</TableHead>
                        <TableHead>开始日期</TableHead>
                        <TableHead>结束日期</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockPeriods.map((period) => (
                        <TableRow key={period.code}>
                          <TableCell className="font-mono">{period.code}</TableCell>
                          <TableCell>{period.startDate}</TableCell>
                          <TableCell>{period.endDate}</TableCell>
                          <TableCell>
                            <Badge className={periodStatusConfig[period.status].color}>
                              {periodStatusConfig[period.status].label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="audit" className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">创建时间</div>
                      <div className="font-medium mt-1">{selectedLedger.createdAt}</div>
                      <div className="text-sm text-muted-foreground mt-1">创建人: {selectedLedger.createdBy}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">最后更新</div>
                      <div className="font-medium mt-1">{selectedLedger.updatedAt}</div>
                      <div className="text-sm text-muted-foreground mt-1">更新人: {selectedLedger.updatedBy}</div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* LD3 新建/编辑账本抽屉 */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editMode ? "编辑账本" : "新建账本"}</SheetTitle>
            <SheetDescription>
              {editMode ? "修改账本信息，账本编码/类型/归属不可变更" : "创建新账本，编码唯一且创建后不可变更"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>账本编码 *</Label>
              <Input 
                placeholder="如 SL_HK_HIGOOD_USD" 
                defaultValue={selectedLedger?.code}
                disabled={editMode}
              />
              <p className="text-xs text-muted-foreground">仅大写字母/数字/下划线，3-32位，创建后不可修改</p>
            </div>

            <div className="space-y-2">
              <Label>账本名称 *</Label>
              <Input 
                placeholder="账本描述名称" 
                defaultValue={selectedLedger?.name}
              />
            </div>

            <div className="space-y-2">
              <Label>账本类型 *</Label>
              <Select defaultValue={selectedLedger?.type || "STATUTORY"} disabled={editMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGEMENT">管理账本（归属集团）</SelectItem>
                  <SelectItem value="STATUTORY">法定账本（归属法人）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">创建后不可修改</p>
            </div>

            <div className="space-y-2">
              <Label>所属主体 *</Label>
              <Select defaultValue={selectedLedger?.ownerId || "g_01H001"} disabled={editMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="g_01H001">HiGood Group（集团）</SelectItem>
                  <SelectItem value="le_01H001">HK_HIGOOD_PROC（香港）</SelectItem>
                  <SelectItem value="le_01H002">KY_HIGOOD_HOLD（开曼）</SelectItem>
                  <SelectItem value="le_01H003">ID_BDG_FADFAD（印尼BDG）</SelectItem>
                  <SelectItem value="le_01H004">ID_JKT_HIGOOD_LIVE（印尼JKT）</SelectItem>
                  <SelectItem value="le_01H005">CN_BJ_FANDE（北京）</SelectItem>
                  <SelectItem value="le_01H006">CN_SZ_HIGOOD_OPS（深圳）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">创建后不可修改</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>本位币 *</Label>
                <Select defaultValue={selectedLedger?.functionalCurrency || "USD"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - 美元</SelectItem>
                    <SelectItem value="CNY">CNY - 人民币</SelectItem>
                    <SelectItem value="IDR">IDR - 印尼盾</SelectItem>
                    <SelectItem value="HKD">HKD - 港币</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>报告币</Label>
                <Select defaultValue={selectedLedger?.reportingCurrency || "USD"}>
                  <SelectTrigger>
                    <SelectValue placeholder="可选" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - 美元</SelectItem>
                    <SelectItem value="CNY">CNY - 人民币</SelectItem>
                    <SelectItem value="IDR">IDR - 印尼盾</SelectItem>
                    <SelectItem value="HKD">HKD - 港币</SelectItem>
                    <SelectItem value="NONE">不设置</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">管理账本必须为 USD</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>会计日历</Label>
              <Select defaultValue="MONTHLY_GREGORIAN" disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY_GREGORIAN">月度公历（MONTHLY_GREGORIAN）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">V0 仅支持月度公历</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>金蝶账本ID（可选）</Label>
              <Input 
                placeholder="KD_BOOK_xxxx" 
                defaultValue={selectedLedger?.externalIds.kingdee_book_id}
              />
            </div>

            <div className="space-y-2">
              <Label>状态 *</Label>
              <Select defaultValue={selectedLedger?.status || "ACTIVE"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">启用</SelectItem>
                  <SelectItem value="INACTIVE">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                {editMode ? "保存修改" : "创建"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function LedgersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LedgersContent />
    </Suspense>
  )
}
