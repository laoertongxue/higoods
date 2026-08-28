// PCS 生产工程成果文件：原型中也必须由真实 File 对象产生，不能用地址或文件名冒充上传。

export type EngineeringUploadPurpose =
  | 'STYLE_IMAGE'
  | 'DESIGN_IMAGE'
  | 'PATTERN_SOURCE'
  | 'PATTERN_PREVIEW'
  | 'PATTERN_ARTWORK'
  | 'COLOR_RESULT'
  | 'SAMPLE_RESULT'
  | 'TECHNICAL_ATTACHMENT'

export type EngineeringUploadStatus = '上传中' | '已保存' | '上传失败'

export interface EngineeringUploadedFile {
  fileId: string
  purpose: EngineeringUploadPurpose
  fileName: string
  extension: string
  mimeType: string
  sizeBytes: number
  dataUrl: string
  status: EngineeringUploadStatus
  uploadedById: string
  uploadedByName: string
  uploadedByTeam: string
  uploadedAt: string
  roundNo: number
  errorMessage: string
}

export interface EngineeringUploadRule {
  label: string
  accept: string
  extensions: string[]
  maxSizeBytes: number
}

const MB = 1024 * 1024
let fallbackUploadSequence = 0

function createEngineeringUploadFileId(index: number): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `ENG-FILE-${uuid}`
  fallbackUploadSequence += 1
  return `ENG-FILE-${Date.now().toString(36)}-${fallbackUploadSequence.toString(36).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`
}

export const ENGINEERING_UPLOAD_RULES: Record<EngineeringUploadPurpose, EngineeringUploadRule> = {
  STYLE_IMAGE: { label: '款式图片', accept: '.jpg,.jpeg,.png,.webp', extensions: ['jpg', 'jpeg', 'png', 'webp'], maxSizeBytes: 5 * MB },
  DESIGN_IMAGE: { label: '设计稿', accept: '.jpg,.jpeg,.png,.webp', extensions: ['jpg', 'jpeg', 'png', 'webp'], maxSizeBytes: 5 * MB },
  PATTERN_SOURCE: { label: '纸样源文件', accept: '.prj,.dxf,.rul,.pdf', extensions: ['prj', 'dxf', 'rul', 'pdf'], maxSizeBytes: 8 * MB },
  PATTERN_PREVIEW: { label: '纸样预览图', accept: '.jpg,.jpeg,.png,.webp,.pdf', extensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'], maxSizeBytes: 5 * MB },
  PATTERN_ARTWORK: { label: '花型成果', accept: '.jpg,.jpeg,.png,.webp,.pdf,.ai,.psd', extensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'ai', 'psd'], maxSizeBytes: 8 * MB },
  COLOR_RESULT: { label: '调色成果', accept: '.jpg,.jpeg,.png,.webp,.pdf', extensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'], maxSizeBytes: 5 * MB },
  SAMPLE_RESULT: { label: '样衣成果图', accept: '.jpg,.jpeg,.png,.webp', extensions: ['jpg', 'jpeg', 'png', 'webp'], maxSizeBytes: 5 * MB },
  TECHNICAL_ATTACHMENT: { label: '技术资料附件', accept: '.pdf,.doc,.docx,.xls,.xlsx,.zip', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip'], maxSizeBytes: 8 * MB },
}

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

export function getEngineeringFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  return index < 0 ? '' : fileName.slice(index + 1).trim().toLowerCase()
}

export function validateEngineeringUploadFile(file: Pick<File, 'name' | 'size'>, purpose: EngineeringUploadPurpose): void {
  const rule = ENGINEERING_UPLOAD_RULES[purpose]
  const extension = getEngineeringFileExtension(file.name)
  if (!extension || !rule.extensions.includes(extension)) {
    throw new Error(`${rule.label}仅支持 ${rule.extensions.map((item) => `.${item}`).join('、')} 文件。`)
  }
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error(`${file.name} 为空文件，无法上传。`)
  if (file.size > rule.maxSizeBytes) {
    throw new Error(`${file.name} 超过 ${Math.round(rule.maxSizeBytes / MB)} MB，无法上传。`)
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)))
  }
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : (globalThis as unknown as { Buffer: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer.from(binary, 'binary').toString('base64')
  return `data:${file.type || 'application/octet-stream'};base64,${base64}`
}

export async function captureEngineeringUploadedFiles(input: {
  files: FileList | File[]
  purpose: EngineeringUploadPurpose
  actor: { userId: string; userName: string; teamName: string }
  roundNo?: number
  uploadedAt?: string
}): Promise<EngineeringUploadedFile[]> {
  const files = Array.from(input.files)
  if (files.length === 0) throw new Error(`请选择真实的${ENGINEERING_UPLOAD_RULES[input.purpose].label}。`)
  if (!input.actor.userId.trim() || !input.actor.userName.trim() || !input.actor.teamName.trim()) {
    throw new Error('上传文件缺少实际操作人或所在团队。')
  }
  files.forEach((file) => validateEngineeringUploadFile(file, input.purpose))
  const uploadedAt = input.uploadedAt || nowText()
  return Promise.all(files.map(async (file, index) => ({
    fileId: createEngineeringUploadFileId(index),
    purpose: input.purpose,
    fileName: file.name,
    extension: getEngineeringFileExtension(file.name),
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    dataUrl: await fileToDataUrl(file),
    status: '已保存' as const,
    uploadedById: input.actor.userId,
    uploadedByName: input.actor.userName,
    uploadedByTeam: input.actor.teamName,
    uploadedAt,
    roundNo: input.roundNo || 1,
    errorMessage: '',
  })))
}

export function assertEngineeringUploadedFilesReady(files: EngineeringUploadedFile[], label = '成果文件'): void {
  if (files.length === 0) throw new Error(`请先上传并保存${label}。`)
  const invalid = files.find((file) => file.status !== '已保存' || !file.dataUrl || !file.fileName)
  if (invalid) throw new Error(`${invalid.fileName || label}尚未保存成功，不能推进任务。`)
}

export function formatEngineeringUploadSize(sizeBytes: number): string {
  if (sizeBytes >= MB) return `${(sizeBytes / MB).toFixed(2)} MB`
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
}
