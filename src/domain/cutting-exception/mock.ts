import type { CuttingException } from './types'
import { buildPlatformCuttingExceptionViews } from './platform.adapter'

export function cloneCuttingExceptionRecords(): CuttingException[] {
  return buildPlatformCuttingExceptionViews().map((row) => ({ ...row }))
}
