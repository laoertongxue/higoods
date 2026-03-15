"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { PmsSidebarNav } from "@/components/pms-sidebar-nav"
import { PmsSystemNav } from "@/components/pms-system-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  CheckCircle,
  User,
  Calendar,
  Package,
  FileText,
  ExternalLink,
  MessageSquare,
} from "lucide-react"

// 异常详情数据
const exceptionData = {
  "EX-2025-00058": {
    id: "EX-2025-00058",
    orderId: "PO-2025-001050",
    requirementId: "PR-2025-000387",
    type: "到货延期",
    description: "原预计到货时间2025-03-28，供应商通知延迟至2025-03-30",
    purchaseType: "测款采购",
    objectType: "样衣",
    orderStatus: "已下单",
    creator: "采购系统 / 张琳",
    createdAt: "2025-03-23 09:30",
    expectedResolveDate: "2025-03-30",
    priority: "高",
    status: "未处理",
    supplier: {
      name: "淘宝电商平台",
      contact: "平台客服",
      phone: "无",
      transactionId: "TB-2025-0115",
      currency: "人民币",
    },
    orderItems: [
      {
        sku: "SK2025-031",
        name: "连衣裙",
        spec: "M / L / XL 混码",
        purchaseQty: 300,
        arrivedQty: 0,
        inTransitQty: 300,
        currentStock: 620,
      },
    ],
    processRecords: [],
    historyExceptions: [
      {
        id: "EX-2025-00050",
        type: "数量变更",
        description: "增加50件",
        status: "已处理",
        createdAt: "2025-03-15 10:20",
      },
      {
        id: "EX-2025-00052",
        type: "供应商缺货",
        description: "部分SKU缺货，已更换替代品",
        status: "已处理",
        createdAt: "2025-03-18 14:30",
      },
    ],
  },
  "EX-2025-00057": {
    id: "EX-2025-00057",
    orderId: "PO-2025-001048",
    requirementId: "PR-2025-000385",
    type: "数量变更",
    description: "供应商库存不足，实际可供应数量由500米调整为450米",
    purchaseType: "备货采购",
    objectType: "面料",
    orderStatus: "已下单",
    creator: "张琳",
    createdAt: "2025-03-22 14:20",
    expectedResolveDate: "2025-03-25",
    priority: "中",
    status: "处理中",
    supplier: {
      name: "杭州纺织有限公司",
      contact: "王经理",
      phone: "0571-88888888",
      contractId: "HT-2025-0088",
      currency: "人民币",
    },
    orderItems: [
      {
        sku: "FB2025-018",
        name: "棉麻混纺面料",
        spec: "150cm幅宽",
        purchaseQty: 500,
        arrivedQty: 0,
        inTransitQty: 450,
        currentStock: 1200,
        unit: "米",
      },
    ],
    processRecords: [
      {
        id: 1,
        action: "标记处理中",
        handler: "李明",
        time: "2025-03-22 15:30",
        remark: "已联系供应商确认实际可供应数量",
      },
    ],
    historyExceptions: [],
  },
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "未处理":
      return <Badge variant="destructive">{status}</Badge>
    case "处理中":
      return <Badge className="bg-amber-500 hover:bg-amber-600">{status}</Badge>
    case "已处理":
      return <Badge className="bg-green-600 hover:bg-green-700">{status}</Badge>
    case "已关闭":
      return <Badge variant="secondary">{status}</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case "高":
      return <Badge variant="destructive">{priority}优先级</Badge>
    case "中":
      return <Badge className="bg-amber-500 hover:bg-amber-600">{priority}优先级</Badge>
    case "低":
      return <Badge variant="secondary">{priority}优先级</Badge>
    default:
      return <Badge variant="outline">{priority}</Badge>
  }
}

const getTypeBadge = (type: string) => {
  switch (type) {
    case "到货延期":
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-600">
          {type}
        </Badge>
      )
    case "数量变更":
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-600">
          {type}
        </Badge>
      )
    case "供应商缺货":
      return (
        <Badge variant="outline" className="border-red-500 text-red-600">
          {type}
        </Badge>
      )
    case "质量问题":
      return (
        <Badge variant="outline" className="border-purple-500 text-purple-600">
          {type}
        </Badge>
      )
    case "价格变更":
      return (
        <Badge variant="outline" className="border-green-500 text-green-600">
          {type}
        </Badge>
      )
    case "取消订单":
      return (
        <Badge variant="outline" className="border-gray-500 text-gray-600">
          {type}
        </Badge>
      )
    default:
      return <Badge variant="outline">{type}</Badge>
  }
}

