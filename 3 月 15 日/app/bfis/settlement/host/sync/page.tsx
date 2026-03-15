"use client"

// HS3 结算单同步/回传日志页
import { useState } from "react"
import { Search, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"

type SyncType = "INBOUND" | "OUTBOUND"
type SyncStatus = "SUCCESS" | "FAIL" | "PROCESSING"

interface SyncLog {
  id: string
  syncType: SyncType
  batchId: string
  recordCount: number
  successCount: number
  failCount: number
  status: SyncStatus
  syncTime: string
  errorMsg: string | null
}

const mockLogs: SyncLog[] = [
  {
    id: "sync_001",
    syncType: "INBOUND",
    batchId: "BATCH-20260125-001",
    recordCount: 10,
    successCount: 10,
    failCount: 0,
    status: "SUCCESS",
    syncTime: "2026-01-25 08:00",
    errorMsg: null,
  },
  {
    id: "sync_002",
    syncType: "OUTBOUND",
    batchId: "BATCH-20260125-002",
    recordCount: 5,
    successCount: 4,
    failCount: 1,
    status: "FAIL",
    syncTime: "2026-01-25 16:30",
    errorMsg: "结算单 OS-HS-202601-020 回传失败: 旧系统接口超时",
  },
  {
    id: "sync_003",
    syncType: "INBOUND",
    batchId: "BATCH-20260125-003",
    recordCount: 8,
    successCount: 0,
    failCount: 0,
    status: "PROCESSING",
    syncTime: "2026-01-25 18:00",
    errorMsg: null,
  },
]

const syncTypeLabels: Record<SyncType, string> = {
  INBOUND: "同步入库",
  OUTBOUND: "回传旧系统",
}

const statusConfig: Record<SyncStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  SUCCESS: { label: "成功", color: "bg-green-100 text-green-700", icon: CheckCircle },
  FAIL: { label: "失败", color: "bg-red-100 text-red-700", icon: XCircle },
  PROCESSING: { label: "处理中", color: "bg-blue-100 text-blue-700", icon: Clock },
}

export default function HostSyncPage() {
  const searchParams = useSearchParams()
  const [filterSyncType, setFilterSyncType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchKeyword, setSearchKeyword] = useState("")

  const filteredData = mockLogs.filter((item) => {
    if (filterSyncType !== "all" && item.syncType !== filterSyncType) return false
    if (filterStatus !== "all" && item.status !== filterStatus) return false
    if (searchKeyword && !item.batchId.toLowerCase().includes(searchKeyword.toLowerCase())) return false
    return true
  })

  const totalBatches = mockLogs.length
  const successBatches = mockLogs.filter((l) => l.status === "SUCCESS").length
  const failBatches = mockLogs.filter((l) => l.status === "FAIL").length
  const totalRecords = mockLogs.reduce((sum, l) => sum + l.recordCount, 0)

  return (
    <Suspense fallback={<Loading />}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">结算单同步与回传日志</h1>
            <p className="text-muted-foreground">追溯旧系统同步和状态回传的完整记录</p>
          </div>
          <Button size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            手工同步
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalBatches}</div>
                  <div className="text-sm text-muted-foreground">总批次数</div>
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
                  <div className="text-2xl font-bold">{successBatches}</div>
                  <div className="text-sm text-muted-foreground">成功批次</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{failBatches}</div>
                  <div className="text-sm text-muted-foreground">失败批次</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalRecords}</div>
                  <div className="text-sm text-muted-foreground">总记录数</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <Select value={filterSyncType} onValueChange={setFilterSyncType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="同步类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="INBOUND">同步入库</SelectItem>
                  <SelectItem value="OUTBOUND">回传旧系统</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="SUCCESS">成功</SelectItem>
                  <SelectItem value="FAIL">失败</SelectItem>
                  <SelectItem value="PROCESSING">处理中</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索批次号..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>同步日志（共 {filteredData.length} 条）</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>批次号</TableHead>
                  <TableHead>同步类型</TableHead>
                  <TableHead>记录总数</TableHead>
                  <TableHead>成功数</TableHead>
                  <TableHead>失败数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>同步时间</TableHead>
                  <TableHead>错误信息</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((log) => {
                  const statusInfo = statusConfig[log.status]
                  const StatusIcon = statusInfo.icon
                  return (
                    <TableRow key={log.id} className={log.status === "FAIL" ? "bg-red-50" : ""}>
                      <TableCell className="font-mono text-sm">{log.batchId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{syncTypeLabels[log.syncType]}</Badge>
                      </TableCell>
                      <TableCell>{log.recordCount}</TableCell>
                      <TableCell className="text-green-600">{log.successCount}</TableCell>
                      <TableCell className="text-red-600">{log.failCount}</TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.syncTime}</TableCell>
                      <TableCell className="text-sm text-red-600">{log.errorMsg || "-"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card>
          <CardHeader>
            <CardTitle>同步说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Badge variant="outline">同步入库</Badge>
              <div className="text-muted-foreground">从旧业务系统拉取主播结算单并存入 OFA</div>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline">回传旧系统</Badge>
              <div className="text-muted-foreground">
                当付款完成后，回传旧系统将结算单标记为已付款/完结，并写入付款参考号
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-muted-foreground">失败记录需在工单中心处理或手工重试</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Suspense>
  )
}
