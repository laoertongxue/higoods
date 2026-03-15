"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Edit,
  Upload,
  RefreshCw,
  ExternalLink,
  FileText,
  Package,
  History,
  Map,
  ShoppingCart,
  Check,
  X,
} from "lucide-react"

// 状态枚举
const CHANNEL_PRODUCT_STATUS = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  READY: { label: "就绪", color: "bg-blue-100 text-blue-700" },
  LISTING_IN_PROGRESS: { label: "上架中", color: "bg-yellow-100 text-yellow-700" },
  ONLINE: { label: "在售", color: "bg-green-100 text-green-700" },
  OFFLINE: { label: "已下架", color: "bg-orange-100 text-orange-700" },
  BLOCKED: { label: "受限", color: "bg-red-100 text-red-700" },
}

const MAPPING_HEALTH = {
  OK: { label: "正常", color: "bg-green-100 text-green-700" },
  MISSING: { label: "缺映射", color: "bg-yellow-100 text-yellow-700" },
  CONFLICT: { label: "冲突", color: "bg-red-100 text-red-700" },
}

// Mock详情数据
const mockProductDetail = {
  id: "CP-001",
  groupId: "CPG-001",
  channel: "tiktok",
  channelName: "TikTok Shop",
  storeId: "store-1",
  storeName: "HiGood官方旗舰店",
  storeCountry: "ID",
  platformItemId: "TT-10001234567",
  platformItemTitle: "印尼风格碎花连衣裙夏季新款",
  status: "ONLINE",
  internalRefType: "SPU",
  internalRefCode: "SPU-20260110-001",
  internalRefName: "印尼风格碎花连衣裙",
  originProjectId: "PRJ-20251216-001",
  variantCount: 6,
  storePrice: 199000,
  storePriceOverride: false,
  currency: "IDR",
  activeListingInstanceId: null,
  lastListingResult: "success",
  lastListingAt: "2026-01-10 15:00",
  lastOrderAt: "2026-01-14 15:30",
  mappingHealth: "OK",
  createdAt: "2026-01-05 10:00",
  updatedAt: "2026-01-14 15:30",
}

// Mock变体
const mockVariants = [
  {
    id: "V-001",
    platformSkuId: "SKU-TT-001",
    sellerSku: "HG-FD-001-S-RED",
    color: "碎花红",
    size: "S",
    internalSkuId: "SKU-001-S-RED",
    mapStatus: "OK",
    price: 199000,
    stock: 50,
  },
  {
    id: "V-002",
    platformSkuId: "SKU-TT-002",
    sellerSku: "HG-FD-001-M-RED",
    color: "碎花红",
    size: "M",
    internalSkuId: "SKU-001-M-RED",
    mapStatus: "OK",
    price: 199000,
    stock: 80,
  },
  {
    id: "V-003",
    platformSkuId: "SKU-TT-003",
    sellerSku: "HG-FD-001-L-RED",
    color: "碎花红",
    size: "L",
    internalSkuId: "SKU-001-L-RED",
    mapStatus: "OK",
    price: 199000,
    stock: 60,
  },
  {
    id: "V-004",
    platformSkuId: "SKU-TT-004",
    sellerSku: "HG-FD-001-S-BLUE",
    color: "碎花蓝",
    size: "S",
    internalSkuId: "SKU-001-S-BLUE",
    mapStatus: "OK",
    price: 199000,
    stock: 45,
  },
  {
    id: "V-005",
    platformSkuId: "SKU-TT-005",
    sellerSku: "HG-FD-001-M-BLUE",
    color: "碎花蓝",
    size: "M",
    internalSkuId: "SKU-001-M-BLUE",
    mapStatus: "OK",
    price: 199000,
    stock: 70,
  },
  {
    id: "V-006",
    platformSkuId: "SKU-TT-006",
    sellerSku: "HG-FD-001-L-BLUE",
    color: "碎花蓝",
    size: "L",
    internalSkuId: "SKU-001-L-BLUE",
    mapStatus: "OK",
    price: 199000,
    stock: 55,
  },
]

