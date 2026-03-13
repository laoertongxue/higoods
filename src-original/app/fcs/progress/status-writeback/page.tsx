'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from '@/lib/navigation'
import { RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/lib/i18n'
import { useFcs, type ReturnBatch } from '@/lib/fcs/fcs-store'
import type { ProcessTask } from '@/lib/fcs/process-tasks'

const BATCH_QC_STATUS_LABEL: Record<ReturnBatch['qcStatus'], string> = {
  QC_PENDING:  '待质检',
  PASS_CLOSED: '合格已放行',
  FAIL_IN_QC:  '不合格处理中',
}

function GateBlockedCard({ tasks }: { tasks: ProcessTask[] }) {
  const gatedTasks = tasks
    .filter(t => t.status === 'BLOCKED' && t.blockReason === 'ALLOCATION_GATE')
    .slice(0, 20)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{t('gate.blockedList.title')}</CardTitle>
        <CardDescription>上游染印/印花工序未放行时，下游任务将自动阻塞</CardDescription>
      </CardHeader>
      <CardContent>
        {gatedTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('gate.blockedList.empty')}</p>
        ) : (
          <div className="divide-y divide-border rounded-md border">
            {gatedTasks.map(task => {
              const depIds: string[] = (task as any).dependsOnTaskIds ?? []
              return (
                <div key={task.taskId} className="px-4 py-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-foreground">{task.processNameZh}</span>
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">门禁阻塞</Badge>
                  </div>
                  {depIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('task.dependencies')}：{depIds.join('、')}
                    </p>
                  )}
                  <p className="text-xs text-orange-700">{(task as any).blockNoteZh ?? '等待上游放行'}</p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReturnBatchCard() {
  const { state, createReturnBatch, markReturnBatchPass, startReturnBatchFailQc } = useFcs()
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [returnedQty, setReturnedQty]       = useState<number | ''>('')
  // track newly generated qcId per batch so we can show the link immediately
  const [pendingQcLinks, setPendingQcLinks] = useState<Record<string, string>>({})

  const tasks = state.processTasks.slice().sort((a, b) => a.taskId.localeCompare(b.taskId))
  const batches = [...(state.returnBatches ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)

  function handleCreate() {
    if (!selectedTaskId) { toast.error('请选择任务'); return }
    const qty = Number(returnedQty)
    if (!Number.isInteger(qty) || qty <= 0) { toast.error('回货数量必须为正整数'); return }
    const result = createReturnBatch(selectedTaskId, qty, '管理员')
    if (result.ok) {
      toast.success(`回货批次已登记，批次号：${result.batchId}`)
      setReturnedQty('')
    } else {
      toast.error(result.message ?? '登记失败')
    }
  }

  function handlePass(batchId: string) {
    const result = markReturnBatchPass(batchId, '管理员')
    if (result.ok) {
      toast.success('已合格放行，Allocation 已更新')
    } else {
      toast.error(result.message ?? '操作失败')
    }
  }

  function handleFailQc(batchId: string) {
    const result = startReturnBatchFailQc(batchId, '管理员')
    if (result.ok && result.qcId) {
      setPendingQcLinks(prev => ({ ...prev, [batchId]: result.qcId! }))
      toast.success(`已创建质检单 ${result.qcId}，任务已阻塞`)
    } else {
      toast.error(result.message ?? '操作失败')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">分批回货（按批质检放行）</CardTitle>
        <CardDescription>逐批登记回货，选择合格放行或不合格处理</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 登记表单 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_auto] items-end rounded-md border p-4 bg-muted/40">
          <div className="space-y-1">
            <Label className="text-xs">任务</Label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="选择任务" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map(task => (
                  <SelectItem key={task.taskId} value={task.taskId}>
                    {task.processNameZh ?? task.taskId}（{task.taskId}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">回货数量</Label>
            <Input
              type="number"
              min={1}
              step={1}
              className="h-8 text-sm"
              placeholder="整数"
              value={returnedQty}
              onChange={e => setReturnedQty(e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value))))}
            />
          </div>
          <Button size="sm" className="h-8" onClick={handleCreate}>登记回货</Button>
        </div>

        {/* 批次列表 */}
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">暂无回货批次</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>批次号</TableHead>
                  <TableHead>任务</TableHead>
                  <TableHead className="text-right">回货数量</TableHead>
                  <TableHead>质检状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map(batch => {
                  const linkedQcId = batch.linkedQcId ?? pendingQcLinks[batch.batchId]
                  const taskName = state.processTasks.find(t => t.taskId === batch.taskId)?.processNameZh ?? batch.taskId
                  return (
                    <TableRow key={batch.batchId}>
                      <TableCell className="font-mono text-xs">{batch.batchId}</TableCell>
                      <TableCell className="text-sm">{taskName}</TableCell>
                      <TableCell className="text-right text-sm">{batch.returnedQty}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            batch.qcStatus === 'PASS_CLOSED' ? 'bg-green-50 text-green-700 border-green-200' :
                            batch.qcStatus === 'FAIL_IN_QC'  ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }
                        >
                          {BATCH_QC_STATUS_LABEL[batch.qcStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {batch.qcStatus === 'QC_PENDING' && (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handlePass(batch.batchId)}>
                              合格放行
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50" onClick={() => handleFailQc(batch.batchId)}>
                              不合格处理
                            </Button>
                          </div>
                        )}
                        {batch.qcStatus === 'FAIL_IN_QC' && (
                          linkedQcId ? (
                            <Link href={`/fcs/quality/qc-records/${linkedQcId}`}>
                              <Button size="sm" variant="outline" className="h-7 text-xs">去处理</Button>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">未生成质检单</span>
                          )
                        )}
                        {batch.qcStatus === 'PASS_CLOSED' && (
                          <span className="text-xs text-muted-foreground">已放行</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusWritebackContent() {
  const searchParams = useSearchParams()
  const taskId = searchParams.get('taskId')
  const poId = searchParams.get('po')
  const { state } = useFcs()

  const allocationEvents = [...(state.allocationEvents ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/fcs/progress/board">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            返回看板
          </Button>
        </Link>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          {t('placeholder.statusWriteback.title')}
        </h1>
      </div>

      {/* 分批回货 */}
      <ReturnBatchCard />

      {/* 门禁阻塞（Allocation） */}
      <GateBlockedCard tasks={state.processTasks} />

      {/* Allocation 回写事件 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Allocation 回写事件</CardTitle>
          <CardDescription>质检结案或批次放行后自动写入，记录可用量变更</CardDescription>
        </CardHeader>
        <CardContent>
          {allocationEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">暂无 Allocation 回写事件</p>
          ) : (
            <>
              {/* 统计：染印加工单回写次数 */}
              {(() => {
                const dyePrintCount = (state.allocationEvents ?? []).filter(e => e.refType === 'DYE_PRINT_ORDER').length
                return dyePrintCount > 0 ? (
                  <div className="mb-3 px-3 py-2 rounded-md bg-blue-50 border border-blue-100 text-sm text-blue-700">
                    染印加工单回写次数：{dyePrintCount}
                  </div>
                ) : null
              })()}
              <div className="divide-y divide-border rounded-md border">
                {allocationEvents.map(ev => {
                  const sourceLabel =
                    ev.refType === 'DYE_PRINT_ORDER' ? '染印加工单' :
                    ev.refType === 'RETURN_BATCH'    ? '回货批次'   : '质检单'
                  const refLabel =
                    ev.refType === 'DYE_PRINT_ORDER' ? '加工单' :
                    ev.refType === 'RETURN_BATCH'    ? '批次'   : '质检单'
                  return (
                    <div key={ev.eventId} className="px-4 py-3 text-sm space-y-0.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground text-xs">{ev.createdAt}</span>
                        <span className="text-xs text-muted-foreground">任务：{ev.taskId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>来源：{sourceLabel}</span>
                        <span className="text-border">|</span>
                        <span>{refLabel}：{ev.refId}</span>
                      </div>
                      <p className="font-medium text-foreground">{ev.noteZh}</p>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>状态回写</CardTitle>
          <CardDescription>任务状态变更后会自动同步回写到生产单，计算生产单进度百分比和状态流转。</CardDescription>
        </CardHeader>
        <CardContent>
          {(taskId || poId) && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">{t('placeholder.fromBoard')}</h4>
              <div className="space-y-1 text-sm">
                {taskId && <div>任务ID: <code className="bg-background px-1 rounded">{taskId}</code></div>}
                {poId && <div>生产单: <code className="bg-background px-1 rounded">{poId}</code></div>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function StatusWritebackPage() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <StatusWritebackContent />
    </Suspense>
  )
}
