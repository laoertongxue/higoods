# 旧full/cross契约对齐旁路

2026-10-20，独立只读trace/当前源码审查，仅局部修改tests/post-finishing-full-flow.spec.ts；cross-terminal文件不改。没有启动浏览器、运行套件或构建，不声明对齐后已通过。主代理负责真实并发修复和fresh单例/完整重跑。

原始npm前缀日志、解析JSON、四个可用error-context/trace/截图/视频目录及修改前两份测试已先保存于相邻final-full-cross-red-before-main-test-alignment，原manifest SHA166d764a8e744e466a0c133866c1481cb1c0b1d2388e39f6ebe5c70781672ade。只诊断指定三个首因；第四个停测时的等待链仅保留，不在本旁路冒作已修复。

## 三个首因

1. cross的data-post-process期望4实际0：实际页面为加载失败，不是选择器过期。console栈prepareAccessoryWarehouseSources→hydrateProductionContextRecords抛生产来源正在保存或迁移，route-renderers.ts:50；随后ownedProductionIdentities→listAccessoryPreparations同错。保留四项目数量与后续按项完成/显式交复检全部断言。
2. full辅料详情：实际列表仍有唯一DB-PF-202608-001、待入库和查看详情按钮，无console错误。main已把详情打开/关闭从data-nav地址改为局部detail action和关闭按钮，属于明确旧测试契约。旧该行是非managed只读演示，不将其冒充新AW收货入口。
3. full QC领取后data-qc-result-line期望5实际0：实际页面为加载失败，console同生产来源锁冲突，栈route-renderers-fcs.ts:68以及事件后的renderWithFocusRestore。保留五SKU、图片、原因汇总和权限断言。主代理已确认是导航订阅与外层重复渲染并发prepare，并负责命名后道导航路径的最小修复；本代理不改产品、不绕锁或等待到异常消失。

## 唯一测试调整

- 详情未开：由不存在旧detail标志改验实际命名dialog不存在。
- 打开：由data-nav material-transfers?transferId改为data-post-finishing-material-transfers-action=detail。
- 保留详情4条材料行、图片加载、标准列表骨架及无数量输入；旧退役提示文字改为实际“尚未入库”，另明确验数量/库位字段和receive动作都不存在，保留并强化该旧分支只读边界。
- 关闭：由旧导航关闭改为实际dialog内唯一“关闭”按钮。

没有修改cross文件，没有放宽数量、顺序、角色、来源、保存或图片要求。git diff --check通过；动态验证仍由主代理重跑。

## 错误工厂标识符探针更正

原f090-todo-equivalence的脚本/actual实际使用ID-F090，而本轮full/cross实际PDA_SESSION是F090。该20次零值结果属于错误目标探针，撤回实际F090等价结论；原数据保持不动，原review/manifest有before-wrong-identity-correction副本，现review明确追加纠正。更正清单SHA1d65140e5f524630070ac922be0a25e8b7b64f9ce44b42746c7e1717a678c9f0。没有重跑Node，也没有据此修改F090初始化。
