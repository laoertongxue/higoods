import { readFileSync, writeFileSync } from 'fs'

const pages = [
  'app/fcs/workbench/todos/page.tsx',
  'app/fcs/workbench/risks/page.tsx',
  'app/fcs/workbench/overview/page.tsx',
  'app/fcs/trace/unit-price/page.tsx',
  'app/fcs/trace/unique-codes/page.tsx',
  'app/fcs/trace/parent-codes/page.tsx',
  'app/fcs/trace/mapping/page.tsx',
  'app/fcs/tech-pack/[spuCode]/page.tsx',
  'app/fcs/settlement/statements/page.tsx',
  'app/fcs/settlement/payment-sync/page.tsx',
  'app/fcs/settlement/material-statements/page.tsx',
  'app/fcs/settlement/history/page.tsx',
  'app/fcs/settlement/batches/page.tsx',
  'app/fcs/settlement/adjustments/page.tsx',
  'app/fcs/quality/rework/page.tsx',
  'app/fcs/quality/penalty-output/page.tsx',
  'app/fcs/quality/arbitration/page.tsx',
  'app/fcs/progress/exceptions/page.tsx',
  'app/fcs/progress/board/page.tsx',
  'app/fcs/production/status/page.tsx',
  'app/fcs/production/plan/page.tsx',
  'app/fcs/production/orders/page.tsx',
  'app/fcs/production/orders/[id]/page.tsx',
  'app/fcs/production/demand-inbox/page.tsx',
  'app/fcs/production/delivery-warehouse/page.tsx',
  'app/fcs/production/create/page.tsx',
  'app/fcs/production/changes/page.tsx',
  'app/fcs/dispatch/tenders/page.tsx',
  'app/fcs/dispatch/exceptions/page.tsx',
  'app/fcs/dispatch/award/page.tsx',
  'app/fcs/factories/status/page.tsx',
  'app/fcs/factories/settlement/page.tsx',
  'app/fcs/factories/settlement/[factoryId]/page.tsx',
  'app/fcs/factories/performance/page.tsx',
  'app/fcs/factories/capability/page.tsx',
  'app/fcs/capacity/risk/page.tsx',
  'app/fcs/capacity/policies/page.tsx',
  'app/fcs/capacity/overview/page.tsx',
  'app/fcs/capacity/constraints/page.tsx',
  'app/fcs/capacity/bottleneck/page.tsx',
  'app/fcs/process/material-issue/page.tsx',
  'app/fcs/process/templates/page.tsx',
  'app/fcs/process/qc-standards/page.tsx',
]

let added = 0
for (const rel of pages) {
  const path = `/vercel/share/v0-project/${rel}`
  try {
    const content = readFileSync(path, 'utf8')
    if (!content.startsWith("'use client'")) {
      writeFileSync(path, `'use client'\n\n${content}`)
      console.log(`Added 'use client' to ${rel}`)
      added++
    } else {
      console.log(`Already has 'use client': ${rel}`)
    }
  } catch (e) {
    console.log(`Skipped (not found): ${rel}`)
  }
}
console.log(`\nDone. Added to ${added} files.`)
