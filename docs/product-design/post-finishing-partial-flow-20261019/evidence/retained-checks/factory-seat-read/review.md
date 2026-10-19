# 工厂席位精确读取独立契约

范围：只新增一份Node unit；产品两文件由主代理实现，本记录只核读最小差异。Node临时window.localStorage为本测试的Map，显式公开upsert/remove只写该隔离Map，没有连接数据库、启动浏览器、造工厂实物动作或验证IndexedDB事务。

最小red实际运行1例，0通过/1失败，exit1。失败原因是readFactorySewingSeatCount未导出（typeof undefined），见red.log。主代理补丁完成后同文件扩展为5个有意义契约，实际5/5通过、exit0，见green.log。测试耗时不是页面性能样本。

1. 真实非空工厂目录41张，逐个ID和code共82次，与原listFactoryMasterRecords().find(id===input||code===input)的原始sewingSeatCount相等；评级解析也与完整列表原公式相等。另核unknown、空串、精确ID-F090。
2. reader及评级解析期间临时将structuredClone设为抛错，仍可读原始primitive；修改返回变量或完整列表的副本不改变源，普通读取不新增保存。
3. 用公开upsert保存隔离档案的12个字段边界：undefined、0、-3、0.25、0.99、1、1.99、29.99、30.25、127、NaN、Infinity。比较5种fallback（undefined/0/-9/2.75/97）和ID/code，共120组，完全沿用原取整与fallback原值、sourceLabel。不把负/非有限字段控制输入称为真实工厂业务。连续更新及删除的下一次读取即生效，没有跨动作缓存。
4. 合法自定义档案code=ID-F090、席位317。新reader取精确首匹配317；既有getById('ID-F090')仍指向实际TEST_FACTORY_ID，证明新reader没有错误复用该别名。实际测试工厂自身席位保持。
5. 自定义code与另一真实工厂ID重合时，保留原数组首匹配规则，不擅自改为ID优先；公开更新后521立即可见，移除后恢复原结果。

静态差异：master新函数为原factoryMasterRecords.find精确id/code匹配返回?.sewingSeatCount；rating仅替换import和toPositiveInteger的入参，原toPositiveInteger、fallback和sourceLabel保持。本测试不负责完整评级/派单/结算所有public输出的fresh旧新深等价，该旁路由主代理执行；不重复该任务。

边界：完整list oracle依旧执行原档案规范化，normal load/upsert合法性机制未被新reader替代；无browser、IDB、页面绘制、性能门槛或实体设备通过声明。最小red前产品源码由seat-source-before目录保留原身份；本目录存当前产品源码和测试副本与SHA。
