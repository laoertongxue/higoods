# PPIC 每日回货发布核验补修记录

依据 [AGENTS.md](../../AGENTS.md) 的 REVIEW-01、PERF-01、EVIDENCE-01 和 RELEASE-01，使用当前原型审查记录模板。

本记录继承已确认的 PPIC 方案和 R01～R79 原子需求，只补本次 main 发布现场发现的直接读取及加载问题。前两轮审查、本地验收及 `ec9481cd0bfb86db7292025d366b62dfe30ec55a` 的原始证据保留原版本身份。本记录不是业务方验收回执。

本记录的审查阶段为“补修产物本地验证”。下方通过结论只对应这个阶段；正式站新版本的部署及性能尚须补发后核验，发布整体尚未关闭。旧正式站的失败不会被本地证据抵消。

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：PPIC 发布补修 L01～L04，继承 R51／R52／R58／R59
- 验证人：Codex 主代理；最终差异由独立只读审查代理核对

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：直接进入回货跟进及相邻消费者前读取已保存事实，消除旧值；三条页面在导航内提前下载静态依赖，保留原业务动作和初始化。

## 现场反例

- `ec9481cd` 的 Caddy Production run `38574026758` 成功，正式元数据及 32 个相关资源哈希均已核对。
- 同一隔离浏览器后道确认 100 件，填报页实收从 399 变为 499 件，10 件原承诺兑现；新文档直接打开回货跟进仍显示 399 件及“尚无每日承诺”。根因是根路由的 PPIC 直接入口及相邻进度消费者没有在渲染前恢复该库。修改 FCS 通用渲染器尚不能修复根路由快路径，专项失败记录保留。
- 正式站冷资源加载 5 个样本为 1064.6、1459.5、2062.4、1481.2、1586.1 毫秒，违反 R58。诊断记录证实 HTTP/2、Brotli 可用，CPU 大部分空闲，首屏必需模块到约 922 毫秒才被发现，形成串行下载等待；不能用本地预览最大 793.7 毫秒覆盖这一失败。
- 首次线上脚本还存在同一 `data-promise-id` 匹配卡片和按钮的严格定位错误，已限为 `article`。该采集错误不改变上面的有效冷加载反例或直接读取业务反例。

原始证据：`output/ppic-release-20261014/online-1791986515546/`、`online-1791986630558/`、`online-cold-diagnostic.json`、`online-cold-profile.json`、`direct-return-read-red.log`、`direct-return-read-green.log`。

## 实施与验收计划

| 编号／继承 | 原子结果 | 负责文件／修改 | 自动化／现场验证 | 状态 |
| --- | --- | --- | --- | --- |
| L01／R51 | 回货跟进新文档直达恢复已保存的正式实收、原承诺和分摊 | `src/router/routes.ts` 根快路径；`route-renderers-fcs.ts` 直接 PPIC／进度消费者；`route-renderers.ts` 进度入口；调用既有 `ensurePpicDailyReturnState` | `ppic-daily-return-receipts.spec.ts` 新标签反例；线上 399→499、10 件兑现及组长汇总 | 已实现待验证 |
| L02／R52 | 上述恢复只读，不写种子或第二事实源 | 同既有 IndexedDB 恢复，无新增存储、迁移或后备 | 比较恢复前后原始持久记录；首次空库仍为零 | 已实现待验证 |
| L03／R58 | PPIC 填报、汇总和回货跟进冷加载满足 1 秒 | `vite.config.ts` 复用既有精确路径预加载，提前发现页面及必需部位票模块；只抓取编译，不改变初始化或结果 | 冻结生产产物及正式 HTTPS 每类至少 5 个样本；保留全部失败样本 | 已实现待验证 |
| L04／R59 | 补修版本经完整差异审查、适用检查和发布证明 | 本记录；5 个代码／测试文件；技术收据及外部部署记录 | 新构建、22 项浏览器、受影响治理；同完整 SHA 的 Actions、元数据和资源；独立审查 | 实施中 |

