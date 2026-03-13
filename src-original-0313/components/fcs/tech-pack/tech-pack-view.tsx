'use client'

import { useState, useEffect } from 'react'
import { useRouter } from '@/lib/navigation'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, AlertTriangle, Check, FileText, Upload, Plus, Trash2, Edit2,
  Package, Ruler, ClipboardList, Scissors, History, Image as ImageIcon, Paperclip, DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { useAppShell } from '@/components/app-shell/app-shell-context'
import { 
  getOrCreateTechPack, 
  updateTechPack, 
  calculateCompleteness,
  type TechPack,
  type TechPackBomItem,
  type TechPackProcess,
  type TechPackSizeRow,
} from '@/lib/fcs/tech-packs'

// 状态配置
const techPackStatusConfig: Record<string, { label: string; className: string }> = {
  MISSING: { label: t('techPackStatus.MISSING'), className: 'bg-red-100 text-red-700' },
  BETA: { label: t('techPackStatus.BETA'), className: 'bg-yellow-100 text-yellow-700' },
  RELEASED: { label: t('techPackStatus.RELEASED'), className: 'bg-green-100 text-green-700' },
}

// 当前用户 Mock
const currentUser = {
  id: 'U001',
  name: 'Budi Santoso',
  role: 'ADMIN' as const,
}

// 工序相关类型（模块级定义，避免 TDZ 问题）
type QualityCheckItem = { id: string; name: string; required: boolean; standard: string }
type TechniqueItem = {
  id: string
  stage: string
  process: string
  technique: string
  patternPieces: string[]
  standardTime: number
  timeUnit: string
  difficulty: string
  enableQualityCheck: boolean
  qualityChecks: QualityCheckItem[]
  remark: string
}

// Mock 数据提升到模块顶层，确保在 useState 初始化器执行前已就绪
const BOM_MOCK_DATA = [
  { id: 'bom-1', type: '面料', materialCode: 'FAB-001', materialName: '纯棉针织布', spec: '180g/m²', patternPieces: ['前片', '后片', '袖片'], usage: 0.8, lossRate: 3, printRequirement: '数码印', dyeRequirement: '无' },
  { id: 'bom-2', type: '面料', materialCode: 'FAB-002', materialName: '弹力罗纹', spec: '200g/m²', patternPieces: ['领片'], usage: 0.1, lossRate: 5, printRequirement: '无', dyeRequirement: '匹染' },
  { id: 'bom-3', type: '辅料', materialCode: 'ACC-001', materialName: '纽扣', spec: '15mm圆形', patternPieces: ['前片'], usage: 5, lossRate: 2, printRequirement: '无', dyeRequirement: '无' },
]

const PROCESS_MOCK_DATA: TechniqueItem[] = [
  {
    id: 'tech-1', stage: '生产阶段', process: '印花', technique: '数码印',
    patternPieces: ['前片'], standardTime: 10, timeUnit: '分钟/件', difficulty: '中等',
    enableQualityCheck: true, qualityChecks: [{ id: 'qc-1', name: '印花位置', required: true, standard: '误差≤2mm' }], remark: '图案必须居中',
  },
  {
    id: 'tech-2', stage: '生产阶段', process: '缝纫', technique: '平缝',
    patternPieces: ['前片', '后片'], standardTime: 15, timeUnit: '分钟/件', difficulty: '简单',
    enableQualityCheck: false, qualityChecks: [], remark: '',
  },
  {
    id: 'tech-3', stage: '准备阶段', process: '裁剪', technique: '自动裁剪',
    patternPieces: ['前片', '后片', '袖片', '领片'], standardTime: 5, timeUnit: '分钟/件', difficulty: '简单',
    enableQualityCheck: true, qualityChecks: [{ id: 'qc-2', name: '裁片尺寸', required: true, standard: '公差±1cm' }], remark: '',
  },
  {
    id: 'tech-4', stage: '后道阶段', process: '整烫', technique: '蒸汽整烫',
    patternPieces: [], standardTime: 3, timeUnit: '分钟/件', difficulty: '简单',
    enableQualityCheck: false, qualityChecks: [], remark: '',
  },
]

// 核价行类型（模块级）
type MaterialCostRow = { id: string; materialName: string; spec: string; usage: number; price: string; currency: string; unit: string }
type ProcessCostRow = { id: string; stage: string; process: string; technique: string; price: string; currency: string; unit: string }

interface TechPackPageProps {
  spuCode: string
}

