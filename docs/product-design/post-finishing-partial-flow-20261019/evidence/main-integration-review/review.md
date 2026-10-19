# main 三仓辅料与本期后道分项流程交叉审查

阶段：合并前独立只读语义审查，2026-10-20。main依据eb1b8c92，本期依据当前工作树（原HEAD4a0ce9ef，加本期未提交变更）。未运行浏览器/构建，未修改产品或测试源码。以下“代码确认”不冒充整合后的动态通过；主代理负责整合和验收。

## 范围与新有效事实源

只核读main新增F辅料读取桥/写入guard/迁移guard、WLS后道辅料适配与必要main/PDA入口，再对照本期R候选恢复、显式旧源迁移、storage-notice和旧role8的交叉路径；未遍历无关三仓全模块。

main新增桥使已接管生产单的调拨/库存/齐套来自Accessory记录，不复制回PCS flow材料事实；旧F材料接收对managed单拒绝。新有效入口为Web `/fcs/craft/post-finishing/material-transfers` 或实际后道单号PDA `/fcs/pda/handover?tab=pickup&materialOrderNo=<正式单号>`，先prepareAccessoryPostFinishing。新实收须逐行核对应收量和DLN库位，整单原子提交；不等于本期成衣分项的“分批复检”。两类对象和角色不得混同。

## 代码确认的交叉冲突

1. **空材料旧包也受全局桥前置阻断。** main F注册的旧flow normalizer在浏览器无accessoryPostBridge时直接throw；本期普通work-orders旧资料按钮直接调用R/migratePostFinishingLegacyData，R在临时restore(staged)后逐个执行normalizer。该普通入口尚无prepareAccessoryPostFinishing，所以M1/M3/M5当前正常旧包即使material数组为空也会进入新阻断。应在真实整合版本验证空材料H/N迁移仍能从正式后道入口完成，不为过测试删guard或靠测试私下先访问辅料页。

2. **同一旧包内非辅料事实存在迁移闭环缺口。** main normalizer只要managedLegacyMaterialState内有材料行就始终throw；新migrateLegacyAccessoryPost归档成功后明确保留LS/PCS原资料只读，而未移除同包材料行。因而“先辅料归档后继续后道转换”仍会被retired.length阻断。本期既有H/N/复检/附件的显式迁移必须有真实可完成入口，同时受管材料不可再成为第二可写源，不能把业务加工资料也永久锁在整包旧源。需要主代理整合这一交叉场景，而非把原正常迁移用例改成应拒绝。

3. **备份恢复与桥基线需要直接集成控制。** 本期R/import备份只调用recordValidators，未执行normalizer，也未调用persist；main新增材料保护仅在persist和legacy normalizer。须实际验证“已安装桥后，导入含受管旧材料的合法旧备份”不会绕过退休边界、使第二材料事实落PCS，或因baseline与恢复状态不同而阻断后续无关加工登记。此为明确入口差异与风险，当前未做浏览器动态结论。

4. **故障提示和恢复按钮不能互相替代。** 本期普通后道入口PCSblocked使用data-post-finishing-entry-storage-failure/data-pcs-storage-retry；后道R旧源/保存使用data-post-finishing-storage-notice；新辅料页有独立prepare及局部输入错误。必须在整合后的实际入口验证错误真实、原源保留、关闭旧连接/重试可恢复，不能用一类banner的通过推导另一类入口已通过。

## 旧验收的保留与改写

| 旧覆盖 | 继续有效的业务结果 | 新有效辅料分支需如何验证 |
|---|---|---|
| role1后道执行、role3回货SKU、role6已交出成衣、role7返回、role8自助回货 | 保留本期现有职责/数量/扫码覆盖 | 不把DLN辅料仓管权限扩大为成衣仓实收权限 |
| role2回货/自助回货/辅料三个待接收入口、布局 | 保留导航和工厂权限边界 | 辅料入口必须能到当前managed资料；不能依靠五张固定旧单代表新流转 |
| role4操作工无数量输入、按DB-PF旧单整单入库 | 仅能作为明确非managed旧演示分支回归 | managed正式单逐行数量+上架库位；ROLE_OPERATOR只读，ROLE_ADMIN/HANDOVER/DISPATCH可提交；错工厂拒绝 |
| role5旧001覆盖与补齐五张静态调拨 | 不能作为managed新源验收 | 新有效Accessory入库/库存/齐套一致，PCS不生成新材料副本；旧历史只读、首次不落种子 |
| 本期full-flow/cross辅料receive API | 非managed旧表示可按其有效范围保留 | managed必须走Accessory公开正式命令；旧receive拒绝且两库不变，不能mock桥为合法新动作 |
| 本期M1–M5旧源/备份恢复 | H/N、旧0行/未知关联、附件、中断续跑仍有效 | 追加同包受管辅料与非辅料事实的集成控制，不能仅替换为新全备份测试 |

## 必须补齐的最小集成控制

- 无材料旧flow：直接后道入口显式迁移，H/N和复检/附件不丢，旧数据按本期既定读回成功后处理；未要求预先访问某辅料页。
- 同包旧flow包含managed材料与本期加工/复检：辅料先归档核验，保留其原源；再完成加工记录迁移与H/N承接；刷新及下游直达两边一致，无第二材料可写源、不重复库存。
- 新managed辅料实收成功/失败/重试，以及后续逐项加工/交复检成功/失败/重试，互相不改对方事实；各自transaction complete才发布。原材料API对managed拒绝，两边持久记录不变。
- 后道R合法备份与错误备份的导入、含旧材料备份的恢复：已有Accessory库存/调拨/附件/归档保持不变，后续本期加工仍可保存；完整Accessory备份继续按其新有效入口验证，不把namespace后道备份冒称覆盖新辅料全部事实。
- main新增PDA正式单：操作工只读、后道仓管相关角色可提交、其他工厂拒绝；成衣仓实收保持本期独立角色校验。需实际路由，不仅单独mount导出模板。
- 后道入口blocked恢复与辅料准备失败恢复分别验证，重试后恢复到原身份/正式单对象，不写种子，不清原资料。

main已有accessory-post-finishing浏览器契约涵盖新源自身的投影、角色、事务中止、图片、旧材料归档/保留与旧API拒绝，可保留其已有效覆盖；这些不包含本期新增processCompletions/H+N/多Rc恢复交叉链，不能替代上述控制。

PFN-048独立平台结果公开命令脚本已准备，待main整合完成后运行一次并绑定整合代码SHA。预期最初500/300/200/100的工序和为1100但平台F=100，最终三子单100/100/800累计复检1000、平台F1000。当前此项仍待运行，不预填通过。
