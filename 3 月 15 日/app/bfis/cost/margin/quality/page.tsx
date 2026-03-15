"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  Search,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  Filter,
  ChevronRight,
  ExternalLink,
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
import LoadingComponent from "./loading"
import Loading from "./loading" // Declare the Loading variable

// GM4 毛利差异与数据质量问题列表页

type IssueType = "COST_MISSING" | "FEE_MISSING" | "FX_MISSING" | "MARGIN_ANOMALY" | "DATA_MISMATCH" | "REVERSAL_PENDING"
type IssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "IGNORED"
type IssueSeverity = "HIGH" | "MEDIUM" | "LOW"

const issueTypeConfig: Record<IssueType, { label: string; color: string }> = {
  COST_MISSING: { label: "成本缺失", color: "bg-red-100 text-red-700" },
  FEE_MISSING: { label: "费用缺失", color: "bg-orange-100 text-orange-700" },
  FX_MISSING: { label: "汇率缺失", color: "bg-yellow-100 text-yellow-700" },
  MARGIN_ANOMALY: { label: "毛利异常", color: "bg-purple-100 text-purple-700" },
  DATA_MISMATCH: { label: "数据不一致", color: "bg-blue-100 text-blue-700" },
  REVERSAL_PENDING: { label: "待冲回", color: "bg-pink-100 text-pink-700" },
}

const issueStatusConfig: Record<IssueStatus, { label: string; color: string }> = {
  OPEN: { label: "待处理", color: "bg-red-100 text-red-700" },
  IN_PROGRESS: { label: "处理中", color: "bg-yellow-100 text-yellow-700" },
  RESOLVED: { label: "已解决", color: "bg-green-100 text-green-700" },
  IGNORED: { label: "已忽略", color: "bg-gray-100 text-gray-700" },
}

const severityConfig: Record<IssueSeverity, { label: string; color: string }> = {
  HIGH: { label: "高", color: "bg-red-500 text-white" },
  MEDIUM: { label: "中", color: "bg-yellow-500 text-white" },
  LOW: { label: "低", color: "bg-blue-500 text-white" },
}

// Mock 数据质量问题
const mockIssues = [
  {
    id: "DQ-2026-001",
    issueType: "COST_MISSING" as IssueType,
    severity: "HIGH" as IssueSeverity,
    status: "OPEN" as IssueStatus,
    snapshotDate: "2026-01-16",
    affectedOrders: 45,
    affectedAmountUSD: 12500,
    description: "45个订单行缺少成本数据，涉及SKU: SKU-003, SKU-007, SKU-012",
    rootCause: "新SKU未录入标准成本",
    suggestedAction: "补录SKU标准成本或使用暂估成本",
    relatedSnapshot: "GMS-2026-0116",
    createdAt: "2026-01-17 06:00",
    updatedAt: "2026-01-17 06:00",
  },
  {
    id: "DQ-2026-002",
    issueType: "FEE_MISSING" as IssueType,
    severity: "MEDIUM" as IssueSeverity,
    status: "IN_PROGRESS" as IssueStatus,
    snapshotDate: "2026-01-15",
    affectedOrders: 23,
    affectedAmountUSD: 3200,
    description: "TikTok平台费用数据延迟，23个订单缺少平台手续费",
    rootCause: "平台API数据同步延迟",
    suggestedAction: "等待平台数据同步或手动补录",
    relatedSnapshot: "GMS-2026-0115",
    createdAt: "2026-01-16 06:00",
    updatedAt: "2026-01-17 10:30",
    assignee: "张三",
  },
  {
    id: "DQ-2026-003",
    issueType: "MARGIN_ANOMALY" as IssueType,
    severity: "HIGH" as IssueSeverity,
    status: "OPEN" as IssueStatus,
    snapshotDate: "2026-01-14",
    affectedOrders: 12,
    affectedAmountUSD: 8900,
    description: "12个订单毛利率低于-50%，疑似数据异常",
    rootCause: "待排查：可能是成本错误或价格异常",
    suggestedAction: "人工复核订单数据",
    relatedSnapshot: "GMS-2026-0114",
    createdAt: "2026-01-15 06:00",
    updatedAt: "2026-01-15 06:00",
  },
  {
    id: "DQ-2026-004",
    issueType: "REVERSAL_PENDING" as IssueType,
    severity: "MEDIUM" as IssueSeverity,
    status: "OPEN" as IssueStatus,
    snapshotDate: "2026-01-13",
    affectedOrders: 8,
    affectedAmountUSD: 2100,
    description: "8个预售取消订单待冲回毛利",
    rootCause: "预售批次取消，暂估成本需冲回",
    suggestedAction: "执行预售取消冲回流程",
    relatedSnapshot: "GMS-2026-0113",
    createdAt: "2026-01-14 06:00",
    updatedAt: "2026-01-14 06:00",
  },
  {
    id: "DQ-2026-005",
    issueType: "FX_MISSING" as IssueType,
    severity: "LOW" as IssueSeverity,
    status: "RESOLVED" as IssueStatus,
    snapshotDate: "2026-01-12",
    affectedOrders: 156,
    affectedAmountUSD: 0,
    description: "2026-01-12 IDR/USD汇率缺失，已使用最近汇率降级处理",
    rootCause: "汇率数据源节假日未更新",
    suggestedAction: "确认降级汇率是否合理",
    relatedSnapshot: "GMS-2026-0112",
    createdAt: "2026-01-13 06:00",
    updatedAt: "2026-01-13 10:00",
    resolvedBy: "系统",
    resolution: "使用2026-01-11汇率，差异可忽略",
  },
  {
    id: "DQ-2026-006",
    issueType: "DATA_MISMATCH" as IssueType,
    severity: "MEDIUM" as IssueSeverity,
    status: "IGNORED" as IssueStatus,
    snapshotDate: "2026-01-10",
    affectedOrders: 5,
    affectedAmountUSD: 450,
    description: "5个订单平台GMV与系统GMV差异超过1%",
    rootCause: "平台促销补贴计入方式差异",
    suggestedAction: "确认口径差异是否可接受",
    relatedSnapshot: "GMS-2026-0110",
    createdAt: "2026-01-11 06:00",
    updatedAt: "2026-01-12 09:00",
    ignoredBy: "李四",
    ignoreReason: "口径差异在可接受范围内",
  },
]

