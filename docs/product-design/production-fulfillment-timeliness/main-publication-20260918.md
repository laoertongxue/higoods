# 2026-09-18 main 合并说明

本次按用户明确指令合并当前 DDS 生产与履约时效原型进本地及 GitHub main。属于当前进展发布，不将产品矩阵、图片或业务缺口改成验收通过。

- 原任务基础：4804328a822eec3c77eee1ffa5b10911bb77c9fe；发布集成基础：bbde0ffd1be5624dfdf388462e4fe3f52ce380bb。
- 155个原任务文件限定复制；原工作区 AGENTS.md 及其他工作树保留，不进入提交。
- index.html、src/main.ts 保留 main 的技术包预加载及局部 Tab 切换，同时合入 DDS 预加载与事件处理；其余新增/修改仅按当前需求及对应性能检查范围。
- 需求范围见 requirements-matrix.csv 每行编号及当前状态。当前327条：180已实现待验证、144实施中、3不适用；ACT77条仍实施中。V4-GRAPH/BLOCK/DOC/UI/DATA/SOURCE/PERF/REVIEW 的本轮证据不替代全业务完成。

## 证据

- 合并前final5原始证据已纳入 output/playwright/dds-pf-v4-final5、dds-pf-v4-final5-source-entry、dds-pf-v4-final5-material-bridge；保留final3/final4失败报告，不改写原始数值。
- final5 source-manifest.json 的note字段遗留了final4字样；64文件hash、build元信息及combined正式报告为实际final5，原始注释保留，此处澄清。
- 合并后构建、专项检查、页面与技术收据分别写入 output/playwright/dds-main-publication-20260918；合并前性能证据不冒称合并后结果。
- 产品核查结论继续以2026-09-18-dds-production-fulfillment-v4.md为准：对应图片及部分完整来源链路尚未齐备，整体未结项。Git提交和推送不等于生产部署或产品验收通过。

## 附件归档格式

四份历史测量脚本保留原字节为 `.mjs.txt`，移除末尾`.txt`即可复现；原JSON的脚本哈希仍对应这些字节。它们是历史快照，不作为当前应用源码参与CodeGraph。四份旧构建日志的可读版本只去掉行尾空格；完整原始字节同时保存于 `.log.raw.gz`。逐文件映射与SHA256见 output/playwright/dds-main-publication-20260918/archive-map.json。原始数值、失败样本与当前运行脚本均未改动。


## 合并回归发现与修正

第一轮合并后测试保留在 `merged-browser/combined-verification.json`：配置冷入 204ms、执行任务来源点击 215.7ms、PCS BOM 冷入4次超200ms，均判失败。物料首入因测量脚本的多标题严格定位失败，修正定位后独立补测，不改写原报告。

诊断显示既有 PCS/FCS 来源被和 DDS 页面装入同一3.3MB业务包。仅调整 `vite.config.ts` 的既有分包边界：DDS页面目录独立为 production-timeliness，其余复用来源为 production-source-shared，并同步预压缩；数据、页面、单据事实和事件处理不改动。DDS页面包降为约460KB，其他来源页面不再引用DDS页面模块。修正后的独立复测结果以 `merged-browser-split` 为准，历史失败不覆盖。


## 本次发布结论（不是产品结项）

修正后定向回归：255个主脚本样本、12组功能检查及15次真实来源点击无功能错误；网络边界确认 PCS、FCS execution 和物料首入不再加载 DDS 页面块。性能结论仍为 **失败**，保留9个超限原始样本：总览冷入336.1ms；execution冷入279/259.5/254.4/253.5/259.2ms；PCS专项冷入233.8/219/221.2ms。PCS浏览器内完整内容就绪测量和旧专项自动化回读时间有差异，二者原样保留，不能据此删除专项失败。

用户本次明确要求把当前工作合入并推送main，因此仅进行Git进展发布。**性能硬门禁、图片及业务来源缺口没有通过，模块总体仍未结项，不标记已验证、delivered或accepted。** 技术命令收据只记录构建等命令结果，不能替代上述浏览器和产品结论。后续需继续修复冷启动耗时并重测。
