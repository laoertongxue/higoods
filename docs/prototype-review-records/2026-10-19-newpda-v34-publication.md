# 中央工厂 PDA V34 独立目录发布审查

## 基本信息

- 日期：2026-10-19
- 任务 / 需求编号：NEWPDA-PUBLISH-V34；用户要求发布到 higood.12lab.cn/newpda/
- 验证人：Codex 主代理；1 个独立只读发布包审查代理。技术验证不代替用户接受。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：新增独立静态入口 /newpda/ 与 /newpda/board.html，承载用户已审阅的 V34 设计。既有 src/、根 index.html、构建与部署配置均不修改。仅发布副本默认进入接收，更新其缓存参数与公开说明；业务逻辑和示例数据沿用 V34。
- 范围与阶段：T3 + T5；完成静态打包与本地验证后沿用现有 main → GitHub Actions → Caddy。此记录不预填 Production 成功；最终 SHA、run_id 和 HTTPS 字节核对由发布后证据记录。
- 非范围：实际业务后端、测试站数据库、原 PDA 页面、业务状态机、新权限或数据存储。没有真实工厂业务发生。

## 需求与实施对应

| 编号 | 用户要求 / 原子结果 | 实际位置 | 验证 | 状态 |
|---|---|---|---|---|
| NP-01 | 独立入口默认接收 | public/newpda/app.js、index.html | 本地生产预览直接打开 /newpda/ 显示账号、接收和三模块 | 已验证 |
| NP-02 | V34 总览与命名页面可访问 | public/newpda/board.html 及 36 个运行文件 | 153 个 HTML 引用均存在；JS 语法通过；25 个页面样本 | 已验证 |
| NP-03 | 图片与 V34 对应 | 18 个 assets 与 3 个展示截图 | 原图字节沿用；加载后 naturalWidth 非零 | 已验证 |
| NP-04 | 发布目录不含无关历史证据 | public/newpda 全部 60 个文件 | 独立清单复核无多余、无缺少；无本机地址、外部服务请求 | 已验证 |
| NP-05 | 不更改既有业务源码或部署配置 | 最终任务 diff | 只有 public/newpda 和本发布记录 / 核验摘要 | 已验证 |
| NP-06 | 用户域名真实上线 | main / Deploy Caddy Production / deployment.json | 推送后核对完整 SHA、run_id、资源字节及真实页面 | 待实施 |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
|---|---|---|
| 独立路径和缺失资源 | 通过 | 所有页面、图片、样式及脚本相对引用留在 /newpda/，构建 dist 中 60 文件与 public 逐字节一致 |
| 数量、单位、状态、交接 | 通过 | 业务运行逻辑沿用 V34；源设计 114 项专项及浏览器证据保持原版本。发布差异只有 4 个入口 / 说明文件，无收发逻辑变化 |
| 浏览器数据边界 | 通过 | 设计只使用内存；无 fetch/XHR/WebSocket、localStorage、sessionStorage、IndexedDB，不读取或写入正式站业务数据 |
| 图片 | 通过 | 18 张正式对象素材原样发布，当前命名页面图片加载通过；原有盘扣等缺图限制沿用 V34 记录，不冒充新素材已补齐 |
| 小屏与语言 | 通过 | 360×744，默认接收、印花、水溶、绣花印尼语及总览，均无横向溢出；语言切换保留子路径 |
| 部署契约 | 通过 | 54 项现有部署契约通过；服务器部署配置与接收器未修改 |
| 本地构建 | 通过 | TypeScript 检查、1190 项单测及 Vite 构建通过；public/dist 60 文件一致 |
| 打印 / 实物扫码枪 | 不适用 | 本次是既有独立点击稿发布，无打印修改及硬件接入 |

## 最终结论

结论：通过

以上为待发布静态包及本地验证结论。Production 成功单独以 Actions、HTTPS 清单与线上操作登记，不在此预填。

## 变更覆盖与验证

### 受管文件

