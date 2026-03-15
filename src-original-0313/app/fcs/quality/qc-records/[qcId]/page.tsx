'use client'

import { Suspense, useState, useEffect, useCallback, use } from 'react'
import { useRouter, useSearchParams } from '@/lib/navigation'
import {
  useFcs,
  type QualityInspection,
  type DefectItem,
  type QcResult,
  type QcDisposition,
  type RootCauseType,
  type LiabilityStatus,
  type SettlementPartyType,
} from '@/lib/fcs/fcs-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Plus, Trash2, ExternalLink, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── helpers ────────────────────────────────────────────────────────────────

function nowString() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

const DISPOSITION_LABEL: Record<QcDisposition, string> = {
  REWORK:           '返工',
  REMAKE:           '重做',
  ACCEPT_AS_DEFECT: '接受（瑕疵品）',
  SCRAP:            '报废',
  ACCEPT:           '接受（无扣款）',
}

const ROOT_CAUSE_LABEL: Record<RootCauseType, string> = {
  PROCESS:      '工艺问题',
  MATERIAL:     '面辅料问题',
  DYE_PRINT:    '染整/印花问题',
  CUTTING:      '裁剪问题',
  PATTERN_TECH: '版型/技术问题',
  UNKNOWN:      '未知',
}

const LIABILITY_LABEL: Record<LiabilityStatus, string> = {
  DRAFT:     '草稿',
  CONFIRMED: '已确认',
  DISPUTED:  '争议中',
  VOID:      '已作废',
}

const PARTY_TYPE_LABEL: Record<SettlementPartyType, string> = {
  FACTORY:        '工厂',
  SUPPLIER:       '供应商',
  PROCESSOR:      '外发商',
  GROUP_INTERNAL: '集团内部',
  OTHER:          '其他',
}

const NEEDS_AFFECTED_QTY: QcDisposition[] = ['REWORK', 'REMAKE', 'ACCEPT_AS_DEFECT']

// ── form state ─────────────────────────────────────────────────────────────

interface FormState {
  refType: 'TASK' | 'HANDOVER'
  refId: string
  productionOrderId: string
  inspector: string
  inspectedAt: string
  result: QcResult
  defectItems: DefectItem[]
  disposition: QcDisposition | ''
  affectedQty: number | ''
  rootCauseType: RootCauseType
  responsiblePartyType: SettlementPartyType | ''
  responsiblePartyId: string
  liabilityStatus: LiabilityStatus
  remark: string
}

function emptyForm(overrides?: Partial<FormState>): FormState {
  return {
    refType: 'TASK',
    refId: '',
    productionOrderId: '',
    inspector: '质检员A',
    inspectedAt: nowString(),
    result: 'PASS',
    defectItems: [],
    disposition: '',
    affectedQty: '',
    rootCauseType: 'UNKNOWN',
    responsiblePartyType: '',
    responsiblePartyId: '',
    liabilityStatus: 'DRAFT',
    remark: '',
    ...overrides,
  }
}

function qcToForm(qc: QualityInspection): FormState {
  return {
    refType: qc.refType,
    refId: qc.refId,
    productionOrderId: qc.productionOrderId,
    inspector: qc.inspector,
    inspectedAt: qc.inspectedAt,
    result: qc.result,
    defectItems: qc.defectItems,
    disposition: qc.disposition ?? '',
    affectedQty: qc.affectedQty ?? '',
    rootCauseType: qc.rootCauseType,
    responsiblePartyType: qc.responsiblePartyType ?? '',
    responsiblePartyId: qc.responsiblePartyId ?? '',
    liabilityStatus: qc.liabilityStatus,
    remark: qc.remark ?? '',
  }
}

// ── inner component (uses useSearchParams) ─────────────────────────────────

