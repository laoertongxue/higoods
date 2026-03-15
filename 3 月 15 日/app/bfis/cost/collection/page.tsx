"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  Copy,
  CheckCircle,
  Clock,
  Archive,
  AlertTriangle,
  FileText,
  RefreshCw,
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
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// CV1 成本版本列表页 + CV2 详情页 + CV3 新建/编辑抽屉

type CostType = "STANDARD" | "ESTIMATE" | "ACTUAL"
type CostScope = "SKU" | "SPU" | "ORDER_LINE" | "PROD_BATCH"
type CostStatus = "DRAFT" | "APPROVED" | "RETIRED"

const costTypeConfig: Record<CostType, { label: string; color: string }> = {
  STANDARD: { label: "标准成本", color: "bg-blue-100 text-blue-700" },
  ESTIMATE: { label: "暂估成本", color: "bg-yellow-100 text-yellow-700" },
  ACTUAL: { label: "实际成本", color: "bg-green-100 text-green-700" },
}

const costScopeConfig: Record<CostScope, { label: string }> = {
  SKU: { label: "SKU" },
  SPU: { label: "SPU" },
  ORDER_LINE: { label: "订单行" },
  PROD_BATCH: { label: "生产批次" },
}

const costStatusConfig: Record<CostStatus, { label: string; color: string }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  APPROVED: { label: "已生效", color: "bg-green-100 text-green-700" },
  RETIRED: { label: "已退役", color: "bg-red-100 text-red-700" },
}

// Mock 成本版本数据
const mockCostVersions = [
  {
    id: "CV-2026-001",
    versionNo: "STD-2026-Q1-v1",
    costType: "STANDARD" as CostType,
    costScope: "SKU" as CostScope,
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-03-31",
    coveredCount: 1256,
    currency: "USD",
    status: "APPROVED" as CostStatus,
    source: "商品建档",
    updatedAt: "2026-01-15 10:30",
    updatedBy: "系统",
  },
  {
    id: "CV-2026-002",
    versionNo: "EST-BATCH-001",
    costType: "ESTIMATE" as CostType,
    costScope: "PROD_BATCH" as CostScope,
    effectiveFrom: "2026-01-10",
    effectiveTo: null,
    coveredCount: 45,
    currency: "CNY",
    status: "APPROVED" as CostStatus,
    source: "预售暂估",
    updatedAt: "2026-01-12 14:20",
    updatedBy: "张三",
  },
  {
    id: "CV-2026-003",
    versionNo: "ACT-BATCH-001",
    costType: "ACTUAL" as CostType,
    costScope: "PROD_BATCH" as CostScope,
    effectiveFrom: "2026-01-16",
    effectiveTo: null,
    coveredCount: 45,
    currency: "CNY",
    status: "DRAFT" as CostStatus,
    source: "工厂结算",
    updatedAt: "2026-01-16 09:00",
    updatedBy: "李四",
  },
  {
    id: "CV-2026-004",
    versionNo: "STD-2025-Q4-v2",
    costType: "STANDARD" as CostType,
    costScope: "SKU" as CostScope,
    effectiveFrom: "2025-10-01",
    effectiveTo: "2025-12-31",
    coveredCount: 1180,
    currency: "USD",
    status: "RETIRED" as CostStatus,
    source: "商品建档",
    updatedAt: "2025-12-31 23:59",
    updatedBy: "系统",
  },
]

// Mock 成本明细
const mockCostItems = [
  { objectId: "SKU-001", objectName: "连衣裙-红色-S", unitCost: 45.00, currency: "USD", usdAmount: 45.00, breakdown: { fabric: 25, labor: 15, overhead: 5 } },
  { objectId: "SKU-002", objectName: "连衣裙-红色-M", unitCost: 45.00, currency: "USD", usdAmount: 45.00, breakdown: { fabric: 25, labor: 15, overhead: 5 } },
  { objectId: "SKU-003", objectName: "连衣裙-红色-L", unitCost: 46.50, currency: "USD", usdAmount: 46.50, breakdown: { fabric: 26, labor: 15.5, overhead: 5 } },
  { objectId: "SKU-004", objectName: "T恤-白色-S", unitCost: 12.00, currency: "USD", usdAmount: 12.00, breakdown: { fabric: 6, labor: 4, overhead: 2 } },
  { objectId: "SKU-005", objectName: "T恤-白色-M", unitCost: 12.00, currency: "USD", usdAmount: 12.00, breakdown: { fabric: 6, labor: 4, overhead: 2 } },
]

