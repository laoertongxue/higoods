import { readFileSync, writeFileSync } from 'fs'

const filePath = '/vercel/share/v0-project/components/fcs/progress/progress-board-page.tsx'
const content = readFileSync(filePath, 'utf-8')
const lines = content.split('\n')

// Keep only lines 1–1784 (index 0–1783), the new component
const truncated = lines.slice(0, 1784).join('\n') + '\n'

writeFileSync(filePath, truncated, 'utf-8')
console.log(`Truncated to ${lines.slice(0, 1784).length} lines`)
console.log('Last 3 lines:')
console.log(lines.slice(1781, 1784).join('\n'))
