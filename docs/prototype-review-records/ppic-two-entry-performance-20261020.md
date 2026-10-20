# PPIC 两入口性能专项候选审查

依据 [AGENTS.md](../../AGENTS.md)。范围和追踪见 [专项计划](../product-design/ppic-two-entry-performance-20261020.md)。本记录仅冻结候选本地验收，正式发布另记，不覆盖历史失败。

## 基本信息

- 日期：2026-10-20
- 任务 / 需求编号：PPIC-P01～P05
- 验证人：Codex 技术验证

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：T4 构建生成的日报预加载提示改变，业务源码未改；T5 待正式部署。其他路由请求行为逐条比较。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 当前身份与业务数量 | 通过 | 默认陈琳、成员吴静；500件应回/399实收/101待回保持，未出现演示身份选择 |
| 加载范围与顺序 | 通过 | 30路由VM比较，资源集合、顺序及其他路由属性完全一致；日报30依赖从auto提升high |
| 业务实现与存储 | 通过 | 185个JS/CSS摘要与89da9256正式manifest完全一致；HTML只有优先级判断变化，普通读取无业务种子落盘 |
| 页面与必要图片 | 通过 | 1366×768默认日报及1024×768成员日报无水平溢出，原款式图可见，实际任务/数量/截止完整，member.png目视核验 |
| 两入口候选性能 | 通过 | HTTPS候选各5次，最大691.7/842.1ms；本地生产预览各5次最大541.6/239.1ms，全部有效样本保留 |
| 原失败保留 | 通过 | online-1792458663244的1299.7ms仍为有效失败；单次profile不计五样本通过 |
| 迁移/新存储/打印/PDA | 不适用 | 只改变日报精确路由的fetchPriority，没有写逻辑、模式或打印/PDA资产变化；其他预加载路径保持 |
| 新正式性能 | 不适用 | 本候选审查不能代替发布后真实HTML两入口复测，正式结果写独立release.json |

## 最终结论

结论：通过

候选局部验证通过；正式发布与两入口硬门禁仍须对应新SHA核验。

## 变更覆盖与验证

### 受管文件

- `vite.config.ts`

### 页面证据

- 版本：89da92566c32896d892d5f2251673c8c429c0d1d加本次priority条件；本工作树真实生产预览5531，Chromium149.0.7827.55，Asia/Jakarta，真实时钟、原静态任务与空隔离IndexedDB。每次新上下文冷HTTP缓存，未改用户网络。
- 证据：output/ppic-two-entry-20261020/online-1792458980504/result.json、daily.png、member.png；候选HTTPS online-1792458950218/result.json；asset-equivalence.json、preload-contract.json。初次ENFILE构建失败未算通过。

### 性能结论

- 结论：通过
- 依据：本地2类10有效样本各≤1000ms；同网络原资产HTTPS候选2类10有效样本各≤1000ms。终点保持内容、必要图片、有限动画及两次绘制；成员通过原已有登录上下文隔离夹具读取，不变更产品身份逻辑。正式未验结果不得复用为已发布通过。

### 验证命令

- `node output/ppic-two-entry-20261020/preload-contract.mjs`：通过
- `PPIC_RELEASE_SHA=89da92566c32896d892d5f2251673c8c429c0d1d node output/ppic-two-entry-20261020/check-candidate.mjs`：通过
- `PPIC_PERF_ORIGIN=http://127.0.0.1:5531 PPIC_RELEASE_SHA=89da92566c32896d892d5f2251673c8c429c0d1d node output/ppic-two-entry-20261020/check.mjs`：通过

### 例外

- 无

最终技术收据冻结本记录后生成：output/ppic-two-entry-20261020/task-receipt.json。发布SHA、Actions、原始HTML与两入口正式数据在独立发布记录登记。
