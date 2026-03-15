"use client"

import { useState } from "react"
import Link from "next/link"
import { PmsSidebarNav } from "@/components/pms-sidebar-nav"
import { PmsSystemNav } from "@/components/pms-system-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Search,
  MoreVertical,
  Eye,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  RefreshCw,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// 异常类型
type ExceptionType = "到货延期" | "数量变更" | "供应商缺货" | "质量问题" | "价格变更" | "取消订单"

// 处理状态
type ProcessStatus = "未处理" | "处理中" | "已处理" | "已关闭"

interface OrderException {
  id: string
  orderId: string
  requirementId: string
  type: ExceptionType
  description: string
  purchaseType: "测款采购" | "备货采购" | "手工采购"
  objectType: "样衣" | "面料" | "辅料" | "纱线" | "耗材" | "设备"
  supplier: string
  status: ProcessStatus
  priority: "高" | "中" | "低"
  creator: string
  createdAt: string
  expectedResolveDate: string
  handler?: string
  handledAt?: string
}

const exceptions: OrderException[] = [
  {
    id: "EX-2025-00058",
    orderId: "PO-2025-001050",
    requirementId: "PR-2025-000387",
    type: "到货延期",
    description: "原预计到货时间2025-03-28，供应商通知延迟至2025-03-30",
    purchaseType: "测款采购",
    objectType: "样衣",
    supplier: "淘宝电商平台",
    status: "未处理",
    priority: "高",
    creator: "采购系统",
    createdAt: "2025-03-23 09:30",
    expectedResolveDate: "2025-03-30",
  },
  {
    id: "EX-2025-00057",
    orderId: "PO-2025-001048",
    requirementId: "PR-2025-000385",
    type: "数量变更",
    description: "供应商库存不足，实际可供应数量由500米调整为450米",
    purchaseType: "备货采购",
    objectType: "面料",
    supplier: "杭州纺织有限公司",
    status: "处理中",
    priority: "中",
    creator: "张琳",
    createdAt: "2025-03-22 14:20",
    expectedResolveDate: "2025-03-25",
    handler: "李明",
  },
  {
    id: "EX-2025-00056",
    orderId: "PO-2025-001045",
    requirementId: "PR-2025-000380",
    type: "质量问题",
    description: "到货样衣存在色差问题，需要退换",
    purchaseType: "测款采购",
    objectType: "样衣",
    supplier: "京东电商平台",
    status: "已处理",
    priority: "高",
    creator: "王芳",
    createdAt: "2025-03-21 10:15",
    expectedResolveDate: "2025-03-24",
    handler: "张琳",
    handledAt: "2025-03-23 16:30",
  },
  {
    id: "EX-2025-00055",
    orderId: "PO-2025-001042",
    requirementId: "PR-2025-000375",
    type: "供应商缺货",
    description: "供应商通知该面料已断货，需更换供应商或替代品",
    purchaseType: "备货采购",
    objectType: "面料",
    supplier: "绍兴印染厂",
    status: "处理中",
    priority: "高",
    creator: "采购系统",
    createdAt: "2025-03-20 09:00",
    expectedResolveDate: "2025-03-26",
    handler: "王芳",
  },
  {
    id: "EX-2025-00054",
    orderId: "PO-2025-001040",
    requirementId: "PR-2025-000370",
    type: "价格变更",
    description: "供应商调整价格，单价由45元/米上调至48元/米",
    purchaseType: "备货采购",
    objectType: "辅料",
    supplier: "广州辅料批发市场",
    status: "已关闭",
    priority: "低",
    creator: "李明",
    createdAt: "2025-03-19 15:45",
    expectedResolveDate: "2025-03-22",
    handler: "李明",
    handledAt: "2025-03-21 11:00",
  },
  {
    id: "EX-2025-00053",
    orderId: "PO-2025-001038",
    requirementId: "PR-2025-000368",
    type: "取消订单",
    description: "测款需求取消，需退回已付款项",
    purchaseType: "测款采购",
    objectType: "样衣",
    supplier: "淘宝电商平台",
    status: "已处理",
    priority: "中",
    creator: "张琳",
    createdAt: "2025-03-18 11:30",
    expectedResolveDate: "2025-03-20",
    handler: "张琳",
    handledAt: "2025-03-19 14:20",
  },
  {
    id: "EX-2025-00052",
    orderId: "PO-2025-001035",
    requirementId: "PR-2025-000365",
    type: "到货延期",
    description: "物流延误，预计延迟3天到货",
    purchaseType: "手工采购",
    objectType: "耗材",
    supplier: "1688批发平台",
    status: "已关闭",
    priority: "低",
    creator: "采购系统",
    createdAt: "2025-03-17 08:45",
    expectedResolveDate: "2025-03-20",
    handler: "王芳",
    handledAt: "2025-03-20 09:15",
  },
  {
    id: "EX-2025-00051",
    orderId: "PO-2025-001032",
    requirementId: "PR-2025-000360",
    type: "数量变更",
    description: "需求方追加采购数量，由200件增至280件",
    purchaseType: "测款采购",
    objectType: "样衣",
    supplier: "淘宝电商平台",
    status: "已处理",
    priority: "中",
    creator: "李明",
    createdAt: "2025-03-16 16:20",
    expectedResolveDate: "2025-03-18",
    handler: "李明",
    handledAt: "2025-03-17 10:30",
  },
]

