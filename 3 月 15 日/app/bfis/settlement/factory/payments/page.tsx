"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Filter, Download, Plus, AlertCircle, CheckCircle2, Clock, XCircle, FileText, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"

// FP1｜工厂付款申请列表页 + FP2｜详情页 + FP3｜新建/编辑付款申请抽屉

type PaymentStatus = "DRAFT" | "SUBMITTED" | "APPROVING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELED"

interface FactoryPaymentRequest {
  payment_request_id: string
  payment_request_code: string
  paying_legal_entity_id: string
  paying_legal_entity_name: string
  payee_factory_id: string
  payee_factory_name: string
  currency: string
  requested_amount: number
  status: PaymentStatus
  feishu_instance_id: string | null
  feishu_status_raw: string | null
  paid_amount_actual: number | null
  paid_time_actual: string | null
  linked_settlement_count: number
  request_time: string
  note: string | null
}

interface SettlementOption {
  settlement_id: string
  source_settlement_id: string
  factory_name: string
  period_start: string
  period_end: string
  currency: string
  settlement_amount: number
}

const mockPaymentRequests: FactoryPaymentRequest[] = [
  {
    payment_request_id: "fpr_001",
    payment_request_code: "FP-20260125-001",
    paying_legal_entity_id: "le_BDG",
    paying_legal_entity_name: "BDG主体",
    payee_factory_id: "F001",
    payee_factory_name: "BDG自有工厂（包干）",
    currency: "IDR",
    requested_amount: 125000000,
    status: "PAID",
    feishu_instance_id: "fs_ins_001",
    feishu_status_raw: "APPROVED",
    paid_amount_actual: 125000000,
    paid_time_actual: "2026-01-16 10:30",
    linked_settlement_count: 1,
    request_time: "2026-01-15 14:00",
    note: "自有工厂包干费用支付"
  },
  {
    payment_request_id: "fpr_002",
    payment_request_code: "FP-20260126-001",
    paying_legal_entity_id: "le_BDG",
    paying_legal_entity_name: "BDG主体",
    payee_factory_id: "F002",
    payee_factory_name: "外协工厂A",
    currency: "IDR",
    requested_amount: 85000000,
    status: "APPROVING",
    feishu_instance_id: "fs_ins_002",
    feishu_status_raw: "APPROVING",
    paid_amount_actual: null,
    paid_time_actual: null,
    linked_settlement_count: 1,
    request_time: "2026-01-16 09:00",
    note: null
  },
  {
    payment_request_id: "fpr_003",
    payment_request_code: "FP-20260127-001",
    paying_legal_entity_id: "le_BDG",
    paying_legal_entity_name: "BDG主体",
    payee_factory_id: "F003",
    payee_factory_name: "外协工厂B",
    currency: "IDR",
    requested_amount: 68000000,
    status: "DRAFT",
    feishu_instance_id: null,
    feishu_status_raw: null,
    paid_amount_actual: null,
    paid_time_actual: null,
    linked_settlement_count: 2,
    request_time: "2026-01-27 10:00",
    note: null
  },
]

const mockSettlementOptions: SettlementOption[] = [
  {
    settlement_id: "fs_003",
    source_settlement_id: "OS-FS-202601-003",
    factory_name: "BDG自有工厂（包干）",
    period_start: "2026-01-15",
    period_end: "2026-01-28",
    currency: "IDR",
    settlement_amount: 135000000,
  },
  {
    settlement_id: "fs_005",
    source_settlement_id: "OS-FS-202601-005",
    factory_name: "外协工厂A",
    period_start: "2026-01-15",
    period_end: "2026-01-28",
    currency: "IDR",
    settlement_amount: 92000000,
  },
]

