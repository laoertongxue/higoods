# 第18阶段子单primitive摘要独立契约

范围只扩展原quantity-summary测试文件；保留原5例与全部原断言，复用公开回货、确认、送检、QC、加工、主管订正、交复检、复检和仓收helpers。没有修改产品或旧证据，没有browser/build/IDB/性能验收。

最小red：新API存在断言先实际单跑，1例0通过/1失败、exit1，原因为listPostFinishingTaskChildQuantitySummaries尚未导出。red-test.ts.txt保存该时点测试，red.log保留原始输出。主代理实现后扩展为6例，原5＋新增1，真实6/6通过、exit0，见green.log。

原compareSummaries的每个已有阶段附加子单比较，另新增混合状态实际业务场景；共19个子单阶段、93组无参/各真实生产No/全No/空Set/未知Set过滤比较。每组expected来自原完整公开getter先过滤再映射求和，逐字段、数组顺序deepEqual。每行仅primitive；逐字段修改返回对象并清空返回数组后，新摘要和3个原完整getter仍等于原事实。

覆盖：
- D1先500/300/200/100、主管订正、100/100/800三张子单到最终仓收；各阶段原parent摘要断言保持。
- 两项/各单项、多生产No；原getter双过滤交集108组保持，QC直达无postTaskId出货保持。
- 多SKU授权部分0：复检应交20、实际10，出货仅正数SKU10，摘要totalExpectedQty20、totalHandoverQty10，仓待交10。
- 历史H400/N600、unknown旧表示和原demo，依旧公开声明原输入边界，不造历史子单/人员；原有正常下游通过公开命令生成。
- 新场景同父100/100/800：首100真实复检完成并仓收；第二100已领取处于复检中；第三800待复检。三种状态同时存在；首仓待交0。另同场加入上述授权部分0和QC直达40出货，完整计数4复检/3出货/2待交出，已收与待收两种出货状态均覆盖。

静态核读F新函数：3个集合均保留原数组顺序，在productionOrderNo集合过滤后映射独立新对象；仅导出约定primitive字段，expected/handover||0/available的求和与oracle相同。原完整getter未被改成摘要。V只有TaskProjectionSnapshot改用子摘要；WorkOrderProjectionSnapshot仍调用完整getter并保留详情SKU。主代理负责完整V旧新11状态等价、R分组、内部validator免clone和最终集成，此记录不冒称复核了那些结果。

Node输出出现localStorage实验警告，但全部业务断言通过；这里没有配置Node持久localStorage，也未用该警告作为browser存储错误结论。192ms总unit耗时不是页面/保存完整响应计时。