const getStatusBadge = (status: ProcessStatus) => {
  switch (status) {
    case "未处理":
      return <Badge variant="destructive">{status}</Badge>
    case "处理中":
      return <Badge className="bg-amber-500 hover:bg-amber-600">{status}</Badge>
    case "已处理":
      return <Badge className="bg-green-600 hover:bg-green-700">{status}</Badge>
    case "已关闭":
      return <Badge variant="secondary">{status}</Badge>
  }
}

const getPriorityBadge = (priority: "高" | "中" | "低") => {
  switch (priority) {
    case "高":
      return (
        <Badge variant="destructive" className="text-xs">
          {priority}
        </Badge>
      )
    case "中":
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-xs">{priority}</Badge>
    case "低":
      return (
        <Badge variant="secondary" className="text-xs">
          {priority}
        </Badge>
      )
  }
}

const getTypeBadge = (type: ExceptionType) => {
  switch (type) {
    case "到货延期":
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-600">
          {type}
        </Badge>
      )
    case "数量变更":
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-600">
          {type}
        </Badge>
      )
    case "供应商缺货":
      return (
        <Badge variant="outline" className="border-red-500 text-red-600">
          {type}
        </Badge>
      )
    case "质量问题":
      return (
        <Badge variant="outline" className="border-purple-500 text-purple-600">
          {type}
        </Badge>
      )
    case "价格变更":
      return (
        <Badge variant="outline" className="border-green-500 text-green-600">
          {type}
        </Badge>
      )
    case "取消订单":
      return (
        <Badge variant="outline" className="border-gray-500 text-gray-600">
          {type}
        </Badge>
      )
  }
}

