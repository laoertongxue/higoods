"use client"

import { useState } from "react"
import {
  Search,
  Filter,
  Download,
  Upload,
  ChevronDown,
  FileText,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  History,
  Plus,
  ArrowRight,
  FileUp,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// PS1 平台账单列表页 + PS2 详情页 + PS3 导入账单抽屉 + PS4 重算/版本确认弹窗

// Mock 数据
const mockStatements = [
  {
    id: "PS-2026-001",
    storeAccountId: "STORE-TT-001",
    storeName: "TikTok印尼主店",
    channel: "TIKTOK",
    periodFrom: "2026-01-01",
    periodTo: "2026-01-15",
    currency: "IDR",
    grossAmount: 125000000,
    feeAmount: 12500000,
    netAmount: 112500000,
    netAmountUSD: 7500,
    status: "IMPORTED",
    importBatchId: "BATCH-001",
    importedAt: "2026-01-16 10:30:00",
    importedBy: "系统自动",
    sellerEntity: "PT HiGood Indonesia",
    settlementCycle: "半月结",
    freezeDays: 7,
  },
  {
    id: "PS-2026-002",
    storeAccountId: "STORE-TT-002",
    storeName: "TikTok印尼分店",
    channel: "TIKTOK",
    periodFrom: "2026-01-01",
    periodTo: "2026-01-15",
    currency: "IDR",
    grossAmount: 85000000,
    feeAmount: 8500000,
    netAmount: 76500000,
    netAmountUSD: 5100,
    status: "RECONCILING",
    importBatchId: "BATCH-001",
    importedAt: "2026-01-16 10:30:00",
    importedBy: "系统自动",
    sellerEntity: "PT HiGood Indonesia",
    settlementCycle: "半月结",
    freezeDays: 7,
  },
  {
    id: "PS-2026-003",
    storeAccountId: "STORE-SP-001",
    storeName: "Shopee印尼店",
    channel: "SHOPEE",
    periodFrom: "2026-01-01",
    periodTo: "2026-01-07",
    currency: "IDR",
    grossAmount: 65000000,
    feeAmount: 6500000,
    netAmount: 58500000,
    netAmountUSD: 3900,
    status: "CLOSED",
    importBatchId: "BATCH-002",
    importedAt: "2026-01-08 09:00:00",
    importedBy: "财务-李四",
    sellerEntity: "PT HiGood Indonesia",
    settlementCycle: "周结",
    freezeDays: 3,
  },
  {
    id: "PS-2026-004",
    storeAccountId: "STORE-TT-003",
    storeName: "TikTok菲律宾店",
    channel: "TIKTOK",
    periodFrom: "2026-01-01",
    periodTo: "2026-01-15",
    currency: "PHP",
    grossAmount: 2500000,
    feeAmount: 250000,
    netAmount: 2250000,
    netAmountUSD: 4050,
    status: "IMPORTED",
    importBatchId: "BATCH-003",
    importedAt: "2026-01-16 11:00:00",
    importedBy: "系统自动",
    sellerEntity: "HiGood Philippines Inc",
    settlementCycle: "半月结",
    freezeDays: 7,
  },
  {
    id: "PS-2026-005",
    storeAccountId: "STORE-SP-002",
    storeName: "Shopee菲律宾店",
    channel: "SHOPEE",
    periodFrom: "2026-01-01",
    periodTo: "2026-01-07",
    currency: "PHP",
    grossAmount: 1800000,
    feeAmount: 180000,
    netAmount: 1620000,
    netAmountUSD: 2916,
    status: "CLOSED",
    importBatchId: "BATCH-004",
    importedAt: "2026-01-08 10:00:00",
    importedBy: "财务-李四",
    sellerEntity: "HiGood Philippines Inc",
    settlementCycle: "周结",
    freezeDays: 3,
  },
]

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  IMPORTED: { label: "已导入", variant: "secondary" },
  RECONCILING: { label: "核对中", variant: "default" },
  CLOSED: { label: "已关闭", variant: "outline" },
}

const channelConfig: Record<string, { label: string; color: string }> = {
  TIKTOK: { label: "TikTok", color: "bg-pink-100 text-pink-700" },
  SHOPEE: { label: "Shopee", color: "bg-orange-100 text-orange-700" },
}

