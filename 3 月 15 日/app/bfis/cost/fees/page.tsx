"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  Search,
  Download,
  Plus,
  Eye,
  Settings,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileText,
  DollarSign,
  Percent,
  Building,
  Store,
  ChevronRight,
  Edit,
  Trash2,
  Copy,
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
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import Loading from "./loading"

// FE1 费用归集台账列表页 + FE2 详情页 + FE3 规则配置抽屉

type FeeType = "PLATFORM_FEE" | "SHIPPING_FEE" | "MARKETING_FEE" | "WAREHOUSE_FEE" | "OTHER_FEE"
type AllocationMethod = "GMV_RATIO" | "ORDER_COUNT" | "SKU_COUNT" | "FIXED_AMOUNT" | "MANUAL"
type FeeStatus = "PENDING" | "ALLOCATED" | "CONFIRMED" | "REVERSED"

const feeTypeConfig: Record<FeeType, { label: string; color: string }> = {
  PLATFORM_FEE: { label: "平台费用", color: "bg-blue-100 text-blue-700" },
  SHIPPING_FEE: { label: "物流费用", color: "bg-purple-100 text-purple-700" },
  MARKETING_FEE: { label: "营销费用", color: "bg-orange-100 text-orange-700" },
  WAREHOUSE_FEE: { label: "仓储费用", color: "bg-green-100 text-green-700" },
  OTHER_FEE: { label: "其他费用", color: "bg-gray-100 text-gray-700" },
}

const allocationMethodConfig: Record<AllocationMethod, { label: string }> = {
  GMV_RATIO: { label: "按GMV比例" },
  ORDER_COUNT: { label: "按订单数" },
  SKU_COUNT: { label: "按SKU数" },
  FIXED_AMOUNT: { label: "固定金额" },
  MANUAL: { label: "人工分配" },
}

const feeStatusConfig: Record<FeeStatus, { label: string; color: string }> = {
  PENDING: { label: "待分摊", color: "bg-yellow-100 text-yellow-700" },
  ALLOCATED: { label: "已分摊", color: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "已确认", color: "bg-green-100 text-green-700" },
  REVERSED: { label: "已冲回", color: "bg-red-100 text-red-700" },
}

// Mock 费用归集数据
const mockFeeRecords = [
  {
    id: "FEE-2026-001",
    feeType: "PLATFORM_FEE" as FeeType,
    feeName: "TikTok平台手续费",
    period: "2026-01",
    platform: "TikTok",
    storeName: "TikTok印尼主店",
    originalAmount: 125680000,
    currency: "IDR",
    amountUSD: 8378.67,
    allocationMethod: "GMV_RATIO" as AllocationMethod,
    allocatedTo: 1256,
    status: "CONFIRMED" as FeeStatus,
    sourceDoc: "TT-INV-2026-001",
    createdAt: "2026-01-15",
    confirmedAt: "2026-01-16",
  },
  {
    id: "FEE-2026-002",
    feeType: "SHIPPING_FEE" as FeeType,
    feeName: "物流配送费-JNE",
    period: "2026-01",
    platform: "TikTok",
    storeName: "TikTok印尼主店",
    originalAmount: 45000000,
    currency: "IDR",
    amountUSD: 3000.00,
    allocationMethod: "ORDER_COUNT" as AllocationMethod,
    allocatedTo: 892,
    status: "ALLOCATED" as FeeStatus,
    sourceDoc: "JNE-INV-2026-001",
    createdAt: "2026-01-14",
    confirmedAt: null,
  },
  {
    id: "FEE-2026-003",
    feeType: "MARKETING_FEE" as FeeType,
    feeName: "直播推广费",
    period: "2026-01",
    platform: "TikTok",
    storeName: "TikTok印尼主店",
    originalAmount: 28000000,
    currency: "IDR",
    amountUSD: 1866.67,
    allocationMethod: "GMV_RATIO" as AllocationMethod,
    allocatedTo: 0,
    status: "PENDING" as FeeStatus,
    sourceDoc: "MKT-2026-001",
    createdAt: "2026-01-16",
    confirmedAt: null,
  },
  {
    id: "FEE-2026-004",
    feeType: "WAREHOUSE_FEE" as FeeType,
    feeName: "仓储服务费",
    period: "2026-01",
    platform: "ALL",
    storeName: "全平台",
    originalAmount: 15000000,
    currency: "IDR",
    amountUSD: 1000.00,
    allocationMethod: "SKU_COUNT" as AllocationMethod,
    allocatedTo: 450,
    status: "CONFIRMED" as FeeStatus,
    sourceDoc: "WH-INV-2026-001",
    createdAt: "2026-01-10",
    confirmedAt: "2026-01-12",
  },
  {
    id: "FEE-2026-005",
    feeType: "PLATFORM_FEE" as FeeType,
    feeName: "Shopee平台手续费",
    period: "2026-01",
    platform: "Shopee",
    storeName: "Shopee印尼店",
    originalAmount: 89000000,
    currency: "IDR",
    amountUSD: 5933.33,
    allocationMethod: "GMV_RATIO" as AllocationMethod,
    allocatedTo: 0,
    status: "PENDING" as FeeStatus,
    sourceDoc: "SP-INV-2026-001",
    createdAt: "2026-01-16",
    confirmedAt: null,
  },
]

