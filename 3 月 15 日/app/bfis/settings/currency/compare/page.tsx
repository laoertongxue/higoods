"use client"

import { useState } from "react"
import {
  ArrowRightLeft,
  Calculator,
  AlertTriangle,
  Info,
  ChevronRight,
  FileText,
  Link as LinkIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// DX1｜汇率对照与差异解释页
// 使用 SPOT 仅作参考，不影响管理口径报表
// 输入：账本、期间、币对、金额（可选）
// 输出：各口径汇率值、折算结果、差异金额/比例、引用的 rate_set_id/fx_rate_id

// Mock 账本数据
const mockLedgers = [
  { id: "ledger_001", code: "GL_MGMT_USD", name: "集团管理账本", currency: "USD" },
  { id: "ledger_002", code: "GL_ID_BDG_IDR", name: "BDG法定账本", currency: "IDR" },
  { id: "ledger_003", code: "GL_ID_JKT_IDR", name: "JKT法定账本", currency: "IDR" },
  { id: "ledger_004", code: "GL_CN_BJ_CNY", name: "BJ法定账本", currency: "CNY" },
  { id: "ledger_005", code: "GL_CN_SZ_CNY", name: "SZ法定账本", currency: "CNY" },
  { id: "ledger_006", code: "GL_HK_USD", name: "HK法定账本", currency: "USD" },
]

// Mock 汇率对照结果
const mockCompareResult = {
  baseCurrency: "IDR",
  quoteCurrency: "USD",
  inputAmount: 15600000,
  periodFixed: {
    rate: 0.0000641,
    rateSetId: "rs_001",
    rateSetItemId: "rsi_001",
    status: "LOCKED",
    source: "IMPORT",
    convertedAmount: 999.96,
  },
  endPeriod: {
    rate: 0.0000638,
    rateSetId: "rs_002",
    rateSetItemId: "rsi_005",
    status: "LOCKED",
    source: "IMPORT",
    convertedAmount: 995.28,
  },
  spot: {
    rate: 0.0000635,
    fxRateId: "fx_015",
    effectiveDate: "2026-01-21",
    source: "IMPORT",
    convertedAmount: 990.60,
  },
}

export default function ComparePage() {
  const [selectedLedger, setSelectedLedger] = useState("")
  const [selectedPeriod, setSelectedPeriod] = useState("2026-01")
  const [baseCurrency, setBaseCurrency] = useState("IDR")
  const [quoteCurrency, setQuoteCurrency] = useState("USD")
  const [inputAmount, setInputAmount] = useState("15600000")
  const [showResult, setShowResult] = useState(true)

  const handleCompare = () => {
    if (!selectedLedger) {
      toast.error("请选择账本")
      return
    }
    setShowResult(true)
    toast.success("对照完成")
  }

  const calculateDiff = (rate1: number, rate2: number) => {
    const diff = ((rate1 - rate2) / rate2) * 100
    return diff.toFixed(4)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">汇率对照与差异解释</h1>
          <p className="text-muted-foreground">
            对比不同口径（期间固定/期末/即期）的汇率值，解释折算差异
          </p>
        </div>
      </div>

      {/* 重要提示 */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800">SPOT 仅作参考</h4>
            <p className="text-sm text-yellow-700 mt-1">
              即期汇率（SPOT）仅用于查询/审计追溯/差异解释，不进入管理口径的默认解析链路。
              管理口径只使用 PERIOD_FIXED（期间固定）+ END_PERIOD（期末）。
            </p>
          </div>
        </div>
      </div>

      {/* 查询条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">查询条件</CardTitle>
          <CardDescription>选择账本、期间和币对进行汇率对照</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>账本 *</Label>
              <Select value={selectedLedger} onValueChange={setSelectedLedger}>
                <SelectTrigger>
                  <SelectValue placeholder="选择账本" />
                </SelectTrigger>
                <SelectContent>
                  {mockLedgers.map((ledger) => (
                    <SelectItem key={ledger.id} value={ledger.id}>
                      {ledger.name} ({ledger.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>期间 *</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026-01">2026-01</SelectItem>
                  <SelectItem value="2025-12">2025-12</SelectItem>
                  <SelectItem value="2025-11">2025-11</SelectItem>
                  <SelectItem value="2025-10">2025-10</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>原币种</Label>
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">IDR</SelectItem>
                  <SelectItem value="CNY">CNY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>目标币种</Label>
              <Select value={quoteCurrency} onValueChange={setQuoteCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CNY">CNY</SelectItem>
                  <SelectItem value="IDR">IDR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>金额（可选）</Label>
              <Input
                type="number"
                placeholder="输入金额进行折算"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleCompare}>
              <Calculator className="h-4 w-4 mr-2" />
              开始对照
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 对照结果 */}
      {showResult && (
        <div className="space-y-6">
          {/* 汇率对比卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 期间固定 */}
            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-700">管理口径</Badge>
                    期间固定
                  </CardTitle>
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    {mockCompareResult.periodFixed.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-green-700">
                    {mockCompareResult.periodFixed.rate.toFixed(8)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    1 {baseCurrency} = {mockCompareResult.periodFixed.rate.toFixed(8)} {quoteCurrency}
                  </div>
                </div>
                {inputAmount && (
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <div className="text-sm text-green-600">折算结果</div>
                    <div className="text-xl font-bold text-green-700">
                      {mockCompareResult.periodFixed.convertedAmount.toLocaleString()} {quoteCurrency}
                    </div>
                  </div>
                )}
                <Separator className="my-3" />
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">来源</span>
                    <span>{mockCompareResult.periodFixed.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">汇率集ID</span>
                    <span className="font-mono">{mockCompareResult.periodFixed.rateSetId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">明细ID</span>
                    <span className="font-mono">{mockCompareResult.periodFixed.rateSetItemId}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 期末 */}
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-700">管理口径</Badge>
                    期末
                  </CardTitle>
                  <Badge variant="outline" className="text-blue-600 border-blue-300">
                    {mockCompareResult.endPeriod.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-blue-700">
                    {mockCompareResult.endPeriod.rate.toFixed(8)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    1 {baseCurrency} = {mockCompareResult.endPeriod.rate.toFixed(8)} {quoteCurrency}
                  </div>
                </div>
                {inputAmount && (
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <div className="text-sm text-blue-600">折算结果</div>
                    <div className="text-xl font-bold text-blue-700">
                      {mockCompareResult.endPeriod.convertedAmount.toLocaleString()} {quoteCurrency}
                    </div>
                  </div>
                )}
                <Separator className="my-3" />
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">来源</span>
                    <span>{mockCompareResult.endPeriod.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">汇率集ID</span>
                    <span className="font-mono">{mockCompareResult.endPeriod.rateSetId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">明细ID</span>
                    <span className="font-mono">{mockCompareResult.endPeriod.rateSetItemId}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 即期 */}
            <Card className="border-orange-200 border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge className="bg-orange-100 text-orange-700">仅参考</Badge>
                    即期 (SPOT)
                  </CardTitle>
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    {mockCompareResult.spot.effectiveDate}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-orange-700">
                    {mockCompareResult.spot.rate.toFixed(8)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    1 {baseCurrency} = {mockCompareResult.spot.rate.toFixed(8)} {quoteCurrency}
                  </div>
                </div>
                {inputAmount && (
                  <div className="p-3 bg-orange-50 rounded-lg text-center">
                    <div className="text-sm text-orange-600">折算结果（仅参考）</div>
                    <div className="text-xl font-bold text-orange-700">
                      {mockCompareResult.spot.convertedAmount.toLocaleString()} {quoteCurrency}
                    </div>
                  </div>
                )}
                <Separator className="my-3" />
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">来源</span>
                    <span>{mockCompareResult.spot.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">原子汇率ID</span>
                    <span className="font-mono">{mockCompareResult.spot.fxRateId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">生效日期</span>
                    <span>{mockCompareResult.spot.effectiveDate}</span>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                  <Info className="h-3 w-3 inline mr-1" />
                  SPOT 不参与管理口径计算
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 差异分析 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">差异分析</CardTitle>
              <CardDescription>各口径汇率之间的差异对比</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>对比项</TableHead>
                    <TableHead className="text-right">汇率A</TableHead>
                    <TableHead className="text-right">汇率B</TableHead>
                    <TableHead className="text-right">汇率差异</TableHead>
                    <TableHead className="text-right">差异率</TableHead>
                    {inputAmount && <TableHead className="text-right">金额差异</TableHead>}
                    <TableHead>说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">期间固定 vs 期末</TableCell>
                    <TableCell className="text-right font-mono">{mockCompareResult.periodFixed.rate.toFixed(8)}</TableCell>
                    <TableCell className="text-right font-mono">{mockCompareResult.endPeriod.rate.toFixed(8)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {(mockCompareResult.periodFixed.rate - mockCompareResult.endPeriod.rate).toFixed(8)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={(mockCompareResult.periodFixed.rate - mockCompareResult.endPeriod.rate) > 0 ? "text-green-600" : "text-red-600"}>
                        {calculateDiff(mockCompareResult.periodFixed.rate, mockCompareResult.endPeriod.rate)}%
                      </span>
                    </TableCell>
                    {inputAmount && (
                      <TableCell className="text-right font-mono">
                        {(mockCompareResult.periodFixed.convertedAmount - mockCompareResult.endPeriod.convertedAmount).toFixed(2)} {quoteCurrency}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">期内与期末的汇率口径差异</TableCell>
                  </TableRow>
                  <TableRow className="bg-orange-50/50">
                    <TableCell className="font-medium">
                      期间固定 vs 即期
                      <Badge variant="outline" className="ml-2 text-xs">参考</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{mockCompareResult.periodFixed.rate.toFixed(8)}</TableCell>
                    <TableCell className="text-right font-mono text-orange-600">{mockCompareResult.spot.rate.toFixed(8)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {(mockCompareResult.periodFixed.rate - mockCompareResult.spot.rate).toFixed(8)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={(mockCompareResult.periodFixed.rate - mockCompareResult.spot.rate) > 0 ? "text-green-600" : "text-red-600"}>
                        {calculateDiff(mockCompareResult.periodFixed.rate, mockCompareResult.spot.rate)}%
                      </span>
                    </TableCell>
                    {inputAmount && (
                      <TableCell className="text-right font-mono">
                        {(mockCompareResult.periodFixed.convertedAmount - mockCompareResult.spot.convertedAmount).toFixed(2)} {quoteCurrency}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">管理口径与即期的差异（仅参考）</TableCell>
                  </TableRow>
                  <TableRow className="bg-orange-50/50">
                    <TableCell className="font-medium">
                      期末 vs 即期
                      <Badge variant="outline" className="ml-2 text-xs">参考</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{mockCompareResult.endPeriod.rate.toFixed(8)}</TableCell>
                    <TableCell className="text-right font-mono text-orange-600">{mockCompareResult.spot.rate.toFixed(8)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {(mockCompareResult.endPeriod.rate - mockCompareResult.spot.rate).toFixed(8)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={(mockCompareResult.endPeriod.rate - mockCompareResult.spot.rate) > 0 ? "text-green-600" : "text-red-600"}>
                        {calculateDiff(mockCompareResult.endPeriod.rate, mockCompareResult.spot.rate)}%
                      </span>
                    </TableCell>
                    {inputAmount && (
                      <TableCell className="text-right font-mono">
                        {(mockCompareResult.endPeriod.convertedAmount - mockCompareResult.spot.convertedAmount).toFixed(2)} {quoteCurrency}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">期末口径与即期的差异（仅参考）</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 追溯信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">追溯信息</CardTitle>
              <CardDescription>所有折算结果必须可追溯到具体的汇率记录</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-3">期间固定汇率追溯</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-3 w-3" />
                      <span className="text-muted-foreground">汇率集:</span>
                      <code className="text-xs bg-green-100 px-1 rounded">{mockCompareResult.periodFixed.rateSetId}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-3 w-3" />
                      <span className="text-muted-foreground">明细项:</span>
                      <code className="text-xs bg-green-100 px-1 rounded">{mockCompareResult.periodFixed.rateSetItemId}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      <span className="text-muted-foreground">解析路径:</span>
                      <span>RATE_SET / DIRECT</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-3">期末汇率追溯</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-3 w-3" />
                      <span className="text-muted-foreground">汇率集:</span>
                      <code className="text-xs bg-blue-100 px-1 rounded">{mockCompareResult.endPeriod.rateSetId}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-3 w-3" />
                      <span className="text-muted-foreground">明细项:</span>
                      <code className="text-xs bg-blue-100 px-1 rounded">{mockCompareResult.endPeriod.rateSetItemId}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      <span className="text-muted-foreground">解析路径:</span>
                      <span>RATE_SET / DIRECT</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg border-dashed">
                  <h4 className="font-medium text-orange-800 mb-3">即期汇率追溯（仅参考）</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-3 w-3" />
                      <span className="text-muted-foreground">原子汇率:</span>
                      <code className="text-xs bg-orange-100 px-1 rounded">{mockCompareResult.spot.fxRateId}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      <span className="text-muted-foreground">生效日期:</span>
                      <span>{mockCompareResult.spot.effectiveDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      <span className="text-muted-foreground">解析路径:</span>
                      <span>FX_RATE / DIRECT</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 口径说明 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">口径说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">PERIOD_FIXED 期间固定</h4>
                  <p className="text-green-700">
                    期间内所有管理口径折算的默认依据。用于利润类、毛利快照、经营分析等。
                    期间确定后锁定。
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">END_PERIOD 期末</h4>
                  <p className="text-blue-700">
                    期末余额折算与月末重估输入依据。用于资产负债类期末、往来余额等。
                    月末落定后锁定。
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h4 className="font-medium text-orange-800 mb-2">SPOT 即期（仅参考）</h4>
                  <p className="text-orange-700">
                    仅维护，用于查询/审计追溯/差异解释。
                    <strong>不进入管理口径的默认解析链路。</strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
