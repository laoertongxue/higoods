"use client"

import { useState } from "react"
import Link from "next/link"
import { PmsSidebarNav } from "@/components/pms-sidebar-nav"
import { PmsSystemNav } from "@/components/pms-system-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Eye,
  Send,
  FileText,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react"

const requirements = [
  {
    id: "PR-2025-000412",
    type: "备货采购",
    source: "库存安全库存触发",
    materialName: "40S 精梳棉面料（白色）",
    materialCode: "FAB-2025-001",
    currentStock: 300,
    safetyStock: 500,
    gapQty: 200,
    suggestedQty: 250,
    estimatedAmount: 9000,
    expectedDate: "2025-04-10",
    status: "pending",
    creator: "采购系统 / 李伟",
    createdAt: "2025-03-22 10:15",
    isSafetyTrigger: true,
  },
  {
    id: "PR-2025-000418",
    type: "备货采购",
    source: "生产计划触发",
    materialName: "涤纶里布（黑色）",
    materialCode: "FAB-2025-015",
    currentStock: 800,
    safetyStock: 600,
    gapQty: 0,
    suggestedQty: 400,
    estimatedAmount: 4800,
    expectedDate: "2025-04-12",
    status: "approved",
    creator: "生产系统 / 王芳",
    createdAt: "2025-03-23 09:30",
    isSafetyTrigger: false,
  },
  {
    id: "PR-2025-000425",
    type: "备货采购",
    source: "库存安全库存触发",
    materialName: "YKK拉链 5# （银色）",
    materialCode: "ACC-2025-008",
    currentStock: 1500,
    safetyStock: 3000,
    gapQty: 1500,
    suggestedQty: 2000,
    estimatedAmount: 6000,
    expectedDate: "2025-04-08",
    status: "draft",
    creator: "采购系统 / 李伟",
    createdAt: "2025-03-24 14:20",
    isSafetyTrigger: true,
  },
  {
    id: "PR-2025-000430",
    type: "备货采购",
    source: "库存安全库存触发",
    materialName: "纽扣 四孔 12mm（白色）",
    materialCode: "ACC-2025-012",
    currentStock: 5000,
    safetyStock: 8000,
    gapQty: 3000,
    suggestedQty: 4000,
    estimatedAmount: 2400,
    expectedDate: "2025-04-15",
    status: "ordered",
    creator: "采购系统 / 张琳",
    createdAt: "2025-03-25 11:00",
    isSafetyTrigger: true,
  },
]

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  pending: { label: "待审批", variant: "default" },
  approved: { label: "已批准", variant: "outline" },
  ordered: { label: "已生成采购订单", variant: "outline" },
  closed: { label: "已关闭", variant: "destructive" },
}

