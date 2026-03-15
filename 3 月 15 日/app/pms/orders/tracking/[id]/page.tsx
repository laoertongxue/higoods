"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { PmsSidebarNav } from "@/components/pms-sidebar-nav"
import { PmsSystemNav } from "@/components/pms-system-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Package, FileInput, XCircle, Truck, CheckCircle, Clock, AlertCircle } from "lucide-react"

const trackingDetails: Record<
  string,
  {
    id: string
    requirementId: string
    type: string
    objectType: string
    status: string
    creator: string
    createdAt: string
    expectedDate: string
    supplier: {
      name: string
      contact: string
      phone: string
      transactionId: string
      currency: string
    }
    items: {
      sku: string
      product: string
      spec: string
      quantity: number
      unit: string
      unitPrice: number
      amount: number
      domesticShipping: number
      transferShipping: number
      totalCost: number
    }[]
    progress: {
      orderDate: string
      arrivedQty: number
      inboundQty: number
      inTransitQty: number
      availableStock: number
      arrivalStatus: string
    }
    logs: {
      time: string
      event: string
      detail: string
      operator: string
    }[]
    approval: {
      role: string
      name: string
      status: string
      time: string
    }[]
  }
> = {
  "PO-2025-001050": {
    id: "PO-2025-001050",
    requirementId: "PR-2025-000387",
    type: "测款采购",
    objectType: "样衣",
    status: "已下单",
    creator: "采购系统 / 张琳",
    createdAt: "2025-03-22 15:00",
    expectedDate: "2025-03-30",
    supplier: {
      name: "淘宝电商平台",
      contact: "平台客服",
      phone: "无",
      transactionId: "TB-2025-0115",
      currency: "人民币",
    },
    items: [
      {
        sku: "SK2025-031",
        product: "连衣裙",
        spec: "M / L / XL 混码",
        quantity: 300,
        unit: "件",
        unitPrice: 75,
        amount: 22500,
        domesticShipping: 200,
        transferShipping: 0,
        totalCost: 22700,
      },
    ],
    progress: {
      orderDate: "2025-03-22",
      arrivedQty: 0,
      inboundQty: 0,
      inTransitQty: 300,
      availableStock: 620,
      arrivalStatus: "未到",
    },
    logs: [
      {
        time: "2025-03-23 10:30",
        event: "物流已发货",
        detail: "淘宝快递单号：TB-20250323-001",
        operator: "系统",
      },
      {
        time: "2025-03-22 15:30",
        event: "订单已下单",
        detail: "订单已提交至淘宝电商平台",
        operator: "采购系统",
      },
      {
        time: "2025-03-22 15:00",
        event: "订单创建",
        detail: "由采购需求 PR-2025-000387 自动生成",
        operator: "张琳",
      },
    ],
    approval: [
      { role: "商品负责人", name: "陈雪", status: "已通过", time: "2025-03-22 14:00" },
      { role: "采购负责人", name: "李明", status: "已通过", time: "2025-03-22 14:30" },
      { role: "财务负责人", name: "王芳", status: "已通过", time: "2025-03-22 14:50" },
    ],
  },
  "PO-2025-001048": {
    id: "PO-2025-001048",
    requirementId: "PR-2025-000385",
    type: "备货采购",
    objectType: "面料",
    status: "已部分到货",
    creator: "李明",
    createdAt: "2025-03-20 09:00",
    expectedDate: "2025-03-28",
    supplier: {
      name: "杭州锦绣纺织有限公司",
      contact: "张经理",
      phone: "0571-88889999",
      transactionId: "HT-2025-0320-001",
      currency: "人民币",
    },
    items: [
      {
        sku: "FAB-2025-088",
        product: "真丝印花面料",
        spec: "幅宽 140cm / 克重 85g/m²",
        quantity: 500,
        unit: "米",
        unitPrice: 120,
        amount: 60000,
        domesticShipping: 500,
        transferShipping: 0,
        totalCost: 60500,
      },
    ],
    progress: {
      orderDate: "2025-03-20",
      arrivedQty: 200,
      inboundQty: 200,
      inTransitQty: 300,
      availableStock: 1200,
      arrivalStatus: "部分到货",
    },
    logs: [
      {
        time: "2025-03-25 14:00",
        event: "部分入库完成",
        detail: "入库数量：200米，入库单号：INB-2025-0325-001",
        operator: "仓库管理员",
      },
      {
        time: "2025-03-25 10:30",
        event: "部分到货",
        detail: "到货数量：200米，物流单号：SF-20250320001",
        operator: "李明",
      },
      {
        time: "2025-03-21 09:00",
        event: "供应商已发货",
        detail: "顺丰物流，单号：SF-20250320001",
        operator: "供应商",
      },
      {
        time: "2025-03-20 10:00",
        event: "订单已确认",
        detail: "供应商已确认订单，预计分两批发货",
        operator: "张经理",
      },
      {
        time: "2025-03-20 09:00",
        event: "订单创建",
        detail: "由采购需求 PR-2025-000385 生成",
        operator: "李明",
      },
    ],
    approval: [
      { role: "采购负责人", name: "李明", status: "已通过", time: "2025-03-20 08:30" },
      { role: "财务负责人", name: "王芳", status: "已通过", time: "2025-03-20 08:50" },
    ],
  },
}

