"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Package,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Eye,
  Power,
  Link2,
  ExternalLink,
  ChevronDown,
  Upload,
  Copy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react"
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"

// Mock data
const mockSKUs = [
  {
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
    techpack_version: "V2.1",
    mapping_health: "OK",
    channel_mappings: 3,
    last_listing: "2025-12-18",
    last_order: "2026-01-10",
    created_at: "2025-12-15",
  },
  {
    id: "SKU-002",
    sku_code: "SKU-FD-001-RED-M",
    spu_id: "SPU-FD-001",
    spu_code: "SPU-FD-001",
    spu_name: "印尼风格碎花连衣裙",
    color: "红色",
    size: "M",
    print: "碎花A",
    status: "ACTIVE",
    barcode: "6901234567891",
    techpack_version: "V2.1",
    mapping_health: "OK",
    channel_mappings: 3,
    last_listing: "2025-12-18",
    last_order: "2026-01-12",
    created_at: "2025-12-15",
  },
  {
    id: "SKU-003",
    sku_code: "SKU-FD-001-BLUE-S",
    spu_id: "SPU-FD-001",
    spu_code: "SPU-FD-001",
    spu_name: "印尼风格碎花连衣裙",
    color: "蓝色",
    size: "S",
    print: "碎花B",
    status: "ACTIVE",
    barcode: "6901234567892",
    techpack_version: "V2.1",
    mapping_health: "MISSING",
    channel_mappings: 1,
    last_listing: "2025-12-20",
    last_order: null,
    created_at: "2025-12-15",
  },
  {
    id: "SKU-004",
    sku_code: "SKU-FD-001-BLUE-M",
    spu_id: "SPU-FD-001",
    spu_code: "SPU-FD-001",
    spu_name: "印尼风格碎花连衣裙",
    color: "蓝色",
    size: "M",
    print: "碎花B",
    status: "INACTIVE",
    barcode: "6901234567893",
    techpack_version: "V2.1",
    mapping_health: "OK",
    channel_mappings: 2,
    last_listing: "2025-12-20",
    last_order: "2025-12-28",
    created_at: "2025-12-15",
  },
  {
    id: "SKU-005",
    sku_code: "SKU-BS-002-WHITE-L",
    spu_id: "SPU-BS-002",
    spu_code: "SPU-BS-002",
    spu_name: "波西米亚风半裙",
    color: "白色",
    size: "L",
    print: null,
    status: "ACTIVE",
    barcode: "6901234567900",
    techpack_version: "V1.0",
    mapping_health: "CONFLICT",
    channel_mappings: 2,
    last_listing: "2025-12-22",
    last_order: "2026-01-08",
    created_at: "2025-12-20",
  },
  {
    id: "SKU-006",
    sku_code: "SKU-TS-003-BLACK-M",
    spu_id: "SPU-TS-003",
    spu_code: "SPU-TS-003",
    spu_name: "基础款T恤",
    color: "黑色",
    size: "M",
    print: null,
    status: "ACTIVE",
    barcode: null,
    techpack_version: "V1.2",
    mapping_health: "MISSING",
    channel_mappings: 0,
    last_listing: null,
    last_order: null,
    created_at: "2025-12-25",
  },
]

const colorOptions = ["红色", "蓝色", "白色", "黑色", "绿色", "黄色", "粉色"]
const sizeOptions = ["XS", "S", "M", "L", "XL", "XXL"]

