import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'
import { getProjectById } from '../data/pcs-project-repository.ts'
import {
  buildProjectArchivePageViewModel,
  buildProjectArchiveSummaryByProject,
  type ProjectArchiveDocumentViewModel,
} from '../data/pcs-project-archive-view-model.ts'
import { getProjectArchiveByProjectId } from '../data/pcs-project-archive-repository.ts'
import {
  createProjectArchive,
  deleteProjectArchiveManualDocument,
  finalizeProjectArchive,
  syncProjectArchive,
  uploadProjectArchiveManualDocument,
} from '../data/pcs-project-archive-sync.ts'

type ArchiveTab = 'base' | 'technical' | 'sample' | 'inspection' | 'missing'
type ManualDocumentGroup = 'INSPECTION_FILE' | 'QUOTATION_FILE' | 'OTHER_FILE'

interface ManualFileDraft {
  id: string
  fileName: string
  fileType: string
  previewUrl: string
}

interface ProjectArchivePageState {
  projectId: string | null
  activeTab: ArchiveTab
  notice: string | null
  uploadDialogOpen: boolean
  uploadCategory: ManualDocumentGroup
  uploadTitle: string
  uploadNote: string
  uploadFiles: ManualFileDraft[]
}

const state: ProjectArchivePageState = {
  projectId: null,
  activeTab: 'base',
  notice: null,
  uploadDialogOpen: false,
  uploadCategory: 'INSPECTION_FILE',
  uploadTitle: '',
  uploadNote: '',
  uploadFiles: [],
}

function clearUploadFiles(): void {
  state.uploadFiles.forEach((file) => {
    if (file.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(file.previewUrl)
    }
  })
  state.uploadFiles = []
}

function resetUploadForm(): void {
  clearUploadFiles()
  state.uploadCategory = 'INSPECTION_FILE'
  state.uploadTitle = ''
  state.uploadNote = ''
}

