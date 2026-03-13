'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  indonesiaFactories,
  tierLabels,
  typeLabels,
  type IndonesiaFactory,
  type FactoryTier,
} from '@/lib/fcs/indonesia-factories'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  MoreHorizontal,
  History,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Edit,
} from 'lucide-react'

// 权限类型
type UserRole = 'ADMIN' | 'OPS' | 'FINANCE' | 'VIEWER'
const currentUser = { role: 'ADMIN' as UserRole, name: 'Admin User' }
const canModify = ['ADMIN', 'OPS'].includes(currentUser.role)

// 状态类型
type FactoryStatusType = 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED' | 'INACTIVE'

const statusConfig: Record<FactoryStatusType, { label: string; color: string }> = {
  ACTIVE: { label: '在合作', color: 'bg-green-100 text-green-700 border-green-200' },
  SUSPENDED: { label: '暂停', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  BLACKLISTED: { label: '黑名单', color: 'bg-red-100 text-red-700 border-red-200' },
  INACTIVE: { label: '未激活', color: 'bg-gray-100 text-gray-700 border-gray-200' },
}

// 历史记录类型
interface StatusHistory {
  id: string
  factoryId: string
  oldStatus: FactoryStatusType
  newStatus: FactoryStatusType
  reason: string
  changedBy: string
  changedAt: string
}

// 变更日志类型
interface ChangeLog {
  id: string
  action: string
  targetIds: string[]
  targetNames: string[]
  oldValue?: string
  newValue: string
  reason: string
  operator: string
  timestamp: string
}

// Mock 初始历史记录
const initialHistoryData: StatusHistory[] = [
  { id: 'h1', factoryId: 'ID-F003', oldStatus: 'ACTIVE', newStatus: 'SUSPENDED', reason: 'Kapasitas produksi tidak mencukupi', changedBy: 'Budi Admin', changedAt: '2024-10-20 14:30:00' },
  { id: 'h2', factoryId: 'ID-F023', oldStatus: 'SUSPENDED', newStatus: 'BLACKLISTED', reason: 'Kualitas gagal 3x berturut-turut', changedBy: 'Siti OPS', changedAt: '2024-09-01 10:15:00' },
  { id: 'h3', factoryId: 'ID-F008', oldStatus: 'ACTIVE', newStatus: 'SUSPENDED', reason: 'Upgrade peralatan', changedBy: 'Ahmad Admin', changedAt: '2024-10-15 09:00:00' },
  { id: 'h4', factoryId: 'ID-F016', oldStatus: 'ACTIVE', newStatus: 'SUSPENDED', reason: 'Masalah kualitas', changedBy: 'Dewi OPS', changedAt: '2024-10-10 11:00:00' },
  { id: 'h5', factoryId: 'ID-F026', oldStatus: 'ACTIVE', newStatus: 'SUSPENDED', reason: 'Pemeliharaan peralatan', changedBy: 'Rudi Admin', changedAt: '2024-10-15 08:30:00' },
]

const PAGE_SIZE = 10

export function FactoryStatusPage() {
  // 数据状态
  const [factories, setFactories] = useState<IndonesiaFactory[]>(indonesiaFactories)
  const [historyRecords, setHistoryRecords] = useState<StatusHistory[]>(initialHistoryData)
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([])

  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  // 选中状态
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // 弹窗状态
  const [changeDialogOpen, setChangeDialogOpen] = useState(false)
  const [batchChangeDialogOpen, setBatchChangeDialogOpen] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [changeLogDialogOpen, setChangeLogDialogOpen] = useState(false)
  const [pendingBatchConfirm, setPendingBatchConfirm] = useState(false)

  // 变更表单
  const [targetFactory, setTargetFactory] = useState<IndonesiaFactory | null>(null)
  const [newStatus, setNewStatus] = useState<FactoryStatusType>('ACTIVE')
  const [changeReason, setChangeReason] = useState('')
  const [changeNote, setChangeNote] = useState('')
  const [reasonError, setReasonError] = useState('')

  // 历史查看
  const [viewingFactoryId, setViewingFactoryId] = useState<string>('')

  // 筛选后的工厂列表
  const filteredFactories = useMemo(() => {
    let result = factories.filter(f => {
      const matchKeyword = !keyword ||
        f.name.toLowerCase().includes(keyword.toLowerCase()) ||
        f.code.toLowerCase().includes(keyword.toLowerCase()) ||
        f.contactName.toLowerCase().includes(keyword.toLowerCase()) ||
        f.city.toLowerCase().includes(keyword.toLowerCase())
      const matchStatus = statusFilter === 'all' || f.status === statusFilter
      const matchTier = tierFilter === 'all' || f.tier === tierFilter
      return matchKeyword && matchStatus && matchTier
    })
    // 按 code 排序确保一致性
    result.sort((a, b) => a.code.localeCompare(b.code))
    return result
  }, [factories, keyword, statusFilter, tierFilter])

  // 分页
  const totalPages = Math.ceil(filteredFactories.length / PAGE_SIZE)
  const paginatedList = filteredFactories.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  // 全选/取消全选
  const allSelected = paginatedList.length > 0 && paginatedList.every(f => selectedIds.includes(f.id))
  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(paginatedList.map(f => f.id))
    }
  }, [allSelected, paginatedList])

  // 单选
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }, [])

  // 重置筛选
  const handleReset = () => {
    setKeyword('')
    setStatusFilter('all')
    setTierFilter('all')
    setCurrentPage(1)
    setSelectedIds([])
  }

  // 打开单个变更弹窗
  const openSingleChange = (factory: IndonesiaFactory) => {
    setTargetFactory(factory)
    setNewStatus(factory.status as FactoryStatusType)
    setChangeReason('')
    setChangeNote('')
    setReasonError('')
    setChangeDialogOpen(true)
  }

  // 打开批量变更弹窗
  const openBatchChange = () => {
    if (selectedIds.length === 0) return
    setTargetFactory(null)
    setNewStatus('ACTIVE')
    setChangeReason('')
    setChangeNote('')
    setReasonError('')
    setBatchChangeDialogOpen(true)
  }

  // 验证表单
  const validateForm = (): boolean => {
    if (!changeReason.trim()) {
      setReasonError('变更原因为必填项')
      return false
    }
    if ((newStatus === 'BLACKLISTED' || newStatus === 'SUSPENDED') && changeReason.trim().length < 5) {
      setReasonError('黑名单/暂停状态需要详细说明原因（至少5个字）')
      return false
    }
    setReasonError('')
    return true
  }

  // 提交单个变更
  const handleSingleSubmit = () => {
    if (!validateForm()) return
    if (newStatus === 'BLACKLISTED' || newStatus === 'SUSPENDED') {
      setPendingBatchConfirm(false)
      setChangeDialogOpen(false)
      setConfirmDialogOpen(true)
    } else {
      executeSingleChange()
    }
  }

  // 提交批量变更
  const handleBatchSubmit = () => {
    if (!validateForm()) return
    if (newStatus === 'BLACKLISTED' || newStatus === 'SUSPENDED') {
      setPendingBatchConfirm(true)
      setBatchChangeDialogOpen(false)
      setConfirmDialogOpen(true)
    } else {
      executeBatchChange()
    }
  }

  // 获取当前时间
  const getNow = () => {
    const now = new Date()
    return {
      date: now.toISOString().split('T')[0],
      full: now.toLocaleString('zh-CN'),
    }
  }

  // 执行单个变更
  const executeSingleChange = () => {
    if (!targetFactory) return
    const { date, full } = getNow()

    // 更新工厂状态
    setFactories(prev => prev.map(f =>
      f.id === targetFactory.id
        ? { ...f, status: newStatus, updatedAt: date }
        : f
    ))

    // 添加历史记录
    const history: StatusHistory = {
      id: `h${Date.now()}`,
      factoryId: targetFactory.id,
      oldStatus: targetFactory.status as FactoryStatusType,
      newStatus,
      reason: changeReason,
      changedBy: currentUser.name,
      changedAt: full,
    }
    setHistoryRecords(prev => [history, ...prev])

    // 添加变更日志
    const log: ChangeLog = {
      id: `log${Date.now()}`,
      action: 'STATUS_CHANGE',
      targetIds: [targetFactory.id],
      targetNames: [targetFactory.name],
      oldValue: statusConfig[targetFactory.status as FactoryStatusType].label,
      newValue: statusConfig[newStatus].label,
      reason: changeReason,
      operator: currentUser.name,
      timestamp: full,
    }
    setChangeLogs(prev => [log, ...prev])

    setChangeDialogOpen(false)
    setConfirmDialogOpen(false)
  }

  // 执行批量变更
  const executeBatchChange = () => {
    const { date, full } = getNow()
    const targetFactories = factories.filter(f => selectedIds.includes(f.id))

    // 更新工厂状态
    setFactories(prev => prev.map(f =>
      selectedIds.includes(f.id)
        ? { ...f, status: newStatus, updatedAt: date }
        : f
    ))

    // 添加历史记录
    targetFactories.forEach(factory => {
      const history: StatusHistory = {
        id: `h${Date.now()}_${factory.id}`,
        factoryId: factory.id,
        oldStatus: factory.status as FactoryStatusType,
        newStatus,
        reason: changeReason,
        changedBy: currentUser.name,
        changedAt: full,
      }
      setHistoryRecords(prev => [history, ...prev])
    })

    // 添加变更日志
    const log: ChangeLog = {
      id: `log${Date.now()}`,
      action: 'BATCH_STATUS_CHANGE',
      targetIds: selectedIds,
      targetNames: targetFactories.map(f => f.name),
      newValue: statusConfig[newStatus].label,
      reason: changeReason,
      operator: currentUser.name,
      timestamp: full,
    }
    setChangeLogs(prev => [log, ...prev])

    setBatchChangeDialogOpen(false)
    setConfirmDialogOpen(false)
    setSelectedIds([])
  }

  // 确认执行
  const handleConfirmExecute = () => {
    if (pendingBatchConfirm) {
      executeBatchChange()
    } else {
      executeSingleChange()
    }
  }

  // 查看历史
  const openHistory = (factoryId: string) => {
    setViewingFactoryId(factoryId)
    setHistoryDialogOpen(true)
  }

  // 获取工厂的历史记录
  const factoryHistory = useMemo(() => {
    return historyRecords.filter(h => h.factoryId === viewingFactoryId)
  }, [historyRecords, viewingFactoryId])

  const viewingFactory = factories.find(f => f.id === viewingFactoryId)

  // 获取工厂最后一条历史记录的原因
  const getLastReason = (factoryId: string) => {
    const history = historyRecords.find(h => h.factoryId === factoryId)
    return history?.reason || '-'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">工厂状态</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理工厂合作状态，控制派单资格（变更立即生效）
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canModify && (
            <Button onClick={openBatchChange} disabled={selectedIds.length === 0}>
              批量变更状态 {selectedIds.length > 0 && `(${selectedIds.length})`}
            </Button>
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
            placeholder="搜索工厂名称/编号/联系人/城市..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="flex-1"
          />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="层级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部层级</SelectItem>
            <SelectItem value="CENTRAL">中央工厂</SelectItem>
            <SelectItem value="SATELLITE">卫星工厂</SelectItem>
            <SelectItem value="THIRD_PARTY">第三方</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="ACTIVE">在合作</SelectItem>
            <SelectItem value="SUSPENDED">暂停</SelectItem>
            <SelectItem value="BLACKLISTED">黑名单</SelectItem>
            <SelectItem value="INACTIVE">未激活</SelectItem>
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

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {canModify && (
                <TableHead className="w-12">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
              )}
              <TableHead>工厂名称</TableHead>
              <TableHead>编号</TableHead>
              <TableHead>层级</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>当前状态</TableHead>
              <TableHead>状态原因</TableHead>
              <TableHead>生效时间</TableHead>
              <TableHead>最近更新</TableHead>
              <TableHead className="w-[80px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedList.map((factory) => (
              <TableRow key={factory.id}>
                {canModify && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(factory.id)}
                      onCheckedChange={() => toggleSelect(factory.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">{factory.name}</TableCell>
                <TableCell className="font-mono text-sm">{factory.code}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {tierLabels[factory.tier]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {typeLabels[factory.type]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={statusConfig[factory.status as FactoryStatusType].color}>
                    {statusConfig[factory.status as FactoryStatusType].label}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                  {getLastReason(factory.id)}
                </TableCell>
                <TableCell className="text-sm">{factory.createdAt}</TableCell>
                <TableCell className="text-sm">{factory.updatedAt}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canModify && (
                        <DropdownMenuItem onClick={() => openSingleChange(factory)}>
                          <Edit className="mr-2 h-4 w-4" />
                          变更状态
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openHistory(factory.id)}>
                        <History className="mr-2 h-4 w-4" />
                        查看历史
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {paginatedList.length === 0 && (
              <TableRow>
                <TableCell colSpan={canModify ? 10 : 9} className="h-24 text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {canModify && selectedIds.length > 0 && `已选择 ${selectedIds.length} 项，`}
          共 {filteredFactories.length} 条记录
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{currentPage} / {totalPages || 1}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 单个变更状态弹窗 */}
      <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>变更工厂状态</DialogTitle>
            <DialogDescription>
              修改工厂的合作状态，黑名单/暂停状态将影响派单资格
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>工厂</Label>
              <Input value={targetFactory?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>当前状态</Label>
              <Badge className={targetFactory ? statusConfig[targetFactory.status as FactoryStatusType].color : ''}>
                {targetFactory ? statusConfig[targetFactory.status as FactoryStatusType].label : '-'}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>新状态 <span className="text-red-500">*</span></Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as FactoryStatusType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">在合作</SelectItem>
                  <SelectItem value="SUSPENDED">暂停</SelectItem>
                  <SelectItem value="BLACKLISTED">黑名单</SelectItem>
                  <SelectItem value="INACTIVE">未激活</SelectItem>
                </SelectContent>
              </Select>
              {(newStatus === 'BLACKLISTED' || newStatus === 'SUSPENDED') && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  此状态将阻止工厂接收派单
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>变更原因 <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="请输入变更原因（必填）"
                value={changeReason}
                onChange={(e) => { setChangeReason(e.target.value); setReasonError('') }}
                rows={3}
              />
              {reasonError && <p className="text-sm text-red-500">{reasonError}</p>}
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                placeholder="可选备注"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground">生效时间：立即生效</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeDialogOpen(false)}>取消</Button>
            <Button onClick={handleSingleSubmit}>确认变更</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量变更弹窗 */}
      <Dialog open={batchChangeDialogOpen} onOpenChange={setBatchChangeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量变更状态</DialogTitle>
            <DialogDescription>
              将对 {selectedIds.length} 个工厂进行状态变更
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>新状态 <span className="text-red-500">*</span></Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as FactoryStatusType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">在合作</SelectItem>
                  <SelectItem value="SUSPENDED">暂停</SelectItem>
                  <SelectItem value="BLACKLISTED">黑名单</SelectItem>
                  <SelectItem value="INACTIVE">未激活</SelectItem>
                </SelectContent>
              </Select>
              {(newStatus === 'BLACKLISTED' || newStatus === 'SUSPENDED') && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  此状态将阻止工厂接收派单
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>变更原因 <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="请输入变更原因（必填）"
                value={changeReason}
                onChange={(e) => { setChangeReason(e.target.value); setReasonError('') }}
                rows={3}
              />
              {reasonError && <p className="text-sm text-red-500">{reasonError}</p>}
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                placeholder="可选备注"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground">生效时间：立即生效</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchChangeDialogOpen(false)}>取消</Button>
            <Button onClick={handleBatchSubmit}>确认变更</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 二次确认弹窗（BLACKLISTED/SUSPENDED） */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              确认变更为"{statusConfig[newStatus].label}"？
            </AlertDialogTitle>
            <AlertDialogDescription>
              {newStatus === 'BLACKLISTED' && '将工厂列入黑名单后，该工厂将无法接收新任务。'}
              {newStatus === 'SUSPENDED' && '暂停合作后，该工厂将暂时无法接收新任务。'}
              <br />
              <span className="font-medium">原因：</span>{changeReason}
              {pendingBatchConfirm && (
                <><br /><span className="font-medium">影响工厂数：</span>{selectedIds.length} 家</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmDialogOpen(false)
              if (pendingBatchConfirm) {
                setBatchChangeDialogOpen(true)
              } else {
                setChangeDialogOpen(true)
              }
            }}>
              返回修改
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExecute}>确认执行</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 历史记录弹窗 */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>状态变更历史 - {viewingFactory?.name}</DialogTitle>
            <DialogDescription>
              工厂编号：{viewingFactory?.code} | 层级：{viewingFactory && tierLabels[viewingFactory.tier]} | 类型：{viewingFactory && typeLabels[viewingFactory.type]}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {factoryHistory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>原状态</TableHead>
                    <TableHead>新状态</TableHead>
                    <TableHead>变更原因</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>变更时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factoryHistory.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <Badge className={statusConfig[h.oldStatus].color}>
                          {statusConfig[h.oldStatus].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[h.newStatus].color}>
                          {statusConfig[h.newStatus].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{h.reason}</TableCell>
                      <TableCell>{h.changedBy}</TableCell>
                      <TableCell className="text-sm">{h.changedAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">暂无变更记录</div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 变更日志弹窗 */}
      <Dialog open={changeLogDialogOpen} onOpenChange={setChangeLogDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>变更日志</DialogTitle>
            <DialogDescription>
              所有状态变更操作的记录
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {changeLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>操作类型</TableHead>
                    <TableHead>目标工厂</TableHead>
                    <TableHead>变更内容</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changeLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {log.action === 'BATCH_STATUS_CHANGE' ? '批量变更' : '状态变更'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {log.targetNames.length > 2
                          ? `${log.targetNames.slice(0, 2).join(', ')} 等${log.targetNames.length}家`
                          : log.targetNames.join(', ')}
                      </TableCell>
                      <TableCell>
                        {log.oldValue && `${log.oldValue} → `}{log.newValue}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{log.reason}</TableCell>
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
