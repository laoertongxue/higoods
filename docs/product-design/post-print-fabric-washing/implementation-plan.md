# 印花后面料水洗实施计划

> V1.3 增量修订：[GTG 固定承接与加工单结构](gtg-routing-and-processing-layout-v1.3.md)。本文件保留原版规则及证据，冲突部分以本次修订为准。

> V1.2 增量修订：[操作栏发起洗水与名称统一](list-entry-and-washing-name-v1.2.md)。本文件保留 V1.1 的规则及证据身份，新增入口和显示名称以修订为准。
版本：V1.1。日期：2026-10-15。阶段：本地技术验证完成，产品接受另行登记。核查代码基线：67499ec61a1e770c39e5cdf3eddc4d2068eb7f4a，detached HEAD，整理前工作树干净。

依据：[业务需求](requirements.md)。逐项交付：[原子矩阵](atomic-requirements.md)。现状与直接消费者：[影响核查](upstream-downstream-review.md)。

本轮按共享事实、跨端和存量调整的 T4 实施，并更新四份文档。隔离验收浏览器用于操作与失败注入，未访问测试站数据库或用户浏览器业务资料。用户明确要求不提交、不推送、不发布。P1 保留原计划文件组，P9 登记实际实现绑定和方案收敛。

## P1 依赖顺序与实施位置

先固定记录和存量边界，再改路线和初始生成；在同库保存能力成立后接现场建单、按卷交出、染厂实收和产出，最后接直接读取入口、打印、Mock 与验收。不能先把新入口挂在旧整包写入上交付。

下列 F 编号供矩阵精确引用。既有位置是本次已核查位置；“拟新增”是实施目标而非现有实现。开工后根据实际 patch 更新绑定，不能将拟新增位置当作已实现。

| 文件组 | 位置与关键符号 | 范围 |
| --- | --- | --- |
| F01 | src/data/tech-pack-process-route.ts：ProcessRouteGraphEntry、路线验证；src/pages/tech-pack/process-domain.ts；src/pages/tech-pack/bom-process-linkage.ts | 路线选择、校验、BOM 联动和图形前置 |
| F02 | src/data/pcs-technical-data-demo-completion.ts；src/data/pcs-technical-data-version-types.ts；src/data/fcs/production-tech-pack-snapshot-builder.ts：freezeProcessEntries | 演示链、类型和版本快照读取 |
| F03 | src/data/fcs/production-artifact-generation.ts：generateProductionArtifactsForOrder、generateBomDrivenPrepArtifactsForEntry；src/data/fcs/production-task-breakdown.ts：buildProductionTaskBreakdownPreview；src/data/fcs/process-work-order-generation-registry.ts | 初始生成及预览，禁止将现场水洗加入自动生成注册列表 |
| F04 | src/data/fcs/printing-task-domain.ts：completePrintingWorkOrder、getPrintingWorkflowFacts、handoverPrintingOutput、confirmPrintingDispatch、saveFormalPrintExecution；src/data/fcs/printing-work-order-business.ts | 实际批次、卷、交出及旧保存边界 |
| F05 | src/pages/process-factory/printing/events.ts、dialogs.ts、work-order-detail.ts、presentation.ts；src/pages/pda-exec.ts；src/pages/pda-exec-detail.ts：renderPrintingTaskCard、renderPdaExecDetailPage；src/router/routes-pda.ts、route-renderers.ts | 现场入口、实际详情、异步加载与局部交互 |
| F06 | 拟新增 src/data/fcs/fabric-washing.ts | 专项判断、水洗单、卷占用、状态及命令；不建通用状态机 |
| F07 | 拟新增 src/data/fcs/fabric-washing-repository.ts；src/data/pcs-record-db.ts：commitPcsRecords、readPcsRecords；src/data/pcs-record-runtime.ts：runPcsRecordCommand；src/data/fcs/design-revision-pcs-storage.ts、design-revision-pcs-command.ts | 按记录持久化、来源覆盖、版本与幂等 |
| F08 | src/data/fcs/factory-receiving-types.ts；src/data/fcs/factory-receiving.ts：registerFactoryReceivingSource、prepareFactoryReceipt、savePreparedFactoryReceipt、recordFactoryMaterialUsage；factory-receiving-links.ts、factory-receiving-source-sync.ts、factory-receiving-warehouse.ts、factory-internal-warehouse.ts；src/data/fcs/pda-handover-events.ts | 收发、责任、实际领用与库存相关直接读取 |
| F09 | src/data/fcs/process-work-order-domain.ts；process-order-task-links.ts：buildProcessOrderTaskLinks、buildPendingRouteRelations；process-order-receiving-target.ts：resolveProcessOrderReceivingTarget、resolveTerminalProcessOrderReceivingTarget | 单据投影、实际加工关系和按来源去向 |
| F10 | src/data/fcs/process-mobile-task-binding.ts；mobile-execution-task-index.ts；process-web-status-actions.ts；pda-receive-scope.ts | Web 与 PDA 命令及工厂范围 |
| F11 | 拟新增 src/pages/process-factory/dyeing/washing-work-orders.ts、washing-work-order-detail.ts、washing-events.ts；src/router/routes-fcs.ts、route-renderers.ts；src/components/ui/；非 PCS 维护先复用共用入口，确无时拟新增 src/pages/fcs-prototype-data-maintenance.ts | 染厂列表、详情、动作、唯一入口和任务必要共用能力 |
| F12 | src/data/fcs/production-demand-early-process-work-orders.ts：prepareProductionDemandEarlyMatches；process-order-receiving-target.ts；printing-task-domain.ts 的 sourceSnapshot | 提前加工、采购备货、补料、改款来源衔接 |
| F13 | src/data/fcs/print-service.ts、print-template-registry.ts；拟新增 src/pages/print/templates/washing-work-order-template.ts；src/data/production-timing/source.ts：timingDocumentHref | 加工和交接打印、深链及既有履约来源 |
| F14 | src/data/fcs/printing-execution-storage.ts；受影响旧印花、交接、接收键及 PCS 记录；历史技术包读取 | 受控迁移、附件与旧写入停止 |
| F15 | 既有 tests/printing-partial-batches.spec.ts、heat-transfer-and-print-dye-flow.spec.ts、process-route-continuation.spec.ts、process-work-order-unification.spec.ts 等；拟新增 tests/unit/fabric-washing*.test.ts 与 tests/post-print-fabric-washing*.spec.ts | 业务契约、来源集成、页面和性能 |
| F16 | 本目录四份方案、实施后的专项证据目录与任务收据 | 覆盖、证据与交付状态 |

