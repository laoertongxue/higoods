"use client"

// HP1 主播付款申请列表页 + HP2 详情页 + HP3 新建/编辑抽屉
import { useState } from "react"
import { Search, Download, Plus, CheckCircle, Clock, XCircle, AlertCircle, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"

type PaymentStatus = "DRAFT" | "SUBMITTED" | "APPROVING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELED"

interface PaymentRequest {
  id: string
  hprCode: string
  payingLegalEntityId: string
  payingLegalEntityName: string
  payeeHostId: string
  payeeHostName: string
  currency: string
  requestedAmount: number
  status: PaymentStatus
  feishuInstanceId: string | null
  paidAmountActual: number
  paidTimeActual: string | null
  settlementIds: string[]
  settlementCount: number
  createdAt: string
}

const mockPayments: PaymentRequest[] = [
  {
    id: "hpr_001",
    hprCode: "HPR-20260125-001",
    payingLegalEntityId: "le_JKT",
    payingLegalEntityName: "印尼直播主体",
    payeeHostId: "host_001",
    payeeHostName: "主播小美",
    currency: "IDR",
    requestedAmount: 15000000,
    status: "PAID",
    feishuInstanceId: "fs_ins_12345",
    paidAmountActual: 15000000,
    paidTimeActual: "2026-01-20 15:30",
    settlementIds: ["hs_001"],
    settlementCount: 1,
    createdAt: "2026-01-18 10:00",
  },
  {
    id: "hpr_002",
    hprCode: "HPR-20260125-002",
    payingLegalEntityId: "le_JKT",
    payingLegalEntityName: "印尼直播主体",
    payeeHostId: "host_002",
    payeeHostName: "直播机构A",
    currency: "IDR",
    requestedAmount: 45000000,
    status: "APPROVING",
    feishuInstanceId: "fs_ins_12346",
    paidAmountActual: 0,
    paidTimeActual: null,
    settlementIds: ["hs_002"],
    settlementCount: 1,
    createdAt: "2026-01-23 14:20",
  },
]

const statusConfig: Record<PaymentStatus, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700", icon: Clock },
  SUBMITTED: { label: "已提交", color: "bg-blue-100 text-blue-700", icon: ArrowRight },
  APPROVING: { label: "审批中", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  APPROVED: { label: "已批准", color: "bg-green-100 text-green-700", icon: CheckCircle },
  PAID: { label: "已付款", color: "bg-green-100 text-green-700", icon: CheckCircle },
  REJECTED: { label: "已拒绝", color: "bg-red-100 text-red-700", icon: XCircle },
  CANCELED: { label: "已取消", color: "bg-gray-100 text-gray-700", icon: XCircle },
}

export default function HostPaymentsPage() {
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const searchParams = useSearchParams()

  const filteredData = mockPayments.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false
    if (searchKeyword && !item.hprCode.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const totalRequested = mockPayments.reduce((sum, p) => sum + p.requestedAmount, 0)
  const totalPaid = mockPayments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.paidAmountActual, 0)
  const countApproving = mockPayments.filter((p) => p.status === "APPROVING").length
  const countPaid = mockPayments.filter((p) => p.status === "PAID").length

  const detailPayment = mockPayments.find((p) => p.id === detailId)

  return (
    <Suspense fallback={<Loading />}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">主播付款申请</h1>
            <p className="text-muted-foreground">选择结算单 → 飞书审批 → 付款闭环</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建付款申请
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalRequested.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">申请总额</div>
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
                  <div className="text-2xl font-bold">{countApproving}</div>
                  <div className="text-sm text-muted-foreground">审批中</div>
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
                  <div className="text-2xl font-bold">{countPaid}</div>
                  <div className="text-sm text-muted-foreground">已付款笔数</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="DRAFT">草稿</SelectItem>
                  <SelectItem value="APPROVING">审批中</SelectItem>
                  <SelectItem value="PAID">已付款</SelectItem>
                  <SelectItem value="REJECTED">已拒绝</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索付款申请号..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>付款申请列表（共 {filteredData.length} 条）</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>付款申请号</TableHead>
                  <TableHead>付款主体</TableHead>
                  <TableHead>收款对象</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead>申请金额</TableHead>
                  <TableHead>实付金额</TableHead>
                  <TableHead>关联结算单</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>付款时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((payment) => {
                  const statusInfo = statusConfig[payment.status]
                  const StatusIcon = statusInfo.icon
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">{payment.hprCode}</TableCell>
                      <TableCell>{payment.payingLegalEntityName}</TableCell>
                      <TableCell className="font-medium">{payment.payeeHostName}</TableCell>
                      <TableCell>{payment.currency}</TableCell>
                      <TableCell className="font-medium">{payment.requestedAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-green-600">{payment.paidAmountActual.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.settlementCount} 张</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payment.paidTimeActual || "-"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(payment.id)}>
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* HP2 Detail Sheet */}
        <Sheet open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
          <SheetContent className="sm:max-w-[600px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>付款申请详情</SheetTitle>
            </SheetHeader>
            {detailPayment && (
              <Tabs defaultValue="summary" className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="summary">摘要</TabsTrigger>
                  <TabsTrigger value="settlements">关联结算单</TabsTrigger>
                  <TabsTrigger value="evidence">飞书证据</TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">付款申请号</div>
                      <div className="font-mono text-sm">{detailPayment.hprCode}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">状态</div>
                      <Badge className={statusConfig[detailPayment.status].color}>
                        {statusConfig[detailPayment.status].label}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">付款主体</div>
                      <div>{detailPayment.payingLegalEntityName}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">收款对象</div>
                      <div className="font-medium">{detailPayment.payeeHostName}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">币种</div>
                      <div>{detailPayment.currency}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">申请金额</div>
                      <div className="font-bold text-lg">{detailPayment.requestedAmount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">实付金额</div>
                      <div className="font-bold text-lg text-green-600">
                        {detailPayment.paidAmountActual.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">付款时间</div>
                      <div>{detailPayment.paidTimeActual || "-"}</div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="settlements" className="mt-4">
                  <div className="space-y-2">
                    <div className="text-sm p-3 bg-gray-50 rounded">
                      <div className="font-medium">OS-HS-202601-008</div>
                      <div className="text-muted-foreground">期间: 2026-01-01 至 2026-01-15</div>
                      <div className="text-muted-foreground">金额: 15,000,000 IDR</div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="evidence" className="mt-4">
                  <div className="space-y-2">
                    <div className="text-sm p-3 bg-blue-50 rounded border border-blue-200">
                      <div className="font-medium">飞书实例号</div>
                      <div className="font-mono text-xs">{detailPayment.feishuInstanceId}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">付款证据/附件由飞书回传</div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </SheetContent>
        </Sheet>

        {/* HP3 Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建主播付款申请</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>付款主体 *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="选择付款主体" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="le_JKT">印尼直播主体</SelectItem>
                    <SelectItem value="le_HK">HK</SelectItem>
                    <SelectItem value="le_SZ">深圳主体</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>收款主播/机构 *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="选择主播" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="host_001">主播小美</SelectItem>
                    <SelectItem value="host_002">直播机构A</SelectItem>
                    <SelectItem value="host_003">主播阿强</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>币种 *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="选择币种" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>选择结算单 *</Label>
                <div className="border rounded p-3 space-y-2 max-h-[200px] overflow-y-auto">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="hs_001" />
                    <label htmlFor="hs_001" className="text-sm flex-1">
                      <div className="font-medium">OS-HS-202601-008</div>
                      <div className="text-muted-foreground">主播小美 | 2026-01-01~15 | 15,000,000 IDR</div>
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="hs_004" />
                    <label htmlFor="hs_004" className="text-sm flex-1">
                      <div className="font-medium">OS-HS-202601-018</div>
                      <div className="text-muted-foreground">主播小美 | 2026-01-16~31 | 18,000,000 IDR</div>
                    </label>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  结算单合计金额: <span className="font-medium">33,000,000 IDR</span>
                </div>
              </div>
              <div>
                <Label>申请付款金额 *</Label>
                <Input type="number" placeholder="默认等于结算单合计" defaultValue="33000000" />
              </div>
              <div>
                <Label>备注</Label>
                <Textarea placeholder="填写备注信息" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 bg-transparent">
                  保存草稿
                </Button>
                <Button className="flex-1">提交飞书审批</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Suspense>
  )
}
