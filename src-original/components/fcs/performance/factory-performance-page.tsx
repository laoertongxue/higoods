'use client'

import { useState, useMemo } from 'react'
import {
  indonesiaFactories,
  tierLabels,
  typeLabels,
  kpiTemplateLabels,
  type IndonesiaFactory,
  type KpiTemplate,
} from '@/lib/fcs/indonesia-factories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  MoreHorizontal,
  RefreshCw,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Target,
  AlertCircle,
  ArrowUpDown,
  AlertTriangle,
  FileText,
} from 'lucide-react'

// 权限类型
type UserRole = 'ADMIN' | 'OPS' | 'FINANCE' | 'VIEWER'
const currentUser = { role: 'ADMIN' as UserRole, name: 'Admin User' }
const canModify = ['ADMIN', 'OPS'].includes(currentUser.role)

// 绩效等级
type PerformanceLevel = 'A' | 'B' | 'C'

// 绩效数据类型
interface FactoryPerformance {
  factoryId: string
  factoryName: string
  factoryCode: string
  tier: IndonesiaFactory['tier']
  type: IndonesiaFactory['type']
  kpiTemplate: KpiTemplate
  status: string
  onTimeRate: number
  defectRate: number
  rejectRate: number
  disputeRate: number
  score: number
  level: PerformanceLevel
  updatedAt: string
}

// 历史记录类型
interface PerformanceRecord {
  id: string
  factoryId: string
  period: string // YYYY-MM
  onTimeRate: number
  defectRate: number
  rejectRate: number
  disputeRate: number
  score: number
  level: PerformanceLevel
  note?: string
  updatedAt: string
  updatedBy: string
}

// 变更日志类型
interface ChangeLog {
  id: string
  action: string
  factoryId: string
  factoryName: string
  period: string
  detail: string
  operator: string
  timestamp: string
}

// 计算绩效分数（固定公式）
function calculateScore(data: { onTimeRate: number; defectRate: number; rejectRate: number; disputeRate: number }): number {
  // 准时交付率 × 0.4 + (100 - 残次率) × 0.3 + (100 - 拒单率) × 0.2 + (100 - 争议率) × 0.1
  const score = data.onTimeRate * 0.4 + (100 - data.defectRate) * 0.3 + (100 - data.rejectRate) * 0.2 + (100 - data.disputeRate) * 0.1
  return Math.round(score * 10) / 10
}

// 计算绩效等级
function calculateLevel(score: number): PerformanceLevel {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  return 'C'
}

// 检查风险
function checkRisks(data: { onTimeRate: number; defectRate: number }): string[] {
  const risks: string[] = []
  if (data.onTimeRate < 90) risks.push('准时交付率低于90%')
  if (data.defectRate > 3) risks.push('残次率超过3%')
  return risks
}

// 从工厂数据生成绩效数据
const generatePerformanceData = (): FactoryPerformance[] => {
  return indonesiaFactories.map(f => {
    const score = f.performanceScore || calculateScore({
      onTimeRate: f.qualityScore,
      defectRate: 100 - f.deliveryScore,
      rejectRate: Math.random() * 5,
      disputeRate: Math.random() * 3,
    })
    return {
      factoryId: f.id,
      factoryName: f.name,
      factoryCode: f.code,
      tier: f.tier,
      type: f.type,
      kpiTemplate: f.kpiTemplate,
      status: f.status,
      onTimeRate: f.performanceScore ? 85 + Math.random() * 15 : f.qualityScore,
      defectRate: Math.round((100 - f.deliveryScore) * 0.1 * 10) / 10,
      rejectRate: Math.round(Math.random() * 5 * 10) / 10,
      disputeRate: Math.round(Math.random() * 3 * 10) / 10,
      score: f.performanceScore || Math.round(score * 10) / 10,
      level: f.performanceLevel || calculateLevel(score),
      updatedAt: f.updatedAt,
    }
  })
}

// 生成初始历史记录
const generateInitialRecords = (): Record<string, PerformanceRecord[]> => {
  const records: Record<string, PerformanceRecord[]> = {}
  indonesiaFactories.slice(0, 10).forEach(f => {
    const months = ['2024-12', '2024-11', '2024-10']
    records[f.id] = months.map((period, idx) => {
      const onTimeRate = 85 + Math.random() * 15
      const defectRate = Math.round(Math.random() * 5 * 10) / 10
      const rejectRate = Math.round(Math.random() * 5 * 10) / 10
      const disputeRate = Math.round(Math.random() * 3 * 10) / 10
      const score = calculateScore({ onTimeRate, defectRate, rejectRate, disputeRate })
      return {
        id: `pr-${f.id}-${period}`,
        factoryId: f.id,
        period,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        defectRate,
        rejectRate,
        disputeRate,
        score: Math.round(score * 10) / 10,
        level: calculateLevel(score),
        updatedAt: `2024-${12 - idx}-05 10:00:00`,
        updatedBy: idx === 0 ? 'Budi Admin' : 'System',
      }
    })
  })
  return records
}

