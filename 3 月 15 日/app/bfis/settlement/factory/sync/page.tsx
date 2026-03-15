"use client"

import { useState } from "react"
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, Download } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// FS3｜结算单同步批次/对账日志页

type SyncStatus = "SUCCESS" | "PARTIAL" | "FAILED"

interface SyncBatch {
  batch_id: string
  sync_time: string
  source: string
  status: SyncStatus
  total_count: number
  success_count: number
  failed_count: number
  duration_ms: number
}

interface SyncLog {
  log_id: string
  batch_id: string
  settlement_id: string
  source_settlement_id: string
  operation: string
  status: string
  error_msg: string | null
  sync_time: string
}

const mockSyncBatches: SyncBatch[] = [
  {
    batch_id: "batch_001",
    sync_time: "2026-01-29 08:00:15",
    source: "OLD_SYS",
    status: "SUCCESS",
    total_count: 15,
    success_count: 15,
    failed_count: 0,
    duration_ms: 3200,
  },
  {
    batch_id: "batch_002",
    sync_time: "2026-01-28 08:00:10",
    source: "OLD_SYS",
    status: "PARTIAL",
    total_count: 12,
    success_count: 11,
    failed_count: 1,
    duration_ms: 2800,
  },
  {
    batch_id: "batch_003",
    sync_time: "2026-01-27 08:00:08",
    source: "OLD_SYS",
    status: "SUCCESS",
    total_count: 18,
    success_count: 18,
    failed_count: 0,
    duration_ms: 4100,
  },
]

const mockSyncLogs: SyncLog[] = [
  {
    log_id: "log_001",
    batch_id: "batch_001",
    settlement_id: "fs_003",
    source_settlement_id: "OS-FS-202601-003",
    operation: "SYNC_CREATE",
    status: "SUCCESS",
    error_msg: null,
    sync_time: "2026-01-29 08:00:16",
  },
  {
    log_id: "log_002",
    batch_id: "batch_001",
    settlement_id: "fs_004",
    source_settlement_id: "OS-FS-202601-004",
    operation: "SYNC_UPDATE",
    status: "SUCCESS",
    error_msg: null,
    sync_time: "2026-01-29 08:00:17",
  },
  {
    log_id: "log_003",
    batch_id: "batch_002",
    settlement_id: null,
    source_settlement_id: "OS-FS-202601-999",
    operation: "SYNC_CREATE",
    status: "FAILED",
    error_msg: "工厂ID不存在: F999",
    sync_time: "2026-01-28 08:00:12",
  },
]

const statusConfig: Record<SyncStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  SUCCESS: { label: "成功", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  PARTIAL: { label: "部分成功", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  FAILED: { label: "失败", color: "bg-red-100 text-red-700", icon: XCircle },
}

export default function FactorySyncPage() {
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)

  const filteredLogs = selectedBatch
    ? mockSyncLogs.filter((log) => log.batch_id === selectedBatch)
    : mockSyncLogs

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">结算单同步批次与对账</h1>
          <p className="text-muted-foreground">旧系统结算单同步记录与对账日志</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            手动同步
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出日志
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">总批次</div>
            <div className="text-2xl font-bold">{mockSyncBatches.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">成功批次</div>
            <div className="text-2xl font-bold text-green-600">
              {mockSyncBatches.filter((b) => b.status === "SUCCESS").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">总同步记录</div>
            <div className="text-2xl font-bold">
              {mockSyncBatches.reduce((sum, b) => sum + b.total_count, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">失败记录</div>
            <div className="text-2xl font-bold text-red-600">
              {mockSyncBatches.reduce((sum, b) => sum + b.failed_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="batches">
        <TabsList>
          <TabsTrigger value="batches">同步批次</TabsTrigger>
          <TabsTrigger value="logs">同步日志</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>批次ID</TableHead>
                    <TableHead>同步时间</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">总数</TableHead>
                    <TableHead className="text-right">成功</TableHead>
                    <TableHead className="text-right">失败</TableHead>
                    <TableHead className="text-right">耗时(ms)</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSyncBatches.map((batch) => {
                    const statusInfo = statusConfig[batch.status]
                    const StatusIcon = statusInfo.icon

                    return (
                      <TableRow key={batch.batch_id}>
                        <TableCell className="font-mono font-medium">{batch.batch_id}</TableCell>
                        <TableCell className="text-sm">{batch.sync_time}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{batch.source}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.color} variant="outline">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{batch.total_count}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{batch.success_count}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{batch.failed_count}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {batch.duration_ms}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBatch(batch.batch_id)
                              document.querySelector('[value="logs"]')?.dispatchEvent(new Event('click', { bubbles: true }))
                            }}
                          >
                            查看日志
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {selectedBatch && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">筛选批次: {selectedBatch}</Badge>
              <Button variant="ghost" size="sm" onClick={() => setSelectedBatch(null)}>
                清除筛选
              </Button>
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>批次ID</TableHead>
                    <TableHead>旧系统结算单号</TableHead>
                    <TableHead>OFA结算单ID</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>错误信息</TableHead>
                    <TableHead>同步时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.log_id} className={log.status === "FAILED" ? "bg-red-50" : ""}>
                      <TableCell className="font-mono text-sm">{log.batch_id}</TableCell>
                      <TableCell className="font-mono font-medium">{log.source_settlement_id}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {log.settlement_id || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.operation}</Badge>
                      </TableCell>
                      <TableCell>
                        {log.status === "SUCCESS" ? (
                          <Badge className="bg-green-100 text-green-700" variant="outline">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            成功
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700" variant="outline">
                            <XCircle className="h-3 w-3 mr-1" />
                            失败
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-red-600">{log.error_msg || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.sync_time}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
