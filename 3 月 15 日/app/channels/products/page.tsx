"use client"

import { useState } from "react"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Map,
  Store,
  FileText,
  ArrowRightLeft,
  Check,
} from "lucide-react"

// 渠道商品组状态（跨店铺）
const GROUP_STATUS = {
  ACTIVE: { label: "活跃", color: "bg-green-100 text-green-700" },
  PARTIAL_ONLINE: { label: "部分在售", color: "bg-blue-100 text-blue-700" },
  ALL_OFFLINE: { label: "全部下架", color: "bg-orange-100 text-orange-700" },
  HAS_BLOCKED: { label: "有受限", color: "bg-red-100 text-red-700" },
  PENDING_MIGRATION: { label: "待迁移", color: "bg-purple-100 text-purple-700" },
}

// 内部绑定类型
const INTERNAL_REF_TYPE = {
  CANDIDATE: { label: "候选商品", color: "bg-purple-100 text-purple-700" },
  SPU: { label: "SPU", color: "bg-blue-100 text-blue-700" },
}

// 价格策略
const PRICING_MODE = {
  UNIFIED: { label: "渠道统一价", color: "bg-green-100 text-green-700" },
  STORE_OVERRIDE: { label: "店铺差异价", color: "bg-orange-100 text-orange-700" },
}

// 映射健康
const MAPPING_HEALTH = {
  OK: { label: "正常", color: "bg-green-100 text-green-700" },
  MISSING: { label: "缺映射", color: "bg-yellow-100 text-yellow-700" },
  CONFLICT: { label: "冲突", color: "bg-red-100 text-red-700" },
}

// 内容版本状态
const CONTENT_STATUS = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  PUBLISHED: { label: "已发布", color: "bg-green-100 text-green-700" },
  ARCHIVED: { label: "已归档", color: "bg-gray-200 text-gray-600" },
}

// 渠道
const CHANNELS = [
  { id: "tiktok", name: "TikTok Shop" },
  { id: "shopee", name: "Shopee" },
  { id: "lazada", name: "Lazada" },
  { id: "standalone", name: "独立站" },
]

// 店铺
const STORES = [
  { id: "store-1", name: "HiGood官方旗舰店", channel: "tiktok", country: "ID" },
  { id: "store-2", name: "HiGood印尼店", channel: "tiktok", country: "ID" },
  { id: "store-3", name: "HiGood马来店", channel: "shopee", country: "MY" },
  { id: "store-4", name: "HiGood菲律宾店", channel: "lazada", country: "PH" },
  { id: "store-5", name: "HiGood越南店", channel: "shopee", country: "VN" },
]

