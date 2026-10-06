# PCS 商品、物料与渠道店铺商品 R1 当前原型审查

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 记录日期 | 2026-10-06 |
| 相关需求 / 任务 | 用户授权执行《PCS 商品、物料与渠道店铺商品原型调整方案 R1》；ARCH/CFG/PRODUCT/MAT/UOM/CODE/COST/CHAN/SYNC/BRIDGE/GOV 的158项原子需求 |
| 记录模式 | 完整产品审查；实施与验收尚未关闭 |
| 涉及系统 | PCS；直接关联 PMS、FCS、WLS 只读库存投影及既有毛织入口 |
| 涉及页面路径 | 见第7节及原始测量文件 |
| 端类型 | 管理端为主；既有毛织PDA/打印引用回归 |
| 主要角色与任务 | 商品/物料维护与审核人员、采购/加工计划人员、店铺运营人员 |
| 版本与服务 | main / 88324f65506f47c678b17d1b51879f8fd7c2488a 加未提交差异；5173开发预览与5178构建预览均来自 /Users/laoer/Documents/higoods |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：商品SPU/SKU、五类物料主档/阶段SKU、基础配置、计量单位、标准成本、店铺/PID/平台规格及关联业务入口发生变化；列表、详情、编辑、Tab、图片、规则、Mock和本地保存随之调整。PCS不显示供应商/库存编辑项，也没有浏览器资料维护工具。
- 当前基线：AGENTS.md第4节现场产品设计、第5节UI与图片、第7节验证规则；用户R1实施授权及FCS染色加工单页面层次要求。
- 原有AGENTS.md调整和维护工具删除属于此前本地差异，按其原记录承接，未宣称本轮新增。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| 角色、任务与页面模式 | 通过 | 命名列表/详情/编辑及66个Tab已有页面证据；未把长表单铺在列表中 |
| 文案、状态、数量与单位 | 不通过 | 专项规则已覆盖单位/费用与身份；未测完全部状态动作，不能关闭此项 |
| 扫码、真实图片与对象识别 | 不通过 | 静态实物图、缩略图、大图、标签预览已有证据；新增加工图片文件选择及实物扫码未闭环 |
| 防错、危险确认与主管兜底 | 不通过 | 原生确认窗口无法由当前工具读取/处理，确认后的启用/停用/归档证据未齐；未绕过确认 |
| 交接、跨端事实与异常追溯 | 不通过 | 标准成本下游、渠道逐项重试和现有毛织引用已测；完整加工链及测款回写仍有缺口 |
| 低分辨率、PDA、弱网与上传恢复 | 不通过 | 1280×720、1366×768和390×844限定场景有证据；上传许可与部分故障页面未闭环 |
| 命名路由、交互、图片大图与打印 | 不通过 | 已测范围见测量汇总；导入曾超时，未补足5轮，整体性能门禁未通过 |

## 4. 问题标签

- 字段过载：已按列表/详情/编辑及业务Tab重组，保留页面证据。
- 追溯不足：仍需补连续加工、测款回写和跨系统操作证据。
- 选不对：已修正新加工/采购选用遗漏主档及SKU审核/启用状态的校验。
- 点错风险：原生确认后的结果仍需验收，不能按未操作过的路径判通过。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
|---|---|---|---|---|
| 已审核物料仅改名称被技术身份比较阻断 | 选不对 | 物料维护人员 | 保留精确原技术值；保存5轮及受影响路由120次回归 | 相邻状态动作待验 |
| 旧品类编号引用与新配置ID不同 | 追溯不足 | 商品维护人员 | 精确ID优先并保留别名；343项静态来源核对 | 浏览器旧配置转换待验 |
| 从渠道返回测款保留旧校验提示 | 读不懂 | 店铺运营人员 | 返回时清除旧提示，保留各次来源；5轮绑定回归 | 完整上架回执仍仅1轮 |
| BOM缺损结构被缓存为空资料 | 追溯不足 | 技术资料人员 | 失败可重新读取、零写入；保留修复前最小失败和回归 | 全页面故障验收未齐 |
| 未审核/停用物料或停用主档可新建加工/采购 | 选不对 | 加工计划、采购人员 | 候选项/入口/保存共同校验；已有计划、草稿保持快照 | 专项19项通过，最新页面动作待验 |
| BOM加入物料遗漏主档审核/启用检查；技术BOM的既有停用行反而不能维护 | 选不对 | 买手、技术资料人员 | 新选用和保存同时校验；以已保存行ID和SKU判定原有使用，允许维护用量；候选项隐藏不可新选物料 | BOM专项11项通过，其中新增3项；修复后页面待验 |
| 批量导入性能与文件操作证据不足 | 追溯不足 | 资料维护人员 | 保留慢样本，申请本机测试CSV选择许可后重测 | 是 |
| 原生确认窗口导致后续点击未生效 | 点错风险 | 本机验收 | 已请求手动取消；保留状态，不跳过确认 | 是 |

## 6. 最终结论

结论：不通过

