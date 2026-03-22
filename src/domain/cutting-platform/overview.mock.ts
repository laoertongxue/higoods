import { cloneCuttingSummaryRecords } from '../../data/fcs/cutting/cutting-summary'
import {
  buildPlatformCuttingOverviewRows,
  type PlatformCuttingOverviewRow,
} from './overview.adapter'

export function clonePlatformCuttingOverviewRows(): PlatformCuttingOverviewRow[] {
  return buildPlatformCuttingOverviewRows(cloneCuttingSummaryRecords())
}
