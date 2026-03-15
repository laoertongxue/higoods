"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import {
  Search,
  Filter,
  Download,
  AlertTriangle,
  Eye,
  RefreshCw,
  FileText,
  ArrowUpDown,
  ChevronRight,
  XCircle,
  CheckCircle,
  Clock,
  Ban,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"

// TX1｜交易流水列表页 + TX2｜交易流水详情页

type Platform = "TIKTOK" | "SHOPEE"
type TxnType = "ORDER_REVENUE" | "BUYER_SHIPPING_FEE" | "PLATFORM_FEE" | "PROMO_SUBSIDY" | "REFUND" | "CHARGEBACK_DISPUTE" | "ADJUSTMENT" | "TAX_WITHHELD" | "OTHER"
type TxnStatus = "OPEN" | "ASSIGNED" | "REVERSED" | "CANCELED"
type Direction = "IN" | "OUT"
type AcquiringType = "PERSONAL" | "LEGAL" | ""

interface TransactionEntry {
  txn_id: string
  platform: Platform
  store_id: string
  store_name: string
  txn_time: string
  txn_date: string
  currency: string
  amount: number
  txn_type: TxnType
  direction: Direction
  order_id: string | null
  statement_id: string | null
  statement_period_code: string | null
  payout_account_id: string | null
  payout_account_name: string | null
  payout_account_last4: string | null
  acquiring_subject_type: AcquiringType
  acquiring_subject_id: string | null
  acquiring_subject_name: string | null
  status: TxnStatus
  source: string
  source_ref: string
  has_binding_issue: boolean
  is_duplicate_suspect: boolean
}

// Mock 数据
const mockTransactions: TransactionEntry[] = [
  {
    txn_id: "tx_01H9K8ABCD123",
    platform: "TIKTOK",
    store_id: "st_tiktok_id_001",
    store_name: "ID-直播主店",
    txn_time: "2026-01-20 14:23:15",
    txn_date: "2026-01-20",
    currency: "IDR",
    amount: 850000,
    txn_type: "ORDER_REVENUE",
    direction: "IN",
    order_id: "TT20260120001",
    statement_id: "ps_202601_tiktok_id",
    statement_period_code: "2026-01",
    payout_account_id: "pa_bri_id_001",
    payout_account_name: "BRI Jakarta Account",
    payout_account_last4: "1234",
    acquiring_subject_type: "LEGAL",
    acquiring_subject_id: "le_id_jkt_higood",
    acquiring_subject_name: "PT HIGOOD LIVE JAKARTA",
    status: "ASSIGNED",
    source: "API",
    source_ref: "api_txn_tt_20260120_001",
    has_binding_issue: false,
    is_duplicate_suspect: false,
  },
  {
    txn_id: "tx_01H9K8ABCD124",
    platform: "TIKTOK",
    store_id: "st_tiktok_id_001",
    store_name: "ID-直播主店",
    txn_time: "2026-01-20 14:23:15",
    txn_date: "2026-01-20",
    currency: "IDR",
    amount: -127500,
    txn_type: "PLATFORM_FEE",
    direction: "OUT",
    order_id: "TT20260120001",
    statement_id: "ps_202601_tiktok_id",
    statement_period_code: "2026-01",
    payout_account_id: "pa_bri_id_001",
    payout_account_name: "BRI Jakarta Account",
    payout_account_last4: "1234",
    acquiring_subject_type: "LEGAL",
    acquiring_subject_id: "le_id_jkt_higood",
    acquiring_subject_name: "PT HIGOOD LIVE JAKARTA",
    status: "ASSIGNED",
    source: "API",
    source_ref: "api_txn_tt_20260120_002",
    has_binding_issue: false,
    is_duplicate_suspect: false,
  },
  {
    txn_id: "tx_01H9K8ABCD125",
    platform: "SHOPEE",
    store_id: "st_shopee_id_002",
    store_name: "Shopee ID Official",
    txn_time: "2026-01-19 10:15:30",
    txn_date: "2026-01-19",
    currency: "IDR",
    amount: 1250000,
    txn_type: "ORDER_REVENUE",
    direction: "IN",
    order_id: "SP20260119002",
    statement_id: "ps_202601_shopee_id",
    statement_period_code: "2026-01",
    payout_account_id: "pa_mandiri_id_002",
    payout_account_name: "Mandiri Jakarta",
    payout_account_last4: "5678",
    acquiring_subject_type: "LEGAL",
    acquiring_subject_id: "le_id_jkt_higood",
    acquiring_subject_name: "PT HIGOOD LIVE JAKARTA",
    status: "ASSIGNED",
    source: "FILE_IMPORT",
    source_ref: "import_202601_batch_05_row_12",
    has_binding_issue: false,
    is_duplicate_suspect: false,
  },
  {
    txn_id: "tx_01H9K8ABCD126",
    platform: "SHOPEE",
    store_id: "st_shopee_id_002",
    store_name: "Shopee ID Official",
    txn_time: "2026-01-18 16:45:00",
    txn_date: "2026-01-18",
    currency: "IDR",
    amount: -450000,
    txn_type: "REFUND",
    direction: "OUT",
    order_id: "SP20260115003",
    statement_id: null,
    statement_period_code: null,
    payout_account_id: null,
    payout_account_name: null,
    payout_account_last4: null,
    acquiring_subject_type: "",
    acquiring_subject_id: null,
    acquiring_subject_name: null,
    status: "OPEN",
    source: "API",
    source_ref: "api_txn_sp_20260118_005",
    has_binding_issue: true,
    is_duplicate_suspect: false,
  },
  {
    txn_id: "tx_01H9K8ABCD127",
    platform: "TIKTOK",
    store_id: "st_tiktok_id_001",
    store_name: "ID-直播主店",
    txn_time: "2026-01-17 09:20:00",
    txn_date: "2026-01-17",
    currency: "IDR",
    amount: 35000,
    txn_type: "BUYER_SHIPPING_FEE",
    direction: "IN",
    order_id: "TT20260117005",
    statement_id: "ps_202601_tiktok_id",
    statement_period_code: "2026-01",
    payout_account_id: "pa_bri_id_001",
    payout_account_name: "BRI Jakarta Account",
    payout_account_last4: "1234",
    acquiring_subject_type: "LEGAL",
    acquiring_subject_id: "le_id_jkt_higood",
    acquiring_subject_name: "PT HIGOOD LIVE JAKARTA",
    status: "ASSIGNED",
    source: "API",
    source_ref: "api_txn_tt_20260117_008",
    has_binding_issue: false,
    is_duplicate_suspect: false,
  },
  {
    txn_id: "tx_01H9K8ABCD128",
    platform: "SHOPEE",
    store_id: "st_shopee_id_003",
    store_name: "Shopee ID Store 2",
    txn_time: "2026-01-21 11:30:00",
    txn_date: "2026-01-21",
    currency: "IDR",
    amount: 680000,
    txn_type: "ORDER_REVENUE",
    direction: "IN",
    order_id: "SP20260121010",
    statement_id: null,
    statement_period_code: null,
    payout_account_id: "pa_mandiri_id_002",
    payout_account_name: "Mandiri Jakarta",
    payout_account_last4: "5678",
    acquiring_subject_type: "LEGAL",
    acquiring_subject_id: "le_id_jkt_higood",
    acquiring_subject_name: "PT HIGOOD LIVE JAKARTA",
    status: "OPEN",
    source: "API",
    source_ref: "api_txn_sp_20260121_012",
    has_binding_issue: false,
    is_duplicate_suspect: true,
  },
]

