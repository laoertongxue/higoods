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
  GitBranch,
  Building2,
  ChevronRight,
  FileText,
  Link as LinkIcon,
  Trash2,
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
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// IC1｜跨主体关系配置页

type RelationType = "SALE_PURCHASE" | "CONSIGNMENT" | "SERVICE" | "LOAN" | "OTHER"
type RelationStatus = "ACTIVE" | "INACTIVE"

const relationTypeConfig: Record<RelationType, { label: string; color: string; description: string }> = {
  SALE_PURCHASE: { label: "采购销售", color: "bg-blue-100 text-blue-700", description: "标准买卖关系，一方采购另一方销售" },
  CONSIGNMENT: { label: "代销", color: "bg-purple-100 text-purple-700", description: "货物寄售代销关系" },
  SERVICE: { label: "服务", color: "bg-green-100 text-green-700", description: "提供服务的关系（如技术服务、管理费等）" },
  LOAN: { label: "借款", color: "bg-orange-100 text-orange-700", description: "资金借贷往来关系" },
  OTHER: { label: "其他", color: "bg-gray-100 text-gray-700", description: "其他跨主体关系" },
}

const statusConfig: Record<RelationStatus, { label: string; color: string }> = {
  ACTIVE: { label: "启用", color: "bg-green-100 text-green-700" },
  INACTIVE: { label: "停用", color: "bg-gray-100 text-gray-700" },
}

// Mock 法人主体
const mockEntities = [
  { id: "le_01H001", code: "HK_HIGOOD_PROC", name: "HIGOOD LIVE LIMITED", alias: "HK-采购出口主体" },
  { id: "le_01H002", code: "KY_HIGOOD_HOLD", name: "HiGOOD LIVE Limited", alias: "KY-集团控股" },
  { id: "le_01H003", code: "ID_BDG_FADFAD", name: "PT FADFAD FASHION BANDUNG", alias: "BDG-生产主体" },
  { id: "le_01H004", code: "ID_JKT_HIGOOD_LIVE", name: "PT HIGOOD LIVE JAKARTA", alias: "JKT-直播主体" },
  { id: "le_01H005", code: "CN_BJ_FANDE", name: "北京范得科技有限公司", alias: "BJ-样衣采购" },
  { id: "le_01H006", code: "CN_SZ_HIGOOD_OPS", name: "深圳嗨好科技有限公司", alias: "SZ-运营研发" },
]

// Mock 跨主体关系
const mockRelations = [
  {
    id: "ic_01H001",
    fromEntityId: "le_01H001",
    fromEntityCode: "HK_HIGOOD_PROC",
    fromEntityAlias: "HK-采购出口主体",
    toEntityId: "le_01H003",
    toEntityCode: "ID_BDG_FADFAD",
    toEntityAlias: "BDG-生产主体",
    relationType: "SALE_PURCHASE" as RelationType,
    defaultSettlementCurrency: "USD",
    defaultPricingPolicyNote: "按采购合同约定价格，FOB条款",
    attachments: ["采购框架协议_2025.pdf"],
    status: "ACTIVE" as RelationStatus,
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-10 14:00",
    updatedBy: "finance_admin",
  },
  {
    id: "ic_01H002",
    fromEntityId: "le_01H003",
    fromEntityCode: "ID_BDG_FADFAD",
    fromEntityAlias: "BDG-生产主体",
    toEntityId: "le_01H004",
    toEntityCode: "ID_JKT_HIGOOD_LIVE",
    toEntityAlias: "JKT-直播主体",
    relationType: "CONSIGNMENT" as RelationType,
    defaultSettlementCurrency: "IDR",
    defaultPricingPolicyNote: "代销结算，按实际销售扣除佣金后结算",
    attachments: ["代销协议_2025.pdf"],
    status: "ACTIVE" as RelationStatus,
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-05 09:00",
    updatedBy: "admin",
  },
  {
    id: "ic_01H003",
    fromEntityId: "le_01H005",
    fromEntityCode: "CN_BJ_FANDE",
    fromEntityAlias: "BJ-样衣采购",
    toEntityId: "le_01H001",
    toEntityCode: "HK_HIGOOD_PROC",
    toEntityAlias: "HK-采购出口主体",
    relationType: "SALE_PURCHASE" as RelationType,
    defaultSettlementCurrency: "CNY",
    defaultPricingPolicyNote: "样衣采购，按实际成本加成5%",
    attachments: [],
    status: "ACTIVE" as RelationStatus,
    createdAt: "2025-01-01 10:00",
    createdBy: "admin",
    updatedAt: "2025-12-20 16:00",
    updatedBy: "admin",
  },
  {
    id: "ic_01H004",
    fromEntityId: "le_01H006",
    fromEntityCode: "CN_SZ_HIGOOD_OPS",
    fromEntityAlias: "SZ-运营研发",
    toEntityId: "le_01H002",
    toEntityCode: "KY_HIGOOD_HOLD",
    toEntityAlias: "KY-集团控股",
    relationType: "SERVICE" as RelationType,
    defaultSettlementCurrency: "USD",
    defaultPricingPolicyNote: "技术服务费，按成本加成10%",
    attachments: ["服务协议_2025.pdf"],
    status: "ACTIVE" as RelationStatus,
    createdAt: "2025-06-01 10:00",
    createdBy: "admin",
    updatedAt: "2026-01-08 11:00",
    updatedBy: "finance_admin",
  },
]

