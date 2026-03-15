"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Search,
  AlertTriangle,
  XCircle,
  TrendingUp,
  RefreshCw,
  FileText,
  Unlock,
  CheckCircle,
  Clock,
  Eye,
  ChevronRight,
  Download,
  Filter,
  Bell,
  TriangleAlert,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"
import Loading from "./loading"

// AL1｜汇率预警列表页
// 预警类型：缺失/波动/覆盖/三角换算/解锁/导入失败

type AlertType = "MISSING" | "VOLATILITY" | "OVERRIDE" | "TRIANGULATION" | "UNLOCK" | "IMPORT_FAIL"
type AlertSeverity = "HIGH" | "MEDIUM" | "LOW"
type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "IGNORED"

const alertTypeConfig: Record<AlertType, { label: string; color: string; icon: typeof AlertTriangle; description: string }> = {
  MISSING: { label: "缺失", color: "bg-red-100 text-red-700", icon: XCircle, description: "缺少汇率集/缺少汇率集明细" },
  VOLATILITY: { label: "波动", color: "bg-yellow-100 text-yellow-700", icon: TrendingUp, description: "与上期对比超阈值" },
  OVERRIDE: { label: "覆盖", color: "bg-blue-100 text-blue-700", icon: FileText, description: "手工覆盖发生" },
  TRIANGULATION: { label: "三角换算", color: "bg-purple-100 text-purple-700", icon: TriangleAlert, description: "无直接币对被迫三角" },
  UNLOCK: { label: "解锁", color: "bg-orange-100 text-orange-700", icon: Unlock, description: "LOCKED 被解锁（高风险）" },
  IMPORT_FAIL: { label: "导入失败", color: "bg-gray-100 text-gray-700", icon: RefreshCw, description: "批次错误" },
}

const severityConfig: Record<AlertSeverity, { label: string; color: string }> = {
  HIGH: { label: "高", color: "bg-red-500 text-white" },
  MEDIUM: { label: "中", color: "bg-yellow-500 text-white" },
  LOW: { label: "低", color: "bg-blue-500 text-white" },
}

const statusConfig: Record<AlertStatus, { label: string; color: string }> = {
  OPEN: { label: "待处理", color: "bg-red-100 text-red-700" },
  ACKNOWLEDGED: { label: "已确认", color: "bg-yellow-100 text-yellow-700" },
  RESOLVED: { label: "已解决", color: "bg-green-100 text-green-700" },
  IGNORED: { label: "已忽略", color: "bg-gray-100 text-gray-700" },
}

