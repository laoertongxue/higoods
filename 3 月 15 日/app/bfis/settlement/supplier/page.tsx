"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Building2,
  Calendar,
  DollarSign,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

// SS1｜供应商应付台账列表页（按采购单）
// SS2｜应付单详情页（采购单视图）

type PayableStatus = "DRAFT" | "RECONCILING" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "VOID"
type SupplierType = "FABRIC" | "TRIM" | "EQUIPMENT" | "SAMPLE" | "SERVICE" | "OTHER"

interface SupplierPayable {
  ap_id: string
  ap_code: string
  supplier_id: string
  supplier_name: string
  supplier_type: SupplierType
  buyer_legal_entity_id: string
  buyer_entity_name: string
  ledger_id: string
  currency: string
  source_po_id: string
  po_code: string
  ap_amount: number
  confirmed_amount: number
  paid_amount_total: number
  open_amount: number
  status: PayableStatus
  ap_due_date: string | null
  overdue_days: number
  reconcile_notes: string | null
  created_at: string
  created_by: string
}

// Mock data
const mockPayables: SupplierPayable[] = [
  { ap_id: "AP001", ap_code: "AP-2026-001", supplier_id: "SUP001", supplier_name: "绍兴纺织有限公司", supplier_type: "FABRIC", buyer_legal_entity_id: "HK_HIGOOD_PROC", buyer_entity_name: "HIGOOD LIVE LIMITED", ledger_id: "GL_HK_USD", currency: "USD", source_po_id: "PO001", po_code: "PO-HK-2026-001", ap_amount: 50000, confirmed_amount: 50000, paid_amount_total: 0, open_amount: 50000, status: "CONFIRMED", ap_due_date: "2026-02-15", overdue_days: 0, reconcile_notes: null, created_at: "2026-01-10", created_by: "system" },
  { ap_id: "AP002", ap_code: "AP-2026-002", supplier_id: "SUP002", supplier_name: "PT Indonesia Trim Supply", supplier_type: "TRIM", buyer_legal_entity_id: "ID_BDG_FADFAD", buyer_entity_name: "PT FADFAD FASHION BANDUNG", ledger_id: "GL_ID_BDG_IDR", currency: "IDR", source_po_id: "PO002", po_code: "PO-BDG-2026-002", ap_amount: 15000000, confirmed_amount: 14850000, paid_amount_total: 7500000, open_amount: 7350000, status: "PARTIALLY_PAID", ap_due_date: "2026-02-10", overdue_days: 0, reconcile_notes: "数量短缺调整 -1%", created_at: "2026-01-12", created_by: "system" },
  { ap_id: "AP003", ap_code: "AP-2026-003", supplier_id: "SUP003", supplier_name: "北京样衣工作室", supplier_type: "SAMPLE", buyer_legal_entity_id: "CN_BJ_FANDE", buyer_entity_name: "北京范得科技有限公司", ledger_id: "GL_CN_BJ_CNY", currency: "CNY", source_po_id: "PO003", po_code: "PO-BJ-2026-003", ap_amount: 12000, confirmed_amount: 12000, paid_amount_total: 12000, open_amount: 0, status: "PAID", ap_due_date: "2026-01-25", overdue_days: 0, reconcile_notes: null, created_at: "2026-01-08", created_by: "system" },
  { ap_id: "AP004", ap_code: "AP-2026-004", supplier_id: "SUP001", supplier_name: "绍兴纺织有限公司", supplier_type: "FABRIC", buyer_legal_entity_id: "HK_HIGOOD_PROC", buyer_entity_name: "HIGOOD LIVE LIMITED", ledger_id: "GL_HK_USD", currency: "USD", source_po_id: "PO004", po_code: "PO-HK-2025-125", ap_amount: 38000, confirmed_amount: 38000, paid_amount_total: 0, open_amount: 38000, status: "CONFIRMED", ap_due_date: "2026-01-20", overdue_days: 3, reconcile_notes: null, created_at: "2025-12-28", created_by: "system" },
  { ap_id: "AP005", ap_code: "AP-2026-005", supplier_id: "SUP004", supplier_name: "HK Equipment Ltd", supplier_type: "EQUIPMENT", buyer_legal_entity_id: "ID_BDG_FADFAD", buyer_entity_name: "PT FADFAD FASHION BANDUNG", ledger_id: "GL_ID_BDG_IDR", currency: "IDR", source_po_id: "PO005", po_code: "PO-BDG-2026-005", ap_amount: 85000000, confirmed_amount: 85000000, paid_amount_total: 0, open_amount: 85000000, status: "RECONCILING", ap_due_date: "2026-03-01", overdue_days: 0, reconcile_notes: "待验收确认", created_at: "2026-01-15", created_by: "system" },
]