此结论表示 **R1总体交付未完成**，不否定已经取得直接证据的局部需求。当前矩阵29项已验证、127项已实现待验证、2项已阻塞；没有用户授权的性能例外。248项专项测试和构建通过，不能代替尚缺的页面、性能、附件与连续场景。未提交、推送、部署或取得产品接受回执。

## 7. 变更覆盖与验证

### 受管文件

以下按当前任务工作树实际差异列出，包括保留的此前维护工具删除；源文件清单和指纹见证据目录source-manifest.json。该清单是覆盖范围，不表示所有文件均完成业务验收。

- `src/data/fcs/material-process-plans.ts`
- `src/data/generated/pcs-record-baseline.json`
- `src/data/pcs-channel-catalog-types.ts`
- `src/data/pcs-channel-catalog.ts`
- `src/data/pcs-channel-commands.ts`
- `src/data/pcs-channel-legacy-conversion.ts`
- `src/data/pcs-channel-listing-spec-types.ts`
- `src/data/pcs-channel-listing-spec-utils.ts`
- `src/data/pcs-channel-options.ts`
- `src/data/pcs-channel-platform-template.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-channel-store-master.ts`
- `src/data/pcs-channel-store-repository.ts`
- `src/data/pcs-channel-sync.ts`
- `src/data/pcs-channel-wms-projection.ts`
- `src/data/pcs-config-dimensions.ts`
- `src/data/pcs-config-workspace-repository.ts`
- `src/data/pcs-design-revision-material-sku.ts`
- `src/data/pcs-engineering-bom-legacy-intent.ts`
- `src/data/pcs-engineering-bom-material-resolver.ts`
- `src/data/pcs-engineering-bom-pricing.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-bom-snapshot-validation.ts`
- `src/data/pcs-engineering-bom-types.ts`
- `src/data/pcs-engineering-bom-version.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-exchange-rate-config.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-material-archive-types.ts`
- `src/data/pcs-material-attributes.ts`
- `src/data/pcs-material-config.ts`
- `src/data/pcs-material-handoff.ts`
- `src/data/pcs-material-pattern.ts`
- `src/data/pcs-material-performance-fixtures.ts`
- `src/data/pcs-material-r1-seeds.ts`
- `src/data/pcs-material-reference-check.ts`
- `src/data/pcs-material-rules.ts`
- `src/data/pcs-material-technical-usage.ts`
- `src/data/pcs-material-transfer.ts`
- `src/data/pcs-material-variant-repository.ts`
- `src/data/pcs-material-variant-types.ts`
- `src/data/pcs-pattern-library.ts`
- `src/data/pcs-product-archive-commands.ts`
- `src/data/pcs-product-archive-rules.ts`
- `src/data/pcs-product-lifecycle-governance.ts`
- `src/data/pcs-product-packaging.ts`
- `src/data/pcs-product-reference-check.ts`
- `src/data/pcs-project-bootstrap.ts`
- `src/data/pcs-project-config-workspace-adapter.ts`
- `src/data/pcs-project-data-consistency.ts`
- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-project-relation-repository.ts`
- `src/data/pcs-project-repository.ts`
- `src/data/pcs-project-technical-data-writeback.ts`
- `src/data/pcs-project-types.ts`
- `src/data/pcs-record-bootstrap.ts`
- `src/data/pcs-record-codec.ts`
- `src/data/pcs-record-db.ts`
- `src/data/pcs-record-position.ts`
- `src/data/pcs-record-runtime.ts`
- `src/data/pcs-record-static-versions.ts`
- `src/data/pcs-sku-archive-repository.ts`
- `src/data/pcs-sku-archive-types.ts`
- `src/data/pcs-style-archive-bootstrap.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-style-archive-types.ts`
- `src/data/pcs-style-product-information.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/data/pcs-testing-order-repository.ts`
- `src/data/pcs-unsaved-changes.ts`
- `src/data/pms/material-purchase-orders.ts`
- `src/data/pms/material-purchase-references.ts`
- `src/data/pms/reconciliations.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/pages/pcs-channel-payouts.ts`
- `src/pages/pcs-channel-products.ts`
- `src/pages/pcs-channel-stores.ts`
- `src/pages/pcs-channel-ui.ts`
- `src/pages/pcs-config-workspace.ts`
- `src/pages/pcs-independent-sampling.ts`
- `src/pages/pcs-local-data.ts`
- `src/pages/pcs-material-archive-detail.ts`
- `src/pages/pcs-material-archives.ts`
- `src/pages/pcs-material-handoff.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pcs-product-information.ts`
- `src/pages/pcs-storage-error.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/pcs-testing-order-detail.ts`
- `src/pages/pms/material-purchase-orders.ts`
- `src/pages/process-dye-orders.ts`
- `src/pages/process-factory/special-craft/task-orders.ts`
- `src/pages/process-print-orders.ts`
- `src/pages/process-work-orders/early-process-management.ts`
- `src/pages/process-work-orders/material-process-plans.ts`
- `src/pages/tech-pack/cost-domain.ts`
- `src/pages/wls/finished/stock-realtime.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes-pcs.ts`

### 页面路由

下面是原始路由测量中记录的实际页面；五轮冷启动/刷新、站内切换、Tab和保存分别保留，不相互替代。最新物料选用校验变更后，新加工/采购相关入口仍需重测；此前证据只能证明当时相应范围。

- `/pcs/channels/stores`
- `/pcs/channels/stores/ST-001`
- `/pcs/channels/stores/ST-001/edit`
- `/pcs/channels/stores/new`
- `/pcs/channels/stores/sync`
- `/pcs/materials/accessory`
- `/pcs/materials/consumable`
- `/pcs/materials/fabric`
- `/pcs/materials/fabric/material-r1-MAT-FB-00000001`
- `/pcs/materials/fabric/material-r1-MAT-FB-00000001/edit`
- `/pcs/materials/fabric/material-r1-MAT-FB-00000001/skus/material-r1-MAT-FB-00000001-B01`
- `/pcs/materials/fabric/material-r1-MAT-FB-00000001/skus/material-r1-MAT-FB-00000001-B01/edit`
- `/pcs/materials/fabric/material-r1-MAT-FB-00000001/skus/material-r1-MAT-FB-00000001-B01/process`
- `/pcs/materials/fabric/material-r1-MAT-FB-00000001/skus/new`
- `/pcs/materials/fabric/new`
- `/pcs/materials/parts`
- `/pcs/materials/yarn`
- `/pcs/products/channel-products`
- `/pcs/products/channel-products/channel-listing-demo-1`
- `/pcs/products/channel-products/channel-listing-demo-1/edit`
- `/pcs/products/channel-products/new`
- `/pcs/products/specifications`
- `/pcs/products/specifications/new`
- `/pcs/products/specifications/sku_b926eba2-fe3b-4126-8971-0ea7ad370b2c`
- `/pcs/products/specifications/sku_b926eba2-fe3b-4126-8971-0ea7ad370b2c/edit`
- `/pcs/products/styles`
- `/pcs/products/styles/new`
- `/pcs/products/styles/style_1b2d1a30-923d-4e1e-9a57-293de505b485`
- `/pcs/products/styles/style_1b2d1a30-923d-4e1e-9a57-293de505b485/edit`
- `/pcs/settings/config-workspace`

- `/pcs/testing/orders/to_muvl1of8_7`：5轮来源绑定，完整发布未闭环。
- `/fcs/process/material-plans` 与新建/详情/编辑入口：规则通过，最新选用校验后的页面操作待验。
- 既有毛织打印/PDA的精确URL见 `wool-print-release.json`、`wool-pda-release.json`，不将其扩展为全域PDA验收。

### 验证命令

- `node --import tsx --experimental-test-module-mocks --test tests/pcs-r1-*.test.ts tests/unit/pcs-design-revision-current-flow.test.ts tests/unit/fcs-design-revision-result-readiness.test.ts`：通过，248/248；原始日志见证据目录。
- `npm run build`：通过，工程检查573/573，Vite构建成功。
- `npm run typecheck`：失败，3条基准HEAD也可重现的既有错误；没有忽略失败或改写为通过。
- `python3 docs/reviews/2026-10-05-pcs-prototype-adjustment-plan/validate_documents.py --implementation`：通过，158项需求、337项字段、64项决策、403项旧字段、69组线上信息的引用与实施状态结构完整；不是业务验收通过。
- `npm run check:prototype-design-governance -- --all`：通过，103个用户可见受管文件关联2份审查记录。首次运行因历史记录格式失败，规范化后重跑通过；此脚本只验证审查记录覆盖，R1整体结论仍不通过。
- `git diff --check`：通过，未发现补丁空白错误。
- `workflow:verify`完整任务收据：未运行；当前整体性能及业务门禁未通过，不以收据替代交付。

### 真实图片验证

- 来源为仓库随应用发布的真实服装/面辅料静态图片及当前已有附件引用；没有把上传占位、空白或data URL作为完成证据。
- 商品/物料识别列组合缩略图、业务编码和名称；大图、失败态、物料标签预览按各原始截图/测量范围检查。
- 5次款式大图、5次物料标签预览已有证据；新增加工阶段自身图片选择尚未完成。没有进行实物打印或设备扫码。
- 当前款式列表截图：`docs/reviews/2026-10-05-pcs-prototype-adjustment-plan/evidence/styles-current-preview.png`；此截图不是新的详情导航或性能通过证据。

### 例外

- 无。未完成项没有被作为例外豁免，详见 [未闭环验收清单](../reviews/2026-10-05-pcs-prototype-adjustment-plan/remaining-validation.md)。
- 完整测量、失败及环境见 [证据说明](../reviews/2026-10-05-pcs-prototype-adjustment-plan/evidence/README.md)，逐条状态见 [实施记录](../reviews/2026-10-05-pcs-prototype-adjustment-plan/implementation-progress.md)。
