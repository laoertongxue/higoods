// 花型任务模块：列表 / 详情渲染与列表分派注册（从 pcs-engineering-tasks.ts 拆分）

import {
  PATTERN_TASK_TEAMS,
  listPatternTaskMembersByTeam,
} from '../../data/pcs-pattern-task-team-config.ts'
import {
  getPatternTaskCompletionMissingFields,
  getPatternTaskExecutionSubmitMissingFields,
} from '../../data/pcs-engineering-task-field-policy.ts'
import type { PatternTaskRecord } from '../../data/pcs-pattern-task-types.ts'
import { listPatternAssets } from '../../data/pcs-pattern-library.ts'
import { listFirstSampleTasks } from '../../data/pcs-first-sample-repository.ts'
import { getStyleArchiveById } from '../../data/pcs-style-archive-repository.ts'
import { listPatternTasks, getPatternTaskById } from '../../data/pcs-pattern-task-repository.ts'
import { getPatternTechPackActionMeta } from '../../data/pcs-tech-pack-task-generation.ts'
import { escapeHtml, formatDateTime, toClassName } from '../../utils.ts'
import {
  ENGINEERING_COMMON_FILTER_STATUS_OPTIONS,
  PATTERN_COLOR_DEPTH_OPTIONS,
  PATTERN_DEMAND_SOURCE_OPTIONS,
  PATTERN_DIFFICULTY_OPTIONS,
  PATTERN_PROCESS_OPTIONS,
  type EngineeringListRow,
  type PatternDetailDraft,
  type PatternTab,
  baseLogs,
  buildProjectOptions,
  buildSelectOptions,
  buildStyleArchiveOptions,
  createEngineeringListColumns,
  getOwners,
  getProjectDefaultValues,
  getSources,
  getTaskStyleInfo,
  initialPatternDetailDraft,
  isOverdue,
  mergeLogs,
  projectButton,
  registerEngineeringListModule,
  renderDateTimeInput,
  renderDialog,
  renderEmptyDetail,
  renderEngineeringStandardListPage,
  renderFileUploader,
  renderHeaderMeta,
  renderImageList,
  renderImageUploader,
  renderKeyValueGrid,
  renderListFilters,
  renderLogs,
  renderMetricButton,
  renderNotice,
  renderPreviewImageModal,
  renderProjectContext,
  renderSectionCard,
  renderSelectInput,
  renderSmallImage,
  renderStatusBadge,
  renderTabBar,
  renderTaskSaveBar,
  renderTextInput,
  renderTextarea,
  state,
  styleArchiveLink,
  techPackLinkByProject,
} from './shared.ts'
function ensurePatternDetailDraft(task: ReturnType<typeof getPatternTaskById>): PatternDetailDraft {
  if (!task) {
    return initialPatternDetailDraft()
  }
  if (state.patternDetailDraftTaskId !== task.patternTaskId) {
    state.patternDetailDraftTaskId = task.patternTaskId
    state.patternDetailDraft = {
      artworkVersion: task.artworkVersion,
      difficultyGrade: task.difficultyGrade,
      colorDepthOption: task.colorDepthOption,
      physicalReferenceNote: task.physicalReferenceNote,
      colorConfirmNote: task.colorConfirmNote,
      completionImageIds: [...task.completionImageIds],
      patternFileIds: [...(task.patternFileIds || [])],
      liveReferenceImageIds: [...task.liveReferenceImageIds],
      imageReferenceIds: [...task.imageReferenceIds],
      buyerReviewNote: task.buyerReviewNote,
      transferReason: task.transferReason,
      patternCategoryCode: task.patternCategoryCode,
      patternStyleTagsText: task.patternStyleTags.join('、'),
      hotSellerFlag: task.hotSellerFlag,
    }
  }
  return state.patternDetailDraft
}

function getPatternMemberOptions(teamCode: string): Array<{ value: string; label: string }> {
  return listPatternTaskMembersByTeam(teamCode).map((item) => ({ value: item.memberId, label: item.memberName }))
}