const statusConfig: Record<PayableStatus, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700", icon: FileText },
  RECONCILING: { label: "对账中", color: "bg-blue-100 text-blue-700", icon: Clock },
  CONFIRMED: { label: "已确认", color: "bg-green-100 text-green-700", icon: CheckCircle },
  PARTIALLY_PAID: { label: "部分已付", color: "bg-yellow-100 text-yellow-700", icon: DollarSign },
  PAID: { label: "已付清", color: "bg-green-100 text-green-700", icon: CheckCircle },
  VOID: { label: "已作废", color: "bg-red-100 text-red-700", icon: XCircle },
}

const supplierTypeLabels: Record<SupplierType, string> = {
  FABRIC: "面料",
  TRIM: "辅料",
  EQUIPMENT: "设备",
  SAMPLE: "样衣",
  SERVICE: "服务",
  OTHER: "其他",
}

export default function SupplierPayablesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterSupplierType, setFilterSupplierType] = useState("all")
  const [filterEntity, setFilterEntity] = useState("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [selectedPayable, setSelectedPayable] = useState<SupplierPayable | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const openDetail = (payable: SupplierPayable) => {
    setSelectedPayable(payable)
    setDetailOpen(true)
  }

  const filteredPayables = mockPayables.filter((p) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false
    if (filterSupplierType !== "all" && p.supplier_type !== filterSupplierType) return false
    if (filterEntity !== "all" && p.buyer_legal_entity_id !== filterEntity) return false
    if (searchKeyword && !p.supplier_name.toLowerCase().includes(searchKeyword.toLowerCase()) && !p.po_code.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const totalAP = filteredPayables.reduce((sum, p) => sum + p.confirmed_amount, 0)
  const totalPaid = filteredPayables.reduce((sum, p) => sum + p.paid_amount_total, 0)
  const totalOpen = filteredPayables.reduce((sum, p) => sum + p.open_amount, 0)
  const overdueCount = filteredPayables.filter((p) => p.overdue_days > 0).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">供应商应付台账</h1>
          <p className="text-muted-foreground">
            以采购单为唯一权威业务依据，统一管理集团各付款主体（HK/BDG/北京）对供应商的应付与付款
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{filteredPayables.length}</div>
                <div className="text-sm text-muted-foreground">应付单数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalAP.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">已确认应付</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalOpen.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">未付余额</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={overdueCount > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${overdueCount > 0 ? "bg-red-100" : "bg-gray-100"}`}>
                <AlertTriangle className={`h-5 w-5 ${overdueCount > 0 ? "text-red-600" : "text-gray-600"}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : ""}`}>{overdueCount}</div>
                <div className={`text-sm ${overdueCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>超期未付</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索供应商/采购单号..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="RECONCILING">对账中</SelectItem>
                <SelectItem value="CONFIRMED">已确认</SelectItem>
                <SelectItem value="PARTIALLY_PAID">部分已付</SelectItem>
                <SelectItem value="PAID">已付清</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSupplierType} onValueChange={setFilterSupplierType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="供应商类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="FABRIC">面料</SelectItem>
                <SelectItem value="TRIM">辅料</SelectItem>
                <SelectItem value="EQUIPMENT">设备</SelectItem>
                <SelectItem value="SAMPLE">样衣</SelectItem>
                <SelectItem value="SERVICE">服务</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="付款主体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部主体</SelectItem>
                <SelectItem value="HK_HIGOOD_PROC">HK-采购主体</SelectItem>
                <SelectItem value="ID_BDG_FADFAD">BDG-生产主体</SelectItem>
                <SelectItem value="CN_BJ_FANDE">BJ-样衣采购</SelectItem>
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
                <TableHead>应付单号</TableHead>
                <TableHead>采购单号</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>付款主体</TableHead>
                <TableHead>币种</TableHead>
                <TableHead className="text-right">已确认应付</TableHead>
                <TableHead className="text-right">已付金额</TableHead>
                <TableHead className="text-right">未付余额</TableHead>
                <TableHead>到期日</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayables.map((payable) => {
                const config = statusConfig[payable.status]
                const Icon = config.icon
                const isOverdue = payable.overdue_days > 0
                return (
                  <TableRow key={payable.ap_id} className={isOverdue ? "bg-red-50" : ""}>
                    <TableCell className="font-mono text-sm">{payable.ap_code}</TableCell>
                    <TableCell className="font-mono text-sm">{payable.po_code}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payable.supplier_name}</div>
                        <div className="text-xs text-muted-foreground">{supplierTypeLabels[payable.supplier_type]}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{supplierTypeLabels[payable.supplier_type]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{payable.buyer_entity_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{payable.currency}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {payable.confirmed_amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {payable.paid_amount_total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {payable.open_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {payable.ap_due_date || "-"}
                        {isOverdue && (
                          <div className="text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            超期{payable.overdue_days}天
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={config.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(payable)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SS2 Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selectedPayable && (
            <>
              <SheetHeader>
                <SheetTitle>应付单详情</SheetTitle>
                <SheetDescription>采购单视图 - {selectedPayable.ap_code}</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Summary */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">应付单号</span>
                      <span className="font-mono font-medium">{selectedPayable.ap_code}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">采购单号</span>
                      <span className="font-mono font-medium">{selectedPayable.po_code}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">供应商</span>
                      <span className="font-medium">{selectedPayable.supplier_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">付款主体</span>
                      <span className="text-sm">{selectedPayable.buyer_entity_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">币种</span>
                      <Badge variant="outline">{selectedPayable.currency}</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">已确认应付</span>
                      <span className="font-mono font-bold text-lg">{selectedPayable.confirmed_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">已付金额</span>
                      <span className="font-mono">{selectedPayable.paid_amount_total.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">未付余额</span>
                      <span className="font-mono font-bold text-lg text-orange-600">
                        {selectedPayable.open_amount.toLocaleString()}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">状态</span>
                      <Badge className={statusConfig[selectedPayable.status].color}>
                        {statusConfig[selectedPayable.status].label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">到期日</span>
                      <span className="text-sm">{selectedPayable.ap_due_date || "-"}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabs */}
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="info">采购单信息</TabsTrigger>
                    <TabsTrigger value="payments">付款记录</TabsTrigger>
                    <TabsTrigger value="reconcile">对账与差异</TabsTrigger>
                    <TabsTrigger value="logs">日志</TabsTrigger>
                  </TabsList>
                  <TabsContent value="info" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">采购单基本信息</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">采购单号</span>
                          <span className="font-mono">{selectedPayable.po_code}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">采购主体</span>
                          <span>{selectedPayable.buyer_entity_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">创建时间</span>
                          <span>{selectedPayable.created_at}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="payments" className="mt-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground text-center py-8">暂无付款记录</p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="reconcile" className="mt-4">
                    <Card>
                      <CardContent className="p-4">
                        {selectedPayable.reconcile_notes ? (
                          <div className="space-y-2">
                            <div className="text-sm font-medium">对账备注</div>
                            <p className="text-sm text-muted-foreground">{selectedPayable.reconcile_notes}</p>
                            {selectedPayable.ap_amount !== selectedPayable.confirmed_amount && (
                              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <div className="text-sm font-medium text-yellow-800">金额调整</div>
                                <div className="text-xs text-yellow-700 mt-1">
                                  原应付: {selectedPayable.ap_amount.toLocaleString()} → 
                                  确认后: {selectedPayable.confirmed_amount.toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">无对账备注</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="logs" className="mt-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3 text-sm">
                            <div className="p-1 bg-blue-100 rounded">
                              <Clock className="h-3 w-3 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">应付单创建</div>
                              <div className="text-xs text-muted-foreground">{selectedPayable.created_at} by {selectedPayable.created_by}</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
