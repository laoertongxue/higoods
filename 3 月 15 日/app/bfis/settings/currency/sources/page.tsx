"use client"

import { useState } from "react"
import { Suspense } from "react"
import Loading from "./loading"
import { useSearchParams } from "next/navigation"
import {
  Search,
  Plus,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Upload,
  Globe,
  RefreshCw,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

// RS1｜汇率来源列表页 + RS2｜汇率来源详情页

type SourceType = "MANUAL" | "FILE_IMPORT" | "API"
type SyncStatus = "OK" | "FAIL" | "NA"

const sourceTypeConfig: Record<SourceType, { label: string; color: string; icon: typeof Database }> = {
  MANUAL: { label: "手工维护", color: "bg-blue-100 text-blue-700", icon: Edit },
  FILE_IMPORT: { label: "文件导入", color: "bg-green-100 text-green-700", icon: Upload },
  API: { label: "API接口", color: "bg-purple-100 text-purple-700", icon: Globe },
}

const syncStatusConfig: Record<SyncStatus, { label: string; color: string }> = {
  OK: { label: "正常", color: "bg-green-100 text-green-700" },
  FAIL: { label: "失败", color: "bg-red-100 text-red-700" },
  NA: { label: "不适用", color: "bg-gray-100 text-gray-700" },
}

// Mock 汇率来源数据
const mockSources = [
  {
    id: "rs_import",
    code: "IMPORT",
    name: "文件导入",
    type: "FILE_IMPORT" as SourceType,
    priority: 1,
    status: "ACTIVE",
    lastSyncAt: "2026-01-21 08:00:00",
    lastSyncStatus: "OK" as SyncStatus,
    lastError: null,
    rateCount: 104,
    usedByPolicies: ["POLICY_BANK_SPOT_USD", "POLICY_PLATFORM_SPOT_USD", "POLICY_MARGIN_DAILY_SPOT_USD"],
    createdAt: "2025-01-01",
    updatedAt: "2026-01-21",
  },
  {
    id: "rs_manual",
    code: "MANUAL",
    name: "手工维护",
    type: "MANUAL" as SourceType,
    priority: 2,
    status: "ACTIVE",
    lastSyncAt: null,
    lastSyncStatus: "NA" as SyncStatus,
    lastError: null,
    rateCount: 52,
    usedByPolicies: ["POLICY_BANK_SPOT_USD", "POLICY_PLATFORM_SPOT_USD"],
    createdAt: "2025-01-01",
    updatedAt: "2026-01-20",
  },
  {
    id: "rs_ecb",
    code: "ECB_API",
    name: "欧央行API",
    type: "API" as SourceType,
    priority: 3,
    status: "INACTIVE",
    lastSyncAt: "2026-01-15 00:00:00",
    lastSyncStatus: "FAIL" as SyncStatus,
    lastError: "Connection timeout",
    rateCount: 0,
    usedByPolicies: [],
    createdAt: "2025-06-01",
    updatedAt: "2026-01-15",
  },
]

function SourcesPageContent() {
  const searchParams = useSearchParams()
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [selectedSource, setSelectedSource] = useState<(typeof mockSources)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editMode, setEditMode] = useState<"create" | "edit">("create")
  const [activeTab, setActiveTab] = useState("info")

  // 编辑表单
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "FILE_IMPORT" as SourceType,
    priority: 1,
    status: "ACTIVE",
  })

  // 筛选
  const filteredSources = mockSources.filter((s) => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false
    if (filterType !== "all" && s.type !== filterType) return false
    if (searchKeyword && !s.code.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !s.name.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (source: typeof mockSources[0]) => {
    setSelectedSource(source)
    setDetailOpen(true)
    setActiveTab("info")
  }

  const openEdit = (source?: typeof mockSources[0]) => {
    if (source) {
      setEditMode("edit")
      setFormData({
        code: source.code,
        name: source.name,
        type: source.type,
        priority: source.priority,
        status: source.status,
      })
    } else {
      setEditMode("create")
      setFormData({ code: "", name: "", type: "FILE_IMPORT", priority: 1, status: "ACTIVE" })
    }
    setEditOpen(true)
  }

  const handleSave = () => {
    if (!formData.code || !formData.name) {
      toast.error("请填写必填项")
      return
    }
    toast.success(editMode === "create" ? "汇率来源创建成功" : "汇率来源更新成功")
    setEditOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">汇率来源</h1>
          <p className="text-muted-foreground">管理汇率数据来源，配置优先级与同步状态</p>
        </div>
        <Button size="sm" onClick={() => openEdit()}>
          <Plus className="h-4 w-4 mr-2" />
          新增来源
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{mockSources.length}</div>
                <div className="text-sm text-muted-foreground">来源总数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">
                  {mockSources.filter((s) => s.status === "ACTIVE").length}
                </div>
                <div className="text-sm text-green-600">已启用</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <RefreshCw className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {mockSources.filter((s) => s.lastSyncStatus === "OK").length}
                </div>
                <div className="text-sm text-muted-foreground">同步正常</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={mockSources.filter((s) => s.lastSyncStatus === "FAIL").length > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${mockSources.filter((s) => s.lastSyncStatus === "FAIL").length > 0 ? "bg-red-100" : "bg-gray-100"}`}>
                <XCircle className={`h-5 w-5 ${mockSources.filter((s) => s.lastSyncStatus === "FAIL").length > 0 ? "text-red-600" : "text-gray-600"}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${mockSources.filter((s) => s.lastSyncStatus === "FAIL").length > 0 ? "text-red-700" : ""}`}>
                  {mockSources.filter((s) => s.lastSyncStatus === "FAIL").length}
                </div>
                <div className={`text-sm ${mockSources.filter((s) => s.lastSyncStatus === "FAIL").length > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                  同步失败
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索来源编码/名称..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="来源类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="MANUAL">手工维护</SelectItem>
                <SelectItem value="FILE_IMPORT">文件导入</SelectItem>
                <SelectItem value="API">API接口</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="ACTIVE">已启用</SelectItem>
                <SelectItem value="INACTIVE">已停用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>来源编码</TableHead>
                <TableHead>来源名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-center">优先级</TableHead>
                <TableHead className="text-right">汇率数</TableHead>
                <TableHead>同步状态</TableHead>
                <TableHead>最近同步</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSources.map((source) => {
                const typeConfig = sourceTypeConfig[source.type]
                const TypeIcon = typeConfig.icon
                return (
                  <TableRow key={source.id}>
                    <TableCell className="font-mono font-bold">{source.code}</TableCell>
                    <TableCell>{source.name}</TableCell>
                    <TableCell>
                      <Badge className={typeConfig.color}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {typeConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">{source.priority}</TableCell>
                    <TableCell className="text-right font-mono">{source.rateCount}</TableCell>
                    <TableCell>
                      <Badge className={syncStatusConfig[source.lastSyncStatus].color}>
                        {syncStatusConfig[source.lastSyncStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {source.lastSyncAt || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={source.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                        {source.status === "ACTIVE" ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(source)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(source)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* RS2 汇率来源详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <span className="font-mono">{selectedSource?.code}</span>
              <span>{selectedSource?.name}</span>
            </SheetTitle>
            <SheetDescription>
              {selectedSource && sourceTypeConfig[selectedSource.type].label}
            </SheetDescription>
          </SheetHeader>

          {selectedSource && (
            <div className="mt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="info">基本信息</TabsTrigger>
                  <TabsTrigger value="sync">同步状态</TabsTrigger>
                  <TabsTrigger value="policies">关联策略</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">来源编码</div>
                      <div className="font-mono font-bold mt-1">{selectedSource.code}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">来源名称</div>
                      <div className="font-medium mt-1">{selectedSource.name}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">类型</div>
                      <div className="mt-1">
                        <Badge className={sourceTypeConfig[selectedSource.type].color}>
                          {sourceTypeConfig[selectedSource.type].label}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">解析优先级</div>
                      <div className="font-mono font-bold mt-1">{selectedSource.priority}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">汇率记录数</div>
                      <div className="font-mono font-bold mt-1">{selectedSource.rateCount}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">状态</div>
                      <div className="mt-1">
                        <Badge className={selectedSource.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                          {selectedSource.status === "ACTIVE" ? "启用" : "停用"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="sync" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">同步状态</div>
                      <div className="mt-1">
                        <Badge className={syncStatusConfig[selectedSource.lastSyncStatus].color}>
                          {syncStatusConfig[selectedSource.lastSyncStatus].label}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">最近同步时间</div>
                      <div className="font-medium mt-1">{selectedSource.lastSyncAt || "-"}</div>
                    </div>
                  </div>

                  {selectedSource.lastError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="font-medium text-red-800">同步错误</span>
                      </div>
                      <p className="text-sm text-red-700 font-mono">{selectedSource.lastError}</p>
                    </div>
                  )}

                  {selectedSource.type === "API" && (
                    <Button variant="outline" className="w-full bg-transparent">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      手动触发同步
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="policies" className="space-y-4">
                  <p className="text-sm text-muted-foreground">以下策略使用此来源</p>
                  {selectedSource.usedByPolicies.length > 0 ? (
                    <div className="space-y-2">
                      {selectedSource.usedByPolicies.map((policy) => (
                        <div key={policy} className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{policy}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg text-center text-muted-foreground">
                      暂无策略使用此来源
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 新建/编辑来源抽屉 */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editMode === "create" ? "新增汇率来源" : "编辑汇率来源"}</SheetTitle>
            <SheetDescription>
              {editMode === "create" ? "创建新的汇率数据来源" : "修改汇率来源配置"}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>来源编码 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="如 IMPORT、MANUAL、ECB_API"
                disabled={editMode === "edit"}
              />
            </div>

            <div className="space-y-2">
              <Label>来源名称 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如 文件导入、手工维护"
              />
            </div>

            <div className="space-y-2">
              <Label>来源类型</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as SourceType })}
                disabled={editMode === "edit"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">手工维护</SelectItem>
                  <SelectItem value="FILE_IMPORT">文件导入</SelectItem>
                  <SelectItem value="API">API接口</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>解析优先级</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">数值越小优先级越高（1-99）</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label>启用状态</Label>
                <p className="text-xs text-muted-foreground">停用后该来源的汇率将不参与解析</p>
              </div>
              <Switch
                checked={formData.status === "ACTIVE"}
                onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? "ACTIVE" : "INACTIVE" })}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function SourcesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SourcesPageContent />
    </Suspense>
  )
}
