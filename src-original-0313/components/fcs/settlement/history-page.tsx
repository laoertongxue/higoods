'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs } from '@/lib/fcs/fcs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ─── 常量映射 ─────────────────────────────────────────────────────────────────

const PARTY_TYPE_ZH: Record<string, string> = {
  FACTORY:        '工厂',
  PROCESSOR:      '加工方',
  SUPPLIER:       '供应商',
  GROUP_INTERNAL: '内部主体',
  INTERNAL:       '内部主体',
  OTHER:          '其他',
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function partyZh(type: string, id: string) {
  return `${PARTY_TYPE_ZH[type] ?? type} / ${id}`
}

// ─── 组件 ─────────────────────────────────────────────────────────────────────

export function HistoryPage() {
  const router = useRouter()
  const { statementDrafts, statementAdjustments, settlementBatches } = useFcs() as {
    statementDrafts: any[]
    statementAdjustments: any[]
    settlementBatches: any[]
  }

  const [keyword, setKeyword]       = useState('')
  const [partyType, setPartyType]   = useState('ALL')

  // ─── 已关闭对账单历史 ─────────────────────────────────────────────────────
  const statementHistory = useMemo(() => {
    const closedStatements = (statementDrafts ?? []).filter((s: any) => s.status === 'CLOSED')
    return closedStatements.map((s: any) => {
      const adjs = (statementAdjustments ?? []).filter((a: any) => a.statementId === s.statementId)
      const adjustmentCount = adjs.length
      const effectiveAdjustmentAmount = adjs
        .filter((a: any) => a.status === 'EFFECTIVE')
        .reduce((sum: number, a: any) => {
          return a.adjustmentType === 'REVERSAL' ? sum - a.amount : sum + a.amount
        }, 0)

      let accountingSummaryZh: string
      if (adjustmentCount === 0) {
        accountingSummaryZh = '无调整'
      } else if (effectiveAdjustmentAmount === 0) {
        accountingSummaryZh = '含调整记录'
      } else if (effectiveAdjustmentAmount > 0) {
        accountingSummaryZh = '含已生效调整'
      } else {
        accountingSummaryZh = '含冲销调整'
      }

      // 反查关联批次
      const relatedBatch = (settlementBatches ?? []).find((b: any) =>
        Array.isArray(b.statementIds) && b.statementIds.includes(s.statementId)
      )
      const relatedBatchId = relatedBatch?.batchId ?? null
      const closedAt = s.updatedAt ?? s.createdAt ?? null

      return {
        statementId: s.statementId as string,
        settlementPartyType: s.settlementPartyType as string,
        settlementPartyId: s.settlementPartyId as string,
        itemCount: (s.itemCount as number) ?? s.items?.length ?? 0,
        totalQty: (s.totalQty as number) ?? 0,
        totalAmount: (s.totalAmount as number) ?? 0,
        adjustmentCount,
        effectiveAdjustmentAmount,
        relatedBatchId,
        closedAt,
        accountingSummaryZh,
      }
    })
  }, [statementDrafts, statementAdjustments, settlementBatches])

  // ─── 已完成结算批次历史 ───────────────────────────────────────────────────
  const batchHistory = useMemo(() => {
    const completedBatches = (settlementBatches ?? []).filter((b: any) => b.status === 'COMPLETED')
    return completedBatches.map((b: any) => {
      const statementCount = Array.isArray(b.statementIds)
        ? b.statementIds.length
        : (b.itemCount ?? 0)

      const items: any[] = Array.isArray(b.items) ? b.items : []
      const uniqueParties = new Set(items.map((i: any) => i.settlementPartyId))
      const partyCount = uniqueParties.size
      const settlementPartySummaryZh =
        partyCount <= 1 ? '单一结算对象' : `多结算对象（${partyCount}个）`

      return {
        batchId: b.batchId as string,
        batchName: (b.batchName as string) || null,
        itemCount: b.itemCount as number,
        totalAmount: (b.totalAmount as number) ?? 0,
        statementCount,
        settlementPartySummaryZh,
        completedAt: b.updatedAt ?? b.createdAt ?? null,
      }
    })
  }, [settlementBatches])

  // ─── 统计卡 ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const closedCount      = statementHistory.length
    const completedCount   = batchHistory.length
    const totalAmount      = statementHistory.reduce((s, x) => s + x.totalAmount, 0)
    const adjustedCount    = statementHistory.filter(x => x.adjustmentCount > 0).length
    return { closedCount, completedCount, totalAmount, adjustedCount }
  }, [statementHistory, batchHistory])

  // ─── 筛选 ─────────────────────────────────────────────────────────────────
  const kw = keyword.trim().toLowerCase()

  const filteredStatements = useMemo(() => {
    return statementHistory.filter(s => {
      const matchParty = partyType === 'ALL' || s.settlementPartyType === partyType
      const matchKw = !kw || [s.statementId, s.settlementPartyId, s.relatedBatchId ?? ''].some(
        v => v.toLowerCase().includes(kw)
      )
      return matchParty && matchKw
    })
  }, [statementHistory, partyType, kw])

  const filteredBatches = useMemo(() => {
    return batchHistory.filter(b => {
      const matchKw = !kw || [b.batchId, b.batchName ?? ''].some(
        v => v.toLowerCase().includes(kw)
      )
      return matchKw
    })
  }, [batchHistory, kw])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground text-balance">历史对账与核算</h1>
          <p className="text-sm text-muted-foreground mt-0.5">历史对账与核算用于回看已关闭对账单与已完成结算批次；原型阶段仅做历史汇总展示，不包含真实财务核算</p>
        </div>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已关闭对账单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.closedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">已完成结算批次数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">历史金额合计</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">含调整历史单数</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.adjustedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区 */}
      <div className="flex flex-wrap gap-3">
        <Input
          className="w-64"
          placeholder="搜索对账单号/批次号/结算对象ID"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
        />
        <Select value={partyType} onValueChange={setPartyType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="结算对象类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            <SelectItem value="FACTORY">工厂</SelectItem>
            <SelectItem value="PROCESSOR">加工方</SelectItem>
            <SelectItem value="SUPPLIER">供应商</SelectItem>
            <SelectItem value="GROUP_INTERNAL">内部主体</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="statements">
        <TabsList>
          <TabsTrigger value="statements">
            对账单历史
            <Badge variant="secondary" className="ml-2">{filteredStatements.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="batches">
            结算批次历史
            <Badge variant="secondary" className="ml-2">{filteredBatches.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* 对账单历史 */}
        <TabsContent value="statements" className="mt-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>对账单号</TableHead>
                  <TableHead>结算对象</TableHead>
                  <TableHead>条目数</TableHead>
                  <TableHead>扣款总数量</TableHead>
                  <TableHead>最终金额</TableHead>
                  <TableHead>调整项数</TableHead>
                  <TableHead>核算摘要</TableHead>
                  <TableHead>关联批次</TableHead>
                  <TableHead>关闭时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStatements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      暂无对账单历史数据
                    </TableCell>
                  </TableRow>
                ) : filteredStatements.map(s => (
                  <TableRow key={s.statementId}>
                    <TableCell className="font-mono text-xs">{s.statementId}</TableCell>
                    <TableCell className="text-sm">{partyZh(s.settlementPartyType, s.settlementPartyId)}</TableCell>
                    <TableCell className="text-sm text-center">{s.itemCount}</TableCell>
                    <TableCell className="text-sm text-center">{s.totalQty}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {s.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {s.adjustmentCount > 0
                        ? <Badge variant="secondary">{s.adjustmentCount}</Badge>
                        : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-sm">{s.accountingSummaryZh}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.relatedBatchId ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.closedAt ?? <span>—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push('/fcs/settlement/statements')}
                        >
                          查看对账单
                        </Button>
                        {s.relatedBatchId ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push('/fcs/settlement/batches')}
                          >
                            查看批次
                          </Button>
                        ) : (
                          <span className="px-2 py-1 text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 结算批次历史 */}
        <TabsContent value="batches" className="mt-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>批次号</TableHead>
                  <TableHead>批次名称</TableHead>
                  <TableHead>对账单数</TableHead>
                  <TableHead>总金额</TableHead>
                  <TableHead>结算对象摘要</TableHead>
                  <TableHead>完成时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      暂无结算批次历史数据
                    </TableCell>
                  </TableRow>
                ) : filteredBatches.map(b => (
                  <TableRow key={b.batchId}>
                    <TableCell className="font-mono text-xs">{b.batchId}</TableCell>
                    <TableCell className="text-sm">
                      {b.batchName ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-center">{b.statementCount}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {b.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm">{b.settlementPartySummaryZh}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.completedAt ?? <span>—</span>}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push('/fcs/settlement/batches')}
                      >
                        查看批次
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
