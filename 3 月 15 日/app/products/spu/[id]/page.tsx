"use client"

import type React from "react"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Edit,
  Plus,
  GitBranch,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  Layers,
  Scissors,
  Palette,
  Ruler,
  FileText,
  MoreHorizontal,
  Copy,
  Trash2,
  Eye,
  ExternalLink,
  GitCompare,
  MapPin,
} from "lucide-react"
import { toast } from "sonner"

// Mock SPU详情数据
const mockSPU = {
  id: "SPU-20260101-001",
  code: "SPU-20260101-001",
  name: "印尼风格碎花连衣裙",
  category: "裙装/连衣裙",
  styleTags: ["波西米亚", "碎花", "度假风"],
  priceBand: "¥299-399",
  brand: "HiGood",
  status: "ACTIVE",
  originProjectId: "PRJ-20251216-001",
  originSnapshotId: "SNAP-001",
  effectiveVersionId: "V2.1",
  listingReadiness: { ready: true, reasons: [] },
  mappingHealth: "OK",
  createdAt: "2025-12-20 10:00",
  createdBy: "张三",
  updatedAt: "2026-01-14 10:30",
  updatedBy: "李四",
}

// Mock版本数据
const mockVersions = [
  {
    id: "V2.1",
    code: "V2.1",
    name: "产前版-领口调整",
    status: "EFFECTIVE",
    basedOnVersion: "V2.0",
    changeSummary: "根据试穿反馈调整腰部收省位置，优化领口深度",
    effectiveFrom: "2026-01-10 14:30",
    effectiveTo: null,
    linkedWorkItems: ["WI-PRJ001-010 制版准备", "WI-PRJ001-015 改版任务"],
    createdBy: "王版师",
    createdAt: "2026-01-08 10:00",
    approvedBy: "李主管",
    approvedAt: "2026-01-10 14:30",
  },
  {
    id: "V2.0",
    code: "V2.0",
    name: "首单版-袖笼优化",
    status: "HISTORICAL",
    basedOnVersion: "V1.0",
    changeSummary: "优化袖笼弧线，调整领口深度",
    effectiveFrom: "2025-12-28 10:00",
    effectiveTo: "2026-01-10 14:30",
    linkedWorkItems: ["WI-PRJ001-008 首单样衣打样"],
    createdBy: "王版师",
    createdAt: "2025-12-25 15:00",
    approvedBy: "李主管",
    approvedAt: "2025-12-28 10:00",
  },
  {
    id: "V1.0",
    code: "V1.0",
    name: "初版",
    status: "HISTORICAL",
    basedOnVersion: null,
    changeSummary: "从商品项目PRJ-20251216-001继承创建",
    effectiveFrom: "2025-12-20 10:00",
    effectiveTo: "2025-12-28 10:00",
    linkedWorkItems: ["WI-PRJ001-005 制版任务"],
    createdBy: "张三",
    createdAt: "2025-12-20 10:00",
    approvedBy: "李主管",
    approvedAt: "2025-12-20 10:00",
  },
  {
    id: "V0.1",
    code: "V0.1",
    name: "测试版-已废弃",
    status: "DEPRECATED",
    basedOnVersion: null,
    changeSummary: "测试版本，已废弃",
    effectiveFrom: null,
    effectiveTo: null,
    linkedWorkItems: [],
    createdBy: "测试",
    createdAt: "2025-12-18 10:00",
    approvedBy: null,
    approvedAt: null,
  },
]

