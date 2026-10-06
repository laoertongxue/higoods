# 直播房间标号、门牌打印及款式属性原型审查记录

## 1. 基本信息

- 日期：2026-10-06
- 相关需求：ROOM-001～012、STYLE-PHOTO-001～004、PERF-ROOM-001、PERF-STYLE-001
- 模式：完整产品审查
- 系统 / 角色：LOS 地点与直播房间维护人员；PCS 商品、样衣管理人员
- 工作树：/Users/laoer/Documents/higoods，codex/sample-wp05-completion，基准 eb1da8508f0ecda6c172b38df0b7b2d929f477b0

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增直播房间维护、唯一标号、分离详情 / 编辑 / 标签预览及只读打印；PCS 位置取 LOS 房间，停用阻断新流入；款式属性按名称和值分组显示、独立 CSV 字段。共享品类字典源及发布静态基线同步照片名称，未保存离开和只读事务版本防错。

依据 AGENTS.md 第 4 / 5 / 7 节、PCS 总体设计 §7.5、实施计划 WP-LOS-ROOM / WP-STYLE-PHOTO；业务与原子追踪位于 docs/reviews/2026-10-06-sample-label-and-style-attributes/requirements-and-evidence.md。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 页面层次与角色任务 | 通过 | 列表、详情、编辑和标签预览分离；房间身份、品类、责任人分区 |
| 身份与共享字典 | 通过 | 标号地点＋楼层＋序列号，唯一且固定；多品类引用同一配置 ID；不复制 PCS 房间主数据 |
| 图片和打印 | 通过 | 款式及样衣使用真实服装图；门牌品类中英文、OPM/S.O 按照片，多品类各一张；打印前后记录不变 |
| 保存、失败和并发 | 通过 | 按记录 IndexedDB 保存，不落种子；回滚保留输入；同码并发及旧版本覆盖被拒绝，PCS 保存只读校验 LOS |
| 交接与启停 | 通过 | 停用房间/地点不新增样衣流入；历史可读；危险操作需确认 |
| 未保存与恢复 | 通过 | 点击、取消、关闭、浏览器后退保护；初次读失败重试；容量失败保留输入后重试 |
| 低分辨率及性能 | 通过 | 1366×768 / 1280×720；房间 515 样本、款式 410 样本，均≤1000ms，无例外；样衣另有1340样本 |

地点 A/B、部分房间位置为演示，人员按照片演示文字；未作为真实现场主数据。样衣 HG 标签业务含义及尺寸尚待确认，单独记录，不把房间门牌打印视为样衣标签完成。

## 4. 问题标签

- 共享字典一致性、房间身份唯一性、打印事实、防丢输入、跨标签冲突、保存原子性、性能。

## 5. 主要问题与处理

只读对抗审查先后发现并修正：并发停用旧缓存（保存前刷新＋同事务只读版本校验）；初次读取失败空草稿（安全面板＋初始化）；品类名称与照片不同（共享源和生成基线同步）；列拖拽缺失（本页保存偏好）；未保存导航（点击 / 关闭 / 浏览器历史保护）。历史导航在全局实际触发前发可取消事件，仅 LOS dirty 时处理，其余路径默认保持原行为。主代理对完整 diff 与实际输出复核。

## 6. 最终结论

结论：通过。

本结论限 ROOM-001～012、STYLE-PHOTO-001～004 及相应性能；全部浏览器业务、打印输出、失败/并发和关联样衣回归在最终应用代码上通过。房间515样本最大346.39999997615814ms，款式410样本最大346.5ms，样衣1340样本最大374.39999997615814ms，全部≤1秒。样衣 HG 标签仍待用户事实，本记录不声明四张照片全部需求已完成。远端发布及产品接受尚未发生。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/los-live-room-master.ts`
- `src/pages/los-live-rooms.ts`
- `src/router/routes-los.ts`
- `src/router/routes.ts`
- `src/main.ts`
- `src/data/pcs-record-db.ts`
- `src/data/pcs-record-runtime.ts`
- `src/data/pcs-sample-location-master.ts`
- `src/pages/pcs-sample-management.ts`
- `src/data/pcs-config-dimensions.ts`
- `src/data/generated/pcs-record-baseline.json`
- `src/data/pcs-style-product-information.ts`
- `src/pages/pcs-product-archives.ts`
- `scripts/check-menu-routes.mjs`

### 页面路由

- `/los/live-room`
- `/los/live-room/new`
- `/los/live-room/loc-live-01`
- `/los/live-room/loc-live-01/edit`
- `/los/live-room/loc-live-01/label`
- `/pcs/products/styles`
- `/pcs/products/specifications`
- `/pcs/samples/*`
- `/pcs/testing/orders/*`

### 验证命令

- `node --import tsx --test tests/browser-contracts/los-live-room-label.test.ts`：通过（3/3）
- `node --import tsx --test tests/browser-contracts/los-live-room-extra.test.ts`：通过（1/1，5轮，补齐全部可排序列/搜索/地点/分页/恢复）
- `node --import tsx --test tests/browser-contracts/pcs-style-photo-attributes.test.ts`：通过（1/1，5轮）
- `node --import tsx --test tests/browser-contracts/pcs-sample-wp05.test.ts`：通过（5/5，全 Mock 链）
- `node --import tsx --test tests/browser-contracts/pcs-sample-performance.test.ts`：通过（213组1080样本）
- `node --import tsx --test tests/browser-contracts/pcs-sample-testing-regression.test.ts`：通过（10轮90样本）
- `node --import tsx --test tests/unit/*.test.ts`：通过（583/583）
- `npm run build`：通过（工程类型检查＋单元＋Vite构建）
- `npx tsc --noEmit`：失败（3项既有范围外错误；当前涉及文件无新增错误；原始输出保留）

### 验证结果

验证结果：通过（PASS），指房间及款式本轮范围。业务、打印输出及性能见 docs/reviews/2026-10-06-sample-label-and-style-attributes/evidence；样衣受影响链路已重新运行，见相邻 WP-05 记录。最后应用代码改动后证据重新生成。最终治理、CodeGraph和完整源差异绑定由随后生成的 output/playwright/sample-label-style/task-receipt.json 提供，不用旧收据代替。

### 例外

- 无性能例外。门牌为浏览器打印原型，实际纸张 / 打印机由现场选择；未声称已完成物理打印机验收。样衣 HG 标签仍待用户口径，不混为门牌验收。