- `public/newpda/V34连续作业核查.html`
- `public/newpda/app.js`
- `public/newpda/assets/accessory-button.jpg`
- `public/newpda/assets/accessory-elastic-band.jpg`
- `public/newpda/assets/accessory-label.jpg`
- `public/newpda/assets/blue-white-print-cotton.png`
- `public/newpda/assets/cardigan-sample.jpg`
- `public/newpda/assets/cotton-yarn-cone.jpg`
- `public/newpda/assets/fabric-contrast.jpg`
- `public/newpda/assets/fog-grey-rib-knit.png`
- `public/newpda/assets/grey-zip-hoodie.png`
- `public/newpda/assets/pleated-white.jpg`
- `public/newpda/assets/rope-real-bundle.jpg`
- `public/newpda/assets/rose-cotton-jersey.png`
- `public/newpda/assets/tip-plastic-aglet.jpg`
- `public/newpda/assets/tip-silicone-dip.jpg`
- `public/newpda/assets/webbing-real-roll.jpg`
- `public/newpda/assets/white-cotton-jersey.jpg`
- `public/newpda/assets/white-poplin.png`
- `public/newpda/assets/white-water-soluble-lace-12-15mm.jpg`
- `public/newpda/aux-special-accessory-flow.css`
- `public/newpda/aux-special-accessory-flow.js`
- `public/newpda/board.html`
- `public/newpda/continuous-input.js`
- `public/newpda/cutting-flow.css`
- `public/newpda/cutting-flow.js`
- `public/newpda/device-session.css`
- `public/newpda/device-session.js`
- `public/newpda/dye-print-wash-flow.css`
- `public/newpda/dye-print-wash-flow.js`
- `public/newpda/floor-flow.css`
- `public/newpda/floor-flow.js`
- `public/newpda/handoff-context.js`
- `public/newpda/index.html`
- `public/newpda/knit-link-flow.css`
- `public/newpda/knit-link-flow.js`
- `public/newpda/locale-id-terms.js`
- `public/newpda/locale-preview.js`
- `public/newpda/post-flow.css`
- `public/newpda/post-flow.js`
- `public/newpda/sewing-return.css`
- `public/newpda/sewing-return.js`
- `public/newpda/style.css`
- `public/newpda/v3.js`
- `public/newpda/v4-warehouse.css`
- `public/newpda/v4-warehouse.js`
- `public/newpda/v4.css`
- `public/newpda/v4.js`
- `public/newpda/v5-warehouse.css`
- `public/newpda/v5-warehouse.js`
- `public/newpda/v6-warehouse.css`
- `public/newpda/v6-warehouse.js`
- `public/newpda/v7-warehouse.css`
- `public/newpda/v7-warehouse.js`
- `public/newpda/verification/v34/execution-zh.png`
- `public/newpda/verification/v34/finished-zh.png`
- `public/newpda/verification/v34/receive-zh.png`
- `public/newpda/warehouse-location-catalog.js`
- `public/newpda/water-binding-flow.css`
- `public/newpda/water-binding-flow.js`

### 页面证据

- 版本：基准 main 90092818e0d12c5d1b97a07d33bc9850b7d2914a；分支 codex/publish-newpda-v34；工作树 publish-newpda-v34/higoods；运行 http://127.0.0.1:48335/newpda/，Vite production preview；逐文件哈希绑定见 docs/deployment/newpda-v34-publication-checks.json。
- 证据：同文件记录 25 个实际页面加载样本；截图 output/playwright/newpda-publication/local-receive.png。各命名路由页面、图片、控制台、资源请求及宽度均核对。最初临时 Python 服务出现单次脚本加载不完整，保留原始记录；正式本地验证固定为现有 Vite 生产预览，所有 25 样本无错误，未修改设计业务代码。原始证据位于独立设计目录 verification/publish-v34。

### 性能结论

- 结论：通过
- 依据：本地 Vite 生产预览、Chrome、Asia/Shanghai、360×744、各样本独立无缓存 context；从导航开始至实际内容、图片 decode、两帧绘制结束。默认接收、总览、印花、水溶、绣花各 5 样本共 25 项，最大 190.3ms；无样本超过 1000ms。公网首载在发布后另测，不混用本地数值。

### 验证命令

- `npm run build`：通过
- `python3 -m unittest discover -s tests/deploy -v`：通过
- `node --check public/newpda/*.js（逐文件执行）`：通过
- `Playwright CLI local production preview checks`：通过

### 例外

- 仅可点击设计预览，不连接真实业务；刷新重置内存示例，与 V34 一致。原有现场母语及扫码枪验收边界保留。
- 所有静态发布范围文件独立存放；正式站浏览器数据不作迁移、清理或读取。
