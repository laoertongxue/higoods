'use client'

import { useState, useMemo } from 'react'
import { useRouter } from '@/lib/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Plus, Search, Eye, Check, X } from 'lucide-react'
import type { FactorySettlementSummary, CycleType, SettlementStatus } from '@/lib/fcs/settlement-types'
import { cycleTypeConfig, pricingModeConfig, settlementStatusConfig } from '@/lib/fcs/settlement-types'
import { settlementSummaries as initialSummaries } from '@/lib/fcs/settlement-mock-data'

const PAGE_SIZE = 10

export function SettlementListPage() {
  const router = useRouter()
  
  // 数据状态
  const [summaries] = useState<FactorySettlementSummary[]>(initialSummaries)
  
  // 筛选状态
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterCycleType, setFilterCycleType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)

  // 筛选后的数据
  const filteredSummaries = useMemo(() => {
    let result = [...summaries]

    // 关键词搜索
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      result = result.filter(s => 
        s.factoryName.toLowerCase().includes(keyword) ||
        s.factoryId.toLowerCase().includes(keyword)
      )
    }

    // 结算周期筛选
    if (filterCycleType && filterCycleType !== 'all') {
      result = result.filter(s => s.cycleType === filterCycleType)
    }

    // 状态筛选
    if (filterStatus && filterStatus !== 'all') {
      result = result.filter(s => s.status === filterStatus)
    }

    return result
  }, [summaries, searchKeyword, filterCycleType, filterStatus])

  // 分页数据
  const paginatedSummaries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredSummaries.slice(start, start + PAGE_SIZE)
  }, [filteredSummaries, currentPage])

  const totalPages = Math.ceil(filteredSummaries.length / PAGE_SIZE)

  // 重置筛选
  const handleReset = () => {
    setSearchKeyword('')
    setFilterCycleType('all')
    setFilterStatus('all')
    setCurrentPage(1)
  }

  // 查看详情
  const handleViewDetail = (factoryId: string) => {
    router.push(`/fcs/factories/settlement/${factoryId}`)
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">结算信息</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理工厂结算配置、收款账户和扣款规则
          </p>
        </div>
        <Button onClick={() => router.push('/fcs/factories/settlement/new')}>
          <Plus className="mr-2 h-4 w-4" />
          新增结算配置
        </Button>
      </div>

      {/* 筛选区域 */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">工厂名称/编码</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索工厂名称或编码"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">结算周期</Label>
            <Select value={filterCycleType} onValueChange={setFilterCycleType}>
              <SelectTrigger>
                <SelectValue placeholder="全部周期" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部周期</SelectItem>
                {(Object.keys(cycleTypeConfig) as CycleType[]).map(key => (
                  <SelectItem key={key} value={key}>{cycleTypeConfig[key].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">状态</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {(Object.keys(settlementStatusConfig) as SettlementStatus[]).map(key => (
                  <SelectItem key={key} value={key}>{settlementStatusConfig[key].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground invisible">操作</Label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                重置
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>工厂名称</TableHead>
              <TableHead>结算周期</TableHead>
              <TableHead>计价方式</TableHead>
              <TableHead>默认币种</TableHead>
              <TableHead>默认收款账户</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最近更新</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSummaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              paginatedSummaries.map((summary) => {
                const statusConfig = settlementStatusConfig[summary.status]
                return (
                  <TableRow key={summary.factoryId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{summary.factoryName}</div>
                        <div className="text-xs text-muted-foreground">{summary.factoryId}</div>
                      </div>
                    </TableCell>
                    <TableCell>{cycleTypeConfig[summary.cycleType].label}</TableCell>
                    <TableCell>{pricingModeConfig[summary.pricingMode].label}</TableCell>
                    <TableCell>{summary.currency}</TableCell>
                    <TableCell>
                      {summary.hasDefaultAccount ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Check className="mr-1 h-3 w-3" />
                          已配置
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <X className="mr-1 h-3 w-3" />
                          未配置
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{summary.updatedAt}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewDetail(summary.factoryId)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {filteredSummaries.length} 条记录
        </p>
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  )
}
