"use client"

import { useState } from "react"
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  Copy,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  Filter,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

// FC5｜规则与假设集配置页（财务后台，核心细化）
// 平台回款三日期推算规则：平台单created_at → expected_settlement_at → confirmed_settlement_at → bank_receipt_at
// 规则配置包含：T+N天规则、工作日规则、假期规则、币种特殊规则

type RuleType = "PLATFORM_SETTLEMENT" | "AR_DUE" | "AP_DUE" | "FIXED_EXPENSE" | "SEASONAL_PATTERN"
type RuleStatus = "ACTIVE" | "DRAFT" | "DISABLED"

interface Rule {
  id: string
  code: string
  name: string
  type: RuleType
  status: RuleStatus
  description: string
  config: Record<string, unknown>
  priority: number
  createdAt: string
  updatedAt: string
}

const ruleTypeConfig: Record<RuleType, { label: string; color: string }> = {
  PLATFORM_SETTLEMENT: { label: "平台到账", color: "bg-blue-100 text-blue-700" },
  AR_DUE: { label: "应收账款", color: "bg-green-100 text-green-700" },
  AP_DUE: { label: "应付账款", color: "bg-purple-100 text-purple-700" },
  FIXED_EXPENSE: { label: "固定费用", color: "bg-orange-100 text-orange-700" },
  SEASONAL_PATTERN: { label: "季节模式", color: "bg-pink-100 text-pink-700" },
}

const ruleStatusConfig: Record<RuleStatus, { label: string; color: string }> = {
  ACTIVE: { label: "生效中", color: "bg-green-100 text-green-700" },
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  DISABLED: { label: "已停用", color: "bg-red-100 text-red-700" },
}

// Mock 规则数据
const mockRules: Rule[] = [
  {
    id: "RULE001",
    code: "RULE_TIKTOK_T0",
    name: "TikTok Shop T+0 推算",
    type: "PLATFORM_SETTLEMENT",
    status: "ACTIVE",
    description: "TikTok Shop平台单创建后T+0日到账，周末顺延至下周一",
    config: {
      platform: "TikTok Shop",
      t_days: 0,
      skip_weekend: true,
      skip_holiday: true,
      currency: "IDR",
    },
    priority: 1,
    createdAt: "2026-01-01 10:00",
    updatedAt: "2026-01-15 14:30",
  },
  {
    id: "RULE002",
    code: "RULE_SHOPEE_T3",
    name: "Shopee T+3 推算",
    type: "PLATFORM_SETTLEMENT",
    status: "ACTIVE",
    description: "Shopee平台单创建后T+3日到账，需扣除工作日",
    config: {
      platform: "Shopee",
      t_days: 3,
      skip_weekend: true,
      skip_holiday: true,
      currency: "IDR",
    },
    priority: 2,
    createdAt: "2026-01-01 10:00",
    updatedAt: "2026-01-10 16:00",
  },
  {
    id: "RULE003",
    code: "RULE_LAZADA_T7",
    name: "Lazada T+7 推算",
    type: "PLATFORM_SETTLEMENT",
    status: "ACTIVE",
    description: "Lazada平台单创建后T+7日到账",
    config: {
      platform: "Lazada",
      t_days: 7,
      skip_weekend: true,
      skip_holiday: false,
      currency: "IDR",
    },
    priority: 3,
    createdAt: "2026-01-01 10:00",
    updatedAt: "2026-01-01 10:00",
  },
  {
    id: "RULE004",
    code: "RULE_AR_DUE",
    name: "应收账款到期",
    type: "AR_DUE",
    status: "ACTIVE",
    description: "基于应收账款到期日预测回款，默认按到期日计算",
    config: {
      confidence_decay_days: 30,
      overdue_penalty_rate: 0.1,
    },
    priority: 10,
    createdAt: "2026-01-01 10:00",
    updatedAt: "2026-01-05 11:00",
  },
  {
    id: "RULE005",
    code: "RULE_AP_DUE",
    name: "应付账款到期",
    type: "AP_DUE",
    status: "ACTIVE",
    description: "基于应付账款到期日预测付款，默认按到期日计算",
    config: {
      advance_payment_days: 0,
      delay_tolerance_days: 3,
    },
    priority: 10,
    createdAt: "2026-01-01 10:00",
    updatedAt: "2026-01-01 10:00",
  },
  {
    id: "RULE006",
    code: "RULE_SALARY_MONTHLY",
    name: "月度工资发放",
    type: "FIXED_EXPENSE",
    status: "ACTIVE",
    description: "每月25日发放工资，若遇周末则提前至最近工作日",
    config: {
      day_of_month: 25,
      advance_if_weekend: true,
      amount_usd: 12500,
    },
    priority: 20,
    createdAt: "2026-01-01 10:00",
    updatedAt: "2026-01-01 10:00",
  },
]

