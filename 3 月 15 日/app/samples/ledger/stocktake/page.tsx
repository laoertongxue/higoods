"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, RefreshCw, Download, Eye, FileText, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"

// L4 - Stocktake Difference Tracking Page

const DIFF_STATUS = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待处理" },
  { value: "investigating", label: "追踪中" },
  { value: "resolved", label: "已解决" },
  { value: "written_off", label: "已核销" },
]

const mockStocktakeDiffs = [
  {
    id: "STD-20260118-001",
    stocktakeId: "ST-20260118-001",
    stocktakeName: "月度盘点-深圳仓-2026年1月",
    site: "shenzhen",
    sampleCode: "SY-2026-004",
    sampleName: "度假风露背上衣-样衣A",
    systemQty: 1,
    countQty: 0,
    diffQty: -1,
    diffType: "shortage",
    status: "investigating",
    assignee: "样管-李娜",
    discoveredAt: "2026-01-18 10:15:00",
    lastLocation: "深圳仓-A3-02",
    lastEvent: "领用出库",
    lastEventAt: "2026-01-10 14:00:00",
    lastHolder: "主播-小红",
    investigationNotes: "正在联系最后持有人确认是否已归还",
    attachments: [{ name: "盘点差异照片.jpg", type: "image" }],
    resolution: null,
    resolvedAt: null,
    resolvedBy: null,
  },
  {
    id: "STD-20260118-002",
    stocktakeId: "ST-20260118-001",
    stocktakeName: "月度盘点-深圳仓-2026年1月",
    site: "shenzhen",
    sampleCode: "SY-2025-066",
    sampleName: "夏季碎花连衣裙-样衣B",
    systemQty: 1,
    countQty: 0,
    diffQty: -1,
    diffType: "shortage",
    status: "resolved",
    assignee: "样管-张明",
    discoveredAt: "2026-01-18 10:30:00",
    lastLocation: "深圳仓-B1-05",
    lastEvent: "归还入库",
    lastEventAt: "2026-01-05 16:00:00",
    lastHolder: null,
    investigationNotes: "经核查，样衣已在2026-01-12被错误归档到D区",
    attachments: [{ name: "实际位置照片.jpg", type: "image" }],
    resolution: "库位记录错误，已更正至D1-03",
    resolvedAt: "2026-01-18 14:00:00",
    resolvedBy: "样管-张明",
  },
  {
    id: "STD-20260118-003",
    stocktakeId: "ST-20260118-001",
    stocktakeName: "月度盘点-深圳仓-2026年1月",
    site: "shenzhen",
    sampleCode: "SY-2025-089",
    sampleName: "基础款白色衬衫-样衣A",
    systemQty: 0,
    countQty: 1,
    diffQty: 1,
    diffType: "surplus",
    status: "pending",
    assignee: null,
    discoveredAt: "2026-01-18 11:00:00",
    lastLocation: null,
    lastEvent: null,
    lastEventAt: null,
    lastHolder: null,
    investigationNotes: "发现未入系统的样衣，需补录",
    attachments: [{ name: "多余样衣照片.jpg", type: "image" }],
    resolution: null,
    resolvedAt: null,
    resolvedBy: null,
  },
  {
    id: "STD-20260115-001",
    stocktakeId: "ST-20260115-002",
    stocktakeName: "抽盘-雅加达仓",
    site: "jakarta",
    sampleCode: "SY-2025-102",
    sampleName: "印尼风格蜡染裙-样衣A",
    systemQty: 1,
    countQty: 0,
    diffQty: -1,
    diffType: "shortage",
    status: "written_off",
    assignee: "仓管-Andi",
    discoveredAt: "2026-01-15 15:00:00",
    lastLocation: "雅加达仓-A1-01",
    lastEvent: "核对入库",
    lastEventAt: "2025-12-20 10:00:00",
    lastHolder: null,
    investigationNotes: "经多方核查无法找回，确认遗失",
    attachments: [{ name: "核销审批单.pdf", type: "pdf" }],
    resolution: "确认遗失，已核销处理",
    resolvedAt: "2026-01-16 10:00:00",
    resolvedBy: "仓管-Andi",
  },
]

