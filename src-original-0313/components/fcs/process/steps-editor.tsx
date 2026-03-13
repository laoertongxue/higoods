'use client'

import { useState, useCallback } from 'react'
import {
  Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, ChevronDown as ChevronDownIcon,
  AlertCircle, Eraser, Wand2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { processTypes, getProcessTypeByCode, stageLabels, type ProcessStage } from '@/lib/fcs/process-types'
import type { TemplateStep, OwnerSuggestion } from '@/lib/fcs/routing-templates'

// 工厂类型选项（模拟）
const factoryTypeOptions = [
  'SEWING', 'CUTTING', 'EMBROIDERY', 'PRINTING', 'DYEING', 
  'WASHING', 'SPECIAL_PROCESS', 'FINISHING', 'WAREHOUSE', 'DENIM', 'LASER'
]

// 能力标签选项（模拟）
const tagOptions = [
  '车缝', '针织', '梭织', '特种工艺', '印花', '绣花', '洗水', '激光切'
]

// 层级选项
const tierOptions: { value: 'ANY' | 'CENTRAL' | 'SATELLITE' | 'THIRD_PARTY'; label: string }[] = [
  { value: 'ANY', label: t('factoryTier.ANY') },
  { value: 'CENTRAL', label: t('factoryTier.CENTRAL') },
  { value: 'SATELLITE', label: t('factoryTier.SATELLITE') },
  { value: 'THIRD_PARTY', label: t('factoryTier.THIRD_PARTY') },
]

// 阶段颜色
const stageColors: Record<ProcessStage, string> = {
  PREP: 'bg-purple-100 text-purple-700',
  CUTTING: 'bg-blue-100 text-blue-700',
  SEWING: 'bg-green-100 text-green-700',
  POST: 'bg-orange-100 text-orange-700',
  SPECIAL: 'bg-pink-100 text-pink-700',
  MATERIAL: 'bg-cyan-100 text-cyan-700',
  WAREHOUSE: 'bg-gray-100 text-gray-700',
}

interface StepsEditorProps {
  steps: TemplateStep[]
  onChange: (steps: TemplateStep[]) => void
  requiredProcessCodes?: string[]
  errors?: Record<number, string[]>
}

export function StepsEditor({ steps, onChange, requiredProcessCodes = [], errors = {} }: StepsEditorProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]))
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // 展开/折叠步骤
  const toggleExpand = (seq: number) => {
    const newSet = new Set(expandedSteps)
    if (newSet.has(seq)) {
      newSet.delete(seq)
    } else {
      newSet.add(seq)
    }
    setExpandedSteps(newSet)
  }

  // 新增步骤
  const handleAddStep = useCallback(() => {
    const newSeq = steps.length + 1
    const newStep: TemplateStep = {
      seq: newSeq,
      processCode: '',
      assignmentMode: 'DIRECT',
      ownerSuggestion: { kind: 'MAIN_FACTORY' },
      qcPoints: [],
      dependsOnSeq: newSeq > 1 ? [newSeq - 1] : [],
    }
    onChange([...steps, newStep])
    setExpandedSteps(prev => new Set([...prev, newSeq]))
  }, [steps, onChange])

  // 删除步骤
  const handleDeleteStep = useCallback((seq: number) => {
    const newSteps = steps
      .filter(s => s.seq !== seq)
      .map((s, idx) => ({ ...s, seq: idx + 1 }))
    // 重新计算 dependsOnSeq
    newSteps.forEach(s => {
      if (s.dependsOnSeq) {
        s.dependsOnSeq = s.dependsOnSeq
          .filter(depSeq => depSeq < seq)
          .map(depSeq => depSeq)
      }
    })
    onChange(newSteps)
    setDeleteConfirm(null)
  }, [steps, onChange])

  // 上移步骤
  const handleMoveUp = useCallback((seq: number) => {
    if (seq <= 1) return
    const newSteps = [...steps]
    const idx = newSteps.findIndex(s => s.seq === seq)
    if (idx > 0) {
      [newSteps[idx - 1], newSteps[idx]] = [newSteps[idx], newSteps[idx - 1]]
      newSteps.forEach((s, i) => { s.seq = i + 1 })
      onChange(newSteps)
    }
  }, [steps, onChange])

  // 下移步骤
  const handleMoveDown = useCallback((seq: number) => {
    if (seq >= steps.length) return
    const newSteps = [...steps]
    const idx = newSteps.findIndex(s => s.seq === seq)
    if (idx < newSteps.length - 1) {
      [newSteps[idx], newSteps[idx + 1]] = [newSteps[idx + 1], newSteps[idx]]
      newSteps.forEach((s, i) => { s.seq = i + 1 })
      onChange(newSteps)
    }
  }, [steps, onChange])

  // 清空所有步骤
  const handleClearAll = useCallback(() => {
    onChange([])
    setClearConfirmOpen(false)
    setExpandedSteps(new Set())
  }, [onChange])

  // 自动填充（根据 requiredProcessCodes）
  const handleAutoFill = useCallback(() => {
    if (requiredProcessCodes.length === 0) return
    const newSteps: TemplateStep[] = requiredProcessCodes.map((code, idx) => {
      const proc = getProcessTypeByCode(code)
      return {
        seq: idx + 1,
        processCode: code,
        assignmentMode: proc?.recommendedAssignmentMode || 'DIRECT',
        ownerSuggestion: proc?.recommendedAssignmentMode === 'BIDDING' 
          ? { 
              kind: 'RECOMMENDED_FACTORY_POOL' as const, 
              recommendedTier: proc?.recommendedOwnerTier || 'ANY',
              recommendedTypes: proc?.recommendedOwnerTypes || [],
            }
          : { kind: 'MAIN_FACTORY' as const },
        qcPoints: [],
        dependsOnSeq: idx > 0 ? [idx] : [],
      }
    })
    onChange(newSteps)
    setExpandedSteps(new Set(newSteps.map(s => s.seq)))
  }, [requiredProcessCodes, onChange])

  // 更新单个步骤
  const updateStep = useCallback((seq: number, updates: Partial<TemplateStep>) => {
    const newSteps = steps.map(s => 
      s.seq === seq ? { ...s, ...updates } : s
    )
    onChange(newSteps)
  }, [steps, onChange])

  // 更新 ownerSuggestion
  const updateOwnerSuggestion = useCallback((seq: number, updates: Partial<OwnerSuggestion>) => {
    const step = steps.find(s => s.seq === seq)
    if (!step) return
    const newSuggestion = { ...step.ownerSuggestion, ...updates }
    updateStep(seq, { ownerSuggestion: newSuggestion })
  }, [steps, updateStep])

  // 添加质检点
  const addQcPoint = useCallback((seq: number) => {
    const step = steps.find(s => s.seq === seq)
    if (!step) return
    updateStep(seq, { qcPoints: [...(step.qcPoints || []), ''] })
  }, [steps, updateStep])

  // 更新质检点
  const updateQcPoint = useCallback((seq: number, idx: number, value: string) => {
    const step = steps.find(s => s.seq === seq)
    if (!step) return
    const newQcPoints = [...(step.qcPoints || [])]
    newQcPoints[idx] = value
    updateStep(seq, { qcPoints: newQcPoints })
  }, [steps, updateStep])

  // 删除质检点
  const removeQcPoint = useCallback((seq: number, idx: number) => {
    const step = steps.find(s => s.seq === seq)
    if (!step) return
    const newQcPoints = (step.qcPoints || []).filter((_, i) => i !== idx)
    updateStep(seq, { qcPoints: newQcPoints })
  }, [steps, updateStep])

  return (
    <div className="space-y-4">
      {/* 工具条 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t('processTemplate.steps.title')}</h3>
        <div className="flex items-center gap-2">
          {requiredProcessCodes.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleAutoFill}>
              <Wand2 className="mr-1.5 h-4 w-4" />
              {t('processTemplate.steps.autoFill')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleAddStep}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('processTemplate.steps.add')}
          </Button>
          {steps.length > 0 && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setClearConfirmOpen(true)}>
              <Eraser className="mr-1.5 h-4 w-4" />
              {t('processTemplate.steps.clear')}
            </Button>
          )}
        </div>
      </div>

      {/* 步骤列表 */}
      {steps.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>{t('processTemplate.steps.emptyState')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step) => {
            const proc = getProcessTypeByCode(step.processCode)
            const isExpanded = expandedSteps.has(step.seq)
            const hasError = errors[step.seq] && errors[step.seq].length > 0

            return (
              <Card key={step.seq} className={cn(hasError && 'border-destructive')}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(step.seq)}>
                  <CardHeader className="p-3">
                    <div className="flex items-center gap-3">
                      {/* 序号 */}
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-mono text-sm font-medium">
                        {String(step.seq).padStart(2, '0')}
                      </div>
                      
                      {/* 工艺信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {proc ? (
                            <>
                              <span className="font-medium">{proc.nameZh}</span>
                              <Badge variant="outline" className={stageColors[proc.stage]}>
                                {stageLabels[proc.stage]}
                              </Badge>
                            </>
                          ) : step.processCode ? (
                            <span className="text-muted-foreground">{step.processCode}</span>
                          ) : (
                            <span className="text-muted-foreground italic">{t('processTemplate.steps.selectProcess')}</span>
                          )}
                          <Badge className={step.assignmentMode === 'DIRECT' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>
                            {step.assignmentMode === 'DIRECT' ? '派单' : '竞价'}
                          </Badge>
                        </div>
                        {hasError && (
                          <div className="text-xs text-destructive mt-1">
                            {errors[step.seq].join('; ')}
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={step.seq === 1}
                          onClick={(e) => { e.stopPropagation(); handleMoveUp(step.seq) }}
                          title={t('common.moveUp')}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={step.seq === steps.length}
                          onClick={(e) => { e.stopPropagation(); handleMoveDown(step.seq) }}
                          title={t('common.moveDown')}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(step.seq) }}
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4 space-y-4">
                      {/* 工艺选择 */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{t('processTemplate.steps.process')} *</Label>
                          <Select
                            value={step.processCode}
                            onValueChange={(value) => updateStep(step.seq, { processCode: value })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder={t('processTemplate.steps.selectProcess')} />
                            </SelectTrigger>
                            <SelectContent>
                              {processTypes.map(p => (
                                <SelectItem key={p.code} value={p.code}>
                                  <span>{p.nameZh}</span>
                                  <span className="text-muted-foreground ml-1">({p.code})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{t('processTemplate.steps.assignmentMode')}</Label>
                          <RadioGroup
                            value={step.assignmentMode}
                            onValueChange={(value) => updateStep(step.seq, { assignmentMode: value as 'DIRECT' | 'BIDDING' })}
                            className="flex gap-4 mt-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="DIRECT" id={`direct-${step.seq}`} />
                              <Label htmlFor={`direct-${step.seq}`} className="font-normal cursor-pointer">派单</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="BIDDING" id={`bidding-${step.seq}`} />
                              <Label htmlFor={`bidding-${step.seq}`} className="font-normal cursor-pointer">竞价</Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>

                      {/* 承接建议 */}
                      <div className="space-y-3">
                        <Label>{t('processTemplate.steps.ownerSuggestion')}</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">{t('processTemplate.steps.ownerKind')}</Label>
                            <Select
                              value={step.ownerSuggestion.kind}
                              onValueChange={(value) => updateOwnerSuggestion(step.seq, { 
                                kind: value as 'MAIN_FACTORY' | 'RECOMMENDED_FACTORY_POOL',
                                // 切换到主工厂时清除其他字段
                                ...(value === 'MAIN_FACTORY' ? { recommendedTier: undefined, recommendedTypes: undefined, requiredTags: undefined } : {})
                              })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MAIN_FACTORY">{t('ownerSuggestion.MAIN_FACTORY')}</SelectItem>
                                <SelectItem value="RECOMMENDED_FACTORY_POOL">{t('ownerSuggestion.RECOMMENDED_FACTORY_POOL')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {step.ownerSuggestion.kind === 'RECOMMENDED_FACTORY_POOL' && (
                            <div>
                              <Label className="text-xs text-muted-foreground">{t('processTemplate.steps.recommendedTier')}</Label>
                              <Select
                                value={step.ownerSuggestion.recommendedTier || 'ANY'}
                                onValueChange={(value) => updateOwnerSuggestion(step.seq, { 
                                  recommendedTier: value as 'ANY' | 'CENTRAL' | 'SATELLITE' | 'THIRD_PARTY'
                                })}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {tierOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {step.ownerSuggestion.kind === 'RECOMMENDED_FACTORY_POOL' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">{t('processTemplate.steps.recommendedTypes')}</Label>
                              <Input
                                placeholder="输入类型，逗号分隔"
                                value={(step.ownerSuggestion.recommendedTypes || []).join(', ')}
                                onChange={(e) => updateOwnerSuggestion(step.seq, { 
                                  recommendedTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                })}
                                className="mt-1"
                              />
                              <div className="flex flex-wrap gap-1 mt-1">
                                {factoryTypeOptions.slice(0, 6).map(type => (
                                  <Badge
                                    key={type}
                                    variant="outline"
                                    className="cursor-pointer hover:bg-accent text-xs"
                                    onClick={() => {
                                      const current = step.ownerSuggestion.recommendedTypes || []
                                      if (!current.includes(type)) {
                                        updateOwnerSuggestion(step.seq, { recommendedTypes: [...current, type] })
                                      }
                                    }}
                                  >
                                    + {type}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">{t('processTemplate.steps.requiredTags')}</Label>
                              <Input
                                placeholder="输入标签，逗号分隔"
                                value={(step.ownerSuggestion.requiredTags || []).join(', ')}
                                onChange={(e) => updateOwnerSuggestion(step.seq, { 
                                  requiredTags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                })}
                                className="mt-1"
                              />
                              <div className="flex flex-wrap gap-1 mt-1">
                                {tagOptions.slice(0, 4).map(tag => (
                                  <Badge
                                    key={tag}
                                    variant="outline"
                                    className="cursor-pointer hover:bg-accent text-xs"
                                    onClick={() => {
                                      const current = step.ownerSuggestion.requiredTags || []
                                      if (!current.includes(tag)) {
                                        updateOwnerSuggestion(step.seq, { requiredTags: [...current, tag] })
                                      }
                                    }}
                                  >
                                    + {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 质检点 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>{t('processTemplate.steps.qcPoints')}</Label>
                          <Button variant="ghost" size="sm" onClick={() => addQcPoint(step.seq)}>
                            <Plus className="mr-1 h-3 w-3" />
                            {t('processTemplate.steps.addQcPoint')}
                          </Button>
                        </div>
                        {(step.qcPoints || []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            未配置质检点，拆解时将使用工艺默认质检点
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {(step.qcPoints || []).map((qc, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Input
                                  value={qc}
                                  onChange={(e) => updateQcPoint(step.seq, idx, e.target.value)}
                                  placeholder={`质检点 ${idx + 1}`}
                                  className="flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeQcPoint(step.seq, idx)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 依赖步骤（只读展示） */}
                      {step.dependsOnSeq && step.dependsOnSeq.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">{t('processTemplate.steps.dependsOn')}</Label>
                          <div className="flex gap-1 mt-1">
                            {step.dependsOnSeq.map(depSeq => (
                              <Badge key={depSeq} variant="secondary">
                                步骤 {depSeq}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )
          })}
        </div>
      )}

      {/* 清空确认弹窗 */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('processTemplate.steps.clear')}</AlertDialogTitle>
            <AlertDialogDescription>{t('processTemplate.steps.clearConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('processTemplate.steps.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirm !== null && handleDeleteStep(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