export default function OrderTrackingDetailPage() {
  const params = useParams()
  const id = params.id as string

  const order = trackingDetails[id] || trackingDetails["PO-2025-001050"]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "已下单":
        return "bg-indigo-100 text-indigo-700"
      case "已部分到货":
        return "bg-amber-100 text-amber-700"
      case "已完成":
        return "bg-green-100 text-green-700"
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

  const getLogIcon = (event: string) => {
    if (event.includes("发货")) return <Truck className="h-4 w-4 text-blue-500" />
    if (event.includes("到货")) return <Package className="h-4 w-4 text-amber-500" />
    if (event.includes("入库")) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (event.includes("创建") || event.includes("确认")) return <Clock className="h-4 w-4 text-gray-500" />
    return <AlertCircle className="h-4 w-4 text-gray-400" />
  }

  const isEcommerce =
    order.supplier.name.includes("电商平台") ||
    order.supplier.name.includes("淘宝") ||
    order.supplier.name.includes("京东")

  return (
    <div className="flex h-screen bg-muted/30">
      <PmsSidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PmsSystemNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 返回和标题 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/pms/orders/tracking">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">{order.id}</h1>
                  <Badge variant="outline" className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                  <Badge variant="outline" className={getArrivalStatusColor(order.progress.arrivalStatus)}>
                    {order.progress.arrivalStatus}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">订单执行跟踪详情</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={order.progress.arrivalStatus === "已完成"}>
                <Package className="h-4 w-4 mr-2" />
                更新到货数量
              </Button>
              <Button variant="outline" disabled={order.progress.arrivalStatus === "未到"}>
                <FileInput className="h-4 w-4 mr-2" />
                生成入库单
              </Button>
              <Button variant="outline" className="text-destructive hover:text-destructive bg-transparent">
                <XCircle className="h-4 w-4 mr-2" />
                关闭订单
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧主要内容 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 基础信息 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">基础信息</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">采购订单编号</p>
                      <p className="text-sm font-medium">{order.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">关联采购需求</p>
                      <Link
                        href={`/pms/requirements/${order.requirementId}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {order.requirementId}
                      </Link>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">采购类型</p>
                      <Badge variant="outline" className={getTypeColor(order.type)}>
                        {order.type}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">采购对象类型</p>
                      <p className="text-sm font-medium">{order.objectType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">创建人</p>
                      <p className="text-sm font-medium">{order.creator}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">创建时间</p>
                      <p className="text-sm font-medium">{order.createdAt}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">预计到货时间</p>
                      <p className="text-sm font-medium">{order.expectedDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">采购状态</p>
                      <Badge variant="outline" className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 供应商/平台信息 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{isEcommerce ? "电商平台信息" : "供应商信息"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{isEcommerce ? "平台名称" : "供应商名称"}</p>
                      <p className="text-sm font-medium">{order.supplier.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{isEcommerce ? "客服" : "联系人"}</p>
                      <p className="text-sm font-medium">{order.supplier.contact}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{isEcommerce ? "联系方式" : "电话"}</p>
                      <p className="text-sm font-medium">{order.supplier.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{isEcommerce ? "交易编号" : "合同编号"}</p>
                      <p className="text-sm font-medium">{order.supplier.transactionId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">币种</p>
                      <p className="text-sm font-medium">{order.supplier.currency}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 采购明细 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">采购明细</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>SKU / 商品</TableHead>
                        <TableHead>规格</TableHead>
                        <TableHead className="text-right">采购数量</TableHead>
                        <TableHead className="text-right">单价</TableHead>
                        <TableHead className="text-right">采购金额</TableHead>
                        <TableHead className="text-right">国内运费</TableHead>
                        <TableHead className="text-right">转运费用</TableHead>
                        <TableHead className="text-right">综合成本</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product}</p>
                              <p className="text-xs text-muted-foreground">{item.sku}</p>
                            </div>
                          </TableCell>
                          <TableCell>{item.spec}</TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            ¥{item.unitPrice}/{item.unit}
                          </TableCell>
                          <TableCell className="text-right">¥{item.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">¥{item.domesticShipping}</TableCell>
                          <TableCell className="text-right">
                            {item.transferShipping === 0 ? "¥0（人工带回）" : `¥${item.transferShipping}`}
                          </TableCell>
                          <TableCell className="text-right font-semibold">¥{item.totalCost.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* 执行进度 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">执行进度</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* 进度指标 */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">下单日期</p>
                      <p className="text-sm font-semibold">{order.progress.orderDate}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                      <p className="text-xs text-blue-600">采购数量</p>
                      <p className="text-lg font-bold text-blue-700">{order.items[0].quantity}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
                      <p className="text-xs text-amber-600">在途数量</p>
                      <p className="text-lg font-bold text-amber-700">{order.progress.inTransitQty}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                      <p className="text-xs text-green-600">已到货</p>
                      <p className="text-lg font-bold text-green-700">{order.progress.arrivedQty}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
                      <p className="text-xs text-emerald-600">已入库</p>
                      <p className="text-lg font-bold text-emerald-700">{order.progress.inboundQty}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">当前可用库存</p>
                      <p className="text-sm font-semibold">{order.progress.availableStock}</p>
                    </div>
                  </div>

                  {/* 到货日志时间轴 */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">到货日志</h4>
                    <div className="space-y-4">
                      {order.logs.map((log, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              {getLogIcon(log.event)}
                            </div>
                            {idx < order.logs.length - 1 && <div className="w-px h-full bg-border mt-2" />}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{log.event}</span>
                              <span className="text-xs text-muted-foreground">{log.time}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{log.detail}</p>
                            <p className="text-xs text-muted-foreground mt-1">操作人：{log.operator}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 右侧审批流程 */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">审批流程</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.approval.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              item.status === "已通过" ? "bg-green-100" : "bg-muted"
                            }`}
                          >
                            {item.status === "已通过" ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          {idx < order.approval.length - 1 && <div className="w-px h-8 bg-border mt-1" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.role}</span>
                            <Badge
                              variant="outline"
                              className={
                                item.status === "已通过" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                              }
                            >
                              {item.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 快捷操作 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">快捷操作</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-transparent"
                    disabled={order.progress.arrivalStatus === "已完成"}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    更新到货数量
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-transparent"
                    disabled={order.progress.arrivalStatus === "未到"}
                  >
                    <FileInput className="h-4 w-4 mr-2" />
                    生成入库单
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:text-destructive bg-transparent"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    关闭订单
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
