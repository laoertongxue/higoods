import {
  runEngineeringMasterRepositoryTransaction,
} from '../src/data/pcs-engineering-master-repository'
import {
  runTechnicalDataVersionRepositoryTransaction,
} from '../src/data/pcs-technical-data-version-repository'

runEngineeringMasterRepositoryTransaction(() => '同步结果')
runTechnicalDataVersionRepositoryTransaction(() => ({ ok: true }))

// @ts-expect-error 工程主单仓储事务禁止 Promise 回调。
runEngineeringMasterRepositoryTransaction(async () => '异步结果')

// @ts-expect-error 技术资料仓储事务禁止 Promise 回调。
runTechnicalDataVersionRepositoryTransaction(async () => ({ ok: true }))
