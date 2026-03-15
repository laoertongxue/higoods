"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { toast } from "sonner"
import {
  ArrowLeft,
  Edit,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Database,
  Building2,
  User,
  Wallet,
  History,
  Plus,
} from "lucide-react"

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
  PERSONAL: { label: "个人", color: "bg-blue-100 text-blue-700" },
  LEGAL: { label: "法人", color: "bg-purple-100 text-purple-700" },
}

// Mock提现账号列表
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
const mockStore = {
  id: "ST-001",
  channel: "TikTok",
  storeName: "IDN-Store-A",
  storeCode: "TT_IDN_A",
  platformStoreId: "7239012",
  country: "印尼",
  region: "ID",
  pricingCurrency: "IDR",
  settlementCurrency: "IDR",
  timezone: "Asia/Jakarta",
  status: "ACTIVE",
  authStatus: "CONNECTED",
  tokenExpireAt: "2026-02-15",
  lastRefreshAt: "2026-01-10 14:30",
  storeOwner: "李运营",
  team: "东南亚运营组",
  reviewer: "陈主管",
  // 当前提现账号绑定
  currentPayoutBinding: {
    payoutAccountId: "PA-002",
    payoutAccountName: "PT HIGOOD LIVE - IDN Payout",
    payoutIdentifier: "****1234",
    ownerType: "LEGAL",
    ownerName: "PT HIGOOD LIVE JAKARTA",
    effectiveFrom: "2025-10-01",
    effectiveTo: null,
  },
  // 策略配置
  policies: {
    allowListing: true,
    inventorySyncMode: "AVAILABLE_TO_SELL",
    safetyStock: 10,
    handlingTime: 3,
    defaultCategoryId: "Women>Dresses",
  },
  createdAt: "2025-10-15 09:00",
  createdBy: "系统管理员",
  updatedAt: "2026-01-10 14:30",
  updatedBy: "李运营",
}

// Mock绑定历史
const mockBindingHistory = [
  {
    id: "BND-002",
    payoutAccountId: "PA-002",
    payoutAccountName: "PT HIGOOD LIVE - IDN Payout",
    ownerType: "LEGAL",
    ownerName: "PT HIGOOD LIVE JAKARTA",
    effectiveFrom: "2025-10-01",
    effectiveTo: null,
    changeReason: "店铺正式上线，绑定公司提现账号",
    changedBy: "李运营",
    changedAt: "2025-10-01 09:00",
  },
  {
    id: "BND-001",
    payoutAccountId: "PA-003",
    payoutAccountName: "张三-个人卡",
    ownerType: "PERSONAL",
    ownerName: "张三",
    effectiveFrom: "2025-08-15",
    effectiveTo: "2025-09-30",
    changeReason: "测试阶段临时绑定个人账号",
    changedBy: "系统管理员",
    changedAt: "2025-08-15 10:00",
  },
]

// Mock日志
const mockLogs = [
  { time: "2026-01-10 14:30", action: "刷新授权", operator: "李运营", detail: "授权token刷新成功，有效期至2026-02-15" },
  { time: "2026-01-05 11:00", action: "修改策略", operator: "李运营", detail: "修改安全库存从5改为10" },
  {
    time: "2025-10-01 09:00",
    action: "变更提现账号",
    operator: "李运营",
    detail: "从张三-个人卡变更为PT HIGOOD LIVE - IDN Payout",
  },
  { time: "2025-10-15 09:00", action: "创建店铺", operator: "系统管理员", detail: "新建店铺IDN-Store-A" },
]

