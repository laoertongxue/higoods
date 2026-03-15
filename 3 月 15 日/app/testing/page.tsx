"use client"

import { useState } from "react"
import Link from "next/link"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Eye,
  Crown,
  Trash2,
  ExternalLink,
  Video,
  Radio,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  RefreshCw,
} from "lucide-react"

// 测款数据
const testingData = [
  {
    id: "TK-20251220-001",
    projectId: "PRJ-20251216-001",
    projectName: "印尼风格碎花连衣裙",
    projectStage: "测款阶段",
    workItemName: "直播测款",
    testingType: "live" as const,
    executionRole: "main" as const,
    channel: "抖音",
    broadcaster: "小美穿搭",
    testingTime: "2025-12-20 19:00",
    metrics: { viewers: 15600, clicks: 2340, conversion: "4.2%" },
    conclusion: "pass" as const,
    meetsCompletion: true,
    status: "completed" as const,
    affectsFlow: true,
    creator: "张丽",
    createTime: "2025-12-20 14:30",
  },
  {
    id: "TK-20251220-002",
    projectId: "PRJ-20251216-001",
    projectName: "印尼风格碎花连衣裙",
    projectStage: "测款阶段",
    workItemName: "直播测款",
    testingType: "live" as const,
    executionRole: "supplement" as const,
    channel: "淘宝直播",
    broadcaster: "时尚达人小王",
    testingTime: "2025-12-20 20:00",
    metrics: { viewers: 8900, clicks: 1120, conversion: "3.1%" },
    conclusion: "pending" as const,
    meetsCompletion: false,
    status: "completed" as const,
    affectsFlow: false,
    creator: "李明",
    createTime: "2025-12-20 15:00",
  },
  {
    id: "TK-20251219-001",
    projectId: "PRJ-20251216-002",
    projectName: "基础款白色T恤",
    projectStage: "测款阶段",
    workItemName: "短视频测款",
    testingType: "video" as const,
    executionRole: "main" as const,
    channel: "抖音",
    broadcaster: "穿搭日记",
    testingTime: "2025-12-19 10:00",
    metrics: { plays: 125000, completion: "45%", conversion: "2.8%" },
    conclusion: "pass" as const,
    meetsCompletion: true,
    status: "completed" as const,
    affectsFlow: true,
    creator: "王芳",
    createTime: "2025-12-19 09:00",
  },
  {
    id: "TK-20251219-002",
    projectId: "PRJ-20251216-003",
    projectName: "夏季牛仔短裤",
    projectStage: "测款阶段",
    workItemName: "直播测款",
    testingType: "live" as const,
    executionRole: "main" as const,
    channel: "小红书",
    broadcaster: "夏日穿搭",
    testingTime: "2025-12-19 19:30",
    metrics: { viewers: 5600, clicks: 890, conversion: "3.5%" },
    conclusion: "fail" as const,
    meetsCompletion: false,
    status: "completed" as const,
    affectsFlow: true,
    creator: "赵强",
    createTime: "2025-12-19 14:00",
  },
  {
    id: "TK-20251218-001",
    projectId: "PRJ-20251216-004",
    projectName: "复古皮夹克",
    projectStage: "测款阶段",
    workItemName: "短视频测款",
    testingType: "video" as const,
    executionRole: "retry" as const,
    channel: "抖音",
    broadcaster: "潮流先锋",
    testingTime: "2025-12-18 15:00",
    metrics: { plays: 89000, completion: "38%", conversion: "1.9%" },
    conclusion: "pending" as const,
    meetsCompletion: false,
    status: "in_progress" as const,
    affectsFlow: false,
    creator: "刘洋",
    createTime: "2025-12-18 10:00",
  },
  {
    id: "TK-20251217-001",
    projectId: "PRJ-20251216-005",
    projectName: "针织开衫外套",
    projectStage: "测款阶段",
    workItemName: "直播测款",
    testingType: "live" as const,
    executionRole: "experiment" as const,
    channel: "快手",
    broadcaster: "暖冬穿搭",
    testingTime: "2025-12-17 20:00",
    metrics: { viewers: 12300, clicks: 1560, conversion: "2.6%" },
    conclusion: "pending" as const,
    meetsCompletion: false,
    status: "not_started" as const,
    affectsFlow: false,
    creator: "陈静",
    createTime: "2025-12-17 16:00",
  },
]

