# 生产需求提前染色、印花加工单原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-17 |
| 相关需求 / 任务 | 染色印花加工单提前创建、生产单自动匹配、单需求与多需求合并匹配 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS、FCS、PFOS |
| 涉及页面路径 | `/fcs/craft/dyeing/work-orders`、`/fcs/craft/printing/work-orders` |
| 端类型 | 管理端 |
| 主要角色与任务 | 生产准备人员／PPIC 从列表创建大货提前加工单并跟进匹配；买手审核专业成果；管理员代操作验收；系统在单独或合并生成生产单后自动匹配 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：染色、印花加工单列表不再重复展示页面标题，新增主操作与工厂 Tab 同行并位于最右；印花工厂首屏固定为“全部＋4 个常用厂＋更多”。创建弹窗要求先选生产需求、再手动选择具体调色／花型任务，加工厂必选；匹配生产单前下游保持待确认。创建弹窗和列表加工要求展示专业任务、染色要求／花型产出、成果编号、版本和全部附件。Mock 数据覆盖大货提前加工单及单需求、合并需求、待核验、异常、取消、重建场景。

审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：管理端列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和当前证据要求。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端沿用现有加工单列表；创建在单层弹窗完成，业务人员无需进入多层页面；管理员可代操作。 |
| 文案、状态、数量与单位 | 通过 | 来源、执行状态和匹配状态分别展示；计划量明确使用需求数量、单耗和损耗率，单位随物料展示。 |
| 扫码、真实图片与对象识别 | 通过 | 列表和弹窗同块展示款式／物料缩略图、名称、编码；本任务不是扫码执行页。 |
| 防错、危险确认与主管兜底 | 通过 | 未审核成果不可选；任务与需求不一致、加工厂未选、相同投入产出 SKU、重复稳定键均被阻断；取消要求原因和二次确认；管理员可代操作。 |
| 交接、跨端事实与异常追溯 | 通过 | 提前单保留生产需求、专业成果、投入产出、生产单匹配和操作事实；BOM／路线／SKU 不一致进入匹配异常，不静默补单。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768 管理端实测；弹窗在视口内滚动。PDA、扫码、文件上传不属于本次新增入口；创建失败保留弹窗输入并展示原因。 |
| 命名路由、交互、图片大图与打印 | 通过 | 两个命名路由返回 200；新增按钮、Tab、弹窗、数量计算、缩略图和 Esc 关闭大图已实测；既有打印能力未被修改。 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 原方案曾错误假设生产需求与生产单严格 1:1 | 协作断裂 | 生产准备人员、系统 | 保留单需求和合并需求生成路径；生产单遍历全部来源需求并匹配多张提前单；稳定键保留需求维度 | 否 |
| 设计改款销售展示样衣与大货提前加工单被误认为冲突来源 | 读不懂 | 买手、生产准备人员 | 保留 `DESIGN_REVISION` 样衣场景，新增 `PRODUCTION_DEMAND` 大货场景；页面文案说明用途 | 否 |
| 花型图和源文件曾被拆成两类成果 | 字段过载 | 买手、印花团队 | 统一为一份审核成果附件集合，图片和文件都支持多个 | 否 |
| 创建时只按需求单默认带入任务，无法确认实际使用哪一份专业成果 | 协作断裂 | 生产准备人员、调色／花型团队 | 需求单与专业任务拆为两级选择；保存准确任务 ID，并在加工要求列回显任务和成果 | 否 |
| 创建时加工厂和下游都可能被提前推断 | 协作断裂 | 生产准备人员、下游接收方 | 加工厂改为创建必选；下游仅在匹配正式生产单后确认，匹配前统一显示待确认 | 否 |
| 列表标题和新增操作占用额外纵向空间，印花工厂过多挤压主操作 | 操作不顺手 | 生产准备人员 | 去除列表主体重复标题；新增按钮并入工厂 Tab 行最右；印花溢出工厂收入“更多” | 否 |
| 刷新后，本地保存的提前印花单在恢复阶段被当成未知正式单，连带导致染色列表空白 | 协作断裂 | 生产准备人员、管理员 | 恢复时按生产需求、专业任务、投入／产出 SKU 和版本校验提前单；允许恢复合法提前单并以加工单快照同步任务来源，仍阻断来源不一致记录 | 否 |

## 6. 最终结论

结论：通过

说明：

- 染色、印花列表均可从工厂 Tab 行最右侧直接创建大货提前加工单；创建时准确选择专业任务和加工厂，匹配前不虚构下游。
- 浏览器已确认同一合并生产单 `PO-EARLY-MERGED-001` 同时展示两张不同需求来源的染色单和三张印花单；其中两张印花单来自不同生产需求，未按生产单号错误去重。
- `DESIGN_REVISION` 销售展示样衣加工单写入路径未删除；大货提前单使用独立 `PRODUCTION_DEMAND` 来源。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/process-work-order-generation-key.ts`
- `src/data/fcs/process-work-order-generation-registry.ts`
- `src/data/fcs/production-demand-early-process-work-orders.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/process-order-receiving-target.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/production/demand-domain.ts`

### 页面路由

- `/fcs/craft/dyeing/work-orders`
- `/fcs/craft/printing/work-orders`

### 验证命令

- `npm run check:production-demand-early-process-work-orders`：通过，12/12。
- `npm run typecheck:entrypoints`：通过。
- `npm run check:list-page-governance`：通过。
- `npm run check:prototype-design-governance`：通过。
- `npm run build`：通过。
- `npm run workflow:verify -- --output /private/tmp/production-demand-professional-task-factory-receipt.json --task-boundary "生产需求提前染色印花加工单：手动选择专业任务、创建必选加工厂、匹配前下游待确认、加工要求成果展示、工厂Tab同行新增按钮与印花更多工厂"`：通过，状态 `verified`，无阻断项。

### 浏览器证据

- `output/playwright/2026-09-17-dyeing-early-order-create-1366x768.png`
- `output/playwright/2026-09-17-printing-early-order-create-1366x768.png`
- `output/playwright/2026-09-17-dyeing-merged-match-1366x768.png`
- `output/playwright/2026-09-17-printing-matched-tab-1366x768.png`
- `output/playwright/2026-09-17-dyeing-create-task-factory-1366x768.png`
- `output/playwright/2026-09-17-printing-create-task-factory-1366x768.png`
- `output/playwright/2026-09-17-dyeing-factory-row-create-1366x768.png`
- `output/playwright/2026-09-17-printing-factory-row-create-more-1366x768.png`
- `output/playwright/2026-09-17-dyeing-pending-task-result-downstream-1366x768.png`
- `output/playwright/2026-09-17-printing-pending-task-result-downstream-1366x768.png`
- 局域网地址 `http://192.168.5.2:4176/fcs/craft/dyeing/work-orders`、`http://192.168.5.2:4176/fcs/craft/printing/work-orders` 均返回 200。

### 真实图片验证

- 款式图来自生产需求 Mock 的正式项目静态资源，如 `/shirt-sample.jpg`、`/tshirt-sample.jpg`；物料图来自 `/materials/process-orders/`、`/materials/fei-ticket/`。
- 款式、投入物料和产出物料均在对象信息块内同时展示缩略图、名称和编码。
- 浏览器实测点击 `Kemeja Batik Pria Modern / SPU-2024-001` 缩略图后出现高清大图弹窗，遮罩、关闭按钮和 `Esc` 关闭有效。
- 图片组件保留加载中和加载失败文案，不以色块或图标冒充真实图片。

### 例外

- 无
