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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Upload,
  RefreshCw,
  AlertTriangle,
  Link2,
  Package,
  Store,
  Map,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  Eye,
  ShoppingCart,
  FileText,
  ArrowRight,
} from "lucide-react"

// 状态枚举复用
const CHANNEL_PRODUCT_STATUS = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  LISTING_IN_PROGRESS: { label: "上架中", color: "bg-blue-100 text-blue-700" },
  ONLINE: { label: "在售", color: "bg-green-100 text-green-700" },
  OFFLINE: { label: "已下架", color: "bg-orange-100 text-orange-700" },
  BLOCKED: { label: "受限", color: "bg-red-100 text-red-700" },
  ARCHIVED: { label: "归档", color: "bg-gray-200 text-gray-600" },
}

const MAPPING_HEALTH = {
  OK: { label: "正常", color: "bg-green-100 text-green-700" },
  MISSING_SKU_MAP: { label: "缺SKU映射", color: "bg-yellow-100 text-yellow-700" },
  CONFLICT: { label: "冲突", color: "bg-red-100 text-red-700" },
}

const MAP_STATUS = {
  OK: { label: "正常", color: "bg-green-100 text-green-700" },
  MISSING: { label: "缺失", color: "bg-yellow-100 text-yellow-700" },
  CONFLICT: { label: "冲突", color: "bg-red-100 text-red-700" },
}

// Mock详情数据
const mockProductDetail = {
  id: "CP-001",
  channel: "TikTok Shop",
  store: "HiGood官方旗舰店",
  platformItemId: "TT-10001234567",
  platformItemTitle: "印尼风格碎花连衣裙夏季新款",
  platformCategory: "女装 > 连衣裙",
  platformMainImage: "/floral-dress.png",
  listingTime: "2026-01-05 14:30",
  status: "ONLINE",
  internalRefType: "SPU",
  internalRefId: "SPU-20260110-001",
  internalRefCode: "SPU-20260110-001",
  internalRefTitle: "印尼风格碎花连衣裙夏季新款",
  candidateConversionStatus: null, // 若是候选商品：已转档/未转档
  mappingHealth: "OK",
  createdAt: "2026-01-05 10:00",
  updatedAt: "2026-01-12 15:30",
}

// Mock变体数据
const mockVariants = [
  {
    id: "V-001",
    platformSkuId: "TT-SKU-001",
    sellerSku: "HG-DRESS-RED-S",
    color: "红色",
    size: "S",
    price: 199000,
    internalSkuId: "SKU-001",
    mapStatus: "OK",
  },
  {
    id: "V-002",
    platformSkuId: "TT-SKU-002",
    sellerSku: "HG-DRESS-RED-M",
    color: "红色",
    size: "M",
    price: 199000,
    internalSkuId: "SKU-002",
    mapStatus: "OK",
  },
  {
    id: "V-003",
    platformSkuId: "TT-SKU-003",
    sellerSku: "HG-DRESS-RED-L",
    color: "红色",
    size: "L",
    price: 199000,
    internalSkuId: "SKU-003",
    mapStatus: "OK",
  },
  {
    id: "V-004",
    platformSkuId: "TT-SKU-004",
    sellerSku: "HG-DRESS-BLUE-S",
    color: "蓝色",
    size: "S",
    price: 199000,
    internalSkuId: "SKU-004",
    mapStatus: "OK",
  },
  {
    id: "V-005",
    platformSkuId: "TT-SKU-005",
    sellerSku: "HG-DRESS-BLUE-M",
    color: "蓝色",
    size: "M",
    price: 199000,
    internalSkuId: null,
    mapStatus: "MISSING",
  },
  {
    id: "V-006",
    platformSkuId: "TT-SKU-006",
    sellerSku: "HG-DRESS-BLUE-L",
    color: "蓝色",
    size: "L",
    price: 199000,
    internalSkuId: "SKU-006",
    mapStatus: "OK",
  },
]

// Mock上架工作项
const mockListingInstances = [
  {
    id: "LI-003",
    code: "WI-LISTING-003",
    status: "已完成",
    owner: "渠道运营-李明",
    createdAt: "2026-01-05 10:30",
    completedAt: "2026-01-05 14:30",
    failReason: null,
  },
  {
    id: "LI-002",
    code: "WI-LISTING-002",
    status: "失败",
    owner: "渠道运营-李明",
    createdAt: "2026-01-04 16:00",
    completedAt: null,
    failReason: "主图不符合平台规范",
  },
  {
    id: "LI-001",
    code: "WI-LISTING-001",
    status: "已取消",
    owner: "渠道运营-王芳",
    createdAt: "2026-01-03 11:00",
    completedAt: null,
    failReason: null,
  },
]

