"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import {
  Search,
  Plus,
  Download,
  Upload,
  Eye,
  Lock,
  Unlock,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  FileText,
  TrendingUp,
  TrendingDown,
  Copy,
  Database,
  Calendar,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// FS1｜期间汇率集列表页（按账本/期间）（核心）
// FS2｜期间汇率集详情页（明细+锁定+差异对比）
// FS3｜生成/导入期间汇率集抽屉（含完整性校验）

type RateSetStatus = "DRAFT" | "ACTIVE" | "LOCKED"
type RateSetType = "PERIOD_FIXED" | "END_PERIOD"

const statusConfig: Record<RateSetStatus, { label: string; color: string; icon: typeof Lock }> = {
  LOCKED: { label: "已锁定", color: "bg-green-100 text-green-700", icon: Lock },
  ACTIVE: { label: "生效中", color: "bg-blue-100 text-blue-700", icon: CheckCircle },
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700", icon: Clock },
}

const typeConfig: Record<RateSetType, { label: string; color: string }> = {
  PERIOD_FIXED: { label: "期间固定", color: "bg-green-100 text-green-700" },
  END_PERIOD: { label: "期末", color: "bg-blue-100 text-blue-700" },
}

// Mock 汇率集数据
const mockRateSets = [
  {
    id: "rs_001",
    ledgerId: "GL_MGMT_USD",
    ledgerName: "集团管理账本",
    periodCode: "2026-01",
    rateSetType: "PERIOD_FIXED" as RateSetType,
    status: "LOCKED" as RateSetStatus,
    sourcePriority: ["IMPORT", "MANUAL"],
    itemCount: 6,
    isComplete: true,
    lockedAt: "2026-01-05 10:00",
    lockedBy: "admin",
    createdAt: "2026-01-02 09:00",
    updatedAt: "2026-01-05 10:00",
  },
  {
    id: "rs_002",
    ledgerId: "GL_MGMT_USD",
    ledgerName: "集团管理账本",
    periodCode: "2026-01",
    rateSetType: "END_PERIOD" as RateSetType,
    status: "LOCKED" as RateSetStatus,
    sourcePriority: ["IMPORT", "MANUAL"],
    itemCount: 6,
    isComplete: true,
    lockedAt: "2026-01-20 18:00",
    lockedBy: "admin",
    createdAt: "2026-01-15 09:00",
    updatedAt: "2026-01-20 18:00",
  },
  {
    id: "rs_003",
    ledgerId: "GL_ID_BDG_IDR",
    ledgerName: "BDG法定账本",
    periodCode: "2026-01",
    rateSetType: "PERIOD_FIXED" as RateSetType,
    status: "LOCKED" as RateSetStatus,
    sourcePriority: ["IMPORT", "MANUAL"],
    itemCount: 4,
    isComplete: true,
    lockedAt: "2026-01-05 11:00",
    lockedBy: "finance_admin",
    createdAt: "2026-01-02 10:00",
    updatedAt: "2026-01-05 11:00",
  },
  {
    id: "rs_004",
    ledgerId: "GL_ID_BDG_IDR",
    ledgerName: "BDG法定账本",
    periodCode: "2026-01",
    rateSetType: "END_PERIOD" as RateSetType,
    status: "ACTIVE" as RateSetStatus,
    sourcePriority: ["IMPORT", "MANUAL"],
    itemCount: 4,
    isComplete: true,
    lockedAt: null,
    lockedBy: null,
    createdAt: "2026-01-15 10:00",
    updatedAt: "2026-01-18 14:00",
  },
  {
    id: "rs_005",
    ledgerId: "GL_CN_BJ_CNY",
    ledgerName: "BJ法定账本",
    periodCode: "2026-01",
    rateSetType: "PERIOD_FIXED" as RateSetType,
    status: "ACTIVE" as RateSetStatus,
    sourcePriority: ["IMPORT", "MANUAL"],
    itemCount: 3,
    isComplete: false,
    lockedAt: null,
    lockedBy: null,
    createdAt: "2026-01-03 09:00",
    updatedAt: "2026-01-10 16:00",
  },
  {
    id: "rs_006",
    ledgerId: "GL_CN_BJ_CNY",
    ledgerName: "BJ法定账本",
    periodCode: "2026-01",
    rateSetType: "END_PERIOD" as RateSetType,
    status: "DRAFT" as RateSetStatus,
    sourcePriority: ["IMPORT", "MANUAL"],
    itemCount: 2,
    isComplete: false,
    lockedAt: null,
    lockedBy: null,
    createdAt: "2026-01-15 11:00",
    updatedAt: "2026-01-15 11:00",
  },
]

