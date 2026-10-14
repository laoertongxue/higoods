// One owner for published preparation identities; both readers and full prep use these values.
export const MATERIAL_PREP_BASE_ORDER_IDS = Object.freeze(["PO-202603-0004","PO-202603-0008","PO-202603-0101","PO-202603-0102","PO-202603-0001","PO-202603-0002","PO-202603-0006","PO-202603-0007"])
export const MATERIAL_PREP_CATEGORY_SEQUENCES = Object.freeze([1101,1102,1103,1104,1201,1202,1203])
export const MATERIAL_PREP_SEEDED_ORDER_IDS = Object.freeze([...MATERIAL_PREP_BASE_ORDER_IDS, ...MATERIAL_PREP_CATEGORY_SEQUENCES.map(seq => `PO-202603-${String(seq).padStart(4, '0')}`)])
