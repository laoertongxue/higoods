"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Package,
  ArrowLeft,
  Edit,
  Power,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Plus,
  Trash2,
  FileText,
  Layers,
  MoreHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"

// Mock SKU detail data
const mockSKUDetail = {
  id: "SKU-001",
  sku_code: "SKU-FD-001-RED-S",
  spu_id: "SPU-FD-001",
  spu_code: "SPU-FD-001",
  spu_name: "印尼风格碎花连衣裙",
  color: "红色",
  size: "S",
  print: "碎花A",
  status: "ACTIVE",
  barcode: "6901234567890",
  weight: 0.35,
  volume: "30x25x5cm",
  techpack_version: "V2.1",
  techpack_version_id: "TPV-002",
  mapping_health: "OK",
  created_at: "2025-12-15 10:30",
  created_by: "张三",
  updated_at: "2026-01-10 14:20",
  updated_by: "李四",
}

// Mock channel mappings (Tab4)
const mockChannelMappings = [
  {
    id: "CM-001",
    channel: "TikTok",
    store: "印尼旗舰店",
    store_id: "STORE-TT-ID-001",
    platform_sku_id: "TT-SKU-12345",
    seller_sku: "SELLER-001-RED-S",
    platform_item_id: "TT-ITEM-001",
    status: "ACTIVE",
    effective_from: "2025-12-18",
    effective_to: null,
    source: "上架任务 WI-PRJ001-019",
  },
  {
    id: "CM-002",
    channel: "Shopee",
    store: "印尼官方店",
    store_id: "STORE-SP-ID-001",
    platform_sku_id: "SP-SKU-67890",
    seller_sku: "SELLER-001-RED-S",
    platform_item_id: "SP-ITEM-001",
    status: "ACTIVE",
    effective_from: "2025-12-20",
    effective_to: null,
    source: "上架任务 WI-PRJ001-020",
  },
  {
    id: "CM-003",
    channel: "Lazada",
    store: "马来西亚店",
    store_id: "STORE-LZ-MY-001",
    platform_sku_id: "LZ-SKU-11111",
    seller_sku: null,
    platform_item_id: "LZ-ITEM-001",
    status: "ACTIVE",
    effective_from: "2025-12-22",
    effective_to: null,
    source: "手动创建",
  },
]

// Mock channel product variants (Tab5)
const mockChannelVariants = [
  {
    id: "CPV-001",
    channel: "TikTok",
    store: "印尼旗舰店",
    channel_product_id: "CP-TT-001",
    channel_product_name: "Floral Dress Indonesia",
    variant_name: "Red-S",
    platform_variant_id: "TT-VAR-001",
    status: "已上架",
    listing_work_item: "WI-PRJ001-019",
    listing_date: "2025-12-18",
  },
  {
    id: "CPV-002",
    channel: "Shopee",
    store: "印尼官方店",
    channel_product_id: "CP-SP-001",
    channel_product_name: "印尼碎花连衣裙",
    variant_name: "红色-S码",
    platform_variant_id: "SP-VAR-001",
    status: "已上架",
    listing_work_item: "WI-PRJ001-020",
    listing_date: "2025-12-20",
  },
]

// Mock legacy/external mappings (Tab6)
const mockCodeMappings = [
  {
    id: "LM-001",
    type: "老系统SKU",
    system: "ERP V1",
    external_code: "OLD-SKU-001-RED-S",
    status: "ACTIVE",
    effective_from: "2025-12-15",
    effective_to: null,
    created_by: "系统迁移",
  },
  {
    id: "LM-002",
    type: "供应商条码",
    system: "供应商A",
    external_code: "SUP-A-12345",
    status: "ACTIVE",
    effective_from: "2025-12-15",
    effective_to: null,
    created_by: "张三",
  },
  {
    id: "LM-003",
    type: "工厂码",
    system: "深圳工厂",
    external_code: "FACTORY-SZ-001",
    status: "EXPIRED",
    effective_from: "2025-11-01",
    effective_to: "2025-12-14",
    created_by: "李四",
  },
]

