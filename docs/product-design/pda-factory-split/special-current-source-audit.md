# 单一辅助 / 特种工艺当前Web接续审查

范围：继承C08/WP3、C08.21～24。基准6f477551与当前工作树，阶段为代码核查和局部实施；不冒称全部中央/三方或最终迁移完成。C09织带/花边另有独立原域，不套本表。

## 当前原Web规则及直接事实

原process-web-status-actions、process-action-writeback-service、special-craft-task-orders和special-craft-operations为本轮业务事实。确认接收只在接收Tab；执行页加工填报/可交实物时发起交出；原Web已加工>0即可完工，已完结仍能交剩余产出。当前规则优先于V34旧全只读例子。

普通成衣逐SKU，未选SKU本次为0，片类逐菲票或行；加工不得超过该行实收余量，不能借另一SKU或部位片的数。制作辅料按BOM投入量比例向下取整授权产出；盘扣全票接收后才准填产出，投入张、产出个，不用米数替代个数。上下游依据原targetObject对应裁床、面辅料仓、成衣仓及原指定接收仓，PDA不选择自动库位。仓管只看真实库区/货架/库位、接收/交出及独立实收，不新增接收或交出命令。

## 当前实际原单的16个工序代表

下表来源为原单和当前领域模型，读取后逐个实际纸码进入320×480印尼语接收页面，0页面错误。它只证明当前实际来源形态，不代表配置中尚无有效原单的其他对象形态已验收。

| 工序 | 当前实物 | 当前数量模式 | 投入单位 | 产出单位 |
|---|---|---|---|---|
| 烫画 | 成衣 | SAME_UNIT | 件 | 件 |
| 直喷 | 成衣 | SAME_UNIT | 件 | 件 |
| 橡筋定长切割 | 辅料 | SAME_UNIT | 米 | 条 |
| 盘扣 | 捆条 | TICKET_INPUT_OUTPUT | 张 | 个 |
| 打揽 | 已裁部位 | SAME_UNIT | 片 | 片 |
| 打条 | 已裁部位 | SAME_UNIT | 片 | 片 |
| 布包扣 | 辅料 | MATERIAL_INPUT_OUTPUT | 米 | 个 |
| 绣花 | 已裁部位 | SAME_UNIT | 片 | 片 |
| 压褶 | 已裁部位 | SAME_UNIT | 片 | 片 |
| 缝边绣 | 已裁部位 | SAME_UNIT | 片 | 片 |
| 花朵 | 已裁部位 | SAME_UNIT | 片 | 片 |
| 打褶 | 已裁部位 | SAME_UNIT | 片 | 片 |
| 烫钻 | 已裁部位 | SAME_UNIT | 片 | 片 |
| 模板工序 | 已裁部位 | SAME_UNIT | 片 | 片 |
| 激光开袋 | 已裁部位 | SAME_UNIT | 片 | 片 |
| 特种车缝（花样机） | 已裁部位 | SAME_UNIT | 片 | 片 |

原盘扣、花朵业务身份在当前dict仍为AUX_*；显示分组可按已确认辅料四类整理，但不改原ID、二维码、票/个或片数/回裁床关系。布包扣沿当前Web是制作BOM投入→个，不改成安装钮扣到成衣。

## 已发现并修正的现场问题

- 新中央原扫码只比裸编号，无法识别Web纸面FCS:WORK_ORDER:v1原码。现复用原task-qr解析，保留含冒号ID，同时匹配原任务码/生产单码/菲票/SKU；跨工厂、跨工序、非任务/单据码和未知版本拒绝。多候选仍选真实单，不自动猜单。单测逐原单验证，当前16工序纸码页面另实际核对。
- 无该工序单据的有效中央工厂账号会被拒绝或回退另一管理员。现仅在真实active中央工厂范围保留本人当前工厂，可空列表，不采用其他工厂数据。实际DYE-GOTO-GLOBAL_operator密码登录后头部保留goto_global并为空列表。
- 原生提交成功、回读失败后仍能改数：c08-committed-input-red保留反例。现锁定已提交填写/保存/清空；语言、返回后仍锁定，一次重新读取核对同操作号后清理，不再点第二次提交。c08-committed-input-read-complete证明原生接收仍6件。初版collector未等异步读取结束，失败保留，修正完成条件后通过，未再改业务规则。
- 账号Enter未到密码、扫码加工后未聚焦数量：保留keyboard-red及keyboard-continuous-chain反例。已补账号→密码→登录、数量Enter/F1仅聚焦主按钮；扫码进入加工/切动作后定位数量。actual c08-keyboard-continuous-focus操作员接收6/加工4/交出3，原生3条操作均本人UID，发方未代实收。数量框y249～307、主按钮y412～468，视口320×480无横向溢出；印尼语及清空切语言/返回续填通过。

## 证据与未完成范围

证据在output/playwright/pda-factory-split：c08-single-operation-qr-empty-factory（16工序原图/原单/单位/上游/扫码入口）；c08-current-object-shape-inventory（当前可接收原单无额外对象/单位形态；不伪造额外原单）；c08-keyboard-continuous-focus；c08-committed-input-read-complete；c08-empty-factory-green（3项单测）。本轮4文件范围类型0/全量19既有错误记录在c07-c08-continuity-scope，键盘最后差异仍须最后检查。

已有16工序领域动作证据central-special-cache-safety-c06-adjacent保留原版本；本轮未改四动作数量公式、原单类型或原库位结构，不能把旧结果改标当前运行。当前新增控制器恢复/焦点、共同binding捕获分支的直接回归已另取证；正式生产性能、最终源码/资产绑定、全部直接下游正向接收和完整旧资料/旧消费者仍未关闭。尚无实际源的额外配置对象分支登记待补，不以默认16来源代替。无任务提交推送部署、无物理工厂/实拍PDA接受。

## C08 本轮生产采样与定点整改

固定 c07-c08-continuity-final-vite 资产，30家族150样本：功能、原生数量及交接责任正确、0页面错误；emptyFactoryRefresh有效1033/1017ms，性能不通过，保留 c08-current-continuity-production-five.json。原始三份校准失败为脚本把隐藏字段alert当扫码提示、取消按钮标签不一致；实际页面未因此改业务。

c08-empty-frame-cost-diagnostic证明工厂菜单首次151.9ms；代码确认它调用完整centralWoolCraftContexts，建立所有毛织实收来源，却只取task.factoryId。改为centralWoolCraftAssignments原任务归属；同一原任务生成函数及原工厂条件，完整contexts无匹配任务先返回，不读取无关来片源。7直接单元/工程scope0（全19既有）通过，其中逐实际任务ID/工厂对照轻重投影一致。新运行资产及正式复验待完成，不将诊断值或原有通过追认为整改后通过。
