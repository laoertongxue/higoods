"use client"

import type React from "react"

import { useState } from "react"
import { Search, Download, Eye, Plus, ChevronRight, RotateCcw, MessageSquare, Ban, FileText } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// AD1 退款/争议/调账列表页 + AD2 事项详情页

type AdjustmentType = "REFUND" | "DISPUTE" | "PENALTY" | "MANUAL_ADJUST"
type AdjustmentStatus = "PENDING" | "CONFIRMED" | "APPLIED"

const typeConfig: Record<AdjustmentType, { label: string; icon: React.ElementType; color: string }> = {
  REFUND: { label: "退款", icon: RotateCcw, color: "bg-orange-100 text-orange-700" },
  DISPUTE: { label: "争议", icon: MessageSquare, color: "bg-red-100 text-red-700" },
  PENALTY: { label: "罚款", icon: Ban, color: "bg-purple-100 text-purple-700" },
  MANUAL_ADJUST: { label: "手工调账", icon: FileText, color: "bg-blue-100 text-blue-700" },
}

const statusConfig: Record<AdjustmentStatus, { label: string; color: string }> = {
  PENDING: { label: "待确认", color: "bg-yellow-100 text-yellow-700" },
  CONFIRMED: { label: "已确认", color: "bg-blue-100 text-blue-700" },
  APPLIED: { label: "已应用", color: "bg-green-100 text-green-700" },
}

// Mock 数据
const mockAdjustments = [
  {
    id: "AD-2026-001",
    adjustmentId: "AD-2026-001",
    storeAccountId: "STORE-TT-001",
    storeName: "TikTok印尼主店",
    channel: "TIKTOK",
    adjType: "REFUND" as AdjustmentType,
    adjDate: "2026-01-15",
    currency: "IDR",
    amount: -2500000,
    amountUSD: -167,
    reasonCode: "BUYER_RETURN",
    reasonDesc: "买家退货退款",
    relatedStatementId: "PS-2026-001",
    relatedReceivableId: "AR-2026-001",
    relatedOrderRef: "ORD-2026-12345",
    status: "CONFIRMED" as AdjustmentStatus,
    createdAt: "2026-01-15 14:00:00",
    updatedAt: "2026-01-15 15:30:00",
  },
  {
    id: "AD-2026-002",
    adjustmentId: "AD-2026-002",
    storeAccountId: "STORE-SP-001",
    storeName: "Shopee印尼店",
    channel: "SHOPEE",
    adjType: "DISPUTE" as AdjustmentType,
    adjDate: "2026-01-12",
    currency: "IDR",
    amount: -5000000,
    amountUSD: -333,
    reasonCode: "QUALITY_DISPUTE",
    reasonDesc: "商品质量争议",
    relatedStatementId: null,
    relatedReceivableId: "AR-2026-003",
    relatedOrderRef: "ORD-2026-11234",
    status: "PENDING" as AdjustmentStatus,
    createdAt: "2026-01-12 10:00:00",
    updatedAt: "2026-01-12 10:00:00",
  },
  {
    id: "AD-2026-003",
    adjustmentId: "AD-2026-003",
    storeAccountId: "STORE-TT-001",
    storeName: "TikTok印尼主店",
    channel: "TIKTOK",
    adjType: "PENALTY" as AdjustmentType,
    adjDate: "2026-01-10",
    currency: "IDR",
    amount: -1000000,
    amountUSD: -67,
    reasonCode: "LATE_SHIP",
    reasonDesc: "延迟发货罚款",
    relatedStatementId: "PS-2026-002",
    relatedReceivableId: null,
    relatedOrderRef: null,
    status: "APPLIED" as AdjustmentStatus,
    createdAt: "2026-01-10 08:00:00",
    updatedAt: "2026-01-11 09:00:00",
  },
  {
    id: "AD-2026-004",
    adjustmentId: "AD-2026-004",
    storeAccountId: "STORE-SP-002",
    storeName: "Shopee马来店",
    channel: "SHOPEE",
    adjType: "MANUAL_ADJUST" as AdjustmentType,
    adjDate: "2026-01-08",
    currency: "MYR",
    amount: 500,
    amountUSD: 114,
    reasonCode: "FX_CORRECTION",
    reasonDesc: "汇率差异调整",
    relatedStatementId: null,
    relatedReceivableId: "AR-2026-006",
    relatedOrderRef: null,
    status: "APPLIED" as AdjustmentStatus,
    createdAt: "2026-01-08 16:00:00",
    updatedAt: "2026-01-09 10:00:00",
  },
]