function getPatternTasksFiltered() {
  const tasks = listPatternTasks()
  const keyword = state.patternList.search.trim().toLowerCase()
  return tasks.filter((task) => {
    if (keyword) {
      const haystack = [task.patternTaskCode, task.title, task.projectCode, task.projectName, task.ownerName, task.artworkName, task.productStyleCode, task.demandSourceType, task.processType, task.assignedTeamName, task.assignedMemberName].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.patternList.status !== 'all' && task.status !== state.patternList.status) return false
    if (state.patternList.owner !== 'all' && task.ownerName !== state.patternList.owner) return false
    if (state.patternList.source !== 'all' && task.sourceType !== state.patternList.source) return false
    if (state.patternList.quickFilter === 'mine' && task.ownerName !== '林小美') return false
    if (state.patternList.quickFilter === 'pending-review' && task.buyerReviewStatus !== '待买手确认') return false
    if (state.patternList.quickFilter === 'confirmed-no-output' && !(task.status === '已确认' && !task.linkedTechPackVersionId)) return false
    if (state.patternList.quickFilter === 'blocked' && task.status !== '异常待处理') return false
    if (state.patternList.quickFilter === 'overdue' && !isOverdue(task.dueAt, task.status === '已完成' || task.status === '已取消')) return false
    return true
  })
}

const PATTERN_LIST_COLUMNS = createEngineeringListColumns([
  { key: 'task', title: '花型任务', width: 190, required: true, freezeable: true, sortable: true },
  { key: 'image', title: '需求图', width: 90, required: true, freezeable: true },
  { key: 'project', title: '商品项目', width: 180, required: true, freezeable: true, sortable: true },
  { key: 'source', title: '来源', width: 130, sortable: true },
  { key: 'process', title: '工艺', width: 120 },
  { key: 'fabric', title: '面料', width: 150 },
  { key: 'qty', title: '数量', width: 100 },
  { key: 'difficulty', title: '难易程度', width: 110 },
  { key: 'team', title: '团队', width: 130 },
  { key: 'member', title: '花型师', width: 120, sortable: true },
  { key: 'review', title: '买手确认状态', width: 140, required: true, freezeable: true, sortable: true },
  { key: 'library', title: '花型库状态', width: 140 },
  { key: 'techPack', title: '技术包状态', width: 150 },
  { key: 'actions', title: '操作', width: 300, required: true, actionColumn: true },
])

function getPatternListRows(): EngineeringListRow[] {
  return getPatternTasksFiltered().map((task) => {
    const asset = listPatternAssets().find((item) => item.source_task_id === task.patternTaskId)
    const techPackAction = getPatternTechPackActionMeta(task.patternTaskId)
    return {
      cells: {
        task: `<div class="space-y-1">
            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/patterns/colors/${escapeHtml(task.patternTaskId)}">${escapeHtml(task.patternTaskCode)}</button>
            <p class="text-xs text-slate-500">${escapeHtml(task.title)}</p>
          </div>`,
        image: renderSmallImage(task.demandImageIds[0] || ''),
        project: projectButton(task.projectId, task.projectCode, task.projectName),
        source: escapeHtml(task.demandSourceType),
        process: escapeHtml(task.processType),
        fabric: escapeHtml(task.fabricSku || task.fabricName || '-'),
        qty: escapeHtml(task.requestQty || '-'),
        difficulty: escapeHtml(task.difficultyGrade || '-'),
        team: escapeHtml(task.assignedTeamName || '-'),
        member: escapeHtml(task.assignedMemberName || '-'),
        review: renderStatusBadge(task.buyerReviewStatus),
        library: asset ? `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/pattern-library/${escapeHtml(asset.id)}">${escapeHtml(asset.pattern_code)}</button>` : '<span class="text-slate-400">未沉淀</span>',
        techPack: task.linkedTechPackVersionId ? techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看技术包') : '<span class="text-slate-400">未写入</span>',
        actions: `<div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/patterns/colors/${escapeHtml(task.patternTaskId)}">查看</button>
              type="button"
              class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
              data-pcs-engineering-action="pattern-generate-tech-pack"
              data-task-id="${escapeHtml(task.patternTaskId)}"
              ${techPackAction.disabled ? `disabled title="${escapeHtml(techPackAction.disabledReason)}"` : ''}
            >${escapeHtml(techPackAction.label)}</button>
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="pattern-publish-library" data-task-id="${escapeHtml(task.patternTaskId)}">${escapeHtml(asset ? '打开花型库' : '沉淀花型库')}</button>
          </div>`,
      },
      sortValues: {
        task: task.patternTaskCode,
        project: `${task.projectCode} ${task.projectName}`,
        source: task.demandSourceType,
        member: task.assignedMemberName || task.ownerName,
        review: task.buyerReviewStatus,
      },
    }
  })
}

