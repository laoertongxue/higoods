import {
  buildPlatformCuttingOverviewRows,
  type PlatformCuttingOverviewRow,
} from './overview.adapter'

export function clonePlatformCuttingOverviewRows(): PlatformCuttingOverviewRow[] {
  return buildPlatformCuttingOverviewRows()
}
