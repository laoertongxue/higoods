"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import {
  Search,
  Plus,
  Download,
  Building2,
  User,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  Globe,
  DollarSign,
  FileText,
  Link as LinkIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

// PA1｜提现银行账号列表页
// PA2｜提现银行账号详情页（Sheet Tabs）
// PA3｜新建/编辑提现银行账号抽屉

const mockPayoutAccounts = [
  {
    payout_account_id: "pa_001",
    payout_account_name: "JKT-对公主账户",
    bank_name: "Bank Central Asia (BCA)",
    bank_country_code: "ID",
    currency: "IDR",
    account_holder_name: "PT HIGOOD LIVE JAKARTA",
    account_no_masked: "****1234",
    owner_type: "LEGAL",
    owner_ref_id: "le_id_jkt",
    owner_ref_name: "PT HIGOOD LIVE JAKARTA",
    status: "ACTIVE",
    bound_stores_count: 2,
    created_at: "2025-01-01",
    updated_at: "2026-01-20",
  },
  {
    payout_account_id: "pa_002",
    payout_account_name: "SZ-对公账户",
    bank_name: "中国工商银行",
    bank_country_code: "CN",
    currency: "CNY",
    account_holder_name: "深圳嗨好科技有限公司",
    account_no_masked: "****9012",
    owner_type: "LEGAL",
    owner_ref_id: "le_cn_sz",
    owner_ref_name: "深圳嗨好科技有限公司",
    status: "ACTIVE",
    bound_stores_count: 1,
    created_at: "2025-03-01",
    updated_at: "2026-01-15",
  },
  {
    payout_account_id: "pa_003",
    payout_account_name: "张三-个人卡",
    bank_name: "Bank Mandiri",
    bank_country_code: "ID",
    currency: "IDR",
    account_holder_name: "Zhang San",
    account_no_masked: "****5678",
    owner_type: "PERSONAL",
    owner_ref_id: "person_001",
    owner_ref_name: "张三",
    status: "ACTIVE",
    bound_stores_count: 1,
    created_at: "2025-06-01",
    updated_at: "2026-01-10",
  },
  {
    payout_account_id: "pa_004",
    payout_account_name: "测试账号（已停用）",
    bank_name: "Bank BRI",
    bank_country_code: "ID",
    currency: "IDR",
    account_holder_name: "Test Account",
    account_no_masked: "****0000",
    owner_type: "PERSONAL",
    owner_ref_id: "person_test",
    owner_ref_name: "测试用户",
    status: "INACTIVE",
    bound_stores_count: 0,
    created_at: "2025-01-01",
    updated_at: "2025-12-01",
  },
]

const mockBoundStores = [
  { store_code: "TK-ID-001", store_name: "HiGood TK ID", platform: "TIKTOK", status: "ACTIVE" },
  { store_code: "SP-ID-001", store_name: "HiGood SP ID", platform: "SHOPEE", status: "ACTIVE" },
]

const ownerTypeConfig = {
  LEGAL: { label: "法人", color: "bg-blue-100 text-blue-700", icon: Building2 },
  PERSONAL: { label: "个人", color: "bg-purple-100 text-purple-700", icon: User },
}

const statusConfig = {
  ACTIVE: { label: "启用", color: "bg-green-100 text-green-700", icon: CheckCircle },
  INACTIVE: { label: "停用", color: "bg-gray-100 text-gray-700", icon: XCircle },
  FROZEN: { label: "冻结", color: "bg-red-100 text-red-700", icon: XCircle },
}

