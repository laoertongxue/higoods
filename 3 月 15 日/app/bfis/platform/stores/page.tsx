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
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  History,
  Globe,
  DollarSign,
  User,
  Clock,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
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
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// SS1｜店铺与收单主体列表页
// SS2｜店铺详情页（Sheet Tabs）
// SS3｜新建/编辑店铺抽屉
// SS6｜店铺提现绑定历史弹窗

const mockStores = [
  {
    store_id: "st_001",
    platform: "TIKTOK",
    store_name: "HiGood TK ID",
    store_code: "TK-ID-001",
    country_code: "ID",
    settlement_currency: "IDR",
    status: "ACTIVE",
    auth_status: "CONNECTED",
    current_payout_account: "JKT-对公主账户 ****1234",
    acquiring_subject_type: "LEGAL",
    acquiring_subject_name: "PT HIGOOD LIVE JAKARTA",
    effective_from: "2025-01-01",
    updated_at: "2026-01-20",
  },
  {
    store_id: "st_002",
    platform: "SHOPEE",
    store_name: "HiGood SP ID",
    store_code: "SP-ID-001",
    country_code: "ID",
    settlement_currency: "IDR",
    status: "ACTIVE",
    auth_status: "CONNECTED",
    current_payout_account: "JKT-对公主账户 ****1234",
    acquiring_subject_type: "LEGAL",
    acquiring_subject_name: "PT HIGOOD LIVE JAKARTA",
    effective_from: "2025-01-01",
    updated_at: "2026-01-18",
  },
  {
    store_id: "st_003",
    platform: "TIKTOK",
    store_name: "张三个人店",
    store_code: "TK-ID-P01",
    country_code: "ID",
    settlement_currency: "IDR",
    status: "ACTIVE",
    auth_status: "CONNECTED",
    current_payout_account: "张三-个人卡 ****5678",
    acquiring_subject_type: "PERSONAL",
    acquiring_subject_name: "张三",
    effective_from: "2025-06-01",
    updated_at: "2026-01-15",
  },
  {
    store_id: "st_004",
    platform: "TIKTOK",
    store_name: "HiGood TK CN",
    store_code: "TK-CN-001",
    country_code: "CN",
    settlement_currency: "CNY",
    status: "ACTIVE",
    auth_status: "ERROR",
    current_payout_account: "SZ-对公账户 ****9012",
    acquiring_subject_type: "LEGAL",
    acquiring_subject_name: "深圳嗨好科技有限公司",
    effective_from: "2025-03-01",
    updated_at: "2026-01-10",
  },
  {
    store_id: "st_005",
    platform: "SHOPEE",
    store_name: "Test Store (No Binding)",
    store_code: "SP-ID-TEST",
    country_code: "ID",
    settlement_currency: "IDR",
    status: "INACTIVE",
    auth_status: "EXPIRED",
    current_payout_account: null,
    acquiring_subject_type: null,
    acquiring_subject_name: null,
    effective_from: null,
    updated_at: "2025-12-20",
  },
]

const mockBindingHistory = [
  {
    binding_id: "spb_001",
    payout_account_name: "JKT-对公主账户 ****1234",
    acquiring_subject_name: "PT HIGOOD LIVE JAKARTA",
    effective_from: "2025-01-01 00:00",
    effective_to: null,
    change_reason: "初始绑定",
    changed_by: "admin",
    changed_at: "2025-01-01 10:00",
  },
]

const platformConfig = {
  TIKTOK: { label: "TikTok", color: "bg-black text-white", icon: "🎵" },
  SHOPEE: { label: "Shopee", color: "bg-orange-500 text-white", icon: "🛍️" },
}

const statusConfig = {
  ACTIVE: { label: "启用", color: "bg-green-100 text-green-700", icon: CheckCircle },
  INACTIVE: { label: "停用", color: "bg-gray-100 text-gray-700", icon: XCircle },
}

