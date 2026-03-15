"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { PmsSidebarNav } from "@/components/pms-sidebar-nav"
import { PmsSystemNav } from "@/components/pms-system-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Send, FileText, XCircle, CheckCircle, Clock, AlertTriangle, Edit } from "lucide-react"

export default function StockingRequirementDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [isEditing, setIsEditing] = useState(false)
  const [adjustedQty, setAdjustedQty] = useState(250)
  const [adjustReason, setAdjustReason] = useState("")

  const requirement = {
    id: "PR-2025-000412",
    type: "备货采购",
    source: "库存安全库存触发",
    materialName: "40S 精梳棉面料（白色）",
    materialCode: "FAB-2025-001",
    status: "pending",
    creator: "采购系统 / 李伟",
    createdAt: "2025-03-22 10:15",
    expectedDate: "2025-04-10",
    // 库存评估
    currentStock: 300,
    safetyStock: 500,
    inTransitStock: 150,
    inTransitDate: "2025-03-30",
    availableStock: 450,
    gapQty: 200,
    suggestedQty: 250,
    redundancy: 25,
    // 费用
    unitPrice: 36,
    estimatedAmount: 9000,
    domesticShipping: 500,
    internationalShipping: 700,
    totalCost: 10200,
  }

  const approvalFlow = [
    { role: "采购负责人", name: "李伟", status: "pending", time: null, comment: null },
    { role: "财务负责人", name: "王芳", status: "waiting", time: null, comment: null },
  ]

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
                <Link href="/pms/requirements/stocking">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{requirement.id}</h1>
                  <Badge variant="default">待审批</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {requirement.type} · {requirement.source}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline">
                <Save className="h-4 w-4 mr-2" />
                保存草稿
              </Button>
              <Button variant="outline">
                <Send className="h-4 w-4 mr-2" />
                提交审批
              </Button>
              <Button>
                <FileText className="h-4 w-4 mr-2" />
                生成采购订单
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="col-span-2 space-y-6">
              {/* 基础信息 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">基础信息</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">采购需求编号</div>
                      <div className="font-medium mt-1">{requirement.id}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">需求类型</div>
                      <div className="font-medium mt-1">{requirement.type}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">需求来源</div>
                      <div className="font-medium mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        {requirement.source}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">关联物料</div>
                      <div className="font-medium mt-1">{requirement.materialName}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">物料编码</div>
                      <div className="font-medium mt-1">{requirement.materialCode}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">期望到货时间</div>
                      <div className="font-medium mt-1">{requirement.expectedDate}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">创建人</div>
                      <div className="font-medium mt-1">{requirement.creator}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">创建时间</div>
                      <div className="font-medium mt-1">{requirement.createdAt}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 库存评估 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    库存评估
                    <Badge variant="secondary" className="font-normal">
                      核心决策区
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-3">
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">当前实物库存</span>
                        <span className="font-medium">{requirement.currentStock.toLocaleString()} 米</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">安全库存</span>
                        <span className="font-medium">{requirement.safetyStock.toLocaleString()} 米</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">在途库存（预计{requirement.inTransitDate}到仓）</span>
                        <span className="font-medium text-green-600">
                          +{requirement.inTransitStock.toLocaleString()} 米
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between p-2 bg-blue-50 rounded border border-blue-200">
                        <span className="text-blue-800">可用库存计算结果</span>
                        <span className="font-bold text-blue-800">
                          {requirement.availableStock.toLocaleString()} 米
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-red-50 rounded border border-red-200">
                        <span className="text-red-800">系统计算缺口数量</span>
                        <span className="font-bold text-red-800">{requirement.gapQty.toLocaleString()} 米</span>
                      </div>
                      <div className="flex justify-between p-2 bg-green-50 rounded border border-green-200">
                        <span className="text-green-800">建议采购数量（含{requirement.redundancy}米冗余）</span>
                        <span className="font-bold text-green-800">{requirement.suggestedQty.toLocaleString()} 米</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 采购明细 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">采购明细</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                      <Edit className="h-4 w-4 mr-2" />
                      {isEditing ? "取消编辑" : "调整数量"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">物料名称</th>
                        <th className="text-left p-3 font-medium">批次/规格</th>
                        <th className="text-right p-3 font-medium">建议采购数量</th>
                        <th className="text-right p-3 font-medium">调整数量</th>
                        <th className="text-left p-3 font-medium">调整原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-3 font-medium">{requirement.materialName}</td>
                        <td className="p-3 text-muted-foreground">标准卷布</td>
                        <td className="p-3 text-right font-medium">{requirement.suggestedQty.toLocaleString()} 米</td>
                        <td className="p-3 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={adjustedQty}
                              onChange={(e) => setAdjustedQty(Number(e.target.value))}
                              className="w-24 text-right"
                            />
                          ) : (
                            <span className="font-medium">{adjustedQty.toLocaleString()} 米</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <Input
                              placeholder="必填"
                              value={adjustReason}
                              onChange={(e) => setAdjustReason(e.target.value)}
                            />
                          ) : (
                            <span className="text-muted-foreground">{adjustReason || "-"}</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* 费用与成本 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">费用与成本预估</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">历史采购单价</span>
                        <span className="font-medium">¥{requirement.unitPrice} / 米</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">预估采购金额（不含税）</span>
                        <span className="font-medium">¥{requirement.estimatedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">国内段运费预估</span>
                        <span className="font-medium">¥{requirement.domesticShipping.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">转运/海运预估</span>
                        <span className="font-medium">¥{requirement.internationalShipping.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-primary/10 rounded border border-primary/20">
                        <span className="font-medium">预估综合成本</span>
                        <span className="font-bold text-primary">¥{requirement.totalCost.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-sm text-amber-800">费用为预估，最终以采购订单为准</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Approval Flow */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">审批流程</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {approvalFlow.map((step, index) => (
                      <div key={index} className="relative">
                        {index < approvalFlow.length - 1 && (
                          <div className="absolute left-4 top-10 w-0.5 h-12 bg-border" />
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
                                <Badge variant="outline" className="text-green-600 border-green-200">
                                  已审批
                                </Badge>
                              )}
                              {step.status === "pending" && (
                                <Badge variant="outline" className="text-amber-600 border-amber-200">
                                  待审批
                                </Badge>
                              )}
                              {step.status === "waiting" && <Badge variant="secondary">等待中</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">{step.name}</div>
                            {step.time && <div className="text-xs text-muted-foreground mt-1">{step.time}</div>}
                            {step.comment && <div className="text-sm mt-2 p-2 bg-muted/50 rounded">{step.comment}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">快捷操作</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <FileText className="h-4 w-4 mr-2" />
                    查看物料档案
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent">
                    <FileText className="h-4 w-4 mr-2" />
                    查看库存明细
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:text-destructive bg-transparent"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    关闭需求
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