function ensureState(projectId: string): void {
  if (state.projectId !== projectId) {
    state.projectId = projectId
    state.activeTab = 'base'
    state.notice = null
    state.uploadDialogOpen = false
    resetUploadForm()
  }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-project-archive-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderEmptyState(projectId: string): string {
  const project = getProjectById(projectId)
  if (!project) {
    return `
      <section class="rounded-lg border bg-card p-8 text-center">
        <p class="text-base font-medium">商品项目未找到</p>
        <p class="mt-1 text-sm text-muted-foreground">未匹配到项目 ID：${escapeHtml(projectId)}</p>
      </section>
    `
  }

  const summary = buildProjectArchiveSummaryByProject(projectId)
  if (summary) {
    return `
      <section class="rounded-lg border bg-card p-8 text-center">
        <p class="text-base font-medium">已存在正式项目资料归档对象</p>
        <p class="mt-1 text-sm text-muted-foreground">归档编号：${escapeHtml(summary.archiveNo)} · 归档状态：${escapeHtml(summary.archiveStatusLabel)}</p>
        <div class="mt-4">
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-pcs-project-archive-action="reload-archive">查看项目资料归档</button>
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-8 text-center">
      <p class="text-base font-medium">暂无项目资料归档对象</p>
      <p class="mt-1 text-sm text-muted-foreground">当前项目尚未建立正式项目资料归档，可在此创建并集中收口研发资产。</p>
      <div class="mt-4 flex items-center justify-center gap-2">
        <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pcs-project-archive-action="back-project">返回项目</button>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-pcs-project-archive-action="create-archive">创建项目资料归档</button>
      </div>
    </section>
  `
}

function renderInfoCard(label: string, value: string, muted = false): string {
  return `
    <article class="rounded-lg border bg-muted/20 p-3">
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 text-sm ${muted ? 'text-muted-foreground' : 'font-medium'}">${escapeHtml(value)}</p>
    </article>
  `
}

function renderDocumentSection(
  title: string,
  documents: ProjectArchiveDocumentViewModel[],
): string {
  if (documents.length === 0) {
    return `
      <section class="rounded-lg border bg-card p-5">
        <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
        <div class="mt-3 rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          当前分组暂无正式资料。
        </div>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
        <span class="text-xs text-muted-foreground">${documents.length} 条资料</span>
      </div>
      <div class="space-y-3">
        ${documents
          .map(
            (document) => `
              <article class="rounded-lg border bg-muted/10 p-4">
                <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div><span class="text-muted-foreground">资料分组：</span><span class="font-medium">${escapeHtml(document.groupLabel)}</span></div>
                  <div><span class="text-muted-foreground">资料类别：</span><span class="font-medium">${escapeHtml(document.documentCategory)}</span></div>
                  <div><span class="text-muted-foreground">资料标题：</span><span class="font-medium">${escapeHtml(document.documentTitle)}</span></div>
                  <div><span class="text-muted-foreground">当前状态：</span><span class="font-medium">${escapeHtml(document.documentStatus || '—')}</span></div>
                  <div><span class="text-muted-foreground">来源模块：</span><span class="font-medium">${escapeHtml(document.sourceModule)}</span></div>
                  <div><span class="text-muted-foreground">来源对象：</span><span class="font-medium">${escapeHtml(document.sourceObjectCode || '—')}</span></div>
                  <div><span class="text-muted-foreground">来源版本：</span><span class="font-medium">${escapeHtml(document.sourceVersionCode || document.sourceVersionLabel || '—')}</span></div>
                  <div><span class="text-muted-foreground">业务时间：</span><span class="font-medium">${escapeHtml(document.businessDate || '—')}</span></div>
                  <div><span class="text-muted-foreground">项目工作项：</span><span class="font-medium">${escapeHtml(document.workItemTypeName || '—')}</span></div>
                  <div><span class="text-muted-foreground">负责人：</span><span class="font-medium">${escapeHtml(document.ownerName || '—')}</span></div>
                  <div><span class="text-muted-foreground">文件数量：</span><span class="font-medium">${document.fileCount}</span></div>
                  <div><span class="text-muted-foreground">可复用：</span><span class="font-medium">${document.reusableFlag ? '是' : '否'}</span></div>
                </div>
                ${
                  document.fileList.length > 0
                    ? `
                      <div class="mt-3 rounded-lg border border-slate-200 bg-white/70 p-3">
                        <p class="text-xs text-muted-foreground">文件列表</p>
                        <div class="mt-2 flex flex-wrap gap-2">
                          ${document.fileList
                            .map(
                              (file) => `
                                <span class="inline-flex items-center rounded-md border px-2 py-1 text-xs">
                                  ${escapeHtml(file.fileName)} · ${escapeHtml(file.fileType || '文件')}
                                </span>
                              `,
                            )
                            .join('')}
                        </div>
                      </div>
                    `
                    : ''
                }
                ${
                  document.manualFlag
                    ? `
                      <div class="mt-3 flex justify-end">
                        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-archive-action="delete-manual-document" data-document-id="${escapeHtml(document.archiveDocumentId)}">
                          删除手工资料
                        </button>
                      </div>
                    `
                    : ''
                }
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderBaseTab(viewModel: NonNullable<ReturnType<typeof buildProjectArchivePageViewModel>>): string {
  return `
    <div class="space-y-4">
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderInfoCard('归档编号', viewModel.archive.archiveNo)}
        ${renderInfoCard('项目编号', viewModel.archive.projectCode)}
        ${renderInfoCard('项目名称', viewModel.archive.projectName)}
        ${renderInfoCard('归档状态', viewModel.archiveStatusLabel)}
        ${renderInfoCard('关联款式档案', viewModel.styleLinkText, !viewModel.archive.styleId)}
        ${renderInfoCard('当前生效技术包版本', viewModel.technicalVersionText, !viewModel.archive.currentTechnicalVersionId)}
        ${renderInfoCard('资料数量', `${viewModel.archive.documentCount} 条`, viewModel.archive.documentCount === 0)}
        ${renderInfoCard('文件数量', `${viewModel.archive.fileCount} 份`, viewModel.archive.fileCount === 0)}
      </section>
      ${renderDocumentSection('基础与来源', viewModel.baseDocuments)}
    </div>
  `
}

function renderTechnicalTab(viewModel: NonNullable<ReturnType<typeof buildProjectArchivePageViewModel>>): string {
  return renderDocumentSection('技术与图纸', viewModel.technicalDocuments)
}

function renderSampleTab(viewModel: NonNullable<ReturnType<typeof buildProjectArchivePageViewModel>>): string {
  return renderDocumentSection('样衣与打样', viewModel.sampleDocuments)
}

function renderInspectionTab(viewModel: NonNullable<ReturnType<typeof buildProjectArchivePageViewModel>>): string {
  return renderDocumentSection('检测与报价', viewModel.manualDocuments)
}

function renderMissingTab(viewModel: NonNullable<ReturnType<typeof buildProjectArchivePageViewModel>>): string {
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-card p-5">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold">缺失项清单</h3>
          <span class="text-xs text-muted-foreground">${viewModel.missingItems.length} 项缺失</span>
        </div>
        ${
          viewModel.missingItems.length === 0
            ? `
              <div class="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                当前归档对象暂无缺失项，可执行完成归档。
              </div>
            `
            : `
              <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead class="bg-muted/30 text-left text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 font-medium">缺失项</th>
                      <th class="px-3 py-2 font-medium">关联工作项</th>
                      <th class="px-3 py-2 font-medium">原因类型</th>
                      <th class="px-3 py-2 font-medium">原因说明</th>
                      <th class="px-3 py-2 font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    ${viewModel.missingItems
                      .map(
                        (item) => `
                          <tr>
                            <td class="px-3 py-3 font-medium">${escapeHtml(item.itemName)}</td>
                            <td class="px-3 py-3">${escapeHtml(item.workItemTypeName || '—')}</td>
                            <td class="px-3 py-3">${escapeHtml(item.reasonType)}</td>
                            <td class="px-3 py-3">${escapeHtml(item.reasonText)}</td>
                            <td class="px-3 py-3">${escapeHtml(item.status)}</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
        }
      </section>
      ${renderDocumentSection('已上传手工资料', viewModel.manualDocuments)}
    </div>
  `
}

function renderTabs(): string {
  const tabs: Array<{ key: ArchiveTab; label: string }> = [
    { key: 'base', label: '基础与来源' },
    { key: 'technical', label: '技术与图纸' },
    { key: 'sample', label: '样衣与打样' },
    { key: 'inspection', label: '检测与报价' },
    { key: 'missing', label: '缺失项与手工资料' },
  ]
  return `
    <div class="flex flex-wrap gap-2">
      ${tabs
        .map(
          (tab) => `
            <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm ${
              state.activeTab === tab.key ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'
            }" data-pcs-project-archive-action="set-tab" data-tab="${tab.key}">${tab.label}</button>
          `,
        )
        .join('')}
    </div>
  `
}

function renderUploadDialog(): string {
  if (!state.uploadDialogOpen) return ''
  const categoryOptions: Array<{ value: ManualDocumentGroup; label: string }> = [
    { value: 'INSPECTION_FILE', label: '检测资料' },
    { value: 'QUOTATION_FILE', label: '报价资料' },
    { value: 'OTHER_FILE', label: '其他说明资料' },
  ]
  return `
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4">
      <section class="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <header class="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">上传手工资料</h2>
            <p class="mt-1 text-sm text-muted-foreground">本轮支持检测资料、报价资料和其他说明资料。</p>
          </div>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border text-lg hover:bg-muted" data-pcs-project-archive-action="close-upload">×</button>
        </header>
        <div class="space-y-4 px-5 py-4">
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-2 text-sm">
              <span class="font-medium">资料类别</span>
              <select class="h-9 w-full rounded-md border px-3 text-sm" data-pcs-project-archive-field="uploadCategory">
                ${categoryOptions
                  .map(
                    (option) => `
                      <option value="${option.value}" ${state.uploadCategory === option.value ? 'selected' : ''}>${option.label}</option>
                    `,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-2 text-sm">
              <span class="font-medium">资料标题</span>
              <input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.uploadTitle)}" data-pcs-project-archive-field="uploadTitle" placeholder="请输入资料标题" />
            </label>
          </div>
          <label class="space-y-2 text-sm">
            <span class="font-medium">资料说明</span>
            <textarea class="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm" data-pcs-project-archive-field="uploadNote" placeholder="请填写资料说明">${escapeHtml(state.uploadNote)}</textarea>
          </label>
          <label class="space-y-2 text-sm">
            <span class="font-medium">文件列表</span>
            <input type="file" multiple class="block w-full text-sm" data-pcs-project-archive-field="uploadFiles" />
            <div class="rounded-lg border bg-muted/20 p-3">
              ${
                state.uploadFiles.length === 0
                  ? '<p class="text-sm text-muted-foreground">尚未选择文件。</p>'
                  : `
                      <div class="flex flex-wrap gap-2">
                        ${state.uploadFiles
                          .map(
                            (file) => `
                              <span class="inline-flex items-center rounded-md border px-2 py-1 text-xs">
                                ${escapeHtml(file.fileName)} · ${escapeHtml(file.fileType || '文件')}
                              </span>
                            `,
                          )
                          .join('')}
                      </div>
                    `
              }
            </div>
          </label>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pcs-project-archive-action="close-upload">取消</button>
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-pcs-project-archive-action="submit-upload">确认上传</button>
        </footer>
      </section>
    </div>
  `
}

export function renderPcsProjectArchivePage(projectId: string): string {
  ensureState(projectId)
  const archive = getProjectArchiveByProjectId(projectId)
  const viewModel = archive ? buildProjectArchivePageViewModel(archive.projectArchiveId) : null

  if (!viewModel) {
    return `
      <div class="space-y-4">
        <header class="rounded-lg border bg-card p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs text-muted-foreground">商品项目 / 项目资料归档</p>
              <h1 class="mt-2 text-2xl font-semibold">项目资料归档</h1>
            </div>
            <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pcs-project-archive-action="back-project">返回项目</button>
          </div>
        </header>
        ${renderNotice()}
        ${renderEmptyState(projectId)}
        ${renderUploadDialog()}
      </div>
    `
  }

  const tabContent =
    state.activeTab === 'base'
      ? renderBaseTab(viewModel)
      : state.activeTab === 'technical'
        ? renderTechnicalTab(viewModel)
        : state.activeTab === 'sample'
          ? renderSampleTab(viewModel)
          : state.activeTab === 'inspection'
            ? renderInspectionTab(viewModel)
            : renderMissingTab(viewModel)

  return `
    <div class="space-y-4">
      <header class="rounded-lg border bg-card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-2">
            <p class="text-xs text-muted-foreground">商品项目 / 项目资料归档 / ${escapeHtml(viewModel.archive.projectName)}</p>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold">${escapeHtml(viewModel.archive.projectName)}项目资料归档</h1>
              <span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(viewModel.archive.archiveNo)}</span>
              <span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">${escapeHtml(viewModel.archiveStatusLabel)}</span>
            </div>
            <p class="text-sm text-muted-foreground">
              项目编号：${escapeHtml(viewModel.archive.projectCode)} · 关联款式档案：${escapeHtml(viewModel.styleLinkText)} · 当前生效技术包版本：${escapeHtml(viewModel.technicalVersionText)}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pcs-project-archive-action="back-project">返回项目</button>
            <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pcs-project-archive-action="sync-archive">同步归档资料</button>
            <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pcs-project-archive-action="open-upload">上传手工资料</button>
            <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-pcs-project-archive-action="finalize-archive">完成归档</button>
          </div>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          ${renderInfoCard('归档编号', viewModel.archive.archiveNo)}
          ${renderInfoCard('归档状态', viewModel.archiveStatusLabel)}
          ${renderInfoCard('资料数量', `${viewModel.archive.documentCount} 条`)}
          ${renderInfoCard('文件数量', `${viewModel.archive.fileCount} 份`)}
          ${renderInfoCard('缺失项数量', `${viewModel.archive.missingItemCount} 项`, viewModel.archive.missingItemCount === 0)}
          ${renderInfoCard('自动收集资料', `${viewModel.archive.autoCollectedCount} 条`, viewModel.archive.autoCollectedCount === 0)}
          ${renderInfoCard('手工上传资料', `${viewModel.archive.manualUploadedCount} 条`, viewModel.archive.manualUploadedCount === 0)}
          ${renderInfoCard('可完成归档', viewModel.archive.readyForFinalize ? '是' : '否')}
          ${renderInfoCard('更新时间', viewModel.archive.updatedAt)}
          ${renderInfoCard('完成归档时间', viewModel.archive.finalizedAt || '未完成归档', !viewModel.archive.finalizedAt)}
        </div>
      </header>
      ${renderNotice()}
      ${renderTabs()}
      ${tabContent}
      ${renderUploadDialog()}
    </div>
  `
}

export function handlePcsProjectArchiveEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-project-archive-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsProjectArchiveAction
  if (!action) return false

  if (action === 'back-project') {
    if (state.projectId) {
      appStore.navigate(`/pcs/projects/${encodeURIComponent(state.projectId)}`)
    } else {
      appStore.navigate('/pcs/projects')
    }
    return true
  }

  if (action === 'reload-archive') {
    if (state.projectId) {
      appStore.navigate(`/pcs/projects/${encodeURIComponent(state.projectId)}/archive`)
    }
    return true
  }

  if (action === 'set-tab') {
    const tab = actionNode.dataset.tab as ArchiveTab | undefined
    if (tab) state.activeTab = tab
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'create-archive') {
    if (!state.projectId) return true
    const result = createProjectArchive(state.projectId, '商品中心')
    state.notice = result.message
    if (result.ok && result.archive) {
      appStore.navigate(`/pcs/projects/${encodeURIComponent(state.projectId)}/archive`)
    }
    return true
  }

  if (action === 'sync-archive') {
    if (!state.projectId) return true
    const archive = getProjectArchiveByProjectId(state.projectId)
    if (!archive) {
      state.notice = '当前项目尚未建立正式项目资料归档对象。'
      return true
    }
    const nextArchive = syncProjectArchive(archive.projectArchiveId, '商品中心')
    state.notice = `已同步项目资料归档：${nextArchive.archiveNo}。`
    return true
  }

  if (action === 'open-upload') {
    state.uploadDialogOpen = true
    return true
  }

  if (action === 'close-upload') {
    state.uploadDialogOpen = false
    resetUploadForm()
    return true
  }

  if (action === 'submit-upload') {
    if (!state.projectId) return true
    const archive = getProjectArchiveByProjectId(state.projectId)
    if (!archive) {
      state.notice = '当前项目尚未建立正式项目资料归档对象。'
      return true
    }
    if (!state.uploadTitle.trim()) {
      state.notice = '请填写资料标题后再上传。'
      return true
    }
    if (state.uploadFiles.length === 0) {
      state.notice = '请至少选择一个文件后再上传。'
      return true
    }
    uploadProjectArchiveManualDocument(
      archive.projectArchiveId,
      {
        documentGroup: state.uploadCategory,
        title: state.uploadTitle,
        note: state.uploadNote,
        files: state.uploadFiles.map((file) => ({
          fileName: file.fileName,
          fileType: file.fileType,
          previewUrl: file.previewUrl,
        })),
      },
      '商品中心',
    )
    state.notice = '已上传手工资料，并同步更新项目资料归档。'
    state.uploadDialogOpen = false
    resetUploadForm()
    state.activeTab = 'missing'
    return true
  }

  if (action === 'delete-manual-document') {
    if (!state.projectId) return true
    const archive = getProjectArchiveByProjectId(state.projectId)
    const documentId = actionNode.dataset.documentId
    if (!archive || !documentId) return true
    deleteProjectArchiveManualDocument(archive.projectArchiveId, documentId, '商品中心')
    state.notice = '已删除手工资料，并重新同步归档状态。'
    return true
  }

  if (action === 'finalize-archive') {
    if (!state.projectId) return true
    const archive = getProjectArchiveByProjectId(state.projectId)
    if (!archive) {
      state.notice = '当前项目尚未建立正式项目资料归档对象。'
      return true
    }
    try {
      const nextArchive = finalizeProjectArchive(archive.projectArchiveId, '商品中心')
      state.notice = `已完成项目资料归档：${nextArchive.archiveNo}。`
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '完成项目资料归档失败。'
    }
    return true
  }

  return false
}

export function handlePcsProjectArchiveInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-project-archive-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsProjectArchiveField
  if (!field) return false

  if (field === 'uploadCategory' && fieldNode instanceof HTMLSelectElement) {
    state.uploadCategory = fieldNode.value as ManualDocumentGroup
    return true
  }

  if (field === 'uploadTitle' && fieldNode instanceof HTMLInputElement) {
    state.uploadTitle = fieldNode.value
    return true
  }

  if (field === 'uploadNote' && fieldNode instanceof HTMLTextAreaElement) {
    state.uploadNote = fieldNode.value
    return true
  }

  if (field === 'uploadFiles' && fieldNode instanceof HTMLInputElement) {
    clearUploadFiles()
    const files = Array.from(fieldNode.files || [])
    state.uploadFiles = files.map((file, index) => ({
      id: `manual_upload_${index + 1}`,
      fileName: file.name,
      fileType: file.type || file.name.split('.').pop()?.toUpperCase() || '文件',
      previewUrl: URL.createObjectURL(file),
    }))
    return true
  }

  return false
}

export function isPcsProjectArchiveDialogOpen(): boolean {
  return state.uploadDialogOpen
}