// Mock上架历史
const mockListingHistory = [
  {
    id: "WI-LISTING-001",
    type: "首次上架",
    status: "已完成",
    result: "success",
    submittedAt: "2026-01-05 10:30",
    completedAt: "2026-01-05 11:00",
    operator: "张三",
    platformResponse: "审核通过",
  },
  {
    id: "WI-LISTING-003",
    type: "更新上架",
    status: "已完成",
    result: "success",
    submittedAt: "2026-01-10 14:30",
    completedAt: "2026-01-10 15:00",
    operator: "李四",
    platformResponse: "审核通过",
  },
]

// Mock订单追溯
const mockOrders = [
  {
    id: "ORD-001",
    platformOrderId: "TT-ORD-20260114001",
    orderAt: "2026-01-14 15:30",
    buyer: "buyer***",
    skuCount: 2,
    amount: 398000,
    status: "已发货",
  },
  {
    id: "ORD-002",
    platformOrderId: "TT-ORD-20260114002",
    orderAt: "2026-01-14 12:00",
    buyer: "buyer***",
    skuCount: 1,
    amount: 199000,
    status: "待发货",
  },
  {
    id: "ORD-003",
    platformOrderId: "TT-ORD-20260113001",
    orderAt: "2026-01-13 18:00",
    buyer: "buyer***",
    skuCount: 3,
    amount: 597000,
    status: "已完成",
  },
]

