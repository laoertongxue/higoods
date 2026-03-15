'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronDown, ChevronRight, PlusCircle, Pencil } from 'lucide-react'
import type {
  Factory,
  FactoryFormData,
  FactoryStatus,
  CooperationMode,
  FactoryTier,
  FactoryType,
} from '@/lib/fcs/factory-types'
import {
  factoryStatusConfig,
  cooperationModeConfig,
  capabilityCategories,
  factoryTierConfig,
  factoryTypeConfig,
  typesByTier,
} from '@/lib/fcs/factory-types'
import { allCapabilityTags } from '@/lib/fcs/factory-mock-data'
import { t } from '@/lib/i18n'
import {
  useFcs,
  permissionCatalog,
  type FactoryPdaUser,
  type FactoryPdaRole,
  type PermissionKey,
  type PdaRoleId,
} from '@/lib/fcs/fcs-store'

interface FactoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  factory?: Factory | null
  allFactories: Factory[]
  onSubmit: (data: FactoryFormData) => void
}

const initialFormData: FactoryFormData = {
  name: '',
  address: '',
  contact: '',
  phone: '',
  status: 'active',
  cooperationMode: 'general',
  capabilities: [],
  monthlyCapacity: 0,
  factoryTier: 'CENTRAL',
  factoryType: 'CENTRAL_POD',
  parentFactoryId: undefined,
  pdaEnabled: true,
  pdaTenantId: '',
  eligibility: {
    allowDispatch: true,
    allowBid: true,
    allowExecute: true,
    allowSettle: true,
  },
}

