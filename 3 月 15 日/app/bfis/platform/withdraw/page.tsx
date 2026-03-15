"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowRightLeft,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Filter,
  Search,
  ChevronRight,
  ExternalLink,
  TrendingUp,
  Banknote,
  Wallet,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

// WD1｜提现单列表页（提现与到账）
// WD2｜提现单详情页（Sheet）

type WithdrawalStatus = "REQUESTED" | "PROCESSING" | "TRANSFERRED" | "FAILED" | "CANCELED"
type MatchStatus = "UNMATCHED" | "MATCHED" | "PARTIAL" | "REJECTED"

interface Withdrawal {
  id: string
  platform: "TIKTOK" | "SHOPEE"
  storeId: string
  storeName: string
  referenceId: string
  requestTime: string
  successTime: string | null
  amount: number
  currency: string
  status: WithdrawalStatus
  bankAccountMasked: string
  matchStatus: MatchStatus
  arrivalTime: string | null
  matchedAmount: number | null
  subjectType: "PERSONAL" | "LEGAL"
  subjectName: string
  statementId: string | null
  alert: string | null
}

// Mock data
const mockWithdrawals: Withdrawal[] = [
  {
    id: "wd_001",
    platform: "TIKTOK",
    storeId: "st_001",
    storeName: "Higood Live",
    referenceId: "3530819661875544329",
    requestTime: "2025-11-20 10:00:00",
    successTime: "2025-11-20 12:00:00",
    amount: 65244493,
    currency: "IDR",
    status: "TRANSFERRED",
    bankAccountMasked: "********6968",
    matchStatus: "MATCHED",
    arrivalTime: "2025-11-21 09:00:00",
    matchedAmount: 65244493,
    subjectType: "LEGAL",
    subjectName: "PT HIGOOD LIVE JAKARTA",
    statementId: "ps_001",
    alert: null,
  },
  {
    id: "wd_002",
    platform: "TIKTOK",
    storeId: "st_001",
    storeName: "Higood Live",
    referenceId: "3530819661875544330",
    requestTime: "2025-11-18 14:30:00",
    successTime: "2025-11-18 16:00:00",
    amount: 48500000,
    currency: "IDR",
    status: "TRANSFERRED",
    bankAccountMasked: "********6968",
    matchStatus: "UNMATCHED",
    arrivalTime: null,
    matchedAmount: null,
    subjectType: "LEGAL",
    subjectName: "PT HIGOOD LIVE JAKARTA",
    statementId: "ps_002",
    alert: "超期未到账",
  },
  {
    id: "wd_003",
    platform: "SHOPEE",
    storeId: "st_002",
    storeName: "Higood Store",
    referenceId: "SHP-20251115-001",
    requestTime: "2025-11-15 11:00:00",
    successTime: "2025-11-15 13:00:00",
    amount: 32800000,
    currency: "IDR",
    status: "TRANSFERRED",
    bankAccountMasked: "********1234",
    matchStatus: "PARTIAL",
    arrivalTime: "2025-11-16 10:00:00",
    matchedAmount: 32750000,
    subjectType: "LEGAL",
    subjectName: "PT FADFAD FASHION BANDUNG",
    statementId: "ps_003",
    alert: "金额不一致",
  },
]

const statusConfig: Record<WithdrawalStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  REQUESTED: { label: "已请求", color: "bg-blue-100 text-blue-700", icon: Clock },
  PROCESSING: { label: "处理中", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  TRANSFERRED: { label: "已转出", color: "bg-green-100 text-green-700", icon: CheckCircle },
  FAILED: { label: "失败", color: "bg-red-100 text-red-700", icon: XCircle },
  CANCELED: { label: "已取消", color: "bg-gray-100 text-gray-700", icon: XCircle },
}

const matchStatusConfig: Record<MatchStatus, { label: string; color: string }> = {
  UNMATCHED: { label: "未到账", color: "bg-gray-100 text-gray-700" },
  MATCHED: { label: "已到账", color: "bg-green-100 text-green-700" },
  PARTIAL: { label: "部分到账", color: "bg-yellow-100 text-yellow-700" },
  REJECTED: { label: "已拒绝", color: "bg-red-100 text-red-700" },
}

