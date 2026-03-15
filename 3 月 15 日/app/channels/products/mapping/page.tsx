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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  Plus,
  MoreHorizontal,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowRight,
  Clock,
} from "lucide-react"

// 映射类型
const MAPPING_TYPE = {
  CANDIDATE_TO_SPU: { label: "候选→SPU", color: "bg-purple-100 text-purple-700" },
  ITEM_TO_INTERNAL: { label: "商品→内部", color: "bg-blue-100 text-blue-700" },
  SKU_TO_INTERNAL: { label: "SKU→内部", color: "bg-green-100 text-green-700" },
}

// 映射状态
const MAPPING_STATUS = {
  ACTIVE: { label: "有效", color: "bg-green-100 text-green-700" },
  EXPIRED: { label: "已过期", color: "bg-gray-100 text-gray-600" },
  CONFLICT: { label: "冲突", color: "bg-red-100 text-red-700" },
}

// 渠道数据
const CHANNELS = [
  { id: "tiktok", name: "TikTok Shop" },
  { id: "shopee", name: "Shopee" },
  { id: "lazada", name: "Lazada" },
]

// 店铺数据
const STORES = [
  { id: "store-1", name: "HiGood官方旗舰店", channel: "tiktok" },
  { id: "store-2", name: "HiGood印尼店", channel: "tiktok" },
  { id: "store-3", name: "HiGood马来店", channel: "shopee" },
]

// Mock映射数据
const mockMappings = [
  {
    id: "MAP-001",
    type: "CANDIDATE_TO_SPU",
    sourceKey: "CAND-20260108-001",
    targetKey: "SPU-20260115-001",
    channel: null,
    store: null,
    effectiveFrom: "2026-01-15 10:00",
    effectiveTo: null,
    status: "ACTIVE",
    remark: "测款通过转档",
    updatedAt: "2026-01-15 10:00",
  },
  {
    id: "MAP-002",
    type: "ITEM_TO_INTERNAL",
    sourceKey: "TT-10001234567",
    targetKey: "SPU-20260110-001",
    channel: "tiktok",
    store: "store-1",
    effectiveFrom: "2026-01-05 14:30",
    effectiveTo: null,
    status: "ACTIVE",
    remark: "上架时自动创建",
    updatedAt: "2026-01-05 14:30",
  },
  {
    id: "MAP-003",
    type: "SKU_TO_INTERNAL",
    sourceKey: "TT-SKU-001",
    targetKey: "SKU-001",
    channel: "tiktok",
    store: "store-1",
    effectiveFrom: "2026-01-05 14:30",
    effectiveTo: null,
    status: "ACTIVE",
    remark: "自动映射",
    updatedAt: "2026-01-05 14:30",
  },
  {
    id: "MAP-004",
    type: "SKU_TO_INTERNAL",
    sourceKey: "TT-SKU-002",
    targetKey: "SKU-002",
    channel: "tiktok",
    store: "store-1",
    effectiveFrom: "2026-01-05 14:30",
    effectiveTo: null,
    status: "ACTIVE",
    remark: "自动映射",
    updatedAt: "2026-01-05 14:30",
  },
  {
    id: "MAP-005",
    type: "SKU_TO_INTERNAL",
    sourceKey: "TT-SKU-005",
    targetKey: "SKU-005",
    channel: "tiktok",
    store: "store-1",
    effectiveFrom: "2026-01-12 10:00",
    effectiveTo: null,
    status: "CONFLICT",
    remark: "与 MAP-006 冲突",
    updatedAt: "2026-01-12 10:00",
  },
  {
    id: "MAP-006",
    type: "SKU_TO_INTERNAL",
    sourceKey: "TT-SKU-005",
    targetKey: "SKU-006",
    channel: "tiktok",
    store: "store-1",
    effectiveFrom: "2026-01-10 15:00",
    effectiveTo: null,
    status: "CONFLICT",
    remark: "与 MAP-005 冲突",
    updatedAt: "2026-01-10 15:00",
  },
  {
    id: "MAP-007",
    type: "ITEM_TO_INTERNAL",
    sourceKey: "SH-20001234569",
    targetKey: "CAND-20260112-002",
    channel: "shopee",
    store: "store-3",
    effectiveFrom: "2026-01-08 09:00",
    effectiveTo: "2026-01-12 00:00",
    status: "EXPIRED",
    remark: "候选商品已转档",
    updatedAt: "2026-01-12 00:00",
  },
]