function QcRecordInner({ qcId }: { qcId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, getQcById, createQc, updateQc, submitQc, updateQcDispositionBreakdown } = useFcs()

  const isNew = qcId === 'new'
  const queryTaskId     = searchParams.get('taskId')     ?? ''
  const queryHandoverId = searchParams.get('handoverId') ?? ''

  // After save-draft on new, track the real qcId
  const [currentQcId, setCurrentQcId] = useState<string | null>(isNew ? null : qcId)

  // Pre-fill from query params
  const preTask = queryTaskId
    ? state.processTasks.find(t => t.taskId === queryTaskId)
    : undefined

  const initOverrides: Partial<FormState> = {}
  if (queryTaskId) {
    initOverrides.refType = 'TASK'
    initOverrides.refId   = queryTaskId
    if (preTask?.productionOrderId) initOverrides.productionOrderId = preTask.productionOrderId
  } else if (queryHandoverId) {
    initOverrides.refType = 'HANDOVER'
    initOverrides.refId   = queryHandoverId
  }

  const existingQc = currentQcId ? getQcById(currentQcId) : undefined

  const [form, setForm] = useState<FormState>(
    existingQc ? qcToForm(existingQc) : emptyForm(initOverrides)
  )

  // Sync form when store updates (e.g. after submit sets status=SUBMITTED)
  useEffect(() => {
    if (!currentQcId) return
    const qc = getQcById(currentQcId)
    if (qc) setForm(qcToForm(qc))
  }, [currentQcId, state.qualityInspections]) // eslint-disable-line react-hooks/exhaustive-deps

  const readOnly = existingQc?.status === 'SUBMITTED' || existingQc?.status === 'CLOSED'
  const isFail   = form.result === 'FAIL'
  const needsQty = NEEDS_AFFECTED_QTY.includes(form.disposition as QcDisposition)

  // ── 处置数量拆分 state ────────────────────────────────────────────────────
  const existingBd = existingQc?.dispositionQtyBreakdown
  const [bdRework,        setBdRework]        = useState<number | ''>(existingBd?.reworkQty        ?? '')
  const [bdRemake,        setBdRemake]        = useState<number | ''>(existingBd?.remakeQty        ?? '')
  const [bdAcceptDefect,  setBdAcceptDefect]  = useState<number | ''>(existingBd?.acceptAsDefectQty?? '')
  const [bdScrap,         setBdScrap]         = useState<number | ''>(existingBd?.scrapQty         ?? '')
  const [bdNoDeduct,      setBdNoDeduct]      = useState<number | ''>(existingBd?.acceptNoDeductQty?? '')

  // Sync breakdown inputs when store updates
  useEffect(() => {
    const bd = existingQc?.dispositionQtyBreakdown
    setBdRework(bd?.reworkQty        ?? '')
    setBdRemake(bd?.remakeQty        ?? '')
    setBdAcceptDefect(bd?.acceptAsDefectQty ?? '')
    setBdScrap(bd?.scrapQty          ?? '')
    setBdNoDeduct(bd?.acceptNoDeductQty    ?? '')
  }, [existingQc?.dispositionQtyBreakdown]) // eslint-disable-line react-hooks/exhaustive-deps

  const bdTarget  = existingQc?.affectedQty
  const bdSum     = (Number(bdRework) || 0) + (Number(bdRemake) || 0) + (Number(bdAcceptDefect) || 0) + (Number(bdScrap) || 0) + (Number(bdNoDeduct) || 0)
  const bdDelta   = bdTarget !== undefined ? bdTarget - bdSum : undefined
  const bdValid   = bdTarget === undefined || bdDelta === 0

  function handleBdQuickFill(field: 'rework' | 'remake' | 'defect' | 'scrap' | 'nodeduct') {
    const v = bdTarget ?? 0
    setBdRework(field === 'rework'   ? v : 0)
    setBdRemake(field === 'remake'   ? v : 0)
    setBdAcceptDefect(field === 'defect'  ? v : 0)
    setBdScrap(field === 'scrap'    ? v : 0)
    setBdNoDeduct(field === 'nodeduct' ? v : 0)
  }

  function handleSaveBreakdown() {
    if (!currentQcId) { toast.error('请先保存草稿再填写处置拆分'); return }
    const result = updateQcDispositionBreakdown(
      currentQcId,
      {
        reworkQty:         Number(bdRework)        || 0,
        remakeQty:         Number(bdRemake)        || 0,
        acceptAsDefectQty: Number(bdAcceptDefect)  || 0,
        scrapQty:          Number(bdScrap)         || 0,
        acceptNoDeductQty: Number(bdNoDeduct)      || 0,
      },
      '管理员',
    )
    if (result.ok) {
      toast.success('处置数量拆分已保存，可扣款数量已同步')
    } else {
      toast.error(result.message ?? '保存失败')
    }
  }

  // Max qty hint from ref task
  const refTask = state.processTasks.find(t => t.taskId === form.refId)
  const maxQty  = refTask?.qty

  // Basis items linked to this QC
  const basisItems = currentQcId
    ? state.deductionBasisItems.filter(
        b => b.sourceId === currentQcId || b.sourceRefId === currentQcId
      )
    : []

  const generatedTaskIds = existingQc?.generatedTaskIds ?? []

  // ── field helpers ────────────────────────────────────────────────────────

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }, [])

  function addDefect() {
    setForm(prev => ({
      ...prev,
      defectItems: [...prev.defectItems, { defectCode: '', defectName: '', qty: 1 }],
    }))
  }

  function removeDefect(idx: number) {
    setForm(prev => ({
      ...prev,
      defectItems: prev.defectItems.filter((_, i) => i !== idx),
    }))
  }

  function updateDefect(idx: number, patch: Partial<DefectItem>) {
    setForm(prev => ({
      ...prev,
      defectItems: prev.defectItems.map((d, i) => i === idx ? { ...d, ...patch } : d),
    }))
  }

  // ── build QC payload ─────────────────────────────────────────────────────

  function buildPayload(): Omit<QualityInspection, 'qcId' | 'status' | 'auditLogs' | 'createdAt' | 'updatedAt'> {
    return {
      refType: form.refType,
      refId: form.refId.trim(),
      productionOrderId: form.productionOrderId.trim(),
      inspector: form.inspector.trim(),
      inspectedAt: form.inspectedAt.trim(),
      result: form.result,
      defectItems: isFail ? form.defectItems : [],
      remark: form.remark.trim() || undefined,
      disposition: (isFail && form.disposition) ? (form.disposition as QcDisposition) : undefined,
      affectedQty: (isFail && needsQty && form.affectedQty !== '') ? Number(form.affectedQty) : undefined,
      rootCauseType: form.rootCauseType,
      responsiblePartyType: (form.responsiblePartyType as SettlementPartyType) || undefined,
      responsiblePartyId: form.responsiblePartyId.trim() || undefined,
      liabilityStatus: form.liabilityStatus,
      generatedTaskIds: existingQc?.generatedTaskIds,
    }
  }

  // ── validation ───────────────────────────────────────────────────────────

  function validate(forSubmit: boolean): string | null {
    if (!form.refId.trim()) return '请填写引用 ID（任务 ID 或交接事件 ID）'
    if (!form.inspector.trim()) return '请填写质检员姓名'
    if (!forSubmit) return null
    if (form.result === 'FAIL') {
      if (form.defectItems.length === 0) return '不合格时至少填写一条缺陷明细'
      for (const d of form.defectItems) {
        if (!d.defectName.trim()) return '缺陷名称不能为空'
        if (!d.qty || d.qty < 1) return '缺陷数量须 ≥ 1'
      }
      if (!form.disposition) return '请选择处置方式'
      if (needsQty) {
        const qty = Number(form.affectedQty)
        if (!qty || qty < 1) return '请填写受影响数量（≥ 1）'
        if (maxQty !== undefined && qty > maxQty) return `受影响数量（${qty}）不能超过任务总量（${maxQty}）`
      }
    }
    return null
  }

  // ── actions ──────────────────────────────────────────────────────────────

  function handleSaveDraft() {
    const err = validate(false)
    if (err) { toast.error(err); return }

    if (!currentQcId) {
      const created = createQc(buildPayload())
      setCurrentQcId(created.qcId)
      toast.success(`草稿已保存  ${created.qcId}`)
      router.replace(`/fcs/quality/qc-records/${created.qcId}`)
    } else {
      if (!existingQc) return
      updateQc({ ...existingQc, ...buildPayload(), updatedAt: nowString() })
      toast.success('草稿已更新')
    }
  }

  function handleSubmit() {
    const err = validate(true)
    if (err) { toast.error(err); return }

    // Ensure record exists before calling submitQc
    let targetId = currentQcId
    if (!targetId) {
      const created = createQc(buildPayload())
      targetId = created.qcId
      setCurrentQcId(created.qcId)
      router.replace(`/fcs/quality/qc-records/${created.qcId}`)
    } else if (existingQc) {
      updateQc({ ...existingQc, ...buildPayload(), updatedAt: nowString() })
    }

    const result = submitQc(targetId!, form.inspector)
    if (result?.errorCode === 'PERMISSION_DENIED') {
      toast.error('权限不足，无法提交质检')
      return
    }

    let msg = '质检已提交'
    if (result?.generatedTaskIds?.length) {
      msg += `，已生成返工任务：${result.generatedTaskIds.join('、')}`
    }
    toast.success(msg)
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold leading-tight">
            {isNew && !currentQcId ? '新建质检记录' : `质检记录 ${currentQcId ?? ''}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {form.refType === 'TASK' ? '来源类型：生产任务' : '来源类型：交接事件'}
            {form.refId && ` · ${form.refId}`}
          </p>
        </div>
        {existingQc && (
          <Badge
            className={cn(
              existingQc.status === 'SUBMITTED'
                ? 'bg-green-100 text-green-800 border-green-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            )}
          >
            {existingQc.status === 'SUBMITTED' ? '已提交' : '草稿'}
          </Badge>
        )}
      </div>

      <Separator />

      {/* ── 基本信息 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>引用类型</Label>
              <Select
                value={form.refType}
                onValueChange={v => set('refType', v as 'TASK' | 'HANDOVER')}
                disabled={readOnly}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TASK">生产任务</SelectItem>
                  <SelectItem value="HANDOVER">交接事件</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.refType === 'TASK' ? '任务 ID' : '交接事件 ID'}</Label>
              <Input
                value={form.refId}
                onChange={e => set('refId', e.target.value)}
                placeholder={form.refType === 'TASK' ? 'TASK-xxxx-xxx' : 'HND-xxxx'}
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>生产工单号</Label>
            <Input
              value={form.productionOrderId}
              onChange={e => set('productionOrderId', e.target.value)}
              placeholder="PO-xxxx（关联任务时自动带入）"
              disabled={readOnly}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>质检员</Label>
              <Input
                value={form.inspector}
                onChange={e => set('inspector', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label>质检时间</Label>
              <Input
                value={form.inspectedAt}
                onChange={e => set('inspectedAt', e.target.value)}
                placeholder="YYYY-MM-DD HH:mm:ss"
                disabled={readOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 质检结果 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">质检结果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>结果</Label>
            <div className="flex gap-3">
              {(['PASS', 'FAIL'] as QcResult[]).map(r => (
                <button
                  key={r}
                  disabled={readOnly}
                  onClick={() => !readOnly && set('result', r)}
                  className={cn(
                    'px-5 py-2 rounded-md border text-sm font-medium transition-colors',
                    form.result === r
                      ? r === 'PASS'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-red-600 text-white border-red-600'
                      : 'bg-background text-muted-foreground hover:border-foreground',
                    readOnly && 'cursor-not-allowed opacity-70'
                  )}
                >
                  {r === 'PASS' ? '合格' : '不合格'}
                </button>
              ))}
            </div>
          </div>

          {isFail && (
            <div className="space-y-4 rounded-md border border-red-200 bg-red-50/40 p-4">
              {/* defect items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">缺陷明细 <span className="text-destructive">*</span></Label>
                  {!readOnly && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addDefect}>
                      <Plus className="h-3 w-3 mr-1" />添加缺陷
                    </Button>
                  )}
                </div>
                {form.defectItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">暂无缺陷条目，请点击"添加缺陷"</p>
                )}
                <div className="space-y-2">
                  {form.defectItems.map((d, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        className="flex-1 h-8 text-sm"
                        placeholder="缺陷名称"
                        value={d.defectName}
                        onChange={e => updateDefect(idx, { defectName: e.target.value })}
                        disabled={readOnly}
                      />
                      <Input
                        className="w-20 h-8 text-sm"
                        type="number"
                        min={1}
                        placeholder="数量"
                        value={d.qty || ''}
                        onChange={e => updateDefect(idx, { qty: Number(e.target.value) })}
                        disabled={readOnly}
                      />
                      {!readOnly && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeDefect(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* disposition + affectedQty */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    处置方式 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.disposition}
                    onValueChange={v => set('disposition', v as QcDisposition)}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="请选择" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DISPOSITION_LABEL) as QcDisposition[]).map(k => (
                        <SelectItem key={k} value={k}>{DISPOSITION_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {needsQty && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">
                      受影响数量 <span className="text-destructive">*</span>
                      {maxQty !== undefined && (
                        <span className="text-muted-foreground font-normal ml-1">（任务量 {maxQty}）</span>
                      )}
                    </Label>
                    <Input
                      className="h-9"
                      type="number"
                      min={1}
                      max={maxQty}
                      value={form.affectedQty}
                      onChange={e => set('affectedQty', e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={readOnly}
                    />
                  </div>
                )}
              </div>

              {/* rootCauseType + liabilityStatus */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">根因类型</Label>
                  <Select
                    value={form.rootCauseType}
                    onValueChange={v => set('rootCauseType', v as RootCauseType)}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROOT_CAUSE_LABEL) as RootCauseType[]).map(k => (
                        <SelectItem key={k} value={k}>{ROOT_CAUSE_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">责任状态</Label>
                  <Select
                    value={form.liabilityStatus}
                    onValueChange={v => set('liabilityStatus', v as LiabilityStatus)}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LIABILITY_LABEL) as LiabilityStatus[]).map(k => (
                        <SelectItem key={k} value={k}>{LIABILITY_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* responsible party */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">责任方类型</Label>
                  <Select
                    value={form.responsiblePartyType}
                    onValueChange={v => set('responsiblePartyType', v as SettlementPartyType)}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="留空由系统推导" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PARTY_TYPE_LABEL) as SettlementPartyType[]).map(k => (
                        <SelectItem key={k} value={k}>{PARTY_TYPE_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">责任方 ID</Label>
                  <Input
                    className="h-9"
                    value={form.responsiblePartyId}
                    onChange={e => set('responsiblePartyId', e.target.value)}
                    placeholder="留空由系统推导"
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

            {/* ── 处置数量拆分（FAIL + 已提交时显示） ── */}
      {existingQc?.result === 'FAIL' && existingQc?.status === 'SUBMITTED' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">处置数量拆分</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bdTarget !== undefined && (
              <p className="text-sm text-muted-foreground">
                不合格数量（目标）：<span className="font-semibold text-foreground">{bdTarget}</span>
              </p>
            )}

            {/* 快捷按钮 */}
            {bdTarget !== undefined && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground self-center">快速填充：</span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBdQuickFill('rework')}>全部返工</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBdQuickFill('remake')}>全部重做</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBdQuickFill('defect')}>全部瑕疵接收</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBdQuickFill('scrap')}>全部报废</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBdQuickFill('nodeduct')}>全部无扣款接受</Button>
              </div>
            )}

            {/* 5 个数字输入框 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([
                { label: '返工数量',         state: bdRework,       set: setBdRework },
                { label: '重做数量',         state: bdRemake,       set: setBdRemake },
                { label: '接受（瑕疵品）数量', state: bdAcceptDefect, set: setBdAcceptDefect },
                { label: '报废数量',         state: bdScrap,        set: setBdScrap },
                { label: '接受（无扣款）数量', state: bdNoDeduct,     set: setBdNoDeduct },
              ] as { label: string; state: number | ''; set: (v: number | '') => void }[]).map(({ label, state: val, set: setVal }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-8 text-sm"
                    value={val}
                    onChange={e => setVal(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value))))}
                  />
                </div>
              ))}
            </div>

            {/* 合计 / 差值 */}
            <div className={cn(
              'rounded-md px-3 py-2 text-sm flex flex-wrap gap-4',
              bdValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            )}>
              <span>合计：<span className="font-semibold">{bdSum}</span></span>
              {bdTarget !== undefined && (
                <>
                  <span>目标：<span className="font-semibold">{bdTarget}</span></span>
                  <span>差值：<span className={cn('font-semibold', bdDelta !== 0 && 'text-red-600')}>{bdDelta}</span></span>
                  {!bdValid && (
                    <span className="text-red-600 font-medium w-full text-xs">合计必须等于不合格数量</span>
                  )}
                </>
              )}
            </div>

            <Button
              size="sm"
              onClick={handleSaveBreakdown}
              disabled={bdTarget !== undefined && !bdValid}
            >
              保存拆分
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── 备注 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">备注</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={form.remark}
            onChange={e => set('remark', e.target.value)}
            placeholder="可选备注..."
            disabled={readOnly}
          />
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      {!readOnly && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSaveDraft}>保存草稿</Button>
          <Button onClick={handleSubmit}>提交质检</Button>
        </div>
      )}
      {readOnly && (
        <div className="rounded-md bg-muted px-4 py-2.5 text-sm text-muted-foreground">
          已提交，表单只读。
        </div>
      )}

      {/* ── 串联产物（提交后） ── */}
      {existingQc?.status === 'SUBMITTED' && (
        <div className="space-y-4 pt-2">
          <Separator />
          <h2 className="text-sm font-semibold">提交串联产物</h2>

          {/* basis items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                扣款依据条目
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {basisItems.length} 条
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {basisItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无���联扣款���据</p>
              ) : (
                <div className="space-y-2">
                  {basisItems.map(b => (
                    <div key={b.basisId} className="rounded-md border bg-background px-3 py-2.5 text-sm space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-medium">{b.basisId}</span>
                        <Badge variant="outline" className="text-xs">{b.sourceType === 'QC_FAIL' ? '质检不合格' : '交接差异'}</Badge>
                        <Badge
                          className={cn(
                            'text-xs',
                            b.status === 'CONFIRMED' && 'bg-green-100 text-green-800 border-green-200',
                            b.status === 'DISPUTED'  && 'bg-yellow-100 text-yellow-800 border-yellow-200',
                            b.status === 'VOID'      && 'bg-gray-100 text-gray-500',
                            b.status === 'DRAFT'     && 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {b.status === 'CONFIRMED' ? '已确认' : b.status === 'DISPUTED' ? '争议中' : b.status === 'VOID' ? '已作废' : '草稿'}
                        </Badge>
                      </div>
                      {b.summary && (
                        <p className="text-xs text-muted-foreground">{b.summary}</p>
                      )}
                      <div className="text-xs text-muted-foreground tabular-nums">
                        责任方：{b.settlementPartyType ? PARTY_TYPE_LABEL[b.settlementPartyType] : '-'}
                        {' / '}{b.settlementPartyId ?? '-'}
                        {'  ·  '}数量：{b.qty} {b.uom}
                      </div>
                      <a
                        href={`/fcs/quality/deduction-calc?sourceId=${currentQcId}`}
                        className="inline-flex items-center gap-1 text-xs text-primary underline"
                      >
                        去扣款计算查看 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* generated rework/remake tasks */}
          {generatedTaskIds.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  返工 / 重做任务
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {generatedTaskIds.length} 条
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {generatedTaskIds.map(tid => {
                    const t = state.processTasks.find(p => p.taskId === tid)
                    return (
                      <div
                        key={tid}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs shrink-0">{tid}</span>
                          {t && (
                            <span className="text-xs text-muted-foreground truncate">
                              {t.processNameZh}
                              {' · '}
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  t.status === 'DONE'        && 'bg-green-50 text-green-700 border-green-200',
                                  t.status === 'IN_PROGRESS' && 'bg-blue-50 text-blue-700 border-blue-200',
                                  t.status === 'BLOCKED'     && 'bg-red-50 text-red-700 border-red-200',
                                )}
                              >
                                {t.status === 'DONE' ? '已完成' : t.status === 'IN_PROGRESS' ? '进行中' : t.status === 'BLOCKED' ? '已暂不能继续' : t.status}
                              </Badge>
                            </span>
                          )}
                        </div>
                        <a
                          href={`/fcs/pda/task-receive/${tid}`}
                          className="inline-flex items-center gap-1 text-xs text-primary underline shrink-0"
                        >
                          跳转 PDA 任务 <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* audit log */}
          {existingQc.auditLogs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">操作日志</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {existingQc.auditLogs.map(log => (
                    <li key={log.id} className="flex gap-3 text-xs text-muted-foreground">
                      <span className="shrink-0 tabular-nums">{log.at}</span>
                      <span className="font-medium text-foreground shrink-0">{log.by}</span>
                      <span>{log.detail}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ── page default export with Suspense wrapper ──────────────────────────────

export default function QcRecordPage({ params }: { params: Promise<{ qcId: string }> }) {
  const { qcId } = use(params)
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">加载中...</div>}>
      <QcRecordInner qcId={qcId} />
    </Suspense>
  )
}
