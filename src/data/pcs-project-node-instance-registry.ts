import {
  getProjectById,
  getProjectNodeRecordById,
  listProjectNodes,
  updateProjectNodeRecord,
} from './pcs-project-repository.ts'
import { listProjectInlineNodeRecordsByProject } from './pcs-project-inline-node-record-repository.ts'
import { listProjectRelationsByProject } from './pcs-project-relation-repository.ts'
import {
  getProjectWorkItemMultiInstanceDefinition,
  type PcsProjectMultiInstanceDefinition,
} from './pcs-project-domain-contract.ts'
import type { PcsProjectInlineNodeRecord } from './pcs-project-inline-node-record-types.ts'

export type ProjectNodeInstanceSourceKind = 'PROJECT_RECORD' | 'INLINE_RECORD' | 'RELATION_OBJECT'
export type ProjectNodeInstanceSourceLayer = '项目主记录' | '项目内正式记录' | '正式业务对象'

export interface ProjectNodeInstanceRecord {
  projectNodeInstanceId: string
  projectId: string
  projectCode: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  sourceKind: ProjectNodeInstanceSourceKind
  sourceLayer: ProjectNodeInstanceSourceLayer
  sourceModule: string
  sourceObjectType: string
  sourceObjectId: string
  sourceObjectCode: string
  relationRole: string
  instanceId: string
  instanceCode: string
  title: string
  status: string
  ownerName: string
  businessDate: string
  updatedAt: string
}

export interface ProjectNodeInstanceRuntimeSnapshot {
  projectId: string
  projectCode: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  multiInstanceDefinition: PcsProjectMultiInstanceDefinition | null
  primaryInstanceCount: number
  validInstanceCount: number
  latestInstanceId: string
  latestInstanceCode: string
  latestInstance: ProjectNodeInstanceRecord | null
  primaryInstances: ProjectNodeInstanceRecord[]
  supportingInstances: ProjectNodeInstanceRecord[]
  instances: ProjectNodeInstanceRecord[]
}

