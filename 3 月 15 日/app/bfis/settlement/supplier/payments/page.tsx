"use client"

// SP1 供应商付款申请列表页
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  FileText,
  Plus,
  Search,
  Download,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  ChevronRight,
  Calendar,
  DollarSign,
  Building2,
  User,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// SP1｜供应商付款申请列表页
// SP2｜付款申请详情页（Sheet）
// SP3｜新建/编辑付款申请抽屉（强制选择应付单）

type PaymentStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID" | "CANCELED"
type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED"

interface PaymentApplication {
  id: string
  applicationNo: string
  applicant: string
  applyDate: string
  payee: string
  payeeType: "SUPPLIER_HK" | "SUPPLIER_BDG"
  payerEntity: string
  currency: string
  appliedAmount: number
  actualPaidAmount: number | null
  status: PaymentStatus
  approvalStatus: ApprovalStatus | null
  feishuApprovalNo: string | null
  feishuLink: string | null
  poCount: number
  poTotalAmount: number
  hasDifference: boolean
  differenceReason: string | null
  paymentDate: string | null
  remark: string | null
}

const mockApplications: PaymentApplication[] = [
  {
    id: "app_001",
    applicationNo: "PAY_SUP_20260121_001",
    applicant: "张财务",
    applyDate: "2026-01-21",
    payee: "HK Fabric Supplier Ltd.",
    payeeType: "SUPPLIER_HK",
    payerEntity: "GL_HK_USD",
    currency: "USD",
    appliedAmount: 15000,
    actualPaidAmount: null,
    status: "SUBMITTED",
    approvalStatus: "PENDING",
    feishuApprovalNo: "FS_2026012101",
    feishuLink: "https://feishu.cn/approval/FS_2026012101",
    poCount: 3,
    poTotalAmount: 15000,
    hasDifference: false,
    differenceReason: null,
    paymentDate: null,
    remark: null,
  },
  {
    id: "app_002",
    applicationNo: "PAY_SUP_20260120_002",
    applicant: "李采购",
    applyDate: "2026-01-20",
    payee: "PT BDG Textile",
    payeeType: "SUPPLIER_BDG",
    payerEntity: "GL_ID_BDG_IDR",
    currency: "IDR",
    appliedAmount: 50000000,
    actualPaidAmount: 50000000,
    status: "PAID",
    approvalStatus: "APPROVED",
    feishuApprovalNo: "FS_2026012002",
    feishuLink: "https://feishu.cn/approval/FS_2026012002",
    poCount: 2,
    poTotalAmount: 48000000,
    hasDifference: true,
    differenceReason: "包含运费调整 2,000,000 IDR",
    paymentDate: "2026-01-21",
    remark: null,
  },
]

const statusConfig: Record<PaymentStatus, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700", icon: FileText },
  SUBMITTED: { label: "已提交", color: "bg-blue-100 text-blue-700", icon: Clock },
  APPROVED: { label: "已批准", color: "bg-green-100 text-green-700", icon: CheckCircle },
  REJECTED: { label: "已拒绝", color: "bg-red-100 text-red-700", icon: XCircle },
  PAID: { label: "已付款", color: "bg-green-100 text-green-700", icon: CheckCircle },
  CANCELED: { label: "已取消", color: "bg-gray-100 text-gray-700", icon: XCircle },
}

const approvalStatusConfig: Record<ApprovalStatus, { label: string; color: string }> = {
  PENDING: { label: "待审批", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "已批准", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "已拒绝", color: "bg-red-100 text-red-700" },
}

