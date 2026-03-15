"use client"

import { useState } from "react"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function GroupOverviewPage() {
  const [period, setPeriod] = useState("today")

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">集团总览（USD）</h1>
          <p className="text-muted-foreground mt-1">数据更新时间：2026-01-17 10:30:00</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">今日</SelectItem>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
              <SelectItem value="quarter">本季度</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">集团现金余额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-blue-900">$2,345,678</span>
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                +5.2%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700">本月营收</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-green-900">$1,234,567</span>
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                +12.3%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">应收账款</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-orange-900">$567,890</span>
              <div className="flex items-center text-red-600 text-sm">
                <TrendingDown className="h-4 w-4 mr-1" />
                -3.1%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">待处理异常</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-red-900">23</span>
              <Badge variant="destructive">需关注</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 二级指标 */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: "平台待提现", value: "$123,456", trend: "+8%" },
          { label: "待核销金额", value: "$45,678", trend: "-2%" },
          { label: "本月毛利率", value: "32.5%", trend: "+1.2%" },
          { label: "资金周转天数", value: "28天", trend: "-3天" },
          { label: "待审批付款", value: "15笔", trend: "" },
          { label: "本月关账进度", value: "60%", trend: "" },
        ].map((item, index) => (
          <Card key={index}>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <div className="flex items-end justify-between mt-1">
                <span className="text-xl font-bold">{item.value}</span>
                {item.trend && (
                  <span
                    className={`text-xs ${item.trend.startsWith("+") ? "text-green-600" : item.trend.startsWith("-") ? "text-red-600" : ""}`}
                  >
                    {item.trend}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 快捷入口和待办 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 待办事项 */}
        <Card className="col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>待办事项</CardTitle>
              <Button variant="link" size="sm">
                查看全部 <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { type: "审批", title: "付款申请 #PAY-2026-0123 待审批", time: "10分钟前", priority: "high" },
                { type: "核对", title: "TikTok 店铺 A 结算单待核对", time: "30分钟前", priority: "medium" },
                { type: "异常", title: "银行流水匹配异常 3 笔", time: "1小时前", priority: "high" },
                { type: "提醒", title: "本月关账截止还有 5 天", time: "2小时前", priority: "low" },
                { type: "审批", title: "供应商结算单 #SET-2026-0456 待确认", time: "3小时前", priority: "medium" },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        item.priority === "high" ? "destructive" : item.priority === "medium" ? "default" : "secondary"
                      }
                    >
                      {item.type}
                    </Badge>
                    <span className="text-sm">{item.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 快捷入口 */}
        <Card>
          <CardHeader>
            <CardTitle>快捷入口</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "发起付款", icon: DollarSign },
                { label: "对账确认", icon: CheckCircle },
                { label: "异常处理", icon: AlertTriangle },
                { label: "快捷查询", icon: Clock },
              ].map((item, index) => {
                const Icon = item.icon
                return (
                  <Button key={index} variant="outline" className="h-20 flex-col gap-2 bg-transparent">
                    <Icon className="h-5 w-5" />
                    <span className="text-sm">{item.label}</span>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 异常与预警 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>异常与预警</CardTitle>
            <Button variant="link" size="sm">
              查看全部 <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "结算差异", count: 5, type: "error" },
              { label: "对账异常", count: 3, type: "error" },
              { label: "逾期应收", count: 8, type: "warning" },
              { label: "汇率波动提醒", count: 2, type: "info" },
            ].map((item, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                  item.type === "error"
                    ? "bg-red-50 border-red-200"
                    : item.type === "warning"
                      ? "bg-orange-50 border-orange-200"
                      : "bg-blue-50 border-blue-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.label}</span>
                  <Badge
                    variant={item.type === "error" ? "destructive" : item.type === "warning" ? "default" : "secondary"}
                  >
                    {item.count}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