const LoadingComponent = () => null

export default function CostCollectionPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterScope, setFilterScope] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedVersion, setSelectedVersion] = useState<(typeof mockCostVersions)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("info")

  const searchParams = useSearchParams()

  // KPI统计
  const stats = {
    total: mockCostVersions.length,
    approved: mockCostVersions.filter((v) => v.status === "APPROVED").length,
    draft: mockCostVersions.filter((v) => v.status === "DRAFT").length,
    retired: mockCostVersions.filter((v) => v.status === "RETIRED").length,
    standardCount: mockCostVersions.filter((v) => v.costType === "STANDARD" && v.status === "APPROVED").length,
    actualPending: mockCostVersions.filter((v) => v.costType === "ACTUAL" && v.status === "DRAFT").length,
  }

  // 筛选
  const filteredVersions = mockCostVersions.filter((v) => {
    if (filterType !== "all" && v.costType !== filterType) return false
    if (filterScope !== "all" && v.costScope !== filterScope) return false
    if (filterStatus !== "all" && v.status !== filterStatus) return false
    if (searchKeyword && !v.versionNo.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (version: typeof mockCostVersions[0]) => {
    setSelectedVersion(version)
    setDetailOpen(true)
    setActiveTab("info")
  }

  const handleApprove = () => {
    toast.success("成本版本已审批通过")
    setDetailOpen(false)
  }

  const handleRetire = () => {
    toast.success("成本版本已退役")
    setDetailOpen(false)
  }

  const handleCopy = () => {
    toast.success("已复制为新版本草稿")
    setDetailOpen(false)
    setCreateOpen(true)
  }

  const handleCreateBackfill = () => {
    toast.success("成本回写任务已创建")
  }

  return (
    <Suspense fallback={<LoadingComponent />}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">成本归集与版本</h1>
            <p className="text-muted-foreground">管理标准/暂估/实际成本版本，支持成本回写到毛利快照</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建成本版本
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">版本总数</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="text-sm text-green-600 mb-1">已生效</div>
              <div className="text-2xl font-bold text-green-700">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="text-sm text-yellow-600 mb-1">草稿待审</div>
              <div className="text-2xl font-bold text-yellow-700">{stats.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">已退役</div>
              <div className="text-2xl font-bold">{stats.retired}</div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="text-sm text-blue-600 mb-1">标准成本版本</div>
              <div className="text-2xl font-bold text-blue-700">{stats.standardCount}</div>
            </CardContent>
          </Card>
          <Card className={stats.actualPending > 0 ? "border-orange-200 bg-orange-50" : ""}>
            <CardContent className="p-4">
              <div className={`text-sm mb-1 ${stats.actualPending > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                实际成本待审
              </div>
              <div className={`text-2xl font-bold ${stats.actualPending > 0 ? "text-orange-700" : ""}`}>
                {stats.actualPending}
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
                  placeholder="搜索版本号/商品编码/批次号..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="成本类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="STANDARD">标准成本</SelectItem>
                  <SelectItem value="ESTIMATE">暂估成本</SelectItem>
                  <SelectItem value="ACTUAL">实际成本</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterScope} onValueChange={setFilterScope}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="作用范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部范围</SelectItem>
                  <SelectItem value="SKU">SKU</SelectItem>
                  <SelectItem value="SPU">SPU</SelectItem>
                  <SelectItem value="ORDER_LINE">订单行</SelectItem>
                  <SelectItem value="PROD_BATCH">生产批次</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="DRAFT">草稿</SelectItem>
                  <SelectItem value="APPROVED">已生效</SelectItem>
                  <SelectItem value="RETIRED">已退役</SelectItem>
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
                  <TableHead>版本号</TableHead>
                  <TableHead>成本类型</TableHead>
                  <TableHead>作用范围</TableHead>
                  <TableHead>生效区间</TableHead>
                  <TableHead className="text-right">覆盖对象数</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>最近更新</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVersions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">{version.versionNo}</TableCell>
                    <TableCell>
                      <Badge className={costTypeConfig[version.costType].color}>
                        {costTypeConfig[version.costType].label}
                      </Badge>
                    </TableCell>
                    <TableCell>{costScopeConfig[version.costScope].label}</TableCell>
                    <TableCell className="text-sm">
                      {version.effectiveFrom} ~ {version.effectiveTo || "至今"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{version.coveredCount.toLocaleString()}</TableCell>
                    <TableCell>{version.currency}</TableCell>
                    <TableCell>
                      <Badge className={costStatusConfig[version.status].color}>
                        {costStatusConfig[version.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{version.source}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{version.updatedAt}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(version)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {version.status === "DRAFT" && (
                          <Button variant="ghost" size="sm" onClick={handleApprove}>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {version.status === "APPROVED" && (
                          <Button variant="ghost" size="sm" onClick={handleRetire}>
                            <Archive className="h-4 w-4 text-gray-600" />
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

        {/* CV2 成本版本详情抽屉 */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-[700px] sm:max-w-[700px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {selectedVersion?.versionNo}
                {selectedVersion && (
                  <Badge className={costStatusConfig[selectedVersion.status].color}>
                    {costStatusConfig[selectedVersion.status].label}
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription>
                {selectedVersion && costTypeConfig[selectedVersion.costType].label} | 
                生效区间: {selectedVersion?.effectiveFrom} ~ {selectedVersion?.effectiveTo || "至今"}
              </SheetDescription>
            </SheetHeader>

            {selectedVersion && (
              <div className="mt-6">
                {/* 操作按钮 */}
                <div className="flex items-center gap-2 mb-6">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" />
                    复制为新版本
                  </Button>
                  {selectedVersion.status === "DRAFT" && (
                    <Button size="sm" onClick={handleApprove}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      审批通过
                    </Button>
                  )}
                  {selectedVersion.status === "APPROVED" && selectedVersion.costType === "ACTUAL" && (
                    <Button size="sm" onClick={handleCreateBackfill}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      生成回写任务
                    </Button>
                  )}
                  {selectedVersion.status === "APPROVED" && (
                    <Button variant="outline" size="sm" onClick={handleRetire}>
                      <Archive className="h-4 w-4 mr-2" />
                      退役
                    </Button>
                  )}
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="info">基本信息</TabsTrigger>
                    <TabsTrigger value="items">成本明细</TabsTrigger>
                    <TabsTrigger value="impact">影响评估</TabsTrigger>
                    <TabsTrigger value="backfill">关联回写</TabsTrigger>
                    <TabsTrigger value="logs">日志</TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">成本类型</div>
                        <div className="font-medium mt-1">{costTypeConfig[selectedVersion.costType].label}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">作用范围</div>
                        <div className="font-medium mt-1">{costScopeConfig[selectedVersion.costScope].label}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">来源</div>
                        <div className="font-medium mt-1">{selectedVersion.source}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">主币种</div>
                        <div className="font-medium mt-1">{selectedVersion.currency}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">覆盖对象数</div>
                        <div className="font-medium mt-1">{selectedVersion.coveredCount.toLocaleString()}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">最后更新</div>
                        <div className="font-medium mt-1">{selectedVersion.updatedAt}</div>
                      </div>
                    </div>

                    {/* 规则说明 */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">版本规则</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>STANDARD 成本支持按订单时间取当时有效版本</li>
                        <li>APPROVED 后禁止直接编辑，只能复制新版本或退役</li>
                        <li>ACTUAL 成本审批后可生成回写任务更新毛利快照</li>
                      </ul>
                    </div>
                  </TabsContent>

                  <TabsContent value="items" className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>对象ID</TableHead>
                          <TableHead>商品名称</TableHead>
                          <TableHead className="text-right">单位成本</TableHead>
                          <TableHead>币种</TableHead>
                          <TableHead className="text-right">USD金额</TableHead>
                          <TableHead>成本分解</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockCostItems.map((item) => (
                          <TableRow key={item.objectId}>
                            <TableCell className="font-mono text-sm">{item.objectId}</TableCell>
                            <TableCell>{item.objectName}</TableCell>
                            <TableCell className="text-right font-mono">${item.unitCost.toFixed(2)}</TableCell>
                            <TableCell>{item.currency}</TableCell>
                            <TableCell className="text-right font-mono">${item.usdAmount.toFixed(2)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              面料${item.breakdown.fabric} + 人工${item.breakdown.labor} + 制费${item.breakdown.overhead}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="impact" className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-3">预估影响毛利金额（按近30天销量模拟）</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-background rounded">
                          <div className="text-2xl font-bold">$125,680</div>
                          <div className="text-sm text-muted-foreground">预计影响金额</div>
                        </div>
                        <div className="text-center p-3 bg-background rounded">
                          <div className="text-2xl font-bold">3,456</div>
                          <div className="text-sm text-muted-foreground">涉及订单行数</div>
                        </div>
                        <div className="text-center p-3 bg-background rounded">
                          <div className="text-2xl font-bold text-orange-600">+2.3%</div>
                          <div className="text-sm text-muted-foreground">成本变动率</div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="backfill" className="space-y-4">
                    {selectedVersion.costType === "ACTUAL" ? (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          实际成本版本可生成回写任务，将实际成本更新到相关毛利快照
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>任务号</TableHead>
                              <TableHead>状态</TableHead>
                              <TableHead>影响范围</TableHead>
                              <TableHead>创建时间</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                暂无回写任务，请点击"生成回写任务"创建
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        仅实际成本（ACTUAL）版本支持生成回写任务
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="logs" className="space-y-4">
                    <div className="space-y-3">
                      {[
                        { time: "2026-01-16 09:00", action: "创建版本", user: "李四", detail: "从工厂结算导入" },
                        { time: "2026-01-15 10:30", action: "版本更新", user: "系统", detail: "自动同步商品建档成本" },
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

        {/* CV3 新建/编辑成本版本抽屉 */}
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px]">
            <SheetHeader>
              <SheetTitle>新建成本版本</SheetTitle>
              <SheetDescription>创建新的成本版本，支持标准/暂估/实际成本</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label>成本类型 *</Label>
                <Select defaultValue="STANDARD">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">标准成本（商品建档）</SelectItem>
                    <SelectItem value="ESTIMATE">暂估成本（预售暂估）</SelectItem>
                    <SelectItem value="ACTUAL">实际成本（工厂结算）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>作用范围 *</Label>
                <Select defaultValue="SKU">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SKU">SKU（单品）</SelectItem>
                    <SelectItem value="SPU">SPU（款式）</SelectItem>
                    <SelectItem value="ORDER_LINE">订单行</SelectItem>
                    <SelectItem value="PROD_BATCH">生产批次</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>生效开始日期 *</Label>
                  <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} />
                </div>
                <div className="space-y-2">
                  <Label>生效结束日期</Label>
                  <Input type="date" placeholder="可选，不填表示持续有效" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>主币种 *</Label>
                <Select defaultValue="USD">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - 美元</SelectItem>
                    <SelectItem value="CNY">CNY - 人民币</SelectItem>
                    <SelectItem value="IDR">IDR - 印尼盾</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>来源系统 *</Label>
                <Select defaultValue="manual">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">人工录入</SelectItem>
                    <SelectItem value="import">Excel导入</SelectItem>
                    <SelectItem value="factory">工厂结算系统</SelectItem>
                    <SelectItem value="legacy">旧系统同步</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>上传成本明细（可选）</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">上传 Excel 模板</p>
                  <p className="text-xs text-muted-foreground">下载模板 | 支持 xlsx 格式</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>备注</Label>
                <Textarea placeholder="版本说明（可选）" rows={2} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setCreateOpen(false)}>
                  取消
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => {
                    toast.success("成本版本已保存为草稿")
                    setCreateOpen(false)
                  }}
                >
                  保存草稿
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    toast.success("成本版本已提交审批")
                    setCreateOpen(false)
                  }}
                >
                  提交审批
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Suspense>
  )
}
