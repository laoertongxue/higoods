const fs = require('fs')
const path = require('path')

const filePath = '/vercel/share/v0-project/components/fcs/progress/progress-board-page.tsx'
const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split('\n')
console.log(`[v0] Total lines before truncation: ${lines.length}`)

// Keep only first 1784 lines (the new ProgressBoardPage component)
const truncated = lines.slice(0, 1784).join('\n') + '\n'
fs.writeFileSync(filePath, truncated, 'utf8')

const verify = fs.readFileSync(filePath, 'utf8').split('\n')
console.log(`[v0] Total lines after truncation: ${verify.length}`)
console.log(`[v0] Last 3 lines:`, verify.slice(-4).join(' | '))
