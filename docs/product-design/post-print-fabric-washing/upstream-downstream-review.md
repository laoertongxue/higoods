# 印花后面料水洗直接上下游影响核查

> V1.2 增量修订：[操作栏发起洗水与名称统一](list-entry-and-washing-name-v1.2.md)。本文件保留 V1.1 的规则及证据身份，新增入口和显示名称以修订为准。
版本：V1.1。日期：2026-10-15。V1.0 基线核查对象：本地 67499ec61a1e770c39e5cdf3eddc4d2068eb7f4a。整理前工作树无差异，detached HEAD。

本表回答“当前哪些直接接口和消费者会受方案影响”。结论为代码已确认或基于代码的影响推断，不代表业务页面、存储迁移或工厂现场已验证。以下 I-01～I-30 保留 V1.0 基线事实与当时建议；V1.1 实施和直接相邻复查追加在后文。全程未连接测试站数据库。

依据：[需求](requirements.md)、[计划](implementation-plan.md)、[原子矩阵](atomic-requirements.md)。用户本轮要求重查，故对关键源头与直接读写消费者重新取证；其余同版本已有事实保留，不做无目的重复。

## I1 核查方法与范围

确认 HEAD、工作树和 CodeGraph 状态后，以 context 定位已命名符号；对交出及关系、接收修订使用 impact 查直接消费者。对工具截断或未覆盖的具体范围读取源码。没有通过初始化、迁移、清理或演示写入建立证据。

本轮重点为：实际完成 → 实物卷 → 判断及建单 → 印花分流交出 → 染厂实收及加工 → 原后续接收，以及原技术包和初始拆解的退出关系。普通生产、提前需求、采购、备货、补料、设计改款均列入。

## I2 对象 问题 证据 调整覆盖表

