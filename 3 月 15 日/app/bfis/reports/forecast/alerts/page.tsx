"use client"

import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  TrendingDown,
  Calendar,
  DollarSign,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// FC6｜资金预警与建议动作页
// 预警类型：即将低于安全线、持续负流量、大额支出集中、规则异常
// 建议动作：加快回款、延期支付、调整广告、申请融资

type AlertType = "LOW_BALANCE" | "NEGATIVE_FLOW" | "LARGE_OUTFLOW" | "RULE_ERROR"
type AlertLevel = "CRITICAL" | "HIGH" | "MEDIUM"
type ActionType = "ACCELERATE_INFLOW" | "DELAY_OUTFLOW" | "ADJUST_BUDGET" | "SEEK_FINANCING"

interface Alert {
  id: string
  type: AlertType
  level: AlertLevel
  title: string
  description: string
  triggerDate: string
  affectedAmount: number
  relatedItems: string[]
  suggestedActions: ActionType[]
  status: "PENDING" | "ACKNOWLEDGED" | "RESOLVED"
  createdAt: string
}

interface SuggestedAction {
  type: ActionType
  title: string
  description: string
  impact: string
  priority: number
}

const alertTypeConfig: Record<AlertType, { label: string; color: string; icon: typeof AlertTriangle }> = {
  LOW_BALANCE: { label: "余额预警", color: "bg-red-100 text-red-700", icon: TrendingDown },
  NEGATIVE_FLOW: { label: "负流量预警", color: "bg-orange-100 text-orange-700", icon: TrendingDown },
  LARGE_OUTFLOW: { label: "大额支出", color: "bg-yellow-100 text-yellow-700", icon: DollarSign },
  RULE_ERROR: { label: "规则异常", color: "bg-purple-100 text-purple-700", icon: RefreshCw },
}

const alertLevelConfig: Record<AlertLevel, { label: string; color: string }> = {
  CRITICAL: { label: "严重", color: "bg-red-600 text-white" },
  HIGH: { label: "高", color: "bg-orange-600 text-white" },
  MEDIUM: { label: "中", color: "bg-yellow-600 text-white" },
}

const actionTypeConfig: Record<ActionType, { label: string; color: string }> = {
  ACCELERATE_INFLOW: { label: "加快回款", color: "bg-green-100 text-green-700" },
  DELAY_OUTFLOW: { label: "延期支付", color: "bg-blue-100 text-blue-700" },
  ADJUST_BUDGET: { label: "调整预算", color: "bg-purple-100 text-purple-700" },
  SEEK_FINANCING: { label: "申请融资", color: "bg-orange-100 text-orange-700" },
}

// Mock 预警数据
const mockAlerts: Alert[] = [
  {
    id: "ALT001",
    type: "LOW_BALANCE",
    level: "CRITICAL",
    title: "2026-01-31 余额将低于安全线",
    description: "预测余额将降至 $48,000，低于最低安全线 $50,000",
    triggerDate: "2026-01-31",
    affectedAmount: 48000,
    relatedItems: ["OUT001", "OUT002", "OUT005"],
    suggestedActions: ["ACCELERATE_INFLOW", "DELAY_OUTFLOW"],
    status: "PENDING",
    createdAt: "2026-01-21 08:00",
  },
  {
    id: "ALT002",
    type: "NEGATIVE_FLOW",
    level: "HIGH",
    title: "1月28-31日持续净流出",
    description: "连续4天净流出，累计 -$52,000",
    triggerDate: "2026-01-28",
    affectedAmount: 52000,
    relatedItems: ["OUT001", "OUT002", "OUT005", "OUT006"],
    suggestedActions: ["ADJUST_BUDGET", "SEEK_FINANCING"],
    status: "PENDING",
    createdAt: "2026-01-21 09:30",
  },
  {
    id: "ALT003",
    type: "LARGE_OUTFLOW",
    level: "MEDIUM",
    title: "1月25日大额支出集中",
    description: "单日支出 $36,840，包含工资 + 供应商付款",
    triggerDate: "2026-01-25",
    affectedAmount: 36840,
    relatedItems: ["OUT001", "OUT002"],
    suggestedActions: ["DELAY_OUTFLOW"],
    status: "ACKNOWLEDGED",
    createdAt: "2026-01-20 14:00",
  },
]

