'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DefaultPenaltyRule, PenaltyRuleFormData, RuleType, RuleMode, SettlementStatus } from '@/lib/fcs/settlement-types'
import { ruleTypeConfig, ruleModeConfig } from '@/lib/fcs/settlement-types'

interface PenaltyRuleDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: DefaultPenaltyRule | null
  onSubmit: (data: PenaltyRuleFormData) => void
}

export function PenaltyRuleDrawer({
  open,
  onOpenChange,
  rule,
  onSubmit,
}: PenaltyRuleDrawerProps) {
  const [formData, setFormData] = useState<PenaltyRuleFormData>({
    ruleType: 'QUALITY_DEFECT',
    ruleMode: 'PERCENTAGE',
    ruleValue: 0,
    effectiveFrom: '',
    status: 'ACTIVE',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (rule) {
        setFormData({
          ruleType: rule.ruleType,
          ruleMode: rule.ruleMode,
          ruleValue: rule.ruleValue,
          effectiveFrom: rule.effectiveFrom,
          status: rule.status,
        })
      } else {
        setFormData({
          ruleType: 'QUALITY_DEFECT',
          ruleMode: 'PERCENTAGE',
          ruleValue: 0,
          effectiveFrom: new Date().toISOString().split('T')[0],
          status: 'ACTIVE',
        })
      }
      setErrors({})
    }
  }, [open, rule])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.ruleType) newErrors.ruleType = '请选择规则类型'
    if (!formData.ruleMode) newErrors.ruleMode = '请选择计算方式'
    if (formData.ruleValue <= 0) newErrors.ruleValue = '请输入有效数值'
    if (!formData.effectiveFrom) newErrors.effectiveFrom = '请选择生效日期'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      onSubmit(formData)
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{rule ? '编辑扣款规则' : '新增扣款规则'}</SheetTitle>
          <SheetDescription>
            {rule ? '修改默认扣款规则' : '添加新的默认扣款规则'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <Label>规则类型 *</Label>
            <Select
              value={formData.ruleType}
              onValueChange={(v) => setFormData(prev => ({ ...prev, ruleType: v as RuleType }))}
            >
              <SelectTrigger className={errors.ruleType ? 'border-destructive' : ''}>
                <SelectValue placeholder="请选择规则类型" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ruleTypeConfig) as RuleType[]).map(key => (
                  <SelectItem key={key} value={key}>{ruleTypeConfig[key].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.ruleType && <p className="text-xs text-destructive">{errors.ruleType}</p>}
          </div>

          <div className="space-y-2">
            <Label>计算方式 *</Label>
            <Select
              value={formData.ruleMode}
              onValueChange={(v) => setFormData(prev => ({ ...prev, ruleMode: v as RuleMode }))}
            >
              <SelectTrigger className={errors.ruleMode ? 'border-destructive' : ''}>
                <SelectValue placeholder="请选择计算方式" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ruleModeConfig) as RuleMode[]).map(key => (
                  <SelectItem key={key} value={key}>{ruleModeConfig[key].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.ruleMode && <p className="text-xs text-destructive">{errors.ruleMode}</p>}
          </div>

          <div className="space-y-2">
            <Label>
              数值 * {formData.ruleMode === 'PERCENTAGE' ? '(%)' : '(元)'}
            </Label>
            <Input
              type="number"
              min="0"
              step={formData.ruleMode === 'PERCENTAGE' ? '0.1' : '1'}
              placeholder={formData.ruleMode === 'PERCENTAGE' ? '例如：5' : '例如：100'}
              value={formData.ruleValue || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, ruleValue: parseFloat(e.target.value) || 0 }))}
              className={errors.ruleValue ? 'border-destructive' : ''}
            />
            {errors.ruleValue && <p className="text-xs text-destructive">{errors.ruleValue}</p>}
          </div>

          <div className="space-y-2">
            <Label>生效日期 *</Label>
            <Input
              type="date"
              value={formData.effectiveFrom}
              onChange={(e) => setFormData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
              className={errors.effectiveFrom ? 'border-destructive' : ''}
            />
            {errors.effectiveFrom && <p className="text-xs text-destructive">{errors.effectiveFrom}</p>}
          </div>

          <div className="space-y-2">
            <Label>状态</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as SettlementStatus }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">启用</SelectItem>
                <SelectItem value="INACTIVE">禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit}>确认保存</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
