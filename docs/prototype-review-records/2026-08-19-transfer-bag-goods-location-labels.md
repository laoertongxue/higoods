# 中转袋货物标识与库位标签调整原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-19 |
| 相关需求 / 任务 | 库位标签改为 100mm × 100mm 五段式；中转袋身份标签改为 100mm × 100mm；菲票装袋与中转袋入仓增加单袋、批量货物标识打印 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS / FCS 统一打印预览 |
| 涉及页面路径 | `/fcs/craft/cutting/warehouse-management/wait-handover?tab=bagging`、`?tab=inbound`、`?tab=locations`、`/fcs/print/preview` |
| 端类型 | 管理端 / 主管端 |
| 主要角色与任务 | 裁床装袋员打印并按袋号插入货物标识；裁床仓管入仓后补打；仓库主管打印第三层也能扫码的库位标签 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：库位标签纸张、版式、二维码和条形码尺寸发生变化；中转袋身份标签纸张改为 100mm × 100mm；菲票装袋和中转袋入仓列表新增单行打印与独立批量打印模式；新增颜色行 × 尺码列的纯黑白热敏货物标识及使用周期防串袋规则。

当前审查依据：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 列表面向裁床装袋员、仓管和主管；打印动作紧邻对应中转袋，批量动作位于列表工具栏而非挤入行操作列。 |
| 文案、状态、数量与单位 | 通过 | 装袋页与入仓页分别显示对应事件的时间和操作人；菲票用“张”、裁片用“片”；颜色尺码矩阵提供行列小计、本页和整袋合计。 |
| 扫码、真实图片与对象识别 | 通过（用户确认例外） | 库位标签放大真实二维码和 Code 128 条码；货物标识最大显示袋号。货物标识由黑白热敏机打印，用户明确确认不打印款式图；为避免大量部位名称挤压矩阵，票面以款号、生产单、部位数量和袋号完成识别，具体部位仍保留在装袋快照中追溯。 |
| 防错、危险确认与主管兜底 | 通过 | 空快照、作废菲票、非正整数数量、跨生产单和批量含无效周期均阻断；无选择时提示先勾选，取消批量可恢复。 |
| 交接、跨端事实与异常追溯 | 通过 | 货物标识绑定精确 `usageCycleId` 的装袋快照；同袋号后续复用不会覆盖历史周期补打内容。 |
| 低分辨率、PDA、弱网与上传恢复 | 不适用 | 本次只改管理端列表和本地打印预览，不改 PDA、上传、弱网或真实打印驱动；管理列表按 1366×768 验收。 |
| 命名路由、交互、图片大图与打印 | 通过 | 两个命名列表、单袋打印、批量选择、批量预览、库位标签和身份标签均在当前分支、当前服务真实验收；货物标识按用户确认不含图片。 |

## 4. 问题标签

- 无。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 同一袋可同时包含多个颜色和多个尺码，单值字段无法表达 | 读不懂 / 算不准 | 装袋员、仓管 | 改为颜色分行、尺码分列的数量矩阵，并提供行列小计和整袋合计 | 否 |
| 入仓事件曾覆盖装袋时间和装袋人 | 追溯不足 | 装袋员、仓管 | 模型分别保留装袋事实和入仓事实，各列表按自身事件展示 | 否 |
| 100mm × 100mm 无法无限容纳颜色和尺码 | 字段过载 | 装袋员、仓管 | 颜色、尺码分块分页；每页最多 4 色 × 6 码，颜色不超过 3 色时最多 3 色 × 8 码；每页重复袋号和页码 | 否 |
| 一个袋子的部位名称可能很多且可能继续翻倍 | 字段过载 / 读不懂 | 装袋员、仓管 | 票面改为只显示去重后的“部位数量 N 个”，不显示具体部位名称；底层装袋快照继续保留完整部位信息 | 否；32 个部位专项与实际打印预览已通过 |

## 6. 最终结论

结论：通过。

