"use client"

import { useState } from "react"
import {
  Search,
  PlayCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Building2,
  User,
  Calendar,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"

// SS7｜收单主体解析测试页（给财务/研发联调）

const mockStores = [
  { store_id: "st_001", store_code: "TK-ID-001", store_name: "HiGood TK ID" },
  { store_id: "st_002", store_code: "SP-ID-001", store_name: "HiGood SP ID" },
  { store_id: "st_003", store_code: "TK-ID-P01", store_name: "张三个人店" },
  { store_id: "st_004", store_code: "TK-CN-001", store_name: "HiGood TK CN" },
  { store_id: "st_005", store_code: "SP-ID-TEST", store_name: "Test Store (No Binding)" },
]

const mockResolveResults = [
  {
    test_id: "test_001",
    store_id: "st_001",
    store_code: "TK-ID-001",
    test_time: "2026-01-15 10:00:00",
    status: "SUCCESS",
    payout_account_id: "pa_001",
    payout_account_name: "JKT-对公主账户 ****1234",
    acquiring_subject_type: "LEGAL",
    acquiring_subject_id: "le_id_jkt",
    acquiring_subject_name: "PT HIGOOD LIVE JAKARTA",
    effective_from: "2025-01-01",
    effective_to: null,
    execution_time_ms: 45,
  },
  {
    test_id: "test_002",
    store_id: "st_003",
    store_code: "TK-ID-P01",
    test_time: "2025-06-15 14:30:00",
    status: "SUCCESS",
    payout_account_id: "pa_003",
    payout_account_name: "张三-个人卡 ****5678",
    acquiring_subject_type: "PERSONAL",
    acquiring_subject_id: "person_001",
    acquiring_subject_name: "张三",
    effective_from: "2025-06-01",
    effective_to: null,
    execution_time_ms: 38,
  },
  {
    test_id: "test_003",
    store_id: "st_005",
    store_code: "SP-ID-TEST",
    test_time: "2026-01-20 09:00:00",
    status: "ERROR",
    error_code: "PAYOUT_MISSING",
    error_message: "店铺无有效绑定，阻断应收生成",
    execution_time_ms: 12,
  },
]

const statusConfig = {
  SUCCESS: { label: "成功", color: "bg-green-100 text-green-700", icon: CheckCircle },
  ERROR: { label: "失败", color: "bg-red-100 text-red-700", icon: XCircle },
  WARNING: { label: "警告", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
}

const subjectTypeConfig = {
  LEGAL: { label: "法人", color: "bg-blue-100 text-blue-700", icon: Building2 },
  PERSONAL: { label: "个人", color: "bg-purple-100 text-purple-700", icon: User },
}

export default function AcquiringSubjectTestPage() {
  const [selectedStore, setSelectedStore] = useState("")
  const [testTime, setTestTime] = useState(new Date().toISOString().split("T")[0])
  const [resolveResult, setResolveResult] = useState<any>(null)
  const [isResolving, setIsResolving] = useState(false)

  const handleResolve = () => {
    setIsResolving(true)
    // 模拟API调用
    setTimeout(() => {
      const mockResult = mockResolveResults.find((r) => r.store_id === selectedStore) || mockResolveResults[2]
      setResolveResult(mockResult)
      setIsResolving(false)
    }, 500)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">收单主体解析测试</h1>
        <p className="text-muted-foreground">
          测试"店铺→时间点→提现账号绑定→收单主体"解析算法，用于财务/研发联调与数据验证
        </p>
      </div>

      {/* 算法说明 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-blue-900 mb-2">解析算法（唯一权威）</div>
              <div className="text-blue-700 space-y-1">
                <div>1. 输入：store_id + t（业务发生时间）</div>
                <div>2. 查找店铺在时间 t 的有效绑定：effective_from {" <= "} t {"<"} effective_to</div>
                <div>3. 读取 payout_account 的 owner_type 与 owner_ref_id</div>
                <div>4. 输出：acquiring_subject_type, acquiring_subject_id, payout_account_id</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 测试表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">解析测试</CardTitle>
          <CardDescription>
            选择店铺和时间点，测试收单主体解析结果
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>店铺 *</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="选择店铺" />
                </SelectTrigger>
                <SelectContent>
                  {mockStores.map((store) => (
                    <SelectItem key={store.store_id} value={store.store_id}>
                      {store.store_code} - {store.store_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>业务发生时间 *</Label>
              <Input
                type="date"
                value={testTime}
                onChange={(e) => setTestTime(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={handleResolve}
                disabled={!selectedStore || isResolving}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                {isResolving ? "解析中..." : "执行解析"}
              </Button>
            </div>
          </div>

          {resolveResult && (
            <>
              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">解析结果</h3>
                  <Badge className={statusConfig[resolveResult.status as keyof typeof statusConfig].color}>
                    {statusConfig[resolveResult.status as keyof typeof statusConfig].label}
                  </Badge>
                </div>

                {resolveResult.status === "SUCCESS" ? (
                  <>
                    {/* 成功结果 */}
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground mb-1">提现账号</div>
                          <div className="font-medium">{resolveResult.payout_account_name}</div>
                          <div className="font-mono text-xs text-muted-foreground mt-1">
                            ID: {resolveResult.payout_account_id}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">收单主体类型</div>
                          <Badge className={subjectTypeConfig[resolveResult.acquiring_subject_type as keyof typeof subjectTypeConfig].color}>
                            {subjectTypeConfig[resolveResult.acquiring_subject_type as keyof typeof subjectTypeConfig].label}
                          </Badge>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-muted-foreground mb-1">收单主体</div>
                          <div className="font-medium">{resolveResult.acquiring_subject_name}</div>
                          <div className="font-mono text-xs text-muted-foreground mt-1">
                            ID: {resolveResult.acquiring_subject_id}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">生效区间</div>
                          <div className="text-sm">
                            {resolveResult.effective_from} ~ {resolveResult.effective_to || "当前"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">执行耗时</div>
                          <div className="text-sm">{resolveResult.execution_time_ms}ms</div>
                        </div>
                      </div>
                    </div>

                    {/* 追溯链展示 */}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="font-medium mb-3 text-sm">解析追溯链</div>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <div className="p-2 bg-background rounded border">
                          <div className="text-xs text-muted-foreground">店铺</div>
                          <div className="font-mono text-xs mt-1">{resolveResult.store_code}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="p-2 bg-background rounded border">
                          <div className="text-xs text-muted-foreground">时间点</div>
                          <div className="font-mono text-xs mt-1">{testTime}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="p-2 bg-background rounded border">
                          <div className="text-xs text-muted-foreground">绑定查询</div>
                          <div className="font-mono text-xs mt-1">effective_from {" <= "} t {"<"} effective_to</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="p-2 bg-background rounded border">
                          <div className="text-xs text-muted-foreground">提现账号</div>
                          <div className="font-mono text-xs mt-1">{resolveResult.payout_account_id}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="p-2 bg-green-100 rounded border border-green-200">
                          <div className="text-xs text-green-700">收单主体</div>
                          <div className="font-mono text-xs mt-1 text-green-900">{resolveResult.acquiring_subject_id}</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 错误结果 */}
                    <Alert className="border-red-200 bg-red-50">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-900">
                        <div className="font-medium mb-1">错误码: {resolveResult.error_code}</div>
                        <div className="text-sm text-red-700">{resolveResult.error_message}</div>
                      </AlertDescription>
                    </Alert>

                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
                      <div className="font-medium text-red-900 mb-2">错误处理建议</div>
                      <ul className="list-disc list-inside text-red-700 space-y-1">
                        <li>检查店铺是否存在有效的提现账号绑定</li>
                        <li>确认绑定生效区间是否覆盖测试时间点</li>
                        <li>验证提现账号状态是否为 ACTIVE</li>
                        <li>联系财务团队补充绑定信息</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 历史测试记录 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">历史测试记录</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>测试时间</TableHead>
                <TableHead>店铺</TableHead>
                <TableHead>业务时间点</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>收单主体</TableHead>
                <TableHead>耗时</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockResolveResults.map((result) => {
                const statusInfo = statusConfig[result.status as keyof typeof statusConfig]
                const StatusIcon = statusInfo.icon

                return (
                  <TableRow key={result.test_id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.test_time}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {result.store_code}
                    </TableCell>
                    <TableCell className="text-sm">
                      {result.test_time.split(" ")[0]}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusInfo.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {result.status === "SUCCESS" ? (
                        <div>
                          <Badge className={subjectTypeConfig[result.acquiring_subject_type as keyof typeof subjectTypeConfig].color} variant="outline">
                            {subjectTypeConfig[result.acquiring_subject_type as keyof typeof subjectTypeConfig].label}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {result.acquiring_subject_name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-red-600 text-xs">{result.error_code}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.execution_time_ms}ms
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="font-medium mb-1">用途</div>
            <div className="text-muted-foreground">
              该页面供财务团队与研发团队联调使用，用于验证收单主体解析算法的正确性，排查历史数据问题。
            </div>
          </div>
          <Separator />
          <div>
            <div className="font-medium mb-1">注意事项</div>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>测试时间应选择在绑定生效区间内</li>
              <li>解析结果将缓存到测试记录表，可追溯</li>
              <li>生产环境应限制访问权限（仅 R1/R2/财务）</li>
              <li>不影响真实业务数据，仅供验证使用</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
