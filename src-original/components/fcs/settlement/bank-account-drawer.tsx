'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import type { FactoryBankAccount, BankAccountFormData, SettlementStatus } from '@/lib/fcs/settlement-types'

interface BankAccountDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: FactoryBankAccount | null
  onSubmit: (data: BankAccountFormData) => void
}

const currencies = ['CNY', 'USD', 'EUR', 'HKD']

export function BankAccountDrawer({
  open,
  onOpenChange,
  account,
  onSubmit,
}: BankAccountDrawerProps) {
  const [formData, setFormData] = useState<BankAccountFormData>({
    accountName: '',
    bankName: '',
    accountMasked: '',
    currency: 'CNY',
    isDefault: false,
    status: 'ACTIVE',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (account) {
        setFormData({
          accountName: account.accountName,
          bankName: account.bankName,
          accountMasked: account.accountMasked,
          currency: account.currency,
          isDefault: account.isDefault,
          status: account.status,
        })
      } else {
        setFormData({
          accountName: '',
          bankName: '',
          accountMasked: '',
          currency: 'CNY',
          isDefault: false,
          status: 'ACTIVE',
        })
      }
      setErrors({})
    }
  }, [open, account])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.accountName.trim()) newErrors.accountName = '请输入账户名称'
    if (!formData.bankName.trim()) newErrors.bankName = '请输入银行名称'
    if (!formData.accountMasked.trim()) newErrors.accountMasked = '请输入账号'
    if (!formData.currency) newErrors.currency = '请选择币种'
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
          <SheetTitle>{account ? '编辑收款账户' : '新增收款账户'}</SheetTitle>
          <SheetDescription>
            {account ? '修改收款账户信息' : '添加新的收款账户'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <Label>账户名称 *</Label>
            <Input
              placeholder="请输入账户名称"
              value={formData.accountName}
              onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
              className={errors.accountName ? 'border-destructive' : ''}
            />
            {errors.accountName && <p className="text-xs text-destructive">{errors.accountName}</p>}
          </div>

          <div className="space-y-2">
            <Label>银行名称 *</Label>
            <Input
              placeholder="请输入银行名称"
              value={formData.bankName}
              onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
              className={errors.bankName ? 'border-destructive' : ''}
            />
            {errors.bankName && <p className="text-xs text-destructive">{errors.bankName}</p>}
          </div>

          <div className="space-y-2">
            <Label>银行账号 *</Label>
            <Input
              placeholder="请输入银行账号"
              value={formData.accountMasked}
              onChange={(e) => setFormData(prev => ({ ...prev, accountMasked: e.target.value }))}
              className={errors.accountMasked ? 'border-destructive' : ''}
            />
            {errors.accountMasked && <p className="text-xs text-destructive">{errors.accountMasked}</p>}
          </div>

          <div className="space-y-2">
            <Label>币种 *</Label>
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

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>设为默认账户</Label>
              <p className="text-xs text-muted-foreground">默认账户将用于结算付款</p>
            </div>
            <Switch
              checked={formData.isDefault}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
            />
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
