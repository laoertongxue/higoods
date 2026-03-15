"use client"

import { useState } from "react"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  Package,
  Store,
  ShoppingCart,
  Link2,
  Video,
  AlertCircle,
  Bell,
  Mail,
  MessageSquare,
  Save,
} from "lucide-react"
import Link from "next/link"

// 风险规则配置
const riskRules = [
  {
    id: "WORKITEM_OVERDUE",
    label: "工作项超期",
    icon: Clock,
    description: "工作项 due_at < now 且未完成",
    enabled: true,
    severity_mapping: "超期1天=P2，超期3天=P1，超期7天=P0",
    routing: "assignee → 项目负责人",
    escalation: "P0: 2小时, P1: 1天, P2: 3天",
    cooldown: "6小时",
  },
  {
    id: "WORKITEM_BLOCKED",
    label: "工作项阻塞",
    icon: AlertCircle,
    description: "状态=BLOCKED 且 blocker 未解决>阈值",
    enabled: true,
    severity_mapping: "阻塞1天=P2，阻塞2天=P1，阻塞3天=P0",
    routing: "assignee → 项目负责人",
    escalation: "P0: 2小时, P1: 1天, P2: 3天",
    cooldown: "6小时",
  },
  {
    id: "SAMPLE_OVERDUE_RETURN",
    label: "样衣超期未归还",
    icon: Package,
    description: "样衣使用申请 expectedReturnAt < now 且未归还",
    enabled: true,
    severity_mapping: "超期1天=P2，超期3天=P1，超期7天=P0",
    routing: "领用人/申请负责人 → 站点仓管",
    escalation: "P0: 2小时, P1: 1天, P2: 3天",
    cooldown: "6小时",
  },
  {
    id: "SAMPLE_IN_TRANSIT_UNRECEIVED",
    label: "在途未签收",
    icon: Package,
    description: "寄出后超过阈值未签收",
    enabled: true,
    severity_mapping: "超期3天=P2，超期5天=P1，超期7天=P0",
    routing: "收件责任人 → 仓管主管",
    escalation: "P0: 2小时, P1: 1天, P2: 3天",
    cooldown: "6小时",
  },
  {
    id: "SAMPLE_STOCK_MISMATCH",
    label: "账实不一致",
    icon: AlertTriangle,
    description: "盘点差异/台账不闭环",
    enabled: true,
    severity_mapping: "差异1件=P2，差异3件=P1，差异5件=P0",
    routing: "站点仓管 → 仓管主管",
    escalation: "P0: 2小时, P1: 1天, P2: 3天",
    cooldown: "24小时",
  },
  {
    id: "STORE_AUTH_EXPIRED",
    label: "店铺授权过期",
    icon: Store,
    description: "connection_status=EXPIRED/FAILED",
    enabled: true,
    severity_mapping: "已过期=P0",
    routing: "店铺负责人 → 渠道主管",
    escalation: "P0: 2小时",
    cooldown: "1小时",
  },
  {
    id: "STORE_AUTH_EXPIRING",
    label: "店铺授权将过期",
    icon: Store,
    description: "EXPIRING<=7天",
    enabled: true,
    severity_mapping: "<=2天=P1，<=7天=P2",
    routing: "店铺负责人 → 渠道主管",
    escalation: "P1: 1天, P2: 3天",
    cooldown: "24小时",
  },
  {
    id: "LISTING_FAILED",
    label: "上架失败",
    icon: ShoppingCart,
    description: "商品上架实例失败",
    enabled: true,
    severity_mapping: "失败=P1",
    routing: "上架负责人 → 店铺负责人",
    escalation: "P1: 1天",
    cooldown: "6小时",
  },
  {
    id: "LISTING_TIMEOUT",
    label: "上架超时",
    icon: ShoppingCart,
    description: "上架中超过阈值未完成",
    enabled: true,
    severity_mapping: ">24h=P2，>72h=P1",
    routing: "上架负责人 → 店铺负责人",
    escalation: "P1: 1天, P2: 3天",
    cooldown: "6小时",
  },
  {
    id: "MAPPING_CONFLICT",
    label: "映射冲突",
    icon: Link2,
    description: "CodeMapping 冲突",
    enabled: true,
    severity_mapping: "冲突=P1",
    routing: "渠道运营 → 数据主管",
    escalation: "P1: 1天",
    cooldown: "6小时",
  },
  {
    id: "MAPPING_MISSING_SKU",
    label: "缺SKU映射",
    icon: Link2,
    description: "渠道商品缺 SKU 映射",
    enabled: true,
    severity_mapping: "缺失=P2",
    routing: "渠道运营 → 数据主管",
    escalation: "P2: 3天",
    cooldown: "24小时",
  },
  {
    id: "TEST_ACCOUNTING_PENDING",
    label: "测款待入账",
    icon: Video,
    description: "Live/Video 存在 TEST 条目且入账PENDING>阈值",
    enabled: true,
    severity_mapping: ">2天=P1，>7天=P0",
    routing: "场次/记录 owner 或 reviewer → 测款主管",
    escalation: "P0: 2小时, P1: 1天",
    cooldown: "6小时",
  },
]

