"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import {
  Search,
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Package,
  Truck,
  DollarSign,
  ChevronRight,
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
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// PSB1 预售批次监控列表页 + PSB2 预售批次详情页

type BatchStatus = "PENDING_PROD" | "IN_PRODUCTION" | "SHIPPED" | "PARTIALLY_RECEIVED" | "COMPLETED" | "CANCELLED"
type CostStatus = "ESTIMATE" | "PARTIAL_ACTUAL" | "FULL_ACTUAL"

const batchStatusConfig: Record<BatchStatus, { label: string; color: string }> = {
  PENDING_PROD: { label: "待生产", color: "bg-gray-100 text-gray-700" },
  IN_PRODUCTION: { label: "生产中", color: "bg-blue-100 text-blue-700" },
  SHIPPED: { label: "已发货", color: "bg-purple-100 text-purple-700" },
  PARTIALLY_RECEIVED: { label: "部分到货", color: "bg-yellow-100 text-yellow-700" },
  COMPLETED: { label: "已完成", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "已取消", color: "bg-red-100 text-red-700" },
}

const costStatusConfig: Record<CostStatus, { label: string; color: string }> = {
  ESTIMATE: { label: "暂估成本", color: "bg-yellow-100 text-yellow-700" },
  PARTIAL_ACTUAL: { label: "部分实际", color: "bg-blue-100 text-blue-700" },
  FULL_ACTUAL: { label: "全实际成本", color: "bg-green-100 text-green-700" },
}

// Mock 预售批次数据
const mockPresaleBatches = [
  {
    id: "PSB-2026-001",
    batchName: "春季新款连衣裙批次",
    spuCount: 5,
    skuCount: 25,
    orderCount: 156,
    orderLineCount: 312,
    totalQty: 1560,
    estimateCostUSD: 45680,
    actualCostUSD: 0,
    costStatus: "ESTIMATE" as CostStatus,
    batchStatus: "IN_PRODUCTION" as BatchStatus,
    factoryName: "东莞制衣厂A",
    expectedDelivery: "2026-02-15",
    createdAt: "2026-01-10",
    progress: 35,
  },
  {
    id: "PSB-2026-002",
    batchName: "冬季外套清仓批次",
    spuCount: 3,
    skuCount: 12,
    orderCount: 89,
    orderLineCount: 145,
    totalQty: 890,
    estimateCostUSD: 28900,
    actualCostUSD: 15600,
    costStatus: "PARTIAL_ACTUAL" as CostStatus,
    batchStatus: "PARTIALLY_RECEIVED" as BatchStatus,
    factoryName: "广州制衣厂B",
    expectedDelivery: "2026-01-20",
    createdAt: "2025-12-25",
    progress: 68,
  },
  {
    id: "PSB-2026-003",
    batchName: "基础款T恤补货",
    spuCount: 2,
    skuCount: 8,
    orderCount: 234,
    orderLineCount: 456,
    totalQty: 2340,
    estimateCostUSD: 18720,
    actualCostUSD: 18450,
    costStatus: "FULL_ACTUAL" as CostStatus,
    batchStatus: "COMPLETED" as BatchStatus,
    factoryName: "东莞制衣厂A",
    expectedDelivery: "2026-01-05",
    createdAt: "2025-12-15",
    progress: 100,
  },
  {
    id: "PSB-2026-004",
    batchName: "情人节限定款",
    spuCount: 4,
    skuCount: 16,
    orderCount: 45,
    orderLineCount: 78,
    totalQty: 450,
    estimateCostUSD: 12500,
    actualCostUSD: 0,
    costStatus: "ESTIMATE" as CostStatus,
    batchStatus: "CANCELLED" as BatchStatus,
    factoryName: "深圳制衣厂C",
    expectedDelivery: "2026-02-01",
    createdAt: "2026-01-05",
    progress: 0,
    cancelReason: "供应商产能不足",
  },
]

// Mock 批次内订单行
const mockBatchOrderLines = [
  { orderId: "ORD-2026-001", sku: "SKU-DRESS-001", skuName: "连衣裙-红色-S", qty: 10, estimateCost: 450, actualCost: 0, status: "PENDING_PROD" },
  { orderId: "ORD-2026-002", sku: "SKU-DRESS-002", skuName: "连衣裙-红色-M", qty: 15, estimateCost: 675, actualCost: 0, status: "PENDING_PROD" },
  { orderId: "ORD-2026-003", sku: "SKU-DRESS-003", skuName: "连衣裙-蓝色-S", qty: 8, estimateCost: 360, actualCost: 0, status: "PENDING_PROD" },
  { orderId: "ORD-2026-004", sku: "SKU-DRESS-004", skuName: "连衣裙-蓝色-M", qty: 12, estimateCost: 540, actualCost: 0, status: "PENDING_PROD" },
]

