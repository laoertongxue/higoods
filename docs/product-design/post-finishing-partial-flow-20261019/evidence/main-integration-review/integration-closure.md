# main整合集成旁路关闭记录

2026-10-20。本代理负责的新增4个唯一浏览器集成用例均有效通过，原main纯材料退出边界单节点通过，另PFN-048平台数量和两项Node等价检查已分别保存实际结果。当前本代理的浏览器及上下文全部关闭，已向主代理释放窗口。这里是本旁路关闭，不代表整项发布、最终性能或用户业务接受；主代理继续最终构建、full/cross、性能和收据。

## 实际版本、来源与执行

main祖先为eb1b8c92，实际整合工作树以integration-closure-manifest.json逐文件SHA256为准，不能仅以HEAD代表未提交完整任务。dev43197由主代理干净重启，最终有效运行使用v3/session33831；有效用例分几个明确日志运行，未重复计例。此前服务修复/测试夹具校准各有独立身份。

加工事实由公开registerPostFinishingFactoryReturn→confirm→sendQc→claimQc→completeQc→appendProcessCompletion→submitForRecheck命令产生，浏览器动作通过runPostFinishingCommand事务入口。I1仅把这些事实编码为明确旧schema2/H400/N600表示；没有私有flow state注入。辅料初始状态复用main冻结post.json/postLegacy.json并校验当前原文件SHA，属于隔离本地验收输入，不冒称本次GTP/HILON上游实操或真实工厂执行。I2既有辅料收货使用receiveAccessoryPostTransfer公开命令，I3使用实际PDA正式单路由和真实UI收货。

PDA身份使用现有公开listFactoryPdaUsers(factoryId)/getFactoryPdaUserById/createPdaSessionFromUser/setPdaSession；必要角色通过已有公开setFactoryPdaUserRole在独立原型上下文设定，不伪造不存在的用户。三个授权角色分别在自己的上下文真实提交收货；这是原型角色边界验证，不是真实后端鉴权证明。

## 四个唯一用例与有效日志

| 唯一用例 | 实际通过结果 | 有效日志 |
|---|---|---|
| I1a post-first-inline | 对应真实zipper旧inline→PCS事务故障两边不变/LS保留→同入口重试→非辅料迁移+raw/Blob原包→LS清理→辅料7实存/10历史入库→刷新/来源去重/真冲突阻断→H400+N100=F500、新100复检，WLS不变 | accepted-20261020/i1-post-first-pass.log，1pass13.2s |
| I1b accessory-first-existing-pcs | 原PCS两个材料及文件保留；先辅料归档后加工迁移，LS到archive沿用原身份，无重复库存；H/N续做和新复检，WLS不变 | i1-accessory-first-pass-before-qc-fixture-failure.log内第1例通过；后面的I2夹具错误不抹去本例有效结果 |
| I2 readonly backup restore | 实际审计file input错误格式→合法重试；受管新材料仅入readonly material-original+Blob，无第二活跃源；原Accessory库存/调拨不变；同备份幂等、同ID不同内容冲突/DB不变；后续实际加工+100交复检可保存 | i2-restore-pass-before-pda-session-fixture-failure.log内第1例通过；I3夹具错误另列 |
| I3 managed PDA role | 正式单真实路由，OP只读/旧managed API拒绝；ADMIN真实事务失败保输入、同意图重试10/20实存，390与480无横溢；HANDOVER和DISPATCH各实际完成10/20收货；别厂ID-F004正式直达阻断，PCS未误写 | i3-managed-pda-role-pass.log，1pass22.2s |

I3包含5个角色/工厂子分支：ID-F002 ROLE_OPERATOR、ROLE_ADMIN、ROLE_HANDOVER、ROLE_DISPATCH，以及ID-F004 ROLE_ADMIN。实际身份和最终路由见managed-role-results.json。五个分支仍计1个唯一测试，不冒增用例数。

I1a截图/完整两库JSON、I1b截图/JSON、I2恢复JSON/截图、I3主截图/480截图及实际角色JSON均在accepted-20261020。R迁移失败注入和PDA失败注入均真实触及IndexedDB提交边界，断言原持久事实不变；没有绕过保存失败或用内存成功代替transaction complete。

原main `旧后道整包转换不能绕过受管辅料退出边界` 单节点使用原脚本/原断言实跑exit0，1pass，1.68s；归档前后纯材料包R转换仍拒绝，原LS/PCS保留，无退休事实写回。仅验证这个过滤节点，未宣称该main浏览器文件所有其他测试本轮全部运行。

## 原失败与校准身份

- **真实产品失败1**：新postScope辅料prepare对旧LS inline调用严格新存储pcsFileReferences，转换按钮不可达。主代理修成历史读取只收集既有pcs-file引用；新commit仍严格。完整原trace/截图/日志保存在red-inline-read-gate。
- **真实产品失败2**：readSources将archivePrefix末尾斜杠传namespace reader，重复拼斜杠漏掉已持久raw archive；服装迁移成功后辅料页错误为0条。主代理分离archiveScope与ID prefix，原资料始终保留在底层归档。完整原trace/截图/日志保存在red-archive-range。
- **测试预期校准**：I1曾断言QuotaExceededError原始注入文字，实际R.translate已正确显示业务错误“本次未保存”；更正为真实错误契约，原子/LS不变断言保留。原日志/trace在fixture-quota-message-calibration。
- **测试helper校准**：辅料归档按钮没有confirm，错误注册的once dialog监听残留，与后面的H/N确认双重accept。移除不存在确认的监听；原trace证明真实确认链，见helper-unused-dialog-calibration。
- **测试输入校准**：I2原QC actor已拥有seed活动单，合法单人单活动规则阻断。改用保留相同完整QC角色的独立隔离actor，不释放无关旧单；见fixture-qc-owner-calibration原日志/trace。
- **测试身份校准**：I3自造userId被真实原型用户目录拒绝并进入登录页。改用正式公开原型身份入口，见fixture-pda-session-calibration原日志/trace。
- **测试API参数校准**：I3首次公开用户列表调用遗漏必需factoryId，得到空集合。修为按厂读取真实用户；fixture-pda-list-api-calibration保留原失败日志与测试源码，原trace未另存，不声称有该轮trace。

这些校准不计额外通过用例，也不把产品失败归咎HMR。新4例未修改既有纯材料guard或降低原子、数量、来源、角色要求。

## 补充直接证据与限制

PFN-048：platform-d1-integrated包含整合后公开D1实际JSON和源码SHA：500/300/200/100工序求和1100，但平台F100；四项各1000时平台F1000，首100实收后可交900；三张复检100/100/800最终平台累计复检1000。其绑定为该整合阶段版本，不把后续材料旁路优化当作新平台运行样本。

material-bulk-equivalence：非空公开Node材料接口比较，先以合法旧公开receive生成4stock，原5调拨/4stock；两种桥实际接管2来源后均3调拨/0stock，全部返回对象一致；下一次owner集合为空恢复5/4，bulk回调2→3，没有跨调用缓存。最初0stock输入前置失败作为fixture校准保留，不计产品失败。

f090-todo-equivalence：原20个fresh Node进程误查ID-F090，实际目标为F090。撤回实际F090等价结论，不能因两边全0将错误身份当成有效目标控制。原脚本/actual/日志和早期说明均保持原身份，纠正见该目录review.md第7行起；主代理未据此删除F090初始化。

本代理未改矩阵/coverage最终状态，未执行生产发布。最终构建、旧full/cross、正式性能与发布回执由主代理整合。