export default function OrderChangesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [exceptionType, setExceptionType] = useState<string>("all")
  const [processStatus, setProcessStatus] = useState<string>("all")
  const [purchaseType, setPurchaseType] = useState<string>("all")
  const [objectType, setObjectType] = useState<string>("all")
  const [priority, setPriority] = useState<string>("all")
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const filteredExceptions = exceptions.filter((ex) => {
    const matchesSearch =
      searchQuery === "" ||
      ex.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = exceptionType === "all" || ex.type === exceptionType
    const matchesStatus = processStatus === "all" || ex.status === processStatus
    const matchesPurchaseType = purchaseType === "all" || ex.purchaseType === purchaseType
    const matchesObjectType = objectType === "all" || ex.objectType === objectType
    const matchesPriority = priority === "all" || ex.priority === priority
    return matchesSearch && matchesType && matchesStatus && matchesPurchaseType && matchesObjectType && matchesPriority
  })

  const totalPages = Math.ceil(filteredExceptions.length / pageSize)
  const paginatedExceptions = filteredExceptions.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const resetFilters = () => {
    setSearchQuery("")
    setExceptionType("all")
    setProcessStatus("all")
    setPurchaseType("all")
    setObjectType("all")
    setPriority("all")
  }

  return (
    <div className="flex h-screen bg-background">
      <PmsSidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PmsSystemNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 页面标题 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">订单变更与异常</h1>
              <p className="text-sm text-muted-foreground mt-1">管理采购订单的变更记录和异常情况</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </div>
          </div>

          {/* 搜索和筛选区域 */}
          <div className="bg-card rounded-lg border p-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索异常编号、订单编号或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="default">查询</Button>
              <Button variant="outline" onClick={resetFilters}>
                重置筛选
              </Button>
              <Collapsible open={showAdvancedFilter} onOpenChange={setShowAdvancedFilter}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    高级筛选
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>

            <Collapsible open={showAdvancedFilter} onOpenChange={setShowAdvancedFilter}>
              <CollapsibleContent className="pt-4 border-t">
                <div className="grid grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">异常类型</label>
                    <Select value={exceptionType} onValueChange={setExceptionType}>
                      <SelectTrigger>
                        <SelectValue placeholder="全部类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部类型</SelectItem>
                        <SelectItem value="到货延期">到货延期</SelectItem>
                        <SelectItem value="数量变更">数量变更</SelectItem>
                        <SelectItem value="供应商缺货">供应商缺货</SelectItem>
                        <SelectItem value="质量问题">质量问题</SelectItem>
                        <SelectItem value="价格变更">价格变更</SelectItem>
                        <SelectItem value="取消订单">取消订单</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">处理状态</label>
                    <Select value={processStatus} onValueChange={setProcessStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="全部状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部状态</SelectItem>
                        <SelectItem value="未处理">未处理</SelectItem>
                        <SelectItem value="处理中">处理中</SelectItem>
                        <SelectItem value="已处理">已处理</SelectItem>
                        <SelectItem value="已关闭">已关闭</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">采购类型</label>
                    <Select value={purchaseType} onValueChange={setPurchaseType}>
                      <SelectTrigger>
                        <SelectValue placeholder="全部类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部类型</SelectItem>
                        <SelectItem value="测款采购">测款采购</SelectItem>
                        <SelectItem value="备货采购">备货采购</SelectItem>
                        <SelectItem value="手工采购">手工采购</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">采购对象</label>
                    <Select value={objectType} onValueChange={setObjectType}>
                      <SelectTrigger>
                        <SelectValue placeholder="全部对象" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部对象</SelectItem>
                        <SelectItem value="样衣">样衣</SelectItem>
                        <SelectItem value="面料">面料</SelectItem>
                        <SelectItem value="辅料">辅料</SelectItem>
                        <SelectItem value="纱线">纱线</SelectItem>
                        <SelectItem value="耗材">耗材</SelectItem>
                        <SelectItem value="设备">设备</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">优先级</label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue placeholder="全部优先级" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部优先级</SelectItem>
                        <SelectItem value="高">高</SelectItem>
                        <SelectItem value="中">中</SelectItem>
                        <SelectItem value="低">低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">未处理异常</p>
                  <p className="text-2xl font-bold text-red-600">
                    {exceptions.filter((e) => e.status === "未处理").length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">处理中</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {exceptions.filter((e) => e.status === "处理中").length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">已处理</p>
                  <p className="text-2xl font-bold text-green-600">
                    {exceptions.filter((e) => e.status === "已处理").length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">已关闭</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {exceptions.filter((e) => e.status === "已关闭").length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 数据表格 */}
          <div className="bg-card rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[140px]">异常编号</TableHead>
                    <TableHead className="w-[140px]">采购订单</TableHead>
                    <TableHead className="w-[100px]">异常类型</TableHead>
                    <TableHead className="min-w-[200px]">异常描述</TableHead>
                    <TableHead className="w-[90px]">采购类型</TableHead>
                    <TableHead className="w-[80px]">采购对象</TableHead>
                    <TableHead className="w-[120px]">供应商/平台</TableHead>
                    <TableHead className="w-[80px]">优先级</TableHead>
                    <TableHead className="w-[80px]">状态</TableHead>
                    <TableHead className="w-[100px]">预计解决</TableHead>
                    <TableHead className="w-[80px]">处理人</TableHead>
                    <TableHead className="w-[80px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedExceptions.map((ex) => (
                    <TableRow
                      key={ex.id}
                      className={
                        ex.status === "未处理"
                          ? "bg-red-50/50 hover:bg-red-50"
                          : ex.status === "处理中"
                            ? "bg-amber-50/50 hover:bg-amber-50"
                            : "hover:bg-muted/50"
                      }
                    >
                      <TableCell>
                        <Link
                          href={`/pms/orders/changes/${ex.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {ex.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/pms/orders/${ex.orderId}`}
                          className="text-sm text-muted-foreground hover:text-primary hover:underline"
                        >
                          {ex.orderId}
                        </Link>
                      </TableCell>
                      <TableCell>{getTypeBadge(ex.type)}</TableCell>
                      <TableCell>
                        <span className="text-sm line-clamp-2">{ex.description}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ex.purchaseType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{ex.objectType}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{ex.supplier}</span>
                      </TableCell>
                      <TableCell>{getPriorityBadge(ex.priority)}</TableCell>
                      <TableCell>{getStatusBadge(ex.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm">{ex.expectedResolveDate}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{ex.handler || "-"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/pms/orders/changes/${ex.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                查看详情
                              </Link>
                            </DropdownMenuItem>
                            {ex.status === "未处理" && (
                              <DropdownMenuItem>
                                <Clock className="h-4 w-4 mr-2" />
                                标记处理中
                              </DropdownMenuItem>
                            )}
                            {(ex.status === "未处理" || ex.status === "处理中") && (
                              <DropdownMenuItem>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                标记已处理
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 分页 */}
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">共 {filteredExceptions.length} 条记录</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">每页 10 条</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-transparent"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-transparent"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground ml-2">
                  前往
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = Number.parseInt(e.target.value)
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page)
                      }
                    }}
                    className="w-12 h-8 mx-1 text-center inline-block"
                  />
                  页
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
