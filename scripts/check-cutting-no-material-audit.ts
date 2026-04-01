import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

const fileChecks: Array<{
  file: string
  forbidden: string[]
}> = [
  {
    file: 'src/pages/process-factory/cutting/material-prep.ts',
    forbidden: ['面料审核', 'materialAuditStatus', '审核：'],
  },
  {
    file: 'src/pages/process-factory/cutting/production-progress.ts',
    forbidden: ['面料审核', 'materialAuditSummary', 'auditStatus'],
  },
  {
    file: 'src/pages/process-factory/cutting/cuttable-pool.ts',
    forbidden: ['面料审核', 'materialAuditStatus', 'auditStatus'],
  },
  {
    file: 'src/pages/process-factory/cutting/original-orders-model.ts',
    forbidden: ['materialAuditStatus', 'WAITING_REVIEW'],
  },
  {
    file: 'src/domain/fcs-cutting-piece-truth/index.ts',
    forbidden: ["reviewStatus !== 'APPROVED'"],
  },
]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function main(): void {
  fileChecks.forEach(({ file, forbidden }) => {
    const filePath = path.join(repoRoot, file)
    const source = fs.readFileSync(filePath, 'utf8')
    forbidden.forEach((token) => {
      assert(!source.includes(token), `${file} 仍包含禁用片段: ${token}`)
    })
  })
  console.log('cutting 域关键页面已移除面料审核主链依赖。')
}

main()