export default function StoreChannelProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const productId = params.id as string

  const [activeTab, setActiveTab] = useState("overview")

  // 格式化价格
  const formatPrice = (price: number, currency: string) => {
    if (currency === "IDR") return `Rp ${price.toLocaleString()}`
    return `${currency} ${price}`
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{mockProductDetail.platformItemTitle}</h1>
                  <Badge
                    className={
                      CHANNEL_PRODUCT_STATUS[mockProductDetail.status as keyof typeof CHANNEL_PRODUCT_STATUS].color
                    }
                  >
                    {CHANNEL_PRODUCT_STATUS[mockProductDetail.status as keyof typeof CHANNEL_PRODUCT_STATUS].label}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>
                    店铺: <span className="font-medium text-foreground">{mockProductDetail.storeName}</span>
                  </span>
                  <span>
                    平台Item: <span className="font-mono">{mockProductDetail.platformItemId}</span>
                  </span>
                  <span>
                    内部绑定: <span className="text-blue-600">{mockProductDetail.internalRefCode}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mockProductDetail.status === "ONLINE" && (
                <>
                  <Button variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    更新上架
                  </Button>
                  <Button variant="outline">下架</Button>
                </>
              )}
              {(mockProductDetail.status === "DRAFT" ||
                mockProductDetail.status === "OFFLINE" ||
                mockProductDetail.status === "BLOCKED") && (
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  发起上架
                </Button>
              )}
              <Button variant="outline" onClick={() => router.push(`/channels/products/${mockProductDetail.groupId}`)}>
                查看商品组
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="variants">变体与映射</TabsTrigger>
              <TabsTrigger value="listing">上架工作项</TabsTrigger>
              <TabsTrigger value="orders">订单追溯</TabsTrigger>
            </TabsList>

            {/* Tab1: 概览 */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      基本信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">渠道商品ID:</span>{" "}
                      <span className="font-mono">{mockProductDetail.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">渠道商品组:</span>{" "}
                      <span className="text-blue-600">{mockProductDetail.groupId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">渠道:</span> {mockProductDetail.channelName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">店铺:</span> {mockProductDetail.storeName} (
                      {mockProductDetail.storeCountry})
                    </div>
                    <div>
                      <span className="text-muted-foreground">平台Item ID:</span>{" "}
                      <span className="font-mono">{mockProductDetail.platformItemId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">内部绑定:</span>{" "}
                      <Badge className="bg-blue-100 text-blue-700">{mockProductDetail.internalRefType}</Badge>{" "}
                      {mockProductDetail.internalRefCode}
                    </div>
                    <div>
                      <span className="text-muted-foreground">变体数量:</span> {mockProductDetail.variantCount}
                    </div>
                    <div>
                      <span className="text-muted-foreground">来源项目:</span>{" "}
                      <span className="text-blue-600">{mockProductDetail.originProjectId}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">状态与价格</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">状态</span>
                      <Badge
                        className={
                          CHANNEL_PRODUCT_STATUS[mockProductDetail.status as keyof typeof CHANNEL_PRODUCT_STATUS].color
                        }
                      >
                        {CHANNEL_PRODUCT_STATUS[mockProductDetail.status as keyof typeof CHANNEL_PRODUCT_STATUS].label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">映射健康</span>
                      <Badge
                        className={MAPPING_HEALTH[mockProductDetail.mappingHealth as keyof typeof MAPPING_HEALTH].color}
                      >
                        {MAPPING_HEALTH[mockProductDetail.mappingHealth as keyof typeof MAPPING_HEALTH].label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">店铺价格</span>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">
                          {formatPrice(mockProductDetail.storePrice, mockProductDetail.currency)}
                        </span>
                        {mockProductDetail.storePriceOverride && (
                          <Badge variant="outline" className="text-xs">
                            覆盖
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">最近上架</span>
                      <span className="text-sm">{mockProductDetail.lastListingAt}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">最近订单</span>
                      <span className="text-sm">{mockProductDetail.lastOrderAt}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab2: 变体与映射 */}
            <TabsContent value="variants" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    平台变体列表
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-1" />
                      自动匹配
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push("/channels/products/mapping")}>
                      <Map className="h-4 w-4 mr-1" />
                      统一映射
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>平台SKU</TableHead>
                        <TableHead>Seller SKU</TableHead>
                        <TableHead>颜色</TableHead>
                        <TableHead>尺码</TableHead>
                        <TableHead>内部SKU</TableHead>
                        <TableHead>映射状态</TableHead>
                        <TableHead>价格</TableHead>
                        <TableHead>库存</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockVariants.map((variant) => (
                        <TableRow key={variant.id}>
                          <TableCell className="font-mono text-sm">{variant.platformSkuId}</TableCell>
                          <TableCell className="font-mono text-sm">{variant.sellerSku}</TableCell>
                          <TableCell>{variant.color}</TableCell>
                          <TableCell>{variant.size}</TableCell>
                          <TableCell>
                            <span className="text-blue-600">{variant.internalSkuId}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                variant.mapStatus === "OK"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }
                            >
                              {variant.mapStatus === "OK" ? "已映射" : "待匹配"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatPrice(variant.price, mockProductDetail.currency)}</TableCell>
                          <TableCell>{variant.stock}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab3: 上架工作项 */}
            <TabsContent value="listing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    上架工作项历史
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>工作项ID</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>结果</TableHead>
                        <TableHead>平台回执</TableHead>
                        <TableHead>提交时间</TableHead>
                        <TableHead>完成时间</TableHead>
                        <TableHead>操作人</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockListingHistory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <span className="text-blue-600 cursor-pointer hover:underline">{item.id}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700">{item.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {item.result === "success" ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-red-600" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{item.platformResponse}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.submittedAt}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.completedAt}</TableCell>
                          <TableCell>{item.operator}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab4: 订单追溯 */}
            <TabsContent value="orders" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    关联订单
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>订单ID</TableHead>
                        <TableHead>平台订单号</TableHead>
                        <TableHead>下单时间</TableHead>
                        <TableHead>买家</TableHead>
                        <TableHead>SKU数</TableHead>
                        <TableHead>金额</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <span className="text-blue-600 cursor-pointer hover:underline">{order.id}</span>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{order.platformOrderId}</TableCell>
                          <TableCell className="text-sm">{order.orderAt}</TableCell>
                          <TableCell>{order.buyer}</TableCell>
                          <TableCell>{order.skuCount}</TableCell>
                          <TableCell className="font-medium">
                            {formatPrice(order.amount, mockProductDetail.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
