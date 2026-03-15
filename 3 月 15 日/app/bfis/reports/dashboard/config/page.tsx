"use client"

import { useState } from "react"
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

// GD3｜驾驶舱配置页（财务/管理员可配置展示卡片/阈值）

export default function DashboardConfigPage() {
  const [thresholds, setThresholds] = useState({
    overdueCollectionDays: 7,
    cashDeltaUSD: 5000,
    cashDeltaIDR: 78000000,
    cashDeltaCNY: 36000,
    marginDelayDays: 2,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/bfis/reports/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回驾驶舱
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">驾驶舱配置</h1>
            <p className="text-muted-foreground">配置展示卡片、预警阈值和默认筛选项</p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          保存配置
        </Button>
      </div>

      {/* Section Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>区块展示配置</CardTitle>
          <CardDescription>控制各区块在驾驶舱中的显示与隐藏</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>经营结果（Operating Result）</Label>
              <p className="text-sm text-muted-foreground">GMV、毛利、毛利率等核心经营指标</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>现金安全（Cash Safety）</Label>
              <p className="text-sm text-muted-foreground">银行余额、系统余额、预计最低现金点</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>平台回款态势（Platform Collection）</Label>
              <p className="text-sm text-muted-foreground">应收四态、提现中、超期未到账</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>资产与占用（Inventory & Assets）</Label>
              <p className="text-sm text-muted-foreground">存货、固定资产、样衣资产</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>风险与待办（Risk & To-do）</Label>
              <p className="text-sm text-muted-foreground">预警汇总、待办事项</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Threshold Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>预警阈值配置</CardTitle>
          <CardDescription>设置各类风险预警的触发阈值</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>回款超期天数（天）</Label>
              <Input
                type="number"
                value={thresholds.overdueCollectionDays}
                onChange={(e) => setThresholds({ ...thresholds, overdueCollectionDays: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">超过该天数未到账的提现单将被标记为超期</p>
            </div>

            <div className="space-y-2">
              <Label>毛利快照延迟天数（天）</Label>
              <Input
                type="number"
                value={thresholds.marginDelayDays}
                onChange={(e) => setThresholds({ ...thresholds, marginDelayDays: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">超过该天数未生成快照将触发预警</p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-4">余额差异阈值（按币种）</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>USD 阈值</Label>
                <Input
                  type="number"
                  value={thresholds.cashDeltaUSD}
                  onChange={(e) => setThresholds({ ...thresholds, cashDeltaUSD: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>IDR 阈值</Label>
                <Input
                  type="number"
                  value={thresholds.cashDeltaIDR}
                  onChange={(e) => setThresholds({ ...thresholds, cashDeltaIDR: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>CNY 阈值</Label>
                <Input
                  type="number"
                  value={thresholds.cashDeltaCNY}
                  onChange={(e) => setThresholds({ ...thresholds, cashDeltaCNY: Number(e.target.value) })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">银行余额与系统余额差异超过该值时触发预警</p>
          </div>
        </CardContent>
      </Card>

      {/* Default Filter Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>默认筛选项配置</CardTitle>
          <CardDescription>设置驾驶舱打开时的默认筛选条件</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>默认时间范围</Label>
              <Select defaultValue="month">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">今日</SelectItem>
                  <SelectItem value="week">本周</SelectItem>
                  <SelectItem value="month">本月</SelectItem>
                  <SelectItem value="quarter">本季度</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>默认视角</Label>
              <Select defaultValue="group">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">集团</SelectItem>
                  <SelectItem value="entity">按法人主体</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>默认币种视图</Label>
              <Select defaultValue="USD">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD（集团）</SelectItem>
                  <SelectItem value="native">原币</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-based Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>角色权限配置</CardTitle>
          <CardDescription>控制不同角色在驾驶舱中看到的内容</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">老板（Boss）</div>
                <div className="text-sm text-muted-foreground">查看所有区块，简化版口径说明</div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">财务（Finance）</div>
                <div className="text-sm text-muted-foreground">查看所有区块，完整血缘与字段映射</div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">业务（Business）</div>
                <div className="text-sm text-muted-foreground">查看经营结果、平台回款区块</div>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
