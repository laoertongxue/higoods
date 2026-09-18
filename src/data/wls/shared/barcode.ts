/**
 * Barcode recognition, preview, and classification utilities extracted from WMS App.
 */

import type {
  BarcodeRule,
  BarcodeRuleDateFormat,
  BarcodeObjectType,
  BarcodePrefixRecognitionResult,
  InboundType,
  OutboundType,
} from "../types";

/**
 * Map of barcode object types to suggested route hints.
 */
export const barcodeRouteHintMap: Record<BarcodeObjectType, string> = {
  商品SKU: "建议跳转：商品中心",
  收货单: "建议跳转：PDA收货 / 预入库管理",
  上架单: "建议跳转：PDA上架 / 入库单列表",
  拣货单: "建议跳转：PDA拣货 / 预出库管理",
  出库单: "建议跳转：PDA发货 / 出库单列表",
  移库单: "建议跳转：PDA移库 / 移货操作",
  移货单: "建议跳转：移货操作",
  库区库位: "建议跳转：库区库位管理",
};

/**
 * Format the date portion of a barcode based on the rule's date format.
 */
export const formatBarcodeDatePart = (dateFormat: BarcodeRuleDateFormat): string => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  if (dateFormat === "NONE") return "";
  return dateFormat === "YYYYMM" ? `${year}${month}` : `${year}${month}${day}`;
};

/**
 * Generate a preview barcode string from a rule definition.
 */
export const previewBarcodeByRule = (rule: Pick<BarcodeRule, "prefix" | "dateFormat" | "serialLength">): string => {
  return `${rule.prefix}${formatBarcodeDatePart(rule.dateFormat)}${String(1).padStart(Math.max(1, rule.serialLength), "0")}`;
};

/**
 * Recognize a barcode by matching its prefix against enabled rules.
 */
export const recognizeBarcodeByPrefix = (
  scanCode: string,
  rules: Pick<BarcodeRule, "prefix" | "objectType" | "isEnabled">[],
): BarcodePrefixRecognitionResult => {
  const code = scanCode.trim().toUpperCase();
  if (!code) {
    return { objectType: "未知", matchedPrefix: "-", routeHint: "-", message: "请输入条码后再识别。" };
  }
  const enabledRules = rules.filter((item) => item.isEnabled).sort((a, b) => b.prefix.length - a.prefix.length);
  const matched = enabledRules.find((item) => code.startsWith(item.prefix.toUpperCase()));
  if (!matched) {
    return { objectType: "未知", matchedPrefix: "-", routeHint: "-", message: "未命中任何启用前缀规则。" };
  }
  return {
    objectType: matched.objectType,
    matchedPrefix: matched.prefix,
    routeHint: barcodeRouteHintMap[matched.objectType],
    message: `识别成功：${code} 命中前缀 ${matched.prefix}`,
  };
};

/**
 * Determine the shipping channel by examining the waybill prefix.
 */
export const getShippingChannelByWaybill = (waybill: string): string => {
  const code = waybill.trim().toUpperCase();
  if (!code) return "-";
  if (code.startsWith("SF")) return "顺丰";
  if (code.startsWith("YT")) return "圆通";
  if (code.startsWith("JNE")) return "JNE";
  if (code.startsWith("JP")) return "J&T";
  if (code.startsWith("SICEPAT")) return "Shopee";
  if (code.startsWith("AJA")) return "Lazada";
  return "-";
};

/**
 * Determine the inbound type by examining the related order number prefix.
 */
export const getInboundTypeByRelatedOrderNo = (relatedOrderNo: string): InboundType => {
  if (relatedOrderNo.startsWith("CG-")) return "原料采购入库";
  if (relatedOrderNo.startsWith("GC-")) return "成衣入库";
  if (relatedOrderNo.startsWith("HZ-")) return "中转回货入库";
  if (relatedOrderNo.startsWith("TH-")) return "退货入库";
  return "仓库调拨";
};

/**
 * Determine the outbound type by examining the related order number prefix.
 */
export const getOutboundTypeByRelatedOrderNo = (relatedOrderNo: string): OutboundType => {
  if (relatedOrderNo.startsWith("XS-")) return "成衣销售出库";
  if (relatedOrderNo.startsWith("YL-")) return "原料领料出库";
  if (relatedOrderNo.startsWith("ZZ-")) return "中转配料出库";
  if (relatedOrderNo.startsWith("YS-")) return "预售出库";
  return "调拨出库";
};