export default function PlatformBillsPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [channelFilter, setChannelFilter] = useState("all")
  const [storeFilter, setStoreFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedStatement, setSelectedStatement] = useState<(typeof mockStatements)[0] | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [recalcDialogOpen, setRecalcDialogOpen] = useState(false)

  // 筛选数据
  const filteredStatements = mockStatements.filter((s) => {
    if (
      searchKeyword &&
      !s.id.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !s.storeName.toLowerCase().includes(searchKeyword.toLowerCase())
    )
      return false
    if (channelFilter !== "all" && s.channel !== channelFilter) return false
    if (statusFilter !== "all" && s.status !== statusFilter) return false
    return true
  })

  // 统计
  const stats = {
    total: mockStatements.length,
    imported: mockStatements.filter((s) => s.status === "IMPORTED").length,
    reconciling: mockStatements.filter((s) => s.status === "RECONCILING").length,
    closed: mockStatements.filter((s) => s.status === "CLOSED").length,
    totalUSD: mockStatements.reduce((sum, s) => sum + s.netAmountUSD, 0),
  }

  const handleViewDetail = (statement: (typeof mockStatements)[0]) => {
    setSelectedStatement(statement)
    setDetailOpen(true)
  }

  const handleImport = () => {
    toast.success("账单导入任务已创建")
    setImportDialogOpen(false)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredStatements.map((s) => s.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id))
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">平台账单/结算单</h1>
          <p className="text-muted-foreground mt-1">管理各平台结算账单，支持导入、核对和关闭</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            导入账单
          </Button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter("all")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              全部账单
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats.total}</span>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setStatusFilter("IMPORTED")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              已导入
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-blue-600">{stats.imported}</span>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setStatusFilter("RECONCILING")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              核对中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-yellow-600">{stats.reconciling}</span>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setStatusFilter("CLOSED")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              已关闭
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-green-600">{stats.closed}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">本期净额（USD）</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">${stats.totalUSD.toLocaleString()}</span>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索账单号、店铺名称..."
                className="pl-9"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="平台" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部平台</SelectItem>
                <SelectItem value="TIKTOK">TikTok</SelectItem>
                <SelectItem value="SHOPEE">Shopee</SelectItem>
              </SelectContent>
            </Select>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="店铺" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部店铺</SelectItem>
                <SelectItem value="STORE-TT-001">TikTok印尼主店</SelectItem>
                <SelectItem value="STORE-TT-002">TikTok印尼分店</SelectItem>
                <SelectItem value="STORE-SP-001">Shopee印尼店</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="IMPORTED">已导入</SelectItem>
                <SelectItem value="RECONCILING">核对中</SelectItem>
                <SelectItem value="CLOSED">已关闭</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="账期" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部账期</SelectItem>
                <SelectItem value="2026-01">2026年1月</SelectItem>
                <SelectItem value="2025-12">2025年12月</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作 */}
      {selectedIds.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">已选择 {selectedIds.length} 项</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  批量核对
                </Button>
                <Button variant="outline" size="sm">
                  批量关闭
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                  取消选择
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 数据表格 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedIds.length === filteredStatements.length && filteredStatements.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>账单号</TableHead>
                <TableHead>平台</TableHead>
                <TableHead>店铺</TableHead>
                <TableHead>收单主体</TableHead>
                <TableHead>账期</TableHead>
                <TableHead className="text-right">毛额（原币）</TableHead>
                <TableHead className="text-right">费用（原币）</TableHead>
                <TableHead className="text-right">净额（原币）</TableHead>
                <TableHead className="text-right">净额（USD）</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>导入时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStatements.map((statement) => (
                <TableRow key={statement.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(statement.id)}
                      onCheckedChange={(checked) => handleSelectOne(statement.id, checked as boolean)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <span
                      className="text-primary font-medium cursor-pointer hover:underline"
                      onClick={() => handleViewDetail(statement)}
                    >
                      {statement.id}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={channelConfig[statement.channel].color}>
                      {channelConfig[statement.channel].label}
                    </Badge>
                  </TableCell>
                  <TableCell>{statement.storeName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{statement.sellerEntity}</TableCell>
                  <TableCell className="text-sm">
                    {statement.periodFrom} ~ {statement.periodTo}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {statement.currency} {statement.grossAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    -{statement.currency} {statement.feeAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {statement.currency} {statement.netAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    ${statement.netAmountUSD.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[statement.status].variant}>
                      {statusConfig[statement.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{statement.importedAt}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          操作 <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetail(statement)}>
                          <Eye className="h-4 w-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                        {statement.status === "IMPORTED" && (
                          <DropdownMenuItem onClick={() => toast.success("生成应收台账成功")}>
                            生成应收
                          </DropdownMenuItem>
                        )}
                        {statement.status !== "CLOSED" && (
                          <DropdownMenuItem onClick={() => setRecalcDialogOpen(true)}>进入核对</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* PS2 详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              平台账单详情 - {selectedStatement?.id}
              {selectedStatement && (
                <Badge variant={statusConfig[selectedStatement.status].variant}>
                  {statusConfig[selectedStatement.status].label}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          {selectedStatement && (
            <div className="mt-6 space-y-6">
              {/* 基本信息 */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  基本信息
                </h3>
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <span className="text-xs text-muted-foreground">账单号</span>
                    <p className="font-medium">{selectedStatement.id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">平台</span>
                    <p>
                      <Badge variant="outline" className={channelConfig[selectedStatement.channel].color}>
                        {channelConfig[selectedStatement.channel].label}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">店铺</span>
                    <p className="font-medium">{selectedStatement.storeName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">收单主体（法人）</span>
                    <p className="font-medium">{selectedStatement.sellerEntity}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">结算周期</span>
                    <p>{selectedStatement.settlementCycle}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">冻结天数</span>
                    <p>{selectedStatement.freezeDays} 天</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">账期</span>
                    <p className="font-medium">
                      {selectedStatement.periodFrom} ~ {selectedStatement.periodTo}
                    </p>
                  </div>
                </div>
              </div>

              {/* 金额信息 */}
              <div>
                <h3 className="text-sm font-semibold mb-3">金额明细</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">毛额</span>
                          <span className="font-mono">
                            {selectedStatement.currency} {selectedStatement.grossAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span className="text-muted-foreground">平台费用</span>
                          <span className="font-mono">
                            -{selectedStatement.currency} {selectedStatement.feeAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold">
                          <span>净额（原币）</span>
                          <span className="font-mono">
                            {selectedStatement.currency} {selectedStatement.netAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5">
                    <CardContent className="pt-4 flex flex-col justify-center h-full">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">净额（集团 USD）</p>
                        <p className="text-3xl font-bold">${selectedStatement.netAmountUSD.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-2">汇率：交易日汇率 | 来源：Reuters</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Tab 区域 */}
              <Tabs defaultValue="breakdown">
                <TabsList>
                  <TabsTrigger value="breakdown">费用明细</TabsTrigger>
                  <TabsTrigger value="receivables">关联应收</TabsTrigger>
                  <TabsTrigger value="logs">操作日志</TabsTrigger>
                </TabsList>
                <TabsContent value="breakdown" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>费用类型</TableHead>
                        <TableHead className="text-right">金额（原币）</TableHead>
                        <TableHead className="text-right">金额（USD）</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>平台佣金</TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          -{selectedStatement.currency} {(selectedStatement.feeAmount * 0.6).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          -${(selectedStatement.netAmountUSD * 0.06).toFixed(2)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>支付手续费</TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          -{selectedStatement.currency} {(selectedStatement.feeAmount * 0.3).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          -${(selectedStatement.netAmountUSD * 0.03).toFixed(2)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>物流补贴</TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          -{selectedStatement.currency} {(selectedStatement.feeAmount * 0.1).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          -${(selectedStatement.netAmountUSD * 0.01).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="receivables" className="mt-4">
                  <div className="text-center py-8 text-muted-foreground">
                    {selectedStatement.status === "IMPORTED" ? (
                      <div className="space-y-2">
                        <p>暂未生成应收台账</p>
                        <Button size="sm" onClick={() => toast.success("生成应收台账成功")}>
                          立即生成
                        </Button>
                      </div>
                    ) : (
                      <p>关联应收：AR-2026-001</p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="logs" className="mt-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      <div>
                        <p className="text-muted-foreground">{selectedStatement.importedAt}</p>
                        <p>账单导入完成，导入人：{selectedStatement.importedBy}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {selectedStatement.status === "IMPORTED" && (
                  <Button onClick={() => toast.success("生成应收台账成功")}>生成应收</Button>
                )}
                {selectedStatement.status !== "CLOSED" && (
                  <Button variant="outline" onClick={() => setRecalcDialogOpen(true)}>
                    进入核对
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 导入弹窗 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入平台账单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>平台 *</Label>
                <Select defaultValue="TIKTOK">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIKTOK">TikTok</SelectItem>
                    <SelectItem value="SHOPEE">Shopee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>店铺 *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="选择店铺" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STORE-TT-001">TikTok印尼主店</SelectItem>
                    <SelectItem value="STORE-TT-002">TikTok印尼分店</SelectItem>
                    <SelectItem value="STORE-SP-001">Shopee印尼店</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>账期开始 *</Label>
                <Input type="date" />
              </div>
              <div className="space-y-2">
                <Label>账期结束 *</Label>
                <Input type="date" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>账单币种 *</Label>
                <Select defaultValue="IDR">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR - 印尼盾</SelectItem>
                    <SelectItem value="MYR">MYR - 马来西亚令吉</SelectItem>
                    <SelectItem value="PHP">PHP - 菲律宾比索</SelectItem>
                    <SelectItem value="VND">VND - 越南盾</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>账单模板类型 *</Label>
                <Select defaultValue="TIKTOK">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIKTOK">TikTok 标准模板</SelectItem>
                    <SelectItem value="SHOPEE">Shopee 标准模板</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>上传文件 *</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">拖拽文件至此处，或点击选择文件</p>
                <p className="text-xs text-muted-foreground mt-1">支持 .xlsx, .csv 格式，单文件不超过10MB</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea placeholder="可选：说明本次导入的特殊情况" rows={2} />
            </div>

            {/* 解析预览区 */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">解析预览</span>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  解析文件
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Gross (毛额)</span>
                  <p className="font-mono font-medium">IDR 125,000,000</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fee (费用)</span>
                  <p className="font-mono font-medium text-red-600">-IDR 12,500,000</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Net (净额)</span>
                  <p className="font-mono font-medium text-green-600">IDR 112,500,000</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center p-2 bg-background rounded">
                  <div className="font-medium">256</div>
                  <div className="text-muted-foreground">支付</div>
                </div>
                <div className="text-center p-2 bg-background rounded">
                  <div className="font-medium">12</div>
                  <div className="text-muted-foreground">退款</div>
                </div>
                <div className="text-center p-2 bg-background rounded">
                  <div className="font-medium">8</div>
                  <div className="text-muted-foreground">费用</div>
                </div>
                <div className="text-center p-2 bg-background rounded">
                  <div className="font-medium">3</div>
                  <div className="text-muted-foreground">调整</div>
                </div>
              </div>
            </div>

            {/* 风险提示 */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">导入提醒</p>
                  <ul className="text-yellow-700 mt-1 space-y-1 text-xs">
                    <li>同店铺+账期重复导入会生成新版本，旧版本标记为&ldquo;被替代&rdquo;</li>
                    <li>账单状态为 CLOSED 后禁止再导入新版本</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              取消
            </Button>
            <Button variant="outline">
              解析预览
            </Button>
            <Button onClick={handleImport}>确认导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PS4 重算/版本确认弹窗 */}
      <Dialog open={recalcDialogOpen} onOpenChange={setRecalcDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重算应收确认</DialogTitle>
            <DialogDescription>
              重算将基于最新账单版本重新生成应收台账
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">账单号</span>
                <span className="font-medium">{selectedStatement?.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">当前版本</span>
                <span className="font-medium">v2</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">净额变化</span>
                <span className="font-medium text-orange-600">+IDR 500,000</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>重算原因 *</Label>
              <Textarea placeholder="请说明重算原因，将记录在审计日志中" rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="confirm-recalc" />
              <Label htmlFor="confirm-recalc" className="text-sm">
                我确认已核实账单版本变更，同意重算应收
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecalcDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => {
              toast.success("应收重算已完成，版本号更新为 v2")
              setRecalcDialogOpen(false)
            }}>
              确认重算
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
