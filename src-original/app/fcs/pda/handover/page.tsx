'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useFcs, type HandoverEventType } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowRight, Search, Package, ChevronRight } from 'lucide-react'

const EVENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: t('pda.handover.eventType.all') },
  { value: 'CUT_PIECES_TO_MAIN_FACTORY', label: t('pda.handover.eventType.cutPiecesToMainFactory') },
  { value: 'FINISHED_GOODS_TO_WAREHOUSE', label: t('pda.handover.eventType.finishedGoodsToWarehouse') },
  { value: 'MATERIAL_TO_PROCESSOR', label: t('pda.handover.eventType.materialToProcessor') },
]

function getEventTypeLabel(type: HandoverEventType): string {
  switch (type) {
    case 'CUT_PIECES_TO_MAIN_FACTORY': return t('pda.handover.eventType.cutPiecesToMainFactory')
    case 'FINISHED_GOODS_TO_WAREHOUSE': return t('pda.handover.eventType.finishedGoodsToWarehouse')
    case 'MATERIAL_TO_PROCESSOR': return t('pda.handover.eventType.materialToProcessor')
    default: return type
  }
}

export default function PdaHandoverListPage() {
  const { state } = useFcs()
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [keyword, setKeyword] = useState('')

  // 从 localStorage 读取当前工厂
  useEffect(() => {
    const stored = localStorage.getItem('fcs_pda_factory_id')
    if (stored) {
      setSelectedFactoryId(stored)
    }
  }, [])

  // 过滤待确认的交接事件（toParty.id = 当前工厂且 status = PENDING_CONFIRM）
  const pendingEvents = useMemo(() => {
    return state.handoverEvents.filter(event => {
      // 必须是待确认状态
      if (event.status !== 'PENDING_CONFIRM') return false
      // 必须是发给工厂的
      if (event.toParty.kind !== 'FACTORY') return false
      // 必须是发给当前选中工厂的
      if (event.toParty.id !== selectedFactoryId) return false
      // 事件类型过滤
      if (filterType !== 'ALL' && event.eventType !== filterType) return false
      // 关键词过滤
      if (keyword) {
        const kw = keyword.toLowerCase()
        const matchEventId = event.eventId.toLowerCase().includes(kw)
        const matchPo = event.productionOrderId.toLowerCase().includes(kw)
        const matchFrom = event.fromParty.name.toLowerCase().includes(kw)
        const matchTo = event.toParty.name.toLowerCase().includes(kw)
        if (!matchEventId && !matchPo && !matchFrom && !matchTo) return false
      }
      return true
    }).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  }, [state.handoverEvents, selectedFactoryId, filterType, keyword])

  // 工厂选项
  const factoryOptions = useMemo(() => {
    return state.factories.map(f => ({ value: f.id, label: f.name }))
  }, [state.factories])

  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t('pda.handover.title')}</h1>
      </div>

      {/* 工厂选择 */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">{t('pda.taskReceive.factory')}</label>
        <Select 
          value={selectedFactoryId} 
          onValueChange={(v) => {
            setSelectedFactoryId(v)
            localStorage.setItem('fcs_pda_factory_id', v)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('pda.taskReceive.selectFactory')} />
          </SelectTrigger>
          <SelectContent>
            {factoryOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 过滤器 */}
      <div className="flex gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('pda.handover.filter.keywordPlaceholder')}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 待确认数量 */}
      {selectedFactoryId && (
        <div className="text-sm text-muted-foreground">
          {t('pda.taskReceive.pending')}: <span className="font-medium text-foreground">{pendingEvents.length}</span>
        </div>
      )}

      {/* 事件列表 */}
      {!selectedFactoryId ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('pda.taskReceive.selectFactory')}
          </CardContent>
        </Card>
      ) : pendingEvents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('pda.handover.noEvents')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingEvents.map(event => (
            <Link key={event.eventId} href={`/fcs/pda/handover/${event.eventId}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-2">
                      {/* 事件ID和类型 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">{event.eventId}</span>
                        <Badge variant="outline">{getEventTypeLabel(event.eventType)}</Badge>
                        <Badge variant="secondary">{t('pda.handover.status.PENDING_CONFIRM')}</Badge>
                      </div>
                      {/* 生产单号 */}
                      <div className="text-sm text-muted-foreground">
                        {event.productionOrderId}
                      </div>
                      {/* 收发方 */}
                      <div className="flex items-center gap-2 text-sm">
                        <span>{event.fromParty.name}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{event.toParty.name}</span>
                      </div>
                      {/* 数量 */}
                      <div className="flex items-center gap-4 text-sm">
                        <span>
                          <Package className="inline h-3.5 w-3.5 mr-1" />
                          {t('pda.handover.field.expected')}: <span className="font-medium">{event.qtyExpected}</span>
                        </span>
                        <span>
                          {t('pda.handover.field.actual')}: <span className="font-medium">{event.qtyActual ?? '-'}</span>
                        </span>
                      </div>
                      {/* 时间 */}
                      <div className="text-xs text-muted-foreground">
                        {t('pda.handover.field.occurredAt')}: {event.occurredAt}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