function renderPatternListStats(): string {
  const tasks = listPatternTasks()
  return `<section class="flex flex-wrap gap-3">
    ${renderMetricButton('全部任务', tasks.length, state.patternList.quickFilter === 'all', 'all', 'set-pattern-quick-filter')}
    ${renderMetricButton('我的任务', tasks.filter((item) => item.ownerName === '林小美').length, state.patternList.quickFilter === 'mine', 'mine', 'set-pattern-quick-filter')}
    ${renderMetricButton('待买手确认', tasks.filter((item) => item.buyerReviewStatus === '待买手确认').length, state.patternList.quickFilter === 'pending-review', 'pending-review', 'set-pattern-quick-filter')}
    ${renderMetricButton('已确认待沉淀', tasks.filter((item) => item.status === '已确认' && !listPatternAssets().find((asset) => asset.source_task_id === item.patternTaskId)).length, state.patternList.quickFilter === 'confirmed-no-output', 'confirmed-no-output', 'set-pattern-quick-filter')}
    ${renderMetricButton('超期任务', tasks.filter((item) => isOverdue(item.dueAt, item.status === '已完成' || item.status === '已取消')).length, state.patternList.quickFilter === 'overdue', 'overdue', 'set-pattern-quick-filter')}
  </section>`
}

function renderPatternListPage(): string {
  const tasks = listPatternTasks()
  return renderEngineeringStandardListPage({
    module: 'pattern',
    title: '花型任务',
    createLabel: '新建花型任务',
    createAction: 'open-pattern-create',
    filtersHtml: renderListFilters({
        searchPlaceholder: '搜索任务编号 / 花型名称 / 商品项目 / 团队 / 花型师',
        listState: state.patternList,
        searchField: 'pattern-search',
        statusField: 'pattern-status',
        ownerField: 'pattern-owner',
        sourceField: 'pattern-source',
        statusOptions: ENGINEERING_COMMON_FILTER_STATUS_OPTIONS,
        ownerOptions: getOwners(tasks),
        sourceOptions: getSources(tasks),
    }),
    statsHtml: renderPatternListStats(),
    rows: getPatternListRows(),
    columns: PATTERN_LIST_COLUMNS,
    listState: state.patternList,
    emptyText: '暂无花型任务数据',
    overlaysHtml: renderPatternCreateDialog(),
  })
}

function renderPatternCreateDialog(): string {
  const draft = state.patternCreateDraft
  const teamOptions = PATTERN_TASK_TEAMS.map((team) => ({ value: team.teamCode, label: team.teamName }))
  const showProjectField = draft.bindingMode === 'project'
  const selectedStyle = getStyleArchiveById(draft.styleId)
  const selectedProjectDefaults = draft.projectId ? getProjectDefaultValues(draft.projectId) : { ownerName: '', styleId: '', styleCode: '', styleName: '' }
  const projectStyle = selectedProjectDefaults.styleId ? getStyleArchiveById(selectedProjectDefaults.styleId) : null
  const body = `
    <div class="grid gap-4 md:grid-cols-2">
      ${renderSelectInput('来源类型', 'pattern-create-source-type', showProjectField ? '商品项目' : '人工创建', [
        { value: showProjectField ? '商品项目' : '人工创建', label: showProjectField ? '商品项目' : '人工创建' },
      ])}
      ${showProjectField ? renderSelectInput('商品项目', 'pattern-create-project', draft.projectId, buildProjectOptions()) : renderSelectInput('款式档案', 'pattern-create-style-id', draft.styleId, buildStyleArchiveOptions())}
      ${renderTextInput('负责人', 'pattern-create-owner', draft.ownerName, '')}
      ${renderTextInput('任务标题', 'pattern-create-title', draft.title, '')}
      ${renderDateTimeInput('截止时间', 'pattern-create-due-at', draft.dueAt)}
      ${renderSelectInput('需求来源', 'pattern-create-demand-source', draft.demandSourceType, buildSelectOptions(PATTERN_DEMAND_SOURCE_OPTIONS))}
      ${renderSelectInput('工艺类型', 'pattern-create-process-type', draft.processType, buildSelectOptions(PATTERN_PROCESS_OPTIONS))}
      ${renderTextInput('需求数量', 'pattern-create-request-qty', draft.requestQty, '')}
      ${renderTextInput('面料 SKU', 'pattern-create-fabric-sku', draft.fabricSku, '')}
      ${renderTextInput('面料名称', 'pattern-create-fabric-name', draft.fabricName, '')}
      ${renderSelectInput('团队', 'pattern-create-team', draft.assignedTeamCode, teamOptions)}
      ${renderSelectInput('花型师', 'pattern-create-member', draft.assignedMemberId, getPatternMemberOptions(draft.assignedTeamCode))}
      ${renderTextInput('花型名称', 'pattern-create-artwork-name', draft.artworkName, '')}
      ${renderTextInput('花型库分类', 'pattern-create-category', draft.patternCategoryCode, '')}
      ${renderTextInput('风格标签', 'pattern-create-style-tags', draft.patternStyleTagsText, '')}
    </div>
    <div class="mt-4 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
      ${escapeHtml(showProjectField ? (projectStyle?.styleCode ? `${projectStyle.styleCode} · ${projectStyle.styleName}` : '未绑定款式档案') : (selectedStyle?.styleCode ? `${selectedStyle.styleCode} · ${selectedStyle.styleName}` : '未选择款式档案'))}
    </div>
    <div class="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
      ${renderImageUploader('需求图片', 'pattern-create-demand-images', draft.demandImageIds, '暂未上传需求图片')}
      <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
        <input type="checkbox" ${draft.hotSellerFlag ? 'checked' : ''} data-pcs-engineering-field="pattern-create-hot-flag" />
        <span>标记为爆款花型</span>
      </label>
    </div>
    <div class="mt-4">
      ${renderTextarea('备注', 'pattern-create-note', draft.note, '')}
    </div>
  `
  return renderDialog(state.patternCreateOpen, '新建花型任务', body, 'close-pattern-create', 'submit-pattern-create', '创建花型任务')
}

