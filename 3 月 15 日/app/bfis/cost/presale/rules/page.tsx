"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Search, Plus, Edit, Trash2, CheckCircle, Clock, AlertTriangle, Settings, Copy, ToggleLeft, ToggleRight, } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

// PSR1 预售规则配置页

type RuleStatus = "ACTIVE" | "INACTIVE" | "DRAFT"
type CostBasis = "STANDARD" | "ESTIMATE" | "LAST_ACTUAL"

const statusConfig: Record<RuleStatus, { label: string; color: string }> = {
  ACTIVE: { label: "启用", color: "bg-green-100 text-green-700" },
  INACTIVE: { label: "停用", color: "bg-gray-100 text-gray-700" },
  DRAFT: { label: "草稿", color: "bg-yellow-100 text-yellow-700" },
}

const costBasisConfig: Record<CostBasis, { label: string }> = {
  STANDARD: { label: "标准成本" },
  ESTIMATE: { label: "暂估成本" },
  LAST_ACTUAL: { label: "上次实际成本" },
}

// Mock 预售规则数据
const mockPresaleRules = [
  {
    id: "PSR-001",
    ruleName: "默认预售规则",
    description: "适用于所有预售订单的默认成本暂估规则",
    costBasis: "STANDARD" as CostBasis,
    markupRate: 10,
    autoBackfill: true,
    backfillTrigger: "BATCH_COMPLETE",
    applySpu: null,
    applyCategory: null,
    priority: 100,
    status: "ACTIVE" as RuleStatus,
    createdAt: "2025-12-01",
    updatedAt: "2026-01-10",
  },
  {
    id: "PSR-002",
    ruleName: "高端女装预售规则",
    description: "适用于高端女装类目，使用上次实际成本作为暂估基础",
    costBasis: "LAST_ACTUAL" as CostBasis,
    markupRate: 5,
    autoBackfill: true,
    backfillTrigger: "PARTIAL_RECEIVE",
    applySpu: null,
    applyCategory: "高端女装",
    priority: 80,
    status: "ACTIVE" as RuleStatus,
    createdAt: "2025-12-15",
    updatedAt: "2026-01-05",
  },
  {
    id: "PSR-003",
    ruleName: "特殊SPU规则-限量款",
    description: "适用于限量款商品，需要人工确认成本",
    costBasis: "ESTIMATE" as CostBasis,
    markupRate: 15,
    autoBackfill: false,
    backfillTrigger: null,
    applySpu: "SPU-LIMITED-*",
    applyCategory: null,
    priority: 50,
    status: "ACTIVE" as RuleStatus,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-15",
  },
  {
    id: "PSR-004",
    ruleName: "测试规则",
    description: "测试用规则，暂未启用",
    costBasis: "STANDARD" as CostBasis,
    markupRate: 8,
    autoBackfill: true,
    backfillTrigger: "BATCH_COMPLETE",
    applySpu: null,
    applyCategory: "测试类目",
    priority: 10,
    status: "DRAFT" as RuleStatus,
    createdAt: "2026-01-14",
    updatedAt: "2026-01-14",
  },
]

