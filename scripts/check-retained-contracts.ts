import { spawnSync } from 'node:child_process'

const retainedContracts = [
  'scripts/check-factory-onboarding-step1-model-state-form.ts',
  'scripts/check-factory-onboarding-step2-platform-review.ts',
  'scripts/check-factory-onboarding-step3-sample-issue.ts',
  'scripts/check-factory-onboarding-step4-factory-sample-submit.ts',
  'scripts/check-factory-onboarding-step5-sample-review.ts',
  'scripts/check-fcs-cutting-prep-scope.ts',
  'scripts/check-fcs-money-unit-idr.ts',
  'scripts/check-pcs-channel-listing-images.ts',
  'scripts/check-pcs-project-data-consistency.ts',
  'scripts/check-pcs-project-image-assets.ts',
  'scripts/check-pcs-sample-shoot-images.ts',
  'scripts/check-pcs-style-archive-images.ts',
  'scripts/check-print-dye-requirement-residue.ts',
  'scripts/check-process-platform-status-mapping.ts',
  'scripts/check-technical-version-storage-migration.ts',
] as const

for (const contract of retainedContracts) {
  console.log(`\n[retained-contract] ${contract}`)
  const result = spawnSync(process.execPath, ['--import', 'tsx', contract], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

console.log(`\n${retainedContracts.length} retained contracts passed.`)