function PayoutAccountsPageContent() {
  const searchParams = useSearchParams()
  const [filterOwnerType, setFilterOwnerType] = useState("all")
  const [filterCountry, setFilterCountry] = useState("all")
  const [filterCurrency, setFilterCurrency] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [selectedAccount, setSelectedAccount] = useState<any>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const openDetail = (account: any) => {
    setSelectedAccount(account)
    setIsDetailOpen(true)
  }

  const openEdit = (account?: any) => {
    setSelectedAccount(account || null)
    setIsEditOpen(true)
  }

  const filteredAccounts = mockPayoutAccounts.filter((account) => {
    if (filterOwnerType !== "all" && account.owner_type !== filterOwnerType) return false
    if (filterCountry !== "all" && account.bank_country_code !== filterCountry) return false
    if (filterCurrency !== "all" && account.currency !== filterCurrency) return false
    if (filterStatus !== "all" && account.status !== filterStatus) return false
    if (searchKeyword && !account.payout_account_name.toLowerCase().includes(searchKeyword.toLowerCase()) && !account.account_holder_name.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const statsCards = [
    { label: "账号总数", value: mockPayoutAccounts.length, color: "text-blue-600" },
    { label: "法人账号", value: mockPayoutAccounts.filter((a) => a.owner_type === "LEGAL").length, color: "text-blue-600" },
    { label: "个人账号", value: mockPayoutAccounts.filter((a) => a.owner_type === "PERSONAL").length, color: "text-purple-600" },
    { label: "被绑定店铺", value: mockPayoutAccounts.reduce((sum, a) => sum + a.bound_stores_count, 0), color: "text-green-600" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">提现银行账号</h1>
          <p className="text-muted-foreground">
            管理平台店铺提现账号主数据，决定收入归属主体
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/bfis/platform/stores">
            <Button variant="outline" size="sm">
              <LinkIcon className="h-4 w-4 mr-2" />
              店铺管理
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => openEdit()}>
            <Plus className="h-4 w-4 mr-2" />
            新增账号
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsCards.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className={`text-2xl font-bold mb-1 ${stat.color}`}>{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Select value={filterOwnerType} onValueChange={setFilterOwnerType}>
              <SelectTrigger>
                <SelectValue placeholder="归属类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="LEGAL">法人</SelectItem>
                <SelectItem value="PERSONAL">个人</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCountry} onValueChange={setFilterCountry}>
              <SelectTrigger>
                <SelectValue placeholder="国家" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部国家</SelectItem>
                <SelectItem value="ID">印尼</SelectItem>
                <SelectItem value="CN">中国</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCurrency} onValueChange={setFilterCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="币种" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部币种</SelectItem>
                <SelectItem value="IDR">IDR</SelectItem>
                <SelectItem value="CNY">CNY</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="ACTIVE">启用</SelectItem>
                <SelectItem value="INACTIVE">停用</SelectItem>
                <SelectItem value="FROZEN">冻结</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索账号名称/开户名..."
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
                <TableHead>账号名称</TableHead>
                <TableHead>银行/国家</TableHead>
                <TableHead>币种</TableHead>
                <TableHead>账号尾号</TableHead>
                <TableHead>归属类型</TableHead>
                <TableHead>归属主体</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>被绑定店铺</TableHead>
                <TableHead>最近更新</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => {
                const ownerInfo = ownerTypeConfig[account.owner_type as keyof typeof ownerTypeConfig]
                const statusInfo = statusConfig[account.status as keyof typeof statusConfig]
                const OwnerIcon = ownerInfo.icon
                const StatusIcon = statusInfo.icon

                return (
                  <TableRow key={account.payout_account_id}>
                    <TableCell>
                      <div className="font-medium">{account.payout_account_name}</div>
                      <div className="text-sm text-muted-foreground">{account.account_holder_name}</div>
                    </TableCell>
                    <TableCell>
                      <div>{account.bank_name}</div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Globe className="h-3 w-3" />
                        {account.bank_country_code}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {account.currency}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {account.account_no_masked}
                    </TableCell>
                    <TableCell>
                      <Badge className={ownerInfo.color}>
                        <OwnerIcon className="h-3 w-3 mr-1" />
                        {ownerInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {account.owner_ref_name}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusInfo.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold">{account.bound_stores_count}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {account.updated_at}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(account)}>
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

      {/* PA2 提现银行账号详情 Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedAccount?.payout_account_name}</SheetTitle>
            <SheetDescription>
              提现银行账号详情
            </SheetDescription>
          </SheetHeader>

          {selectedAccount && (
            <div className="mt-6">
              <Tabs defaultValue="basic">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">基本信息</TabsTrigger>
                  <TabsTrigger value="owner">归属信息</TabsTrigger>
                  <TabsTrigger value="stores">关联店铺</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">账号名称</div>
                          <div className="font-medium mt-1">{selectedAccount.payout_account_name}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">状态</div>
                          <div className="mt-1">
                            <Badge className={statusConfig[selectedAccount.status as keyof typeof statusConfig].color}>
                              {statusConfig[selectedAccount.status as keyof typeof statusConfig].label}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">银行名称</div>
                          <div className="font-medium mt-1">{selectedAccount.bank_name}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">银行国家</div>
                          <div className="font-medium mt-1">{selectedAccount.bank_country_code}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">账号币种</div>
                          <div className="mt-1">
                            <Badge variant="outline">{selectedAccount.currency}</Badge>
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">账号尾号</div>
                          <div className="font-mono font-medium mt-1">{selectedAccount.account_no_masked}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-muted-foreground">开户名</div>
                          <div className="font-medium mt-1">{selectedAccount.account_holder_name}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(selectedAccount)}>
                      <Edit className="h-4 w-4 mr-2" />
                      编辑账号
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="owner" className="space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">归属类型</div>
                          <div className="mt-1">
                            <Badge className={ownerTypeConfig[selectedAccount.owner_type as keyof typeof ownerTypeConfig].color}>
                              {ownerTypeConfig[selectedAccount.owner_type as keyof typeof ownerTypeConfig].label}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">归属主体ID</div>
                          <div className="font-mono text-xs mt-1">{selectedAccount.owner_ref_id}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-muted-foreground">归属主体名称</div>
                          <div className="font-medium mt-1">{selectedAccount.owner_ref_name}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                      <div className="text-sm text-blue-900">
                        <div className="font-medium mb-2">收单主体归属说明</div>
                        <div className="text-blue-700">
                          该账号决定绑定店铺的收入归属主体。所有通过此账号提现的平台收入将归属到：<span className="font-bold">{selectedAccount.owner_ref_name}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="stores" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">关联店铺（当前绑定：{selectedAccount.bound_stores_count}）</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {mockBoundStores.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>店铺编码</TableHead>
                              <TableHead>店铺名称</TableHead>
                              <TableHead>平台</TableHead>
                              <TableHead>状态</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mockBoundStores.map((store, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-sm">{store.store_code}</TableCell>
                                <TableCell>{store.store_name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{store.platform}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">{store.status}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground">
                          暂无绑定店铺
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* PA3 新建/编辑提现银行账号抽屉 */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedAccount ? "编辑提现账号" : "新增提现账号"}</SheetTitle>
            <SheetDescription>
              填写提现银行账号信息
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>账号名称 *</Label>
              <Input defaultValue={selectedAccount?.payout_account_name} placeholder="JKT-对公主账户" />
              <div className="text-sm text-muted-foreground">
                建议格式：主体简称-用途-后缀
              </div>
            </div>

            <div className="space-y-2">
              <Label>银行名称 *</Label>
              <Input defaultValue={selectedAccount?.bank_name} placeholder="Bank Central Asia (BCA)" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>银行国家 *</Label>
                <Select defaultValue={selectedAccount?.bank_country_code || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择国家" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ID">印尼</SelectItem>
                    <SelectItem value="CN">中国</SelectItem>
                    <SelectItem value="US">美国</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>账号币种 *</Label>
                <Select defaultValue={selectedAccount?.currency || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择币种" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>开户名 *</Label>
              <Input defaultValue={selectedAccount?.account_holder_name} placeholder="PT HIGOOD LIVE JAKARTA" />
            </div>

            <div className="space-y-2">
              <Label>账号/卡号 *</Label>
              <Input type="password" placeholder="完整账号（密文存储）" />
              <div className="text-sm text-muted-foreground">
                仅后端密文保存，前端只展示尾号
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>归属类型 *</Label>
              <Select defaultValue={selectedAccount?.owner_type || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="选择归属类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEGAL">法人</SelectItem>
                  <SelectItem value="PERSONAL">个人</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>归属主体 *</Label>
              <Select defaultValue={selectedAccount?.owner_ref_id || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="选择归属主体" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="le_id_jkt">PT HIGOOD LIVE JAKARTA</SelectItem>
                  <SelectItem value="le_cn_sz">深圳嗨好科技有限公司</SelectItem>
                  <SelectItem value="person_001">张三</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">
                法人主体来自 9.1 组织与账本，个人主体来自员工/外部达人档案
              </div>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <Select defaultValue={selectedAccount?.status || "ACTIVE"}>
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

            <div className="space-y-2">
              <Label>附件（可选）</Label>
              <Input type="file" />
              <div className="text-sm text-muted-foreground">
                开户证明、平台截图等
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button className="flex-1">保存</Button>
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setIsEditOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function PayoutAccountsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PayoutAccountsPageContent />
    </Suspense>
  )
}