export default function SKUListPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [mappingHealthFilter, setMappingHealthFilter] = useState<string>("all")
  const [spuFilter, setSpuFilter] = useState<string>("all")
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [batchGenerateOpen, setBatchGenerateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<"single" | "batch" | "import">("single")

  // Create form state
  const [newSKU, setNewSKU] = useState({
    spu_id: "",
    color: "",
    size: "",
    print: "",
    barcode: "",
    code_strategy: "auto",
    manual_code: "",
  })

  // Batch generate state
  const [batchConfig, setBatchConfig] = useState({
    spu_id: "SPU-FD-001",
    colors: [] as string[],
    sizes: [] as string[],
  })

  // Filter SKUs
  const filteredSKUs = mockSKUs.filter((sku) => {
    const matchesSearch =
      !searchTerm ||
      sku.sku_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.spu_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || sku.status === statusFilter
    const matchesMappingHealth = mappingHealthFilter === "all" || sku.mapping_health === mappingHealthFilter
    const matchesSPU = spuFilter === "all" || sku.spu_id === spuFilter
    return matchesSearch && matchesStatus && matchesMappingHealth && matchesSPU
  })

  // Stats
  const stats = {
    total: mockSKUs.length,
    active: mockSKUs.filter((s) => s.status === "ACTIVE").length,
    inactive: mockSKUs.filter((s) => s.status === "INACTIVE").length,
    mappingOK: mockSKUs.filter((s) => s.mapping_health === "OK").length,
    mappingMissing: mockSKUs.filter((s) => s.mapping_health === "MISSING").length,
    mappingConflict: mockSKUs.filter((s) => s.mapping_health === "CONFLICT").length,
  }

  const handleCreateSKU = () => {
    toast({ title: "SKU 创建成功", description: `已创建 SKU: ${newSKU.manual_code || "SKU-AUTO-XXX"}` })
    setCreateDrawerOpen(false)
  }

  const handleBatchGenerate = () => {
    const count = batchConfig.colors.length * batchConfig.sizes.length
    toast({ title: "批量生成成功", description: `已生成 ${count} 个 SKU` })
    setBatchGenerateOpen(false)
  }

  const handleToggleStatus = (sku: (typeof mockSKUs)[0]) => {
    const newStatus = sku.status === "ACTIVE" ? "停用" : "启用"
    toast({ title: `SKU ${newStatus}成功`, description: `${sku.sku_code} 已${newStatus}` })
  }

  const getMappingHealthBadge = (health: string) => {
    switch (health) {
      case "OK":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            正常
          </Badge>
        )
      case "MISSING":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            缺映射
          </Badge>
        )
      case "CONFLICT":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            冲突
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
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">商品档案 - SKU</h1>
              <p className="text-muted-foreground">管理 SKU 主档、规格、映射与上架关联</p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    新建 SKU
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setCreateMode("single")
                      setCreateDrawerOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    单个创建
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBatchGenerateOpen(true)}>
                    <Copy className="h-4 w-4 mr-2" />
                    批量生成（颜色×尺码）
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setCreateMode("import")
                      setCreateDrawerOpen(true)
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    导入/绑定老系统 SKU
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-6 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("all")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">全部 SKU</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setStatusFilter("ACTIVE")}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                <div className="text-sm text-muted-foreground">启用中</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setStatusFilter("INACTIVE")}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-500">{stats.inactive}</div>
                <div className="text-sm text-muted-foreground">已停用</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setMappingHealthFilter("OK")}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{stats.mappingOK}</div>
                <div className="text-sm text-muted-foreground">映射正常</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setMappingHealthFilter("MISSING")}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.mappingMissing}</div>
                <div className="text-sm text-muted-foreground">缺渠道映射</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setMappingHealthFilter("CONFLICT")}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{stats.mappingConflict}</div>
                <div className="text-sm text-muted-foreground">映射冲突</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索 SKU 编码/条码/SPU 名称..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={spuFilter} onValueChange={setSpuFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="所属 SPU" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部 SPU</SelectItem>
                    <SelectItem value="SPU-FD-001">SPU-FD-001</SelectItem>
                    <SelectItem value="SPU-BS-002">SPU-BS-002</SelectItem>
                    <SelectItem value="SPU-TS-003">SPU-TS-003</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="ACTIVE">启用</SelectItem>
                    <SelectItem value="INACTIVE">停用</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={mappingHealthFilter} onValueChange={setMappingHealthFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="映射健康" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部映射状态</SelectItem>
                    <SelectItem value="OK">正常</SelectItem>
                    <SelectItem value="MISSING">缺映射</SelectItem>
                    <SelectItem value="CONFLICT">冲突</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSearchTerm("")
                    setStatusFilter("all")
                    setMappingHealthFilter("all")
                    setSpuFilter("all")
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">SKU 编码</TableHead>
                    <TableHead>所属 SPU</TableHead>
                    <TableHead>规格</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>条码</TableHead>
                    <TableHead>资料版本</TableHead>
                    <TableHead>映射健康</TableHead>
                    <TableHead>渠道映射数</TableHead>
                    <TableHead>最近上架</TableHead>
                    <TableHead>最近订单</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSKUs.map((sku) => (
                    <TableRow
                      key={sku.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/products/sku/${sku.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {sku.sku_code}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{sku.spu_code}</div>
                          <div className="text-xs text-muted-foreground">{sku.spu_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline">{sku.color}</Badge>
                          <Badge variant="outline">{sku.size}</Badge>
                          {sku.print && <Badge variant="outline">{sku.print}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sku.status === "ACTIVE" ? "default" : "secondary"}>
                          {sku.status === "ACTIVE" ? "启用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{sku.barcode || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{sku.techpack_version}</Badge>
                      </TableCell>
                      <TableCell>{getMappingHealthBadge(sku.mapping_health)}</TableCell>
                      <TableCell>{sku.channel_mappings}</TableCell>
                      <TableCell>{sku.last_listing || "-"}</TableCell>
                      <TableCell>{sku.last_order || "-"}</TableCell>
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
                                router.push(`/products/sku/${sku.id}`)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              查看详情
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleStatus(sku)
                              }}
                            >
                              <Power className="h-4 w-4 mr-2" />
                              {sku.status === "ACTIVE" ? "停用" : "启用"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/products/sku/${sku.id}?tab=mapping`)
                              }}
                            >
                              <Link2 className="h-4 w-4 mr-2" />
                              管理映射
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/products/spu/${sku.spu_id}`)
                              }}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              跳转 SPU
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

          {/* Create SKU Drawer (SKU2) */}
          <Sheet open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
            <SheetContent className="w-[500px] sm:max-w-[500px]">
              <SheetHeader>
                <SheetTitle>{createMode === "import" ? "导入/绑定老系统 SKU" : "新建 SKU"}</SheetTitle>
                <SheetDescription>
                  {createMode === "import" ? "从老系统导入或绑定已有 SKU 编码" : "创建单个 SKU 并关联到 SPU"}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 py-6">
                {/* 所属 SPU */}
                <div className="space-y-2">
                  <Label>所属 SPU *</Label>
                  <Select value={newSKU.spu_id} onValueChange={(v) => setNewSKU({ ...newSKU, spu_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择 SPU" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SPU-FD-001">SPU-FD-001 - 印尼风格碎花连衣裙</SelectItem>
                      <SelectItem value="SPU-BS-002">SPU-BS-002 - 波西米亚风半裙</SelectItem>
                      <SelectItem value="SPU-TS-003">SPU-TS-003 - 基础款T恤</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {createMode === "import" ? (
                  <>
                    {/* 老系统导入 */}
                    <div className="space-y-2">
                      <Label>老系统 SKU 编码 *</Label>
                      <Input placeholder="输入老系统 SKU 编码" />
                    </div>
                    <div className="space-y-2">
                      <Label>老系统名称</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="选择老系统" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="erp_v1">ERP V1</SelectItem>
                          <SelectItem value="wms_old">旧 WMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <div className="text-sm text-yellow-800">
                          <div className="font-medium">映射规则说明</div>
                          <div className="mt-1">
                            同一老系统 SKU 编码在同一时间段只能映射到一个 SKU，系统将自动检测冲突。
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 规格字段 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>颜色 *</Label>
                        <Select value={newSKU.color} onValueChange={(v) => setNewSKU({ ...newSKU, color: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择颜色" />
                          </SelectTrigger>
                          <SelectContent>
                            {colorOptions.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>尺码 *</Label>
                        <Select value={newSKU.size} onValueChange={(v) => setNewSKU({ ...newSKU, size: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择尺码" />
                          </SelectTrigger>
                          <SelectContent>
                            {sizeOptions.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>花型/色系（可选）</Label>
                      <Input
                        value={newSKU.print}
                        onChange={(e) => setNewSKU({ ...newSKU, print: e.target.value })}
                        placeholder="如：碎花A、条纹B"
                      />
                    </div>

                    {/* SKU 编码策略 */}
                    <div className="space-y-2">
                      <Label>SKU 编码策略</Label>
                      <Select
                        value={newSKU.code_strategy}
                        onValueChange={(v) => setNewSKU({ ...newSKU, code_strategy: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">自动生成（推荐）</SelectItem>
                          <SelectItem value="manual">手工输入</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newSKU.code_strategy === "manual" && (
                      <div className="space-y-2">
                        <Label>SKU 编码 *</Label>
                        <Input
                          value={newSKU.manual_code}
                          onChange={(e) => setNewSKU({ ...newSKU, manual_code: e.target.value })}
                          placeholder="输入唯一的 SKU 编码"
                        />
                      </div>
                    )}

                    {/* 条码 */}
                    <div className="space-y-2">
                      <Label>条码（可选）</Label>
                      <Input
                        value={newSKU.barcode}
                        onChange={(e) => setNewSKU({ ...newSKU, barcode: e.target.value })}
                        placeholder="商品条形码"
                      />
                    </div>
                  </>
                )}
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setCreateDrawerOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateSKU}>{createMode === "import" ? "绑定并创建" : "创建 SKU"}</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* Batch Generate Dialog */}
          <Dialog open={batchGenerateOpen} onOpenChange={setBatchGenerateOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>批量生成 SKU</DialogTitle>
                <DialogDescription>选择颜色和尺码组合，系统将自动生成所有 SKU</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label>所属 SPU *</Label>
                  <Select
                    value={batchConfig.spu_id}
                    onValueChange={(v) => setBatchConfig({ ...batchConfig, spu_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SPU-FD-001">SPU-FD-001 - 印尼风格碎花连衣裙</SelectItem>
                      <SelectItem value="SPU-BS-002">SPU-BS-002 - 波西米亚风半裙</SelectItem>
                      <SelectItem value="SPU-TS-003">SPU-TS-003 - 基础款T恤</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>选择颜色 *</Label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <div key={color} className="flex items-center gap-2">
                        <Checkbox
                          id={`color-${color}`}
                          checked={batchConfig.colors.includes(color)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setBatchConfig({ ...batchConfig, colors: [...batchConfig.colors, color] })
                            } else {
                              setBatchConfig({ ...batchConfig, colors: batchConfig.colors.filter((c) => c !== color) })
                            }
                          }}
                        />
                        <label htmlFor={`color-${color}`} className="text-sm">
                          {color}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>选择尺码 *</Label>
                  <div className="flex flex-wrap gap-2">
                    {sizeOptions.map((size) => (
                      <div key={size} className="flex items-center gap-2">
                        <Checkbox
                          id={`size-${size}`}
                          checked={batchConfig.sizes.includes(size)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setBatchConfig({ ...batchConfig, sizes: [...batchConfig.sizes, size] })
                            } else {
                              setBatchConfig({ ...batchConfig, sizes: batchConfig.sizes.filter((s) => s !== size) })
                            }
                          }}
                        />
                        <label htmlFor={`size-${size}`} className="text-sm">
                          {size}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {batchConfig.colors.length > 0 && batchConfig.sizes.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm text-blue-800">
                      将生成 <span className="font-bold">{batchConfig.colors.length * batchConfig.sizes.length}</span>{" "}
                      个 SKU （{batchConfig.colors.length} 颜色 × {batchConfig.sizes.length} 尺码）
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBatchGenerateOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleBatchGenerate}
                  disabled={batchConfig.colors.length === 0 || batchConfig.sizes.length === 0}
                >
                  批量生成
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
