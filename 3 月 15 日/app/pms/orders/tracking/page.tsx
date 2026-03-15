"use client"

import { useState } from "react"
import Link from "next/link"
import { PmsSidebarNav } from "@/components/pms-sidebar-nav"
import { PmsSystemNav } from "@/components/pms-system-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ChevronDown,
  ChevronUp,
  Search,
  MoreHorizontal,
  Eye,
  Package,
  FileInput,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

const trackingOrders = [
  {
    id: "PO-2025-001050",
    type: "测款采购",
    objectType: "样衣",
    requirementId: "PR-2025-000387",
    supplierPlatform: "淘宝电商平台",
    product: "连衣裙 / SK2025-031",
    orderDate: "2025-03-22",
    quantity: 300,
    arrivedQty: 0,
    inboundQty: 0,
    inTransitQty: 300,
    availableStock: 620,
    expectedDate: "2025-03-30",
    status: "已下单",
    arrivalStatus: "未到",
    creator: "采购系统 / 张琳",
  },
  {
    id: "PO-2025-001048",
    type: "备货采购",
    objectType: "面料",
    requirementId: "PR-2025-000385",
    supplierPlatform: "杭州锦绣纺织",
    product: "真丝印花面料 / FAB-2025-088",
    orderDate: "2025-03-20",
    quantity: 500,
    arrivedQty: 200,
    inboundQty: 200,
    inTransitQty: 300,
    availableStock: 1200,
    expectedDate: "2025-03-28",
    status: "已部分到货",
    arrivalStatus: "部分到货",
    creator: "李明",
  },
  {
    id: "PO-2025-001045",
    type: "手工采购",
    objectType: "样衣",
    requirementId: "PR-2025-000380",
    supplierPlatform: "京东电商平台",
    product: "针织开衫 / SK2025-028",
    orderDate: "2025-03-18",
    quantity: 150,
    arrivedQty: 150,
    inboundQty: 150,
    inTransitQty: 0,
    availableStock: 480,
    expectedDate: "2025-03-25",
    status: "已完成",
    arrivalStatus: "已完成",
    creator: "王芳",
  },
  {
    id: "PO-2025-001042",
    type: "测款采购",
    objectType: "辅料",
    requirementId: "PR-2025-000375",
    supplierPlatform: "广州辅料批发",
    product: "珍珠纽扣 / ACC-2025-012",
    orderDate: "2025-03-15",
    quantity: 2000,
    arrivedQty: 2000,
    inboundQty: 1800,
    inTransitQty: 0,
    availableStock: 5600,
    expectedDate: "2025-03-22",
    status: "已完成",
    arrivalStatus: "已完成",
    creator: "采购系统 / 张琳",
  },
  {
    id: "PO-2025-001040",
    type: "备货采购",
    objectType: "纱线",
    requirementId: "PR-2025-000370",
    supplierPlatform: "苏州纱线厂",
    product: "棉纱 32S / YARN-2025-005",
    orderDate: "2025-03-12",
    quantity: 800,
    arrivedQty: 400,
    inboundQty: 400,
    inTransitQty: 400,
    availableStock: 2100,
    expectedDate: "2025-03-26",
    status: "已部分到货",
    arrivalStatus: "部分到货",
    creator: "李明",
  },
]

