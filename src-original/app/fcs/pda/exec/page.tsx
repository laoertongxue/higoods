'use client'

import { useState, useMemo, useEffect } from 'react'
// useRouter removed — use window.location for PDA navigation
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Search, Play, CheckCircle, AlertTriangle, Eye, Package } from 'lucide-react'
import { useFcs, type BlockReason } from '@/lib/fcs/fcs-store'
import { getMaterialProgressByPo, type MaterialProgress } from '@/lib/mocks/legacyWmsPicking'
import { t } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'

const FACTORY_STORAGE_KEY = 'fcs_pda_factory_id'

type TaskStatusTab = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'

const statusTabConfig: { key: TaskStatusTab; label: string; color: string }[] = [
  { key: 'NOT_STARTED', label: 'pda.exec.tabs.todo', color: 'bg-gray-100 text-gray-800' },
  { key: 'IN_PROGRESS', label: 'pda.exec.tabs.running', color: 'bg-blue-100 text-blue-800' },
  { key: 'BLOCKED', label: 'pda.exec.tabs.blocked', color: 'bg-red-100 text-red-800' },
  { key: 'DONE', label: 'pda.exec.tabs.done', color: 'bg-green-100 text-green-800' },
]

const materialStatusColor: Record<string, string> = {
  'NOT_CREATED': 'bg-gray-100 text-gray-600',
  'CREATED': 'bg-yellow-100 text-yellow-700',
  'PICKING': 'bg-blue-100 text-blue-700',
  'PARTIAL': 'bg-orange-100 text-orange-700',
  'COMPLETED': 'bg-green-100 text-green-700',
  'CANCELLED': 'bg-red-100 text-red-600',
}