const statusConfig: Record<PaymentStatus, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700", icon: FileText },
  SUBMITTED: { label: "已提交", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  APPROVING: { label: "审批中", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  APPROVED: { label: "已批准", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  PAID: { label: "已付款", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  REJECTED: { label: "已驳回", color: "bg-red-100 text-red-700", icon: XCircle },
  CANCELED: { label: "已取消", color: "bg-gray-100 text-gray-700", icon: XCircle },
}

export default function FactoryPaymentRequestsPage() {
  const [filterFactory, setFilterFactory] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<FactoryPaymentRequest | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  
  // FP3 新建付款申请状态
  const [formLegalEntity, setFormLegalEntity] = useState("le_BDG")
  const [formFactory, setFormFactory] = useState("")
  const [formCurrency, setFormCurrency] = useState("IDR")
  const [formSelectedSettlements, setFormSelectedSettlements] = useState<string[]>([])
  const [formRequestedAmount, setFormRequestedAmount] = useState("")
  const [formVarianceReason, setFormVarianceReason] = useState("")
  const [formNote, setFormNote] = useState("")

  const filteredData = mockPaymentRequests.filter((item) => {
    if (filterFactory !== "all" && item.payee_factory_id !== filterFactory) return false
    if (filterStatus !== "all" && item.status !== filterStatus) return false
    if (searchKeyword && !item.payment_request_code.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const stats = {
    totalRequested: mockPaymentRequests.reduce((sum, r) => sum + r.requested_amount, 0),
    totalPaid: mockPaymentRequests.reduce((sum, r) => sum + (r.paid_amount_actual || 0), 0),
    approvingCount: mockPaymentRequests.filter((r) => r.status === "APPROVING").length,
    draftCount: mockPaymentRequests.filter((r) => r.status === "DRAFT").length,
  }

  const selectedSettlementSum = mockSettlementOptions
    .filter((s) => formSelectedSettlements.includes(s.settlement_id))
    .reduce((sum, s) => sum + s.settlement_amount, 0)

  const requestedAmountNum = parseFloat(formRequestedAmount) || 0
  const variance = requestedAmountNum - selectedSettlementSum
  const hasVariance = Math.abs(variance) > 1000

  const handleSubmitPayment = () => {
    // 校验逻辑
    if (formSelectedSettlements.length === 0) {
      alert("请至少选择一张结算单")
      return
    }
    if (hasVariance && !formVarianceReason) {
      alert("付款金额与结算单合计不一致，请填写差异原因")
      return
    }
    alert("付款申请已提交！")
    setShowCreateDialog(false)
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">工厂付款申请</h1>
            <p className="text-muted-foreground">选择结算单发起付款，对接飞书审批</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/bfis/settlement/factory">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                结算单列表
              </Button>
            </Link>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建付款申请
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">申请总额</div>
              <div className="text-2xl font-bold">{(stats.totalRequested / 1000000).toFixed(1)}M</div>
              <div className="text-xs text-muted-foreground">IDR</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">已付总额</div>
              <div className="text-2xl font-bold text-green-600">{(stats.totalPaid / 1000000).toFixed(1)}M</div>
              <div className="text-xs text-muted-foreground">IDR</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">审批中</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.approvingCount}</div>
              <div className="text-xs text-muted-foreground">笔</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">草稿</div>
              <div className="text-2xl font-bold text-gray-600">{stats.draftCount}</div>
              <div className="text-xs text-muted-foreground">笔</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索付款申请号..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="h-9"
                />
              </div>
              <Select value={filterFactory} onValueChange={setFilterFactory}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="工厂" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部工厂</SelectItem>
                  <SelectItem value="F001">BDG自有工厂</SelectItem>
                  <SelectItem value="F002">外协工厂A</SelectItem>
                  <SelectItem value="F003">外协工厂B</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="DRAFT">草稿</SelectItem>
                  <SelectItem value="APPROVING">审批中</SelectItem>
                  <SelectItem value="PAID">已付款</SelectItem>
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
                  <TableHead>付款申请号</TableHead>
                  <TableHead>工厂</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead className="text-right">申请金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>飞书实例</TableHead>
                  <TableHead className="text-right">实付金额</TableHead>
                  <TableHead>实付时间</TableHead>
                  <TableHead className="text-center">关联结算单</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((request) => {
                  const statusInfo = statusConfig[request.status]
                  const StatusIcon = statusInfo.icon

                  return (
                    <TableRow key={request.payment_request_id}>
                      <TableCell className="font-mono font-medium">{request.payment_request_code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{request.payee_factory_name}</div>
                        <div className="text-xs text-muted-foreground">{request.paying_legal_entity_name}</div>
                      </TableCell>
                      <TableCell>{request.currency}</TableCell>
                      <TableCell className="text-right font-mono">{request.requested_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color} variant="outline">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {request.feishu_instance_id ? (
                          <div className="flex items-center gap-1 text-sm">
                            <span className="font-mono">{request.feishu_instance_id}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {request.paid_amount_actual ? request.paid_amount_actual.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {request.paid_time_actual || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{request.linked_settlement_count}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(request)}>
                          查看详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* FP2 详情页 Sheet */}
        <Sheet open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
            {selectedRequest && (
              <>
                <SheetHeader>
                  <SheetTitle>付款申请详情</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 py-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">付款申请号</div>
                      <div className="text-xl font-mono font-bold">{selectedRequest.payment_request_code}</div>
                    </div>
                    <Badge className={statusConfig[selectedRequest.status].color} variant="outline">
                      {statusConfig[selectedRequest.status].label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">工厂</div>
                      <div className="font-medium">{selectedRequest.payee_factory_name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">付款主体</div>
                      <div className="font-medium">{selectedRequest.paying_legal_entity_name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">币种</div>
                      <div className="font-medium">{selectedRequest.currency}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">申请时间</div>
                      <div className="text-sm">{selectedRequest.request_time}</div>
                    </div>
                  </div>

                  <Tabs defaultValue="summary">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="summary">摘要</TabsTrigger>
                      <TabsTrigger value="settlements">关联结算单</TabsTrigger>
                      <TabsTrigger value="evidence">飞书证据</TabsTrigger>
                    </TabsList>
                    <TabsContent value="summary" className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">申请金额</span>
                          <span className="text-sm font-mono font-bold">
                            {selectedRequest.requested_amount.toLocaleString()} {selectedRequest.currency}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">实付金额</span>
                          <span className="text-sm font-mono">
                            {selectedRequest.paid_amount_actual ? `${selectedRequest.paid_amount_actual.toLocaleString()} ${selectedRequest.currency}` : "-"}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">实付时间</span>
                          <span className="text-sm">{selectedRequest.paid_time_actual || "-"}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">飞书实例号</span>
                          <span className="text-sm font-mono">{selectedRequest.feishu_instance_id || "-"}</span>
                        </div>
                        {selectedRequest.note && (
                          <div className="py-2">
                            <div className="text-sm text-muted-foreground mb-1">备注</div>
                            <p className="text-sm">{selectedRequest.note}</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="settlements">
                      <div className="text-sm text-muted-foreground text-center py-8">
                        关联 {selectedRequest.linked_settlement_count} 张结算单
                      </div>
                    </TabsContent>
                    <TabsContent value="evidence">
                      {selectedRequest.paid_amount_actual ? (
                        <div className="space-y-3">
                          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                              <div>
                                <div className="font-medium text-green-900">付款已完成</div>
                                <div className="text-sm text-green-700 mt-1">
                                  飞书已回传付款事实，金额: {selectedRequest.paid_amount_actual.toLocaleString()} {selectedRequest.currency}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-8">
                          暂无付款证据
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* FP3 新建付款申请 Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建工厂付款申请</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>付款主体 *</Label>
                <Select value={formLegalEntity} onValueChange={setFormLegalEntity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="le_BDG">BDG主体</SelectItem>
                    <SelectItem value="le_HK">HK主体</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>收款工厂 *</Label>
                <Select value={formFactory} onValueChange={setFormFactory}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择工厂" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F001">BDG自有工厂（包干）</SelectItem>
                    <SelectItem value="F002">外协工厂A</SelectItem>
                    <SelectItem value="F003">外协工厂B</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>币种 *</Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>选择结算单 * （可多选）</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
                  {mockSettlementOptions.map((settlement) => (
                    <div key={settlement.settlement_id} className="flex items-start gap-2 p-2 hover:bg-muted/50 rounded">
                      <Checkbox
                        checked={formSelectedSettlements.includes(settlement.settlement_id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormSelectedSettlements([...formSelectedSettlements, settlement.settlement_id])
                          } else {
                            setFormSelectedSettlements(formSelectedSettlements.filter((id) => id !== settlement.settlement_id))
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-mono text-sm font-medium">{settlement.source_settlement_id}</div>
                        <div className="text-xs text-muted-foreground">
                          {settlement.factory_name} | {settlement.period_start} ~ {settlement.period_end}
                        </div>
                        <div className="text-sm font-medium mt-1">
                          {settlement.settlement_amount.toLocaleString()} {settlement.currency}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {formSelectedSettlements.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="text-sm font-medium text-blue-900">
                      已选择 {formSelectedSettlements.length} 张结算单
                    </div>
                    <div className="text-sm text-blue-700">
                      结算单合计: {selectedSettlementSum.toLocaleString()} {formCurrency}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>付款申请金额 *</Label>
                <Input
                  type="number"
                  placeholder="默认等于结算单合计"
                  value={formRequestedAmount}
                  onChange={(e) => setFormRequestedAmount(e.target.value)}
                />
                {hasVariance && (
                  <div className="p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                    <AlertCircle className="h-4 w-4 inline mr-1 text-orange-600" />
                    <span className="text-orange-700">
                      差异金额: {variance > 0 ? "+" : ""}{variance.toLocaleString()} {formCurrency}
                    </span>
                  </div>
                )}
              </div>

              {hasVariance && (
                <div className="space-y-2">
                  <Label>差异原因 * （金额不一致时必填）</Label>
                  <Textarea
                    placeholder="请说明为什么申请金额与结算单合计不一致..."
                    value={formVarianceReason}
                    onChange={(e) => setFormVarianceReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>备注</Label>
                <Textarea
                  placeholder="可选备注信息..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSubmitPayment}>
                提交到飞书
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Suspense>
  )
}
