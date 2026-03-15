"use client"

import { useState } from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Search,
  Download,
  Plus,
  Eye,
  Edit,
  Building2,
  AlertTriangle,
  CheckCircle,
  Globe,
  FileText,
  Link as LinkIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// LE1｜法人主体列表页 + LE2｜详情页 + LE3｜新建/编辑抽屉

type EntityStatus = "ACTIVE" | "INACTIVE"
type RegistrationCountry = "HK" | "KY" | "ID" | "CN"
type TaxProfile = "VAT" | "NON_VAT" | "WHT" | "OTHER"

const statusConfig: Record<EntityStatus, { label: string; color: string }> = {
  ACTIVE: { label: "启用", color: "bg-green-100 text-green-700" },
  INACTIVE: { label: "停用", color: "bg-gray-100 text-gray-700" },
}

const countryConfig: Record<RegistrationCountry, { label: string; flag: string }> = {
  HK: { label: "香港", flag: "🇭🇰" },
  KY: { label: "开曼群岛", flag: "🇰🇾" },
  ID: { label: "印度尼西亚", flag: "🇮🇩" },
  CN: { label: "中国大陆", flag: "🇨🇳" },
}

const taxProfileConfig: Record<TaxProfile, { label: string }> = {
  VAT: { label: "增值税" },
  NON_VAT: { label: "非增值税" },
  WHT: { label: "预扣税" },
  OTHER: { label: "其他" },
}

// Mock 法人主体数据
const mockLegalEntities = [
  {
    id: "le_01H001",
    code: "HK_HIGOOD_PROC",
    name: "HIGOOD LIVE LIMITED",
    displayAlias: "HK-采购出口主体",
    registrationCountry: "HK" as RegistrationCountry,
    registrationNo: "12345678",
    taxProfile: "NON_VAT" as TaxProfile,
    functionalCurrency: "USD",
    status: "ACTIVE" as EntityStatus,
    parentGroupId: "g_01H001",
    externalIds: { kingdee_org_id: "KD_ORG_1001", legacy_org_id: "LEG_HK_01" },
    hasLedger: true,
    ledgerCode: "SL_HK_HIGOOD_USD",
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-15 14:30",
    updatedBy: "finance_admin",
  },
  {
    id: "le_01H002",
    code: "KY_HIGOOD_HOLD",
    name: "HiGOOD LIVE Limited",
    displayAlias: "KY-集团控股",
    registrationCountry: "KY" as RegistrationCountry,
    registrationNo: "KY-98765",
    taxProfile: "OTHER" as TaxProfile,
    functionalCurrency: "USD",
    status: "ACTIVE" as EntityStatus,
    parentGroupId: "g_01H001",
    externalIds: { kingdee_org_id: "KD_ORG_1002" },
    hasLedger: true,
    ledgerCode: "SL_KY_HOLD_USD",
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-10 09:00",
    updatedBy: "admin",
  },
  {
    id: "le_01H003",
    code: "ID_BDG_FADFAD",
    name: "PT FADFAD FASHION BANDUNG",
    displayAlias: "BDG-生产主体",
    registrationCountry: "ID" as RegistrationCountry,
    registrationNo: "ID-BDG-12345",
    taxProfile: "VAT" as TaxProfile,
    functionalCurrency: "IDR",
    status: "ACTIVE" as EntityStatus,
    parentGroupId: "g_01H001",
    externalIds: { kingdee_org_id: "KD_ORG_1003" },
    hasLedger: true,
    ledgerCode: "SL_ID_BDG_IDR",
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-12 16:00",
    updatedBy: "finance_admin",
  },
  {
    id: "le_01H004",
    code: "ID_JKT_HIGOOD_LIVE",
    name: "PT HIGOOD LIVE JAKARTA",
    displayAlias: "JKT-直播主体",
    registrationCountry: "ID" as RegistrationCountry,
    registrationNo: "ID-JKT-67890",
    taxProfile: "VAT" as TaxProfile,
    functionalCurrency: "IDR",
    status: "ACTIVE" as EntityStatus,
    parentGroupId: "g_01H001",
    externalIds: { kingdee_org_id: "KD_ORG_1004" },
    hasLedger: true,
    ledgerCode: "SL_ID_JKT_IDR",
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-11 11:00",
    updatedBy: "admin",
  },
  {
    id: "le_01H005",
    code: "CN_BJ_FANDE",
    name: "北京范得科技有限公司",
    displayAlias: "BJ-样衣采购",
    registrationCountry: "CN" as RegistrationCountry,
    registrationNo: "91110000MA01234567",
    taxProfile: "VAT" as TaxProfile,
    functionalCurrency: "CNY",
    status: "ACTIVE" as EntityStatus,
    parentGroupId: "g_01H001",
    externalIds: { kingdee_org_id: "KD_ORG_1005", feishu_entity_code: "FS_BJ_01" },
    hasLedger: true,
    ledgerCode: "SL_CN_BJ_CNY",
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-08 10:00",
    updatedBy: "admin",
  },
  {
    id: "le_01H006",
    code: "CN_SZ_HIGOOD_OPS",
    name: "深圳嗨好科技有限公司",
    displayAlias: "SZ-运营研发",
    registrationCountry: "CN" as RegistrationCountry,
    registrationNo: "91440300MA76543210",
    taxProfile: "VAT" as TaxProfile,
    functionalCurrency: "CNY",
    status: "ACTIVE" as EntityStatus,
    parentGroupId: "g_01H001",
    externalIds: { kingdee_org_id: "KD_ORG_1006", feishu_entity_code: "FS_SZ_01" },
    hasLedger: true,
    ledgerCode: "SL_CN_SZ_CNY",
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-05 15:00",
    updatedBy: "admin",
  },
]