// Mock 预警数据
const mockAlerts = [
  {
    id: "alert_001",
    type: "MISSING" as AlertType,
    severity: "HIGH" as AlertSeverity,
    status: "OPEN" as AlertStatus,
    title: "汇率集缺失",
    message: "GL_CN_BJ_CNY 2026-01 PERIOD_FIXED 汇率集缺失 USD/CNY 币对",
    ledgerId: "ledger_004",
    ledgerName: "BJ法定账本",
    periodCode: "2026-01",
    rateSetType: "PERIOD_FIXED",
    currencyPair: "USD/CNY",
    affectedModule: "毛利核算快照",
    affectedCount: 15,
    createdAt: "2026-01-21 08:00:00",
    acknowledgedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    remark: null,
  },
  {
    id: "alert_002",
    type: "VOLATILITY" as AlertType,
    severity: "MEDIUM" as AlertSeverity,
    status: "ACKNOWLEDGED" as AlertStatus,
    title: "汇率波动异常",
    message: "USD/IDR 期间固定汇率较上期波动 3.5%，超过阈值（2%）",
    ledgerId: "ledger_002",
    ledgerName: "BDG法定账本",
    periodCode: "2026-01",
    rateSetType: "PERIOD_FIXED",
    currencyPair: "USD/IDR",
    affectedModule: "简化三表",
    affectedCount: 8,
    createdAt: "2026-01-21 07:30:00",
    acknowledgedAt: "2026-01-21 09:00:00",
    resolvedAt: null,
    resolvedBy: null,
    remark: "已确认为正常市场波动",
  },
  {
    id: "alert_003",
    type: "OVERRIDE" as AlertType,
    severity: "LOW" as AlertSeverity,
    status: "RESOLVED" as AlertStatus,
    title: "汇率被手工覆盖",
    message: "GL_MGMT_USD 2026-01 期间固定汇率集 USD/IDR 被手工覆盖",
    ledgerId: "ledger_001",
    ledgerName: "集团管理账本",
    periodCode: "2026-01",
    rateSetType: "PERIOD_FIXED",
    currencyPair: "USD/IDR",
    affectedModule: "管理报表",
    affectedCount: 3,
    createdAt: "2026-01-20 16:00:00",
    acknowledgedAt: "2026-01-20 16:30:00",
    resolvedAt: "2026-01-20 17:00:00",
    resolvedBy: "finance_admin",
    remark: "已审批通过，覆盖原因：纠正导入错误",
  },
  {
    id: "alert_004",
    type: "UNLOCK" as AlertType,
    severity: "HIGH" as AlertSeverity,
    status: "OPEN" as AlertStatus,
    title: "汇率集被解锁",
    message: "GL_ID_BDG_IDR 2025-12 END_PERIOD 汇率集被解锁",
    ledgerId: "ledger_002",
    ledgerName: "BDG法定账本",
    periodCode: "2025-12",
    rateSetType: "END_PERIOD",
    currencyPair: null,
    affectedModule: "期末处理",
    affectedCount: 12,
    createdAt: "2026-01-19 10:00:00",
    acknowledgedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    remark: null,
  },
  {
    id: "alert_005",
    type: "TRIANGULATION" as AlertType,
    severity: "MEDIUM" as AlertSeverity,
    status: "OPEN" as AlertStatus,
    title: "使用三角换算",
    message: "CNY/IDR 无直接汇率，使用 USD 作为枢轴币进行三角换算",
    ledgerId: "ledger_004",
    ledgerName: "BJ法定账本",
    periodCode: "2026-01",
    rateSetType: "PERIOD_FIXED",
    currencyPair: "CNY/IDR",
    affectedModule: "跨主体交易",
    affectedCount: 5,
    createdAt: "2026-01-18 14:00:00",
    acknowledgedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    remark: null,
  },
  {
    id: "alert_006",
    type: "IMPORT_FAIL" as AlertType,
    severity: "MEDIUM" as AlertSeverity,
    status: "RESOLVED" as AlertStatus,
    title: "汇率导入失败",
    message: "批次 IMP-2026-001 导入失败，3 行数据校验错误",
    ledgerId: null,
    ledgerName: null,
    periodCode: "2026-01",
    rateSetType: null,
    currencyPair: null,
    affectedModule: "汇率导入",
    affectedCount: 3,
    createdAt: "2026-01-17 11:00:00",
    acknowledgedAt: "2026-01-17 11:30:00",
    resolvedAt: "2026-01-17 12:00:00",
    resolvedBy: "system_admin",
    remark: "已修正数据重新导入",
  },
]

