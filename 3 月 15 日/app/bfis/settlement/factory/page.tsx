"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Filter, Download, Plus, AlertCircle, CheckCircle2, Clock, XCircle, FileText, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

// FS1｜工厂结算单列表页 + FS2｜详情页

type SettlementStatus = "OPEN" | "IN_PAYMENT" | "PAID" | "CLOSED"
type FactoryType = "OWN_FACTORY" | "OUTSOURCED"
type CloseReasonCode = "NORMAL_PAID" | "OWN_FACTORY_PACKAGE" | "MANUAL_CLOSE"

interface FactorySettlement {
  settlement_id: string
  source_settlement_id: string
  factory_id: string
  factory_name: string
  factory_type: FactoryType
  period_start: string
  period_end: string
  currency: string
  settlement_amount: number
  paid_amount_total: number
  variance_amount: number
  status_ofa: SettlementStatus
  paid_time_last: string | null
  close_reason_code: CloseReasonCode | null
  variance_reason: string | null
  synced_from_old_system_time: string
}

const mockSettlements: FactorySettlement[] = [
  {
    settlement_id: "fs_001",
    source_settlement_id: "OS-FS-202601-001",
    factory_id: "F001",
    factory_name: "BDG自有工厂（包干）",
    factory_type: "OWN_FACTORY",
    period_start: "2026-01-01",
    period_end: "2026-01-14",
    currency: "IDR",
    settlement_amount: 120000000,
    paid_amount_total: 125000000,
    variance_amount: 5000000,
    status_ofa: "PAID",
    paid_time_last: "2026-01-16 10:30",
    close_reason_code: "OWN_FACTORY_PACKAGE",
    variance_reason: "自有工厂包干模式，实际支付包干费用高于结算工序金额",
    synced_from_old_system_time: "2026-01-15 08:00"
  },
  {
    settlement_id: "fs_002",
    source_settlement_id: "OS-FS-202601-002",
    factory_id: "F002",
    factory_name: "外协工厂A",
    factory_type: "OUTSOURCED",
    period_start: "2026-01-01",
    period_end: "2026-01-14",
    currency: "IDR",
    settlement_amount: 85000000,
    paid_amount_total: 85000000,
    variance_amount: 0,
    status_ofa: "PAID",
    paid_time_last: "2026-01-17 14:20",
    close_reason_code: "NORMAL_PAID",
    variance_reason: null,
    synced_from_old_system_time: "2026-01-15 08:00"
  },
  {
    settlement_id: "fs_003",
    source_settlement_id: "OS-FS-202601-003",
    factory_id: "F001",
    factory_name: "BDG自有工厂（包干）",
    factory_type: "OWN_FACTORY",
    period_start: "2026-01-15",
    period_end: "2026-01-28",
    currency: "IDR",
    settlement_amount: 135000000,
    paid_amount_total: 0,
    variance_amount: 0,
    status_ofa: "OPEN",
    paid_time_last: null,
    close_reason_code: null,
    variance_reason: null,
    synced_from_old_system_time: "2026-01-29 08:00"
  },
  {
    settlement_id: "fs_004",
    source_settlement_id: "OS-FS-202601-004",
    factory_id: "F003",
    factory_name: "外协工厂B",
    factory_type: "OUTSOURCED",
    period_start: "2026-01-15",
    period_end: "2026-01-28",
    currency: "IDR",
    settlement_amount: 68000000,
    paid_amount_total: 68000000,
    variance_amount: 0,
    status_ofa: "IN_PAYMENT",
    paid_time_last: null,
    close_reason_code: null,
    variance_reason: null,
    synced_from_old_system_time: "2026-01-29 08:00"
  },
]

const statusConfig: Record<SettlementStatus, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "待付款", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock },
  IN_PAYMENT: { label: "付款中", color: "bg-blue-100 text-blue-700 border-blue-200", icon: AlertCircle },
  PAID: { label: "已付款", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  CLOSED: { label: "已完结", color: "bg-gray-100 text-gray-700 border-gray-200", icon: XCircle },
}

const factoryTypeConfig: Record<FactoryType, { label: string; color: string }> = {
  OWN_FACTORY: { label: "自有工厂", color: "bg-purple-100 text-purple-700" },
  OUTSOURCED: { label: "外协工厂", color: "bg-blue-100 text-blue-700" },
}

const closeReasonConfig: Record<CloseReasonCode, string> = {
  NORMAL_PAID: "正常付款",
  OWN_FACTORY_PACKAGE: "自有工厂包干",
  MANUAL_CLOSE: "手工关闭",
}

const Loading = () => null;

