# 缝边绣统一与工艺固定承接厂调整

依据 `AGENTS.md` 的 SCOPE-02、TRACE-01、NAME-01、STORE-01～04、LIST-01、REVIEW-01、PERF-01、EVIDENCE-01，使用完整产品审查格式。

## 基本信息

- 日期：2026-10-17
- 任务 / 需求编号：SEAM-01～SEAM-17
- 验证人：Codex 主代理；技术验证不代替用户接受

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：正式业务对象合并，涉及工艺字典、加工单、技术包、毛织、仓库、PDA、存量引用与公共列表，按 T4；合并 main 和正式发布另叠加 T5。

## 需求与边界

用户追加要求：原三类边绣统一为“缝边绣”，当前系统文案和工程代码不保留原三类名称与对象；辅助工艺、特种工艺不出现多工厂切换及其演示分支。前一版本的18类页面已发布至GitHub main，完整基准为 `821b9ea54040ec03662acbe6ae3d2c62608fe273`；该版本仅作本次合并前的独立基线，不把其线上检查当成本次新需求通过。

目标：唯一“缝边绣”工艺与加工单入口，新内部标识 `AUX-OP-SEAM-EMBROIDERY`，新工艺代码 `CRAFT_3000010`，路由 `/fcs/process-factory/special-craft/aux-op-seam-embroidery/work-orders`。三个类型合为一个类型后，列表入口共16类（辅助12、特种4）。合并的是工艺类别，不以合并为由丢弃个别加工单、工序节点、实收、加工、交出、库存或附件引用。

固定承接厂按每种工艺的现行唯一归属处理：烫画／直喷沿用FLOWER，其他辅助工艺沿用APF，特种工艺沿用SPF；不把单工艺页面扩大为跨工厂管理。毛织原测试厂的工艺演示节点改为其对应固定工艺厂，保留毛织本厂及上下游的真实角色。用户已保存的实际交接事实不冒充发生在其他工厂；存在归属冲突必须保留并阻断不安全迁移。

非范围：不改变印花、染色、横机、缝盘或其他工厂的业务身份；不清空浏览器或删库；仅删除下节明确授权的无编码历史成本行，其他用户记录不重置；不新增后端、鉴权、状态机或通用基础设施。不以拼接、编码或隐藏字符串保留已退役对象。

## 追加授权与删除边界

2026-10-17 用户明确追加：旧名称在代码中绝不保留；无编码的历史成本行全部删除。本条只针对历史可选工艺成本明细缺少有效工艺编码的行及其对应金额／展示缓存，不删除整张核价单、材料、固定工序、其他业务记录或附件。带有效编码的行保留。删除采用独立受控步骤，失败不假称完成；不能用普通读取静默清理或构造旧名称映射。用户授权删除该具体范围，按STORE-04允许丢弃，不扩展到其他资料。

## 存储与历史资料边界

- 工艺与静态技术包：`process-craft-dict.ts`、`special-craft-operations.ts`、PCS冻结基线、生产技术包JSON。当前可选项只保留唯一新对象；旧数字身份仅可用于受控的一次迁移与追溯，不作为三个可选对象或旧路由。
- PCS用户技术包／配置：沿用既有IndexedDB记录、附件及事务设施；只改必要记录和结构化工艺引用，保留稳定单据／节点／文件身份，验证刷新与独立入口。
- 毛织：当前旧源为 `higood-fcs-wool-stage-store-v3`，已有工艺与交接事实；须明确转换范围、读回及旧写入阻断，复用已有记录事务设施，不能把整包JSON换个存储位置，也不把普通读取变成落种子或写迁移。
- 直接接收来源：`higood-factory-material-receiving-v1` 中与毛织片关联的来源、实收和分配；与同一业务动作共同成功的改动须同库同事务，不改无关印染接收事实。
- FCS内存生成事实：通过当前技术包和稳定来源关系生成；合并前后核对来源身份与数量，不把演示样本数量变化冒充用户数据迁移成功。
- 历史报告及原始证据：旧版本按完整Git基准保留身份；当前树中含退役对象的冻结原始证据先核对可恢复版本及消费者，再退役并改为该Git版本的引用，不改写旧采样数值或结论。新记录不重复旧名称。

## 实施计划

