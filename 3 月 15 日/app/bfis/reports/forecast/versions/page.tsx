"use client"

import { useState } from "react"
import {
  Calendar,
  GitBranch,
  Lock,
  Copy,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// FC1｜预测版本与情景页

type ForecastStatus = "DRAFT" | "PUBLISHED" | "LOCKED"
type Scenario = "BASE" | "CONSERVATIVE" | "AGGRESSIVE"

const mockVersions = [
  {
    id: "fv_001",
    as_of_date: "2026-01-22",
    scenario: "BASE" as Scenario,
    horizon_days: 90,
    status: "PUBLISHED" as ForecastStatus,
    created_at: "2026-01-22 08:00",
    created_by: "finance_admin",
    remark: "基准情景，按当前规则集生成",
  },
  {
    id: "fv_002",
    as_of_date: "2026-01-22",
    scenario: "CONSERVATIVE" as Scenario,
    horizon_days: 90,
    status: "DRAFT" as ForecastStatus,
    created_at: "2026-01-22 09:00",
    created_by: "finance_admin",
    remark: "保守情景，延长到账SLA +2天",
  },
  {
    id: "fv_003",
    as_of_date: "2026-01-21",
    scenario: "BASE" as Scenario,
    horizon_days: 90,
    status: "LOCKED" as ForecastStatus,
    created_at: "2026-01-21 20:00",
    created_by: "finance_admin",
    remark: "昨日基准版本（已锁定）",
  },
]

const statusConfig: Record<ForecastStatus, { label: string; color: string; icon: typeof Lock }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700", icon: Edit },
  PUBLISHED: { label: "已发布", color: "bg-blue-100 text-blue-700", icon: CheckCircle },
  LOCKED: { label: "已锁定", color: "bg-green-100 text-green-700", icon: Lock },
}

const scenarioConfig: Record<Scenario, { label: string; desc: string; color: string }> = {
  BASE: { label: "基准", desc: "按当前规则与历史数据", color: "bg-blue-100 text-blue-700" },
  CONSERVATIVE: { label: "保守", desc: "延长SLA、降低置信度", color: "bg-orange-100 text-orange-700" },
  AGGRESSIVE: { label: "激进", desc: "缩短SLA、提升回款速度", color: "bg-green-100 text-green-700" },
}

export default function ForecastVersionsPage() {
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterScenario, setFilterScenario] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)

  const filteredVersions = mockVersions.filter((v) => {
    if (filterStatus !== "all" && v.status !== filterStatus) return false
    if (filterScenario !== "all" && v.scenario !== filterScenario) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">预测版本与情景</h1>
          <p className="text-muted-foreground">管理预测版本、情景假设与版本对比</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            生成新版本
          </Button>
        </div>
      </div>

      {/* 情景说明 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(scenarioConfig).map(([key, config]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={config.color}>{config.label}</Badge>
                <GitBranch className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{config.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选器 */}
      <div className="flex items-center gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="DRAFT">草稿</SelectItem>
            <SelectItem value="PUBLISHED">已发布</SelectItem>
            <SelectItem value="LOCKED">已锁定</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterScenario} onValueChange={setFilterScenario}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="情景" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部情景</SelectItem>
            <SelectItem value="BASE">基准</SelectItem>
            <SelectItem value="CONSERVATIVE">保守</SelectItem>
            <SelectItem value="AGGRESSIVE">激进</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 版本列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">预测版本列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>版本ID</TableHead>
                <TableHead>截止日期</TableHead>
                <TableHead>情景</TableHead>
                <TableHead>预测天数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>创建人</TableHead>
                <TableHead>备注</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVersions.map((version) => {
                const statusCfg = statusConfig[version.status]
                const scenarioCfg = scenarioConfig[version.scenario]
                const StatusIcon = statusCfg.icon
                return (
                  <TableRow key={version.id}>
                    <TableCell className="font-mono text-sm">{version.id}</TableCell>
                    <TableCell className="font-medium">{version.as_of_date}</TableCell>
                    <TableCell>
                      <Badge className={scenarioCfg.color}>{scenarioCfg.label}</Badge>
                    </TableCell>
                    <TableCell>{version.horizon_days}天</TableCell>
                    <TableCell>
                      <Badge className={statusCfg.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{version.created_at}</TableCell>
                    <TableCell className="text-sm">{version.created_by}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {version.remark}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm">
                          查看
                        </Button>
                        {version.status !== "LOCKED" && (
                          <>
                            <Button variant="ghost" size="sm">
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 创建版本对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成新预测版本</DialogTitle>
            <DialogDescription>配置预测参数并生成新版本</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>截止日期（as_of_date）</Label>
              <Input type="date" defaultValue="2026-01-22" />
            </div>
            <div className="space-y-2">
              <Label>情景</Label>
              <Select defaultValue="BASE">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASE">基准</SelectItem>
                  <SelectItem value="CONSERVATIVE">保守</SelectItem>
                  <SelectItem value="AGGRESSIVE">激进</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>预测天数</Label>
              <Input type="number" defaultValue="90" />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea placeholder="版本说明与假设变更..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={() => setCreateOpen(false)}>生成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
