/**
 * Packaging label generation, packaging code utilities extracted from WMS App.
 */

import type {
  PackagingUnitInput,
  PackagingCodeHistoryItem,
  GeneratedPackagingLabel,
  GeneratePackagingLabelsParams,
  GenerateShortPackageCodesParams,
  MaterialCategory,
} from "../types";
import { formatShortPackageDate } from "./format";

/**
 * Map of packaging unit inputs to their single-letter codes.
 */
export const packagingUnitCodeMap: Record<PackagingUnitInput, string> = {
  箱: "X",
  卷: "R",
  亚: "Y",
  压: "Y",
  包: "P",
  袋: "P",
  KG: "K",
  kg: "K",
  X: "X",
  R: "R",
  Y: "Y",
  P: "P",
  K: "K",
};

/**
 * Check whether a unit string is a valid packaging unit input.
 */
export const isPackagingUnitInput = (unit: string): unit is PackagingUnitInput =>
  Object.prototype.hasOwnProperty.call(packagingUnitCodeMap, unit);

/**
 * Get the full alphanumeric code from a SKU string (strip non-alphanumeric characters).
 */
export const getSkuFullCode = (sku: string): string => sku.replace(/[^A-Za-z0-9]/g, "");

/**
 * Extract the packaging label code from a history item (string or object).
 */
export const getPackagingLabelCode = (item: PackagingCodeHistoryItem): string =>
  typeof item === "string" ? item : item.package_code || item.label_code || "";

/**
 * Extract the material type code from a packaging label history item.
 */
export const getPackagingLabelMaterialTypeCode = (item: PackagingCodeHistoryItem): string =>
  typeof item === "string" ? "" : item.material_type_code || item.materialTypeCode || "";

/**
 * Map of material category names/codes to their single-letter type codes.
 */
export const materialTypeCodeMap: Record<string, string> = {
  FABRIC: "F",
  面料: "F",
  ACCESSORY: "A",
  辅料: "A",
  PACKAGING: "P",
  包材: "P",
  YARN: "Y",
  纱线: "Y",
  CONSUMABLE: "C",
  耗材: "C",
  OTHER: "O",
  其他: "O",
};

/**
 * Get the material type code for a given material category.
 * Throws if the category is not recognized.
 */
export const getMaterialTypeCode = (materialCategory?: string | null): string => {
  const raw = String(materialCategory || "").trim();
  const typeCode = materialTypeCodeMap[raw.toUpperCase()] || materialTypeCodeMap[raw];
  if (!typeCode) {
    throw new Error("当前物料缺少物料类型，无法生成包装码。");
  }
  return typeCode;
};

/**
 * Generate short package codes based on material category, date, quantity and existing labels.
 */
export const generateShortPackageCodes = ({
  materialCategory,
  printDate,
  generateQty,
  existingPackageLabels,
}: GenerateShortPackageCodesParams): string[] => {
  const normalizedQty = Math.max(0, Math.floor(Number(generateQty) || 0));
  if (normalizedQty <= 0) {
    throw new Error("本次收货数量为0，无法生成标签。");
  }
  if (!Array.isArray(existingPackageLabels)) {
    throw new Error("历史包装码读取失败，请重试。");
  }
  const typeCode = getMaterialTypeCode(materialCategory);
  const dateCode = formatShortPackageDate(printDate);
  const codePattern = new RegExp(`^${typeCode}${dateCode}(\\d{4})$`);
  const maxSeq = existingPackageLabels.reduce((max, item) => {
    const code = getPackagingLabelCode(item).trim().toUpperCase();
    const itemTypeCode = getPackagingLabelMaterialTypeCode(item);
    const matched = code.match(codePattern);
    if (!matched || (itemTypeCode && itemTypeCode !== typeCode)) return max;
    return Math.max(max, Number(matched[1]) || 0);
  }, 0);
  if (maxSeq + normalizedQty > 9999) {
    throw new Error("当日包装码流水号已用完，请联系管理员。");
  }
  const existingCodeSet = new Set(
    existingPackageLabels.map(getPackagingLabelCode).filter(Boolean).map((code) => code.toUpperCase()),
  );
  return Array.from({ length: normalizedQty }, (_, index) => {
    const packageCode = `${typeCode}${dateCode}${String(maxSeq + index + 1).padStart(4, "0")}`;
    if (existingCodeSet.has(packageCode)) {
      throw new Error("包装码重复，请刷新后重试。");
    }
    existingCodeSet.add(packageCode);
    return packageCode;
  });
};

/**
 * Split a total base quantity across a given number of packages.
 */
