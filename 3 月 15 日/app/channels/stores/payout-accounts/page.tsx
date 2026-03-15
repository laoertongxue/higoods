"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Search, RotateCcw, Eye, Edit, Building2, User, Wallet, ArrowLeft } from "lucide-react"

// 归属类型
const OWNER_TYPE = {
  PERSONAL: { label: "个人", color: "bg-blue-100 text-blue-700" },
  LEGAL: { label: "法人", color: "bg-purple-100 text-purple-700" },
}

// 状态
const ACCOUNT_STATUS = {
  ACTIVE: { label: "启用", color: "bg-green-100 text-green-700" },
  INACTIVE: { label: "停用", color: "bg-gray-100 text-gray-500" },
}

// 法人主体列表
const LEGAL_ENTITIES = [
  { id: "LE-001", name: "HiGOOD LIVE Limited", country: "HK" },
  { id: "LE-002", name: "PT HIGOOD LIVE JAKARTA", country: "ID" },
]

// Mock提现账号数据
const mockPayoutAccounts = [
  {
    id: "PA-001",
    name: "HiGOOD LIVE Limited - TikTok Payout",
    payoutChannel: "平台内提现",
    identifierMasked: "****6789",
    ownerType: "LEGAL",
    ownerRefId: "LE-001",
    ownerName: "HiGOOD LIVE Limited",
    country: "HK",
    currency: "USD",
    status: "ACTIVE",
    relatedStoresCount: 2,
    updatedAt: "2026-01-10 10:00",
  },
  {
    id: "PA-002",
    name: "PT HIGOOD LIVE - IDN Payout",
    payoutChannel: "平台内提现",
    identifierMasked: "****1234",
    ownerType: "LEGAL",
    ownerRefId: "LE-002",
    ownerName: "PT HIGOOD LIVE JAKARTA",
    country: "ID",
    currency: "IDR",
    status: "ACTIVE",
    relatedStoresCount: 1,
    updatedAt: "2026-01-08 14:30",
  },
  {
    id: "PA-003",
    name: "张三-个人卡",
    payoutChannel: "银行转账",
    identifierMasked: "****5678",
    ownerType: "PERSONAL",
    ownerRefId: "P-001",
    ownerName: "张三",
    country: "ID",
    currency: "IDR",
    status: "ACTIVE",
    relatedStoresCount: 1,
    updatedAt: "2026-01-05 09:00",
  },
  {
    id: "PA-004",
    name: "李四-个人卡",
    payoutChannel: "银行转账",
    identifierMasked: "****9012",
    ownerType: "PERSONAL",
    ownerRefId: "P-002",
    ownerName: "李四",
    country: "VN",
    currency: "VND",
    status: "ACTIVE",
    relatedStoresCount: 1,
    updatedAt: "2026-01-03 16:00",
  },
  {
    id: "PA-005",
    name: "旧账号-已停用",
    payoutChannel: "PSP",
    identifierMasked: "****0000",
    ownerType: "LEGAL",
    ownerRefId: "LE-001",
    ownerName: "HiGOOD LIVE Limited",
    country: "HK",
    currency: "USD",
    status: "INACTIVE",
    relatedStoresCount: 0,
    updatedAt: "2025-12-01 10:00",
  },
]

