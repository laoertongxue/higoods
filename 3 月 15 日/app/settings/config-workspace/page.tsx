"use client"

import { useState } from "react"
import { Search, Plus, Edit2, Trash2, ChevronRight, ChevronDown, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

// CW1｜配置工作台（左右分栏，全量数据 + 商品类目树）

type ConfigStatus = "ENABLED" | "DISABLED"

interface ConfigOption {
  code: string
  name_zh: string
  name_en?: string
  status: ConfigStatus
  sortOrder: number
}

interface CategoryNode {
  id: string
  code: string
  name_zh: string
  name_en?: string
  status: ConfigStatus
  sortOrder: number
  level: 1 | 2 | 3
  parent_id: string | null
  children?: CategoryNode[]
  product_count?: number // 模拟该类目下的商品数量
}

// 完整配置数据常量
const CONFIG_DATA = {
  brands: [
    { code: "Chicmore", name_zh: "Chicmore", name_en: "Chicmore", status: "ENABLED" as ConfigStatus, sortOrder: 1 },
    { code: "FADFAD", name_zh: "FADFAD", name_en: "FADFAD", status: "ENABLED" as ConfigStatus, sortOrder: 2 },
    { code: "Tendblank", name_zh: "Tendblank", name_en: "Tendblank", status: "ENABLED" as ConfigStatus, sortOrder: 3 },
    { code: "Asaya", name_zh: "Asaya", name_en: "Asaya", status: "ENABLED" as ConfigStatus, sortOrder: 4 },
    { code: "LUXME", name_zh: "LUXME", name_en: "LUXME", status: "ENABLED" as ConfigStatus, sortOrder: 5 },
    { code: "MODISH", name_zh: "MODISH", name_en: "MODISH", status: "ENABLED" as ConfigStatus, sortOrder: 6 },
    { code: "PRIMA", name_zh: "PRIMA", name_en: "PRIMA", status: "ENABLED" as ConfigStatus, sortOrder: 7 },
  ],
  styles: [
    { code: "casual", name_zh: "休闲", name_en: "Casual", status: "ENABLED" as ConfigStatus, sortOrder: 1 },
    { code: "vacation", name_zh: "度假", name_en: "Vacation", status: "ENABLED" as ConfigStatus, sortOrder: 2 },
    { code: "vintage", name_zh: "复古", name_en: "Vintage", status: "ENABLED" as ConfigStatus, sortOrder: 3 },
    { code: "runway", name_zh: "秀场", name_en: "Runway", status: "ENABLED" as ConfigStatus, sortOrder: 4 },
    { code: "evening", name_zh: "礼服", name_en: "Evening", status: "ENABLED" as ConfigStatus, sortOrder: 5 },
    { code: "socialite", name_zh: "名媛", name_en: "Socialite", status: "ENABLED" as ConfigStatus, sortOrder: 6 },
    { code: "office", name_zh: "通勤", name_en: "Office", status: "ENABLED" as ConfigStatus, sortOrder: 7 },
    { code: "elegant", name_zh: "优雅", name_en: "Elegant", status: "ENABLED" as ConfigStatus, sortOrder: 8 },
    { code: "sexy", name_zh: "性感", name_en: "Sexy", status: "ENABLED" as ConfigStatus, sortOrder: 9 },
    { code: "sweet", name_zh: "甜美", name_en: "Sweet", status: "ENABLED" as ConfigStatus, sortOrder: 10 },
    { code: "street", name_zh: "街头", name_en: "Street", status: "ENABLED" as ConfigStatus, sortOrder: 11 },
    { code: "preppy", name_zh: "学院", name_en: "Preppy", status: "ENABLED" as ConfigStatus, sortOrder: 12 },
    { code: "simple", name_zh: "简约", name_en: "Simple", status: "ENABLED" as ConfigStatus, sortOrder: 13 },
  ],
}

// 商品类目树形数据（模拟三级类目）
const CATEGORY_TREE: CategoryNode[] = [
  {
    id: "cat_1",
    code: "women",
    name_zh: "女装",
    name_en: "Women's Clothing",
    status: "ENABLED",
    sortOrder: 1,
    level: 1,
    parent_id: null,
    product_count: 0,
    children: [
      {
        id: "cat_1_1",
        code: "women_tops",
        name_zh: "上衣",
        name_en: "Tops",
        status: "ENABLED",
        sortOrder: 1,
        level: 2,
        parent_id: "cat_1",
        product_count: 0,
        children: [
          {
            id: "cat_1_1_1",
            code: "women_tshirt",
            name_zh: "T恤",
            name_en: "T-shirt",
            status: "ENABLED",
            sortOrder: 1,
            level: 3,
            parent_id: "cat_1_1",
            product_count: 15,
          },
          {
            id: "cat_1_1_2",
            code: "women_shirt",
            name_zh: "衬衫",
            name_en: "Shirt",
            status: "ENABLED",
            sortOrder: 2,
            level: 3,
            parent_id: "cat_1_1",
            product_count: 0,
          },
        ],
      },
      {
        id: "cat_1_2",
        code: "women_dress",
        name_zh: "连衣裙",
        name_en: "Dress",
        status: "ENABLED",
        sortOrder: 2,
        level: 2,
        parent_id: "cat_1",
        product_count: 0,
        children: [
          {
            id: "cat_1_2_1",
            code: "women_mini_dress",
            name_zh: "短款连衣裙",
            name_en: "Mini Dress",
            status: "ENABLED",
            sortOrder: 1,
            level: 3,
            parent_id: "cat_1_2",
            product_count: 0,
          },
        ],
      },
    ],
  },
  {
    id: "cat_2",
    code: "men",
    name_zh: "男装",
    name_en: "Men's Clothing",
    status: "ENABLED",
    sortOrder: 2,
    level: 1,
    parent_id: null,
    product_count: 0,
    children: [
      {
        id: "cat_2_1",
        code: "men_tops",
        name_zh: "上衣",
        name_en: "Tops",
        status: "ENABLED",
        sortOrder: 1,
        level: 2,
        parent_id: "cat_2",
        product_count: 0,
        children: [],
      },
    ],
  },
]

const DIMENSION_LIST = [
  { id: "category_tree", name: "商品类目", count: 0, type: "tree" },
  { id: "brands", name: "品牌", count: CONFIG_DATA.brands.length, type: "flat" },
  { id: "styles", name: "风格", count: CONFIG_DATA.styles.length, type: "flat" },
]

export default function ConfigWorkspacePage() {
  const [selectedDimension, setSelectedDimension] = useState<string>("category_tree")
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryData, setCategoryData] = useState<CategoryNode[]>(CATEGORY_TREE)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["cat_1", "cat_1_1"]))
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [parentForNew, setParentForNew] = useState<CategoryNode | null>(null)

  const dimensionType = DIMENSION_LIST.find((d) => d.id === selectedDimension)?.type || "flat"

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const canDeleteCategory = (node: CategoryNode): { canDelete: boolean; reason?: string } => {
    // 必须是叶子节点
    if (node.children && node.children.length > 0) {
      return { canDelete: false, reason: "该类目下有子类目，不能删除" }
    }
    // 该类目下没有商品
    if (node.product_count && node.product_count > 0) {
      return { canDelete: false, reason: `该类目下有 ${node.product_count} 个商品，不能删除` }
    }
    return { canDelete: true }
  }

  const handleDeleteCategory = (node: CategoryNode) => {
    const check = canDeleteCategory(node)
    if (!check.canDelete) {
      alert(check.reason)
      return
    }
    // 实际删除逻辑（这里仅模拟）
    alert(`删除类目: ${node.name_zh}`)
  }

  const renderCategoryTree = (nodes: CategoryNode[], level: number = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedNodes.has(node.id)
      const hasChildren = node.children && node.children.length > 0
      const check = canDeleteCategory(node)

      return (
        <div key={node.id}>
          <div
            className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded"
            style={{ paddingLeft: `${level * 24 + 12}px` }}
          >
            <button
              type="button"
              onClick={() => toggleNode(node.id)}
              className="w-5 h-5 flex items-center justify-center"
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              ) : (
                <span className="w-4" />
              )}
            </button>
            <div className="flex-1 flex items-center gap-2">
              <span className="font-medium">{node.name_zh}</span>
              <span className="text-sm text-muted-foreground">({node.code})</span>
              {node.product_count !== undefined && node.product_count > 0 && (
                <Badge variant="secondary">{node.product_count}个商品</Badge>
              )}
              <Badge variant={node.status === "ENABLED" ? "default" : "secondary"}>{node.status === "ENABLED" ? "启用" : "停用"}</Badge>
              <span className="text-xs text-muted-foreground">L{node.level}</span>
            </div>
            <div className="flex items-center gap-1">
              {node.level < 3 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setParentForNew(node)
                    setIsAddingCategory(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setEditingCategory(node)}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteCategory(node)}
                disabled={!check.canDelete}
                title={check.reason}
              >
                <Trash2 className={`h-4 w-4 ${check.canDelete ? "text-red-600" : "text-gray-400"}`} />
              </Button>
            </div>
          </div>
          {isExpanded && hasChildren && renderCategoryTree(node.children!, level + 1)}
        </div>
      )
    })
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* 左侧：维度列表 */}
      <div className="w-64 bg-white border-r p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">配置维度</h2>
        <div className="space-y-1">
          {DIMENSION_LIST.map((dim) => (
            <button
              key={dim.id}
              type="button"
              onClick={() => {
                setSelectedDimension(dim.id)
                setSearchTerm("")
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between ${
                selectedDimension === dim.id ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-gray-100"
              }`}
            >
              <span>{dim.name}</span>
              {dim.type === "flat" && (
                <Badge variant="outline" className="ml-2">
                  {dim.count}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧：配置内容区 */}
      <div className="flex-1 p-6 overflow-y-auto">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold">
                {DIMENSION_LIST.find((d) => d.id === selectedDimension)?.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {dimensionType === "tree" ? "树形结构管理，支持三级类目" : "配置项管理"}
              </p>
            </div>
            {dimensionType === "tree" && (
              <Button
                onClick={() => {
                  setParentForNew(null)
                  setIsAddingCategory(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                新建一级类目
              </Button>
            )}
          </div>

          {selectedDimension === "category_tree" && (
            <div className="space-y-2">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  删除规则：只能删除叶子类目（没有子类目）且该类目下没有商品的类目
                </AlertDescription>
              </Alert>
              <div className="border rounded-lg bg-white">{renderCategoryTree(categoryData)}</div>
            </div>
          )}

          {selectedDimension !== "category_tree" && (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索 code 或名称"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新建配置项
                </Button>
              </div>
              <div className="text-center text-muted-foreground py-8">选择左侧维度查看配置项</div>
            </div>
          )}
        </Card>
      </div>

      {/* 编辑类目抽屉 */}
      <Sheet open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>编辑类目</SheetTitle>
            <SheetDescription>修改类目基本信息</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <Label>类目层级</Label>
              <div className="mt-2 text-sm text-muted-foreground">
                L{editingCategory?.level} - {editingCategory?.level === 1 ? "一级类目" : editingCategory?.level === 2 ? "二级类目" : "三级类目"}
              </div>
            </div>
            <div>
              <Label>Code</Label>
              <Input
                value={editingCategory?.code || ""}
                onChange={(e) =>
                  setEditingCategory((prev) => (prev ? { ...prev, code: e.target.value } : null))
                }
                placeholder="输入 code"
              />
            </div>
            <div>
              <Label>中文名称</Label>
              <Input
                value={editingCategory?.name_zh || ""}
                onChange={(e) =>
                  setEditingCategory((prev) => (prev ? { ...prev, name_zh: e.target.value } : null))
                }
                placeholder="输入中文名称"
              />
            </div>
            <div>
              <Label>英文名称</Label>
              <Input
                value={editingCategory?.name_en || ""}
                onChange={(e) =>
                  setEditingCategory((prev) => (prev ? { ...prev, name_en: e.target.value } : null))
                }
                placeholder="输入英文名称（可选）"
              />
            </div>
            <div>
              <Label>排序</Label>
              <Input
                type="number"
                value={editingCategory?.sortOrder || 0}
                onChange={(e) =>
                  setEditingCategory((prev) =>
                    prev ? { ...prev, sortOrder: Number.parseInt(e.target.value) || 0 } : null
                  )
                }
              />
            </div>
            <div>
              <Label>状态</Label>
              <Select
                value={editingCategory?.status || "ENABLED"}
                onValueChange={(value) =>
                  setEditingCategory((prev) =>
                    prev ? { ...prev, status: value as ConfigStatus } : null
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENABLED">启用</SelectItem>
                  <SelectItem value="DISABLED">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => setEditingCategory(null)}>
              保存
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 新建类目抽屉 */}
      <Sheet open={isAddingCategory} onOpenChange={() => setIsAddingCategory(false)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>新建类目</SheetTitle>
            <SheetDescription>
              {parentForNew
                ? `在 "${parentForNew.name_zh}" 下新建 L${parentForNew.level + 1} 类目`
                : "新建一级类目"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <Label>Code</Label>
              <Input placeholder="输入 code" />
            </div>
            <div>
              <Label>中文名称</Label>
              <Input placeholder="输入中文名称" />
            </div>
            <div>
              <Label>英文名称</Label>
              <Input placeholder="输入英文名称（可选）" />
            </div>
            <div>
              <Label>排序</Label>
              <Input type="number" defaultValue={1} />
            </div>
            <Button className="w-full" onClick={() => setIsAddingCategory(false)}>
              创建
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