// Mock数据 - 渠道商品组（CPG1）
const mockChannelProductGroups = [
  {
    id: "CPG-001",
    channel: "tiktok",
    internalRefType: "SPU",
    internalRefId: "SPU-20260110-001",
    internalRefCode: "SPU-20260110-001",
    internalRefName: "印尼风格碎花连衣裙",
    originProjectId: "PRJ-20251216-001",
    originProjectName: "印尼风格碎花连衣裙",
    pricingMode: "UNIFIED",
    channelDefaultPrice: 199000,
    currency: "IDR",
    coverStoreCount: 2,
    onlineStoreCount: 2,
    contentStatus: "PUBLISHED",
    contentVersionId: "CV-001",
    mappingHealth: "OK",
    groupStatus: "ACTIVE",
    createdAt: "2026-01-05 10:00",
    updatedAt: "2026-01-12 14:30",
  },
  {
    id: "CPG-002",
    channel: "tiktok",
    internalRefType: "CANDIDATE",
    internalRefId: "CAND-20260108-001",
    internalRefCode: "CAND-测款001",
    internalRefName: "波西米亚风印花半身裙",
    originProjectId: "PRJ-20251220-002",
    originProjectName: "波西米亚风印花半身裙",
    pricingMode: "UNIFIED",
    channelDefaultPrice: 159000,
    currency: "IDR",
    coverStoreCount: 1,
    onlineStoreCount: 1,
    contentStatus: "PUBLISHED",
    contentVersionId: "CV-002",
    mappingHealth: "OK",
    groupStatus: "PENDING_MIGRATION",
    hasCandidateToSpuMapping: true,
    targetSpuId: "SPU-20260115-001",
    createdAt: "2026-01-08 09:00",
    updatedAt: "2026-01-13 11:00",
  },
  {
    id: "CPG-003",
    channel: "shopee",
    internalRefType: "SPU",
    internalRefId: "SPU-20260112-002",
    internalRefCode: "SPU-20260112-002",
    internalRefName: "清新格纹休闲衬衫",
    originProjectId: "PRJ-20251218-003",
    originProjectName: "清新格纹休闲衬衫",
    pricingMode: "STORE_OVERRIDE",
    channelDefaultPrice: 89000,
    currency: "IDR",
    coverStoreCount: 2,
    onlineStoreCount: 1,
    contentStatus: "DRAFT",
    contentVersionId: "CV-003",
    mappingHealth: "MISSING",
    groupStatus: "PARTIAL_ONLINE",
    createdAt: "2026-01-10 14:00",
    updatedAt: "2026-01-14 09:30",
  },
  {
    id: "CPG-004",
    channel: "tiktok",
    internalRefType: "SPU",
    internalRefId: "SPU-20260108-003",
    internalRefCode: "SPU-20260108-003",
    internalRefName: "运动休闲套装",
    originProjectId: "PRJ-20251215-004",
    originProjectName: "运动休闲套装",
    pricingMode: "UNIFIED",
    channelDefaultPrice: 299000,
    currency: "IDR",
    coverStoreCount: 2,
    onlineStoreCount: 0,
    contentStatus: "PUBLISHED",
    contentVersionId: "CV-004",
    mappingHealth: "CONFLICT",
    groupStatus: "HAS_BLOCKED",
    createdAt: "2026-01-08 11:00",
    updatedAt: "2026-01-13 16:00",
  },
  {
    id: "CPG-005",
    channel: "lazada",
    internalRefType: "SPU",
    internalRefId: "SPU-20260110-004",
    internalRefCode: "SPU-20260110-004",
    internalRefName: "真丝印花连衣裙",
    originProjectId: "PRJ-20251222-005",
    originProjectName: "真丝印花连衣裙",
    pricingMode: "UNIFIED",
    channelDefaultPrice: 459000,
    currency: "IDR",
    coverStoreCount: 1,
    onlineStoreCount: 0,
    contentStatus: "PUBLISHED",
    contentVersionId: "CV-005",
    mappingHealth: "OK",
    groupStatus: "ALL_OFFLINE",
    createdAt: "2026-01-10 16:00",
    updatedAt: "2026-01-12 10:00",
  },
  {
    id: "CPG-006",
    channel: "standalone",
    internalRefType: "SPU",
    internalRefId: "SPU-20260105-005",
    internalRefCode: "SPU-20260105-005",
    internalRefName: "法式优雅针织开衫",
    originProjectId: "PRJ-20251210-006",
    originProjectName: "法式优雅针织开衫",
    pricingMode: "UNIFIED",
    channelDefaultPrice: 35.99,
    currency: "USD",
    coverStoreCount: 1,
    onlineStoreCount: 1,
    contentStatus: "PUBLISHED",
    contentVersionId: "CV-006",
    mappingHealth: "OK",
    groupStatus: "ACTIVE",
    createdAt: "2026-01-05 09:00",
    updatedAt: "2026-01-14 08:00",
  },
]

