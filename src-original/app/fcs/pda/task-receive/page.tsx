'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight, Factory, ClipboardList } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { t } from '@/lib/i18n'
import { useFcs } from '@/lib/fcs/fcs-store'

const LOCAL_STORAGE_KEY = 'fcs_pda_factory_id'

export default function TaskReceivePage() {
  const { state, getOrderById } = useFcs()
  const { processTasks, factories } = state
  
  // 工厂选择状态
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  
  // 获取 ACTIVE 工厂列表
  const activeFactories = useMemo(() => {
    return factories.filter(f => f.status === 'ACTIVE')
  }, [factories])
  
  // 初始化工厂选择（从 localStorage 或默认第一个）
  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (stored && activeFactories.some(f => f.id === stored)) {
      setSelectedFactoryId(stored)
    } else if (activeFactories.length > 0) {
      const firstFactory = activeFactories[0].id
      setSelectedFactoryId(firstFactory)
      localStorage.setItem(LOCAL_STORAGE_KEY, firstFactory)
    }
  }, [activeFactories])
  
  // 选择工厂时存储
  const handleFactoryChange = (factoryId: string) => {
    setSelectedFactoryId(factoryId)
    localStorage.setItem(LOCAL_STORAGE_KEY, factoryId)
  }
  
  // 筛选待确认任务：assignedFactoryId == selectedFactoryId 且 acceptanceStatus in ['PENDING', undefined]
  const pendingTasks = useMemo(() => {
    if (!selectedFactoryId) return []
    return processTasks.filter(task => {
      if (task.assignedFactoryId !== selectedFactoryId) return false
      // PENDING 或 undefined 视为待确认
      if (task.acceptanceStatus && task.acceptanceStatus !== 'PENDING') return false
      return true
    })
  }, [processTasks, selectedFactoryId])
  
  // 当前选中的工厂名称
  const selectedFactory = activeFactories.find(f => f.id === selectedFactoryId)
  
  return (
    <div className="flex flex-col min-h-full">
      {/* 顶部 Header */}
      <header className="sticky top-0 z-40 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {t('pda.taskReceive.title')}
          </h1>
        </div>
        {/* 工厂选择器 */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('pda.taskReceive.factory')}:</span>
            <Select value={selectedFactoryId} onValueChange={handleFactoryChange}>
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder={t('pda.taskReceive.selectFactory')} />
              </SelectTrigger>
              <SelectContent>
                {activeFactories.map(factory => (
                  <SelectItem key={factory.id} value={factory.id}>
                    {factory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      
      {/* 列表内容 */}
      <div className="flex-1 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t('pda.taskReceive.pending')} ({pendingTasks.length})
          </h2>
        </div>
        
        {pendingTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">{t('pda.taskReceive.noPending')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map(task => {
              const order = getOrderById(task.productionOrderId)
              const spuCode = order?.demandSnapshot?.spuCode || '-'
              const spuName = order?.demandSnapshot?.spuName || '-'
              const deliveryDate = order?.demandSnapshot?.requiredDeliveryDate || '-'
              const assignmentModeLabel = t(`pda.taskReceive.assignmentMode.${task.assignmentMode}`)
              
              return (
                <Link 
                  key={task.taskId} 
                  href={`/fcs/pda/task-receive/${task.taskId}`}
                >
                  <Card className="hover:border-primary transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {/* 任务ID + 生产单号 */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono text-sm font-medium">{task.taskId}</span>
                            <Badge variant="outline" className="text-xs">{task.productionOrderId}</Badge>
                          </div>
                          
                          {/* SPU */}
                          <div className="text-sm mb-1">
                            <span className="text-muted-foreground">SPU:</span>
                            <span className="ml-1">{spuCode}</span>
                            <span className="text-muted-foreground ml-1">({spuName})</span>
                          </div>
                          
                          {/* 工艺 + 数量 */}
                          <div className="flex items-center gap-4 text-sm mb-1">
                            <span>
                              <span className="text-muted-foreground">{t('task.processNameZh')}:</span>
                              <span className="ml-1 font-medium">{task.processNameZh}</span>
                            </span>
                            <span>
                              <span className="text-muted-foreground">{t('task.qty')}:</span>
                              <span className="ml-1">{task.qty}</span>
                            </span>
                          </div>
                          
                          {/* 分配模式 + 状态 */}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">{assignmentModeLabel}</Badge>
                            <Badge variant="outline" className="text-xs">{task.assignmentStatus}</Badge>
                          </div>
                          
                          {/* 交付期 */}
                          <div className="text-xs text-muted-foreground mt-2">
                            {t('common.deliveryDate')}: {deliveryDate}
                          </div>
                        </div>
                        
                        {/* 箭头 */}
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