上表路径以仓库根为基准；省略目录的后续文件沿用同组已写出的目录。具体行号和可点击来源放在影响核查中。移动端列表、实际详情及异步路由已分别绑定，不能只修改列表。

## P2 工作包

| 工作包 | 业务目标与修改 | 负责位置 | 依赖 | 计划验证与完成条件 |
| --- | --- | --- | --- | --- |
| WP-01 | 固定六项决策、实物键、来源链、角色动作、数量和直接存储边界；先建立最小失败契约 | F04、F06、F07、F08、F12、F15 | 需求 V1.0 | CT-01～CT-05、CT-08 的失败样例可重放；无助剂字段或自动推断 |
| WP-02 | 实现本专项记录级读写与受影响旧记录切换，先停目标旧写入；复用同库事务和任务必要 FCS 共用资料保护 | F07、F14，必要 F04/F08/F11 适配 | WP-01 | CT-08～CT-10；事务失败、续迁、冲突、直达及完整附件恢复；不触及无关资料 |
| WP-03 | 从新路线、BOM、演示和初始生成中移除固定水洗，重接前置；保护历史 | F01、F02、F03、F14 | WP-01；持久切换使用 WP-02 | CT-01、CT-10；新生成无水洗、历史可读、原印染裁剪车缝不重建 |
| WP-04 | 按实际批次及整卷登记触摸结果，按三种手感一次建单 | F04、F05、F06、F07 | WP-02 | CT-02～CT-04；PG-01/02、PD-01；只选手感即可提交 |
| WP-05 | 单内混合卷的实际去向、占用、交出草稿和目标冻结按范围调整 | F04、F06、F08、F09 | WP-04 | CT-05/06；PG-01/04、PD-02；两类去向不串单、不重发 |
| WP-06 | 染厂派单、接单、实收、开工、产出、分批完成及实际交回 | F06、F07、F08、F10、F11 | WP-05 | CT-06/07；PG-03/04、PD-02/03；无自动实收及线上配方 |
| WP-07 | 六来源、提前匹配、实际加工关系、生产单和下游可用量接入 | F03、F08、F09、F12、F13 的时效来源 | WP-05、WP-06 | CT-04～CT-06、CT-11；PG-05；零重复单、零伪造生产来源 |
| WP-08 | 完成 Web/PDA 入口、标准列表、真实图片、加工单和交接打印及深链 | F05、F10、F11、F13 | WP-04～WP-07 | PG-01～05、PD-01～03、PR-01/02；RL-01；无失效入口 |
| WP-09 | 纠错、异常、存量读回、旧逻辑退出及直接相邻回归 | F04、F06～F10、F12、F14、F15 | WP-02～WP-08 | CT-07～CT-11；PG/PD 失败恢复；无已发生事实被抹除 |
| WP-10 | 正反向核对原子矩阵，正式页面、持久化、性能、构建和适用收据 | F15、F16 | 任务文件稳定 | 每条适用条目有当前证据；不存在未说明失败；不代替用户接受 |