export default function StocktakeDiffPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [site, setSite] = useState("all")
  const [selectedDiff, setSelectedDiff] = useState<(typeof mockStocktakeDiffs)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const filteredDiffs = useMemo(() => {
    return mockStocktakeDiffs.filter((diff) => {
      if (
        search &&
        !diff.sampleCode.toLowerCase().includes(search.toLowerCase()) &&
        !diff.sampleName.toLowerCase().includes(search.toLowerCase())
      )
        return false
      if (status !== "all" && diff.status !== status) return false
      if (site !== "all" && diff.site !== site) return false
      return true
    })
  }, [search, status, site])

  const stats = useMemo(
    () => ({
      total: mockStocktakeDiffs.length,
      pending: mockStocktakeDiffs.filter((d) => d.status === "pending").length,
      investigating: mockStocktakeDiffs.filter((d) => d.status === "investigating").length,
      resolved: mockStocktakeDiffs.filter((d) => d.status === "resolved").length,
      writtenOff: mockStocktakeDiffs.filter((d) => d.status === "written_off").length,
      shortage: mockStocktakeDiffs.filter((d) => d.diffType === "shortage").length,
      surplus: mockStocktakeDiffs.filter((d) => d.diffType === "surplus").length,
    }),
    [],
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            待处理
          </Badge>
        )
      case "investigating":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            追踪中
          </Badge>
        )
      case "resolved":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            已解决
          </Badge>
        )
      case "written_off":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            已核销
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getDiffTypeBadge = (type: string, qty: number) => {
    if (type === "shortage") {
      return <Badge variant="destructive">{qty} 短缺</Badge>
    } else {
      return <Badge className="bg-blue-100 text-blue-800">+{qty} 盈余</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">盘点差异追踪</h1>
              <p className="text-muted-foreground text-sm mt-1">追踪和处理盘点过程中发现的库存差异</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.success("数据已刷新")}>
                <RefreshCw className="h-4 w-4 mr-1" />
                刷新
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.success("已导出差异报告")}>
                <Download className="h-4 w-4 mr-1" />
                导出
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">全部差异</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-yellow-400" onClick={() => setStatus("pending")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-sm text-muted-foreground">待处理</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-blue-400" onClick={() => setStatus("investigating")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.investigating}</div>
                <div className="text-sm text-muted-foreground">追踪中</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-green-400" onClick={() => setStatus("resolved")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
                <div className="text-sm text-muted-foreground">已解决</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{stats.shortage}</div>
                <div className="text-sm text-muted-foreground">短缺</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.surplus}</div>
                <div className="text-sm text-muted-foreground">盈余</div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索样衣编号/名称..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFF_STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={site} onValueChange={setSite}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部站点</SelectItem>
                    <SelectItem value="shenzhen">深圳</SelectItem>
                    <SelectItem value="jakarta">雅加达</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("")
                    setStatus("all")
                    setSite("all")
                  }}
                >
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>差异编号</TableHead>
                    <TableHead>盘点单</TableHead>
                    <TableHead>样衣</TableHead>
                    <TableHead className="text-center">系统</TableHead>
                    <TableHead className="text-center">实盘</TableHead>
                    <TableHead className="text-center">差异</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>负责人</TableHead>
                    <TableHead>发现时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDiffs.map((diff) => (
                    <TableRow key={diff.id}>
                      <TableCell className="font-mono text-sm">{diff.id}</TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          className="p-0 h-auto text-sm"
                          onClick={() => toast.info(`打开盘点单: ${diff.stocktakeId}`)}
                        >
                          {diff.stocktakeId}
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          {diff.site === "shenzhen" ? "深圳" : "雅加达"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{diff.sampleCode}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">{diff.sampleName}</div>
                      </TableCell>
                      <TableCell className="text-center">{diff.systemQty}</TableCell>
                      <TableCell className="text-center">{diff.countQty}</TableCell>
                      <TableCell className="text-center">
                        {getDiffTypeBadge(diff.diffType, Math.abs(diff.diffQty))}
                      </TableCell>
                      <TableCell>{getStatusBadge(diff.status)}</TableCell>
                      <TableCell>{diff.assignee || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-sm">{diff.discoveredAt}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedDiff(diff)
                            setDetailOpen(true)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Detail Drawer */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedDiff && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  {getDiffTypeBadge(selectedDiff.diffType, Math.abs(selectedDiff.diffQty))}
                  {getStatusBadge(selectedDiff.status)}
                </div>
                <SheetTitle className="text-left mt-2">差异追踪: {selectedDiff.id}</SheetTitle>
              </SheetHeader>

              <Tabs defaultValue="info" className="mt-6">
                <TabsList>
                  <TabsTrigger value="info">差异信息</TabsTrigger>
                  <TabsTrigger value="trace">追踪记录</TabsTrigger>
                  <TabsTrigger value="evidence">证据附件</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <div>
                    <h3 className="font-semibold mb-3">样衣信息</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">样衣编号</div>
                        <div className="font-medium">{selectedDiff.sampleCode}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">样衣名称</div>
                        <div>{selectedDiff.sampleName}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">差异详情</h3>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-muted/50 rounded">
                        <div className="text-2xl font-bold">{selectedDiff.systemQty}</div>
                        <div className="text-xs text-muted-foreground">系统数量</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded">
                        <div className="text-2xl font-bold">{selectedDiff.countQty}</div>
                        <div className="text-xs text-muted-foreground">实盘数量</div>
                      </div>
                      <div className={`p-3 rounded ${selectedDiff.diffQty < 0 ? "bg-red-50" : "bg-blue-50"}`}>
                        <div
                          className={`text-2xl font-bold ${selectedDiff.diffQty < 0 ? "text-red-600" : "text-blue-600"}`}
                        >
                          {selectedDiff.diffQty > 0 ? "+" : ""}
                          {selectedDiff.diffQty}
                        </div>
                        <div className="text-xs text-muted-foreground">差异</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">盘点来源</h3>
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">盘点单</span>
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => toast.info(`打开盘点单: ${selectedDiff.stocktakeId}`)}
                        >
                          {selectedDiff.stocktakeId}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">盘点名称</span>
                        <span>{selectedDiff.stocktakeName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">发现时间</span>
                        <span>{selectedDiff.discoveredAt}</span>
                      </div>
                    </div>
                  </div>

                  {selectedDiff.lastLocation && (
                    <div>
                      <h3 className="font-semibold mb-3">最后已知状态</h3>
                      <div className="text-sm space-y-2 bg-muted/50 p-3 rounded">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">最后位置</span>
                          <span>{selectedDiff.lastLocation}</span>
                        </div>
                        {selectedDiff.lastEvent && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">最后事件</span>
                            <span>{selectedDiff.lastEvent}</span>
                          </div>
                        )}
                        {selectedDiff.lastEventAt && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">事件时间</span>
                            <span>{selectedDiff.lastEventAt}</span>
                          </div>
                        )}
                        {selectedDiff.lastHolder && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">最后持有人</span>
                            <span>{selectedDiff.lastHolder}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedDiff.resolution && (
                    <div>
                      <h3 className="font-semibold mb-3">处理结果</h3>
                      <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                        <div className="font-medium text-green-800">{selectedDiff.resolution}</div>
                        <div className="text-green-600 mt-2">
                          处理人: {selectedDiff.resolvedBy} | 处理时间: {selectedDiff.resolvedAt}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="trace" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    {selectedDiff.investigationNotes && (
                      <div className="p-3 border rounded">
                        <div className="text-sm font-medium mb-1">追踪备注</div>
                        <div className="text-sm text-muted-foreground">{selectedDiff.investigationNotes}</div>
                      </div>
                    )}
                    <div className="p-3 border rounded">
                      <div className="text-sm font-medium mb-1">负责人</div>
                      <div className="text-sm">{selectedDiff.assignee || "未分配"}</div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="evidence" className="space-y-4 mt-4">
                  {selectedDiff.attachments && selectedDiff.attachments.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedDiff.attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-3 border rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() => toast.info(`查看附件: ${att.name}`)}
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-8">暂无附件</div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Actions */}
              {selectedDiff.status === "pending" && (
                <div className="mt-6 pt-4 border-t flex gap-2">
                  <Button onClick={() => toast.success("已分配追踪任务")}>分配负责人</Button>
                  <Button variant="outline" onClick={() => toast.success("已标记为追踪中")}>
                    开始追踪
                  </Button>
                </div>
              )}
              {selectedDiff.status === "investigating" && (
                <div className="mt-6 pt-4 border-t flex gap-2">
                  <Button onClick={() => toast.success("差异已解决")}>标记已解决</Button>
                  <Button variant="outline" onClick={() => toast.success("已申请核销")}>
                    申请核销
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