export default function PresaleRulesPage() {
  const searchParams = useSearchParams();
  const [searchKeyword, setSearchKeyword] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedRule, setSelectedRule] = useState<(typeof mockPresaleRules)[0] | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // 筛选
  const filteredRules = mockPresaleRules.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false
    if (searchKeyword && !r.ruleName.toLowerCase().includes(searchKeyword.toLowerCase()) &&
        !r.description.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const openEdit = (rule: typeof mockPresaleRules[0] | null, creating = false) => {
    setSelectedRule(rule)
    setIsCreating(creating)
    setEditOpen(true)
  }

  const handleToggleStatus = (rule: typeof mockPresaleRules[0]) => {
    const newStatus = rule.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    toast.success(`规则 "${rule.ruleName}" 已${newStatus === "ACTIVE" ? "启用" : "停用"}`)
  }

  const handleSave = () => {
    toast.success(isCreating ? "规则已创建" : "规则已保存")
    setEditOpen(false)
  }

  const handleDelete = (rule: typeof mockPresaleRules[0]) => {
    toast.success(`规则 "${rule.ruleName}" 已删除`)
  }

  const handleCopy = (rule: typeof mockPresaleRules[0]) => {
    toast.success(`已复制规则 "${rule.ruleName}"`)
    setSelectedRule({ ...rule, id: `PSR-NEW`, ruleName: `${rule.ruleName} (副本)`, status: "DRAFT" as RuleStatus })
    setIsCreating(true)
    setEditOpen(true)
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">预售规则配置</h1>
            <p className="text-muted-foreground">配置预售订单的成本暂估规则，支持按类目/SPU差异化配置</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => openEdit(null, true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建规则
            </Button>
          </div>
        </div>

        {/* 规则说明 */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium text-blue-800 mb-1">预售规则匹配逻辑</p>
                <ul className="space-y-1">
                  <li>1. 按优先级从高到低匹配（数值越大优先级越高）</li>
                  <li>2. 优先匹配SPU级规则，再匹配类目级规则，最后使用默认规则</li>
                  <li>3. 暂估成本 = 成本基础 × (1 + 加成比例%)</li>
                  <li>4. 自动回写：批次完成/部分到货时自动用实际成本替换暂估成本</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索规则名称/描述..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="ACTIVE">启用</SelectItem>
                  <SelectItem value="INACTIVE">停用</SelectItem>
                  <SelectItem value="DRAFT">草稿</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>规则名称</TableHead>
                  <TableHead>成本基础</TableHead>
                  <TableHead className="text-right">加成比例</TableHead>
                  <TableHead>适用范围</TableHead>
                  <TableHead>自动回写</TableHead>
                  <TableHead className="text-right">优先级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="font-medium">{rule.ruleName}</div>
                      <div className="text-xs text-muted-foreground max-w-[200px] truncate">{rule.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{costBasisConfig[rule.costBasis].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{rule.markupRate}%</TableCell>
                    <TableCell>
                      {rule.applySpu ? (
                        <Badge variant="outline" className="bg-purple-50">SPU: {rule.applySpu}</Badge>
                      ) : rule.applyCategory ? (
                        <Badge variant="outline" className="bg-cyan-50">类目: {rule.applyCategory}</Badge>
                      ) : (
                        <span className="text-muted-foreground">全部</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.autoBackfill ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-muted-foreground">
                            {rule.backfillTrigger === "BATCH_COMPLETE" ? "批次完成" : "部分到货"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">手动</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{rule.priority}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig[rule.status].color}>
                        {statusConfig[rule.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rule.updatedAt}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(rule)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(rule)}>
                          {rule.status === "ACTIVE" ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                        {rule.status !== "ACTIVE" && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(rule)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Sheet */}
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px]">
            <SheetHeader>
              <SheetTitle>{isCreating ? "新建预售规则" : "编辑预售规则"}</SheetTitle>
              <SheetDescription>
                配置预售订单的成本暂估策略
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label>规则名称 *</Label>
                <Input defaultValue={selectedRule?.ruleName || ""} placeholder="输入规则名称" />
              </div>

              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea defaultValue={selectedRule?.description || ""} placeholder="规则描述（可选）" rows={2} />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>成本基础 *</Label>
                <Select defaultValue={selectedRule?.costBasis || "STANDARD"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">标准成本（商品建档）</SelectItem>
                    <SelectItem value="ESTIMATE">暂估成本（手工录入）</SelectItem>
                    <SelectItem value="LAST_ACTUAL">上次实际成本</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">暂估成本将基于此成本计算</p>
              </div>

              <div className="space-y-2">
                <Label>加成比例 (%)</Label>
                <Input type="number" defaultValue={selectedRule?.markupRate || 10} min={0} max={100} />
                <p className="text-xs text-muted-foreground">暂估成本 = 成本基础 × (1 + 加成比例%)</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>适用范围</Label>
                <Select defaultValue={selectedRule?.applySpu ? "spu" : selectedRule?.applyCategory ? "category" : "all"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部商品（默认规则）</SelectItem>
                    <SelectItem value="category">指定类目</SelectItem>
                    <SelectItem value="spu">指定SPU</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>类目/SPU（支持通配符 *）</Label>
                <Input 
                  defaultValue={selectedRule?.applySpu || selectedRule?.applyCategory || ""} 
                  placeholder="如：高端女装 或 SPU-LIMITED-*" 
                />
              </div>

              <div className="space-y-2">
                <Label>优先级</Label>
                <Input type="number" defaultValue={selectedRule?.priority || 50} min={1} max={100} />
                <p className="text-xs text-muted-foreground">数值越大优先级越高，默认规则建议设为100</p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>自动回写实际成本</Label>
                    <p className="text-xs text-muted-foreground">批次完成后自动用实际成本替换暂估</p>
                  </div>
                  <Switch defaultChecked={selectedRule?.autoBackfill ?? true} />
                </div>

                <div className="space-y-2">
                  <Label>回写触发时机</Label>
                  <Select defaultValue={selectedRule?.backfillTrigger || "BATCH_COMPLETE"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BATCH_COMPLETE">批次完成（全部到货）</SelectItem>
                      <SelectItem value="PARTIAL_RECEIVE">部分到货即回写</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setEditOpen(false)}>
                  取消
                </Button>
                {isCreating && (
                  <Button variant="outline" className="flex-1 bg-transparent" onClick={() => {
                    toast.success("规则已保存为草稿")
                    setEditOpen(false)
                  }}>
                    保存草稿
                  </Button>
                )}
                <Button className="flex-1" onClick={handleSave}>
                  {isCreating ? "创建并启用" : "保存"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Suspense>
  )
}
