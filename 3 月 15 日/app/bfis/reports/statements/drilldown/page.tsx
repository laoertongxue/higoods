"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import {
  Download,
  ChevronLeft,
  ExternalLink,
  Filter,
  Building2,
  Store,
  Package,
  Info,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"

// MS2｜报表行下钻明细页（通用 Drilldown）

// 行定义配置
const lineDefinitions: Record<string, { name: string; sourceObject: string; columns: string[] }> = {
  PL_GMV_NET: { name: "有效GMV（净额）", sourceObject: "PlatformStatement", columns: ["单据号", "店铺", "平台", "原币金额", "本位币", "USD金额", "汇率追溯", "状态"] },
  PL_COGS: { name: "销售成本（COGS）", sourceObject: "COGSRecord", columns: ["结转单号", "订单/SKU", "成本类型", "原币金额", "USD金额", "汇率追溯", "版本", "状态"] },
  BS_CASH: { name: "货币资金", sourceObject: "FundAccount", columns: ["账户编码", "账户名称", "币种", "原币余额", "USD余额", "账户类型", "状态"] },
  BS_AR_PLATFORM: { name: "平台结算应收", sourceObject: "ARLedger", columns: ["应收单号", "店铺", "平台", "原币金额", "USD金额", "四态", "账龄", "状态"] },
  BS_INVENTORY: { name: "存货", sourceObject: "InventoryValuation", columns: ["仓库", "SKU", "数量", "单价", "原币金额", "USD金额", "计价方式", "状态"] },
  CF_OP_IN_PLATFORM: { name: "平台提现到账", sourceObject: "Withdrawal", columns: ["提现单号", "店铺", "平台", "原币金额", "USD金额", "到账日期", "汇率追溯", "状态"] },
}

// Mock 下钻数据
const mockDrilldownData: Record<string, Array<Record<string, string | number>>> = {
  PL_GMV_NET: [
    { id: "PS001", 单据号: "TT-2026012101", 店铺: "TikTok ID Shop 1", 平台: "TikTok", 原币金额: 15600000000, 本位币: "IDR", USD金额: 1000000, 汇率追溯: "PERIOD_FIXED 15600", 状态: "CONFIRMED" },
    { id: "PS002", 单据号: "TT-2026012102", 店铺: "TikTok ID Shop 2", 平台: "TikTok", 原币金额: 12480000000, 本位币: "IDR", USD金额: 800000, 汇率追溯: "PERIOD_FIXED 15600", 状态: "CONFIRMED" },
    { id: "PS003", 单据号: "SP-2026012101", 店铺: "Shopee ID Shop", 平台: "Shopee", 原币金额: 7800000000, 本位币: "IDR", USD金额: 500000, 汇率追溯: "PERIOD_FIXED 15600", 状态: "CONFIRMED" },
    { id: "PS004", 单据号: "TT-2026012103", 店铺: "TikTok ID Shop 1", 平台: "TikTok", 原币金额: 8580000000, 本位币: "IDR", USD金额: 550000, 汇率追溯: "PERIOD_FIXED 15600", 状态: "PENDING" },
  ],
  PL_COGS: [
    { id: "CG001", 结转单号: "COGS-2026012101", "订单/SKU": "ORD-001 / SKU-A001", 成本类型: "做货成本", 原币金额: 5000000000, USD金额: 320512, 汇率追溯: "PERIOD_FIXED 15600", 版本: "V1", 状态: "CONFIRMED" },
    { id: "CG002", 结转单号: "COGS-2026012102", "订单/SKU": "ORD-002 / SKU-B001", 成本类型: "现货成本", 原币金额: 3000000000, USD金额: 192307, 汇率追溯: "PERIOD_FIXED 15600", 版本: "V1", 状态: "ESTIMATED" },
    { id: "CG003", 结转单号: "COGS-2026012103", "订单/SKU": "ORD-003 / SKU-A002", 成本类型: "做货成本", 原币金额: 4500000000, USD金额: 288461, 汇率追溯: "PERIOD_FIXED 15600", 版本: "V1", 状态: "CONFIRMED" },
  ],
  BS_CASH: [
    { id: "FA001", 账户编码: "BANK-HK-HSBC-001", 账户名称: "HSBC HK USD Account", 币种: "USD", 原币余额: 500000, USD余额: 500000, 账户类型: "银行账户", 状态: "ACTIVE" },
    { id: "FA002", 账户编码: "BANK-ID-BCA-001", 账户名称: "BCA IDR Account", 币种: "IDR", 原币余额: 3120000000, USD余额: 200000, 账户类型: "银行账户", 状态: "ACTIVE" },
    { id: "FA003", 账户编码: "PLATFORM-TT-001", 账户名称: "TikTok ID Wallet", 币种: "IDR", 原币余额: 2340000000, USD余额: 150000, 账户类型: "平台钱包", 状态: "ACTIVE" },
  ],
}

