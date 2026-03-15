"use client"

import type React from "react"

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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Search,
  Plus,
  Upload,
  Link2,
  Eye,
  GitBranch,
  MapPin,
  MoreHorizontal,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

// Mock SPU数据
const mockSPUs = [
  {
    id: "SPU-20260101-001",
    code: "SPU-20260101-001",
    name: "印尼风格碎花连衣裙",
    category: "裙装/连衣裙",
    styleTags: ["波西米亚", "碎花", "度假风"],
    priceBand: "¥299-399",
    status: "ACTIVE",
    effectiveVersion: { code: "V2.1", effectiveAt: "2026-01-10" },
    skuCount: 12,
    mappingHealth: "OK",
    legacyMapping: "ERP-A: SKU10086",
    channelCount: 3,
    onSaleCount: 8,
    lastListingTime: "2026-01-12",
    originProject: "PRJ-20251216-001",
    updatedAt: "2026-01-14 10:30",
  },
  {
    id: "SPU-20260102-002",
    code: "SPU-20260102-002",
    name: "复古格纹西装外套",
    category: "上装/外套",
    styleTags: ["复古", "格纹", "通勤"],
    priceBand: "¥499-699",
    status: "ACTIVE",
    effectiveVersion: { code: "V1.0", effectiveAt: "2026-01-05" },
    skuCount: 8,
    mappingHealth: "MISSING",
    legacyMapping: null,
    channelCount: 2,
    onSaleCount: 4,
    lastListingTime: "2026-01-08",
    originProject: "PRJ-20251220-003",
    updatedAt: "2026-01-13 16:20",
  },
  {
    id: "SPU-20260103-003",
    code: "SPU-20260103-003",
    name: "简约针织开衫",
    category: "上装/开衫",
    styleTags: ["简约", "百搭", "休闲"],
    priceBand: "¥199-299",
    status: "ACTIVE",
    effectiveVersion: { code: "V1.2", effectiveAt: "2026-01-08" },
    skuCount: 15,
    mappingHealth: "CONFLICT",
    legacyMapping: "ERP-A: SKU10102 (冲突)",
    channelCount: 4,
    onSaleCount: 12,
    lastListingTime: "2026-01-11",
    originProject: "PRJ-20251218-002",
    updatedAt: "2026-01-12 09:15",
  },
  {
    id: "SPU-20260104-004",
    code: "SPU-20260104-004",
    name: "高腰阔腿牛仔裤",
    category: "裤装/牛仔裤",
    styleTags: ["复古", "显瘦", "百搭"],
    priceBand: "¥249-349",
    status: "ACTIVE",
    effectiveVersion: null,
    skuCount: 6,
    mappingHealth: "OK",
    legacyMapping: "ERP-B: JK20086",
    channelCount: 0,
    onSaleCount: 0,
    lastListingTime: null,
    originProject: "PRJ-20251225-005",
    updatedAt: "2026-01-10 14:00",
  },
  {
    id: "SPU-20260105-005",
    code: "SPU-20260105-005",
    name: "法式蕾丝衬衫",
    category: "上装/衬衫",
    styleTags: ["法式", "蕾丝", "优雅"],
    priceBand: "¥299-399",
    status: "ARCHIVED",
    effectiveVersion: { code: "V3.0", effectiveAt: "2025-12-20" },
    skuCount: 10,
    mappingHealth: "OK",
    legacyMapping: "ERP-A: SKU10055",
    channelCount: 1,
    onSaleCount: 0,
    lastListingTime: "2025-12-25",
    originProject: "PRJ-20251201-001",
    updatedAt: "2026-01-05 11:30",
  },
  {
    id: "SPU-20260106-006",
    code: "SPU-20260106-006",
    name: "运动休闲套装",
    category: "套装/运动套装",
    styleTags: ["运动", "休闲", "舒适"],
    priceBand: "¥399-499",
    status: "ACTIVE",
    effectiveVersion: { code: "V1.0", effectiveAt: "2026-01-12" },
    skuCount: 9,
    mappingHealth: "OK",
    legacyMapping: "ERP-A: SKU10120",
    channelCount: 2,
    onSaleCount: 6,
    lastListingTime: "2026-01-13",
    originProject: null,
    updatedAt: "2026-01-14 08:00",
  },
]

