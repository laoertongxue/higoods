import {
  getStyleArchiveById,
  resetStyleArchiveRepository,
} from '../../src/data/pcs-style-archive-repository.ts'
import type { StyleArchiveShellRecord } from '../../src/data/pcs-style-archive-types.ts'
import {
  listEngineeringIndependentSamplingRecords,
  resetEngineeringIndependentSamplingRepository,
} from '../../src/data/pcs-engineering-master-sampling.ts'

export function resetAndGetProductionPreparationStyle(): StyleArchiveShellRecord {
  resetStyleArchiveRepository()
  resetEngineeringIndependentSamplingRepository(true)
  const source = listEngineeringIndependentSamplingRecords().find((record) =>
    record.status === 'COMPLETED'
    && record.professionalTasks.some((task) =>
      task.taskType === 'BASE_PATTERN'
      && task.results.some((result) =>
        result.status === 'APPROVED'
        && result.files.some((file) => file.extension === 'prj' && file.status === '已保存'),
      ),
    ),
  )
  if (!source) throw new Error('测试前置缺少已完成且带真实基码纸样的设计改款')
  const style = getStyleArchiveById(source.targetStyleId)
  if (!style) throw new Error('测试前置中的设计改款目标款尚未建档')
  return style
}