export default function StockingRequirementsPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [materialTypeFilter, setMaterialTypeFilter] = useState("all")
  const [safetyTriggerFilter, setSafetyTriggerFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const filteredRequirements = requirements.filter((req) => {
    const matchesSearch =
      req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.materialCode.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || req.status === statusFilter
    const matchesSafety =
      safetyTriggerFilter === "all" ||
      (safetyTriggerFilter === "yes" && req.isSafetyTrigger) ||
      (safetyTriggerFilter === "no" && !req.isSafetyTrigger)
    return matchesSearch && matchesStatus && matchesSafety
  })

  const totalPages = Math.ceil(filteredRequirements.length / pageSize)
  const paginatedRequirements = filteredRequirements.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <PmsSystemNav />
      <div className="flex flex-1 overflow-hidden">
        <PmsSidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">备货采购需求</h1>
              <p className="text-sm text-muted-foreground mt-1">基于库存安全水平与长期生产需求生成的采购需求</p>
            </div>
            <Button>新建采购需求</Button>
          </div>

          {/* Search and Filter */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  查询条件
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("")
                      setStatusFilter("all")
                      setMaterialTypeFilter("all")
                      setSafetyTriggerFilter("all")
                    }}
                  >
                    清空
                  </Button>
                  <Button size="sm">查询</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                    {showFilters ? "收起" : "展开"}
                    {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索需求编号、物料名称、物料编码..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="需求状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="pending">待审批</SelectItem>
                    <SelectItem value="approved">已批准</SelectItem>
                    <SelectItem value="ordered">已生成采购订单</SelectItem>
                    <SelectItem value="closed">已关闭</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {showFilters && (
                <div className="grid grid-cols-4 gap-4 pt-2 border-t">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">物料类型</label>
                    <Select value={materialTypeFilter} onValueChange={setMaterialTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="fabric">面料</SelectItem>
                        <SelectItem value="accessory">辅料</SelectItem>
                        <SelectItem value="yarn">纱线</SelectItem>
                        <SelectItem value="consumable">耗材</SelectItem>
                        <SelectItem value="equipment">设备</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">安全库存触发</label>
                    <Select value={safetyTriggerFilter} onValueChange={setSafetyTriggerFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="yes">是</SelectItem>
                        <SelectItem value="no">否</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">创建时间</label>
                    <Input type="date" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">期望到货时间</label>
                    <Input type="date" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">
                  数据列表
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    共 {filteredRequirements.length} 条记录
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">需求编号</th>
                      <th className="text-left p-3 font-medium">需求来源</th>
                      <th className="text-left p-3 font-medium">关联物料</th>
                      <th className="text-right p-3 font-medium">当前库存</th>
                      <th className="text-right p-3 font-medium">安全库存</th>
                      <th className="text-right p-3 font-medium">缺口数量</th>
                      <th className="text-right p-3 font-medium">建议采购数量</th>
                      <th className="text-right p-3 font-medium">预估金额(不含税)</th>
                      <th className="text-left p-3 font-medium">期望到货</th>
                      <th className="text-left p-3 font-medium">状态</th>
                      <th className="text-left p-3 font-medium">创建人</th>
                      <th className="text-left p-3 font-medium">创建时间</th>
                      <th className="text-center p-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequirements.map((req) => (
                      <tr key={req.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          <Link
                            href={`/pms/requirements/stocking/${req.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {req.id}
                          </Link>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            {req.isSafetyTrigger && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                            <span className="text-muted-foreground">{req.source}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div>{req.materialName}</div>
                          <div className="text-xs text-muted-foreground">{req.materialCode}</div>
                        </td>
                        <td className="p-3 text-right">{req.currentStock.toLocaleString()}</td>
                        <td className="p-3 text-right">{req.safetyStock.toLocaleString()}</td>
                        <td className="p-3 text-right font-medium text-red-600">
                          {req.gapQty > 0 ? req.gapQty.toLocaleString() : "-"}
                        </td>
                        <td className="p-3 text-right font-semibold text-primary">
                          {req.suggestedQty.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-medium">¥{req.estimatedAmount.toLocaleString()}</td>
                        <td className="p-3">{req.expectedDate}</td>
                        <td className="p-3">
                          <Badge variant={statusConfig[req.status].variant}>{statusConfig[req.status].label}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{req.creator}</td>
                        <td className="p-3 text-muted-foreground text-xs">{req.createdAt}</td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/pms/requirements/stocking/${req.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  查看详情
                                </Link>
                              </DropdownMenuItem>
                              {req.status === "draft" && (
                                <DropdownMenuItem>
                                  <Send className="h-4 w-4 mr-2" />
                                  提交审批
                                </DropdownMenuItem>
                              )}
                              {req.status === "approved" && (
                                <DropdownMenuItem>
                                  <FileText className="h-4 w-4 mr-2" />
                                  生成采购订单
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive">
                                <XCircle className="h-4 w-4 mr-2" />
                                关闭需求
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  显示 {(currentPage - 1) * pageSize + 1} -{" "}
                  {Math.min(currentPage * pageSize, filteredRequirements.length)} 条，共 {filteredRequirements.length}{" "}
                  条
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8"
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
