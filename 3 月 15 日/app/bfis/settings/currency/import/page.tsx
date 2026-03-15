"use client"

import { useState } from "react"
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  Trash2,
  Eye,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { toast } from "sonner"

// FI1｜汇率导入页（原子汇率/汇率集两类模板）
// 流程：上传→预校验→错误行展示（错误码+提示）→确认入库

type ImportStatus = "PENDING" | "VALIDATING" | "VALIDATED" | "IMPORTING" | "SUCCESS" | "PARTIAL" | "FAILED"

const statusConfig: Record<ImportStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING: { label: "待处理", color: "bg-gray-100 text-gray-700", icon: Clock },
  VALIDATING: { label: "校验中", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  VALIDATED: { label: "校验完成", color: "bg-green-100 text-green-700", icon: CheckCircle },
  IMPORTING: { label: "导入中", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  SUCCESS: { label: "成功", color: "bg-green-100 text-green-700", icon: CheckCircle },
  PARTIAL: { label: "部分成功", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  FAILED: { label: "失败", color: "bg-red-100 text-red-700", icon: XCircle },
}

// Mock 导入历史
const mockImportHistory = [
  {
    id: "imp_001",
    fileName: "fx_rates_202601.xlsx",
    uploadedAt: "2026-01-21 08:00:00",
    uploadedBy: "finance_admin",
    status: "SUCCESS" as ImportStatus,
    totalRows: 60,
    successRows: 60,
    errorRows: 0,
    progress: 100,
  },
  {
    id: "imp_002",
    fileName: "fx_rates_202512.xlsx",
    uploadedAt: "2025-12-31 23:00:00",
    uploadedBy: "admin",
    status: "SUCCESS" as ImportStatus,
    totalRows: 62,
    successRows: 62,
    errorRows: 0,
    progress: 100,
  },
  {
    id: "imp_003",
    fileName: "fx_manual_correction.csv",
    uploadedAt: "2025-12-20 14:30:00",
    uploadedBy: "finance_admin",
    status: "PARTIAL" as ImportStatus,
    totalRows: 10,
    successRows: 8,
    errorRows: 2,
    progress: 100,
  },
]

// Mock 校验错误
const mockValidationErrors = [
  { row: 5, field: "rate", value: "-100", errorCode: "FR_3003", message: "汇率值必须大于0" },
  { row: 8, field: "base_currency", value: "CNY", errorCode: "FR_3001", message: "基准币与报价币不能相同（base=CNY, quote=CNY）" },
]

// 模板字段说明
const templateFields = [
  { field: "base_currency", description: "基准币（如 USD）", required: true, example: "USD" },
  { field: "quote_currency", description: "报价币（如 IDR、CNY）", required: true, example: "IDR" },
  { field: "rate_type", description: "汇率类型（SPOT/AVG_MONTH/END_PERIOD）", required: true, example: "SPOT" },
  { field: "effective_date", description: "生效日期（YYYY-MM-DD）", required: true, example: "2026-01-21" },
  { field: "period_code", description: "期间编码（YYYY-MM，月均/期末推荐）", required: false, example: "2026-01" },
  { field: "rate", description: "汇率值（>0）", required: true, example: "15850" },
  { field: "source_code", description: "来源编码（默认 IMPORT）", required: false, example: "IMPORT" },
  { field: "remark", description: "备注", required: false, example: "" },
]

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState("upload")
  const [uploadStatus, setUploadStatus] = useState<ImportStatus | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedImport, setSelectedImport] = useState<(typeof mockImportHistory)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const handleDownloadTemplate = () => {
    toast.success("模板下载已开始")
  }

  const handleUpload = () => {
    setUploadStatus("VALIDATING")
    setUploadProgress(0)

    // 模拟上传和校验过程
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setUploadStatus("VALIDATED")
          setShowErrors(true)
          return 100
        }
        return prev + 20
      })
    }, 500)
  }

  const handleConfirmImport = () => {
    setUploadStatus("IMPORTING")
    setUploadProgress(0)

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setUploadStatus("SUCCESS")
          toast.success("汇率导入成功")
          return 100
        }
        return prev + 25
      })
    }, 300)
  }

  const handleReset = () => {
    setUploadStatus(null)
    setUploadProgress(0)
    setShowErrors(false)
  }

  const openDetail = (imp: typeof mockImportHistory[0]) => {
    setSelectedImport(imp)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">汇率导入</h1>
          <p className="text-muted-foreground">批量导入汇率数据，支持模板下载与校验预览</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          下载导入模板
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload">上传导入</TabsTrigger>
          <TabsTrigger value="history">导入历史</TabsTrigger>
          <TabsTrigger value="template">模板说明</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {/* 上传区域 */}
          <Card>
            <CardHeader>
              <CardTitle>上传文件</CardTitle>
              <CardDescription>支持 CSV、Excel (.xlsx) 格式，单次最多 1000 行</CardDescription>
            </CardHeader>
            <CardContent>
              {!uploadStatus ? (
                <div
                  className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={handleUpload}
                >
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">点击或拖拽文件到此处上传</p>
                  <p className="text-sm text-muted-foreground">支持 .csv, .xlsx 格式</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <FileSpreadsheet className="h-10 w-10 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">fx_rates_sample.xlsx</p>
                      <p className="text-sm text-muted-foreground">60 行数据</p>
                    </div>
                    <Badge className={statusConfig[uploadStatus].color}>
                      {statusConfig[uploadStatus].label}
                    </Badge>
                  </div>

                  {(uploadStatus === "VALIDATING" || uploadStatus === "IMPORTING") && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{uploadStatus === "VALIDATING" ? "校验中..." : "导入中..."}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}

                  {uploadStatus === "VALIDATED" && showErrors && mockValidationErrors.length > 0 && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium text-yellow-800">校验发现 {mockValidationErrors.length} 个错误</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>行号</TableHead>
                            <TableHead>字段</TableHead>
                            <TableHead>错误值</TableHead>
                            <TableHead>错误说明</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mockValidationErrors.map((err, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{err.row}</TableCell>
                              <TableCell className="font-mono">{err.field}</TableCell>
                              <TableCell className="font-mono text-red-600">{err.value}</TableCell>
                              <TableCell className="text-sm">{err.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="text-sm text-yellow-700 mt-3">
                        请修正错误后重新上传，或忽略错误行继续导入有效数据
                      </p>
                    </div>
                  )}

                  {uploadStatus === "VALIDATED" && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-800">校验完成</span>
                      </div>
                      <p className="text-sm text-green-700">
                        共 60 行数据，{60 - mockValidationErrors.length} 行有效，{mockValidationErrors.length} 行错误
                      </p>
                    </div>
                  )}

                  {uploadStatus === "SUCCESS" && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-800">导入成功</span>
                      </div>
                      <p className="text-sm text-green-700">
                        成功导入 {60 - mockValidationErrors.length} 条汇率记录
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {uploadStatus === "VALIDATED" && (
                      <>
                        <Button onClick={handleConfirmImport}>
                          确认导入（跳过错误行）
                        </Button>
                        <Button variant="outline" onClick={handleReset}>
                          重新上传
                        </Button>
                      </>
                    )}
                    {uploadStatus === "SUCCESS" && (
                      <Button variant="outline" onClick={handleReset}>
                        继续导入
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {/* 导入历史 */}
          <Card>
            <CardHeader>
              <CardTitle>导入历史</CardTitle>
              <CardDescription>查看历史导入记录与结果</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>文件名</TableHead>
                    <TableHead>上传时间</TableHead>
                    <TableHead>上传人</TableHead>
                    <TableHead className="text-right">总行数</TableHead>
                    <TableHead className="text-right">成功</TableHead>
                    <TableHead className="text-right">失败</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockImportHistory.map((imp) => {
                    const config = statusConfig[imp.status]
                    const StatusIcon = config.icon
                    return (
                      <TableRow key={imp.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{imp.fileName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{imp.uploadedAt}</TableCell>
                        <TableCell>{imp.uploadedBy}</TableCell>
                        <TableCell className="text-right font-mono">{imp.totalRows}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{imp.successRows}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {imp.errorRows > 0 ? imp.errorRows : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={config.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openDetail(imp)}>
                            <Eye className="h-4 w-4" />
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

        <TabsContent value="template" className="space-y-6">
          {/* 模板说明 */}
          <Card>
            <CardHeader>
              <CardTitle>导入模板字段说明</CardTitle>
              <CardDescription>请按照以下字段格式准备导入数据</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>字段名</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead>必填</TableHead>
                    <TableHead>示例</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templateFields.map((field) => (
                    <TableRow key={field.field}>
                      <TableCell className="font-mono font-medium">{field.field}</TableCell>
                      <TableCell>{field.description}</TableCell>
                      <TableCell>
                        {field.required ? (
                          <Badge className="bg-red-100 text-red-700">必填</Badge>
                        ) : (
                          <Badge variant="outline">可选</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">{field.example || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>导入规则说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg">
                <strong>唯一性校验：</strong>同一 base + quote + rate_type + effective_date + source 不得重复存在 ACTIVE 记录
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <strong>汇率值校验：</strong>rate 必须大于 0，base_currency 与 quote_currency 不能相同
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <strong>日期校验：</strong>SPOT 类型必须填写 effective_date，AVG_MONTH/END_PERIOD 建议同时填写 period_code
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <strong>来源默认值：</strong>若未填写 source_code，默认使用 IMPORT
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 导入详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>导入详情</SheetTitle>
            <SheetDescription>{selectedImport?.fileName}</SheetDescription>
          </SheetHeader>

          {selectedImport && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">上传时间</div>
                  <div className="font-medium mt-1">{selectedImport.uploadedAt}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">上传人</div>
                  <div className="font-medium mt-1">{selectedImport.uploadedBy}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">总行数</div>
                  <div className="font-mono font-bold mt-1">{selectedImport.totalRows}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">状态</div>
                  <div className="mt-1">
                    <Badge className={statusConfig[selectedImport.status].color}>
                      {statusConfig[selectedImport.status].label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <div className="text-sm text-green-600 mb-1">成功导入</div>
                  <div className="text-2xl font-bold text-green-700">{selectedImport.successRows}</div>
                </div>
                <div className={`p-4 rounded-lg text-center ${selectedImport.errorRows > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                  <div className={`text-sm mb-1 ${selectedImport.errorRows > 0 ? "text-red-600" : "text-gray-600"}`}>导入失败</div>
                  <div className={`text-2xl font-bold ${selectedImport.errorRows > 0 ? "text-red-700" : "text-gray-700"}`}>
                    {selectedImport.errorRows}
                  </div>
                </div>
              </div>

              {selectedImport.errorRows > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-800">错误详情</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>行号</TableHead>
                        <TableHead>错误说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockValidationErrors.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">{err.row}</TableCell>
                          <TableCell className="text-sm">{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
