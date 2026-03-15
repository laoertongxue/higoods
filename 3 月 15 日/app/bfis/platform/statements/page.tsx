"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading" // Import the Loading component
import {
  FileText,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ChevronRight,
  Filter,
  Search,
  Plus,
  Eye,
  FileCheck,
  TrendingUp,
  Calendar,
  DollarSign,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

// PS1｜平台账单列表页 + PS2｜账单详情页 + PS3｜导入账单向导

type StatementStatus = "DRAFT" | "IMPORTED" | "VALIDATED" | "CONFIRMED" | "SUPERSEDED"
type Platform = "TIKTOK" | "SHOPEE"

interface Statement {
  statement_id: string
  platform: Platform
  store_id: string
  store_name: string
  period_start: string
  period_end: string
  timezone: string
  currency: string
  total_settlement_amount: number
  total_revenue: number
  total_fees: number
  total_adjustments: number
  status: StatementStatus
  version_no: number
  imported_at: string
  imported_by: string
  acquiring_subject?: string
}

// Mock 平台账单数据
const mockStatements: Statement[] = [
  {
    statement_id: "ps_01H8X9Y1Z2",
    platform: "TIKTOK",
    store_id: "st_tiktok_jkt_01",
    store_name: "HiGOOD TikTok JKT",
    period_start: "2025-11-01",
    period_end: "2025-11-30",
    timezone: "UTC+7",
    currency: "IDR",
    total_settlement_amount: 52138291,
    total_revenue: 66588910,
    total_fees: -14629619,
    total_adjustments: 179000,
    status: "CONFIRMED",
    version_no: 2,
    imported_at: "2025-12-02 10:30",
    imported_by: "张财务",
    acquiring_subject: "PT HIGOOD LIVE JAKARTA",
  },
  {
    statement_id: "ps_01H8X9Y2A3",
    platform: "TIKTOK",
    store_id: "st_tiktok_jkt_01",
    store_name: "HiGOOD TikTok JKT",
    period_start: "2025-10-01",
    period_end: "2025-10-31",
    timezone: "UTC+7",
    currency: "IDR",
    total_settlement_amount: 48250000,
    total_revenue: 62000000,
    total_fees: -13750000,
    total_adjustments: 0,
    status: "CONFIRMED",
    version_no: 1,
    imported_at: "2025-11-02 09:15",
    imported_by: "张财务",
    acquiring_subject: "PT HIGOOD LIVE JAKARTA",
  },
  {
    statement_id: "ps_01H8X9Y3B4",
    platform: "SHOPEE",
    store_id: "st_shopee_jkt_01",
    store_name: "HiGOOD Shopee JKT",
    period_start: "2025-11-01",
    period_end: "2025-11-30",
    timezone: "UTC+7",
    currency: "IDR",
    total_settlement_amount: 35000000,
    total_revenue: 45000000,
    total_fees: -10000000,
    total_adjustments: 0,
    status: "VALIDATED",
    version_no: 1,
    imported_at: "2025-12-01 14:20",
    imported_by: "李财务",
    acquiring_subject: "PT HIGOOD LIVE JAKARTA",
  },
]

const statusConfig: Record<StatementStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700", icon: Clock },
  IMPORTED: { label: "已导入", color: "bg-blue-100 text-blue-700", icon: FileText },
  VALIDATED: { label: "已校验", color: "bg-green-100 text-green-700", icon: FileCheck },
  CONFIRMED: { label: "已确认", color: "bg-green-100 text-green-700", icon: CheckCircle },
  SUPERSEDED: { label: "已替代", color: "bg-gray-100 text-gray-700", icon: XCircle },
}

