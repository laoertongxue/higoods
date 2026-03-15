"use client"

import { useState } from "react"
import Link from "next/link"
import { PmsSidebarNav } from "@/components/pms-sidebar-nav"
import { PmsSystemNav } from "@/components/pms-system-nav"
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
  MoreHorizontal,
  Eye,
  CheckCircle,
  Truck,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

const orders = [
  {
    id: "PO-2025-001050",
    requirementId: "PR-2025-000387",
    type: "测款采购",
    objectType: "样衣",
    supplier: "淘宝电商平台",
    productName: "连衣裙",
    skuCode: "SK2025-031",
    spec: "M / L / XL 混码",
    quantity: 300,
    availableStock: 620,
    suggestedQty: 300,
    expectedDate: "2025-03-30",
    status: "approved",
    estimatedAmount: 22500,
    creator: "采购系统 / 张琳",
    createdAt: "2025-03-22 15:00",
  },
  {
    id: "PO-2025-001060",
    requirementId: "PR-2025-000412",
    type: "备货采购",
    objectType: "面料",
    supplier: "浙江布业有限公司",
    productName: "40S 精梳棉面料（白色）",
    skuCode: "FAB-2025-001",
    spec: "标准卷布",
    quantity: 250,
    availableStock: 450,
    suggestedQty: 200,
    expectedDate: "2025-04-10",
    status: "approved",
    estimatedAmount: 9000,
    creator: "采购系统 / 李伟",
    createdAt: "2025-03-22 10:15",
  },
  {
    id: "PO-2025-001080",
    requirementId: "PR-2025-000420",
    type: "手工采购",
    objectType: "样衣",
    supplier: "京东电商平台",
    productName: "衬衫",
    skuCode: "SK2025-045",
    spec: "S / M / L 混码",
    quantity: 50,
    availableStock: 20,
    suggestedQty: 30,
    expectedDate: "2025-03-28",
    status: "approved",
    estimatedAmount: 3750,
    creator: "采购系统 / 刘晨",
    createdAt: "2025-03-23 09:20",
  },
  {
    id: "PO-2025-001055",
    requirementId: "PR-2025-000392",
    type: "测款采购",
    objectType: "样衣",
    supplier: "1688批发平台",
    productName: "波西米亚风格长裙",
    skuCode: "SK2025-048",
    spec: "M / L / XL 混码",
    quantity: 200,
    availableStock: 450,
    suggestedQty: 200,
    expectedDate: "2025-04-02",
    status: "ordered",
    estimatedAmount: 16000,
    creator: "采购系统 / 李伟",
    createdAt: "2025-03-23 10:30",
  },
  {
    id: "PO-2025-001065",
    requirementId: "PR-2025-000418",
    type: "备货采购",
    objectType: "辅料",
    supplier: "苏州辅料供应商",
    productName: "涤纶里布（黑色）",
    skuCode: "FAB-2025-015",
    spec: "标准卷布",
    quantity: 800,
    availableStock: 800,
    suggestedQty: 400,
    expectedDate: "2025-04-12",
    status: "completed",
    estimatedAmount: 9600,
    creator: "生产系统 / 王芳",
    createdAt: "2025-03-25 14:00",
  },
  {
    id: "PO-2025-001070",
    requirementId: "PR-2025-000405",
    type: "手工采购",
    objectType: "纱线",
    supplier: "东莞纱线厂",
    productName: "32支棉纱（本白）",
    skuCode: "YRN-2025-008",
    spec: "标准卷",
    quantity: 1000,
    availableStock: 200,
    suggestedQty: 800,
    expectedDate: "2025-04-15",
    status: "pending",
    estimatedAmount: 45000,
    creator: "张琳",
    createdAt: "2025-03-26 11:00",
  },
  {
    id: "PO-2025-001075",
    requirementId: "PR-2025-000421",
    type: "手工采购",
    objectType: "设备",
    supplier: "杰克缝纫机",
    productName: "平缝机 JK-9100B",
    skuCode: "EQP-2025-002",
    spec: "标准配置",
    quantity: 5,
    availableStock: 2,
    suggestedQty: 5,
    expectedDate: "2025-04-20",
    status: "draft",
    estimatedAmount: 35000,
    creator: "王芳",
    createdAt: "2025-03-27 09:00",
  },
  {
    id: "PO-2025-001082",
    requirementId: "PR-2025-000425",
    type: "备货采购",
    objectType: "耗材",
    supplier: "深圳包材厂",
    productName: "快递袋（中号）",
    skuCode: "PKG-2025-012",
    spec: "28x42cm",
    quantity: 5000,
    availableStock: 2000,
    suggestedQty: 3000,
    expectedDate: "2025-04-05",
    status: "partial",
    estimatedAmount: 2500,
    creator: "采购系统 / 李伟",
    createdAt: "2025-03-28 09:30",
  },
]

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  pending: { label: "待审批", variant: "default" },
  approved: { label: "已批准", variant: "outline" },
  ordered: { label: "已下单", variant: "outline" },
  partial: { label: "已部分到货", variant: "default" },
  completed: { label: "已完成", variant: "outline" },
  closed: { label: "已关闭", variant: "destructive" },
}

