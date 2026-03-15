"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  Search,
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  RotateCcw,
  Play,
  FileText,
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
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// PSC1 预售取消冲回队列页

type ReversalStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "MANUAL_REVIEW"
type ReversalType = "ORDER_CANCEL" | "BATCH_CANCEL" | "PARTIAL_CANCEL"

const statusConfig: Record<ReversalStatus, { label: string; color: string }> = {
  PENDING: { label: "待处理", color: "bg-gray-100 text-gray-700" },
  PROCESSING: { label: "处理中", color: "bg-blue-100 text-blue-700" },
  SUCCESS: { label: "已完成", color: "bg-green-100 text-green-700" },
  FAILED: { label: "处理失败", color: "bg-red-100 text-red-700" },
  MANUAL_REVIEW: { label: "需人工复核", color: "bg-yellow-100 text-yellow-700" },
}

const typeConfig: Record<ReversalType, { label: string; color: string }> = {
  ORDER_CANCEL: { label: "订单取消", color: "bg-orange-100 text-orange-700" },
  BATCH_CANCEL: { label: "批次取消", color: "bg-purple-100 text-purple-700" },
  PARTIAL_CANCEL: { label: "部分取消", color: "bg-cyan-100 text-cyan-700" },
}

// Mock 冲回队列数据
const mockReversalQueue = [
  {
    id: "REV-2026-001",
    type: "ORDER_CANCEL" as ReversalType,
    sourceId: "ORD-2026-0115-088",
    sourceBatchId: "PSB-2026-001",
    sku: "SKU-DRESS-001",
    skuName: "连衣裙-红色-S",
    qty: 5,
    estimateCostUSD: 225,
    status: "PENDING" as ReversalStatus,
    reason: "用户取消订单",
    affectedSnapshots: ["GMS-2026-0115", "GMS-2026-0116"],
    createdAt: "2026-01-16 14:30",
    processedAt: null,
  },
  {
    id: "REV-2026-002",
    type: "BATCH_CANCEL" as ReversalType,
    sourceId: "PSB-2026-004",
    sourceBatchId: "PSB-2026-004",
    sku: null,
    skuName: "情人节限定款（整批）",
    qty: 450,
    estimateCostUSD: 12500,
    status: "PROCESSING" as ReversalStatus,
    reason: "供应商产能不足",
    affectedSnapshots: ["GMS-2026-0110", "GMS-2026-0111", "GMS-2026-0112"],
    createdAt: "2026-01-15 10:00",
    processedAt: null,
  },
  {
    id: "REV-2026-003",
    type: "PARTIAL_CANCEL" as ReversalType,
    sourceId: "ORD-2026-0112-045",
    sourceBatchId: "PSB-2026-002",
    sku: "SKU-COAT-003",
    skuName: "冬季外套-黑色-L",
    qty: 3,
    estimateCostUSD: 180,
    status: "SUCCESS" as ReversalStatus,
    reason: "部分商品缺货",
    affectedSnapshots: ["GMS-2026-0112"],
    createdAt: "2026-01-14 16:00",
    processedAt: "2026-01-14 16:05",
  },
  {
    id: "REV-2026-004",
    type: "ORDER_CANCEL" as ReversalType,
    sourceId: "ORD-2026-0110-023",
    sourceBatchId: "PSB-2026-001",
    sku: "SKU-DRESS-002",
    skuName: "连衣裙-红色-M",
    qty: 2,
    estimateCostUSD: 90,
    status: "MANUAL_REVIEW" as ReversalStatus,
    reason: "用户取消订单",
    affectedSnapshots: ["GMS-2026-0110"],
    createdAt: "2026-01-13 09:30",
    processedAt: null,
    reviewReason: "快照已锁定，需要财务确认是否重开",
  },
  {
    id: "REV-2026-005",
    type: "ORDER_CANCEL" as ReversalType,
    sourceId: "ORD-2026-0108-067",
    sourceBatchId: "PSB-2026-003",
    sku: "SKU-TSHIRT-001",
    skuName: "T恤-白色-S",
    qty: 10,
    estimateCostUSD: 80,
    status: "FAILED" as ReversalStatus,
    reason: "用户取消订单",
    affectedSnapshots: ["GMS-2026-0108"],
    createdAt: "2026-01-12 11:00",
    processedAt: "2026-01-12 11:05",
    errorMsg: "关联成本版本已退役",
  },
]

const LoadingComponent = () => null;