export default function TestingManagementPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filters, setFilters] = useState({
    testingType: "all",
    executionRole: "all",
    status: "all",
    channel: "all",
    conclusion: "all",
    meetsCompletion: "all",
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [selectedTesting, setSelectedTesting] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const pageSize = 10

  // 筛选数据
  const filteredData = testingData.filter((item) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !item.id.toLowerCase().includes(query) &&
        !item.projectName.toLowerCase().includes(query) &&
        !item.broadcaster.toLowerCase().includes(query)
      ) {
        return false
      }
    }
    if (filters.testingType !== "all" && item.testingType !== filters.testingType) return false
    if (filters.executionRole !== "all" && item.executionRole !== filters.executionRole) return false
    if (filters.status !== "all" && item.status !== filters.status) return false
    if (filters.channel !== "all" && item.channel !== filters.channel) return false
    if (filters.conclusion !== "all" && item.conclusion !== filters.conclusion) return false
    if (filters.meetsCompletion !== "all") {
      const meets = filters.meetsCompletion === "yes"
      if (item.meetsCompletion !== meets) return false
    }
    return true
  })

  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const resetFilters = () => {
    setFilters({
      testingType: "all",
      executionRole: "all",
      status: "all",
      channel: "all",
      conclusion: "all",
      meetsCompletion: "all",
    })
    setSearchQuery("")
  }

  const getTestingTypeLabel = (type: string) => {
    return type === "live" ? "直播测款" : "短视频测款"
  }

  const getTestingTypeIcon = (type: string) => {
    return type === "live" ? <Radio className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />
  }

  const getExecutionRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      main: "主执行",
      supplement: "补充",
      retry: "返工",
      experiment: "试验",
    }
    return labels[role] || role
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_started: "未开始",
      in_progress: "进行中",
      completed: "已完成",
      voided: "已作废",
    }
    return labels[status] || status
  }

  const getStatusVariant = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      not_started: "secondary",
      in_progress: "default",
      completed: "outline",
      voided: "destructive",
    }
    return variants[status] || "default"
  }

  const getConclusionLabel = (conclusion: string) => {
    const labels: Record<string, string> = {
      pass: "通过",
      pending: "待定",
      fail: "不通过",
    }
    return labels[conclusion] || conclusion
  }

  const getConclusionColor = (conclusion: string) => {
    const colors: Record<string, string> = {
      pass: "text-green-600 bg-green-50",
      pending: "text-amber-600 bg-amber-50",
      fail: "text-red-600 bg-red-50",
    }
    return colors[conclusion] || "text-muted-foreground bg-muted"
  }

  const handleSetAsMain = (id: string) => {
    alert(`已将 ${id} 设为主执行实例`)
  }

  const handleVoidTesting = () => {
    if (selectedTesting && voidReason.trim()) {
      alert(`已作废测款 ${selectedTesting}，原因：${voidReason}`)
      setVoidDialogOpen(false)
      setSelectedTesting(null)
      setVoidReason("")
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 页面标题 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">测款管理</h1>
              <p className="text-sm text-muted-foreground mt-1">管理直播测款与短视频测款执行实例</p>
            </div>
            <Button>
              <PlayCircle className="w-4 h-4 mr-2" />
              新建测款
            </Button>
          </div>

          {/* 搜索和筛选 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  查询条件
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    重置
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
                    {showAdvancedFilters ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        收起
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        展开
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 基础筛选 */}
              <div className="grid grid-cols-4 gap-4">
                <div className="relative col-span-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索测款编号、项目名称、主播..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={filters.testingType}
                  onValueChange={(value) => setFilters({ ...filters, testingType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="测款类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="live">直播测款</SelectItem>
                    <SelectItem value="video">短视频测款</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="执行状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="not_started">未开始</SelectItem>
                    <SelectItem value="in_progress">进行中</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="voided">已作废</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 高级筛选 */}
              {showAdvancedFilters && (
                <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                  <Select
                    value={filters.executionRole}
                    onValueChange={(value) => setFilters({ ...filters, executionRole: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="执行角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部角色</SelectItem>
                      <SelectItem value="main">主执行</SelectItem>
                      <SelectItem value="supplement">补充</SelectItem>
                      <SelectItem value="retry">返工</SelectItem>
                      <SelectItem value="experiment">试验</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filters.channel} onValueChange={(value) => setFilters({ ...filters, channel: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="渠道/平台" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部渠道</SelectItem>
                      <SelectItem value="抖音">抖音</SelectItem>
                      <SelectItem value="淘宝直播">淘宝直播</SelectItem>
                      <SelectItem value="小红书">小红书</SelectItem>
                      <SelectItem value="快手">快手</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.conclusion}
                    onValueChange={(value) => setFilters({ ...filters, conclusion: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="测款结论" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部结论</SelectItem>
                      <SelectItem value="pass">通过</SelectItem>
                      <SelectItem value="pending">待定</SelectItem>
                      <SelectItem value="fail">不通过</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.meetsCompletion}
                    onValueChange={(value) => setFilters({ ...filters, meetsCompletion: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="满足完成条件" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="yes">是</SelectItem>
                      <SelectItem value="no">否</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 数据列表 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  测款列表
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    共 {filteredData.length} 条记录
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">测款编号</th>
                      <th className="text-left p-3 font-medium">商品项目</th>
                      <th className="text-left p-3 font-medium">工作项</th>
                      <th className="text-left p-3 font-medium">类型</th>
                      <th className="text-left p-3 font-medium">执行角色</th>
                      <th className="text-left p-3 font-medium">渠道/主播</th>
                      <th className="text-left p-3 font-medium">测款时间</th>
                      <th className="text-left p-3 font-medium">核心指标</th>
                      <th className="text-left p-3 font-medium">结论</th>
                      <th className="text-left p-3 font-medium">状态</th>
                      <th className="text-center p-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedData.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-muted/30 ${item.executionRole === "main" ? "bg-primary/5" : ""}`}
                      >
                        <td className="p-3">
                          <Link href={`/testing/${item.id}`} className="text-primary hover:underline font-medium">
                            {item.id}
                          </Link>
                        </td>
                        <td className="p-3">
                          <div>
                            <Link
                              href={`/projects/${item.projectId}`}
                              className="text-foreground hover:text-primary hover:underline"
                            >
                              {item.projectName}
                            </Link>
                            <div className="text-xs text-muted-foreground">{item.projectStage}</div>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{item.workItemName}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            {getTestingTypeIcon(item.testingType)}
                            <span>{getTestingTypeLabel(item.testingType)}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {item.executionRole === "main" && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                            <span className={item.executionRole === "main" ? "font-medium text-amber-600" : ""}>
                              {getExecutionRoleLabel(item.executionRole)}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{item.channel}</div>
                            <div className="text-xs text-muted-foreground">{item.broadcaster}</div>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{item.testingTime}</td>
                        <td className="p-3">
                          <div className="text-xs space-y-0.5">
                            {item.testingType === "live" ? (
                              <>
                                <div>观看: {item.metrics.viewers?.toLocaleString()}</div>
                                <div>点击: {item.metrics.clicks?.toLocaleString()}</div>
                                <div className="font-medium text-primary">转化: {item.metrics.conversion}</div>
                              </>
                            ) : (
                              <>
                                <div>播放: {item.metrics.plays?.toLocaleString()}</div>
                                <div>完播: {item.metrics.completion}</div>
                                <div className="font-medium text-primary">转化: {item.metrics.conversion}</div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getConclusionColor(item.conclusion)}`}
                          >
                            {getConclusionLabel(item.conclusion)}
                          </span>
                          {item.meetsCompletion && <div className="text-xs text-green-600 mt-0.5">满足完成条件</div>}
                        </td>
                        <td className="p-3">
                          <Badge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</Badge>
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/testing/${item.id}`}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  查看详情
                                </Link>
                              </DropdownMenuItem>
                              {item.executionRole !== "main" && (
                                <DropdownMenuItem onClick={() => handleSetAsMain(item.id)}>
                                  <Crown className="w-4 h-4 mr-2" />
                                  设为主执行实例
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href={`/projects/${item.projectId}`}>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  跳转商品项目
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedTesting(item.id)
                                  setVoidDialogOpen(true)
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                作废测款
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredData.length)}{" "}
                    条，共 {filteredData.length} 条
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
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
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* 作废对话框 */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>作废测款</DialogTitle>
            <DialogDescription>确定要作废测款 {selectedTesting} 吗？请填写作废原因。</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="请输入作废原因..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleVoidTesting} disabled={!voidReason.trim()}>
              确认作废
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