export default function PresaleBatchPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterBatchStatus, setFilterBatchStatus] = useState("all")
  const [filterCostStatus, setFilterCostStatus] = useState("all")
  const [selectedBatch, setSelectedBatch] = useState<(typeof mockPresaleBatches)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  const searchParams = useSearchParams()

  // KPI统计
  const stats = {
    totalBatches: mockPresaleBatches.length,
    inProduction: mockPresaleBatches.filter((b) => b.batchStatus === "IN_PRODUCTION").length,
    pendingActualCost: mockPresaleBatches.filter((b) => b.costStatus === "ESTIMATE").length,
    totalEstimateUSD: mockPresaleBatches.reduce((sum, b) => sum + b.estimateCostUSD, 0),
    totalActualUSD: mockPresaleBatches.reduce((sum, b) => sum + b.actualCostUSD, 0),
    cancelledCount: mockPresaleBatches.filter((b) => b.batchStatus === "CANCELLED").length,
  }

  // 筛选
  const filteredBatches = mockPresaleBatches.filter((b) => {
    if (filterBatchStatus !== "all" && b.batchStatus !== filterBatchStatus) return false
    if (filterCostStatus !== "all" && b.costStatus !== filterCostStatus) return false
    if (searchKeyword && !b.id.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !b.batchName.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (batch: typeof mockPresaleBatches[0]) => {
    setSelectedBatch(batch)
    setDetailOpen(true)
    setActiveTab("overview")
  }

  const handleTriggerActualCost = () => {
    toast.success("实际成本同步任务已创建")
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">预售批次监控</h1>
            <p className="text-muted-foreground">监控预售批次生产进度与成本状态，支持暂估-实际成本切换</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button variant="outline" size="sm" onClick={handleTriggerActualCost}>
              <RefreshCw className="h-4 w-4 mr-2" />
              同步实际成本
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">批次总数</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalBatches}</div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-600">生产中</span>
              </div>
              <div className="text-2xl font-bold text-blue-700">{stats.inProduction}</div>
            </CardContent>
          </Card>
          <Card className={stats.pendingActualCost > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`h-4 w-4 ${stats.pendingActualCost > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
                <span className={`text-sm ${stats.pendingActualCost > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>待实际成本</span>
              </div>
              <div className={`text-2xl font-bold ${stats.pendingActualCost > 0 ? "text-yellow-700" : ""}`}>
                {stats.pendingActualCost}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">暂估成本 (USD)</span>
              </div>
              <div className="text-2xl font-bold">${stats.totalEstimateUSD.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">实际成本 (USD)</span>
              </div>
              <div className="text-2xl font-bold text-green-700">${stats.totalActualUSD.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className={stats.cancelledCount > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className={`h-4 w-4 ${stats.cancelledCount > 0 ? "text-red-600" : "text-muted-foreground"}`} />
                <span className={`text-sm ${stats.cancelledCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>已取消</span>
              </div>
              <div className={`text-2xl font-bold ${stats.cancelledCount > 0 ? "text-red-700" : ""}`}>
                {stats.cancelledCount}
              </div>
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
                  placeholder="搜索批次号/批次名称..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterBatchStatus} onValueChange={setFilterBatchStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="批次状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="PENDING_PROD">待生产</SelectItem>
                  <SelectItem value="IN_PRODUCTION">生产中</SelectItem>
                  <SelectItem value="SHIPPED">已发货</SelectItem>
                  <SelectItem value="PARTIALLY_RECEIVED">部分到货</SelectItem>
                  <SelectItem value="COMPLETED">已完成</SelectItem>
                  <SelectItem value="CANCELLED">已取消</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCostStatus} onValueChange={setFilterCostStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="成本状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="ESTIMATE">暂估成本</SelectItem>
                  <SelectItem value="PARTIAL_ACTUAL">部分实际</SelectItem>
                  <SelectItem value="FULL_ACTUAL">全实际成本</SelectItem>
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
                  <TableHead>批次号</TableHead>
                  <TableHead>批次名称</TableHead>
                  <TableHead className="text-right">SPU/SKU</TableHead>
                  <TableHead className="text-right">订单数</TableHead>
                  <TableHead className="text-right">总数量</TableHead>
                  <TableHead className="text-right">暂估成本 (USD)</TableHead>
                  <TableHead className="text-right">实际成本 (USD)</TableHead>
                  <TableHead>成本状态</TableHead>
                  <TableHead>批次状态</TableHead>
                  <TableHead>进度</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => (
                  <TableRow key={batch.id} className={batch.batchStatus === "CANCELLED" ? "opacity-60" : ""}>
                    <TableCell className="font-mono text-sm">{batch.id}</TableCell>
                    <TableCell>
                      <div className="font-medium">{batch.batchName}</div>
                      <div className="text-xs text-muted-foreground">{batch.factoryName}</div>
                    </TableCell>
                    <TableCell className="text-right">{batch.spuCount}/{batch.skuCount}</TableCell>
                    <TableCell className="text-right">{batch.orderCount}</TableCell>
                    <TableCell className="text-right font-mono">{batch.totalQty.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-orange-600">${batch.estimateCostUSD.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {batch.actualCostUSD > 0 ? `$${batch.actualCostUSD.toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={costStatusConfig[batch.costStatus].color}>
                        {costStatusConfig[batch.costStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={batchStatusConfig[batch.batchStatus].color}>
                        {batchStatusConfig[batch.batchStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="w-20">
                        <Progress value={batch.progress} className="h-2" />
                        <span className="text-xs text-muted-foreground">{batch.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(batch)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* PSB2 预售批次详情抽屉 */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {selectedBatch?.batchName}
                {selectedBatch && (
                  <>
                    <Badge className={batchStatusConfig[selectedBatch.batchStatus].color}>
                      {batchStatusConfig[selectedBatch.batchStatus].label}
                    </Badge>
                    <Badge className={costStatusConfig[selectedBatch.costStatus].color}>
                      {costStatusConfig[selectedBatch.costStatus].label}
                    </Badge>
                  </>
                )}
              </SheetTitle>
              <SheetDescription>
                {selectedBatch?.id} | 工厂: {selectedBatch?.factoryName} | 预计交付: {selectedBatch?.expectedDelivery}
              </SheetDescription>
            </SheetHeader>

            {selectedBatch && (
              <div className="mt-6">
                {/* Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">生产进度</span>
                    <span className="text-sm font-bold">{selectedBatch.progress}%</span>
                  </div>
                  <Progress value={selectedBatch.progress} className="h-3" />
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-orange-50 rounded-lg text-center">
                    <div className="text-sm text-orange-600 mb-1">暂估成本</div>
                    <div className="text-xl font-bold text-orange-700">${selectedBatch.estimateCostUSD.toLocaleString()}</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <div className="text-sm text-green-600 mb-1">实际成本</div>
                    <div className="text-xl font-bold text-green-700">
                      {selectedBatch.actualCostUSD > 0 ? `$${selectedBatch.actualCostUSD.toLocaleString()}` : "-"}
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <div className="text-sm text-blue-600 mb-1">差异</div>
                    <div className="text-xl font-bold text-blue-700">
                      {selectedBatch.actualCostUSD > 0 
                        ? `$${Math.abs(selectedBatch.actualCostUSD - selectedBatch.estimateCostUSD).toLocaleString()}`
                        : "-"
                      }
                    </div>
                  </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="overview">概览</TabsTrigger>
                    <TabsTrigger value="orders">订单明细</TabsTrigger>
                    <TabsTrigger value="cost">成本明细</TabsTrigger>
                    <TabsTrigger value="timeline">时间线</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">SPU 数量</div>
                        <div className="font-medium mt-1">{selectedBatch.spuCount}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">SKU 数量</div>
                        <div className="font-medium mt-1">{selectedBatch.skuCount}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">订单数</div>
                        <div className="font-medium mt-1">{selectedBatch.orderCount}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">总数量</div>
                        <div className="font-medium mt-1">{selectedBatch.totalQty.toLocaleString()}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">创建时间</div>
                        <div className="font-medium mt-1">{selectedBatch.createdAt}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">预计交付</div>
                        <div className="font-medium mt-1">{selectedBatch.expectedDelivery}</div>
                      </div>
                    </div>

                    {selectedBatch.batchStatus === "CANCELLED" && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span className="font-medium text-red-800">批次已取消</span>
                        </div>
                        <p className="text-sm text-red-700">取消原因: {(selectedBatch as typeof selectedBatch & { cancelReason?: string }).cancelReason || "未说明"}</p>
                      </div>
                    )}

                    {selectedBatch.costStatus === "ESTIMATE" && selectedBatch.batchStatus !== "CANCELLED" && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          <span className="font-medium text-yellow-800">暂估成本待更新</span>
                        </div>
                        <p className="text-sm text-yellow-700">工厂结算后，实际成本将自动同步并触发成本回写</p>
                        <Button size="sm" variant="outline" className="mt-2 bg-transparent" onClick={handleTriggerActualCost}>
                          手动同步实际成本
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="orders" className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>订单号</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>商品名称</TableHead>
                          <TableHead className="text-right">数量</TableHead>
                          <TableHead className="text-right">暂估成本</TableHead>
                          <TableHead className="text-right">实际成本</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockBatchOrderLines.map((line) => (
                          <TableRow key={line.orderId + line.sku}>
                            <TableCell className="font-mono text-sm">{line.orderId}</TableCell>
                            <TableCell className="font-mono text-sm">{line.sku}</TableCell>
                            <TableCell>{line.skuName}</TableCell>
                            <TableCell className="text-right">{line.qty}</TableCell>
                            <TableCell className="text-right font-mono text-orange-600">${line.estimateCost}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                              {line.actualCost > 0 ? `$${line.actualCost}` : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge className={batchStatusConfig[line.status as BatchStatus]?.color || "bg-gray-100"}>
                                {batchStatusConfig[line.status as BatchStatus]?.label || line.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="cost" className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-3">成本计算规则</h4>
                      <div className="text-sm space-y-2">
                        <p><strong>暂估成本:</strong> 基于商品标准成本 + 预售加成比例（默认10%）</p>
                        <p><strong>实际成本:</strong> 工厂结算后由ERP系统同步</p>
                        <p><strong>成本回写:</strong> 实际成本确认后自动触发毛利快照回写</p>
                      </div>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>成本项</TableHead>
                          <TableHead className="text-right">暂估金额</TableHead>
                          <TableHead className="text-right">实际金额</TableHead>
                          <TableHead className="text-right">差异</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>面料成本</TableCell>
                          <TableCell className="text-right font-mono">${(selectedBatch.estimateCostUSD * 0.55).toFixed(0)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {selectedBatch.actualCostUSD > 0 ? `$${(selectedBatch.actualCostUSD * 0.54).toFixed(0)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {selectedBatch.actualCostUSD > 0 ? `-$${Math.abs((selectedBatch.estimateCostUSD * 0.55) - (selectedBatch.actualCostUSD * 0.54)).toFixed(0)}` : "-"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>人工成本</TableCell>
                          <TableCell className="text-right font-mono">${(selectedBatch.estimateCostUSD * 0.30).toFixed(0)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {selectedBatch.actualCostUSD > 0 ? `$${(selectedBatch.actualCostUSD * 0.31).toFixed(0)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {selectedBatch.actualCostUSD > 0 ? `+$${Math.abs((selectedBatch.estimateCostUSD * 0.30) - (selectedBatch.actualCostUSD * 0.31)).toFixed(0)}` : "-"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>制造费用</TableCell>
                          <TableCell className="text-right font-mono">${(selectedBatch.estimateCostUSD * 0.15).toFixed(0)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {selectedBatch.actualCostUSD > 0 ? `$${(selectedBatch.actualCostUSD * 0.15).toFixed(0)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {selectedBatch.actualCostUSD > 0 ? "$0" : "-"}
                          </TableCell>
                        </TableRow>
                        <TableRow className="font-bold">
                          <TableCell>合计</TableCell>
                          <TableCell className="text-right font-mono">${selectedBatch.estimateCostUSD.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">
                            {selectedBatch.actualCostUSD > 0 ? `$${selectedBatch.actualCostUSD.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {selectedBatch.actualCostUSD > 0 
                              ? (selectedBatch.actualCostUSD < selectedBatch.estimateCostUSD 
                                ? <span className="text-green-600">-${(selectedBatch.estimateCostUSD - selectedBatch.actualCostUSD).toLocaleString()}</span>
                                : <span className="text-red-600">+${(selectedBatch.estimateCostUSD - selectedBatch.actualCostUSD).toLocaleString()}</span>
                              )
                              : "-"
                            }
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="timeline" className="space-y-4">
                    <div className="space-y-3">
                      {[
                        { time: "2026-01-10 10:00", action: "批次创建", detail: "预售订单汇总生成批次" },
                        { time: "2026-01-12 14:00", action: "开始生产", detail: "工厂确认接单，开始生产" },
                        { time: "2026-01-15 09:00", action: "生产进度更新", detail: "完成35%，预计按时交付" },
                      ].map((log, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="text-sm text-muted-foreground w-36">{log.time}</div>
                          <div className="flex-1">
                            <div className="font-medium">{log.action}</div>
                            <div className="text-sm text-muted-foreground">{log.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Suspense>
  )
}
