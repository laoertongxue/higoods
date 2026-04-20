import type { TechPackSourceTaskType, TechPackVersionChangeScope } from './pcs-technical-data-version-types.ts'

export type TechPackVersionLogType =
  | '制版生成技术包'
  | '花型写入技术包'
  | '花型生成新版本'
  | '改版生成新版本'
  | '发布技术包版本'
  | '启用当前生效版本'

export interface TechPackVersionLogRecord {
  logId: string
  technicalVersionId: string
  technicalVersionCode: string
  versionLabel: string
  styleId: string
  styleCode: string
  logType: TechPackVersionLogType
  sourceTaskType: TechPackSourceTaskType | ''
  sourceTaskId: string
  sourceTaskCode: string
  sourceTaskName: string
  changeScope: TechPackVersionChangeScope | ''
  changeText: string
  beforeVersionId: string
  beforeVersionCode: string
  afterVersionId: string
  afterVersionCode: string
  createdAt: string
  createdBy: string
}

export interface TechPackVersionLogStoreSnapshot {
  version: number
  logs: TechPackVersionLogRecord[]
}
