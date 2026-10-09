# 款式档案描述与尺码资料实施计划

需求来源：[需求说明](style-archive-description-size-chart-requirements.md)。仅 PCS 款式档案编辑／详情受影响，沿用路由及记录格式。

| 工作包 | 业务目标 → 实现位置 → 修改 → 验证 → 完成条件 |
| --- | --- |
| WP-DESC | DESC-001/002 → `pcs-style-size-chart.ts`、档案 repository、fixture、静态 baseline → 从现有档案初始化内容，修正默认生成顺序，补齐静态描述，安全格式编辑 → 默认／空值契约及浏览器 → 已有用户内容保留，默认描述可见 |
| WP-SIZE | SIZE-001/002/003 → `pcs-style-archive-types.ts`、`pcs-style-size-chart.ts`、`pcs-style-content-editor.ts` → 独立工厂表、线上 14 图 / 372 尺码 / 41 参数、三属性、国家设置、选后生成矩阵、范围及 free、插入和自动图片 → 边界专项及页面 → 数值和独立资料保存结果一致 |
| WP-IMAGE | IMAGE-001 → `pcs-style-content-editor.ts`、`pcs-product-archives.ts` → 原始示意图静态发布、完整默认模板及静态参考图片、原生 Canvas 自动 PNG、既有文件登记、上传／预览／删除／替换 → 实际图像与刷新读回 → 复用文件机制，无 Base64 或重复待保存文件 |
| WP-SAVE | SAVE-001 → `pcs-product-archives.ts` → 沿用 `runPcsRecordCommand`；多语言草稿一起提交；局部 DOM 更新 → 存储失败、重试、冲突、刷新 → 持久结果准确，失败输入保留 |
| WP-VERIFY | PERF-001／全部需求 → 专项测试、当前浏览器开发验收和测量、审查记录 → 最终 diff 审查及当前版本证据 → 专项、构建、治理、CodeGraph、收据及五轮浏览器 → 所有适用门禁通过 |

顺序：默认内容与字段 → 编辑及生成工具 → 文件与事务接入 → 专项与浏览器 → 治理和收据。不修改存储数据库结构，不执行旧源清理，不接入线上数据库。

存储登记：款式记录来自 `src/data/generated/pcs-record-baseline.json` 的款式集合，用户覆盖位于现有 PCS IndexedDB `records`；生成／上传图像位于 `files`，记录只存文件引用。全部读写入口为款式详情、款式编辑、复制及既有渠道内容读取；本次沿用现有事务／文件生命周期，不新增 localStorage 业务项或双写。

## 连续插入性能修正

分段验收发现相同表格向多个目标插入时重复编码 PNG；复用当前页面内已生成且 HTML 相同的 Blob。表格、测量值或生成预览变化后重新编码，不新增持久缓存。重测商品／工厂／各国插入与图片替换五轮，保留此前慢样本。

## 格式持久性修正

浏览器原生 fontName 产生的 font 标签被安全过滤去除。格式操作改用受限 CSS span；过滤支持引号字体和下划线，属性实体在重新编码前解码，避免多次保存丢失字体及重复转义链接参数。验证保存源码、实际计算样式、五轮保存重开及受影响操作回归；未扩大其他模块的 HTML 过滤规则。