// Mock 汇率集明细
const mockRateSetItems = [
  { id: "rsi_001", baseCurrency: "USD", quoteCurrency: "IDR", rate: 15600, fxRateId: "fx_001", isOverride: false, remark: "", source: "IMPORT" },
  { id: "rsi_002", baseCurrency: "USD", quoteCurrency: "CNY", rate: 7.25, fxRateId: "fx_002", isOverride: false, remark: "", source: "IMPORT" },
  { id: "rsi_003", baseCurrency: "IDR", quoteCurrency: "USD", rate: 0.0000641, fxRateId: "fx_003", isOverride: false, remark: "", source: "IMPORT" },
  { id: "rsi_004", baseCurrency: "CNY", quoteCurrency: "USD", rate: 0.138, fxRateId: "fx_004", isOverride: true, remark: "手工修正", source: "MANUAL" },
]

// Mock 上期对比
const mockPrevComparison = [
  { baseCurrency: "USD", quoteCurrency: "IDR", currentRate: 15600, prevRate: 15500, change: 0.65 },
  { baseCurrency: "USD", quoteCurrency: "CNY", currentRate: 7.25, prevRate: 7.30, change: -0.68 },
]

// Mock 账本列表
const mockLedgers = [
  { id: "GL_MGMT_USD", name: "集团管理账本", currency: "USD" },
  { id: "GL_ID_BDG_IDR", name: "BDG法定账本", currency: "IDR" },
  { id: "GL_ID_JKT_IDR", name: "JKT法定账本", currency: "IDR" },
  { id: "GL_CN_BJ_CNY", name: "BJ法定账本", currency: "CNY" },
  { id: "GL_CN_SZ_CNY", name: "SZ法定账本", currency: "CNY" },
  { id: "GL_HK_USD", name: "HK法定账本", currency: "USD" },
]

