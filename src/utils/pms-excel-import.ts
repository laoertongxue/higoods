type CellMap = Record<string, string>

const decoder = new TextDecoder('utf-8')

function columnIndex(ref: string): number {
  const letters = ref.replace(/\d/g, '')
  return letters.split('').reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

function parseDelimited(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  const delimiter = text.includes('\t') ? '\t' : ','
  return lines.map((line) => line.split(delimiter).map((cell) => cell.replace(/^"|"$/g, '').trim()))
}

function parseHtmlTable(text: string): string[][] {
  const doc = new DOMParser().parseFromString(text, 'text/html')
  return Array.from(doc.querySelectorAll('tr'))
    .map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent?.trim() ?? ''))
    .filter((row) => row.length)
}

async function unzipEntry(bytes: Uint8Array, entryName: string): Promise<string> {
  const view = new DataView(bytes.buffer)
  let end = bytes.length - 22
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1
  if (end < 0) throw new Error('未找到 xlsx 中央目录')
  const centralOffset = view.getUint32(end + 16, true)
  const totalEntries = view.getUint16(end + 10, true)
  let cursor = centralOffset

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('xlsx 中央目录格式错误')
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const fileNameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const fileName = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength))
    cursor += 46 + fileNameLength + extraLength + commentLength
    if (fileName !== entryName) continue

    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = bytes.slice(dataStart, dataStart + compressedSize)
    if (method === 0) return decoder.decode(compressed)
    if (method !== 8) throw new Error('暂不支持该 xlsx 压缩方式')
    if (!('DecompressionStream' in window)) throw new Error('当前浏览器不支持 xlsx 解压，请上传模板 xls 文件')
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat))
    return decoder.decode(await new Response(stream).arrayBuffer())
  }
  return ''
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return []
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.querySelectorAll('si')).map((si) => Array.from(si.querySelectorAll('t')).map((t) => t.textContent ?? '').join(''))
}

function parseWorksheet(xml: string, shared: string[]): string[][] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.querySelectorAll('sheetData row'))
    .map((row) => {
      const cells: CellMap = {}
      row.querySelectorAll('c').forEach((cell) => {
        const ref = cell.getAttribute('r') ?? ''
        const type = cell.getAttribute('t')
        const inlineText = cell.querySelector('is t')?.textContent ?? ''
        const rawValue = cell.querySelector('v')?.textContent ?? ''
        const value = type === 's' ? shared[Number(rawValue)] ?? '' : type === 'inlineStr' ? inlineText : rawValue
        cells[String(columnIndex(ref))] = value.trim()
      })
      const max = Math.max(...Object.keys(cells).map(Number), -1)
      return Array.from({ length: max + 1 }, (_, index) => cells[String(index)] ?? '')
    })
    .filter((row) => row.some(Boolean))
}

export async function parsePmsExcelRows(file: File): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith('.xlsx')) {
    const shared = parseSharedStrings(await unzipEntry(bytes, 'xl/sharedStrings.xml'))
    const sheet = await unzipEntry(bytes, 'xl/worksheets/sheet1.xml')
    if (!sheet) throw new Error('xlsx 中未找到第一个工作表')
    return parseWorksheet(sheet, shared)
  }
  const text = decoder.decode(bytes)
  if (text.includes('<table') || text.includes('<tr')) return parseHtmlTable(text)
  return parseDelimited(text)
}