// Mock SKU数据
const mockSKUs = [
  {
    id: "SKU-001",
    code: "SKU-001-RD-S",
    color: "红色",
    size: "S",
    print: "碎花A",
    barcode: "6901234567890",
    status: "ACTIVE",
    platformMappingHealth: "OK",
    isListed: true,
  },
  {
    id: "SKU-002",
    code: "SKU-001-RD-M",
    color: "红色",
    size: "M",
    print: "碎花A",
    barcode: "6901234567891",
    status: "ACTIVE",
    platformMappingHealth: "OK",
    isListed: true,
  },
  {
    id: "SKU-003",
    code: "SKU-001-RD-L",
    color: "红色",
    size: "L",
    print: "碎花A",
    barcode: "6901234567892",
    status: "ACTIVE",
    platformMappingHealth: "MISSING",
    isListed: false,
  },
  {
    id: "SKU-004",
    code: "SKU-001-BL-S",
    color: "蓝色",
    size: "S",
    print: "碎花B",
    barcode: "6901234567893",
    status: "ACTIVE",
    platformMappingHealth: "OK",
    isListed: true,
  },
  {
    id: "SKU-005",
    code: "SKU-001-BL-M",
    color: "蓝色",
    size: "M",
    print: "碎花B",
    barcode: "6901234567894",
    status: "ACTIVE",
    platformMappingHealth: "OK",
    isListed: true,
  },
  {
    id: "SKU-006",
    code: "SKU-001-BL-L",
    color: "蓝色",
    size: "L",
    print: "碎花B",
    barcode: "6901234567895",
    status: "ACTIVE",
    platformMappingHealth: "CONFLICT",
    isListed: false,
  },
  {
    id: "SKU-007",
    code: "SKU-001-GR-S",
    color: "绿色",
    size: "S",
    print: "碎花C",
    barcode: "6901234567896",
    status: "ACTIVE",
    platformMappingHealth: "OK",
    isListed: true,
  },
  {
    id: "SKU-008",
    code: "SKU-001-GR-M",
    color: "绿色",
    size: "M",
    print: "碎花C",
    barcode: "6901234567897",
    status: "ACTIVE",
    platformMappingHealth: "OK",
    isListed: true,
  },
  {
    id: "SKU-009",
    code: "SKU-001-GR-L",
    color: "绿色",
    size: "L",
    print: "碎花C",
    barcode: "6901234567898",
    status: "INACTIVE",
    platformMappingHealth: "OK",
    isListed: false,
  },
  {
    id: "SKU-010",
    code: "SKU-001-YL-S",
    color: "黄色",
    size: "S",
    print: "碎花D",
    barcode: "6901234567899",
    status: "ACTIVE",
    platformMappingHealth: "OK",
    isListed: true,
  },
  {
    id: "SKU-011",
    code: "SKU-001-YL-M",
    color: "黄色",
    size: "M",
    print: "碎花D",
    barcode: "6901234567900",
    status: "ACTIVE",
    platformMappingHealth: "OK",
    isListed: true,
  },
  {
    id: "SKU-012",
    code: "SKU-001-YL-L",
    color: "黄色",
    size: "L",
    print: "碎花D",
    barcode: "6901234567901",
    status: "ACTIVE",
    platformMappingHealth: "OK",
    isListed: false,
  },
]

// Mock映射数据
const mockMappings = [
  {
    id: "MAP-001",
    type: "LEGACY_SPU",
    system: "ERP-A",
    sourceCode: "SKU10086",
    targetSpu: "SPU-20260101-001",
    effectiveFrom: "2025-12-20",
    effectiveTo: null,
    status: "ACTIVE",
    remark: "初始映射",
  },
  {
    id: "MAP-002",
    type: "EXTERNAL_CODE",
    system: "供应商",
    sourceCode: "SUP-DR-001",
    targetSpu: "SPU-20260101-001",
    effectiveFrom: "2025-12-25",
    effectiveTo: null,
    status: "ACTIVE",
    remark: "供应商款号",
  },
  {
    id: "MAP-003",
    type: "CHANNEL_ITEM",
    system: "TikTok-ID店",
    sourceCode: "TT-1234567890",
    targetSpu: "SPU-20260101-001",
    effectiveFrom: "2026-01-05",
    effectiveTo: null,
    status: "ACTIVE",
    remark: "TikTok平台商品",
  },
]

// Mock渠道上架数据
const mockListings = [
  {
    id: "LIST-001",
    channel: "TikTok",
    store: "ID-主店",
    status: "在售",
    workItemId: "WI-LISTING-001",
    listedAt: "2026-01-05",
    skuCount: 8,
  },
  {
    id: "LIST-002",
    channel: "Shopee",
    store: "ID-旗舰店",
    status: "在售",
    workItemId: "WI-LISTING-002",
    listedAt: "2026-01-08",
    skuCount: 6,
  },
  {
    id: "LIST-003",
    channel: "TikTok",
    store: "PH-分店",
    status: "待上架",
    workItemId: "WI-LISTING-003",
    listedAt: null,
    skuCount: 0,
  },
]

// 状态Badge
function VersionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "草稿", className: "bg-gray-100 text-gray-700" },
    EFFECTIVE: { label: "生效中", className: "bg-green-100 text-green-700" },
    HISTORICAL: { label: "历史", className: "bg-blue-100 text-blue-700" },
    DEPRECATED: { label: "已废弃", className: "bg-red-100 text-red-700" },
  }
  const { label, className } = config[status] || { label: status, className: "" }
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}

function MappingHealthBadge({ health }: { health: string }) {
  const config: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    OK: { label: "健康", icon: <CheckCircle2 className="h-3 w-3" />, className: "bg-green-100 text-green-700" },
    MISSING: {
      label: "缺映射",
      icon: <AlertTriangle className="h-3 w-3" />,
      className: "bg-yellow-100 text-yellow-700",
    },
    CONFLICT: { label: "冲突", icon: <XCircle className="h-3 w-3" />, className: "bg-red-100 text-red-700" },
  }
  const { label, icon, className } = config[health] || { label: health, icon: null, className: "" }
  return (
    <Badge variant="outline" className={className}>
      {icon}
      <span className="ml-1">{label}</span>
    </Badge>
  )
}

