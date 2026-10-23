# 染色 / 印花现行源码审查（实施前）

目标版本：`caa7b286bde449c12f226c7434072b1fe8f7221c`及本任务恢复后的变化。承接完整PDA拆分矩阵C03/C04/C06，不缩减其他工序。前两节为源码审查；后文单列已实施范围和实际证据，不冒称完整染印功能或现场验收。

## 染色已确认的直接事实

| 对象 | 已确认现状 | 新PDA必须遵循 | 证据 |
|---|---|---|---|
| 实际Web详情 | 展示数量事实、来料入口、染缸执行、交出/独立收货；旧URL动作仍会在部分来源渲染时执行 | 新页面不能复制Web渲染函数，也不通过查询参数模拟写入 | work-order-detail.ts的renderCraftDyeingWorkOrderDetailPage、applyWebActionFromUrl |
| 来料接收 | 标量qty/receiptId入口已停用；缺FactoryReceiptInput即拒绝；接收工厂和每条dyeOrderId须匹配 | 使用本厂待接收实际原卷、实收和物位输入，调用同一prepareFactoryReceipt/savePreparedFactoryReceipt；不能套用C08自动库位/单数量表单 | dyeing-material-receipts.ts的receiveDyeMaterial |
| 来源范围 | 按工厂、任务、rawMaterialSku/materialId、BOM身份和已收上游记录限定备料来源 | 扫码只在真实可接来源定位；没有明确来源不能凭空建立来料 | getDyeMaterialReceiptOptions → getPreparationMaterialReceiptSources |
| 数量事实 | 以实际接收、领用、已归档/当前染色批次、包装完成和未作废交出逐笔求和 | 剩余投入=接收减已用；可交=包装完成减已交；不以计划或整单状态代替实际库存 | dyeing-quantity-facts.ts的getDyeingQuantityFacts |
| 单位 | 交出与对方实收先按订单单位显式换算；无法换算即阻断。领用还可使用接收行明确的businessQty/businessUnit比例 | 米/Yard/kg及纱线重量分支不能混加，不能把未知单位当0；按当前换算与实际称量显示 | getDyeingQuantityFacts、convertReceiptQuantity |
| 本批加工投入 | startDyeing校验缸号、实际剩余；当前批次未包装完成不能重复开始；下一批开始时归档前一批执行节点 | 员工只录本批投入和实际染缸，数量受同一原料余量约束；保留当前批与已归档批，不覆盖上一批 | startDyeing、validateDyeStartPrerequisite |
| 扣料与完染 | 开染记录领用；完成时不能修改已扣库的本批投入；染缸编号不可缺失 | 完成页面沿用已锁定投入，只填写当前动作确需的产出；不能第二次扣料 | completeDyeing、recordFactoryMaterialUsage |
| 水溶接续 | 未完成水溶或处于暂停时拒绝开染，水溶产出约束本批可投入 | C06与染色连贯；恢复不代表自动加工完成或自动交出 | validateDyeStartPrerequisite、executeDyeWaterSolublePdaAction |
| 接单边界 | acceptanceStatus是领域历史事实；startDyeing同时更新任务的已接受/执行中事实 | PDA不新增接受任务、竞价或商业开工按钮；必要的染缸加工动作仍按实际领域前置执行 | ensureDyeAcceptanceFact、startDyeing |
| 操作人 | 现有Web部分按钮取旧PDA会话；节点operatorUserId有旧默认USR-DYE，而operatorName可显式传入 | 新中央端不能借用三方会话；逐命令核查操作人和实际交接责任，禁止默认为另一工厂/员工 | handleDyeWorkOrderReceiptDetailEvent、startDyeing |
| 输出实物与交出 | 当前领域已有outputRolls、dispatchDocuments、逐卷扫码/交出和运输信息接口 | 下一步必须读其实际规则及页面，不用“填交出总量”替代原卷、重新分卷、合单或纱线包装分支 | saveDyeOutputRolls、scanDyeDispatchRoll、createDyeDispatchDocument、finishDyeDispatchDocument |

## 继续核查后才能实施的项目

