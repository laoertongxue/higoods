"use client"

import { useState } from "react"
import { Search, Download, Eye, Plus, ChevronRight, RotateCcw, FileText, Upload } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// RC1 收款登记列表页 + RC2 收款登记详情页

type ReceiptStatus = "DRAFT" | "CONFIRMED" | "REVERSED"

const statusConfig: Record<ReceiptStatus, { label: string; color: string }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  CONFIRMED: { label: "已确认", color: "bg-green-100 text-green-700" },
  REVERSED: { label: "已冲销", color: "bg-red-100 text-red-700" },
}

// Mock 数据
const mockReceipts = [
  {
    id: "RC-2026-001",
    receiptNo: "RC-2026-001",
    receiptType: "PLATFORM_PAYOUT",
    storeAccountId: "STORE-SP-001",
    storeName: "Shopee印尼店",
    sellerEntityId: "PT HiGood Indonesia",
    receiptDate: "2025-12-16",
    currency: "IDR",
    amount: 142000000,
    amountUSD: 9467,
    linkedWithdrawalId: "WD-2025-015",
    linkedBankTxnId: "BK-2025-089",
    linkedReceivableId: "AR-2026-004",
    status: "CONFIRMED" as ReceiptStatus,
    evidenceAttachments: ["回单_BCA_20251216.pdf"],
    createdAt: "2025-12-16 10:00:00",
    updatedAt: "2025-12-16 10:30:00",
    confirmedBy: "财务李四",
    confirmedAt: "2025-12-16 10:30:00",
  },
  {
    id: "RC-2026-002",
    receiptNo: "RC-2026-002",
    receiptType: "PLATFORM_PAYOUT",
    storeAccountId: "STORE-TT-001",
    storeName: "TikTok印尼主店",
    sellerEntityId: "PT HiGood Indonesia",
    receiptDate: "2026-01-08",
    currency: "IDR",
    amount: 156000000,
    amountUSD: 10400,
    linkedWithdrawalId: "WD-2026-001",
    linkedBankTxnId: "BK-2026-001",
    linkedReceivableId: "AR-2026-003",
    status: "DRAFT" as ReceiptStatus,
    evidenceAttachments: [],
    createdAt: "2026-01-08 14:00:00",
    updatedAt: "2026-01-08 14:00:00",
    confirmedBy: null,
    confirmedAt: null,
  },
]