export default function SupplierPaymentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPayeeType, setFilterPayeeType] = useState("all")
  const [filterKeyword, setFilterKeyword] = useState("")
  const [selectedApp, setSelectedApp] = useState<PaymentApplication | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const filteredApplications = mockApplications.filter((app) => {
    if (filterStatus !== "all" && app.status !== filterStatus) return false
    if (filterPayeeType !== "all" && app.payeeType !== filterPayeeType) return false
    if (filterKeyword && !app.applicationNo.toLowerCase().includes(filterKeyword.toLowerCase()) &&
        !app.payee.toLowerCase().includes(filterKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (app: PaymentApplication) => {
    setSelectedApp(app)
    setDetailOpen(true)
  }

  const StatusIcon = selectedApp ? statusConfig[selectedApp.status].icon : Clock

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">供应商付款申请</h1>
          <p className="text-muted-foreground">管理供应商付款申请与飞书审批流程</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建付款申请
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">待审批</div>
            <div className="text-2xl font-bold">
              {mockApplications.filter((a) => a.status === "SUBMITTED").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">已批准待付</div>
            <div className="text-2xl font-bold">
              {mockApplications.filter((a) => a.status === "APPROVED").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">本月已付款</div>
            <div className="text-2xl font-bold">
              {mockApplications.filter((a) => a.status === "PAID").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">本月金额（USD）</div>
            <div className="text-2xl font-bold">$15.0K</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">有差异</div>
            <div className="text-2xl font-bold text-yellow-600">
              {mockApplications.filter((a) => a.hasDifference).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索申请单号、收款方..."
                  value={filterKeyword}
                  onChange={(e) => setFilterKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="申请状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="SUBMITTED">已提交</SelectItem>
                <SelectItem value="APPROVED">已批准</SelectItem>
                <SelectItem value="PAID">已付款</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPayeeType} onValueChange={setFilterPayeeType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="供应商类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="SUPPLIER_HK">HK供应商</SelectItem>
                <SelectItem value="SUPPLIER_BDG">BDG供应商</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>付款申请列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>申请单号</TableHead>
                <TableHead>申请日期</TableHead>
                <TableHead>收款方</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">申请金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>审批状态</TableHead>
                <TableHead>采购单数</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.map((app) => {
                const StatusIcon = statusConfig[app.status].icon
                return (
                  <TableRow
                    key={app.id}
                    className={`cursor-pointer hover:bg-muted/50 ${app.hasDifference ? "bg-yellow-50" : ""}`}
                    onClick={() => openDetail(app)}
                  >
                    <TableCell>
                      <div className="font-mono text-sm">{app.applicationNo}</div>
                      {app.hasDifference && (
                        <Badge variant="outline" className="mt-1 bg-yellow-100 text-yellow-700">
                          有差异
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{app.applyDate}</TableCell>
                    <TableCell>
                      <div className="font-medium">{app.payee}</div>
                      <div className="text-sm text-muted-foreground">{app.payerEntity}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {app.payeeType === "SUPPLIER_HK" ? "HK供应商" : "BDG供应商"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono font-medium">
                        {app.currency} {app.appliedAmount.toLocaleString()}
                      </div>
                      {app.actualPaidAmount && (
                        <div className="text-sm text-muted-foreground">
                          实付: {app.actualPaidAmount.toLocaleString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[app.status].color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[app.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {app.approvalStatus && (
                        <div className="flex items-center gap-2">
                          <Badge className={approvalStatusConfig[app.approvalStatus].color}>
                            {approvalStatusConfig[app.approvalStatus].label}
                          </Badge>
                          {app.feishuLink && (
                            <a href={app.feishuLink} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </a>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span>{app.poCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(app)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SP2 Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selectedApp && (
            <>
              <SheetHeader>
                <SheetTitle>付款申请详情</SheetTitle>
                <SheetDescription>{selectedApp.applicationNo}</SheetDescription>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                {/* Summary Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">申请摘要</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">申请单号</div>
                        <div className="font-mono">{selectedApp.applicationNo}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">申请日期</div>
                        <div>{selectedApp.applyDate}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">申请人</div>
                        <div>{selectedApp.applicant}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">状态</div>
                        <Badge className={statusConfig[selectedApp.status].color}>
                          {statusConfig[selectedApp.status].label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">付款信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">收款方</div>
                      <div className="font-medium">{selectedApp.payee}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">付款主体</div>
                      <div>{selectedApp.payerEntity}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">申请金额</div>
                        <div className="text-lg font-bold">
                          {selectedApp.currency} {selectedApp.appliedAmount.toLocaleString()}
                        </div>
                      </div>
                      {selectedApp.actualPaidAmount && (
                        <div>
                          <div className="text-sm text-muted-foreground">实付金额</div>
                          <div className="text-lg font-bold">
                            {selectedApp.currency} {selectedApp.actualPaidAmount.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedApp.hasDifference && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-yellow-800">差异说明</div>
                            <div className="text-sm text-yellow-700">{selectedApp.differenceReason}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Related POs */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">关联采购单 ({selectedApp.poCount})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      采购单总额: {selectedApp.currency} {selectedApp.poTotalAmount.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                {/* Feishu Approval */}
                {selectedApp.feishuApprovalNo && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">飞书审批</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground">审批单号</div>
                        <div className="font-mono">{selectedApp.feishuApprovalNo}</div>
                      </div>
                      {selectedApp.approvalStatus && (
                        <div>
                          <div className="text-sm text-muted-foreground">审批状态</div>
                          <Badge className={approvalStatusConfig[selectedApp.approvalStatus].color}>
                            {approvalStatusConfig[selectedApp.approvalStatus].label}
                          </Badge>
                        </div>
                      )}
                      {selectedApp.feishuLink && (
                        <a
                          href={selectedApp.feishuLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          在飞书中查看
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* SP3 Create Dialog (Simplified) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建付款申请</DialogTitle>
            <DialogDescription>选择应付单并填写付款信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>收款方 *</Label>
              <Input placeholder="选择或输入供应商名称" />
            </div>
            <div className="space-y-2">
              <Label>付款主体 *</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择付款主体" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GL_HK_USD">GL_HK_USD (HK主体)</SelectItem>
                  <SelectItem value="GL_ID_BDG_IDR">GL_ID_BDG_IDR (BDG主体)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>关联采购单 *</Label>
              <div className="text-sm text-muted-foreground">至少选择1张采购单</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>申请金额 *</Label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>币种</Label>
                <Input value="USD" disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label>差异原因（若金额不一致）</Label>
              <Textarea placeholder="若申请金额与采购单合计不一致，必须填写差异原因" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button>提交申请</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
