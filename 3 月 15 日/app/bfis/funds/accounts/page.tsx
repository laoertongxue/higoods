"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Building2,
  Landmark,
  Wallet,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Download,
  Plus,
  Edit,
  Pause,
  Eye,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

// CA1｜资金账户列表页
// CA2｜资金账户详情页（Sheet）
// CA3｜新建/编辑资金账户抽屉

type AccountType = "BANK" | "PLATFORM" | "PSP_WALLET" | "CASH" | "INTERNAL_CLEARING"
type AccountStatus = "ACTIVE" | "INACTIVE" | "FROZEN"
type PurposeTag = "COLLECTION" | "PAYMENT" | "PAYOUT" | "ESCROW" | "TAX"

interface CashAccount {
  account_id: string
  account_code: string
  account_name: string
  account_type: AccountType
  platform?: string
  legal_entity: string
  legal_entity_name: string
  ledger: string
  ledger_name: string
  currency: string
  country: string
  status: AccountStatus
  purpose_tags: PurposeTag[]
  bank_name?: string
  bank_account_no_masked?: string
  bank_balance_snapshot_amount: number
  bank_balance_snapshot_time: string
  system_balance_amount: number
  delta_amount: number
  last_reconciled_at: string
}

// Mock data
const mockAccounts: CashAccount[] = [
  {
    account_id: "ca_001",
    account_code: "CA-ID-BDG-001",
    account_name: "BDG主收款账户",
    account_type: "BANK",
    legal_entity: "ID_BDG_FADFAD",
    legal_entity_name: "PT FADFAD FASHION BANDUNG",
    ledger: "GL_ID_BDG_IDR",
    ledger_name: "BDG法定账本",
    currency: "IDR",
    country: "ID",
    status: "ACTIVE",
    purpose_tags: ["COLLECTION", "PAYOUT"],
    bank_name: "BCA",
    bank_account_no_masked: "********6968",
    bank_balance_snapshot_amount: 1850000000,
    bank_balance_snapshot_time: "2026-01-22 09:00",
    system_balance_amount: 1835000000,
    delta_amount: 15000000,
    last_reconciled_at: "2026-01-21 18:00",
  },
  {
    account_id: "ca_002",
    account_code: "CA-ID-JKT-001",
    account_name: "JKT主收款账户",
    account_type: "BANK",
    legal_entity: "ID_JKT_HIGOOD_LIVE",
    legal_entity_name: "PT HIGOOD LIVE JAKARTA",
    ledger: "GL_ID_JKT_IDR",
    ledger_name: "JKT法定账本",
    currency: "IDR",
    country: "ID",
    status: "ACTIVE",
    purpose_tags: ["COLLECTION", "PAYOUT"],
    bank_name: "Mandiri",
    bank_account_no_masked: "********1234",
    bank_balance_snapshot_amount: 890000000,
    bank_balance_snapshot_time: "2026-01-22 09:00",
    system_balance_amount: 885000000,
    delta_amount: 5000000,
    last_reconciled_at: "2026-01-21 18:00",
  },
  {
    account_id: "ca_003",
    account_code: "CA-HK-001",
    account_name: "HK主收款账户",
    account_type: "BANK",
    legal_entity: "HK_HIGOOD_PROC",
    legal_entity_name: "HIGOOD LIVE LIMITED",
    ledger: "GL_HK_USD",
    ledger_name: "HK法定账本",
    currency: "USD",
    country: "HK",
    status: "ACTIVE",
    purpose_tags: ["COLLECTION", "PAYMENT"],
    bank_name: "HSBC",
    bank_account_no_masked: "********5678",
    bank_balance_snapshot_amount: 285000,
    bank_balance_snapshot_time: "2026-01-22 09:00",
    system_balance_amount: 280000,
    delta_amount: 5000,
    last_reconciled_at: "2026-01-21 18:00",
  },
  {
    account_id: "ca_004",
    account_code: "CA-TIKTOK-JKT-001",
    account_name: "TikTok JKT平台资金",
    account_type: "PLATFORM",
    platform: "TIKTOK",
    legal_entity: "ID_JKT_HIGOOD_LIVE",
    legal_entity_name: "PT HIGOOD LIVE JAKARTA",
    ledger: "GL_ID_JKT_IDR",
    ledger_name: "JKT法定账本",
    currency: "IDR",
    country: "ID",
    status: "ACTIVE",
    purpose_tags: ["COLLECTION"],
    bank_balance_snapshot_amount: 125000000,
    bank_balance_snapshot_time: "2026-01-22 08:00",
    system_balance_amount: 125000000,
    delta_amount: 0,
    last_reconciled_at: "2026-01-22 08:00",
  },
  {
    account_id: "ca_005",
    account_code: "CA-CN-BJ-001",
    account_name: "北京主收款账户",
    account_type: "BANK",
    legal_entity: "CN_BJ_FANDE",
    legal_entity_name: "北京范得科技有限公司",
    ledger: "GL_CN_BJ_CNY",
    ledger_name: "BJ法定账本",
    currency: "CNY",
    country: "CN",
    status: "ACTIVE",
    purpose_tags: ["COLLECTION", "PAYMENT"],
    bank_name: "中国银行",
    bank_account_no_masked: "********9012",
    bank_balance_snapshot_amount: 3250000,
    bank_balance_snapshot_time: "2026-01-22 09:00",
    system_balance_amount: 3180000,
    delta_amount: 70000,
    last_reconciled_at: "2026-01-21 18:00",
  },
]