export function FactoryFormDialog({
  open,
  onOpenChange,
  factory,
  allFactories,
  onSubmit,
}: FactoryFormDialogProps) {
  const [formData, setFormData] = useState<FactoryFormData>(initialFormData)
  const isEditing = !!factory

  // PDA account & role management
  const {
    listFactoryPdaUsers,
    createFactoryPdaUser,
    toggleFactoryPdaUserLock,
    setFactoryPdaUserRole,
    listFactoryPdaRoles,
    createFactoryPdaRole,
    updateFactoryPdaRole,
    toggleFactoryPdaRole,
    computeEffectivePermissionsForUser,
  } = useFcs()
  const factoryId = factory?.id ?? ''
  const pdaUsers: FactoryPdaUser[] = open && factoryId ? listFactoryPdaUsers(factoryId) : []
  const pdaRoles: FactoryPdaRole[] = open && factoryId ? listFactoryPdaRoles(factoryId) : []

  // New user form state
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLoginId, setNewLoginId] = useState('')
  const [newRoleId, setNewRoleId] = useState<string>('ROLE_DISPATCH')

  // Role form state
  const [roleFormOpen, setRoleFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<FactoryPdaRole | null>(null)
  const [roleFormName, setRoleFormName] = useState('')
  const [roleFormPerms, setRoleFormPerms] = useState<PermissionKey[]>([])
  const [copyFromRoleId, setCopyFromRoleId] = useState<string>('')

  useEffect(() => {
    if (factory) {
      setFormData({
        name: factory.name,
        address: factory.address,
        contact: factory.contact,
        phone: factory.phone,
        status: factory.status,
        cooperationMode: factory.cooperationMode,
        capabilities: factory.capabilities.map((c) => c.id),
        monthlyCapacity: factory.monthlyCapacity,
        factoryTier: factory.factoryTier,
        factoryType: factory.factoryType,
        parentFactoryId: factory.parentFactoryId,
        pdaEnabled: factory.pdaEnabled,
        pdaTenantId: factory.pdaTenantId ?? '',
        eligibility: { ...factory.eligibility },
      })
    } else {
      setFormData(initialFormData)
    }
    // reset add-user form on drawer open/close
    setAddOpen(false)
    setNewName('')
    setNewLoginId('')
    setNewRoleId('ROLE_DISPATCH')
    setRoleFormOpen(false)
    setEditingRole(null)
    setRoleFormName('')
    setRoleFormPerms([])
    setCopyFromRoleId('')
  }, [factory, open])

  // 当 tier 变化时重置 type 为该 tier 第一个可用类型
  const handleTierChange = (tier: FactoryTier) => {
    const firstType = typesByTier[tier][0]
    setFormData((prev) => ({ ...prev, factoryTier: tier, factoryType: firstType }))
  }

  const handleCreatePdaUser = () => {
    if (!newName.trim() || !newLoginId.trim()) {
      toast.error(t('factory.pdaAuth.validation.required'))
      return
    }
    const result = createFactoryPdaUser({
      factoryId,
      name: newName.trim(),
      loginId: newLoginId.trim(),
      roleId: newRoleId as PdaRoleId,
      status: 'ACTIVE',
    })
    if (!result.ok) {
      toast.error(t(result.messageKey ?? 'factory.pdaAuth.validation.duplicateLoginId'))
      return
    }
    toast.success(t('factory.pdaAuth.create.actions.create') + ' ' + t('common.success'))
    setNewName('')
    setNewLoginId('')
    setNewRoleId('ROLE_DISPATCH')
    setAddOpen(false)
  }

  // Role form helpers
  const openCreateRoleForm = () => {
    setEditingRole(null)
    setRoleFormName('')
    setRoleFormPerms([])
    setCopyFromRoleId('')
    setRoleFormOpen(true)
  }

  const openEditRoleForm = (role: FactoryPdaRole) => {
    setEditingRole(role)
    setRoleFormName(role.roleName)
    setRoleFormPerms([...role.permissionKeys])
    setCopyFromRoleId('')
    setRoleFormOpen(true)
  }

  const handleCopyFromRole = (srcRoleId: string) => {
    setCopyFromRoleId(srcRoleId)
    const src = pdaRoles.find(r => r.roleId === srcRoleId)
    if (src) setRoleFormPerms([...src.permissionKeys])
  }

  const toggleFormPerm = (key: PermissionKey) => {
    setRoleFormPerms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const toggleGroupPerms = (group: string, selectAll: boolean) => {
    const groupKeys = permissionCatalog.filter(p => p.group === group).map(p => p.key)
    if (selectAll) {
      setRoleFormPerms(prev => [...new Set([...prev, ...groupKeys])])
    } else {
      setRoleFormPerms(prev => prev.filter(k => !groupKeys.includes(k)))
    }
  }

  const handleSaveRole = () => {
    if (!roleFormName.trim()) {
      toast.error(t('factory.pdaAuth.roles.nameRequired'))
      return
    }
    if (editingRole) {
      const result = updateFactoryPdaRole(editingRole.roleId, factoryId, {
        roleName: roleFormName.trim(),
        permissionKeys: roleFormPerms,
      })
      if (!result.ok) { toast.error(t(result.messageKey ?? 'factory.pdaAuth.roles.notFound')); return }
      toast.success(t('factory.pdaAuth.roles.edit') + ' ' + t('common.success'))
    } else {
      createFactoryPdaRole(factoryId, roleFormName.trim(), roleFormPerms)
      toast.success(t('factory.pdaAuth.roles.create') + ' ' + t('common.success'))
    }
    setRoleFormOpen(false)
    setEditingRole(null)
    setRoleFormName('')
    setRoleFormPerms([])
  }

  const handleToggleRole = (role: FactoryPdaRole) => {
    const next: 'ACTIVE' | 'DISABLED' = role.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    const result = toggleFactoryPdaRole(role.roleId, factoryId, next)
    if (!result.ok) { toast.error(t(result.messageKey ?? 'factory.pdaAuth.roles.notFound')); return }
    toast.success(next === 'DISABLED' ? t('factory.pdaAuth.roles.disable') + ' ' + t('common.success') : t('factory.pdaAuth.roles.enable') + ' ' + t('common.success'))
  }

  // Group permissionCatalog by group for rendering
  const permGroups = permissionCatalog.reduce<Record<string, typeof permissionCatalog>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 校验：pdaEnabled=true 且 pdaTenantId 为空 → 阻断
    if (formData.pdaEnabled && !formData.pdaTenantId?.trim()) {
      toast.error(t('factory.pdaTenantId.required'))
      return
    }

    // 校验：tier=SATELLITE/THIRD_PARTY 且 parentFactoryId 为空 → toast 警告（不阻断）
    if (
      (formData.factoryTier === 'SATELLITE' || formData.factoryTier === 'THIRD_PARTY') &&
      !formData.parentFactoryId
    ) {
      toast.warning(t('factory.parent.warning'))
    }

    // 校验：eligibility 全 false → 提示风险（不阻断）
    const allDisabled = !Object.values(formData.eligibility).some(Boolean)
    if (allDisabled) {
      toast.warning(t('factory.eligibility.allDisabled.warning'))
    }

    onSubmit(formData)
    onOpenChange(false)
  }

  const handleCapabilityToggle = (tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(tagId)
        ? prev.capabilities.filter((id) => id !== tagId)
        : [...prev.capabilities, tagId],
    }))
  }

  const groupedTags = allCapabilityTags.reduce(
    (acc, tag) => {
      if (!acc[tag.category]) acc[tag.category] = []
      acc[tag.category].push(tag)
      return acc
    },
    {} as Record<string, typeof allCapabilityTags>
  )

  // 可选的上级工厂（排除自身）
  const parentCandidates = allFactories.filter(
    (f) => f.factoryTier === 'CENTRAL' && (!factory || f.id !== factory.id)
  )

  const availableTypes = typesByTier[formData.factoryTier]

  const eligibilityFlags = [
    { key: 'allowDispatch' as const, label: t('factory.eligibility.allowDispatch') },
    { key: 'allowBid'      as const, label: t('factory.eligibility.allowBid') },
    { key: 'allowExecute'  as const, label: t('factory.eligibility.allowExecute') },
    { key: 'allowSettle'   as const, label: t('factory.eligibility.allowSettle') },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col h-[100dvh] w-full sm:max-w-[720px]"
      >
        {/* Sticky header */}
        <SheetHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <SheetTitle>{isEditing ? '编辑工厂档案' : '新增工厂档案'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-6">

              {/* 基本信息 */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground border-b pb-1">基本信息</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">工厂名称 *</Label>
                    <Input id="name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="请输入工厂名称" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">联系人 *</Label>
                    <Input id="contact" value={formData.contact} onChange={(e) => setFormData((p) => ({ ...p, contact: e.target.value }))} placeholder="请输入联系人姓名" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">联系电话 *</Label>
                    <Input id="phone" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} placeholder="请输入联系电话" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyCapacity">月产能（件）</Label>
                    <Input id="monthlyCapacity" type="number" value={formData.monthlyCapacity} onChange={(e) => setFormData((p) => ({ ...p, monthlyCapacity: Number(e.target.value) }))} placeholder="请输入月产能" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">工厂地址 *</Label>
                  <Input id="address" value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} placeholder="请输入工厂详细地址" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>工厂状态</Label>
                    <Select value={formData.status} onValueChange={(v: FactoryStatus) => setFormData((p) => ({ ...p, status: v }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(factoryStatusConfig).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>合作模式</Label>
                    <Select value={formData.cooperationMode} onValueChange={(v: CooperationMode) => setFormData((p) => ({ ...p, cooperationMode: v }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(cooperationModeConfig).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 组织层级 */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground border-b pb-1">{t('factory.fields.tier')} / {t('factory.fields.type')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('factory.fields.tier')}</Label>
                    <Select value={formData.factoryTier} onValueChange={(v: FactoryTier) => handleTierChange(v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(factoryTierConfig) as FactoryTier[]).map((tier) => (
                          <SelectItem key={tier} value={tier}>{factoryTierConfig[tier].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('factory.fields.type')}</Label>
                    <Select value={formData.factoryType} onValueChange={(v: FactoryType) => setFormData((p) => ({ ...p, factoryType: v }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableTypes.map((type) => (
                          <SelectItem key={type} value={type}>{factoryTypeConfig[type].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">类型用于分配开始条件与产能/绩效归类</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('factory.fields.parent')}</Label>
                  <Select
                    value={formData.parentFactoryId ?? 'none'}
                    onValueChange={(v) => setFormData((p) => ({ ...p, parentFactoryId: v === 'none' ? undefined : v }))}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="请选择上级工厂（可选）" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— 无上级工厂 —</SelectItem>
                      {parentCandidates.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name} ({f.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(formData.factoryTier === 'SATELLITE' || formData.factoryTier === 'THIRD_PARTY') && (
                    <p className="text-xs text-amber-600">{t('factory.parent.hint')}</p>
                  )}
                  {formData.parentFactoryId && (
                    <p className="text-xs text-muted-foreground">
                      层级路径：{factoryTierConfig[formData.factoryTier].label} / {allFactories.find((f) => f.id === formData.parentFactoryId)?.name ?? formData.parentFactoryId}
                    </p>
                  )}
                </div>
              </div>

              {/* 当前生产流程资格开始条件 */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground border-b pb-1">{t('factory.eligibility.label')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  {eligibilityFlags.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <Switch
                        id={`eligibility-${key}`}
                        checked={formData.eligibility[key]}
                        onCheckedChange={(v) =>
                          setFormData((p) => ({ ...p, eligibility: { ...p.eligibility, [key]: v } }))
                        }
                      />
                      <Label htmlFor={`eligibility-${key}`} className="cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t('factory.eligibility.hint')}</p>
              </div>

              {/* 能力标签 */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground border-b pb-1">能力标签</h4>
                {Object.entries(groupedTags).map(([category, tags]) => (
                  <div key={category} className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {capabilityCategories[category as keyof typeof capabilityCategories]}
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      {tags.map((tag) => (
                        <div key={tag.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={tag.id}
                            checked={formData.capabilities.includes(tag.id)}
                            onCheckedChange={() => handleCapabilityToggle(tag.id)}
                          />
                          <Label htmlFor={tag.id} className="text-sm font-normal cursor-pointer">
                            {tag.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* PDA 配置 */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground border-b pb-1">PDA 配置（主数据）</h4>
                <div className="flex items-center gap-3">
                  <Switch
                    id="pdaEnabled"
                    checked={formData.pdaEnabled}
                    onCheckedChange={(v) => setFormData((p) => ({ ...p, pdaEnabled: v }))}
                  />
                  <Label htmlFor="pdaEnabled" className="cursor-pointer">{t('factory.fields.pdaEnabled')}</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdaTenantId">
                    {t('factory.fields.pdaTenantId')}
                    {formData.pdaEnabled && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    id="pdaTenantId"
                    value={formData.pdaTenantId ?? ''}
                    onChange={(e) => setFormData((p) => ({ ...p, pdaTenantId: e.target.value }))}
                    placeholder="默认与工厂ID一致，可自定义"
                    disabled={!formData.pdaEnabled}
                  />
                  <p className="text-xs text-muted-foreground">{t('factory.pda.hint')}</p>
                </div>
              </div>

              {/* PDA 账号与权限 */}
              <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground border-b pb-1">
                    {t('factory.pdaAuth.sectionTitle')}
                  </h4>

                  {!formData.pdaEnabled && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      {t('factory.pdaAuth.notice.pdaDisabled')}
                    </p>
                  )}

                  <Tabs defaultValue="users" className="w-full">
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="users">{t('factory.pdaAuth.tabs.users')}</TabsTrigger>
                      <TabsTrigger value="roles">{t('factory.pdaAuth.tabs.roles')}</TabsTrigger>
                      <TabsTrigger value="permissions">{t('factory.pdaAuth.tabs.permissions')}</TabsTrigger>
                    </TabsList>

                    {/* ── Tab 1: 账号列表 ── */}
                    <TabsContent value="users" className="mt-3 space-y-3">
                      {pdaUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">{t('factory.pdaAuth.users.empty')}</p>
                      ) : (
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">{t('factory.pdaAuth.users.columns.name')}</TableHead>
                                <TableHead className="text-xs">{t('factory.pdaAuth.users.columns.loginId')}</TableHead>
                                <TableHead className="text-xs">{t('factory.pdaAuth.users.columns.role')}</TableHead>
                                <TableHead className="text-xs">{t('factory.pdaAuth.users.columns.status')}</TableHead>
                                <TableHead className="text-xs">{t('factory.pdaAuth.users.columns.effectivePerms')}</TableHead>
                                <TableHead className="text-xs">{t('factory.pdaAuth.users.columns.actions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pdaUsers.map((u) => {
                                const userRole = pdaRoles.find(r => r.roleId === u.roleId)
                                const roleDisabled = userRole?.status === 'DISABLED'
                                const effectivePerms = computeEffectivePermissionsForUser(u.userId)
                                const permCountByGroup = permissionCatalog.reduce<Record<string, number>>((acc, p) => {
                                  if (effectivePerms.includes(p.key)) acc[p.group] = (acc[p.group] ?? 0) + 1
                                  return acc
                                }, {})
                                const activeRoles = pdaRoles.filter(r => r.status === 'ACTIVE')
                                return (
                                  <TableRow key={u.userId}>
                                    <TableCell className="text-sm py-2">{u.name}</TableCell>
                                    <TableCell className="text-xs py-2 font-mono">{u.loginId}</TableCell>
                                    <TableCell className="py-2 min-w-[120px]">
                                      <div className="space-y-1">
                                        <Select
                                          value={u.roleId}
                                          onValueChange={(v) => setFactoryPdaUserRole(u.userId, v)}
                                        >
                                          <SelectTrigger className="h-7 text-xs w-[120px]">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {activeRoles.map((r) => (
                                              <SelectItem key={r.roleId} value={r.roleId} className="text-xs">
                                                {r.roleName}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {roleDisabled && (
                                          <Badge variant="destructive" className="text-xs px-1 py-0">
                                            {t('factory.pdaAuth.users.roleDisabled')}
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <Badge variant={u.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                                        {u.status === 'ACTIVE' ? t('factory.pdaAuth.users.status.active') : t('factory.pdaAuth.users.status.locked')}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                                            {t('factory.pdaAuth.users.columns.viewPerms')}
                                            {Object.keys(permCountByGroup).length > 0 && (
                                              <span className="text-muted-foreground">({effectivePerms.length})</span>
                                            )}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 p-3" side="left">
                                          <p className="text-xs font-semibold mb-2">{t('factory.pdaAuth.users.columns.effectivePerms')}</p>
                                          {effectivePerms.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">无生效权限</p>
                                          ) : (
                                            <div className="space-y-2">
                                              {Object.entries(permGroups).map(([group, items]) => {
                                                const active = items.filter(i => effectivePerms.includes(i.key))
                                                if (active.length === 0) return null
                                                return (
                                                  <div key={group}>
                                                    <p className="text-xs text-muted-foreground font-medium">{t(`permGroup.${group}`)}</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                      {active.map(i => (
                                                        <Badge key={i.key} variant="outline" className="text-xs px-1 py-0">{i.nameZh}</Badge>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </PopoverContent>
                                      </Popover>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <Button
                                        type="button" variant="ghost" size="sm" className="h-7 text-xs"
                                        onClick={() => toggleFactoryPdaUserLock(u.userId, u.status === 'ACTIVE')}
                                      >
                                        {u.status === 'ACTIVE' ? t('factory.pdaAuth.users.actions.lock') : t('factory.pdaAuth.users.actions.unlock')}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {/* 新增账号（可折叠） */}
                      <Collapsible open={addOpen} onOpenChange={setAddOpen}>
                        <CollapsibleTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!formData.pdaEnabled}>
                            {addOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <PlusCircle className="h-3.5 w-3.5" />
                            {t('factory.pdaAuth.create.title')}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="rounded-md border p-4 space-y-3 bg-muted/30">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">{t('factory.pdaAuth.create.fields.name')} *</Label>
                                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('factory.pdaAuth.create.fields.name.placeholder')} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">{t('factory.pdaAuth.create.fields.loginId')} *</Label>
                                <Input value={newLoginId} onChange={e => setNewLoginId(e.target.value)} placeholder={t('factory.pdaAuth.create.fields.loginId.placeholder')} className="h-8 text-sm" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">{t('factory.pdaAuth.create.fields.role')}</Label>
                              <Select value={newRoleId} onValueChange={v => setNewRoleId(v)}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {pdaRoles.filter(r => r.status === 'ACTIVE').map(r => (
                                    <SelectItem key={r.roleId} value={r.roleId} className="text-sm">{r.roleName}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button type="button" variant="outline" size="sm" onClick={() => { setAddOpen(false); setNewName(''); setNewLoginId(''); setNewRoleId('ROLE_DISPATCH') }}>
                                {t('factory.pdaAuth.create.actions.cancel')}
                              </Button>
                              <Button type="button" size="sm" onClick={handleCreatePdaUser}>
                                {t('factory.pdaAuth.create.actions.create')}
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </TabsContent>

                    {/* ── Tab 2: 角色管理 ── */}
                    <TabsContent value="roles" className="mt-3 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">{t('factory.pdaAuth.roles.title')}</p>
                        <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={openCreateRoleForm} disabled={!formData.pdaEnabled}>
                          <PlusCircle className="h-3.5 w-3.5" />
                          {t('factory.pdaAuth.roles.create')}
                        </Button>
                      </div>

                      {/* Role create/edit inline form */}
                      {roleFormOpen && (
                        <div className="rounded-md border p-4 space-y-3 bg-muted/30">
                          <p className="text-xs font-semibold">{editingRole ? t('factory.pdaAuth.roles.edit') : t('factory.pdaAuth.roles.create')}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">{t('factory.pdaAuth.roles.form.roleName')} *</Label>
                              <Input value={roleFormName} onChange={e => setRoleFormName(e.target.value)} placeholder={t('factory.pdaAuth.roles.form.roleName.placeholder')} className="h-8 text-sm" />
                            </div>
                            {!editingRole && (
                              <div className="space-y-1.5">
                                <Label className="text-xs">{t('factory.pdaAuth.roles.form.copyFrom')}</Label>
                                <Select value={copyFromRoleId} onValueChange={handleCopyFromRole}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="— 不复制 —" /></SelectTrigger>
                                  <SelectContent>
                                    {pdaRoles.map(r => <SelectItem key={r.roleId} value={r.roleId} className="text-sm">{r.roleName}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t('factory.pdaAuth.roles.form.permissions')}</Label>
                            {Object.entries(permGroups).map(([group, items]) => {
                              const groupKeys = items.map(i => i.key)
                              const allSelected = groupKeys.every(k => roleFormPerms.includes(k))
                              return (
                                <div key={group} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">{t(`permGroup.${group}`)}</span>
                                    <div className="flex gap-2">
                                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggleGroupPerms(group, true)}>{t('factory.pdaAuth.roles.form.selectAll')}</button>
                                      <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => toggleGroupPerms(group, false)}>{t('factory.pdaAuth.roles.form.clearAll')}</button>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {items.map(item => (
                                      <div key={item.key} className="flex items-center gap-1.5">
                                        <Checkbox
                                          id={`perm-${item.key}`}
                                          checked={roleFormPerms.includes(item.key)}
                                          onCheckedChange={() => toggleFormPerm(item.key)}
                                        />
                                        <label htmlFor={`perm-${item.key}`} className="text-xs cursor-pointer">{item.nameZh}</label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => { setRoleFormOpen(false); setEditingRole(null) }}>{t('factory.pdaAuth.roles.cancel')}</Button>
                            <Button type="button" size="sm" onClick={handleSaveRole}>{t('factory.pdaAuth.roles.save')}</Button>
                          </div>
                        </div>
                      )}

                      {pdaRoles.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">{t('factory.pdaAuth.roles.empty')}</p>
                      ) : (
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">{t('factory.pdaAuth.roles.columns.name')}</TableHead>
                                <TableHead className="text-xs">{t('factory.pdaAuth.roles.columns.status')}</TableHead>
                                <TableHead className="text-xs text-center">{t('factory.pdaAuth.roles.columns.permCount')}</TableHead>
                                <TableHead className="text-xs text-center">{t('factory.pdaAuth.roles.columns.userCount')}</TableHead>
                                <TableHead className="text-xs">{t('factory.pdaAuth.roles.columns.actions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pdaRoles.map(role => {
                                const userCount = pdaUsers.filter(u => u.roleId === role.roleId).length
                                return (
                                  <TableRow key={role.roleId}>
                                    <TableCell className="text-sm py-2">
                                      <div className="flex items-center gap-1.5">
                                        {role.roleName}
                                        <Badge variant="outline" className="text-xs px-1 py-0">
                                          {role.isSystemPreset ? t('factory.pdaAuth.roles.preset') : t('factory.pdaAuth.roles.custom')}
                                        </Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <Badge variant={role.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                                        {role.status === 'ACTIVE' ? t('factory.pdaAuth.roles.status.active') : t('factory.pdaAuth.roles.status.disabled')}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-2 text-center text-sm tabular-nums">{role.permissionKeys.length}</TableCell>
                                    <TableCell className="py-2 text-center text-sm tabular-nums">{userCount}</TableCell>
                                    <TableCell className="py-2">
                                      <div className="flex gap-1">
                                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2" onClick={() => openEditRoleForm(role)}>
                                          <Pencil className="h-3 w-3" />{t('factory.pdaAuth.roles.edit')}
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => handleToggleRole(role)}>
                                          {role.status === 'ACTIVE' ? t('factory.pdaAuth.roles.disable') : t('factory.pdaAuth.roles.enable')}
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </TabsContent>

                    {/* ── Tab 3: 权限管理（只读字典） ── */}
                    <TabsContent value="permissions" className="mt-3 space-y-3">
                      <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">
                        {t('factory.pdaAuth.permissions.readonlyNotice')}
                      </p>
                      {Object.entries(permGroups).map(([group, items]) => (
                        <div key={group} className="space-y-1">
                          <p className="text-xs font-semibold text-foreground">{t(`permGroup.${group}`)}</p>
                          <div className="rounded-md border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="text-xs h-8">{t('factory.pdaAuth.permissions.columns.name')}</TableHead>
                                  <TableHead className="text-xs h-8 font-mono">{t('factory.pdaAuth.permissions.columns.key')}</TableHead>
                                  <TableHead className="text-xs h-8">{t('factory.pdaAuth.permissions.columns.desc')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map(item => (
                                  <TableRow key={item.key}>
                                    <TableCell className="text-sm py-2">{item.nameZh}</TableCell>
                                    <TableCell className="text-xs py-2 font-mono text-muted-foreground">{item.key}</TableCell>
                                    <TableCell className="text-xs py-2 text-muted-foreground">{item.descriptionZh}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

            </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 z-10 bg-background border-t px-6 py-4 flex justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit">{isEditing ? t('common.save') : '创建工厂'}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