1. 登记当前源码、数据、菜单、路由、持久源和历史消费者；建立下面原子矩阵及失败契约。
2. 统一字典、技术包、静态配置及代码身份；删除三套旧对象和重复配置，保留新工艺唯一性。
3. 处理结构化存量引用与必要持久边界；核对记录、节点、单号、数量、文件和历史事实，验证错误／冲突不丢数据。
4. 移除辅助／特种多工厂Tab、状态与事件；修正毛织工艺厂演示归属，验证每种工艺唯一固定承接厂及访问边界。
5. 同步PDA、仓库、工厂能力、测试、专项脚本与现行文档；清理历史原始资料的当前树消费者，保留Git版本追溯。
6. 逐项核对16类列表与直接上下游，三个桌面视口、适用PDA／打印、图片、正常／边界／恢复及性能；最终全量正反向核对。
7. 两轮实质对抗审查，修复并复验；冻结文件后运行范围治理与技术收据。
8. 提交、合并main、推GitHub；核对Actions和HTTPS部署身份，再全量核对线上16类及新名称唯一性，独立记录发布证据。

## 16类逐项核对清单

工艺类别合并后按以下顺序逐项核对，每项通过后再进入下一项；随后独立执行全量核对。以下为本地冻结阶段结果，正式站发布证据另附。演示夹具总量158张，不把退役的重复类型演示桶计为用户记录丢失；22张毛织片的稳定单号与节点另核。

| 序号 | 加工单 | 固定承接厂 | 当前演示张数 | 单项页面核对 | 全量核对 |
| --- | --- | --- | --- | --- | --- |
| 01 | 打揽 | APF | 9 | 已验证 | 已验证 |
| 02 | 打条 | APF | 9 | 已验证 | 已验证 |
| 03 | 烫画 | FLOWER | 9 | 已验证 | 已验证 |
| 04 | 直喷 | FLOWER | 9 | 已验证 | 已验证 |
| 05 | 布包扣 | APF | 9 | 已验证 | 已验证 |
| 06 | 绣花 | APF | 18 | 已验证 | 已验证 |
| 07 | 压褶 | APF | 9 | 已验证 | 已验证 |
| 08 | 缝边绣 | APF | 22 | 已验证 | 已验证 |
| 09 | 盘扣 | APF | 1 | 已验证 | 已验证 |
| 10 | 花朵 | APF | 9 | 已验证 | 已验证 |
| 11 | 打褶 | APF | 9 | 已验证 | 已验证 |
| 12 | 烫钻 | APF | 9 | 已验证 | 已验证 |
| 13 | 模板工序 | SPF | 9 | 已验证 | 已验证 |
| 14 | 激光开袋 | SPF | 9 | 已验证 | 已验证 |
| 15 | 特种车缝（花样机） | SPF | 9 | 已验证 | 已验证 |
| 16 | 橡筋定长切割 | SPF | 9 | 已验证 | 已验证 |

## 原子矩阵