1. 本厂待接收的FactoryReceiptInput、逐卷/实重/库位、准备和保存原子边界，以及上下游直接冷入口。
2. 普通面料、纱线、辅料/花边与连续水溶的实际工厂归属；不得按名称猜中央/三方。
3. 当前各对象真实适用的染色、脱水、烘干、定型、打卷、包装节点与可用动作；不把枚举全部铺到每单，也不转成管理节点上报。
4. 原卷/重分卷、产出包装、下游伙伴、合单交出、运输必填、交出取消/作废、独立实收和分批余量。
5. 当前命令的既有PCS设计变更、洗水、普通染色/印花归属。不能把普通命令的内存成功当持久成功；也不能让两个仓库共同写同一事实。
6. 印尼语的业务名称、数量/重量/长度单位、扫码/错误恢复、小屏主按钮、换人及返回续填。
7. 印花明细、实际转印/直喷等分支尚待逐一审查；不从染色或C08推断印花字段与校验。

验收仍按完整矩阵：对应正常、边界/恢复、Web/PDA同一事实、独立实收、必要图片及每家族五次性能。未完成项不预填已验证。

## C03 接入阶段边界

先落实际染色事实与接收模型：工厂归属按factory master的CENTRAL判定；来货按本厂有效来源、加工单、物料SKU和未收原卷定位。页面使用FactoryReceiptInput，一次提交一条实际来源及其选定实物，不新增送货单、审批、接单、竞价或商业开工。面料为原卷码与实际Yard；纱线为实际毛重/筒数/管型去皮；普通辅料按重量并在必要时保留原单业务数量，连续辅料按米。实收由当前领域prepare校验和save保存，保留对方交出责任与当前接收人。

共同命令仍使用既有PCS数据库；优先沿用已有设计变更/洗水归属，普通染色通过同一记录事务及共同账缓存边界保存。此阶段先验证实际源、分批和失败恢复后接UI，不把单一标量替代原卷/称量。后续出卷、打印、扫码、司机/车型/车牌和逐卷交出均是当前代码要求，不因PDA简化而省掉；纱线独立交出分支仍需另读现行页面。

## 接收命令与页面接入进展

- `central-execution-record-bridge.ts`将既有两组工艺集合的只读共同账入口独立出来，普通染色Web冷入口先读取同一IndexedDB事实，避免为了接收明细加载特殊工艺页面。集合身份未变，未创建第二数据源，读取不写种子。原子命令仍由`special-craft-records.ts`负责；命令自身记录确切target，以便普通染色首笔接收后相邻Web动作沿同一写入归属。
- `central-dye-receipt-contract-web-confirmed.log`：真实浏览器隔离存储，DWO-001先收12.5 Yard，再收另一卷12.5 Yard；现有换算得到11.43m与22.86m。重复确认未增量、重复卷拒绝、账号错配拒绝、外厂库位拒绝；模拟QuotaExceededError不改变已保存接收或缓存，恢复后可重试。实际Web详情`data-dye-receipt-region`加载后回读同一两笔FRP接收和22.86m。两笔实际单位均Yard，操作人ID-F003_admin。最初脚本错误使用库位对象扁平属性，已按真实warehouse/location层级修正；最初等待内部ID文本超时，不当作业务失败或通过。
- 新染色接收页位于`/fcs/pda/central/dye/receive`，独立接收表单按当前来源的面料原卷、纱线称重/管型、连续辅料米数、普通辅料称重及必要业务数量分支。接收没有加工/交出模式按钮，不省略染色实际库位。执行页随后已接入本批染色与脱水、烘干、定型、打卷、包装的实际动作，逐批保留投入、产出、余量和人员；交出闭环尚未实现。仓储目前仅接入接收物位/收发事实，待交出卷等分支尚待完成。
- `session.ts`统一新中央页面的账号、语言和退出偏好；字段与草稿仍只在页面内存，按工厂/员工/加工单/来源行/原卷隔离。退出清理所有已加载工序的草稿，取消退出保留填写。语言转换只改变合法数字的小数符号，不对混合分隔符、指数或无效值作截断转换。
- `central-page-contract-shared-session.log`重新执行C08真实页面回归，通过原子失败恢复、返回续填、切语言、退出换人、6/4/3再交1、两名交出人独立责任及Web同事实回读。

