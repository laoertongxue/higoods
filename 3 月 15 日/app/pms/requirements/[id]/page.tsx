"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { PmsSystemNav } from "@/components/pms-system-nav"
import { PmsSidebarNav } from "@/components/pms-sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  Save,
  Send,
  FileText,
  XCircle,
  ExternalLink,
  Clock,
  User,
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

// 状态配置
const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  pending_approval: { label: "待审批", color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "已批准", color: "bg-green-100 text-green-700" },
  order_generated: { label: "已生成采购订单", color: "bg-blue-100 text-blue-700" },
  closed: { label: "已关闭", color: "bg-gray-100 text-gray-500" },
}

// 模拟数据
const requirementData = {
  id: "PR-2025-000387",
  type: "testing",
  source: "直播测款",
  sourceDetail: "2025-03-春夏专场",
  relatedObject: {
    type: "garment",
    name: "印尼风格碎花连衣裙",
    code: "SK2025-031",
    projectId: "PRJ-20251216-001",
  },
  status: "pending_approval",
  creator: "商品中心系统",
  createdAt: "2025-03-22 14:36",
  expectedDelivery: "2025-04-05",

  // 测款/业务背景
  testingData: {
    currentOrders: 218,
    targetThreshold: 200,
    estimatedFinalSales: 3200,
    conversionRate: 6.8,
    historicalMultiplier: 1.4,
  },

  // 库存评估
  inventoryAssessment: {
    physicalStock: 800,
    allocatedStock: 180,
    availableStock: 620,
    inTransitStock: 300,
    inTransitEta: "2025-03-28",
    safetyStock: 500,
    supportableQty: 920,
    gapQty: 2280,
    suggestedQty: 2600,
    redundancyRate: 15,
  },

  // 采购明细
  purchaseDetails: [
    {
      id: 1,
      sku: "SK2025-031",
      name: "印尼风格碎花连衣裙",
      spec: "M/L/XL 混码",
      suggestedQty: 2600,
      adjustedQty: 2600,
      adjustReason: "",
    },
  ],

  // 费用预估
  costEstimate: {
    historicalPrice: 68,
    estimatedAmount: 176800,
    domesticShipping: 6500,
    internationalShipping: 11200,
    totalEstimate: 194500,
  },

  // 审批记录
  approvalRecords: [
    {
      role: "商品负责人",
      user: "张琳",
      status: "approved",
      time: "2025-03-22 15:20",
      comment: "测款数据达标，同意采购",
    },
    {
      role: "采购负责人",
      user: "李明",
      status: "pending",
      time: null,
      comment: null,
    },
    {
      role: "财务负责人",
      user: "王芳",
      status: "pending",
      time: null,
      comment: null,
    },
  ],
}

