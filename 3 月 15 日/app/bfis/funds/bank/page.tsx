"use client"

import { useState } from "react"
import { Search, Download, Eye, Upload, ChevronRight, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// BK1 银行流水列表页 + BK2 银行流水详情页

type Direction = "IN" | "OUT"
type MatchStatus = "UNMATCHED" | "PARTIAL" | "MATCHED"

const matchStatusConfig: Record<MatchStatus, { label: string; color: string }> = {
  UNMATCHED: { label: "未匹配", color: "bg-yellow-100 text-yellow-700" },
  PARTIAL: { label: "部分匹配", color: "bg-orange-100 text-orange-700" },
  MATCHED: { label: "已匹配", color: "bg-green-100 text-green-700" },
}

// Mock 数据
const mockBankTransactions = [
  {
    id: "BK-2026-001",
    bankTxnId: "BK-2026-001",
    cashAccountId: "BCA-001",
    accountName: "BCA - PT HiGood Indonesia",
    accountNo: "1234567890",
    txnDate: "2026-01-08",
    direction: "IN" as Direction,
    currency: "IDR",
    amount: 156000000,
    amountUSD: 10400,
    bankRefNo: "BCA20260108001",
    memo: "SHOPEE PAYOUT SP-WD-123456",
    counterpartyName: "PT SHOPEE INDONESIA",
    matchStatus: "UNMATCHED" as MatchStatus,
    matchedObjectRefs: [],
    hasReceipt: false,
    createdAt: "2026-01-08 10:00:00",
    updatedAt: "2026-01-08 10:00:00",
  },
  {
    id: "BK-2026-002",
    bankTxnId: "BK-2026-002",
    cashAccountId: "CIMB-001",
    accountName: "CIMB - HiGood Malaysia",
    accountNo: "0987654321",
    txnDate: "2026-01-15",
    direction: "IN" as Direction,
    currency: "MYR",
    amount: 45000,
    amountUSD: 10227,
    bankRefNo: "CIMB20260115001",
    memo: "SHOPEE MY SETTLEMENT",
    counterpartyName: "SHOPEE MALAYSIA SDN BHD",
    matchStatus: "UNMATCHED" as MatchStatus,
    matchedObjectRefs: [],
    hasReceipt: false,
    createdAt: "2026-01-15 14:00:00",
    updatedAt: "2026-01-15 14:00:00",
  },
  {
    id: "BK-2025-089",
    bankTxnId: "BK-2025-089",
    cashAccountId: "BCA-001",
    accountName: "BCA - PT HiGood Indonesia",
    accountNo: "1234567890",
    txnDate: "2025-12-16",
    direction: "IN" as Direction,
    currency: "IDR",
    amount: 142000000,
    amountUSD: 9467,
    bankRefNo: "BCA20251216001",
    memo: "SHOPEE PAYOUT SP-WD-012345",
    counterpartyName: "PT SHOPEE INDONESIA",
    matchStatus: "MATCHED" as MatchStatus,
    matchedObjectRefs: [
      { type: "withdrawal", id: "WD-2025-015" },
      { type: "receipt", id: "RC-2026-001" },
    ],
    hasReceipt: true,
    receiptFile: "回单_BCA_20251216.pdf",
    createdAt: "2025-12-16 09:00:00",
    updatedAt: "2025-12-16 10:30:00",
  },
  {
    id: "BK-2026-003",
    bankTxnId: "BK-2026-003",
    cashAccountId: "BCA-001",
    accountName: "BCA - PT HiGood Indonesia",
    accountNo: "1234567890",
    txnDate: "2026-01-10",
    direction: "OUT" as Direction,
    currency: "IDR",
    amount: 50000000,
    amountUSD: 3333,
    bankRefNo: "BCA20260110001",
    memo: "PAYMENT TO SUPPLIER",
    counterpartyName: "PT SUPPLIER FACTORY",
    matchStatus: "MATCHED" as MatchStatus,
    matchedObjectRefs: [{ type: "payment", id: "PAY-2026-001" }],
    hasReceipt: true,
    receiptFile: "回单_BCA_20260110.pdf",
    createdAt: "2026-01-10 11:00:00",
    updatedAt: "2026-01-10 12:00:00",
  },
]

export default function BankFlowPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterAccount, setFilterAccount] = useState("all")
  const [filterDirection, setFilterDirection] = useState("all")
  const [filterMatchStatus, setFilterMatchStatus] = useState("all")
  const [selectedTxn, setSelectedTxn] = useState<(typeof mockBankTransactions)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // 筛选
  const filteredData = mockBankTransactions.filter((item) => {
    if (
      searchKeyword &&
      !item.bankTxnId.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !item.counterpartyName.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !item.memo.toLowerCase().includes(searchKeyword.toLowerCase())
    )
      return false
    if (filterAccount !== "all" && item.cashAccountId !== filterAccount) return false
    if (filterDirection !== "all" && item.direction !== filterDirection) return false
    if (filterMatchStatus !== "all" && item.matchStatus !== filterMatchStatus) return false
    return true
  })

  // KPI统计
  const kpiStats = {
    total: mockBankTransactions.length,
    inCount: mockBankTransactions.filter((t) => t.direction === "IN").length,
    inUSD: mockBankTransactions.filter((t) => t.direction === "IN").reduce((sum, t) => sum + t.amountUSD, 0),
    outCount: mockBankTransactions.filter((t) => t.direction === "OUT").length,
    outUSD: mockBankTransactions.filter((t) => t.direction === "OUT").reduce((sum, t) => sum + t.amountUSD, 0),
    unmatched: mockBankTransactions.filter((t) => t.matchStatus === "UNMATCHED").length,
  }

  const openDetail = (item: (typeof mockBankTransactions)[0]) => {
    setSelectedTxn(item)
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
          <h1 className="text-2xl font-bold">银行流水/回单</h1>
          <p className="text-muted-foreground">银行流水导入、回单管理与匹配</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            导入流水
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">全部流水</div>
            <div className="text-2xl font-bold">{kpiStats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 text-sm text-green-600 mb-1">
              <ArrowDownLeft className="h-4 w-4" />
              收入
            </div>
            <div className="text-2xl font-bold text-green-700">{kpiStats.inCount}笔</div>
            <div className="text-sm text-green-600">${kpiStats.inUSD.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 text-sm text-red-600 mb-1">
              <ArrowUpRight className="h-4 w-4" />
              支出
            </div>
            <div className="text-2xl font-bold text-red-700">{kpiStats.outCount}笔</div>
            <div className="text-sm text-red-600">${kpiStats.outUSD.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className={kpiStats.unmatched > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
          <CardContent className="p-4">
            <div className={`text-sm mb-1 ${kpiStats.unmatched > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
              待匹配
            </div>
            <div className={`text-2xl font-bold ${kpiStats.unmatched > 0 ? "text-yellow-700" : ""}`}>
              {kpiStats.unmatched}
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
                placeholder="搜索流水号/对手方/摘要..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="账户" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部账户</SelectItem>
                <SelectItem value="BCA-001">BCA - PT HiGood Indonesia</SelectItem>
                <SelectItem value="CIMB-001">CIMB - HiGood Malaysia</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDirection} onValueChange={setFilterDirection}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="方向" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="IN">收入</SelectItem>
                <SelectItem value="OUT">支出</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMatchStatus} onValueChange={setFilterMatchStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="匹配状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="UNMATCHED">未匹配</SelectItem>
                <SelectItem value="MATCHED">已匹配</SelectItem>
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
                <TableHead>流水号</TableHead>
                <TableHead>账户</TableHead>
                <TableHead>交易日期</TableHead>
                <TableHead>方向</TableHead>
                <TableHead className="text-right">金额（原币）</TableHead>
                <TableHead className="text-right">金额（USD）</TableHead>
                <TableHead>对手方</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead>匹配状态</TableHead>
                <TableHead>回单</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Button variant="link" className="p-0 h-auto text-blue-600" onClick={() => openDetail(item)}>
                      {item.bankTxnId}
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate">{item.accountName}</TableCell>
                  <TableCell className="text-sm">{item.txnDate}</TableCell>
                  <TableCell>
                    {item.direction === "IN" ? (
                      <Badge className="bg-green-100 text-green-700">
                        <ArrowDownLeft className="h-3 w-3 mr-1" />
                        收入
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        支出
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${item.direction === "IN" ? "text-green-600" : "text-red-600"}`}
                  >
                    {item.direction === "IN" ? "+" : "-"}
                    {formatCurrency(item.amount, item.currency)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${item.direction === "IN" ? "text-green-600" : "text-red-600"}`}
                  >
                    {item.direction === "IN" ? "+" : "-"}${item.amountUSD.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm max-w-[120px] truncate">{item.counterpartyName}</TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate">{item.memo}</TableCell>
                  <TableCell>
                    <Badge className={matchStatusConfig[item.matchStatus].color}>
                      {matchStatusConfig[item.matchStatus].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.hasReceipt ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        有
                      </Badge>
                    ) : (
                      <Badge variant="outline">无</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(item)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {item.direction === "IN" && item.matchStatus === "UNMATCHED" && (
                        <Button variant="ghost" size="sm" className="h-8 text-green-600">
                          去匹配
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

      {/* BK2 Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedTxn && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span>{selectedTxn.bankTxnId}</span>
                  {selectedTxn.direction === "IN" ? (
                    <Badge className="bg-green-100 text-green-700">收入</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700">支出</Badge>
                  )}
                </SheetTitle>
                <SheetDescription>{selectedTxn.accountName}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* 金额信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">原币金额</div>
                    <div
                      className={`text-xl font-bold ${selectedTxn.direction === "IN" ? "text-green-600" : "text-red-600"}`}
                    >
                      {selectedTxn.direction === "IN" ? "+" : "-"}
                      {formatCurrency(selectedTxn.amount, selectedTxn.currency)}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">USD金额</div>
                    <div
                      className={`text-xl font-bold ${selectedTxn.direction === "IN" ? "text-green-600" : "text-red-600"}`}
                    >
                      {selectedTxn.direction === "IN" ? "+" : "-"}${selectedTxn.amountUSD.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">交易日期</div>
                    <div className="font-medium">{selectedTxn.txnDate}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">银行参考号</div>
                    <div className="font-mono text-sm">{selectedTxn.bankRefNo}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground">对手方</div>
                    <div className="font-medium">{selectedTxn.counterpartyName}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground">摘要</div>
                    <div className="text-sm">{selectedTxn.memo}</div>
                  </div>
                </div>

                <Separator />

                {/* 匹配状态 */}
                <div>
                  <h3 className="font-semibold mb-3">匹配状态</h3>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span>匹配状态</span>
                      <Badge className={matchStatusConfig[selectedTxn.matchStatus].color}>
                        {matchStatusConfig[selectedTxn.matchStatus].label}
                      </Badge>
                    </div>
                    {selectedTxn.matchedObjectRefs.length > 0 && (
                      <div className="space-y-2 mt-3">
                        {selectedTxn.matchedObjectRefs.map((ref, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              {ref.type === "withdrawal" ? "提现单" : ref.type === "receipt" ? "收款登记" : "付款申请"}
                            </span>
                            <Button variant="link" className="p-0 h-auto text-sm">
                              {ref.id} <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 回单 */}
                <div>
                  <h3 className="font-semibold mb-3">回单附件</h3>
                  {selectedTxn.hasReceipt ? (
                    <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                      <span className="text-sm">{selectedTxn.receiptFile}</span>
                      <Button variant="outline" size="sm">
                        下载
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                      暂无回单
                      <Button variant="link" className="p-0 h-auto ml-2">
                        上传回单
                      </Button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t">
                  {selectedTxn.direction === "IN" && selectedTxn.matchStatus === "UNMATCHED" && (
                    <>
                      <Button>推荐匹配</Button>
                      <Button variant="outline">去匹配中心</Button>
                    </>
                  )}
                  {selectedTxn.matchStatus === "MATCHED" && (
                    <Button variant="outline" onClick={() => toast.success("已解绑")}>
                      解绑匹配
                    </Button>
                  )}
                  {!selectedTxn.hasReceipt && (
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      上传回单
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* BK3 导入流水抽屉 */}
      <Sheet open={importOpen} onOpenChange={setImportOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>导入银行流水</SheetTitle>
            <SheetDescription>从银行导出的流水文件导入系统</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* 选择账户 */}
            <div className="space-y-2">
              <Label>选择资金账户 *</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择银行账户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BCA-001">BCA - 1234567890 (PT HiGood Indonesia)</SelectItem>
                  <SelectItem value="CIMB-001">CIMB - 0987654321 (HiGood Malaysia)</SelectItem>
                  <SelectItem value="MANDIRI-001">Mandiri - 1122334455 (PT HiGood Indonesia)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 上传文件 */}
            <div className="space-y-2">
              <Label>上传文件 *</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">点击或拖拽文件上传</p>
                <p className="text-xs text-muted-foreground mt-1">支持 CSV, XLSX 格式（银行标准导出格式）</p>
              </div>
            </div>

            {/* 解析预览 */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">解析预览</span>
                <Badge variant="outline">待上传</Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-2 bg-background rounded">
                  <div className="font-bold text-lg">--</div>
                  <div className="text-muted-foreground text-xs">总行数</div>
                </div>
                <div className="text-center p-2 bg-background rounded">
                  <div className="font-bold text-lg text-green-600">--</div>
                  <div className="text-muted-foreground text-xs">收入</div>
                </div>
                <div className="text-center p-2 bg-background rounded">
                  <div className="font-bold text-lg text-red-600">--</div>
                  <div className="text-muted-foreground text-xs">支出</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">币种分布</span>
                  <p className="font-medium">--</p>
                </div>
                <div>
                  <span className="text-muted-foreground">日期范围</span>
                  <p className="font-medium">--</p>
                </div>
              </div>
            </div>

            {/* 错误提示区 */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <Download className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-yellow-700">
                  <p className="font-medium">幂等规则</p>
                  <ul className="text-xs mt-1 space-y-1">
                    <li>优先使用银行参考号(bank_ref_no)去重</li>
                    <li>若无参考号：日期+金额+币种+账户+方向作为去重键</li>
                    <li>重复记录将跳过并在日志中标记</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setImportOpen(false)}>
                取消
              </Button>
              <Button variant="outline" className="flex-1 bg-transparent">
                解析预览
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  toast.success("流水导入成功，生成批次号 BATCH-20260116-001")
                  setImportOpen(false)
                }}
              >
                确认导入
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