export default function ReceiptsPage() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedReceipt, setSelectedReceipt] = useState<(typeof mockReceipts)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  // 筛选
  const filteredData = mockReceipts.filter((item) => {
    if (
      searchKeyword &&
      !item.receiptNo.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !item.storeName.toLowerCase().includes(searchKeyword.toLowerCase())
    )
      return false
    if (filterStatus !== "all" && item.status !== filterStatus) return false
    return true
  })

  // KPI统计
  const kpiStats = {
    total: mockReceipts.length,
    totalUSD: mockReceipts.filter((r) => r.status === "CONFIRMED").reduce((sum, r) => sum + r.amountUSD, 0),
    draft: mockReceipts.filter((r) => r.status === "DRAFT").length,
    confirmed: mockReceipts.filter((r) => r.status === "CONFIRMED").length,
  }

  const openDetail = (item: (typeof mockReceipts)[0]) => {
    setSelectedReceipt(item)
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
          <h1 className="text-2xl font-bold">收款登记</h1>
          <p className="text-muted-foreground">平台到账收款登记与确认</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建收款登记
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">全部登记</div>
            <div className="text-2xl font-bold">{kpiStats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="text-sm text-green-600 mb-1">已确认金额（USD）</div>
            <div className="text-2xl font-bold text-green-700">${kpiStats.totalUSD.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">草稿</div>
            <div className="text-2xl font-bold">{kpiStats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">已确认</div>
            <div className="text-2xl font-bold">{kpiStats.confirmed}</div>
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
                placeholder="搜索收款编号/店铺..."
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
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="CONFIRMED">已确认</SelectItem>
                <SelectItem value="REVERSED">已冲销</SelectItem>
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
                <TableHead>收款编号</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>店铺</TableHead>
                <TableHead>法人主体</TableHead>
                <TableHead>收款日期</TableHead>
                <TableHead className="text-right">金额（原币）</TableHead>
                <TableHead className="text-right">金额（USD）</TableHead>
                <TableHead>关联提现</TableHead>
                <TableHead>关联流水</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Button variant="link" className="p-0 h-auto text-blue-600" onClick={() => openDetail(item)}>
                      {item.receiptNo}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">平台到账</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{item.storeName}</TableCell>
                  <TableCell className="text-sm">{item.sellerEntityId}</TableCell>
                  <TableCell className="text-sm">{item.receiptDate}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(item.amount, item.currency)}</TableCell>
                  <TableCell className="text-right font-mono">${item.amountUSD.toLocaleString()}</TableCell>
                  <TableCell>
                    {item.linkedWithdrawalId ? (
                      <Button variant="link" className="p-0 h-auto text-sm">
                        {item.linkedWithdrawalId}
                      </Button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {item.linkedBankTxnId ? (
                      <Button variant="link" className="p-0 h-auto text-sm">
                        {item.linkedBankTxnId}
                      </Button>
                    ) : (
                      "-"
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
                      {item.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-green-600"
                          onClick={() => toast.success("已确认")}
                        >
                          确认
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

      {/* RC2 Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedReceipt && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span>{selectedReceipt.receiptNo}</span>
                  <Badge className={statusConfig[selectedReceipt.status].color}>
                    {statusConfig[selectedReceipt.status].label}
                  </Badge>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">店铺</div>
                    <div className="font-medium">{selectedReceipt.storeName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">法人主体</div>
                    <div className="font-medium">{selectedReceipt.sellerEntityId}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">收款日期</div>
                    <div className="font-medium">{selectedReceipt.receiptDate}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">类型</div>
                    <div className="font-medium">平台到账</div>
                  </div>
                </div>

                {/* 金额 */}
                <div>
                  <h3 className="font-semibold mb-3">金额信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">原币金额</div>
                      <div className="text-xl font-bold">
                        {formatCurrency(selectedReceipt.amount, selectedReceipt.currency)}
                      </div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">USD金额</div>
                      <div className="text-xl font-bold">${selectedReceipt.amountUSD.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 穿透关联 */}
                <div>
                  <h3 className="font-semibold mb-3">穿透关联</h3>
                  <div className="space-y-2">
                    {selectedReceipt.linkedWithdrawalId && (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span>提现单</span>
                        <Button variant="link" className="p-0 h-auto">
                          {selectedReceipt.linkedWithdrawalId} <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                    {selectedReceipt.linkedReceivableId && (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span>应收</span>
                        <Button variant="link" className="p-0 h-auto">
                          {selectedReceipt.linkedReceivableId} <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                    {selectedReceipt.linkedBankTxnId && (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span>银行流水</span>
                        <Button variant="link" className="p-0 h-auto">
                          {selectedReceipt.linkedBankTxnId} <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* 证据附件 */}
                <div>
                  <h3 className="font-semibold mb-3">证据附件</h3>
                  {selectedReceipt.evidenceAttachments.length > 0 ? (
                    <div className="space-y-2">
                      {selectedReceipt.evidenceAttachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{file}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">暂无附件</div>
                  )}
                </div>

                {/* 确认信息 */}
                {selectedReceipt.confirmedBy && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3">确认信息</h3>
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <div className="text-sm text-muted-foreground">确认人</div>
                          <div className="font-medium">{selectedReceipt.confirmedBy}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">确认时间</div>
                          <div className="font-medium">{selectedReceipt.confirmedAt}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t">
                  {selectedReceipt.status === "DRAFT" && (
                    <>
                      <Button onClick={() => toast.success("已确认")}>确认</Button>
                      <Button variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        上传附件
                      </Button>
                    </>
                  )}
                  {selectedReceipt.status === "CONFIRMED" && (
                    <Button
                      variant="outline"
                      className="text-red-600 bg-transparent"
                      onClick={() => toast.success("已冲销")}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      冲销
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* RC3 新建收款登记抽屉 */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>新建收款登记</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* 提示信息 */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              在"银行流水尚未导入/尚未匹配"时，可先把到账事实记录下来
            </div>

            {/* 店铺选择 */}
            <div className="space-y-2">
              <Label>店铺 *</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择店铺" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STORE-TT-001">TikTok印尼主店 (PT HiGood Indonesia)</SelectItem>
                  <SelectItem value="STORE-TT-002">TikTok印尼分店 (PT HiGood Indonesia)</SelectItem>
                  <SelectItem value="STORE-SP-001">Shopee印尼店 (PT HiGood Indonesia)</SelectItem>
                  <SelectItem value="STORE-SP-002">Shopee马来店 (HiGood Malaysia Sdn Bhd)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 关联提现单 */}
            <div className="space-y-2">
              <Label>关联提现单（强烈建议选择）</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择已有的提现单" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WD-2026-001">WD-2026-001 - Shopee印尼店 - IDR 156,000,000</SelectItem>
                  <SelectItem value="WD-2026-002">WD-2026-002 - Shopee马来店 - MYR 45,000</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">选择提现单后，币种必须一致；金额差超容差需备注说明</p>
            </div>

            {/* 到账日期 */}
            <div className="space-y-2">
              <Label>到账日期 *</Label>
              <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} />
            </div>

            {/* 币种与金额 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>币种 *</Label>
                <Select defaultValue="IDR">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR - 印尼盾</SelectItem>
                    <SelectItem value="MYR">MYR - 马来西亚令吉</SelectItem>
                    <SelectItem value="VND">VND - 越南盾</SelectItem>
                    <SelectItem value="PHP">PHP - 菲律宾比索</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>金额 *</Label>
                <Input type="number" placeholder="0.00" />
              </div>
            </div>

            {/* 证据附件 */}
            <div className="space-y-2">
              <Label>证据附件（可选）</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">上传回单/平台截图</p>
                <p className="text-xs text-muted-foreground">支持 PDF, PNG, JPG</p>
              </div>
            </div>

            {/* 备注 */}
            <div className="space-y-2">
              <Label>备注（建议必填）</Label>
              <Input placeholder="说明到账来源，如：平台截图显示已到账" />
            </div>

            {/* 预警提示 */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-yellow-700">
                  <p className="font-medium">确认为 CONFIRMED 后</p>
                  <ul className="text-xs mt-1 space-y-1">
                    <li>可用于驱动应收状态变更</li>
                    <li>若未匹配银行流水，将标记"待匹配流水"预警</li>
                  </ul>
                </div>
              </div>
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
                  toast.success("收款登记已保存为草稿")
                  setCreateOpen(false)
                }}
              >
                保存草稿
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  toast.success("收款登记已确认")
                  setCreateOpen(false)
                }}
              >
                直接确认
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