export default function ChannelStoreDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [activeTab, setActiveTab] = useState("overview")
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [showChangePayoutDialog, setShowChangePayoutDialog] = useState(false)
  const [showBindingHistoryDialog, setShowBindingHistoryDialog] = useState(false)
  const [authStep, setAuthStep] = useState(1)
  const [authMethod, setAuthMethod] = useState<"oauth" | "token">("oauth")
  const [tokenInput, setTokenInput] = useState("")
  const [tokenExpireAt, setTokenExpireAt] = useState("")
  const [newPayoutAccountId, setNewPayoutAccountId] = useState("")
  const [newEffectiveFrom, setNewEffectiveFrom] = useState(new Date().toISOString().split("T")[0])
  const [changeReason, setChangeReason] = useState("")

  const handleRefreshAuth = () => {
    toast.success("授权刷新成功")
  }

  const handleCompleteAuth = () => {
    toast.success("授权连接成功")
    setShowAuthDialog(false)
    setAuthStep(1)
  }

  const handleChangePayoutAccount = () => {
    if (!newPayoutAccountId || !changeReason) {
      toast.error("请填写必填项")
      return
    }
    toast.success("提现账号变更成功")
    setShowChangePayoutDialog(false)
    setNewPayoutAccountId("")
    setChangeReason("")
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
                返回列表
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{mockStore.storeName}</h1>
                  <Badge variant="outline">{mockStore.channel}</Badge>
                  <Badge className={STORE_STATUS[mockStore.status as keyof typeof STORE_STATUS]?.color}>
                    {STORE_STATUS[mockStore.status as keyof typeof STORE_STATUS]?.label}
                  </Badge>
                  <Badge className={AUTH_STATUS[mockStore.authStatus as keyof typeof AUTH_STATUS]?.color}>
                    {AUTH_STATUS[mockStore.authStatus as keyof typeof AUTH_STATUS]?.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {mockStore.storeCode} | {mockStore.country} | {mockStore.pricingCurrency}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowEditDrawer(true)}>
                <Edit className="h-4 w-4 mr-2" />
                编辑店铺
              </Button>
              <Button variant="outline" onClick={() => setShowAuthDialog(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                重新授权
              </Button>
              <Button onClick={() => setShowChangePayoutDialog(true)}>
                <Wallet className="h-4 w-4 mr-2" />
                变更提现账号
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">基本信息</TabsTrigger>
              <TabsTrigger value="auth">授权与连接</TabsTrigger>
              <TabsTrigger value="policies">上架策略</TabsTrigger>
              <TabsTrigger value="payout">提现账号绑定</TabsTrigger>
              <TabsTrigger value="sync">同步与数据</TabsTrigger>
              <TabsTrigger value="logs">日志与附件</TabsTrigger>
            </TabsList>

            {/* Tab1: Overview */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">店铺基础信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">渠道</div>
                        <div className="font-medium">{mockStore.channel}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">店铺名称</div>
                        <div className="font-medium">{mockStore.storeName}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">内部编码</div>
                        <div className="font-medium">{mockStore.storeCode}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">平台店铺ID</div>
                        <div className="font-medium">{mockStore.platformStoreId}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">国家/区域</div>
                        <div className="font-medium">{mockStore.country}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">时区</div>
                        <div className="font-medium">{mockStore.timezone}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">报价币种</div>
                        <div className="font-medium">{mockStore.pricingCurrency}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">结算币种</div>
                        <div className="font-medium">{mockStore.settlementCurrency}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">组织与责任</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">店铺负责人</div>
                        <div className="font-medium">{mockStore.storeOwner}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">所属团队</div>
                        <div className="font-medium">{mockStore.team}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">审核人</div>
                        <div className="font-medium">{mockStore.reviewer}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">创建时间</div>
                        <div className="font-medium">{mockStore.createdAt}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 当前提现账号绑定摘要 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    当前提现账号绑定
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setShowBindingHistoryDialog(true)}>
                    <History className="h-4 w-4 mr-1" />
                    查看绑定历史
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-8 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">提现账号</div>
                      <div className="font-medium">{mockStore.currentPayoutBinding.payoutAccountName}</div>
                      <div className="text-xs text-muted-foreground">
                        {mockStore.currentPayoutBinding.payoutIdentifier}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">归属类型</div>
                      <Badge
                        className={
                          OWNER_TYPE[mockStore.currentPayoutBinding.ownerType as keyof typeof OWNER_TYPE]?.color
                        }
                      >
                        {mockStore.currentPayoutBinding.ownerType === "LEGAL" ? (
                          <Building2 className="h-3 w-3 mr-1" />
                        ) : (
                          <User className="h-3 w-3 mr-1" />
                        )}
                        {OWNER_TYPE[mockStore.currentPayoutBinding.ownerType as keyof typeof OWNER_TYPE]?.label}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">归属主体</div>
                      <div className="font-medium">{mockStore.currentPayoutBinding.ownerName}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">生效起始</div>
                      <div className="font-medium">{mockStore.currentPayoutBinding.effectiveFrom}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab2: Auth */}
            <TabsContent value="auth" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">授权状态</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="font-medium text-green-700">已连接</div>
                      <div className="text-sm text-green-600">授权有效期至 {mockStore.tokenExpireAt}</div>
                    </div>
                    <div className="ml-auto">
                      <Button variant="outline" size="sm" onClick={handleRefreshAuth}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        刷新授权
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">最近刷新时间</div>
                      <div className="font-medium">{mockStore.lastRefreshAt}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">平台店铺ID</div>
                      <div className="font-medium flex items-center gap-2">
                        {mockStore.platformStoreId}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            navigator.clipboard.writeText(mockStore.platformStoreId)
                            toast.success("已复制")
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab3: Policies */}
            <TabsContent value="policies" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">上架策略配置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium">允许上架</div>
                      <div className="text-sm text-muted-foreground">控制该店铺是否可以发起商品上架</div>
                    </div>
                    <Switch checked={mockStore.policies.allowListing} />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>库存同步模式</Label>
                      <Select defaultValue={mockStore.policies.inventorySyncMode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AVAILABLE_TO_SELL">可售库存 (ATS)</SelectItem>
                          <SelectItem value="ON_HAND">在库库存</SelectItem>
                          <SelectItem value="MANUAL">手动管理</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>安全库存</Label>
                      <Input type="number" defaultValue={mockStore.policies.safetyStock} />
                    </div>
                    <div className="space-y-2">
                      <Label>默认类目</Label>
                      <Input defaultValue={mockStore.policies.defaultCategoryId} />
                    </div>
                    <div className="space-y-2">
                      <Label>处理时效（天）</Label>
                      <Input type="number" defaultValue={mockStore.policies.handlingTime} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab4: Payout Binding (核心) */}
            <TabsContent value="payout" className="space-y-6 mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">当前有效提现账号</CardTitle>
                  <Button onClick={() => setShowChangePayoutDialog(true)}>
                    <Wallet className="h-4 w-4 mr-2" />
                    变更提现账号
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="p-6 bg-muted/30 rounded-lg space-y-4">
                    <div className="grid grid-cols-4 gap-6">
                      <div>
                        <div className="text-sm text-muted-foreground">提现账号名称</div>
                        <div className="font-medium text-lg">{mockStore.currentPayoutBinding.payoutAccountName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">账号标识（脱敏）</div>
                        <div className="font-medium">{mockStore.currentPayoutBinding.payoutIdentifier}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">归属类型</div>
                        <Badge
                          className={
                            OWNER_TYPE[mockStore.currentPayoutBinding.ownerType as keyof typeof OWNER_TYPE]?.color
                          }
                        >
                          {mockStore.currentPayoutBinding.ownerType === "LEGAL" ? (
                            <Building2 className="h-3 w-3 mr-1" />
                          ) : (
                            <User className="h-3 w-3 mr-1" />
                          )}
                          {OWNER_TYPE[mockStore.currentPayoutBinding.ownerType as keyof typeof OWNER_TYPE]?.label}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">归属主体</div>
                        <div className="font-medium">{mockStore.currentPayoutBinding.ownerName}</div>
                      </div>
                    </div>
                    <div className="pt-4 border-t flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">生效起始：</span>
                        <span className="font-medium">{mockStore.currentPayoutBinding.effectiveFrom}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">生效结束：</span>
                        <span className="font-medium">{mockStore.currentPayoutBinding.effectiveTo || "当前生效"}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">绑定历史</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setShowBindingHistoryDialog(true)}>
                    查看完整历史
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>提现账号</TableHead>
                        <TableHead>归属类型</TableHead>
                        <TableHead>归属主体</TableHead>
                        <TableHead>生效区间</TableHead>
                        <TableHead>变更原因</TableHead>
                        <TableHead>操作人/时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockBindingHistory.map((binding) => (
                        <TableRow key={binding.id}>
                          <TableCell>
                            <div className="font-medium">{binding.payoutAccountName}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={OWNER_TYPE[binding.ownerType as keyof typeof OWNER_TYPE]?.color}>
                              {OWNER_TYPE[binding.ownerType as keyof typeof OWNER_TYPE]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{binding.ownerName}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {binding.effectiveFrom} ~ {binding.effectiveTo || "当前"}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{binding.changeReason}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <div>{binding.changedBy}</div>
                            <div>{binding.changedAt}</div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab5: Sync */}
            <TabsContent value="sync" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">数据同步状态</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>同步监控功能开发中</p>
                    <Button variant="link" onClick={() => router.push("/channels/stores/sync")}>
                      前往同步状态页 →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab6: Logs */}
            <TabsContent value="logs" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">操作日志</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>时间</TableHead>
                        <TableHead>操作</TableHead>
                        <TableHead>操作人</TableHead>
                        <TableHead>详情</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockLogs.map((log, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm text-muted-foreground">{log.time}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action}</Badge>
                          </TableCell>
                          <TableCell>{log.operator}</TableCell>
                          <TableCell className="text-sm">{log.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* CS3: Edit Store Drawer */}
          <Sheet open={showEditDrawer} onOpenChange={setShowEditDrawer}>
            <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>编辑店铺信息</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>店铺名称</Label>
                    <Input defaultValue={mockStore.storeName} />
                  </div>
                  <div className="space-y-2">
                    <Label>负责人</Label>
                    <Input defaultValue={mockStore.storeOwner} />
                  </div>
                  <div className="space-y-2">
                    <Label>所属团队</Label>
                    <Input defaultValue={mockStore.team} />
                  </div>
                  <div className="space-y-2">
                    <Label>审核人</Label>
                    <Input defaultValue={mockStore.reviewer} />
                  </div>
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setShowEditDrawer(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => {
                    toast.success("保存成功")
                    setShowEditDrawer(false)
                  }}
                >
                  保存
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* Auth Dialog (3-step wizard) */}
          <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>店铺授权连接</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${authStep >= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {step}
                      </div>
                      {step < 3 && <div className={`w-12 h-0.5 ${authStep > step ? "bg-primary" : "bg-muted"}`} />}
                    </div>
                  ))}
                </div>

                {authStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-medium">选择授权方式</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        className={`p-4 border rounded-lg cursor-pointer ${authMethod === "oauth" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setAuthMethod("oauth")}
                      >
                        <div className="font-medium">OAuth 授权</div>
                        <div className="text-sm text-muted-foreground">跳转平台登录授权</div>
                      </div>
                      <div
                        className={`p-4 border rounded-lg cursor-pointer ${authMethod === "token" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setAuthMethod("token")}
                      >
                        <div className="font-medium">手动填写 Token</div>
                        <div className="text-sm text-muted-foreground">手动输入授权凭证</div>
                      </div>
                    </div>
                  </div>
                )}

                {authStep === 2 && (
                  <div className="space-y-4">
                    {authMethod === "oauth" ? (
                      <div className="text-center py-8">
                        <ExternalLink className="h-12 w-12 mx-auto mb-4 text-primary" />
                        <p className="font-medium">点击下方按钮跳转至平台授权</p>
                        <p className="text-sm text-muted-foreground mt-2">授权完成后将自动返回</p>
                        <Button className="mt-4" onClick={() => setAuthStep(3)}>
                          前往 {mockStore.channel} 授权
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Access Token *</Label>
                          <Textarea
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            placeholder="粘贴授权Token"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Token有效期 *</Label>
                          <Input type="date" value={tokenExpireAt} onChange={(e) => setTokenExpireAt(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {authStep === 3 && (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                    <p className="font-medium text-green-700">连接测试成功</p>
                    <p className="text-sm text-muted-foreground mt-2">授权凭证有效，可以保存生效</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                {authStep > 1 && (
                  <Button variant="outline" onClick={() => setAuthStep(authStep - 1)}>
                    上一步
                  </Button>
                )}
                {authStep < 3 && authMethod === "token" && authStep === 2 && (
                  <Button onClick={() => setAuthStep(3)}>测试连接</Button>
                )}
                {authStep === 3 && <Button onClick={handleCompleteAuth}>保存生效</Button>}
                {authStep === 1 && <Button onClick={() => setAuthStep(2)}>下一步</Button>}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* CS6: Change Payout Account Dialog */}
          <Dialog open={showChangePayoutDialog} onOpenChange={setShowChangePayoutDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>变更提现账号</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-700">
                      <p className="font-medium">重要提示</p>
                      <p>
                        变更提现账号将影响该店铺的收入归属主体。历史订单/结算仍按原绑定账号归属，新绑定仅对生效日期后的订单生效。
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>选择新提现账号 *</Label>
                    <Select value={newPayoutAccountId} onValueChange={setNewPayoutAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择提现账号" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockPayoutAccounts.map((pa) => (
                          <SelectItem key={pa.id} value={pa.id}>
                            <div className="flex items-center gap-2">
                              <span>{pa.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {pa.ownerType === "LEGAL" ? "法人" : "个人"}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto"
                      onClick={() => router.push("/channels/stores/payout-accounts")}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      新建提现账号
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>生效开始时间 *</Label>
                    <Input type="date" value={newEffectiveFrom} onChange={(e) => setNewEffectiveFrom(e.target.value)} />
                    <p className="text-xs text-muted-foreground">旧绑定将在此日期前一天自动结束</p>
                  </div>

                  <div className="space-y-2">
                    <Label>变更原因 *</Label>
                    <Textarea
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      placeholder="请填写变更原因，如：店铺转让/公司主体变更/账号更换等"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowChangePayoutDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleChangePayoutAccount}>确认变更</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Binding History Dialog */}
          <Dialog open={showBindingHistoryDialog} onOpenChange={setShowBindingHistoryDialog}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>提现账号绑定历史</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>提现账号</TableHead>
                      <TableHead>归属类型</TableHead>
                      <TableHead>归属主体</TableHead>
                      <TableHead>生效区间</TableHead>
                      <TableHead>变更原因</TableHead>
                      <TableHead>操作人/时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockBindingHistory.map((binding) => (
                      <TableRow key={binding.id}>
                        <TableCell>
                          <div className="font-medium">{binding.payoutAccountName}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={OWNER_TYPE[binding.ownerType as keyof typeof OWNER_TYPE]?.color}>
                            {OWNER_TYPE[binding.ownerType as keyof typeof OWNER_TYPE]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{binding.ownerName}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {binding.effectiveFrom} ~ {binding.effectiveTo || "当前"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{binding.changeReason}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div>{binding.changedBy}</div>
                          <div>{binding.changedAt}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
