# 中央工厂 PDA V34 图片与首屏性能修正

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01。

## 基本信息

- 日期：2026-10-20
- 任务 / 需求编号：NEWPDA-PERF-V34 / NP-P01～NP-P05；承接用户“继续”与上轮首屏性能未通过项
- 验证人：Codex 主代理；技术验证不代替用户接受

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：在最新 main 89da92566c32896d892d5f2251673c8c429c0d1d 上，只调整 public/newpda 的公共图片输出和 app 资源版本。此前后道等业务更新完整保留。原始18图逐字节不改，新增对应320px预览和原像素尺寸高清WebP，通过picture选择编码；未知图片继续读取原文件。普通卡片懒加载，放大即时加载。
- 目标与非目标：修正过渡页面下载大图及卡片原图传输；不改收发数量、工序、按钮、角色、状态、草稿、存储或根站路由；不连接数据库。T3 + T5。
- CodeGraph：该静态稿未在 context 中返回，直接读取明确静态文件完成核查；工作树已从上一版快进到最新 main 并同步索引。

## 发布前主分支整合

- 验证期间 main 前进到 3540514b18eed844abfeb73a12ee04c4a15aa33e，新增 PPIC 日报预加载优先级调整。已快进整合，未修改其代码；public/newpda 的既有业务文件没有变化。
- 保留89da9256基准的原始页面与性能证据，不冒称重跑；在3540514b基准重新构建并生成技术收据，随后核对 dist/newpda 与本任务源码逐文件一致。

## 需求、计划与原子矩阵

| 编号 | 原子结果 | 实际文件 / 工作包 | 自动化与页面证据 | 状态 | 确认人 / 版本 |
|---|---|---|---|---|---|
| NP-P01 | 接收首页不下载过渡图片 | app.js productImage 懒加载 | local-diagnostic.txt：最终无图片且 imageRequests=[] | 已验证 | Codex / 基准89da9256+本任务哈希 |
| NP-P02 | 卡片图对应原对象且轻量 | app.js、assets/previews | 18源哈希及80项图片契约；168页面无图片报错 | 已验证 | Codex / 图清单绑定 |
| NP-P03 | 放大保留像素尺寸与关闭方式 | app.js、assets/display | 各图尺寸与原图相同；放大、Esc关闭、原图不变；局部截图 | 已验证 | Codex / 图清单绑定 |
| NP-P04 | 连续收发和印尼语输入保留 | 业务文件不改 | 输入6→看图→切语→返回续填仍6；6/14余量；超14阻断，随后收齐 | 已验证 | Codex / 当前本地预览 |
| NP-P05 | 线上冷启动及图片动作≤1000ms | main、Caddy | 待对应SHA发布后核对run_id、资源哈希、9家族各5样本 | 待实施 | 公网证据另记，不预填通过 |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
|---|---|---|
| 图片来源与对应 | 通过 | docs/deployment/newpda-image-delivery-20261020.json：18源文件SHA、尺寸、方向、生成参数与输出大小；原文件与基准Git版本逐字节相同，无裁切、无上采样、无替换内容 |
| 小图与大图 | 通过 | 卡片最大25,828字节；全尺寸18图合计2,605,982字节，最大436,938字节；WebP source和原文件fallback同时保留 |
| 入口启动 | 通过 | 当前公网基线无图首页仍下载1,956,488字节卫衣图，下载2329.5ms；本地修正后不再有此请求 |
| 页面、设备与印尼语 | 通过 | 当前UI实际28工序×接收/执行/仓管×320/360，共168状态，控制台无异常、无横向溢出，底部按钮均在744px视口内 |
| 数量与单位 | 通过 | 图片helper以外业务文件逐字节保持基准；连续操作保留原20片、实收6、剩14，超量检查未改数量，最后收齐；单位仍panel |
| 返回续填 / 语言 | 通过 | 看图关闭、切印尼语、返回后续填均保留6；已收齐后不保留空数量输入，记录仍可查看 |
| 放大布局与关闭 | 通过 | 360px实际截图 local-printing-large.png：原1448×1086全尺寸图、框内显示、Tutup与Esc可关闭，字段不丢失 |
| 图片未知 / 不支持编码 | 通过 | 实际源代码契约验证未知文件走原src；picture内保留原图img作为格式fallback |
| 存储 / 数据库 / 打印 | 不适用 | 只读静态图片与HTML；未增加业务存储、服务端接口、数据库或打印动作 |
| 历史失败保留 | 通过 | 上轮公网3～4.4s和本轮公网基线2587ms保留；Python临时预览出现1次3275ms，保留，不按平均值改成通过；正式本地预览采用项目Vite |

## 最终结论

结论：通过

以上为本地专项与待发布产物结论；Production与公网1秒验收在对应新SHA部署后单独记录。没有以本地时间冒充公网通过，也不代填用户验收。

## 变更覆盖与验证

### 受管文件