// Mock订单追溯
const mockOrders = [
  {
    id: "ORD-001",
    platformOrderId: "TT-ORD-20260112001",
    buyerName: "用户A***",
    qty: 2,
    amount: 398000,
    orderTime: "2026-01-12 15:30",
    platformSkuId: "TT-SKU-001",
    mappedTo: "SKU-001",
  },
  {
    id: "ORD-002",
    platformOrderId: "TT-ORD-20260111002",
    buyerName: "用户B***",
    qty: 1,
    amount: 199000,
    orderTime: "2026-01-11 10:20",
    platformSkuId: "TT-SKU-004",
    mappedTo: "SKU-004",
  },
  {
    id: "ORD-003",
    platformOrderId: "TT-ORD-20260110003",
    buyerName: "用户C***",
    qty: 3,
    amount: 597000,
    orderTime: "2026-01-10 18:45",
    platformSkuId: "TT-SKU-002",
    mappedTo: "SKU-002",
  },
]

// Mock日志
const mockLogs = [
  {
    id: "LOG-001",
    action: "SKU映射更新",
    detail: "TT-SKU-005 映射到 SKU-005",
    operator: "系统",
    time: "2026-01-12 10:00",
  },
  {
    id: "LOG-002",
    action: "上架完成",
    detail: "工作项 WI-LISTING-003 执行成功",
    operator: "渠道运营-李明",
    time: "2026-01-05 14:30",
  },
  {
    id: "LOG-003",
    action: "创建渠道商品",
    detail: "绑定SPU SPU-20260110-001",
    operator: "渠道运营-李明",
    time: "2026-01-05 10:00",
  },
]

