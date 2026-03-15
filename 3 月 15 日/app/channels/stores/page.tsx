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
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Plus, Search, RotateCcw, Eye, AlertTriangle, Building2, User, Wallet } from "lucide-react"

// 店铺状态
const STORE_STATUS = {
  ACTIVE: { label: "启用", color: "bg-green-100 text-green-700" },
  INACTIVE: { label: "停用", color: "bg-gray-100 text-gray-500" },
}

// 授权状态
const AUTH_STATUS = {
  CONNECTED: { label: "已连接", color: "bg-green-100 text-green-700" },
  EXPIRED: { label: "已过期", color: "bg-red-100 text-red-700" },
  ERROR: { label: "连接错误", color: "bg-red-100 text-red-700" },
}

// 归属类型
const OWNER_TYPE = {
  PERSONAL: { label: "个人", color: "bg-blue-100 text-blue-700", icon: User },
  LEGAL: { label: "法人", color: "bg-purple-100 text-purple-700", icon: Building2 },
}

// 渠道列表
const CHANNELS = ["TikTok", "Shopee", "独立站"]

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
    ownerType: "LEGAL",
    ownerName: "HiGOOD LIVE Limited",
    identifier: "****6789",
    currency: "USD",
  },
  {
    id: "PA-002",
    name: "PT HIGOOD LIVE - IDN Payout",
    ownerType: "LEGAL",
    ownerName: "PT HIGOOD LIVE JAKARTA",
    identifier: "****1234",
    currency: "IDR",
  },
  {
    id: "PA-003",
    name: "张三-个人卡",
    ownerType: "PERSONAL",
    ownerName: "张三",
    identifier: "****5678",
    currency: "IDR",
  },
  {
    id: "PA-004",
    name: "李四-个人卡",
    ownerType: "PERSONAL",
    ownerName: "李四",
    identifier: "****9012",
    currency: "VND",
  },
]

// Mock店铺数据
const mockStores = [
  {
    id: "ST-001",
    channel: "TikTok",
    storeName: "IDN-Store-A",
    storeCode: "TT_IDN_A",
    platformStoreId: "7239012",
    country: "印尼",
    pricingCurrency: "IDR",
    status: "ACTIVE",
    authStatus: "CONNECTED",
    payoutAccountId: "PA-002",
    payoutAccountName: "PT HIGOOD LIVE - IDN Payout",
    payoutIdentifier: "****1234",
    ownerType: "LEGAL",
    ownerName: "PT HIGOOD LIVE JAKARTA",
    updatedAt: "2026-01-10 14:30",
  },
  {
    id: "ST-002",
    channel: "TikTok",
    storeName: "VN-Store-B",
    storeCode: "TT_VN_B",
    platformStoreId: "7239013",
    country: "越南",
    pricingCurrency: "VND",
    status: "ACTIVE",
    authStatus: "EXPIRED",
    payoutAccountId: "PA-004",
    payoutAccountName: "李四-个人卡",
    payoutIdentifier: "****9012",
    ownerType: "PERSONAL",
    ownerName: "李四",
    updatedAt: "2026-01-08 10:00",
  },
  {
    id: "ST-003",
    channel: "Shopee",
    storeName: "MY-Store-C",
    storeCode: "SP_MY_C",
    platformStoreId: "88901234",
    country: "马来西亚",
    pricingCurrency: "MYR",
    status: "ACTIVE",
    authStatus: "CONNECTED",
    payoutAccountId: "PA-001",
    payoutAccountName: "HiGOOD LIVE Limited - TikTok Payout",
    payoutIdentifier: "****6789",
    ownerType: "LEGAL",
    ownerName: "HiGOOD LIVE Limited",
    updatedAt: "2026-01-05 16:20",
  },
  {
    id: "ST-004",
    channel: "TikTok",
    storeName: "IDN-Store-D",
    storeCode: "TT_IDN_D",
    platformStoreId: "7239014",
    country: "印尼",
    pricingCurrency: "IDR",
    status: "INACTIVE",
    authStatus: "ERROR",
    payoutAccountId: null,
    payoutAccountName: null,
    payoutIdentifier: null,
    ownerType: null,
    ownerName: null,
    updatedAt: "2025-12-20 09:00",
  },
  {
    id: "ST-005",
    channel: "独立站",
    storeName: "Global-Store",
    storeCode: "IND_GLOBAL",
    platformStoreId: null,
    country: "全球",
    pricingCurrency: "USD",
    status: "ACTIVE",
    authStatus: "CONNECTED",
    payoutAccountId: "PA-003",
    payoutAccountName: "张三-个人卡",
    payoutIdentifier: "****5678",
    ownerType: "PERSONAL",
    ownerName: "张三",
    updatedAt: "2026-01-12 11:30",
  },
]

