# 现场标签、款式属性及直播房间维护

需求来源：2026-10-06 用户四张现场照片及「直播房间必须能打印标签，标号由地点＋楼层＋序列号构成」。业务总体设计 §7.5；实施计划 WP-STYLE-PHOTO / WP-LOS-ROOM / WP-SAMPLE-LABEL。当前分支 codex/sample-wp05-completion；基准 HEAD eb1da8508f0ecda6c172b38df0b7b2d929f477b0。本轮不推送、不接真实服务端，不改全量 LOS 排班业务。

## 数据与范围

- 款式：读取原 PCS 款式档案与共享基础配置，只调整列表、偏好和导出，不新增业务存储。
- 地点与房间：LOS 自有 `higood-los-live-room-master-v1/sites|rooms/<id>`，复用现有 IndexedDB 记录 adapter；静态演示读取不写入，保存单条记录，版本控制；地点是房间上级，品类编号引用 PCS 字典 ID。
- PCS 样衣：房间身份投影取 LOS。新流转提交重新读取 LOS、同事务只读校验房间及地点版本，PCS 不写 LOS 记录；已有历史房间 ID 保留可解析。其他家播、工厂、部门和仓库位置保持原来源。
- 门牌只读打印：新地点标号规范为 `地点编码-楼层两位-序号三位`；房间每个品类一张门牌，打印不改变房间、样衣或贴码状态。
- 用户给出的 402 房间照片没有实际地点正式名称。当前地点 A / B、第二处楼层与序号、责任人均为演示，用户维护后按维护值打印。照片 OPM/S.O 岗位含义不擅自解释。21 品类尾部遮挡，沿用已有完整配置的年龄段。
- 不清空浏览器、不暴露 PCS 本地资料维护工具，不覆盖用户保存的基础配置。

## 原子追踪矩阵

确认人：用户（本次请求）；实现及验证负责人：Codex；验证版本：上述 HEAD＋当前工作区差异。房间与款式原子项以本轮最后应用改动后的浏览器证据验证；样衣 HG 标签另列待确认。

| 编号 | 原子需求 / 来源 | 工作包 | 实现 | 自动化和页面证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| ROOM-001 | 房间唯一标号由地点＋楼层＋序号构成，原标号不重复分配 | WP-LOS-ROOM | los-live-room-master / liveRoomCode、saveLiveRoom | los-live-room-label.test，唯一性及刷新 | 已验证 |
| ROOM-002 | 地点可维护，编码固定，房间可新增和维护 | WP-LOS-ROOM | los-live-rooms / editor、overlays，saveLiveSite | 同上，真实页面维护 | 已验证 |
| ROOM-003 | 单房间可关联多个共享品类编号 | WP-LOS-ROOM | categoryNumberIds、liveRoomCategories | 多选、保存和刷新 | 已验证 |
| ROOM-004 | 专用详情 / 编辑 / 标签预览，列表不平铺表单 | WP-LOS-ROOM | routes-los、los-live-rooms | 五条路由、1366×768 / 1280×720 | 已验证 |
| ROOM-005 | 每个品类门牌展示房间标号、完整品类英中名称、OPM / S.O | WP-LOS-ROOM | roomLabel、detail、printRoom | iframe 打印 HTML、PDF、截图 | 已验证 |
| ROOM-006 | 打印只读，不改变业务状态或复制数据 | WP-LOS-ROOM | printRoom | 打印前后 IndexedDB 记录完全一致 | 已验证 |
| ROOM-007 | 首次读取不写种子，保存完成才更新缓存，失败原子回滚 | WP-LOS-ROOM | ensureLosLiveRoomState、commit | fresh 0 rows、quota abort、saved refresh | 已验证 |
| ROOM-008 | 旧版本修改和并发同码创建不能覆盖记录 | WP-LOS-ROOM | commitPcsRecords expectedVersion | stale update、duplicate identity、race guards | 已验证 |
| ROOM-009 | 停用房间 / 地点不能新增样衣流入，历史可读 | WP-LOS-ROOM | liveRoomTransferGuards、PCS 位置投影、save-flow | disabled room、parent guard、PCS flow | 已验证 |
| ROOM-010 | 未保存输入提醒 / 离开确认，首次读取失败后可重试 | WP-LOS-ROOM | dirty / siteDirty、initializeDraft | leave dismiss、new / edit failure recovery | 已验证 |
| ROOM-011 | 列设置可见 / 冻结 / 顺序、筛选排序分页和导出 | WP-LOS-ROOM | list、prefs、drag/drop、handlers | 用户操作后刷新、CSV | 已验证 |
| ROOM-012 | 共享品类编号名称与可见现场照片一致 | WP-LOS-ROOM | pcs-config-dimensions，style-product-information | 门牌名称、款式引用同源 | 已验证 |
| STYLE-PHOTO-001 | 款式列表属性有名称和值，不新增备注选项列 | WP-STYLE-PHOTO | pcs-product-archives / attributeColumn | pcs-style-photo-attributes.test | 已验证 |
| STYLE-PHOTO-002 | 品类 / 风格 / 面料 / 流行元素 / 定位 / 工艺、人群 / 年龄 / 人群定位完整承接 | WP-STYLE-PHOTO | styleAttributeLines | 多值保存后刷新 / 真实图片 | 已验证 |
| STYLE-PHOTO-003 | 品类编号完整英中名称、稳定配置引用，备注不替代属性 | WP-STYLE-PHOTO | categoryNumberLabel、listContext | 48 品类示例及字典一致 | 已验证 |
| STYLE-PHOTO-004 | CSV 分组属性独立字段，过滤全部结果，列偏好兼容 | WP-STYLE-PHOTO | exportList、preferences | CSV、隐藏 / 排序 / 冻结 / 旧偏好 | 已验证 |
| PERF-ROOM-001 | 所有命名路由冷启动 / 刷新 / SPA 和修改交互各 5 次 ≤1000ms | WP-LOS-ROOM | 测量脚本 | room-performance.json | 已验证 |
| PERF-STYLE-001 | 款式 / SKU 页面同一性能门禁 | WP-STYLE-PHOTO | 测量脚本 | attributes-and-performance.json | 已验证 |
| SAMPLE-LABEL-001 | 样衣标签条码＋HG＋日期＋SKU，照片排版 | WP-SAMPLE-LABEL | 尚未绑定；等待编号 / 日期口径 | 不适用：尚未实施 | 已阻塞 |
| SAMPLE-LABEL-002 | 明确 HG 来源、条码 payload、日期与尺寸 | WP-SAMPLE-LABEL | 用户问题已提出，尚未回复 | 待用户确认 | 已阻塞 |
| SAMPLE-LABEL-003 | 标签打印不代表实际贴码，不改⑤口径 | WP-SAMPLE-LABEL | 现有贴码流程保持 | 尚未有新增打印证据 | 已阻塞 |

