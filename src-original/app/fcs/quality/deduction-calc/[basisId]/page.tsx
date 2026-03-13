'use client'

import { use } from 'react'
import Link from '@/components/spa-link'
import { ArrowLeft, ExternalLink, FileText, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { DeductionBasisSourceType, DeductionBasisStatus } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'

// ── badge helpers ──────────────────────────────────────────────────────────
const sourceTypeBadgeClass: Partial<Record<DeductionBasisSourceType, string>> = {
  QC_FAIL: 'bg-red-100 text-red-700 border-red-200',
  HANDOVER_DIFF: 'bg-orange-100 text-orange-700 border-orange-200',
}
const SOURCE_TYPE_LABEL: Record<string, string> = {
  QC_FAIL: '质检不合格', QC_DEFECT_ACCEPT: '瑕疵接受', HANDOVER_DIFF: '交接差异',
}

const statusBadgeClass: Record<DeductionBasisStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  DISPUTED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  VOID: 'bg-slate-100 text-slate-500 border-slate-200',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', CONFIRMED: '已确认', DISPUTED: '争议中', VOID: '已作废',
}
const SETTLEMENT_PARTY_LABEL: Record<string, string> = {
  FACTORY: '工厂', PROCESSOR: '加工厂', SUPPLIER: '供应商', GROUP_INTERNAL: '集团内部', OTHER: '其他',
}
const DISPOSITION_LABEL: Record<string, string> = {
  REWORK: '返工', REMAKE: '重做', ACCEPT_AS_DEFECT: '接受（瑕疵品）', SCRAP: '报废', ACCEPT: '接受（无扣款）',
}

interface FieldRowProps {
  label: string
  value: React.ReactNode
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="flex items-start gap-4 py-2">
      <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="flex-1 text-sm text-foreground break-all">{value ?? '—'}</span>
    </div>
  )
}

interface PageProps {
  params: Promise<{ basisId: string }>
}