// Mock logs (Tab7)
const mockLogs = [
  { id: "LOG-001", time: "2026-01-10 14:20", action: "编辑基础信息", operator: "李四", detail: "更新条码" },
  {
    id: "LOG-002",
    time: "2025-12-22 11:30",
    action: "新增渠道映射",
    operator: "系统",
    detail: "Lazada 马来西亚店映射",
  },
  {
    id: "LOG-003",
    time: "2025-12-20 09:15",
    action: "新增渠道映射",
    operator: "系统",
    detail: "Shopee 印尼官方店映射",
  },
  {
    id: "LOG-004",
    time: "2025-12-18 16:40",
    action: "新增渠道映射",
    operator: "系统",
    detail: "TikTok 印尼旗舰店映射",
  },
  { id: "LOG-005", time: "2025-12-15 10:30", action: "创建 SKU", operator: "张三", detail: "从 SPU 批量生成" },
]

export default function SKUDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [listingDrawerOpen, setListingDrawerOpen] = useState(false)
  const [addMappingOpen, setAddMappingOpen] = useState(false)

  const sku = mockSKUDetail

  const handleToggleStatus = () => {
    const newStatus = sku.status === "ACTIVE" ? "停用" : "启用"
    toast({ title: `SKU ${newStatus}成功`, description: `${sku.sku_code} 已${newStatus}` })
  }

  const handleEndMapping = (mapping: (typeof mockChannelMappings)[0]) => {
    toast({ title: "映射已结束", description: `${mapping.channel} ${mapping.store} 的映射已设置结束时间` })
  }

  const getMappingHealthBadge = (health: string) => {
    switch (health) {
      case "OK":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            映射正常
          </Badge>
        )
      case "MISSING":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            缺渠道映射
          </Badge>
        )
      case "CONFLICT":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            映射冲突
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="border-b bg-background sticky top-0 z-10">
            <div className="p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/products/sku")}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  返回列表
                </Button>
              </div>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Package className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold">{sku.sku_code}</h1>
                      <Badge variant={sku.status === "ACTIVE" ? "default" : "secondary"}>
                        {sku.status === "ACTIVE" ? "启用" : "停用"}
                      </Badge>
                      {getMappingHealthBadge(sku.mapping_health)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>
                        规格：{sku.color} / {sku.size} {sku.print && `/ ${sku.print}`}
                      </span>
                      <span>|</span>
                      <span
                        className="text-primary cursor-pointer hover:underline"
                        onClick={() => router.push(`/products/spu/${sku.spu_id}`)}
                      >
                        所属 SPU: {sku.spu_code}
                      </span>
                      <span>|</span>
                      <span>资料版本: {sku.techpack_version}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setEditDrawerOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    编辑
                  </Button>
                  <Button variant="outline" onClick={handleToggleStatus}>
                    <Power className="h-4 w-4 mr-2" />
                    {sku.status === "ACTIVE" ? "停用" : "启用"}
                  </Button>
                  {sku.status === "ACTIVE" && (
                    <Button onClick={() => setListingDrawerOpen(true)}>
                      <Rocket className="h-4 w-4 mr-2" />
                      发起上架
                    </Button>
                  )}
                  {sku.mapping_health === "CONFLICT" && (
                    <Button variant="destructive" onClick={() => router.push("/channels/products/mapping")}>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      解决冲突
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Content */}
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="overview">概览</TabsTrigger>
                <TabsTrigger value="specs">规格与属性</TabsTrigger>
                <TabsTrigger value="techpack">生产资料引用</TabsTrigger>
                <TabsTrigger value="channel-mapping">渠道映射</TabsTrigger>
                <TabsTrigger value="channel-variants">渠道上架</TabsTrigger>
                <TabsTrigger value="code-mapping">编码映射</TabsTrigger>
                <TabsTrigger value="logs">日志</TabsTrigger>
              </TabsList>

              {/* Tab1: 概览 */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  {/* SKU 主信息卡 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">SKU 主信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SKU 编码</span>
                        <span className="font-medium">{sku.sku_code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">状态</span>
                        <Badge variant={sku.status === "ACTIVE" ? "default" : "secondary"}>
                          {sku.status === "ACTIVE" ? "启用" : "停用"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">条码</span>
                        <span className="font-mono">{sku.barcode || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">重量</span>
                        <span>{sku.weight ? `${sku.weight}kg` : "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">体积</span>
                        <span>{sku.volume || "-"}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 所属 SPU 卡 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">所属 SPU</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SPU 编码</span>
                        <span
                          className="font-medium text-primary cursor-pointer hover:underline"
                          onClick={() => router.push(`/products/spu/${sku.spu_id}`)}
                        >
                          {sku.spu_code}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SPU 名称</span>
                        <span>{sku.spu_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">类目</span>
                        <span>裙装 / 连衣裙</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 bg-transparent"
                        onClick={() => router.push(`/products/spu/${sku.spu_id}`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        查看 SPU 详情
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 资料版本卡 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">生产资料版本</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">当前版本</span>
                        <Badge variant="outline">{sku.techpack_version}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">继承自</span>
                        <span>SPU 生效版本</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">版本状态</span>
                        <Badge className="bg-green-100 text-green-700">生效中</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        SKU 默认继承 SPU 的生效资料版本，如需变更请在 SPU 上操作
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 风险提示 */}
                {sku.mapping_health !== "OK" && (
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2 text-yellow-800">
                        <AlertTriangle className="h-5 w-5" />
                        风险提示
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {sku.mapping_health === "MISSING" && (
                        <div className="text-sm text-yellow-800">
                          该 SKU 存在部分渠道未建立映射，可能影响订单追溯。
                          <Button
                            variant="link"
                            className="text-yellow-800 underline p-0 h-auto ml-2"
                            onClick={() => setActiveTab("channel-mapping")}
                          >
                            去添加映射
                          </Button>
                        </div>
                      )}
                      {sku.mapping_health === "CONFLICT" && (
                        <div className="text-sm text-yellow-800">
                          该 SKU 存在映射冲突，请及时处理以避免订单错误。
                          <Button
                            variant="link"
                            className="text-yellow-800 underline p-0 h-auto ml-2"
                            onClick={() => router.push("/channels/products/mapping")}
                          >
                            去解决冲突
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab2: 规格与属性 */}
              <TabsContent value="specs" className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">规格信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">颜色</Label>
                          <div className="font-medium mt-1">{sku.color}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">尺码</Label>
                          <div className="font-medium mt-1">{sku.size}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">花型/色系</Label>
                          <div className="font-medium mt-1">{sku.print || "-"}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">物流属性</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">重量</Label>
                          <div className="font-medium mt-1">{sku.weight ? `${sku.weight}kg` : "-"}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">包装规格</Label>
                          <div className="font-medium mt-1">{sku.volume || "-"}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">装箱数</Label>
                          <div className="font-medium mt-1">20件/箱</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">HS Code</Label>
                          <div className="font-medium mt-1">6204.42</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab3: 生产资料引用 */}
              <TabsContent value="techpack" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">当前生效资料版本摘要</CardTitle>
                    <CardDescription>SKU 继承自 SPU 的生效版本，此处为只读展示</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          BOM 摘要
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between p-2 bg-muted rounded">
                            <span>主面料</span>
                            <span>100% 涤纶雪纺</span>
                          </div>
                          <div className="flex justify-between p-2 bg-muted rounded">
                            <span>里料</span>
                            <span>涤纶内衬</span>
                          </div>
                          <div className="flex justify-between p-2 bg-muted rounded">
                            <span>拉链</span>
                            <span>YKK隐形拉链</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          工艺摘要
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between p-2 bg-muted rounded">
                            <span>关键工序</span>
                            <span>数码印花、包边、装拉链</span>
                          </div>
                          <div className="flex justify-between p-2 bg-muted rounded">
                            <span>缝纫针距</span>
                            <span>3.5针/cm</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        查看尺码表
                      </Button>
                      <Button variant="outline" size="sm">
                        <Layers className="h-4 w-4 mr-2" />
                        查看花型文件
                      </Button>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                      如需变更生产资料，请在 SPU 上创建新版本并发布生效
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab4: 渠道映射 (SKU4) */}
              <TabsContent value="channel-mapping" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">渠道平台 SKU 映射</CardTitle>
                      <CardDescription>按店铺维度管理平台 SKU 与内部 SKU 的映射关系</CardDescription>
                    </div>
                    <Button onClick={() => setAddMappingOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      新增映射
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>渠道</TableHead>
                          <TableHead>店铺</TableHead>
                          <TableHead>平台 SKU ID</TableHead>
                          <TableHead>Seller SKU</TableHead>
                          <TableHead>关联商品</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>生效区间</TableHead>
                          <TableHead>来源</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockChannelMappings.map((mapping) => (
                          <TableRow key={mapping.id}>
                            <TableCell>
                              <Badge variant="outline">{mapping.channel}</Badge>
                            </TableCell>
                            <TableCell>{mapping.store}</TableCell>
                            <TableCell className="font-mono text-sm">{mapping.platform_sku_id}</TableCell>
                            <TableCell className="font-mono text-sm">{mapping.seller_sku || "-"}</TableCell>
                            <TableCell>
                              <span className="text-primary cursor-pointer hover:underline">
                                {mapping.platform_item_id}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={mapping.status === "ACTIVE" ? "default" : "secondary"}>
                                {mapping.status === "ACTIVE" ? "生效" : "已过期"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {mapping.effective_from} ~ {mapping.effective_to || "至今"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{mapping.source}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEndMapping(mapping)}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    结束映射
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push("/channels/products/mapping")}>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    跳转统一映射页
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
              </TabsContent>

              {/* Tab5: 渠道上架/变体引用 */}
              <TabsContent value="channel-variants" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">关联渠道商品变体</CardTitle>
                    <CardDescription>该 SKU 在各渠道店铺的商品变体关联</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>渠道</TableHead>
                          <TableHead>店铺</TableHead>
                          <TableHead>渠道商品</TableHead>
                          <TableHead>变体名称</TableHead>
                          <TableHead>平台变体ID</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>上架工作项</TableHead>
                          <TableHead>上架日期</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockChannelVariants.map((variant) => (
                          <TableRow key={variant.id}>
                            <TableCell>
                              <Badge variant="outline">{variant.channel}</Badge>
                            </TableCell>
                            <TableCell>{variant.store}</TableCell>
                            <TableCell>
                              <div>
                                <div
                                  className="text-primary cursor-pointer hover:underline"
                                  onClick={() => router.push(`/channels/products/${variant.channel_product_id}`)}
                                >
                                  {variant.channel_product_id}
                                </div>
                                <div className="text-xs text-muted-foreground">{variant.channel_product_name}</div>
                              </div>
                            </TableCell>
                            <TableCell>{variant.variant_name}</TableCell>
                            <TableCell className="font-mono text-sm">{variant.platform_variant_id}</TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-700">{variant.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-primary cursor-pointer hover:underline">
                                {variant.listing_work_item}
                              </span>
                            </TableCell>
                            <TableCell>{variant.listing_date}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/channels/products/${variant.channel_product_id}`)}
                              >
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

              {/* Tab6: 编码映射（老系统/外部）*/}
              <TabsContent value="code-mapping" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">老系统/外部编码映射</CardTitle>
                      <CardDescription>管理与老系统 SKU、供应商条码、工厂码等的映射关系</CardDescription>
                    </div>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      新增映射
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>映射类型</TableHead>
                          <TableHead>系统/来源</TableHead>
                          <TableHead>外部编码</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>生效区间</TableHead>
                          <TableHead>创建人</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockCodeMappings.map((mapping) => (
                          <TableRow key={mapping.id}>
                            <TableCell>
                              <Badge variant="outline">{mapping.type}</Badge>
                            </TableCell>
                            <TableCell>{mapping.system}</TableCell>
                            <TableCell className="font-mono">{mapping.external_code}</TableCell>
                            <TableCell>
                              <Badge variant={mapping.status === "ACTIVE" ? "default" : "secondary"}>
                                {mapping.status === "ACTIVE" ? "生效" : "已过期"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {mapping.effective_from} ~ {mapping.effective_to || "至今"}
                            </TableCell>
                            <TableCell>{mapping.created_by}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab7: 日志与附件 */}
              <TabsContent value="logs" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">变更日志</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>时间</TableHead>
                          <TableHead>操作</TableHead>
                          <TableHead>操作人</TableHead>
                          <TableHead>详情</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">{log.time}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.action}</Badge>
                            </TableCell>
                            <TableCell>{log.operator}</TableCell>
                            <TableCell className="text-muted-foreground">{log.detail}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Edit Drawer */}
          <Sheet open={editDrawerOpen} onOpenChange={setEditDrawerOpen}>
            <SheetContent className="w-[500px] sm:max-w-[500px]">
              <SheetHeader>
                <SheetTitle>编辑 SKU</SheetTitle>
                <SheetDescription>修改 SKU 基础信息（规格不可修改）</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-6">
                <div className="space-y-2">
                  <Label>条码</Label>
                  <Input defaultValue={sku.barcode || ""} placeholder="商品条形码" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>重量 (kg)</Label>
                    <Input type="number" defaultValue={sku.weight} step="0.01" />
                  </div>
                  <div className="space-y-2">
                    <Label>包装规格</Label>
                    <Input defaultValue={sku.volume || ""} placeholder="如：30x25x5cm" />
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  规格（颜色/尺码/花型）不可修改，如需调整请联系管理员
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setEditDrawerOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => {
                    toast({ title: "保存成功" })
                    setEditDrawerOpen(false)
                  }}
                >
                  保存
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* Listing Drawer */}
          <Sheet open={listingDrawerOpen} onOpenChange={setListingDrawerOpen}>
            <SheetContent className="w-[500px] sm:max-w-[500px]">
              <SheetHeader>
                <SheetTitle>发起商品上架</SheetTitle>
                <SheetDescription>创建商品上架工作项，将该 SKU 上架到指定渠道店铺</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-6">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium">待上架 SKU</div>
                  <div className="text-sm text-muted-foreground mt-1">{sku.sku_code}</div>
                </div>
                <div className="space-y-2">
                  <Label>目标渠道 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择渠道" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="shopee">Shopee</SelectItem>
                      <SelectItem value="lazada">Lazada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>目标店铺 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择店铺" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id-flagship">印尼旗舰店</SelectItem>
                      <SelectItem value="my-main">马来西亚主店</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>负责人 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择负责人" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zhangsan">张三</SelectItem>
                      <SelectItem value="lisi">李四</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setListingDrawerOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => {
                    toast({ title: "上架工作项已创建" })
                    setListingDrawerOpen(false)
                  }}
                >
                  创建上架任务
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* Add Mapping Dialog */}
          <Dialog open={addMappingOpen} onOpenChange={setAddMappingOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增渠道映射</DialogTitle>
                <DialogDescription>为该 SKU 添加渠道平台 SKU 映射</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>渠道 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择渠道" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="shopee">Shopee</SelectItem>
                      <SelectItem value="lazada">Lazada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>店铺 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择店铺" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id-flagship">印尼旗舰店</SelectItem>
                      <SelectItem value="my-main">马来西亚主店</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>平台 SKU ID *</Label>
                  <Input placeholder="输入平台 SKU ID" />
                </div>
                <div className="space-y-2">
                  <Label>Seller SKU（可选）</Label>
                  <Input placeholder="输入 Seller SKU" />
                </div>
                <div className="space-y-2">
                  <Label>生效开始日期 *</Label>
                  <Input type="date" defaultValue="2026-01-14" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddMappingOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => {
                    toast({ title: "映射添加成功" })
                    setAddMappingOpen(false)
                  }}
                >
                  添加映射
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