本矩阵关闭本地T4实施与验收阶段。SEAM-16为后续T5正式发布阶段，只有版本、线上全量及资源核验通过后，独立发布回执才能将其改为已验证；本记录不预填发布结果。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 打印 / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEAM-01 | 用户1 | 唯一工艺字典与16类定义 | 字典 | src/data/fcs/process-craft-dict.ts；src/data/fcs/special-craft-operations.ts；process-craft-dict / special-craft-operations | identity-final-10.log；r2-empty-label-real-whitespace.log | consumers、16类菜单 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-02 | NAME-01 | 唯一新菜单、路由、操作身份；旧地址退役 | 路由 | src/data/fcs/special-craft-operations.ts；operation registry | identity-final-10.log | local-final/retired-routes.json | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-03 | 用户1 | 技术包、纸样、部位、BOM与毛织路线引用归一 | 数据 | src/data/fcs/seam-embroidery-identity.ts；src/data/fcs/production-context-records.ts；src/data/fcs/wool-domain/tech-pack-source.ts；identity projection / tech pack | static-data-diff.json；38项R2专项 | 多节点稳定ID与存量回读 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-04 | STORE-04 | 稳定身份、来源、数量、原工厂与附件引用保留；迁移幂等 | 迁移 | src/data/fcs/wool-domain/store.ts；src/data/fcs/design-revision-pcs-storage.ts；src/data/pcs-record-codec.ts；wool records / receiving bridge | output/verification/wool-storage/browser-final.log；replay.mjs | 77条直接来货、9条历史厂事实、16条无关来源保留 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-05 | STORE-01～02 | 受影响毛织和直接来货同记录库、同事务，失败保留输入 | 持久 | src/data/fcs/design-revision-pcs-command.ts；src/data/pcs-record-runtime.ts；src/main-handlers/fcs-handlers.ts；runDesignRevisionFcsCommand | wool-record-storage7项；真实浏览器quota/retry | 刷新、独立下游、相同事务回读 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-06 | STORE-03、IMAGE-01 | 文件ID和真实图片对应保留，列表与详情可预览关闭 | 图片 | src/pages/process-factory/special-craft/order-display.ts；src/pages/process-factory/special-craft/task-detail.ts；shared product/material identity templates | local-final/all-details.json：158单176图 | local-final/interactions.json；detail-image performance | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-07 | 用户2 | 16类全部移除工厂Tab、状态和事件 | 列表 | src/pages/process-factory/special-craft/task-orders.ts；renderSpecialCraftTaskOrdersPage | identity-final-10.log；local-final/online-batch-0-16.json | 16类×1366/1280/1024共48场景 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-08 | 用户2 | 新单唯一固定承接厂，原实际归属保留并阻断冲突 | 工厂 | src/data/fcs/special-craft-dedicated-factories.ts；src/data/fcs/wool-domain/craft-flow.ts；dedicated factory / assert factory | scope-boundary；wool-record-storage7项 | local-final/interactions.json；历史F090阻断与原量保留 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-09 | 用户1～2 | 实收、投入、产出、交出与单位结果一致 | 链路 | src/pages/process-factory/special-craft/task-detail.ts；src/pages/process-factory/wool/craft-actions.ts；special craft flow / wool flow | output/verification/aux-special-accessory/seam-unification/final-summary.json | 1448契约通过；22毛织另用真实浏览器契约 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-10 | 用户1 | 工厂能力、成本、配置和仓位统一消费新身份 | 消费者 | src/data/fcs/factory-master-store.ts；src/data/pcs-config-dimensions.ts；src/data/fcs/factory-internal-warehouse-locations.ts；factory capability migration / cost cleanup | 5项能力迁移；15项成本；仓位身份契约 | local-final/consumers.json；全部三原库区货架仍可定位 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-11 | 清洁要求 | 当前运行源、Mock、测试、脚本、文本产物无退役名称 | 清理 | src/data/fcs/seam-embroidery-identity.ts；完整任务清单；complete task diff | retired-name-scan-final.json；源码5980文本、产物585文本零命中 | 不以编码、拼接或隐藏名称兼容 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-12 | DOC-01 | 历史原始证据按Git版本追溯，当前消费者有效 | 文档 | docs/retired-craft-history.md；docs/retired-craft-history.json；retired history mapping | history-recovery-verified.json；R2独立65项SHA回读 | 51原始文件退役；10冻结消费者不改字节 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-13 | 逐项/全量要求 | 逐项核对16类，再独立全量核对含空结果、刷新和恢复 | 验收 | src/pages/process-factory/special-craft/task-orders.ts；src/pages/process-factory/special-craft/task-detail.ts；named page collectors | local-final/sequential-results.json；online-batch-0-16.json；all-details.json | 48列表场景、158真实详情、分页身份及图片 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-14 | PERF-01 | 具名性能家族各至少5有效样本且全部≤1000ms | 性能 | 完整受管运行文件；frozen production build and separate dev migration | performance-summary-final.json | 原始样本、起终点、浏览器/视口/数据/资产绑定；采集错误与历史失败保留 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-15 | 两轮审查要求 | 两轮对抗审查无未关闭问题，主代理整合完整diff | 审查 | 完整任务diff；R1 forward / R2 reverse coverage | review-round-1.json；review-round-2-final.json | R1事件/能力/成本/图片修复；R2空显示名边界修复 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-17 | 追加删除授权 | 删除无编码历史可选工艺成本行及对应金额缓存，其他金额不重价 | 历史成本 | src/data/pcs-sample-cost-optional-cleanup.ts；src/data/pcs-project-inline-node-record-repository.ts；src/main.ts；cleanupLegacyUncodedSampleOptionalCosts | 15项成本契约；local-final/cost-maintenance.json | 删除12示例成本后100→88；有编码20与冻结汇率保留；失败原源不变、真实重试 | 已验证 | output/playwright/seam-embroidery-unification；output/verification/wool-storage | Codex技术验证；asset-version.json冻结工作树 |
| SEAM-16 | 用户发布要求 | main/GitHub/Actions/HTTPS版本一致并线上16类全量通过 | 正式发布 | .github/workflows/deploy.yml及正式站 | 远端完整SHA、Actions run_id、deployment.json与资源散列 | formal线上16×3视口及158详情；正式发布阶段独立回执 | 待实施 | output/playwright/seam-embroidery-unification/release-final.json | T5阶段独立确认 |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 本地T4范围与唯一工艺对象 | 通过 | SEAM-01～15、17；16类清单、字典与路由一致，SEAM-16独立T5阶段未预填 |
| 列表结构与设备 | 通过 | 16类逐项后全量48场景，1366×768、1280×720、1024×768；宽表在内部滚动，无工厂Tab |
| 数量与状态 | 通过 | 1448专项结果；毛织片按独立契约核验，不能用普通来源夹具的NA代替 |
| 原子保存、迁移和恢复 | 通过 | 浏览器旧版28单、77来货记录迁移；quota失败输入保留、重试和下游直达；普通读取不落整包种子 |
| 删除范围和金额保护 | 通过 | 明确授权的无编码可选工艺成本行清理；材料、固定工序、有编码冻结金额、附件不改；并发源冲突保留新事实 |
| 商品与物料图片 | 通过 | 158详情176图；列表与详情同源对应；大图Esc/关闭/遮罩及加载失败态实测 |
| PDA演示与打印映射 | 通过 | 原子契约与现有专项脚本；单位、物料和工艺身份一致；不代表设备实操 |
| 实体PDA、扫码、打印机现场验收 | 不适用 | 本次为免登录本地原型发布，没有真实设备或工厂执行；17项外部设备门禁单列，未冒称通过 |
| 附件新增、删除或恢复功能 | 不适用 | 本次不改变Blob实体或附件生命周期；稳定fileId/引用保留已验证，不新增PCS维护入口 |
| 性能 | 通过 | 具名家族原始样本见performance-summary-final.json，每家族至少5次，最慢有效样本≤1000ms |
| 工程与历史清理 | 通过 | 全树及生产文本零退役名；旧地址不兼容跳转；65映射可从固定Git恢复，现行消费者无失效链接 |
| 治理所需等价整理 | 通过 | 备料桌面/PDA显式分支、仓库表格参数显式传递；2契约比较旧Git函数，4种登录/模式与48仓库组合的HTML/状态/调用次数保持，未改检查器或基线 |
| 两轮实质对抗审查 | 通过 | R1修复分发await、能力数组及成本持久边界；R2修复空白显示名，原问题和复验保留 |

