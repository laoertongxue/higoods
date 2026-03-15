"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { SystemNav } from "@/components/system-nav"
import { SidebarNav } from "@/components/sidebar-nav"
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
  MoreVertical,
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react"

// 模拟打样任务数据
const samplingTasks = [
  {
    id: "ST-001",
    projectId: "PRJ-20251220-001",
    projectName: "印尼风格碎花连衣裙",
    samplingType: "新版打样",
    triggerWorkItem: "外采样品采购",
    referenceSample: "SPL-001",
    patternMethod: "新版",
    responsibleTeam: "深圳打样组",
    owner: "李版师",
    plannedFinishDate: "2025-12-25",
    status: "进行中",
    outputSampleCount: 1,
    createdAt: "2025-12-20",
  },
  {
    id: "ST-002",
    projectId: "PRJ-20251220-002",
    projectName: "基础白色T恤",
    samplingType: "调整打样",
    triggerWorkItem: "制版准备",
    referenceSample: "SPL-002",
    patternMethod: "调整",
    responsibleTeam: "深圳打样组",
    owner: "王版师",
    plannedFinishDate: "2025-12-26",
    status: "待开始",
    outputSampleCount: 0,
    createdAt: "2025-12-19",
  },
  {
    id: "ST-003",
    projectId: "PRJ-20251220-003",
    projectName: "夏季牛仔短裤",
    samplingType: "复制打样",
    triggerWorkItem: "首单样衣打样",
    referenceSample: "SPL-003",
    patternMethod: "复制",
    responsibleTeam: "印尼打样组",
    owner: "张版师",
    plannedFinishDate: "2025-12-24",
    status: "已完成",
    outputSampleCount: 2,
    createdAt: "2025-12-18",
  },
  {
    id: "ST-004",
    projectId: "PRJ-20251220-004",
    projectName: "复古皮夹克",
    samplingType: "新版打样",
    triggerWorkItem: "外采样品采购",
    referenceSample: null,
    patternMethod: "新版",
    responsibleTeam: "深圳打样组",
    owner: "陈版师",
    plannedFinishDate: "2025-12-28",
    status: "已取消",
    outputSampleCount: 0,
    createdAt: "2025-12-17",
  },
]

export default function SamplingTasksPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [filters, setFilters] = useState({
    team: "all",
    samplingType: "all",
    status: "all",
    patternMethod: "all",
  })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const filteredTasks = useMemo(() => {
    return samplingTasks.filter((task) => {
      const matchesSearch =
        searchTerm === "" ||
        task.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.projectName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesTeam = filters.team === "all" || task.responsibleTeam === filters.team
      const matchesSamplingType = filters.samplingType === "all" || task.samplingType === filters.samplingType
      const matchesStatus = filters.status === "all" || task.status === filters.status
      const matchesPatternMethod = filters.patternMethod === "all" || task.patternMethod === filters.patternMethod
      return matchesSearch && matchesTeam && matchesSamplingType && matchesStatus && matchesPatternMethod
    })
  }, [searchTerm, filters])

  const totalPages = Math.ceil(filteredTasks.length / pageSize)
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      待开始: "bg-gray-500/20 text-gray-400",
      进行中: "bg-blue-500/20 text-blue-400",
      已完成: "bg-green-500/20 text-green-400",
      已取消: "bg-red-500/20 text-red-400",
    }
    return colors[status] || "bg-gray-500/20 text-gray-400"
  }

  const resetFilters = () => {
    setFilters({ team: "all", samplingType: "all", status: "all", patternMethod: "all" })
    setSearchTerm("")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SystemNav />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">打样任务列表</h1>
              <p className="text-muted-foreground text-sm mt-1">管理所有打样任务，跟踪打样进度</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
            </div>
          </div>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  查询条件
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    重置
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}>
                    <Filter className="h-4 w-4 mr-1" />
                    高级筛选
                    {showAdvancedFilter ? (
                      <ChevronUp className="h-4 w-4 ml-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-1" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索任务编号、项目名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {showAdvancedFilter && (
                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-border">
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">执行团队</label>
                    <Select value={filters.team} onValueChange={(v) => setFilters({ ...filters, team: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="深圳打样组">深圳打样组</SelectItem>
                        <SelectItem value="印尼打样组">印尼打样组</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">打样类型</label>
                    <Select
                      value={filters.samplingType}
                      onValueChange={(v) => setFilters({ ...filters, samplingType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="新版打样">新版打样</SelectItem>
                        <SelectItem value="调整打样">调整打样</SelectItem>
                        <SelectItem value="复制打样">复制打样</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">任务状态</label>
                    <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="待开始">待开始</SelectItem>
                        <SelectItem value="进行中">进行中</SelectItem>
                        <SelectItem value="已完成">已完成</SelectItem>
                        <SelectItem value="已取消">已取消</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">制版方式</label>
                    <Select
                      value={filters.patternMethod}
                      onValueChange={(v) => setFilters({ ...filters, patternMethod: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="新版">新版</SelectItem>
                        <SelectItem value="调整">调整</SelectItem>
                        <SelectItem value="复制">复制</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  数据列表
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    共 {filteredTasks.length} 条记录
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">任务编号</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">所属项目</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">打样类型</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">触发工作项</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">参考样衣</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">制版方式</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">执行团队</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">负责人</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">计划完成</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">状态</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">产出样衣</th>
                      <th className="p-3 text-left text-sm font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTasks.map((task) => (
                      <tr key={task.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                        <td className="p-3">
                          <Link
                            href={`/sampling-tasks/${task.id}`}
                            className="text-primary font-medium hover:underline"
                          >
                            {task.id}
                          </Link>
                        </td>
                        <td className="p-3">
                          <Link href={`/projects/${task.projectId}`} className="text-primary hover:underline">
                            {task.projectName}
                          </Link>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary">{task.samplingType}</Badge>
                        </td>
                        <td className="p-3 text-sm text-foreground">{task.triggerWorkItem}</td>
                        <td className="p-3">
                          {task.referenceSample ? (
                            <Link
                              href={`/samples/${task.referenceSample}`}
                              className="text-primary hover:underline text-sm"
                            >
                              {task.referenceSample}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{task.patternMethod}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{task.responsibleTeam}</Badge>
                        </td>
                        <td className="p-3 text-sm text-foreground">{task.owner}</td>
                        <td className="p-3 text-sm text-foreground">{task.plannedFinishDate}</td>
                        <td className="p-3">
                          <Badge className={`${getStatusColor(task.status)} border`}>{task.status}</Badge>
                        </td>
                        <td className="p-3 text-sm text-foreground">{task.outputSampleCount}</td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/sampling-tasks/${task.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  查看详情
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                导出记录
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between p-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  显示 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredTasks.length)}{" "}
                  条，共 {filteredTasks.length} 条
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-foreground px-2">
                    {currentPage} / {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
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
