import type { EngineeringLinkedPartTemplateVersionSnapshot } from './pcs-engineering-bom-types.ts'
import { getPartTemplateRecordById } from './pcs-part-template-library.ts'

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