本轮由主代理直接实施和执行两轮对抗审查，未新增或派发子代理。WP-02 的成功是 WP-04 的前置，不能延后为收尾优化。

## P3 直接模型与接口调整

### P3.1 专项记录

采用原印花单 ID、实际批次 ID、原卷 ID、判断版本组成稳定范围标识，并守卫原印花要求版本与相关卷版本。记录保留 rootSourceType/rootSourceId、原生产或需求关联、原最终去向及相关版本；不由业务名称拼接推断来源。上游修正触及已判断实物时检查引用并显式处理受影响范围，不将原判断静默套给新版本。

拟新增专项记录：触摸判断、水洗主单与卷明细、卷占用和流转资格、加工及交接动作。记录主键和稳定操作标识在事务中唯一，不能只依按钮 disabled 或内存 Map 去重。

一张单仅承接一个原印花批次、一个 SKU、一种手感。首版不建设跨单自动合并，也不在触摸功能拆开一卷。实际重包建立新卷时保存来源卷明细和数量对应，不复制库存。

判断改版不删除原版本；有效版和卷占用共同变化。需要水洗的判断与主单共同提交；无需水洗只提交判断及放行资格。

### P3.2 与现有加工单区分

水洗使用独立 WASH 业务类型和单据身份，不复用 DYE、WATER_SOLUBLE、waterOrderId 或原染色配方。实际加工投影可以复用 ProcessWorkOrder 展示能力；生成入口保持为现场命令，不能加入初始 prepareProcessWorkOrderBatch 的自动枚举。

具体显示名称统一“水洗加工单”。历史“洗水”文字只在保留的历史记录中保持原意；不新增两个并列有效对象。

### P3.3 按卷关系

技术包图仍描述计划路线。实际加工关系增加印花产出范围 → 水洗单 → 原后续接收方；无需水洗范围仍沿原关系。

现有 sourceEntryIds、predecessorEntryIds 只表达静态节点时，允许现场水洗以真实单据和卷范围连接，不伪造一个技术包 entry。原单级“唯一接收方”需限定到实际交出单及其卷范围：一单交出一个接收方、已交出范围冻结、未交出其他卷可去不同合法对象。

先检查既有交出草稿占用；变更去向必须显式更新或作废冲突草稿，不静默改已打印、已交出或已接收单据。原单总交出量是各唯一实物范围汇总，不能将洗前与洗后重复算成两份印花产出。

下游实际领用在 recordFactoryMaterialUsage 及必要的直接消费者核对判断资格，不能只在按钮或交出页面限制；水洗不用 legacyAvailableQty 兜底未接收数量。buildFactoryReceiptInboundRecords 等工艺 fallback 明确新增水洗分支，不能默认为染色。

### P3.4 源头与最终去向

水洗单有“当前承接染厂”和“水洗完成后原后续去向”两个明确含义，不能覆盖同一字段造成完成后仍指回染厂。

原最终去向待确定时允许按手感建单，保留 unresolved 状态；染厂派单或后续实际交回各自核对当时所需对象，不能将最终接收主数据缺失提前变成额外建单门槛。

prepareProductionDemandEarlyMatches 成功后，根据原印花关联补充正式生产关系；事务中更新必要引用和去向版本，不新建水洗单。未匹配或匹配失败保留原待匹配位置，已经实际交出的目标不追改。

