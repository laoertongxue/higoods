"use client"

// HS1 主播结算单列表页（旧系统镜像 + 付款闭环）
import { useState } from "react"
import { Search, Download, Plus, ArrowRight, AlertCircle, CheckCircle, Clock, DollarSign } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"

type HostType = "PERSON" | "AGENCY"
type SettlementStatus = "OPEN" | "IN_PAYMENT" | "PAID" | "CLOSED"

interface HostSettlement {
  id: string
  sourceSettlementId: string
  hostId: string
  hostName: string
  hostType: HostType
  periodStart: string
  periodEnd: string
  currency: string
  settlementAmount: number
  paidAmountTotal: number
  unpaidAmount: number
  statusOfa: SettlementStatus
  paidTimeLast: string | null
  varianceAmount: number
}

const mockSettlements: HostSettlement[] = [
  {
    id: "hs_001",
    sourceSettlementId: "OS-HS-202601-008",
    hostId: "host_001",
    hostName: "主播小美",
    hostType: "PERSON",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-15",
    currency: "IDR",
    settlementAmount: 15000000,
    paidAmountTotal: 15000000,
    unpaidAmount: 0,
    statusOfa: "PAID",
    paidTimeLast: "2026-01-20 15:30",
    varianceAmount: 0,
  },
  {
    id: "hs_002",
    sourceSettlementId: "OS-HS-202601-012",
    hostId: "host_002",
    hostName: "直播机构A",
    hostType: "AGENCY",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    currency: "IDR",
    settlementAmount: 45000000,
    paidAmountTotal: 0,
    unpaidAmount: 45000000,
    statusOfa: "OPEN",
    paidTimeLast: null,
    varianceAmount: 0,
  },
  {
    id: "hs_003",
    sourceSettlementId: "OS-HS-202601-015",
    hostId: "host_003",
    hostName: "主播阿强",
    hostType: "PERSON",
    periodStart: "2026-01-16",
    periodEnd: "2026-01-31",
    currency: "CNY",
    settlementAmount: 8500,
    paidAmountTotal: 0,
    unpaidAmount: 8500,
    statusOfa: "OPEN",
    paidTimeLast: null,
    varianceAmount: 0,
  },
  {
    id: "hs_004",
    sourceSettlementId: "OS-HS-202601-018",
    hostId: "host_001",
    hostName: "主播小美",
    hostType: "PERSON",
    periodStart: "2026-01-16",
    periodEnd: "2026-01-31",
    currency: "IDR",
    settlementAmount: 18000000,
    paidAmountTotal: 10000000,
    unpaidAmount: 8000000,
    statusOfa: "IN_PAYMENT",
    paidTimeLast: "2026-01-22 10:00",
    varianceAmount: 0,
  },
]

const statusConfig: Record<SettlementStatus, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "待付款", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  IN_PAYMENT: { label: "付款中", color: "bg-blue-100 text-blue-700", icon: ArrowRight },
  PAID: { label: "已付款", color: "bg-green-100 text-green-700", icon: CheckCircle },
  CLOSED: { label: "已关闭", color: "bg-gray-100 text-gray-700", icon: CheckCircle },
}

const hostTypeLabels: Record<HostType, string> = {
  PERSON: "个人",
  AGENCY: "机构",
}