- `public/newpda/app.js`
- `public/newpda/index.html`
- `public/newpda/assets/display/accessory-button.jpg.webp`
- `public/newpda/assets/display/accessory-elastic-band.jpg.webp`
- `public/newpda/assets/display/accessory-label.jpg.webp`
- `public/newpda/assets/display/blue-white-print-cotton.png.webp`
- `public/newpda/assets/display/cardigan-sample.jpg.webp`
- `public/newpda/assets/display/cotton-yarn-cone.jpg.webp`
- `public/newpda/assets/display/fabric-contrast.jpg.webp`
- `public/newpda/assets/display/fog-grey-rib-knit.png.webp`
- `public/newpda/assets/display/grey-zip-hoodie.png.webp`
- `public/newpda/assets/display/pleated-white.jpg.webp`
- `public/newpda/assets/display/rope-real-bundle.jpg.webp`
- `public/newpda/assets/display/rose-cotton-jersey.png.webp`
- `public/newpda/assets/display/tip-plastic-aglet.jpg.webp`
- `public/newpda/assets/display/tip-silicone-dip.jpg.webp`
- `public/newpda/assets/display/webbing-real-roll.jpg.webp`
- `public/newpda/assets/display/white-cotton-jersey.jpg.webp`
- `public/newpda/assets/display/white-poplin.png.webp`
- `public/newpda/assets/display/white-water-soluble-lace-12-15mm.jpg.webp`
- `public/newpda/assets/previews/accessory-button.jpg.webp`
- `public/newpda/assets/previews/accessory-elastic-band.jpg.webp`
- `public/newpda/assets/previews/accessory-label.jpg.webp`
- `public/newpda/assets/previews/blue-white-print-cotton.png.webp`
- `public/newpda/assets/previews/cardigan-sample.jpg.webp`
- `public/newpda/assets/previews/cotton-yarn-cone.jpg.webp`
- `public/newpda/assets/previews/fabric-contrast.jpg.webp`
- `public/newpda/assets/previews/fog-grey-rib-knit.png.webp`
- `public/newpda/assets/previews/grey-zip-hoodie.png.webp`
- `public/newpda/assets/previews/pleated-white.jpg.webp`
- `public/newpda/assets/previews/rope-real-bundle.jpg.webp`
- `public/newpda/assets/previews/rose-cotton-jersey.png.webp`
- `public/newpda/assets/previews/tip-plastic-aglet.jpg.webp`
- `public/newpda/assets/previews/tip-silicone-dip.jpg.webp`
- `public/newpda/assets/previews/webbing-real-roll.jpg.webp`
- `public/newpda/assets/previews/white-cotton-jersey.jpg.webp`
- `public/newpda/assets/previews/white-poplin.png.webp`
- `public/newpda/assets/previews/white-water-soluble-lace-12-15mm.jpg.webp`

### 页面证据

- 版本：codex/publish-newpda-v34；基准89da92566c32896d892d5f2251673c8c429c0d1d；工作树 publish-newpda-v34/higoods；运行时SHA256在图片清单中绑定。
- 证据：独立设计目录 verification/performance-v34-20261020/。local-coverage.json记录168状态；local-vite-performance.json记录45冷加载及相应放大；continuity-stage1.txt、continuity-boundary-snapshot.txt、continuity-completed.txt记录真实操作。早期走查按旧按钮文案/数量零终态断言产生采集失败，输出保留；按实际“检查数量”和“已收齐”与操作记录重新核对。
- 服务：本地项目 Vite preview --outDir public，127.0.0.1:48338/newpda/；静态设计文件直接读取，不经过开发代码变换。公网Caddy目录跳转仍沿用此前实现，完整计时在发布后另验。

### 性能结论

- 结论：通过
- 依据：本地Vite预览，Chrome headed，Asia/Shanghai，360×744；每次独立无HTTP缓存context。从导航调用前计时，至真实内容、可见图片解码及两帧绘制结束；图片动作从真实点击至大图解码和两帧绘制结束。9家族各5次，最大冷加载377ms，最大放大145ms。公网性能待发布后单独核对。

| 家族 | 5次冷加载ms | 最大图片放大ms（0表示本页无图） |
|---|---|---|
| directory | 366, 242, 235, 377, 237 | 0 |
| receive | 232, 203, 204, 204, 262 | 0 |
| printing | 288, 194, 208, 245, 200 | 108 |
| dyeing | 262, 228, 265, 198, 254 | 145 |
| washing | 215, 321, 222, 211, 209 | 0 |
| water | 203, 197, 206, 209, 232 | 95 |
| embroidery | 247, 238, 186, 206, 223 | 94 |
| elastic | 222, 233, 204, 218, 290 | 97 |
| knitting | 202, 214, 296, 208, 245 | 97 |

### 验证命令

- `node --check public/newpda/app.js`：通过
- `node 独立设计目录/verification/performance-v34-20261020/image-contract.cjs 当前工作树`：通过
- `Playwright CLI local Vite cold load and image checks`：通过
- `Playwright CLI 28 operations × 3 tabs × 2 widths`：通过
- `Playwright CLI image/language/draft/partial-receipt continuity`：通过

### 例外

- 无。仅格式与尺寸转换，使用已存在的工作区Sharp0.35.5，不新增项目依赖；原图保留。未做真机或现场母语验收，不改变原型内存示例边界。
