"use client"

import { useState } from "react"
import { Calendar, Upload, Download, CheckCircle, AlertTriangle, Clock, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

// CA4｜余额快照与对账记录页

interface BalanceSnapshot {
  snapshot_id: string
  account_code: string
  account_name: string
  snapshot_time: string
  bank_balance_amount: number
  system_balance_amount: number
  delta_amount: number
  source: "BANK_STATEMENT_IMPORT" | "MANUAL" | "API"
  source_ref: string
  operator: string
  remark?: string
}

interface ReconcileRecord {
  reconcile_id: string
  account_code: string
  account_name: string
  reconcile_date: string
  period: string
  bank_balance: number
  system_balance: number
  delta: number
  status: "PENDING" | "MATCHED" | "PARTIAL" | "REJECTED"
  unmatched_count: number
  operator: string
}

const mockSnapshots: BalanceSnapshot[] = [
  {
    snapshot_id: "snap_001",
    account_code: "CA-ID-BDG-001",
    account_name: "BDG主收款账户",
    snapshot_time: "2026-01-22 09:00",
    bank_balance_amount: 1850000000,
    system_balance_amount: 1835000000,
    delta_amount: 15000000,
    source: "BANK_STATEMENT_IMPORT",
    source_ref: "BDG_202601_Statement.xlsx",
    operator: "finance_admin",
  },
  {
    snapshot_id: "snap_002",
    account_code: "CA-ID-JKT-001",
    account_name: "JKT主收款账户",
    snapshot_time: "2026-01-22 09:00",
    bank_balance_amount: 890000000,
    system_balance_amount: 885000000,
    delta_amount: 5000000,
    source: "BANK_STATEMENT_IMPORT",
    source_ref: "JKT_202601_Statement.xlsx",
    operator: "finance_admin",
  },
  {
    snapshot_id: "snap_003",
    account_code: "CA-HK-001",
    account_name: "HK主收款账户",
    snapshot_time: "2026-01-22 09:00",
    bank_balance_amount: 285000,
    system_balance_amount: 280000,
    delta_amount: 5000,
    source: "MANUAL",
    source_ref: "手工录入",
    operator: "finance_admin",
    remark: "根据HSBC对账单手工录入期末余额",
  },
]

const mockReconciles: ReconcileRecord[] = [
  {
    reconcile_id: "rec_001",
    account_code: "CA-ID-BDG-001",
    account_name: "BDG主收款账户",
    reconcile_date: "2026-01-21",
    period: "2026-01",
    bank_balance: 1850000000,
    system_balance: 1835000000,
    delta: 15000000,
    status: "PARTIAL",
    unmatched_count: 3,
    operator: "finance_admin",
  },
  {
    reconcile_id: "rec_002",
    account_code: "CA-ID-JKT-001",
    account_name: "JKT主收款账户",
    reconcile_date: "2026-01-21",
    period: "2026-01",
    bank_balance: 890000000,
    system_balance: 885000000,
    delta: 5000000,
    status: "MATCHED",
    unmatched_count: 0,
    operator: "finance_admin",
  },
]

const sourceLabels = {
  BANK_STATEMENT_IMPORT: "对账单导入",
  MANUAL: "手工录入",
  API: "API同步",
}

const statusConfig = {
  PENDING: { label: "待对账", color: "bg-gray-100 text-gray-700" },
  MATCHED: { label: "已匹配", color: "bg-green-100 text-green-700" },
  PARTIAL: { label: "部分匹配", color: "bg-yellow-100 text-yellow-700" },
  REJECTED: { label: "差异待处理", color: "bg-red-100 text-red-700" },
}

export default function SnapshotsPage() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  const formatAmount = (amount: number, currency: string = "IDR") => {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">余额快照与对账记录</h1>
          <p className="text-muted-foreground">
            管理银行余额快照，追溯余额差异，发起对账任务
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            录入快照
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{mockSnapshots.length}</div>
                <div className="text-sm text-muted-foreground">今日快照</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {mockReconciles.filter((r) => r.status === "MATCHED").length}
                </div>
                <div className="text-sm text-muted-foreground">已匹配</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {mockReconciles.filter((r) => r.status === "PARTIAL").length}
                </div>
                <div className="text-sm text-muted-foreground">部分匹配</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {mockReconciles.reduce((sum, r) => sum + r.unmatched_count, 0)}
                </div>
                <div className="text-sm text-muted-foreground">未匹配流水</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="snapshots">
        <TabsList>
          <TabsTrigger value="snapshots">余额快照历史</TabsTrigger>
          <TabsTrigger value="reconciles">对账记录</TabsTrigger>
        </TabsList>

        {/* Tab1: 余额快照历史 */}
        <TabsContent value="snapshots" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="选择账户" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部账户</SelectItem>
                    <SelectItem value="CA-ID-BDG-001">BDG主收款账户</SelectItem>
                    <SelectItem value="CA-ID-JKT-001">JKT主收款账户</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all-source">
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="来源" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-source">全部来源</SelectItem>
                    <SelectItem value="BANK_STATEMENT_IMPORT">对账单导入</SelectItem>
                    <SelectItem value="MANUAL">手工录入</SelectItem>
                    <SelectItem value="API">API同步</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>账户</TableHead>
                    <TableHead>快照时间</TableHead>
                    <TableHead className="text-right">银行余额</TableHead>
                    <TableHead className="text-right">系统余额</TableHead>
                    <TableHead className="text-right">差异</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSnapshots.map((snapshot) => {
                    const hasDelta = Math.abs(snapshot.delta_amount) > 100000
                    return (
                      <TableRow key={snapshot.snapshot_id} className={hasDelta ? "bg-yellow-50" : ""}>
                        <TableCell>
                          <div className="font-medium">{snapshot.account_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{snapshot.account_code}</div>
                        </TableCell>
                        <TableCell className="text-sm">{snapshot.snapshot_time}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatAmount(snapshot.bank_balance_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(snapshot.system_balance_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={hasDelta ? "text-yellow-700 font-semibold" : "text-muted-foreground"}>
                            {snapshot.delta_amount > 0 ? "+" : ""}{formatAmount(snapshot.delta_amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sourceLabels[snapshot.source]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{snapshot.operator}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {snapshot.remark || snapshot.source_ref}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab2: 对账记录 */}
        <TabsContent value="reconciles" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="选择账户" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部账户</SelectItem>
                    <SelectItem value="CA-ID-BDG-001">BDG主收款账户</SelectItem>
                    <SelectItem value="CA-ID-JKT-001">JKT主收款账户</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all-status">
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="对账状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-status">全部状态</SelectItem>
                    <SelectItem value="MATCHED">已匹配</SelectItem>
                    <SelectItem value="PARTIAL">部分匹配</SelectItem>
                    <SelectItem value="REJECTED">差异待处理</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>账户</TableHead>
                    <TableHead>对账日期</TableHead>
                    <TableHead>账期</TableHead>
                    <TableHead className="text-right">银行余额</TableHead>
                    <TableHead className="text-right">系统余额</TableHead>
                    <TableHead className="text-right">差异</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">未匹配流水</TableHead>
                    <TableHead>操作人</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockReconciles.map((record) => (
                    <TableRow key={record.reconcile_id}>
                      <TableCell>
                        <div className="font-medium">{record.account_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{record.account_code}</div>
                      </TableCell>
                      <TableCell className="text-sm">{record.reconcile_date}</TableCell>
                      <TableCell className="text-sm">{record.period}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatAmount(record.bank_balance)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatAmount(record.system_balance)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={Math.abs(record.delta) > 100000 ? "text-yellow-700 font-semibold" : "text-muted-foreground"}>
                          {record.delta > 0 ? "+" : ""}{formatAmount(record.delta)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[record.status].color}>
                          {statusConfig[record.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {record.unmatched_count > 0 ? (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            {record.unmatched_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{record.operator}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 录入快照 Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>录入余额快照</DialogTitle>
            <DialogDescription>手工录入或导入银行对账单期末余额</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>选择账户 *</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择账户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CA-ID-BDG-001">BDG主收款账户</SelectItem>
                  <SelectItem value="CA-ID-JKT-001">JKT主收款账户</SelectItem>
                  <SelectItem value="CA-HK-001">HK主收款账户</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>快照时间 *</Label>
                <Input type="datetime-local" />
              </div>
              <div>
                <Label>银行余额 *</Label>
                <Input type="number" placeholder="0.00" />
              </div>
            </div>

            <div>
              <Label>来源 *</Label>
              <Select defaultValue="MANUAL">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">手工录入</SelectItem>
                  <SelectItem value="BANK_STATEMENT_IMPORT">对账单导入</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>备注</Label>
              <Textarea placeholder="说明余额来源、附件名称或其他备注信息" rows={3} />
            </div>

            <div>
              <Label>附件（可选）</Label>
              <div className="flex items-center gap-2">
                <Input type="file" />
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">上传银行对账单或其他证明文件</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>取消</Button>
            <Button onClick={() => setUploadDialogOpen(false)}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