export default function ForecastRulesPage() {
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const openEdit = (rule?: Rule) => {
    if (rule) {
      setSelectedRule(rule)
    } else {
      setSelectedRule(null)
    }
    setIsEditOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">规则与假设集配置</h1>
          <p className="text-muted-foreground">
            配置平台回款T+N推算、应收应付到期、固定费用等预测规则
          </p>
        </div>
        <Button size="sm" onClick={() => openEdit()}>
          <Plus className="h-4 w-4 mr-2" />
          新建规则
        </Button>
      </div>

      {/* 规则统计 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">规则总数</div>
            <div className="text-2xl font-bold mt-1">{mockRules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">生效中</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {mockRules.filter((r) => r.status === "ACTIVE").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">草稿</div>
            <div className="text-2xl font-bold mt-1">
              {mockRules.filter((r) => r.status === "DRAFT").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">已停用</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {mockRules.filter((r) => r.status === "DISABLED").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">平台规则</div>
            <div className="text-2xl font-bold mt-1">
              {mockRules.filter((r) => r.type === "PLATFORM_SETTLEMENT").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="platform">
        <TabsList>
          <TabsTrigger value="platform">平台到账规则</TabsTrigger>
          <TabsTrigger value="ar_ap">应收应付规则</TabsTrigger>
          <TabsTrigger value="fixed">固定费用规则</TabsTrigger>
          <TabsTrigger value="all">全部规则</TabsTrigger>
        </TabsList>

        {/* 平台到账规则 */}
        <TabsContent value="platform">
          <Card>
            <CardHeader>
              <CardTitle>平台到账规则（T+N推算）</CardTitle>
              <CardDescription>
                基于平台单created_at推算expected_settlement_at，再推算bank_receipt_at
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>规则编码</TableHead>
                    <TableHead>规则名称</TableHead>
                    <TableHead>平台</TableHead>
                    <TableHead>T+天数</TableHead>
                    <TableHead>跳过周末</TableHead>
                    <TableHead>跳过假日</TableHead>
                    <TableHead>优先级</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRules
                    .filter((r) => r.type === "PLATFORM_SETTLEMENT")
                    .map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono text-sm">{rule.code}</TableCell>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>{(rule.config.platform as string) || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">T+{rule.config.t_days as number}</Badge>
                        </TableCell>
                        <TableCell>
                          {rule.config.skip_weekend ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </TableCell>
                        <TableCell>
                          {rule.config.skip_holiday ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </TableCell>
                        <TableCell>{rule.priority}</TableCell>
                        <TableCell>
                          <Badge className={ruleStatusConfig[rule.status].color}>
                            {ruleStatusConfig[rule.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 应收应付规则 */}
        <TabsContent value="ar_ap">
          <Card>
            <CardHeader>
              <CardTitle>应收应付规则</CardTitle>
              <CardDescription>基于应收账款、应付账款到期日的回款/付款预测</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>规则编码</TableHead>
                    <TableHead>规则名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>优先级</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRules
                    .filter((r) => r.type === "AR_DUE" || r.type === "AP_DUE")
                    .map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono text-sm">{rule.code}</TableCell>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <Badge className={ruleTypeConfig[rule.type].color}>
                            {ruleTypeConfig[rule.type].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md text-sm text-muted-foreground">
                          {rule.description}
                        </TableCell>
                        <TableCell>{rule.priority}</TableCell>
                        <TableCell>
                          <Badge className={ruleStatusConfig[rule.status].color}>
                            {ruleStatusConfig[rule.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 固定费用规则 */}
        <TabsContent value="fixed">
          <Card>
            <CardHeader>
              <CardTitle>固定费用规则</CardTitle>
              <CardDescription>月度/季度固定支出的自动预测</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>规则编码</TableHead>
                    <TableHead>规则名称</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>配置</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRules
                    .filter((r) => r.type === "FIXED_EXPENSE")
                    .map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono text-sm">{rule.code}</TableCell>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell className="max-w-md text-sm text-muted-foreground">
                          {rule.description}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-xs">
                            {rule.config.day_of_month && (
                              <span>每月 {rule.config.day_of_month as number} 日</span>
                            )}
                            {rule.config.amount_usd && (
                              <span className="font-mono">${rule.config.amount_usd as number}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={ruleStatusConfig[rule.status].color}>
                            {ruleStatusConfig[rule.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 全部规则 */}
        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>规则编码</TableHead>
                    <TableHead>规则名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>优先级</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono text-sm">{rule.code}</TableCell>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        <Badge className={ruleTypeConfig[rule.type].color}>
                          {ruleTypeConfig[rule.type].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md text-sm text-muted-foreground">
                        {rule.description}
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <Badge className={ruleStatusConfig[rule.status].color}>
                          {ruleStatusConfig[rule.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{rule.updatedAt}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 编辑抽屉 */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedRule ? "编辑规则" : "新建规则"}</SheetTitle>
            <SheetDescription>配置预测规则的参数与优先级</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label>规则编码</Label>
              <Input placeholder="RULE_XXX_XXX" defaultValue={selectedRule?.code} />
            </div>
            <div className="space-y-2">
              <Label>规则名称</Label>
              <Input placeholder="规则名称" defaultValue={selectedRule?.name} />
            </div>
            <div className="space-y-2">
              <Label>规则类型</Label>
              <Select defaultValue={selectedRule?.type || "PLATFORM_SETTLEMENT"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLATFORM_SETTLEMENT">平台到账</SelectItem>
                  <SelectItem value="AR_DUE">应收账款</SelectItem>
                  <SelectItem value="AP_DUE">应付账款</SelectItem>
                  <SelectItem value="FIXED_EXPENSE">固定费用</SelectItem>
                  <SelectItem value="SEASONAL_PATTERN">季节模式</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea placeholder="规则描述" defaultValue={selectedRule?.description} />
            </div>
            <div className="space-y-2">
              <Label>优先级</Label>
              <Input type="number" placeholder="1-100" defaultValue={selectedRule?.priority} />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select defaultValue={selectedRule?.status || "DRAFT"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">生效中</SelectItem>
                  <SelectItem value="DRAFT">草稿</SelectItem>
                  <SelectItem value="DISABLED">已停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setIsEditOpen(false)}>保存</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