export default function SPUDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedVersion, setSelectedVersion] = useState("V2.1")
  const [techPackTab, setTechPackTab] = useState("pattern")
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareVersions, setCompareVersions] = useState<[string, string]>(["V2.1", "V2.0"])
  const [createVersionOpen, setCreateVersionOpen] = useState(false)
  const [skuGenerateOpen, setSkuGenerateOpen] = useState(false)
  const [listingOpen, setListingOpen] = useState(false)

  const currentVersion = mockVersions.find((v) => v.id === selectedVersion)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b p-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/products/spu")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold">{mockSPU.name}</h1>
                  <Badge variant="outline">{mockSPU.code}</Badge>
                  <MappingHealthBadge health={mockSPU.mappingHealth} />
                  {mockSPU.listingReadiness.ready ? (
                    <Badge className="bg-green-100 text-green-700">上架就绪</Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-700">未就绪</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span>{mockSPU.category}</span>
                  <span>•</span>
                  <span>{mockSPU.priceBand}</span>
                  <span>•</span>
                  <span>
                    来源：
                    <Button
                      variant="link"
                      className="p-0 h-auto text-sm"
                      onClick={() => router.push(`/projects/${mockSPU.originProjectId}`)}
                    >
                      {mockSPU.originProjectId}
                    </Button>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => toast.info("编辑基础信息")}>
                  <Edit className="h-4 w-4 mr-2" />
                  编辑
                </Button>
                <Button variant="outline" onClick={() => setCreateVersionOpen(true)}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  新建版本
                </Button>
                <Button onClick={() => setListingOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  发起上架
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="overview">概览</TabsTrigger>
                <TabsTrigger value="techpack">生产资料</TabsTrigger>
                <TabsTrigger value="versions">版本管理</TabsTrigger>
                <TabsTrigger value="sku">SKU档案</TabsTrigger>
                <TabsTrigger value="listing">渠道上架</TabsTrigger>
                <TabsTrigger value="mapping">编码映射</TabsTrigger>
                <TabsTrigger value="logs">日志</TabsTrigger>
              </TabsList>

              {/* Tab1: 概览 */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  {/* SPU主属性卡 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">SPU 主属性</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">类目</span>
                        <span>{mockSPU.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">品牌</span>
                        <span>{mockSPU.brand}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">目标价带</span>
                        <span>{mockSPU.priceBand}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground">风格标签</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {mockSPU.styleTags.map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">创建</span>
                        <span>
                          {mockSPU.createdBy} {mockSPU.createdAt}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">更新</span>
                        <span>
                          {mockSPU.updatedBy} {mockSPU.updatedAt}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 当前生效版本卡 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">当前生效版本</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {mockVersions.find((v) => v.status === "EFFECTIVE") ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-700">
                              {mockVersions.find((v) => v.status === "EFFECTIVE")?.code}
                            </Badge>
                            <span className="font-medium">
                              {mockVersions.find((v) => v.status === "EFFECTIVE")?.name}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {mockVersions.find((v) => v.status === "EFFECTIVE")?.changeSummary}
                          </p>
                          <Separator />
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">生效时间</span>
                              <span>{mockVersions.find((v) => v.status === "EFFECTIVE")?.effectiveFrom}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">关联工作项</span>
                              <span>
                                {mockVersions.find((v) => v.status === "EFFECTIVE")?.linkedWorkItems.length}个
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full bg-transparent"
                            onClick={() => setActiveTab("versions")}
                          >
                            查看版本详情
                          </Button>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                          <p className="text-muted-foreground">暂无生效版本</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 bg-transparent"
                            onClick={() => setCreateVersionOpen(true)}
                          >
                            创建版本
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 上架概览卡 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">上架概览</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="text-2xl font-bold">
                            {mockListings.filter((l) => l.status === "在售").length}
                          </div>
                          <div className="text-xs text-muted-foreground">在售店铺</div>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="text-2xl font-bold">{mockSKUs.filter((s) => s.isListed).length}</div>
                          <div className="text-xs text-muted-foreground">在售SKU</div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        {mockListings.slice(0, 3).map((listing) => (
                          <div key={listing.id} className="flex justify-between items-center text-sm">
                            <span>
                              {listing.channel} {listing.store}
                            </span>
                            <Badge variant={listing.status === "在售" ? "default" : "outline"}>{listing.status}</Badge>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-transparent"
                        onClick={() => setActiveTab("listing")}
                      >
                        查看全部
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* 风险提示 */}
                {(mockSKUs.some((s) => s.platformMappingHealth !== "OK") ||
                  !mockVersions.some((v) => v.status === "EFFECTIVE")) && (
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        风险提示
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        {!mockVersions.some((v) => v.status === "EFFECTIVE") && (
                          <li className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span>无生效版本，无法用于生产/上架</span>
                          </li>
                        )}
                        {mockSKUs.some((s) => s.platformMappingHealth === "MISSING") && (
                          <li className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            <span>
                              {mockSKUs.filter((s) => s.platformMappingHealth === "MISSING").length}个SKU缺少平台映射
                            </span>
                          </li>
                        )}
                        {mockSKUs.some((s) => s.platformMappingHealth === "CONFLICT") && (
                          <li className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span>
                              {mockSKUs.filter((s) => s.platformMappingHealth === "CONFLICT").length}个SKU映射冲突
                            </span>
                          </li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab2: 生产资料 */}
              <TabsContent value="techpack" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Label>选择版本：</Label>
                    <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mockVersions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.code} - {v.name} (
                            {v.status === "EFFECTIVE"
                              ? "生效中"
                              : v.status === "DRAFT"
                                ? "草稿"
                                : v.status === "HISTORICAL"
                                  ? "历史"
                                  : "已废弃"}
                            )
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <VersionStatusBadge status={currentVersion?.status || ""} />
                  </div>
                  {currentVersion?.status === "DRAFT" && (
                    <Button onClick={() => toast.success("版本已发布生效")}>发布生效</Button>
                  )}
                  {currentVersion?.status === "EFFECTIVE" && (
                    <Button variant="outline" onClick={() => setCreateVersionOpen(true)}>
                      复制为新版本
                    </Button>
                  )}
                </div>

                {/* 生产资料子Tab */}
                <Tabs value={techPackTab} onValueChange={setTechPackTab}>
                  <TabsList>
                    <TabsTrigger value="pattern">
                      <Scissors className="h-4 w-4 mr-1" />
                      制版
                    </TabsTrigger>
                    <TabsTrigger value="process">
                      <FileText className="h-4 w-4 mr-1" />
                      工艺
                    </TabsTrigger>
                    <TabsTrigger value="size">
                      <Ruler className="h-4 w-4 mr-1" />
                      尺码
                    </TabsTrigger>
                    <TabsTrigger value="bom">
                      <Layers className="h-4 w-4 mr-1" />
                      BOM
                    </TabsTrigger>
                    <TabsTrigger value="print">
                      <Palette className="h-4 w-4 mr-1" />
                      花型
                    </TabsTrigger>
                    <TabsTrigger value="attachments">
                      <Package className="h-4 w-4 mr-1" />
                      附件
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pattern" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>制版信息</CardTitle>
                        <CardDescription>纸样文件、版片列表、版型说明</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">版型类型</Label>
                            <p>A字裙</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">版片数量</Label>
                            <p>12片</p>
                          </div>
                        </div>
                        <Separator />
                        <div>
                          <Label className="text-muted-foreground">版型说明</Label>
                          <p className="mt-1">V领设计，腰部收省，裙摆自然A字展开。领口深度根据V2.1调整为8cm。</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">纸样文件</Label>
                          <div className="mt-2 flex gap-2">
                            <Button variant="outline" size="sm">
                              <FileText className="h-4 w-4 mr-1" />
                              纸样图.pdf
                            </Button>
                            <Button variant="outline" size="sm">
                              <FileText className="h-4 w-4 mr-1" />
                              版片明细.xlsx
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="process" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>工艺信息</CardTitle>
                        <CardDescription>工艺路线、工序列表、质检点</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>工序号</TableHead>
                              <TableHead>工序名称</TableHead>
                              <TableHead>工时(分钟)</TableHead>
                              <TableHead>难度</TableHead>
                              <TableHead>质检点</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>01</TableCell>
                              <TableCell>裁片</TableCell>
                              <TableCell>5</TableCell>
                              <TableCell>普通</TableCell>
                              <TableCell>尺寸校验</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>02</TableCell>
                              <TableCell>缝合侧缝</TableCell>
                              <TableCell>8</TableCell>
                              <TableCell>普通</TableCell>
                              <TableCell>-</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>03</TableCell>
                              <TableCell>领口处理</TableCell>
                              <TableCell>12</TableCell>
                              <TableCell>较难</TableCell>
                              <TableCell>领口深度、对称性</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>04</TableCell>
                              <TableCell>袖笼处理</TableCell>
                              <TableCell>10</TableCell>
                              <TableCell>较难</TableCell>
                              <TableCell>弧线流畅度</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>05</TableCell>
                              <TableCell>下摆锁边</TableCell>
                              <TableCell>6</TableCell>
                              <TableCell>普通</TableCell>
                              <TableCell>-</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="size" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>尺码信息</CardTitle>
                        <CardDescription>尺码组、尺码表、放码规则</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>部位</TableHead>
                              <TableHead className="text-center">S</TableHead>
                              <TableHead className="text-center">M</TableHead>
                              <TableHead className="text-center">L</TableHead>
                              <TableHead className="text-center">XL</TableHead>
                              <TableHead>放码档差</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>胸围</TableCell>
                              <TableCell className="text-center">86</TableCell>
                              <TableCell className="text-center">90</TableCell>
                              <TableCell className="text-center">94</TableCell>
                              <TableCell className="text-center">98</TableCell>
                              <TableCell>4cm</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>腰围</TableCell>
                              <TableCell className="text-center">68</TableCell>
                              <TableCell className="text-center">72</TableCell>
                              <TableCell className="text-center">76</TableCell>
                              <TableCell className="text-center">80</TableCell>
                              <TableCell>4cm</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>裙长</TableCell>
                              <TableCell className="text-center">95</TableCell>
                              <TableCell className="text-center">97</TableCell>
                              <TableCell className="text-center">99</TableCell>
                              <TableCell className="text-center">101</TableCell>
                              <TableCell>2cm</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>肩宽</TableCell>
                              <TableCell className="text-center">36</TableCell>
                              <TableCell className="text-center">38</TableCell>
                              <TableCell className="text-center">40</TableCell>
                              <TableCell className="text-center">42</TableCell>
                              <TableCell>2cm</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="bom" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>BOM 物料清单</CardTitle>
                        <CardDescription>面料、辅料、包装等清单</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>物料类型</TableHead>
                              <TableHead>物料名称</TableHead>
                              <TableHead>规格</TableHead>
                              <TableHead>单耗</TableHead>
                              <TableHead>损耗率</TableHead>
                              <TableHead>供应商</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>
                                <Badge variant="outline">面料</Badge>
                              </TableCell>
                              <TableCell>印花雪纺</TableCell>
                              <TableCell>150cm幅宽</TableCell>
                              <TableCell>1.8m</TableCell>
                              <TableCell>5%</TableCell>
                              <TableCell>绍兴XX面料</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>
                                <Badge variant="outline">里布</Badge>
                              </TableCell>
                              <TableCell>涤纶里布</TableCell>
                              <TableCell>150cm幅宽</TableCell>
                              <TableCell>1.5m</TableCell>
                              <TableCell>3%</TableCell>
                              <TableCell>绍兴XX面料</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>
                                <Badge variant="outline">辅料</Badge>
                              </TableCell>
                              <TableCell>隐形拉链</TableCell>
                              <TableCell>50cm</TableCell>
                              <TableCell>1条</TableCell>
                              <TableCell>1%</TableCell>
                              <TableCell>义乌XX辅料</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>
                                <Badge variant="outline">辅料</Badge>
                              </TableCell>
                              <TableCell>吊牌</TableCell>
                              <TableCell>标准</TableCell>
                              <TableCell>1套</TableCell>
                              <TableCell>2%</TableCell>
                              <TableCell>杭州XX印刷</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="print" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>花型信息</CardTitle>
                        <CardDescription>花型文件、配色方案、色卡</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                          {["碎花A-红", "碎花B-蓝", "碎花C-绿", "碎花D-黄"].map((name, i) => (
                            <Card key={i}>
                              <CardContent className="p-4">
                                <div className="aspect-square bg-gradient-to-br from-pink-100 to-pink-200 rounded-lg mb-2 flex items-center justify-center">
                                  <Palette className="h-8 w-8 text-pink-400" />
                                </div>
                                <p className="text-sm font-medium text-center">{name}</p>
                                <p className="text-xs text-muted-foreground text-center">全款适用</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="attachments" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>附件管理</CardTitle>
                        <CardDescription>版本相关的所有附件</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>文件名</TableHead>
                              <TableHead>类型</TableHead>
                              <TableHead>大小</TableHead>
                              <TableHead>上传时间</TableHead>
                              <TableHead>上传人</TableHead>
                              <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>纸样图_V2.1.pdf</TableCell>
                              <TableCell>制版</TableCell>
                              <TableCell>2.5MB</TableCell>
                              <TableCell>2026-01-08</TableCell>
                              <TableCell>王版师</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  下载
                                </Button>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>工艺单.pdf</TableCell>
                              <TableCell>工艺</TableCell>
                              <TableCell>1.2MB</TableCell>
                              <TableCell>2026-01-08</TableCell>
                              <TableCell>王版师</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  下载
                                </Button>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>花型源文件.ai</TableCell>
                              <TableCell>花型</TableCell>
                              <TableCell>15MB</TableCell>
                              <TableCell>2026-01-05</TableCell>
                              <TableCell>花型设计师</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  下载
                                </Button>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* Tab3: 版本管理 */}
              <TabsContent value="versions" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">版本列表</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setCompareOpen(true)}>
                      <GitCompare className="h-4 w-4 mr-2" />
                      版本对比
                    </Button>
                    <Button onClick={() => setCreateVersionOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      新建版本
                    </Button>
                  </div>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>版本号</TableHead>
                          <TableHead>版本名称</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>生效区间</TableHead>
                          <TableHead>变更摘要</TableHead>
                          <TableHead>关联工作项</TableHead>
                          <TableHead>创建人</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockVersions.map((version) => (
                          <TableRow key={version.id}>
                            <TableCell className="font-medium">{version.code}</TableCell>
                            <TableCell>{version.name}</TableCell>
                            <TableCell>
                              <VersionStatusBadge status={version.status} />
                            </TableCell>
                            <TableCell className="text-sm">
                              {version.effectiveFrom ? (
                                <div>
                                  <div>{version.effectiveFrom}</div>
                                  {version.effectiveTo && (
                                    <div className="text-muted-foreground">至 {version.effectiveTo}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{version.changeSummary}</TableCell>
                            <TableCell>{version.linkedWorkItems.length}个</TableCell>
                            <TableCell>{version.createdBy}</TableCell>
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
                                      setSelectedVersion(version.id)
                                      setActiveTab("techpack")
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    查看内容
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toast.info("复制为新版本")}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    复制版本
                                  </DropdownMenuItem>
                                  {version.status === "DRAFT" && (
                                    <DropdownMenuItem onClick={() => toast.success("版本已发布生效")}>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      发布生效
                                    </DropdownMenuItem>
                                  )}
                                  {version.status === "HISTORICAL" && (
                                    <DropdownMenuItem onClick={() => toast.success("版本已回滚为生效")}>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      回滚为生效
                                    </DropdownMenuItem>
                                  )}
                                  {(version.status === "DRAFT" || version.status === "HISTORICAL") && (
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => toast.success("版本已废弃")}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      废弃
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

              {/* Tab4: SKU档案 */}
              <TabsContent value="sku" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="font-medium">SKU 列表</h3>
                    <Badge variant="outline">{mockSKUs.length}个SKU</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSkuGenerateOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      批量生成
                    </Button>
                    <Button variant="outline" onClick={() => router.push("/channels/products/mapping")}>
                      <MapPin className="h-4 w-4 mr-2" />
                      修复映射
                    </Button>
                  </div>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU编码</TableHead>
                          <TableHead>颜色</TableHead>
                          <TableHead>尺码</TableHead>
                          <TableHead>花型/色系</TableHead>
                          <TableHead>条码</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>平台映射</TableHead>
                          <TableHead>是否上架</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockSKUs.map((sku) => (
                          <TableRow key={sku.id}>
                            <TableCell className="font-medium">{sku.code}</TableCell>
                            <TableCell>{sku.color}</TableCell>
                            <TableCell>{sku.size}</TableCell>
                            <TableCell>{sku.print}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{sku.barcode}</TableCell>
                            <TableCell>
                              <Badge variant={sku.status === "ACTIVE" ? "default" : "secondary"}>
                                {sku.status === "ACTIVE" ? "启用" : "停用"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <MappingHealthBadge health={sku.platformMappingHealth} />
                            </TableCell>
                            <TableCell>
                              {sku.isListed ? (
                                <Badge className="bg-green-100 text-green-700">已上架</Badge>
                              ) : (
                                <Badge variant="outline">未上架</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => toast.info("编辑SKU")}>
                                编辑
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab5: 渠道上架 */}
              <TabsContent value="listing" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">渠道上架记录</h3>
                  <Button onClick={() => setListingOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    发起上架
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>渠道</TableHead>
                          <TableHead>店铺</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>上架工作项</TableHead>
                          <TableHead>上架时间</TableHead>
                          <TableHead>SKU数量</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockListings.map((listing) => (
                          <TableRow key={listing.id}>
                            <TableCell>{listing.channel}</TableCell>
                            <TableCell>{listing.store}</TableCell>
                            <TableCell>
                              <Badge variant={listing.status === "在售" ? "default" : "outline"}>
                                {listing.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="link"
                                className="p-0 h-auto"
                                onClick={() =>
                                  router.push(`/projects/prj_20251216_001/work-items/${listing.workItemId}`)
                                }
                              >
                                {listing.workItemId}
                              </Button>
                            </TableCell>
                            <TableCell>{listing.listedAt || "-"}</TableCell>
                            <TableCell>{listing.skuCount}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/channels/products/${listing.id}`)}
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

              {/* Tab6: 编码映射 */}
              <TabsContent value="mapping" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">编码映射管理</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push("/channels/products/mapping")}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      统一映射管理
                    </Button>
                    <Button onClick={() => toast.info("新增映射")}>
                      <Plus className="h-4 w-4 mr-2" />
                      新增映射
                    </Button>
                  </div>
                </div>

                {/* 老系统映射 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">老系统 SPU 映射</CardTitle>
                    <CardDescription>与ERP/老系统的SPU编码映射</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>系统</TableHead>
                          <TableHead>源编码</TableHead>
                          <TableHead>生效起</TableHead>
                          <TableHead>生效止</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>备注</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockMappings
                          .filter((m) => m.type === "LEGACY_SPU")
                          .map((mapping) => (
                            <TableRow key={mapping.id}>
                              <TableCell>{mapping.system}</TableCell>
                              <TableCell className="font-medium">{mapping.sourceCode}</TableCell>
                              <TableCell>{mapping.effectiveFrom}</TableCell>
                              <TableCell>{mapping.effectiveTo || "-"}</TableCell>
                              <TableCell>
                                <Badge variant={mapping.status === "ACTIVE" ? "default" : "secondary"}>
                                  {mapping.status === "ACTIVE" ? "生效" : mapping.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{mapping.remark}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => toast.info("结束映射")}>
                                  结束
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* 外部编码映射 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">外部/供应商编码映射</CardTitle>
                    <CardDescription>供应商款号、工厂版号等</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>来源</TableHead>
                          <TableHead>编码</TableHead>
                          <TableHead>生效起</TableHead>
                          <TableHead>生效止</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>备注</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockMappings
                          .filter((m) => m.type === "EXTERNAL_CODE")
                          .map((mapping) => (
                            <TableRow key={mapping.id}>
                              <TableCell>{mapping.system}</TableCell>
                              <TableCell className="font-medium">{mapping.sourceCode}</TableCell>
                              <TableCell>{mapping.effectiveFrom}</TableCell>
                              <TableCell>{mapping.effectiveTo || "-"}</TableCell>
                              <TableCell>
                                <Badge variant={mapping.status === "ACTIVE" ? "default" : "secondary"}>
                                  {mapping.status === "ACTIVE" ? "生效" : mapping.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{mapping.remark}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => toast.info("结束映射")}>
                                  结束
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* 渠道映射 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">渠道 Item 映射</CardTitle>
                    <CardDescription>平台商品与SPU的映射关系（只读，管理请跳转渠道商品）</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>渠道/店铺</TableHead>
                          <TableHead>平台商品ID</TableHead>
                          <TableHead>生效起</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockMappings
                          .filter((m) => m.type === "CHANNEL_ITEM")
                          .map((mapping) => (
                            <TableRow key={mapping.id}>
                              <TableCell>{mapping.system}</TableCell>
                              <TableCell className="font-medium">{mapping.sourceCode}</TableCell>
                              <TableCell>{mapping.effectiveFrom}</TableCell>
                              <TableCell>
                                <Badge variant="default">生效</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => router.push("/channels/products")}>
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

              {/* Tab7: 日志 */}
              <TabsContent value="logs" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">变更日志</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { time: "2026-01-14 10:30", user: "李四", action: "更新基础信息", detail: "修改风格标签" },
                        { time: "2026-01-10 14:30", user: "李主管", action: "发布版本", detail: "V2.1 发布为生效版本" },
                        { time: "2026-01-08 10:00", user: "王版师", action: "创建版本", detail: "创建 V2.1 草稿" },
                        { time: "2026-01-05", user: "系统", action: "渠道上架", detail: "TikTok-ID店 上架完成" },
                        { time: "2025-12-28 10:00", user: "李主管", action: "发布版本", detail: "V2.0 发布为生效版本" },
                        {
                          time: "2025-12-20 10:00",
                          user: "张三",
                          action: "创建SPU",
                          detail: "从项目PRJ-20251216-001生成",
                        },
                      ].map((log, i) => (
                        <div key={i} className="flex items-start gap-4 pb-4 border-b last:border-0">
                          <div className="w-[140px] text-sm text-muted-foreground">{log.time}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{log.user}</span>
                              <Badge variant="outline">{log.action}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{log.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* SPU5: 版本对比弹窗 */}
          <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>版本对比</DialogTitle>
                <DialogDescription>对比两个版本之间的差异</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>版本A</Label>
                    <Select
                      value={compareVersions[0]}
                      onValueChange={(v) => setCompareVersions([v, compareVersions[1]])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mockVersions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.code} - {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>版本B</Label>
                    <Select
                      value={compareVersions[1]}
                      onValueChange={(v) => setCompareVersions([compareVersions[0], v])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mockVersions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.code} - {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">差异列表</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>模块</TableHead>
                          <TableHead>字段</TableHead>
                          <TableHead>{compareVersions[0]}</TableHead>
                          <TableHead>{compareVersions[1]}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>制版</TableCell>
                          <TableCell>领口深度</TableCell>
                          <TableCell className="bg-green-50">8cm</TableCell>
                          <TableCell className="bg-red-50">7cm</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>制版</TableCell>
                          <TableCell>腰部收省</TableCell>
                          <TableCell className="bg-green-50">调整位置</TableCell>
                          <TableCell className="bg-red-50">原位置</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>工艺</TableCell>
                          <TableCell>领口工时</TableCell>
                          <TableCell className="bg-green-50">12分钟</TableCell>
                          <TableCell className="bg-red-50">10分钟</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCompareOpen(false)}>
                  关闭
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 新建版本抽屉 */}
          <Sheet open={createVersionOpen} onOpenChange={setCreateVersionOpen}>
            <SheetContent className="w-[500px] sm:max-w-[500px]">
              <SheetHeader>
                <SheetTitle>新建生产资料版本</SheetTitle>
                <SheetDescription>从现有版本复制或创建空白版本</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-6">
                <div className="space-y-2">
                  <Label>基于版本</Label>
                  <Select defaultValue="V2.1">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">空白版本</SelectItem>
                      {mockVersions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.code} - {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>版本名称 *</Label>
                  <Input placeholder="如：改版-袖型调整" />
                </div>
                <div className="space-y-2">
                  <Label>变更摘要 *</Label>
                  <Textarea placeholder="描述本次版本的主要变更内容" />
                </div>
                <div className="space-y-2">
                  <Label>关联工作项</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="选择关联的工作项" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wi1">WI-PRJ001-020 改版任务</SelectItem>
                      <SelectItem value="wi2">WI-PRJ001-021 制版任务</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setCreateVersionOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => {
                    toast.success("版本创建成功")
                    setCreateVersionOpen(false)
                  }}
                >
                  创建草稿
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* SKU批量生成弹窗 */}
          <Dialog open={skuGenerateOpen} onOpenChange={setSkuGenerateOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>批量生成 SKU</DialogTitle>
                <DialogDescription>根据颜色、尺码、花型组合生成SKU</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>颜色（多选）</Label>
                  <div className="flex gap-2 flex-wrap">
                    {["红色", "蓝色", "绿色", "黄色", "黑色", "白色"].map((color) => (
                      <div key={color} className="flex items-center gap-1">
                        <Checkbox
                          id={`color-${color}`}
                          defaultChecked={["红色", "蓝色", "绿色", "黄色"].includes(color)}
                        />
                        <Label htmlFor={`color-${color}`} className="text-sm">
                          {color}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>尺码（多选）</Label>
                  <div className="flex gap-2 flex-wrap">
                    {["S", "M", "L", "XL", "XXL"].map((size) => (
                      <div key={size} className="flex items-center gap-1">
                        <Checkbox id={`size-${size}`} defaultChecked={["S", "M", "L"].includes(size)} />
                        <Label htmlFor={`size-${size}`} className="text-sm">
                          {size}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    预计生成：<strong>4色 × 3码 = 12个SKU</strong>
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSkuGenerateOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => {
                    toast.success("SKU生成成功")
                    setSkuGenerateOpen(false)
                  }}
                >
                  生成
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 发起上架抽屉 */}
          <Sheet open={listingOpen} onOpenChange={setListingOpen}>
            <SheetContent className="w-[500px] sm:max-w-[500px]">
              <SheetHeader>
                <SheetTitle>发起商品上架</SheetTitle>
                <SheetDescription>创建"商品上架"工作项，预填SPU信息</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-6">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium">绑定SPU</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {mockSPU.name}（{mockSPU.code}）
                  </div>
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
                      <SelectItem value="id-main">ID-主店</SelectItem>
                      <SelectItem value="id-flagship">ID-旗舰店</SelectItem>
                      <SelectItem value="ph-main">PH-分店</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>上架SKU</Label>
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">选择要上架的SKU变体</span>
                      <Button variant="link" size="sm" className="h-auto p-0">
                        全选
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {mockSKUs.filter((s) => s.status === "ACTIVE").length}个可用SKU
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>负责人</Label>
                  <Select defaultValue="current">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">当前用户</SelectItem>
                      <SelectItem value="zhangsan">张三</SelectItem>
                      <SelectItem value="lisi">李四</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setListingOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => {
                    toast.success("上架工作项已创建")
                    setListingOpen(false)
                  }}
                >
                  创建上架工作项
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </main>
      </div>
    </div>
  )
}
