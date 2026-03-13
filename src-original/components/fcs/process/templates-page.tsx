'use client'

import { useState, useMemo } from 'react'
import { useRouter } from '@/lib/navigation'
import { 
  Search, Plus, Copy, Download, MoreHorizontal, 
  Eye, Edit2, Power, PowerOff, ChevronDown, ChevronRight,
  FileText, AlertCircle, CheckCircle2, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppShell } from '@/components/app-shell/app-shell-context'
import { t } from '@/lib/i18n'
import { 
  routingTemplates, 
  getAllTemplateTags, 
  copyTemplate,
  templateAuditLogs,
  generateTemplateId,
  type RoutingTemplate,
  type TemplateStep,
} from '@/lib/fcs/routing-templates'
import { processTypes, getProcessTypeByCode, stageLabels } from '@/lib/fcs/process-types'
import { StepsEditor } from './steps-editor'
import { useToast } from '@/hooks/use-toast'

// 状态颜色配置
const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  INACTIVE: 'bg-gray-100 text-gray-700 border-gray-200',
}

// 分配模式颜色
const assignmentModeColors: Record<string, string> = {
  DIRECT: 'bg-blue-100 text-blue-700',
  BIDDING: 'bg-orange-100 text-orange-700',
}

// 编辑表单状态
interface EditFormState {
  name: string
  version: string
  description: string
  tags: string
  applicableCategory: string
  matchMode: 'MANUAL' | 'AUTO'
  requiredProcessCodes: string[]
  optionalProcessCodes: string[]
  keywords: string
  steps: TemplateStep[]
}

const emptyFormState: EditFormState = {
  name: '',
  version: 'v1.0',
  description: '',
  tags: '',
  applicableCategory: '',
  matchMode: 'AUTO',
  requiredProcessCodes: [],
  optionalProcessCodes: [],
  keywords: '',
  steps: [],
}