export default function AlertsPage() {
  const searchParams = useSearchParams()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterSeverity, setFilterSeverity] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedAlert, setSelectedAlert] = useState<(typeof mockAlerts)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // 统计
  const stats = {
    total: mockAlerts.length,
    open: mockAlerts.filter((a) => a.status === "OPEN").length,
    high: mockAlerts.filter((a) => a.severity === "HIGH" && a.status === "OPEN").length,
    missing: mockAlerts.filter((a) => a.type === "MISSING" && a.status === "OPEN").length,
    volatility: mockAlerts.filter((a) => a.type === "VOLATILITY" && a.status === "OPEN").length,
    unlock: mockAlerts.filter((a) => a.type === "UNLOCK" && a.status === "OPEN").length,
  }

  // 筛选
  const filteredAlerts = mockAlerts.filter((a) => {
    if (filterType !== "all" && a.type !== filterType) return false
    if (filterSeverity !== "all" && a.severity !== filterSeverity) return false
    if (filterStatus !== "all" && a.status !== filterStatus) return false
    if (searchKeyword && !a.title.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !a.message.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (alert: typeof mockAlerts[0]) => {
    setSelectedAlert(alert)
    setDetailOpen(true)
  }

  const handleAcknowledge = (id: string) => {
    toast.success("预警已确认")
  }

  const handleResolve = (id: string) => {
    toast.success("预警已解决")
  }

  const handleIgnore = (id: string) => {
    toast.success("预警已忽略")
  }

  const handleBatchAcknowledge = () => {
    if (selectedIds.length === 0) {
      toast.error("请选择预警")
      return
    }
    toast.success(`已确认 ${selectedIds.length} 条预警`)
    setSelectedIds([])
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAlerts.filter((a) => a.status === "OPEN").length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredAlerts.filter((a) => a.status === "OPEN").map((a) => a.id))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">汇率预警</h1>
          <p className="text-muted-foreground">
            监控汇率缺失、波动、覆盖、三角换算、解锁、导入失败等异常情况
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          {selectedIds.length > 0 && (
            <Button size="sm" onClick={handleBatchAcknowledge}>
              <CheckCircle className="h-4 w-4 mr-2" />
              批量确认 ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">预警总数</span>
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className={stats.open > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className={`h-4 w-4 ${stats.open > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              <span className={`text-sm ${stats.open > 0 ? "text-red-600" : "text-muted-foreground"}`}>待处理</span>
            </div>
            <div className={`text-2xl font-bold ${stats.open > 0 ? "text-red-700" : ""}`}>{stats.open}</div>
          </CardContent>
        </Card>
        <Card className={stats.high > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-4 w-4 ${stats.high > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              <span className={`text-sm ${stats.high > 0 ? "text-red-600" : "text-muted-foreground"}`}>高优先级</span>
            </div>
            <div className={`text-2xl font-bold ${stats.high > 0 ? "text-red-700" : ""}`}>{stats.high}</div>
          </CardContent>
        </Card>
        <Card className={stats.missing > 0 ? "border-orange-200 bg-orange-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className={`h-4 w-4 ${stats.missing > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
              <span className={`text-sm ${stats.missing > 0 ? "text-orange-600" : "text-muted-foreground"}`}>汇率缺失</span>
            </div>
            <div className={`text-2xl font-bold ${stats.missing > 0 ? "text-orange-700" : ""}`}>{stats.missing}</div>
          </CardContent>
        </Card>
        <Card className={stats.volatility > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={`h-4 w-4 ${stats.volatility > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
              <span className={`text-sm ${stats.volatility > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>波动异常</span>
            </div>
            <div className={`text-2xl font-bold ${stats.volatility > 0 ? "text-yellow-700" : ""}`}>{stats.volatility}</div>
          </CardContent>
        </Card>
        <Card className={stats.unlock > 0 ? "border-purple-200 bg-purple-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Unlock className={`h-4 w-4 ${stats.unlock > 0 ? "text-purple-600" : "text-muted-foreground"}`} />
              <span className={`text-sm ${stats.unlock > 0 ? "text-purple-600" : "text-muted-foreground"}`}>解锁风险</span>
            </div>
            <div className={`text-2xl font-bold ${stats.unlock > 0 ? "text-purple-700" : ""}`}>{stats.unlock}</div>
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
                placeholder="搜索预警标题/内容..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="预警类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(alertTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="严重级别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="HIGH">高</SelectItem>
                <SelectItem value="MEDIUM">中</SelectItem>
                <SelectItem value="LOW">低</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="OPEN">待处理</SelectItem>
                <SelectItem value="ACKNOWLEDGED">已确认</SelectItem>
                <SelectItem value="RESOLVED">已解决</SelectItem>
                <SelectItem value="IGNORED">已忽略</SelectItem>
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
                    checked={selectedIds.length === filteredAlerts.filter((a) => a.status === "OPEN").length && selectedIds.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>级别</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>预警内容</TableHead>
                <TableHead>账本</TableHead>
                <TableHead>期间</TableHead>
                <TableHead>影响模块</TableHead>
                <TableHead className="text-right">影响数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlerts.map((alert) => {
                const typeConfig = alertTypeConfig[alert.type]
                const TypeIcon = typeConfig.icon
                return (
                  <TableRow key={alert.id} className={alert.status === "OPEN" && alert.severity === "HIGH" ? "bg-red-50/50" : ""}>
                    <TableCell>
                      {alert.status === "OPEN" && (
                        <Checkbox
                          checked={selectedIds.includes(alert.id)}
                          onCheckedChange={() => toggleSelect(alert.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={severityConfig[alert.severity].color}>
                        {severityConfig[alert.severity].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4" />
                        <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px]">
                        <div className="font-medium truncate">{alert.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{alert.message}</div>
                      </div>
                    </TableCell>
                    <TableCell>{alert.ledgerName || "-"}</TableCell>
                    <TableCell>{alert.periodCode}</TableCell>
                    <TableCell>{alert.affectedModule}</TableCell>
                    <TableCell className="text-right font-mono">{alert.affectedCount}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig[alert.status].color}>
                        {statusConfig[alert.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {alert.createdAt.split(" ")[0]}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(alert)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {alert.status === "OPEN" && (
                          <Button variant="ghost" size="sm" onClick={() => handleAcknowledge(alert.id)}>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 预警详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedAlert?.title}
              {selectedAlert && (
                <>
                  <Badge className={severityConfig[selectedAlert.severity].color}>
                    {severityConfig[selectedAlert.severity].label}
                  </Badge>
                  <Badge className={statusConfig[selectedAlert.status].color}>
                    {statusConfig[selectedAlert.status].label}
                  </Badge>
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              {selectedAlert?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedAlert && (
            <div className="mt-6 space-y-6">
              {/* 预警类型 */}
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                {(() => {
                  const TypeIcon = alertTypeConfig[selectedAlert.type].icon
                  return <TypeIcon className="h-6 w-6" />
                })()}
                <div>
                  <Badge className={alertTypeConfig[selectedAlert.type].color}>
                    {alertTypeConfig[selectedAlert.type].label}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    {alertTypeConfig[selectedAlert.type].description}
                  </p>
                </div>
              </div>

              {/* 预警内容 */}
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm">{selectedAlert.message}</p>
              </div>

              {/* 详细信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">账本</div>
                  <div className="font-medium mt-1">{selectedAlert.ledgerName || "-"}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">期间</div>
                  <div className="font-medium mt-1">{selectedAlert.periodCode}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">汇率集类型</div>
                  <div className="font-medium mt-1">{selectedAlert.rateSetType || "-"}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">币对</div>
                  <div className="font-medium mt-1">{selectedAlert.currencyPair || "-"}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">影响模块</div>
                  <div className="font-medium mt-1">{selectedAlert.affectedModule}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">影响记录数</div>
                  <div className="font-medium mt-1">{selectedAlert.affectedCount}</div>
                </div>
              </div>

              {/* 时间线 */}
              <div className="space-y-3">
                <h4 className="font-medium">处理时间线</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">创建时间: {selectedAlert.createdAt}</span>
                  </div>
                  {selectedAlert.acknowledgedAt && (
                    <div className="flex items-center gap-3 p-2 bg-yellow-50 rounded">
                      <CheckCircle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm">确认时间: {selectedAlert.acknowledgedAt}</span>
                    </div>
                  )}
                  {selectedAlert.resolvedAt && (
                    <div className="flex items-center gap-3 p-2 bg-green-50 rounded">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">解决时间: {selectedAlert.resolvedAt} | 处理人: {selectedAlert.resolvedBy}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 备注 */}
              {selectedAlert.remark && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">处理备注</div>
                  <div>{selectedAlert.remark}</div>
                </div>
              )}

              {/* 操作按钮 */}
              {selectedAlert.status === "OPEN" && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => handleIgnore(selectedAlert.id)}>
                    忽略
                  </Button>
                  <Button variant="outline" onClick={() => handleAcknowledge(selectedAlert.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    确认
                  </Button>
                  <Button onClick={() => handleResolve(selectedAlert.id)}>
                    标记解决
                  </Button>
                </div>
              )}

              {selectedAlert.status === "ACKNOWLEDGED" && (
                <div className="flex justify-end gap-2">
                  <Button onClick={() => handleResolve(selectedAlert.id)}>
                    标记解决
                  </Button>
                </div>
              )}

              {/* 快捷跳转 */}
              {selectedAlert.type === "MISSING" && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">快捷操作</h4>
                  <div className="flex gap-2">
                    <Link href="/bfis/settings/currency/rate-sets">
                      <Button variant="outline" size="sm">
                        前往汇率集 <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                    <Link href="/bfis/settings/currency/import">
                      <Button variant="outline" size="sm">
                        导入汇率 <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