interface PatternTaskFlowStep {
  key: PatternTab | 'done'
  label: string
  done: boolean
  active: boolean
  desc: string
}

interface PatternTaskFlowView {
  stageLabel: string
  nextActionText: string
  missingFields: string[]
  completionMissingFields: string[]
  executionReady: boolean
  completionReady: boolean
  closureReady: boolean
  steps: PatternTaskFlowStep[]
}

function buildPatternTaskFlowView(task: PatternTaskRecord, hasPatternAsset: boolean): PatternTaskFlowView {
  const executionMissingFields = getPatternTaskExecutionSubmitMissingFields(task)
  const completionMissingFields = getPatternTaskCompletionMissingFields(task)
  const hasDemand = task.demandImageIds.length > 0
  const hasOutput = executionMissingFields.length === 0
  const submittedForReview = task.status === '待确认' || task.status === '已确认' || task.status === '已生成技术包' || task.status === '已完成'
  const buyerPassed = task.buyerReviewStatus === '买手已通过'
  const techPackWritten = Boolean(task.linkedTechPackVersionId)
  const closureReady = buyerPassed && hasOutput && techPackWritten && hasPatternAsset
  const completed = task.status === '已完成'
  let activeKey: PatternTaskFlowStep['key'] = 'execution'
  let stageLabel = '花型执行中'
  let nextActionText = '补齐花型版次、完成确认图片和花型文件。'
  let currentMissingFields = executionMissingFields

  if (completed) {
    activeKey = 'done'
    stageLabel = '已完成'
    nextActionText = '任务已完成，商品项目关系已更新。'
    currentMissingFields = []
  } else if (!hasOutput) {
    activeKey = 'execution'
    stageLabel = '花型执行中'
    nextActionText = executionMissingFields.length > 0 ? `请先补齐：${executionMissingFields.join('、')}。` : '请保存花型执行资料。'
    currentMissingFields = executionMissingFields
  } else if (task.buyerReviewStatus === '买手已驳回') {
    activeKey = 'execution'
    stageLabel = '买手已驳回'
    nextActionText = '按买手驳回说明调整花型后重新提交确认。'
    currentMissingFields = executionMissingFields
  } else if (!submittedForReview) {
    activeKey = 'execution'
    stageLabel = '待提交买手确认'
    nextActionText = '花型师产出资料已补齐，请提交买手确认。'
    currentMissingFields = []
  } else if (!buyerPassed) {
    activeKey = 'review'
    stageLabel = '待买手确认'
    nextActionText = '请买手确认花型结果，通过后再写技术包或沉淀花型库。'
    currentMissingFields = completionMissingFields
  } else if (!techPackWritten || !hasPatternAsset) {
    activeKey = 'closure'
    stageLabel = '产出闭环中'
    nextActionText = [
      techPackWritten ? '' : '写入技术包花型',
      hasPatternAsset ? '' : '沉淀花型库资产',
    ].filter(Boolean).join('，') || '完成产出闭环。'
    currentMissingFields = completionMissingFields
  } else {
    activeKey = 'closure'
    stageLabel = '待完成'
    nextActionText = '花型产出已闭环，可以完成任务。'
    currentMissingFields = []
  }

  const steps: PatternTaskFlowStep[] = [
    { key: 'demand', label: '需求创建', done: hasDemand, active: activeKey === 'demand', desc: hasDemand ? '需求图已保留' : '缺需求图' },
    { key: 'execution', label: '花型执行', done: submittedForReview || buyerPassed || completed, active: activeKey === 'execution', desc: submittedForReview || buyerPassed || completed ? '已提交买手确认' : hasOutput ? '资料已齐待提交' : '补齐版次/完成图/文件' },
    { key: 'review', label: '买手确认', done: buyerPassed, active: activeKey === 'review', desc: buyerPassed ? '买手已通过' : task.buyerReviewStatus },
    { key: 'closure', label: '产出闭环', done: closureReady, active: activeKey === 'closure', desc: closureReady ? '技术包和花型库已闭环' : '待写包/沉淀' },
    { key: 'done', label: '任务完成', done: completed, active: activeKey === 'done', desc: completed ? '项目关系已更新' : '待完成' },
  ]

  return {
    stageLabel,
    nextActionText,
    missingFields: currentMissingFields,
    completionMissingFields,
    executionReady: executionMissingFields.length === 0,
    completionReady: completionMissingFields.length === 0,
    closureReady,
    steps,
  }
}

