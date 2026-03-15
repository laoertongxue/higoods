"use client"

import { useState } from "react"
import { Suspense } from "react"
import Loading from "./loading"
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  Download,
  Filter,
  Calendar,
  FileText,
  History,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

// FR1｜原子汇率列表页（补录/审计）
// FR2｜原子汇率详情页（审计/覆盖/作废）
// FR3｜新增/编辑原子汇率抽屉
// 原子记录用于：补录、审计、导入落库、汇率集明细引用、以及缺少汇率集时的回退解析

type RateType = "PERIOD_FIXED" | "END_PERIOD" | "SPOT"
type RateStatus = "ACTIVE" | "VOID"

const rateTypeConfig: Record<RateType, { label: string; color: string }> = {
  PERIOD_FIXED: { label: "期间固定", color: "bg-green-100 text-green-700" },
  END_PERIOD: { label: "期末", color: "bg-blue-100 text-blue-700" },
  SPOT: { label: "即期", color: "bg-orange-100 text-orange-700" },
}

// Mock 原子汇率数据
const mockRates = [
  { id: "fx_001", base: "USD", quote: "IDR", type: "PERIOD_FIXED" as RateType, effectiveDate: null, periodCode: "2026-01", rate: 15600, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2026-01-02 08:00", createdBy: "system", updatedAt: "2026-01-02 08:00", updatedBy: "system" },
  { id: "fx_002", base: "USD", quote: "CNY", type: "PERIOD_FIXED" as RateType, effectiveDate: null, periodCode: "2026-01", rate: 7.25, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2026-01-02 08:00", createdBy: "system", updatedAt: "2026-01-02 08:00", updatedBy: "system" },
  { id: "fx_003", base: "USD", quote: "IDR", type: "END_PERIOD" as RateType, effectiveDate: null, periodCode: "2026-01", rate: 15650, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2026-01-20 08:00", createdBy: "system", updatedAt: "2026-01-20 08:00", updatedBy: "system" },
  { id: "fx_004", base: "USD", quote: "CNY", type: "END_PERIOD" as RateType, effectiveDate: null, periodCode: "2026-01", rate: 7.28, source: "MANUAL", status: "ACTIVE" as RateStatus, isOverride: true, remark: "手工补录期末汇率", createdAt: "2026-01-20 10:00", createdBy: "finance_admin", updatedAt: "2026-01-20 10:00", updatedBy: "finance_admin" },
  { id: "fx_005", base: "USD", quote: "IDR", type: "SPOT" as RateType, effectiveDate: "2026-01-21", periodCode: null, rate: 15680, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2026-01-21 08:00", createdBy: "system", updatedAt: "2026-01-21 08:00", updatedBy: "system" },
  { id: "fx_006", base: "USD", quote: "CNY", type: "SPOT" as RateType, effectiveDate: "2026-01-21", periodCode: null, rate: 7.26, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2026-01-21 08:00", createdBy: "system", updatedAt: "2026-01-21 08:00", updatedBy: "system" },
  { id: "fx_007", base: "IDR", quote: "USD", type: "PERIOD_FIXED" as RateType, effectiveDate: null, periodCode: "2026-01", rate: 0.0000641, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2026-01-02 08:00", createdBy: "system", updatedAt: "2026-01-02 08:00", updatedBy: "system" },
  { id: "fx_008", base: "CNY", quote: "USD", type: "PERIOD_FIXED" as RateType, effectiveDate: null, periodCode: "2026-01", rate: 0.138, source: "MANUAL", status: "ACTIVE" as RateStatus, isOverride: true, remark: "手工修正", createdAt: "2026-01-04 15:00", createdBy: "finance_admin", updatedAt: "2026-01-04 15:00", updatedBy: "finance_admin" },
  { id: "fx_009", base: "USD", quote: "IDR", type: "PERIOD_FIXED" as RateType, effectiveDate: null, periodCode: "2025-12", rate: 15500, source: "IMPORT", status: "VOID" as RateStatus, isOverride: false, remark: "被新记录替代", createdAt: "2025-12-02 08:00", createdBy: "system", updatedAt: "2026-01-02 09:00", updatedBy: "admin" },
  { id: "fx_003", base: "USD", quote: "IDR", type: "SPOT" as RateType, effectiveDate: "2026-01-20", periodCode: null, rate: 15780, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2026-01-20 08:00", createdBy: "system", updatedAt: "2026-01-20 08:00", updatedBy: "system" },
  { id: "fx_004", base: "USD", quote: "CNY", type: "SPOT" as RateType, effectiveDate: "2026-01-20", periodCode: null, rate: 7.26, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2026-01-20 08:00", createdBy: "system", updatedAt: "2026-01-20 08:00", updatedBy: "system" },
  { id: "fx_005", base: "USD", quote: "CNY", type: "SPOT" as RateType, effectiveDate: "2026-01-19", periodCode: null, rate: 7.24, source: "MANUAL", status: "ACTIVE" as RateStatus, isOverride: true, remark: "手工覆盖：修正数据来源延迟", createdAt: "2026-01-19 10:00", createdBy: "admin", updatedAt: "2026-01-19 16:00", updatedBy: "finance_admin" },
  { id: "fx_010", base: "USD", quote: "IDR", type: "PERIOD_FIXED" as RateType, effectiveDate: null, periodCode: "2025-12", rate: 15580, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2025-12-02 08:00", createdBy: "system", updatedAt: "2025-12-02 08:00", updatedBy: "system" },
  { id: "fx_011", base: "USD", quote: "CNY", type: "PERIOD_FIXED" as RateType, effectiveDate: null, periodCode: "2025-12", rate: 7.22, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2025-12-02 08:00", createdBy: "system", updatedAt: "2025-12-02 08:00", updatedBy: "system" },
  { id: "fx_008", base: "USD", quote: "IDR", type: "END_PERIOD" as RateType, effectiveDate: "2025-12-31", periodCode: "2025-12", rate: 15650, source: "IMPORT", status: "ACTIVE" as RateStatus, isOverride: false, remark: null, createdAt: "2025-12-31 23:59", createdBy: "system", updatedAt: "2025-12-31 23:59", updatedBy: "system" },
]

// Mock 审计记录
const mockAuditLogs = [
  { id: 1, action: "CREATE", field: null, oldValue: null, newValue: null, remark: "汇率创建", createdAt: "2026-01-19 10:00", createdBy: "admin" },
  { id: 2, action: "UPDATE", field: "rate", oldValue: "7.23", newValue: "7.24", remark: "手工覆盖：修正数据来源延迟", createdAt: "2026-01-19 16:00", createdBy: "finance_admin" },
]

function RatesPageContent() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterBase, setFilterBase] = useState("all")
  const [filterQuote, setFilterQuote] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterSource, setFilterSource] = useState("all")
  const [filterStatus, setFilterStatus] = useState("ACTIVE")
  const [filterOverride, setFilterOverride] = useState("all")
  const [selectedRate, setSelectedRate] = useState<(typeof mockRates)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editMode, setEditMode] = useState<"create" | "edit">("create")
  const [activeTab, setActiveTab] = useState("info")

  // 编辑表单
  const [formData, setFormData] = useState({
    base: "USD",
    quote: "",
    type: "SPOT" as RateType,
    effectiveDate: "",
    periodCode: "",
    rate: "",
    source: "MANUAL",
    isOverride: false,
    remark: "",
    batchMode: false,
    dateFrom: "",
    dateTo: "",
  })

  // 筛选
  const filteredRates = mockRates.filter((r) => {
    if (filterBase !== "all" && r.base !== filterBase) return false
    if (filterQuote !== "all" && r.quote !== filterQuote) return false
    if (filterType !== "all" && r.type !== filterType) return false
    if (filterSource !== "all" && r.source !== filterSource) return false
    if (filterStatus !== "all" && r.status !== filterStatus) return false
    if (filterOverride === "yes" && !r.isOverride) return false
    if (filterOverride === "no" && r.isOverride) return false
    return true
  })

  const openDetail = (rate: typeof mockRates[0]) => {
    setSelectedRate(rate)
    setDetailOpen(true)
    setActiveTab("info")
  }

  const openEdit = (rate?: typeof mockRates[0]) => {
    if (rate) {
      setEditMode("edit")
      setFormData({
        base: rate.base,
        quote: rate.quote,
        type: rate.type,
        effectiveDate: rate.effectiveDate,
        periodCode: rate.periodCode || "",
        rate: String(rate.rate),
        source: rate.source,
        isOverride: rate.isOverride,
        remark: rate.remark || "",
        batchMode: false,
        dateFrom: "",
        dateTo: "",
      })
    } else {
      setEditMode("create")
      setFormData({
        base: "USD",
        quote: "",
        type: "SPOT",
        effectiveDate: "",
        periodCode: "",
        rate: "",
        source: "MANUAL",
        isOverride: false,
        remark: "",
        batchMode: false,
        dateFrom: "",
        dateTo: "",
      })
    }
    setEditOpen(true)
  }

  const handleSave = () => {
    if (!formData.quote || !formData.rate) {
      toast.error("请填写必填项")
      return
    }
    if (formData.base === formData.quote) {
      toast.error("基准币与报价币不能相同")
      return
    }
    if (Number(formData.rate) <= 0) {
      toast.error("汇率值必须大于0")
      return
    }
    if (formData.type === "SPOT" && !formData.effectiveDate && !formData.batchMode) {
      toast.error("即期汇率必须填写生效日期")
      return
    }
    if (formData.isOverride && !formData.remark) {
      toast.error("覆盖汇率必须填写原因备注")
      return
    }
    toast.success(editMode === "create" ? "汇率创建成功" : "汇率更新成功")
    setEditOpen(false)
  }

  const handleVoid = () => {
    toast.success("汇率已作废")
    setDetailOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">原子汇率</h1>
          <p className="text-muted-foreground">原子记录用于补录、审计、导入落库、汇率集明细引用、以及缺少汇率集时的回退解析</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => openEdit()}>
            <Plus className="h-4 w-4 mr-2" />
            补录汇率
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{mockRates.length}</div>
                <div className="text-sm text-muted-foreground">汇率总数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-700">{mockRates.filter((r) => r.type === "SPOT").length}</div>
                <div className="text-sm text-orange-600">即期汇率</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{mockRates.filter((r) => r.type === "PERIOD_FIXED").length}</div>
                <div className="text-sm text-muted-foreground">期间固定</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{mockRates.filter((r) => r.type === "END_PERIOD").length}</div>
                <div className="text-sm text-muted-foreground">期末汇率</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={mockRates.filter((r) => r.isOverride).length > 0 ? "border-orange-200 bg-orange-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${mockRates.filter((r) => r.isOverride).length > 0 ? "bg-orange-100" : "bg-gray-100"}`}>
                <FileText className={`h-5 w-5 ${mockRates.filter((r) => r.isOverride).length > 0 ? "text-orange-600" : "text-gray-600"}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${mockRates.filter((r) => r.isOverride).length > 0 ? "text-orange-700" : ""}`}>
                  {mockRates.filter((r) => r.isOverride).length}
                </div>
                <div className={`text-sm ${mockRates.filter((r) => r.isOverride).length > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                  手工覆盖
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterBase} onValueChange={setFilterBase}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="基准币" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterQuote} onValueChange={setFilterQuote}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="报价币" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="IDR">IDR</SelectItem>
                <SelectItem value="CNY">CNY</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="汇率类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="SPOT">即期</SelectItem>
                <SelectItem value="PERIOD_FIXED">期间固定</SelectItem>
                <SelectItem value="END_PERIOD">期末</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                <SelectItem value="IMPORT">导入</SelectItem>
                <SelectItem value="MANUAL">手工</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="ACTIVE">有效</SelectItem>
                <SelectItem value="VOID">作废</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOverride} onValueChange={setFilterOverride}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="是否覆盖" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="yes">已覆盖</SelectItem>
                <SelectItem value="no">未覆盖</SelectItem>
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
                <TableHead>日期</TableHead>
                <TableHead>币对</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>期间</TableHead>
                <TableHead className="text-right">汇率</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>覆盖</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRates.map((rate) => (
                <TableRow key={rate.id} className={rate.status === "VOID" ? "opacity-50" : ""}>
                  <TableCell className="font-mono">{rate.effectiveDate}</TableCell>
                  <TableCell className="font-mono font-bold">{rate.base}/{rate.quote}</TableCell>
                  <TableCell>
                    <Badge className={rateTypeConfig[rate.type].color}>
                      {rateTypeConfig[rate.type].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">{rate.periodCode || "-"}</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {rate.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{rate.source}</Badge>
                  </TableCell>
                  <TableCell>
                    {rate.isOverride ? (
                      <Badge className="bg-orange-100 text-orange-700">是</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={rate.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                      {rate.status === "ACTIVE" ? "有效" : "作废"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{rate.updatedAt}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(rate)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {rate.status === "ACTIVE" && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(rate)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* FR2 汇率详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[650px] sm:max-w-[650px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <span className="font-mono text-xl">{selectedRate?.base}/{selectedRate?.quote}</span>
              <Badge className={selectedRate ? rateTypeConfig[selectedRate.type].color : ""}>
                {selectedRate && rateTypeConfig[selectedRate.type].label}
              </Badge>
              {selectedRate?.isOverride && (
                <Badge className="bg-orange-100 text-orange-700">手工覆盖</Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              生效日期: {selectedRate?.effectiveDate}
              {selectedRate?.periodCode && ` | 期间: ${selectedRate.periodCode}`}
            </SheetDescription>
          </SheetHeader>

          {selectedRate && (
            <div className="mt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="info">基本信息</TabsTrigger>
                  <TabsTrigger value="audit">审计记录</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  {/* 汇率值突出显示 */}
                  <div className="p-6 bg-primary/5 rounded-lg text-center">
                    <div className="text-sm text-muted-foreground mb-2">
                      1 {selectedRate.base} =
                    </div>
                    <div className="text-4xl font-bold font-mono">
                      {selectedRate.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                    </div>
                    <div className="text-lg text-muted-foreground mt-1">
                      {selectedRate.quote}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">汇率ID</div>
                      <div className="font-mono text-sm mt-1">{selectedRate.id}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">汇率类型</div>
                      <div className="mt-1">
                        <Badge className={rateTypeConfig[selectedRate.type].color}>
                          {rateTypeConfig[selectedRate.type].label}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">生效日期</div>
                      <div className="font-mono mt-1">{selectedRate.effectiveDate}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">期间编码</div>
                      <div className="font-mono mt-1">{selectedRate.periodCode || "-"}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">来源</div>
                      <div className="mt-1">
                        <Badge variant="outline">{selectedRate.source}</Badge>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">状态</div>
                      <div className="mt-1">
                        <Badge className={selectedRate.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                          {selectedRate.status === "ACTIVE" ? "有效" : "作废"}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">创建时间</div>
                      <div className="text-sm mt-1">{selectedRate.createdAt}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">创建人</div>
                      <div className="text-sm mt-1">{selectedRate.createdBy}</div>
                    </div>
                  </div>

                  {selectedRate.isOverride && selectedRate.remark && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        <span className="font-medium text-orange-800">覆盖备注</span>
                      </div>
                      <p className="text-sm text-orange-700">{selectedRate.remark}</p>
                    </div>
                  )}

                  {selectedRate.status === "ACTIVE" && (
                    <div className="flex gap-2 pt-4">
                      <Button variant="outline" className="flex-1 bg-transparent" onClick={() => openEdit(selectedRate)}>
                        <Edit className="h-4 w-4 mr-2" />
                        编辑/覆盖
                      </Button>
                      <Button variant="destructive" className="flex-1" onClick={handleVoid}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        作废
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="space-y-4">
                  <p className="text-sm text-muted-foreground">汇率变更历史记录</p>
                  <div className="space-y-3">
                    {mockAuditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{log.action}</Badge>
                          <span className="text-xs text-muted-foreground">{log.createdAt}</span>
                        </div>
                        <div className="text-sm">
                          {log.field && (
                            <span>
                              字段 <code className="bg-muted px-1 rounded">{log.field}</code>: {log.oldValue} → {log.newValue}
                            </span>
                          )}
                          {log.remark && <p className="text-muted-foreground mt-1">{log.remark}</p>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">操作人: {log.createdBy}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* FR3 新建/编辑汇率抽屉 */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-[550px] sm:max-w-[550px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editMode === "create" ? "新增汇率" : "编辑汇率"}</SheetTitle>
            <SheetDescription>
              {editMode === "create" ? "创建新的汇率记录，支持批量补录" : "修改汇率信息或覆盖现有汇率"}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>基准币 <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.base}
                  onValueChange={(v) => setFormData({ ...formData, base: v })}
                  disabled={editMode === "edit"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>报价币 <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.quote}
                  onValueChange={(v) => setFormData({ ...formData, quote: v })}
                  disabled={editMode === "edit"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择报价币" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR - 印尼盾</SelectItem>
                    <SelectItem value="CNY">CNY - 人民币</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>汇率类型 <span className="text-red-500">*</span></Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as RateType })}
                disabled={editMode === "edit"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SPOT">SPOT - 即期汇率</SelectItem>
                  <SelectItem value="AVG_MONTH">AVG_MONTH - 月均汇率</SelectItem>
                  <SelectItem value="END_PERIOD">END_PERIOD - 期末汇率</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editMode === "create" && formData.type === "SPOT" && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  id="batchMode"
                  checked={formData.batchMode}
                  onCheckedChange={(checked) => setFormData({ ...formData, batchMode: checked as boolean })}
                />
                <Label htmlFor="batchMode" className="cursor-pointer">批量补录模式（按日期范围）</Label>
              </div>
            )}

            {formData.batchMode ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>开始日期 <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={formData.dateFrom}
                    onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>结束日期 <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={formData.dateTo}
                    onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    生效日期 {formData.type === "SPOT" && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                    disabled={editMode === "edit"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>期间编码</Label>
                  <Input
                    placeholder="YYYY-MM"
                    value={formData.periodCode}
                    onChange={(e) => setFormData({ ...formData, periodCode: e.target.value })}
                    disabled={editMode === "edit"}
                  />
                  <p className="text-xs text-muted-foreground">月均/期末建议填写</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>汇率值 <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                placeholder="如 15850 或 7.25"
              />
              <p className="text-xs text-muted-foreground">
                1 {formData.base || "USD"} = ? {formData.quote || "报价币"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>数据来源</Label>
              <Select
                value={formData.source}
                onValueChange={(v) => setFormData({ ...formData, source: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">MANUAL - 手工维护</SelectItem>
                  <SelectItem value="IMPORT">IMPORT - 文件导入</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editMode === "edit" && (
              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div>
                  <Label>标记为覆盖</Label>
                  <p className="text-xs text-orange-700">覆盖后必须填写备注原因</p>
                </div>
                <Switch
                  checked={formData.isOverride}
                  onCheckedChange={(checked) => setFormData({ ...formData, isOverride: checked })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                备注 {formData.isOverride && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                placeholder="填写备注说明..."
                rows={3}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function RatesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RatesPageContent />
    </Suspense>
  )
}