设计改款保留原结果和文件引用，不复制工程附件字节。采购展示分类沿用其真实底层 STOCK 等映射。

## P4 持久化与迁移边界

### P4.1 共同事实与数据库

优先复用现有 higood-pcs-records IndexedDB 的 records/files/operations/meta 能力，为本专项使用明确命名空间。readPcsRecords、commitPcsRecords 已有版本、文件及事务能力，复用前核实注册与缓存生命周期，不新增第二个跨库事务。

拟登记集合：fcs.fabric-washing.judgments.v1、orders.v1、rolls.v1、actions.v1、links.v1。主单与明细可按实际访问拆成记录，不能将全模块 JSON 换存 records。

| 业务对象 | 当前来源 / 旧项 | 新读写归属与入口 | 共同保存及直接读者 | 验收 |
| --- | --- | --- | --- | --- |
| 被判断的印花批次、卷、数量与要求版本 | 静态演示；higoods.formal-print-execution.v1；部分设计改款已有 PCS 记录 | 只迁本任务读取或修改的印花单及必要子记录；专项仓库按记录读写，静态未改记录只读 | 判断、卷占用、交出、原印花详情与仓储 | CT-02/05/08/10 |
| 判断与水洗单 | 当前没有完整专项模型 | 新集合，建单命令 | 判断、主单、卷占用、链接、动作同事务 | CT-03/08/09 |
| 相关交出头、明细、下游待接收源 | 印花交出记录；PDA 交接旧项；higood-factory-material-receiving-v1 | 将实际参与的新旧记录统一同库；其直接读取入口读同一事实 | 卷交出、交接记录、待接收来源共同提交 | CT-05/06/08 |
| 实收、加工、产出及库存责任 | factory-receiving 的 receipts/allocations/materialUses 等必要范围 | 水洗专项与必要收货记录使用同库，复用既有责任库存计算 | 实收及其回写、加工量、后续领用不能双计 | CT-06/08/09 |
| 工程或用户附件 | 设计改款文件引用；旧印花 JSON 可能含 data URL | 现有 Blob 文件仓库；只迁必要附件和引用，静态资源继续静态引用 | 复制复用引用，删引用不自动删共享文件 | CT-10；PG-02/03 |
| 列宽和筛选等偏好 | 既有 localStorage 偏好 | 少量路由偏好；登记键名、上限和默认值 | 失败回默认，不影响业务事务 | CT-08；PG-03 |

普通生产等来源当前未必由 runDesignRevisionFcsCommand 纳入同库事务；不能直接调用它就声称六来源原子完成。采用专项命令明确参与记录，对触及的原印花、交接和收货入口补受控按记录覆盖读取及旧写入拒绝。

### P4.2 动作原子组

| 动作 | 同事务集合 |
| --- | --- |
| 记录无需水洗 | 判断版本、卷资格、动作事实 |
| 选择手感建单 | 判断、主单、明细、卷占用、来源关系、操作去重 |
| 派厂 / 承接变更 | 单据承接版本、相关有效去向、动作；若已有实物流转则拒绝覆盖 |
| 印花交到染厂 | 实际交出范围、原印花必要汇总、交接记录、染厂待接收来源 |
| 染厂接收 | 实收、位置、卷责任、来源已收回写和去重 |
| 水洗产出 | 加工事实、实际产出卷及来源映射、数量变化、动作 |
| 水洗交出及下游接收 | 各动作分别保存其交出或接收、实物资格、对应库存责任与必要关联 |
| 纠错 / 作废 | 原记录新版本、单据状态、占用释放或替代关系、旧记录保留 |

需要共同成功的记录不能落两个数据库，也不能一份新库一份旧 localStorage。事务完成后才发布内存结果、刷新直接消费者并提示成功；文件读取和计算放事务前。

### P4.3 旧资料切换顺序

