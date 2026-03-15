"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRightLeft,
  Clock,
  CheckCircle,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Building2,
  FileText,
  ChevronRight,
  Download,
  RefreshCw,
  Filter,
  X,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"

// AR1｜平台结算应收台账（四态）列表页
// 核心：把订单→签收→COD付款→平台结算→可提现→提现→到账全过程统一为"四态台账"

type FourState = "FORECAST" | "PENDING_SETTLEMENT" | "WITHDRAWABLE" | "CASHED"
type Platform = "TIKTOK" | "SHOPEE"
type OrderType = "PRESALE" | "INSTOCK"
type SubjectType = "PERSONAL" | "LEGAL"

interface ARItem {
  id: string
  platform: Platform
  storeId: string
  storeName: string
  orderId: string
  orderType: OrderType
  currency: string
  expectedAmount: number | null
  confirmedAmount: number | null
  status: FourState
  confidenceScore: number
  orderCreatedTime: string
  expectedShipTime: string | null
  actualShipTime: string | null
  expectedDeliveryTime: string | null
  actualDeliveryTime: string | null
  expectedSettledTime: string | null
  actualSettledTime: string | null
  expectedWithdrawableTime: string | null
  expectedArrivalTimeP50: string | null
  statementId: string | null
  withdrawalId: string | null
  bankMatchStatus: string | null
  subjectType: SubjectType | null
  subjectId: string | null
  subjectName: string | null
  hasExceptions: boolean
  exceptionTypes: string[]
}

// Mock数据
const mockARItems: ARItem[] = [
  {
    id: "ar_001",
    platform: "TIKTOK",
    storeId: "st_tiktok_id_01",
    storeName: "TikTok ID Main Store",
    orderId: "581392764638658049",
    orderType: "PRESALE",
    currency: "IDR",
    expectedAmount: 180000,
    confirmedAmount: null,
    status: "FORECAST",
    confidenceScore: 75,
    orderCreatedTime: "2026-01-10 10:30",
    expectedShipTime: "2026-01-30",
    actualShipTime: null,
    expectedDeliveryTime: "2026-02-05",
    actualDeliveryTime: null,
    expectedSettledTime: "2026-02-07",
    actualSettledTime: null,
    expectedWithdrawableTime: "2026-02-14",
    expectedArrivalTimeP50: "2026-02-15",
    statementId: null,
    withdrawalId: null,
    bankMatchStatus: null,
    subjectType: "LEGAL",
    subjectId: "le_id_bdg",
    subjectName: "PT FADFAD FASHION BANDUNG",
    hasExceptions: false,
    exceptionTypes: [],
  },
  {
    id: "ar_002",
    platform: "TIKTOK",
    storeId: "st_tiktok_id_01",
    storeName: "TikTok ID Main Store",
    orderId: "581392764638658050",
    orderType: "INSTOCK",
    currency: "IDR",
    expectedAmount: 85000,
    confirmedAmount: null,
    status: "PENDING_SETTLEMENT",
    confidenceScore: 90,
    orderCreatedTime: "2026-01-18 14:20",
    expectedShipTime: "2026-01-19",
    actualShipTime: "2026-01-19 08:00",
    expectedDeliveryTime: "2026-01-24",
    actualDeliveryTime: "2026-01-23 16:30",
    expectedSettledTime: "2026-01-25",
    actualSettledTime: null,
    expectedWithdrawableTime: "2026-02-01",
    expectedArrivalTimeP50: "2026-02-02",
    statementId: null,
    withdrawalId: null,
    bankMatchStatus: null,
    subjectType: "LEGAL",
    subjectId: "le_id_bdg",
    subjectName: "PT FADFAD FASHION BANDUNG",
    hasExceptions: true,
    exceptionTypes: ["SETTLEMENT_DELAY"],
  },
  {
    id: "ar_003",
    platform: "TIKTOK",
    storeId: "st_tiktok_id_01",
    storeName: "TikTok ID Main Store",
    orderId: "581392764638658048",
    orderType: "INSTOCK",
    currency: "IDR",
    expectedAmount: 120000,
    confirmedAmount: 115340,
    status: "WITHDRAWABLE",
    confidenceScore: 100,
    orderCreatedTime: "2026-01-08 09:15",
    expectedShipTime: "2026-01-09",
    actualShipTime: "2026-01-09 07:30",
    expectedDeliveryTime: "2026-01-14",
    actualDeliveryTime: "2026-01-13 15:00",
    expectedSettledTime: "2026-01-15",
    actualSettledTime: "2026-01-15 10:30",
    expectedWithdrawableTime: "2026-01-22",
    expectedArrivalTimeP50: "2026-01-23",
    statementId: "ps_202601_tiktok_01",
    withdrawalId: null,
    bankMatchStatus: null,
    subjectType: "LEGAL",
    subjectId: "le_id_bdg",
    subjectName: "PT FADFAD FASHION BANDUNG",
    hasExceptions: true,
    exceptionTypes: ["WITHDRAWABLE_NOT_WITHDRAWN"],
  },
  {
    id: "ar_004",
    platform: "SHOPEE",
    storeId: "st_shopee_id_01",
    storeName: "Shopee ID Fashion Store",
    orderId: "SP240108001234",
    orderType: "INSTOCK",
    currency: "IDR",
    expectedAmount: 95000,
    confirmedAmount: 92800,
    status: "CASHED",
    confidenceScore: 100,
    orderCreatedTime: "2026-01-01 11:00",
    expectedShipTime: "2026-01-02",
    actualShipTime: "2026-01-02 08:00",
    expectedDeliveryTime: "2026-01-07",
    actualDeliveryTime: "2026-01-06 14:00",
    expectedSettledTime: "2026-01-09",
    actualSettledTime: "2026-01-09 09:00",
    expectedWithdrawableTime: "2026-01-16",
    expectedArrivalTimeP50: "2026-01-17",
    statementId: "ps_202601_shopee_01",
    withdrawalId: "wd_202601_001",
    bankMatchStatus: "MATCHED",
    subjectType: "LEGAL",
    subjectId: "le_id_jkt",
    subjectName: "PT HIGOOD LIVE JAKARTA",
    hasExceptions: false,
    exceptionTypes: [],
  },
  {
    id: "ar_005",
    platform: "TIKTOK",
    storeId: "st_tiktok_id_02",
    storeName: "TikTok ID Fashion Outlet",
    orderId: "581392764638658051",
    orderType: "INSTOCK",
    currency: "IDR",
    expectedAmount: null,
    confirmedAmount: null,
    status: "FORECAST",
    confidenceScore: 40,
    orderCreatedTime: "2026-01-20 16:45",
    expectedShipTime: "2026-01-21",
    actualShipTime: null,
    expectedDeliveryTime: "2026-01-26",
    actualDeliveryTime: null,
    expectedSettledTime: "2026-01-28",
    actualSettledTime: null,
    expectedWithdrawableTime: "2026-02-04",
    expectedArrivalTimeP50: "2026-02-05",
    statementId: null,
    withdrawalId: null,
    bankMatchStatus: null,
    subjectType: null,
    subjectId: null,
    subjectName: null,
    hasExceptions: true,
    exceptionTypes: ["MISSING_SUBJECT"],
  },
]