export default function StatementsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filterPlatform, setFilterPlatform] = useState<string>("all")
  const [filterStore, setFilterStore] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterCurrency, setFilterCurrency] = useState<string>("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedStatement, setSelectedStatement] = useState<Statement | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const openDetail = (statement: Statement) => {
    setSelectedStatement(statement)
    setDetailOpen(true)
  }

  const openImport = () => {
    setImportOpen(true)
  }

  const filteredStatements = mockStatements.filter((s) => {
    if (filterPlatform !== "all" && s.platform !== filterPlatform) return false
    if (filterStore !== "all" && s.store_id !== filterStore) return false
    if (filterStatus !== "all" && s.status !== filterStatus) return false
    if (filterCurrency !== "all" && s.currency !== filterCurrency) return false
    if (searchKeyword && !s.statement_id.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  // 统计指标
  const totalStatements = filteredStatements.length
  const confirmedStatements = filteredStatements.filter(s => s.status === "CONFIRMED").length
  const totalAmount = filteredStatements.reduce((sum, s) => sum + s.total_settlement_amount, 0)

  return (
    <Suspense fallback={<Loading />}> {/* Wrap the main content in a Suspense boundary */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">平台账单/结算单</h1>
            <p className="text-muted-foreground">
              承接平台侧官方结算口径，统一沉淀结算汇总、订单明细、入账提现记录
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出列表
            </Button>
            <Button size="sm" onClick={openImport}>
              <Upload className="h-4 w-4 mr-2" />
              导入账单
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalStatements}</div>
                  <div className="text-sm text-muted-foreground">账单总数</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{confirmedStatements}</div>
                  <div className="text-sm text-muted-foreground">已确认账单</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{(totalAmount / 1000000).toFixed(1)}M</div>
                  <div className="text-sm text-muted-foreground">结算总额（IDR）</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">2</div>
                  <div className="text-sm text-muted-foreground">平台数量</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
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
                  <SelectItem value="st_tiktok_jkt_01">HiGOOD TikTok JKT</SelectItem>
                  <SelectItem value="st_shopee_jkt_01">HiGOOD Shopee JKT</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="CONFIRMED">已确认</SelectItem>
                  <SelectItem value="VALIDATED">已校验</SelectItem>
                  <SelectItem value="IMPORTED">已导入</SelectItem>
                  <SelectItem value="SUPERSEDED">已替代</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue placeholder="币种" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部币种</SelectItem>
                  <SelectItem value="IDR">IDR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索账单ID、备注..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
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
                  <TableHead>账期</TableHead>
                  <TableHead>时区</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead className="text-right">结算入账金额</TableHead>
                  <TableHead className="text-right">总收入</TableHead>
                  <TableHead className="text-right">总费用</TableHead>
                  <TableHead>收单主体</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>导入时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStatements.map((statement) => {
                  const config = statusConfig[statement.status]
                  const Icon = config.icon
                  return (
                    <TableRow key={statement.statement_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{statement.store_name}</div>
                          <div className="text-sm text-muted-foreground">{statement.platform}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{statement.period_start}</div>
                          <div className="text-muted-foreground">~ {statement.period_end}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{statement.timezone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{statement.currency}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {statement.total_settlement_amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {statement.total_revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {statement.total_fees.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{statement.acquiring_subject}</TableCell>
                      <TableCell>
                        <Badge variant="outline">v{statement.version_no}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{statement.imported_at}</div>
                        <div className="text-xs">{statement.imported_by}</div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openDetail(statement)}>
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

        {/* PS2 账单详情页 Sheet */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
            {selectedStatement && (
              <>
                <SheetHeader>
                  <SheetTitle>平台账单详情</SheetTitle>
                  <SheetDescription>
                    {selectedStatement.platform} | {selectedStatement.store_name} | {selectedStatement.period_start} ~ {selectedStatement.period_end}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* 关键指标卡 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">关键指标</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">结算入账金额</div>
                          <div className="text-xl font-bold">
                            {selectedStatement.total_settlement_amount.toLocaleString()} {selectedStatement.currency}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">总收入</div>
                          <div className="text-xl font-bold text-green-600">
                            {selectedStatement.total_revenue.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">总费用</div>
                          <div className="text-xl font-bold text-red-600">
                            {selectedStatement.total_fees.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">调整金额</div>
                          <div className="text-xl font-bold">
                            {selectedStatement.total_adjustments.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="overview">概览</TabsTrigger>
                      <TabsTrigger value="orders">订单明细</TabsTrigger>
                      <TabsTrigger value="withdrawals">入账/提现</TabsTrigger>
                      <TabsTrigger value="fees">字段解释</TabsTrigger>
                      <TabsTrigger value="validation">校验异常</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">收入类指标</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Total Revenue</span>
                            <span className="font-mono">{selectedStatement.total_revenue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Customer Payment</span>
                            <span className="font-mono">68,250,000</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">费用类指标</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Total Fees</span>
                            <span className="font-mono text-red-600">{selectedStatement.total_fees.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Platform Commission Fee</span>
                            <span className="font-mono text-red-600">-8,500,000</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Order Processing Fee</span>
                            <span className="font-mono text-red-600">-2,100,000</span>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="orders">
                      <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                        订单/调整明细：显示 Order details 表数据，支持按类型、日期、金额筛选
                      </div>
                    </TabsContent>

                    <TabsContent value="withdrawals">
                      <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                        账户入账/提现记录：显示 Withdrawal records 数据，区分 Earnings / Withdrawal 类型
                      </div>
                    </TabsContent>

                    <TabsContent value="fees">
                      <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                        字段解释：显示 Fees explanation，帮助理解各费用项含义
                      </div>
                    </TabsContent>

                    <TabsContent value="validation">
                      <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                        校验与异常：显示导入时的校验结果、异常记录、工单入口
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* PS3 导入账单向导 Dialog */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>导入平台账单</DialogTitle>
              <DialogDescription>
                上传平台导出的结算单文件（Excel格式），系统将自动识别账期、币种等信息
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>选择平台</Label>
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
                <Label>选择店铺</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择店铺" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="st_tiktok_jkt_01">HiGOOD TikTok JKT</SelectItem>
                    <SelectItem value="st_shopee_jkt_01">HiGOOD Shopee JKT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>上传文件</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">点击上传或拖拽文件到这里</p>
                  <p className="text-xs text-muted-foreground mt-1">支持 .xlsx 格式，最大 10MB</p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">导入说明：</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>文件必须包含 Reports、Order details、Withdrawal records 三个Sheet</li>
                      <li>系统将自动识别账期、时区、币种并回填</li>
                      <li>导入前会进行校验，检查结构、币种一致性、汇总准确性等</li>
                      <li>若同一账期已存在账单，将生成新版本</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                取消
              </Button>
              <Button>
                开始导入
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Suspense>
  )
}
