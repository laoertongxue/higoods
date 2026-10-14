type CellMap = Record<string, string>

const decoder = new TextDecoder('utf-8')
const oleSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

// Import values, not a spreadsheet renderer: dates use the same unambiguous form as the PMS inputs.
export function formatPmsExcelNumber(value: number, formatId = 0, format = '', date1904 = false): string {
  if (!Number.isFinite(value)) throw new Error('Excel 中有无效数字，请修正后重新上传')
  const tokens = format.replace(/"[^"]*"|\\.|_.|\*./g, '').replace(/\[(?![hms]+\])[^\]]*\]/gi, '')
  const isDate = (formatId >= 14 && formatId <= 17) || formatId === 22 || (formatId >= 27 && formatId <= 36) || (formatId >= 50 && formatId <= 58) || /[yd]/i.test(tokens)
  const isTime = (formatId >= 18 && formatId <= 21) || (formatId >= 45 && formatId <= 47) || /[hs]/i.test(tokens)
  if (!isDate && !isTime) return String(value)
  if (/\[[hms]+\]/i.test(tokens)) throw new Error('暂不支持累计时长格式，请把该列改为文本或日期后重新上传')
  if (value < 0 || value > 2958465) throw new Error('Excel 日期超出有效范围，请修正后重新上传')
  const seconds = Math.round(value * 86400)
  const day = Math.floor(seconds / 86400)
  const time = seconds % 86400
  const hhmmss = [Math.floor(time / 3600), Math.floor(time / 60) % 60, time % 60].map((n) => String(n).padStart(2, '0')).join(':')
  if (!isDate) return hhmmss
  const date = !date1904 && day === 60 ? '1900-02-29' : new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31) + (day - (!date1904 && day > 60 ? 1 : 0)) * 86400000).toISOString().slice(0, 10)
  return isTime ? `${date} ${hhmmss}` : date
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Excel XML 内容损坏，请用 Excel 重新保存后上传')
  return doc
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/\d/g, '')
  return letters.split('').reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

function parseDelimited(text: string): string[][] {
  const delimiter = text.split(/\r?\n/, 1)[0].includes('\t') ? '\t' : ','
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i += 1 } else quoted = !quoted
    } else if (!quoted && (char === delimiter || char === '\n' || char === '\r')) {
      row.push(value.trim()); value = ''
      if (char !== delimiter) { if (row.some(Boolean)) rows.push(row); row = []; if (char === '\r' && text[i + 1] === '\n') i += 1 }
    } else value += char
  }
  if (quoted) throw new Error('CSV 引号未闭合，请修正文件后重新上传')
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row)
  return rows
}

function parseHtmlTable(text: string): string[][] {
  const doc = new DOMParser().parseFromString(text, 'text/html')
  return Array.from(doc.querySelectorAll('tr'))
    .map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent?.trim() ?? ''))
    .filter((row) => row.length)
}

async function unzipEntry(bytes: Uint8Array, entryName: string): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const valid = (offset: number, size: number) => { if (offset < 0 || offset + size > bytes.length) throw new Error('xlsx 文件截断或目录损坏，请用 Excel 重新保存后上传') }
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50) end -= 1
  if (end < 0) throw new Error('未找到 xlsx 中央目录')
  valid(end, 22)
  if (view.getUint32(end, true) !== 0x06054b50) throw new Error('未找到 xlsx 中央目录，请重新保存文件后上传')
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('不支持分卷 xlsx，请用 Excel 另存为普通 .xlsx 后上传')
  const centralOffset = view.getUint32(end + 16, true)
  const totalEntries = view.getUint16(end + 10, true)
  let cursor = centralOffset

  for (let index = 0; index < totalEntries; index += 1) {
    valid(cursor, 46)
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('xlsx 中央目录格式错误')
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const fileNameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const fileName = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength))
    valid(cursor + 46, fileNameLength + extraLength + commentLength)
    cursor += 46 + fileNameLength + extraLength + commentLength
    if (fileName !== entryName) continue

    valid(localOffset, 30)
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('xlsx 文件内容损坏，请重新保存后上传')
    if (view.getUint16(localOffset + 6, true) & 1) throw new Error('文件已加密，请取消打开密码后重新上传')
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    valid(dataStart, compressedSize)
    const compressed = bytes.slice(dataStart, dataStart + compressedSize)
    if (method === 0) return decoder.decode(compressed)
    if (method !== 8) throw new Error('暂不支持该 xlsx 压缩方式')
    if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持 xlsx 解压，请更换新版 Chrome 后重试')
    const stream = new Blob([new Uint8Array(compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat))
    return decoder.decode(await new Response(stream).arrayBuffer())
  }
  return ''
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return []
  const doc = parseXml(xml)
  return Array.from(doc.querySelectorAll('si')).map((si) => Array.from(si.querySelectorAll('t')).map((t) => t.textContent ?? '').join(''))
}

