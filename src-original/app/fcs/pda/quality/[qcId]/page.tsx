'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Check, AlertTriangle, Plus, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useFcs, type QualityInspection, type QcDisposition, type DefectItem } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'

export default function QualityDetailPage() {
  const params = useParams()

  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { state, getQcById, createQc, updateQc, submitQc, can } = useFcs()
  
  const qcId = params.qcId as string
  const isNew = qcId === 'new'
  const taskIdFromQuery = searchParams.get('taskId')
  
  // 表单状态
  const [result, setResult] = useState<'PASS' | 'FAIL'>('PASS')
  const [defectItems, setDefectItems] = useState<DefectItem[]>([])
  const [remark, setRemark] = useState('')
  const [disposition, setDisposition] = useState<QcDisposition | ''>('')
  const [affectedQty, setAffectedQty] = useState<number>(0)
  const [inspector, setInspector] = useState('质检员A')
  
  // 加载现有 QC 数据
  const existingQc = !isNew ? getQcById(qcId) : undefined
  const refTask = state.processTasks.find(t => t.taskId === (existingQc?.refId || taskIdFromQuery))
  const maxQty = refTask?.qty || 100
  
  useEffect(() => {
    if (existingQc) {
      setResult(existingQc.result)
      setDefectItems(existingQc.defectItems || [])
      setRemark(existingQc.remark || '')
      setDisposition(existingQc.disposition || '')
      setAffectedQty(existingQc.affectedQty || 0)
      setInspector(existingQc.inspector)
    }
  }, [existingQc])
  
  // 添加缺陷项
  const addDefectItem = () => {
    setDefectItems([...defectItems, { defectCode: `DEF-${Date.now()}`, defectName: '', qty: 1 }])
  }
  
  // 删除缺陷项
  const removeDefectItem = (index: number) => {
    setDefectItems(defectItems.filter((_, i) => i !== index))
  }
  
  // 更新缺陷项
  const updateDefectItem = (index: number, field: keyof DefectItem, value: string | number) => {
    const updated = [...defectItems]
    updated[index] = { ...updated[index], [field]: value }
    setDefectItems(updated)
  }
  
  // 校验
  const validate = () => {
    if (result === 'FAIL') {
      if (defectItems.length === 0) {
        toast({ title: t('pda.quality.validation.defectRequired'), variant: 'destructive' })
        return false
      }
      if (!disposition) {
        toast({ title: t('pda.quality.validation.dispositionRequired'), variant: 'destructive' })
        return false
      }
      if ((disposition === 'REWORK' || disposition === 'REMAKE') && (affectedQty < 1 || affectedQty > maxQty)) {
        toast({ title: t('pda.quality.validation.affectedQtyInvalid').replace('{max}', String(maxQty)), variant: 'destructive' })
        return false
      }
    }
    return true
  }
  
  // 保存草稿
  const handleSave = () => {
    if (isNew && taskIdFromQuery) {
      const qc = createQc({
        refType: 'TASK',
        refId: taskIdFromQuery,
        productionOrderId: refTask?.productionOrderId || '',
        inspector,
        inspectedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        result,
        defectItems,
        remark,
        disposition: disposition || undefined,
        affectedQty: affectedQty || undefined,
      })
      window.location.replace(`/fcs/pda/quality/${qc.qcId}`)
    } else if (existingQc) {
      updateQc({
        ...existingQc,
        result,
        defectItems,
        remark,
        disposition: disposition || undefined,
        affectedQty: affectedQty || undefined,
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })
    }
    toast({ title: '已保存草稿' })
  }
  
  // 提交质检
  const handleSubmit = () => {
    if (!validate()) return
    
    let currentQcId = qcId
    
    // 如果是新建，先创建
    if (isNew && taskIdFromQuery) {
      const qc = createQc({
        refType: 'TASK',
        refId: taskIdFromQuery,
        productionOrderId: refTask?.productionOrderId || '',
        inspector,
        inspectedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        result,
        defectItems,
        remark,
        disposition: disposition || undefined,
        affectedQty: affectedQty || undefined,
      })
      currentQcId = qc.qcId
    } else if (existingQc) {
      // 先更新
      updateQc({
        ...existingQc,
        result,
        defectItems,
        remark,
        disposition: disposition || undefined,
        affectedQty: affectedQty || undefined,
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })
    }
    
    // 提交
    const { generatedTaskIds } = submitQc(currentQcId, inspector)
    
    toast({ 
      title: t('pda.quality.submitSuccess'),
      description: generatedTaskIds.length > 0 ? `生成返工任务：${generatedTaskIds.join(', ')}` : undefined,
    })
    
    // 刷新页面以显示提交后状态
    if (isNew) {
      window.location.replace(`/fcs/pda/quality/${currentQcId}`)
    } else {
      router.refresh()
    }
  }
  
  // 已提交状态
  const isSubmitted = existingQc?.status === 'SUBMITTED'
  // 权限标志
  const canSubmitQc = can('QC_SUBMIT')
  
  // 状态 Badge
  const statusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <Badge variant="secondary">{t('pda.quality.status.DRAFT')}</Badge>
      case 'SUBMITTED': return <Badge variant="default">{t('pda.quality.status.SUBMITTED')}</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }
  
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{t('pda.quality.title')}</h1>
        {existingQc && statusBadge(existingQc.status)}
      </div>
      
      {/* 基本信息 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">{isNew ? '新建质检' : existingQc?.qcId}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {refTask && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <Label className="text-muted-foreground">{t('pda.quality.field.refTask')}</Label>
                <p className="font-medium">{refTask.taskId}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">工艺</Label>
                <p className="font-medium">{refTask.processNameZh}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">数量</Label>
                <p className="font-medium">{refTask.qty} {refTask.qtyUnit}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{t('pda.quality.field.inspector')}</Label>
                <p className="font-medium">{inspector}</p>
              </div>
            </div>
          )}
          
          <Separator />
          
          {/* 检验结果 */}
          <div className="space-y-2">
            <Label>{t('pda.quality.field.result')} *</Label>
            <Select value={result} onValueChange={(v) => setResult(v as 'PASS' | 'FAIL')} disabled={isSubmitted}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASS">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    {t('pda.quality.result.PASS')}
                  </div>
                </SelectItem>
                <SelectItem value="FAIL">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    {t('pda.quality.result.FAIL')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 不合格时显示：缺陷项 */}
          {result === 'FAIL' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('pda.quality.field.defectItems')} *</Label>
                  {!isSubmitted && (
                    <Button variant="outline" size="sm" onClick={addDefectItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      添加
                    </Button>
                  )}
                </div>
                {defectItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <Input 
                      placeholder="缺陷名称" 
                      value={item.defectName} 
                      onChange={(e) => updateDefectItem(index, 'defectName', e.target.value)}
                      disabled={isSubmitted}
                      className="flex-1"
                    />
                    <Input 
                      type="number" 
                      placeholder="数量" 
                      value={item.qty} 
                      onChange={(e) => updateDefectItem(index, 'qty', parseInt(e.target.value) || 0)}
                      disabled={isSubmitted}
                      className="w-20"
                    />
                    {!isSubmitted && (
                      <Button variant="ghost" size="icon" onClick={() => removeDefectItem(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
                {defectItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">请添加缺陷项</p>
                )}
              </div>
              
              {/* 处置结论 */}
              <div className="space-y-2">
                <Label>{t('pda.quality.field.disposition')} *</Label>
                <Select value={disposition} onValueChange={(v) => setDisposition(v as QcDisposition)} disabled={isSubmitted}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择处置结论" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACCEPT">{t('pda.quality.disposition.accept')}</SelectItem>
                    <SelectItem value="REWORK">{t('pda.quality.disposition.rework')}</SelectItem>
                    <SelectItem value="REMAKE">{t('pda.quality.disposition.remake')}</SelectItem>
                    <SelectItem value="SCRAP">{t('pda.quality.disposition.scrap')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* 受影响数量（仅 REWORK/REMAKE 时显示） */}
              {(disposition === 'REWORK' || disposition === 'REMAKE') && (
                <div className="space-y-2">
                  <Label>{t('pda.quality.field.affectedQty')} * (1 ~ {maxQty})</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    max={maxQty}
                    value={affectedQty || ''} 
                    onChange={(e) => setAffectedQty(parseInt(e.target.value) || 0)}
                    disabled={isSubmitted}
                  />
                </div>
              )}
            </>
          )}
          
          {/* 备注 */}
          <div className="space-y-2">
            <Label>{t('pda.quality.field.remark')}</Label>
            <Textarea 
              value={remark} 
              onChange={(e) => setRemark(e.target.value)}
              disabled={isSubmitted}
              placeholder="备注信息"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* 生成的返工任务（已提交时显示） */}
      {isSubmitted && existingQc?.generatedTaskIds && existingQc.generatedTaskIds.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('pda.quality.generatedTasks.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {existingQc.generatedTaskIds.map(taskId => {
              const task = state.processTasks.find(t => t.taskId === taskId)
              return (
                <div key={taskId} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <p className="font-medium">{taskId}</p>
                    <p className="text-sm text-muted-foreground">{task?.processNameZh} - {task?.qty} {task?.qtyUnit}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.location.href = `/fcs/pda/task-receive/${taskId}`}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    {t('pda.quality.generatedTasks.action.view')}
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
      
      {/* 审计日志 */}
      {existingQc && existingQc.auditLogs.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">操作日志</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {existingQc.auditLogs.map(log => (
                <div key={log.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                  <p className="font-medium">{log.action}</p>
                  <p className="text-muted-foreground">{log.detail}</p>
                  <p className="text-xs text-muted-foreground">{log.at} - {log.by}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* 操作按钮 */}
      {!isSubmitted && (
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={handleSave}>
            {t('pda.quality.action.save')}
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!canSubmitQc}
            title={!canSubmitQc ? t('pda.auth.noPermission') : undefined}
          >
            {t('pda.quality.action.submit')}
          </Button>
        </div>
      )}
    </div>
  )
}