1. 开工清点现有旧键、已有 PCS 切片、实际记录版本和附件引用，登记每条目标记录的源指纹；本轮未访问用户浏览器，不能预填实际迁移条数。
2. 停止对应目标记录的旧写入，旧标签提示刷新。保留无关记录的现有写入，不长期双写。
3. 分批转换所需记录、覆盖和删除标记、动作、附件 Blob 和稳定映射；保存进度。共用 JSON 中的无关数据原样保留。
4. 目标读回核对内容、数量、来源、前后关系和文件完整性。不得将旧路线生成现场判断。
5. 仅对已核对且有权处理的旧片段清理；保留共用数据。localStorage 与 IndexedDB 不假定原子，用逐批回执和源指纹恢复。
6. 完成后验证普通读取不再迁移、复制种子、全量扫描或写旧事实；可移除的兼容按消费者清单退出。

空间不足、源缺失、附件不完整或旧写入停不住时停止受影响迁移，保留旧源并报告，不能以清库解决。PCS 不新增维护入口。非 PCS 优先复用适用共用资料保护：容量估算、附件统计、完整备份恢复、无引用清理、明确授权的指定范围重置。没有共用入口时补本专项必要的 FCS 轻量共用能力，不在每页新增或建设长期维护产品；没有完整已验证备份不承诺清空可恢复。

备份和恢复仅拥有本专项及必要 FCS 关联记录，不以共用数据库为由导出或覆盖无关 PCS 资料。格式含业务记录、静态覆盖和删除标记、必要附件字节、来源映射与格式版本；恢复先验结构、版本、引用、重复和冲突，使用记录版本保护原数据，分批大资料但单业务动作原子。无引用清理在事务中复核所有有效引用后删除实体及必要元数据，不误删共享附件。重置另获明确操作授权，本轮不执行。

## P5 页面 路由与打印

建议唯一水洗列表 / 详情地址为 /fcs/craft/dyeing/washing/work-orders 及其 /:id，菜单归染厂管理。拟新增地址仍须接入当前字符串模板路由和事件体系，不迁 React。

生产时效 source.ts 已有 /fcs/craft/washing/work-orders 字符串，本次将其消费者更新到唯一有效地址；不存在有效旧页面时不另造兼容跳转，保留历史单据本身。所有新链接与原引用一次核对，避免两个入口身份。

页面证据编号：

| 编号 | 命名入口与范围 |
| --- | --- |
| PG-01 | 现有印花详情 / 实际产出：批次、卷判断、建单、混合去向、刷新回读 |
| PG-02 | 水洗单直达详情：三手感、来源、派厂、执行、纠错、图片 |
| PG-03 | 染厂水洗列表：标准骨架、真实必要查询、分页、总数和路由偏好 |
| PG-04 | 印花交出、染厂待接收、厂内实物和水洗交回；下游直达读取 |
| PG-05 | 六来源、提前匹配、生产单实际加工关系、履约单据深链 |
| PG-06 | 非 PCS 轻量共用资料保护：容量和附件统计、备份、恢复、错误格式与冲突、无引用清理；PCS 不提供入口 |
| PD-01 | PDA 面料触摸结果与建单；非本厂不可处理、扫码与已有兜底 |
| PD-02 | PDA 原印花交出与染厂逐卷接收、位置和错扫反馈 |
| PD-03 | PDA 水洗加工与交回、下游接收和失败恢复 |
| PR-01 | 水洗加工单预览 / 纸面：手感、面料图、批次卷、单位、责任方 |
| PR-02 | 交接与卷标预览 / 纸面：源卷映射、实际数量、单一接收方；打印不造事实 |
| RL-01 | 正规新地址、六来源直达、原旧引用修正、失效 ID 的可理解结果 |

标准列表新增或结构变化使用现有 renderStandardListPage、renderStandardListTable 和适用分页，声明页面模式并执行同任务范围治理。布局参照染色加工单，不复制其业务字段、配方或专用批量能力。

## P6 契约与 Mock

