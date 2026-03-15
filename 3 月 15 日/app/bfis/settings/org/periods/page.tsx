"use client"

import { useState } from "react"
import { Suspense } from "react"
import {
  Search,
  Download,
  Plus,
  Eye,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Lock,
  Unlock,
  Clock,
  BookOpen,
  ChevronRight,
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
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

// AP1｜会计期间列表页 + AP2｜会计期间详情/状态变更页

type PeriodStatus = "OPEN" | "CLOSING" | "CLOSED"

const periodStatusConfig: Record<PeriodStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  OPEN: { label: "开放", color: "bg-green-100 text-green-700", icon: Unlock },
  CLOSING: { label: "关闭中", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  CLOSED: { label: "已关闭", color: "bg-gray-100 text-gray-700", icon: Lock },
}

// Mock 账本数据
const mockLedgers = [
  { id: "l_01H001", code: "GL_MGMT_USD", name: "HiGood 管理账本（USD）", type: "MANAGEMENT", currency: "USD" },
  { id: "l_01H002", code: "SL_HK_HIGOOD_USD", name: "香港采购主体法定账本", type: "STATUTORY", currency: "USD" },
  { id: "l_01H003", code: "SL_ID_BDG_IDR", name: "印尼BDG生产主体法定账本", type: "STATUTORY", currency: "IDR" },
  { id: "l_01H004", code: "SL_ID_JKT_IDR", name: "印尼JKT直播主体法定账本", type: "STATUTORY", currency: "IDR" },
  { id: "l_01H005", code: "SL_CN_BJ_CNY", name: "北京范得法定账本", type: "STATUTORY", currency: "CNY" },
  { id: "l_01H006", code: "SL_CN_SZ_CNY", name: "深圳嗨好法定账本", type: "STATUTORY", currency: "CNY" },
]

// Mock 期间数据
const mockPeriods = [
  { id: "p_2026_01", ledgerId: "l_01H001", ledgerCode: "GL_MGMT_USD", periodCode: "2026-01", startDate: "2026-01-01", endDate: "2026-01-31", status: "OPEN" as PeriodStatus, closedAt: null, closedBy: null },
  { id: "p_2025_12", ledgerId: "l_01H001", ledgerCode: "GL_MGMT_USD", periodCode: "2025-12", startDate: "2025-12-01", endDate: "2025-12-31", status: "CLOSED" as PeriodStatus, closedAt: "2026-01-05 10:00", closedBy: "finance_admin" },
  { id: "p_2025_11", ledgerId: "l_01H001", ledgerCode: "GL_MGMT_USD", periodCode: "2025-11", startDate: "2025-11-01", endDate: "2025-11-30", status: "CLOSED" as PeriodStatus, closedAt: "2025-12-05 10:00", closedBy: "finance_admin" },
  { id: "p_2026_01_hk", ledgerId: "l_01H002", ledgerCode: "SL_HK_HIGOOD_USD", periodCode: "2026-01", startDate: "2026-01-01", endDate: "2026-01-31", status: "OPEN" as PeriodStatus, closedAt: null, closedBy: null },
  { id: "p_2025_12_hk", ledgerId: "l_01H002", ledgerCode: "SL_HK_HIGOOD_USD", periodCode: "2025-12", startDate: "2025-12-01", endDate: "2025-12-31", status: "CLOSED" as PeriodStatus, closedAt: "2026-01-05 11:00", closedBy: "finance_admin" },
  { id: "p_2026_01_bdg", ledgerId: "l_01H003", ledgerCode: "SL_ID_BDG_IDR", periodCode: "2026-01", startDate: "2026-01-01", endDate: "2026-01-31", status: "OPEN" as PeriodStatus, closedAt: null, closedBy: null },
  { id: "p_2025_12_bdg", ledgerId: "l_01H003", ledgerCode: "SL_ID_BDG_IDR", periodCode: "2025-12", startDate: "2025-12-01", endDate: "2025-12-31", status: "CLOSING" as PeriodStatus, closedAt: null, closedBy: null },
]

// Mock 检查项
const mockChecklistItems = [
  { id: "chk_1", name: "未核销应收账款", status: "pass", count: 0, amount: 0 },
  { id: "chk_2", name: "未核销应付账款", status: "pass", count: 0, amount: 0 },
  { id: "chk_3", name: "汇率缺失记录", status: "warn", count: 3, amount: 1250 },
  { id: "chk_4", name: "毛利回写待处理", status: "pass", count: 0, amount: 0 },
  { id: "chk_5", name: "凭证草稿未过账", status: "warn", count: 5, amount: 8600 },
]

function PeriodsContent() {
  const [selectedLedger, setSelectedLedger] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof mockPeriods)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [statusChangeOpen, setStatusChangeOpen] = useState(false)
  const [targetStatus, setTargetStatus] = useState<PeriodStatus | null>(null)
  const [reopenReason, setReopenReason] = useState("")
  const [activeTab, setActiveTab] = useState("info")

  // KPI 统计
  const stats = {
    total: mockPeriods.length,
    open: mockPeriods.filter((p) => p.status === "OPEN").length,
    closing: mockPeriods.filter((p) => p.status === "CLOSING").length,
    closed: mockPeriods.filter((p) => p.status === "CLOSED").length,
  }

  // 筛选
  const filteredPeriods = mockPeriods.filter((p) => {
    if (selectedLedger !== "all" && p.ledgerId !== selectedLedger) return false
    if (filterStatus !== "all" && p.status !== filterStatus) return false
    return true
  })

  const openDetail = (period: typeof mockPeriods[0]) => {
    setSelectedPeriod(period)
    setDetailOpen(true)
    setActiveTab("info")
  }

  const initiateStatusChange = (period: typeof mockPeriods[0], newStatus: PeriodStatus) => {
    setSelectedPeriod(period)
    setTargetStatus(newStatus)
    setReopenReason("")
    setStatusChangeOpen(true)
  }

  const handleStatusChange = () => {
    if (targetStatus === "OPEN" && selectedPeriod?.status === "CLOSED" && !reopenReason) {
      toast.error("重开已关闭期间必须填写原因")
      return
    }
    toast.success(`期间 ${selectedPeriod?.periodCode} 状态已变更为 ${periodStatusConfig[targetStatus!].label}`)
    setStatusChangeOpen(false)
    setDetailOpen(false)
  }

  const getLedgerName = (ledgerId: string) => {
    return mockLedgers.find((l) => l.id === ledgerId)?.name || ledgerId
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">会计期间</h1>
          <p className="text-muted-foreground">管理各账本的会计期间，控制期间开放/关闭状态</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            批量生成期间
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">期间总数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Unlock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">{stats.open}</div>
                <div className="text-sm text-green-600">开放中</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.closing > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.closing > 0 ? "bg-yellow-100" : "bg-gray-100"}`}>
                <Clock className={`h-5 w-5 ${stats.closing > 0 ? "text-yellow-600" : "text-gray-500"}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${stats.closing > 0 ? "text-yellow-700" : ""}`}>
                  {stats.closing}
                </div>
                <div className={`text-sm ${stats.closing > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                  关闭中
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Lock className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.closed}</div>
                <div className="text-sm text-muted-foreground">已关闭</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={selectedLedger} onValueChange={setSelectedLedger}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="选择账本" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部账本</SelectItem>
                {mockLedgers.map((ledger) => (
                  <SelectItem key={ledger.id} value={ledger.id}>
                    {ledger.code} - {ledger.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="OPEN">开放</SelectItem>
                <SelectItem value="CLOSING">关闭中</SelectItem>
                <SelectItem value="CLOSED">已关闭</SelectItem>
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
                <TableHead>期间编码</TableHead>
                <TableHead>开始日期</TableHead>
                <TableHead>结束日期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>关闭时间</TableHead>
                <TableHead>关闭人</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPeriods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell>
                    <div className="text-sm font-mono">{period.ledgerCode}</div>
                  </TableCell>
                  <TableCell className="font-mono font-medium">{period.periodCode}</TableCell>
                  <TableCell>{period.startDate}</TableCell>
                  <TableCell>{period.endDate}</TableCell>
                  <TableCell>
                    <Badge className={periodStatusConfig[period.status].color}>
                      {periodStatusConfig[period.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {period.closedAt || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {period.closedBy || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(period)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {period.status === "OPEN" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => initiateStatusChange(period, "CLOSING")}
                          title="开始关闭"
                        >
                          <Clock className="h-4 w-4 text-yellow-600" />
                        </Button>
                      )}
                      {period.status === "CLOSING" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => initiateStatusChange(period, "CLOSED")}
                          title="确认关闭"
                        >
                          <Lock className="h-4 w-4 text-gray-600" />
                        </Button>
                      )}
                      {period.status === "CLOSED" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => initiateStatusChange(period, "OPEN")}
                          title="重开期间"
                        >
                          <Unlock className="h-4 w-4 text-orange-600" />
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

      {/* AP2 会计期间详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              期间 {selectedPeriod?.periodCode}
              {selectedPeriod && (
                <Badge className={periodStatusConfig[selectedPeriod.status].color}>
                  {periodStatusConfig[selectedPeriod.status].label}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              账本: {selectedPeriod?.ledgerCode}
            </SheetDescription>
          </SheetHeader>

          {selectedPeriod && (
            <div className="mt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="info">基本信息</TabsTrigger>
                  <TabsTrigger value="checklist">关账检查项</TabsTrigger>
                  <TabsTrigger value="logs">操作日志</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">期间编码</div>
                      <div className="font-mono font-medium mt-1">{selectedPeriod.periodCode}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">账本</div>
                      <div className="font-mono font-medium mt-1">{selectedPeriod.ledgerCode}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">开始日期</div>
                      <div className="font-medium mt-1">{selectedPeriod.startDate}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">结束日期</div>
                      <div className="font-medium mt-1">{selectedPeriod.endDate}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">状态</div>
                      <div className="mt-1">
                        <Badge className={periodStatusConfig[selectedPeriod.status].color}>
                          {periodStatusConfig[selectedPeriod.status].label}
                        </Badge>
                      </div>
                    </div>
                    {selectedPeriod.closedAt && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">关闭时间</div>
                        <div className="font-medium mt-1">{selectedPeriod.closedAt}</div>
                        <div className="text-sm text-muted-foreground">关闭人: {selectedPeriod.closedBy}</div>
                      </div>
                    )}
                  </div>

                  {/* 状态变更按钮 */}
                  <div className="flex items-center gap-2 pt-4">
                    {selectedPeriod.status === "OPEN" && (
                      <Button 
                        variant="outline" 
                        onClick={() => initiateStatusChange(selectedPeriod, "CLOSING")}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        开始关闭
                      </Button>
                    )}
                    {selectedPeriod.status === "CLOSING" && (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={() => initiateStatusChange(selectedPeriod, "OPEN")}
                        >
                          <Unlock className="h-4 w-4 mr-2" />
                          取消关闭
                        </Button>
                        <Button 
                          onClick={() => initiateStatusChange(selectedPeriod, "CLOSED")}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          确认关闭
                        </Button>
                      </>
                    )}
                    {selectedPeriod.status === "CLOSED" && (
                      <Button 
                        variant="outline" 
                        className="text-orange-600 border-orange-200 hover:bg-orange-50 bg-transparent"
                        onClick={() => initiateStatusChange(selectedPeriod, "OPEN")}
                      >
                        <Unlock className="h-4 w-4 mr-2" />
                        重开期间（需填写原因）
                      </Button>
                    )}
                  </div>

                  {/* 规则说明 */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mt-4">
                    <h4 className="font-medium text-blue-800 mb-2">期间状态流转规则</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>OPEN → CLOSING → CLOSED 按顺序流转</li>
                      <li>单账本仅允许 1 个 OPEN 期间（V0 强约束）</li>
                      <li>CLOSED → OPEN 仅系统管理员可操作，且必须填写原因</li>
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="checklist" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    以下检查项在关闭期间前需要确认，部分项目配置为阻断策略时将阻止关闭。
                  </p>
                  <div className="space-y-3">
                    {mockChecklistItems.map((item) => (
                      <div 
                        key={item.id} 
                        className={`p-3 rounded-lg border ${
                          item.status === "pass" 
                            ? "bg-green-50 border-green-200" 
                            : "bg-yellow-50 border-yellow-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.status === "pass" ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-yellow-600" />
                            )}
                            <span className={item.status === "pass" ? "text-green-800" : "text-yellow-800"}>
                              {item.name}
                            </span>
                          </div>
                          <div className="text-sm">
                            {item.count > 0 && (
                              <span className="text-yellow-700">
                                {item.count} 条 | ${item.amount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="logs" className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { time: "2026-01-01 00:00", action: "期间生成", user: "系统", detail: "自动生成 2026-01 期间" },
                    ].map((log, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground w-36">{log.time}</div>
                        <div className="flex-1">
                          <div className="font-medium">{log.action}</div>
                          <div className="text-sm text-muted-foreground">{log.detail}</div>
                        </div>
                        <div className="text-sm">{log.user}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 状态变更确认对话框 */}
      <Dialog open={statusChangeOpen} onOpenChange={setStatusChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {targetStatus === "CLOSING" && "开始关闭期间"}
              {targetStatus === "CLOSED" && "确认关闭期间"}
              {targetStatus === "OPEN" && selectedPeriod?.status === "CLOSED" && "重开已关闭期间"}
              {targetStatus === "OPEN" && selectedPeriod?.status === "CLOSING" && "取消关闭"}
            </DialogTitle>
            <DialogDescription>
              期间 {selectedPeriod?.periodCode} | 账本 {selectedPeriod?.ledgerCode}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {targetStatus === "OPEN" && selectedPeriod?.status === "CLOSED" && (
              <>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800">高风险操作</span>
                  </div>
                  <p className="text-sm text-orange-700">
                    重开已关闭期间可能影响已出具的财务报表，仅系统管理员可执行此操作。
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>重开原因 *</Label>
                  <Textarea 
                    placeholder="请详细说明重开期间的原因..."
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
            {targetStatus === "CLOSED" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  关闭期间后，该期间将不允许新增或修改业务单据。如需调整请先确保所有检查项已通过。
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusChangeOpen(false)}>
              取消
            </Button>
            <Button onClick={handleStatusChange}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PeriodsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PeriodsContent />
    </Suspense>
  )
}