export interface ProjectNodeInstanceRegistryProjectSnapshot {
  projectId: string
  projectCode: string
  totalCount: number
  nodes: ProjectNodeInstanceRuntimeSnapshot[]
  instances: ProjectNodeInstanceRecord[]
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function compareInstances(left: ProjectNodeInstanceRecord, right: ProjectNodeInstanceRecord): number {
  const leftTime = left.updatedAt || left.businessDate || ''
  const rightTime = right.updatedAt || right.businessDate || ''
  if (leftTime !== rightTime) return rightTime.localeCompare(leftTime)
  if (left.businessDate !== right.businessDate) return right.businessDate.localeCompare(left.businessDate)
  return right.instanceCode.localeCompare(left.instanceCode)
}

function filterPrimaryInstances(
  instances: ProjectNodeInstanceRecord[],
  definition: PcsProjectMultiInstanceDefinition | null,
): ProjectNodeInstanceRecord[] {
  if (!definition) return instances
  const primarySourceKinds = new Set(definition.primarySourceKinds)
  const primaryRelationObjectTypes = new Set(definition.primaryRelationObjectTypes)
  return instances.filter((instance) => {
    if (!primarySourceKinds.has(instance.sourceKind)) return false
    if (instance.sourceKind !== 'RELATION_OBJECT') return true
    if (primaryRelationObjectTypes.size === 0) return true
    return primaryRelationObjectTypes.has(instance.sourceObjectType)
  })
}

function filterSupportingInstances(
  instances: ProjectNodeInstanceRecord[],
  definition: PcsProjectMultiInstanceDefinition | null,
  primaryInstances: ProjectNodeInstanceRecord[],
): ProjectNodeInstanceRecord[] {
  if (!definition) return []
  const primaryKeys = new Set(primaryInstances.map((instance) => instance.projectNodeInstanceId))
  const supportingRelationObjectTypes = new Set(definition.supportingRelationObjectTypes)
  return instances.filter((instance) => {
    if (primaryKeys.has(instance.projectNodeInstanceId)) return false
    if (instance.sourceKind !== 'RELATION_OBJECT') return false
    if (supportingRelationObjectTypes.size === 0) return false
    return supportingRelationObjectTypes.has(instance.sourceObjectType)
  })
}

function buildInlineRecordTitle(record: PcsProjectInlineNodeRecord): string {
  if (record.workItemTypeCode !== 'SAMPLE_SHOOT_FIT') {
    return record.workItemTypeName
  }
  const payload = (record.payload && typeof record.payload === 'object' ? record.payload : {}) as Record<string, unknown>
  const imageCount =
    ['sampleFlatImageIds', 'sampleTryOnImageIds', 'sampleDetailImageIds'].reduce((count, key) => {
      const value = payload[key]
      return count + (Array.isArray(value) ? value.length : 0)
    }, 0)
  return imageCount > 0 ? `${record.workItemTypeName} / ${imageCount} 张图片` : record.workItemTypeName
}

export function listProjectNodeInstances(
  projectId: string,
  projectNodeId?: string,
): ProjectNodeInstanceRecord[] {
  const project = getProjectById(projectId)
  if (!project) return []

  const nodes = listProjectNodes(projectId)
  const instances: ProjectNodeInstanceRecord[] = []
  const initNode = nodes.find((node) => node.workItemTypeCode === 'PROJECT_INIT')
  if (initNode) {
    instances.push({
      projectNodeInstanceId: `project-record:${project.projectId}:${initNode.projectNodeId}`,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: initNode.projectNodeId,
      workItemTypeCode: initNode.workItemTypeCode,
      workItemTypeName: initNode.workItemTypeName,
      sourceKind: 'PROJECT_RECORD',
      sourceLayer: '项目主记录',
      sourceModule: '商品项目',
      sourceObjectType: '商品项目',
      sourceObjectId: project.projectId,
      sourceObjectCode: project.projectCode,
      relationRole: '项目主记录',
      instanceId: project.projectId,
      instanceCode: project.projectCode,
      title: project.projectName,
      status: project.projectStatus,
      ownerName: project.ownerName,
      businessDate: project.createdAt,
      updatedAt: project.updatedAt,
    })
  }

  listProjectInlineNodeRecordsByProject(projectId).forEach((record) => {
    instances.push({
      projectNodeInstanceId: `inline-record:${record.recordId}`,
      projectId: record.projectId,
      projectCode: record.projectCode,
      projectNodeId: record.projectNodeId,
      workItemTypeCode: record.workItemTypeCode,
      workItemTypeName: record.workItemTypeName,
      sourceKind: 'INLINE_RECORD',
      sourceLayer: '项目内正式记录',
      sourceModule: record.sourceModule || '商品项目',
      sourceObjectType: '项目内正式记录',
      sourceObjectId: record.recordId,
      sourceObjectCode: record.recordCode,
      relationRole: '执行记录',
      instanceId: record.recordId,
      instanceCode: record.recordCode,
      title: buildInlineRecordTitle(record),
      status: record.recordStatus,
      ownerName: record.ownerName,
      businessDate: record.businessDate,
      updatedAt: record.updatedAt,
    })
  })

  listProjectRelationsByProject(projectId).forEach((relation) => {
    const instanceId = relation.sourceLineId || relation.sourceObjectId
    const instanceCode = relation.sourceLineCode || relation.sourceObjectCode
    instances.push({
      projectNodeInstanceId: `relation-object:${relation.projectRelationId}:${instanceId}`,
      projectId: relation.projectId,
      projectCode: relation.projectCode,
      projectNodeId: relation.projectNodeId,
      workItemTypeCode: relation.workItemTypeCode,
      workItemTypeName: relation.workItemTypeName,
      sourceKind: 'RELATION_OBJECT',
      sourceLayer: '正式业务对象',
      sourceModule: relation.sourceModule,
      sourceObjectType: relation.sourceObjectType,
      sourceObjectId: relation.sourceObjectId,
      sourceObjectCode: relation.sourceObjectCode,
      relationRole: relation.relationRole,
      instanceId,
      instanceCode,
      title: relation.sourceTitle,
      status: relation.sourceStatus,
      ownerName: relation.ownerName,
      businessDate: relation.businessDate,
      updatedAt: relation.updatedAt,
    })
  })

  const filtered = projectNodeId ? instances.filter((item) => item.projectNodeId === projectNodeId) : instances
  return filtered.sort(compareInstances)
}

export function getProjectNodeInstanceRuntimeSnapshot(
  projectId: string,
  projectNodeId: string,
): ProjectNodeInstanceRuntimeSnapshot | null {
  const project = getProjectById(projectId)
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!project || !node) return null