export default function OrderTrackingListPage() {
  const [showFilters, setShowFilters] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [orderStatus, setOrderStatus] = useState("all")
  const [purchaseType, setPurchaseType] = useState("all")
  const [objectType, setObjectType] = useState("all")
  const [arrivalStatus, setArrivalStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "已批准":
        return "bg-blue-100 text-blue-700"
      case "已下单":
        return "bg-indigo-100 text-indigo-700"
      case "已部分到货":
        return "bg-amber-100 text-amber-700"
      case "已完成":
        return "bg-green-100 text-green-700"
      case "已关闭":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getArrivalStatusColor = (status: string) => {
    switch (status) {
      case "未到":
        return "bg-red-100 text-red-700"
      case "部分到货":
        return "bg-amber-100 text-amber-700"
      case "已完成":
        return "bg-green-100 text-green-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "测款采购":
        return "bg-purple-100 text-purple-700"
      case "备货采购":
        return "bg-blue-100 text-blue-700"
      case "手工采购":
        return "bg-orange-100 text-orange-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const filteredOrders = trackingOrders.filter((order) => {
    if (
      searchTerm &&
      !order.id.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !order.product.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false
    if (orderStatus !== "all" && order.status !== orderStatus) return false
    if (purchaseType !== "all" && order.type !== purchaseType) return false
    if (objectType !== "all" && order.objectType !== objectType) return false
    if (arrivalStatus !== "all" && order.arrivalStatus !== arrivalStatus) return false
    return true
  })

  return (
    <div className="flex h-screen bg-muted/30">
      <PmsSidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PmsSystemNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 页面标题 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">订单执行跟踪</h1>
              <p className="text-sm text-muted-foreground mt-1">跟踪采购订单从下单到到货、入库、完成的全流程</p>
            </div>
          </div>

          {/* 搜索和筛选 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索订单编号、商品/物料..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  高级筛选
                  {showFilters ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                </Button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-4 border-t">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">订单状态</label>
                    <Select value={orderStatus} onValueChange={setOrderStatus}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="已批准">已批准</SelectItem>
                        <SelectItem value="已下单">已下单</SelectItem>
                        <SelectItem value="已部分到货">已部分到货</SelectItem>
                        <SelectItem value="已完成">已完成</SelectItem>
                        <SelectItem value="已关闭">已关闭</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">采购类型</label>
                    <Select value={purchaseType} onValueChange={setPurchaseType}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="测款采购">测款采购</SelectItem>
                        <SelectItem value="备货采购">备货采购</SelectItem>
                        <SelectItem value="手工采购">手工采购</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">采购对象类型</label>
                    <Select value={objectType} onValueChange={setObjectType}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="样衣">样衣</SelectItem>
                        <SelectItem value="面料">面料</SelectItem>
                        <SelectItem value="辅料">辅料</SelectItem>
                        <SelectItem value="纱线">纱线</SelectItem>
                        <SelectItem value="耗材">耗材</SelectItem>
                        <SelectItem value="设备">设备</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">到货完成状态</label>
                    <Select value={arrivalStatus} onValueChange={setArrivalStatus}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="未到">未到</SelectItem>
                        <SelectItem value="部分到货">部分到货</SelectItem>
                        <SelectItem value="已完成">已完成</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">供应商/平台</label>
                    <Select defaultValue="all">
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="淘宝">淘宝电商平台</SelectItem>
                        <SelectItem value="京东">京东电商平台</SelectItem>
                        <SelectItem value="杭州锦绣">杭州锦绣纺织</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 数据表格 */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap font-semibold">采购订单编号</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">采购类型</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">采购对象</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">关联需求</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">供应商/平台</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">商品/物料</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">下单日期</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-right">采购数量</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-right">已到货</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-right">已入库</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-right">在途</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-right">可用库存</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">预计到货</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">订单状态</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">到货状态</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">创建人</TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Link
                            href={`/pms/orders/tracking/${order.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {order.id}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getTypeColor(order.type)}>
                            {order.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.objectType}</TableCell>
                        <TableCell>
                          <Link
                            href={`/pms/requirements/${order.requirementId}`}
                            className="text-primary hover:underline text-sm"
                          >
                            {order.requirementId}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate" title={order.supplierPlatform}>
                          {order.supplierPlatform}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={order.product}>
                          {order.product}
                        </TableCell>
                        <TableCell>{order.orderDate}</TableCell>
                        <TableCell className="text-right font-medium text-blue-600">{order.quantity}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">{order.arrivedQty}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">{order.inboundQty}</TableCell>
                        <TableCell className="text-right font-medium text-amber-600">{order.inTransitQty}</TableCell>
                        <TableCell className="text-right">{order.availableStock}</TableCell>
                        <TableCell>{order.expectedDate}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getArrivalStatusColor(order.arrivalStatus)}>
                            {order.arrivalStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{order.creator}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/pms/orders/tracking/${order.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  查看详情
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={order.arrivalStatus === "已完成"}>
                                <Package className="h-4 w-4 mr-2" />
                                更新到货数量
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={order.arrivalStatus === "未到"}>
                                <FileInput className="h-4 w-4 mr-2" />
                                生成入库单
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">共 {filteredOrders.length} 条记录</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">第 {currentPage} 页</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)}>
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