// 项目列表（用于从项目生成）
const mockProjects = [
  { id: "PRJ-20251216-001", name: "印尼风格碎花连衣裙", status: "ARCHIVED", hasSpu: true, spuId: "SPU-20260110-001" },
  {
    id: "PRJ-20251220-002",
    name: "波西米亚风印花半身裙",
    status: "ARCHIVED",
    hasSpu: false,
    candidateId: "CAND-20260108-001",
  },
  { id: "PRJ-20251218-003", name: "清新格纹休闲衬衫", status: "ACTIVE", hasSpu: true, spuId: "SPU-20260112-002" },
  { id: "PRJ-20251215-004", name: "运动休闲套装", status: "ARCHIVED", hasSpu: true, spuId: "SPU-20260108-003" },
  { id: "PRJ-20260105-007", name: "简约百搭T恤", status: "ACTIVE", hasSpu: false, candidateId: "CAND-20260105-002" },
]

export default function ChannelProductGroupListPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterChannel, setFilterChannel] = useState("all")
  const [filterRefType, setFilterRefType] = useState("all")
  const [filterMappingHealth, setFilterMappingHealth] = useState("all")
  const [filterGroupStatus, setFilterGroupStatus] = useState("all")
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // CP3 - 创建/从项目生成抽屉
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [createMode, setCreateMode] = useState<"project" | "new">("project")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [selectedChannel, setSelectedChannel] = useState("")
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [inheritContent, setInheritContent] = useState(true)
  const [inheritPrice, setInheritPrice] = useState(true)
  const [pricingMode, setPricingMode] = useState("UNIFIED")
  const [defaultPrice, setDefaultPrice] = useState("")

  // CP7 - 迁移向导
  const [showMigrationWizard, setShowMigrationWizard] = useState(false)
  const [migrationStep, setMigrationStep] = useState(1)
  const [migrationGroup, setMigrationGroup] = useState<(typeof mockChannelProductGroups)[0] | null>(null)

  // 筛选数据
  const filteredGroups = mockChannelProductGroups.filter((group) => {
    if (
      searchKeyword &&
      !group.internalRefName.includes(searchKeyword) &&
      !group.internalRefCode.includes(searchKeyword) &&
      !group.originProjectName.includes(searchKeyword)
    )
      return false
    if (filterChannel !== "all" && group.channel !== filterChannel) return false
    if (filterRefType !== "all" && group.internalRefType !== filterRefType) return false
    if (filterMappingHealth !== "all" && group.mappingHealth !== filterMappingHealth) return false
    if (filterGroupStatus !== "all") {
      if (filterGroupStatus === "ONLINE" && group.onlineStoreCount === 0) return false
      if (filterGroupStatus === "ALL_OFFLINE" && group.onlineStoreCount > 0) return false
      if (filterGroupStatus === "HAS_BLOCKED" && group.groupStatus !== "HAS_BLOCKED") return false
    }
    return true
  })

  // KPI统计
  const kpiStats = {
    total: mockChannelProductGroups.length,
    hasOnline: mockChannelProductGroups.filter((g) => g.onlineStoreCount > 0).length,
    allOffline: mockChannelProductGroups.filter((g) => g.onlineStoreCount === 0).length,
    hasBlocked: mockChannelProductGroups.filter((g) => g.groupStatus === "HAS_BLOCKED").length,
    pendingMigration: mockChannelProductGroups.filter((g) => g.groupStatus === "PENDING_MIGRATION").length,
    mappingIssue: mockChannelProductGroups.filter((g) => g.mappingHealth !== "OK").length,
  }

  // 选择全部
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedGroups(filteredGroups.map((g) => g.id))
    } else {
      setSelectedGroups([])
    }
  }

  // 选择单个
  const handleSelectGroup = (groupId: string, checked: boolean) => {
    if (checked) {
      setSelectedGroups([...selectedGroups, groupId])
    } else {
      setSelectedGroups(selectedGroups.filter((id) => id !== groupId))
    }
  }

  // 获取可用店铺
  const getAvailableStores = () => {
    if (!selectedChannel) return []
    return STORES.filter((s) => s.channel === selectedChannel)
  }

  // 处理创建
  const handleCreate = () => {
    if (createMode === "project" && !selectedProjectId) {
      toast({ title: "请选择来源项目", variant: "destructive" })
      return
    }
    if (!selectedChannel) {
      toast({ title: "请选择渠道", variant: "destructive" })
      return
    }
    if (selectedStores.length === 0) {
      toast({ title: "请选择至少一个店铺", variant: "destructive" })
      return
    }
    if (pricingMode === "UNIFIED" && !defaultPrice) {
      toast({ title: "请填写渠道默认价", variant: "destructive" })
      return
    }

    toast({ title: "渠道商品组创建成功", description: `已为 ${selectedStores.length} 个店铺创建渠道商品` })
    setShowCreateDrawer(false)
    resetCreateForm()
  }

  // 重置表单
  const resetCreateForm = () => {
    setCreateMode("project")
    setSelectedProjectId("")
    setSelectedChannel("")
    setSelectedStores([])
    setInheritContent(true)
    setInheritPrice(true)
    setPricingMode("UNIFIED")
    setDefaultPrice("")
  }

  // 开始迁移
  const handleStartMigration = (group: (typeof mockChannelProductGroups)[0]) => {
    setMigrationGroup(group)
    setMigrationStep(1)
    setShowMigrationWizard(true)
  }

  // 完成迁移
  const handleCompleteMigration = () => {
    toast({ title: "迁移完成", description: `${migrationGroup?.internalRefName} 已成功迁移到 SPU` })
    setShowMigrationWizard(false)
    setMigrationGroup(null)
    setMigrationStep(1)
  }

  // 格式化价格
  const formatPrice = (price: number, currency: string) => {
    if (currency === "IDR") {
      return `Rp ${price.toLocaleString()}`
    } else if (currency === "USD") {
      return `$${price.toFixed(2)}`
    }
    return `${currency} ${price}`
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 页面标题 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">渠道商品管理（组视角）</h1>
              <p className="text-sm text-muted-foreground mt-1">
                跨店铺管理渠道商品，支持从项目生成、内容版本、价格策略、转档迁移
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/channels/products/store")}>
                <Store className="h-4 w-4 mr-2" />
                店铺视角
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    新建渠道商品
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setCreateMode("project")
                      setShowCreateDrawer(true)
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    从商品项目生成
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setCreateMode("new")
                      setShowCreateDrawer(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    从零新建
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* KPI卡片 */}
          <div className="grid grid-cols-6 gap-4">
            <Card className="cursor-pointer hover:border-primary" onClick={() => setFilterGroupStatus("all")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{kpiStats.total}</div>
                <div className="text-sm text-muted-foreground">全部商品组</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setFilterGroupStatus("ONLINE")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{kpiStats.hasOnline}</div>
                <div className="text-sm text-muted-foreground">有在售店铺</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setFilterGroupStatus("ALL_OFFLINE")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">{kpiStats.allOffline}</div>
                <div className="text-sm text-muted-foreground">全部下架</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setFilterGroupStatus("HAS_BLOCKED")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{kpiStats.hasBlocked}</div>
                <div className="text-sm text-muted-foreground">有受限</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">{kpiStats.pendingMigration}</div>
                <div className="text-sm text-muted-foreground">待迁移</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setFilterMappingHealth("MISSING")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{kpiStats.mappingIssue}</div>
                <div className="text-sm text-muted-foreground">映射异常</div>
              </CardContent>
            </Card>
          </div>

          {/* 筛选栏 */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索项目/款/编码..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="全部渠道" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部渠道</SelectItem>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRefType} onValueChange={setFilterRefType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="绑定类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="SPU">SPU</SelectItem>
                <SelectItem value="CANDIDATE">候选商品</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMappingHealth} onValueChange={setFilterMappingHealth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="映射健康" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="OK">正常</SelectItem>
                <SelectItem value="MISSING">缺映射</SelectItem>
                <SelectItem value="CONFLICT">冲突</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchKeyword("")
                setFilterChannel("all")
                setFilterRefType("all")
                setFilterMappingHealth("all")
                setFilterGroupStatus("all")
              }}
            >
              重置筛选
            </Button>
          </div>

          {/* 批量操作工具栏 */}
          {selectedGroups.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium">已选 {selectedGroups.length} 项</span>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" />
                批量发起上架
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                导出
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedGroups([])}>
                取消选择
              </Button>
            </div>
          )}

          {/* 数据表格 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedGroups.length === filteredGroups.length && filteredGroups.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>内部绑定</TableHead>
                    <TableHead>来源项目</TableHead>
                    <TableHead>渠道</TableHead>
                    <TableHead>覆盖店铺</TableHead>
                    <TableHead>价格策略</TableHead>
                    <TableHead>内容版本</TableHead>
                    <TableHead>映射健康</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroups.map((group) => (
                    <TableRow
                      key={group.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/channels/products/${group.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedGroups.includes(group.id)}
                          onCheckedChange={(checked) => handleSelectGroup(group.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={
                                INTERNAL_REF_TYPE[group.internalRefType as keyof typeof INTERNAL_REF_TYPE].color
                              }
                            >
                              {INTERNAL_REF_TYPE[group.internalRefType as keyof typeof INTERNAL_REF_TYPE].label}
                            </Badge>
                            <span className="font-medium">{group.internalRefCode}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{group.internalRefName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-blue-600 hover:underline">{group.originProjectId}</div>
                          <div className="text-muted-foreground truncate max-w-[150px]">{group.originProjectName}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{CHANNELS.find((c) => c.id === group.channel)?.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-green-600">{group.onlineStoreCount}</span>
                          <span className="text-muted-foreground">/</span>
                          <span>{group.coverStoreCount}</span>
                          <span className="text-muted-foreground text-sm">店铺</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Badge className={PRICING_MODE[group.pricingMode as keyof typeof PRICING_MODE].color}>
                            {PRICING_MODE[group.pricingMode as keyof typeof PRICING_MODE].label}
                          </Badge>
                          <span className="text-sm text-muted-foreground mt-1">
                            {formatPrice(group.channelDefaultPrice, group.currency)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={CONTENT_STATUS[group.contentStatus as keyof typeof CONTENT_STATUS].color}>
                          {CONTENT_STATUS[group.contentStatus as keyof typeof CONTENT_STATUS].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={MAPPING_HEALTH[group.mappingHealth as keyof typeof MAPPING_HEALTH].color}>
                          {MAPPING_HEALTH[group.mappingHealth as keyof typeof MAPPING_HEALTH].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={GROUP_STATUS[group.groupStatus as keyof typeof GROUP_STATUS].color}>
                          {GROUP_STATUS[group.groupStatus as keyof typeof GROUP_STATUS].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{group.updatedAt}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/channels/products/${group.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              查看详情
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Upload className="h-4 w-4 mr-2" />
                              发起上架
                            </DropdownMenuItem>
                            {group.groupStatus === "PENDING_MIGRATION" && (
                              <DropdownMenuItem onClick={() => handleStartMigration(group)}>
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                转档迁移
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Map className="h-4 w-4 mr-2" />
                              查看映射
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 分页 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">共 {filteredGroups.length} 条</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">第 {currentPage} 页</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage * pageSize >= filteredGroups.length}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* CP3 - 创建/从项目生成抽屉 */}
          <Sheet open={showCreateDrawer} onOpenChange={setShowCreateDrawer}>
            <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{createMode === "project" ? "从商品项目生成渠道商品" : "新建渠道商品"}</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-6">
                {/* 创建方式 */}
                <div className="space-y-2">
                  <Label>创建方式</Label>
                  <div className="flex gap-4">
                    <Button
                      variant={createMode === "project" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setCreateMode("project")}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      从项目生成
                    </Button>
                    <Button
                      variant={createMode === "new" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setCreateMode("new")}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      从零新建
                    </Button>
                  </div>
                </div>

                {/* 来源项目 */}
                {createMode === "project" && (
                  <div className="space-y-2">
                    <Label>来源项目 *</Label>
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择商品项目" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <span>{p.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {p.hasSpu ? "已转档SPU" : "候选商品"}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProjectId && (
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">内部绑定：</span>
                          {mockProjects.find((p) => p.id === selectedProjectId)?.hasSpu ? (
                            <Badge className="bg-blue-100 text-blue-700">
                              SPU: {mockProjects.find((p) => p.id === selectedProjectId)?.spuId}
                            </Badge>
                          ) : (
                            <Badge className="bg-purple-100 text-purple-700">
                              候选: {mockProjects.find((p) => p.id === selectedProjectId)?.candidateId}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 渠道选择 */}
                <div className="space-y-2">
                  <Label>渠道 *</Label>
                  <Select
                    value={selectedChannel}
                    onValueChange={(v) => {
                      setSelectedChannel(v)
                      setSelectedStores([])
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择渠道" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 店铺选择 */}
                <div className="space-y-2">
                  <Label>店铺 *（可多选）</Label>
                  {selectedChannel ? (
                    <div className="border rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
                      {getAvailableStores().map((store) => (
                        <div key={store.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedStores.includes(store.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedStores([...selectedStores, store.id])
                              } else {
                                setSelectedStores(selectedStores.filter((s) => s !== store.id))
                              }
                            }}
                          />
                          <span>{store.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {store.country}
                          </Badge>
                        </div>
                      ))}
                      {getAvailableStores().length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4">该渠道暂无可用店铺</div>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 text-center text-muted-foreground text-sm">请先选择渠道</div>
                  )}
                </div>

                {/* 继承选项 */}
                {createMode === "project" && (
                  <div className="space-y-3">
                    <Label>内容继承</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={inheritContent} onCheckedChange={(c) => setInheritContent(c as boolean)} />
                        <span className="text-sm">继承项目素材（主图/视频/详情图/尺码表）</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={inheritPrice} onCheckedChange={(c) => setInheritPrice(c as boolean)} />
                        <span className="text-sm">继承项目文案（标题/卖点/属性）</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 价格策略 */}
                <div className="space-y-2">
                  <Label>价格策略 *</Label>
                  <Select value={pricingMode} onValueChange={setPricingMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNIFIED">渠道统一价</SelectItem>
                      <SelectItem value="STORE_OVERRIDE">店铺差异价</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 默认价格 */}
                {pricingMode === "UNIFIED" && (
                  <div className="space-y-2">
                    <Label>渠道默认价 *</Label>
                    <Input
                      type="number"
                      placeholder="输入默认价格"
                      value={defaultPrice}
                      onChange={(e) => setDefaultPrice(e.target.value)}
                    />
                  </div>
                )}

                {/* 店铺差异价表格 */}
                {pricingMode === "STORE_OVERRIDE" && selectedStores.length > 0 && (
                  <div className="space-y-2">
                    <Label>店铺价格（每店铺必填）</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>店铺</TableHead>
                            <TableHead>价格</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedStores.map((storeId) => {
                            const store = STORES.find((s) => s.id === storeId)
                            return (
                              <TableRow key={storeId}>
                                <TableCell>{store?.name}</TableCell>
                                <TableCell>
                                  <Input type="number" placeholder="输入价格" className="w-[150px]" />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
              <SheetFooter className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
                <Button variant="outline" onClick={() => setShowCreateDrawer(false)}>
                  取消
                </Button>
                <Button onClick={handleCreate}>{createMode === "project" ? "生成渠道商品" : "创建"}</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* CP7 - 转档迁移向导 */}
          <Dialog open={showMigrationWizard} onOpenChange={setShowMigrationWizard}>
            <DialogContent className="max-w-[700px]">
              <DialogHeader>
                <DialogTitle>转档迁移向导</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                {/* 步骤指示器 */}
                <div className="flex items-center justify-center gap-4 mb-6">
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step} className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${migrationStep >= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {migrationStep > step ? <Check className="h-4 w-4" /> : step}
                      </div>
                      {step < 4 && (
                        <div className={`w-12 h-1 mx-2 ${migrationStep > step ? "bg-primary" : "bg-muted"}`} />
                      )}
                    </div>
                  ))}
                </div>

                {/* 步骤1：确认映射 */}
                {migrationStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-medium">步骤1：确认 Candidate → SPU 映射</h3>
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">候选商品</span>
                        <span className="font-medium">{migrationGroup?.internalRefCode}</span>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">目标SPU</span>
                        <span className="font-medium text-blue-600">{migrationGroup?.targetSpuId}</span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      确认后，将把该渠道商品组的内部绑定从候选商品切换到正式SPU。
                    </div>
                  </div>
                )}

                {/* 步骤2：选择迁移范围 */}
                {migrationStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-medium">步骤2：选择迁移范围</h3>
                    <div className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox defaultChecked />
                        <span>HiGood官方旗舰店</span>
                        <Badge className="bg-green-100 text-green-700">在售</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox defaultChecked />
                        <span>HiGood印尼店</span>
                        <Badge className="bg-orange-100 text-orange-700">已下架</Badge>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      选择要一并迁移的店铺渠道商品，平台item_id将保持不变。
                    </div>
                  </div>
                )}

                {/* 步骤3：变体映射补齐 */}
                {migrationStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-medium">步骤3：变体映射补齐</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>平台SKU</TableHead>
                            <TableHead>颜色/尺码</TableHead>
                            <TableHead>内部SKU</TableHead>
                            <TableHead>状态</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono text-sm">SKU-TT-001</TableCell>
                            <TableCell>碎花红 / S</TableCell>
                            <TableCell>
                              <Select defaultValue="sku-1">
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sku-1">SKU-001-S</SelectItem>
                                  <SelectItem value="sku-2">SKU-001-M</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-700">已匹配</Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono text-sm">SKU-TT-002</TableCell>
                            <TableCell>碎花红 / M</TableCell>
                            <TableCell>
                              <Select defaultValue="sku-2">
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sku-1">SKU-001-S</SelectItem>
                                  <SelectItem value="sku-2">SKU-001-M</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-700">已匹配</Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono text-sm">SKU-TT-003</TableCell>
                            <TableCell>碎花蓝 / S</TableCell>
                            <TableCell>
                              <Select>
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue placeholder="选择SKU" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sku-3">SKU-002-S</SelectItem>
                                  <SelectItem value="sku-4">SKU-002-M</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-yellow-100 text-yellow-700">待匹配</Badge>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-1" />
                        自动匹配
                      </Button>
                      <span className="text-sm text-muted-foreground">根据颜色+尺码自动匹配内部SKU</span>
                    </div>
                  </div>
                )}

                {/* 步骤4：迁移报告 */}
                {migrationStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="font-medium">步骤4：迁移报告</h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="text-green-700">渠道商品组绑定已切换为 SPU</span>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="text-green-700">2 个店铺渠道商品已迁移</span>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="text-green-700">3 个变体映射已建立</span>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-blue-600" />
                        <span className="text-blue-700">历史订单追溯映射已保留（candidate_id → spu_id）</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowMigrationWizard(false)}>
                  取消
                </Button>
                {migrationStep < 4 ? (
                  <Button onClick={() => setMigrationStep(migrationStep + 1)}>下一步</Button>
                ) : (
                  <Button onClick={handleCompleteMigration}>完成迁移</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