function renderPatternFlowSteps(flow: PatternTaskFlowView): string {
  return `
    <div class="grid gap-3 md:grid-cols-5" data-testid="pattern-flow-steps">
      ${flow.steps.map((step, index) => `
        <div class="${escapeHtml(toClassName('rounded-lg border px-4 py-3', step.active ? 'border-blue-300 bg-blue-50' : step.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'))}">
          <div class="flex items-center gap-2">
            <span class="${escapeHtml(toClassName('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', step.done ? 'bg-emerald-600 text-white' : step.active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'))}">${step.done ? '✓' : String(index + 1)}</span>
            <span class="text-sm font-medium text-slate-900">${escapeHtml(step.label)}</span>
          </div>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(step.desc)}</p>
        </div>
      `).join('')}
    </div>
  `
}

function renderPatternMissingItems(missingFields: string[]): string {
  if (missingFields.length === 0) {
    return '<span class="text-emerald-700">完成资料已满足</span>'
  }
  return missingFields.map((item) => `<span class="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">${escapeHtml(item)}</span>`).join('')
}

function renderPatternCurrentActionPanel(
  flow: PatternTaskFlowView,
  task: PatternTaskRecord,
  hasPatternAsset: boolean,
): string {
  const closureMissing = [
    task.linkedTechPackVersionId ? '' : '未写入技术包',
    hasPatternAsset ? '' : '未沉淀花型库',
  ].filter(Boolean)
  return `
    <section class="rounded-xl border border-blue-100 bg-blue-50 p-5" data-testid="pattern-current-action">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-medium text-blue-700">当前阶段</p>
          <h2 class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(flow.stageLabel)}</h2>
          <p class="mt-2 text-sm text-slate-700">${escapeHtml(flow.nextActionText)}</p>
        </div>
        <div class="rounded-lg bg-white px-4 py-3 text-sm shadow-sm">
          <p class="text-xs text-slate-500">当前阶段缺失项</p>
          <div class="mt-2 flex flex-wrap gap-2">${renderPatternMissingItems(flow.missingFields)}</div>
        </div>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-3">
        <div class="rounded-lg border border-blue-100 bg-white px-4 py-3">
          <p class="text-xs text-slate-500">买手确认</p>
          <div class="mt-2">${renderStatusBadge(task.buyerReviewStatus)}</div>
        </div>
        <div class="rounded-lg border border-blue-100 bg-white px-4 py-3">
          <p class="text-xs text-slate-500">技术包</p>
          <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || task.linkedTechPackVersionStatus || '未写入')}</p>
        </div>
        <div class="rounded-lg border border-blue-100 bg-white px-4 py-3">
          <p class="text-xs text-slate-500">产出闭环</p>
          <p class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(closureMissing.length > 0 ? closureMissing.join('、') : '已闭环')}</p>
        </div>
      </div>
    </section>
  `
}