  const instances = listProjectNodeInstances(projectId, projectNodeId)
  const multiInstanceDefinition = getProjectWorkItemMultiInstanceDefinition(node.workItemTypeCode)
  const primaryInstances = filterPrimaryInstances(instances, multiInstanceDefinition)
  const supportingInstances = filterSupportingInstances(instances, multiInstanceDefinition, primaryInstances)
  const latestInstance = (primaryInstances[0] || instances[0]) || null
  const validInstanceCount = primaryInstances.length > 0 ? primaryInstances.length : instances.length
  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: node.workItemTypeCode,
    workItemTypeName: node.workItemTypeName,
    multiInstanceDefinition,
    primaryInstanceCount: primaryInstances.length,
    validInstanceCount,
    latestInstanceId: latestInstance?.instanceId || '',
    latestInstanceCode: latestInstance?.instanceCode || '',
    latestInstance,
    primaryInstances,
    supportingInstances,
    instances,
  }
}

export function getProjectNodeInstanceRegistry(projectId: string): ProjectNodeInstanceRegistryProjectSnapshot | null {
  const project = getProjectById(projectId)
  if (!project) return null

  const nodes = listProjectNodes(projectId)
  const nodeSnapshots = nodes
    .map((node) => getProjectNodeInstanceRuntimeSnapshot(projectId, node.projectNodeId))
    .filter((item): item is ProjectNodeInstanceRuntimeSnapshot => Boolean(item))
  const instances = listProjectNodeInstances(projectId)

  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    totalCount: instances.length,
    nodes: nodeSnapshots,
    instances,
  }
}

export function syncProjectNodeInstanceRuntime(
  projectId: string,
  projectNodeId: string,
  operatorName = '系统实例注册中心',
  timestamp = nowText(),
): ReturnType<typeof getProjectNodeRecordById> {
  const currentNode = getProjectNodeRecordById(projectId, projectNodeId)
  const snapshot = getProjectNodeInstanceRuntimeSnapshot(projectId, projectNodeId)
  if (!currentNode || !snapshot) return null

  const latestInstanceId = snapshot.latestInstanceId
  const latestInstanceCode = snapshot.latestInstanceCode
  const validInstanceCount = snapshot.validInstanceCount
  const hasChanged =
    (currentNode.latestInstanceId || '') !== latestInstanceId ||
    (currentNode.latestInstanceCode || '') !== latestInstanceCode ||
    (currentNode.validInstanceCount || 0) !== validInstanceCount

  if (!hasChanged) {
    return currentNode
  }

  return updateProjectNodeRecord(
    projectId,
    projectNodeId,
    {
      latestInstanceId,
      latestInstanceCode,
      validInstanceCount,
      updatedAt: timestamp,
    },
    operatorName,
  )
}

export function syncProjectNodeInstancesByProject(
  projectId: string,
  operatorName = '系统实例注册中心',
  timestamp = nowText(),
): void {
  listProjectNodes(projectId).forEach((node) => {
    syncProjectNodeInstanceRuntime(projectId, node.projectNodeId, operatorName, timestamp)
  })
}
