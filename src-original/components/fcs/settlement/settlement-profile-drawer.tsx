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
import type { SettlementProfileFormData, CycleType, PricingMode } from '@/lib/fcs/settlement-types'
import { cycleTypeConfig, pricingModeConfig } from '@/lib/fcs/settlement-types'

interface SettlementProfileDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: SettlementProfileFormData) => void
}

const currencies = ['CNY', 'USD', 'EUR', 'HKD']

export function SettlementProfileDrawer({
  open,
  onOpenChange,
  onSubmit,
}: SettlementProfileDrawerProps) {
  const [formData, setFormData] = useState<SettlementProfileFormData>({
    cycleType: 'MONTHLY',
    settlementDayRule: '',
    pricingMode: 'BY_PIECE',
    currency: 'CNY',
    effectiveFrom: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setFormData({
        cycleType: 'MONTHLY',
        settlementDayRule: '',
        pricingMode: 'BY_PIECE',
        currency: 'CNY',
        effectiveFrom: new Date().toISOString().split('T')[0],
      })
      setErrors({})
    }
  }, [open])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.cycleType) newErrors.cycleType = '请选择结算周期'
    if (!formData.pricingMode) newErrors.pricingMode = '请选择计价方式'
    if (!formData.currency) newErrors.currency = '请选择币种'
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
          <SheetTitle>新增结算版本</SheetTitle>
          <SheetDescription>
            创建新的结算配置版本，原有生效版本将自动失效
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <Label>结算周期 *</Label>
            <Select
              value={formData.cycleType}
              onValueChange={(v) => setFormData(prev => ({ ...prev, cycleType: v as CycleType }))}
            >
              <SelectTrigger className={errors.cycleType ? 'border-destructive' : ''}>
                <SelectValue placeholder="请选择结算周期" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(cycleTypeConfig) as CycleType[]).map(key => (
                  <SelectItem key={key} value={key}>{cycleTypeConfig[key].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.cycleType && <p className="text-xs text-destructive">{errors.cycleType}</p>}
          </div>

          <div className="space-y-2">
            <Label>结算日规则</Label>
            <Input
              placeholder="例如：每月25日、每周五"
              value={formData.settlementDayRule}
              onChange={(e) => setFormData(prev => ({ ...prev, settlementDayRule: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>计价方式 *</Label>
            <Select
              value={formData.pricingMode}
              onValueChange={(v) => setFormData(prev => ({ ...prev, pricingMode: v as PricingMode }))}
            >
              <SelectTrigger className={errors.pricingMode ? 'border-destructive' : ''}>
                <SelectValue placeholder="请选择计价方式" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(pricingModeConfig) as PricingMode[]).map(key => (
                  <SelectItem key={key} value={key}>{pricingModeConfig[key].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.pricingMode && <p className="text-xs text-destructive">{errors.pricingMode}</p>}
          </div>

          <div className="space-y-2">
            <Label>默认币种 *</Label>
            <Select
              value={formData.currency}
              onValueChange={(v) => setFormData(prev => ({ ...prev, currency: v }))}
            >
              <SelectTrigger className={errors.currency ? 'border-destructive' : ''}>
                <SelectValue placeholder="请选择币种" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.currency && <p className="text-xs text-destructive">{errors.currency}</p>}
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
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit}>确认创建</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
