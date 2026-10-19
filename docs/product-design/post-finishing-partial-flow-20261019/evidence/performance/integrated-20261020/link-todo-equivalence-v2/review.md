# 第二轮生产单范围过滤与目录等价检查

日期2026-10-20，独立静态审查和实际公开 Node 内存契约；不启动浏览器/构建，不作性能通过声明。第一轮目录完整保留于相邻 link-todo-equivalence。本轮目录为独立版本，源码及证据散列见 manifest。

基线仍为 HEAD production-object-overview，所有依赖使用当前最终工作树。PDA无条件染色初始化重建基线沿用第一轮已明确说明的生成方式，非直接历史文件。专用工厂门控无进一步变化。

四阶段的 PRODUCTION_ORDER/PROCESS_DOC 全行、顺序、全部字段及4748个编号/上下文解析 deepEqual；全类型全局搜索完整 deepEqual。九个既有/兼容角色的专用工厂待办在染色初始化前后保持一致。

新增范围读取契约：每阶段对V/listPostFinishingTasks以及F/listPostFinishingFactoryReturns，分别用空ID集合、未知ID、所有ID以及每个实际ID，断言与原无参结果按productionOrderId筛选完全一致。QC/post/recheck/outbound/waitHandover五种Flist分别用空No、未知No、全部No及逐单No，断言与原无参结果后筛选完全一致。修改过滤返回对象再读无参结果仍等于原结果，不存在对内部source的别名。

静态核读：只有可选参数存在时才先筛后clone；无参表达式仍clone原数组。V来源先按生产单ID限定，回货同ID限定，后续QC/后道/复检/出货/待交出按选中来源和既有回货的No全集限定，保留后续原来的按No关联语义。PROCESS_DOC限定到原本真正能输出的fixture生产单ID集合，全局搜索默认不传范围，未改变权限和可点击编号集合。

脚本结束恢复临时来源计划，仅用公开回货→确认→送检→QC→加工→交复检→扫码→出货→仓收API创建隔离内存事实；没有向内部flow状态注入下游记录。脚本/日志/report均实际保存。