## 审查与结果

只读对抗审查首次发现五项：样衣流入跨标签启停竞态、失败恢复空草稿、现场字典冲突、列拖拽缺失、未保存离开保护。按相应原子项修正；详见同目录 adversarial-review.md。不存在用户授权后的新增许可等待，唯一待确认是样衣 HG 标签业务语义，房间门牌工作独立完成。

## 当前验证环境与直接证据

2026-10-06，上述分支与基准＋当前源差异；源文件 SHA256 见 evidence/source-manifest.json。Chromium 149.0.7827.55，1366×768 / 1280×720（补充房间测试 1280×768），同一工作树 Vite 4206；样衣路由回归为该工作树最终构建 preview 4207。各测试用独立浏览器上下文，不清理用户数据。冷加载与刷新禁用 HTTP 缓存、计时含读写和两帧渲染，款式与样衣还等真实图片解码完成。

| 证据 | 场景和结果 |
| --- | --- |
| evidence/room-performance.json | 59 个场景×5轮=295 样本，最大 346.39999997615814ms；5 路由冷启动/刷新/站内切换，创建维护刷新、标签预览及生成打印、列设置、启停、日志 |
| evidence/room-extra-performance.json | 44 个场景×5轮=220 样本，最大 174.4000000357628ms；地点维护/启停、全部可排序列、搜索、分页、离开取消、故障及重试 |
| evidence/attributes-and-performance.json | 410 样本，最大 346.5ms；结构化款式属性、多值、CSV、偏好、两路由及低分辨率/真实图片 |
| evidence/room-main.log、room-extra.log、style.log | 3/3＋1/1＋1/1 浏览器契约通过；并发同码只能保存一次、版本防覆盖、父地点停用竞态、故障回滚和重新读取 |
| evidence/room-door-label.html；output/playwright/sample-label-style/room-door-label.pdf、room-label.png | 逐品类一张门牌；打印与预览一致，打印前后业务记录相同。PDF/浏览器原型已验收，物理打印机不在当前证据内 |
| evidence/build.log、typecheck.log | 构建及 583 单元测试通过；全量 tsc 保留 3 项既有范围外错误，当前涉及文件无新增错误，不声明全项目类型错误归零 |
| ../sample-wp05-completion/evidence/ | 五轮双 SKU 到样/贴码/直播间/家播/工厂/部门/仓库/互转以及 10 轮测款回归，样衣相关总计 1340 原始样本，全部≤1000ms |
| adversarial-review.md | 独立只读审查及主代理反向/正向追踪，发现已关闭；最后历史钩子由主代理浏览器补验 |

所有 1 秒门禁无例外。修复前的 1058.0999999642372ms 冷加载失败保留于 evidence/performance-failure-history.json；修复后全量重测。最终治理及 CodeGraph 状态以 output/playwright/sample-label-style/task-receipt.json 为准。
