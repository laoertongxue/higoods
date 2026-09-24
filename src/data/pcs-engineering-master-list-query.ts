import type { EngineeringMasterListRow } from './pcs-engineering-master-view-model.ts'
import { buildPmsCsv } from '../utils/pms-export.ts'

export const ENGINEERING_PREPARATION_LABELS: Record<string, string> = {
  PURE_WOVEN: '纯梭织', HEAT_TRANSFER_DIRECT_PRINT: '热转印直喷', KNIT: '毛织', KNIT_WOVEN: '毛织＋梭织',
}
export interface EngineeringMasterListFilters {
  keyword: string
  status: string
  merchandiser: string
  attention: string
  preparationType: string
  team: string
  dateFrom: string
  dateTo: string
}
export const EMPTY_ENGINEERING_MASTER_FILTERS: EngineeringMasterListFilters = {
  keyword: '', status: '', merchandiser: '', attention: '', preparationType: '', team: '', dateFrom: '', dateTo: '',
}
export function filterEngineeringMasterListRows(rows: EngineeringMasterListRow[], filters: EngineeringMasterListFilters): EngineeringMasterListRow[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.merchandiser && row.merchandiserName !== filters.merchandiser) return false
    if (filters.attention && !row.attentionKinds.includes(filters.attention)) return false
    if (filters.preparationType && row.preparationType !== filters.preparationType) return false
    if (filters.team && !row.pendingTasks.some((task) => task.ownerTeamName === filters.team)) return false
    const date = row.createdAt.slice(0, 10)
    if (filters.dateFrom && (!date || date < filters.dateFrom)) return false
    if (filters.dateTo && (!date || date > filters.dateTo)) return false
    return !keyword || [row.masterOrderCode, row.styleCode, row.styleName, row.merchandiserName, row.latestTestingCode,
      row.sourceDesignRevisionTaskCode, ...row.pendingTasks.flatMap((task) => [task.taskName, task.ownerTeamName, task.assigneeName])]
      .join(' ').toLowerCase().includes(keyword)
  })
}
export function summarizeEngineeringMasterList(rows: EngineeringMasterListRow[]) {
  return [
    { label: '准备单数', value: rows.length },
    { label: '待发布', value: rows.filter((row) => row.status === '草稿').length },
    { label: '执行中', value: rows.filter((row) => ['已发布', '进行中', '技术包审核中'].includes(row.status)).length },
    { label: '待审核', value: rows.filter((row) => row.attentionKinds.includes('待审核')).length },
    { label: '返工', value: rows.filter((row) => row.attentionKinds.includes('返工')).length },
    { label: '待关闭', value: rows.filter((row) => row.status === '待关闭').length },
  ]
}
export function buildEngineeringMasterListCsv(rows: EngineeringMasterListRow[]): string {
  return buildPmsCsv(
    ['准备单号', 'SPU', '款式名称', '准备类型', '状态', '跟单负责人', '最近测款单', '最近测款结果', '关联设计改款', '创建原因', '已完成任务数', '适用任务数', '当前事项', '创建时间', '发布时间', '关闭时间', '更新时间'],
    rows.map((row) => [row.masterOrderCode, row.styleCode, row.styleName, ENGINEERING_PREPARATION_LABELS[row.preparationType] || '待确认', row.status,
      row.merchandiserName, row.latestTestingCode, row.latestTestingResult, row.sourceDesignRevisionTaskCode, row.creationReason, row.completedTaskCount, row.taskCount,
      row.pendingTasks.map((task) => `${task.taskName}：${task.status}；${task.ownerTeamName || '团队待确认'}／${task.assigneeName || '待分配'}；计划完成 ${task.plannedCompleteAt || '未设置'}${task.waitingFor.length ? `；等待 ${task.waitingFor.join('、')}` : ''}`).join('\n'),
      row.createdAt, row.publishedAt, row.closedAt, row.updatedAt]),
  )
}
