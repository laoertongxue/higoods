# 继承原型代码盘点 · 实施前摘要

版本：ee14949905b08b260e9c6309eebc59bfa5b32764。仅继承早期已读代码与Mock统计，不重探索，也不是当前按钮运行验收。当前21页对齐+6对象全面删除；不授权清空用户持久数据。

三基础页面模块、固定路由、数据导出函数和标准列表骨架存在。原盘点未独立保存全部CRUD符号；不能据页面存在声称供应商新增/供货复制导入/物流渠道CRUD已逐按钮完成。对应模块和精确export函数详见JSON activePageExports，功能验收以测试按钮清单和主代理当前CodeGraph/运行核对为准。

| 稳定编号 | 领域 | 已读代码事实 | 实施影响 |
|---|---|---|
| PMS-PROTO-NAV-01 | 菜单 | 原型组顺序为基础资料→采购建议→商品采购→面辅料采购→KOL样衣申请→面辅料供应商确认→库存查询→头程物流→采购对账；与测试顺序不同。（src/data/app-shell-config.ts） | 按测试菜单顺序排列保留21叶；6对象全面删除。 |
| PMS-PROTO-NAV-02 | 菜单图标 | 原有27叶均配置Lucide icon，AppShell渲染；不能把菜单顺序差异扩大成全部缺icon。（src/data/app-shell-config.ts） | 实施后核对21叶图标仍可见。 |
| PMS-PROTO-STRUCT-01 | 列表骨架 | 26个固定路由与2个动态路由已存在；盘点的列表使用标准骨架，默认10条/页。（src/router/routes-pms.ts；src/components/ui/） | 复用标准组件，按已观察行为补丁；不推倒架构。 |
| PMS-PROTO-REO-01 | 备货 | 新增SPU/备货存在占位或仅内存路径，没有建立完整采购单。（src/pages/pms/reorder-suggestions.ts；src/data/pms/reorder-suggestions.ts） | 补本地可保存的备货数量分配、采购生成与下游直接读取；正常10件与边界验证。 |
| PMS-PROTO-KOL-01 | KOL库存 | 锁定绕过可用量检查，释放/增减直接操作内存；锁定操作记录为独立固定Mock。（src/pages/pms/；src/data/pms/（KOL库存与操作记录）） | 锁定/释放校验、持久事实和关联操作记录一起保存，统一读取来源。 |
| PMS-PROTO-KOL-02 | KOL样品池链接 | 创建用随机URL而无可读业务记录；修改仅意图；作废仅内存；剪贴板失败被吞。（src/pages/pms/；src/data/pms/（KOL样品池链接）） | 按已观察对象与生命周期保存记录；失败反馈；刷新与直达回读。 |
| PMS-PROTO-MPO-01 | 面辅料图片补充 | 只有文件校验，没有附件Blob持久化。（src/pages/pms/；src/data/pms/（面辅料采购相关动作）） | 原始Blob/元数据引用同事务，并保留取消/失败输入；不存Base64。 |
| PMS-PROTO-PAY-01 | 面辅料/物流付款附件 | 附件只有名称等元数据，没有Blob实体持久化。（src/pages/pms/；src/data/pms/（两类请款/付款）） | 业务记录+附件引用+Blob同库事务；查看、刷新、失败回读。 |
| PMS-PROTO-STORE-01 | 共同保存 | 多处写入fire-and-forget，内存更新/成功提示先于事务complete；pmsPut遇IDB不可用会捕获后返回成功。（src/data/pms/；符号pmsPut（初始摘要未保留精确文件）） | await事务complete后发布内存与成功；IDB打开/事务中止必须真实失败，不回退localStorage。 |
| PMS-PROTO-STORE-02 | 操作记录 | 业务主记录与操作日志分别异步保存，日志失败被catch，不能共同成功。（src/data/pms/） | 直接相关业务对象、明细、日志合并到同库同事务。 |
| PMS-PROTO-STORE-03 | 缺少持久写入的对象 | 单位/物料/售后/备货/KOL/时效的若干可写对象缺持久路径。六项删除后不能因此把仍有效的售后、备货、KOL、时效问题当已解决。（src/data/pms/） | 对仍有效21范围按每动作建立直接对象存储；六项旧持久项登记STORE-04，不直接删用户库。 |
| PMS-PROTO-TMF-01 | 物流关联 | TMF使用单例/整包存储并有localStorage后备；PMS总初始化包含全模块读取/自动迁移。（src/data/pms/；PMS初始化/TMF相关入口） | 按本次动作直接影响登记；不能用静默后备或普通读取迁移冒充原子保存；不扩大到无关TMF。 |
| PMS-PROTO-IMAGE-01 | 对象图片 | 现有演示照片有通用图，未证明与所有对象对应。（src/data/pms/；各物料/SKU引用） | 使用已观察真实对象图片或登记素材阻塞；缩略图/大图/关闭/Esc/失败状态。 |
| PMS-PROTO-CHECK-01 | 专项验证 | check:pms-purchase-chain 有12个指向已删文件的陈旧import。（check:pms-purchase-chain） | 修复当前专项检查契约与有效路径，不能把检查未运行当通过。 |

21个有效列表的静态数量/默认每页数/导出函数已在此前Mock统计JSON中记录；没有为了两页删除有效字典记录。六项专属页和对象需完整退役，仍有效的采购物料/SKU/仓库/单位/BOM引用先核对真实现有来源与直接消费者，再清旧依赖。
