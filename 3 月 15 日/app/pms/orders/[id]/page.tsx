"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { PmsSidebarNav } from "@/components/pms-sidebar-nav"
import { PmsSystemNav } from "@/components/pms-system-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Save,
  CheckCircle,
  XCircle,
  Truck,
  Clock,
  FileText,
  Package,
  AlertTriangle,
  Building2,
  Store,
} from "lucide-react"

const ordersData: Record<string, any> = {
  "PO-2025-001050": {
    id: "PO-2025-001050",
    requirementId: "PR-2025-000387",
    type: "测款采购",
    objectType: "样衣",
    status: "approved",
    creator: "采购系统 / 张琳",
    createdAt: "2025-03-22 15:00",
    expectedDate: "2025-03-30",
    supplierType: "platform",
    supplier: {
      name: "淘宝电商平台",
      contact: "平台客服",
      phone: "无",
      transactionId: "TB-2025-0115",
      currency: "人民币",
    },
    productName: "连衣裙",
    skuCode: "SK2025-031",
    spec: "M / L / XL 混码",
    unit: "件",
    quantity: 300,
    unitPrice: 75,
    purchaseAmount: 22500,
    domesticShipping: 200,
    transferShipping: 0,
    transferNote: "人工带回",
    totalCost: 22700,
    currentStock: 620,
    allocatedStock: 180,
    inTransitStock: 300,
    inTransitDate: "2025-03-28",
    receivedQty: 0,
    gapQty: 2280,
    approvalFlow: [
      {
        role: "商品负责人",
        name: "张琳",
        status: "approved",
        time: "2025-03-22 15:30",
        comment: "测款数据达标，同意采购",
      },
      {
        role: "采购负责人",
        name: "李伟",
        status: "approved",
        time: "2025-03-22 16:00",
        comment: "供应商报价合理，批准",
      },
      { role: "财务负责人", name: "王芳", status: "pending", time: null, comment: null },
    ],
  },
  "PO-2025-001060": {
    id: "PO-2025-001060",
    requirementId: "PR-2025-000412",
    type: "备货采购",
    objectType: "面料",
    status: "approved",
    creator: "采购系统 / 李伟",
    createdAt: "2025-03-22 10:15",
    expectedDate: "2025-04-10",
    supplierType: "vendor",
    supplier: {
      name: "浙江布业有限公司",
      contact: "周刚",
      phone: "137-xxxx-xxxx",
      contractId: "CT-2025-0230",
      currency: "人民币",
    },
    productName: "40S 精梳棉面料（白色）",
    skuCode: "FAB-2025-001",
    spec: "标准卷布",
    unit: "米",
    quantity: 250,
    unitPrice: 36,
    purchaseAmount: 9000,
    domesticShipping: 500,
    transferShipping: 700,
    transferNote: "",
    totalCost: 10200,
    currentStock: 450,
    allocatedStock: 0,
    inTransitStock: 150,
    inTransitDate: "2025-03-30",
    receivedQty: 0,
    gapQty: 200,
    approvalFlow: [
      {
        role: "采购负责人",
        name: "李伟",
        status: "approved",
        time: "2025-03-22 11:00",
        comment: "库存安全需要，批准采购",
      },
      { role: "财务负责人", name: "王芳", status: "approved", time: "2025-03-22 14:00", comment: "费用预算内，同意" },
    ],
  },
  "PO-2025-001080": {
    id: "PO-2025-001080",
    requirementId: "PR-2025-000420",
    type: "手工采购",
    objectType: "样衣",
    status: "approved",
    creator: "采购系统 / 刘晨",
    createdAt: "2025-03-23 09:20",
    expectedDate: "2025-03-28",
    supplierType: "platform",
    supplier: {
      name: "京东电商平台",
      contact: "平台客服",
      phone: "无",
      transactionId: "JD-2025-0140",
      currency: "人民币",
    },
    productName: "衬衫",
    skuCode: "SK2025-045",
    spec: "S / M / L 混码",
    unit: "件",
    quantity: 50,
    unitPrice: 75,
    purchaseAmount: 3750,
    domesticShipping: 50,
    transferShipping: 0,
    transferNote: "人工带回",
    totalCost: 3800,
    currentStock: 20,
    allocatedStock: 0,
    inTransitStock: 10,
    inTransitDate: "2025-03-27",
    receivedQty: 0,
    gapQty: 30,
    approvalFlow: [
      { role: "采购负责人", name: "刘晨", status: "approved", time: "2025-03-23 10:00", comment: "手工补充采购，批准" },
      { role: "财务负责人", name: "王芳", status: "approved", time: "2025-03-23 11:30", comment: "金额较小，同意" },
    ],
  },
}