export const splitQuantityAcrossPackages = (
  totalBaseQty: number,
  packageQty: number,
  quantityPerPackage?: number,
): number[] => {
  if (packageQty <= 0) return [] as number[];
  const perPackage = Math.max(0, Math.floor(quantityPerPackage || Math.ceil(totalBaseQty / packageQty)));
  let remain = Math.max(0, Math.floor(totalBaseQty));
  return Array.from({ length: packageQty }, (_, index) => {
    if (index === packageQty - 1) {
      const lastQty = remain;
      remain = 0;
      return lastQty;
    }
    const current = Math.min(remain, perPackage);
    remain -= current;
    return current;
  });
};

/**
 * Generate packaging labels for a batch of received packages.
 */
export const generatePackagingLabels = ({
  inboundNo,
  asnNo,
  spuCode,
  skuCode,
  materialCategory,
  supplierName,
  packageUnit,
  baseUnit,
  currentReceivePackageQty,
  currentReceiveBaseQty,
  existingLabels = [],
  receiveBatchNo,
  printDate,
}: GeneratePackagingLabelsParams): GeneratedPackagingLabel[] => {
  const normalizedPackageQty = Math.max(0, Math.floor(Number(currentReceivePackageQty) || 0));
  const normalizedBaseQty = Math.max(0, Math.floor(Number(currentReceiveBaseQty) || 0));
  if (normalizedPackageQty <= 0 || normalizedBaseQty <= 0) {
    throw new Error("本次未录入收货数量，无法生成标签。");
  }
  if (!packageUnit || !isPackagingUnitInput(packageUnit)) {
    throw new Error("当前物料缺少包装单位，无法生成标签。");
  }
  if (!baseUnit) {
    throw new Error("当前物料缺少基础单位，无法生成标签。");
  }
  const cleanInboundNo = inboundNo.trim();
  const cleanSkuCode = skuCode.trim();
  const materialTypeCode = getMaterialTypeCode(materialCategory);
  const packageCodes = generateShortPackageCodes({
    materialCategory,
    printDate: printDate || new Date(),
    generateQty: normalizedPackageQty,
    existingPackageLabels: existingLabels,
  });
  const baseQtyList = splitQuantityAcrossPackages(
    normalizedBaseQty,
    normalizedPackageQty,
    Math.max(1, Math.floor(normalizedBaseQty / normalizedPackageQty || 1)),
  );

  return Array.from({ length: normalizedPackageQty }, (_, index) => {
    const labelCode = packageCodes[index];
    return {
      label_code: labelCode,
      package_code: labelCode,
      inbound_no: cleanInboundNo,
      asn_no: asnNo,
      spu_code: spuCode,
      sku_code: cleanSkuCode,
      material_category: String(materialCategory || "OTHER"),
      material_type_code: materialTypeCode,
      supplier_name: supplierName,
      package_unit: packageUnit,
      base_unit: baseUnit,
      package_qty: 1,
      base_qty: baseQtyList[index] || Math.max(1, Math.floor(normalizedBaseQty / normalizedPackageQty)),
      print_date: printDate,
      print_status: "GENERATED_TEMP" as const,
      print_count: 0,
      is_reprint: false,
      receive_batch_no: receiveBatchNo,
    };
  });
};

/**
 * Get the numeric sequence from the last 4 digits of a package code.
 */
export const getPackagingCodeSequence = (code: string): number => {
  const matched = code.match(/(\d{4})$/);
  return matched ? Math.max(0, Math.floor(Number(matched[1]) || 0)) : 0;
};

/**
 * Set of valid packaging history print statuses.
 */
export const validPackagingHistoryStatuses = new Set([
  "PRINTED",
  "REPRINTED",
  "WAIT_REPRINT",
  "NOT_PRINTED",
  "GENERATED",
  "GENERATED_TEMP",
]);

/**
 * Generate packaging codes for an inbound order + SKU combination.
 */
export const generatePackagingCodes = (
  inboundOrderNo: string,
  sku: string,
  packageUnit: PackagingUnitInput,
  quantity: number,
  existingLabels: PackagingCodeHistoryItem[] = [],
  receivedPackageQty = 0,
): string[] => {
  if (!inboundOrderNo || !sku || !packageUnit || quantity <= 0) return [];
  const unitCode = packagingUnitCodeMap[packageUnit];
  const prefix = `${inboundOrderNo.trim()}-${getSkuFullCode(sku.trim())}-${unitCode}-`;
  return Array.from({ length: quantity }, (_, index) => `${prefix}${String(receivedPackageQty + index + 1).padStart(4, "0")}`);
};