// 状态Badge渲染
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ACTIVE: { label: "启用", variant: "default" },
    ARCHIVED: { label: "已归档", variant: "secondary" },
  }
  const { label, variant } = config[status] || { label: status, variant: "outline" }
  return <Badge variant={variant}>{label}</Badge>
}

// 映射健康Badge
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

export default function SPUListPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [versionFilter, setVersionFilter] = useState("all")
  const [mappingFilter, setMappingFilter] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<"new" | "project" | "legacy">("new")

  // 新建表单状态
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    styleTags: "",
    priceBand: "",
    projectId: "",
    legacySystem: "",
    legacyCode: "",
    createVersion: true,
  })

  // 筛选逻辑
  const filteredSPUs = mockSPUs.filter((spu) => {
    if (search && !spu.name.includes(search) && !spu.code.includes(search)) return false
    if (statusFilter !== "all" && spu.status !== statusFilter) return false
    if (versionFilter === "has" && !spu.effectiveVersion) return false
    if (versionFilter === "none" && spu.effectiveVersion) return false
    if (mappingFilter !== "all" && spu.mappingHealth !== mappingFilter) return false
    return true
  })

  // KPI统计
  const stats = {
    total: mockSPUs.length,
    active: mockSPUs.filter((s) => s.status === "ACTIVE").length,
    hasVersion: mockSPUs.filter((s) => s.effectiveVersion).length,
    noVersion: mockSPUs.filter((s) => !s.effectiveVersion).length,
    mappingOK: mockSPUs.filter((s) => s.mappingHealth === "OK").length,
    mappingConflict: mockSPUs.filter((s) => s.mappingHealth === "CONFLICT").length,
  }

  const handleCreate = () => {
    toast.success("SPU创建成功", { description: `已创建 ${formData.name}` })
    setCreateOpen(false)
    setFormData({
      name: "",
      category: "",
      styleTags: "",
      priceBand: "",
      projectId: "",
      legacySystem: "",
      legacyCode: "",
      createVersion: true,
    })
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
              <h1 className="text-2xl font-bold">商品档案 - SPU</h1>
              <p className="text-muted-foreground">管理正式商品档案，含生产资料版本、SKU档案、编码映射</p>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    新建 SPU
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setCreateMode("new")
                      setCreateOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    从零新建
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setCreateMode("project")
                      setCreateOpen(true)
                    }}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    从商品项目生成
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setCreateMode("legacy")
                      setCreateOpen(true)
                    }}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    绑定老系统SPU
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={() => toast.info("批量导入功能开发中")}>
                <Upload className="h-4 w-4 mr-2" />
                批量导入
              </Button>
            </div>
          </div>

          {/* KPI卡片 */}
          <div className="grid grid-cols-6 gap-4">
            <Card
              className="cursor-pointer hover:border-primary"
              onClick={() => {
                setStatusFilter("all")
                setVersionFilter("all")
                setMappingFilter("all")
              }}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">全部SPU</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("ACTIVE")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                <div className="text-sm text-muted-foreground">启用中</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setVersionFilter("has")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.hasVersion}</div>
                <div className="text-sm text-muted-foreground">有生效版本</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setVersionFilter("none")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.noVersion}</div>
                <div className="text-sm text-muted-foreground">无生效版本</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setMappingFilter("OK")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{stats.mappingOK}</div>
                <div className="text-sm text-muted-foreground">映射健康</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary" onClick={() => setMappingFilter("CONFLICT")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{stats.mappingConflict}</div>
                <div className="text-sm text-muted-foreground">映射冲突</div>
              </CardContent>
            </Card>
          </div>

          {/* 筛选栏 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索SPU编码/名称/款号/老系统编码..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="ACTIVE">启用</SelectItem>
                    <SelectItem value="ARCHIVED">已归档</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={versionFilter} onValueChange={setVersionFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="生效版本" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="has">有生效版本</SelectItem>
                    <SelectItem value="none">无生效版本</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={mappingFilter} onValueChange={setMappingFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="映射健康" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="OK">健康</SelectItem>
                    <SelectItem value="MISSING">缺映射</SelectItem>
                    <SelectItem value="CONFLICT">冲突</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("")
                    setStatusFilter("all")
                    setVersionFilter("all")
                    setMappingFilter("all")
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 数据表格 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">SPU编码/名称</TableHead>
                    <TableHead>类目/风格</TableHead>
                    <TableHead>当前生效版本</TableHead>
                    <TableHead className="text-center">SKU数量</TableHead>
                    <TableHead>映射状态</TableHead>
                    <TableHead>最近上架</TableHead>
                    <TableHead>来源项目</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSPUs.map((spu) => (
                    <TableRow
                      key={spu.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/products/spu/${spu.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{spu.name}</div>
                        <div className="text-xs text-muted-foreground">{spu.code}</div>
                      </TableCell>
                      <TableCell>
                        <div>{spu.category}</div>
                        <div className="flex gap-1 mt-1">
                          {spu.styleTags.slice(0, 2).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {spu.effectiveVersion ? (
                          <div>
                            <Badge variant="secondary">{spu.effectiveVersion.code}</Badge>
                            <div className="text-xs text-muted-foreground mt-1">{spu.effectiveVersion.effectiveAt}</div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            无生效版本
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{spu.skuCount}</TableCell>
                      <TableCell>
                        <MappingHealthBadge health={spu.mappingHealth} />
                        {spu.legacyMapping && (
                          <div className="text-xs text-muted-foreground mt-1">{spu.legacyMapping}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {spu.channelCount > 0 ? (
                          <div>
                            <div className="text-sm">
                              {spu.channelCount}店铺 / {spu.onSaleCount}在售
                            </div>
                            <div className="text-xs text-muted-foreground">{spu.lastListingTime}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {spu.originProject ? (
                          <Button
                            variant="link"
                            className="p-0 h-auto text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/projects/${spu.originProject}`)
                            }}
                          >
                            {spu.originProject}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={spu.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{spu.updatedAt}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/products/spu/${spu.id}`)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              查看详情
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                toast.info("创建新版本", { description: "跳转到版本管理Tab" })
                                router.push(`/products/spu/${spu.id}?tab=versions`)
                              }}
                            >
                              <GitBranch className="h-4 w-4 mr-2" />
                              创建新版本
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/products/spu/${spu.id}?tab=mapping`)
                              }}
                            >
                              <MapPin className="h-4 w-4 mr-2" />
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
            <div className="text-sm text-muted-foreground">共 {filteredSPUs.length} 条</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                上一页
              </Button>
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
                1
              </Button>
              <Button variant="outline" size="sm" disabled>
                下一页
              </Button>
            </div>
          </div>

          {/* SPU2 新建/绑定抽屉 */}
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {createMode === "new" && "新建 SPU"}
                  {createMode === "project" && "从商品项目生成 SPU"}
                  {createMode === "legacy" && "绑定老系统 SPU"}
                </SheetTitle>
                <SheetDescription>
                  {createMode === "new" && "手工创建新的商品档案"}
                  {createMode === "project" && "从已归档的商品项目继承信息创建SPU"}
                  {createMode === "legacy" && "建立与已有业务系统SPU的映射关系"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* 创建方式选择 */}
                <div className="space-y-2">
                  <Label>创建方式</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={createMode === "new" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCreateMode("new")}
                    >
                      从零新建
                    </Button>
                    <Button
                      variant={createMode === "project" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCreateMode("project")}
                    >
                      从项目生成
                    </Button>
                    <Button
                      variant={createMode === "legacy" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCreateMode("legacy")}
                    >
                      绑定老系统
                    </Button>
                  </div>
                </div>

                {/* 基础信息 */}
                <div className="space-y-4">
                  <h4 className="font-medium">SPU 基础信息</h4>
                  <div className="space-y-2">
                    <Label>SPU 名称 *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="输入商品名称"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>类目 *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(v) => setFormData({ ...formData, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择类目" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dress">裙装/连衣裙</SelectItem>
                          <SelectItem value="top">上装/衬衫</SelectItem>
                          <SelectItem value="pants">裤装/牛仔裤</SelectItem>
                          <SelectItem value="coat">上装/外套</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>目标价带</Label>
                      <Select
                        value={formData.priceBand}
                        onValueChange={(v) => setFormData({ ...formData, priceBand: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择价带" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="99-199">¥99-199</SelectItem>
                          <SelectItem value="199-299">¥199-299</SelectItem>
                          <SelectItem value="299-399">¥299-399</SelectItem>
                          <SelectItem value="399-499">¥399-499</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>风格标签</Label>
                    <Input
                      value={formData.styleTags}
                      onChange={(e) => setFormData({ ...formData, styleTags: e.target.value })}
                      placeholder="多个标签用逗号分隔"
                    />
                  </div>
                </div>

                {/* 从项目生成时显示 */}
                {createMode === "project" && (
                  <div className="space-y-4">
                    <h4 className="font-medium">来源项目</h4>
                    <div className="space-y-2">
                      <Label>商品项目 *</Label>
                      <Select
                        value={formData.projectId}
                        onValueChange={(v) => setFormData({ ...formData, projectId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择已归档的商品项目" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRJ-20251216-001">PRJ-20251216-001 印尼风格碎花连衣裙</SelectItem>
                          <SelectItem value="PRJ-20251220-003">PRJ-20251220-003 复古格纹西装</SelectItem>
                          <SelectItem value="PRJ-20251218-002">PRJ-20251218-002 简约针织开衫</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-sm">
                      <p className="font-medium text-blue-700">继承说明</p>
                      <p className="text-blue-600 mt-1">
                        将从项目继承：类目、风格标签、目标价带、主图素材、制版/花型/工艺等工作项输出物
                      </p>
                    </div>
                  </div>
                )}

                {/* 绑定老系统时显示 */}
                {createMode === "legacy" && (
                  <div className="space-y-4">
                    <h4 className="font-medium">老系统映射</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>老系统 *</Label>
                        <Select
                          value={formData.legacySystem}
                          onValueChange={(v) => setFormData({ ...formData, legacySystem: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择系统" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ERP_A">ERP-A</SelectItem>
                            <SelectItem value="ERP_B">ERP-B</SelectItem>
                            <SelectItem value="EXTERNAL">外部系统</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>老系统SPU编码 *</Label>
                        <Input
                          value={formData.legacyCode}
                          onChange={(e) => setFormData({ ...formData, legacyCode: e.target.value })}
                          placeholder="输入编码"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg text-sm">
                      <p className="font-medium text-yellow-700">映射规则</p>
                      <p className="text-yellow-600 mt-1">同一编码在同一时间段只能映射到一个SPU，系统将自动检测冲突</p>
                    </div>
                  </div>
                )}

                {/* 版本创建选项 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="createVersion"
                      checked={formData.createVersion}
                      onCheckedChange={(checked) => setFormData({ ...formData, createVersion: checked as boolean })}
                    />
                    <Label htmlFor="createVersion">同时创建生产资料版本 V1（草稿）</Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    {createMode === "project"
                      ? "将从项目工作项继承制版/工艺/BOM/花型等输出物"
                      : "创建空白版本，后续手工填写"}
                  </p>
                </div>
              </div>

              <SheetFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreate}>保存并进入详情</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </main>
      </div>
    </div>
  )
}