export function TechPackPage({ spuCode }: TechPackPageProps) {
  const router = useRouter()
  const { closeTab } = useAppShell()

  // 本地状态 - 初始化时获取或创建技术包
  const [localTechPack, setLocalTechPack] = useState<TechPack | null>(null)
  const [loading, setLoading] = useState(true)

  // 发布确认 Dialog
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false)

  // 添加BOM Dialog
  const [addBomDialogOpen, setAddBomDialogOpen] = useState(false)
  const [newBomItem, setNewBomItem] = useState({
    type: '面料',
    materialCode: '',
    materialName: '',
    spec: '',
    patternPieces: [] as string[],
    usage: '',
    lossRate: '',
    printRequirement: '无',
    dyeRequirement: '无',
  })

  // 添加工序 Dialog
  const [addProcessDialogOpen, setAddProcessDialogOpen] = useState(false)
  const [newProcess, setNewProcess] = useState({
    name: '',
    timeMinutes: '',
    difficulty: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    qcPoint: '',
  })

  // 编辑纸样描述 Dialog
  const [editPatternDialogOpen, setEditPatternDialogOpen] = useState(false)
  const [editPatternDesc, setEditPatternDesc] = useState('')

  // BOM Tab 状态
  const [bomItems, setBomItems] = useState(BOM_MOCK_DATA)
  const [patternDialogOpen, setPatternDialogOpen] = useState(false)
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null)

  // 纸样列表 Tab 状态
  type PatternItem = { id: string; name: string; type: string; image: string; file: string; remark: string }
  const patternMockItems: PatternItem[] = [
    { id: 'PAT-001', name: '前片', type: '主体片', image: 'pattern-front.png', file: 'front.dxf', remark: '标准前片' },
    { id: 'PAT-002', name: '后片', type: '主体片', image: 'pattern-back.png', file: 'back.dxf', remark: '标准后片' },
  ]
  const [patternItems, setPatternItems] = useState<PatternItem[]>(patternMockItems)
  const [addPatternDialogOpen, setAddPatternDialogOpen] = useState(false)
  const [newPattern, setNewPattern] = useState<Omit<PatternItem, 'id'>>({ name: '', type: '主体片', image: '', file: '', remark: '' })
  const [editPatternItem, setEditPatternItem] = useState<PatternItem | null>(null)

  // 工序 Tab 状态
  const [techniques, setTechniques] = useState<TechniqueItem[]>(PROCESS_MOCK_DATA)
  const [addTechniqueDialogOpen, setAddTechniqueDialogOpen] = useState(false)
  const [currentStage, setCurrentStage] = useState('')
  const [currentProcess, setCurrentProcess] = useState('')
  const [newTechnique, setNewTechnique] = useState({
    technique: '',
    patternPieces: [] as string[],
    standardTime: '',
    timeUnit: '分钟/件',
    difficulty: '中等',
    enableQualityCheck: false,
    qualityChecks: [] as QualityCheckItem[],
    remark: '',
  })

  // 核价 Tab 状态 — 从 bomItems 和 techniques 派生，附加本地可编辑价格字段
  const [materialCostRows, setMaterialCostRows] = useState<MaterialCostRow[]>(() =>
    BOM_MOCK_DATA.map(b => ({
      id: b.id,
      materialName: b.materialName,
      spec: b.spec,
      usage: b.usage,
      price: '',
      currency: '人民币',
      unit: '人民币/件',
    }))
  )
  const [processCostRows, setProcessCostRows] = useState<ProcessCostRow[]>(() =>
    PROCESS_MOCK_DATA.map(t => ({
      id: t.id,
      stage: t.stage,
      process: t.process,
      technique: t.technique,
      price: '',
      currency: '人民币',
      unit: '人民币/件',
    }))
  )

  // 初始化获取或创建技术包
  useEffect(() => {
    // 使用 getOrCreateTechPack，如果不存在会自动创建beta版本
    const techPack = getOrCreateTechPack(spuCode)
    setLocalTechPack(techPack)
    setLoading(false)
  }, [spuCode])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!localTechPack) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>技术包不存在或已删除：{spuCode}</p>
        <Button
          variant="link"
          onClick={() => {
            closeTab(`tech-pack-${spuCode}`)
            router.back()
          }}
        >
          {t('common.back')}
        </Button>
      </div>
    )
  }

  // 关键项检查（替代旧完整度）
  const hasDesignRequirement = bomItems.some(b => b.printRequirement && b.printRequirement !== '无')
  const checklist = [
    {
      key: 'pattern',
      label: t('techPack.tabs.pattern'),
      required: true,
      done: patternItems.length > 0,
    },
    {
      key: 'bom',
      label: t('techPack.tabs.bom'),
      required: true,
      done: bomItems.length > 0,
    },
    {
      key: 'process',
      label: t('techPack.tabs.process'),
      required: true,
      done: techniques.length > 0,
    },
    {
      key: 'cost',
      label: '核价',
      required: true,
      // mock: 物料成本2条、工序成本2条，始终已完成（原型阶段）
      done: true,
    },
    {
      key: 'size',
      label: t('techPack.tabs.size'),
      required: true,
      done: localTechPack.sizeTable.length > 0,
    },
    {
      key: 'design',
      label: t('techPack.tabs.design'),
      required: hasDesignRequirement,
      done: localTechPack.patternDesigns.length > 0,
    },
  ]
  const hasIncomplete = checklist.some(c => c.required && !c.done)
  const canRelease = !hasIncomplete && localTechPack.status !== 'RELEASED'

  // 同步更新到全局store
  const syncToStore = (updated: TechPack) => {
    updateTechPack(spuCode, updated)
  }

  // 发布技术包
  const handleRelease = () => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const currentVersionNum = localTechPack.versionLabel === 'beta' ? 0 : parseInt(localTechPack.versionLabel.replace('v', '').split('.')[0]) || 0
    const newVersion = `v${currentVersionNum + 1}.0`

    const updated: TechPack = {
      ...localTechPack,
      status: 'RELEASED',
      versionLabel: newVersion,
      lastUpdatedAt: now,
      lastUpdatedBy: currentUser.name,
    }
    
    setLocalTechPack(updated)
    syncToStore(updated)
    setReleaseDialogOpen(false)
  }

  // 添加BOM项
  const handleAddBom = () => {
    if (!newBomItem.materialName) return

    const newItem = {
      id: `bom-${Date.now()}`,
      type: newBomItem.type || '面料',
      materialCode: newBomItem.materialCode,
      materialName: newBomItem.materialName,
      spec: newBomItem.spec,
      patternPieces: newBomItem.patternPieces,
      usage: parseFloat(newBomItem.usage) || 0,
      lossRate: parseFloat(newBomItem.lossRate) || 0,
      printRequirement: newBomItem.printRequirement,
      dyeRequirement: newBomItem.dyeRequirement,
    }

    // 添加到本地 bomItems 状态
    setBomItems(prev => [...prev, newItem])
    setNewBomItem({
      type: '面料',
      materialCode: '',
      materialName: '',
      spec: '',
      patternPieces: [],
      usage: '',
      lossRate: '',
      printRequirement: '无',
      dyeRequirement: '无',
    })
    setAddBomDialogOpen(false)
  }

  // 删除BOM项
  const handleDeleteBom = (bomId: string) => {
    const updated: TechPack = {
      ...localTechPack,
      bomItems: localTechPack.bomItems.filter(b => b.id !== bomId),
      lastUpdatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      lastUpdatedBy: currentUser.name,
    }
    setLocalTechPack(updated)
    syncToStore(updated)
  }

  // 添加工序
  const handleAddProcess = () => {
    if (!newProcess.name) return

    const maxSeq = Math.max(...localTechPack.processes.map(p => p.seq), 0)
    const newItem: TechPackProcess = {
      id: `PR-${Date.now()}`,
      seq: maxSeq + 1,
      name: newProcess.name,
      timeMinutes: parseInt(newProcess.timeMinutes) || 0,
      difficulty: newProcess.difficulty,
      qcPoint: newProcess.qcPoint,
    }

    const updated: TechPack = {
      ...localTechPack,
      processes: [...localTechPack.processes, newItem],
      lastUpdatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      lastUpdatedBy: currentUser.name,
    }

    setLocalTechPack(updated)
    syncToStore(updated)
    setNewProcess({ name: '', timeMinutes: '', difficulty: 'MEDIUM', qcPoint: '' })
    setAddProcessDialogOpen(false)
  }

  // 删除工序
  const handleDeleteProcess = (processId: string) => {
    const updated: TechPack = {
      ...localTechPack,
      processes: localTechPack.processes.filter(p => p.id !== processId),
      lastUpdatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      lastUpdatedBy: currentUser.name,
    }
    setLocalTechPack(updated)
    syncToStore(updated)
  }

  // 保存制版�����述
  const handleSavePatternDesc = () => {
    const updated: TechPack = {
      ...localTechPack,
      patternDesc: editPatternDesc,
      lastUpdatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      lastUpdatedBy: currentUser.name,
    }
    setLocalTechPack(updated)
    syncToStore(updated)
    setEditPatternDialogOpen(false)
  }

  // 打开编辑纸样描述
  const openEditPatternDesc = () => {
    setEditPatternDesc(localTechPack.patternDesc)
    setEditPatternDialogOpen(true)
  }

  const difficultyLabels: Record<string, string> = {
    LOW: '低',
    MEDIUM: '中',
    HIGH: '高',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">{t('techPack.title')} - {spuCode}</h1>
            <Badge className={techPackStatusConfig[localTechPack.status]?.className}>
              {techPackStatusConfig[localTechPack.status]?.label}
            </Badge>
            <span className="text-sm text-muted-foreground">({localTechPack.versionLabel})</span>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            {localTechPack.spuName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 关键项检�� */}
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/30">
            <span className="text-sm text-muted-foreground font-medium mr-1">{t('techPack.checklist')}:</span>
            {checklist.map(c => {
              let label: string
              let variant: 'default' | 'secondary' | 'outline' | 'destructive'
              let className: string
              if (!c.required) {
                label = t('techPack.optional')
                variant = 'outline'
                className = 'text-muted-foreground border-muted-foreground/30'
              } else if (c.done) {
                label = t('techPack.completed')
                variant = 'outline'
                className = 'text-green-700 border-green-400 bg-green-50'
              } else {
                label = t('techPack.incomplete')
                variant = 'outline'
                className = 'text-orange-700 border-orange-400 bg-orange-50'
              }
              return (
                <div key={c.key} className="flex flex-col items-center gap-0.5">
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                  <Badge variant={variant} className={`text-xs px-1.5 py-0 ${className}`}>{label}</Badge>
                </div>
              )
            })}
          </div>
          {/* 发布按钮 */}
          <div title={hasIncomplete ? t('techPack.publishBlocked') : undefined}>
            <Button
              variant="default"
              onClick={() => setReleaseDialogOpen(true)}
              disabled={!canRelease}
            >
              <Check className="mr-2 h-4 w-4" />
              {t('techPack.release')}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pattern" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="pattern" className="gap-2">
            <FileText className="h-4 w-4" />
            {t('techPack.tabs.pattern')}
          </TabsTrigger>
          <TabsTrigger value="bom" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            {t('techPack.tabs.bom')}
          </TabsTrigger>
          <TabsTrigger value="process" className="gap-2">
            <Scissors className="h-4 w-4" />
            {t('techPack.tabs.process')}
          </TabsTrigger>
          <TabsTrigger value="cost" className="gap-2">
            <DollarSign className="h-4 w-4" />
            核价
          </TabsTrigger>
          <TabsTrigger value="size" className="gap-2">
            <Ruler className="h-4 w-4" />
            {t('techPack.tabs.size')}
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            {t('techPack.tabs.design')}
          </TabsTrigger>
          <TabsTrigger value="attachments" className="gap-2">
            <Paperclip className="h-4 w-4" />
            {t('techPack.tabs.attachments')}
          </TabsTrigger>
        </TabsList>

        {/* 纸样 Tab */}
        <TabsContent value="pattern">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('techPack.patternTab')}</CardTitle>
              </div>
              <Button onClick={() => {
                setNewPattern({ name: '', type: '主体片', image: '', file: '', remark: '' })
                setEditPatternItem(null)
                setAddPatternDialogOpen(true)
              }}>
                <Plus className="mr-2 h-4 w-4" />
                {t('techPack.addPattern')}
              </Button>
            </CardHeader>
            <CardContent>
              {patternItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>暂无纸样</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('techPack.patternName')}</TableHead>
                      <TableHead>{t('techPack.patternType')}</TableHead>
                      <TableHead>{t('techPack.patternImage')}</TableHead>
                      <TableHead>{t('techPack.patternFile')}</TableHead>
                      <TableHead>{t('techPack.patternRemark')}</TableHead>
                      <TableHead>{t('common.action')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patternItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                        <TableCell>
                          {item.image ? (
                            <img
                              src={`/placeholder.svg?height=60&width=80`}
                              alt={item.name}
                              className="rounded border object-cover"
                              style={{ width: 80, height: 60 }}
                            />
                          ) : (
                            <span className="text-muted-foreground text-sm">无</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.file ? (
                            <Button variant="link" size="sm" className="p-0 h-auto">
                              {item.file}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">无</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.remark || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setEditPatternItem(item)
                              setNewPattern({ name: item.name, type: item.type, image: item.image, file: item.file, remark: item.remark })
                              setAddPatternDialogOpen(true)
                            }}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setPatternItems(prev => prev.filter(p => p.id !== item.id))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* 新增/编辑纸样 Dialog */}
          <Dialog open={addPatternDialogOpen} onOpenChange={setAddPatternDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editPatternItem ? '编辑纸样' : t('techPack.addPattern')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t('techPack.patternName')} <span className="text-red-500">*</span></Label>
                  <Input className="mt-1" value={newPattern.name} onChange={e => setNewPattern(p => ({ ...p, name: e.target.value }))} placeholder="例如 前片" />
                </div>
                <div>
                  <Label>{t('techPack.patternType')}</Label>
                  <Select value={newPattern.type} onValueChange={v => setNewPattern(p => ({ ...p, type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="主体片">主体片</SelectItem>
                      <SelectItem value="结构片">结构片</SelectItem>
                      <SelectItem value="装饰片">装饰片</SelectItem>
                      <SelectItem value="其他">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('techPack.patternImage')}</Label>
                  <Input className="mt-1" value={newPattern.image} onChange={e => setNewPattern(p => ({ ...p, image: e.target.value }))} placeholder="图片文件名" />
                </div>
                <div>
                  <Label>{t('techPack.patternFile')}</Label>
                  <Input className="mt-1" value={newPattern.file} onChange={e => setNewPattern(p => ({ ...p, file: e.target.value }))} placeholder="纸样文件名，例如 front.dxf" />
                </div>
                <div>
                  <Label>{t('techPack.patternRemark')}</Label>
                  <Textarea className="mt-1" rows={2} value={newPattern.remark} onChange={e => setNewPattern(p => ({ ...p, remark: e.target.value }))} placeholder="备注信息" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddPatternDialogOpen(false)}>{t('common.cancel')}</Button>
                <Button
                  disabled={!newPattern.name}
                  onClick={() => {
                    if (editPatternItem) {
                      setPatternItems(prev => prev.map(p => p.id === editPatternItem.id ? { ...editPatternItem, ...newPattern } : p))
                    } else {
                      setPatternItems(prev => [...prev, { id: `PAT-${Date.now()}`, ...newPattern }])
                    }
                    setAddPatternDialogOpen(false)
                  }}
                >{t('common.confirm')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* 工序表 Tab */}
        <TabsContent value="process">
          {(() => {
            const stages = ['准备阶段', '生产阶段', '后道阶段']
            const processOptions: Record<string, string[]> = {
              '准备阶段': ['裁剪', '验布', '排版'],
              '生产阶段': ['印花', '缝纫', '绣花', '车缝', '拼接'],
              '后道阶段': ['整烫', '包装', '检验'],
            }
            const patternPieceOptions = ['前片', '后片', '袖片', '领片', '口袋']
            const timeUnitOptions = ['分钟/件', '分钟/批', '分钟/米', '分钟/打']
            const difficultyOptions = ['简单', '中等', '困难']

            const openAddTechnique = (stage: string, process: string) => {
              setCurrentStage(stage)
              setCurrentProcess(process)
              setNewTechnique({
                technique: '',
                patternPieces: [],
                standardTime: '',
                timeUnit: '分钟/件',
                difficulty: '中等',
                enableQualityCheck: false,
                qualityChecks: [],
                remark: '',
              })
              setAddTechniqueDialogOpen(true)
            }

            const handleAddTechnique = () => {
              if (!newTechnique.technique) return
              const item: TechniqueItem = {
                id: `tech-${Date.now()}`,
                stage: currentStage,
                process: currentProcess,
                technique: newTechnique.technique,
                patternPieces: newTechnique.patternPieces,
                standardTime: parseFloat(newTechnique.standardTime) || 0,
                timeUnit: newTechnique.timeUnit,
                difficulty: newTechnique.difficulty,
                enableQualityCheck: newTechnique.enableQualityCheck,
                qualityChecks: newTechnique.qualityChecks,
                remark: newTechnique.remark,
              }
              setTechniques(prev => [...prev, item])
              setAddTechniqueDialogOpen(false)
            }

            const deleteTechnique = (id: string) => {
              setTechniques(prev => prev.filter(t => t.id !== id))
            }

            const updateTechniqueField = (id: string, field: keyof TechniqueItem, value: any) => {
              setTechniques(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
            }

            const addQualityCheck = (techId: string) => {
              setTechniques(prev => prev.map(t => {
                if (t.id !== techId) return t
                return {
                  ...t,
                  qualityChecks: [...t.qualityChecks, { id: `qc-${Date.now()}`, name: '', required: true, standard: '' }]
                }
              }))
            }

            const removeQualityCheck = (techId: string, qcId: string) => {
              setTechniques(prev => prev.map(t => {
                if (t.id !== techId) return t
                return { ...t, qualityChecks: t.qualityChecks.filter(q => q.id !== qcId) }
              }))
            }

            const updateQualityCheck = (techId: string, qcId: string, field: keyof QualityCheckItem, value: any) => {
              setTechniques(prev => prev.map(t => {
                if (t.id !== techId) return t
                return {
                  ...t,
                  qualityChecks: t.qualityChecks.map(q => q.id === qcId ? { ...q, [field]: value } : q)
                }
              }))
            }

            return (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('techPack.tabs.process')}</CardTitle>
                    <CardDescription>阶段 → 工序 → 工艺</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" defaultValue={stages} className="space-y-2">
                      {stages.map(stage => (
                        <AccordionItem key={stage} value={stage} className="border rounded-lg px-4">
                          <AccordionTrigger className="text-base font-semibold">{stage}</AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-2">
                            {processOptions[stage].map(process => {
                              const items = techniques.filter(t => t.stage === stage && t.process === process)
                              return (
                                <div key={process} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-sm">{process}</h4>
                                    <Button variant="outline" size="sm" onClick={() => openAddTechnique(stage, process)}>
                                      <Plus className="h-3 w-3 mr-1" />
                                      添加工艺
                                    </Button>
                                  </div>
                                  {items.length === 0 ? (
                                    <p className="text-xs text-muted-foreground pl-2">暂无工艺</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {items.map(tech => (
                                        <Card key={tech.id} className="p-4 space-y-3">
                                          <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                              <p className="font-medium">{tech.technique}</p>
                                              <div className="flex flex-wrap gap-1">
                                                {tech.patternPieces.map(p => (
                                                  <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                                                ))}
                                              </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteTechnique(tech.id)}>
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <div className="grid grid-cols-3 gap-3 text-sm">
                                            <div>
                                              <Label className="text-xs text-muted-foreground">标准工时</Label>
                                              <div className="flex items-center gap-1">
                                                <Input
                                                  type="number"
                                                  className="h-8 w-20"
                                                  value={tech.standardTime}
                                                  onChange={e => updateTechniqueField(tech.id, 'standardTime', parseFloat(e.target.value) || 0)}
                                                />
                                                <Select value={tech.timeUnit} onValueChange={v => updateTechniqueField(tech.id, 'timeUnit', v)}>
                                                  <SelectTrigger className="h-8 w-24">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {timeUnitOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            </div>
                                            <div>
                                              <Label className="text-xs text-muted-foreground">难度</Label>
                                              <Select value={tech.difficulty} onValueChange={v => updateTechniqueField(tech.id, 'difficulty', v)}>
                                                <SelectTrigger className="h-8">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {difficultyOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Switch
                                                checked={tech.enableQualityCheck}
                                                onCheckedChange={v => updateTechniqueField(tech.id, 'enableQualityCheck', v)}
                                              />
                                              <Label className="text-xs">安排质检</Label>
                                            </div>
                                          </div>
                                          {tech.enableQualityCheck && (
                                            <div className="space-y-2">
                                              <div className="flex items-center justify-between">
                                                <Label className="text-xs text-muted-foreground">质检项</Label>
                                                <Button variant="ghost" size="sm" onClick={() => addQualityCheck(tech.id)}>
                                                  <Plus className="h-3 w-3 mr-1" />
                                                  新增
                                                </Button>
                                              </div>
                                              {tech.qualityChecks.length > 0 && (
                                                <Table>
                                                  <TableHeader>
                                                    <TableRow>
                                                      <TableHead className="text-xs">检查项名称</TableHead>
                                                      <TableHead className="text-xs w-20">必检</TableHead>
                                                      <TableHead className="text-xs">标准要求</TableHead>
                                                      <TableHead className="text-xs w-12" />
                                                    </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                    {tech.qualityChecks.map(qc => (
                                                      <TableRow key={qc.id}>
                                                        <TableCell>
                                                          <Input
                                                            className="h-7 text-xs"
                                                            value={qc.name}
                                                            onChange={e => updateQualityCheck(tech.id, qc.id, 'name', e.target.value)}
                                                            placeholder="检查项名称"
                                                          />
                                                        </TableCell>
                                                        <TableCell>
                                                          <Switch
                                                            checked={qc.required}
                                                            onCheckedChange={v => updateQualityCheck(tech.id, qc.id, 'required', v)}
                                                          />
                                                        </TableCell>
                                                        <TableCell>
                                                          <Input
                                                            className="h-7 text-xs"
                                                            value={qc.standard}
                                                            onChange={e => updateQualityCheck(tech.id, qc.id, 'standard', e.target.value)}
                                                            placeholder="标准要求"
                                                          />
                                                        </TableCell>
                                                        <TableCell>
                                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => removeQualityCheck(tech.id, qc.id)}>
                                                            <Trash2 className="h-3 w-3" />
                                                          </Button>
                                                        </TableCell>
                                                      </TableRow>
                                                    ))}
                                                  </TableBody>
                                                </Table>
                                              )}
                                            </div>
                                          )}
                                          <div>
                                            <Label className="text-xs text-muted-foreground">备注</Label>
                                            <Textarea
                                              className="mt-1 text-sm"
                                              rows={2}
                                              value={tech.remark}
                                              onChange={e => updateTechniqueField(tech.id, 'remark', e.target.value)}
                                              placeholder="备注信息"
                                            />
                                          </div>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>

                {/* 添加工艺 Dialog */}
                <Dialog open={addTechniqueDialogOpen} onOpenChange={setAddTechniqueDialogOpen}>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>添加工艺 - {currentStage} / {currentProcess}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>工艺名称 <span className="text-red-500">*</span></Label>
                        <Input
                          className="mt-1"
                          value={newTechnique.technique}
                          onChange={e => setNewTechnique(p => ({ ...p, technique: e.target.value }))}
                          placeholder="例如 数码印、平缝"
                        />
                      </div>
                      <div>
                        <Label>关联纸样</Label>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {patternPieceOptions.map(piece => (
                            <Badge
                              key={piece}
                              variant={newTechnique.patternPieces.includes(piece) ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => {
                                setNewTechnique(p => ({
                                  ...p,
                                  patternPieces: p.patternPieces.includes(piece)
                                    ? p.patternPieces.filter(x => x !== piece)
                                    : [...p.patternPieces, piece]
                                }))
                              }}
                            >
                              {piece}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>标准工时</Label>
                          <Input
                            className="mt-1"
                            type="number"
                            value={newTechnique.standardTime}
                            onChange={e => setNewTechnique(p => ({ ...p, standardTime: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label>工时单位</Label>
                          <Select value={newTechnique.timeUnit} onValueChange={v => setNewTechnique(p => ({ ...p, timeUnit: v }))}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {timeUnitOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>难度</Label>
                        <Select value={newTechnique.difficulty} onValueChange={v => setNewTechnique(p => ({ ...p, difficulty: v }))}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {difficultyOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>备注</Label>
                        <Textarea
                          className="mt-1"
                          rows={2}
                          value={newTechnique.remark}
                          onChange={e => setNewTechnique(p => ({ ...p, remark: e.target.value }))}
                          placeholder="备注信息"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddTechniqueDialogOpen(false)}>{t('common.cancel')}</Button>
                      <Button onClick={handleAddTechnique} disabled={!newTechnique.technique}>{t('common.confirm')}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )
          })()}
        </TabsContent>

        {/* 尺码表 Tab */}
        <TabsContent value="size">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('techPack.tabs.size')}</CardTitle>
                <CardDescription>各部位尺寸规格定义</CardDescription>
              </div>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                添加部位
              </Button>
            </CardHeader>
            <CardContent>
              {localTechPack.sizeTable.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Ruler className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>{t('common.noData')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>部位</TableHead>
                      <TableHead className="text-right">S</TableHead>
                      <TableHead className="text-right">M</TableHead>
                      <TableHead className="text-right">L</TableHead>
                      <TableHead className="text-right">XL</TableHead>
                      <TableHead className="text-right">公差(±)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localTechPack.sizeTable.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.part}</TableCell>
                        <TableCell className="text-right">{row.S}</TableCell>
                        <TableCell className="text-right">{row.M}</TableCell>
                        <TableCell className="text-right">{row.L}</TableCell>
                        <TableCell className="text-right">{row.XL}</TableCell>
                        <TableCell className="text-right">{row.tolerance}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BOM Tab */}
        <TabsContent value="bom">
          {(() => {
            // BOM 常量配置
            const printOptions = ['无', '数码印', '丝网印', '胶浆印', '烫金', '烫银', '转印', '其他']
            const dyeOptions = ['无', '匹染', '成衣染', '扎染', '渐变染', '其他']
            const patternMockInfo: Record<string, { name: string; image: string; desc: string }> = {
              '前片': { name: '前片', image: '/placeholder.svg?height=120&width=120', desc: '服装正面主体部分，包含门襟、口袋位置等细节。' },
              '后片': { name: '后片', image: '/placeholder.svg?height=120&width=120', desc: '服装背面主体部分，通常包含后育克或开衩设计。' },
              '袖片': { name: '袖片', image: '/placeholder.svg?height=120&width=120', desc: '左右袖片，包含袖山、袖口等结构。' },
              '领片': { name: '领片', image: '/placeholder.svg?height=120&width=120', desc: '领口部分，可能是罗纹领、翻领或立领。' },
              '口袋': { name: '口袋', image: '/placeholder.svg?height=120&width=120', desc: '贴袋或插袋结构，根据款式定位缝制。' },
            }

            return (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{t('techPack.tabs.bom')}</CardTitle>
                    <CardDescription>物料清单，定义生产所需的原材料和辅料</CardDescription>
                  </div>
                  <Button onClick={() => setAddBomDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加物料
                  </Button>
                </CardHeader>
                <CardContent>
                  {bomItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ClipboardList className="mx-auto h-12 w-12 mb-2 opacity-50" />
                      <p>{t('common.noData')}</p>
                      <Button variant="link" onClick={() => setAddBomDialogOpen(true)}>
                        添加物料
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>类型</TableHead>
                          <TableHead>物料编码</TableHead>
                          <TableHead>物料名称</TableHead>
                          <TableHead>规格</TableHead>
                          <TableHead>关联纸样</TableHead>
                          <TableHead className="text-right">单位用量</TableHead>
                          <TableHead className="text-right">损耗率(%)</TableHead>
                          <TableHead>印花需求</TableHead>
                          <TableHead>染色需求</TableHead>
                          <TableHead>{t('common.action')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bomItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Badge variant="outline">{item.type}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{item.materialCode}</TableCell>
                            <TableCell className="font-medium">{item.materialName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.spec || '-'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {item.patternPieces.map(p => (
                                  <Badge
                                    key={p}
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-secondary/80"
                                    onClick={() => { setSelectedPattern(p); setPatternDialogOpen(true) }}
                                  >
                                    {p}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{item.usage}</TableCell>
                            <TableCell className="text-right">{item.lossRate}%</TableCell>
                            <TableCell>
                              <Select
                                value={item.printRequirement}
                                onValueChange={v => setBomItems(prev => prev.map(b => b.id === item.id ? { ...b, printRequirement: v } : b))}
                              >
                                <SelectTrigger className="w-24 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {printOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.dyeRequirement}
                                onValueChange={v => setBomItems(prev => prev.map(b => b.id === item.id ? { ...b, dyeRequirement: v } : b))}
                              >
                                <SelectTrigger className="w-24 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {dyeOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setBomItems(prev => prev.filter(b => b.id !== item.id))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>

                {/* 纸样详情 Dialog */}
                <Dialog open={patternDialogOpen} onOpenChange={setPatternDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>纸样详情</DialogTitle>
                    </DialogHeader>
                    {selectedPattern && patternMockInfo[selectedPattern] && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={patternMockInfo[selectedPattern].image}
                            alt={patternMockInfo[selectedPattern].name}
                            className="h-24 w-24 rounded border object-cover"
                          />
                          <div>
                            <h4 className="font-semibold text-lg">{patternMockInfo[selectedPattern].name}</h4>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{patternMockInfo[selectedPattern].desc}</p>
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPatternDialogOpen(false)}>关闭</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Card>
            )
          })()}
        </TabsContent>

        {/* 核价 Tab */}
        <TabsContent value="cost">
          {(() => {
            const currencyOptions = ['人民币', '美元', '印尼盾']
            const materialUnitOptions = ['人民币/米', '人民币/码', '人民币/件', '美元/米', '美元/件', '印尼盾/件']
            const processUnitOptions = ['人民币/件', '人民币/批', '美元/件', '美元/批', '印尼盾/件', '印尼盾/批']

            const materialTotal = materialCostRows.reduce((sum, m) => sum + m.usage * (parseFloat(m.price) || 0), 0)
            const processTotal = processCostRows.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0)
            const grandTotal = materialTotal + processTotal

            return (
              <div className="space-y-6">
                {/* 物料标准成本 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('techPack.materialCost')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>物料名称</TableHead>
                          <TableHead>规格</TableHead>
                          <TableHead className="text-right">单位用量</TableHead>
                          <TableHead className="w-32">{t('techPack.standardPrice')}</TableHead>
                          <TableHead className="w-28">{t('techPack.currency')}</TableHead>
                          <TableHead className="w-36">{t('techPack.unit')}</TableHead>
                          <TableHead className="text-right">{t('techPack.amount')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materialCostRows.map(row => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.materialName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{row.spec || '-'}</TableCell>
                            <TableCell className="text-right">{row.usage}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="h-8 w-24"
                                value={row.price}
                                placeholder="0.00"
                                onChange={e => setMaterialCostRows(prev => prev.map(r => r.id === row.id ? { ...r, price: e.target.value } : r))}
                              />
                            </TableCell>
                            <TableCell>
                              <Select value={row.currency} onValueChange={v => setMaterialCostRows(prev => prev.map(r => r.id === row.id ? { ...r, currency: v } : r))}>
                                <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {currencyOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select value={row.unit} onValueChange={v => setMaterialCostRows(prev => prev.map(r => r.id === row.id ? { ...r, unit: v } : r))}>
                                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {materialUnitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {(row.usage * (parseFloat(row.price) || 0)).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* 工序标准成本 */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('techPack.processCost')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>阶段</TableHead>
                          <TableHead>工序</TableHead>
                          <TableHead>工艺</TableHead>
                          <TableHead className="w-32">{t('techPack.standardPrice')}</TableHead>
                          <TableHead className="w-28">{t('techPack.currency')}</TableHead>
                          <TableHead className="w-36">{t('techPack.unit')}</TableHead>
                          <TableHead className="text-right">{t('techPack.amount')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processCostRows.map(row => (
                          <TableRow key={row.id}>
                            <TableCell>{row.stage}</TableCell>
                            <TableCell>{row.process}</TableCell>
                            <TableCell className="font-medium">{row.technique}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="h-8 w-24"
                                value={row.price}
                                placeholder="0.00"
                                onChange={e => setProcessCostRows(prev => prev.map(r => r.id === row.id ? { ...r, price: e.target.value } : r))}
                              />
                            </TableCell>
                            <TableCell>
                              <Select value={row.currency} onValueChange={v => setProcessCostRows(prev => prev.map(r => r.id === row.id ? { ...r, currency: v } : r))}>
                                <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {currencyOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select value={row.unit} onValueChange={v => setProcessCostRows(prev => prev.map(r => r.id === row.id ? { ...r, unit: v } : r))}>
                                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {processUnitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {(parseFloat(row.price) || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* 成本汇总 */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t('techPack.materialCost')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{materialTotal.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t('techPack.processCost')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{processTotal.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t('techPack.totalCost')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold text-primary">{grandTotal.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )
          })()}
        </TabsContent>

        {/* 花型设计 Tab */}
        <TabsContent value="design">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('techPack.tabs.design')}</CardTitle>
                <CardDescription>花型图案��设计稿</CardDescription>
              </div>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                上传设计稿
              </Button>
            </CardHeader>
            <CardContent>
              {localTechPack.patternDesigns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>{t('common.noData')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {localTechPack.patternDesigns.map((design) => (
                    <div key={design.id} className="border rounded-lg p-2">
                      <div className="aspect-square bg-muted rounded flex items-center justify-center mb-2">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-center truncate">{design.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 附件 Tab */}
        <TabsContent value="attachments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('techPack.tabs.attachments')}</CardTitle>
                <CardDescription>其他相关文档和附件</CardDescription>
              </div>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                上传附件
              </Button>
            </CardHeader>
            <CardContent>
              {localTechPack.attachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Paperclip className="mx-auto h-12 w-12 mb-2 opacity-50" />
                  <p>{t('common.noData')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文件名</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>大小</TableHead>
                      <TableHead>上传时间</TableHead>
                      <TableHead>上传人</TableHead>
                      <TableHead>{t('common.action')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localTechPack.attachments.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.fileName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{file.fileType}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{file.fileSize}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{file.uploadedAt}</TableCell>
                        <TableCell className="text-sm">{file.uploadedBy}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">下载</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 发布确认 Dialog */}
      <AlertDialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('techPack.release')}</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将技术包 {spuCode} 发布为正式版本吗？发布后将生成新版本号，生产单可以正常拆解。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRelease}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 添加BOM Dialog */}
      <Dialog open={addBomDialogOpen} onOpenChange={setAddBomDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>添加物料</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            {/* 左侧 */}
            <div className="space-y-4">
              <div>
                <Label>物料类型</Label>
                <Select value={newBomItem.type} onValueChange={v => setNewBomItem(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="面料">面料</SelectItem>
                    <SelectItem value="辅料">辅料</SelectItem>
                    <SelectItem value="包装材料">包装材料</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>物料编码</Label>
                <Input
                  className="mt-1"
                  value={newBomItem.materialCode}
                  onChange={e => setNewBomItem(p => ({ ...p, materialCode: e.target.value }))}
                  placeholder="例如 FAB-001"
                />
              </div>
              <div>
                <Label>规格</Label>
                <Input
                  className="mt-1"
                  value={newBomItem.spec}
                  onChange={e => setNewBomItem(p => ({ ...p, spec: e.target.value }))}
                  placeholder="例如 180g/m²"
                />
              </div>
              <div>
                <Label>关联纸样</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {['前片', '后片', '袖片', '领片', '口袋'].map(piece => (
                    <Badge
                      key={piece}
                      variant={newBomItem.patternPieces.includes(piece) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setNewBomItem(p => ({
                          ...p,
                          patternPieces: p.patternPieces.includes(piece)
                            ? p.patternPieces.filter(x => x !== piece)
                            : [...p.patternPieces, piece]
                        }))
                      }}
                    >
                      {piece}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>单位用量</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={newBomItem.usage}
                  onChange={e => setNewBomItem(p => ({ ...p, usage: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            {/* 右侧 */}
            <div className="space-y-4">
              <div>
                <Label>物料名称 <span className="text-red-500">*</span></Label>
                <Input
                  className="mt-1"
                  value={newBomItem.materialName}
                  onChange={e => setNewBomItem(p => ({ ...p, materialName: e.target.value }))}
                  placeholder="例如 纯棉针织布"
                />
              </div>
              <div>
                <Label>损耗率(%)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={newBomItem.lossRate}
                  onChange={e => setNewBomItem(p => ({ ...p, lossRate: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>印花需求</Label>
                <Select value={newBomItem.printRequirement} onValueChange={v => setNewBomItem(p => ({ ...p, printRequirement: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="无">无</SelectItem>
                    <SelectItem value="数码印">数码印</SelectItem>
                    <SelectItem value="丝网印">丝网印</SelectItem>
                    <SelectItem value="胶浆印">胶浆印</SelectItem>
                    <SelectItem value="烫金">烫金</SelectItem>
                    <SelectItem value="烫银">烫银</SelectItem>
                    <SelectItem value="转印">转印</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>染色需求</Label>
                <Select value={newBomItem.dyeRequirement} onValueChange={v => setNewBomItem(p => ({ ...p, dyeRequirement: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="无">无</SelectItem>
                    <SelectItem value="匹染">匹染</SelectItem>
                    <SelectItem value="成衣染">成衣染</SelectItem>
                    <SelectItem value="扎染">扎染</SelectItem>
                    <SelectItem value="渐变染">渐变染</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBomDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddBom} disabled={!newBomItem.materialName}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加工序 Dialog */}
      <Dialog open={addProcessDialogOpen} onOpenChange={setAddProcessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加工序</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>工序名称 <span className="text-red-500">*</span></Label>
              <Input
                className="mt-1"
                value={newProcess.name}
                onChange={e => setNewProcess(p => ({ ...p, name: e.target.value }))}
                placeholder="如：裁剪、缝合、整烫"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>标准工时(分钟)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={newProcess.timeMinutes}
                  onChange={e => setNewProcess(p => ({ ...p, timeMinutes: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>难度</Label>
                <Select value={newProcess.difficulty} onValueChange={v => setNewProcess(p => ({ ...p, difficulty: v as 'LOW' | 'MEDIUM' | 'HIGH' }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">低</SelectItem>
                    <SelectItem value="MEDIUM">中</SelectItem>
                    <SelectItem value="HIGH">高</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>质检点</Label>
              <Input
                className="mt-1"
                value={newProcess.qcPoint}
                onChange={e => setNewProcess(p => ({ ...p, qcPoint: e.target.value }))}
                placeholder="如：检查尺寸、检查针距"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProcessDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddProcess} disabled={!newProcess.name}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑纸样描述 Dialog */}
      <Dialog open={editPatternDialogOpen} onOpenChange={setEditPatternDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑纸样说明</DialogTitle>
          </DialogHeader>
          <div>
            <Textarea
              className="min-h-[200px]"
              value={editPatternDesc}
              onChange={e => setEditPatternDesc(e.target.value)}
              placeholder="输入纸样说明..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPatternDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSavePatternDesc}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
