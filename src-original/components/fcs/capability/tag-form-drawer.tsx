'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CapabilityTagFull, TagFormData, TagCategory, TagStatus } from '@/lib/fcs/capability-types'

interface TagFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag?: CapabilityTagFull | null
  categories: TagCategory[]
  onSubmit: (data: TagFormData) => void
}

const initialFormData: TagFormData = {
  name: '',
  categoryId: '',
  description: '',
  status: 'active',
  isSystemTag: false,
}

export function TagFormDrawer({
  open,
  onOpenChange,
  tag,
  categories,
  onSubmit,
}: TagFormDrawerProps) {
  const [formData, setFormData] = useState<TagFormData>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEditing = !!tag

  useEffect(() => {
    if (tag) {
      setFormData({
        name: tag.name,
        categoryId: tag.categoryId,
        description: tag.description,
        status: tag.status,
        isSystemTag: tag.isSystemTag,
      })
    } else {
      setFormData(initialFormData)
    }
    setErrors({})
  }, [tag, open])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = '标签名称不能为空'
    }
    if (!formData.categoryId) {
      newErrors.categoryId = '请选择所属分类'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onSubmit(formData)
      onOpenChange(false)
    }
  }

  const activeCategories = categories.filter(c => c.status === 'active')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? '编辑标签' : '新建标签'}</SheetTitle>
          <SheetDescription>
            {isEditing ? '修改能力标签的信息' : '创建新的能力标签'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                标签名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="请输入标签名称"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">
                所属分类 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && (
                <p className="text-sm text-destructive">{errors.categoryId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="请输入标签描述"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={formData.status}
                onValueChange={(value: TagStatus) => setFormData((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="isSystemTag">系统标签</Label>
                <p className="text-sm text-muted-foreground">
                  系统标签不可被普通用户删除
                </p>
              </div>
              <Switch
                id="isSystemTag"
                checked={formData.isSystemTag}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isSystemTag: checked }))
                }
              />
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">{isEditing ? '保存' : '创建'}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