export default function ProcurementRequirementDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [adjustedQty, setAdjustedQty] = useState(requirementData.purchaseDetails[0].suggestedQty)
  const [adjustReason, setAdjustReason] = useState("")
  const [showInventoryDetail, setShowInventoryDetail] = useState(true)

  const data = requirementData

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <PmsSystemNav />

      <div className="flex flex-1 overflow-hidden">
        <PmsSidebarNav />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 页面头部 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{data.id}</h1>
                  <Badge className={statusConfig[data.status].color}>{statusConfig[data.status].label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">采购需求详情 · {data.source}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {data.status === "draft" && (
                <>
                  <Button variant="outline">
                    <Save className="w-4 h-4 mr-2" />
                    保存草稿
                  </Button>
                  <Button>
                    <Send className="w-4 h-4 mr-2" />
                    提交审批
                  </Button>
                </>
              )}
              {data.status === "approved" && (
                <Button>
                  <FileText className="w-4 h-4 mr-2" />
                  生成采购订单
                </Button>
              )}
              {data.status !== "closed" && data.status !== "order_generated" && (
                <Button variant="outline" className="text-red-600 hover:text-red-700 bg-transparent">
                  <XCircle className="w-4 h-4 mr-2" />
                  关闭需求
                </Button>
              )}
            </div>
          </div>

          {/* 基础信息区 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基础信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground">采购需求编号</div>
                  <div className="font-medium mt-1">{data.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">需求类型</div>
                  <div className="font-medium mt-1">
                    <Badge className="bg-purple-100 text-purple-700">测款采购</Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">需求来源</div>
                  <div className="font-medium mt-1">
                    {data.source}（{data.sourceDetail}）
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">关联商品</div>
                  <div className="font-medium mt-1 flex items-center gap-2">
                    <span>{data.relatedObject.name}</span>
                    <Link href={`/projects/${data.relatedObject.projectId}`} className="text-primary hover:underline">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground">{data.relatedObject.code}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">需求状态</div>
                  <div className="font-medium mt-1">
                    <Badge className={statusConfig[data.status].color}>{statusConfig[data.status].label}</Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">创建人</div>
                  <div className="font-medium mt-1">{data.creator}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">创建时间</div>
                  <div className="font-medium mt-1">{data.createdAt}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">期望到货时间</div>
                  <div className="font-medium mt-1">{data.expectedDelivery}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 测款/业务背景信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                测款业务背景（只读）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-6">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">当前直播订单数</div>
                  <div className="text-2xl font-bold text-primary mt-1">{data.testingData.currentOrders} 单</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">测款达标阈值</div>
                  <div className="text-2xl font-bold mt-1">{data.testingData.targetThreshold} 单</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-green-700">预估最终销量</div>
                  <div className="text-2xl font-bold text-green-700 mt-1">
                    {data.testingData.estimatedFinalSales.toLocaleString()} 件
                  </div>
                  <div className="text-xs text-green-600 mt-1">可人工调整</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">首日转化率</div>
                  <div className="text-2xl font-bold mt-1">{data.testingData.conversionRate}%</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">历史放量系数</div>
                  <div className="text-2xl font-bold mt-1">{data.testingData.historicalMultiplier}x</div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <span className="font-medium">预估逻辑说明：</span>
                    首日转化率 {data.testingData.conversionRate}% × 历史同款放量系数{" "}
                    {data.testingData.historicalMultiplier} = 预估最终销量{" "}
                    {data.testingData.estimatedFinalSales.toLocaleString()} 件
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 库存评估 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  库存评估（核心决策区）
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowInventoryDetail(!showInventoryDetail)}>
                  {showInventoryDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showInventoryDetail && (
                <div className="grid grid-cols-2 gap-6">
                  {/* 库存数据表 */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">库存数据</h4>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2 text-muted-foreground">当前实物库存</td>
                          <td className="py-2 text-right font-medium">
                            {data.inventoryAssessment.physicalStock.toLocaleString()} 件
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 text-muted-foreground">已分配库存</td>
                          <td className="py-2 text-right font-medium text-orange-600">
                            -{data.inventoryAssessment.allocatedStock.toLocaleString()} 件
                          </td>
                        </tr>
                        <tr className="border-b bg-muted/30">
                          <td className="py-2 font-medium">可用库存</td>
                          <td className="py-2 text-right font-bold">
                            {data.inventoryAssessment.availableStock.toLocaleString()} 件
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 text-muted-foreground">在途库存</td>
                          <td className="py-2 text-right font-medium text-blue-600">
                            +{data.inventoryAssessment.inTransitStock.toLocaleString()} 件
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 text-xs text-muted-foreground pl-4">预计到仓</td>
                          <td className="py-2 text-right text-xs text-muted-foreground">
                            {data.inventoryAssessment.inTransitEta}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2 text-muted-foreground">安全库存</td>
                          <td className="py-2 text-right font-medium text-red-600">
                            -{data.inventoryAssessment.safetyStock.toLocaleString()} 件
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 系统计算 */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">系统计算</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">实际可支撑数量</div>
                        <div className="text-xl font-bold mt-1">
                          {data.inventoryAssessment.supportableQty.toLocaleString()} 件
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">可用库存 + 在途库存</div>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="text-sm text-orange-700">预计缺口数量</div>
                        <div className="text-xl font-bold text-orange-700 mt-1">
                          {data.inventoryAssessment.gapQty.toLocaleString()} 件
                        </div>
                        <div className="text-xs text-orange-600 mt-1">预估销量 - 可支撑数量</div>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-sm text-green-700">建议采购数量</div>
                        <div className="text-xl font-bold text-green-700 mt-1">
                          {data.inventoryAssessment.suggestedQty.toLocaleString()} 件
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          含 {data.inventoryAssessment.redundancyRate}% 冗余
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 采购明细 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">采购明细（可编辑）</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 text-sm font-medium">物料/SKU</th>
                    <th className="text-left py-3 px-4 text-sm font-medium">规格</th>
                    <th className="text-right py-3 px-4 text-sm font-medium">建议采购数量</th>
                    <th className="text-right py-3 px-4 text-sm font-medium">调整数量</th>
                    <th className="text-left py-3 px-4 text-sm font-medium">调整原因</th>
                  </tr>
                </thead>
                <tbody>
                  {data.purchaseDetails.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3 px-4">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-sm">{item.spec}</td>
                      <td className="py-3 px-4 text-right font-medium">{item.suggestedQty.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        <Input
                          type="number"
                          value={adjustedQty}
                          onChange={(e) => setAdjustedQty(Number(e.target.value))}
                          className="w-32 text-right ml-auto"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <Input
                          placeholder="调整原因（必填）"
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          disabled={adjustedQty === item.suggestedQty}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* 费用与成本预估 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">费用与成本预估（财务关注）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">历史采购单价</div>
                  <div className="text-xl font-bold mt-1">¥{data.costEstimate.historicalPrice}/件</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">预估采购金额</div>
                  <div className="text-xl font-bold mt-1">¥{data.costEstimate.estimatedAmount.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">不含税</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">国内段运费预估</div>
                  <div className="text-xl font-bold mt-1">¥{data.costEstimate.domesticShipping.toLocaleString()}</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">转运/海运预估</div>
                  <div className="text-xl font-bold mt-1">
                    ¥{data.costEstimate.internationalShipping.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-sm text-primary">预估综合成本</div>
                  <div className="text-xl font-bold text-primary mt-1">
                    ¥{data.costEstimate.totalEstimate.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <span className="font-medium">备注：</span>
                    费用为预估，最终以采购订单为准
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 审批与操作区 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">审批流程</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {data.approvalRecords.map((record, index) => (
                  <div key={index} className="flex items-center">
                    <div
                      className={`p-4 rounded-lg border ${
                        record.status === "approved"
                          ? "bg-green-50 border-green-200"
                          : record.status === "pending"
                            ? "bg-yellow-50 border-yellow-200"
                            : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {record.status === "approved" ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-600" />
                        )}
                        <span className="text-sm font-medium">{record.role}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-3 h-3" />
                        <span>{record.user}</span>
                      </div>
                      {record.time && <div className="text-xs text-muted-foreground mt-1">{record.time}</div>}
                      {record.comment && <div className="text-xs text-green-600 mt-2">{record.comment}</div>}
                    </div>
                    {index < data.approvalRecords.length - 1 && <div className="w-8 h-0.5 bg-muted mx-2" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