export default function AdjustmentsPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedAdjustment, setSelectedAdjustment] = useState<(typeof mockAdjustments)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // 筛选
  const filteredData = mockAdjustments.filter((item) => {
    if (
      searchKeyword &&
      !item.adjustmentId.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !item.storeName.toLowerCase().includes(searchKeyword.toLowerCase())
    )
      return false
    if (filterType !== "all" && item.adjType !== filterType) return false
    if (filterStatus !== "all" && item.status !== filterStatus) return false
    return true
  })

  // KPI统计
  const kpiStats = {
    total: mockAdjustments.length,
    pending: mockAdjustments.filter((a) => a.status === "PENDING").length,
    refundUSD: mockAdjustments.filter((a) => a.adjType === "REFUND").reduce((sum, a) => sum + a.amountUSD, 0),
    disputeUSD: mockAdjustments.filter((a) => a.adjType === "DISPUTE").reduce((sum, a) => sum + a.amountUSD, 0),
  }

  const openDetail = (item: (typeof mockAdjustments)[0]) => {
    setSelectedAdjustment(item)
    setDetailOpen(true)
  }

  const formatCurrency = (amount: number, currency: string) => {
    const sign = amount < 0 ? "-" : "+"
    const absAmount = Math.abs(amount)
    if (currency === "IDR") return `${sign}Rp ${absAmount.toLocaleString()}`
    if (currency === "MYR") return `${sign}RM ${absAmount.toLocaleString()}`
    return `${sign}${currency} ${absAmount.toLocaleString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">退款/争议/调账</h1>
          <p className="text-muted-foreground">平台退款、争议、罚款和手工调账管理</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            新建调账
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">全部事项</div>
            <div className="text-2xl font-bold">{kpiStats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="text-sm text-yellow-600 mb-1">待确认</div>
            <div className="text-2xl font-bold text-yellow-700">{kpiStats.pending}</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="text-sm text-orange-600 mb-1">退款合计（USD）</div>
            <div className="text-2xl font-bold text-orange-700">${Math.abs(kpiStats.refundUSD)}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-sm text-red-600 mb-1">争议合计（USD）</div>
            <div className="text-2xl font-bold text-red-700">${Math.abs(kpiStats.disputeUSD)}</div>
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
                placeholder="搜索编号/店铺/订单..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="REFUND">退款</SelectItem>
                <SelectItem value="DISPUTE">争议</SelectItem>
                <SelectItem value="PENALTY">罚款</SelectItem>
                <SelectItem value="MANUAL_ADJUST">手工调账</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="PENDING">待确认</SelectItem>
                <SelectItem value="CONFIRMED">已确认</SelectItem>
                <SelectItem value="APPLIED">已应用</SelectItem>
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
                <TableHead>编号</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>平台/店铺</TableHead>
                <TableHead>日期</TableHead>
                <TableHead className="text-right">金额（原币）</TableHead>
                <TableHead className="text-right">金额（USD）</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>关联账单</TableHead>
                <TableHead>关联应收</TableHead>
                <TableHead>关联订单</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => {
                const TypeIcon = typeConfig[item.adjType].icon
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Button variant="link" className="p-0 h-auto text-blue-600" onClick={() => openDetail(item)}>
                        {item.adjustmentId}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge className={typeConfig[item.adjType].color}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {typeConfig[item.adjType].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="mr-1">
                        {item.channel}
                      </Badge>
                      {item.storeName}
                    </TableCell>
                    <TableCell className="text-sm">{item.adjDate}</TableCell>
                    <TableCell
                      className={`text-right font-mono ${item.amount < 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {formatCurrency(item.amount, item.currency)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${item.amountUSD < 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {item.amountUSD < 0 ? `-$${Math.abs(item.amountUSD)}` : `+$${item.amountUSD}`}
                    </TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate" title={item.reasonDesc}>
                      {item.reasonDesc}
                    </TableCell>
                    <TableCell>
                      {item.relatedStatementId ? (
                        <Button variant="link" className="p-0 h-auto text-sm">
                          {item.relatedStatementId}
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {item.relatedReceivableId ? (
                        <Button variant="link" className="p-0 h-auto text-sm">
                          {item.relatedReceivableId}
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {item.relatedOrderRef ? (
                        <Button variant="link" className="p-0 h-auto text-sm">
                          {item.relatedOrderRef}
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[item.status].color}>{statusConfig[item.status].label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {item.status === "PENDING" && (
                          <Button variant="ghost" size="sm" className="h-8 text-blue-600">
                            确认
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AD2 Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedAdjustment && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span>{selectedAdjustment.adjustmentId}</span>
                  <Badge className={typeConfig[selectedAdjustment.adjType].color}>
                    {typeConfig[selectedAdjustment.adjType].label}
                  </Badge>
                  <Badge className={statusConfig[selectedAdjustment.status].color}>
                    {statusConfig[selectedAdjustment.status].label}
                  </Badge>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">店铺</div>
                    <div className="font-medium">{selectedAdjustment.storeName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">日期</div>
                    <div className="font-medium">{selectedAdjustment.adjDate}</div>
                  </div>
                </div>

                {/* 金额 */}
                <div>
                  <h3 className="font-semibold mb-3">金额信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">原币金额</div>
                      <div
                        className={`text-xl font-bold ${selectedAdjustment.amount < 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        {formatCurrency(selectedAdjustment.amount, selectedAdjustment.currency)}
                      </div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">USD金额</div>
                      <div
                        className={`text-xl font-bold ${selectedAdjustment.amountUSD < 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        {selectedAdjustment.amountUSD < 0
                          ? `-$${Math.abs(selectedAdjustment.amountUSD)}`
                          : `+$${selectedAdjustment.amountUSD}`}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 原因 */}
                <div>
                  <h3 className="font-semibold mb-3">原因说明</h3>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{selectedAdjustment.reasonCode}</Badge>
                    </div>
                    <div className="text-sm">{selectedAdjustment.reasonDesc}</div>
                  </div>
                </div>

                <Separator />

                {/* 关联对象 */}
                <div>
                  <h3 className="font-semibold mb-3">关联对象（可穿透）</h3>
                  <div className="space-y-2">
                    {selectedAdjustment.relatedStatementId && (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span>账单</span>
                        <Button variant="link" className="p-0 h-auto">
                          {selectedAdjustment.relatedStatementId} <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                    {selectedAdjustment.relatedReceivableId && (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span>应收</span>
                        <Button variant="link" className="p-0 h-auto">
                          {selectedAdjustment.relatedReceivableId} <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                    {selectedAdjustment.relatedOrderRef && (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span>订单</span>
                        <Button variant="link" className="p-0 h-auto">
                          {selectedAdjustment.relatedOrderRef} <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t">
                  {selectedAdjustment.status === "PENDING" && (
                    <>
                      <Button onClick={() => toast.success("已确认")}>确认</Button>
                      <Button variant="outline">驳回</Button>
                    </>
                  )}
                  {selectedAdjustment.status === "CONFIRMED" && (
                    <Button onClick={() => toast.success("已应用到应收")}>应用到应收</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