export default function PurchaseOrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [approvalComment, setApprovalComment] = useState("")

  // Get order data or use default
  const order = ordersData[id] || ordersData["PO-2025-001050"]

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      approved: { label: "已批准", className: "bg-green-100 text-green-700 border-green-200" },
      pending: { label: "待审批", className: "bg-amber-100 text-amber-700 border-amber-200" },
      ordered: { label: "已下单", className: "bg-blue-100 text-blue-700 border-blue-200" },
      partial: { label: "已部分到货", className: "bg-purple-100 text-purple-700 border-purple-200" },
      completed: { label: "已完成", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      draft: { label: "草稿", className: "bg-gray-100 text-gray-700 border-gray-200" },
    }
    const cfg = config[status] || config.draft
    return <Badge className={cfg.className}>{cfg.label}</Badge>
  }

  const getTypeBadge = (type: string) => {
    const config: Record<string, string> = {
      测款采购: "bg-blue-50 text-blue-700 border-blue-200",
      备货采购: "bg-green-50 text-green-700 border-green-200",
      手工采购: "bg-amber-50 text-amber-700 border-amber-200",
    }
    return (
      <Badge variant="outline" className={config[type] || ""}>
        {type}
      </Badge>
    )
  }

  const getObjectTypeBadge = (objectType: string) => {
    const config: Record<string, string> = {
      样衣: "bg-purple-100 text-purple-700",
      面料: "bg-blue-100 text-blue-700",
      辅料: "bg-green-100 text-green-700",
      纱线: "bg-orange-100 text-orange-700",
      耗材: "bg-cyan-100 text-cyan-700",
      设备: "bg-slate-100 text-slate-700",
    }
    return <Badge className={config[objectType] || ""}>{objectType}</Badge>
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <PmsSystemNav />
      <div className="flex flex-1 overflow-hidden">
        <PmsSidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/pms/orders">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{order.id}</h1>
                  {getStatusBadge(order.status)}
                  {getTypeBadge(order.type)}
                  {getObjectTypeBadge(order.objectType)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  关联需求：
                  <Link href={`/pms/requirements/${order.requirementId}`} className="text-primary hover:underline">
                    {order.requirementId}
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline">
                <CheckCircle className="h-4 w-4 mr-2" />
                审批
              </Button>
              <Button variant="outline">
                <XCircle className="h-4 w-4 mr-2" />
                拒绝
              </Button>
              <Button variant="outline">
                <Save className="h-4 w-4 mr-2" />
                保存调整
              </Button>
              <Button>
                <Truck className="h-4 w-4 mr-2" />
                生成入库/发货单
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="col-span-2 space-y-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    基础信息
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">采购订单编号</div>
                      <div className="font-medium mt-1">{order.id}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">关联采购需求编号</div>
                      <div className="font-medium mt-1">
                        <Link
                          href={`/pms/requirements/${order.requirementId}`}
                          className="text-primary hover:underline"
                        >
                          {order.requirementId}
                        </Link>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">采购类型</div>
                      <div className="mt-1">{getTypeBadge(order.type)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">采购对象类型</div>
                      <div className="mt-1">{getObjectTypeBadge(order.objectType)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">采购状态</div>
                      <div className="mt-1">{getStatusBadge(order.status)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">创建人</div>
                      <div className="font-medium mt-1">{order.creator}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">创建时间</div>
                      <div className="font-medium mt-1">{order.createdAt}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">预计到货时间</div>
                      <div className="font-medium mt-1">{order.expectedDate}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Supplier / Platform Info - Different display based on supplier type */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {order.supplierType === "platform" ? (
                      <>
                        <Store className="h-4 w-4" />
                        电商平台信息
                      </>
                    ) : (
                      <>
                        <Building2 className="h-4 w-4" />
                        供应商信息
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">
                        {order.supplierType === "platform" ? "平台名称" : "供应商名称"}
                      </div>
                      <div className="font-medium mt-1">{order.supplier.name}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">联系人</div>
                      <div className="font-medium mt-1">{order.supplier.contact}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">联系方式</div>
                      <div className="font-medium mt-1 text-muted-foreground">{order.supplier.phone}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        {order.supplierType === "platform" ? "交易编号" : "合同编号"}
                      </div>
                      <div className="font-medium mt-1 text-primary">
                        {order.supplier.transactionId || order.supplier.contractId}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">币种</div>
                      <div className="font-medium mt-1">{order.supplier.currency}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Purchase Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    采购明细
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">
                          {order.objectType === "样衣" ? "SKU / 商品" : "物料名称"}
                        </th>
                        <th className="text-left p-3 font-medium">
                          {order.objectType === "样衣" ? "规格" : "批次/规格"}
                        </th>
                        <th className="text-right p-3 font-medium">采购数量</th>
                        <th className="text-right p-3 font-medium">单价</th>
                        <th className="text-right p-3 font-medium">采购金额（不含税）</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-3">
                          <div className="font-medium">{order.productName}</div>
                          <div className="text-xs text-muted-foreground">{order.skuCode}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{order.spec}</td>
                        <td className="p-3 text-right font-medium text-lg">
                          {order.quantity.toLocaleString()} {order.unit}
                        </td>
                        <td className="p-3 text-right">
                          ¥{order.unitPrice} / {order.unit}
                        </td>
                        <td className="p-3 text-right font-medium text-lg">¥{order.purchaseAmount.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded">
                      <span className="text-muted-foreground">国内段运费</span>
                      <span className="font-medium">¥{order.domesticShipping.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded">
                      <span className="text-muted-foreground">
                        {order.objectType === "面料" || order.objectType === "辅料" ? "转运/海运费用" : "转运/空运费用"}
                      </span>
                      <div className="text-right">
                        <span className="font-medium">¥{order.transferShipping.toLocaleString()}</span>
                        {order.transferNote && (
                          <span className="text-xs text-muted-foreground ml-2">（{order.transferNote}）</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-primary/10 rounded border border-primary/20">
                      <span className="font-medium text-lg">预估综合成本</span>
                      <span className="font-bold text-primary text-2xl">¥{order.totalCost.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stock & Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    库存与进度
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/30 rounded">
                      <div className="text-sm text-muted-foreground">当前库存</div>
                      <div className="text-2xl font-bold mt-1">
                        {order.currentStock.toLocaleString()} {order.unit}
                      </div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded border border-orange-200">
                      <div className="text-sm text-orange-700">已分配库存</div>
                      <div className="text-2xl font-bold mt-1 text-orange-700">
                        {order.allocatedStock.toLocaleString()} {order.unit}
                      </div>
                    </div>
                    <div className="p-4 bg-green-50 rounded border border-green-200">
                      <div className="text-sm text-green-700">在途库存</div>
                      <div className="text-2xl font-bold mt-1 text-green-700">
                        {order.inTransitStock.toLocaleString()} {order.unit}
                      </div>
                      <div className="text-xs text-green-600 mt-1">预计 {order.inTransitDate} 到仓</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded border border-blue-200">
                      <div className="text-sm text-blue-700">已入库数量</div>
                      <div className="text-2xl font-bold mt-1 text-blue-700">
                        {order.receivedQty.toLocaleString()} {order.unit}
                      </div>
                    </div>
                    <div className="p-4 bg-red-50 rounded border border-red-200 col-span-2">
                      <div className="text-sm text-red-700">预计缺口数量</div>
                      <div className="text-2xl font-bold mt-1 text-red-700">
                        {order.gapQty.toLocaleString()} {order.unit}
                      </div>
                      <div className="text-xs text-red-600 mt-1">= 需求总量 - 当前库存 - 已分配 - 在途</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Approval Flow */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">审批与操作</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-3">
                    审批流程：{order.approvalFlow.map((s: any) => s.role).join(" → ")}
                  </div>
                  <div className="space-y-4">
                    {order.approvalFlow.map((step: any, index: number) => (
                      <div key={index} className="relative">
                        {index < order.approvalFlow.length - 1 && (
                          <div className="absolute left-4 top-10 w-0.5 h-16 bg-border" />
                        )}
                        <div className="flex gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              step.status === "approved"
                                ? "bg-green-100 text-green-600"
                                : step.status === "pending"
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {step.status === "approved" ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : step.status === "pending" ? (
                              <Clock className="h-4 w-4" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-current" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{step.role}</span>
                              {step.status === "approved" && (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                  已审批
                                </Badge>
                              )}
                              {step.status === "pending" && (
                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                  待审批
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">{step.name}</div>
                            {step.time && <div className="text-xs text-muted-foreground mt-1">{step.time}</div>}
                            {step.comment && <div className="text-sm mt-2 p-2 bg-muted/50 rounded">{step.comment}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Approval Input */}
                  <div className="mt-6 pt-4 border-t">
                    <label className="text-sm font-medium mb-2 block">审批意见</label>
                    <Textarea
                      placeholder="请输入审批意见..."
                      value={approvalComment}
                      onChange={(e) => setApprovalComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2 mt-3">
                      <Button className="flex-1 bg-transparent" variant="outline">
                        <XCircle className="h-4 w-4 mr-2" />
                        拒绝
                      </Button>
                      <Button className="flex-1">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        通过
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">快捷操作</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Save className="h-4 w-4 mr-2" />
                    保存调整
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <Truck className="h-4 w-4 mr-2" />
                    生成入库/发货单
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                    <Link href={`/pms/requirements/${order.requirementId}`}>
                      <FileText className="h-4 w-4 mr-2" />
                      查看采购需求
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <FileText className="h-4 w-4 mr-2" />
                    查看商品档案
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
