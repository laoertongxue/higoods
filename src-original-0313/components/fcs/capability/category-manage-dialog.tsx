'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Plus, Pencil, Ban } from 'lucide-react'
import type { TagCategory, CategoryFormData, CapabilityTagFull } from '@/lib/fcs/capability-types'
import { tagStatusConfig } from '@/lib/fcs/capability-types'

interface CategoryManageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: TagCategory[]
  tags: CapabilityTagFull[]
  onAddCategory: (data: CategoryFormData) => void
  onEditCategory: (id: string, data: CategoryFormData) => void
  onToggleCategoryStatus: (id: string) => void
}

export function CategoryManageDialog({
  open,
  onOpenChange,
  categories,
  tags,
  onAddCategory,
  onEditCategory,
  onToggleCategoryStatus,
}: CategoryManageDialogProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<TagCategory | null>(null)
  const [formName, setFormName] = useState('')
  const [formError, setFormError] = useState('')
  const [disableConfirm, setDisableConfirm] = useState<TagCategory | null>(null)

  // 计算每个分类下的标签数量
  const getCategoryTagCount = (categoryId: string) => {
    return tags.filter(t => t.categoryId === categoryId).length
  }

  const handleOpenForm = (category?: TagCategory) => {
    if (category) {
      setEditingCategory(category)
      setFormName(category.name)
    } else {
      setEditingCategory(null)
      setFormName('')
    }
    setFormError('')
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingCategory(null)
    setFormName('')
    setFormError('')
  }

  const handleSubmitForm = () => {
    if (!formName.trim()) {
      setFormError('分类名称不能为空')
      return
    }

    const formData: CategoryFormData = {
      name: formName.trim(),
      status: editingCategory?.status || 'active',
      sortOrder: editingCategory?.sortOrder || categories.length + 1,
    }

    if (editingCategory) {
      onEditCategory(editingCategory.id, formData)
    } else {
      onAddCategory(formData)
    }
    handleCloseForm()
  }

  const handleToggleStatus = (category: TagCategory) => {
    if (category.status === 'active') {
      // 禁用前检查是否有标签
      const tagCount = getCategoryTagCount(category.id)
      if (tagCount > 0) {
        setDisableConfirm(category)
        return
      }
    }
    onToggleCategoryStatus(category.id)
  }

  const confirmDisable = () => {
    if (disableConfirm) {
      onToggleCategoryStatus(disableConfirm.id)
      setDisableConfirm(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>分类管理</DialogTitle>
            <DialogDescription>
              管理能力标签的分类，支持新增、编辑和禁用操作
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 新建/编辑表单 */}
            {showForm ? (
              <div className="rounded-lg border p-4 space-y-4">
                <h4 className="font-medium">
                  {editingCategory ? '编辑分类' : '新建分类'}
                </h4>
                <div className="space-y-2">
                  <Label htmlFor="categoryName">分类名称</Label>
                  <Input
                    id="categoryName"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value)
                      setFormError('')
                    }}
                    placeholder="请输入分类名称"
                  />
                  {formError && (
                    <p className="text-sm text-destructive">{formError}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSubmitForm}>
                    {editingCategory ? '保存' : '创建'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCloseForm}>
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => handleOpenForm()} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                新建分类
              </Button>
            )}

            {/* 分类列表 */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>分类名称</TableHead>
                    <TableHead>标签数量</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        暂无分类数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((category) => {
                      const tagCount = getCategoryTagCount(category.id)
                      const statusConfig = tagStatusConfig[category.status]
                      return (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell>{tagCount}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusConfig.color}>
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenForm(category)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleToggleStatus(category)}
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  {category.status === 'active' ? '禁用' : '启用'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 禁用确认弹窗 */}
      <AlertDialog open={!!disableConfirm} onOpenChange={() => setDisableConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认禁用分类</AlertDialogTitle>
            <AlertDialogDescription>
              该分类下有 {disableConfirm ? getCategoryTagCount(disableConfirm.id) : 0} 个标签，
              禁用后这些标签将无法被新工厂选择。确定要禁用吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisable}>确认禁用</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
