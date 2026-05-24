// ============ UI 组件库类型定义 ============
export function toDataPrefix(prefix) {
    return prefix
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/_/g, '-')
        .toLowerCase();
}
/**
 * 生成 data-action 属性字符串
 */
export function toActionAttr(config) {
    return `data-${toDataPrefix(config.prefix)}-action="${config.action}"`;
}
/**
 * 生成 data-field 属性字符串
 */
export function toFieldAttr(prefix, field) {
    return `data-${toDataPrefix(prefix)}-field="${field}"`;
}
/**
 * 生成 data-filter 属性字符串
 */
export function toFilterAttr(prefix, filter) {
    return `data-${toDataPrefix(prefix)}-filter="${filter}"`;
}
