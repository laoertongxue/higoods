'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Plus,
  Settings2,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Ban,
  ArrowUpDown,
  Check,
} from 'lucide-react'
import type { CapabilityTagFull, TagCategory, TagFormData, CategoryFormData, TagStatus } from '@/lib/fcs/capability-types'
import { tagStatusConfig } from '@/lib/fcs/capability-types'
import { tagCategories as initialCategories, capabilityTagsFull as initialTags } from '@/lib/fcs/capability-mock-data'
import { TagFormDrawer } from './tag-form-drawer'
import { CategoryManageDialog } from './category-manage-dialog'

const PAGE_SIZE = 10

export function CapabilityPage() {
  // 数据状态
  const [tags, setTags] = useState<CapabilityTagFull[]>(initialTags)
  const [categories, setCategories] = useState<TagCategory[]>(initialCategories)
  
  // 筛选状态
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSystemTag, setFilterSystemTag] = useState<boolean | null>(null)
  
  // 排序状态
  const [sortField, setSortField] = useState<'name' | 'usageCount'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  
  // 弹窗状态
  const [tagDrawerOpen, setTagDrawerOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<CapabilityTagFull | null>(null)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [disableConfirm, setDisableConfirm] = useState<CapabilityTagFull | null>(null)
  const [viewTag, setViewTag] = useState<CapabilityTagFull | null>(null)

  // 筛选和排序后的数据
  const filteredTags = useMemo(() => {
    let result = [...tags]

    // 关键词搜索
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      result = result.filter(t => t.name.toLowerCase().includes(keyword))
    }

    // 分类筛选
    if (filterCategory && filterCategory !== 'all') {
      result = result.filter(t => t.categoryId === filterCategory)
    }

    // 状态筛选
    if (filterStatus && filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus)
    }

    // 系统标签筛选
    if (filterSystemTag !== null) {
      result = result.filter(t => t.isSystemTag === filterSystemTag)
    }

    // 排序
    result.sort((a, b) => {
      if (sortField === 'name') {
        if (a.name < b.name) return sortOrder === 'asc' ? -1 : 1
        if (a.name > b.name) return sortOrder === 'asc' ? 1 : -1
        return 0
      } else {
        return sortOrder === 'asc' 
          ? a.usageCount - b.usageCount 
          : b.usageCount - a.usageCount
      }
    })

    return result
  }, [tags, searchKeyword, filterCategory, filterStatus, filterSystemTag, sortField, sortOrder])

  // 分页数据
  const paginatedTags = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredTags.slice(start, start + PAGE_SIZE)
  }, [filteredTags, currentPage])

  const totalPages = Math.ceil(filteredTags.length / PAGE_SIZE)

  // 重置筛选
  const handleReset = () => {
    setSearchKeyword('')
    setFilterCategory('all')
    setFilterStatus('all')
    setFilterSystemTag(null)
    setCurrentPage(1)
  }

  // 切换排序
  const handleSort = (field: 'name' | 'usageCount') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // 新建标签
  const handleCreateTag = () => {
    setEditingTag(null)
    setTagDrawerOpen(true)
  }

  // 编辑标签
  const handleEditTag = (tag: CapabilityTagFull) => {
    setEditingTag(tag)
    setTagDrawerOpen(true)
  }

  // 提交标签表单
  const handleSubmitTag = (data: TagFormData) => {
    const category = categories.find(c => c.id === data.categoryId)
    
    if (editingTag) {
      // 编辑
      setTags(prev => prev.map(t => 
        t.id === editingTag.id 
          ? { 
              ...t, 
              ...data, 
              categoryName: category?.name || '',
              updatedAt: new Date().toISOString().split('T')[0],
            }
          : t
      ))
    } else {
      // 新建
      const newTag: CapabilityTagFull = {
        id: `tag-${Date.now()}`,
        ...data,
        categoryName: category?.name || '',
        usageCount: 0,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      }
      setTags(prev => [...prev, newTag])
    }
  }

  // 禁用标签
  const handleDisableTag = (tag: CapabilityTagFull) => {
    setDisableConfirm(tag)
  }

  const confirmDisableTag = () => {
    if (disableConfirm) {
      setTags(prev => prev.map(t => 
        t.id === disableConfirm.id 
          ? { ...t, status: 'inactive' as TagStatus, updatedAt: new Date().toISOString().split('T')[0] }
          : t
      ))
      setDisableConfirm(null)
    }
  }

  // 分类管理
  const handleAddCategory = (data: CategoryFormData) => {
    const newCategory: TagCategory = {
      id: `cat-${Date.now()}`,
      ...data,
    }
    setCategories(prev => [...prev, newCategory])
  }

  const handleEditCategory = (id: string, data: CategoryFormData) => {
    setCategories(prev => prev.map(c => 
      c.id === id ? { ...c, ...data } : c
    ))
    // 更新标签中的分类名称
    setTags(prev => prev.map(t => 
      t.categoryId === id ? { ...t, categoryName: data.name } : t
    ))
  }

  const handleToggleCategoryStatus = (id: string) => {
    setCategories(prev => prev.map(c => 
      c.id === id 
        ? { ...c, status: c.status === 'active' ? 'inactive' as TagStatus : 'active' as TagStatus }
        : c
    ))
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">能力标签</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理工厂能力标签的分类和定义
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            分类管理
          </Button>
          <Button onClick={handleCreateTag}>
            <Plus className="mr-2 h-4 w-4" />
            新建标签
          </Button>
        </div>
      </div>

      {/* 筛选区域 */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">标签分类</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">标签状态</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">启用</SelectItem>
                <SelectItem value="inactive">禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">系统标签</Label>
            <Select 
              value={filterSystemTag === null ? 'all' : filterSystemTag ? 'yes' : 'no'} 
              onValueChange={(v) => setFilterSystemTag(v === 'all' ? null : v === 'yes')}
            >
              <SelectTrigger>
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="yes">是</SelectItem>
                <SelectItem value="no">否</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">关键词搜索</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标签名称"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground invisible">操作</Label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                重置
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer select-none"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  标签名称
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>所属分类</TableHead>
              <TableHead>状态</TableHead>
              <TableHead 
                className="cursor-pointer select-none"
                onClick={() => handleSort('usageCount')}
              >
                <div className="flex items-center gap-1">
                  使用次数
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>系统标签</TableHead>
              <TableHead>最近更新</TableHead>
              <TableHead className="w-[80px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              paginatedTags.map((tag) => {
                const statusConfig = tagStatusConfig[tag.status]
                return (
                  <TableRow key={tag.id}>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell>{tag.categoryName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{tag.usageCount}</TableCell>
                    <TableCell>
                      {tag.isSystemTag ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tag.updatedAt}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewTag(tag)}>
                            <Eye className="mr-2 h-4 w-4" />
                            查看
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditTag(tag)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          {tag.status === 'active' && (
                            <DropdownMenuItem 
                              onClick={() => handleDisableTag(tag)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              禁用
                            </DropdownMenuItem>
                          )}
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

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {filteredTags.length} 条记录
        </p>
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {/* 标签表单抽屉 */}
      <TagFormDrawer
        open={tagDrawerOpen}
        onOpenChange={setTagDrawerOpen}
        tag={editingTag}
        categories={categories}
        onSubmit={handleSubmitTag}
      />

      {/* 分类管理弹窗 */}
      <CategoryManageDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categories={categories}
        tags={tags}
        onAddCategory={handleAddCategory}
        onEditCategory={handleEditCategory}
        onToggleCategoryStatus={handleToggleCategoryStatus}
      />

      {/* 禁用确认弹窗 */}
      <AlertDialog open={!!disableConfirm} onOpenChange={() => setDisableConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认禁用标签</AlertDialogTitle>
            <AlertDialogDescription>
              确定要禁用标签「{disableConfirm?.name}」吗？禁用后该标签将不再显示在工厂能力选项中。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisableTag}>确认禁用</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 查看详情弹窗 */}
      <AlertDialog open={!!viewTag} onOpenChange={() => setViewTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>标签详情</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">标签名称：</span>
                  <span className="text-foreground">{viewTag?.name}</span>
                  <span className="text-muted-foreground">所属分类：</span>
                  <span className="text-foreground">{viewTag?.categoryName}</span>
                  <span className="text-muted-foreground">状态：</span>
                  <span className="text-foreground">{viewTag?.status === 'active' ? '启用' : '禁用'}</span>
                  <span className="text-muted-foreground">使用次数：</span>
                  <span className="text-foreground">{viewTag?.usageCount}</span>
                  <span className="text-muted-foreground">系统标签：</span>
                  <span className="text-foreground">{viewTag?.isSystemTag ? '是' : '否'}</span>
                  <span className="text-muted-foreground">描述：</span>
                  <span className="text-foreground">{viewTag?.description || '-'}</span>
                  <span className="text-muted-foreground">创建时间：</span>
                  <span className="text-foreground">{viewTag?.createdAt}</span>
                  <span className="text-muted-foreground">更新时间：</span>
                  <span className="text-foreground">{viewTag?.updatedAt}</span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>关闭</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
