"use client"

import { useState } from "react"
import { Search, Download, Eye, Plus, CheckCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

// RE1 平台对账任务列表页 + RE2 对账差异明细与工单页

type ReconStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
type DiffType = "MISSING" | "EXTRA" | "AMOUNT_DIFF" | "TIME_DIFF" | "ADJUSTMENT_DIFF" | "FX_DIFF"

const statusConfig: Record<ReconStatus, { label: string; color: string }> = {
  OPEN: { label: "待处理", color: "bg-yellow-100 text-yellow-700" },
  IN_PROGRESS: { label: "处理中", color: "bg-blue-100 text-blue-700" },
  RESOLVED: { label: "已解决", color: "bg-green-100 text-green-700" },
  CLOSED: { label: "已关闭", color: "bg-gray-100 text-gray-700" },
}

const diffTypeConfig: Record<DiffType, { label: string; color: string }> = {
  MISSING: { label: "缺单", color: "bg-red-100 text-red-700" },
  EXTRA: { label: "多单", color: "bg-orange-100 text-orange-700" },
  AMOUNT_DIFF: { label: "金额差异", color: "bg-purple-100 text-purple-700" },
  TIME_DIFF: { label: "时间差异", color: "bg-blue-100 text-blue-700" },
  ADJUSTMENT_DIFF: { label: "调账差异", color: "bg-yellow-100 text-yellow-700" },
  FX_DIFF: { label: "汇率差异", color: "bg-cyan-100 text-cyan-700" },
}

// Mock 数据 - 对账任务
const mockReconTasks = [
  {
    id: "RECON-2026-001",
    reconScope: "STATEMENT_VS_RECEIVABLE",
    storeAccountId: "STORE-TT-001",
    storeName: "TikTok印尼主店",
    channel: "TIKTOK",
    periodFrom: "2026-01-01",
    periodTo: "2026-01-15",
    statementAmount: 112500000,
    receivableAmount: 112500000,
    diffAmount: 0,
    diffAmountUSD: 0,
    diffCount: 0,
    status: "CLOSED" as ReconStatus,
    createdAt: "2026-01-16 12:00:00",
    closedAt: "2026-01-16 14:00:00",
  },
  {
    id: "RECON-2026-002",
    reconScope: "PAYOUT_VS_BANK",
    storeAccountId: "STORE-SP-002",
    storeName: "Shopee马来店",
    channel: "SHOPEE",
    periodFrom: "2025-12-16",
    periodTo: "2025-12-31",
    statementAmount: 45000,
    receivableAmount: 45000,
    diffAmount: 500,
    diffAmountUSD: 114,
    diffCount: 1,
    status: "OPEN" as ReconStatus,
    createdAt: "2026-01-10 09:00:00",
    closedAt: null,
  },
]

// Mock 数据 - 差异明细
const mockDiffItems = [
  {
    id: "DIFF-2026-001",
    reconId: "RECON-2026-002",
    diffType: "AMOUNT_DIFF" as DiffType,
    diffAmount: 500,
    diffAmountUSD: 114,
    currency: "MYR",
    relatedStatementId: "PS-2026-006",
    relatedReceivableId: "AR-2026-006",
    relatedWithdrawalId: "WD-2026-002",
    relatedBankTxnId: null,
    owner: "财务张三",
    slaDueAt: "2026-01-17 18:00:00",
    status: "OPEN" as ReconStatus,
    workorderId: null,
    description: "提现金额与银行入账金额差异500 MYR",
    createdAt: "2026-01-10 09:00:00",
  },
]

export default function PlatformReconcilePage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedTask, setSelectedTask] = useState<(typeof mockReconTasks)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createWorkorderOpen, setCreateWorkorderOpen] = useState(false)
  const [selectedDiff, setSelectedDiff] = useState<(typeof mockDiffItems)[0] | null>(null)
  const [createReconOpen, setCreateReconOpen] = useState(false)

  // 筛选
  const filteredTasks = mockReconTasks.filter((item) => {
    if (
      searchKeyword &&
      !item.id.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !item.storeName.toLowerCase().includes(searchKeyword.toLowerCase())
    )
      return false
    if (filterStatus !== "all" && item.status !== filterStatus) return false
    return true
  })

  // KPI统计
  const kpiStats = {
    total: mockReconTasks.length,
    open: mockReconTasks.filter((t) => t.status === "OPEN").length,
    inProgress: mockReconTasks.filter((t) => t.status === "IN_PROGRESS").length,
    totalDiffUSD: mockReconTasks.reduce((sum, t) => sum + t.diffAmountUSD, 0),
  }

  const openDetail = (item: (typeof mockReconTasks)[0]) => {
    setSelectedTask(item)
    setDetailOpen(true)
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "IDR") return `Rp ${amount.toLocaleString()}`
    if (currency === "MYR") return `RM ${amount.toLocaleString()}`
    return `${currency} ${amount.toLocaleString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">平台对账</h1>
          <p className="text-muted-foreground">平台账单与应收、提现与银行流水对账</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            发起对账
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">全部对账任务</div>
            <div className="text-2xl font-bold">{kpiStats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="text-sm text-yellow-600 mb-1">待处理</div>
            <div className="text-2xl font-bold text-yellow-700">{kpiStats.open}</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="text-sm text-blue-600 mb-1">处理中</div>
            <div className="text-2xl font-bold text-blue-700">{kpiStats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className={kpiStats.totalDiffUSD > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className={`text-sm mb-1 ${kpiStats.totalDiffUSD > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              差异金额（USD）
            </div>
            <div className={`text-2xl font-bold ${kpiStats.totalDiffUSD > 0 ? "text-red-700" : ""}`}>
              ${kpiStats.totalDiffUSD}
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
                placeholder="搜索对账任务/店铺..."
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
                <SelectItem value="OPEN">待处理</SelectItem>
                <SelectItem value="IN_PROGRESS">处理中</SelectItem>
                <SelectItem value="RESOLVED">已解决</SelectItem>
                <SelectItem value="CLOSED">已关闭</SelectItem>
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
                <TableHead>对账任务</TableHead>
                <TableHead>对账范围</TableHead>
                <TableHead>平台/店铺</TableHead>
                <TableHead>账期</TableHead>
                <TableHead className="text-right">账单金额</TableHead>
                <TableHead className="text-right">应收金额</TableHead>
                <TableHead className="text-right">差异金额</TableHead>
                <TableHead>差异数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((item) => (
                <TableRow key={item.id} className={item.diffCount > 0 ? "bg-red-50/50" : ""}>
                  <TableCell>
                    <Button variant="link" className="p-0 h-auto text-blue-600" onClick={() => openDetail(item)}>
                      {item.id}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {item.reconScope === "STATEMENT_VS_RECEIVABLE" ? "账单↔应收" : "提现↔银行"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="mr-1">
                      {item.channel}
                    </Badge>
                    {item.storeName}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.periodFrom} ~ {item.periodTo}
                  </TableCell>
                  <TableCell className="text-right font-mono">{item.statementAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{item.receivableAmount.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-mono ${item.diffAmount !== 0 ? "text-red-600" : ""}`}>
                    {item.diffAmount !== 0 ? item.diffAmount.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell>
                    {item.diffCount > 0 ? (
                      <Badge variant="destructive">{item.diffCount}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        0
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[item.status].color}>{statusConfig[item.status].label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(item)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {item.diffCount > 0 && item.status === "OPEN" && (
                        <Button variant="ghost" size="sm" className="h-8 text-blue-600">
                          处理差异
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

      {/* RE2 Detail Sheet - 对账差异明细与工单 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
          {selectedTask && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span>{selectedTask.id}</span>
                  <Badge className={statusConfig[selectedTask.status].color}>
                    {statusConfig[selectedTask.status].label}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  {selectedTask.storeName} · {selectedTask.periodFrom} ~ {selectedTask.periodTo}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* 对账汇总 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">账单金额</div>
                    <div className="text-xl font-bold">{selectedTask.statementAmount.toLocaleString()}</div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">应收金额</div>
                    <div className="text-xl font-bold">{selectedTask.receivableAmount.toLocaleString()}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${selectedTask.diffAmount !== 0 ? "bg-red-50" : "bg-green-50"}`}>
                    <div className={`text-sm ${selectedTask.diffAmount !== 0 ? "text-red-600" : "text-green-600"}`}>
                      差异金额
                    </div>
                    <div
                      className={`text-xl font-bold ${selectedTask.diffAmount !== 0 ? "text-red-700" : "text-green-700"}`}
                    >
                      {selectedTask.diffAmount !== 0 ? selectedTask.diffAmount.toLocaleString() : "无差异"}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 差异分类 Tabs */}
                <Tabs defaultValue="all">
                  <TabsList>
                    <TabsTrigger value="all">全部差异</TabsTrigger>
                    <TabsTrigger value="MISSING">缺单</TabsTrigger>
                    <TabsTrigger value="EXTRA">多单</TabsTrigger>
                    <TabsTrigger value="AMOUNT_DIFF">金额差异</TabsTrigger>
                    <TabsTrigger value="TIME_DIFF">时间差异</TabsTrigger>
                    <TabsTrigger value="FX_DIFF">汇率差异</TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="mt-4">
                    {mockDiffItems.filter((d) => d.reconId === selectedTask.id).length > 0 ? (
                      <div className="space-y-3">
                        {mockDiffItems
                          .filter((d) => d.reconId === selectedTask.id)
                          .map((diff) => (
                            <div key={diff.id} className="p-4 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge className={diffTypeConfig[diff.diffType].color}>
                                    {diffTypeConfig[diff.diffType].label}
                                  </Badge>
                                  <span className="font-medium">{diff.id}</span>
                                </div>
                                <Badge className={statusConfig[diff.status].color}>
                                  {statusConfig[diff.status].label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">{diff.description}</p>
                              <div className="grid grid-cols-4 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">差异金额: </span>
                                  <span className="font-mono text-red-600">
                                    {formatCurrency(diff.diffAmount, diff.currency)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">责任人: </span>
                                  <span>{diff.owner}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">SLA: </span>
                                  <span>{diff.slaDueAt}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">工单: </span>
                                  <span>{diff.workorderId || "未创建"}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                                {!diff.workorderId && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedDiff(diff)
                                      setCreateWorkorderOpen(true)
                                    }}
                                  >
                                    创建工单
                                  </Button>
                                )}
                                <Button size="sm" variant="outline">
                                  指派责任人
                                </Button>
                                <Button size="sm" variant="outline">
                                  关闭差异
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                        <p>无差异，对账完成</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Workorder Dialog */}
      <Dialog open={createWorkorderOpen} onOpenChange={setCreateWorkorderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建差异工单</DialogTitle>
          </DialogHeader>
          {selectedDiff && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={diffTypeConfig[selectedDiff.diffType].color}>
                    {diffTypeConfig[selectedDiff.diffType].label}
                  </Badge>
                  <span className="font-mono text-red-600">
                    {formatCurrency(selectedDiff.diffAmount, selectedDiff.currency)}
                  </span>
                </div>
                <p className="text-sm">{selectedDiff.description}</p>
              </div>
              <div>
                <Label>指派给</Label>
                <Select defaultValue={selectedDiff.owner}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="财务张三">财务张三</SelectItem>
                    <SelectItem value="财务李四">财务李四</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>备注</Label>
                <Textarea className="mt-1" placeholder="补充说明..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateWorkorderOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                toast.success("工单已创建")
                setCreateWorkorderOpen(false)
              }}
            >
              创建工单
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
