"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import {
  Search,
  Plus,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Coins,
  BookOpen,
  Layers,
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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

// CC1｜币种列表页 + CC2｜币种详情页

// Mock 币种数据
const mockCurrencies = [
  {
    code: "USD",
    nameCn: "美元",
    nameEn: "US Dollar",
    symbol: "$",
    minorUnit: 2,
    status: "ACTIVE",
    isGroupCurrency: true,
    usedByLedgers: ["GL_MGMT_USD", "GL_HK_USD"],
    usedByPolicies: ["POLICY_BANK_SPOT_USD", "POLICY_PLATFORM_SPOT_USD"],
    rateCount: 0,
    createdAt: "2025-01-01",
    updatedAt: "2026-01-15",
  },
  {
    code: "CNY",
    nameCn: "人民币",
    nameEn: "Chinese Yuan",
    symbol: "¥",
    minorUnit: 2,
    status: "ACTIVE",
    isGroupCurrency: false,
    usedByLedgers: ["GL_CN_BJ_CNY", "GL_CN_SZ_CNY"],
    usedByPolicies: ["POLICY_ARAP_END_PERIOD_USD"],
    rateCount: 52,
    createdAt: "2025-01-01",
    updatedAt: "2026-01-21",
  },
  {
    code: "IDR",
    nameCn: "印尼盾",
    nameEn: "Indonesian Rupiah",
    symbol: "Rp",
    minorUnit: 0,
    status: "ACTIVE",
    isGroupCurrency: false,
    usedByLedgers: ["GL_ID_BDG_IDR", "GL_ID_JKT_IDR"],
    usedByPolicies: ["POLICY_MARGIN_DAILY_SPOT_USD"],
    rateCount: 52,
    createdAt: "2025-01-01",
    updatedAt: "2026-01-21",
  },
]