export default function DeductionCalcDetailPage({ params }: PageProps) {
  const { basisId } = use(params)
  const { state } = useFcs()

  const basis = state.deductionBasisItems.find(b => b.basisId === basisId)

  if (!basis) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-lg font-medium text-muted-foreground">
          {t('quality.deductionCalc.detail.notFound')}
        </p>
        <Button variant="outline" asChild>
          <Link href="/fcs/quality/deduction-calc">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('quality.deductionCalc.detail.back')}
          </Link>
        </Button>
      </div>
    )
  }

  // Optional joins
  const qcRecord = basis.sourceType === 'QC_FAIL'
    ? state.qcRecords?.find(q => q.qcId === basis.sourceRefId)
    : undefined

  const linkedTask = basis.taskId
    ? state.processTasks.find(t => t.taskId === basis.taskId)
    : undefined

  const factory = state.factories.find(f => f.id === basis.factoryId)

  const isDyePrint = basis.sourceProcessType === 'DYE_PRINT'
  const canEditAmount = basis.deductionAmountEditable === true

  // Determine freeze hint message
  let freezeHint: string | null = null
  if (!canEditAmount) {
    if (basis.settlementFreezeReason === '质检未结案') {
      freezeHint = t('deduction.detail.noEdit.qcOpen')
    } else if (basis.settlementFreezeReason === '争议中，冻结结算') {
      freezeHint = t('deduction.detail.noEdit.disputed')
    } else {
      freezeHint = t('deduction.detail.noEdit.noLiability')
    }
  }

  const settlPartyLabel = basis.settlementPartyType
    ? `${SETTLEMENT_PARTY_LABEL[basis.settlementPartyType] ?? basis.settlementPartyType} / ${basis.settlementPartyId ?? '—'}`
    : '—'

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/fcs/quality/deduction-calc">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('quality.deductionCalc.detail.back')}
          </Link>
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-xl font-semibold text-foreground">
          {t('quality.deductionCalc.detail.title')}
        </h1>
        <Badge variant="outline" className={statusBadgeClass[basis.status]}>
          {STATUS_LABEL[basis.status] ?? basis.status}
        </Badge>
        <Badge variant="outline" className={sourceTypeBadgeClass[basis.sourceType] ?? 'bg-gray-100 text-gray-700 border-gray-200'}>
          {SOURCE_TYPE_LABEL[basis.sourceType] ?? basis.sourceType}
        </Badge>
      </div>

      {/* 结算视角卡片（仅染印来源或有 settlementReady 字段时显示） */}
      {(isDyePrint || basis.settlementReady !== undefined) && (
        <Card className="border-indigo-200 bg-indigo-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-indigo-800">结算视角</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-indigo-100">
            <FieldRow label="来源流程" value={
              isDyePrint
                ? <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">染印加工单</Badge>
                : '—'
            } />
            {isDyePrint && (
              <FieldRow label="染印加工单号" value={
                basis.sourceOrderId
                  ? <span className="font-mono">{basis.sourceOrderId}</span>
                  : '—'
              } />
            )}
            {isDyePrint && (
              <FieldRow label="承接主体" value={basis.processorFactoryId ?? '—'} />
            )}
            <FieldRow label="结算对象" value={settlPartyLabel} />
            <FieldRow label="结算状态" value={
              basis.settlementReady !== undefined
                ? (
                  <Badge variant="outline" className={basis.settlementReady
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-orange-50 text-orange-700 border-orange-200'
                  }>
                    {basis.settlementReady ? '可进入结算' : '冻结中'}
                  </Badge>
                )
                : '—'
            } />
            <FieldRow label="冻结原因" value={basis.settlementFreezeReason || '—'} />
          </CardContent>
        </Card>
      )}

      {/* 金额录入控制提示 */}
      {!canEditAmount && freezeHint && (
        <Alert className="border-orange-200 bg-orange-50">
          <Lock className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-sm text-orange-800">
            {freezeHint}
          </AlertDescription>
        </Alert>
      )}

      {/* Section 1: 基本信息 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('quality.deductionCalc.detail.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <FieldRow label={t('quality.deductionCalc.columns.basisId')} value={
            <span className="font-mono">{basis.basisId}</span>
          } />
          <FieldRow label="来源类型" value={
            <Badge variant="outline" className={sourceTypeBadgeClass[basis.sourceType] ?? 'bg-gray-100 text-gray-700 border-gray-200'}>
              {SOURCE_TYPE_LABEL[basis.sourceType] ?? basis.sourceType}
            </Badge>
          } />
          <FieldRow label="来源单号" value={
            <span className="font-mono">{basis.sourceRefId}</span>
          } />
          <FieldRow label={t('quality.deductionCalc.columns.productionOrderId')} value={
            <span className="font-mono">{basis.productionOrderId}</span>
          } />
          <FieldRow label={t('quality.deductionCalc.columns.taskId')} value={
            basis.taskId ? <span className="font-mono">{basis.taskId}</span> : '—'
          } />
          <FieldRow label={t('quality.deductionCalc.columns.factory')} value={
            factory ? factory.name : basis.factoryId
          } />
          <FieldRow label="原因代码" value={
            (() => {
              const map: Record<string, string> = {
                QUALITY_FAIL: '质量不合格', QC_FAIL_DEDUCTION: '质检扣款',
                HANDOVER_SHORTAGE: '交接短缺', HANDOVER_OVERAGE: '交接溢出',
                HANDOVER_DAMAGE: '交接破损', HANDOVER_MIXED_BATCH: '交接混批', HANDOVER_DIFF: '交接差异',
              }
              return map[basis.reasonCode] ?? basis.reasonCode
            })()
          } />
          <FieldRow label="数量" value={
            <div className="space-y-1">
              <span>{`${basis.qty} ${basis.uom}`}</span>
              {basis.deductionQty !== undefined && (
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {'可扣款数量：'}
                    {basis.deductionQty === 0
                      ? <span className="text-muted-foreground">当前无可扣款数量</span>
                      : <span className="font-semibold">{basis.deductionQty} {basis.uom}</span>
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    可扣款数量 = 不合格处置合计 - 接受（无扣款）数量（由质检处置拆分自动同步）
                  </p>
                </div>
              )}
            </div>
          } />

          {/* 扣款金额录入（受 deductionAmountEditable 控制） */}
          <div className="flex items-start gap-4 py-2">
            <span className="w-36 shrink-0 text-sm text-muted-foreground">扣款金额录入</span>
            <div className="flex-1">
              <input
                type="number"
                min={0}
                disabled={!canEditAmount}
                placeholder={canEditAmount ? '请输入扣款金额（元）' : '暂不可录入'}
                className={`w-full rounded-md border px-3 py-1.5 text-sm ${
                  canEditAmount
                    ? 'border-input bg-background text-foreground'
                    : 'border-input bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                }`}
              />
              {!canEditAmount && (
                <p className="mt-1 text-xs text-muted-foreground">{freezeHint}</p>
              )}
            </div>
          </div>

          {basis.disposition && (
            <FieldRow label="处置方式" value={DISPOSITION_LABEL[basis.disposition] ?? basis.disposition} />
          )}
          <FieldRow label="创建时间" value={basis.createdAt} />
          <FieldRow label="创建人" value={basis.createdBy} />
          {basis.updatedAt && <FieldRow label="更新时间" value={basis.updatedAt} />}
          {basis.updatedBy && <FieldRow label="更新人" value={basis.updatedBy} />}
          <FieldRow label="状态" value={
            <span className="text-muted-foreground text-xs italic">{t('quality.deductionCalc.readonly')}</span>
          } />
        </CardContent>
      </Card>

      {/* Section 2: 证据清单 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('quality.deductionCalc.detail.evidence')}</CardTitle>
        </CardHeader>
        <CardContent>
          {basis.evidenceRefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('quality.deductionCalc.detail.noEvidence')}</p>
          ) : (
            <ul className="space-y-2">
              {basis.evidenceRefs.map((ev, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {ev.url ? (
                    <a href={ev.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      {ev.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-foreground">{ev.name}</span>
                  )}
                  {ev.type && <span className="text-xs text-muted-foreground">({ev.type})</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Section 3: 关联来源（深链接） */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('quality.deductionCalc.detail.source')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {basis.sourceType === 'QC_FAIL' && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/fcs/quality/qc-records/${basis.sourceRefId}`}>
                <ExternalLink className="mr-1.5 h-4 w-4" />
                {t('quality.deductionCalc.detail.viewQc')}
                {qcRecord && (
                  <span className="ml-1 text-xs text-muted-foreground font-mono">({basis.sourceRefId})</span>
                )}
              </Link>
            </Button>
          )}
          {basis.sourceType === 'HANDOVER_DIFF' && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/fcs/progress/handover?eventId=${basis.sourceRefId}`}>
                <ExternalLink className="mr-1.5 h-4 w-4" />
                {t('quality.deductionCalc.detail.viewHandover')}
                <span className="ml-1 text-xs text-muted-foreground font-mono">({basis.sourceRefId})</span>
              </Link>
            </Button>
          )}
          {isDyePrint && (
            <Button variant="outline" size="sm" asChild className="text-indigo-700 border-indigo-300 hover:bg-indigo-50">
              <Link href="/fcs/process/dye-print-orders">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                查看染印加工单
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Section 4: 关联任务 */}
      {(basis.taskId || basis.productionOrderId) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('quality.deductionCalc.detail.relatedTask')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/fcs/progress/board?taskId=${basis.taskId ?? ''}&po=${basis.productionOrderId}`}>
                <ExternalLink className="mr-1.5 h-4 w-4" />
                {t('quality.deductionCalc.detail.viewBoard')}
              </Link>
            </Button>
            {basis.taskId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/fcs/pda/exec/${basis.taskId}`}>
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  {t('quality.deductionCalc.detail.viewPda')}
                  {linkedTask && (
                    <span className="ml-1 text-xs text-muted-foreground font-mono">({basis.taskId})</span>
                  )}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 5: 审计日志 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('quality.deductionCalc.detail.auditLog')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!basis.auditLogs || basis.auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('quality.deductionCalc.detail.noAuditLog')}</p>
          ) : (
            <ol className="relative border-l border-border ml-2 space-y-4">
              {basis.auditLogs.map((log, idx) => {
                const ACTION_LABEL: Record<string, string> = {
                  CREATE_FROM_DYE_PRINT_FAIL: '由染印不合格回货创建',
                  SYNC_SETTLEMENT_READY_FROM_QC: '结案同步结算状态',
                  CONFIRM_LIABILITY_FROM_QC: '判责确认同步',
                  DISPUTE_LIABILITY_FROM_QC: '争议同步',
                  CREATE_BASIS_FROM_QC: '由质检单创建',
                  UPDATE_BASIS_FROM_QC: '由质检单更新',
                  GENERATE_DEDUCTION_BASIS: '生成扣款依据',
                }
                return (
                  <li key={log.id ?? idx} className="ml-4">
                    <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border border-background bg-muted-foreground/40" />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {ACTION_LABEL[log.action] ?? (t(`quality.auditAction.${log.action}` as any) || log.action)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{log.detail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">{log.at}</p>
                        <p className="text-xs text-muted-foreground">{log.by}</p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
