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
  MoreHorizontal,
  Eye,
  RefreshCw,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  Layers,
  PowerOff,
  Map,
  ExternalLink,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

// 店铺渠道商品状态
const CHANNEL_PRODUCT_STATUS = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  READY: { label: "就绪", color: "bg-blue-100 text-blue-700" },
  LISTING_IN_PROGRESS: { label: "上架中", color: "bg-yellow-100 text-yellow-700" },
  ONLINE: { label: "在售", color: "bg-green-100 text-green-700" },
  OFFLINE: { label: "已下架", color: "bg-orange-100 text-orange-700" },
  BLOCKED: { label: "受限", color: "bg-red-100 text-red-700" },
  ARCHIVED: { label: "归档", color: "bg-gray-200 text-gray-600" },
}

// 映射健康
const MAPPING_HEALTH = {
  OK: { label: "正常", color: "bg-green-100 text-green-700" },
  MISSING: { label: "缺映射", color: "bg-yellow-100 text-yellow-700" },
  CONFLICT: { label: "冲突", color: "bg-red-100 text-red-700" },
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

// Mock数据 - 店铺渠道商品（CP1）
const mockChannelProducts = [
  {
    id: "CP-001",
    groupId: "CPG-001",
    channel: "tiktok",
    storeId: "store-1",
    storeName: "HiGood官方旗舰店",
    platformItemId: "TT-10001234567",
    platformItemTitle: "印尼风格碎花连衣裙夏季新款",
    status: "ONLINE",
    internalRefType: "SPU",
    internalRefCode: "SPU-20260110-001",
    internalRefName: "印尼风格碎花连衣裙",
    variantCount: 6,
    storePrice: 199000,
    currency: "IDR",
    activeListingInstanceId: null,
    lastListingResult: "success",
    lastOrderAt: "2026-01-14 15:30",
    mappingHealth: "OK",
    createdAt: "2026-01-05 10:00",
    updatedAt: "2026-01-14 15:30",
  },
  {
    id: "CP-002",
    groupId: "CPG-001",
    channel: "tiktok",
    storeId: "store-2",
    storeName: "HiGood印尼店",
    platformItemId: "TT-10001234590",
    platformItemTitle: "印尼风格碎花连衣裙夏季新款",
    status: "ONLINE",
    internalRefType: "SPU",
    internalRefCode: "SPU-20260110-001",
    internalRefName: "印尼风格碎花连衣裙",
    variantCount: 6,
    storePrice: 189000,
    currency: "IDR",
    activeListingInstanceId: null,
    lastListingResult: "success",
    lastOrderAt: "2026-01-14 12:00",
    mappingHealth: "OK",
    createdAt: "2026-01-06 09:00",
    updatedAt: "2026-01-14 12:00",
  },
  {
    id: "CP-003",
    groupId: "CPG-002",
    channel: "tiktok",
    storeId: "store-1",
    storeName: "HiGood官方旗舰店",
    platformItemId: "TT-10001234568",
    platformItemTitle: "波西米亚风印花半身裙",
    status: "ONLINE",
    internalRefType: "CANDIDATE",
    internalRefCode: "CAND-测款001",
    internalRefName: "波西米亚风印花半身裙",
    variantCount: 4,
    storePrice: 159000,
    currency: "IDR",
    activeListingInstanceId: null,
    lastListingResult: "success",
    lastOrderAt: "2026-01-13 18:00",
    mappingHealth: "OK",
    createdAt: "2026-01-08 09:00",
    updatedAt: "2026-01-13 18:00",
  },
  {
    id: "CP-004",
    groupId: "CPG-003",
    channel: "shopee",
    storeId: "store-3",
    storeName: "HiGood马来店",
    platformItemId: "SP-20001234567",
    platformItemTitle: "清新格纹休闲衬衫",
    status: "ONLINE",
    internalRefType: "SPU",
    internalRefCode: "SPU-20260112-002",
    internalRefName: "清新格纹休闲衬衫",
    variantCount: 8,
    storePrice: 45.9,
    currency: "MYR",
    activeListingInstanceId: null,
    lastListingResult: "success",
    lastOrderAt: "2026-01-14 10:00",
    mappingHealth: "MISSING",
    createdAt: "2026-01-10 14:00",
    updatedAt: "2026-01-14 10:00",
  },
  {
    id: "CP-005",
    groupId: "CPG-003",
    channel: "shopee",
    storeId: "store-5",
    storeName: "HiGood越南店",
    platformItemId: null,
    platformItemTitle: "清新格纹休闲衬衫",
    status: "DRAFT",
    internalRefType: "SPU",
    internalRefCode: "SPU-20260112-002",
    internalRefName: "清新格纹休闲衬衫",
    variantCount: 8,
    storePrice: 350000,
    currency: "VND",
    activeListingInstanceId: null,
    lastListingResult: null,
    lastOrderAt: null,
    mappingHealth: "MISSING",
    createdAt: "2026-01-12 11:00",
    updatedAt: "2026-01-12 11:00",
  },
  {
    id: "CP-006",
    groupId: "CPG-004",
    channel: "tiktok",
    storeId: "store-1",
    storeName: "HiGood官方旗舰店",
    platformItemId: "TT-10001234580",
    platformItemTitle: "运动休闲套装",
    status: "BLOCKED",
    internalRefType: "SPU",
    internalRefCode: "SPU-20260108-003",
    internalRefName: "运动休闲套装",
    variantCount: 6,
    storePrice: 299000,
    currency: "IDR",
    activeListingInstanceId: null,
    lastListingResult: "fail",
    lastListingFailReason: "平台审核不通过：图片包含敏感信息",
    lastOrderAt: "2026-01-10 14:00",
    mappingHealth: "CONFLICT",
    createdAt: "2026-01-08 11:00",
    updatedAt: "2026-01-13 16:00",
  },
  {
    id: "CP-007",
    groupId: "CPG-004",
    channel: "tiktok",
    storeId: "store-2",
    storeName: "HiGood印尼店",
    platformItemId: "TT-10001234581",
    platformItemTitle: "运动休闲套装",
    status: "LISTING_IN_PROGRESS",
    internalRefType: "SPU",
    internalRefCode: "SPU-20260108-003",
    internalRefName: "运动休闲套装",
    variantCount: 6,
    storePrice: 289000,
    currency: "IDR",
    activeListingInstanceId: "WI-LISTING-001",
    lastListingResult: null,
    lastOrderAt: null,
    mappingHealth: "OK",
    createdAt: "2026-01-08 12:00",
    updatedAt: "2026-01-14 09:00",
  },
  {
    id: "CP-008",
    groupId: "CPG-005",
    channel: "lazada",
    storeId: "store-4",
    storeName: "HiGood菲律宾店",
    platformItemId: "LZ-30001234567",
    platformItemTitle: "真丝印花连衣裙",
    status: "OFFLINE",
    internalRefType: "SPU",
    internalRefCode: "SPU-20260110-004",
    internalRefName: "真丝印花连衣裙",
    variantCount: 4,
    storePrice: 2599,
    currency: "PHP",
    activeListingInstanceId: null,
    lastListingResult: "success",
    lastOrderAt: "2026-01-08 16:00",
    mappingHealth: "OK",
    createdAt: "2026-01-10 16:00",
    updatedAt: "2026-01-12 10:00",
  },
]

export default function StoreChannelProductListPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterChannel, setFilterChannel] = useState("all")
  const [filterStore, setFilterStore] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterMappingHealth, setFilterMappingHealth] = useState("all")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // 筛选数据
  const filteredProducts = mockChannelProducts.filter((product) => {
    if (
      searchKeyword &&
      !product.internalRefName.includes(searchKeyword) &&
      !product.internalRefCode.includes(searchKeyword) &&
      !product.platformItemId?.includes(searchKeyword)
    )
      return false
    if (filterChannel !== "all" && product.channel !== filterChannel) return false
    if (filterStore !== "all" && product.storeId !== filterStore) return false
    if (filterStatus !== "all" && product.status !== filterStatus) return false
    if (filterMappingHealth !== "all" && product.mappingHealth !== filterMappingHealth) return false
    return true
  })

  // KPI统计
  const kpiStats = {
    total: mockChannelProducts.length,
    online: mockChannelProducts.filter((p) => p.status === "ONLINE").length,
    draft: mockChannelProducts.filter((p) => p.status === "DRAFT" || p.status === "READY").length,
    listingInProgress: mockChannelProducts.filter((p) => p.status === "LISTING_IN_PROGRESS").length,
    blocked: mockChannelProducts.filter((p) => p.status === "BLOCKED").length,
    mappingIssue: mockChannelProducts.filter((p) => p.mappingHealth !== "OK").length,
  }

  // 格式化价格
  const formatPrice = (price: number, currency: string) => {
    if (currency === "IDR") return `Rp ${price.toLocaleString()}`
    if (currency === "MYR") return `RM ${price.toFixed(2)}`
    if (currency === "PHP") return `₱${price.toLocaleString()}`
    if (currency === "VND") return `₫${price.toLocaleString()}`
    if (currency === "USD") return `$${price.toFixed(2)}`
    return `${currency} ${price}`
  }

  // 选择全部
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(filteredProducts.map((p) => p.id))
    } else {
      setSelectedProducts([])
    }
  }

  // 选择单个
  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts([...selectedProducts, productId])
    } else {
      setSelectedProducts(selectedProducts.filter((id) => id !== productId))
    }
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
              <h1 className="text-2xl font-bold">店铺渠道商品（店铺视角）</h1>
              <p className="text-sm text-muted-foreground mt-1">
                按店铺维度管理渠道商品，查看上架状态、平台Item、订单追溯
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/channels/products")}>
                <Layers className="h-4 w-4 mr-2" />
                组视角
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
            </div>
          </div>

          {/* KPI卡片 */}
          <div className="grid grid-cols-6 gap-4">
            <Card className="cursor-pointer hover:border-primary" onClick={() => setFilterStatus("all")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{kpiStats.total}</div>
                <div className="text-sm text-muted-foreground">全部商品</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setFilterStatus("ONLINE")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{kpiStats.online}</div>
                <div className="text-sm text-muted-foreground">在售</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setFilterStatus("DRAFT")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-600">{kpiStats.draft}</div>
                <div className="text-sm text-muted-foreground">草稿/就绪</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-primary"
              onClick={() => setFilterStatus("LISTING_IN_PROGRESS")}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{kpiStats.listingInProgress}</div>
                <div className="text-sm text-muted-foreground">上架中</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setFilterStatus("BLOCKED")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{kpiStats.blocked}</div>
                <div className="text-sm text-muted-foreground">受限</div>
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
                placeholder="搜索商品/编码/平台ID..."
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
            <Select value={filterStore} onValueChange={setFilterStore}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="全部店铺" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部店铺</SelectItem>
                {STORES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(CHANNEL_PRODUCT_STATUS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMappingHealth} onValueChange={setFilterMappingHealth}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="映射健康" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
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
                setFilterStore("all")
                setFilterStatus("all")
                setFilterMappingHealth("all")
              }}
            >
              重置
            </Button>
          </div>

          {/* 批量操作工具栏 */}
          {selectedProducts.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium">已选 {selectedProducts.length} 项</span>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" />
                批量发起上架
              </Button>
              <Button variant="outline" size="sm">
                <PowerOff className="h-4 w-4 mr-1" />
                批量下架
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedProducts([])}>
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
                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>店铺</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead>平台Item</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>店铺价格</TableHead>
                    <TableHead>变体数</TableHead>
                    <TableHead>映射</TableHead>
                    <TableHead>最近订单</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/channels/products/store/${product.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{product.storeName}</span>
                          <Badge variant="outline" className="w-fit text-xs">
                            {CHANNELS.find((c) => c.id === product.channel)?.name}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{product.internalRefCode}</span>
                          <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                            {product.internalRefName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.platformItemId ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-sm">{product.platformItemId}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            className={
                              CHANNEL_PRODUCT_STATUS[product.status as keyof typeof CHANNEL_PRODUCT_STATUS].color
                            }
                          >
                            {CHANNEL_PRODUCT_STATUS[product.status as keyof typeof CHANNEL_PRODUCT_STATUS].label}
                          </Badge>
                          {product.status === "BLOCKED" && product.lastListingFailReason && (
                            <span
                              className="text-xs text-red-600 truncate max-w-[120px]"
                              title={product.lastListingFailReason}
                            >
                              {product.lastListingFailReason}
                            </span>
                          )}
                          {product.status === "LISTING_IN_PROGRESS" && (
                            <span className="text-xs text-yellow-600">工作项: {product.activeListingInstanceId}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatPrice(product.storePrice, product.currency)}</TableCell>
                      <TableCell>{product.variantCount}</TableCell>
                      <TableCell>
                        <Badge className={MAPPING_HEALTH[product.mappingHealth as keyof typeof MAPPING_HEALTH].color}>
                          {MAPPING_HEALTH[product.mappingHealth as keyof typeof MAPPING_HEALTH].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.lastOrderAt || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.updatedAt}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/channels/products/store/${product.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              查看详情
                            </DropdownMenuItem>
                            {(product.status === "DRAFT" ||
                              product.status === "READY" ||
                              product.status === "OFFLINE" ||
                              product.status === "BLOCKED") && (
                              <DropdownMenuItem>
                                <Upload className="h-4 w-4 mr-2" />
                                发起上架
                              </DropdownMenuItem>
                            )}
                            {product.status === "ONLINE" && (
                              <>
                                <DropdownMenuItem>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  更新上架
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <PowerOff className="h-4 w-4 mr-2" />
                                  下架
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Map className="h-4 w-4 mr-2" />
                              修复映射
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
            <div className="text-sm text-muted-foreground">共 {filteredProducts.length} 条</div>
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
                disabled={currentPage * pageSize >= filteredProducts.length}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