| 契约 | 业务判定与主要正常 / 边界 |
| --- | --- |
| CT-01 | 路线和初始拆解无水洗；重接前置；新旧版本读取；初始生成反复运行不补水洗 |
| CT-02 | 实际面料完成后才判断；转印前无资格；分批可提前；无自动预测；非面料不受影响 |
| CT-03 | 三手感分别建单、无需判断、缺手感失败、重复 / 并发唯一、一单一批一 SKU 一手感 |
| CT-04 | 六来源各正常与边界；提前匹配成功、待匹配、失败；原来源和最终去向不丢 |
| CT-05 | 混合卷、交出草稿、未判断拦截、需洗分流、按范围冻结、多去向拆单和防重发 |
| CT-06 | 实交、实收、投入、产出、余量和数量变化；错扫、超量、分批、已完成未实收不放行 |
| CT-07 | 各角色、原判断纠正、已派厂协调、已有实物流转后异常、取消二次确认、无自动复洗 |
| CT-08 | 同库原子保存、事务完成才成功、打开失败、满额、中止、读失败、稳定重试、直达回读、偏好异常 |
| CT-09 | 标签版本冲突、卷占用竞争、升级阻塞恢复、旧连接 versionchange、更新后重新读取 |
| CT-10 | 六来源持久边界、断点迁移、映射和文件、共用数据保护、普通读取不迁移、不写旧源、不补触摸；完整备份恢复附件、坏格式与重复冲突不损原数据、无引用清理不误删 |
| CT-11 | 原印花、染色、水溶、TMF 非面料、裁剪和车缝直接相邻回归；打印、时效与实际链接不造事实 |

Mock 至少有六类面料来源，各包含有真实完成产出与无可判断实物的分支；包含三种手感、无需、混合卷、分批完成、不同染厂、已交出冻结、拒单、零产出异常、收发差异、纠错和历史。

每个对象使用对应真实图片，不能重复无关图冒充所有 SKU。样本明确为原型演示。正常例：6 卷中 2 卷无需、4 卷柔软；边界例：3 卷分别柔软、硬挺、无需，另有打印纸未转印，外加失败恢复。

优先复用仓库现有 Node/tsx、Playwright 和局部夹具。先建立最小失败契约再实现，不建设新的测试框架。既有脚本按受影响范围调整，不为消除失败删断言或保留旧错误目标。

## P7 性能与证据

功能入口各自验收，性能家族按相同实现、规模、状态及完成条件判等。初步登记：

| 家族 | 动作 | 完成条件 |
| --- | --- | --- |
| PF-01 | 印花 / 水洗列表详情首次访问、刷新、站内切换，适用时分别采样 | 内容数量状态及必要图片就绪、可交互 |
| PF-02 | 批次卷选择、判断、手感建单 | 局部结果正确；保存包含持久回读 |
| PF-03 | 派厂、接单、拒单、纠错等不同分支分别登记 | 有效状态及责任可读；失败保留输入 |
| PF-04 | 交出扫码、确认与逐卷接收，Web/PDA 按差异拆家族 | 实物范围和库存责任持久回读 |
| PF-05 | 加工产出、完成及下游实际接收 | 数量、来源和资格均可读 |
| PF-06 | 加工单、交接、卷标预览生成 | 完整预览及必要图片可显示 |
| PF-07 | 原来源关联、提前匹配后的详情直达 | 正确单据、目标和数量就绪 |
| PF-08 | 任务必要共用资料保护中的估算、备份、恢复和清理，按不同动作分家族 | 输出完整、恢复可回读、实际实体及引用一致；不以整包无限重写达成 |

实施时固定最重命名数据规模，记录源码与资产、工作树服务、设备视口、时区、缓存和原始时间；每家族至少 5 个有效样本，适用冷 / 热、成功 / 失败分开。任一样本超过 1000ms 为失败，复测追加不覆盖原失败。

本地生产预览使用同工作树；不以另一服务、旧版本或 HTTP 200 证明页面。读写失败、存量或历史证据保留原版本，不能套本次 SHA。

实际实施证据位于 docs/verification-evidence/2026-10-15-post-print-fabric-washing/。矩阵按当前验证结果绑定具体证据，未完成项不得关闭。正式技术收据在任务文件冻结、适用构建与页面验收后生成，输出到工具允许的独立临时目录；收据不替代业务接受。

## P8 阶段关闭

实现开工前：核对矩阵全部来源章节双向覆盖、现有移动入口和实际存储边界，不改本版业务目标。

实施完成时：矩阵所有适用项达到当前证据支持的状态；主代理从需求正向到实现、从代码页面 Mock 测试反向到需求核查全部任务 diff。失败项明确保持未完成。

V1.0 的仅文档阶段已结束。本轮执行产品构建、专项页面与性能验证及适用收据，具体结果按证据记录；技术验证、用户接受和生产发布分别登记。


## 2026-10-15 实施登记（V1.1，本地技术验证完成）

