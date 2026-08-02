import type {
  EngineeringBomPricingSnapshot,
  EngineeringLinkedPartTemplateVersionSnapshot,
} from './pcs-engineering-bom-types.ts'
import { getPartTemplateRecordById } from './pcs-part-template-library.ts'

export interface EngineeringBomPricingSnapshotAttestation {
  technicalVersionId: string
  frozenAt: string
  frozenBy: string
}

const snapshotAttestations = new WeakMap<EngineeringBomPricingSnapshot, EngineeringBomPricingSnapshotAttestation>()

export function resolveEngineeringLinkedPartTemplateVersions(
  linkedPartTemplateIds: string[],
): EngineeringLinkedPartTemplateVersionSnapshot[] {
  return linkedPartTemplateIds.map((partTemplateId) => {
    const template = getPartTemplateRecordById(partTemplateId)
    if (!template) throw new Error(`关联部件模板不存在：${partTemplateId}`)
    return {
      partTemplateId: template.id,
      templatePackageId: template.templatePackageId,
      templateName: template.templateName,
      updatedAt: template.updatedAt,
      geometryHash: template.geometryHash || '',
      sourceDxfFileName: template.sourceDxfFileName,
      sourceRulFileName: template.sourceRulFileName,
    }
  })
}

export function attestEngineeringBomPricingSnapshot(
  snapshot: EngineeringBomPricingSnapshot,
  attestation: EngineeringBomPricingSnapshotAttestation,
): EngineeringBomPricingSnapshot {
  snapshotAttestations.set(snapshot, { ...attestation })
  return snapshot
}

export function getEngineeringBomPricingSnapshotAttestation(
  snapshot: EngineeringBomPricingSnapshot,
): EngineeringBomPricingSnapshotAttestation | null {
  const attestation = snapshotAttestations.get(snapshot)
  return attestation ? { ...attestation } : null
}
