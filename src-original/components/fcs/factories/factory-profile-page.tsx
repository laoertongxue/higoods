'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Search, Plus, RotateCcw } from 'lucide-react'
import { FactoryTable } from './factory-table'
import { FactoryFormDialog } from './factory-form-dialog'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import type { Factory, FactoryFormData, FactoryTier, FactoryType } from '@/lib/fcs/factory-types'
import { factoryStatusConfig, factoryTierConfig, factoryTypeConfig, typesByTier } from '@/lib/fcs/factory-types'
import { mockFactories, generateFactoryCode, allCapabilityTags } from '@/lib/fcs/factory-mock-data'
import { t } from '@/lib/i18n'

const PAGE_SIZE = 10

export function FactoryProfilePage() {
  const [factories, setFactories] = useState<Factory[]>(mockFactories)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [pdaFilter, setPdaFilter] = useState<string>('all')

  const [sortField, setSortField] = useState<string>('code')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null)
  const [deletingFactory, setDeletingFactory] = useState<Factory | null>(null)

  const availableTypes = useMemo(() => {
    if (tierFilter !== 'all') {
      return typesByTier[tierFilter as FactoryTier] || []
    }
    return Object.keys(factoryTypeConfig) as FactoryType[]
  }, [tierFilter])

  const filteredFactories = useMemo(() => {
    let result = [...factories]

    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase()
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(keyword) ||
          f.code.toLowerCase().includes(keyword) ||
          f.contact.toLowerCase().includes(keyword) ||
          (f.phone ?? '').toLowerCase().includes(keyword)
      )
    }
    if (statusFilter !== 'all') result = result.filter((f) => f.status === statusFilter)
    if (tierFilter !== 'all') result = result.filter((f) => f.factoryTier === tierFilter)
    if (typeFilter !== 'all') result = result.filter((f) => f.factoryType === typeFilter)
    if (pdaFilter === 'enabled') result = result.filter((f) => f.pdaEnabled)
    if (pdaFilter === 'disabled') result = result.filter((f) => !f.pdaEnabled)

    result.sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      switch (sortField) {
        case 'code': aVal = a.code; bVal = b.code; break
        case 'name': aVal = a.name; bVal = b.name; break
        case 'status': aVal = a.status; bVal = b.status; break
        case 'tier': aVal = a.factoryTier; bVal = b.factoryTier; break
        default: aVal = a.code; bVal = b.code
      }
      if (typeof aVal === 'string') {
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      }
      return sortOrder === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal
    })

    return result
  }, [factories, searchKeyword, statusFilter, tierFilter, typeFilter, pdaFilter, sortField, sortOrder])

  const totalPages = Math.ceil(filteredFactories.length / PAGE_SIZE)
  const paginatedFactories = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredFactories.slice(start, start + PAGE_SIZE)
  }, [filteredFactories, currentPage])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleCreate = () => { setEditingFactory(null); setFormDialogOpen(true) }
  const handleEdit = (factory: Factory) => { setEditingFactory(factory); setFormDialogOpen(true) }
  const handleDelete = (factory: Factory) => { setDeletingFactory(factory); setDeleteDialogOpen(true) }

  const handleFormSubmit = (data: FactoryFormData) => {
    if (editingFactory) {
      setFactories((prev) =>
        prev.map((f) =>
          f.id === editingFactory.id
            ? {
                ...f,
                ...data,
                capabilities: allCapabilityTags.filter((tag) => data.capabilities.includes(tag.id)),
                updatedAt: new Date().toISOString().split('T')[0],
              }
            : f
        )
      )
    } else {
      const newFactory: Factory = {
        id: `f-${Date.now()}`,
        code: generateFactoryCode(),
        name: data.name,
        address: data.address,
        contact: data.contact,
        phone: data.phone,
        status: data.status,
        cooperationMode: data.cooperationMode,
        capabilities: allCapabilityTags.filter((tag) => data.capabilities.includes(tag.id)),
        monthlyCapacity: data.monthlyCapacity,
        qualityScore: 0,
        deliveryScore: 0,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        factoryTier: data.factoryTier,
        factoryType: data.factoryType,
        parentFactoryId: data.parentFactoryId,
        pdaEnabled: data.pdaEnabled,
        pdaTenantId: data.pdaTenantId,
        eligibility: data.eligibility,
      }
      setFactories((prev) => [newFactory, ...prev])
    }
  }

  const handleConfirmDelete = () => {
    if (deletingFactory) {
      setFactories((prev) => prev.filter((f) => f.id !== deletingFactory.id))
      setDeletingFactory(null)
    }
  }

  const handleReset = () => {
    setSearchKeyword('')
    setStatusFilter('all')
    setTierFilter('all')
    setTypeFilter('all')
    setPdaFilter('all')
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('factory.master.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理合作工厂的基本信息档案，包括组织层级、PDA配置、主链路资格门禁等核心主数据
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增工厂
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索名称、编号、联系人、电话..."
            value={searchKeyword}
            onChange={(e) => { setSearchKeyword(e.target.value); setCurrentPage(1) }}
            className="pl-9"
          />
        </div>

        <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setTypeFilter('all'); setCurrentPage(1) }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t('factory.fields.tier')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部层级</SelectItem>
            {(Object.keys(factoryTierConfig) as FactoryTier[]).map((tier) => (
              <SelectItem key={tier} value={tier}>{factoryTierConfig[tier].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1) }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('factory.fields.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {availableTypes.map((type) => (
              <SelectItem key={type} value={type}>{factoryTypeConfig[type].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={pdaFilter} onValueChange={(v) => { setPdaFilter(v); setCurrentPage(1) }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="PDA状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部PDA</SelectItem>
            <SelectItem value="enabled">已启用</SelectItem>
            <SelectItem value="disabled">未启用</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="工厂状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(factoryStatusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
        </Button>

        <div className="ml-auto text-sm text-muted-foreground">
          共 {filteredFactories.length} 条记录
        </div>
      </div>

      <FactoryTable
        factories={paginatedFactories}
        allFactories={factories}
        onEdit={handleEdit}
        onDelete={handleDelete}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            第 {currentPage} 页，共 {totalPages} 页
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) pageNum = i + 1
                else if (currentPage <= 3) pageNum = i + 1
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
                else pageNum = currentPage - 2 + i
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <FactoryFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        factory={editingFactory}
        allFactories={factories}
        onSubmit={handleFormSubmit}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        factory={deletingFactory}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