function parseWorksheet(xml: string, shared: string[], styles: number[], formats: Map<number, string>, date1904: boolean): string[][] {
  const doc = parseXml(xml)
  return Array.from(doc.querySelectorAll('sheetData row'))
    .map((row) => {
      const cells: CellMap = {}
      row.querySelectorAll('c').forEach((cell) => {
        const ref = cell.getAttribute('r') ?? ''
        const type = cell.getAttribute('t')
        if (!/^[A-Z]+[1-9]\d*$/.test(ref)) throw new Error('xlsx 单元格位置损坏，请重新保存文件后上传')
        if (Object.hasOwn(cells, String(columnIndex(ref)))) throw new Error(`单元格 ${ref} 重复，请重新保存文件后上传`)
        const inlineText = Array.from(cell.querySelectorAll('is t')).map((t) => t.textContent ?? '').join('')
        const rawValue = cell.querySelector('v')?.textContent ?? ''
        if (type === 'e') throw new Error(`单元格 ${ref} 存在 Excel 错误，请修正后重新上传`)
        if (type === 'b' && !['0', '1'].includes(rawValue)) throw new Error(`单元格 ${ref} 布尔值损坏，请重新保存文件后上传`)
        if (type === 's' && (!Number.isInteger(Number(rawValue)) || !shared[Number(rawValue)])) {
          if (shared[Number(rawValue)] !== '') throw new Error('xlsx 文本索引损坏，请重新保存文件后上传')
        }
        const formatId = styles[Number(cell.getAttribute('s') ?? 0)] ?? 0
        const value = type === 's' ? shared[Number(rawValue)] : type === 'inlineStr' ? inlineText : type === 'b' ? rawValue === '1' ? 'TRUE' : 'FALSE' : rawValue && (!type || type === 'n') ? formatPmsExcelNumber(Number(rawValue), formatId, formats.get(formatId), date1904) : rawValue
        cells[String(columnIndex(ref))] = value.trim()
      })
      const max = Math.max(...Object.keys(cells).map(Number), -1)
      return Array.from({ length: max + 1 }, (_, index) => cells[String(index)] ?? '')
    })
    .filter((row) => row.some(Boolean))
}

export async function parsePmsExcelRows(file: File): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (oleSignature.every((value, index) => bytes[index] === value)) {
    const { parsePmsBinaryExcelRows } = await import('./pms-excel-binary-import.ts')
    return parsePmsBinaryExcelRows(bytes)
  }
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) throw new Error('xls 文件头损坏，请用 Excel 重新保存后上传')
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const shared = parseSharedStrings(await unzipEntry(bytes, 'xl/sharedStrings.xml'))
    const workbookXml = await unzipEntry(bytes, 'xl/workbook.xml')
    const workbook = workbookXml ? parseXml(workbookXml) : undefined
    let sheetPath = 'xl/worksheets/sheet1.xml'
    if (workbook?.querySelector('sheets sheet')) {
      const rels = parseXml(await unzipEntry(bytes, 'xl/_rels/workbook.xml.rels'))
      const relations = Array.from(rels.querySelectorAll('Relationship'))
      const relation = Array.from(workbook.querySelectorAll('sheets sheet')).map((sheet) => relations.find((entry) => entry.getAttribute('Id') === sheet.getAttribute('r:id'))).find((entry) => entry?.getAttribute('Type')?.endsWith('/worksheet') || /(^|\/)worksheets\//.test(entry?.getAttribute('Target') ?? ''))
      const target = relation?.getAttribute('Target')
      if (!target || target.includes('..') || target.includes(':')) throw new Error('xlsx 首工作表引用不支持，请另存为普通 .xlsx 后上传')
      if (relation?.getAttribute('TargetMode') === 'External') throw new Error('不支持外部工作表引用，请把数据保存在此 Excel 文件内后上传')
      sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`
    }
    const stylesXml = await unzipEntry(bytes, 'xl/styles.xml')
    const stylesDoc = stylesXml ? parseXml(stylesXml) : undefined
    const styles = Array.from(stylesDoc?.querySelectorAll('cellXfs xf') ?? []).map((xf) => Number(xf.getAttribute('numFmtId') ?? 0))
    const formats = new Map(Array.from(stylesDoc?.querySelectorAll('numFmts numFmt') ?? []).map((item) => [Number(item.getAttribute('numFmtId')), item.getAttribute('formatCode') ?? '']))
    const sheet = await unzipEntry(bytes, sheetPath)
    if (!sheet) throw new Error('xlsx 中未找到第一个工作表')
    return parseWorksheet(sheet, shared, styles, formats, ['1', 'true'].includes(workbook?.querySelector('workbookPr')?.getAttribute('date1904') ?? ''))
  }
  if (file.name.toLowerCase().endsWith('.xlsx')) throw new Error('文件不是有效 xlsx，请用 Excel 重新保存后上传')
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new Error('文件不是有效 Excel 或 UTF-8 文本，请用 Excel 重新保存为 .xls / .xlsx 后上传') }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error('文件含不支持的二进制内容，请用 Excel 重新保存为 .xls / .xlsx 后上传')
  if (/<table\b|<tr\b/i.test(text)) return parseHtmlTable(text)
  if (/^\s*</.test(text)) throw new Error('暂不支持该 XML 表格格式，请用 Excel 另存为 .xlsx 后上传')
  return parseDelimited(text)
}
