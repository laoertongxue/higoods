"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Calendar,
  Clock,
  Lock,
  Unlock,
  ArrowLeft,
  FileText,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Eye,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// MS4｜版本管理页（DAILY/MONTHLY/CLOSE）

type VersionType = "DAILY" | "MONTHLY" | "CLOSE"
type VersionStatus = "DRAFT" | "ACTIVE" | "LOCKED" | "ARCHIVED"

// Mock 版本列表
const versions = [
  {
    id: "v_2026_01_close",
    type: "CLOSE" as VersionType,
    period: "2026-01",
    versionDate: "2026-02-05",
    status: "LOCKED" as VersionStatus,
    lockedBy: "CFO",
    lockedAt: "2026-02-05 18:00",
    pl: { revenue: 2850000, cogs: 1520000, grossProfit: 1330000, opex: 680000, netProfit: 650000 },
    bs: { assets: 8500000, liabilities: 3200000, equity: 5300000 },
    cf: { operating: 720000, investing: -150000, financing: -50000, netCash: 520000 },
    comment: "月结完成，已审核确认",
  },
  {
    id: "v_2026_01_m31",
    type: "MONTHLY" as VersionType,
    period: "2026-01",
    versionDate: "2026-01-31",
    status: "ACTIVE" as VersionStatus,
    lockedBy: null,
    lockedAt: null,
    pl: { revenue: 2840000, cogs: 1515000, grossProfit: 1325000, opex: 675000, netProfit: 650000 },
    bs: { assets: 8480000, liabilities: 3180000, equity: 5300000 },
    cf: { operating: 715000, investing: -150000, financing: -50000, netCash: 515000 },
    comment: "月末快照",
  },
  {
    id: "v_2026_01_d21",
    type: "DAILY" as VersionType,
    period: "2026-01",
    versionDate: "2026-01-21",
    status: "ARCHIVED" as VersionStatus,
    lockedBy: null,
    lockedAt: null,
    pl: { revenue: 2100000, cogs: 1120000, grossProfit: 980000, opex: 480000, netProfit: 500000 },
    bs: { assets: 8300000, liabilities: 3100000, equity: 5200000 },
    cf: { operating: 520000, investing: -100000, financing: -30000, netCash: 390000 },
    comment: null,
  },
  {
    id: "v_2025_12_close",
    type: "CLOSE" as VersionType,
    period: "2025-12",
    versionDate: "2026-01-05",
    status: "LOCKED" as VersionStatus,
    lockedBy: "CFO",
    lockedAt: "2026-01-05 17:30",
    pl: { revenue: 2650000, cogs: 1420000, grossProfit: 1230000, opex: 620000, netProfit: 610000 },
    bs: { assets: 8200000, liabilities: 3050000, equity: 5150000 },
    cf: { operating: 680000, investing: -120000, financing: -40000, netCash: 520000 },
    comment: "2025年12月月结",
  },
]

const versionTypeConfig: Record<VersionType, { label: string; color: string; description: string }> = {
  DAILY: { label: "日快照", color: "bg-gray-100 text-gray-700", description: "每日自动生成，供日常查阅" },
  MONTHLY: { label: "月快照", color: "bg-blue-100 text-blue-700", description: "月末自动生成，供月度分析" },
  CLOSE: { label: "月结版", color: "bg-green-100 text-green-700", description: "月结锁定版本，作为官方数据" },
}

const versionStatusConfig: Record<VersionStatus, { label: string; color: string; icon: typeof Lock }> = {
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700", icon: Clock },
  ACTIVE: { label: "生效中", color: "bg-blue-100 text-blue-700", icon: CheckCircle },
  LOCKED: { label: "已锁定", color: "bg-green-100 text-green-700", icon: Lock },
  ARCHIVED: { label: "已归档", color: "bg-purple-100 text-purple-700", icon: FileText },
}