// Mock 建议动作
const mockActions: SuggestedAction[] = [
  {
    type: "ACCELERATE_INFLOW",
    title: "催收应收账款 AR_20251224_A001",
    description: "客户A应收款 $8,500 将于1月24日到期，建议提前催收",
    impact: "预计可提前2-3天回款，改善1月底流动性",
    priority: 1,
  },
  {
    type: "DELAY_OUTFLOW",
    title: "与供应商B协商延期付款",
    description: "应付账款 $11,730 原定1月28日支付，建议延期至2月初",
    impact: "可延缓约5天支付，缓解1月底现金压力",
    priority: 2,
  },
  {
    type: "ADJUST_BUDGET",
    title: "暂停或降低TikTok广告投放",
    description: "1月23日预计广告支出 $28,440，建议临时调低",
    impact: "可减少支出20-30%，约节省 $6,000-$8,000",
    priority: 3,
  },
  {
    type: "SEEK_FINANCING",
    title: "启动短期信用额度申请",
    description: "向银行申请 $20,000-$30,000 短期授信，以备不时之需",
    impact: "提供安全缓冲，避免资金链断裂风险",
    priority: 4,
  },
]

export default function ForecastAlertsPage() {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">资金预警与建议动作</h1>
          <p className="text-muted-foreground">实时监控资金风险，提供可执行的改善建议</p>
        </div>
        <Link href="/bfis/reports/forecast/rules">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            调整预警阈值
          </Button>
        </Link>
      </div>

      {/* 预警统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {mockAlerts.filter((a) => a.level === "CRITICAL").length}
                </div>
                <div className="text-sm text-red-600">严重预警</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {mockAlerts.filter((a) => a.level === "HIGH").length}
                </div>
                <div className="text-sm text-orange-600">高级预警</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-gray-600" />
              <div>
                <div className="text-2xl font-bold">
                  {mockAlerts.filter((a) => a.status === "PENDING").length}
                </div>
                <div className="text-sm text-muted-foreground">待处理</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{mockActions.length}</div>
                <div className="text-sm text-muted-foreground">建议动作</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">预警列表</TabsTrigger>
          <TabsTrigger value="actions">建议动作</TabsTrigger>
        </TabsList>

        {/* 预警列表 */}
        <TabsContent value="alerts">
          <div className="space-y-4">
            {mockAlerts.map((alert) => {
              const Icon = alertTypeConfig[alert.type].icon
              return (
                <Card
                  key={alert.id}
                  className={`${
                    alert.level === "CRITICAL"
                      ? "border-red-300 bg-red-50"
                      : alert.level === "HIGH"
                        ? "border-orange-300 bg-orange-50"
                        : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            alert.level === "CRITICAL"
                              ? "bg-red-100"
                              : alert.level === "HIGH"
                                ? "bg-orange-100"
                                : "bg-yellow-100"
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${
                              alert.level === "CRITICAL"
                                ? "text-red-600"
                                : alert.level === "HIGH"
                                  ? "text-orange-600"
                                  : "text-yellow-600"
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{alert.title}</CardTitle>
                            <Badge className={alertLevelConfig[alert.level].color}>
                              {alertLevelConfig[alert.level].label}
                            </Badge>
                            <Badge className={alertTypeConfig[alert.type].color}>
                              {alertTypeConfig[alert.type].label}
                            </Badge>
                          </div>
                          <CardDescription>{alert.description}</CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          alert.status === "PENDING"
                            ? "bg-gray-100"
                            : alert.status === "ACKNOWLEDGED"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                        }
                      >
                        {alert.status === "PENDING"
                          ? "待处理"
                          : alert.status === "ACKNOWLEDGED"
                            ? "已确认"
                            : "已解决"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-muted-foreground">触发日期</div>
                        <div className="font-medium">{alert.triggerDate}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">影响金额</div>
                        <div className="font-medium font-mono">${alert.affectedAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">关联条目</div>
                        <div className="font-medium">{alert.relatedItems.length} 项</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">建议动作：</div>
                      <div className="flex flex-wrap gap-2">
                        {alert.suggestedActions.map((action) => (
                          <Badge key={action} className={actionTypeConfig[action].color}>
                            {actionTypeConfig[action].label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" size="sm">
                        忽略
                      </Button>
                      <Button size="sm">查看详情</Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* 建议动作 */}
        <TabsContent value="actions">
          <div className="space-y-4">
            {mockActions.map((action, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={actionTypeConfig[action.type].color}>
                          {actionTypeConfig[action.type].label}
                        </Badge>
                        <Badge variant="outline">优先级 {action.priority}</Badge>
                      </div>
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                      <CardDescription className="mt-2">{action.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm font-medium text-blue-900 mb-1">预计影响</div>
                      <div className="text-sm text-blue-700">{action.impact}</div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm">
                        暂不执行
                      </Button>
                      <Button size="sm">
                        执行动作
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
