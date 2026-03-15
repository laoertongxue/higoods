"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import {
  Search,
  Download,
  Plus,
  Eye,
  RefreshCw,
  Lock,
  AlertTriangle,
  CheckCircle,
  FileText,
  TrendingUp,
  DollarSign,
  Package,
  Truck,
  CreditCard,
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
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// GM1 毛利核算快照列表页 + GM2 详情页 + GM3 生成/重算抽屉

type SnapshotStatus = "DRAFT" | "GENERATED" | "ADJUSTED" | "LOCKED"

const statusConfig: Record<SnapshotStatus, { label: string; color: string }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  GENERATED: { label: "已生成", color: "bg-blue-100 text-blue-700" },
  ADJUSTED: { label: "已调整", color: "bg-yellow-100 text-yellow-700" },
  LOCKED: { label: "已锁定", color: "bg-green-100 text-green-700" },
}

// Mock 毛利快照数据
const mockSnapshots = [
  {
    id: "GMS-2026-0116",
    snapshotDate: "2026-01-16",
    platform: "TikTok",
    storeName: "TikTok印尼主店",
    effectiveGMV: 125680000,
    userShippingFee: 8500000,
    userTransactionFee: 12568000,
    makeCost: 45000000,
    stockCost: 32000000,
    grossMargin: 27612000,
    grossMarginRate: 21.97,
    currency: "IDR",
    amountUSD: 1840.8,
    status: "GENERATED" as SnapshotStatus,
    versionNo: 1,
    adjustmentCount: 0,
    dataQualityFlags: [],
    generatedAt: "2026-01-17 06:00",
  },
  {
    id: "GMS-2026-0115",
    snapshotDate: "2026-01-15",
    platform: "TikTok",
    storeName: "TikTok印尼主店",
    effectiveGMV: 118500000,
    userShippingFee: 7800000,
    userTransactionFee: 11850000,
    makeCost: 42000000,
    stockCost: 30000000,
    grossMargin: 26850000,
    grossMarginRate: 22.66,
    currency: "IDR",
    amountUSD: 1790.0,
    status: "ADJUSTED" as SnapshotStatus,
    versionNo: 2,
    adjustmentCount: 3,
    dataQualityFlags: ["COST_BACKFILL"],
    generatedAt: "2026-01-16 06:00",
  },
  {
    id: "GMS-2026-0114",
    snapshotDate: "2026-01-14",
    platform: "Shopee",
    storeName: "Shopee印尼店",
    effectiveGMV: 89000000,
    userShippingFee: 5600000,
    userTransactionFee: 8900000,
    makeCost: 28000000,
    stockCost: 25000000,
    grossMargin: 21500000,
    grossMarginRate: 24.16,
    currency: "IDR",
    amountUSD: 1433.3,
    status: "LOCKED" as SnapshotStatus,
    versionNo: 1,
    adjustmentCount: 0,
    dataQualityFlags: [],
    generatedAt: "2026-01-15 06:00",
  },
  {
    id: "GMS-2026-0113",
    snapshotDate: "2026-01-13",
    platform: "TikTok",
    storeName: "TikTok印尼主店",
    effectiveGMV: 135200000,
    userShippingFee: 9200000,
    userTransactionFee: 13520000,
    makeCost: 48000000,
    stockCost: 35000000,
    grossMargin: 29480000,
    grossMarginRate: 21.81,
    currency: "IDR",
    amountUSD: 1965.3,
    status: "GENERATED" as SnapshotStatus,
    versionNo: 1,
    adjustmentCount: 0,
    dataQualityFlags: ["COST_MISSING", "FEE_MISSING"],
    generatedAt: "2026-01-14 06:00",
  },
]

// Mock 调整记录
const mockAdjustments = [
  { id: "ADJ-001", type: "COST_BACKFILL", amountDelta: 1200000, reason: "实际成本回写", source: "CV-2026-003", operator: "系统", time: "2026-01-16 10:30" },
  { id: "ADJ-002", type: "REFUND_ADJ", amountDelta: -500000, reason: "跨日退款调整", source: "RFD-2026-0115-001", operator: "系统", time: "2026-01-16 08:00" },
  { id: "ADJ-003", type: "FEE_ADJ", amountDelta: -80000, reason: "平台费用补录", source: "PS-2026-001", operator: "张三", time: "2026-01-16 09:15" },
]

