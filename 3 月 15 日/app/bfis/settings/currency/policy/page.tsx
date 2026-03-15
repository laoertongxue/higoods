"use client"

import { useState } from "react"
import { useSearchParams, Suspense } from "next/navigation"
import {
  Search,
  Plus,
  Download,
  Eye,
  Edit2,
  Trash2,
  Settings,
  Layers,
  Target,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
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
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import Loading from "./loading"

// FP1｜汇率策略列表页
// FP2｜汇率策略详情页
// 策略定义：场景→默认汇率集类型→来源优先级→枢轴币→缺失处理

type ScenarioDomain = "REPORT" | "PLATFORM" | "ARAP" | "BANK" | "COST" | "ASSET"
type RateSetType = "PERIOD_FIXED" | "END_PERIOD"
type MissingBehavior = "BLOCK" | "WARN" | "FALLBACK_TO_TRIANGULATION"
type PolicyStatus = "ACTIVE" | "INACTIVE"

const scenarioDomainConfig: Record<ScenarioDomain, { label: string; color: string; description: string }> = {
  REPORT: { label: "报表", color: "bg-blue-100 text-blue-700", description: "简化三表、管理报表" },
  PLATFORM: { label: "平台", color: "bg-green-100 text-green-700", description: "平台结算、到账" },
  ARAP: { label: "往来", color: "bg-purple-100 text-purple-700", description: "应收应付、往来余额" },
  BANK: { label: "银行", color: "bg-orange-100 text-orange-700", description: "银行流水、资金" },
  COST: { label: "成本", color: "bg-yellow-100 text-yellow-700", description: "毛利核算、成本归集" },
  ASSET: { label: "资产", color: "bg-cyan-100 text-cyan-700", description: "存货、固定资产" },
}

const rateSetTypeConfig: Record<RateSetType, { label: string; color: string }> = {
  PERIOD_FIXED: { label: "期间固定", color: "bg-green-100 text-green-700" },
  END_PERIOD: { label: "期末", color: "bg-blue-100 text-blue-700" },
}

const missingBehaviorConfig: Record<MissingBehavior, { label: string; color: string; description: string }> = {
  BLOCK: { label: "阻断", color: "bg-red-100 text-red-700", description: "缺失时阻止计算" },
  WARN: { label: "预警", color: "bg-yellow-100 text-yellow-700", description: "缺失时生成预警但继续" },
  FALLBACK_TO_TRIANGULATION: { label: "三角换算", color: "bg-blue-100 text-blue-700", description: "缺失时使用枢轴币换算" },
}

// Mock 汇率策略数据
const mockPolicies = [
  {
    id: "policy_001",
    code: "POLICY_REPORT_PL_PERIOD_FIXED_USD",
    name: "报表利润-期间固定",
    scenarioDomain: "REPORT" as ScenarioDomain,
    targetCurrency: "USD",
    defaultRateSetType: "PERIOD_FIXED" as RateSetType,
    allowSpotReference: false,
    sourcePriorityList: ["IMPORT", "MANUAL"],
    pivotCurrency: "USD",
    missingBehavior: "WARN" as MissingBehavior,
    status: "ACTIVE" as PolicyStatus,
    usedByCount: 45,
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    remark: "用于简化三表利润类指标折算",
    createdAt: "2025-01-01 10:00",
    updatedAt: "2026-01-15 14:00",
  },
  {
    id: "policy_002",
    code: "POLICY_REPORT_BS_END_PERIOD_USD",
    name: "报表资产负债-期末",
    scenarioDomain: "REPORT" as ScenarioDomain,
    targetCurrency: "USD",
    defaultRateSetType: "END_PERIOD" as RateSetType,
    allowSpotReference: false,
    sourcePriorityList: ["IMPORT", "MANUAL"],
    pivotCurrency: "USD",
    missingBehavior: "BLOCK" as MissingBehavior,
    status: "ACTIVE" as PolicyStatus,
    usedByCount: 30,
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    remark: "用于简化三表资产负债类期末折算",
    createdAt: "2025-01-01 10:00",
    updatedAt: "2026-01-15 14:00",
  },
  {
    id: "policy_003",
    code: "POLICY_MARGIN_PERIOD_FIXED_USD",
    name: "毛利核算-期间固定",
    scenarioDomain: "COST" as ScenarioDomain,
    targetCurrency: "USD",
    defaultRateSetType: "PERIOD_FIXED" as RateSetType,
    allowSpotReference: false,
    sourcePriorityList: ["IMPORT", "MANUAL"],
    pivotCurrency: "USD",
    missingBehavior: "WARN" as MissingBehavior,
    status: "ACTIVE" as PolicyStatus,
    usedByCount: 28,
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    remark: "用于毛利快照的成本与收入折算",
    createdAt: "2025-01-01 10:00",
    updatedAt: "2026-01-10 09:00",
  },
  {
    id: "policy_004",
    code: "POLICY_ARAP_END_PERIOD_USD",
    name: "往来余额-期末",
    scenarioDomain: "ARAP" as ScenarioDomain,
    targetCurrency: "USD",
    defaultRateSetType: "END_PERIOD" as RateSetType,
    allowSpotReference: false,
    sourcePriorityList: ["IMPORT", "MANUAL"],
    pivotCurrency: "USD",
    missingBehavior: "BLOCK" as MissingBehavior,
    status: "ACTIVE" as PolicyStatus,
    usedByCount: 15,
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    remark: "用于应收应付期末余额折算",
    createdAt: "2025-01-01 10:00",
    updatedAt: "2026-01-05 11:00",
  },
  {
    id: "policy_005",
    code: "POLICY_BANK_SPOT_USD",
    name: "银行流水-即期参考",
    scenarioDomain: "BANK" as ScenarioDomain,
    targetCurrency: "USD",
    defaultRateSetType: "PERIOD_FIXED" as RateSetType,
    allowSpotReference: true,
    sourcePriorityList: ["IMPORT", "MANUAL"],
    pivotCurrency: "USD",
    missingBehavior: "FALLBACK_TO_TRIANGULATION" as MissingBehavior,
    status: "ACTIVE" as PolicyStatus,
    usedByCount: 12,
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    remark: "银行流水允许参考即期汇率进行对照",
    createdAt: "2025-01-01 10:00",
    updatedAt: "2026-01-02 16:00",
  },
  {
    id: "policy_006",
    code: "POLICY_FX_EXPLAIN",
    name: "汇率对照解释",
    scenarioDomain: "REPORT" as ScenarioDomain,
    targetCurrency: "USD",
    defaultRateSetType: "PERIOD_FIXED" as RateSetType,
    allowSpotReference: true,
    sourcePriorityList: ["IMPORT", "MANUAL"],
    pivotCurrency: "USD",
    missingBehavior: "WARN" as MissingBehavior,
    status: "ACTIVE" as PolicyStatus,
    usedByCount: 8,
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    remark: "仅对照页可选 SPOT 进行差异解释",
    createdAt: "2025-01-01 10:00",
    updatedAt: "2026-01-01 10:00",
  },
]

export default function PolicyPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterDomain, setFilterDomain] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedPolicy, setSelectedPolicy] = useState<(typeof mockPolicies)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("basic")
  const searchParams = useSearchParams()

  // 筛选
  const filteredPolicies = mockPolicies.filter((p) => {
    if (filterDomain !== "all" && p.scenarioDomain !== filterDomain) return false
    if (filterStatus !== "all" && p.status !== filterStatus) return false
    if (searchKeyword && !p.code.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !p.name.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (policy: typeof mockPolicies[0]) => {
    setSelectedPolicy(policy)
    setDetailOpen(true)
    setActiveTab("basic")
  }

  const openEdit = (policy?: typeof mockPolicies[0]) => {
    setSelectedPolicy(policy || null)
    setEditOpen(true)
  }

  const handleSave = () => {
    toast.success(selectedPolicy ? "策略已更新" : "策略已创建")
    setEditOpen(false)
  }

  // 按场景域统计
  const domainStats = Object.keys(scenarioDomainConfig).map((domain) => ({
    domain,
    count: mockPolicies.filter((p) => p.scenarioDomain === domain && p.status === "ACTIVE").length,
  }))

  return (
    <Suspense fallback={<Loading />}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">汇率策略</h1>
            <p className="text-muted-foreground">
              配置各业务场景的汇率解析策略：场景域、默认汇率集类型、来源优先级、枢轴币、缺失处理
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button size="sm" onClick={() => openEdit()}>
              <Plus className="h-4 w-4 mr-2" />
              新建策略
            </Button>
          </div>
        </div>

        {/* 场景域统计 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {domainStats.map((stat) => {
            const config = scenarioDomainConfig[stat.domain as ScenarioDomain]
            return (
              <Card key={stat.domain} className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setFilterDomain(filterDomain === stat.domain ? "all" : stat.domain)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={config.color}>{config.label}</Badge>
                    <span className="text-2xl font-bold">{stat.count}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索策略编码/名称..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterDomain} onValueChange={setFilterDomain}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="场景域" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部场景</SelectItem>
                  {Object.entries(scenarioDomainConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="ACTIVE">启用</SelectItem>
                  <SelectItem value="INACTIVE">停用</SelectItem>
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
                  <TableHead>策略编码</TableHead>
                  <TableHead>策略名称</TableHead>
                  <TableHead>场景域</TableHead>
                  <TableHead>目标币种</TableHead>
                  <TableHead>默认汇率集类型</TableHead>
                  <TableHead>允许SPOT</TableHead>
                  <TableHead>缺失处理</TableHead>
                  <TableHead className="text-right">引用次数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-mono text-sm">{policy.code}</TableCell>
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell>
                      <Badge className={scenarioDomainConfig[policy.scenarioDomain].color}>
                        {scenarioDomainConfig[policy.scenarioDomain].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{policy.targetCurrency}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={rateSetTypeConfig[policy.defaultRateSetType].color}>
                        {rateSetTypeConfig[policy.defaultRateSetType].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {policy.allowSpotReference ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={missingBehaviorConfig[policy.missingBehavior].color}>
                        {missingBehaviorConfig[policy.missingBehavior].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{policy.usedByCount}</TableCell>
                    <TableCell>
                      <Badge className={policy.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                        {policy.status === "ACTIVE" ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(policy)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(policy)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* FP2 策略详情抽屉 */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {selectedPolicy?.name}
                {selectedPolicy && (
                  <Badge className={selectedPolicy.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                    {selectedPolicy.status === "ACTIVE" ? "启用" : "停用"}
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription>
                {selectedPolicy?.code}
              </SheetDescription>
            </SheetHeader>

            {selectedPolicy && (
              <div className="mt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="basic">基本信息</TabsTrigger>
                    <TabsTrigger value="resolve">解析规则</TabsTrigger>
                    <TabsTrigger value="usage">引用情况</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">策略编码</div>
                        <div className="font-mono font-medium mt-1">{selectedPolicy.code}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">策略名称</div>
                        <div className="font-medium mt-1">{selectedPolicy.name}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">场景域</div>
                        <div className="mt-1">
                          <Badge className={scenarioDomainConfig[selectedPolicy.scenarioDomain].color}>
                            {scenarioDomainConfig[selectedPolicy.scenarioDomain].label}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">目标币种</div>
                        <div className="font-medium mt-1">{selectedPolicy.targetCurrency}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">生效起始</div>
                        <div className="font-medium mt-1">{selectedPolicy.effectiveFrom}</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">生效截止</div>
                        <div className="font-medium mt-1">{selectedPolicy.effectiveTo || "无限期"}</div>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">备注</div>
                      <div className="mt-1">{selectedPolicy.remark || "-"}</div>
                    </div>

                    <Separator />

                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>创建时间: {selectedPolicy.createdAt}</div>
                      <div>更新时间: {selectedPolicy.updatedAt}</div>
                    </div>
                  </TabsContent>

                  <TabsContent value="resolve" className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">解析规则说明</h4>
                      <p className="text-sm text-blue-700">
                        当调用方需要折算（管理口径）时，根据此策略决定汇率集类型，优先命中对应的 FXRateSet，
                        在明细中查币对；找不到则按缺失处理规则执行。
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers className="h-4 w-4 text-primary" />
                          <span className="font-medium">默认汇率集类型</span>
                        </div>
                        <Badge className={rateSetTypeConfig[selectedPolicy.defaultRateSetType].color}>
                          {rateSetTypeConfig[selectedPolicy.defaultRateSetType].label}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-2">
                          {selectedPolicy.defaultRateSetType === "PERIOD_FIXED" 
                            ? "期间内所有管理口径折算的默认依据" 
                            : "期末余额折算与月末重估输入依据"}
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-primary" />
                          <span className="font-medium">枢轴币种</span>
                        </div>
                        <Badge variant="outline">{selectedPolicy.pivotCurrency}</Badge>
                        <p className="text-xs text-muted-foreground mt-2">
                          三角换算时使用的中间币种
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="h-4 w-4 text-primary" />
                        <span className="font-medium">来源优先级</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedPolicy.sourcePriorityList.map((source, i) => (
                          <div key={source} className="flex items-center gap-2">
                            <Badge variant="outline">{i + 1}. {source}</Badge>
                            {i < selectedPolicy.sourcePriorityList.length - 1 && (
                              <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-primary" />
                          <span className="font-medium">缺失处理</span>
                        </div>
                        <Badge className={missingBehaviorConfig[selectedPolicy.missingBehavior].color}>
                          {missingBehaviorConfig[selectedPolicy.missingBehavior].label}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-2">
                          {missingBehaviorConfig[selectedPolicy.missingBehavior].description}
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowRightLeft className="h-4 w-4 text-primary" />
                          <span className="font-medium">允许SPOT参考</span>
                        </div>
                        <Badge className={selectedPolicy.allowSpotReference ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                          {selectedPolicy.allowSpotReference ? "是" : "否"}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-2">
                          {selectedPolicy.allowSpotReference 
                            ? "允许在对照工具中选择即期汇率" 
                            : "不允许参考即期汇率"}
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="usage" className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <div className="text-3xl font-bold text-primary">{selectedPolicy.usedByCount}</div>
                      <div className="text-sm text-muted-foreground mt-1">引用此策略的记录数</div>
                    </div>

                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium text-yellow-800">修改提醒</span>
                      </div>
                      <p className="text-sm text-yellow-700 mt-2">
                        此策略正在被 {selectedPolicy.usedByCount} 处引用。修改策略配置可能影响相关模块的汇率解析结果。
                      </p>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>引用模块</TableHead>
                          <TableHead>引用类型</TableHead>
                          <TableHead className="text-right">记录数</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>毛利核算快照</TableCell>
                          <TableCell>成本折算</TableCell>
                          <TableCell className="text-right">15</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>简化三表</TableCell>
                          <TableCell>利润表折算</TableCell>
                          <TableCell className="text-right">20</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>平台结算</TableCell>
                          <TableCell>到账折算</TableCell>
                          <TableCell className="text-right">10</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={() => setDetailOpen(false)}>
                    关闭
                  </Button>
                  <Button onClick={() => { setDetailOpen(false); openEdit(selectedPolicy); }}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    编辑
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* 新建/编辑策略抽屉 */}
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{selectedPolicy ? "编辑汇率策略" : "新建汇率策略"}</SheetTitle>
              <SheetDescription>
                配置汇率解析策略的场景域、默认类型、来源优先级与缺失处理规则
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>策略编码 *</Label>
                  <Input placeholder="POLICY_XXX" defaultValue={selectedPolicy?.code} />
                </div>
                <div className="space-y-2">
                  <Label>策略名称 *</Label>
                  <Input placeholder="策略名称" defaultValue={selectedPolicy?.name} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>场景域 *</Label>
                  <Select defaultValue={selectedPolicy?.scenarioDomain || "REPORT"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(scenarioDomainConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label} - {config.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>目标币种 *</Label>
                  <Select defaultValue={selectedPolicy?.targetCurrency || "USD"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CNY">CNY</SelectItem>
                      <SelectItem value="IDR">IDR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>默认汇率集类型 *</Label>
                <Select defaultValue={selectedPolicy?.defaultRateSetType || "PERIOD_FIXED"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERIOD_FIXED">期间固定 - 利润类指标</SelectItem>
                    <SelectItem value="END_PERIOD">期末 - 资产负债类期末</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  PERIOD_FIXED 用于利润类；END_PERIOD 用于资产负债期末余额
                </p>
              </div>

              <div className="space-y-2">
                <Label>枢轴币种</Label>
                <Select defaultValue={selectedPolicy?.pivotCurrency || "USD"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">三角换算时使用的中间币种，默认 USD</p>
              </div>

              <div className="space-y-2">
                <Label>缺失处理 *</Label>
                <Select defaultValue={selectedPolicy?.missingBehavior || "WARN"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(missingBehaviorConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label} - {config.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label>允许 SPOT 参考</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    是否允许在对照工具中选择即期汇率作为参考
                  </p>
                </div>
                <Switch defaultChecked={selectedPolicy?.allowSpotReference || false} />
              </div>

              <div className="space-y-2">
                <Label>备注</Label>
                <Input placeholder="策略用途说明" defaultValue={selectedPolicy?.remark} />
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleSave}>
                  {selectedPolicy ? "保存" : "创建"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Suspense>
  )
}