| 编号 | 对象与当前代码事实 | 问题或影响 | 当前证据 | 方案处理 |
| --- | --- | --- | --- | --- |
| I-01 | 印花实际完成会登记生产批次、卷、损耗及要求版本，转印工艺按 TRANSFER 阶段计算最终产出。 | 不能只判断 PRINT_DONE、标签打印或人工结单；批次可先于整单完成。 | [completePrintingWorkOrder:4815](../../../src/data/fcs/printing-task-domain.ts#L4815)、[getPrintingWorkflowFacts:5384](../../../src/data/fcs/printing-task-domain.ts#L5384) | R3；WP-04；按实际批次最终加工及其卷建立资格。 |
| I-02 | 印花展示来源类型为 PRODUCTION、PRODUCTION_DEMAND、PURCHASE、STOCK、SUPPLEMENT、DESIGN_REVISION。 | 只接正式生产会漏其他五来源；展示分类与底层业务类型不完全一一对应。 | [PrintingDemandSourceType:119](../../../src/data/fcs/printing-task-domain.ts#L119) | R2.2；WP-07；六来源分别正常与边界，不强制新造分类。 |
| I-03 | 提前加工匹配仅准备 DYE / PRINT 操作；保存正式关联及待匹配、失败状态。 | 将 WASH 塞进正式初始生成会重复建单或要求一个不存在的静态水洗节点。 | [prepareProductionDemandEarlyMatches:436](../../../src/data/fcs/production-demand-early-process-work-orders.ts#L436) | 保留水洗原物理身份，随原印花补链接；CT-04。 |
| I-04 | 演示将每款面料写入 DYE → PRINT → WASH，裁剪前置为 WASH，洗水同 SKU。 | 只隐藏节点会断裁剪前置；不等于已有现场触摸记录。 | [演示内容:48](../../../src/data/pcs-technical-data-demo-completion.ts#L48)、[路线与裁剪:64](../../../src/data/pcs-technical-data-demo-completion.ts#L64) | WP-03；节点、引用、前置、说明、预览与测试一起处理，保留同 SKU 规则。 |
| I-05 | 路线动态排除集合当前仅为开扣眼、装扣子、烫包。 | 缺少水洗写入限制；不能直接让历史读取报错。 | [动态集合:88](../../../src/data/tech-pack-process-route.ts#L88)、[固定路线校验:401](../../../src/data/tech-pack-process-route.ts#L401) | 新编制及新业务校验拒绝 WASH；历史版本读取隔离。 |
| I-06 | BOM 自动准备工艺支持 PRINT、WATER_SOLUBLE、DYE、EMBROIDERY，没包含 WASH。 | 不能新增“是否水洗”字段再自动生成；还需检查演示 usageProcessCodes 等独立入口。 | [BOM 工艺联动:180](../../../src/pages/tech-pack/bom-process-linkage.ts#L180) | R7；保持现场命令为唯一新增来源；CT-01。 |
| I-07 | 准备节点按冻结路线生成准备产物；带 BOM 的节点使用通用生成，缺少字典仍有 fallback。 | 单靠不增加字典或菜单不能阻止旧固定 WASH 继续产出。 | [准备产物:799](../../../src/data/fcs/production-artifact-generation.ts#L799)、[总生成:889](../../../src/data/fcs/production-artifact-generation.ts#L889) | WP-03；对新业务生成输入与通路显式排除，存量按版本处理。 |
| I-08 | 初始拆解预览的加工单数组读取现有 PRINT / DYE 单据，任务来自初始工艺产物。 | 不能把实际追加水洗算成“本次待生成任务”或重置已拆解结果。 | [预览:19](../../../src/data/fcs/production-task-breakdown.ts#L19)、[已有加工单读取:53](../../../src/data/fcs/production-task-breakdown.ts#L53) | 初始预览不新增水洗；生产单实际加工关系单独展示追加结果。 |
| I-09 | 统一加工单类型为 PRINT / DYE / WATER_SOLUBLE；初始生成注册仅 DYE / PRINT。 | 缺水洗身份；复用 DYE 或 WATER_SOLUBLE 会让状态、配方、接收和统计串型。 | [加工单类型:47](../../../src/data/fcs/process-work-order-domain.ts#L47)、[注册类型:11](../../../src/data/fcs/process-work-order-generation-registry.ts#L11) | 新增独立实际水洗投影和专项命令，不把它加入初始自动生成。 |
| I-10 | 实际关系卡通过 sourceEntryIds、静态前置和已生成单据解析，缺少单据时显示 pending。 | 无静态 entry 的水洗可能不显示；伪造 entry 则重回固定路线并造成错误等待。 | [关系类型:29](../../../src/data/fcs/process-order-task-links.ts#L29)、[buildPendingRouteRelations:878](../../../src/data/fcs/process-order-task-links.ts#L878) | 增加真实单据及卷范围关系，静态 pending 不补水洗；WP-07。 |
| I-11 | 接收方解析优先静态直接下游，否则按来源解析末道目标。 | 新水洗不能覆盖原最终目标；否则水洗完成后仍交回染厂或错误统一到裁床。 | [resolveProcessOrderReceivingTarget:107](../../../src/data/fcs/process-order-receiving-target.ts#L107) | 当前承接染厂与原最终去向分开；按卷限定关系。 |
| I-12 | 末道去向已区分备货中央仓、补料消费者、改款团队、提前加工待匹配位置、生产裁床位置。 | 各来源后续不同；补料和改款缺少既有主数据时本就不能交出。 | [末道解析:27](../../../src/data/fcs/process-order-receiving-target.ts#L27) | R2.2；沿用真实目标，不添加虚拟消费者来凑闭环。 |
| I-13 | 印花交出校验所选整卷之和、固定 SKU、已交出状态；首次交出后整单接收方冻结。 | 同一单一部分水洗、一部分不洗或不同染厂时，会与整单唯一去向冲突。 | [handoverPrintingOutput:4846](../../../src/data/fcs/printing-task-domain.ts#L4846)，尤其 4869～4875 | WP-05；已交出单及其卷冻结，其他卷按有效判断分流；不改原生效单据。 |
| I-14 | 印花交出草稿占用卷；确认时扫齐所有卷并逐行执行 handoverPrintingOutput。 | 仅在新建水洗按钮加门禁可被原交出入口绕过，旧草稿也可能仍指原接收方。 | [草稿和交出检查:4864](../../../src/data/fcs/printing-task-domain.ts#L4864)、[confirmPrintingDispatch:5296](../../../src/data/fcs/printing-task-domain.ts#L5296) | 门禁覆盖命令及直达；冲突草稿显式重做，PG-04/PD-02。 |
| I-15 | 可交产出按完成量－已交出－草稿预留计算，产出卷可在其他入口操作。 | 建水洗单后的占用要参与正常下游资格；不能把占用和已交出再双减。 | [getPrintingWorkflowFacts:5395](../../../src/data/fcs/printing-task-domain.ts#L5395) | 范围唯一索引和版本守卫；洗前后数量不重算成两份原印花产出。 |
| I-16 | 收货源/实收/分配有 printingOrderId、dyeOrderId、waterOrderId；来源 processCode 仅 PRINT；water 对应水溶。 | 水洗若复用 waterOrderId 会混入水溶批次、库存和校验；所有直接消费者需一起适配。 | [接收类型:9](../../../src/data/fcs/factory-receiving-types.ts#L9)、[实收与分配:38](../../../src/data/fcs/factory-receiving-types.ts#L38) | 独立 washing 身份及根来源；WP-06/07，保护既有水溶。 |
| I-17 | 面料交出源要求具体卷码和 Yard；SourceRoll 只有 yard，PrintingQtyUnit 本身为 string。 | “继承原单位”不能在原字段里悄悄把米或 kg 写作 Yard；需最小明确单位适配。 | [SourceRoll:8](../../../src/data/fcs/factory-receiving-types.ts#L8)、[来源校验:87](../../../src/data/fcs/factory-receiving.ts#L87)、[PrintingQtyUnit:123](../../../src/data/fcs/printing-task-domain.ts#L123) | 受影响面料记录保留真实数量单位；有已确认长度换算才换，其他不猜。CT-06。 |
| I-18 | 厂内入库只由实收产生；工艺分类非 print、非 water 时默认落 DYE。 | 新水洗实收不加适配会被显示成染色并可能错误统计；不能用新增表格假装已入库。 | [入库事实:5](../../../src/data/fcs/factory-receiving-warehouse.ts#L5)、[工艺 fallback:10](../../../src/data/fcs/factory-receiving-warehouse.ts#L10) | 实收分类、库存责任、出入库记录及查询同一专项身份；CT-06/11。 |
| I-19 | 收货来源有不可替换身份及已接收明细保护；实收和领用决定可用量。 | 纠错不能覆盖已经发生的来货或通过重新注册来源二次入库。 | [来源注册:82](../../../src/data/fcs/factory-receiving.ts#L82) | 分阶段纠错、稳定原交出 ID，零重复库存；WP-09。 |
| I-20 | PDA 移动工艺绑定与索引显式区分 PRINT、DYE、WATER_SOLUBLE；交接来源联合类型也不含 WASH。 | 只新增 Web 页面，移动端会看不到、归错类或找不到交接来源。 | [工艺绑定:79](../../../src/data/fcs/process-mobile-task-binding.ts#L79)、[移动来源:164](../../../src/data/fcs/mobile-execution-task-index.ts#L164)、[交接来源:431](../../../src/data/fcs/pda-handover-events.ts#L431) | WP-06/08；加入专项绑定和命令，按厂范围保护，旧非面料不受门禁影响。 |
| I-21 | 实际印花 PDA 卡片和完成命令位于 pda-exec-detail.ts，路由渲染器异步加载。 | 把入口仅写到 pda-exec.ts 列表会漏实际详情、事件和加载。 | [PDA 印花命令引入:118](../../../src/pages/pda-exec-detail.ts#L118)、[renderPrintingTaskCard:818](../../../src/pages/pda-exec-detail.ts#L818)、[异步渲染:455](../../../src/router/route-renderers.ts#L455) | F05 绑定列表、详情和 routes-pda，新增水洗也接异步渲染及事件。 |
| I-22 | runPrintProcessMutation 先做内存动作再依次保存交接和印花，失败尝试回退。 | 不能推定满足本次同库同事务要求，尤其新增判断、单据、占用、待接收共同成功。 | [变更包装:882](../../../src/data/fcs/printing-task-domain.ts#L882) | WP-02 先实现专项按记录事务，涉及原记录一并纳入；不能仅套旧包装。 |
| I-23 | saveFormalPrintExecution 捕获整个工作单集合及节点、任务、交接后序列化到旧键；压缩图片仍可能保存 data URL 字节。 | 将水洗字段加进它会扩大整包写入及 Base64 依赖；不能称已完成存储整改。 | [整包保存:749](../../../src/data/fcs/printing-task-domain.ts#L749)、[图片序列化:6](../../../src/data/fcs/printing-execution-storage.ts#L6) | 仅迁实际受影响记录和必要附件、停止对应旧写；不扩大为全站改造。 |
| I-24 | runDesignRevisionFcsCommand 仅 target 归设计改款时用 runPcsRecordCommand；其他来源直接 recipe。 | 仅复用该包装不能保证普通生产、采购备货、提前和补料原子保存。 | [来源条件:3](../../../src/data/fcs/design-revision-pcs-command.ts#L3)、[存储桥:140](../../../src/data/fcs/design-revision-pcs-storage.ts#L140) | 六来源均按专项明确参与记录；沿用已有设计改款归属不双写。 |
| I-25 | 现有记录库为 higood-pcs-records，含 records/files/operations/meta，事务等待 complete，具备版本及操作标识。 | 有可复用的同库原语；缓存、集合注册、文件引用和源旧项仍需适配，不是直接可用声明。 | [记录类型与库:1](../../../src/data/pcs-record-db.ts#L1)、[事务:59](../../../src/data/pcs-record-db.ts#L59)、[命令:659](../../../src/data/pcs-record-runtime.ts#L659) | WP-02；小专项仓库复用，不新建跨库同步框架。 |
| I-26 | 共用接收 revision 被厂内仓库及毛织读取直接消费。 | 共享收货变更需保持修订与缓存语义，避免重复投影或误清毛织缓存。 | CodeGraph impact(getFactoryReceivingRevision, depth=1)；[revision:15](../../../src/data/fcs/factory-receiving.ts#L15) | 有公共实现改动时加直接投影回归；不无依据重测毛织全流程。 |
| I-27 | 打印模板注册和 sourceType 显式声明印花/染色等文档，水洗暂无完整专属模板。 | 不能仅换标题使用染色配方单；打印不成为加工或接收动作。 | [模板注册:147](../../../src/data/fcs/print-template-registry.ts#L147) | PR-01/02，独立水洗文档类型、手感及源卷；继承图与打印框架。 |
| I-28 | 时效文档水洗链接指向 /fcs/craft/washing/work-orders，路由当前染厂页在 /fcs/craft/dyeing。 | 只新增新地址会保留失效消费者；时效 Mock 不能冒充新水洗实际记录。 | [时效链接:77](../../../src/data/production-timing/source.ts#L77)、[染厂路由:403](../../../src/router/routes-fcs.ts#L403) | 更新直接消费者到唯一地址，保留时效静态场景身份，实际记录按真实关联；不套 3 天。 |
| I-29 | 历史需求记录明确当时 3 款面料固定链及同 SKU。 | 不应以“旧资料”之名删除当时证据，或把本次方案标成已交付。 | [历史范围:7](../../reviews/2026-10-06-tech-pack-completion/requirements.md#L7) | R11；替代固定安排，保留历史原版本与已发生事实。 |
| I-30 | recordFactoryMaterialUsage 按收货和分配计算可用实物，但有 legacyAvailableQty 兜底，身份仅印花/染色/水溶。 | 若只在交出按钮设门禁，直接领用仍可能绕过判断；旧兜底也不能用于水洗虚增实收。 | [实际领用:236](../../../src/data/fcs/factory-receiving.ts#L236) | R5.2/R6.1；WP-05/06，在实际领用及必要下游调用核对资格和水洗身份。 |

I-29 的历史链接相对位置为 docs/reviews/2026-10-06-tech-pack-completion/requirements.md；其身份是此前样本需求，不能覆盖本轮现场触摸要求。

## I3 必须纳入的直接消费者

| 事实源 | 直接写入 / 读取 | 必须共同调整 | 保持的边界 |
| --- | --- | --- | --- |
| 原印花批次及卷 | completePrintingWorkOrder、数量和条码维护、判断、交出、PDA 详情 | 资格、版本守卫、占用、旧写入拒绝 | 不把尚未完成或改版实物套用原判断 |
| 实际流转范围 | 交出草稿、confirmPrintingDispatch、handoverPrintingOutput、目标解析 | 所选卷去向、草稿冲突、范围冻结及单一实际接收方 | 不用整单接收方覆盖不同卷 |
| 新水洗记录 | 判断、建单、派厂、接单、加工、取消、打印、直达详情 | 同一持久源和独立身份 | 不登记配方，不加入初始拆解 |
| 接收事实 | 来源注册、实收、领用、厂内仓库、下游可用量 | washing 身份、单位、原来源和防重、缓存修订 | 不以交出或完成自动造实收 |
| 原业务来源 | 提前匹配、采购备货、补料、改款、生产详情 | 真实根来源与最终去向 | 不虚造生产单、不重建水洗 |
| 技术路线 | 编制、BOM、预览、发布选版、初始生成 | 新静态水洗退出及前置重接 | 保留历史冻结快照与原证据 |
| 单据与时效 | 模板、预览、卷标、源详情链接、历时展示 | 正确手感、图片、来源、唯一地址及重印提示 | 不把 Mock、打印、时间规则当现场结果 |

## I4 以场景检查方案

### 正常场景

原印花 6 卷，2 卷无需、4 卷柔软。初始计划不含水洗，实际完成后现场登记；4 卷形成一张单，计划派染厂。原印花不同去向分开交出；染厂真实接收后加工，洗后按原源去向交回。原印花产出合计仍为 6 卷，不因水洗再增加一份。方案覆盖了 I-01、02、07、08、10～19、22～25。

### 边界场景

纸张已打印但未转印：无判断资格。同批三卷分别柔软、硬挺、无需：两水洗单和原后续去向并存；旧交出草稿需显式更正。首次已交出的一卷去向保持，其他卷不被整单冻结误锁。保存失败不留半单。方案覆盖 I-01、13～16、20～25。

### 来源及历史场景

提前加工尚无生产单可创建水洗，匹配后只有关联补齐；补料回原需求方，改款回原团队，采购备货回原仓。旧已交付记录保持可读，无需补造触摸。方案覆盖 I-02、03、11、12、24、28、29。

以上是基于源码对方案的语义演练，没有声称已在页面运行或已写入持久数据。未来契约、页面及性能证据按矩阵逐项补齐。

## I5 核查结论与后续证据

方案可以在现有原型体系内局部实施，但不能只新增一个水洗表单。必须同时处理：实际产出资格、初始生成退出、按卷接收方、源头与最终去向、共用接收与库存投影、六来源同库原子保存、各端和单据深链。

代码核查没有发现需要突破只读数据库或新增真实后端的理由。已发现的本次必要改造均列入计划；未检查的无关模块不以本表宣称通过。

开工前回填真实存量记录和文件边界、准确账号映射及命名验收数据量；这些是实施输入，不重新开放六项已采纳决策。真实现场试用与产品 accepted 保留给有权用户确认。

V1.0 阶段只新增四份文档。本轮已按后续授权实施，未提交、推送或部署；当前结果以 V1.1 矩阵和专项验收记录为准。

## I6 V1.0 文档阶段核对

V1.0 矩阵共 205 条，编号连续且唯一，当时全部待实施；覆盖需求 R1～R13、计划 WP-01～WP-10。影响表共 30 项。文档核对包括本地链接和源码行号有效性、文件组引用、表格字段、章节与工作包覆盖、差异空白和仅四份新文档的修改范围。

这些检查证明方案文件的一致性，不证明产品实现、迁移、页面、性能或现场执行已经通过。


## 2026-10-15 实施登记（V1.1，本地技术验证完成）

用户已明确授权按四份文档实施全部 205 条原子需求，完成直接上下游、Mock、Web/PDA、打印、持久化和每个有效样本不超过 1000ms 的验证，并执行两轮实质对抗审查。本轮不提交、不推送、不发布。上文 V1.0 的“先不修改代码”保留为当时阶段记录，不作为本轮执行限制。

当前共用保存边界为 `higood-pcs-records` 中的 `fcs.fabric-washing.v1` 与 `fcs.fabric-washing.process-records.v1`，按判断、主单、操作、原加工台账叶记录保存。原生产来源匹配继续由既有生产来源事务拥有，水洗只读取其真实匹配关系；下一笔明确水洗动作可保存来源快照，不增加第二套可写匹配事实。中央仓交回的实收和责任库存从同一水洗卷记录读取；染厂接收和实际领用共同保存必要接收记录。新增直接消费者包括 WLS 原料上架入口中的水洗交回实收区。

技术验证与产品接受分别登记。本轮浏览器、持久化、打印、完整响应和两轮对抗审查已按专项证据关闭；不代表真实工厂执行或用户已接受。


## I7 实施后的直接上下游复查（V1.1）

表中“代码及契约已验证”仅表示本地原型技术结果；页面、打印、性能和交付状态仍由矩阵及专项审查记录按当前版本关闭，不代表工厂现场实际触摸或执行。

| 对应项 | 实际处理与复查结果 | 证据入口 |
| --- | --- | --- |
| I-01 | 实际完成按最终 PRINT/TRANSFER 批次及真实卷判断；纸张完成不构成面料完成。 | CT-02/03；六来源 DONE/PAPER；Web/PDA 印花详情。 |
| I-02 | 六类展示来源和真实 rootSource 同时保留，18 张手感组合单及无需/未判断均按同一整卷规则。 | CT-02/03/04；18 单真实持久备份夹具。 |
| I-03 | 提前匹配仍由既有来源事务保存；水洗联读已提交匹配，原单不复制，失败保留事实；备份冻结已提交关联。 | 边界 CT-11；匹配前后单数=1、刷新、隔离恢复、匹配后重印签名。 |
| I-04 | 当前演示改为 DYE → PRINT，裁剪前序重接，不补造判断或水洗单。 | technical-pack-demo-completion、route-codec 单元。 |
| I-05 | 新路线作者候选移除 WASH，业务校验拒绝静态水洗，历史读取保持。 | validateProcessRouteGraph；route-codec 单元。 |
| I-06 | BOM 工艺引用、名称、说明同步退出固定水洗，不新增预测字段。 | 演示完成及投影差异；技术包单元。 |
| I-07 | 新生成路线输入显式 removePredeterminedWashing；未增自动水洗注册。 | generateProductionArtifactsForOrder；边界 CT-01/05。 |
| I-08 | 初始拆解不产生占位或缺失水洗等待，原裁剪车缝身份不重建。 | 边界 CT-01/05 对原任务完整快照比较。 |
| I-09 | 专项水洗模型、命名空间、单号和命令独立于染色/水溶；PDA 独立执行入口。 | 模型单元、14 项浏览器契约、PDA 生命周期。 |
| I-10 | 生产单详情另列“印花后实际追加水洗”，按真实单号打开，不伪造路线 entry。 | PG-05；Web 实际关系跳转及持久读回。 |
| I-11 | 当前承接染厂与最终去向分开，已交出卷冻结，其他卷保留合法分流。 | 模型 HANDOUT、原正常交出 + 水洗混合 100 Yard 实发契约。 |
| I-12 | 正式、提前、采购备货、补料、改款分别保留源头及末道目标，未补造生产单。 | 六来源 CT-04；早期匹配和原仓实收。 |
| I-13 | 原印花正常交出只放行无需水洗卷；需要水洗卷由专项 SEND 交给已接单染厂。 | CT-05；原交出守卫、卷级冻结。 |
| I-14 | 冲突草稿占用阻断 SEND；需显式解除，旧草稿不能绕过按卷判断。 | 边界 CT-01/05 真实草稿与实际交出。 |
| I-15 | Web 与 PDA 使用相同来源、命令及稳定操作标识，扫码错误/重复有明确反馈。 | PG-01、PD-01～03；逐次性能与本机 IndexedDB 回读。 |
| I-16 | 原通用接收深链进入水洗逐卷实收，真实单位不被默认转成 Yard。 | PG-04 深链及 kg/米/Yard 契约。 |
| I-17 | TO_WASH 与 AFTER_WASH、originPrintOrderId 与 originRollId 保持；库存从实际接收/领用计算。 | CT-05/06；新卷码分配和实领 50，51 被阻断。 |
| I-18 | 染厂库内及 PDA 仓库读取独立水洗类型，原 WLS 原料上架增加水洗交回实收区。 | PD-02/03 仓库直达；PG-04/05 WLS 查询后仍保留水洗区。 |
| I-19 | 来源和实际接收身份沿用不可替换保护；稳定操作标识去重，已发生实物纠错不覆盖原收货或重复入库。 | CT-05/06/07；重复接收、异常冻结、本人纠正和原子失败重试。 |
| I-20 | 采用独立水洗 PDA 路由及本厂命令，不将其塞入初始通用 PRINT/DYE/WATER_SOLUBLE 自动绑定；通用来货扫码转入专属逐卷实收。 | PD-01～03、PG-04；本厂范围、仓库直达与染厂完整执行。 |
| I-21 | 判断面板进入 pda-exec-detail.ts 的真实印花卡片，主入口和异步渲染先读同份持久资料；纸张完成不出现可用实物。 | PD-01、PG-01；Web/PDA 首次打开、刷新和实际建单，DONE/PAPER 对照。 |
| I-22 | 不依赖旧顺序双写包装；判断、单据、卷占用、必要印花/接收/交接台账在同库事务共同提交，之后才发布成功。 | CT-08/09/10；中止、空间不足、稳定标识重试、双标签及持久回读。 |
| I-23 | 本动作必要旧印花、交接、接收叶记录显式切换；图片转 Blob，其他旧记录保留。 | CT-08/10 旧真实图片、选择性清理及隔离恢复。 |
| I-24 | 普通生产、备货、采购、提前、补料和改款统一经过专项事务；原改款包装感知已归属记录。 | 六来源 18 单、同库失败中止、两标签占用竞争。 |
| I-25 | 复用 records/files/operations/meta，等待 complete 再回读；无 localStorage 业务后备。 | CT-08/09/10；空间失败重试、版本升级阻塞和 versionchange。 |
| I-26 | 共用接收的静态演示事实保持内存回退，用户持久记录优先，刷新不丢失且不整包写回。 | 印花保存后刷新、PDA 仓库直达、毛织相关既有单元。 |
| I-27 | 独立 A4 加工单、交接卷标含手感、来源、实测单位和真图；真实 Code128，不产生收发。 | PR-01/02 浏览器打印捕获、A4 PDF 及纸面图。 |
| I-28 | 唯一 Web 详情路径和独立 PDA 视图；历史编码斜杠继续由原时效来源解析，保留原身份/数量/时间。 | RL-01 历史 1,500 米与原日期；无效 ID 反馈。 |
| I-29 | 历史需求/证据未删改，原生产冻结快照未被读取侧写回；本版只替代新业务固定安排。 | 当前完整 diff、技术包与历史时效单元/浏览器。 |
| I-30 | 实际领用保留洗后接收的原卷身份，未接收或超实际库存不能靠 legacyAvailableQty 补足。 | CT-05/06：legacyAvailableQty=9999 仍拒绝领用 51，仅真实 50 可领。 |

新增必要消费者为 src/main.ts 的真实快捷渲染入口，以及全能力工厂重定向后的 PDA 工厂交接页。只改路由包装不足以覆盖实际入口，现已在主入口先完成原有 PCS/FCS 读取，并在专项记录变化后刷新共用缓存；共用库存不另存第二套水洗副本。