仍未完成：染色加工批次与全部适用节点、真实节点操作人、产出卷/标签打印、合单/逐卷扫描/运输信息及纱线独立交出、完整仓储与所有下游冷入口、印花各分支、完整迁移和每家族性能。当前阶段不发布，不改变V34参考资产，不关闭完整目标。

### 执行批次接入前置

染色接收不等于满足投缸前置。DWO-001在真实原卷接收后仍处于WAIT_SAMPLE，必须保留实际样衣到位、打样完成等现行事实。专项批次契约准备阶段通过既有Web领域命令分别确认样衣到位、完成打样和排缸，再检验新的PDA加工动作；该准备不证明这些前置已在新PDA页面实现，也不能自动替员工办理。

`executeDyePdaProcessing`在现行领域函数上增加具名操作者和预期状态/批次校验；不复制原有数量公式。开始与完成分别保留startedBy/finishedBy人员，当前节点operator与实际本次操作人一致，换人完成不抹去开始人的责任。既有调用者不受影响，新增字段为可选。加工适配尚须经过领域、真实页面、冷入口和失败恢复验证后才能标为已验证。

### 本轮独立运行证据

- `central-dye-page-contract-busy.log`：320×640、Asia/Jakarta，DWO-001/002交替填写互不串单；选库位后切印尼语，12.5改显示12,5且值与物位不变；扫错不丢填写，返回续填不换原卷；配额失败保留输入，恢复可保存；已收原卷重扫不自动切换下一卷；换人登录无上一人草稿。原生接收12.5 Yard，订单换算11.43m。
- `central-dye-processing-contract-ready-sample.log`：通过既有命令准备真实样衣/打样/排缸事实后，六个加工步骤逐一执行。第一批投入10m、包装8m，第二批再投入2m后累计投入12m、可投入10.86m、历史批次1；重复确认不重复扣料，旧批次提交被拒绝。开始人ID-F003_admin与完成人ID-F003_operator分别保留，持久回读数量不变。
- `central-dye-processing-page-contract.log`：实际小屏执行六步骤、实收查看往返、下一批续作与印尼语；输入367–425px，主按钮572–628px，无横向溢出。模拟写失败不推进状态且保留8m填写；模拟提交后回读失败，重新读取退役已保存的原确认，不留下隐藏空草稿，不重复办理上一节点。
- `central-dye-entry-preparation-unit.log`：21项直接入口/新中央/数量文案契约通过。完整构建初次1358项中1356通过、2个旧入口mock未支持新增只读准备接口；原日志`central-dye-receive-processing-build.log`保留。已为准确的新模块边界增加stub及读取顺序断言，保留原PMS延迟、PCS/FCS顺序、实际错误和重读断言；修后完整构建仍须以真实退出值为准。

新增或直接变化位置：`central-execution-record-bridge.ts`、`special-craft-records.ts`、`main.ts`、`dyeing-task-domain.ts`、`central-pda/{session,entry,dye-model,dye-page,dye-ui,frame,page}.ts`、`routes-central-pda.ts`、`craft-entry-initialization.test.ts`、`central-pda-dye-input.test.ts`。旧三方/中央C08范围仍按完整矩阵继承，不以本轮局部通过替代整体交付。

### physical-stage收尾与下一组范围

最终运行版本以`central-dye-stage-physical-build.log`、`source-hashes-dye-physical-stage.json`及完整矩阵的最后补充为准，早期labels版本仍保留原身份。已追加原卷自己的库位恢复、当前语言的输入校验、延迟加载返回取消和可见页面事件归属；在原生业务记录中验证恢复后仍由原工厂/原人接收。当前染色7家族性能35样本最大442ms。

下一组逐项接通现行outputRolls与打印、dispatchDocuments合单/逐卷扫码与运输、纱线称量交出、下游正向实收、全部实收后的人工完成单据。染色原有设计变更/洗水归属、纱线/辅料/连续长度/部位片的实际来源及零接收分支还需单独回放；本轮普通面料通过不替代它们。尚不开始把染色字段套用到印花或其他工序。