// 生成当前月份
const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// 生成最近12个月选项
const getMonthOptions = () => {
  const options: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return options
}

const PAGE_SIZE = 10
type SortField = 'score' | 'onTimeRate' | 'defectRate'

export function FactoryPerformancePage() {
  // 数据状态
  const [performanceList, setPerformanceList] = useState<FactoryPerformance[]>(generatePerformanceData)
  const [recordsData, setRecordsData] = useState<Record<string, PerformanceRecord[]>>(generateInitialRecords)
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([])

  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  // 排序状态
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 弹窗状态
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [changeLogDialogOpen, setChangeLogDialogOpen] = useState(false)

  // 当前操作的工厂
  const [currentFactory, setCurrentFactory] = useState<FactoryPerformance | null>(null)

  // 表单数据
  const [formData, setFormData] = useState({
    factoryId: '',
    period: getCurrentMonth(),
    onTimeRate: 0,
    defectRate: 0,
    rejectRate: 0,
    disputeRate: 0,
    note: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // 筛选与排序后的数据
  const filteredList = useMemo(() => {
    let result = [...performanceList]

    if (keyword) {
      const kw = keyword.toLowerCase()
      result = result.filter(
        f => f.factoryName.toLowerCase().includes(kw) ||
             f.factoryCode.toLowerCase().includes(kw)
      )
    }

    // 排序
    result.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })

    return result
  }, [performanceList, keyword, sortField, sortOrder])

  // KPI 汇总
  const kpiSummary = useMemo(() => {
    if (filteredList.length === 0) {
      return { avgOnTimeRate: 0, avgDefectRate: 0, avgRejectRate: 0, avgDisputeRate: 0, avgScore: 0 }
    }
    const sum = filteredList.reduce(
      (acc, f) => ({
        onTimeRate: acc.onTimeRate + f.onTimeRate,
        defectRate: acc.defectRate + f.defectRate,
        rejectRate: acc.rejectRate + f.rejectRate,
        disputeRate: acc.disputeRate + f.disputeRate,
        score: acc.score + f.score,
      }),
      { onTimeRate: 0, defectRate: 0, rejectRate: 0, disputeRate: 0, score: 0 }
    )
    const count = filteredList.length
    return {
      avgOnTimeRate: Math.round((sum.onTimeRate / count) * 10) / 10,
      avgDefectRate: Math.round((sum.defectRate / count) * 10) / 10,
      avgRejectRate: Math.round((sum.rejectRate / count) * 10) / 10,
      avgDisputeRate: Math.round((sum.disputeRate / count) * 10) / 10,
      avgScore: Math.round((sum.score / count) * 10) / 10,
    }
  }, [filteredList])

  // 分页
  const totalPages = Math.ceil(filteredList.length / PAGE_SIZE)
  const paginatedList = filteredList.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  // 切换排序
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // 重置筛选
  const handleReset = () => {
    setKeyword('')
    setMonthFilter('all')
    setCurrentPage(1)
  }

  // 打开明细 Drawer
  const openDetailDrawer = (factory: FactoryPerformance) => {
    setCurrentFactory(factory)
    setDetailDrawerOpen(true)
  }

  // 打开录入 Drawer
  const openFormDrawer = (factory?: FactoryPerformance) => {
    if (factory) {
      setCurrentFactory(factory)
      setFormData({
        factoryId: factory.factoryId,
        period: getCurrentMonth(),
        onTimeRate: factory.onTimeRate,
        defectRate: factory.defectRate,
        rejectRate: factory.rejectRate,
        disputeRate: factory.disputeRate,
        note: '',
      })
    } else {
      setCurrentFactory(null)
      setFormData({
        factoryId: '',
        period: getCurrentMonth(),
        onTimeRate: 0,
        defectRate: 0,
        rejectRate: 0,
        disputeRate: 0,
        note: '',
      })
    }
    setFormErrors({})
    setFormDrawerOpen(true)
  }

  // 验证表单
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.factoryId) errors.factoryId = '请选择工厂'
    if (!formData.period) errors.period = '请选择周期'
    if (formData.onTimeRate < 0 || formData.onTimeRate > 100) errors.onTimeRate = '需在 0-100 之间'
    if (formData.defectRate < 0 || formData.defectRate > 100) errors.defectRate = '需在 0-100 之间'
    if (formData.rejectRate < 0 || formData.rejectRate > 100) errors.rejectRate = '需在 0-100 之间'
    if (formData.disputeRate < 0 || formData.disputeRate > 100) errors.disputeRate = '需在 0-100 之间'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // 提交表单
  const handleSubmit = () => {
    if (!validateForm()) return

    const now = new Date()
    const nowStr = now.toLocaleString('zh-CN')
    const dateStr = now.toISOString().split('T')[0]
    const score = calculateScore(formData)
    const level = calculateLevel(score)

    // 更新工厂绩效
    setPerformanceList(prev => prev.map(f =>
      f.factoryId === formData.factoryId
        ? { ...f, ...formData, score: Math.round(score * 10) / 10, level, updatedAt: dateStr }
        : f
    ))

    // 添加历史记录
    const newRecord: PerformanceRecord = {
      id: `pr-${Date.now()}`,
      factoryId: formData.factoryId,
      period: formData.period,
      onTimeRate: formData.onTimeRate,
      defectRate: formData.defectRate,
      rejectRate: formData.rejectRate,
      disputeRate: formData.disputeRate,
      score: Math.round(score * 10) / 10,
      level,
      note: formData.note,
      updatedAt: nowStr,
      updatedBy: currentUser.name,
    }
    setRecordsData(prev => ({
      ...prev,
      [formData.factoryId]: [newRecord, ...(prev[formData.factoryId] || [])],
    }))

    // 添加变更日志
    const factory = performanceList.find(f => f.factoryId === formData.factoryId)
    const log: ChangeLog = {
      id: `log-${Date.now()}`,
      action: 'PERFORMANCE_UPDATE',
      factoryId: formData.factoryId,
      factoryName: factory?.factoryName || '',
      period: formData.period,
      detail: `绩效录入/调整，总分 ${Math.round(score * 10) / 10}，等级 ${level}`,
      operator: currentUser.name,
      timestamp: nowStr,
    }
    setChangeLogs(prev => [log, ...prev])

    setFormDrawerOpen(false)
  }

  // 获取等级颜色
  const getLevelColor = (level: PerformanceLevel) => {
    if (level === 'A') return 'bg-green-100 text-green-700 border-green-200'
    if (level === 'B') return 'bg-blue-100 text-blue-700 border-blue-200'
    return 'bg-red-100 text-red-700 border-red-200'
  }

  // 获取分数颜色
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800'
    if (score >= 75) return 'bg-blue-100 text-blue-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">工厂绩效</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看与维护工厂绩效指标（仅支持月度周期 YYYY-MM）
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canModify && (
            <Button onClick={() => openFormDrawer()}>录入/调整绩效</Button>
          )}
          <Button variant="outline" onClick={() => setChangeLogDialogOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            变更日志
          </Button>
        </div>
      </div>

      {/* FilterBar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索工厂名称/编号..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="flex-1"
          />
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="月份" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部月份</SelectItem>
            {getMonthOptions().map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setCurrentPage(1)}>查询</Button>
          <Button variant="ghost" onClick={handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重置
          </Button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              平均准时交付率
            </div>
            <div className="text-2xl font-bold">{kpiSummary.avgOnTimeRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertCircle className="h-4 w-4 text-red-500" />
              平均残次率
            </div>
            <div className="text-2xl font-bold">{kpiSummary.avgDefectRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4 text-yellow-500" />
              平均拒单率
            </div>
            <div className="text-2xl font-bold">{kpiSummary.avgRejectRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              平均争议率
            </div>
            <div className="text-2xl font-bold">{kpiSummary.avgDisputeRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4 text-blue-500" />
              平均绩效总分
            </div>
            <div className="text-2xl font-bold">{kpiSummary.avgScore}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>工厂名称</TableHead>
              <TableHead>编号</TableHead>
              <TableHead>层级</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>KPI模板</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('onTimeRate')}>
                <div className="flex items-center gap-1">准时交付率 <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('defectRate')}>
                <div className="flex items-center gap-1">残次率 <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('score')}>
                <div className="flex items-center gap-1">总分 <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead>等级</TableHead>
              <TableHead>风险</TableHead>
              <TableHead className="w-[80px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedList.map((factory) => {
              const risks = checkRisks(factory)
              return (
                <TableRow key={factory.factoryId}>
                  <TableCell className="font-medium">{factory.factoryName}</TableCell>
                  <TableCell className="font-mono text-sm">{factory.factoryCode}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{tierLabels[factory.tier]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{typeLabels[factory.type]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{kpiTemplateLabels[factory.kpiTemplate]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={factory.onTimeRate} className="w-16 h-2" />
                      <span className={factory.onTimeRate < 90 ? 'text-red-600 font-medium' : ''}>{factory.onTimeRate.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={factory.defectRate > 3 ? 'text-red-600 font-medium' : ''}>{factory.defectRate}%</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getScoreColor(factory.score)}>{factory.score}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getLevelColor(factory.level)}>{factory.level}</Badge>
                  </TableCell>
                  <TableCell>
                    {risks.length > 0 ? (
                      <Badge variant="destructive" className="text-xs flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {risks.length}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDetailDrawer(factory)}>
                          <Eye className="mr-2 h-4 w-4" />
                          查看明细
                        </DropdownMenuItem>
                        {canModify && (
                          <DropdownMenuItem onClick={() => openFormDrawer(factory)}>
                            <Edit className="mr-2 h-4 w-4" />
                            录入/调整
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
            {paginatedList.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">共 {filteredList.length} 条记录</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{currentPage} / {totalPages || 1}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 明细 Drawer */}
      <Sheet open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>绩效明细</SheetTitle>
            <SheetDescription>
              {currentFactory?.factoryName} ({currentFactory?.factoryCode})
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            <div className="space-y-6 pr-4">
              {/* 工厂信息 */}
              <div className="space-y-2">
                <h3 className="font-medium">工厂信息</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">层级：</span>{currentFactory && tierLabels[currentFactory.tier]}</div>
                  <div><span className="text-muted-foreground">类型：</span>{currentFactory && typeLabels[currentFactory.type]}</div>
                  <div><span className="text-muted-foreground">KPI模板：</span>{currentFactory && kpiTemplateLabels[currentFactory.kpiTemplate]}</div>
                </div>
              </div>

              <Separator />

              {/* 当前指标 */}
              <div className="space-y-3">
                <h3 className="font-medium">当前绩效指标</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">准时交付率</div>
                    <div className={`text-xl font-semibold ${currentFactory && currentFactory.onTimeRate < 90 ? 'text-red-600' : ''}`}>
                      {currentFactory?.onTimeRate.toFixed(1)}%
                      {currentFactory && currentFactory.onTimeRate < 90 && <AlertTriangle className="inline h-4 w-4 ml-1 text-red-500" />}
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">残次率</div>
                    <div className={`text-xl font-semibold ${currentFactory && currentFactory.defectRate > 3 ? 'text-red-600' : ''}`}>
                      {currentFactory?.defectRate}%
                      {currentFactory && currentFactory.defectRate > 3 && <AlertTriangle className="inline h-4 w-4 ml-1 text-red-500" />}
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">拒单率</div>
                    <div className="text-xl font-semibold">{currentFactory?.rejectRate}%</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">争议率</div>
                    <div className="text-xl font-semibold">{currentFactory?.disputeRate}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">绩效总分</div>
                    <Badge className={currentFactory ? getScoreColor(currentFactory.score) : ''}>{currentFactory?.score}</Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">绩效等级</div>
                    <Badge className={currentFactory ? getLevelColor(currentFactory.level) : ''}>{currentFactory?.level}</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 风险提示 */}
              {currentFactory && checkRisks(currentFactory).length > 0 && (
                <>
                  <div className="space-y-2">
                    <h3 className="font-medium text-red-600 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      风险提示
                    </h3>
                    <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                      {checkRisks(currentFactory).map((risk, i) => (
                        <li key={i}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                  <Separator />
                </>
              )}

              {/* 历史记录 */}
              <div className="space-y-3">
                <h3 className="font-medium">绩效记录历史</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>周期</TableHead>
                      <TableHead>总分</TableHead>
                      <TableHead>等级</TableHead>
                      <TableHead>更新人</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(recordsData[currentFactory?.factoryId || ''] || []).slice(0, 10).map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{r.period}</TableCell>
                        <TableCell><Badge className={getScoreColor(r.score)}>{r.score}</Badge></TableCell>
                        <TableCell><Badge className={getLevelColor(r.level)}>{r.level}</Badge></TableCell>
                        <TableCell>{r.updatedBy}</TableCell>
                        <TableCell className="text-sm">{r.updatedAt}</TableCell>
                      </TableRow>
                    ))}
                    {(!recordsData[currentFactory?.factoryId || ''] || recordsData[currentFactory?.factoryId || ''].length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">暂无历史记录</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* 录入 Drawer */}
      <Sheet open={formDrawerOpen} onOpenChange={setFormDrawerOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>录入/调整绩效</SheetTitle>
            <SheetDescription>
              {currentFactory ? `${currentFactory.factoryName} (${currentFactory.factoryCode})` : '选择工厂后录入绩效数据'}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {!currentFactory && (
              <div className="space-y-2">
                <Label>选择工厂 <span className="text-red-500">*</span></Label>
                <Select value={formData.factoryId} onValueChange={v => setFormData(prev => ({ ...prev, factoryId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择工厂" />
                  </SelectTrigger>
                  <SelectContent>
                    {performanceList.map(f => (
                      <SelectItem key={f.factoryId} value={f.factoryId}>{f.factoryName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.factoryId && <p className="text-sm text-red-500">{formErrors.factoryId}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label>周期（月度）<span className="text-red-500">*</span></Label>
              <Select value={formData.period} onValueChange={v => setFormData(prev => ({ ...prev, period: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.period && <p className="text-sm text-red-500">{formErrors.period}</p>}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>准时交付率 (%) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={formData.onTimeRate}
                  onChange={e => setFormData(prev => ({ ...prev, onTimeRate: parseFloat(e.target.value) || 0 }))}
                />
                {formData.onTimeRate < 90 && <p className="text-xs text-yellow-600">低于90%将触发风险提示</p>}
                {formErrors.onTimeRate && <p className="text-sm text-red-500">{formErrors.onTimeRate}</p>}
              </div>
              <div className="space-y-2">
                <Label>残次率 (%) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={formData.defectRate}
                  onChange={e => setFormData(prev => ({ ...prev, defectRate: parseFloat(e.target.value) || 0 }))}
                />
                {formData.defectRate > 3 && <p className="text-xs text-yellow-600">超过3%将触发风险提示</p>}
                {formErrors.defectRate && <p className="text-sm text-red-500">{formErrors.defectRate}</p>}
              </div>
              <div className="space-y-2">
                <Label>拒单率 (%) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={formData.rejectRate}
                  onChange={e => setFormData(prev => ({ ...prev, rejectRate: parseFloat(e.target.value) || 0 }))}
                />
                {formErrors.rejectRate && <p className="text-sm text-red-500">{formErrors.rejectRate}</p>}
              </div>
              <div className="space-y-2">
                <Label>争议率 (%) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={formData.disputeRate}
                  onChange={e => setFormData(prev => ({ ...prev, disputeRate: parseFloat(e.target.value) || 0 }))}
                />
                {formErrors.disputeRate && <p className="text-sm text-red-500">{formErrors.disputeRate}</p>}
              </div>
            </div>

            {/* 预览计算结果 */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">预览计算结果</div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-muted-foreground">总分：</span>
                  <Badge className={getScoreColor(calculateScore(formData))}>{calculateScore(formData).toFixed(1)}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">等级：</span>
                  <Badge className={getLevelColor(calculateLevel(calculateScore(formData)))}>{calculateLevel(calculateScore(formData))}</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                公式：准时率×0.4 + (100-残次率)×0.3 + (100-拒单率)×0.2 + (100-争议率)×0.1
              </p>
            </div>

            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                placeholder="可选备注..."
                value={formData.note}
                onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setFormDrawerOpen(false)}>取消</Button>
              <Button onClick={handleSubmit}>确认提交</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 变更日志 Dialog */}
      <Dialog open={changeLogDialogOpen} onOpenChange={setChangeLogDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>变更日志</DialogTitle>
            <DialogDescription>所有绩效录入/调整操作的记录</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {changeLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>操作类型</TableHead>
                    <TableHead>工厂</TableHead>
                    <TableHead>周期</TableHead>
                    <TableHead>详情</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changeLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell><Badge variant="outline">绩效录入</Badge></TableCell>
                      <TableCell>{log.factoryName}</TableCell>
                      <TableCell>{log.period}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{log.detail}</TableCell>
                      <TableCell>{log.operator}</TableCell>
                      <TableCell className="text-sm">{log.timestamp}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">暂无变更日志</div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
