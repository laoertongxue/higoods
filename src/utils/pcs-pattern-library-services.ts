import type {
  PatternLibraryConfig,
  PatternParsedFileResult,
  PatternTagRecord,
} from '../data/pcs-pattern-library-types.ts'
import {
  buildPatternTagSuggestions,
  buildPatternCategoryPath,
  canPatternBeReferenced,
  clonePatternCategoryTree,
  DEFAULT_PATTERN_CATEGORY_TREE,
  formatPatternCategoryTreeText,
  getPatternCategoryPrimaryOptions,
  getPatternCategorySecondaryOptions,
  getPatternCategorySuggestions,
  getPatternMimeTypeFromExt,
  getPatternSimilarityHit,
  getPatternSimilarityStatusText,
  hammingDistance,
  inferDuplicateStatus,
  isPatternLicenseUsable,
  parsePatternCategoryTreeText,
  parseJpegMetadata,
  parsePngMetadata,
  parseTiffMetadata,
  tokenizePatternFilename,
  validatePatternSubmitEligibility,
} from './pcs-pattern-library-core.ts'

export {
  buildPatternCategoryPath,
  canPatternBeReferenced,
  clonePatternCategoryTree,
  DEFAULT_PATTERN_CATEGORY_TREE,
  formatPatternCategoryTreeText,
  getPatternCategoryPrimaryOptions,
  getPatternCategorySecondaryOptions,
  getPatternCategorySuggestions,
  getPatternSimilarityHit,
  getPatternSimilarityStatusText,
  hammingDistance,
  inferDuplicateStatus,
  isPatternLicenseUsable,
  parsePatternCategoryTreeText,
  parseJpegMetadata,
  parsePngMetadata,
  parseTiffMetadata,
  tokenizePatternFilename,
  validatePatternSubmitEligibility,
}

interface WorkerRequestState {
  resolve: (result: PatternParsedFileResult) => void
  reject: (error: Error) => void
}

const workerRequests = new Map<string, WorkerRequestState>()
let parseWorker: Worker | null = null

function getParseWorker(): Worker {
  if (parseWorker) return parseWorker
  parseWorker = new Worker(new URL('../workers/pcs-pattern-parse.worker.ts', import.meta.url), { type: 'module' })
  parseWorker.addEventListener('message', (event: MessageEvent<{ id: string; result?: PatternParsedFileResult; error?: string }>) => {
    const payload = event.data
    const request = workerRequests.get(payload.id)
    if (!request) return
    workerRequests.delete(payload.id)
    if (payload.result) {
      request.resolve(payload.result)
      return
    }
    request.reject(new Error(payload.error || '文件解析失败'))
  })
  parseWorker.addEventListener('error', (event) => {
    workerRequests.forEach(({ reject }) => reject(new Error(event.message || '解析线程异常')))
    workerRequests.clear()
    parseWorker?.terminate()
    parseWorker = null
  })
  return parseWorker
}

async function parseFileInWorker(file: File): Promise<PatternParsedFileResult> {
  const worker = getParseWorker()
  const buffer = await file.arrayBuffer()
  const requestId = `${Date.now()}_${Math.random().toString(16).slice(2)}`
  return new Promise<PatternParsedFileResult>((resolve, reject) => {
    workerRequests.set(requestId, { resolve, reject })
    worker.postMessage(
      {
        id: requestId,
        fileName: file.name,
        fileType: file.type || getPatternMimeTypeFromExt(file.name.split('.').pop()?.toLowerCase() ?? ''),
        buffer,
      },
      [buffer],
    )
  })
}

export class PatternParseService {
  static async parseFile(file: File): Promise<PatternParsedFileResult> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['jpg', 'jpeg', 'png', 'tif', 'tiff'].includes(ext)) {
      throw new Error('当前原型仅支持 JPG / JPEG / PNG / TIF / TIFF 文件')
    }
    if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
      return parseFileInWorker(file)
    }
    return {
      originalFilename: file.name,
      fileExt: ext,
      mimeType: file.type || getPatternMimeTypeFromExt(ext),
      fileSize: file.size,
      filenameTokens: tokenizePatternFilename(file.name),
      parseStatus: 'failed',
      parseErrorMessage: '当前环境不支持前端解析线程',
      parseSummary: '当前环境不支持前端解析线程',
      dominantColors: [],
      parseWarnings: ['当前环境不支持前端解析线程'],
      parseResultJson: {},
    }
  }
}

export class PatternTagService {
  static suggestTags(input: {
    filename: string
    tokens: ReturnType<typeof tokenizePatternFilename>
    dominantColors: string[]
    width?: number
    height?: number
    config: PatternLibraryConfig
  }): Array<Omit<PatternTagRecord, 'id' | 'pattern_asset_id'>> {
    return buildPatternTagSuggestions(input)
  }
}