function RateSetsPageContent() {
  const searchParams = useSearchParams()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterLedger, setFilterLedger] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPeriod, setFilterPeriod] = useState("2026-01")
  const [filterComplete, setFilterComplete] = useState("all")

  const [selectedRateSet, setSelectedRateSet] = useState<(typeof mockRateSets)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("items")

  // 新建表单
  const [newLedgerId, setNewLedgerId] = useState("")
  const [newPeriodCode, setNewPeriodCode] = useState("2026-01")
  const [newRateSetType, setNewRateSetType] = useState<RateSetType>("PERIOD_FIXED")
  const [newSourcePriority, setNewSourcePriority] = useState(["IMPORT", "MANUAL"])
  const [newGenerateMethod, setNewGenerateMethod] = useState("from_atomic")
  const [unlockReason, setUnlockReason] = useState("")

  // 筛选
  const filteredRateSets = mockRateSets.filter((rs) => {
    if (filterLedger !== "all" && rs.ledgerId !== filterLedger) return false
    if (filterType !== "all" && rs.rateSetType !== filterType) return false
    if (filterStatus !== "all" && rs.status !== filterStatus) return false
    if (filterPeriod && rs.periodCode !== filterPeriod) return false
    if (filterComplete === "complete" && !rs.isComplete) return false
    if (filterComplete === "incomplete" && rs.isComplete) return false
    if (searchKeyword && !rs.ledgerId.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !rs.ledgerName.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (rs: typeof mockRateSets[0]) => {
    setSelectedRateSet(rs)
    setDetailOpen(true)
    setActiveTab("items")
  }

  const handleLock = () => {
    if (selectedRateSet && !selectedRateSet.isComplete) {
      toast.error("汇率集未通过完整性校验，无法锁定")
      return
    }
    toast.success("汇率集已锁定")
    setDetailOpen(false)
  }

  const handleUnlock = () => {
    if (!unlockReason.trim()) {
      toast.error("请填写解锁原因")
      return
    }
    toast.success("汇率集已解锁")
    setUnlockOpen(false)
    setUnlockReason("")
  }

  const handleCreate = () => {
    if (!newLedgerId || !newPeriodCode || !newRateSetType) {
      toast.error("请填写必填项")
      return
    }
    toast.success("汇率集已创建")
    setCreateOpen(false)
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">期间汇率集</h1>
            <p className="text-muted-foreground">按账本/期间管理期间固定与期末汇率集，支持生成、导入、锁定与解锁</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              生成汇率集
            </Button>
          </div>
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
              <Select value={filterLedger} onValueChange={setFilterLedger}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="账本" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部账本</SelectItem>
                  {mockLedgers.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="month"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="w-[140px]"
              />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="PERIOD_FIXED">期间固定</SelectItem>
                  <SelectItem value="END_PERIOD">期末</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="DRAFT">草稿</SelectItem>
                  <SelectItem value="ACTIVE">生效中</SelectItem>
                  <SelectItem value="LOCKED">已锁定</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterComplete} onValueChange={setFilterComplete}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="完整性" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="complete">完整</SelectItem>
                  <SelectItem value="incomplete">不完整</SelectItem>
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
                  <TableHead>账本</TableHead>
                  <TableHead>期间</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>来源优先级</TableHead>
                  <TableHead className="text-center">明细数</TableHead>
                  <TableHead className="text-center">完整性</TableHead>
                  <TableHead>锁定时间</TableHead>
                  <TableHead>最近更新</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRateSets.map((rs) => (
                  <TableRow key={rs.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{rs.ledgerId}</div>
                      <div className="text-xs text-muted-foreground">{rs.ledgerName}</div>
                    </TableCell>
                    <TableCell className="font-mono">{rs.periodCode}</TableCell>
                    <TableCell>
                      <Badge className={typeConfig[rs.rateSetType].color}>
                        {typeConfig[rs.rateSetType].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[rs.status].color}>
                        {statusConfig[rs.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{rs.sourcePriority.join(" → ")}</TableCell>
                    <TableCell className="text-center font-mono">{rs.itemCount}</TableCell>
                    <TableCell className="text-center">
                      {rs.isComplete ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rs.lockedAt || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rs.updatedAt}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(rs)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* FS2 汇率集详情抽屉 */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                期间汇率集详情
                {selectedRateSet && (
                  <>
                    <Badge className={typeConfig[selectedRateSet.rateSetType].color}>
                      {typeConfig[selectedRateSet.rateSetType].label}
                    </Badge>
                    <Badge className={statusConfig[selectedRateSet.status].color}>
                      {statusConfig[selectedRateSet.status].label}
                    </Badge>
                    {!selectedRateSet.isComplete && (
                      <Badge className="bg-yellow-100 text-yellow-700">不完整</Badge>
                    )}
                  </>
                )}
              </SheetTitle>
              <SheetDescription>
                {selectedRateSet?.ledgerId} | {selectedRateSet?.ledgerName} | {selectedRateSet?.periodCode}
              </SheetDescription>
            </SheetHeader>

            {selectedRateSet && (
              <div className="mt-6">
                {/* 基本信息 */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">来源优先级</div>
                    <div className="font-medium mt-1">{selectedRateSet.sourcePriority.join(" → ")}</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">创建时间</div>
                    <div className="font-medium mt-1">{selectedRateSet.createdAt}</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">锁定信息</div>
                    <div className="font-medium mt-1">
                      {selectedRateSet.lockedAt ? `${selectedRateSet.lockedAt} by ${selectedRateSet.lockedBy}` : "-"}
                    </div>
                  </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="items">明细表</TabsTrigger>
                    <TabsTrigger value="completeness">完整性校验</TabsTrigger>
                    <TabsTrigger value="comparison">差异对比</TabsTrigger>
                    <TabsTrigger value="audit">审计日志</TabsTrigger>
                  </TabsList>

                  <TabsContent value="items" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">共 {mockRateSetItems.length} 条明细</div>
                      {selectedRateSet.status !== "LOCKED" && (
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          补录明细
                        </Button>
                      )}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>基准币</TableHead>
                          <TableHead>报价币</TableHead>
                          <TableHead className="text-right">汇率</TableHead>
                          <TableHead>来源</TableHead>
                          <TableHead>是否覆盖</TableHead>
                          <TableHead>备注</TableHead>
                          <TableHead>原子汇率ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockRateSetItems.map((item) => (
                          <TableRow key={item.id} className={item.isOverride ? "bg-blue-50" : ""}>
                            <TableCell className="font-mono">{item.baseCurrency}</TableCell>
                            <TableCell className="font-mono">{item.quoteCurrency}</TableCell>
                            <TableCell className="text-right font-mono">
                              {item.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.source}</Badge>
                            </TableCell>
                            <TableCell>
                              {item.isOverride ? (
                                <Badge className="bg-blue-100 text-blue-700">是</Badge>
                              ) : (
                                <span className="text-muted-foreground">否</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.remark || "-"}</TableCell>
                            <TableCell className="font-mono text-xs">{item.fxRateId}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="completeness" className="space-y-4">
                    <div className={`p-4 rounded-lg ${selectedRateSet.isComplete ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {selectedRateSet.isComplete ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-green-800">完整性校验通过</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                            <span className="font-medium text-yellow-800">完整性校验未通过</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedRateSet.isComplete
                          ? "该汇率集包含所有必需币对，可以进行锁定操作。"
                          : "该汇率集缺少必需币对，请补齐后再锁定。不完整的汇率集可能影响折算与报表。"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium">必需币对清单</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {["USD/IDR", "USD/CNY", "IDR/USD", "CNY/USD"].map((pair) => (
                          <div key={pair} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-mono text-sm">{pair}</span>
                          </div>
                        ))}
                        {!selectedRateSet.isComplete && (
                          <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span className="font-mono text-sm text-red-700">USD/HKD (缺失)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="comparison" className="space-y-4">
                    <div className="text-sm text-muted-foreground mb-4">
                      与上期 (2025-12) 同类型汇率集对比
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>币对</TableHead>
                          <TableHead className="text-right">本期汇率</TableHead>
                          <TableHead className="text-right">上期汇率</TableHead>
                          <TableHead className="text-right">变动幅度</TableHead>
                          <TableHead>预警</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockPrevComparison.map((c) => (
                          <TableRow key={`${c.baseCurrency}/${c.quoteCurrency}`}>
                            <TableCell className="font-mono">{c.baseCurrency}/{c.quoteCurrency}</TableCell>
                            <TableCell className="text-right font-mono">{c.currentRate.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{c.prevRate.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <span className={`flex items-center justify-end gap-1 ${c.change > 0 ? "text-green-600" : "text-red-600"}`}>
                                {c.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {c.change > 0 ? "+" : ""}{c.change.toFixed(2)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              {Math.abs(c.change) > 3 ? (
                                <Badge className="bg-yellow-100 text-yellow-700">波动超阈值</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="audit" className="space-y-4">
                    <div className="space-y-3">
                      {[
                        { time: "2026-01-05 10:00", action: "锁定汇率集", user: "admin", detail: "完整性校验通过后锁定" },
                        { time: "2026-01-04 15:00", action: "修改明细", user: "finance_admin", detail: "覆盖 CNY/USD 汇率，原因：手工修正" },
                        { time: "2026-01-03 09:00", action: "导入明细", user: "finance_admin", detail: "从文件导入 4 条汇率" },
                        { time: "2026-01-02 09:00", action: "创建汇率集", user: "admin", detail: "从原子汇率自动汇总生成" },
                      ].map((log, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="text-sm text-muted-foreground w-36">{log.time}</div>
                          <div className="flex-1">
                            <div className="font-medium">{log.action}</div>
                            <div className="text-sm text-muted-foreground">{log.detail}</div>
                          </div>
                          <Badge variant="outline">{log.user}</Badge>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 mt-6 pt-4 border-t">
                  {selectedRateSet.status === "LOCKED" ? (
                    <Button variant="outline" onClick={() => setUnlockOpen(true)}>
                      <Unlock className="h-4 w-4 mr-2" />
                      解锁
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleLock} disabled={!selectedRateSet.isComplete}>
                        <Lock className="h-4 w-4 mr-2" />
                        锁定
                      </Button>
                      <Button variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        导入明细
                      </Button>
                      <Button variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        补录明细
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* 解锁确认抽屉 */}
        <Sheet open={unlockOpen} onOpenChange={setUnlockOpen}>
          <SheetContent className="w-[400px]">
            <SheetHeader>
              <SheetTitle className="text-red-600">解锁汇率集</SheetTitle>
              <SheetDescription>
                解锁后可修改汇率集明细。此操作将产生审计记录，请谨慎操作。
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">高风险操作</span>
                </div>
                <p className="text-sm text-red-700">
                  解锁已锁定的汇率集可能影响历史口径与对账，请确保有充分的理由。
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-red-600">解锁原因 (必填)</Label>
                <Textarea
                  placeholder="请详细说明解锁原因..."
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <SheetFooter className="mt-6">
              <Button variant="outline" onClick={() => setUnlockOpen(false)}>取消</Button>
              <Button variant="destructive" onClick={handleUnlock}>确认解锁</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* FS3 生成/导入汇率集抽屉 */}
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>生成期间汇率集</SheetTitle>
              <SheetDescription>
                为指定账本和期间生成期间固定或期末汇率集
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>账本 <span className="text-red-500">*</span></Label>
                <Select value={newLedgerId} onValueChange={setNewLedgerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择账本" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockLedgers.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name} ({l.currency})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>期间 <span className="text-red-500">*</span></Label>
                <Input
                  type="month"
                  value={newPeriodCode}
                  onChange={(e) => setNewPeriodCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>汇率集类型 <span className="text-red-500">*</span></Label>
                <Select value={newRateSetType} onValueChange={(v) => setNewRateSetType(v as RateSetType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERIOD_FIXED">期间固定 (PERIOD_FIXED)</SelectItem>
                    <SelectItem value="END_PERIOD">期末 (END_PERIOD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>来源优先级</Label>
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  IMPORT → MANUAL
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>生成方式</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="from_atomic"
                      name="generateMethod"
                      value="from_atomic"
                      checked={newGenerateMethod === "from_atomic"}
                      onChange={(e) => setNewGenerateMethod(e.target.value)}
                    />
                    <Label htmlFor="from_atomic" className="font-normal">从原子汇率自动汇总</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="from_import"
                      name="generateMethod"
                      value="from_import"
                      checked={newGenerateMethod === "from_import"}
                      onChange={(e) => setNewGenerateMethod(e.target.value)}
                    />
                    <Label htmlFor="from_import" className="font-normal">从导入文件生成</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="from_prev"
                      name="generateMethod"
                      value="from_prev"
                      checked={newGenerateMethod === "from_prev"}
                      onChange={(e) => setNewGenerateMethod(e.target.value)}
                    />
                    <Label htmlFor="from_prev" className="font-normal">从上期复制并调整</Label>
                  </div>
                </div>
              </div>

              {newGenerateMethod === "from_import" && (
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">点击或拖拽上传汇率集模板</p>
                  <Button variant="link" size="sm" className="mt-2">
                    <Download className="h-4 w-4 mr-1" />
                    下载模板
                  </Button>
                </div>
              )}

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800">校验提示</span>
                </div>
                <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                  <li>同 ledger+period+type 不允许重复 ACTIVE/LOCKED</li>
                  <li>汇率值必须大于 0</li>
                  <li>完整性校验不通过可保存为 DRAFT，但不允许锁定</li>
                </ul>
              </div>
            </div>
            <SheetFooter className="mt-6">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button onClick={handleCreate}>生成汇率集</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </Suspense>
  )
}

export default function RateSetsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RateSetsPageContent />
    </Suspense>
  )
}