// 状态配置
const statusConfig: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "已确认", color: "bg-green-100 text-green-700" },
  PENDING: { label: "待确认", color: "bg-yellow-100 text-yellow-700" },
  ESTIMATED: { label: "暂估", color: "bg-orange-100 text-orange-700" },
  ACTIVE: { label: "启用", color: "bg-blue-100 text-blue-700" },
}

// 格式化金额
function formatNumber(value: string | number): string {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value)
  }
  return String(value)
}

function DrilldownPageContent() {
  const searchParams = useSearchParams()
  const lineCode = searchParams.get("line") || "PL_GMV_NET"
  const period = searchParams.get("period") || "2026-01"
  const scope = searchParams.get("scope") || "GROUP"

  const [filterEntity, setFilterEntity] = useState("all")
  const [filterStore, setFilterStore] = useState("all")
  const [searchText, setSearchText] = useState("")

  const lineDef = lineDefinitions[lineCode] || { name: lineCode, sourceObject: "Unknown", columns: [] }
  const data = mockDrilldownData[lineCode] || []

  // 过滤数据
  const filteredData = data.filter((row) => {
    if (searchText) {
      const searchLower = searchText.toLowerCase()
      return Object.values(row).some(v => String(v).toLowerCase().includes(searchLower))
    }
    return true
  })

  // 计算合计
  const totalUsd = filteredData.reduce((sum, row) => {
    const usdCol = Object.keys(row).find(k => k.includes("USD"))
    return sum + (usdCol ? Number(row[usdCol]) || 0 : 0)
  }, 0)

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/bfis/reports/statements">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">报表行下钻</h1>
              <p className="text-muted-foreground">
                {lineDef.name} | 期间: {period} | 来源: {lineDef.sourceObject}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
          </div>
        </div>

        {/* 摘要信息 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">行项目</div>
              <div className="text-lg font-bold mt-1">{lineDef.name}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">期间</div>
              <div className="text-lg font-bold mt-1">{period}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">明细数量</div>
              <div className="text-lg font-bold mt-1">{filteredData.length} 条</div>
            </CardContent>
          </Card>
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <div className="text-sm text-primary">USD 合计</div>
              <div className="text-lg font-bold mt-1 text-primary">
                ${new Intl.NumberFormat("en-US").format(totalUsd)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 筛选 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-[200px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Select value={filterEntity} onValueChange={setFilterEntity}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="法人主体" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部法人</SelectItem>
                    <SelectItem value="HK_HIGOOD_PROC">HK-采购出口</SelectItem>
                    <SelectItem value="ID_BDG_FADFAD">BDG-生产</SelectItem>
                    <SelectItem value="ID_JKT_HIGOOD_LIVE">JKT-直播</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <Select value={filterStore} onValueChange={setFilterStore}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="店铺" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部店铺</SelectItem>
                    <SelectItem value="TT-ID-1">TikTok ID Shop 1</SelectItem>
                    <SelectItem value="TT-ID-2">TikTok ID Shop 2</SelectItem>
                    <SelectItem value="SP-ID-1">Shopee ID Shop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 明细表格 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>下钻明细</CardTitle>
                <CardDescription>来源对象: {lineDef.sourceObject}</CardDescription>
              </div>
              <Badge variant="outline">{filteredData.length} 条记录</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {lineDef.columns.map((col) => (
                      <TableHead key={col} className={col.includes("金额") || col.includes("余额") ? "text-right" : ""}>
                        {col}
                      </TableHead>
                    ))}
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={lineDef.columns.length + 1} className="text-center py-8 text-muted-foreground">
                        无明细数据（规则不匹配/数据未生成/权限不足）
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((row) => (
                      <TableRow key={row.id as string}>
                        {lineDef.columns.map((col) => {
                          const value = row[col]
                          const isAmount = col.includes("金额") || col.includes("余额")
                          const isStatus = col === "状态"
                          
                          if (isStatus && statusConfig[value as string]) {
                            const config = statusConfig[value as string]
                            return (
                              <TableCell key={col}>
                                <Badge className={config.color}>{config.label}</Badge>
                              </TableCell>
                            )
                          }
                          
                          if (col === "汇率追溯") {
                            return (
                              <TableCell key={col}>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="font-mono text-xs cursor-help">
                                      {value as string}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>汇率类型: PERIOD_FIXED</p>
                                    <p>汇率集ID: RS_2026_01_001</p>
                                    <p>解析路径: ledger.rate_set</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            )
                          }

                          return (
                            <TableCell 
                              key={col} 
                              className={`${isAmount ? "text-right font-mono" : ""}`}
                            >
                              {isAmount ? formatNumber(value) : String(value)}
                            </TableCell>
                          )
                        })}
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 口径说明 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-4 w-4" />
              下钻说明
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">数据来源</h4>
                <p className="text-muted-foreground">
                  本行数据来源于 {lineDef.sourceObject}，按报表取数规则过滤后汇总。
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">汇率追溯</h4>
                <p className="text-muted-foreground">
                  所有折算均返回追溯字段（rate_set_id / rate_type / resolve_path），可查看具体汇率来源。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

export default function DrilldownPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DrilldownPageContent />
    </Suspense>
  )
}