export default function PayoutAccountListPage() {
  const router = useRouter()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterOwnerType, setFilterOwnerType] = useState<string>("all")
  const [filterLegalEntity, setFilterLegalEntity] = useState<string>("all")
  const [filterCountry, setFilterCountry] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [newAccount, setNewAccount] = useState({
    name: "",
    payoutChannel: "",
    identifier: "",
    ownerType: "",
    ownerRefId: "",
    country: "",
    currency: "",
  })

  // 筛选数据
  const filteredAccounts = mockPayoutAccounts.filter((account) => {
    if (
      searchKeyword &&
      !account.name.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !account.identifierMasked.includes(searchKeyword)
    )
      return false
    if (filterOwnerType !== "all" && account.ownerType !== filterOwnerType) return false
    if (filterLegalEntity !== "all" && account.ownerRefId !== filterLegalEntity) return false
    if (filterCountry !== "all" && account.country !== filterCountry) return false
    if (filterStatus !== "all" && account.status !== filterStatus) return false
    return true
  })

  // 统计数据
  const stats = {
    total: mockPayoutAccounts.length,
    active: mockPayoutAccounts.filter((a) => a.status === "ACTIVE").length,
    legal: mockPayoutAccounts.filter((a) => a.ownerType === "LEGAL").length,
    personal: mockPayoutAccounts.filter((a) => a.ownerType === "PERSONAL").length,
  }

  const handleReset = () => {
    setSearchKeyword("")
    setFilterOwnerType("all")
    setFilterLegalEntity("all")
    setFilterCountry("all")
    setFilterStatus("all")
  }

  const handleCreateAccount = () => {
    toast.success("提现账号创建成功")
    setShowCreateDrawer(false)
    setNewAccount({
      name: "",
      payoutChannel: "",
      identifier: "",
      ownerType: "",
      ownerRefId: "",
      country: "",
      currency: "",
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/channels/stores")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                返回店铺列表
              </Button>
              <div>
                <h1 className="text-2xl font-bold">提现账号管理</h1>
                <p className="text-muted-foreground text-sm mt-1">管理提现账号主数据，决定店铺收入归属主体</p>
              </div>
            </div>
            <Button onClick={() => setShowCreateDrawer(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建提现账号
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleReset}>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">全部账号</div>
                <div className="text-2xl font-bold mt-1">{stats.total}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFilterStatus("ACTIVE")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">启用中</div>
                <div className="text-2xl font-bold mt-1 text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFilterOwnerType("LEGAL")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  法人账号
                </div>
                <div className="text-2xl font-bold mt-1 text-purple-600">{stats.legal}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFilterOwnerType("PERSONAL")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <User className="h-4 w-4" />
                  个人账号
                </div>
                <div className="text-2xl font-bold mt-1 text-blue-600">{stats.personal}</div>
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
                    placeholder="搜索账号名称/尾号/PSP标识"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterOwnerType} onValueChange={setFilterOwnerType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="归属类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="LEGAL">法人</SelectItem>
                    <SelectItem value="PERSONAL">个人</SelectItem>
                  </SelectContent>
                </Select>
                {filterOwnerType === "LEGAL" && (
                  <Select value={filterLegalEntity} onValueChange={setFilterLegalEntity}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="法人主体" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部法人</SelectItem>
                      {LEGAL_ENTITIES.map((le) => (
                        <SelectItem key={le.id} value={le.id}>
                          {le.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={filterCountry} onValueChange={setFilterCountry}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="国家/币种" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="HK">香港</SelectItem>
                    <SelectItem value="ID">印尼</SelectItem>
                    <SelectItem value="VN">越南</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="ACTIVE">启用</SelectItem>
                    <SelectItem value="INACTIVE">停用</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  重置
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
                    <TableHead>提现账号名称</TableHead>
                    <TableHead>归属类型</TableHead>
                    <TableHead>归属主体</TableHead>
                    <TableHead>国家/币种</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>关联店铺</TableHead>
                    <TableHead>最近更新</TableHead>
                    <TableHead className="w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow
                      key={account.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/channels/stores/payout-accounts/${account.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{account.name}</div>
                            <div className="text-xs text-muted-foreground">{account.identifierMasked}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={OWNER_TYPE[account.ownerType as keyof typeof OWNER_TYPE]?.color}>
                          {account.ownerType === "LEGAL" ? (
                            <Building2 className="h-3 w-3 mr-1" />
                          ) : (
                            <User className="h-3 w-3 mr-1" />
                          )}
                          {OWNER_TYPE[account.ownerType as keyof typeof OWNER_TYPE]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{account.ownerName}</TableCell>
                      <TableCell>
                        <div>{account.country}</div>
                        <div className="text-xs text-muted-foreground">{account.currency}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={ACCOUNT_STATUS[account.status as keyof typeof ACCOUNT_STATUS]?.color}>
                          {ACCOUNT_STATUS[account.status as keyof typeof ACCOUNT_STATUS]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{account.relatedStoresCount} 个店铺</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{account.updatedAt}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/channels/stores/payout-accounts/${account.id}`)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              toast.info("编辑功能开发中")
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* PA3: Create Payout Account Drawer */}
          <Sheet open={showCreateDrawer} onOpenChange={setShowCreateDrawer}>
            <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>新建提现账号</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>账号名称 *</Label>
                    <Input
                      value={newAccount.name}
                      onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                      placeholder="如：HiGOOD LIVE Limited - TikTok Payout"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>提现渠道</Label>
                    <Select
                      value={newAccount.payoutChannel}
                      onValueChange={(v) => setNewAccount({ ...newAccount, payoutChannel: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择提现渠道" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PLATFORM">平台内提现</SelectItem>
                        <SelectItem value="PSP">PSP (支付服务商)</SelectItem>
                        <SelectItem value="BANK">银行转账</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>账号标识（脱敏展示）</Label>
                    <Input
                      value={newAccount.identifier}
                      onChange={(e) => setNewAccount({ ...newAccount, identifier: e.target.value })}
                      placeholder="如：卡号尾号/账户尾号/钱包ID"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>归属类型 *</Label>
                    <Select
                      value={newAccount.ownerType}
                      onValueChange={(v) => setNewAccount({ ...newAccount, ownerType: v, ownerRefId: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择归属类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LEGAL">法人 (公司)</SelectItem>
                        <SelectItem value="PERSONAL">个人</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newAccount.ownerType === "LEGAL" && (
                    <div className="space-y-2">
                      <Label>法人主体 *</Label>
                      <Select
                        value={newAccount.ownerRefId}
                        onValueChange={(v) => setNewAccount({ ...newAccount, ownerRefId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择法人主体" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEGAL_ENTITIES.map((le) => (
                            <SelectItem key={le.id} value={le.id}>
                              {le.name} ({le.country})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {newAccount.ownerType === "PERSONAL" && (
                    <div className="space-y-2">
                      <Label>个人姓名 *</Label>
                      <Input
                        value={newAccount.ownerRefId}
                        onChange={(e) => setNewAccount({ ...newAccount, ownerRefId: e.target.value })}
                        placeholder="输入个人姓名"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>国家/区域 *</Label>
                      <Select
                        value={newAccount.country}
                        onValueChange={(v) => setNewAccount({ ...newAccount, country: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择国家" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HK">香港</SelectItem>
                          <SelectItem value="ID">印尼</SelectItem>
                          <SelectItem value="VN">越南</SelectItem>
                          <SelectItem value="MY">马来西亚</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>币种 *</Label>
                      <Select
                        value={newAccount.currency}
                        onValueChange={(v) => setNewAccount({ ...newAccount, currency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择币种" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="IDR">IDR</SelectItem>
                          <SelectItem value="VND">VND</SelectItem>
                          <SelectItem value="MYR">MYR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setShowCreateDrawer(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateAccount}>创建账号</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </main>
      </div>
    </div>
  )
}
