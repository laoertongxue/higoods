# 商品与物料档案菜单收起修复

依据 `AGENTS.md` REVIEW-01。

## 基本信息
- 日期：2026-10-23
- 任务 / 需求编号：修复“商品&物料档案”在当前子页面下无法收起
- 验证人：Codex

## 影响判定
- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：侧栏嵌套菜单展开 / 收起动作改变，按 T3 验证。未设置手动状态时按当前子页面默认展开；手动状态优先，第一次点击按实际显示状态取反。
- 范围：`renderMenuItem` 与 `AppStore.toggleItem` 共用的侧栏交互；不改变页面路由、页签、业务事实、数据结构或持久化。无需演示业务数据重建及版本绑定收据。
- 工作区已有其他任务差异；本次仅修改下列受管文件，另新增专项测试和本记录，保留其他差异。

## 自查结论
| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 原始失败复现 | 通过 | 修复前，在 `/pcs/products/styles` 点击“商品&物料档案”，子菜单仍有 1 个款式档案入口；`output/playwright/menu-collapse/before.png`。最小失败契约也在首次点击处失败。 |
| 当前页面的父菜单可收起并再次展开 | 通过 | 两种桌面尺寸各 5 次收起、5 次展开，子入口显隐与 `aria-expanded` 一致；当前地址、主内容节点及 localStorage 均保持不变。 |
| 首次进入、刷新及无选中子项的菜单 | 通过 | 刷新自动展开当前父菜单；专项测试遍历各系统所有有子项菜单，覆盖带查询和锚点的子页面、首次收起及再次展开；非当前“系统设置”默认收起，可展开 / 收起。 |
| 直接相邻路径 | 通过 | 侧栏宽窄切换保留手动收起；390×844 的移动菜单可收起并重新展开；既有打印外壳及 WLS 导航测试通过。 |
| 可操作与可读 | 通过 | 1366×768、1280×720 实际截图检查；Enter 收起、Space 展开，两种桌面尺寸均通过。390×844 检查同一渲染路径的小屏菜单。 |
| 保存、库存、上下游业务与附件 | 不适用 | 只改会话内展开状态和对应展示，不写业务存储或附件，不改变业务事实。 |

## 最终结论
结论：通过

## 受管文件
- `src/components/shell.ts`
- `src/state/store.ts`

## 页面证据
- 版本：分支 `main`，基准 HEAD `e3b7205b3cf0e6b84b19d9d9594992b85b484d00` 加本次工作区差异。
- 工作树 / 服务：`/Users/laoer/Documents/higoods`；已核对进程工作目录，使用既有 Vite `http://127.0.0.1:43221/pcs/products/styles`，未修改服务及构建配置。
- 时间 / 环境：2026-10-23 17:08:41（Asia/Shanghai）；macOS，Chrome 155.0.8059.85，Node v26.8.2，本地开发环境，无网络节流。本次未验证发布环境或冷启动速度。
- 源码 SHA256：`src/components/shell.ts` = `664d8425e6033ddeeb457041cd8298f3db83ecb3e9756b182d744047e0647e8d`；`src/state/store.ts` = `c607afc5f7bb1dbb8cf082914bd1a56edc8926a74a302f3a5d7af87421df3b92`。
- 专项测试：`tests/unit/shell-menu-expansion.test.ts`；SHA256 = `3d7c04e474a76f1160d655589f0a936093eb9c4c0bfadc8bd2d1a1271981f80f`。
- 证据：在 `/pcs/products/styles` 点击菜单可收起 / 展开，Enter / Space 可操作，页面与存储保持原样；本地截图为 `output/playwright/menu-collapse/after-1366-collapsed.png`、`after-1366-expanded.png`、`after-1280-collapsed.png`、`after-1280-expanded.png`、`after-mobile-expanded.png`，均位于同一证据目录。
- 原始结果：`output/playwright/menu-collapse/performance.json`、`verification.txt`、`neighbors.txt`；复现与脚本位于同一目录。截图及原始结果为本地忽略文件，本记录保留版本、原始数值及结论。

## 性能结论
- 结论：通过
- 依据：实际点击捕获事件为起点；菜单展开状态及子入口显隐就绪后等待两次绘制帧为终点，并在操作后核验实际可见性。最大值 48.5ms，全部有效样本 <=1000ms。
- 每种桌面尺寸分别记录展开和收起，各 5 个样本。菜单项和图标固定，主内容未重绘，其他系统同类菜单以同一事件、状态及渲染路径为代表；其功能另由遍历契约覆盖。
- 数据：沿用隔离浏览器所见现有静态结果 54 条，当前页仅渲染 20 条；未新增或扩量 Mock，未操作业务记录。侧栏动作不遍历或重绘业务列表，样本只覆盖侧栏。未进行容量或全列表验收。

| 尺寸 / 操作 | 原始值（ms，显示到 0.1ms） |
| --- | --- |
| 1366×768 收起 | 29.2、46.4、46.4、46.3、47.6 |
| 1366×768 展开 | 45.5、46.9、47.4、48.3、47.1 |
| 1280×720 收起 | 47.8、46.9、47.1、46.3、47.8 |
| 1280×720 展开 | 47.5、48.5、47.8、47.3、46.8 |

- 脚本校准：首次校准错误假定筛选后总量为 28，实际仍是 54，等待条件超时，未产生正式样本，保留 `calibration-invalid.txt`。首次完成的操作回放未返回原始数值，保留 `verification-no-results.txt`，未作为正式性能证据；改为返回结果后完成以上有效采样。无有效超时样本被删除或改写。
- 冷启动、刷新耗时不适用：本次只改侧栏点击状态及显示优先级；刷新仅验证默认展开行为，未声称加载性能通过。

## 验证命令
- `node --import tsx --test tests/unit/shell-menu-expansion.test.ts tests/unit/shell-print-path.test.ts tests/unit/wls-menu-navigation.test.ts`：通过
- `npm run typecheck:state`：通过
- `git diff --check -- src/components/shell.ts src/state/store.ts tests/unit/shell-menu-expansion.test.ts`：通过

## 例外
- 渐进类型检查确认 `src/state/` 错误为 0；全仓仍有 19 项既有错误，未声称全仓类型检查或构建通过。
- 本次未提交、推送或部署；未代填用户接受。