## 最终结论

结论：通过

本结论只关闭本地T4实施验收阶段；正式发布尚须执行SEAM-16，不将此记录或技术收据当成部署成功、工厂现场接受或用户接受。最终完整任务结果由独立release-final.json绑定完整提交、Actions与正式域名证据后确认。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/design-revision-pcs-command.ts`
- `src/data/fcs/design-revision-pcs-storage.ts`
- `src/data/fcs/factory-internal-warehouse-locations.ts`
- `src/data/fcs/factory-master-store.ts`
- `src/data/fcs/factory-onboarding-flow.ts`
- `src/data/fcs/process-craft-dict.ts`
- `src/data/fcs/process-order-task-links.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/process-warehouse-domain.ts`
- `src/data/fcs/production-context-records.ts`
- `src/data/fcs/production-order-demo-tech-packs.json`
- `src/data/fcs/seam-embroidery-identity.ts`
- `src/data/fcs/special-craft-dedicated-factories.ts`
- `src/data/fcs/special-craft-operations.ts`
- `src/data/fcs/special-craft-pda-scope.ts`
- `src/data/fcs/wool-domain/craft-flow.ts`
- `src/data/fcs/wool-domain/mock-data.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/data/fcs/wool-domain/tech-pack-source.ts`
- `src/data/generated/pcs-record-baseline.json`
- `src/data/pcs-config-dimensions.ts`
- `src/data/pcs-project-inline-node-record-bootstrap.ts`
- `src/data/pcs-project-inline-node-record-repository.ts`
- `src/data/pcs-record-codec.ts`
- `src/data/pcs-record-runtime.ts`
- `src/data/pcs-sample-cost-optional-cleanup.ts`
- `src/data/pcs-sample-cost-review-pricing.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/main.ts`
- `src/pages/pda-wool-fact-execution.ts`
- `src/pages/process-factory/special-craft/order-display.ts`
- `src/pages/process-factory/special-craft/task-detail.ts`
- `src/pages/process-factory/special-craft/task-orders.ts`
- `src/pages/process-factory/special-craft/warehouse.ts`
- `src/pages/process-factory/wool/craft-actions.ts`
- `src/pages/process-factory/wool/machine-associations.ts`
- `src/pages/process-factory/wool/machines.ts`
- `src/pages/process-factory/wool/pending-receipts.ts`
- `src/pages/process-factory/wool/stage-order-detail.ts`
- `src/pages/process-factory/wool/stage-orders.ts`
- `src/pages/process-factory/wool/stock-allocations.ts`
- `src/pages/process-factory/wool/warehouse.ts`
- `src/pages/process-order-task-relations.ts`

### 页面证据

- 版本：分支codex/seam-embroidery-unification，基准HEAD 821b9ea54040ec03662acbe6ae3d2c62608fe273；未提交源文件及产物SHA256逐项见asset-version.json，资产与输入逐项散列及实际数量见冻结清单。服务http://127.0.0.1:43183，实际工作树/Users/laoer/.codex/worktrees/dfd6/higoods；Chromium155（CLI列表/详情）及Chromium149（毛织/成本/详情图片专项）、Asia/Shanghai，隔离上下文，本地生产构建。正式部署Node24与本地Node26差异由Actions同锁文件重建及正式站资源散列复核。
- 证据：output/playwright/seam-embroidery-unification/local-final中sequential-results.json为16项顺序检查；online-batch-0-16.json为48场景全量；all-details.json为158真实详情176图；interactions/extras/consumers/retired-routes/wool-keyword/cost-maintenance均记录实际结果。图片来自既有正式商品/物料静态资源，与商品、BOM对象相同来源，不新增网络占位。
- 复用边界：列表48场景保留原图片补充前构建身份，list-dom-before/after及list-dom-equivalence.json证明14根节点字节相同，前2根仅演示当前建单时间不同，CSS资产一致；新增详情图另验全部158详情。R2空名修复只作用旧编码空白显示名，正常新身份的页面输入不变，另有失败契约/独立重放与最终构建。普通辅助工艺运行仍是现有内存投影，不冒称全模块已持久化。
- 失败保留：旧选择器、嵌套main、后台采集超时记录均在ignored output；未作为通过项。详情中途构建/预览中断的日志保留并补采未完成类别；性能期间停止构建及其他浏览器负载。旧共享design-revision测试夹具缺少原washing依赖的失败发生在业务断言前，不冒称该旧浏览器套件通过。

### 性能结论

- 结论：通过
- 依据：performance-summary-final.json及其列出的原始采集文件、collector脚本和asset-version.json。列表含混合22单、BOM双图、特种工序；详情含打揽/布包扣两尺寸图片与预览；毛织保存/失败/重试/直接读取、成本启动清理/失败/重试均独立家族。旧版迁移仅独立开发诊断服务（随机端口，原日志记录实际地址），单列25样本，不混入生产加载指标；浏览器进程启动和应用导航耗时分列。每个家族至少5个有效样本，按最大值判断，无豁免。详情首100样本中4个新文档家族有17个真实慢值，最慢1077.8ms；首次scope修复后50样本中10个fresh仍超限，亦保留；CPU诊断定位全量关联任务读取。补传真实生产单范围并将实际路线传入底层来源读取后，136普通单完整关系deepEqual，无路线仍完整恢复，复测结果单独保存，不用不同浏览器或缩略图替代原失败。

### 验证命令

- `npm run build`：通过
- `npx vite build`：通过
- `node --import tsx --test tests/unit/seam-embroidery-unification.test.ts tests/unit/seam-factory-capability-migration.test.ts tests/unit/wool-record-storage.test.ts tests/unit/sample-cost-uncoded-cleanup.test.ts`：通过
- `python3 output/playwright/seam-embroidery-unification/run-sequential.py`：通过
- `python3 output/playwright/seam-embroidery-unification/run-full.py 0 16`：通过
- `python3 output/playwright/seam-embroidery-unification/run-details.py http://127.0.0.1:43183 local-final 12`：通过
- `python3 output/playwright/seam-embroidery-unification/run-performance.py http://127.0.0.1:43183 local-performance`：通过
- `node --import tsx --test tests/unit/wool-stock-render-structure.test.ts`：通过
- `npm run check:list-page-governance -- --scope worktree --paths <实际任务清单>`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths <实际任务清单>`：通过
- `git diff --check`：通过

完整build1071为生产单hint版本；随后底层路线条件修正后8专项及Vite构建通过，全部136普通单关系不变。此前专项38（真实空白另11）保留原日志及复用边界。最终收据对固定输入重跑完整构建，其实际计数与结果单独登记，不预填。范围治理在本记录实际任务路径执行，技术收据在固定本记录后输出/tmp/seam-task-receipt.json；其结果另附，不预填本记录。现有聚合收据强制重跑构建和已通过专项时，保留实际范围及日志，不通过修改检查器绕过。

### 例外

- 无性能或验证门禁例外。SEAM-17只使用用户明确授权的目标成本行删除；其他用户数据保留。用户浏览器在其本地受控启动步骤执行，隔离测试成功不冒称所有设备的浏览器历史已清理。

## 两轮对抗审查与主代理整合

第一轮按需求正向追踪，发现并关闭异步详情分发、数组能力父工序、成本缓存持久化、并发回读保源及空缓存版本标记问题。最初成本名称P2未建立现行消费者，已撤销原缺陷主张；随后用户明确追加删除范围，按SEAM-17单独实现。详情图片缺口由实际逐单验收发现，复用既有模板，独立复核并补页面证据。

第二轮从最终代码、路由、数据、Mock、脚本、测试及历史资料反向追踪，发现并关闭空白显示名替换损坏历史文字事实的P2；三种关联字段、代码数组、空串/空格/真实Tab换行均覆盖。随后实际性能发现详情新文档导航超时，定位关联任务全量计算；仅传递已知生产单范围，保留现有显式跨单引用与runtime分支，136普通单原关系逐单相等，独立审核并复测后关闭。独立审查没有未关闭可复现问题。主代理阅读实际diff和静态JSON结构差异、核对全部退役原件Git散列，整合运行与存储证据；两轮均不以脚本代替语义审查。

治理补充：范围门禁最初无法证明既有混合条件与返回对象的列表契约。仅整理两处显式渲染数据流，原桌面/PDA与仓库HTML/状态保持，真实等价契约及独立附加复核通过；早先77输入清单和性能原始身份保留，最终收据构建后另生成包含新等价契约的冻结清单。此整理不改变保存、读取、数量、图片或操作完成条件，600样本按EVIDENCE-01保留原身份与复用依据。


最终测试接入补充：第一次收据实现态失败的原始日志 workflow-verify-final.log 与 /tmp/seam-task-receipt.json 保留；不是通过回执。七个只改身份的旧浏览器用例以固定821b前后AST精确比较，8项保守契约全部通过，拒绝其他断言和选择器变化，不声称旧版driver实际执行。其余未知测试仍阻断。新增存储契约自建隔离开发服务，旧版夹具从固定Git原件即时生成，4项全部通过、0跳过；335项治理测试通过。Node领域/静态UI专项17个子脚本通过，7文件247次断言与原场景标签保留；专用无窗facade只在检查进程临时使用，不能证明IndexedDB。实际毛织E2E17项均通过，包括真实事务、刷新、后续实际接收与图片；初次15过2失败原始日志保留，修复为明确页大小和夹具await原子保存，未削弱业务断言。相关新运行器、夹具、脚本改动纳入独立第二轮附审及最终收据输入。