function CurrenciesPageContent() {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedCurrency, setSelectedCurrency] = useState<(typeof mockCurrencies)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editMode, setEditMode] = useState<"create" | "edit">("create")
  const [activeTab, setActiveTab] = useState("info")

  // 编辑表单
  const [formData, setFormData] = useState({
    code: "",
    nameCn: "",
    nameEn: "",
    symbol: "",
    minorUnit: 2,
    status: "ACTIVE",
  })

  // 筛选
  const filteredCurrencies = mockCurrencies.filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false
    if (searchKeyword && !c.code.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !c.nameCn.includes(searchKeyword) && !c.nameEn.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openDetail = (currency: typeof mockCurrencies[0]) => {
    setSelectedCurrency(currency)
    setDetailOpen(true)
    setActiveTab("info")
  }

  const openEdit = (currency?: typeof mockCurrencies[0]) => {
    if (currency) {
      setEditMode("edit")
      setFormData({
        code: currency.code,
        nameCn: currency.nameCn,
        nameEn: currency.nameEn,
        symbol: currency.symbol,
        minorUnit: currency.minorUnit,
        status: currency.status,
      })
    } else {
      setEditMode("create")
      setFormData({ code: "", nameCn: "", nameEn: "", symbol: "", minorUnit: 2, status: "ACTIVE" })
    }
    setEditOpen(true)
  }

  const handleSave = () => {
    if (!formData.code || !formData.nameCn) {
      toast.error("请填写必填项")
      return
    }
    if (!/^[A-Z]{3}$/.test(formData.code)) {
      toast.error("币种代码必须为3位大写字母")
      return
    }
    toast.success(editMode === "create" ? "币种创建成功" : "币种更新成功")
    setEditOpen(false)
  }

  return (
    <Suspense fallback={<Loading />}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">币种管理</h1>
          <p className="text-muted-foreground">管理集团可用币种，包含ISO代码、名称、小数位与启用状态</p>
        </div>
        <Button size="sm" onClick={() => openEdit()}>
          <Plus className="h-4 w-4 mr-2" />
          新增币种
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Coins className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{mockCurrencies.length}</div>
                <div className="text-sm text-muted-foreground">币种总数</div>
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
                  {mockCurrencies.filter((c) => c.status === "ACTIVE").length}
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
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">6</div>
                <div className="text-sm text-muted-foreground">关联账本</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Layers className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">7</div>
                <div className="text-sm text-muted-foreground">关联策略</div>
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
                placeholder="搜索币种代码/名称..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
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
                <TableHead>币种代码</TableHead>
                <TableHead>中文名称</TableHead>
                <TableHead>英文名称</TableHead>
                <TableHead>符号</TableHead>
                <TableHead className="text-center">小数位</TableHead>
                <TableHead>集团报告币</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCurrencies.map((currency) => (
                <TableRow key={currency.code}>
                  <TableCell className="font-mono font-bold">{currency.code}</TableCell>
                  <TableCell>{currency.nameCn}</TableCell>
                  <TableCell className="text-muted-foreground">{currency.nameEn}</TableCell>
                  <TableCell className="font-mono">{currency.symbol}</TableCell>
                  <TableCell className="text-center">{currency.minorUnit}</TableCell>
                  <TableCell>
                    {currency.isGroupCurrency ? (
                      <Badge className="bg-primary/10 text-primary">是</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={currency.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                      {currency.status === "ACTIVE" ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{currency.updatedAt}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(currency)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(currency)}>
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

      {/* CC2 币种详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <span className="font-mono text-2xl">{selectedCurrency?.code}</span>
              <span>{selectedCurrency?.nameCn}</span>
              {selectedCurrency?.isGroupCurrency && (
                <Badge className="bg-primary/10 text-primary">集团报告币</Badge>
              )}
            </SheetTitle>
            <SheetDescription>{selectedCurrency?.nameEn}</SheetDescription>
          </SheetHeader>

          {selectedCurrency && (
            <div className="mt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="info">基本信息</TabsTrigger>
                  <TabsTrigger value="ledgers">关联账本</TabsTrigger>
                  <TabsTrigger value="policies">关联策略</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">币种代码</div>
                      <div className="font-mono font-bold mt-1">{selectedCurrency.code}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">符号</div>
                      <div className="font-mono font-bold mt-1">{selectedCurrency.symbol}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">中文名称</div>
                      <div className="font-medium mt-1">{selectedCurrency.nameCn}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">英文名称</div>
                      <div className="font-medium mt-1">{selectedCurrency.nameEn}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">小数位</div>
                      <div className="font-mono font-bold mt-1">{selectedCurrency.minorUnit}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">状态</div>
                      <div className="mt-1">
                        <Badge className={selectedCurrency.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                          {selectedCurrency.status === "ACTIVE" ? "启用" : "停用"}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">创建时间</div>
                      <div className="font-medium mt-1">{selectedCurrency.createdAt}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm text-muted-foreground">更新时间</div>
                      <div className="font-medium mt-1">{selectedCurrency.updatedAt}</div>
                    </div>
                  </div>

                  {selectedCurrency.rateCount > 0 && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-blue-800">汇率记录</span>
                      </div>
                      <p className="text-sm text-blue-700">
                        该币种共有 <strong>{selectedCurrency.rateCount}</strong> 条汇率记录
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ledgers" className="space-y-4">
                  <p className="text-sm text-muted-foreground">以下账本使用此币种作为本位币</p>
                  <div className="space-y-2">
                    {selectedCurrency.usedByLedgers.map((ledger) => (
                      <div key={ledger} className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono">{ledger}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="policies" className="space-y-4">
                  <p className="text-sm text-muted-foreground">以下策略引用此币种</p>
                  <div className="space-y-2">
                    {selectedCurrency.usedByPolicies.map((policy) => (
                      <div key={policy} className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                        <Layers className="h-5 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{policy}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 新建/编辑币种抽屉 */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editMode === "create" ? "新增币种" : "编辑币种"}</SheetTitle>
            <SheetDescription>
              {editMode === "create" ? "创建新的可用币种" : "修改币种信息"}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>币种代码 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="如 USD、CNY、IDR"
                maxLength={3}
                disabled={editMode === "edit"}
              />
              <p className="text-xs text-muted-foreground">ISO 4217标准，3位大写字母</p>
            </div>

            <div className="space-y-2">
              <Label>中文名称 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.nameCn}
                onChange={(e) => setFormData({ ...formData, nameCn: e.target.value })}
                placeholder="如 美元、人民币"
              />
            </div>

            <div className="space-y-2">
              <Label>英文名称</Label>
              <Input
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder="如 US Dollar"
              />
            </div>

            <div className="space-y-2">
              <Label>符号</Label>
              <Input
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="如 $、¥、Rp"
                maxLength={10}
              />
            </div>

            <div className="space-y-2">
              <Label>小数位</Label>
              <Select
                value={String(formData.minorUnit)}
                onValueChange={(v) => setFormData({ ...formData, minorUnit: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 位（如 IDR）</SelectItem>
                  <SelectItem value="2">2 位（如 USD、CNY）</SelectItem>
                  <SelectItem value="3">3 位</SelectItem>
                  <SelectItem value="4">4 位</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label>启用状态</Label>
                <p className="text-xs text-muted-foreground">停用后将无法在新汇率/策略中使用</p>
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
    </Suspense>
  )
}

export default function CurrenciesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CurrenciesPageContent />
    </Suspense>
  )
}