export default function CodeMappingPage() {
  const { toast } = useToast()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterChannel, setFilterChannel] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)

  // 弹窗状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [endDialogOpen, setEndDialogOpen] = useState(false)
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [selectedMapping, setSelectedMapping] = useState<(typeof mockMappings)[0] | null>(null)

  // 新建表单
  const [newMapping, setNewMapping] = useState({
    type: "SKU_TO_INTERNAL",
    sourceKey: "",
    targetKey: "",
    channel: "",
    store: "",
    remark: "",
  })

  // 筛选数据
  const filteredMappings = mockMappings.filter((m) => {
    if (filterType !== "all" && m.type !== filterType) return false
    if (filterChannel !== "all" && m.channel !== filterChannel) return false
    if (filterStatus !== "all" && m.status !== filterStatus) return false
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      return m.sourceKey.toLowerCase().includes(keyword) || m.targetKey.toLowerCase().includes(keyword)
    }
    return true
  })

  // 统计数据
  const stats = {
    total: mockMappings.length,
    active: mockMappings.filter((m) => m.status === "ACTIVE").length,
    expired: mockMappings.filter((m) => m.status === "EXPIRED").length,
    conflict: mockMappings.filter((m) => m.status === "CONFLICT").length,
  }

  // 创建映射
  const handleCreateMapping = () => {
    if (!newMapping.sourceKey || !newMapping.targetKey) {
      toast({ title: "请填写源键和目标键", variant: "destructive" })
      return
    }
    toast({ title: "映射创建成功" })
    setCreateDialogOpen(false)
  }

  // 结束映射
  const handleEndMapping = () => {
    toast({ title: "映射已结束", description: `effective_to 已设置为当前时间` })
    setEndDialogOpen(false)
  }

  // 替换目标
  const handleReplaceTarget = () => {
    toast({ title: "目标替换成功", description: "已创建新映射并结束旧映射" })
    setReplaceDialogOpen(false)
  }

  // 解决冲突
  const handleResolveConflict = () => {
    toast({ title: "冲突已解决" })
    setConflictDialogOpen(false)
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
              <h1 className="text-2xl font-bold">编码映射管理</h1>
              <p className="text-muted-foreground text-sm">管理平台编码与内部编码的映射关系，支持有效期与冲突处理</p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新增映射
            </Button>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("all")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-muted-foreground">全部映射</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFilterStatus("ACTIVE")}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                <div className="text-sm text-muted-foreground">有效映射</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFilterStatus("EXPIRED")}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-600">{stats.expired}</div>
                <div className="text-sm text-muted-foreground">已过期</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFilterStatus("CONFLICT")}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{stats.conflict}</div>
                <div className="text-sm text-muted-foreground">冲突</div>
              </CardContent>
            </Card>
          </div>

          {/* 筛选栏 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="源键/目标键..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="映射类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    {Object.entries(MAPPING_TYPE).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterChannel} onValueChange={setFilterChannel}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="渠道" />
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
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    {Object.entries(MAPPING_STATUS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchKeyword("")
                    setFilterType("all")
                    setFilterChannel("all")
                    setFilterStatus("all")
                  }}
                >
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 冲突判定规则说明 */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-800">冲突判定规则</div>
                  <ul className="text-sm text-blue-700 mt-1 space-y-1">
                    <li>• 同一 (channel, store, platform_item_id) 在同一时间段只能映射到一个 internal_ref</li>
                    <li>• 同一 (channel, store, platform_sku_id) 在同一时间段只能映射到一个 internal_sku_id</li>
                    <li>• 一个 candidate 只能归并到一个 spu（可允许多个 candidate 归并到同一 spu）</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 数据表格 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>映射ID</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>源键</TableHead>
                    <TableHead></TableHead>
                    <TableHead>目标键</TableHead>
                    <TableHead>渠道/店铺</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMappings.map((mapping) => (
                    <TableRow key={mapping.id} className={mapping.status === "CONFLICT" ? "bg-red-50" : ""}>
                      <TableCell className="font-mono text-sm">{mapping.id}</TableCell>
                      <TableCell>
                        <Badge className={MAPPING_TYPE[mapping.type as keyof typeof MAPPING_TYPE]?.color}>
                          {MAPPING_TYPE[mapping.type as keyof typeof MAPPING_TYPE]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{mapping.sourceKey}</TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-mono text-sm text-blue-600">{mapping.targetKey}</TableCell>
                      <TableCell>
                        {mapping.channel ? (
                          <span className="text-sm">
                            {CHANNELS.find((c) => c.id === mapping.channel)?.name} /{" "}
                            {STORES.find((s) => s.id === mapping.store)?.name}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {mapping.effectiveFrom}
                          </div>
                          {mapping.effectiveTo && <div className="text-muted-foreground">至 {mapping.effectiveTo}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={MAPPING_STATUS[mapping.status as keyof typeof MAPPING_STATUS]?.color}>
                          {mapping.status === "CONFLICT" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {MAPPING_STATUS[mapping.status as keyof typeof MAPPING_STATUS]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground max-w-[150px] truncate"
                        title={mapping.remark}
                      >
                        {mapping.remark}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {mapping.status === "ACTIVE" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedMapping(mapping)
                                    setEndDialogOpen(true)
                                  }}
                                >
                                  <Clock className="h-4 w-4 mr-2" />
                                  结束映射
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedMapping(mapping)
                                    setReplaceDialogOpen(true)
                                  }}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  替换目标
                                </DropdownMenuItem>
                              </>
                            )}
                            {mapping.status === "CONFLICT" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMapping(mapping)
                                  setConflictDialogOpen(true)
                                }}
                              >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                解决冲突
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

          {/* 分页 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">共 {filteredMappings.length} 条记录</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">第 {currentPage} 页</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 新增映射弹窗 */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增编码映射</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>
                    映射类型 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={newMapping.type}
                    onValueChange={(v) => setNewMapping((prev) => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MAPPING_TYPE).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {newMapping.type !== "CANDIDATE_TO_SPU" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>渠道</Label>
                      <Select
                        value={newMapping.channel}
                        onValueChange={(v) => setNewMapping((prev) => ({ ...prev, channel: v }))}
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
                    <div className="space-y-2">
                      <Label>店铺</Label>
                      <Select
                        value={newMapping.store}
                        onValueChange={(v) => setNewMapping((prev) => ({ ...prev, store: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择店铺" />
                        </SelectTrigger>
                        <SelectContent>
                          {STORES.filter((s) => !newMapping.channel || s.channel === newMapping.channel).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>
                    源键 (Source Key) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder={newMapping.type === "CANDIDATE_TO_SPU" ? "候选商品ID" : "平台商品/SKU ID"}
                    value={newMapping.sourceKey}
                    onChange={(e) => setNewMapping((prev) => ({ ...prev, sourceKey: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    目标键 (Target Key) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder={newMapping.type === "CANDIDATE_TO_SPU" ? "SPU ID" : "内部商品/SKU ID"}
                    value={newMapping.targetKey}
                    onChange={(e) => setNewMapping((prev) => ({ ...prev, targetKey: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Textarea
                    placeholder="备注信息"
                    value={newMapping.remark}
                    onChange={(e) => setNewMapping((prev) => ({ ...prev, remark: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateMapping}>创建映射</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 结束映射弹窗 */}
          <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>结束映射</DialogTitle>
                <DialogDescription>确认结束此映射？将设置 effective_to 为当前时间。</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">映射ID</span>
                      <span className="text-sm font-mono">{selectedMapping?.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">源键 → 目标键</span>
                      <span className="text-sm">
                        {selectedMapping?.sourceKey} → {selectedMapping?.targetKey}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEndDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleEndMapping}>确认结束</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 替换目标弹窗 */}
          <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>替换映射目标</DialogTitle>
                <DialogDescription>将创建新映射并自动结束旧映射（设置 effective_to）。</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">源键</span>
                      <span className="text-sm font-mono">{selectedMapping?.sourceKey}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">当前目标</span>
                      <span className="text-sm text-red-600 line-through">{selectedMapping?.targetKey}</span>
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  <Label>
                    新目标键 <span className="text-red-500">*</span>
                  </Label>
                  <Input placeholder="输入新的目标键" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReplaceDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleReplaceTarget}>确认替换</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 解决冲突弹窗 */}
          <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>解决映射冲突</DialogTitle>
                <DialogDescription>检测到同一源键在同一时间段映射到多个目标，请选择保留哪一个。</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>冲突的映射</Label>
                  <div className="space-y-2">
                    <Card className="border-2 cursor-pointer hover:border-blue-500">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm">MAP-005: TT-SKU-005 → SKU-005</div>
                          <div className="text-xs text-muted-foreground">生效于 2026-01-12 10:00</div>
                        </div>
                        <input type="radio" name="conflict" defaultChecked />
                      </CardContent>
                    </Card>
                    <Card className="border-2 cursor-pointer hover:border-blue-500">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm">MAP-006: TT-SKU-005 → SKU-006</div>
                          <div className="text-xs text-muted-foreground">生效于 2026-01-10 15:00</div>
                        </div>
                        <input type="radio" name="conflict" />
                      </CardContent>
                    </Card>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  选择保留的映射后，另一个映射将被标记为已过期（设置 effective_to）。
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConflictDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleResolveConflict}>确认解决</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