export function TemplatesPage() {
  const router = useRouter()
  const { addTab } = useAppShell()
  const { toast } = useToast()
  
  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [tagFilter, setTagFilter] = useState<string>('ALL')
  const [processFilter, setProcessFilter] = useState<string>('ALL')
  const [assignmentModeFilter, setAssignmentModeFilter] = useState<string>('ALL')
  
  // UI状态
  const [detailTemplate, setDetailTemplate] = useState<RoutingTemplate | null>(null)
  const [editTemplate, setEditTemplate] = useState<RoutingTemplate | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'enable' | 'disable' | 'copy'; template: RoutingTemplate } | null>(null)
  
  // 编辑表单状态
  const [formState, setFormState] = useState<EditFormState>(emptyFormState)
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({})
  
  // 本地数据（模拟可编辑）
  const [localTemplates, setLocalTemplates] = useState<RoutingTemplate[]>([...routingTemplates])
  
  // 获取所有标签
  const allTags = useMemo(() => getAllTemplateTags(), [])
  
  // 筛选结果
  const filteredTemplates = useMemo(() => {
    return localTemplates.filter(template => {
      // 关键词
      if (keyword) {
        const kw = keyword.toLowerCase()
        const matchName = template.name.toLowerCase().includes(kw)
        const matchTags = template.tags.some(tag => tag.toLowerCase().includes(kw))
        const matchDesc = template.description?.toLowerCase().includes(kw)
        if (!matchName && !matchTags && !matchDesc) return false
      }
      
      // 状态
      if (statusFilter !== 'ALL' && template.status !== statusFilter) return false
      
      // 标签
      if (tagFilter !== 'ALL' && !template.tags.includes(tagFilter)) return false
      
      // 包含工艺
      if (processFilter !== 'ALL') {
        const hasProcess = template.steps.some(step => step.processCode === processFilter)
        if (!hasProcess) return false
      }
      
      // 分配模式
      if (assignmentModeFilter !== 'ALL') {
        const directCount = template.steps.filter(s => s.assignmentMode === 'DIRECT').length
        const biddingCount = template.steps.filter(s => s.assignmentMode === 'BIDDING').length
        if (assignmentModeFilter === 'DIRECT' && biddingCount > 0) return false
        if (assignmentModeFilter === 'BIDDING' && directCount > 0) return false
        if (assignmentModeFilter === 'MIXED' && (directCount === 0 || biddingCount === 0)) return false
      }
      
      return true
    })
  }, [localTemplates, keyword, statusFilter, tagFilter, processFilter, assignmentModeFilter])
  
  // 重置筛选
  const handleReset = () => {
    setKeyword('')
    setStatusFilter('ALL')
    setTagFilter('ALL')
    setProcessFilter('ALL')
    setAssignmentModeFilter('ALL')
  }
  
  // 打开详情
  const handleViewDetail = (template: RoutingTemplate) => {
    setDetailTemplate(template)
  }
  
  // 启用/停用
  const handleToggleStatus = (template: RoutingTemplate, newStatus: 'ACTIVE' | 'INACTIVE') => {
    setLocalTemplates(prev => 
      prev.map(t => t.templateId === template.templateId ? { ...t, status: newStatus, updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19), updatedBy: 'Admin' } : t)
    )
    setConfirmDialog(null)
  }
  
  // 复制模板
  const handleCopyTemplate = (template: RoutingTemplate) => {
    const newTemplate = copyTemplate(template.templateId)
    if (newTemplate) {
      setLocalTemplates(prev => [...prev, newTemplate])
    }
    setConfirmDialog(null)
  }
  
  // 获取分配模式概览
  const getAssignmentOverview = (steps: TemplateStep[]) => {
    const direct = steps.filter(s => s.assignmentMode === 'DIRECT').length
    const bidding = steps.filter(s => s.assignmentMode === 'BIDDING').length
    return { direct, bidding }
  }
  
  // 打开编辑抽屉
  const openEditDrawer = (template: RoutingTemplate | null) => {
    if (template && template.templateId) {
      // 编辑现有模板
      setFormState({
        name: template.name,
        version: template.version,
        description: template.description || '',
        tags: template.tags.join(', '),
        applicableCategory: template.applicableCategory || '',
        matchMode: template.matchRule.mode,
        requiredProcessCodes: template.matchRule.requiredProcessCodes,
        optionalProcessCodes: template.matchRule.optionalProcessCodes,
        keywords: template.matchRule.keywords.join(', '),
        steps: JSON.parse(JSON.stringify(template.steps)), // 深拷贝
      })
    } else {
      // 新建模板
      setFormState(emptyFormState)
    }
    setStepErrors({})
    setEditTemplate(template)
  }
  
  // 关闭编辑抽屉
  const closeEditDrawer = () => {
    setEditTemplate(null)
    setFormState(emptyFormState)
    setStepErrors({})
  }
  
  // 校验步骤
  const validateSteps = (): boolean => {
    const errors: Record<number, string[]> = {}
    let valid = true
    
    if (formState.steps.length === 0) {
      toast({
        title: t('common.error'),
        description: t('processTemplate.steps.validation.atLeastOne'),
        variant: 'destructive',
      })
      return false
    }
    
    formState.steps.forEach(step => {
      const stepErrors: string[] = []
      if (!step.processCode) {
        stepErrors.push(t('processTemplate.steps.validation.processRequired'))
        valid = false
      }
      if (stepErrors.length > 0) {
        errors[step.seq] = stepErrors
      }
    })
    
    setStepErrors(errors)
    
    // 检查是否包含所有必须工艺（提示但不阻断）
    if (formState.requiredProcessCodes.length > 0) {
      const stepProcessCodes = formState.steps.map(s => s.processCode)
      const missingRequired = formState.requiredProcessCodes.filter(c => !stepProcessCodes.includes(c))
      if (missingRequired.length > 0) {
        toast({
          title: t('processTemplate.steps.validation.suggestRequired'),
          description: missingRequired.map(c => getProcessTypeByCode(c)?.nameZh || c).join(', '),
        })
      }
    }
    
    return valid
  }
  
  // 保存模板
  const handleSave = () => {
    if (!validateSteps()) return
    
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    
    // 重新排序 seq
    const normalizedSteps = formState.steps.map((step, idx) => ({
      ...step,
      seq: idx + 1,
    }))
    
    if (editTemplate?.templateId) {
      // 更新现有模板
      setLocalTemplates(prev => 
        prev.map(t => t.templateId === editTemplate.templateId ? {
          ...t,
          name: formState.name,
          version: formState.version,
          description: formState.description || undefined,
          tags: formState.tags.split(',').map(s => s.trim()).filter(Boolean),
          applicableCategory: formState.applicableCategory || undefined,
          matchRule: {
            mode: formState.matchMode,
            requiredProcessCodes: formState.requiredProcessCodes,
            optionalProcessCodes: formState.optionalProcessCodes,
            keywords: formState.keywords.split(',').map(s => s.trim()).filter(Boolean),
          },
          steps: normalizedSteps,
          updatedAt: now,
          updatedBy: 'Admin',
        } : t)
      )
      toast({
        title: t('common.success'),
        description: `模板 "${formState.name}" 已更新`,
      })
    } else {
      // 新建模板
      const newTemplate: RoutingTemplate = {
        templateId: generateTemplateId(),
        name: formState.name,
        status: 'INACTIVE',
        version: formState.version,
        description: formState.description || undefined,
        tags: formState.tags.split(',').map(s => s.trim()).filter(Boolean),
        applicableCategory: formState.applicableCategory || undefined,
        matchRule: {
          mode: formState.matchMode,
          requiredProcessCodes: formState.requiredProcessCodes,
          optionalProcessCodes: formState.optionalProcessCodes,
          keywords: formState.keywords.split(',').map(s => s.trim()).filter(Boolean),
        },
        steps: normalizedSteps,
        createdAt: now,
        createdBy: 'Admin',
        updatedAt: now,
        updatedBy: 'Admin',
      }
      setLocalTemplates(prev => [...prev, newTemplate])
      toast({
        title: t('common.success'),
        description: `模板 "${formState.name}" 已创建`,
      })
    }
    
    closeEditDrawer()
  }
  
  // 获取承接建议文本
  const getOwnerSuggestionText = (suggestion: TemplateStep['ownerSuggestion']) => {
    if (suggestion.kind === 'MAIN_FACTORY') {
      return t('ownerSuggestion.MAIN_FACTORY')
    }
    let text = t('ownerSuggestion.RECOMMENDED_FACTORY_POOL')
    if (suggestion.recommendedTier) {
      text += ` (${suggestion.recommendedTier})`
    }
    if (suggestion.recommendedTypes?.length) {
      text += `: ${suggestion.recommendedTypes.join(', ')}`
    }
    return text
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('process.template.title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 h-4 w-4" />
            {t('process.template.export')}
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Copy className="mr-1.5 h-4 w-4" />
            {t('process.template.copy')}
          </Button>
          <Button size="sm" onClick={() => openEditDrawer(null)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('process.template.create')}
          </Button>
        </div>
      </div>
      
      {/* FilterBar */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('process.template.filter.keyword')}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('process.template.filter.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="ACTIVE">{t('templateStatus.ACTIVE')}</SelectItem>
                <SelectItem value="INACTIVE">{t('templateStatus.INACTIVE')}</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('process.template.filter.tags')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={processFilter} onValueChange={setProcessFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('process.template.filter.processCode')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                {processTypes.map(p => (
                  <SelectItem key={p.code} value={p.code}>{p.nameZh}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={assignmentModeFilter} onValueChange={setAssignmentModeFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('process.template.filter.assignmentMode')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="DIRECT">{t('assignmentMode.DIRECT_ONLY')}</SelectItem>
                <SelectItem value="BIDDING">{t('assignmentMode.BIDDING_ONLY')}</SelectItem>
                <SelectItem value="MIXED">{t('assignmentMode.MIXED')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>{t('common.reset')}</Button>
            <Button size="sm">{t('common.search')}</Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">{t('process.template.table.name')}</TableHead>
                <TableHead className="w-[80px]">{t('process.template.table.version')}</TableHead>
                <TableHead className="w-[80px]">{t('process.template.table.status')}</TableHead>
                <TableHead className="w-[150px]">{t('process.template.table.tags')}</TableHead>
                <TableHead className="w-[80px]">{t('process.template.table.steps')}</TableHead>
                <TableHead className="w-[150px]">{t('process.template.table.assignmentOverview')}</TableHead>
                <TableHead className="w-[150px]">{t('process.template.table.matchRule')}</TableHead>
                <TableHead className="w-[150px]">{t('process.template.table.updatedAt')}</TableHead>
                <TableHead className="w-[100px]">{t('common.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => {
                const overview = getAssignmentOverview(template.steps)
                return (
                  <TableRow key={template.templateId}>
                    <TableCell>
                      <button 
                        className="text-left hover:text-primary hover:underline"
                        onClick={() => handleViewDetail(template)}
                      >
                        {template.name}
                      </button>
                    </TableCell>
                    <TableCell>{template.version}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[template.status]}>
                        {t(`templateStatus.${template.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                        {template.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{template.tags.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{template.steps.length}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={assignmentModeColors.DIRECT}>派{overview.direct}</Badge>
                        <Badge className={assignmentModeColors.BIDDING}>竞{overview.bidding}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t(`matchMode.${template.matchRule.mode}`)}</span>
                        {template.matchRule.requiredProcessCodes.length > 0 && (
                          <span className="ml-1">必须{template.matchRule.requiredProcessCodes.length}项</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {template.updatedAt.slice(0, 16)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetail(template)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('process.template.viewDetail')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDrawer(template)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            {t('process.template.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {template.status === 'ACTIVE' ? (
                            <DropdownMenuItem onClick={() => setConfirmDialog({ type: 'disable', template })}>
                              <PowerOff className="mr-2 h-4 w-4" />
                              {t('process.template.disable')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setConfirmDialog({ type: 'enable', template })}>
                              <Power className="mr-2 h-4 w-4" />
                              {t('process.template.enable')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setConfirmDialog({ type: 'copy', template })}>
                            <Copy className="mr-2 h-4 w-4" />
                            {t('process.template.copyVersion')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filteredTemplates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* 详情 Drawer */}
      <Sheet open={!!detailTemplate} onOpenChange={() => setDetailTemplate(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {detailTemplate && (
            <>
              <SheetHeader>
                <SheetTitle>{t('process.template.detail.title')}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* 基本信息 */}
                <div>
                  <h3 className="font-medium mb-3">{t('process.template.detail.basicInfo')}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">模板名称：</span>
                      <span>{detailTemplate.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">版本：</span>
                      <span>{detailTemplate.version}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">状态：</span>
                      <Badge variant="outline" className={statusColors[detailTemplate.status]}>
                        {t(`templateStatus.${detailTemplate.status}`)}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">适用类目：</span>
                      <span>{detailTemplate.applicableCategory || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">标签：</span>
                      <div className="inline-flex flex-wrap gap-1 ml-2">
                        {detailTemplate.tags.map(tag => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">描述：</span>
                      <span>{detailTemplate.description || '-'}</span>
                    </div>
                  </div>
                </div>
                
                {/* 匹配规则 */}
                <div>
                  <h3 className="font-medium mb-3">{t('process.template.detail.matchRule')}</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">匹配模式：</span>
                      <Badge variant="outline">{t(`matchMode.${detailTemplate.matchRule.mode}`)}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">必须工艺：</span>
                      <div className="inline-flex flex-wrap gap-1 ml-2">
                        {detailTemplate.matchRule.requiredProcessCodes.map(code => {
                          const proc = getProcessTypeByCode(code)
                          return <Badge key={code} variant="outline">{proc?.nameZh || code}</Badge>
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">可选工艺：</span>
                      <div className="inline-flex flex-wrap gap-1 ml-2">
                        {detailTemplate.matchRule.optionalProcessCodes.map(code => {
                          const proc = getProcessTypeByCode(code)
                          return <Badge key={code} variant="secondary">{proc?.nameZh || code}</Badge>
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">关键词：</span>
                      <div className="inline-flex flex-wrap gap-1 ml-2">
                        {detailTemplate.matchRule.keywords.map(kw => (
                          <Badge key={kw} variant="secondary">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 工艺步骤 */}
                <div>
                  <h3 className="font-medium mb-3">{t('process.template.detail.steps')}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">序号</TableHead>
                        <TableHead>工艺</TableHead>
                        <TableHead>阶段</TableHead>
                        <TableHead>分配</TableHead>
                        <TableHead>承接建议</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailTemplate.steps.map(step => {
                        const proc = getProcessTypeByCode(step.processCode)
                        return (
                          <TableRow key={step.seq}>
                            <TableCell>{step.seq}</TableCell>
                            <TableCell>
                              <div>{proc?.nameZh || step.processCode}</div>
                              <div className="text-xs text-muted-foreground">{step.processCode}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{proc ? stageLabels[proc.stage] : '-'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={assignmentModeColors[step.assignmentMode]}>
                                {step.assignmentMode === 'DIRECT' ? '派单' : '竞价'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {getOwnerSuggestionText(step.ownerSuggestion)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* 变更日志 */}
                <div>
                  <h3 className="font-medium mb-3">{t('process.template.detail.logs')}</h3>
                  <div className="space-y-2">
                    {templateAuditLogs
                      .filter(log => log.templateId === detailTemplate.templateId)
                      .map(log => (
                        <div key={log.id} className="flex items-start gap-3 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <div>{log.detail}</div>
                            <div className="text-xs text-muted-foreground">{log.at} · {log.by}</div>
                          </div>
                        </div>
                      ))}
                    {templateAuditLogs.filter(log => log.templateId === detailTemplate.templateId).length === 0 && (
                      <div className="text-sm text-muted-foreground">{t('common.noData')}</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      
      {/* 编辑 Drawer */}
      <Sheet open={!!editTemplate} onOpenChange={closeEditDrawer}>
        <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTemplate?.templateId ? t('process.template.edit') : t('process.template.create')}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('process.template.form.name')} *</Label>
                <Input 
                  placeholder="请输入模板名称" 
                  value={formState.name} 
                  onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1" 
                />
              </div>
              <div>
                <Label>{t('process.template.form.version')} *</Label>
                <Input 
                  placeholder="v1.0" 
                  value={formState.version}
                  onChange={(e) => setFormState(prev => ({ ...prev, version: e.target.value }))}
                  className="mt-1" 
                />
              </div>
            </div>
            <div>
              <Label>{t('process.template.form.description')}</Label>
              <Textarea 
                placeholder="请输入描述" 
                value={formState.description}
                onChange={(e) => setFormState(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('process.template.form.tags')}</Label>
                <Input 
                  placeholder="输入标签，用逗号分隔" 
                  value={formState.tags}
                  onChange={(e) => setFormState(prev => ({ ...prev, tags: e.target.value }))}
                  className="mt-1" 
                />
              </div>
              <div>
                <Label>适用类目</Label>
                <Input 
                  placeholder="如：针织、梭织、牛仔" 
                  value={formState.applicableCategory}
                  onChange={(e) => setFormState(prev => ({ ...prev, applicableCategory: e.target.value }))}
                  className="mt-1" 
                />
              </div>
            </div>
            
            {/* 匹配规则 */}
            <div className="pt-4 border-t space-y-4">
              <h3 className="font-medium">{t('process.template.detail.matchRule')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('process.template.form.matchMode')}</Label>
                  <Select
                    value={formState.matchMode}
                    onValueChange={(value) => setFormState(prev => ({ ...prev, matchMode: value as 'MANUAL' | 'AUTO' }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO">{t('matchMode.AUTO')}</SelectItem>
                      <SelectItem value="MANUAL">{t('matchMode.MANUAL')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('process.template.form.keywords')}</Label>
                  <Input 
                    placeholder="输入关键词，用逗号分隔" 
                    value={formState.keywords}
                    onChange={(e) => setFormState(prev => ({ ...prev, keywords: e.target.value }))}
                    className="mt-1" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('process.template.form.requiredProcesses')}</Label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (!formState.requiredProcessCodes.includes(value)) {
                        setFormState(prev => ({ ...prev, requiredProcessCodes: [...prev.requiredProcessCodes, value] }))
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="选择添加" />
                    </SelectTrigger>
                    <SelectContent>
                      {processTypes.filter(p => !formState.requiredProcessCodes.includes(p.code)).map(p => (
                        <SelectItem key={p.code} value={p.code}>{p.nameZh}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formState.requiredProcessCodes.map(code => {
                      const proc = getProcessTypeByCode(code)
                      return (
                        <Badge key={code} variant="default" className="cursor-pointer" onClick={() => {
                          setFormState(prev => ({ ...prev, requiredProcessCodes: prev.requiredProcessCodes.filter(c => c !== code) }))
                        }}>
                          {proc?.nameZh || code} ×
                        </Badge>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <Label>{t('process.template.form.optionalProcesses')}</Label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (!formState.optionalProcessCodes.includes(value)) {
                        setFormState(prev => ({ ...prev, optionalProcessCodes: [...prev.optionalProcessCodes, value] }))
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="选择添加" />
                    </SelectTrigger>
                    <SelectContent>
                      {processTypes.filter(p => !formState.optionalProcessCodes.includes(p.code)).map(p => (
                        <SelectItem key={p.code} value={p.code}>{p.nameZh}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formState.optionalProcessCodes.map(code => {
                      const proc = getProcessTypeByCode(code)
                      return (
                        <Badge key={code} variant="secondary" className="cursor-pointer" onClick={() => {
                          setFormState(prev => ({ ...prev, optionalProcessCodes: prev.optionalProcessCodes.filter(c => c !== code) }))
                        }}>
                          {proc?.nameZh || code} ×
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 工艺步骤编辑器 */}
            <div className="pt-4 border-t">
              <StepsEditor
                steps={formState.steps}
                onChange={(steps) => setFormState(prev => ({ ...prev, steps }))}
                requiredProcessCodes={formState.requiredProcessCodes}
                errors={stepErrors}
              />
            </div>
            
            {/* 底部按钮 */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={closeEditDrawer}>{t('common.cancel')}</Button>
              <Button onClick={handleSave} disabled={!formState.name || !formState.version}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      
      {/* 确认弹窗 */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.type === 'enable' && t('process.template.confirm.enable')}
              {confirmDialog?.type === 'disable' && t('process.template.confirm.disable')}
              {confirmDialog?.type === 'copy' && t('process.template.confirm.copy')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.template.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmDialog?.type === 'enable') {
                handleToggleStatus(confirmDialog.template, 'ACTIVE')
              } else if (confirmDialog?.type === 'disable') {
                handleToggleStatus(confirmDialog.template, 'INACTIVE')
              } else if (confirmDialog?.type === 'copy') {
                handleCopyTemplate(confirmDialog.template)
              }
            }}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