export default function FactorySettlementPage() {
  const [filterFactory, setFilterFactory] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterVariance, setFilterVariance] = useState("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [selectedSettlement, setSelectedSettlement] = useState<FactorySettlement | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const searchParams = useSearchParams();

  const filteredData = mockSettlements.filter((item) => {
    if (filterFactory !== "all" && item.factory_id !== filterFactory) return false
    if (filterType !== "all" && item.factory_type !== filterType) return false
    if (filterStatus !== "all" && item.status_ofa !== filterStatus) return false
    if (filterVariance === "has_variance" && item.variance_amount === 0) return false
    if (filterVariance === "no_variance" && item.variance_amount !== 0) return false
    if (searchKeyword && !item.source_settlement_id.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const stats = {
    totalSettlement: mockSettlements.reduce((sum, s) => sum + s.settlement_amount, 0),
    totalPaid: mockSettlements.reduce((sum, s) => sum + s.paid_amount_total, 0),
    totalVariance: mockSettlements.reduce((sum, s) => sum + Math.abs(s.variance_amount), 0),
    openCount: mockSettlements.filter((s) => s.status_ofa === "OPEN").length,
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredData.map((s) => s.settlement_id))
    } else {
      setSelectedItems([])
    }
  }

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, id])
    } else {
      setSelectedItems(selectedItems.filter((i) => i !== id))
    }
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">工厂结算单</h1>
            <p className="text-muted-foreground">承接旧系统结算单，发起付款申请并完成闭环</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/bfis/settlement/factory/payments">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                付款申请
              </Button>
            </Link>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            {selectedItems.length > 0 && (
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                批量发起付款 ({selectedItems.length})
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">应付总额</div>
              <div className="text-2xl font-bold">
                {(stats.totalSettlement / 1000000).toFixed(1)}M
              </div>
              <div className="text-xs text-muted-foreground">IDR</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">已付总额</div>
              <div className="text-2xl font-bold">
                {(stats.totalPaid / 1000000).toFixed(1)}M
              </div>
              <div className="text-xs text-muted-foreground">IDR</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">总差异金额</div>
              <div className="text-2xl font-bold text-orange-600">
                {(stats.totalVariance / 1000000).toFixed(1)}M
              </div>
              <div className="text-xs text-muted-foreground">IDR</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">待付款单数</div>
              <div className="text-2xl font-bold text-red-600">{stats.openCount}</div>
              <div className="text-xs text-muted-foreground">OPEN</div>
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
                  placeholder="搜索旧系统结算单号..."
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
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="工厂类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="OWN_FACTORY">自有工厂</SelectItem>
                  <SelectItem value="OUTSOURCED">外协工厂</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="OPEN">待付款</SelectItem>
                  <SelectItem value="IN_PAYMENT">付款中</SelectItem>
                  <SelectItem value="PAID">已付款</SelectItem>
                  <SelectItem value="CLOSED">已完结</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterVariance} onValueChange={setFilterVariance}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="差异状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="no_variance">无差异</SelectItem>
                  <SelectItem value="has_variance">有差异</SelectItem>
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
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedItems.length === filteredData.length && filteredData.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>旧系统结算单号</TableHead>
                  <TableHead>工厂</TableHead>
                  <TableHead>周期</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead className="text-right">待结算金额</TableHead>
                  <TableHead className="text-right">已付金额</TableHead>
                  <TableHead className="text-right">差异金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近付款时间</TableHead>
                  <TableHead>关闭原因</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((settlement) => {
                  const statusInfo = statusConfig[settlement.status_ofa]
                  const StatusIcon = statusInfo.icon
                  const factoryTypeInfo = factoryTypeConfig[settlement.factory_type]
                  const hasVariance = settlement.variance_amount !== 0

                  return (
                    <TableRow
                      key={settlement.settlement_id}
                      className={hasVariance ? "bg-yellow-50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(settlement.settlement_id)}
                          onCheckedChange={(checked) => handleSelectItem(settlement.settlement_id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{settlement.source_settlement_id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{settlement.factory_name}</span>
                          <Badge className={factoryTypeInfo.color} variant="outline">
                            {factoryTypeInfo.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{settlement.period_start} ~ {settlement.period_end.slice(5)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{settlement.currency}</TableCell>
                      <TableCell className="text-right font-mono">
                        {settlement.settlement_amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {settlement.paid_amount_total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {hasVariance && (
                          <span className={settlement.variance_amount > 0 ? "text-orange-600 font-medium" : "text-blue-600"}>
                            {settlement.variance_amount > 0 ? "+" : ""}
                            {settlement.variance_amount.toLocaleString()}
                          </span>
                        )}
                        {!hasVariance && <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color} variant="outline">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {settlement.paid_time_last || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {settlement.close_reason_code ? (
                          <span className={settlement.close_reason_code === "OWN_FACTORY_PACKAGE" ? "text-orange-600" : ""}>
                            {closeReasonConfig[settlement.close_reason_code]}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSettlement(settlement)}
                        >
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

        {/* FS2 详情页 Sheet */}
        <Sheet open={!!selectedSettlement} onOpenChange={(open) => !open && setSelectedSettlement(null)}>
          <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
            {selectedSettlement && (
              <>
                <SheetHeader>
                  <SheetTitle>工厂结算单详情</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 py-6">
                  {/* Header Info */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">旧系统结算单号</div>
                        <div className="text-xl font-mono font-bold">{selectedSettlement.source_settlement_id}</div>
                      </div>
                      <Badge className={statusConfig[selectedSettlement.status_ofa].color} variant="outline">
                        {statusConfig[selectedSettlement.status_ofa].label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <div className="text-sm text-muted-foreground">工厂</div>
                        <div className="font-medium">{selectedSettlement.factory_name}</div>
                        <Badge className={factoryTypeConfig[selectedSettlement.factory_type].color} variant="outline">
                          {factoryTypeConfig[selectedSettlement.factory_type].label}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">结算周期</div>
                        <div className="font-medium">{selectedSettlement.period_start} ~ {selectedSettlement.period_end}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">币种</div>
                        <div className="font-medium">{selectedSettlement.currency}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">同步时间</div>
                        <div className="text-sm">{selectedSettlement.synced_from_old_system_time}</div>
                      </div>
                    </div>
                  </div>

                  {/* Amount Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground">待结算金额</div>
                        <div className="text-xl font-bold">
                          {(selectedSettlement.settlement_amount / 1000000).toFixed(2)}M
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground">累计实付</div>
                        <div className="text-xl font-bold">
                          {(selectedSettlement.paid_amount_total / 1000000).toFixed(2)}M
                        </div>
                      </CardContent>
                    </Card>
                    <Card className={selectedSettlement.variance_amount !== 0 ? "border-orange-200 bg-orange-50" : ""}>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground">差异金额</div>
                        <div className={`text-xl font-bold ${selectedSettlement.variance_amount > 0 ? "text-orange-600" : ""}`}>
                          {selectedSettlement.variance_amount > 0 ? "+" : ""}
                          {(selectedSettlement.variance_amount / 1000000).toFixed(2)}M
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tabs */}
                  <Tabs defaultValue="basic">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="basic">基本信息</TabsTrigger>
                      <TabsTrigger value="payments">付款记录</TabsTrigger>
                      <TabsTrigger value="variance">差异与证据</TabsTrigger>
                      <TabsTrigger value="logs">日志</TabsTrigger>
                    </TabsList>
                    <TabsContent value="basic" className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">结算单ID（OFA）</span>
                          <span className="text-sm font-mono">{selectedSettlement.settlement_id}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">工厂ID</span>
                          <span className="text-sm font-mono">{selectedSettlement.factory_id}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">最近付款时间</span>
                          <span className="text-sm">{selectedSettlement.paid_time_last || "-"}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">关闭原因</span>
                          <span className="text-sm">
                            {selectedSettlement.close_reason_code ? closeReasonConfig[selectedSettlement.close_reason_code] : "-"}
                          </span>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="payments" className="space-y-4">
                      <div className="text-sm text-muted-foreground text-center py-8">
                        暂无付款记录
                      </div>
                    </TabsContent>
                    <TabsContent value="variance" className="space-y-4">
                      {selectedSettlement.variance_amount !== 0 ? (
                        <div className="space-y-3">
                          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                              <div className="flex-1">
                                <div className="font-medium text-orange-900">金额差异说明</div>
                                <p className="text-sm text-orange-700 mt-1">
                                  {selectedSettlement.variance_reason || "未填写差异原因"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">差异金额</span>
                            <span className="text-sm font-mono font-medium text-orange-600">
                              {selectedSettlement.variance_amount > 0 ? "+" : ""}
                              {selectedSettlement.variance_amount.toLocaleString()} {selectedSettlement.currency}
                            </span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-sm text-muted-foreground">差异比例</span>
                            <span className="text-sm">
                              {((Math.abs(selectedSettlement.variance_amount) / selectedSettlement.settlement_amount) * 100).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-8">
                          无差异
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="logs" className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-3 text-sm p-3 bg-muted/50 rounded">
                          <div className="text-muted-foreground">{selectedSettlement.synced_from_old_system_time}</div>
                          <div>
                            <div className="font-medium">从旧系统同步</div>
                            <div className="text-muted-foreground">结算单号: {selectedSettlement.source_settlement_id}</div>
                          </div>
                        </div>
                        {selectedSettlement.paid_time_last && (
                          <div className="flex items-start gap-3 text-sm p-3 bg-muted/50 rounded">
                            <div className="text-muted-foreground">{selectedSettlement.paid_time_last}</div>
                            <div>
                              <div className="font-medium">付款完成</div>
                              <div className="text-muted-foreground">状态更新为: PAID</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    {selectedSettlement.status_ofa === "OPEN" && (
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        发起付款
                      </Button>
                    )}
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      导出详情
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Suspense>
  )
}
