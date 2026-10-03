import test from 'node:test'
import assert from 'node:assert/strict'
import { listProjects, getProjectById, findProjectByCode, listProjectNodes, getProjectNodeRecordById, listProjectPhases } from '../../src/data/pcs-project-repository.ts'
import { listMaterialArchives, getMaterialArchiveById, listMaterialSkuRecordsByMaterialId, getMaterialSkuRecordById } from '../../src/data/pcs-material-archive-repository.ts'

import { listStyleArchives, getStyleArchiveById, findStyleArchiveByCode } from '../../src/data/pcs-style-archive-repository.ts'

import { listProjectInlineNodeRecords, listProjectInlineNodeRecordsByNode } from '../../src/data/pcs-project-inline-node-record-repository.ts'

test('targeted PCS baseline reads return independent records without cloning unrelated collections', () => {
  const project = listProjects()[0]
  const before = getProjectById(project.projectId)!
  const read = getProjectById(project.projectId)!
  read.projectName = 'caller-only'
  read.projectAlbumUrls.push('/caller-only.jpg')
  assert.equal(getProjectById(project.projectId)!.projectName, before.projectName)
  assert.deepEqual(findProjectByCode(project.projectCode)!.projectAlbumUrls, before.projectAlbumUrls)
  const node = listProjectNodes(project.projectId)[0]
  const nodeBefore = getProjectNodeRecordById(project.projectId, node.projectNodeId)!
  node.stepName = 'caller-only'
  assert.deepEqual(getProjectNodeRecordById(project.projectId, node.projectNodeId), nodeBefore)
  const phases = listProjectPhases(project.projectId), phasesBefore = structuredClone(phases)
  Object.assign(phases[0], { phaseName: 'caller-only' })
  assert.deepEqual(listProjectPhases(project.projectId), phasesBefore)
  const inline = listProjectInlineNodeRecords()[0]
  const inlineBefore = listProjectInlineNodeRecordsByNode(inline.projectNodeId)
  Object.assign(inline.payload, { isolation: 'caller-only' })
  assert.deepEqual(listProjectInlineNodeRecordsByNode(inline.projectNodeId), inlineBefore)
  const style=listStyleArchives()[0],styleBefore=getStyleArchiveById(style.styleId)!
  style.styleName='caller-only';style.galleryImageUrls.push('/caller-only.jpg')
  assert.deepEqual(getStyleArchiveById(style.styleId),styleBefore)
  assert(findStyleArchiveByCode(styleBefore.styleCode))
  const material = listMaterialArchives().find(row => listMaterialSkuRecordsByMaterialId(row.materialId).length)!
  const materialBefore = getMaterialArchiveById(material.materialId)!
  const sku = listMaterialSkuRecordsByMaterialId(material.materialId)[0]
  const skuBefore = getMaterialSkuRecordById(sku.materialSkuId)!
  Object.assign(material, { materialName: 'caller-only' })
  Object.assign(sku, { skuCode: 'caller-only' })
  assert.deepEqual(getMaterialArchiveById(material.materialId), materialBefore)
  assert.deepEqual(getMaterialSkuRecordById(sku.materialSkuId), skuBefore)
})