const accountTypeConfig: Record<AccountType, { label: string; color: string; icon: typeof Landmark }> = {
  BANK: { label: "银行", color: "bg-blue-100 text-blue-700", icon: Landmark },
  PLATFORM: { label: "平台", color: "bg-purple-100 text-purple-700", icon: Wallet },
  PSP_WALLET: { label: "钱包", color: "bg-green-100 text-green-700", icon: Wallet },
  CASH: { label: "现金", color: "bg-orange-100 text-orange-700", icon: DollarSign },
  INTERNAL_CLEARING: { label: "内部", color: "bg-gray-100 text-gray-700", icon: Building2 },
}

const statusConfig: Record<AccountStatus, { label: string; color: string }> = {
  ACTIVE: { label: "启用", color: "bg-green-100 text-green-700" },
  INACTIVE: { label: "停用", color: "bg-gray-100 text-gray-700" },
  FROZEN: { label: "冻结", color: "bg-red-100 text-red-700" },
}

const purposeTagLabels: Record<PurposeTag, string> = {
  COLLECTION: "收款",
  PAYMENT: "付款",
  PAYOUT: "平台提现",
  ESCROW: "保证金",
  TAX: "税金",
}

export default function AccountsPage() {
  const [selectedAccount, setSelectedAccount] = useState<CashAccount | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CashAccount | null>(null)

  // Calculate KPIs
  const totalBankBalance = mockAccounts.reduce((sum, acc) => sum + acc.bank_balance_snapshot_amount, 0)
  const totalSystemBalance = mockAccounts.reduce((sum, acc) => sum + acc.system_balance_amount, 0)
  const totalDelta = mockAccounts.reduce((sum, acc) => sum + acc.delta_amount, 0)

  const formatAmount = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">资金账户</h1>
          <p className="text-muted-foreground">
            统一管理集团各法人主体的资金承载账户（银行/平台/钱包），监控余额与口径差异
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => { setEditingAccount(null); setDrawerOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            新建账户
          </Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Landmark className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">银行余额总览</div>
                <div className="text-xl font-bold">¥{(totalBankBalance / 1000000).toFixed(1)}M</div>
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
                <div className="text-sm text-muted-foreground">系统余额总览</div>
                <div className="text-xl font-bold">¥{(totalSystemBalance / 1000000).toFixed(1)}M</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={totalDelta > 0 ? "border-yellow-200" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totalDelta > 0 ? "bg-yellow-100" : "bg-gray-100"}`}>
                <AlertTriangle className={`h-5 w-5 ${totalDelta > 0 ? "text-yellow-600" : "text-gray-600"}`} />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">差异总额</div>
                <div className="text-xl font-bold">¥{(totalDelta / 1000000).toFixed(1)}M</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">账户总数</div>
                <div className="text-xl font-bold">{mockAccounts.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="搜索账户名称、编码、银行尾号..." className="pl-9" />
            </div>
            <Select defaultValue="all-type">
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="账户类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-type">全部类型</SelectItem>
                <SelectItem value="BANK">银行</SelectItem>
                <SelectItem value="PLATFORM">平台</SelectItem>
                <SelectItem value="PSP_WALLET">钱包</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all-status">
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-status">全部状态</SelectItem>
                <SelectItem value="ACTIVE">启用</SelectItem>
                <SelectItem value="INACTIVE">停用</SelectItem>
                <SelectItem value="FROZEN">冻结</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all-currency">
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="币种" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-currency">全部币种</SelectItem>
                <SelectItem value="IDR">IDR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CNY">CNY</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              更多筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>账户编码</TableHead>
                <TableHead>账户名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>法人主体</TableHead>
                <TableHead>币种</TableHead>
                <TableHead>银行信息</TableHead>
                <TableHead className="text-right">银行余额</TableHead>
                <TableHead className="text-right">系统余额</TableHead>
                <TableHead className="text-right">差异</TableHead>
                <TableHead>最近对账</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAccounts.map((account) => {
                const typeConfig = accountTypeConfig[account.account_type]
                const TypeIcon = typeConfig.icon
                const hasDelta = Math.abs(account.delta_amount) > 100000
                
                return (
                  <TableRow key={account.account_id} className={hasDelta ? "bg-yellow-50" : ""}>
                    <TableCell className="font-mono text-sm">{account.account_code}</TableCell>
                    <TableCell className="font-medium">{account.account_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeConfig.color}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {typeConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{account.legal_entity_name}</div>
                      <div className="text-xs text-muted-foreground">{account.ledger_name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{account.currency}</Badge>
                    </TableCell>
                    <TableCell>
                      {account.account_type === "BANK" ? (
                        <div className="text-sm">
                          <div>{account.bank_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{account.bank_account_no_masked}</div>
                        </div>
                      ) : account.account_type === "PLATFORM" ? (
                        <Badge variant="outline">{account.platform}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <div className="text-sm font-semibold">{formatAmount(account.bank_balance_snapshot_amount, account.currency)}</div>
                      <div className="text-xs text-muted-foreground">{account.bank_balance_snapshot_time}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatAmount(account.system_balance_amount, account.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <div className={`text-sm font-semibold ${hasDelta ? "text-yellow-700" : "text-muted-foreground"}`}>
                        {account.delta_amount > 0 ? "+" : ""}{formatAmount(account.delta_amount, account.currency)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{account.last_reconciled_at}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig[account.status].color}>
                        {statusConfig[account.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedAccount(account)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditingAccount(account); setDrawerOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CA2｜资金账户详情页（Sheet） */}
      <Sheet open={!!selectedAccount} onOpenChange={(open) => !open && setSelectedAccount(null)}>
        <SheetContent className="sm:max-w-[800px] overflow-y-auto">
          {selectedAccount && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-xl">{selectedAccount.account_name}</SheetTitle>
                    <SheetDescription className="mt-1">
                      {selectedAccount.account_code} · {selectedAccount.legal_entity_name}
                    </SheetDescription>
                  </div>
                  <Badge className={statusConfig[selectedAccount.status].color}>
                    {statusConfig[selectedAccount.status].label}
                  </Badge>
                </div>
              </SheetHeader>

              <Tabs defaultValue="basic" className="mt-6">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic">基本信息</TabsTrigger>
                  <TabsTrigger value="balance">余额与口径</TabsTrigger>
                  <TabsTrigger value="usage">关联使用</TabsTrigger>
                  <TabsTrigger value="reconcile">对账异常</TabsTrigger>
                  <TabsTrigger value="audit">审计日志</TabsTrigger>
                </TabsList>

                {/* Tab1: 基本信息 */}
                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">账户类型</Label>
                      <div className="mt-1">
                        <Badge variant="outline" className={accountTypeConfig[selectedAccount.account_type].color}>
                          {accountTypeConfig[selectedAccount.account_type].label}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">币种</Label>
                      <div className="mt-1 font-semibold">{selectedAccount.currency}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">法人主体</Label>
                      <div className="mt-1 font-semibold">{selectedAccount.legal_entity_name}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">账本</Label>
                      <div className="mt-1 font-semibold">{selectedAccount.ledger_name}</div>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">用途标签</Label>
                      <div className="mt-1 flex gap-2">
                        {selectedAccount.purpose_tags.map((tag) => (
                          <Badge key={tag} variant="outline">{purposeTagLabels[tag]}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedAccount.account_type === "BANK" && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h3 className="font-semibold">银行信息</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">银行名称</Label>
                            <div className="mt-1 font-semibold">{selectedAccount.bank_name}</div>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">账号尾号</Label>
                            <div className="mt-1 font-mono">{selectedAccount.bank_account_no_masked}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedAccount.account_type === "PLATFORM" && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h3 className="font-semibold">平台信息</h3>
                        <div>
                          <Label className="text-muted-foreground">平台</Label>
                          <div className="mt-1">
                            <Badge variant="outline">{selectedAccount.platform}</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          此账户用于承载平台资金头寸（已结算/可提现但未到账的资金状态）
                        </p>
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Tab2: 余额与口径 */}
                <TabsContent value="balance" className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="p-4">
                        <div className="text-sm text-blue-700 mb-1">银行余额快照</div>
                        <div className="text-2xl font-bold text-blue-900">
                          {formatAmount(selectedAccount.bank_balance_snapshot_amount, selectedAccount.currency)}
                        </div>
                        <div className="text-xs text-blue-600 mt-2">{selectedAccount.bank_balance_snapshot_time}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground mb-1">系统余额</div>
                        <div className="text-2xl font-bold">
                          {formatAmount(selectedAccount.system_balance_amount, selectedAccount.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">根据确认收付计算</div>
                      </CardContent>
                    </Card>
                    <Card className={Math.abs(selectedAccount.delta_amount) > 100000 ? "border-yellow-200 bg-yellow-50" : ""}>
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground mb-1">差异 (Delta)</div>
                        <div className={`text-2xl font-bold ${Math.abs(selectedAccount.delta_amount) > 100000 ? "text-yellow-700" : ""}`}>
                          {selectedAccount.delta_amount > 0 ? "+" : ""}{formatAmount(selectedAccount.delta_amount, selectedAccount.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">银行 - 系统</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">余额快照历史（最近30天）</h3>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        录入快照
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">暂无历史快照记录</div>
                  </div>
                </TabsContent>

                {/* Tab3: 关联使用 */}
                <TabsContent value="usage" className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">使用统计</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground mb-1">关联提现单</div>
                          <div className="text-2xl font-bold">12</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground mb-1">关联付款单</div>
                          <div className="text-2xl font-bold">8</div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-3">关联店铺提现账号</h3>
                    <p className="text-sm text-muted-foreground">暂无关联店铺提现账号</p>
                  </div>
                </TabsContent>

                {/* Tab4: 对账异常 */}
                <TabsContent value="reconcile" className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">对账状态</h3>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-muted-foreground">最近对账时间</div>
                            <div className="text-lg font-semibold mt-1">{selectedAccount.last_reconciled_at}</div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Link href="/bfis/funds/accounts/snapshots">
                              发起对账
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-3">未匹配流水</h3>
                    <p className="text-sm text-muted-foreground">暂无未匹配流水</p>
                  </div>
                </TabsContent>

                {/* Tab5: 审计日志 */}
                <TabsContent value="audit" className="space-y-3">
                  <p className="text-sm text-muted-foreground">暂无审计日志记录</p>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* CA3｜新建/编辑资金账户抽屉 */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{editingAccount ? "编辑资金账户" : "新建资金账户"}</DrawerTitle>
            <DrawerDescription>
              {editingAccount ? "修改账户信息" : "创建新的资金承载账户"}
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>账户编码 *</Label>
                <Input placeholder="CA-ID-BDG-001" defaultValue={editingAccount?.account_code} />
              </div>
              <div>
                <Label>账户名称 *</Label>
                <Input placeholder="BDG主收款账户" defaultValue={editingAccount?.account_name} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>账户类型 *</Label>
                <Select defaultValue={editingAccount?.account_type || "BANK"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK">银行</SelectItem>
                    <SelectItem value="PLATFORM">平台</SelectItem>
                    <SelectItem value="PSP_WALLET">钱包</SelectItem>
                    <SelectItem value="CASH">现金</SelectItem>
                    <SelectItem value="INTERNAL_CLEARING">内部清算</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>状态 *</Label>
                <Select defaultValue={editingAccount?.status || "ACTIVE"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">启用</SelectItem>
                    <SelectItem value="INACTIVE">停用</SelectItem>
                    <SelectItem value="FROZEN">冻结</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>法人主体 *</Label>
                <Select defaultValue={editingAccount?.legal_entity}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择法人主体" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ID_BDG_FADFAD">PT FADFAD FASHION BANDUNG</SelectItem>
                    <SelectItem value="ID_JKT_HIGOOD_LIVE">PT HIGOOD LIVE JAKARTA</SelectItem>
                    <SelectItem value="HK_HIGOOD_PROC">HIGOOD LIVE LIMITED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>账本 *</Label>
                <Select defaultValue={editingAccount?.ledger}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择账本" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GL_ID_BDG_IDR">BDG法定账本</SelectItem>
                    <SelectItem value="GL_ID_JKT_IDR">JKT法定账本</SelectItem>
                    <SelectItem value="GL_HK_USD">HK法定账本</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>币种 *</Label>
                <Select defaultValue={editingAccount?.currency}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择币种" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold">银行信息（当类型为"银行"时必填）</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>银行名称</Label>
                  <Input placeholder="BCA" defaultValue={editingAccount?.bank_name} />
                </div>
                <div>
                  <Label>开户名</Label>
                  <Input placeholder="PT FADFAD..." />
                </div>
              </div>
              <div>
                <Label>银行账号（保密存储）</Label>
                <Input type="password" placeholder="完整账号" />
                <p className="text-xs text-muted-foreground mt-1">账号将加密存储，展示时仅显示尾号</p>
              </div>
            </div>
          </div>

          <DrawerFooter>
            <Button onClick={() => setDrawerOpen(false)}>
              {editingAccount ? "保存" : "创建"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">取消</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