function LegalEntitiesContent() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterCountry, setFilterCountry] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedEntity, setSelectedEntity] = useState<(typeof mockLegalEntities)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState("info")
  const searchParams = useSearchParams()

  // KPI 统计
  const stats = {
    total: mockLegalEntities.length,
    active: mockLegalEntities.filter((e) => e.status === "ACTIVE").length,
    withLedger: mockLegalEntities.filter((e) => e.hasLedger).length,
    withoutLedger: mockLegalEntities.filter((e) => !e.hasLedger).length,
  }

  // 筛选
  const filteredEntities = mockLegalEntities.filter((e) => {
    if (filterCountry !== "all" && e.registrationCountry !== filterCountry) return false
    if (filterStatus !== "all" && e.status !== filterStatus) return false
    if (searchKeyword && 
        !e.code.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !e.name.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !e.displayAlias?.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (entity: typeof mockLegalEntities[0]) => {
    setSelectedEntity(entity)
    setDetailOpen(true)
    setEditMode(false)
    setActiveTab("info")
  }

  const openCreate = () => {
    setSelectedEntity(null)
    setCreateOpen(true)
    setEditMode(false)
  }

  const openEdit = (entity: typeof mockLegalEntities[0]) => {
    setSelectedEntity(entity)
    setCreateOpen(true)
    setEditMode(true)
  }

  const handleSave = () => {
    toast.success(editMode ? "法人主体已更新" : "法人主体已创建")
    setCreateOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">法人主体</h1>
          <p className="text-muted-foreground">管理集团下所有法人主体，法人编码唯一且创建后不可变更</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新建法人主体
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">法人总数</div>
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
                <div className="text-2xl font-bold text-green-700">{stats.active}</div>
                <div className="text-sm text-green-600">已启用</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.withLedger}</div>
                <div className="text-sm text-muted-foreground">已配账本</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.withoutLedger > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.withoutLedger > 0 ? "bg-yellow-100" : "bg-gray-100"}`}>
                <AlertTriangle className={`h-5 w-5 ${stats.withoutLedger > 0 ? "text-yellow-600" : "text-gray-500"}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${stats.withoutLedger > 0 ? "text-yellow-700" : ""}`}>
                  {stats.withoutLedger}
                </div>
                <div className={`text-sm ${stats.withoutLedger > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                  缺少账本
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
                placeholder="搜索法人编码/名称/别名..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCountry} onValueChange={setFilterCountry}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="注册地" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部注册地</SelectItem>
                <SelectItem value="HK">🇭🇰 香港</SelectItem>
                <SelectItem value="KY">🇰🇾 开曼群岛</SelectItem>
                <SelectItem value="ID">🇮🇩 印尼</SelectItem>
                <SelectItem value="CN">🇨🇳 中国大陆</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="ACTIVE">启用</SelectItem>
                <SelectItem value="INACTIVE">停用</SelectItem>
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
                <TableHead>法人编码</TableHead>
                <TableHead>法人名称</TableHead>
                <TableHead>展示别名</TableHead>
                <TableHead>注册地</TableHead>
                <TableHead>本位币</TableHead>
                <TableHead>税务属性</TableHead>
                <TableHead>法定账本</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntities.map((entity) => (
                <TableRow key={entity.id}>
                  <TableCell className="font-mono text-sm">{entity.code}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{entity.name}</TableCell>
                  <TableCell className="text-muted-foreground">{entity.displayAlias}</TableCell>
                  <TableCell>
                    <span className="mr-1">{countryConfig[entity.registrationCountry].flag}</span>
                    {countryConfig[entity.registrationCountry].label}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{entity.functionalCurrency}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {taxProfileConfig[entity.taxProfile].label}
                  </TableCell>
                  <TableCell>
                    {entity.hasLedger ? (
                      <span className="font-mono text-sm text-green-600">{entity.ledgerCode}</span>
                    ) : (
                      <Badge variant="destructive" className="text-xs">缺失</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[entity.status].color}>
                      {statusConfig[entity.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(entity)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(entity)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* LE2 法人主体详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedEntity?.displayAlias || selectedEntity?.name}
              {selectedEntity && (
                <Badge className={statusConfig[selectedEntity.status].color}>
                  {statusConfig[selectedEntity.status].label}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              法人编码: {selectedEntity?.code}
            </SheetDescription>
          </SheetHeader>

          {selectedEntity && (
            <div className="mt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="info">基本信息</TabsTrigger>
                  <TabsTrigger value="ledger">账本信息</TabsTrigger>
                  <TabsTrigger value="external">外部映射</TabsTrigger>
                  <TabsTrigger value="audit">审计日志</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">法人编码</div>
                      <div className="font-mono font-medium mt-1">{selectedEntity.code}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">法人名称</div>
                      <div className="font-medium mt-1">{selectedEntity.name}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">展示别名</div>
                      <div className="font-medium mt-1">{selectedEntity.displayAlias || "-"}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">注册国家/地区</div>
                      <div className="font-medium mt-1">
                        {countryConfig[selectedEntity.registrationCountry].flag}{" "}
                        {countryConfig[selectedEntity.registrationCountry].label}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">注册号</div>
                      <div className="font-mono font-medium mt-1">{selectedEntity.registrationNo || "-"}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">本位币</div>
                      <div className="font-medium mt-1">{selectedEntity.functionalCurrency}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">税务属性</div>
                      <div className="font-medium mt-1">{taxProfileConfig[selectedEntity.taxProfile].label}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">状态</div>
                      <div className="mt-1">
                        <Badge className={statusConfig[selectedEntity.status].color}>
                          {statusConfig[selectedEntity.status].label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(selectedEntity); }}>
                      <Edit className="h-4 w-4 mr-2" />
                      编辑
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="ledger" className="space-y-4">
                  {selectedEntity.hasLedger ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-800">已配置法定账本</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <div className="text-sm text-green-600">账本编码</div>
                          <div className="font-mono font-medium">{selectedEntity.ledgerCode}</div>
                        </div>
                        <div>
                          <div className="text-sm text-green-600">账本类型</div>
                          <div className="font-medium">STATUTORY（法定账本）</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium text-yellow-800">缺少法定账本</span>
                      </div>
                      <p className="text-sm text-yellow-700">
                        该法人主体尚未配置法定账本，将影响往来/资产/报表归属。
                      </p>
                      <Button size="sm" className="mt-3">
                        创建法定账本
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="external" className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">金蝶组织ID</span>
                      </div>
                      <div className="font-mono">{selectedEntity.externalIds.kingdee_org_id || "-"}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">旧系统组织ID</span>
                      </div>
                      <div className="font-mono">{selectedEntity.externalIds.legacy_org_id || "-"}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">飞书主体编码</span>
                      </div>
                      <div className="font-mono">{selectedEntity.externalIds.feishu_entity_code || "-"}</div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">创建时间</div>
                      <div className="font-medium mt-1">{selectedEntity.createdAt}</div>
                      <div className="text-sm text-muted-foreground mt-1">创建人: {selectedEntity.createdBy}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">最后更新</div>
                      <div className="font-medium mt-1">{selectedEntity.updatedAt}</div>
                      <div className="text-sm text-muted-foreground mt-1">更新人: {selectedEntity.updatedBy}</div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* LE3 新建/编辑法人主体抽屉 */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editMode ? "编辑法人主体" : "新建法人主体"}</SheetTitle>
            <SheetDescription>
              {editMode ? "修改法人主体信息，法人编码不可变更" : "创建新的法人主体，编码唯一且创建后不可变更"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>法人编码 *</Label>
              <Input 
                placeholder="如 HK_HIGOOD_PROC" 
                defaultValue={selectedEntity?.code}
                disabled={editMode}
              />
              <p className="text-xs text-muted-foreground">仅大写字母/数字/下划线，3-32位，创建后不可修改</p>
            </div>

            <div className="space-y-2">
              <Label>法人名称 *</Label>
              <Input 
                placeholder="法定注册名称" 
                defaultValue={selectedEntity?.name}
              />
            </div>

            <div className="space-y-2">
              <Label>展示别名</Label>
              <Input 
                placeholder="便于识别的简称，如 HK-采购出口主体" 
                defaultValue={selectedEntity?.displayAlias}
              />
              <p className="text-xs text-muted-foreground">强烈建议 HK/KY 主体必填以避免名称混淆</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>注册国家/地区 *</Label>
                <Select defaultValue={selectedEntity?.registrationCountry || "HK"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HK">🇭🇰 香港</SelectItem>
                    <SelectItem value="KY">🇰🇾 开曼群岛</SelectItem>
                    <SelectItem value="ID">🇮🇩 印度尼西亚</SelectItem>
                    <SelectItem value="CN">🇨🇳 中国大陆</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>本位币 *</Label>
                <Select defaultValue={selectedEntity?.functionalCurrency || "USD"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - 美元</SelectItem>
                    <SelectItem value="CNY">CNY - 人民币</SelectItem>
                    <SelectItem value="IDR">IDR - 印尼盾</SelectItem>
                    <SelectItem value="HKD">HKD - 港币</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>注册号</Label>
              <Input 
                placeholder="工商注册号/统一社会信用代码" 
                defaultValue={selectedEntity?.registrationNo}
              />
            </div>

            <div className="space-y-2">
              <Label>税务属性</Label>
              <Select defaultValue={selectedEntity?.taxProfile || "OTHER"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VAT">增值税</SelectItem>
                  <SelectItem value="NON_VAT">非增值税</SelectItem>
                  <SelectItem value="WHT">预扣税</SelectItem>
                  <SelectItem value="OTHER">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">外部系统映射（可选）</h4>
              <div className="space-y-2">
                <Label>金蝶组织ID</Label>
                <Input 
                  placeholder="KD_ORG_xxxx" 
                  defaultValue={selectedEntity?.externalIds.kingdee_org_id}
                />
              </div>
              <div className="space-y-2">
                <Label>旧系统组织ID</Label>
                <Input 
                  placeholder="LEG_ORG_xx" 
                  defaultValue={selectedEntity?.externalIds.legacy_org_id}
                />
              </div>
              <div className="space-y-2">
                <Label>飞书主体编码</Label>
                <Input 
                  placeholder="FS_LE_xx" 
                  defaultValue={selectedEntity?.externalIds.feishu_entity_code}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>状态 *</Label>
              <Select defaultValue={selectedEntity?.status || "ACTIVE"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">启用</SelectItem>
                  <SelectItem value="INACTIVE">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                {editMode ? "保存修改" : "创建"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Loading() {
  return null
}

export default function LegalEntitiesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LegalEntitiesContent />
    </Suspense>
  )
}