// Mock 订单明细
const mockOrderLines = [
  { orderId: "ORD-2026-0116-001", sku: "SKU-001", skuName: "连衣裙-红色-S", amount: 450000, fee: 45000, cost: 180000, margin: 225000, costType: "ACTUAL", hasIssue: false },
  { orderId: "ORD-2026-0116-002", sku: "SKU-002", skuName: "T恤-白色-M", amount: 120000, fee: 12000, cost: 48000, margin: 60000, costType: "STANDARD", hasIssue: false },
  { orderId: "ORD-2026-0116-003", sku: "SKU-003", skuName: "牛仔裤-蓝色-L", amount: 380000, fee: 38000, cost: 0, margin: 342000, costType: "MISSING", hasIssue: true },
  { orderId: "ORD-2026-0116-004", sku: "SKU-004", skuName: "外套-黑色-M", amount: 680000, fee: 68000, cost: 272000, margin: 340000, costType: "ESTIMATE", hasIssue: false },
]

export default function GrossMarginPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPlatform, setFilterPlatform] = useState("all")
  const [filterQuality, setFilterQuality] = useState("all")
  const [selectedSnapshot, setSelectedSnapshot] = useState<(typeof mockSnapshots)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const searchParams = useSearchParams()

  // KPI统计
  const totalGrossMarginUSD = mockSnapshots.reduce((sum, s) => sum + s.amountUSD, 0)
  const avgMarginRate = mockSnapshots.reduce((sum, s) => sum + s.grossMarginRate, 0) / mockSnapshots.length
  const issueCount = mockSnapshots.filter((s) => s.dataQualityFlags.length > 0).length
  const adjustedCount = mockSnapshots.filter((s) => s.adjustmentCount > 0).length

  // 筛选
  const filteredSnapshots = mockSnapshots.filter((s) => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false
    if (filterPlatform !== "all" && s.platform !== filterPlatform) return false
    if (filterQuality === "issue" && s.dataQualityFlags.length === 0) return false
    if (filterQuality === "clean" && s.dataQualityFlags.length > 0) return false
    if (searchKeyword && !s.id.toLowerCase().includes(searchKeyword.toLowerCase()) && 
        !s.storeName.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (snapshot: typeof mockSnapshots[0]) => {
    setSelectedSnapshot(snapshot)
    setDetailOpen(true)
    setActiveTab("overview")
  }

  const handleLock = (snapshotId: string) => {
    toast.success(`快照 ${snapshotId} 已锁定`)
  }

  const handleRecalc = () => {
    toast.success("重算任务已创建")
    setCreateOpen(false)
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "IDR") {
      return `IDR ${(amount / 1000000).toFixed(1)}M`
    }
    return `$${amount.toLocaleString()}`
  }

  return (
    <Suspense fallback={<Loading />}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">毛利核算快照</h1>
          <p className="text-muted-foreground">每日毛利出数总览，支持下钻与补算（管理口径 USD）</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            生成/重算快照
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">累计毛利 (USD)</span>
            </div>
            <div className="text-2xl font-bold text-green-700">${totalGrossMarginUSD.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">平均毛利率</span>
            </div>
            <div className="text-2xl font-bold">{avgMarginRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className={issueCount > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-4 w-4 ${issueCount > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              <span className={`text-sm ${issueCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>数据质量问题</span>
            </div>
            <div className={`text-2xl font-bold ${issueCount > 0 ? "text-red-700" : ""}`}>{issueCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-muted-foreground">已调整快照</span>
            </div>
            <div className="text-2xl font-bold">{adjustedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">日期范围:</Label>
              <Input type="date" className="w-[140px]" defaultValue="2026-01-01" />
              <span>~</span>
              <Input type="date" className="w-[140px]" defaultValue="2026-01-16" />
            </div>
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="平台" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部平台</SelectItem>
                <SelectItem value="TikTok">TikTok</SelectItem>
                <SelectItem value="Shopee">Shopee</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="GENERATED">已生成</SelectItem>
                <SelectItem value="ADJUSTED">已调整</SelectItem>
                <SelectItem value="LOCKED">已锁定</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterQuality} onValueChange={setFilterQuality}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="数据质量" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="issue">有问题</SelectItem>
                <SelectItem value="clean">无问题</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索快照号/店铺..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>日期</TableHead>
                <TableHead>平台/店铺</TableHead>
                <TableHead className="text-right">有效GMV (USD)</TableHead>
                <TableHead className="text-right">用户运费</TableHead>
                <TableHead className="text-right">用户交易费</TableHead>
                <TableHead className="text-right">做货成本</TableHead>
                <TableHead className="text-right">现货成本</TableHead>
                <TableHead className="text-right">毛利 (USD)</TableHead>
                <TableHead className="text-right">毛利率</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>数据质量</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSnapshots.map((snapshot) => (
                <TableRow key={snapshot.id} className={snapshot.dataQualityFlags.length > 0 ? "bg-red-50/30" : ""}>
                  <TableCell className="font-medium">{snapshot.snapshotDate}</TableCell>
                  <TableCell>
                    <div className="text-sm">{snapshot.platform}</div>
                    <div className="text-xs text-muted-foreground">{snapshot.storeName}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono">${(snapshot.effectiveGMV / 15000).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">${(snapshot.userShippingFee / 15000).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">${(snapshot.userTransactionFee / 15000).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono text-orange-600">${(snapshot.makeCost / 15000).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono text-orange-600">${(snapshot.stockCost / 15000).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-green-600">${snapshot.amountUSD.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{snapshot.grossMarginRate.toFixed(1)}%</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge className={statusConfig[snapshot.status].color}>
                        {statusConfig[snapshot.status].label}
                      </Badge>
                      {snapshot.adjustmentCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{snapshot.adjustmentCount}调整
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {snapshot.dataQualityFlags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {snapshot.dataQualityFlags.map((flag) => (
                          <Badge key={flag} variant="destructive" className="text-xs">
                            {flag === "COST_MISSING" ? "缺成本" : flag === "FEE_MISSING" ? "缺费用" : flag === "COST_BACKFILL" ? "已回写" : flag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(snapshot)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {snapshot.status !== "LOCKED" && (
                        <Button variant="ghost" size="sm" onClick={() => handleLock(snapshot.id)}>
                          <Lock className="h-4 w-4" />
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

      {/* GM2 毛利快照详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedSnapshot?.snapshotDate} - {selectedSnapshot?.storeName}
              {selectedSnapshot && (
                <Badge className={statusConfig[selectedSnapshot.status].color}>
                  {statusConfig[selectedSnapshot.status].label}
                </Badge>
              )}
              {selectedSnapshot && selectedSnapshot.versionNo > 1 && (
                <Badge variant="outline">v{selectedSnapshot.versionNo}</Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              {selectedSnapshot?.platform} | 生成于 {selectedSnapshot?.generatedAt}
            </SheetDescription>
          </SheetHeader>

          {selectedSnapshot && (
            <div className="mt-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <div className="text-sm text-blue-600 mb-1">有效GMV</div>
                  <div className="text-xl font-bold text-blue-700">{formatCurrency(selectedSnapshot.effectiveGMV, selectedSnapshot.currency)}</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg text-center">
                  <div className="text-sm text-orange-600 mb-1">总成本</div>
                  <div className="text-xl font-bold text-orange-700">{formatCurrency(selectedSnapshot.makeCost + selectedSnapshot.stockCost, selectedSnapshot.currency)}</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <div className="text-sm text-green-600 mb-1">毛利 (USD)</div>
                  <div className="text-xl font-bold text-green-700">${selectedSnapshot.amountUSD.toLocaleString()}</div>
                  <div className="text-xs text-green-600">{selectedSnapshot.grossMarginRate.toFixed(1)}%</div>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="overview">概览与口径</TabsTrigger>
                  <TabsTrigger value="dimension">维度拆解</TabsTrigger>
                  <TabsTrigger value="orders">订单明细</TabsTrigger>
                  <TabsTrigger value="adjustments">调整记录</TabsTrigger>
                  <TabsTrigger value="quality">数据质量</TabsTrigger>
                  <TabsTrigger value="logs">日志</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {/* 口径说明 */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-3">毛利计算口径（管理口径）</h4>
                    <div className="text-sm space-y-2">
                      <p><strong>毛利</strong> = 有效GMV - 用户支付运费 - 用户支付交易费 - 做货成本 - 现货成本</p>
                      <Separator className="my-2" />
                      <p><strong>有效GMV判定：</strong>已支付且未全额退款的订单行金额</p>
                      <p><strong>成本取值优先级：</strong>ACTUAL &gt; ESTIMATE &gt; STANDARD</p>
                      <p><strong>汇率策略：</strong>使用快照日汇率，缺失则降级使用最近可用汇率</p>
                    </div>
                  </div>

                  {/* 关键异常摘要 */}
                  {selectedSnapshot.dataQualityFlags.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="font-medium text-red-800 mb-2">关键异常摘要</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-red-600">缺成本金额 (USD):</span>
                          <span className="font-mono ml-2">$1,250</span>
                        </div>
                        <div>
                          <span className="text-red-600">待冲回金额 (USD):</span>
                          <span className="font-mono ml-2">$0</span>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="dimension" className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Label>维度选择:</Label>
                    <Select defaultValue="sku">
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform">平台</SelectItem>
                        <SelectItem value="store">店铺</SelectItem>
                        <SelectItem value="spu">SPU</SelectItem>
                        <SelectItem value="sku">SKU</SelectItem>
                        <SelectItem value="category">类目</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      导出
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">GMV</TableHead>
                        <TableHead className="text-right">费用</TableHead>
                        <TableHead className="text-right">成本</TableHead>
                        <TableHead className="text-right">毛利</TableHead>
                        <TableHead className="text-right">毛利率</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockOrderLines.slice(0, 4).map((line) => (
                        <TableRow key={line.orderId}>
                          <TableCell>
                            <div className="font-medium">{line.sku}</div>
                            <div className="text-xs text-muted-foreground">{line.skuName}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(line.amount, "IDR")}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(line.fee, "IDR")}</TableCell>
                          <TableCell className="text-right font-mono text-orange-600">{formatCurrency(line.cost, "IDR")}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(line.margin, "IDR")}</TableCell>
                          <TableCell className="text-right font-mono">{((line.margin / line.amount) * 100).toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="orders" className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Select defaultValue="all">
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="成本类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="ACTUAL">实际成本</SelectItem>
                        <SelectItem value="ESTIMATE">暂估成本</SelectItem>
                        <SelectItem value="STANDARD">标准成本</SelectItem>
                        <SelectItem value="MISSING">缺成本</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Checkbox id="show-issue" />
                      <Label htmlFor="show-issue" className="text-sm">仅显示有问题</Label>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>订单号</TableHead>
                        <TableHead>商品</TableHead>
                        <TableHead className="text-right">金额</TableHead>
                        <TableHead className="text-right">费用</TableHead>
                        <TableHead className="text-right">成本</TableHead>
                        <TableHead className="text-right">毛利</TableHead>
                        <TableHead>成本类型</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockOrderLines.map((line) => (
                        <TableRow key={line.orderId} className={line.hasIssue ? "bg-red-50/50" : ""}>
                          <TableCell className="font-mono text-sm">{line.orderId}</TableCell>
                          <TableCell>
                            <div className="text-sm">{line.sku}</div>
                            <div className="text-xs text-muted-foreground">{line.skuName}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(line.amount, "IDR")}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(line.fee, "IDR")}</TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            {line.cost > 0 ? formatCurrency(line.cost, "IDR") : <span className="text-red-600">缺失</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(line.margin, "IDR")}</TableCell>
                          <TableCell>
                            <Badge variant={line.costType === "MISSING" ? "destructive" : "outline"} className="text-xs">
                              {line.costType === "ACTUAL" ? "实际" : line.costType === "ESTIMATE" ? "暂估" : line.costType === "STANDARD" ? "标准" : "缺失"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="adjustments" className="space-y-4">
                  {selectedSnapshot.adjustmentCount > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>调整类型</TableHead>
                          <TableHead className="text-right">影响金额</TableHead>
                          <TableHead>原因</TableHead>
                          <TableHead>来源引用</TableHead>
                          <TableHead>操作者</TableHead>
                          <TableHead>时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockAdjustments.map((adj) => (
                          <TableRow key={adj.id}>
                            <TableCell>
                              <Badge variant="outline">
                                {adj.type === "COST_BACKFILL" ? "成本回写" : adj.type === "REFUND_ADJ" ? "退款调整" : "费用调整"}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-mono ${adj.amountDelta > 0 ? "text-green-600" : "text-red-600"}`}>
                              {adj.amountDelta > 0 ? "+" : ""}{formatCurrency(adj.amountDelta, "IDR")}
                            </TableCell>
                            <TableCell className="text-sm">{adj.reason}</TableCell>
                            <TableCell>
                              <Button variant="link" className="p-0 h-auto text-blue-600 text-sm">
                                {adj.source}
                              </Button>
                            </TableCell>
                            <TableCell className="text-sm">{adj.operator}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{adj.time}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">暂无调整记录</p>
                  )}
                </TabsContent>

                <TabsContent value="quality" className="space-y-4">
                  {selectedSnapshot.dataQualityFlags.length > 0 ? (
                    <div className="space-y-4">
                      {selectedSnapshot.dataQualityFlags.includes("COST_MISSING") && (
                        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            <span className="font-medium text-red-800">成本缺失 (COST_MISSING)</span>
                          </div>
                          <div className="text-sm text-red-700 mb-2">影响金额: $1,250 USD | 影响订单行: 3</div>
                          <Button size="sm" variant="outline">
                            创建工单
                          </Button>
                        </div>
                      )}
                      {selectedSnapshot.dataQualityFlags.includes("FEE_MISSING") && (
                        <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                            <span className="font-medium text-yellow-800">费用缺失 (FEE_MISSING)</span>
                          </div>
                          <div className="text-sm text-yellow-700 mb-2">影响金额: $320 USD | 影响订单行: 5</div>
                          <Button size="sm" variant="outline">
                            创建工单
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                      <p className="text-muted-foreground">数据质量良好，无问题</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="logs" className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { time: "2026-01-17 06:00", action: "快照生成", user: "系统", detail: "每日定时任务自动生成" },
                      { time: "2026-01-16 10:30", action: "成本回写", user: "系统", detail: "实际成本版本 CV-2026-003 回写" },
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

      {/* GM3 生成/重算毛利抽屉 */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>生成/重算毛利快照</SheetTitle>
            <SheetDescription>控制出数过程，明确影响范围与版本策略</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>目标日期开始 *</Label>
                <Input type="date" defaultValue="2026-01-16" />
              </div>
              <div className="space-y-2">
                <Label>目标日期结束</Label>
                <Input type="date" defaultValue="2026-01-16" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>范围 *</Label>
              <Select defaultValue="store">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">店铺维度</SelectItem>
                  <SelectItem value="legal_entity">法人维度</SelectItem>
                  <SelectItem value="group">集团汇总</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>店铺（可选）</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="全部店铺" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部店铺</SelectItem>
                  <SelectItem value="STORE-TT-001">TikTok印尼主店</SelectItem>
                  <SelectItem value="STORE-SP-001">Shopee印尼店</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>版本策略 *</Label>
              <Select defaultValue="adjustment">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">生成首次快照（仅无快照日可选）</SelectItem>
                  <SelectItem value="adjustment">生成调整（推荐：不覆盖历史）</SelectItem>
                  <SelectItem value="new_version">生成新版本快照（需关联工单）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>数据源选择</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="ds-order" defaultChecked />
                  <Label htmlFor="ds-order" className="text-sm">订单数据</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ds-fee" defaultChecked />
                  <Label htmlFor="ds-fee" className="text-sm">平台费用</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ds-cost" defaultChecked />
                  <Label htmlFor="ds-cost" className="text-sm">成本版本</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ds-fx" defaultChecked />
                  <Label htmlFor="ds-fx" className="text-sm">汇率</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>备注（重算必填）</Label>
              <Textarea placeholder="说明重算原因..." rows={2} />
            </div>

            <div className="space-y-2">
              <Label>关联工单（新版本必填）</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择关联工单" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WO-2026-001">WO-2026-001 - 成本补录</SelectItem>
                  <SelectItem value="WO-2026-002">WO-2026-002 - 费用调整</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 执行结果预览 */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium text-sm">执行结果预览（确认前）</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">受影响订单行数</span>
                  <p className="font-mono font-medium">1,256</p>
                </div>
                <div>
                  <span className="text-muted-foreground">新增调整条数</span>
                  <p className="font-mono font-medium">3</p>
                </div>
                <div>
                  <span className="text-muted-foreground">毛利变动 (USD)</span>
                  <p className="font-mono font-medium text-green-600">+$1,250</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button variant="outline" className="flex-1 bg-transparent">
                预览
              </Button>
              <Button className="flex-1" onClick={handleRecalc}>
                确认执行
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  </Suspense>
)
}