export default function ChannelProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [activeTab, setActiveTab] = useState("overview")
  const [listingDrawerOpen, setListingDrawerOpen] = useState(false)
  const [switchSpuDialogOpen, setSwitchSpuDialogOpen] = useState(false)
  const [bindSkuDialogOpen, setBindSkuDialogOpen] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<(typeof mockVariants)[0] | null>(null)

  const product = mockProductDetail

  // 发起上架
  const handleCreateListing = () => {
    toast({ title: "上架工作项创建成功" })
    setListingDrawerOpen(false)
  }

  // 切换到SPU
  const handleSwitchToSpu = () => {
    toast({ title: "绑定切换成功" })
    setSwitchSpuDialogOpen(false)
  }

  // 绑定SKU
  const handleBindSku = () => {
    toast({ title: "SKU映射成功" })
    setBindSkuDialogOpen(false)
  }

  // 自动映射
  const handleAutoMap = () => {
    toast({ title: "自动映射完成", description: "按颜色+尺码匹配了5个SKU" })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => router.push("/channels/products")}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  返回列表
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold">{product.platformItemTitle}</h1>
                <Badge className={CHANNEL_PRODUCT_STATUS[product.status as keyof typeof CHANNEL_PRODUCT_STATUS]?.color}>
                  {CHANNEL_PRODUCT_STATUS[product.status as keyof typeof CHANNEL_PRODUCT_STATUS]?.label}
                </Badge>
                <Badge className={MAPPING_HEALTH[product.mappingHealth as keyof typeof MAPPING_HEALTH]?.color}>
                  {product.mappingHealth !== "OK" && <AlertTriangle className="h-3 w-3 mr-1" />}
                  映射{MAPPING_HEALTH[product.mappingHealth as keyof typeof MAPPING_HEALTH]?.label}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  {product.channel} / {product.store}
                </span>
                <span className="font-mono">{product.platformItemId}</span>
                <span>
                  绑定: <span className="text-blue-600">{product.internalRefCode}</span>
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {(product.status === "DRAFT" || product.status === "OFFLINE") && (
                <Button onClick={() => setListingDrawerOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  发起上架
                </Button>
              )}
              {product.internalRefType === "CANDIDATE" && (
                <Button variant="outline" onClick={() => setSwitchSpuDialogOpen(true)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  切换绑定到SPU
                </Button>
              )}
              {product.mappingHealth !== "OK" && (
                <Button variant="outline" onClick={() => toast({ title: "打开映射修复向导" })}>
                  <Map className="h-4 w-4 mr-2" />
                  修复映射
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="variants">变体与映射</TabsTrigger>
              <TabsTrigger value="listing">上架工作项</TabsTrigger>
              <TabsTrigger value="orders">订单追溯</TabsTrigger>
              <TabsTrigger value="price">价格/库存</TabsTrigger>
              <TabsTrigger value="logs">日志与审计</TabsTrigger>
            </TabsList>

            {/* Tab1: 概览 */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* 平台侧信息 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      平台侧信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <img
                        src={product.platformMainImage || "/placeholder.svg"}
                        alt=""
                        className="w-24 h-24 rounded-md object-cover"
                      />
                      <div className="space-y-2 flex-1">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">平台商品ID</span>
                          <span className="text-sm font-mono">{product.platformItemId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">类目</span>
                          <span className="text-sm">{product.platformCategory}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">上架时间</span>
                          <span className="text-sm">{product.listingTime}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 内部绑定 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      内部绑定
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">绑定类型</span>
                        <Badge
                          variant="outline"
                          className={
                            product.internalRefType === "SPU"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }
                        >
                          {product.internalRefType === "SPU" ? "SPU" : "候选商品"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">编码</span>
                        <span className="text-sm text-blue-600 cursor-pointer hover:underline">
                          {product.internalRefCode}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">名称</span>
                        <span className="text-sm">{product.internalRefTitle}</span>
                      </div>
                      {product.internalRefType === "CANDIDATE" && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">转档状态</span>
                          <Badge variant="outline">{product.candidateConversionStatus || "未转档"}</Badge>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      查看{product.internalRefType === "SPU" ? "SPU" : "候选商品"}详情
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* 映射健康提示 */}
              {product.mappingHealth !== "OK" && (
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-4 flex items-center gap-4">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <div className="flex-1">
                      <div className="font-medium text-yellow-800">映射异常提示</div>
                      <div className="text-sm text-yellow-700">部分变体缺少SKU映射，可能影响订单追溯和库存同步</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setActiveTab("variants")}>
                      前往修复
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* 快捷入口 */}
              <div className="grid grid-cols-4 gap-4">
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setActiveTab("variants")}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <Package className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="font-medium">变体管理</div>
                      <div className="text-sm text-muted-foreground">{mockVariants.length} 个变体</div>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setActiveTab("listing")}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="font-medium">上架工作项</div>
                      <div className="text-sm text-muted-foreground">{mockListingInstances.length} 个实例</div>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setActiveTab("orders")}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <ShoppingCart className="h-8 w-8 text-orange-600" />
                    <div>
                      <div className="font-medium">订单追溯</div>
                      <div className="text-sm text-muted-foreground">{mockOrders.length} 个订单</div>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => toast({ title: "跳转到编码映射管理" })}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <Map className="h-8 w-8 text-purple-600" />
                    <div>
                      <div className="font-medium">编码映射</div>
                      <div className="text-sm text-muted-foreground">查看映射关系</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab2: 变体与映射 */}
            <TabsContent value="variants" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  共 {mockVariants.length} 个变体，{mockVariants.filter((v) => v.mapStatus !== "OK").length} 个映射异常
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleAutoMap}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    一键自动映射
                  </Button>
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>平台SKU ID</TableHead>
                        <TableHead>卖家SKU</TableHead>
                        <TableHead>规格</TableHead>
                        <TableHead>价格</TableHead>
                        <TableHead>映射到内部</TableHead>
                        <TableHead>映射状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockVariants.map((variant) => (
                        <TableRow key={variant.id}>
                          <TableCell className="font-mono text-sm">{variant.platformSkuId}</TableCell>
                          <TableCell className="font-mono text-sm">{variant.sellerSku}</TableCell>
                          <TableCell>
                            {variant.color} / {variant.size}
                          </TableCell>
                          <TableCell>Rp {(variant.price / 1000).toFixed(0)}K</TableCell>
                          <TableCell>
                            {variant.internalSkuId ? (
                              <span className="text-blue-600 text-sm">{variant.internalSkuId}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">未映射</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={MAP_STATUS[variant.mapStatus as keyof typeof MAP_STATUS]?.color}>
                              {variant.mapStatus !== "OK" && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {MAP_STATUS[variant.mapStatus as keyof typeof MAP_STATUS]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedVariant(variant)
                                    setBindSkuDialogOpen(true)
                                  }}
                                >
                                  <Link2 className="h-4 w-4 mr-2" />
                                  {variant.internalSkuId ? "更换绑定" : "绑定SKU"}
                                </DropdownMenuItem>
                                {variant.internalSkuId && (
                                  <DropdownMenuItem onClick={() => toast({ title: "解除绑定成功" })}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    解除绑定
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab3: 上架工作项 */}
            <TabsContent value="listing" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">关联的上架工作项实例（时间倒序）</div>
                <Button size="sm" onClick={() => setListingDrawerOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  发起上架
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>实例编号</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>负责人</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead>完成时间</TableHead>
                        <TableHead>失败原因</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockListingInstances.map((instance) => (
                        <TableRow key={instance.id}>
                          <TableCell className="font-mono text-sm text-blue-600">{instance.code}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                instance.status === "已完成"
                                  ? "bg-green-100 text-green-700"
                                  : instance.status === "失败"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-700"
                              }
                            >
                              {instance.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{instance.owner}</TableCell>
                          <TableCell>{instance.createdAt}</TableCell>
                          <TableCell>{instance.completedAt || "-"}</TableCell>
                          <TableCell className="text-red-600 text-sm">{instance.failReason || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => toast({ title: "查看工作项详情" })}>
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
            </TabsContent>

            {/* Tab4: 订单追溯 */}
            <TabsContent value="orders" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">编码映射链路说明</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">平台订单行</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">platform_item_id / sku_id</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">CodeMapping</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">internal_ref (候选/SPU)</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    历史订单保留原始平台编码，通过映射关系追溯到内部商品/SKU
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">最近订单</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>平台订单号</TableHead>
                        <TableHead>买家</TableHead>
                        <TableHead>下单时间</TableHead>
                        <TableHead>数量</TableHead>
                        <TableHead>金额</TableHead>
                        <TableHead>平台SKU</TableHead>
                        <TableHead>映射到</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm text-blue-600">{order.platformOrderId}</TableCell>
                          <TableCell>{order.buyerName}</TableCell>
                          <TableCell>{order.orderTime}</TableCell>
                          <TableCell>{order.qty}</TableCell>
                          <TableCell>Rp {(order.amount / 1000).toFixed(0)}K</TableCell>
                          <TableCell className="font-mono text-sm">{order.platformSkuId}</TableCell>
                          <TableCell className="text-blue-600 text-sm">{order.mappedTo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab5: 价格/库存 */}
            <TabsContent value="price" className="space-y-4">
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>价格与库存信息由其他模块（OMS/WMS）维护</p>
                  <Button variant="link" className="mt-2">
                    跳转到库存管理 <ExternalLink className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab6: 日志与审计 */}
            <TabsContent value="logs" className="space-y-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>时间</TableHead>
                        <TableHead>操作</TableHead>
                        <TableHead>详情</TableHead>
                        <TableHead>操作人</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">{log.time}</TableCell>
                          <TableCell className="font-medium">{log.action}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{log.detail}</TableCell>
                          <TableCell>{log.operator}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* CP4: 发起上架抽屉 */}
          <Sheet open={listingDrawerOpen} onOpenChange={setListingDrawerOpen}>
            <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>发起商品上架</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">渠道/店铺</span>
                      <span className="text-sm">
                        {product.channel} / {product.store}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">内部绑定</span>
                      <span className="text-sm text-blue-600">{product.internalRefCode}</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Label>上架变体</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
                    {mockVariants.map((variant) => (
                      <div key={variant.id} className="flex items-center gap-2">
                        <Checkbox id={`listing-${variant.id}`} defaultChecked />
                        <Label htmlFor={`listing-${variant.id}`} className="text-sm">
                          {variant.color} / {variant.size} ({variant.sellerSku})
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>负责人</Label>
                  <Select defaultValue="渠道运营-李明">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="渠道运营-李明">渠道运营-李明</SelectItem>
                      <SelectItem value="渠道运营-王芳">渠道运营-王芳</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => setListingDrawerOpen(false)}
                  >
                    取消
                  </Button>
                  <Button className="flex-1" onClick={handleCreateListing}>
                    <Upload className="h-4 w-4 mr-2" />
                    创建上架工作项
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* 切换绑定到SPU弹窗 */}
          <Dialog open={switchSpuDialogOpen} onOpenChange={setSwitchSpuDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>切换绑定到SPU</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">确认将绑定从候选商品切换到SPU？</p>
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">当前绑定</span>
                      <span className="text-sm">{product.internalRefCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">切换到</span>
                      <span className="text-sm text-blue-600">SPU-20260115-001</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSwitchSpuDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleSwitchToSpu}>确认切换</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 绑定SKU弹窗 */}
          <Dialog open={bindSkuDialogOpen} onOpenChange={setBindSkuDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>绑定内部SKU</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>平台SKU</Label>
                  <div className="text-sm font-mono">{selectedVariant?.platformSkuId}</div>
                </div>
                <div className="space-y-2">
                  <Label>规格</Label>
                  <div className="text-sm">
                    {selectedVariant?.color} / {selectedVariant?.size}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>选择内部SKU</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SKU-001">SKU-001 (红色-S)</SelectItem>
                      <SelectItem value="SKU-002">SKU-002 (红色-M)</SelectItem>
                      <SelectItem value="SKU-003">SKU-003 (红色-L)</SelectItem>
                      <SelectItem value="SKU-004">SKU-004 (蓝色-S)</SelectItem>
                      <SelectItem value="SKU-005">SKU-005 (蓝色-M)</SelectItem>
                      <SelectItem value="SKU-006">SKU-006 (蓝色-L)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBindSkuDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleBindSku}>确认绑定</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