export default function PresaleReversalPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedReversal, setSelectedReversal] = useState<(typeof mockReversalQueue)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const searchParams = useSearchParams();

  // KPI统计
  const stats = {
    total: mockReversalQueue.length,
    pending: mockReversalQueue.filter((r) => r.status === "PENDING").length,
    processing: mockReversalQueue.filter((r) => r.status === "PROCESSING").length,
    needReview: mockReversalQueue.filter((r) => r.status === "MANUAL_REVIEW").length,
    failed: mockReversalQueue.filter((r) => r.status === "FAILED").length,
    pendingAmountUSD: mockReversalQueue
      .filter((r) => r.status === "PENDING" || r.status === "PROCESSING")
      .reduce((sum, r) => sum + r.estimateCostUSD, 0),
  }

  // 筛选
  const filteredQueue = mockReversalQueue.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false
    if (filterType !== "all" && r.type !== filterType) return false
    if (searchKeyword && !r.id.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !r.sourceId.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (reversal: typeof mockReversalQueue[0]) => {
    setSelectedReversal(reversal)
    setDetailOpen(true)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredQueue.filter((r) => r.status === "PENDING").map((r) => r.id))
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

  const handleBatchProcess = () => {
    toast.success(`已提交 ${selectedItems.length} 条冲回任务`)
    setSelectedItems([])
  }

  const handleRetry = (id: string) => {
    toast.success(`冲回任务 ${id} 已重新提交`)
  }

  const handleManualApprove = () => {
    toast.success("已人工确认，冲回任务继续执行")
    setDetailOpen(false)
  }

  return (
    <Suspense fallback={<LoadingComponent />}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">预售取消冲回队列</h1>
            <p className="text-muted-foreground">处理预售订单/批次取消后的暂估成本冲回，更新毛利快照</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            {selectedItems.length > 0 && (
              <Button size="sm" onClick={handleBatchProcess}>
                <Play className="h-4 w-4 mr-2" />
                批量处理 ({selectedItems.length})
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">队列总数</span>
              </div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className={stats.pending > 0 ? "border-gray-300 bg-gray-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-600">待处理</span>
              </div>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className={stats.processing > 0 ? "border-blue-200 bg-blue-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className={`h-4 w-4 ${stats.processing > 0 ? "text-blue-600 animate-spin" : "text-muted-foreground"}`} />
                <span className={`text-sm ${stats.processing > 0 ? "text-blue-600" : "text-muted-foreground"}`}>处理中</span>
              </div>
              <div className={`text-2xl font-bold ${stats.processing > 0 ? "text-blue-700" : ""}`}>{stats.processing}</div>
            </CardContent>
          </Card>
          <Card className={stats.needReview > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`h-4 w-4 ${stats.needReview > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
                <span className={`text-sm ${stats.needReview > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>需人工复核</span>
              </div>
              <div className={`text-2xl font-bold ${stats.needReview > 0 ? "text-yellow-700" : ""}`}>{stats.needReview}</div>
            </CardContent>
          </Card>
          <Card className={stats.failed > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className={`h-4 w-4 ${stats.failed > 0 ? "text-red-600" : "text-muted-foreground"}`} />
                <span className={`text-sm ${stats.failed > 0 ? "text-red-600" : "text-muted-foreground"}`}>处理失败</span>
              </div>
              <div className={`text-2xl font-bold ${stats.failed > 0 ? "text-red-700" : ""}`}>{stats.failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">待冲回金额</span>
              </div>
              <div className="text-2xl font-bold">${stats.pendingAmountUSD.toLocaleString()}</div>
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
                  placeholder="搜索冲回单号/来源单号..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="PENDING">待处理</SelectItem>
                  <SelectItem value="PROCESSING">处理中</SelectItem>
                  <SelectItem value="SUCCESS">已完成</SelectItem>
                  <SelectItem value="FAILED">处理失败</SelectItem>
                  <SelectItem value="MANUAL_REVIEW">需人工复核</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="冲回类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="ORDER_CANCEL">订单取消</SelectItem>
                  <SelectItem value="BATCH_CANCEL">批次取消</SelectItem>
                  <SelectItem value="PARTIAL_CANCEL">部分取消</SelectItem>
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
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedItems.length === filteredQueue.filter((r) => r.status === "PENDING").length && selectedItems.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>冲回单号</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>来源单号</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">冲回金额 (USD)</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueue.map((reversal) => (
                  <TableRow key={reversal.id} className={reversal.status === "FAILED" || reversal.status === "MANUAL_REVIEW" ? "bg-red-50/30" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.includes(reversal.id)}
                        onCheckedChange={(checked) => handleSelectItem(reversal.id, checked as boolean)}
                        disabled={reversal.status !== "PENDING"}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{reversal.id}</TableCell>
                    <TableCell>
                      <Badge className={typeConfig[reversal.type].color}>
                        {typeConfig[reversal.type].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="link" className="p-0 h-auto text-blue-600 text-sm">
                        {reversal.sourceId}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{reversal.skuName}</div>
                      {reversal.sku && <div className="text-xs text-muted-foreground">{reversal.sku}</div>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{reversal.qty}</TableCell>
                    <TableCell className="text-right font-mono text-orange-600">${reversal.estimateCostUSD.toLocaleString()}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate" title={reversal.reason}>{reversal.reason}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig[reversal.status].color}>
                        {statusConfig[reversal.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{reversal.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(reversal)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {reversal.status === "FAILED" && (
                          <Button variant="ghost" size="sm" onClick={() => handleRetry(reversal.id)}>
                            <RefreshCw className="h-4 w-4" />
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

        {/* Detail Sheet */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-[600px] sm:max-w-[600px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {selectedReversal?.id}
                {selectedReversal && (
                  <>
                    <Badge className={typeConfig[selectedReversal.type].color}>
                      {typeConfig[selectedReversal.type].label}
                    </Badge>
                    <Badge className={statusConfig[selectedReversal.status].color}>
                      {statusConfig[selectedReversal.status].label}
                    </Badge>
                  </>
                )}
              </SheetTitle>
              <SheetDescription>
                来源: {selectedReversal?.sourceId} | 批次: {selectedReversal?.sourceBatchId}
              </SheetDescription>
            </SheetHeader>

            {selectedReversal && (
              <div className="mt-6 space-y-6">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">商品</div>
                    <div className="font-medium mt-1">{selectedReversal.skuName}</div>
                    {selectedReversal.sku && <div className="text-xs text-muted-foreground">{selectedReversal.sku}</div>}
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">数量</div>
                    <div className="font-medium mt-1">{selectedReversal.qty}</div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="text-sm text-orange-600">冲回金额 (USD)</div>
                    <div className="font-bold text-lg text-orange-700 mt-1">${selectedReversal.estimateCostUSD.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">取消原因</div>
                    <div className="font-medium mt-1">{selectedReversal.reason}</div>
                  </div>
                </div>

                {/* 影响的快照 */}
                <div className="space-y-2">
                  <Label>受影响的毛利快照</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedReversal.affectedSnapshots.map((snapshot) => (
                      <Badge key={snapshot} variant="outline" className="cursor-pointer hover:bg-muted">
                        {snapshot}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 错误信息 */}
                {selectedReversal.status === "FAILED" && (selectedReversal as typeof selectedReversal & { errorMsg?: string }).errorMsg && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">处理失败</span>
                    </div>
                    <p className="text-sm text-red-700">{(selectedReversal as typeof selectedReversal & { errorMsg?: string }).errorMsg}</p>
                    <Button size="sm" variant="outline" className="mt-3 bg-transparent" onClick={() => handleRetry(selectedReversal.id)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      重试
                    </Button>
                  </div>
                )}

                {/* 人工复核 */}
                {selectedReversal.status === "MANUAL_REVIEW" && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <span className="font-medium text-yellow-800">需要人工复核</span>
                    </div>
                    <p className="text-sm text-yellow-700 mb-3">
                      {(selectedReversal as typeof selectedReversal & { reviewReason?: string }).reviewReason || "请确认是否继续执行冲回"}
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>复核备注</Label>
                        <Textarea placeholder="请填写复核意见..." rows={2} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handleManualApprove}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          确认执行
                        </Button>
                        <Button size="sm" variant="outline">
                          <XCircle className="h-4 w-4 mr-2" />
                          驳回
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 处理说明 */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">冲回处理逻辑</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>1. 找到关联的毛利快照（基于订单支付日期）</li>
                    <li>2. 生成负向成本调整记录</li>
                    <li>3. 更新毛利快照版本号</li>
                    <li>4. 若快照已锁定，则需人工确认是否重开</li>
                  </ul>
                </div>

                {/* 时间线 */}
                <div className="space-y-3">
                  <Label>处理时间线</Label>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground w-36">{selectedReversal.createdAt}</div>
                      <div className="flex-1">
                        <div className="font-medium">创建冲回任务</div>
                        <div className="text-sm text-muted-foreground">来源: {selectedReversal.sourceId}</div>
                      </div>
                    </div>
                    {selectedReversal.processedAt && (
                      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground w-36">{selectedReversal.processedAt}</div>
                        <div className="flex-1">
                          <div className="font-medium">
                            {selectedReversal.status === "SUCCESS" ? "处理完成" : "处理结束"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Suspense>
  )
}