export default function WithdrawListPage() {
  const searchParams = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"))
  const [filterPlatform, setFilterPlatform] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterMatchStatus, setFilterMatchStatus] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  const selected = mockWithdrawals.find((w) => w.id === selectedId)

  const filteredWithdrawals = mockWithdrawals.filter((w) => {
    if (filterPlatform !== "all" && w.platform !== filterPlatform) return false
    if (filterStatus !== "all" && w.status !== filterStatus) return false
    if (filterMatchStatus !== "all" && w.matchStatus !== filterMatchStatus) return false
    if (searchTerm && !w.referenceId.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">提现与到账</h1>
          <p className="text-muted-foreground">
            统一沉淀平台侧"提现请求—提现成功—银行到账"的全链路记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/bfis/platform/withdraw/match">
            <Button variant="outline" size="sm">
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              到账匹配中心
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">820M</div>
                <div className="text-sm text-muted-foreground">已可提现总额</div>
                <div className="text-xs text-muted-foreground">IDR（引用3.4）</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-muted-foreground">已发起提现</div>
                <div className="text-xs text-muted-foreground">REQUESTED/PROCESSING</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-700">48.5M</div>
                <div className="text-sm text-orange-600">已转出待到账</div>
                <div className="text-xs text-orange-600">TRANSFERRED未匹配</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Banknote className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">97.9M</div>
                <div className="text-sm text-muted-foreground">已到账（近7天）</div>
                <div className="text-xs text-muted-foreground">MATCHED</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">筛选</span>
            </div>
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="平台状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="REQUESTED">已请求</SelectItem>
                <SelectItem value="PROCESSING">处理中</SelectItem>
                <SelectItem value="TRANSFERRED">已转出</SelectItem>
                <SelectItem value="FAILED">失败</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMatchStatus} onValueChange={setFilterMatchStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="到账状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部到账状态</SelectItem>
                <SelectItem value="UNMATCHED">未到账</SelectItem>
                <SelectItem value="MATCHED">已到账</SelectItem>
                <SelectItem value="PARTIAL">部分到账</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索参考号..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                <TableHead>平台/店铺</TableHead>
                <TableHead>提现参考号</TableHead>
                <TableHead>请求时间</TableHead>
                <TableHead>平台成功时间</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>平台状态</TableHead>
                <TableHead>银行尾号</TableHead>
                <TableHead>到账状态</TableHead>
                <TableHead>到账时间</TableHead>
                <TableHead>收单主体</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWithdrawals.map((withdrawal) => {
                const StatusIcon = statusConfig[withdrawal.status].icon
                const hasAlert = withdrawal.alert !== null
                return (
                  <TableRow
                    key={withdrawal.id}
                    className={hasAlert ? "bg-red-50 hover:bg-red-100" : ""}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{withdrawal.storeName}</div>
                        <div className="text-xs text-muted-foreground">{withdrawal.platform}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{withdrawal.referenceId}</TableCell>
                    <TableCell className="text-sm">{withdrawal.requestTime}</TableCell>
                    <TableCell className="text-sm">{withdrawal.successTime || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono font-medium">
                        {withdrawal.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">{withdrawal.currency}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[withdrawal.status].color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[withdrawal.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{withdrawal.bankAccountMasked}</TableCell>
                    <TableCell>
                      <Badge className={matchStatusConfig[withdrawal.matchStatus].color}>
                        {matchStatusConfig[withdrawal.matchStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{withdrawal.arrivalTime || "-"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{withdrawal.subjectName}</div>
                      <div className="text-xs text-muted-foreground">{withdrawal.subjectType}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedId(withdrawal.id)}
                        >
                          详情
                        </Button>
                        {withdrawal.matchStatus === "UNMATCHED" && (
                          <Link href={`/bfis/platform/withdraw/match?wd=${withdrawal.id}`}>
                            <Button variant="outline" size="sm">
                              去匹配
                            </Button>
                          </Link>
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

      {/* WD2 Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>提现单详情</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                {/* Header Card */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">平台/店铺</div>
                        <div className="font-medium">{selected.platform} / {selected.storeName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">提现参考号</div>
                        <div className="font-mono text-sm">{selected.referenceId}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">提现金额</div>
                        <div className="text-xl font-bold">
                          {selected.amount.toLocaleString()} {selected.currency}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">平台状态</div>
                        <Badge className={statusConfig[selected.status].color}>
                          {statusConfig[selected.status].label}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">收单主体</div>
                        <div className="font-medium">{selected.subjectName}</div>
                        <div className="text-xs text-muted-foreground">{selected.subjectType}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">银行尾号</div>
                        <div className="font-mono">{selected.bankAccountMasked}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">提现流程时间线</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">请求时间</div>
                        <div className="text-sm text-muted-foreground">{selected.requestTime}</div>
                      </div>
                    </div>
                    {selected.successTime && (
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-full">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">平台转出成功</div>
                          <div className="text-sm text-muted-foreground">{selected.successTime}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 rounded-full">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">预计到账时间（p90）</div>
                        <div className="text-sm text-muted-foreground">2025-11-23（3天）</div>
                      </div>
                    </div>
                    {selected.arrivalTime && (
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-full">
                          <Banknote className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">实际到账时间</div>
                          <div className="text-sm text-muted-foreground">{selected.arrivalTime}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Match Result */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">到账匹配结果</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">匹配状态</div>
                        <Badge className={matchStatusConfig[selected.matchStatus].color}>
                          {matchStatusConfig[selected.matchStatus].label}
                        </Badge>
                      </div>
                      {selected.matchedAmount && (
                        <div>
                          <div className="text-sm text-muted-foreground">匹配金额</div>
                          <div className="font-mono font-medium">
                            {selected.matchedAmount.toLocaleString()} {selected.currency}
                          </div>
                        </div>
                      )}
                    </div>
                    {selected.matchStatus === "MATCHED" && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          已成功匹配到银行流水，置信度 95%
                        </div>
                      </div>
                    )}
                    {selected.matchStatus === "UNMATCHED" && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-yellow-700">
                          <AlertTriangle className="h-4 w-4" />
                          尚未匹配到银行流水，建议前往到账匹配中心处理
                        </div>
                        <Link href={`/bfis/platform/withdraw/match?wd=${selected.id}`}>
                          <Button variant="outline" size="sm" className="mt-2 bg-transparent">
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            前往匹配中心
                          </Button>
                        </Link>
                      </div>
                    )}
                    {selected.matchStatus === "PARTIAL" && (
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-orange-700">
                          <AlertTriangle className="h-4 w-4" />
                          匹配金额与提现金额不一致，差异: {(selected.amount - (selected.matchedAmount || 0)).toLocaleString()} {selected.currency}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Source */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">证据与来源</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selected.statementId && (
                      <div>
                        <div className="text-sm text-muted-foreground">关联结算单</div>
                        <Link href={`/bfis/platform/statements?id=${selected.statementId}`}>
                          <Button variant="link" className="h-auto p-0">
                            {selected.statementId}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-muted-foreground">导入来源</div>
                      <div className="text-sm">结算单导入 - Withdrawal records</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
