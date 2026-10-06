# HG 样衣标签对抗审查

审查范围：HG-001～009；只读审查代理 hg_label_review；主代理负责实现、浏览器、PDF、性能与最终 diff。

| 发现 | 修正 | 复核证据 | 状态 |
|---|---|---|---|
| P1 原始 SKU 可绕过 HG 门禁；缺编号回退原 SKU | completeLabelStep 只接受 resolve HG；无编号返回空；贴码底层要求 HG 身份 | unit-scoped-final + browser-final 原 SKU / 错 HG 阻断 | 已关闭 |
| P1 旧 SKU 无 identities 字段，再次到样使用新日期 | 两个注册入口共用最早入库事实；入库台账时间固定 sampleInboundAt | 单元旧资料回归；审查代理无落盘探针删除 registeredAt，仅旧入库台账仍取08-01；legacy-registration 浏览器5轮 | 已关闭 |
| P2 详情贴码记录显示 SKU，被误认为条码内容 | 显示实际 HG、对应 SKU、贴码时间；删除“码值=SKU”说明 | 主代理页面与源 diff；审查代理二次复核 | 已关闭 |

二次只读复核未发现本次修正引入的新阻断。没有用子代理的通过报告替代实际浏览器验证；验证原始数据位于 evidence。实体纸张与打印机未纳入本次已验证结论。