function renderPatternDetailPage(patternTaskId: string): string {
  const task = getPatternTaskById(patternTaskId)
  if (!task) return renderEmptyDetail('花型任务', '/pcs/patterns/colors')
  const techPackAction = getPatternTechPackActionMeta(task.patternTaskId)
  const detailDraft = ensurePatternDetailDraft(task)
  const asset = listPatternAssets().find((item) => item.source_task_id === task.patternTaskId)
  const sampleTasks = listFirstSampleTasks().filter((item) => item.upstreamObjectId === task.patternTaskId || item.upstreamObjectCode === task.patternTaskCode)
  const style = getTaskStyleInfo(task)
  const flow = buildPatternTaskFlowView(task, Boolean(asset))
  const executionDraftMissingFields = [
    detailDraft.artworkVersion.trim() ? '' : '花型版次',
    detailDraft.completionImageIds.length > 0 ? '' : '完成确认图片',
    detailDraft.patternFileIds.length > 0 ? '' : '花型文件',
  ].filter(Boolean)
  const executionDraftReady = executionDraftMissingFields.length === 0
  const completeDisabledReason = flow.completionReady ? '' : `缺少字段：${flow.completionMissingFields.join('、')}。`
  const publishDisabledReason = flow.completionReady ? '' : `沉淀花型库前缺少：${flow.completionMissingFields.join('、')}。`
  const logs = mergeLogs('pattern', task.patternTaskId, [
    ...(task.linkedTechPackVersionId ? [{ time: task.linkedTechPackUpdatedAt || task.updatedAt, action: '技术包写回', user: task.updatedBy, detail: `已写入技术包 ${task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || task.linkedTechPackVersionId}。` }] : []),
    ...(asset ? [{ time: asset.updated_at, action: '花型库沉淀', user: asset.updated_by, detail: `已形成花型资产 ${asset.pattern_code}。` }] : []),
    ...baseLogs(task),
  ])
  const header = renderHeaderMeta(
    `${task.patternTaskCode} · ${task.title}`,
    `${task.projectCode} · ${task.projectName} · ${formatDateTime(task.updatedAt)}`,
    `${renderStatusBadge(task.status)}<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">${escapeHtml(task.artworkVersion || '待确认版本')}</span>`,
    [
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/patterns/colors">返回列表</button>`,
      ...(task.status !== '已完成' && task.status !== '已取消'
        ? [`<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white" data-pcs-engineering-action="complete-pattern-task" data-task-id="${escapeHtml(task.patternTaskId)}" ${completeDisabledReason ? `disabled title="${escapeHtml(completeDisabledReason)}"` : ''}>完成任务</button>`]
        : []),
      `<button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white" data-pcs-engineering-action="pattern-generate-tech-pack" data-task-id="${escapeHtml(task.patternTaskId)}" ${techPackAction.disabled ? `disabled title="${escapeHtml(techPackAction.disabledReason)}"` : ''}>${escapeHtml(techPackAction.label)}</button>`,
      `<button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" data-pcs-engineering-action="pattern-publish-library" data-task-id="${escapeHtml(task.patternTaskId)}" ${!asset && publishDisabledReason ? `disabled title="${escapeHtml(publishDisabledReason)}"` : ''}>${escapeHtml(asset ? '打开花型库' : '沉淀花型库')}</button>`,
    ].join(''),
  )
  const tabBar = renderTabBar(state.patternTab, [
    { key: 'demand', label: '任务需求' },
    { key: 'execution', label: '执行与颜色' },
    { key: 'review', label: '买手确认' },
    { key: 'closure', label: '产出闭环' },
    { key: 'logs', label: '操作记录' },
  ], 'set-pattern-tab')
  const demandSection = `${renderProjectContext(task)}${renderSectionCard('需求来源', renderKeyValueGrid([
    { label: '来源', value: escapeHtml(task.demandSourceType) },
    { label: '来源编号', value: escapeHtml(task.demandSourceRefCode || task.upstreamObjectCode || '-') },
    { label: '来源名称', value: escapeHtml(task.demandSourceRefName || task.upstreamObjectType || '-') },
    { label: '款式编码', value: escapeHtml(task.productStyleCode || '-') },
  ], 2))}`

  const processSection = renderSectionCard('工艺与面料', renderKeyValueGrid([
    { label: '工艺类型', value: escapeHtml(task.processType) },
    { label: '需求数量', value: escapeHtml(task.requestQty || '-') },
    { label: '面料 SKU', value: escapeHtml(task.fabricSku || '-') },
    { label: '面料名称', value: escapeHtml(task.fabricName || '-') },
    { label: '花型名称', value: escapeHtml(task.artworkName || task.title) },
    { label: '花型版次', value: escapeHtml(task.artworkVersion || '-') },
  ], 3))

  const demandImagesSection = renderSectionCard('需求图片', renderImageList(task.demandImageIds, '暂未上传需求图片'))

  const assignmentSection = renderSectionCard(
    '团队与成员分配',
    `
      ${renderKeyValueGrid([
        { label: '团队', value: escapeHtml(task.assignedTeamName || '-') },
        { label: '花型师', value: escapeHtml(task.assignedMemberName || '-') },
        { label: '分配时间', value: escapeHtml(formatDateTime(task.assignedAt)) },
        { label: '转派团队', value: escapeHtml(task.transferToTeamName || '-') },
        { label: '转派原因', value: escapeHtml(task.transferReason || '-') },
        { label: '原团队', value: escapeHtml(task.transferFromTeamName || '-') },
      ], 3)}
      <div class="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
        ${renderTextarea('转派原因', 'pattern-detail-transfer-reason', detailDraft.transferReason, '')}
        <div class="flex items-end">
          <button type="button" class="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="pattern-transfer-to-cn" data-task-id="${escapeHtml(task.patternTaskId)}">转中国团队</button>
        </div>
      </div>
    `,
  )

  const colorReviewSection = renderSectionCard(
    '难易程度与颜色确认',
    `
      <div class="grid gap-4 md:grid-cols-2">
        ${renderSelectInput('难易程度', 'pattern-detail-difficulty', detailDraft.difficultyGrade, buildSelectOptions(PATTERN_DIFFICULTY_OPTIONS))}
        ${renderSelectInput('颜色深浅', 'pattern-detail-color-depth', detailDraft.colorDepthOption, buildSelectOptions(PATTERN_COLOR_DEPTH_OPTIONS))}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderImageUploader('直播参考图', 'pattern-detail-live-reference-images', detailDraft.liveReferenceImageIds, '暂未上传直播参考图')}
        ${renderImageUploader('图片参考图', 'pattern-detail-image-reference-images', detailDraft.imageReferenceIds, '暂未上传图片参考图')}
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        ${renderTextarea('实物图说明', 'pattern-detail-physical-note', detailDraft.physicalReferenceNote, '')}
        ${renderTextarea('颜色确认说明', 'pattern-detail-color-note', detailDraft.colorConfirmNote, '')}
      </div>
    `,
  )

  const buyerReviewSection = renderSectionCard(
    '买手确认',
    `
      ${renderKeyValueGrid([
        { label: '确认状态', value: renderStatusBadge(task.buyerReviewStatus) },
        { label: '确认人', value: escapeHtml(task.buyerReviewerName || '-') },
        { label: '确认时间', value: escapeHtml(formatDateTime(task.buyerReviewAt)) },
        { label: '审核说明', value: escapeHtml(task.buyerReviewNote || '-') },
      ], 2)}
      <div class="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        ${renderTextarea('买手审核说明', 'pattern-detail-buyer-note', detailDraft.buyerReviewNote, '')}
        <div class="flex items-end">
          <button type="button" class="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700" data-pcs-engineering-action="pattern-buyer-approve" data-task-id="${escapeHtml(task.patternTaskId)}">买手通过</button>
        </div>
        <div class="flex items-end">
          <button type="button" class="inline-flex h-10 w-full items-center justify-center rounded-md border border-rose-200 bg-white px-4 text-sm font-medium text-rose-700 hover:bg-rose-50" data-pcs-engineering-action="pattern-buyer-reject" data-task-id="${escapeHtml(task.patternTaskId)}">买手驳回</button>
        </div>
      </div>
    `,
  )

  const completionReviewSection = renderSectionCard(
    '完成确认',
    `
      <div class="grid gap-4 md:grid-cols-2">
        ${renderTextInput('花型版次', 'pattern-detail-version', detailDraft.artworkVersion, '')}
        ${renderImageUploader('完成确认图片', 'pattern-detail-completion-images', detailDraft.completionImageIds, '暂未上传完成确认图片')}
      </div>
      <div class="mt-4">
        ${renderFileUploader('花型文件', 'pattern-detail-pattern-files', detailDraft.patternFileIds, '暂未上传花型文件', '.ai,.psd,.cdr,.pdf,.zip,.png,.jpg,.jpeg')}
      </div>
      <div class="mt-4 flex flex-wrap justify-end gap-3">
        <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-engineering-action="save-pattern-detail-fields" data-task-id="${escapeHtml(task.patternTaskId)}">保存任务</button>
        <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" data-pcs-engineering-action="submit-pattern-buyer-review" data-task-id="${escapeHtml(task.patternTaskId)}" ${executionDraftReady && task.status !== '已完成' && task.status !== '已取消' ? '' : `disabled title="${escapeHtml(executionDraftReady ? `当前花型任务${task.status === '已取消' ? '已取消' : '已完成'}。` : `提交前缺少：${executionDraftMissingFields.join('、')}。`)}"`}>提交买手确认</button>
      </div>
    `,
  )

  const librarySection = renderSectionCard(
    '花型库沉淀',
    `
      ${asset
        ? renderKeyValueGrid([
            { label: '花型资产', value: `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/pattern-library/${escapeHtml(asset.id)}">${escapeHtml(asset.pattern_code)}</button>` },
            { label: '维护状态', value: escapeHtml(asset.maintenance_status) },
            { label: '分类', value: escapeHtml(asset.category_primary || task.patternCategoryCode || '-') },
            { label: '风格标签', value: escapeHtml(asset.style_tags.join('、') || task.patternStyleTags.join('、') || '-') },
          ], 2)
        : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">未沉淀花型库</div>'}
      <div class="mt-4 grid gap-4 md:grid-cols-3">
        ${renderTextInput('花型库分类', 'pattern-detail-category', detailDraft.patternCategoryCode)}
        ${renderTextInput('风格标签', 'pattern-detail-style-tags', detailDraft.patternStyleTagsText)}
        <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" ${detailDraft.hotSellerFlag ? 'checked' : ''} data-pcs-engineering-field="pattern-detail-hot-flag" />
          <span>爆款花型</span>
        </label>
      </div>
      ${renderTaskSaveBar('save-pattern-detail-fields', task.patternTaskId, '保存花型库字段')}
    `,
  )

  const techPackSection = renderSectionCard('技术包写入', renderKeyValueGrid([
    { label: '关联技术包', value: task.linkedTechPackVersionId ? techPackLinkByProject(task.projectId, task.linkedTechPackVersionId, task.linkedTechPackVersionCode || task.linkedTechPackVersionLabel || '查看技术包') : '未写入' },
    { label: '技术包状态', value: escapeHtml(task.linkedTechPackVersionStatus || '未写入') },
    { label: '写入动作', value: escapeHtml(techPackAction.label) },
    { label: '限制原因', value: escapeHtml(techPackAction.disabledReason || '-') },
  ], 2))

  const sampleLinkSection = renderSectionCard(
    '下游样衣任务',
    sampleTasks.length > 0
      ? `
        <div class="space-y-3">
          ${sampleTasks.map((item) => `
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
              <div>
                <p class="text-sm font-medium text-slate-900">${escapeHtml(item.sampleCode || item.firstSampleTaskCode)}</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(item.title)}</p>
              </div>
              <div class="flex items-center gap-3">
                ${renderStatusBadge(item.status, true)}
                <button type="button" class="text-sm font-medium text-blue-700 hover:underline" data-nav="/pcs/samples/first-sample/${escapeHtml(item.firstSampleTaskId)}">打开详情</button>
              </div>
            </div>
          `).join('')}
        </div>
      `
      : '<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">当前花型任务暂未生成下游样衣任务</div>',
  )

  const mainContent = state.patternTab === 'demand'
    ? `${renderPatternCurrentActionPanel(flow, task, Boolean(asset))}${demandSection}${processSection}${demandImagesSection}`
    : state.patternTab === 'execution'
      ? `${assignmentSection}${colorReviewSection}${completionReviewSection}`
      : state.patternTab === 'review'
        ? buyerReviewSection
        : state.patternTab === 'closure'
          ? `${librarySection}${techPackSection}${sampleLinkSection}`
          : renderSectionCard('操作记录', renderLogs(logs))

  const aside = `
    <div class="space-y-4 xl:sticky xl:top-4">
      ${renderSectionCard('任务摘要', renderKeyValueGrid([
        { label: '当前阶段', value: escapeHtml(flow.stageLabel) },
        { label: '下一步', value: escapeHtml(flow.nextActionText) },
        { label: '负责人', value: escapeHtml(task.ownerName) },
        { label: '截止时间', value: escapeHtml(formatDateTime(task.dueAt)) },
        { label: '款式档案', value: styleArchiveLink(style.styleId, style.styleCode, style.styleName, task.projectId) },
        { label: '花型库状态', value: asset ? '已沉淀' : '待沉淀' },
      ], 1))}
      ${renderSectionCard('正式对象核对', renderKeyValueGrid([
        { label: '商品项目', value: projectButton(task.projectId, task.projectCode, task.projectName) },
        { label: '技术包状态', value: escapeHtml(task.linkedTechPackVersionStatus || '未写回') },
        { label: '正式状态', value: renderStatusBadge(task.status) },
      ], 1))}
    </div>
  `

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderPreviewImageModal()}
      ${header}
      ${renderPatternFlowSteps(flow)}
      ${tabBar}
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div class="space-y-6">${mainContent}</div>
        ${aside}
      </div>
    </div>
  `
}
// 列表分派注册：花型模块声明列、行、状态与统计读取，供公共列表骨架按模块分派
registerEngineeringListModule('pattern', {
  getColumns: () => PATTERN_LIST_COLUMNS,
  getRows: () => getPatternListRows(),
  getState: () => state.patternList,
  getEmptyText: () => '暂无花型任务数据',
  getStatsHtml: () => renderPatternListStats(),
})

export function renderPcsPatternTaskPage(): string {
  return renderPatternListPage()
}

export function renderPcsPatternTaskDetailPage(patternTaskId: string): string {
  return renderPatternDetailPage(patternTaskId)
}

export { getPatternMemberOptions }