function RelationsContent() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedRelation, setSelectedRelation] = useState<(typeof mockRelations)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState("info")
  const searchParams = useSearchParams()

  // KPI 统计
  const stats = {
    total: mockRelations.length,
    active: mockRelations.filter((r) => r.status === "ACTIVE").length,
    salePurchase: mockRelations.filter((r) => r.relationType === "SALE_PURCHASE").length,
    consignment: mockRelations.filter((r) => r.relationType === "CONSIGNMENT").length,
    service: mockRelations.filter((r) => r.relationType === "SERVICE").length,
  }

  // 筛选
  const filteredRelations = mockRelations.filter((r) => {
    if (filterType !== "all" && r.relationType !== filterType) return false
    if (filterStatus !== "all" && r.status !== filterStatus) return false
    if (searchKeyword && 
        !r.fromEntityCode.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !r.toEntityCode.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (relation: typeof mockRelations[0]) => {
    setSelectedRelation(relation)
    setDetailOpen(true)
    setActiveTab("info")
  }

  const openCreate = () => {
    setSelectedRelation(null)
    setCreateOpen(true)
    setEditMode(false)
  }

  const openEdit = (relation: typeof mockRelations[0]) => {
    setSelectedRelation(relation)
    setCreateOpen(true)
    setEditMode(true)
  }

  const handleSave = () => {
    toast.success(editMode ? "跨主体关系已更新" : "跨主体关系已创建")
    setCreateOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">跨主体关系配置</h1>
          <p className="text-muted-foreground">配置法人主体间的业务关系，为往来核算与预测提供口径</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新建关系
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <GitBranch className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">关系总数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-700">{stats.active}</div>
            <div className="text-sm text-green-600">已启用</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-700">{stats.salePurchase}</div>
            <div className="text-sm text-blue-600">采购销售</div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-700">{stats.consignment}</div>
            <div className="text-sm text-purple-600">代销</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-700">{stats.service}</div>
            <div className="text-sm text-green-600">服务</div>
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
                placeholder="搜索主体编码..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="关系类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="SALE_PURCHASE">采购销售</SelectItem>
                <SelectItem value="CONSIGNMENT">代销</SelectItem>
                <SelectItem value="SERVICE">服务</SelectItem>
                <SelectItem value="LOAN">借款</SelectItem>
                <SelectItem value="OTHER">其他</SelectItem>
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
                <TableHead>甲方主体</TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>乙方主体</TableHead>
                <TableHead>关系类型</TableHead>
                <TableHead>结算币种</TableHead>
                <TableHead>定价说明</TableHead>
                <TableHead>协议附件</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRelations.map((relation) => (
                <TableRow key={relation.id}>
                  <TableCell>
                    <div className="font-mono text-sm">{relation.fromEntityCode}</div>
                    <div className="text-xs text-muted-foreground">{relation.fromEntityAlias}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">{relation.toEntityCode}</div>
                    <div className="text-xs text-muted-foreground">{relation.toEntityAlias}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={relationTypeConfig[relation.relationType].color}>
                      {relationTypeConfig[relation.relationType].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {relation.defaultSettlementCurrency ? (
                      <Badge variant="outline">{relation.defaultSettlementCurrency}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {relation.defaultPricingPolicyNote || "-"}
                  </TableCell>
                  <TableCell>
                    {relation.attachments.length > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        {relation.attachments.length}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[relation.status].color}>
                      {statusConfig[relation.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(relation)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(relation)}>
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

      {/* 关系详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              跨主体关系详情
              {selectedRelation && (
                <>
                  <Badge className={relationTypeConfig[selectedRelation.relationType].color}>
                    {relationTypeConfig[selectedRelation.relationType].label}
                  </Badge>
                  <Badge className={statusConfig[selectedRelation.status].color}>
                    {statusConfig[selectedRelation.status].label}
                  </Badge>
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              {selectedRelation?.fromEntityCode} → {selectedRelation?.toEntityCode}
            </SheetDescription>
          </SheetHeader>

          {selectedRelation && (
            <div className="mt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="info">基本信息</TabsTrigger>
                  <TabsTrigger value="attachments">协议附件</TabsTrigger>
                  <TabsTrigger value="audit">审计日志</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  {/* 关系方向 */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="text-center flex-1">
                        <div className="text-sm text-muted-foreground mb-1">甲方主体</div>
                        <div className="font-mono font-medium">{selectedRelation.fromEntityCode}</div>
                        <div className="text-sm text-muted-foreground">{selectedRelation.fromEntityAlias}</div>
                      </div>
                      <ChevronRight className="h-6 w-6 text-muted-foreground mx-4" />
                      <div className="text-center flex-1">
                        <div className="text-sm text-muted-foreground mb-1">乙方主体</div>
                        <div className="font-mono font-medium">{selectedRelation.toEntityCode}</div>
                        <div className="text-sm text-muted-foreground">{selectedRelation.toEntityAlias}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">关系类型</div>
                      <div className="mt-1">
                        <Badge className={relationTypeConfig[selectedRelation.relationType].color}>
                          {relationTypeConfig[selectedRelation.relationType].label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {relationTypeConfig[selectedRelation.relationType].description}
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">默认结算币种</div>
                      <div className="font-medium mt-1">{selectedRelation.defaultSettlementCurrency || "-"}</div>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">定价/政策说明</div>
                    <div className="mt-1">{selectedRelation.defaultPricingPolicyNote || "-"}</div>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(selectedRelation); }}>
                      <Edit className="h-4 w-4 mr-2" />
                      编辑
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="attachments" className="space-y-4">
                  {selectedRelation.attachments.length > 0 ? (
                    <div className="space-y-2">
                      {selectedRelation.attachments.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span>{file}</span>
                          </div>
                          <Button variant="ghost" size="sm">
                            下载
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">暂无附件</p>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">创建时间</div>
                      <div className="font-medium mt-1">{selectedRelation.createdAt}</div>
                      <div className="text-sm text-muted-foreground mt-1">创建人: {selectedRelation.createdBy}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">最后更新</div>
                      <div className="font-medium mt-1">{selectedRelation.updatedAt}</div>
                      <div className="text-sm text-muted-foreground mt-1">更新人: {selectedRelation.updatedBy}</div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 新建/编辑关系抽屉 */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editMode ? "编辑跨主体关系" : "新建跨主体关系"}</SheetTitle>
            <SheetDescription>
              {editMode ? "修改跨主体关系配置" : "配置两个法人主体间的业务关系"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>甲方主体 *</Label>
              <Select defaultValue={selectedRelation?.fromEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择甲方主体" />
                </SelectTrigger>
                <SelectContent>
                  {mockEntities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.code} - {entity.alias}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>乙方主体 *</Label>
              <Select defaultValue={selectedRelation?.toEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择乙方主体" />
                </SelectTrigger>
                <SelectContent>
                  {mockEntities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.code} - {entity.alias}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">甲方与乙方不能是同一主体</p>
            </div>

            <div className="space-y-2">
              <Label>关系类型 *</Label>
              <Select defaultValue={selectedRelation?.relationType || "SALE_PURCHASE"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALE_PURCHASE">采购销售</SelectItem>
                  <SelectItem value="CONSIGNMENT">代销</SelectItem>
                  <SelectItem value="SERVICE">服务</SelectItem>
                  <SelectItem value="LOAN">借款</SelectItem>
                  <SelectItem value="OTHER">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>默认结算币种</Label>
              <Select defaultValue={selectedRelation?.defaultSettlementCurrency || "USD"}>
                <SelectTrigger>
                  <SelectValue placeholder="可选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - 美元</SelectItem>
                  <SelectItem value="CNY">CNY - 人民币</SelectItem>
                  <SelectItem value="IDR">IDR - 印尼盾</SelectItem>
                  <SelectItem value="HKD">HKD - 港币</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>定价/政策说明</Label>
              <Textarea 
                placeholder="描述定价方式、结算条款等..."
                defaultValue={selectedRelation?.defaultPricingPolicyNote}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>协议附件</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">点击上传或拖拽文件</p>
                <p className="text-xs text-muted-foreground">支持 PDF、Word、Excel</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>状态 *</Label>
              <Select defaultValue={selectedRelation?.status || "ACTIVE"}>
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

export default function RelationsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RelationsContent />
    </Suspense>
  )
}
