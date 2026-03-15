"use client"

import { useState } from "react"
import Link from "next/link"
import { PmsSystemNav } from "@/components/pms-system-nav"
import { PmsSidebarNav } from "@/components/pms-sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Download,
  Upload,
  MoreHorizontal,
  Eye,
  Send,
  FileText,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

// 采购需求状态
const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  pending_approval: { label: "待审批", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "已批准", color: "bg-green-100 text-green-700" },
  order_generated: { label: "已生成采购订单", color: "bg-blue-100 text-blue-700" },
  closed: { label: "已关闭", color: "bg-gray-100 text-gray-500" },
}

// 需求类型
const requirementTypes: Record<string, { label: string; color: string }> = {
  testing: { label: "测款采购", color: "bg-purple-100 text-purple-700" },
  stocking: { label: "备货采购", color: "bg-cyan-100 text-cyan-700" },
  general: { label: "通用采购", color: "bg-gray-100 text-gray-700" },
}

// 模拟数据
const requirements = [
  {
    id: "PR-2025-000387",
    type: "testing",
    source: "直播测款（场次：2025-03-春夏专场）",
    relatedObject: {
      type: "garment",
      name: "印尼风格碎花连衣裙",
      code: "SK2025-031",
    },
    quantity: 3200,
    unit: "件",
    currentStock: 620,
    suggestedQuantity: 2600,
    estimatedAmount: 182000,
    expectedDelivery: "2025-04-05",
    status: "pending_approval",
    creator: "商品中心系统",
    createdAt: "2025-03-22 14:36",
  },
  {
    id: "PR-2025-000386",
    type: "stocking",
    source: "库存预警",
    relatedObject: {
      type: "material",
      name: "40S 精梳棉面料（白色）",
      code: "FAB-2025-0089",
    },
    quantity: 5000,
    unit: "米",
    currentStock: 1200,
    suggestedQuantity: 3800,
    estimatedAmount: 95000,
    expectedDelivery: "2025-04-10",
    status: "approved",
    creator: "李明",
    createdAt: "2025-03-21 10:22",
  },
  {
    id: "PR-2025-000385",
    type: "testing",
    source: "直播测款（场次：2025-03-春夏专场）",
    relatedObject: {
      type: "garment",
      name: "基础款白T恤",
      code: "SK2025-028",
    },
    quantity: 1500,
    unit: "件",
    currentStock: 300,
    suggestedQuantity: 1200,
    estimatedAmount: 36000,
    expectedDelivery: "2025-04-03",
    status: "order_generated",
    creator: "商品中心系统",
    createdAt: "2025-03-20 16:45",
  },
  {
    id: "PR-2025-000384",
    type: "general",
    source: "手工创建",
    relatedObject: {
      type: "material",
      name: "YKK拉链 5# 金属",
      code: "ACC-2025-0156",
    },
    quantity: 10000,
    unit: "条",
    currentStock: 2500,
    suggestedQuantity: 7500,
    estimatedAmount: 22500,
    expectedDelivery: "2025-04-15",
    status: "draft",
    creator: "王芳",
    createdAt: "2025-03-22 09:15",
  },
  {
    id: "PR-2025-000383",
    type: "stocking",
    source: "库存预警",
    relatedObject: {
      type: "material",
      name: "涤纶缝纫线（黑色）",
      code: "ACC-2025-0078",
    },
    quantity: 200,
    unit: "卷",
    currentStock: 50,
    suggestedQuantity: 150,
    estimatedAmount: 4500,
    expectedDelivery: "2025-04-08",
    status: "closed",
    creator: "系统自动",
    createdAt: "2025-03-19 11:30",
  },
]

// 物料类型
const materialTypes = [
  { value: "all", label: "全部类型" },
  { value: "garment", label: "成衣" },
  { value: "fabric", label: "面料" },
  { value: "accessory", label: "辅料" },
  { value: "yarn", label: "纱线" },
  { value: "consumable", label: "耗材" },
  { value: "equipment", label: "设备" },
]