用户已明确授权按四份文档实施全部 205 条原子需求，完成直接上下游、Mock、Web/PDA、打印、持久化和每个有效样本不超过 1000ms 的验证，并执行两轮实质对抗审查。本轮不提交、不推送、不发布。上文 V1.0 的“先不修改代码”保留为当时阶段记录，不作为本轮执行限制。

当前共用保存边界为 `higood-pcs-records` 中的 `fcs.fabric-washing.v1` 与 `fcs.fabric-washing.process-records.v1`，按判断、主单、操作、原加工台账叶记录保存。原生产来源匹配继续由既有生产来源事务拥有，水洗只读取其真实匹配关系；下一笔明确水洗动作可保存来源快照，不增加第二套可写匹配事实。中央仓交回的实收和责任库存从同一水洗卷记录读取；染厂接收和实际领用共同保存必要接收记录。新增直接消费者包括 WLS 原料上架入口中的水洗交回实收区。

技术验证与产品接受分别登记。本轮浏览器、持久化、打印、完整响应和两轮对抗审查已按专项证据关闭；不代表真实工厂执行或用户已接受。


## P9 实际实现与方案收敛（V1.1）

以下为实施后的实际边界，替代 P1 中拟新增文件名及预设的集成方式，业务 R 编号和 205 条原子编号不变。

| 工作包 | 实际文件与符号 | 当前实施结果与验证入口 |
| --- | --- | --- |
| WP-01 | src/data/fcs/fabric-washing-model.ts / applyWashingCommand、washingRollRelease、washingPrintSignature；fabric-washing.ts / buildWashingSources | 专项纯模型及真实来源适配，按卷守卫、角色、实际单位、三手感；无通用状态机。 |
| WP-02 | src/data/fcs/fabric-washing-repository.ts / ensureWashingRecords、runWashingRecordCommand、adoptWashingLedgerRows；fabric-washing-storage-bridge.ts；design-revision-pcs-storage.ts | 两个同库命名空间按叶记录提交；版本、幂等、原附件 Blob、旧指纹、清理失败重试和旧标签变动保护。复用原 pcs-record-db.ts 的事务，增加可限定 wash-file- 前缀的清理入口并继续复核全库引用。 |
| WP-03 | src/data/tech-pack-process-route.ts / removePredeterminedWashing；pcs-technical-data-demo-completion.ts；pcs-technical-data-demo-projection.ts；src/pages/tech-pack/context.ts；src/data/fcs/production-artifact-generation.ts；process-order-task-links.ts | 新路线及初始生成退出固定水洗，重接前序；历史发布快照和已有执行不改写。 |
| WP-04/05 | src/data/fcs/fabric-washing.ts / submitWashingCommand；printing-task-domain.ts / handoverPrintingOutput、markPrintingWashingTransfer；pda-handover-events.ts | 实际产出触摸、按手感建单、混合去向、草稿冲突、按卷原交出守卫及目标冻结。 |
| WP-06 | src/data/fcs/factory-receiving.ts、factory-receiving-types.ts、factory-receiving-warehouse.ts、factory-internal-warehouse.ts、dyeing-warehouse-view.ts；src/pages/process-factory/dyeing/warehouse.ts；fabric-washing.ts | 真实染厂接收、投入、产出、交回及实际库存；新卷码保留 originRollId；水洗身份不套染色或水溶。 |
| WP-07 | src/data/fcs/fabric-washing.ts / registerWashingProjection、washingWarehouseStock；src/pages/production/detail-domain.ts；src/pages/wls/raw/washing-stock.ts | 原生产来源事务继续拥有提前匹配；水洗只联读已提交来源，明确动作和完整备份保存冻结关联；生产实际关系与原料仓直接读取同一事实。 |
| WP-08 | src/pages/process-factory/dyeing/washing/work-orders.ts、storage-tools.ts；printing/work-order-detail.ts；src/pages/pda-exec-detail.ts、pda-handover.ts；src/main.ts；src/router/route-renderers*.ts、routes*.ts；src/data/app-shell-config.ts | 列表、详情、职责操作、PDA、图片、真实 Code128 和独立 A4 打印；复用公共列表组件，不增加共享组件或页面框架。 |
| WP-09 | fabric-washing-model.ts；fabric-washing-maintenance.ts；src/data/fcs/wool-domain/mock-receiving.ts；factory-receiving.ts / fixedDemoRows | 纠错与异常留历史；必要维护限 FCS 两集合及附件。共享接收的固定演示收货改为内存回退，以已保存用户记录优先，避免读取写盘及刷新丢失。 |
| WP-10 | tests/unit/fabric-washing*.test.ts；tests/unit/fcs-design-revision-result-readiness.test.ts；scripts/check-post-print-fabric-washing*.mjs；本目录及专项审查、证据目录 | 单元、真实页面、直接相邻、纸面、逐次性能和两轮主代理对抗审查。每项状态与证据由原子矩阵和专项验收索引关闭。 |