// 通知偏好配置
const notificationPrefs = [
  { id: "P0", label: "P0 致命", siteNotify: true, email: true, wechat: true },
  { id: "P1", label: "P1 高", siteNotify: true, email: true, wechat: false },
  { id: "P2", label: "P2 中", siteNotify: true, email: false, wechat: false },
  { id: "P3", label: "P3 低", siteNotify: false, email: false, wechat: false },
]

export default function RiskSettingsPage() {
  const { toast } = useToast()
  const [rules, setRules] = useState(riskRules)
  const [prefs, setPrefs] = useState(notificationPrefs)
  const [dailyDigest, setDailyDigest] = useState(true)
  const [digestTime, setDigestTime] = useState("09:00")

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  }

  const togglePref = (id: string, field: "siteNotify" | "email" | "wechat") => {
    setPrefs((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: !p[field] } : p)))
  }

  const handleSave = () => {
    toast({ title: "保存成功", description: "风险规则配置已保存" })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/workspace/alerts">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回风险中心
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">风险规则配置</h1>
                <p className="text-sm text-muted-foreground mt-1">配置风险检测规则和通知偏好 (V0 只读)</p>
              </div>
            </div>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              保存配置
            </Button>
          </div>

          <Tabs defaultValue="rules">
            <TabsList>
              <TabsTrigger value="rules">RK3 风险规则</TabsTrigger>
              <TabsTrigger value="notify">RK4 通知偏好</TabsTrigger>
            </TabsList>

            {/* RK3: 风险规则配置 */}
            <TabsContent value="rules" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>风险检测规则</CardTitle>
                  <CardDescription>
                    以下规则用于自动检测各类风险并生成风险实例。V0版本为只读展示，V1将支持自定义阈值和路由策略。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">启用</TableHead>
                        <TableHead className="w-40">风险类型</TableHead>
                        <TableHead>触发条件</TableHead>
                        <TableHead className="w-48">严重等级映射</TableHead>
                        <TableHead className="w-48">路由策略</TableHead>
                        <TableHead className="w-40">升级阈值</TableHead>
                        <TableHead className="w-24">冷却时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((rule) => {
                        const Icon = rule.icon
                        return (
                          <TableRow key={rule.id}>
                            <TableCell>
                              <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{rule.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{rule.description}</TableCell>
                            <TableCell className="text-sm">{rule.severity_mapping}</TableCell>
                            <TableCell className="text-sm">{rule.routing}</TableCell>
                            <TableCell className="text-sm">{rule.escalation}</TableCell>
                            <TableCell className="text-sm">{rule.cooldown}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* 去重说明 */}
              <Card>
                <CardHeader>
                  <CardTitle>去重与防刷屏规则</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-medium mb-2">去重键规则</h4>
                      <p className="text-sm text-muted-foreground">
                        dedup_key = risk_type + source_type + source_id + 关键子维度
                      </p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        <li>• 样衣超期未归还 = risk_type + sample_use_request_id</li>
                        <li>• 映射缺失 = risk_type + channel_product_id</li>
                        <li>• 入账待处理 = risk_type + live_session_id</li>
                      </ul>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-medium mb-2">冷却机制</h4>
                      <p className="text-sm text-muted-foreground">同一 dedup_key 在冷却时间内仅提醒一次</p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        <li>• 默认冷却时间: 6小时</li>
                        <li>• 严重度升级时立即提醒</li>
                        <li>• 升级提醒不受冷却限制</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* RK4: 通知偏好 */}
            <TabsContent value="notify" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>通知渠道偏好</CardTitle>
                  <CardDescription>
                    根据风险严重等级配置通知方式。V0版本使用默认策略，V1将支持个人自定义。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>严重等级</TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Bell className="w-4 h-4" />
                            站内通知
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Mail className="w-4 h-4" />
                            邮件
                          </div>
                        </TableHead>
                        <TableHead className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            企业微信
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prefs.map((pref) => (
                        <TableRow key={pref.id}>
                          <TableCell>
                            <Badge
                              variant={pref.id === "P0" ? "destructive" : pref.id === "P1" ? "default" : "secondary"}
                            >
                              {pref.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={pref.siteNotify}
                              onCheckedChange={() => togglePref(pref.id, "siteNotify")}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox checked={pref.email} onCheckedChange={() => togglePref(pref.id, "email")} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox checked={pref.wechat} onCheckedChange={() => togglePref(pref.id, "wechat")} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>摘要通知</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>每日风险摘要</Label>
                      <p className="text-sm text-muted-foreground">每天定时发送未处理风险汇总</p>
                    </div>
                    <Switch checked={dailyDigest} onCheckedChange={setDailyDigest} />
                  </div>
                  {dailyDigest && (
                    <div className="flex items-center gap-4">
                      <Label>发送时间</Label>
                      <Input
                        type="time"
                        value={digestTime}
                        onChange={(e) => setDigestTime(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