export default function ProcurementRequirementsPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [materialTypeFilter, setMaterialTypeFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // 筛选逻辑
  const filteredRequirements = requirements.filter((req) => {
    if (
      searchTerm &&
      !req.id.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !req.relatedObject.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false
    }
    if (typeFilter !== "all" && req.type !== typeFilter) return false
    if (statusFilter !== "all" && req.status !== statusFilter) return false
    return true
  })

  const totalPages = Math.ceil(filteredRequirements.length / pageSize)
  const paginatedRequirements = filteredRequirements.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const resetFilters = () => {
    setTypeFilter("all")
    setStatusFilter("all")
    setSourceFilter("all")
    setMaterialTypeFilter("all")
    setSearchTerm("")
  }

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <PmsSystemNav />

      <div className="flex flex-1 overflow-hidden">
        <PmsSidebarNav />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 页面标题 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">采购需求列表</h1>
              <p className="text-sm text-muted-foreground mt-1">管理所有采购需求，支持测款采购、备货采购等多种来源</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                批量导入
              </Button>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                新建采购需求
              </Button>
            </div>
          </div>

          {/* 查询条件区 */}
          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  查询条件
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    清空
                  </Button>
                  <Button size="sm">
                    <Search className="w-4 h-4 mr-2" />
                    查询
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                    {showFilters ? (
                      <>
                        收起 <ChevronUp className="w-4 h-4 ml-1" />
                      </>
                    ) : (
                      <>
                        展开 <ChevronDown className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* 基础筛选 */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">采购需求编号</label>
                  <Input
                    placeholder="输入编号搜索"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">需求类型</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      <SelectItem value="testing">测款采购</SelectItem>
                      <SelectItem value="stocking">备货采购</SelectItem>
                      <SelectItem value="general">通用采购</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">需求状态</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="pending_approval">待审批</SelectItem>
                      <SelectItem value="approved">已批准</SelectItem>
                      <SelectItem value="order_generated">已生成采购订单</SelectItem>
                      <SelectItem value="closed">已关闭</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">需求来源</label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部来源" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部来源</SelectItem>
                      <SelectItem value="testing">直播测款</SelectItem>
                      <SelectItem value="stock_warning">库存预警</SelectItem>
                      <SelectItem value="manual">手工创建</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 高级筛选 */}
              {showFilters && (
                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">物料类型</label>
                    <Select value={materialTypeFilter} onValueChange={setMaterialTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="全部类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {materialTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">创建时间</label>
                    <Input type="date" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">期望到货时间</label>
                    <Input type="date" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 数据列表区 */}
          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  数据列表
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    共 {filteredRequirements.length} 条
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    导出
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 text-sm font-medium">采购需求编号</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">需求类型</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">需求来源</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">关联对象</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">需求数量</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">当前库存</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">建议采购</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">预估金额</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">期望到货</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">状态</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">创建人</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">创建时间</th>
                      <th className="text-center py-3 px-4 text-sm font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequirements.map((req) => (
                      <tr key={req.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <Link
                            href={`/pms/requirements/${req.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {req.id}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={requirementTypes[req.type].color}>{requirementTypes[req.type].label}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">{req.source}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{req.relatedObject.name}</span>
                            <span className="text-xs text-muted-foreground">{req.relatedObject.code}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {req.quantity.toLocaleString()} {req.unit}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">
                          {req.currentStock.toLocaleString()} {req.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-primary">
                          {req.suggestedQuantity.toLocaleString()} {req.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">¥{req.estimatedAmount.toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm">{req.expectedDelivery}</td>
                        <td className="py-3 px-4">
                          <Badge className={statusConfig[req.status].color}>{statusConfig[req.status].label}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">{req.creator}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{req.createdAt}</td>
                        <td className="py-3 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/pms/requirements/${req.id}`}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  查看详情
                                </Link>
                              </DropdownMenuItem>
                              {req.status === "draft" && (
                                <DropdownMenuItem>
                                  <Send className="w-4 h-4 mr-2" />
                                  提交审批
                                </DropdownMenuItem>
                              )}
                              {req.status === "approved" && (
                                <DropdownMenuItem>
                                  <FileText className="w-4 h-4 mr-2" />
                                  生成采购订单
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-red-600">
                                <XCircle className="w-4 h-4 mr-2" />
                                关闭需求
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  显示 {(currentPage - 1) * pageSize + 1} -{" "}
                  {Math.min(currentPage * pageSize, filteredRequirements.length)} 条， 共 {filteredRequirements.length}{" "}
                  条
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