// Mock 受影响订单明细
const mockAffectedOrders = [
  { orderId: "ORD-2026-0116-001", sku: "SKU-003", amount: 450000, issue: "成本缺失", status: "OPEN" },
  { orderId: "ORD-2026-0116-002", sku: "SKU-007", amount: 280000, issue: "成本缺失", status: "OPEN" },
  { orderId: "ORD-2026-0116-003", sku: "SKU-012", amount: 320000, issue: "成本缺失", status: "OPEN" },
]

export default function MarginQualityPage() {
  const searchParams = useSearchParams()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterSeverity, setFilterSeverity] = useState("all")
  const [selectedIssue, setSelectedIssue] = useState<(typeof mockIssues)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  // KPI统计
  const stats = {
    total: mockIssues.length,
    open: mockIssues.filter((i) => i.status === "OPEN").length,
    inProgress: mockIssues.filter((i) => i.status === "IN_PROGRESS").length,
    highSeverity: mockIssues.filter((i) => i.severity === "HIGH" && i.status === "OPEN").length,
    totalAffectedUSD: mockIssues.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS")
      .reduce((sum, i) => sum + i.affectedAmountUSD, 0),
    resolved7d: mockIssues.filter((i) => i.status === "RESOLVED").length,
  }

  // 筛选
  const filteredIssues = mockIssues.filter((i) => {
    if (filterType !== "all" && i.issueType !== filterType) return false
    if (filterStatus !== "all" && i.status !== filterStatus) return false
    if (filterSeverity !== "all" && i.severity !== filterSeverity) return false
    if (searchKeyword && !i.id.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !i.description.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (issue: typeof mockIssues[0]) => {
    setSelectedIssue(issue)
    setDetailOpen(true)
    setActiveTab("overview")
  }

  const handleResolve = () => {
    toast.success("问题已标记为已解决")
    setDetailOpen(false)
  }

  const handleIgnore = () => {
    toast.success("问题已忽略")
    setDetailOpen(false)
  }

  const handleCreateWorkOrder = () => {
    toast.success("工单已创建")
  }

  return (
    <Suspense fallback={<Loading />}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">毛利差异与数据质量</h1>
          <p className="text-muted-foreground">监控毛利计算中的数据质量问题，支持问题追踪与处理</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新检测
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">问题总数</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className={stats.open > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className={`text-sm mb-1 ${stats.open > 0 ? "text-red-600" : "text-muted-foreground"}`}>待处理</div>
            <div className={`text-2xl font-bold ${stats.open > 0 ? "text-red-700" : ""}`}>{stats.open}</div>
          </CardContent>
        </Card>
        <Card className={stats.inProgress > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
          <CardContent className="p-4">
            <div className={`text-sm mb-1 ${stats.inProgress > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>处理中</div>
            <div className={`text-2xl font-bold ${stats.inProgress > 0 ? "text-yellow-700" : ""}`}>{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className={stats.highSeverity > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className={`text-sm mb-1 ${stats.highSeverity > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                高优先级
              </div>
            </div>
            <div className={`text-2xl font-bold ${stats.highSeverity > 0 ? "text-red-700" : ""}`}>{stats.highSeverity}</div>
          </CardContent>
        </Card>
        <Card className={stats.totalAffectedUSD > 0 ? "border-orange-200 bg-orange-50" : ""}>
          <CardContent className="p-4">
            <div className={`text-sm mb-1 ${stats.totalAffectedUSD > 0 ? "text-orange-600" : "text-muted-foreground"}`}>影响金额 (USD)</div>
            <div className={`text-2xl font-bold ${stats.totalAffectedUSD > 0 ? "text-orange-700" : ""}`}>
              ${stats.totalAffectedUSD.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="text-sm text-green-600 mb-1">近7天解决</div>
            <div className="text-2xl font-bold text-green-700">{stats.resolved7d}</div>
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
                placeholder="搜索问题ID/描述..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="问题类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="COST_MISSING">成本缺失</SelectItem>
                <SelectItem value="FEE_MISSING">费用缺失</SelectItem>
                <SelectItem value="FX_MISSING">汇率缺失</SelectItem>
                <SelectItem value="MARGIN_ANOMALY">毛利异常</SelectItem>
                <SelectItem value="DATA_MISMATCH">数据不一致</SelectItem>
                <SelectItem value="REVERSAL_PENDING">待冲回</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="OPEN">待处理</SelectItem>
                <SelectItem value="IN_PROGRESS">处理中</SelectItem>
                <SelectItem value="RESOLVED">已解决</SelectItem>
                <SelectItem value="IGNORED">已忽略</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="严重程度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="HIGH">高</SelectItem>
                <SelectItem value="MEDIUM">中</SelectItem>
                <SelectItem value="LOW">低</SelectItem>
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
                <TableHead>问题ID</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>严重程度</TableHead>
                <TableHead>快照日期</TableHead>
                <TableHead className="text-right">影响订单数</TableHead>
                <TableHead className="text-right">影响金额 (USD)</TableHead>
                <TableHead>问题描述</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIssues.map((issue) => (
                <TableRow key={issue.id} className={issue.status === "OPEN" && issue.severity === "HIGH" ? "bg-red-50/50" : ""}>
                  <TableCell className="font-mono text-sm">{issue.id}</TableCell>
                  <TableCell>
                    <Badge className={issueTypeConfig[issue.issueType].color}>
                      {issueTypeConfig[issue.issueType].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={severityConfig[issue.severity].color}>
                      {severityConfig[issue.severity].label}
                    </Badge>
                  </TableCell>
                  <TableCell>{issue.snapshotDate}</TableCell>
                  <TableCell className="text-right font-mono">{issue.affectedOrders}</TableCell>
                  <TableCell className="text-right font-mono">${issue.affectedAmountUSD.toLocaleString()}</TableCell>
                  <TableCell className="max-w-[250px] truncate text-sm" title={issue.description}>
                    {issue.description}
                  </TableCell>
                  <TableCell>
                    <Badge className={issueStatusConfig[issue.status].color}>
                      {issueStatusConfig[issue.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{issue.updatedAt}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openDetail(issue)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedIssue?.id}
              {selectedIssue && (
                <>
                  <Badge className={issueTypeConfig[selectedIssue.issueType].color}>
                    {issueTypeConfig[selectedIssue.issueType].label}
                  </Badge>
                  <Badge className={severityConfig[selectedIssue.severity].color}>
                    {severityConfig[selectedIssue.severity].label}
                  </Badge>
                  <Badge className={issueStatusConfig[selectedIssue.status].color}>
                    {issueStatusConfig[selectedIssue.status].label}
                  </Badge>
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              快照日期: {selectedIssue?.snapshotDate} | 关联快照: {selectedIssue?.relatedSnapshot}
            </SheetDescription>
          </SheetHeader>

          {selectedIssue && (
            <div className="mt-6">
              {/* Action Buttons */}
              {(selectedIssue.status === "OPEN" || selectedIssue.status === "IN_PROGRESS") && (
                <div className="flex items-center gap-2 mb-6">
                  <Button size="sm" onClick={handleResolve}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    标记已解决
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleIgnore}>
                    <XCircle className="h-4 w-4 mr-2" />
                    忽略
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCreateWorkOrder}>
                    <FileText className="h-4 w-4 mr-2" />
                    创建工单
                  </Button>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    查看快照
                  </Button>
                </div>
              )}

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-orange-50 rounded-lg text-center">
                  <div className="text-sm text-orange-600 mb-1">影响订单数</div>
                  <div className="text-xl font-bold text-orange-700">{selectedIssue.affectedOrders}</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <div className="text-sm text-red-600 mb-1">影响金额 (USD)</div>
                  <div className="text-xl font-bold text-red-700">${selectedIssue.affectedAmountUSD.toLocaleString()}</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <div className="text-sm text-muted-foreground mb-1">创建时间</div>
                  <div className="text-sm font-medium">{selectedIssue.createdAt}</div>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="overview">问题详情</TabsTrigger>
                  <TabsTrigger value="orders">受影响订单</TabsTrigger>
                  <TabsTrigger value="history">处理历史</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <Label className="text-sm text-muted-foreground">问题描述</Label>
                      <p className="mt-1">{selectedIssue.description}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <Label className="text-sm text-muted-foreground">根因分析</Label>
                      <p className="mt-1">{selectedIssue.rootCause}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <Label className="text-sm text-blue-600">建议处理方式</Label>
                      <p className="mt-1 text-blue-800">{selectedIssue.suggestedAction}</p>
                    </div>

                    {selectedIssue.status === "RESOLVED" && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-green-800">已解决</span>
                        </div>
                        <p className="text-sm text-green-700">
                          解决人: {(selectedIssue as typeof selectedIssue & { resolvedBy?: string }).resolvedBy} | 
                          解决方案: {(selectedIssue as typeof selectedIssue & { resolution?: string }).resolution}
                        </p>
                      </div>
                    )}

                    {selectedIssue.status === "IGNORED" && (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="h-5 w-5 text-gray-600" />
                          <span className="font-medium text-gray-800">已忽略</span>
                        </div>
                        <p className="text-sm text-gray-700">
                          忽略人: {(selectedIssue as typeof selectedIssue & { ignoredBy?: string }).ignoredBy} | 
                          忽略原因: {(selectedIssue as typeof selectedIssue & { ignoreReason?: string }).ignoreReason}
                        </p>
                      </div>
                    )}

                    {selectedIssue.assignee && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <Label className="text-sm text-muted-foreground">当前处理人</Label>
                        <p className="mt-1">{selectedIssue.assignee}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="orders" className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>订单号</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">金额 (IDR)</TableHead>
                        <TableHead>问题</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockAffectedOrders.map((order) => (
                        <TableRow key={order.orderId}>
                          <TableCell className="font-mono text-sm">{order.orderId}</TableCell>
                          <TableCell className="font-mono text-sm">{order.sku}</TableCell>
                          <TableCell className="text-right font-mono">{order.amount.toLocaleString()}</TableCell>
                          <TableCell>{order.issue}</TableCell>
                          <TableCell>
                            <Badge className={issueStatusConfig[order.status as IssueStatus].color}>
                              {issueStatusConfig[order.status as IssueStatus].label}
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

                <TabsContent value="history" className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { time: selectedIssue.updatedAt, action: "状态更新", user: selectedIssue.assignee || "系统", detail: `状态变更为 ${issueStatusConfig[selectedIssue.status].label}` },
                      { time: selectedIssue.createdAt, action: "问题创建", user: "系统", detail: "毛利快照生成时自动检测到问题" },
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
    </div>
    </Suspense>
  )
}