const txnTypeConfig: Record<TxnType, { label: string; color: string }> = {
  ORDER_REVENUE: { label: "订单收入", color: "bg-green-100 text-green-700" },
  BUYER_SHIPPING_FEE: { label: "用户运费", color: "bg-blue-100 text-blue-700" },
  PLATFORM_FEE: { label: "平台费", color: "bg-orange-100 text-orange-700" },
  PROMO_SUBSIDY: { label: "平台补贴", color: "bg-purple-100 text-purple-700" },
  REFUND: { label: "退款", color: "bg-red-100 text-red-700" },
  CHARGEBACK_DISPUTE: { label: "争议/赔付", color: "bg-yellow-100 text-yellow-700" },
  ADJUSTMENT: { label: "调账", color: "bg-gray-100 text-gray-700" },
  TAX_WITHHELD: { label: "代扣税费", color: "bg-pink-100 text-pink-700" },
  OTHER: { label: "其他", color: "bg-slate-100 text-slate-700" },
}

const statusConfig: Record<TxnStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  OPEN: { label: "未归集", color: "bg-blue-100 text-blue-700", icon: Clock },
  ASSIGNED: { label: "已归集", color: "bg-green-100 text-green-700", icon: CheckCircle },
  REVERSED: { label: "已冲回", color: "bg-yellow-100 text-yellow-700", icon: RefreshCw },
  CANCELED: { label: "已取消", color: "bg-gray-100 text-gray-700", icon: Ban },
}