仅命名消费者的读取和三条路由的静态预加载发生变化。未改数量、截止、分摊、角色、表格交互或数据库归属；未预加载全套 FCS 路由；无真实工厂接口或外部业务数据库写入。PDA 为 Chromium 小屏模拟，合同为电子预览。

最终构建、页面、性能、补发 SHA 和收据结果在冻结后登记于 `/Users/laoer/Documents/deployment-records/2026-10-14-ppic/production.md`，不事后改写本记录冒充新现场运行。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 新标签直达读取正式实收及承诺 | 通过 | 新专项红→绿；最终 22 项浏览器全部通过；`output/ppic-release-20261014/followup/verification.log` |
| 普通读取不新增持久记录 | 通过 | 新标签专项比较前后原始持久记录，既有首开零种子契约同批通过 |
| 应回、两节点、双时间、分摊及失败恢复 | 通过 | 业务核心字节未改；969 项单元及 22 项浏览器重跑通过，后道／身份失败保留输入与原数据 |
| 命名设备页面、图片及电子合同 | 通过 | 22 项浏览器：1366×768、1280×720、1024×768、模拟 PDA 390×844，真实图及 Esc、两页合同；无本次版式改动 |
| 本地生产产物完整响应 | 通过 | 73 类 × 5 共 365 样本，最大 741.8ms，全部不超过 1000ms；`followup/performance-summary.json` 及四份原始报告 |
| 预加载范围与无提前执行 | 通过 | 三个精确 pathname，61／62／61 个静态 chunk；不含 routes-fcs，只创建 modulepreload link；独立审查实读构建产物 |
| 最终完整代码差异及范围 | 通过 | 独立只读审查无新增 P1／P2 或阻断；只改五个代码／测试文件及本记录 |
| 正式站新版本与实机／实体打印接受 | 不适用 | 本记录只验证本地补修阶段；正式站核验须在补发后独立完成，设备及纸面接受未获得，不宣称通过 |

## 最终结论

结论：通过

本地补修阶段已通过；这是可推送的技术证据，不是正式站或业务方接受回执。

## 变更覆盖与验证

### 受管文件

- `src/router/routes.ts`
- `src/router/route-renderers.ts`
- `src/router/route-renderers-fcs.ts`
- `vite.config.ts`
- `tests/ppic-daily-return-receipts.spec.ts`

### 页面证据

- 版本：运行代码及测试冻结于 `aa90e5c0c819c0609101ba7f10a913799ee2e320`；本记录后来补足模板字段，不改产品或测试字节；工作树 `/Users/laoer/.codex/worktrees/5f34/higoods`；浏览器服务为本工作树 Vite 5482，生产性能预览端口另见各原始 JSON；运行 HTML SHA256 `7911f28aa42c2c4f0a5616331ae4d3c89a116547719cf96c8cea4e6b686fcce3`。
- 证据：`output/ppic-adversarial-20261014/browser-1791987686161/` 的 22 项运行；`output/ppic-release-20261014/direct-return-read-green-root.log`；四份生产性能脚本／JSON 位于 `output/ppic-release-20261014/followup/`。直接读取 399→499、承诺兑现、原始数据不变；人员身份、各设备及真实图片沿同批契约核验。

### 性能结论

- 结论：通过
- 依据：仅本地生产预览，真实事件及必要图片／绘制／适用持久读回；每类 5 样本，73 类共 365 次，最大 741.8ms。报告明确时区 Asia/Jakarta、实际视口、规模、冷／热条件；首次正式站超时及诊断保留，尚不宣称新正式站性能通过。

### 验证命令

- `npx playwright test --config tests/ppic-daily-return.config.ts --grep '后道确认后新标签直达'`：通过
- `npm run build`：通过
- `npx playwright test --config tests/ppic-daily-return.config.ts --workers=1 --reporter=line`：通过
- `node output/ppic-release-20261014/followup/performance.mjs`：通过
- `node output/ppic-release-20261014/followup/consumer-performance.mjs`：通过
- `node output/ppic-release-20261014/followup/receipt-performance.mjs`：通过
- `node output/ppic-release-20261014/followup/identity-save-failure-performance.mjs`：通过

### 例外

- 无。正式站性能门禁不豁免，必须在补发后完成。