export default function ChannelStoreListPage() {
  const router = useRouter()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterChannel, setFilterChannel] = useState<string>("all")
  const [filterCountry, setFilterCountry] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterAuthStatus, setFilterAuthStatus] = useState<string>("all")
  const [filterOwnerType, setFilterOwnerType] = useState<string>("all")
  const [filterLegalEntity, setFilterLegalEntity] = useState<string>("all")
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [newStore, setNewStore] = useState({
    channel: "",
    storeName: "",
    storeCode: "",
    platformStoreId: "",
    country: "",
    pricingCurrency: "",
    settlementCurrency: "",
    timezone: "",
  })

  // 筛选数据
  const filteredStores = mockStores.filter((store) => {
    if (
      searchKeyword &&
      !store.storeName.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !store.storeCode.toLowerCase().includes(searchKeyword.toLowerCase())
    )
      return false
    if (filterChannel !== "all" && store.channel !== filterChannel) return false
    if (filterCountry !== "all" && store.country !== filterCountry) return false
    if (filterStatus !== "all" && store.status !== filterStatus) return false
    if (filterAuthStatus !== "all" && store.authStatus !== filterAuthStatus) return false
    if (filterOwnerType !== "all" && store.ownerType !== filterOwnerType) return false
    if (filterLegalEntity !== "all" && store.ownerName !== LEGAL_ENTITIES.find((e) => e.id === filterLegalEntity)?.name)
      return false
    return true
  })

  // 统计数据
  const stats = {
    total: mockStores.length,
    active: mockStores.filter((s) => s.status === "ACTIVE").length,
    connected: mockStores.filter((s) => s.authStatus === "CONNECTED").length,
    expired: mockStores.filter((s) => s.authStatus === "EXPIRED").length,
    noPayoutBinding: mockStores.filter((s) => !s.payoutAccountId).length,
    personalOwner: mockStores.filter((s) => s.ownerType === "PERSONAL").length,
  }

  const handleReset = () => {
    setSearchKeyword("")
    setFilterChannel("all")
    setFilterCountry("all")
    setFilterStatus("all")
    setFilterAuthStatus("all")
    setFilterOwnerType("all")
    setFilterLegalEntity("all")
  }

  const handleCreateStore = () => {
    toast.success("店铺创建成功")
    setShowCreateDrawer(false)
    setNewStore({
      channel: "",
      storeName: "",
      storeCode: "",
      platformStoreId: "",
      country: "",
      pricingCurrency: "",
      settlementCurrency: "",
      timezone: "",
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
            <div>
              <h1 className="text-2xl font-bold">渠道店铺管理</h1>
              <p className="text-muted-foreground text-sm mt-1">管理渠道×店铺的基础信息、授权连接、提现账号绑定</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/channels/stores/payout-accounts")}>
                <Wallet className="h-4 w-4 mr-2" />
                提现账号管理
              </Button>
              <Button onClick={() => setShowCreateDrawer(true)}>
                <Plus className="h-4 w-4 mr-2" />
                新建店铺
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-6 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleReset()}>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">全部店铺</div>
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
              onClick={() => setFilterAuthStatus("CONNECTED")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">已授权</div>
                <div className="text-2xl font-bold mt-1 text-blue-600">{stats.connected}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-yellow-200 bg-yellow-50"
              onClick={() => setFilterAuthStatus("EXPIRED")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-yellow-700">授权过期</div>
                <div className="text-2xl font-bold mt-1 text-yellow-600">{stats.expired}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-red-200 bg-red-50"
              onClick={() => {}}
            >
              <CardContent className="p-4">
                <div className="text-sm text-red-700">缺少提现绑定</div>
                <div className="text-2xl font-bold mt-1 text-red-600">{stats.noPayoutBinding}</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-orange-200 bg-orange-50"
              onClick={() => setFilterOwnerType("PERSONAL")}
            >
              <CardContent className="p-4">
                <div className="text-sm text-orange-700">个人归属</div>
                <div className="text-2xl font-bold mt-1 text-orange-600">{stats.personalOwner}</div>
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
                    placeholder="搜索店铺名/内部编码/平台店铺ID"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterChannel} onValueChange={setFilterChannel}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="渠道" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部渠道</SelectItem>
                    {CHANNELS.map((ch) => (
                      <SelectItem key={ch} value={ch}>
                        {ch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterCountry} onValueChange={setFilterCountry}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="国家/区域" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部区域</SelectItem>
                    <SelectItem value="印尼">印尼</SelectItem>
                    <SelectItem value="越南">越南</SelectItem>
                    <SelectItem value="马来西亚">马来西亚</SelectItem>
                    <SelectItem value="全球">全球</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="店铺状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="ACTIVE">启用</SelectItem>
                    <SelectItem value="INACTIVE">停用</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterAuthStatus} onValueChange={setFilterAuthStatus}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="授权状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部授权</SelectItem>
                    <SelectItem value="CONNECTED">已连接</SelectItem>
                    <SelectItem value="EXPIRED">已过期</SelectItem>
                    <SelectItem value="ERROR">连接错误</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterOwnerType} onValueChange={setFilterOwnerType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="归属类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部归属</SelectItem>
                    <SelectItem value="PERSONAL">个人</SelectItem>
                    <SelectItem value="LEGAL">法人</SelectItem>
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
                    <TableHead className="w-[100px]">渠道</TableHead>
                    <TableHead>店铺名称</TableHead>
                    <TableHead>国家/币种</TableHead>
                    <TableHead>授权状态</TableHead>
                    <TableHead>当前提现账号</TableHead>
                    <TableHead>收入归属主体</TableHead>
                    <TableHead>最近更新</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStores.map((store) => (
                    <TableRow
                      key={store.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/channels/stores/${store.id}`)}
                    >
                      <TableCell>
                        <Badge variant="outline">{store.channel}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{store.storeName}</div>
                        <div className="text-xs text-muted-foreground">{store.storeCode}</div>
                      </TableCell>
                      <TableCell>
                        <div>{store.country}</div>
                        <div className="text-xs text-muted-foreground">{store.pricingCurrency}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={AUTH_STATUS[store.authStatus as keyof typeof AUTH_STATUS]?.color || "bg-gray-100"}
                        >
                          {AUTH_STATUS[store.authStatus as keyof typeof AUTH_STATUS]?.label || store.authStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {store.payoutAccountName ? (
                          <div>
                            <div className="text-sm">{store.payoutAccountName}</div>
                            <div className="text-xs text-muted-foreground">{store.payoutIdentifier}</div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="border-red-300 text-red-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            未绑定
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {store.ownerType ? (
                          <div className="flex items-center gap-2">
                            <Badge className={OWNER_TYPE[store.ownerType as keyof typeof OWNER_TYPE]?.color}>
                              {store.ownerType === "LEGAL" ? (
                                <Building2 className="h-3 w-3 mr-1" />
                              ) : (
                                <User className="h-3 w-3 mr-1" />
                              )}
                              {OWNER_TYPE[store.ownerType as keyof typeof OWNER_TYPE]?.label}
                            </Badge>
                            <span className="text-sm">{store.ownerName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{store.updatedAt}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/channels/stores/${store.id}`)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* CS3: Create Store Drawer */}
          <Sheet open={showCreateDrawer} onOpenChange={setShowCreateDrawer}>
            <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>新建渠道店铺</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-6">
                {/* 基础信息 */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">基础信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>渠道 *</Label>
                      <Select value={newStore.channel} onValueChange={(v) => setNewStore({ ...newStore, channel: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择渠道" />
                        </SelectTrigger>
                        <SelectContent>
                          {CHANNELS.map((ch) => (
                            <SelectItem key={ch} value={ch}>
                              {ch}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>店铺名称 *</Label>
                      <Input
                        value={newStore.storeName}
                        onChange={(e) => setNewStore({ ...newStore, storeName: e.target.value })}
                        placeholder="输入店铺名称"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>内部编码 *</Label>
                      <Input
                        value={newStore.storeCode}
                        onChange={(e) => setNewStore({ ...newStore, storeCode: e.target.value })}
                        placeholder="如 TT_IDN_A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>平台店铺ID</Label>
                      <Input
                        value={newStore.platformStoreId}
                        onChange={(e) => setNewStore({ ...newStore, platformStoreId: e.target.value })}
                        placeholder="平台分配的ID"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>国家/区域 *</Label>
                      <Select value={newStore.country} onValueChange={(v) => setNewStore({ ...newStore, country: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择国家" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ID">印尼</SelectItem>
                          <SelectItem value="VN">越南</SelectItem>
                          <SelectItem value="MY">马来西亚</SelectItem>
                          <SelectItem value="TH">泰国</SelectItem>
                          <SelectItem value="PH">菲律宾</SelectItem>
                          <SelectItem value="GLOBAL">全球</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>时区</Label>
                      <Select
                        value={newStore.timezone}
                        onValueChange={(v) => setNewStore({ ...newStore, timezone: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择时区" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Jakarta">Asia/Jakarta (GMT+7)</SelectItem>
                          <SelectItem value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</SelectItem>
                          <SelectItem value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (GMT+8)</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>报价币种 *</Label>
                      <Select
                        value={newStore.pricingCurrency}
                        onValueChange={(v) => setNewStore({ ...newStore, pricingCurrency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择币种" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IDR">IDR (印尼盾)</SelectItem>
                          <SelectItem value="VND">VND (越南盾)</SelectItem>
                          <SelectItem value="MYR">MYR (马来西亚林吉特)</SelectItem>
                          <SelectItem value="USD">USD (美元)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>结算币种</Label>
                      <Select
                        value={newStore.settlementCurrency}
                        onValueChange={(v) => setNewStore({ ...newStore, settlementCurrency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择币种" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IDR">IDR</SelectItem>
                          <SelectItem value="VND">VND</SelectItem>
                          <SelectItem value="MYR">MYR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Checkbox id="goAuth" />
                  <Label htmlFor="goAuth" className="text-sm text-blue-700">
                    保存后进入授权连接
                  </Label>
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setShowCreateDrawer(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateStore}>创建店铺</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </main>
      </div>
    </div>
  )
}
