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
} from "lucide-react"

const requirements = [
  {
    id: "PR-2025-000387",
    type: "测款采购",
    source: "直播测款（2025-03-春夏专场）",
    skuCode: "SK2025-031",
    productName: "印尼风格碎花连衣裙",
    demandQty: 3200,
    availableStock: 620,
    suggestedQty: 2600,
    estimatedAmount: 176800,
    expectedDate: "2025-04-05",
    status: "pending",
    creator: "商品中心系统 / 张琳",
    createdAt: "2025-03-22 14:36",
  },
  {
    id: "PR-2025-000392",
    type: "测款采购",
    source: "直播测款（2025-03-春夏专场）",
    skuCode: "SK2025-045",
    productName: "波西米亚风格长裙",
    demandQty: 2800,
    availableStock: 450,
    suggestedQty: 2400,
    estimatedAmount: 144000,
    expectedDate: "2025-04-08",
    status: "approved",
    creator: "商品中心系统 / 李伟",
    createdAt: "2025-03-23 09:15",
  },
  {
    id: "PR-2025-000401",
    type: "测款采购",
    source: "短视频测款（2025-04-新品预热）",
    skuCode: "SK2025-058",
    productName: "法式复古衬衫",
    demandQty: 1500,
    availableStock: 280,
    suggestedQty: 1250,
    estimatedAmount: 87500,
    expectedDate: "2025-04-12",
    status: "draft",
    creator: "商品中心系统 / 王芳",
    createdAt: "2025-03-24 11:20",
  },
  {
    id: "PR-2025-000405",
    type: "测款采购",
    source: "直播测款（2025-04-秋冬预热）",
    skuCode: "SK2025-062",
    productName: "毛呢大衣",
    demandQty: 1800,
    availableStock: 320,
    suggestedQty: 1500,
    estimatedAmount: 225000,
    expectedDate: "2025-04-15",
    status: "ordered",
    creator: "商品中心系统 / 张琳",
    createdAt: "2025-03-25 14:00",
  },
  {
    id: "PR-2025-000410",
    type: "测款采购",
    source: "直播测款（2025-03-春夏专场）",
    skuCode: "SK2025-071",
    productName: "真丝印花衬衫",
    demandQty: 2200,
    availableStock: 180,
    suggestedQty: 2050,
    estimatedAmount: 184500,
    expectedDate: "2025-04-10",
    status: "closed",
    creator: "商品中心系统 / 李伟",
    createdAt: "2025-03-26 10:30",
  },
]

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  pending: { label: "待审批", variant: "default" },
  approved: { label: "已批准", variant: "outline" },
  ordered: { label: "已生成采购订单", variant: "outline" },
  closed: { label: "已关闭", variant: "destructive" },
}

export default function TestingRequirementsPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [materialFilter, setMaterialFilter] = useState("all")
  const [sessionFilter, setSessionFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const filteredRequirements = requirements.filter((req) => {
    const matchesSearch =
      req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.skuCode.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || req.status === statusFilter
    return matchesSearch && matchesStatus
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
              <h1 className="text-2xl font-bold text-foreground">测款采购需求</h1>
              <p className="text-sm text-muted-foreground mt-1">基于商品中心直播/短视频测款触发的采购需求</p>
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
                      setMaterialFilter("all")
                      setSessionFilter("all")
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
                    placeholder="搜索需求编号、商品名称、SKU..."
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
                    <Select value={materialFilter} onValueChange={setMaterialFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="garment">成衣</SelectItem>
                        <SelectItem value="fabric">面料</SelectItem>
                        <SelectItem value="accessory">辅料</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">测款场次</label>
                    <Select value={sessionFilter} onValueChange={setSessionFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择场次" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="2025-03-spring">2025-03-春夏专场</SelectItem>
                        <SelectItem value="2025-04-autumn">2025-04-秋冬预热</SelectItem>
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
                      <th className="text-left p-3 font-medium">关联商品/SKU</th>
                      <th className="text-right p-3 font-medium">需求数量</th>
                      <th className="text-right p-3 font-medium">可用库存</th>
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
                            href={`/pms/requirements/testing/${req.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {req.id}
                          </Link>
                        </td>
                        <td className="p-3 text-muted-foreground">{req.source}</td>
                        <td className="p-3">
                          <div>{req.productName}</div>
                          <div className="text-xs text-muted-foreground">{req.skuCode}</div>
                        </td>
                        <td className="p-3 text-right font-medium">{req.demandQty.toLocaleString()}</td>
                        <td className="p-3 text-right">{req.availableStock.toLocaleString()}</td>
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
                                <Link href={`/pms/requirements/testing/${req.id}`}>
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