export default function PurchaseOrdersPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [objectTypeFilter, setObjectTypeFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supplier.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesType = typeFilter === "all" || order.type === typeFilter
    const matchesObjectType = objectTypeFilter === "all" || order.objectType === objectTypeFilter
    return matchesSearch && matchesStatus && matchesType && matchesObjectType
  })

  const totalPages = Math.ceil(filteredOrders.length / pageSize)
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <PmsSystemNav />
      <div className="flex flex-1 overflow-hidden">
        <PmsSidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">采购订单列表</h1>
              <p className="text-sm text-muted-foreground mt-1">管理所有采购订单，跟踪订单执行状态</p>
            </div>
            <Button>新建采购订单</Button>
          </div>

          {/* Search and Filter */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  查询条件
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("")
                      setStatusFilter("all")
                      setTypeFilter("all")
                      setObjectTypeFilter("all")
                      setSupplierFilter("all")
                    }}
                  >
                    清空
                  </Button>
                  <Button size="sm">查询</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                    {showFilters ? "收起" : "展开"}
                    {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索订单编号、商品名称、供应商..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="订单状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="pending">待审批</SelectItem>
                    <SelectItem value="approved">已批准</SelectItem>
                    <SelectItem value="ordered">已下单</SelectItem>
                    <SelectItem value="partial">已部分到货</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="closed">已关闭</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="采购类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="测款采购">测款采购</SelectItem>
                    <SelectItem value="备货采购">备货采购</SelectItem>
                    <SelectItem value="手工采购">手工采购</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={objectTypeFilter} onValueChange={setObjectTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="采购对象" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部对象</SelectItem>
                    <SelectItem value="样衣">样衣</SelectItem>
                    <SelectItem value="面料">面料</SelectItem>
                    <SelectItem value="辅料">辅料</SelectItem>
                    <SelectItem value="纱线">纱线</SelectItem>
                    <SelectItem value="耗材">耗材</SelectItem>
                    <SelectItem value="设备">设备</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {showFilters && (
                <div className="grid grid-cols-4 gap-4 pt-2 border-t">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">供应商 / 平台</label>
                    <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择供应商" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="淘宝电商平台">淘宝电商平台</SelectItem>
                        <SelectItem value="京东电商平台">京东电商平台</SelectItem>
                        <SelectItem value="1688批发平台">1688批发平台</SelectItem>
                        <SelectItem value="浙江布业有限公司">浙江布业有限公司</SelectItem>
                        <SelectItem value="苏州辅料供应商">苏州辅料供应商</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">创建时间起</label>
                    <Input type="date" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">创建时间止</label>
                    <Input type="date" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">预计到货时间</label>
                    <Input type="date" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">
                  数据列表
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    共 {filteredOrders.length} 条记录
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium whitespace-nowrap">采购订单编号</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap">关联采购需求</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap">采购类型</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap">采购对象类型</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap">供应商/平台</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap">关联商品/物料</th>
                      <th className="text-right p-3 font-medium whitespace-nowrap">采购数量</th>
                      <th className="text-right p-3 font-medium whitespace-nowrap">当前可用库存</th>
                      <th className="text-right p-3 font-medium whitespace-nowrap">建议采购数量</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap">预计到货时间</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap">订单状态</th>
                      <th className="text-right p-3 font-medium whitespace-nowrap">预估采购金额</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap">创建人</th>
                      <th className="text-left p-3 font-medium whitespace-nowrap">创建时间</th>
                      <th className="text-center p-3 font-medium whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map((order) => (
                      <tr key={order.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 whitespace-nowrap">
                          <Link href={`/pms/orders/${order.id}`} className="text-primary hover:underline font-medium">
                            {order.id}
                          </Link>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Link
                            href={`/pms/requirements/${order.requirementId}`}
                            className="text-muted-foreground hover:text-primary hover:underline"
                          >
                            {order.requirementId}
                          </Link>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={
                              order.type === "测款采购"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : order.type === "备货采购"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                            }
                          >
                            {order.type}
                          </Badge>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge
                            variant="secondary"
                            className={
                              order.objectType === "样衣"
                                ? "bg-purple-100 text-purple-700"
                                : order.objectType === "面料"
                                  ? "bg-blue-100 text-blue-700"
                                  : order.objectType === "辅料"
                                    ? "bg-green-100 text-green-700"
                                    : order.objectType === "纱线"
                                      ? "bg-orange-100 text-orange-700"
                                      : order.objectType === "耗材"
                                        ? "bg-cyan-100 text-cyan-700"
                                        : order.objectType === "设备"
                                          ? "bg-slate-100 text-slate-700"
                                          : ""
                            }
                          >
                            {order.objectType}
                          </Badge>
                        </td>
                        <td
                          className="p-3 text-muted-foreground max-w-[150px] truncate whitespace-nowrap"
                          title={order.supplier}
                        >
                          {order.supplier}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-medium">{order.productName}</div>
                          <div className="text-xs text-muted-foreground">{order.skuCode}</div>
                        </td>
                        <td className="p-3 text-right font-medium whitespace-nowrap">
                          {order.quantity.toLocaleString()}{" "}
                          {order.objectType === "面料" || order.objectType === "辅料"
                            ? "米"
                            : order.objectType === "纱线"
                              ? "kg"
                              : "件"}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {order.availableStock.toLocaleString()}{" "}
                          {order.objectType === "面料" || order.objectType === "辅料"
                            ? "米"
                            : order.objectType === "纱线"
                              ? "kg"
                              : "件"}
                        </td>
                        <td className="p-3 text-right font-medium text-primary whitespace-nowrap">
                          {order.suggestedQty.toLocaleString()}{" "}
                          {order.objectType === "面料" || order.objectType === "辅料"
                            ? "米"
                            : order.objectType === "纱线"
                              ? "kg"
                              : "件"}
                        </td>
                        <td className="p-3 whitespace-nowrap">{order.expectedDate}</td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge
                            variant={statusConfig[order.status].variant}
                            className={
                              order.status === "approved"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : order.status === "pending"
                                  ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : order.status === "ordered"
                                    ? "bg-blue-100 text-blue-700 border-blue-200"
                                    : order.status === "partial"
                                      ? "bg-purple-100 text-purple-700 border-purple-200"
                                      : order.status === "completed"
                                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                        : order.status === "closed"
                                          ? "bg-red-100 text-red-700 border-red-200"
                                          : ""
                            }
                          >
                            {statusConfig[order.status].label}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-medium whitespace-nowrap">
                          ¥{order.estimatedAmount.toLocaleString()}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{order.creator}</td>
                        <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{order.createdAt}</td>
                        <td className="p-3 whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/pms/orders/${order.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  查看详情
                                </Link>
                              </DropdownMenuItem>
                              {order.status === "pending" && (
                                <DropdownMenuItem>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  审批
                                </DropdownMenuItem>
                              )}
                              {order.status === "approved" && (
                                <DropdownMenuItem>
                                  <Truck className="h-4 w-4 mr-2" />
                                  生成发货/入库单
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive">
                                <XCircle className="h-4 w-4 mr-2" />
                                关闭订单
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredOrders.length)}{" "}
                  条，共 {filteredOrders.length} 条
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8"
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
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