const HostSettlementPage = () => {
  const [filterHost, setFilterHost] = useState("all")
  const [filterHostType, setFilterHostType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterCurrency, setFilterCurrency] = useState("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)

  const filteredData = mockSettlements.filter((item) => {
    if (filterHost !== "all" && item.hostId !== filterHost) return false
    if (filterHostType !== "all" && item.hostType !== filterHostType) return false
    if (filterStatus !== "all" && item.statusOfa !== filterStatus) return false
    if (filterCurrency !== "all" && item.currency !== filterCurrency) return false
    if (searchKeyword && !item.sourceSettlementId.toLowerCase().includes(searchKeyword.toLowerCase()))
      return false
    return true
  })

  const totalSettlement = mockSettlements.reduce((sum, s) => sum + s.settlementAmount, 0)
  const totalPaid = mockSettlements.reduce((sum, s) => sum + s.paidAmountTotal, 0)
  const totalUnpaid = mockSettlements.reduce((sum, s) => sum + s.unpaidAmount, 0)
  const countOpen = mockSettlements.filter((s) => s.statusOfa === "OPEN").length

  const detailSettlement = mockSettlements.find((s) => s.id === detailId)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredData.map((s) => s.id))
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">主播结算单</h1>
          <p className="text-muted-foreground">旧系统镜像 + 付款闭环 + 证据回写 + 状态回传</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
            <Link href="/bfis/settlement/host/payments">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                发起付款
              </Button>
            </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalSettlement.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">结算总额</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalPaid.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">已付金额</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalUnpaid.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">未付金额</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{countOpen}</div>
                <div className="text-sm text-muted-foreground">待付款单数</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filterHost} onValueChange={setFilterHost}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="主播" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部主播</SelectItem>
                <SelectItem value="host_001">主播小美</SelectItem>
                <SelectItem value="host_002">直播机构A</SelectItem>
                <SelectItem value="host_003">主播阿强</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterHostType} onValueChange={setFilterHostType}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="PERSON">个人</SelectItem>
                <SelectItem value="AGENCY">机构</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="OPEN">待付款</SelectItem>
                <SelectItem value="IN_PAYMENT">付款中</SelectItem>
                <SelectItem value="PAID">已付款</SelectItem>
                <SelectItem value="CLOSED">已关闭</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCurrency} onValueChange={setFilterCurrency}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="币种" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部币种</SelectItem>
                <SelectItem value="IDR">IDR</SelectItem>
                <SelectItem value="CNY">CNY</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索结算单号..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Actions */}
      {selectedItems.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-blue-700">已选择 {selectedItems.length} 条结算单</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  批量发起付款
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedItems([])}>
                  取消选择
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>结算单列表（共 {filteredData.length} 条）</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedItems.length === filteredData.length && filteredData.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>旧系统结算单号</TableHead>
                <TableHead>主播/机构</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>期间起止</TableHead>
                <TableHead>币种</TableHead>
                <TableHead>结算金额</TableHead>
                <TableHead>已付金额</TableHead>
                <TableHead>未付金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最近付款时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((settlement) => {
                const statusInfo = statusConfig[settlement.statusOfa]
                const StatusIcon = statusInfo.icon
                return (
                  <TableRow key={settlement.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.includes(settlement.id)}
                        onCheckedChange={(checked) => handleSelectItem(settlement.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{settlement.sourceSettlementId}</TableCell>
                    <TableCell className="font-medium">{settlement.hostName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{hostTypeLabels[settlement.hostType]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {settlement.periodStart} 至 {settlement.periodEnd}
                    </TableCell>
                    <TableCell>{settlement.currency}</TableCell>
                    <TableCell className="font-medium">{settlement.settlementAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-green-600">{settlement.paidAmountTotal.toLocaleString()}</TableCell>
                    <TableCell className="text-yellow-600">{settlement.unpaidAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={statusInfo.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {settlement.paidTimeLast || "-"}
                    </TableCell>
                    <TableCell>
                      <Sheet open={detailId === settlement.id} onOpenChange={(open) => setDetailId(open ? settlement.id : null)}>
                        <SheetTrigger asChild>
                          <Button variant="ghost" size="sm">
                            查看
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="sm:max-w-[600px] overflow-y-auto">
                          <SheetHeader>
                            <SheetTitle>主播结算单详情</SheetTitle>
                          </SheetHeader>
                          {detailSettlement && (
                            <Tabs defaultValue="info" className="mt-6">
                              <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="info">结算信息</TabsTrigger>
                                <TabsTrigger value="payments">付款记录</TabsTrigger>
                                <TabsTrigger value="components">分项说明</TabsTrigger>
                                <TabsTrigger value="logs">日志附件</TabsTrigger>
                              </TabsList>
                              <TabsContent value="info" className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-sm text-muted-foreground">结算单号</div>
                                    <div className="font-mono text-sm">{detailSettlement.sourceSettlementId}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">状态</div>
                                    <Badge className={statusConfig[detailSettlement.statusOfa].color}>
                                      {statusConfig[detailSettlement.statusOfa].label}
                                    </Badge>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">主播/机构</div>
                                    <div className="font-medium">{detailSettlement.hostName}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">类型</div>
                                    <Badge variant="outline">{hostTypeLabels[detailSettlement.hostType]}</Badge>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">期间起止</div>
                                    <div className="text-sm">
                                      {detailSettlement.periodStart} 至 {detailSettlement.periodEnd}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">币种</div>
                                    <div>{detailSettlement.currency}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">结算金额</div>
                                    <div className="font-bold text-lg">
                                      {detailSettlement.settlementAmount.toLocaleString()}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">累计实付</div>
                                    <div className="font-bold text-lg text-green-600">
                                      {detailSettlement.paidAmountTotal.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                {detailSettlement.statusOfa === "OPEN" && (
                                  <Button className="w-full">
                                    <Plus className="h-4 w-4 mr-2" />
                                    发起付款
                                  </Button>
                                )}
                              </TabsContent>
                              <TabsContent value="payments" className="mt-4">
                                <div className="text-sm text-muted-foreground">暂无付款记录</div>
                              </TabsContent>
                              <TabsContent value="components" className="mt-4">
                                <div className="text-sm text-muted-foreground">
                                  分项明细（固定薪资、提成、补贴、扣款等）由旧系统提供
                                </div>
                              </TabsContent>
                              <TabsContent value="logs" className="mt-4">
                                <div className="space-y-2">
                                  <div className="text-sm p-3 bg-gray-50 rounded">
                                    <div className="font-medium">同步记录</div>
                                    <div className="text-muted-foreground">来源系统: OLD_SYS</div>
                                    <div className="text-muted-foreground">同步时间: 2026-01-21 08:00</div>
                                  </div>
                                </div>
                              </TabsContent>
                            </Tabs>
                          )}
                        </SheetContent>
                      </Sheet>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <HostSettlementPage />
    </Suspense>
  )
}
