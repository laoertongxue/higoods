"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading" // Import the Loading component
import {
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  Link as LinkIcon,
  Unlink,
  Eye,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// MR1｜到账匹配中心

interface UnmatchedWithdrawal {
  id: string
  platform: string
  storeName: string
  referenceId: string
  successTime: string
  amount: number
  currency: string
  bankAccountMasked: string
  daysOverdue: number
}

interface BankTransaction {
  id: string
  transactionTime: string
  amount: number
  currency: string
  counterparty: string
  bankAccount: string
  description: string
  matched: boolean
}

interface MatchResult {
  withdrawalId: string
  bankTxnId: string
  confidence: number
  matchRule: string
  status: "PENDING" | "CONFIRMED" | "REJECTED"
}

// Mock data
const mockUnmatched: UnmatchedWithdrawal[] = [
  {
    id: "wd_002",
    platform: "TIKTOK",
    storeName: "Higood Live",
    referenceId: "3530819661875544330",
    successTime: "2025-11-18 16:00:00",
    amount: 48500000,
    currency: "IDR",
    bankAccountMasked: "********6968",
    daysOverdue: 3,
  },
]

const mockBankTxns: BankTransaction[] = [
  {
    id: "bk_001",
    transactionTime: "2025-11-19 10:00:00",
    amount: 48500000,
    currency: "IDR",
    counterparty: "TIKTOK PTE LTD",
    bankAccount: "BCA-********6968",
    description: "Platform settlement",
    matched: false,
  },
  {
    id: "bk_002",
    transactionTime: "2025-11-19 14:30:00",
    amount: 48490000,
    currency: "IDR",
    counterparty: "BYTEDANCE",
    bankAccount: "BCA-********6968",
    description: "Withdrawal",
    matched: false,
  },
]

export default function MatchCenterPage() {
  return (
    <Suspense fallback={<Loading />}>
      <MatchCenterPageContent />
    </Suspense>
  )
}

function MatchCenterPageContent() {
  const searchParams = useSearchParams()
  const preselectedWd = searchParams.get("wd")
  
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<string | null>(preselectedWd)
  const [selectedBankTxn, setSelectedBankTxn] = useState<string | null>(null)
  const [matchResults, setMatchResults] = useState<MatchResult[]>([])
  const [filterPlatform, setFilterPlatform] = useState("all")

  const handleMatch = () => {
    if (!selectedWithdrawal || !selectedBankTxn) return
    
    const withdrawal = mockUnmatched.find((w) => w.id === selectedWithdrawal)
    const bankTxn = mockBankTxns.find((b) => b.id === selectedBankTxn)
    
    if (!withdrawal || !bankTxn) return

    const amountDiff = Math.abs(withdrawal.amount - bankTxn.amount)
    const confidence = amountDiff === 0 ? 100 : amountDiff < 100000 ? 85 : 60

    const newMatch: MatchResult = {
      withdrawalId: selectedWithdrawal,
      bankTxnId: selectedBankTxn,
      confidence,
      matchRule: "MANUAL_MATCH",
      status: "PENDING",
    }

    setMatchResults([...matchResults, newMatch])
    setSelectedWithdrawal(null)
    setSelectedBankTxn(null)
  }

  const handleConfirm = (index: number) => {
    const updated = [...matchResults]
    updated[index].status = "CONFIRMED"
    setMatchResults(updated)
  }

  const handleReject = (index: number) => {
    const updated = [...matchResults]
    updated[index].status = "REJECTED"
    setMatchResults(updated)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">到账匹配中心</h1>
          <p className="text-muted-foreground">
            处理提现单与银行流水的匹配关系，确保回款闭环
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">1</div>
                <div className="text-sm text-muted-foreground">待匹配提现单</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Search className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">2</div>
                <div className="text-sm text-muted-foreground">待匹配银行流水</div>
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
                <div className="text-2xl font-bold">{matchResults.filter((m) => m.status === "CONFIRMED").length}</div>
                <div className="text-sm text-muted-foreground">本次已匹配</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="manual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manual">手工匹配</TabsTrigger>
          <TabsTrigger value="auto">自动匹配建议</TabsTrigger>
          <TabsTrigger value="results">匹配结果</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Left: Unmatched Withdrawals */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">待匹配提现单</CardTitle>
                  <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部平台</SelectItem>
                      <SelectItem value="TIKTOK">TikTok</SelectItem>
                      <SelectItem value="SHOPEE">Shopee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>选择</TableHead>
                      <TableHead>店铺</TableHead>
                      <TableHead>参考号</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>超期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockUnmatched.map((wd) => (
                      <TableRow
                        key={wd.id}
                        className={selectedWithdrawal === wd.id ? "bg-blue-50" : ""}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            name="withdrawal"
                            checked={selectedWithdrawal === wd.id}
                            onChange={() => setSelectedWithdrawal(wd.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{wd.storeName}</div>
                          <div className="text-xs text-muted-foreground">{wd.platform}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{wd.referenceId}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-mono text-sm">{wd.amount.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">{wd.currency}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-red-100 text-red-700">
                            {wd.daysOverdue}天
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Right: Bank Transactions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">待匹配银行流水</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>选择</TableHead>
                      <TableHead>时间</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>对手方</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockBankTxns.map((txn) => (
                      <TableRow
                        key={txn.id}
                        className={selectedBankTxn === txn.id ? "bg-blue-50" : ""}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            name="banktxn"
                            checked={selectedBankTxn === txn.id}
                            onChange={() => setSelectedBankTxn(txn.id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">{txn.transactionTime}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-mono text-sm">{txn.amount.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">{txn.currency}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{txn.counterparty}</div>
                          <div className="text-xs text-muted-foreground">{txn.description}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button
              size="lg"
              disabled={!selectedWithdrawal || !selectedBankTxn}
              onClick={handleMatch}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              建立匹配关系
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="auto">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="p-4 bg-blue-100 rounded-full inline-block mb-4">
                <Search className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium mb-2">自动匹配建议</h3>
              <p className="text-muted-foreground mb-4">
                基于金额、时间、账号等规则自动推荐匹配关系
              </p>
              <Button>
                <Search className="h-4 w-4 mr-2" />
                开始自动匹配
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>提现单</TableHead>
                    <TableHead>银行流水</TableHead>
                    <TableHead>匹配规则</TableHead>
                    <TableHead>置信度</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无匹配结果
                      </TableCell>
                    </TableRow>
                  ) : (
                    matchResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{result.withdrawalId}</TableCell>
                        <TableCell className="font-mono text-sm">{result.bankTxnId}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{result.matchRule}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">{result.confidence}%</div>
                            {result.confidence >= 90 && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                            {result.confidence < 90 && result.confidence >= 70 && (
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {result.status === "PENDING" && (
                            <Badge className="bg-yellow-100 text-yellow-700">待确认</Badge>
                          )}
                          {result.status === "CONFIRMED" && (
                            <Badge className="bg-green-100 text-green-700">已确认</Badge>
                          )}
                          {result.status === "REJECTED" && (
                            <Badge className="bg-red-100 text-red-700">已拒绝</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.status === "PENDING" && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConfirm(index)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                确认
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReject(index)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                拒绝
                              </Button>
                            </div>
                          )}
                          {result.status === "CONFIRMED" && (
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              查看
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