说明：需求范围内的标签对象、周期事实、数量矩阵、两页入口、批量交互和打印版式均已形成代码、专项契约和当前页面证据。`check:cutting-warehouse-location-map` 的完整历史脚本另有既存 T1/T2 活动菲票生命周期断言失败，该断言不读取本次标签、列表入口或打印代码，已作为非本需求遗留项单独记录，不用于替代本次直接证据。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/transfer-bag-goods-label.ts`
- `src/data/fcs/fcs-route-links.ts`
- `src/data/fcs/print-service.ts`
- `src/data/fcs/print-template-registry.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/print-styles.ts`
- `src/pages/print/templates/label-print-template.ts`
- `src/pages/process-factory/cutting/transfer-bags-model.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/cutting/warehouse-location-map.ts`

### 页面路由

- `http://127.0.0.1:43195/fcs/craft/cutting/warehouse-management/wait-handover?tab=bagging`
- `http://127.0.0.1:43195/fcs/craft/cutting/warehouse-management/wait-handover?tab=inbound`
- `http://127.0.0.1:43195/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations`
- `http://127.0.0.1:43195/fcs/print/preview?documentType=TRANSFER_BAG_GOODS_LABEL&sourceType=TRANSFER_BAG_USAGE_RECORD&sourceId=usage%3ABAG-REPACK-DEMO-03%3Amock-1`
- `http://127.0.0.1:43195/fcs/print/preview?documentType=TRANSFER_BAG_LABEL&sourceType=TRANSFER_BAG_RECORD&sourceId=BAG-A-00100`

### 验证命令

- `git diff --check`：通过。
- `npx tsx scripts/check-transfer-bag-goods-label.ts`：通过；覆盖多颜色多尺码聚合、5 色 × 9 码四页拆分、32 个部位稳定计数、部位编码／名称去重、具体部位名称不进入 HTML、数量守恒、历史周期、阻断、批量顺序和三类标签语义边界。
- `npm run check:cutting-wait-handover-transfer-bag-flow`：通过，266 项断言、0 项失败。
- `npm run check:web-cutting-transfer-bag-actions`：通过。
- `npm run check:cutting-fei-ticket-fixed-print-layout`：通过，确认相邻菲票标签版式未受影响。
- `npm run build`：通过，Vite 处理 2348 个模块；仅有既存 chunk 体积提示。
- `codegraph sync /Users/laoer/Documents/higoods`：通过，索引已是最新。
- CodeGraph status：通过，1509 个文件、46632 个节点、163975 条边，无待同步文件。
- `npm run check:cutting-warehouse-location-map`：失败；标签 100×100 五段式断言已通过，随后在既有 “T1 全部交出后活动菲票必须只保留 T2” 生命周期断言失败，实际为 T1、T2；不属于本次实现文件的业务逻辑。
- `npm run check:prototype-design-governance`：通过（仅临时暂存本需求文件；11 个用户可见文件、1 份关联治理记录，检查后暂存区恢复为空）。

### 页面与打印证据

- `output/playwright/wait-handover-bagging-goods-label-actions.png`：菲票装袋行操作与批量入口。
- `output/playwright/wait-handover-bagging-goods-label-batch-selection.png`：装袋页独立批量状态与两袋勾选。
- `output/playwright/wait-handover-inbound-goods-label-actions.png`：真实入仓事件行操作与批量入口。
- `output/playwright/wait-handover-inbound-goods-label-batch-selection.png`：入仓页全选当前页与三袋勾选。
- `output/playwright/transfer-bag-goods-label-single.png`：单袋 100mm × 100mm 黑白热敏矩阵预览；显示“部位数量 5 个”，不显示具体部位名称，378×378 CSS 像素卡片无横向或纵向溢出。
- `output/playwright/transfer-bag-goods-label-batch.png`：两袋各自独立成纸且顺序与选择一致。
- `output/playwright/location-label-100x100-five-section.png`：库位编号、库区仓名、层位指示、二维码、条形码五段式标签本体。
- `output/playwright/transfer-bag-identity-label-100x100.png`：身份标签改为 100mm × 100mm，未混入货物或库位字段。
- 浏览器控制台：命名列表、库位标签、货物标识和身份标签页面均为 0 error、0 warning（React DevTools 开发提示为 info）。

### 真实图片验证

- 用户已明确确认货物标识由黑白热敏打印机打印，不能且不需要打印款式图；本次不把图片素材缺失作为阻塞。
- 替代防错字段为：最大袋号、款号 / SPU、生产单、部位数量、颜色 × 尺码数量矩阵、整袋菲票数和总片数；具体部位名称不进入标签。
- 库位标签和中转袋身份标签属于码标签，不展示款式或物料图片。

### 例外

- 货物标识不执行款式真实图片门禁：这是用户基于实际热敏打印能力明确确认的业务例外；仅影响本次 100mm × 100mm 货物标识，管理端其他出现款式 / 物料的页面不因此豁免。
- 当前工作树含用户已有的工序工艺字典 / 技术包等无关未提交修改，按任务边界不运行会吸收整棵工作树差异的任务收据；本次以专项契约、命名页面、构建、治理和 CodeGraph 证据闭环。