保存对象登记：判断、主单（含本单卷明细）、动作分别归 fcs.fabric-washing.v1；必要原印花、接收、交接等叶记录归 fcs.fabric-washing.process-records.v1，均在 higood-pcs-records。主单、判断、动作和本次必要加工台账同事务，成功后回读再发布；无 localStorage 业务保存后备。静态演示与图片按静态源读取；旧图片只在明确业务切换时转 Blob。

PDA 采用独立水洗入口，沿用原会话与工厂上下文，不向初始自动任务注册表加入 WASH；原通用待接收深链转入水洗逐卷实收。全能力测试工厂的仓库按原主档重定向到工厂交接页，水洗实物区嵌入该真实页面，没有为了样例重排工厂类型分支。

打印直接复用原生打印与现有 Code128 渲染，生成只含所选单据的 A4 文档；无需为两份专项文档扩展通用模板注册表。生成和打印记录不构成实收或交出。原需求变更、匹配后来源和接收方变更均参与重印签名。

维护入口仅限本任务 FCS 必要记录：容量估值、附件统计、完整备份/恢复、无引用附件清理。没有新增 PCS 维护入口，也未执行任何范围重置。恢复复核格式、版本、关系、引用、字节指纹、重复与冲突；备份内二进制编码属于下载格式，不是业务持久化格式。

额外运行旧 check:process-order-task-relations 时，脚本将所有毛织阶段链接断言为已退役的 work-orders 地址，HEAD 67499ec 的实际实现已使用 knitting-orders / linking-orders；继续诊断还发现旧投入产出对象断言未区分横机和缝盘阶段。该脚本及毛织业务均保持原样，失败日志独立保留，不声称通过。水洗直接关系另由本轮混合流转、真实提前匹配、生产关系页面和现有单元回归验证，不扩展为毛织治理任务。

Web 染厂仓库的实物读视图保留可选 washingOrderId，水洗行明确标识、链接专属单据与 PDA 执行；不复用染色领用说明或不可用的通用交出按钮。四个原印花/染厂仓库主入口复用原有准备依赖，再读取同一水洗记录，不创建第二套仓库事实。

PDA 建单成功及已有判断的水洗单链接保留在 PDA 路由，列表/详情复用原有 PDA 执行框架与导航；Web 按需读取页面，不提前加载 PDA 框架。实际 TASKGEN 印花任务在来源恢复后同样进入受保护印花渲染，不仅优化演示前缀。

资料保护验证另含一份由真实旧面料 PNG 迁移得到的 Blob 备份，单独对恢复、导出、同件重试、引用保留清理各取五个完整响应样本，覆盖与“18 单静态图”不同的附件 I/O 分支。恢复和清理成功后立即重新读取当前记录/附件统计。

共享毛织接收回归保留显式批次一次保存及失败回退，并追加“只读固定演示不写盘、缓存刷新可读”的契约；Node 事实检查的轻量 window 无 pagehide，协调脚本仅在该隔离 Node 进程及其子进程停用原生 BroadcastChannel，真实跨标签由 Chromium 验证。旧毛织浏览器测试改为按实际来源总数检查重置/分页，并通过每页50条的既有分页控件定位目标单据，避免把14条演示或默认第一页写死；未改变毛织业务结果断言。

染厂仓库保留既有原生 Tab 外观与内容，表格控制器及其渲染按稳定表身份缓存一次；主库存直接组合标准列表，避免动态 Tab 和缓存对象遮住结构。所有库存和记录表仍使用现有标准列表、分页和列设置，未改共享检查器及历史基线；Web 水洗入口分开表达 PDA 包装与管理列表返回，避免重复构造未使用表格。仓库 Tab 切换和列设置开关按实际受影响分支追加五次响应样本。