export default function PdaExecPage() {

  const { toast } = useToast()
  const { state, startTask, finishTask, blockTask } = useFcs()
  
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TaskStatusTab>('NOT_STARTED')
  const [searchKeyword, setSearchKeyword] = useState('')
  
  // 从 localStorage 读取工厂ID
  useEffect(() => {
    const stored = localStorage.getItem(FACTORY_STORAGE_KEY)
    if (stored) setSelectedFactoryId(stored)
  }, [])
  
  // 保存工厂ID到 localStorage
  const handleFactoryChange = (factoryId: string) => {
    setSelectedFactoryId(factoryId)
    localStorage.setItem(FACTORY_STORAGE_KEY, factoryId)
  }
  
  // 过滤已接单的任务
  const acceptedTasks = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.processTasks.filter(task => 
      task.assignedFactoryId === selectedFactoryId &&
      task.acceptanceStatus === 'ACCEPTED' &&
      ['ASSIGNED', 'AWARDED', 'ASSIGNING', 'BIDDING'].includes(task.assignmentStatus)
    )
  }, [state.processTasks, selectedFactoryId])
  
  // 按状态分组
  const tasksByStatus = useMemo(() => {
    const groups: Record<TaskStatusTab, typeof acceptedTasks> = {
      'NOT_STARTED': [],
      'IN_PROGRESS': [],
      'BLOCKED': [],
      'DONE': [],
    }
    
    for (const task of acceptedTasks) {
      const status = task.status || 'NOT_STARTED'
      if (status in groups) {
        groups[status as TaskStatusTab].push(task)
      }
    }
    
    return groups
  }, [acceptedTasks])
  
  // 搜索过滤
  const filteredTasks = useMemo(() => {
    const tasks = tasksByStatus[activeTab]
    if (!searchKeyword.trim()) return tasks
    
    const kw = searchKeyword.toLowerCase()
    return tasks.filter(task => 
      task.taskId.toLowerCase().includes(kw) ||
      task.productionOrderId.toLowerCase().includes(kw) ||
      task.processNameZh.toLowerCase().includes(kw)
    )
  }, [tasksByStatus, activeTab, searchKeyword])
  
  // 获取物料进度
  const getMaterialStatus = (poId: string): MaterialProgress => {
    return getMaterialProgressByPo(poId)
  }
  
  // 开工操作
  const handleStart = (taskId: string, poId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const material = getMaterialStatus(poId)
    if (material.readinessStatus !== 'COMPLETED') {
      toast({
        title: '无法开工',
        description: t('pda.exec.material.notReady').replace('{status}', t(`pda.exec.material.status.${material.readinessStatus}`)),
        variant: 'destructive',
      })
      return
    }
    startTask(taskId, 'PDA')
    toast({ title: t('pda.exec.startSuccess') })
  }
  
  // 完工操作
  const handleFinish = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    finishTask(taskId, 'PDA')
    toast({ title: t('pda.exec.finishSuccess') })
  }
  
  // 暂不能继续操作 - 快捷（默认OTHER）
  const handleQuickBlock = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // 快捷暂不能继续跳到详情页操作
    window.location.href = `/fcs/pda/exec/${taskId}?action=block`
  }
  
  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <h1 className="text-lg font-semibold">{t('pda.exec.title')}</h1>
      
      {/* 工厂选择器 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('pda.taskReceive.factory')}:</span>
        <Select value={selectedFactoryId} onValueChange={handleFactoryChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('pda.taskReceive.selectFactory')} />
          </SelectTrigger>
          <SelectContent>
            {state.factories.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('pda.exec.search.placeholder')}
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          className="pl-9"
        />
      </div>
      
      {/* 状态 Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TaskStatusTab)}>
        <TabsList className="grid w-full grid-cols-4">
          {statusTabConfig.map(tab => (
            <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
              {t(tab.label)} ({tasksByStatus[tab.key].length})
            </TabsTrigger>
          ))}
        </TabsList>
        
        {statusTabConfig.map(tab => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4 space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">{t('pda.exec.noTasks')}</div>
            ) : (
              filteredTasks.map(task => {
                const material = getMaterialStatus(task.productionOrderId)
                const canStart = task.status === 'NOT_STARTED' && material.readinessStatus === 'COMPLETED'
                const canFinish = task.status === 'IN_PROGRESS'
                const canBlock = task.status !== 'DONE'
                
                return (
                  <Card 
                    key={task.taskId} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => window.location.href = `/fcs/pda/exec/${task.taskId}`}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* 第一行：taskId + 状态 */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{task.taskId}</span>
                        <Badge className={statusTabConfig.find(s => s.key === (task.status || 'NOT_STARTED'))?.color}>
                          {t(`pda.exec.tabs.${task.status === 'NOT_STARTED' ? 'todo' : task.status === 'IN_PROGRESS' ? 'running' : task.status === 'BLOCKED' ? 'blocked' : 'done'}`)}
                        </Badge>
                      </div>
                      
                      {/* 第二行：生产单号 + 工艺 */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{task.productionOrderId}</span>
                        <span>{task.processNameZh}</span>
                      </div>
                      
                      {/* 第三行：数量 + 物料状态 */}
                      <div className="flex items-center justify-between text-sm">
                        <span>{task.qty} {task.qtyUnit}</span>
                        <Badge variant="outline" className={materialStatusColor[material.readinessStatus]}>
                          <Package className="mr-1 h-3 w-3" />
                          {t(`pda.exec.material.status.${material.readinessStatus}`)}
                        </Badge>
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <TooltipProvider>
                          {task.status === 'NOT_STARTED' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    size="sm"
                                    variant={canStart ? 'default' : 'outline'}
                                    disabled={!canStart}
                                    onClick={e => handleStart(task.taskId, task.productionOrderId, e)}
                                  >
                                    <Play className="mr-1 h-3 w-3" />
                                    {t('pda.exec.action.start')}
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {!canStart && (
                                <TooltipContent>
                                  {t('pda.exec.material.notReady').replace('{status}', t(`pda.exec.material.status.${material.readinessStatus}`))}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          )}
                        </TooltipProvider>
                        
                        {canFinish && (
                          <Button size="sm" variant="default" onClick={e => handleFinish(task.taskId, e)}>
                            <CheckCircle className="mr-1 h-3 w-3" />
                            {t('pda.exec.action.finish')}
                          </Button>
                        )}
                        
                        {canBlock && (
                          <Button size="sm" variant="outline" onClick={e => handleQuickBlock(task.taskId, e)}>
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {t('pda.exec.action.block')}
                          </Button>
                        )}
                        
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="ml-auto"
                          onClick={e => { e.stopPropagation(); window.location.href = `/fcs/pda/exec/${task.taskId}` }}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          {t('pda.exec.action.viewDetail')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