const stateConfig: Record<FourState, { label: string; color: string; icon: typeof Clock }> = {
  FORECAST: { label: "预计应收", color: "bg-gray-100 text-gray-700", icon: Clock },
  PENDING_SETTLEMENT: { label: "待结算", color: "bg-yellow-100 text-yellow-700", icon: ArrowRightLeft },
  WITHDRAWABLE: { label: "可提现", color: "bg-blue-100 text-blue-700", icon: Wallet },
  CASHED: { label: "已回款", color: "bg-green-100 text-green-700", icon: CheckCircle },
}

const exceptionTypeLabels: Record<string, string> = {
  MISSING_EVENT: "缺履约事件",
  MISSING_SUBJECT: "缺收单主体",
  SETTLEMENT_DELAY: "结算延迟",
  WITHDRAWABLE_NOT_WITHDRAWN: "可提现未提现",
  WITHDRAWAL_NOT_ARRIVED: "提现未到账",
  FORECAST_ERROR: "预测误差过大",
}

export default function ReceivablesPage() {
  const [selectedTab, setSelectedTab] = useState<FourState>("FORECAST")
  const [selectedItem, setSelectedItem] = useState<ARItem | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const filteredItems = mockARItems.filter((item) => item.status === selectedTab)

  // 计算KPI
  const forecastTotal = mockARItems
    .filter((i) => i.status === "FORECAST")
    .reduce((sum, i) => sum + (i.expectedAmount || 0), 0)
  const pendingTotal = mockARItems
    .filter((i) => i.status === "PENDING_SETTLEMENT")
    .reduce((sum, i) => sum + (i.expectedAmount || 0), 0)
  const withdrawableTotal = mockARItems
    .filter((i) => i.status === "WITHDRAWABLE")
    .reduce((sum, i) => sum + (i.confirmedAmount || 0), 0)
  const cashedTotal = mockARItems
    .filter((i) => i.status === "CASHED")
    .reduce((sum, i) => sum + (i.confirmedAmount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">平台结算应收台账（四态）</h1>
          <p className="text-muted-foreground">
            订单→签收→COD付款→平台结算→可提现→提现→到账全过程统一台账，为资金预测与简化三表提供"现金安全感"口径
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            筛选
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Link href="/bfis/platform/receivables/forecast">
            <Button variant="outline" size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              预测效果
            </Button>
          </Link>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={selectedTab === "FORECAST" ? "border-primary" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(forecastTotal / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K
                </div>
                <div className="text-sm text-muted-foreground">预计应收 IDR</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {mockARItems.filter((i) => i.status === "FORECAST").length} 条
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={selectedTab === "PENDING_SETTLEMENT" ? "border-primary" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ArrowRightLeft className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(pendingTotal / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K
                </div>
                <div className="text-sm text-muted-foreground">待结算 IDR</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {mockARItems.filter((i) => i.status === "PENDING_SETTLEMENT").length} 条
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={selectedTab === "WITHDRAWABLE" ? "border-primary" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(withdrawableTotal / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K
                </div>
                <div className="text-sm text-muted-foreground">可提现 IDR</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {mockARItems.filter((i) => i.status === "WITHDRAWABLE").length} 条
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={selectedTab === "CASHED" ? "border-primary" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(cashedTotal / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K
                </div>
                <div className="text-sm text-muted-foreground">已回款 IDR</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {mockARItems.filter((i) => i.status === "CASHED").length} 条
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar (Collapsible) */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">筛选条件</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">平台</label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部平台</SelectItem>
                    <SelectItem value="TIKTOK">TikTok</SelectItem>
                    <SelectItem value="SHOPEE">Shopee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">店铺</label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部店铺</SelectItem>
                    <SelectItem value="st_tiktok_id_01">TikTok ID Main</SelectItem>
                    <SelectItem value="st_shopee_id_01">Shopee ID Fashion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">订单类型</label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="PRESALE">预售</SelectItem>
                    <SelectItem value="INSTOCK">现货</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">置信度</label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="high">≥80</SelectItem>
                    <SelectItem value="medium">50-80</SelectItem>
                    <SelectItem value="low">&lt;50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Four State Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as FourState)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="FORECAST">
            预计应收 ({mockARItems.filter((i) => i.status === "FORECAST").length})
          </TabsTrigger>
          <TabsTrigger value="PENDING_SETTLEMENT">
            待结算 ({mockARItems.filter((i) => i.status === "PENDING_SETTLEMENT").length})
          </TabsTrigger>
          <TabsTrigger value="WITHDRAWABLE">
            可提现 ({mockARItems.filter((i) => i.status === "WITHDRAWABLE").length})
          </TabsTrigger>
          <TabsTrigger value="CASHED">
            已回款 ({mockARItems.filter((i) => i.status === "CASHED").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>平台/店铺</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead className="text-right">预计净回款</TableHead>
                  <TableHead className="text-right">已确认净回款</TableHead>
                  <TableHead>关键日期</TableHead>
                  <TableHead>收单主体</TableHead>
                  <TableHead>状态/置信度</TableHead>
                  <TableHead>证据</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const config = stateConfig[item.status]
                  return (
                    <TableRow
                      key={item.id}
                      className={item.hasExceptions ? "bg-red-50/50" : ""}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.platform}</div>
                          <div className="text-sm text-muted-foreground">{item.storeName}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.orderId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.orderType === "PRESALE" ? "预售" : "现货"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.expectedAmount
                          ? `${item.currency} ${item.expectedAmount.toLocaleString()}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.confirmedAmount
                          ? `${item.currency} ${item.confirmedAmount.toLocaleString()}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div>
                            <span className="text-muted-foreground">订单: </span>
                            {item.orderCreatedTime}
                          </div>
                          {item.actualSettledTime && (
                            <div>
                              <span className="text-muted-foreground">结算: </span>
                              {item.actualSettledTime}
                            </div>
                          )}
                          {!item.actualSettledTime && item.expectedSettledTime && (
                            <div>
                              <span className="text-muted-foreground">预计结算: </span>
                              {item.expectedSettledTime}
                            </div>
                          )}
                          {item.expectedWithdrawableTime && (
                            <div>
                              <span className="text-muted-foreground">预计可提现: </span>
                              {item.expectedWithdrawableTime}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.subjectName ? (
                          <div>
                            <Badge variant="outline" className="mb-1">
                              {item.subjectType === "LEGAL" ? "法人" : "个人"}
                            </Badge>
                            <div className="text-sm">{item.subjectName}</div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="border-red-500 text-red-600">
                            缺失
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={config.color}>{config.label}</Badge>
                          <div className="text-xs text-muted-foreground">
                            置信度: {item.confidenceScore}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {item.statementId && (
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              <span className="text-blue-600">账单</span>
                            </div>
                          )}
                          {item.withdrawalId && (
                            <div className="flex items-center gap-1">
                              <Wallet className="h-3 w-3" />
                              <span className="text-blue-600">提现</span>
                            </div>
                          )}
                          {item.bankMatchStatus === "MATCHED" && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              <span className="text-green-600">已匹配</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.hasExceptions && (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedItem(item)}
                          >
                            详情
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* AR2 Detail Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle>应收详情 - {selectedItem.orderId}</SheetTitle>
                <SheetDescription>
                  {selectedItem.platform} · {selectedItem.storeName}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Status & Confidence */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className={stateConfig[selectedItem.status].color}>
                          {stateConfig[selectedItem.status].label}
                        </Badge>
                        <div className="text-sm text-muted-foreground mt-1">
                          置信度: {selectedItem.confidenceScore}%
                        </div>
                      </div>
                      {selectedItem.subjectName && (
                        <div className="text-right">
                          <div className="text-sm font-medium">{selectedItem.subjectName}</div>
                          <Badge variant="outline" className="mt-1">
                            {selectedItem.subjectType === "LEGAL" ? "法人主体" : "个人主体"}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Amount Summary */}
                <div>
                  <h3 className="font-medium mb-3">金额构成</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground">预计净回款</div>
                        <div className="text-2xl font-bold mt-1">
                          {selectedItem.expectedAmount
                            ? `${selectedItem.currency} ${selectedItem.expectedAmount.toLocaleString()}`
                            : "-"}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground">已确认净回款</div>
                        <div className="text-2xl font-bold mt-1">
                          {selectedItem.confirmedAmount
                            ? `${selectedItem.currency} ${selectedItem.confirmedAmount.toLocaleString()}`
                            : "-"}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  {selectedItem.expectedAmount && selectedItem.confirmedAmount && (
                    <div className="mt-2 p-3 bg-yellow-50 rounded-lg">
                      <div className="text-sm">
                        <span className="text-muted-foreground">预测差异: </span>
                        <span className="font-medium">
                          {selectedItem.currency}{" "}
                          {(selectedItem.confirmedAmount - selectedItem.expectedAmount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="font-medium mb-3">闭环时间线</h3>
                  <div className="space-y-3">
                    <TimelineItem
                      label="订单生成"
                      time={selectedItem.orderCreatedTime}
                      isActual={true}
                    />
                    <TimelineItem
                      label="发货"
                      time={selectedItem.actualShipTime || selectedItem.expectedShipTime}
                      isActual={!!selectedItem.actualShipTime}
                    />
                    <TimelineItem
                      label="签收"
                      time={selectedItem.actualDeliveryTime || selectedItem.expectedDeliveryTime}
                      isActual={!!selectedItem.actualDeliveryTime}
                    />
                    <TimelineItem
                      label="平台结算"
                      time={selectedItem.actualSettledTime || selectedItem.expectedSettledTime}
                      isActual={!!selectedItem.actualSettledTime}
                    />
                    <TimelineItem
                      label="可提现"
                      time={selectedItem.expectedWithdrawableTime}
                      isActual={false}
                    />
                    <TimelineItem
                      label="预计到账"
                      time={selectedItem.expectedArrivalTimeP50}
                      isActual={false}
                    />
                  </div>
                </div>

                {/* Evidence */}
                <div>
                  <h3 className="font-medium mb-3">证据链接</h3>
                  <div className="space-y-2">
                    {selectedItem.statementId && (
                      <Link href={`/bfis/platform/statements?id=${selectedItem.statementId}`}>
                        <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                          <FileText className="h-4 w-4 mr-2" />
                          查看结算单: {selectedItem.statementId}
                          <ExternalLink className="h-3 w-3 ml-auto" />
                        </Button>
                      </Link>
                    )}
                    {selectedItem.withdrawalId && (
                      <Link href={`/bfis/platform/withdraw?id=${selectedItem.withdrawalId}`}>
                        <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                          <Wallet className="h-4 w-4 mr-2" />
                          查看提现单: {selectedItem.withdrawalId}
                          <ExternalLink className="h-3 w-3 ml-auto" />
                        </Button>
                      </Link>
                    )}
                    {selectedItem.bankMatchStatus && (
                      <Button variant="outline" size="sm" className="w-full justify-start bg-transparent" disabled>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        银行匹配状态: {selectedItem.bankMatchStatus}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Exceptions */}
                {selectedItem.hasExceptions && selectedItem.exceptionTypes.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3 text-red-600">异常提醒</h3>
                    <div className="space-y-2">
                      {selectedItem.exceptionTypes.map((type) => (
                        <div
                          key={type}
                          className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
                        >
                          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                          <span className="text-sm text-red-800">
                            {exceptionTypeLabels[type] || type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function TimelineItem({
  label,
  time,
  isActual,
}: {
  label: string
  time: string | null
  isActual: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-2 h-2 rounded-full mt-1.5 ${isActual ? "bg-green-600" : "bg-gray-300"}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {!isActual && <Badge variant="outline" className="text-xs">预计</Badge>}
        </div>
        <div className="text-sm text-muted-foreground">{time || "-"}</div>
      </div>
    </div>
  )
}