// Mock 分摊明细
const mockAllocationDetails = [
  { orderId: "ORD-2026-001", sku: "SKU-001", gmv: 450000, allocatedFee: 450, ratio: 0.36 },
  { orderId: "ORD-2026-002", sku: "SKU-002", gmv: 280000, allocatedFee: 280, ratio: 0.22 },
  { orderId: "ORD-2026-003", sku: "SKU-003", gmv: 320000, allocatedFee: 320, ratio: 0.26 },
  { orderId: "ORD-2026-004", sku: "SKU-004", gmv: 200000, allocatedFee: 200, ratio: 0.16 },
]

// Mock 费用规则
const mockFeeRules = [
  {
    id: "RULE-001",
    ruleName: "TikTok平台费用分摊",
    feeType: "PLATFORM_FEE" as FeeType,
    platform: "TikTok",
    allocationMethod: "GMV_RATIO" as AllocationMethod,
    allocationScope: "STORE",
    priority: 1,
    isActive: true,
    description: "按店铺GMV比例分摊平台手续费",
  },
  {
    id: "RULE-002",
    ruleName: "物流费用分摊",
    feeType: "SHIPPING_FEE" as FeeType,
    platform: "ALL",
    allocationMethod: "ORDER_COUNT" as AllocationMethod,
    allocationScope: "ORDER",
    priority: 2,
    isActive: true,
    description: "按订单数量平均分摊物流费用",
  },
  {
    id: "RULE-003",
    ruleName: "仓储费用分摊",
    feeType: "WAREHOUSE_FEE" as FeeType,
    platform: "ALL",
    allocationMethod: "SKU_COUNT" as AllocationMethod,
    allocationScope: "SKU",
    priority: 3,
    isActive: true,
    description: "按SKU数量分摊仓储费用",
  },
]

