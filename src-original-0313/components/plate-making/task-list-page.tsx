'use client'

import { useState } from 'react'
import {
  Search,
  RotateCcw,
  Plus,
  MoreHorizontal,
  Download,
  UserPlus,
  Clock,
  XCircle,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { plateMakingTasks } from '@/lib/mock-data'
import { CreateTaskDrawer } from './create-task-drawer'

const statusTabs = [
  { value: 'all', label: '全部', count: 128 },
  { value: 'mine', label: '我的', count: 24 },
  { value: 'pending-review', label: '待评审', count: 8 },
  { value: 'in-progress', label: '进行中', count: 45 },
  { value: 'completed', label: '已完成', count: 51 },
]

const statusColorMap: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: 'bg-green-100', text: 'text-green-700' },
  'in-progress': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'pending-review': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  blocked: { bg: 'bg-red-100', text: 'text-red-700' },
  completed: { bg: 'bg-gray-100', text: 'text-gray-700' },
}

export function TaskListPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('all')
  
  const toggleRow = (id: string) => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }
  
  const tasks = plateMakingTasks || []
  
  const toggleAll = () => {
    if (selectedRows.length === tasks.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(tasks.map(t => t.id))
    }
  }
  
  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">制版任务</h1>
          <p className="text-sm text-muted-foreground mt-1">管理和跟踪所有制版任务的进度</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setDrawerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新建任务
        </Button>
      </div>
      
      {/* 筛选区 */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          {/* 搜索框 */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索任务编号/样衣/商品项目/SPU/样衣编号等"
                className="pl-9"
              />
            </div>
          </div>
          
          {/* 筛选条件 */}
          <div className="flex flex-wrap gap-3">
            <Select>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="confirmed">已确认</SelectItem>
                <SelectItem value="in-progress">进行中</SelectItem>
                <SelectItem value="pending-review">待评审</SelectItem>
                <SelectItem value="blocked">暂不能继续</SelectItem>
              </SelectContent>
            </Select>
            
            <Select>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="负责人" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="zhangsan">张三</SelectItem>
                <SelectItem value="lisi">李四</SelectItem>
                <SelectItem value="wangwu">王五</SelectItem>
              </SelectContent>
            </Select>
            
            <Select>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="spu">SPU需求</SelectItem>
                <SelectItem value="revision">改版需求</SelectItem>
                <SelectItem value="original">原创设计</SelectItem>
              </SelectContent>
            </Select>
            
            <Select>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="原版" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="v001">版型-001</SelectItem>
                <SelectItem value="v002">版型-002</SelectItem>
                <SelectItem value="v003">版型-003</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Search className="h-4 w-4 mr-2" />
              查询
            </Button>
            <Button variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              重置筛选
            </Button>
          </div>
        </div>
      </div>
      
      {/* 状态 Tabs + 批量操作 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto flex-wrap">
            {statusTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                {tab.label}
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {tab.count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                批量操作
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <UserPlus className="h-4 w-4 mr-2" />
                批量分派
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Clock className="h-4 w-4 mr-2" />
                批量截止
              </DropdownMenuItem>
              <DropdownMenuItem>
                <XCircle className="h-4 w-4 mr-2" />
                批量撤销
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
        </div>
      </div>
      
      {/* 表格 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={tasks.length > 0 && selectedRows.length === tasks.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>任务</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="hidden md:table-cell">关联商品项目</TableHead>
              <TableHead className="hidden lg:table-cell">来源</TableHead>
              <TableHead className="hidden lg:table-cell">目标尺码段</TableHead>
              <TableHead className="hidden md:table-cell">负责人</TableHead>
              <TableHead className="hidden xl:table-cell">截止时间</TableHead>
              <TableHead className="hidden xl:table-cell">最近更新</TableHead>
              <TableHead className="w-12">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const statusColor = statusColorMap[task.status] || statusColorMap.confirmed
              return (
                <TableRow key={task.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.includes(task.id)}
                      onCheckedChange={() => toggleRow(task.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs text-muted-foreground">{task.id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(statusColor.bg, statusColor.text, 'border-0')}
                    >
                      {task.statusText}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="max-w-48 truncate text-sm">{task.project}</div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{task.source}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{task.targetSize}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{task.owner}</TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {task.deadline}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {task.updatedAt}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>查看详情</DropdownMenuItem>
                        <DropdownMenuItem>编辑任务</DropdownMenuItem>
                        <DropdownMenuItem>分派负责人</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">删除任务</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      
      {/* 分页信息 */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          已选择 {selectedRows.length} 项，共 {tasks.length} 条记录
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            上一页
          </Button>
          <span>第 1 / 1 页</span>
          <Button variant="outline" size="sm" disabled>
            下一页
          </Button>
        </div>
      </div>
      
      {/* 新建任务抽屉 */}
      <CreateTaskDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  )
}