function TransactionsPageContent() {
  const searchParams = useSearchParams()
  const [selectedTxn, setSelectedTxn] = useState<TransactionEntry | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Filters
  const [filterPlatform, setFilterPlatform] = useState("all")
  const [filterStore, setFilterStore] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchKeyword, setSearchKeyword] = useState("")

  const openDetail = (txn: TransactionEntry) => {
    setSelectedTxn(txn)
    setDetailOpen(true)
  }

  const filteredTransactions = mockTransactions.filter((txn) => {
    if (filterPlatform !== "all" && txn.platform !== filterPlatform) return false
    if (filterStore !== "all" && txn.store_id !== filterStore) return false
    if (filterType !== "all" && txn.txn_type !== filterType) return false
    if (filterStatus !== "all" && txn.status !== filterStatus) return false
    if (searchKeyword && !txn.order_id?.includes(searchKeyword) && !txn.source_ref.includes(searchKeyword)) return false
    return true
  })

  const stats = {
    total: mockTransactions.length,
    open: mockTransactions.filter((t) => t.status === "OPEN").length,
    assigned: mockTransactions.filter((t) => t.status === "ASSIGNED").length,
    bindingIssues: mockTransactions.filter((t) => t.has_binding_issue).length,
    duplicateSuspect: mockTransactions.filter((t) => t.is_duplicate_suspect).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">交易流水</h1>
          <p className="text-muted-foreground">平台侧资金事件的原子明细，作为账单/结算/对账的底层事实数据来源</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            重新归集
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">流水总数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
            <div className="text-sm text-muted-foreground">未归集</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.assigned}</div>
            <div className="text-sm text-muted-foreground">已归集</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.bindingIssues}</div>
            <div className="text-sm text-red-600">归属缺失</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.duplicateSuspect}</div>
            <div className="text-sm text-yellow-600">疑似重复</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="平台" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部平台</SelectItem>
                <SelectItem value="TIKTOK">TikTok</SelectItem>
                <SelectItem value="SHOPEE">Shopee</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStore} onValueChange={setFilterStore}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="店铺" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部店铺</SelectItem>
                <SelectItem value="st_tiktok_id_001">ID-直播主店</SelectItem>
                <SelectItem value="st_shopee_id_002">Shopee ID Official</SelectItem>
                <SelectItem value="st_shopee_id_003">Shopee ID Store 2</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="流水类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="ORDER_REVENUE">订单收入</SelectItem>
                <SelectItem value="PLATFORM_FEE">平台费</SelectItem>
                <SelectItem value="REFUND">退款</SelectItem>
                <SelectItem value="BUYER_SHIPPING_FEE">用户运费</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="OPEN">未归集</SelectItem>
                <SelectItem value="ASSIGNED">已归集</SelectItem>
                <SelectItem value="REVERSED">已冲回</SelectItem>
                <SelectItem value="CANCELED">已取消</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索订单号/来源引用..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
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
                <TableHead>发生时间</TableHead>
                <TableHead>平台/店铺</TableHead>
                <TableHead>流水类型</TableHead>
                <TableHead>订单号</TableHead>
                <TableHead className="text-right">原币金额</TableHead>
                <TableHead>归集账单</TableHead>
                <TableHead>收单主体</TableHead>
                <TableHead>提现账号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>来源</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((txn) => {
                const typeConfig = txnTypeConfig[txn.txn_type]
                const statusCfg = statusConfig[txn.status]
                const StatusIcon = statusCfg.icon

                return (
                  <TableRow
                    key={txn.txn_id}
                    className={`${txn.has_binding_issue ? "bg-red-50" : txn.is_duplicate_suspect ? "bg-yellow-50" : ""}`}
                  >
                    <TableCell className="font-mono text-sm">{txn.txn_time}</TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="mb-1">
                          {txn.platform}
                        </Badge>
                        <div className="text-sm">{txn.store_name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{txn.order_id || "-"}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={txn.amount >= 0 ? "text-green-600" : "text-red-600"}>
                        {txn.amount >= 0 ? "+" : ""}
                        {txn.amount.toLocaleString()}
                      </span>
                      <div className="text-xs text-muted-foreground">{txn.currency}</div>
                    </TableCell>
                    <TableCell>
                      {txn.statement_id ? (
                        <div>
                          <div className="text-sm font-medium">{txn.statement_period_code}</div>
                          <div className="text-xs text-muted-foreground font-mono">{txn.statement_id}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {txn.has_binding_issue ? (
                        <div className="flex items-center gap-2 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">归属缺失</span>
                        </div>
                      ) : txn.acquiring_subject_name ? (
                        <div>
                          <Badge variant="outline" className="mb-1">
                            {txn.acquiring_subject_type === "LEGAL" ? "法人" : "个人"}
                          </Badge>
                          <div className="text-sm">{txn.acquiring_subject_name}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {txn.payout_account_name ? (
                        <div className="text-sm">
                          {txn.payout_account_name}
                          <span className="text-muted-foreground ml-1">****{txn.payout_account_last4}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-4 w-4" />
                        <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{txn.source}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(txn)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* TX2 Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>交易流水详情</SheetTitle>
          </SheetHeader>
          {selectedTxn && (
            <div className="space-y-6 mt-6">
              {/* Alerts */}
              {selectedTxn.has_binding_issue && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-red-900">归属缺失预警</div>
                    <div className="text-sm text-red-700 mt-1">该流水在发生时点（{selectedTxn.txn_time}）无有效提现绑定，无法确定收单主体归属。</div>
                    <Button variant="outline" size="sm" className="mt-2 bg-transparent">
                      补录绑定关系
                    </Button>
                  </div>
                </div>
              )}
              {selectedTxn.is_duplicate_suspect && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-yellow-900">疑似重复预警</div>
                    <div className="text-sm text-yellow-700 mt-1">系统检测到相似流水记录，请核查是否重复导入。</div>
                  </div>
                </div>
              )}

              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-medium mb-3">基本信息</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">流水ID</div>
                    <div className="font-mono mt-1">{selectedTxn.txn_id}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">平台</div>
                    <Badge className="mt-1">{selectedTxn.platform}</Badge>
                  </div>
                  <div>
                    <div className="text-muted-foreground">店铺</div>
                    <div className="mt-1">{selectedTxn.store_name}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">发生时间</div>
                    <div className="font-mono mt-1">{selectedTxn.txn_time}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">流水类型</div>
                    <Badge className={`mt-1 ${txnTypeConfig[selectedTxn.txn_type].color}`}>
                      {txnTypeConfig[selectedTxn.txn_type].label}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-muted-foreground">方向</div>
                    <Badge variant="outline" className="mt-1">
                      {selectedTxn.direction === "IN" ? "流入" : "流出"}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-muted-foreground">原币金额</div>
                    <div className={`font-mono font-bold mt-1 ${selectedTxn.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {selectedTxn.amount >= 0 ? "+" : ""}
                      {selectedTxn.amount.toLocaleString()} {selectedTxn.currency}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">状态</div>
                    <Badge className={`mt-1 ${statusConfig[selectedTxn.status].color}`}>
                      {statusConfig[selectedTxn.status].label}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <div className="text-muted-foreground">订单号</div>
                    <div className="font-mono mt-1">{selectedTxn.order_id || "-"}</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Account Billing Info */}
              <div>
                <h3 className="text-sm font-medium mb-3">账单归集</h3>
                {selectedTxn.statement_id ? (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">账单ID</div>
                        <div className="font-mono mt-1">{selectedTxn.statement_id}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">账单期间</div>
                        <div className="mt-1">{selectedTxn.statement_period_code}</div>
                      </div>
                    </div>
                    <Button variant="link" size="sm" className="mt-2 p-0 h-auto">
                      查看账单详情 <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">未归集到账单</div>
                )}
              </div>

              <Separator />

              {/* Attribution Info */}
              <div>
                <h3 className="text-sm font-medium mb-3">归属信息（核心）</h3>
                {selectedTxn.has_binding_issue ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                    <div className="text-red-900 font-medium mb-2">归属缺失</div>
                    <div className="text-red-700">
                      该交易在发生时点（{selectedTxn.txn_time}）无有效提现账号绑定，无法确定收单主体归属。
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">提现账号</div>
                        <div className="mt-1">
                          {selectedTxn.payout_account_name}
                          <span className="text-muted-foreground ml-1">****{selectedTxn.payout_account_last4}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">主体类型</div>
                        <Badge className="mt-1">{selectedTxn.acquiring_subject_type === "LEGAL" ? "法人" : "个人"}</Badge>
                      </div>
                      <div className="col-span-2">
                        <div className="text-muted-foreground">收单主体</div>
                        <div className="font-medium mt-1">{selectedTxn.acquiring_subject_name}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-muted-foreground">解析时点</div>
                        <div className="font-mono text-xs mt-1">{selectedTxn.txn_time}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Source Info */}
              <div>
                <h3 className="text-sm font-medium mb-3">来源追溯</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">数据来源</div>
                    <Badge variant="outline" className="mt-1">
                      {selectedTxn.source}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-muted-foreground">来源引用</div>
                    <div className="font-mono text-xs mt-1">{selectedTxn.source_ref}</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  发起工单
                </Button>
                {selectedTxn.has_binding_issue && (
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重新解析归属
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TransactionsPageContent />
    </Suspense>
  )
}
