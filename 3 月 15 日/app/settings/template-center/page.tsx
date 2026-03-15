"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Search, Plus, Edit2, Copy, Trash2, Eye, Download, FileText, CheckCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

// TC1｜模板中心

type TemplateType = "IMPORT" | "EXPORT" | "FORM"
type TemplateStatus = "ACTIVE" | "DRAFT" | "ARCHIVED"

interface Template {
  id: string
  code: string
  name: string
  type: TemplateType
  category: string
  version: string
  fieldCount: number
  usedCount: number
  status: TemplateStatus
  description: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface TemplateField {
  id: string
  fieldCode: string
  fieldName: string
  dataType: string
  required: boolean
  min?: number
  max?: number
  dataSource?: string
  validationRule?: string
  defaultValue?: string
  placeholder?: string
  sortOrder: number
}

const mockTemplates: Template[] = [
  { id: "t1", code: "TPLT_FX_IMPORT", name: "汇率导入模板", type: "IMPORT", category: "汇率管理", version: "v1.2", fieldCount: 8, usedCount: 156, status: "ACTIVE", description: "支持期间固定/期末/即期汇率导入", createdBy: "admin", createdAt: "2025-01-01", updatedAt: "2025-01-15" },
  { id: "t2", code: "TPLT_BANK_IMPORT", name: "银行流水导入", type: "IMPORT", category: "资金管理", version: "v2.0", fieldCount: 12, usedCount: 234, status: "ACTIVE", description: "支持多币种银行流水批量导入", createdBy: "finance_admin", createdAt: "2025-01-05", updatedAt: "2025-01-20" },
  { id: "t3", code: "TPLT_PAYMENT_FORM", name: "付款申请表单", type: "FORM", category: "付款管理", version: "v1.0", fieldCount: 15, usedCount: 89, status: "ACTIVE", description: "工厂/供应商/主播付款申请统一表单", createdBy: "admin", createdAt: "2025-01-10", updatedAt: "2025-01-10" },
  { id: "t4", code: "TPLT_COST_EXPORT", name: "成本导出模板", type: "EXPORT", category: "成本管理", version: "v1.1", fieldCount: 20, usedCount: 45, status: "DRAFT", description: "成本归集明细导出", createdBy: "finance_admin", createdAt: "2025-01-18", updatedAt: "2025-01-18" },
]

const mockFields: TemplateField[] = [
  { id: "f1", fieldCode: "base_currency", fieldName: "基准币种", dataType: "SELECT", required: true, dataSource: "CURRENCY", sortOrder: 1, placeholder: "选择币种" },
  { id: "f2", fieldCode: "quote_currency", fieldName: "标价币种", dataType: "SELECT", required: true, dataSource: "CURRENCY", sortOrder: 2, placeholder: "选择币种" },
  { id: "f3", fieldCode: "rate_type", fieldName: "汇率类型", dataType: "SELECT", required: true, dataSource: "RATE_TYPE", sortOrder: 3 },
  { id: "f4", fieldCode: "period_code", fieldName: "会计期间", dataType: "TEXT", required: false, validationRule: "YYYY-MM", sortOrder: 4, placeholder: "2026-01" },
  { id: "f5", fieldCode: "effective_date", fieldName: "生效日期", dataType: "DATE", required: false, sortOrder: 5 },
  { id: "f6", fieldCode: "rate", fieldName: "汇率", dataType: "NUMBER", required: true, min: 0, sortOrder: 6, placeholder: "0.000000" },
  { id: "f7", fieldCode: "source", fieldName: "汇率来源", dataType: "SELECT", required: true, dataSource: "RATE_SOURCE", sortOrder: 7 },
  { id: "f8", fieldCode: "remark", fieldName: "备注", dataType: "TEXTAREA", required: false, max: 200, sortOrder: 8, placeholder: "选填" },
]

const typeLabels: Record<TemplateType, string> = {
  IMPORT: "导入",
  EXPORT: "导出",
  FORM: "表单",
}

const statusConfig: Record<TemplateStatus, { label: string; color: string }> = {
  ACTIVE: { label: "生效", color: "bg-green-100 text-green-700" },
  DRAFT: { label: "草稿", color: "bg-gray-100 text-gray-700" },
  ARCHIVED: { label: "归档", color: "bg-yellow-100 text-yellow-700" },
}

const dataTypeLabels: Record<string, string> = {
  TEXT: "文本",
  NUMBER: "数字",
  DATE: "日期",
  SELECT: "下拉选择",
  TEXTAREA: "多行文本",
  CHECKBOX: "复选框",
}

export default function TemplateCenterPage() {
  const searchParams = useSearchParams()
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  const filteredTemplates = mockTemplates.filter((tpl) => {
    if (search && !tpl.name.includes(search) && !tpl.code.includes(search)) return false
    if (filterType !== "all" && tpl.type !== filterType) return false
    if (filterCategory !== "all" && tpl.category !== filterCategory) return false
    if (filterStatus !== "all" && tpl.status !== filterStatus) return false
    return true
  })

  const openDetail = (template: Template) => {
    setSelectedTemplate(template)
    setDetailOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">模板中心</h1>
          <p className="text-muted-foreground">管理导入、导出、表单模板，定义字段规则和校验逻辑</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            导出模板库
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            新建模板
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索模板名称或Code"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="模板类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="IMPORT">导入</SelectItem>
                <SelectItem value="EXPORT">导出</SelectItem>
                <SelectItem value="FORM">表单</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                <SelectItem value="汇率管理">汇率管理</SelectItem>
                <SelectItem value="资金管理">资金管理</SelectItem>
                <SelectItem value="付款管理">付款管理</SelectItem>
                <SelectItem value="成本管理">成本管理</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="ACTIVE">生效</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="ARCHIVED">归档</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>模板列表</CardTitle>
          <CardDescription>共 {filteredTemplates.length} 个模板</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>模板名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>字段数</TableHead>
                  <TableHead>使用次数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-mono text-sm">{tpl.code}</TableCell>
                    <TableCell className="font-medium">{tpl.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabels[tpl.type]}</Badge>
                    </TableCell>
                    <TableCell>{tpl.category}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tpl.version}</TableCell>
                    <TableCell>{tpl.fieldCount}</TableCell>
                    <TableCell>
                      {tpl.usedCount > 0 ? (
                        <span className="text-blue-600 font-medium">{tpl.usedCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[tpl.status].color}>{statusConfig[tpl.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tpl.updatedAt}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openDetail(tpl)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Copy className="h-4 w-4" />
                        </Button>
                        {tpl.usedCount === 0 && (
                          <Button size="sm" variant="ghost">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>模板详情</SheetTitle>
            <SheetDescription>查看字段规则和表单预览</SheetDescription>
          </SheetHeader>
          {selectedTemplate && (
            <div className="mt-6 space-y-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">基本信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium mb-1">Code</div>
                      <div className="font-mono text-sm bg-muted p-2 rounded">{selectedTemplate.code}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1">版本</div>
                      <div>{selectedTemplate.version}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">模板名称</div>
                    <div>{selectedTemplate.name}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">说明</div>
                    <div className="text-sm text-muted-foreground">{selectedTemplate.description}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm font-medium mb-1">类型</div>
                      <Badge variant="outline">{typeLabels[selectedTemplate.type]}</Badge>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1">分类</div>
                      <div>{selectedTemplate.category}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1">状态</div>
                      <Badge className={statusConfig[selectedTemplate.status].color}>
                        {statusConfig[selectedTemplate.status].label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="fields" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="fields" className="flex-1">
                    字段规则
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1">
                    表单预览
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="fields" className="space-y-3 mt-4">
                  {mockFields.map((field) => (
                    <Card key={field.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-medium">
                              {field.fieldName}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{field.fieldCode}</div>
                          </div>
                          <Badge variant="outline">{dataTypeLabels[field.dataType]}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {field.dataSource && (
                            <div className="text-muted-foreground">数据源: {field.dataSource}</div>
                          )}
                          {field.min !== undefined && <div className="text-muted-foreground">最小: {field.min}</div>}
                          {field.max !== undefined && <div className="text-muted-foreground">最大: {field.max}</div>}
                          {field.placeholder && (
                            <div className="text-muted-foreground">提示: {field.placeholder}</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="preview" className="space-y-4 mt-4">
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="text-sm font-medium mb-4">表单预览（根据字段规则生成）</div>
                    <div className="space-y-4 bg-white p-4 rounded border">
                      {mockFields.slice(0, 4).map((field) => (
                        <div key={field.id}>
                          <Label>
                            {field.fieldName}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {field.dataType === "SELECT" ? (
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="demo">示例选项</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : field.dataType === "TEXTAREA" ? (
                            <Input placeholder={field.placeholder} />
                          ) : (
                            <Input type={field.dataType === "NUMBER" ? "number" : "text"} placeholder={field.placeholder} />
                          )}
                        </div>
                      ))}
                      <Button className="w-full mt-4">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        提交
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Edit2 className="h-4 w-4 mr-2" />
                  编辑模板
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  下载
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