export default function FeesPage() {
  const searchParams = useSearchParams()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPlatform, setFilterPlatform] = useState("all")
  const [selectedFee, setSelectedFee] = useState<(typeof mockFeeRecords)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [ruleOpen, setRuleOpen] = useState(false)
  const [createRuleOpen, setCreateRuleOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  // KPI统计
  const stats = {
    totalFees: mockFeeRecords.length,
    pendingCount: mockFeeRecords.filter((f) => f.status === "PENDING").length,
    pendingAmountUSD: mockFeeRecords.filter((f) => f.status === "PENDING").reduce((sum, f) => sum + f.amountUSD, 0),
    allocatedCount: mockFeeRecords.filter((f) => f.status === "ALLOCATED").length,
    confirmedAmountUSD: mockFeeRecords.filter((f) => f.status === "CONFIRMED").reduce((sum, f) => sum + f.amountUSD, 0),
    totalAmountUSD: mockFeeRecords.reduce((sum, f) => sum + f.amountUSD, 0),
  }

  // 筛选
  const filteredFees = mockFeeRecords.filter((f) => {
    if (filterType !== "all" && f.feeType !== filterType) return false
    if (filterStatus !== "all" && f.status !== filterStatus) return false
    if (filterPlatform !== "all" && f.platform !== filterPlatform) return false
    if (searchKeyword && !f.id.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !f.feeName.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (fee: typeof mockFeeRecords[0]) => {
    setSelectedFee(fee)
    setDetailOpen(true)
    setActiveTab("overview")
  }

  const handleAllocate = () => {
    toast.success("费用分摊任务已执行")
  }

  const handleConfirm = () => {
    toast.success("费用已确认")
    setDetailOpen(false)
  }

  const handleReverse = () => {
    toast.success("费用已冲回")
    setDetailOpen(false)
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
            <h1 className="text-2xl font-bold">费用归集与分摊</h1>
            <p className="text-muted-foreground">管理平台费用、物流费用等的归集与分摊到订单/SKU维度</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRuleOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              分摊规则
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              录入费用
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">费用记录数</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalFees}</div>
            </CardContent>
          </Card>
          <Card className={stats.pendingCount > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className={`h-4 w-4 ${stats.pendingCount > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
                <span className={`text-sm ${stats.pendingCount > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>待分摊</span>
              </div>
              <div className={`text-2xl font-bold ${stats.pendingCount > 0 ? "text-yellow-700" : ""}`}>{stats.pendingCount}</div>
            </CardContent>
          </Card>
          <Card className={stats.pendingAmountUSD > 0 ? "border-orange-200 bg-orange-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className={`h-4 w-4 ${stats.pendingAmountUSD > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
                <span className={`text-sm ${stats.pendingAmountUSD > 0 ? "text-orange-600" : "text-muted-foreground"}`}>待分摊金额</span>
              </div>
              <div className={`text-2xl font-bold ${stats.pendingAmountUSD > 0 ? "text-orange-700" : ""}`}>
                ${stats.pendingAmountUSD.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-600">已分摊</span>
              </div>
              <div className="text-2xl font-bold text-blue-700">{stats.allocatedCount}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">已确认金额</span>
              </div>
              <div className="text-2xl font-bold text-green-700">${stats.confirmedAmountUSD.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">费用总额 (USD)</span>
              </div>
              <div className="text-2xl font-bold">${stats.totalAmountUSD.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">账期:</Label>
                <Select defaultValue="2026-01">
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026-01">2026-01</SelectItem>
                    <SelectItem value="2025-12">2025-12</SelectItem>
                    <SelectItem value="2025-11">2025-11</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="费用类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="PLATFORM_FEE">平台费用</SelectItem>
                  <SelectItem value="SHIPPING_FEE">物流费用</SelectItem>
                  <SelectItem value="MARKETING_FEE">营销费用</SelectItem>
                  <SelectItem value="WAREHOUSE_FEE">仓储费用</SelectItem>
                  <SelectItem value="OTHER_FEE">其他费用</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部平台</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="Shopee">Shopee</SelectItem>
                  <SelectItem value="ALL">全平台</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="PENDING">待分摊</SelectItem>
                  <SelectItem value="ALLOCATED">已分摊</SelectItem>
                  <SelectItem value="CONFIRMED">已确认</SelectItem>
                  <SelectItem value="REVERSED">已冲回</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索费用ID/名称..."
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
                  <TableHead>费用ID</TableHead>
                  <TableHead>费用类型</TableHead>
                  <TableHead>费用名称</TableHead>
                  <TableHead>平台/店铺</TableHead>
                  <TableHead className="text-right">原始金额</TableHead>
                  <TableHead className="text-right">USD金额</TableHead>
                  <TableHead>分摊方式</TableHead>
                  <TableHead className="text-right">分摊对象数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>来源单据</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-mono text-sm">{fee.id}</TableCell>
                    <TableCell>
                      <Badge className={feeTypeConfig[fee.feeType].color}>
                        {feeTypeConfig[fee.feeType].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{fee.feeName}</TableCell>
                    <TableCell>
                      <div className="text-sm">{fee.platform}</div>
                      <div className="text-xs text-muted-foreground">{fee.storeName}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(fee.originalAmount, fee.currency)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">${fee.amountUSD.toLocaleString()}</TableCell>
                    <TableCell>{allocationMethodConfig[fee.allocationMethod].label}</TableCell>
                    <TableCell className="text-right font-mono">
                      {fee.allocatedTo > 0 ? fee.allocatedTo.toLocaleString() : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={feeStatusConfig[fee.status].color}>
                        {feeStatusConfig[fee.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fee.sourceDoc}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(fee)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {fee.status === "PENDING" && (
                          <Button variant="ghost" size="sm" onClick={handleAllocate}>
                            <RefreshCw className="h-4 w-4 text-blue-600" />
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

        {/* FE2 费用详情抽屉 */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {selectedFee?.feeName}
                {selectedFee && (
                  <>
                    <Badge className={feeTypeConfig[selectedFee.feeType].color}>
                      {feeTypeConfig[selectedFee.feeType].label}
                    </Badge>
                    <Badge className={feeStatusConfig[selectedFee.status].color}>
                      {feeStatusConfig[selectedFee.status].label}
                    </Badge>
                  </>
                )}
              </SheetTitle>
              <SheetDescription>
                {selectedFee?.id} | 账期: {selectedFee?.period} | 来源: {selectedFee?.sourceDoc}
              </SheetDescription>
            </SheetHeader>

            {selectedFee && (
              <div className="mt-6">
                {/* Action Buttons */}
                <div className="flex items-center gap-2 mb-6">
                  {selectedFee.status === "PENDING" && (
                    <Button size="sm" onClick={handleAllocate}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      执行分摊
                    </Button>
                  )}
                  {selectedFee.status === "ALLOCATED" && (
                    <Button size="sm" onClick={handleConfirm}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      确认分摊
                    </Button>
                  )}
                  {(selectedFee.status === "ALLOCATED" || selectedFee.status === "CONFIRMED") && (
                    <Button variant="outline" size="sm" onClick={handleReverse}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      冲回
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    导出明细
                  </Button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <div className="text-sm text-muted-foreground mb-1">原始金额</div>
                    <div className="text-xl font-bold">{formatCurrency(selectedFee.originalAmount, selectedFee.currency)}</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <div className="text-sm text-blue-600 mb-1">USD金额</div>
                    <div className="text-xl font-bold text-blue-700">${selectedFee.amountUSD.toLocaleString()}</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <div className="text-sm text-green-600 mb-1">分摊对象数</div>
                    <div className="text-xl font-bold text-green-700">
                      {selectedFee.allocatedTo > 0 ? selectedFee.allocatedTo.toLocaleString() : "-"}
                    </div>
                  </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="overview">基本信息</TabsTrigger>
                    <TabsTrigger value="allocation">分摊明细</TabsTrigger>
                    <TabsTrigger value="logs">操作日志</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">费用类型</div>
                        <div className="font-medium mt-1">{feeTypeConfig[selectedFee.feeType].label}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">分摊方式</div>
                        <div className="font-medium mt-1">{allocationMethodConfig[selectedFee.allocationMethod].label}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">平台</div>
                        <div className="font-medium mt-1">{selectedFee.platform}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">店铺</div>
                        <div className="font-medium mt-1">{selectedFee.storeName}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">创建时间</div>
                        <div className="font-medium mt-1">{selectedFee.createdAt}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">确认时间</div>
                        <div className="font-medium mt-1">{selectedFee.confirmedAt || "-"}</div>
                      </div>
                    </div>

                    {/* 分摊规则说明 */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">分摊规则说明</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>按GMV比例：费用按各订单/SKU的GMV占比分摊</li>
                        <li>按订单数：费用按订单数量平均分摊</li>
                        <li>分摊结果将影响毛利快照中的费用扣减项</li>
                      </ul>
                    </div>
                  </TabsContent>

                  <TabsContent value="allocation" className="space-y-4">
                    {selectedFee.allocatedTo > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>订单号</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">GMV</TableHead>
                            <TableHead className="text-right">分摊比例</TableHead>
                            <TableHead className="text-right">分摊金额</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mockAllocationDetails.map((detail) => (
                            <TableRow key={detail.orderId + detail.sku}>
                              <TableCell className="font-mono text-sm">{detail.orderId}</TableCell>
                              <TableCell className="font-mono text-sm">{detail.sku}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(detail.gmv, "IDR")}</TableCell>
                              <TableCell className="text-right font-mono">{(detail.ratio * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(detail.allocatedFee, "IDR")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        费用尚未分摊，请先执行分摊操作
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="logs" className="space-y-4">
                    <div className="space-y-3">
                      {[
                        { time: selectedFee.confirmedAt || selectedFee.createdAt, action: selectedFee.status === "CONFIRMED" ? "分摊确认" : "费用录入", user: "系统" },
                        { time: selectedFee.createdAt, action: "费用创建", user: "张三", detail: `从 ${selectedFee.sourceDoc} 导入` },
                      ].map((log, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="text-sm text-muted-foreground w-28">{log.time}</div>
                          <div className="flex-1">
                            <div className="font-medium">{log.action}</div>
                            {log.detail && <div className="text-sm text-muted-foreground">{log.detail}</div>}
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

        {/* FE3 费用规则配置抽屉 */}
        <Sheet open={ruleOpen} onOpenChange={setRuleOpen}>
          <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>费用分摊规则配置</SheetTitle>
              <SheetDescription>配置不同费用类型的分摊方式和作用范围</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Add Rule Button */}
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setCreateRuleOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  新建规则
                </Button>
              </div>

              {/* Rules List */}
              <div className="space-y-4">
                {mockFeeRules.map((rule) => (
                  <Card key={rule.id} className={!rule.isActive ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{rule.ruleName}</h4>
                            <Badge className={feeTypeConfig[rule.feeType].color}>
                              {feeTypeConfig[rule.feeType].label}
                            </Badge>
                            <Badge variant="outline">优先级: {rule.priority}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span>平台: {rule.platform}</span>
                            <span>分摊方式: {allocationMethodConfig[rule.allocationMethod].label}</span>
                            <span>分摊范围: {rule.allocationScope}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={rule.isActive} />
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Rule Tips */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">规则说明</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>规则按优先级从低到高执行，高优先级规则可覆盖低优先级</li>
                  <li>平台为 ALL 的规则适用于所有平台</li>
                  <li>分摊范围决定费用分摊到的最小粒度（订单/SKU/店铺）</li>
                </ul>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Create Rule Sheet */}
        <Sheet open={createRuleOpen} onOpenChange={setCreateRuleOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px]">
            <SheetHeader>
              <SheetTitle>新建分摊规则</SheetTitle>
              <SheetDescription>配置费用分摊规则的详细参数</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label>规则名称 *</Label>
                <Input placeholder="例如: TikTok平台费用分摊" />
              </div>

              <div className="space-y-2">
                <Label>费用类型 *</Label>
                <Select defaultValue="PLATFORM_FEE">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLATFORM_FEE">平台费用</SelectItem>
                    <SelectItem value="SHIPPING_FEE">物流费用</SelectItem>
                    <SelectItem value="MARKETING_FEE">营销费用</SelectItem>
                    <SelectItem value="WAREHOUSE_FEE">仓储费用</SelectItem>
                    <SelectItem value="OTHER_FEE">其他费用</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>适用平台 *</Label>
                <Select defaultValue="ALL">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">全部平台</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="Shopee">Shopee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>分摊方式 *</Label>
                <Select defaultValue="GMV_RATIO">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GMV_RATIO">按GMV比例</SelectItem>
                    <SelectItem value="ORDER_COUNT">按订单数</SelectItem>
                    <SelectItem value="SKU_COUNT">按SKU数</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">固定金额</SelectItem>
                    <SelectItem value="MANUAL">人工分配</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>分摊范围 *</Label>
                <Select defaultValue="ORDER">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORDER">订单维度</SelectItem>
                    <SelectItem value="SKU">SKU维度</SelectItem>
                    <SelectItem value="STORE">店铺维度</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>优先级 *</Label>
                <Input type="number" defaultValue="1" min="1" max="100" />
                <p className="text-xs text-muted-foreground">数字越大优先级越高，范围1-100</p>
              </div>

              <div className="space-y-2">
                <Label>规则描述</Label>
                <Textarea placeholder="描述规则的用途和适用场景..." rows={2} />
              </div>

              <div className="flex items-center gap-2">
                <Switch id="rule-active" defaultChecked />
                <Label htmlFor="rule-active">立即启用</Label>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setCreateRuleOpen(false)}>
                  取消
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    toast.success("分摊规则已创建")
                    setCreateRuleOpen(false)
                  }}
                >
                  保存规则
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Suspense>
  )
}