export default function OrderExceptionDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [processRemark, setProcessRemark] = useState("")

  // 获取异常数据
  const data = exceptionData[id as keyof typeof exceptionData] || exceptionData["EX-2025-00058"]
  const isSupplier = data.purchaseType === "备货采购"

  return (
    <div className="flex h-screen bg-background">
      <PmsSidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PmsSystemNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 返回和标题 */}
          <div className="flex items-center gap-4">
            <Link href="/pms/orders/changes">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{data.id}</h1>
                {getTypeBadge(data.type)}
                {getStatusBadge(data.status)}
                {getPriorityBadge(data.priority)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{data.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {data.status === "未处理" && (
                <Button className="bg-amber-500 hover:bg-amber-600">
                  <Clock className="h-4 w-4 mr-2" />
                  标记处理中
                </Button>
              )}
              {(data.status === "未处理" || data.status === "处理中") && (
                <Button className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  标记已处理
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* 左侧主内容 */}
            <div className="col-span-2 space-y-6">
              {/* 基础信息 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    基础信息
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">异常编号</p>
                      <p className="font-medium">{data.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">采购订单编号</p>
                      <Link
                        href={`/pms/orders/${data.orderId}`}
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        {data.orderId}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">关联采购需求编号</p>
                      <Link
                        href={`/pms/requirements/${data.requirementId}`}
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        {data.requirementId}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">异常类型</p>
                      <p className="font-medium">{data.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">采购类型</p>
                      <p className="font-medium">{data.purchaseType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">采购对象类型</p>
                      <p className="font-medium">{data.objectType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">采购状态</p>
                      <p className="font-medium">{data.orderStatus}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">创建人</p>
                      <p className="font-medium">{data.creator}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">创建时间</p>
                      <p className="font-medium">{data.createdAt}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm text-muted-foreground">异常描述</p>
                      <p className="font-medium">{data.description}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">预计解决时间</p>
                      <p className="font-medium text-amber-600 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {data.expectedResolveDate}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 供应商/平台信息 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {isSupplier ? "供应商信息" : "电商平台信息"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">名称</p>
                      <p className="font-medium">{data.supplier.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">联系人</p>
                      <p className="font-medium">{data.supplier.contact}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">联系方式</p>
                      <p className="font-medium">{data.supplier.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{isSupplier ? "合同编号" : "交易编号"}</p>
                      <p className="font-medium">
                        {isSupplier ? (data.supplier as any).contractId : (data.supplier as any).transactionId}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">币种</p>
                      <p className="font-medium">{data.supplier.currency}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 采购订单明细 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    采购订单明细
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU / 商品</TableHead>
                        <TableHead>规格</TableHead>
                        <TableHead className="text-right">采购数量</TableHead>
                        <TableHead className="text-right">已到货数量</TableHead>
                        <TableHead className="text-right">在途数量</TableHead>
                        <TableHead className="text-right">当前库存</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.orderItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.sku}</p>
                            </div>
                          </TableCell>
                          <TableCell>{item.spec}</TableCell>
                          <TableCell className="text-right font-medium">
                            {item.purchaseQty} {(item as any).unit || "件"}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {item.arrivedQty} {(item as any).unit || "件"}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {item.inTransitQty} {(item as any).unit || "件"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.currentStock} {(item as any).unit || "件"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* 异常处理记录 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    异常处理记录
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 处理状态 */}
                  <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">处理状态</p>
                      <p className="font-medium">{getStatusBadge(data.status)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">处理人</p>
                      <p className="font-medium">
                        {data.processRecords.length > 0
                          ? data.processRecords[data.processRecords.length - 1].handler
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">处理时间</p>
                      <p className="font-medium">
                        {data.processRecords.length > 0
                          ? data.processRecords[data.processRecords.length - 1].time
                          : "-"}
                      </p>
                    </div>
                  </div>

                  {/* 处理时间轴 */}
                  {data.processRecords.length > 0 && (
                    <div className="space-y-4 border-l-2 border-muted pl-4 ml-2">
                      {data.processRecords.map((record) => (
                        <div key={record.id} className="relative">
                          <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{record.action}</span>
                              <span className="text-sm text-muted-foreground">- {record.handler}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{record.time}</p>
                            {record.remark && <p className="text-sm mt-1 p-2 bg-muted/50 rounded">{record.remark}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 添加处理备注 */}
                  <div className="space-y-3 pt-4 border-t">
                    <div>
                      <label className="text-sm font-medium">
                        处理备注 <span className="text-red-500">*</span>
                      </label>
                      <Textarea
                        value={processRemark}
                        onChange={(e) => setProcessRemark(e.target.value)}
                        placeholder="请输入处理备注..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {data.status === "未处理" && (
                        <Button variant="outline" className="border-amber-500 text-amber-600 bg-transparent">
                          <Clock className="h-4 w-4 mr-2" />
                          标记处理中
                        </Button>
                      )}
                      <Button variant="outline">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        添加处理备注
                      </Button>
                      {(data.status === "未处理" || data.status === "处理中") && (
                        <Button className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          标记已处理
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 右侧历史记录 */}
            <div className="space-y-6">
              {/* 异常历史 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    该订单异常历史
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.historyExceptions.length > 0 ? (
                    <div className="space-y-3">
                      {data.historyExceptions.map((ex) => (
                        <div key={ex.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <Link
                              href={`/pms/orders/changes/${ex.id}`}
                              className="font-medium text-primary hover:underline text-sm"
                            >
                              {ex.id}
                            </Link>
                            {getStatusBadge(ex.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {ex.type}：{ex.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{ex.createdAt}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">该订单暂无其他异常记录</p>
                  )}
                </CardContent>
              </Card>

              {/* 快捷操作 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">快捷操作</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                    <Link href={`/pms/orders/${data.orderId}`}>
                      <Package className="h-4 w-4 mr-2" />
                      查看采购订单
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                    <Link href={`/pms/requirements/${data.requirementId}`}>
                      <FileText className="h-4 w-4 mr-2" />
                      查看采购需求
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                    <Link href={`/pms/orders/tracking/${data.orderId}`}>
                      <Clock className="h-4 w-4 mr-2" />
                      查看订单跟踪
                    </Link>
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