export default function StatementsVersionsPage() {
  const [compareMode, setCompareMode] = useState(false)
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [showLockDialog, setShowLockDialog] = useState(false)
  const [lockComment, setLockComment] = useState("")

  const handleSelectVersion = (versionId: string) => {
    if (selectedVersions.includes(versionId)) {
      setSelectedVersions(selectedVersions.filter((id) => id !== versionId))
    } else {
      if (selectedVersions.length < 2) {
        setSelectedVersions([...selectedVersions, versionId])
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/bfis/reports/statements">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">版本管理</h1>
            <p className="text-muted-foreground">DAILY日快照 / MONTHLY月快照 / CLOSE月结版</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {compareMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setCompareMode(false)}>
                取消对比
              </Button>
              <Button size="sm" disabled={selectedVersions.length !== 2}>
                对比选中版本
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setCompareMode(true)}>
                版本对比
              </Button>
              <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Lock className="h-4 w-4 mr-2" />
                    锁定月结版
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>锁定月结版本</DialogTitle>
                    <DialogDescription>锁定后数据将不可修改，请确认数据准确性</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>期间</Label>
                      <div className="text-sm font-medium">2026-01</div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="comment">备注说明</Label>
                      <Textarea
                        id="comment"
                        placeholder="输入备注（可选）"
                        value={lockComment}
                        onChange={(e) => setLockComment(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowLockDialog(false)}>
                      取消
                    </Button>
                    <Button onClick={() => setShowLockDialog(false)}>
                      <Lock className="h-4 w-4 mr-2" />
                      确认锁定
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* 版本类型说明 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(versionTypeConfig).map(([type, config]) => (
          <Card key={type}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={config.color}>{config.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 版本列表 */}
      <Card>
        <CardHeader>
          <CardTitle>版本历史</CardTitle>
          <CardDescription>查看所有版本快照，支持对比与回溯</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {compareMode && <TableHead className="w-[50px]"></TableHead>}
                <TableHead>版本类型</TableHead>
                <TableHead>期间</TableHead>
                <TableHead>版本日期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">收入</TableHead>
                <TableHead className="text-right">净利润</TableHead>
                <TableHead className="text-right">总资产</TableHead>
                <TableHead className="text-right">经营现金流</TableHead>
                <TableHead>备注</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => {
                const typeConfig = versionTypeConfig[version.type]
                const statusConfig = versionStatusConfig[version.status]
                const StatusIcon = statusConfig.icon
                return (
                  <TableRow key={version.id}>
                    {compareMode && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedVersions.includes(version.id)}
                          onChange={() => handleSelectVersion(version.id)}
                          disabled={!selectedVersions.includes(version.id) && selectedVersions.length >= 2}
                          className="h-4 w-4"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{version.period}</TableCell>
                    <TableCell className="text-muted-foreground">{version.versionDate}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">${(version.pl.revenue / 1000).toFixed(0)}K</TableCell>
                    <TableCell className="text-right font-mono">
                      ${(version.pl.netProfit / 1000).toFixed(0)}K
                    </TableCell>
                    <TableCell className="text-right font-mono">${(version.bs.assets / 1000).toFixed(0)}K</TableCell>
                    <TableCell className="text-right font-mono">
                      ${(version.cf.operating / 1000).toFixed(0)}K
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {version.comment || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        {version.status === "LOCKED" && (
                          <Button variant="ghost" size="sm">
                            <Unlock className="h-4 w-4" />
                          </Button>
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

      {/* 版本管理说明 */}
      <Card>
        <CardHeader>
          <CardTitle>版本管理规则</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">1. DAILY（日快照）</h4>
            <p className="text-muted-foreground">
              每日自动生成，反映当日最新数据。供日常业务查阅，数据可能包含暂估值（PROV）、估算值（EST）。
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">2. MONTHLY（月快照）</h4>
            <p className="text-muted-foreground">
              月末自动生成，作为月度分析基准。数据完整性高于DAILY，但可能仍有部分估算项。
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">3. CLOSE（月结版）</h4>
            <p className="text-muted-foreground">
              月结流程完成后手工锁定，作为官方数据。所有费用归集、成本结转、汇率重估已完成，数据不可再修改。
            </p>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-700 mb-2">锁定规则</h4>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li>只有MONTHLY版本可以锁定为CLOSE版本</li>
              <li>锁定前需确认所有数据质量问题已解决</li>
              <li>锁定后如需修改，需CFO审批解锁</li>
              <li>解锁会触发审计日志记录</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