const authStatusConfig = {
  CONNECTED: { label: "已连接", color: "bg-green-100 text-green-700", icon: CheckCircle },
  EXPIRED: { label: "已过期", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  ERROR: { label: "错误", color: "bg-red-100 text-red-700", icon: XCircle },
}

const subjectTypeConfig = {
  LEGAL: { label: "法人", color: "bg-blue-100 text-blue-700", icon: Building2 },
  PERSONAL: { label: "个人", color: "bg-purple-100 text-purple-700", icon: User },
}

function StoresPageContent() {
  const searchParams = useSearchParams()
  const [filterPlatform, setFilterPlatform] = useState("all")
  const [filterCountry, setFilterCountry] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterAuthStatus, setFilterAuthStatus] = useState("all")
  const [filterSubjectType, setFilterSubjectType] = useState("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [selectedStore, setSelectedStore] = useState<any>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isBindingHistoryOpen, setIsBindingHistoryOpen] = useState(false)
  const [isChangePayoutOpen, setIsChangePayoutOpen] = useState(false)

  const openDetail = (store: any) => {
    setSelectedStore(store)
    setIsDetailOpen(true)
  }

  const openEdit = (store?: any) => {
    setSelectedStore(store || null)
    setIsEditOpen(true)
  }

  const openBindingHistory = () => {
    setIsBindingHistoryOpen(true)
  }

  const openChangePayout = () => {
    setIsChangePayoutOpen(true)
  }

  const filteredStores = mockStores.filter((store) => {
    if (filterPlatform !== "all" && store.platform !== filterPlatform) return false
    if (filterCountry !== "all" && store.country_code !== filterCountry) return false
    if (filterStatus !== "all" && store.status !== filterStatus) return false
    if (filterAuthStatus !== "all" && store.auth_status !== filterAuthStatus) return false
    if (filterSubjectType !== "all" && store.acquiring_subject_type !== filterSubjectType) return false
    if (searchKeyword && !store.store_name.toLowerCase().includes(searchKeyword.toLowerCase()) && !store.store_code.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const statsCards = [
    { label: "店铺总数", value: mockStores.length, color: "text-blue-600" },
    { label: "TikTok店铺", value: mockStores.filter((s) => s.platform === "TIKTOK").length, color: "text-black" },
    { label: "Shopee店铺", value: mockStores.filter((s) => s.platform === "SHOPEE").length, color: "text-orange-600" },
    { label: "缺失绑定", value: mockStores.filter((s) => !s.current_payout_account).length, color: "text-red-600" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">店铺与收单主体</h1>
          <p className="text-muted-foreground">
            统一管理平台店铺与提现银行账号绑定，确保收入归属主体口径一致
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/bfis/platform/stores/accounts">
            <Button variant="outline" size="sm">
              <Building2 className="h-4 w-4 mr-2" />
              提现银行账号
            </Button>
          </Link>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => openEdit()}>
            <Plus className="h-4 w-4 mr-2" />
            新增店铺
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
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="平台" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部平台</SelectItem>
                <SelectItem value="TIKTOK">TikTok</SelectItem>
                <SelectItem value="SHOPEE">Shopee</SelectItem>
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="ACTIVE">启用</SelectItem>
                <SelectItem value="INACTIVE">停用</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAuthStatus} onValueChange={setFilterAuthStatus}>
              <SelectTrigger>
                <SelectValue placeholder="授权状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="CONNECTED">已连接</SelectItem>
                <SelectItem value="EXPIRED">已过期</SelectItem>
                <SelectItem value="ERROR">错误</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSubjectType} onValueChange={setFilterSubjectType}>
              <SelectTrigger>
                <SelectValue placeholder="收单主体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="LEGAL">法人</SelectItem>
                <SelectItem value="PERSONAL">个人</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索店铺名称/编码..."
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
                <TableHead>平台</TableHead>
                <TableHead>店铺名称</TableHead>
                <TableHead>国家/币种</TableHead>
                <TableHead>授权状态</TableHead>
                <TableHead>当前提现银行账号</TableHead>
                <TableHead>收单主体</TableHead>
                <TableHead>生效时间</TableHead>
                <TableHead>最近更新</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStores.map((store) => {
                const hasBinding = !!store.current_payout_account
                const platformInfo = platformConfig[store.platform as keyof typeof platformConfig]
                const authInfo = authStatusConfig[store.auth_status as keyof typeof authStatusConfig]
                const AuthIcon = authInfo.icon

                return (
                  <TableRow
                    key={store.store_id}
                    className={!hasBinding ? "bg-red-50" : ""}
                  >
                    <TableCell>
                      <Badge className={platformInfo.color}>
                        {platformInfo.icon} {platformInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{store.store_name}</div>
                      <div className="text-sm text-muted-foreground">{store.store_code}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span>{store.country_code}</span>
                        <span className="text-muted-foreground">/</span>
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span>{store.settlement_currency}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={authInfo.color}>
                        <AuthIcon className="h-3 w-3 mr-1" />
                        {authInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {hasBinding ? (
                        <div className="font-mono text-sm">{store.current_payout_account}</div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">未绑定提现账号</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {store.acquiring_subject_type ? (
                        <div>
                          <Badge className={subjectTypeConfig[store.acquiring_subject_type as keyof typeof subjectTypeConfig].color}>
                            {subjectTypeConfig[store.acquiring_subject_type as keyof typeof subjectTypeConfig].label}
                          </Badge>
                          <div className="text-sm mt-1">{store.acquiring_subject_name}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {store.effective_from || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {store.updated_at}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(store)}>
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

      {/* SS2 店铺详情 Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedStore && (
                <>
                  <Badge className={platformConfig[selectedStore.platform as keyof typeof platformConfig].color}>
                    {platformConfig[selectedStore.platform as keyof typeof platformConfig].label}
                  </Badge>
                  {selectedStore.store_name}
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              店铺详情与收单主体管理
            </SheetDescription>
          </SheetHeader>

          {selectedStore && (
            <div className="mt-6">
              <Tabs defaultValue="basic">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">基本信息</TabsTrigger>
                  <TabsTrigger value="subject">收单主体</TabsTrigger>
                  <TabsTrigger value="auth">授权与连接</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">店铺名称</div>
                          <div className="font-medium mt-1">{selectedStore.store_name}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">内部编码</div>
                          <div className="font-medium mt-1">{selectedStore.store_code}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">平台</div>
                          <div className="mt-1">
                            <Badge className={platformConfig[selectedStore.platform as keyof typeof platformConfig].color}>
                              {platformConfig[selectedStore.platform as keyof typeof platformConfig].label}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">状态</div>
                          <div className="mt-1">
                            <Badge className={statusConfig[selectedStore.status as keyof typeof statusConfig].color}>
                              {statusConfig[selectedStore.status as keyof typeof statusConfig].label}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">国家站点</div>
                          <div className="font-medium mt-1">{selectedStore.country_code}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">结算币种</div>
                          <div className="font-medium mt-1">{selectedStore.settlement_currency}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(selectedStore)}>
                      <Edit className="h-4 w-4 mr-2" />
                      编辑店铺
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="subject" className="space-y-4">
                  {selectedStore.current_payout_account ? (
                    <>
                      <Card className="border-primary/20">
                        <CardContent className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">账号名称</div>
                              <div className="font-medium mt-1">{selectedStore.current_payout_account}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">归属类型</div>
                              <div className="mt-1">
                                <Badge className={subjectTypeConfig[selectedStore.acquiring_subject_type as keyof typeof subjectTypeConfig].color}>
                                  {subjectTypeConfig[selectedStore.acquiring_subject_type as keyof typeof subjectTypeConfig].label}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">收单主体</div>
                              <div className="font-medium mt-1">{selectedStore.acquiring_subject_name}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">生效时间</div>
                              <div className="font-medium mt-1">{selectedStore.effective_from}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={openChangePayout}>
                          <Edit className="h-4 w-4 mr-2" />
                          变更提现账号
                        </Button>
                        <Button variant="outline" size="sm" onClick={openBindingHistory}>
                          <History className="h-4 w-4 mr-2" />
                          查看绑定历史
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="p-6 text-center">
                        <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-3" />
                        <div className="font-medium text-red-900 mb-2">店铺未绑定提现账号</div>
                        <div className="text-sm text-red-700 mb-4">
                          平台应收与回款预测将受影响，请尽快绑定
                        </div>
                        <Button size="sm" onClick={openChangePayout}>
                          立即绑定
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="auth" className="space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">当前状态</span>
                        <Badge className={authStatusConfig[selectedStore.auth_status as keyof typeof authStatusConfig].color}>
                          {authStatusConfig[selectedStore.auth_status as keyof typeof authStatusConfig].label}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="text-sm text-muted-foreground">
                        授权管理功能预留，后续集成平台OAuth授权流程
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* SS3 新建/编辑店铺抽屉 */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedStore ? "编辑店铺" : "新增店铺"}</SheetTitle>
            <SheetDescription>
              填写店铺基础信息
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>平台 *</Label>
              <Select defaultValue={selectedStore?.platform || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="选择平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TIKTOK">TikTok</SelectItem>
                  <SelectItem value="SHOPEE">Shopee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>店铺名称 *</Label>
              <Input defaultValue={selectedStore?.store_name} placeholder="输入店铺名称" />
            </div>

            <div className="space-y-2">
              <Label>内部编码 *</Label>
              <Input defaultValue={selectedStore?.store_code} placeholder="TK-ID-001" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>国家站点 *</Label>
                <Select defaultValue={selectedStore?.country_code || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择国家" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ID">印尼</SelectItem>
                    <SelectItem value="CN">中国</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>结算币种 *</Label>
                <Select defaultValue={selectedStore?.settlement_currency || ""}>
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
              <Label>状态</Label>
              <Select defaultValue={selectedStore?.status || "ACTIVE"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">启用</SelectItem>
                  <SelectItem value="INACTIVE">停用</SelectItem>
                </SelectContent>
              </Select>
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

      {/* SS6 店铺提现绑定历史弹窗 */}
      <Dialog open={isBindingHistoryOpen} onOpenChange={setIsBindingHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>提现账号绑定历史</DialogTitle>
            <DialogDescription>
              店铺：{selectedStore?.store_name}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>生效开始</TableHead>
                  <TableHead>生效结束</TableHead>
                  <TableHead>提现账号</TableHead>
                  <TableHead>归属主体</TableHead>
                  <TableHead>变更原因</TableHead>
                  <TableHead>操作人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockBindingHistory.map((binding) => (
                  <TableRow key={binding.binding_id}>
                    <TableCell className="text-sm">{binding.effective_from}</TableCell>
                    <TableCell className="text-sm">
                      {binding.effective_to || <Badge className="bg-green-100 text-green-700">当前生效</Badge>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{binding.payout_account_name}</TableCell>
                    <TableCell>{binding.acquiring_subject_name}</TableCell>
                    <TableCell className="text-sm">{binding.change_reason}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{binding.changed_by}</div>
                      <div>{binding.changed_at}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 变更提现账号弹窗 */}
      <Dialog open={isChangePayoutOpen} onOpenChange={setIsChangePayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>变更提现账号</DialogTitle>
            <DialogDescription>
              更改店铺绑定的提现银行账号，历史绑定将被关闭
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>新提现账号 *</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择提现账号" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pa_001">JKT-对公主账户 ****1234</SelectItem>
                  <SelectItem value="pa_002">SZ-对公账户 ****9012</SelectItem>
                  <SelectItem value="pa_003">张三-个人卡 ****5678</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">
                或 <Link href="/bfis/platform/stores/accounts" className="text-primary underline">新建提现账号</Link>
              </div>
            </div>

            <div className="space-y-2">
              <Label>生效开始时间 *</Label>
              <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} />
            </div>

            <div className="space-y-2">
              <Label>变更原因 *</Label>
              <Textarea placeholder="请填写变更原因（必填）" rows={3} />
            </div>

            <div className="space-y-2">
              <Label>附件（可选）</Label>
              <Input type="file" />
              <div className="text-sm text-muted-foreground">
                支持上传平台截图、通知邮件等证明文件
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="flex-1">确认变更</Button>
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setIsChangePayoutOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function StoresPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StoresPageContent />
    </Suspense>
  )
}
