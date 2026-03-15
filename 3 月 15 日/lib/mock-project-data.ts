// 完整的商品项目mock数据 - 基础款21个工作项
export const mockProjectData = {
  projectId: "prj_20251216_001",
  project: {
    id: "prj_20251216_001",
    name: "印尼风格碎花连衣裙",
    code: "PRJ-20251216-001",
    status: "进行中",
    styleType: "基础款",
    currentPhaseId: "phase_03",
    category: "裙装 / 连衣裙",
    tags: ["休闲", "甜美"],
    owner: "张丽",
    lastUpdated: "2025-12-15 12:30:30",
  },
  phases: [
    {
      id: "phase_01",
      no: "01",
      name: "立项获取",
      description: "项目立项与样衣获取（含深圳前置打版），确保版型/工艺稳定性。",
      items: ["wi_01", "wi_02", "wi_03"],
    },
    {
      id: "phase_02",
      no: "02",
      name: "评估定价",
      description: "闭合可行性、成本与定价，避免测款有效但毛利不可做。",
      items: ["wi_04", "wi_05", "wi_06", "wi_07", "wi_08"],
    },
    {
      id: "phase_03",
      no: "03",
      name: "市场测款",
      description: "短视频验证兴趣，直播验证转化；事实记录支持多实例。",
      items: ["wi_09", "wi_10", "wi_11", "wi_12"],
    },
    {
      id: "phase_04",
      no: "04",
      name: "结论与推进",
      description: "以测款结论判定为推进闸口，通过后解锁转档与制版准备。",
      items: ["wi_13", "wi_14", "wi_15", "wi_16", "wi_17", "wi_18", "wi_19"],
    },
    {
      id: "phase_05",
      no: "05",
      name: "资产处置",
      description: "样衣留存/退货处理按项目结论与资产策略执行。",
      items: ["wi_20", "wi_21"],
    },
  ],
  workItems: {
    wi_01: {
      id: "wi_01",
      name: "商品项目立项",
      nature: "执行类",
      status: "已完成",
      phaseId: "phase_01",
      owner: "张丽",
      createdAt: "2025-12-15 09:30:00",
      updatedAt: "2025-12-15 10:02:12",
      summary: {
        keyOutputs: [
          { label: "目标渠道", value: "TikTok / Shopee" },
          { label: "目标价位", value: "IDR 149k-199k" },
          { label: "风险提示", value: "面料缩水风险待验证" },
        ],
        evidence: { attachments: 2, links: 1, records: 0 },
        latestRecords: [],
      },
      full: {
        sections: [
          {
            title: "立项信息",
            fields: [
              { k: "项目负责人", v: "张丽" },
              { k: "目标市场", v: "印尼" },
              { k: "目标渠道", v: "TikTok / Shopee" },
              { k: "款式类型", v: "基础款" },
              { k: "类目", v: "裙装 / 连衣裙" },
              { k: "风格标签", v: "休闲、甜美" },
              { k: "目标价位带", v: "IDR 149k-199k" },
              { k: "目标毛利要求", v: "≥ 45%" },
              { k: "里程碑目标", v: "完成测款后进入工程准备" },
            ],
          },
          {
            title: "风险与假设",
            fields: [
              { k: "关键风险", v: "面料缩水导致版型偏差；腰线位置可能影响受众" },
              { k: "验证方式", v: "试穿反馈 + 直播测款退换/差评观察" },
              { k: "备选策略", v: "若退换偏高，进入反馈改版（腰线/面料克重）" },
            ],
          },
        ],
        attachments: [
          { name: "立项说明.pdf", type: "file", time: "2025-12-15 09:45" },
          { name: "竞品对标.png", type: "file", time: "2025-12-15 09:50" },
        ],
        links: [{ name: "竞品链接", url: "https://example.com/comp_1" }],
        records: [],
        audit: [{ time: "2025-12-15 10:02", action: "标记完成", by: "张丽", note: "立项信息已补齐" }],
      },
    },
    wi_02: {
      id: "wi_02",
      name: "样衣获取（深圳前置打版）",
      nature: "执行类",
      status: "已完成",
      phaseId: "phase_01",
      owner: "王明",
      createdAt: "2025-12-15 09:40:00",
      updatedAt: "2025-12-15 10:35:00",
      summary: {
        keyOutputs: [
          { label: "样衣来源", value: "深圳前置打版" },
          { label: "样衣数量", value: "2 件" },
          { label: "关键改动", value: "腰线收省、袖口松量调整" },
        ],
        evidence: { attachments: 3, links: 0, records: 1 },
        latestRecords: [{ title: "获取记录", meta: "打版完成并发出", time: "2025-12-15 10:20" }],
      },
      full: {
        sections: [
          {
            title: "获取需求",
            fields: [
              { k: "获取方式", v: "深圳前置打版" },
              { k: "样衣目的", v: "用于试穿 + 测款" },
              { k: "尺码范围", v: "S/M" },
              { k: "数量", v: "2" },
              { k: "交期要求", v: "≤ 2 天" },
              { k: "关键改动点", v: "腰线收省、袖口松量调整" },
            ],
          },
          {
            title: "供应与费用",
            fields: [
              { k: "打版方", v: "深圳版房 A" },
              { k: "费用", v: "CNY 260" },
              { k: "物流方式", v: "顺丰" },
              { k: "运单号", v: "SF123456" },
            ],
          },
        ],
        attachments: [
          { name: "打版需求单.docx", type: "file", time: "2025-12-15 09:55" },
          { name: "尺寸表.xlsx", type: "file", time: "2025-12-15 09:56" },
          { name: "参考图.png", type: "file", time: "2025-12-15 09:58" },
        ],
        links: [],
        records: [
          {
            id: "rec_wi02_1",
            cols: { 动作: "完成打版并发出", 结果: "已发货", 备注: "预计次日到样" },
            time: "2025-12-15 10:20",
          },
        ],
        audit: [{ time: "2025-12-15 10:35", action: "标记完成", by: "王明", note: "样衣已发出" }],
      },
    },
    wi_03: {
      id: "wi_03",
      name: "到样入库与核对",
      nature: "执行类",
      status: "已完成",
      phaseId: "phase_01",
      owner: "样管-李娜",
      createdAt: "2025-12-15 10:50:00",
      updatedAt: "2025-12-15 11:10:10",
      summary: {
        keyOutputs: [
          { label: "入库样衣", value: "2 件（S/M）" },
          { label: "核对结果", value: "无缺件" },
          { label: "样衣编号", value: "SY-INA-001 / SY-INA-002" },
        ],
        evidence: { attachments: 1, links: 0, records: 2 },
        latestRecords: [{ title: "入库记录", meta: "已完成入库与尺码核对", time: "2025-12-15 11:08" }],
      },
      full: {
        sections: [
          {
            title: "入库信息",
            fields: [
              { k: "入库时间", v: "2025-12-15 11:08" },
              { k: "入库仓", v: "深圳样衣仓" },
              { k: "签收人", v: "样管-李娜" },
              { k: "运单号", v: "SF123456" },
            ],
          },
        ],
        attachments: [{ name: "入库签收单.png", type: "file", time: "2025-12-15 11:08" }],
        links: [],
        records: [
          {
            id: "in_1",
            cols: { 样衣编号: "SY-INA-001", 尺码: "S", 数量: "1", 核对: "通过" },
            time: "2025-12-15 11:08",
          },
          {
            id: "in_2",
            cols: { 样衣编号: "SY-INA-002", 尺码: "M", 数量: "1", 核对: "通过" },
            time: "2025-12-15 11:08",
          },
        ],
        audit: [{ time: "2025-12-15 11:10", action: "标记完成", by: "样管-李娜", note: "入库核对完成" }],
      },
    },
    wi_04: {
      id: "wi_04",
      name: "初步可行性判断",
      nature: "决策类",
      status: "已完成",
      phaseId: "phase_02",
      owner: "张丽",
      createdAt: "2025-12-15 11:15:00",
      updatedAt: "2025-12-15 11:25:00",
      summary: {
        keyOutputs: [
          { label: "结论", value: "通过（进入拍摄与测款）" },
          { label: "关键风险", value: "面料缩水、腰线位置需试穿确认" },
          { label: "建议", value: "优先直播测款验证转化" },
        ],
        evidence: { attachments: 0, links: 0, records: 1 },
        latestRecords: [{ title: "决策记录", meta: "通过", time: "2025-12-15 11:24" }],
      },
      full: {
        sections: [
          {
            title: "评估维度",
            fields: [
              { k: "市场匹配", v: "印尼连衣裙需求稳定；碎花风格有热度" },
              { k: "供应可行", v: "版房可快速复刻；面料可替代" },
              { k: "成本空间", v: "核价后确认毛利空间≥45%" },
              { k: "风险点", v: "缩水率与腰线位置影响退换" },
            ],
          },
          {
            title: "决策",
            fields: [
              { k: "结论", v: "通过" },
              { k: "决策备注", v: "先短视频验证兴趣，再直播验证转化" },
              { k: "下一步", v: "进入样衣拍摄与试穿" },
            ],
          },
        ],
        attachments: [],
        links: [],
        records: [{ id: "d1", cols: { 结论: "通过", 备注: "进入拍摄与测款" }, time: "2025-12-15 11:24" }],
        audit: [{ time: "2025-12-15 11:25", action: "做出决策", by: "张丽", note: "通过" }],
      },
    },
    wi_05: {
      id: "wi_05",
      name: "样衣拍摄与试穿",
      nature: "执行类",
      status: "已完成",
      phaseId: "phase_02",
      owner: "内容-赵云",
      createdAt: "2025-12-15 11:30:00",
      updatedAt: "2025-12-15 12:00:00",
      summary: {
        keyOutputs: [
          { label: "素材产出", value: "图 25 张 / 视频 3 条" },
          { label: "试穿要点", value: "腰线偏高，S码更贴合" },
          { label: "卖点提炼", value: "显瘦腰线、碎花氛围感" },
        ],
        evidence: { attachments: 6, links: 0, records: 1 },
        latestRecords: [{ title: "试穿反馈", meta: "建议腰线下移 1cm（可选）", time: "2025-12-15 11:58" }],
      },
      full: {
        sections: [
          {
            title: "拍摄信息",
            fields: [
              { k: "拍摄地点", v: "深圳摄影棚 2 号" },
              { k: "模特", v: "IDN 模特图替换（预案）；本次内拍" },
              { k: "产出", v: "图片 25、视频 3" },
              { k: "主图建议", v: "侧身显瘦 + 腰线特写" },
            ],
          },
          {
            title: "试穿反馈",
            fields: [
              { k: "S码", v: "更贴合，腰线略高" },
              { k: "M码", v: "肩部略松，整体可接受" },
              { k: "可选优化", v: "腰线下移 1cm（进入可选改版点）" },
            ],
          },
        ],
        attachments: [
          { name: "试穿照片.zip", type: "file", time: "2025-12-15 11:55" },
          { name: "试穿视频1.mp4", type: "file", time: "2025-12-15 11:56" },
          { name: "试穿视频2.mp4", type: "file", time: "2025-12-15 11:57" },
          { name: "试穿视频3.mp4", type: "file", time: "2025-12-15 11:58" },
          { name: "卖点提炼.txt", type: "file", time: "2025-12-15 11:59" },
          { name: "主图建议.png", type: "file", time: "2025-12-15 12:00" },
        ],
        links: [],
        records: [
          { id: "fit_1", cols: { 结论: "可上测", 问题: "腰线略高", 建议: "进入可选改版点" }, time: "2025-12-15 11:58" },
        ],
        audit: [{ time: "2025-12-15 12:00", action: "标记完成", by: "内容-赵云", note: "素材已交付" }],
      },
    },
    wi_06: {
      id: "wi_06",
      name: "样衣确认",
      nature: "决策类",
      status: "已完成",
      phaseId: "phase_02",
      owner: "张丽",
      createdAt: "2025-12-15 12:02:00",
      updatedAt: "2025-12-15 12:05:00",
      summary: {
        keyOutputs: [
          { label: "确认结论", value: "确认通过" },
          { label: "需关注点", value: "缩水率入测款观察" },
          { label: "备注", value: "腰线优化列为后续可选改版点" },
        ],
        evidence: { attachments: 1, links: 0, records: 1 },
        latestRecords: [{ title: "决策记录", meta: "确认通过", time: "2025-12-15 12:04" }],
      },
      full: {
        sections: [
          {
            title: "确认依据",
            fields: [
              { k: "试穿反馈", v: "腰线略高但可接受；S码贴合" },
              { k: "内容呈现", v: "卖点清晰：显瘦腰线/碎花氛围感" },
              { k: "风险点", v: "缩水率待验证" },
            ],
          },
          {
            title: "决策",
            fields: [
              { k: "结论", v: "确认通过" },
              { k: "备注", v: "腰线下移 1cm 列为可选改版点，不阻塞测款" },
            ],
          },
        ],
        attachments: [{ name: "确认截图.png", type: "file", time: "2025-12-15 12:04" }],
        links: [],
        records: [{ id: "d2", cols: { 结论: "通过", 备注: "可上测款" }, time: "2025-12-15 12:04" }],
        audit: [{ time: "2025-12-15 12:05", action: "做出决策", by: "张丽", note: "确认通过" }],
      },
    },
    wi_07: {
      id: "wi_07",
      name: "样衣核价",
      nature: "执行类",
      status: "已完成",
      phaseId: "phase_02",
      owner: "核价-周强",
      createdAt: "2025-12-15 12:06:00",
      updatedAt: "2025-12-15 12:15:00",
      summary: {
        keyOutputs: [
          { label: "核价成本", value: "IDR 78k" },
          { label: "主要成本项", value: "面料 52% / 辅料 18%" },
          { label: "建议毛利", value: "≥ 45%" },
        ],
        evidence: { attachments: 1, links: 0, records: 1 },
        latestRecords: [{ title: "核价记录", meta: "成本测算完成", time: "2025-12-15 12:14" }],
      },
      full: {
        sections: [
          {
            title: "成本分解",
            type: "table",
            columns: ["成本项", "占比", "金额（IDR）"],
            rows: [
              ["面料", "52%", "40,560"],
              ["辅料", "18%", "14,040"],
              ["工费", "20%", "15,600"],
              ["包装与杂费", "10%", "7,800"],
            ],
          },
          {
            title: "核价结论",
            fields: [
              { k: "核价成本", v: "IDR 78k" },
              { k: "建议毛利", v: "≥ 45%" },
              { k: "风险提示", v: "若面料克重提升，成本上浮约 6%-8%" },
            ],
          },
        ],
        attachments: [{ name: "核价单.xlsx", type: "file", time: "2025-12-15 12:14" }],
        links: [],
        records: [{ id: "c1", cols: { 核价成本: "IDR 78k", 备注: "成本测算完成" }, time: "2025-12-15 12:14" }],
        audit: [{ time: "2025-12-15 12:15", action: "标记完成", by: "核价-周强", note: "核价完成" }],
      },
    },
    wi_08: {
      id: "wi_08",
      name: "样衣定价",
      nature: "决策类",
      status: "已完成",
      phaseId: "phase_02",
      owner: "张丽",
      createdAt: "2025-12-15 12:16:00",
      updatedAt: "2025-12-15 12:20:00",
      summary: {
        keyOutputs: [
          { label: "定价", value: "IDR 179k" },
          { label: "促销策略", value: "首播券后 169k" },
          { label: "目标转化", value: "≥ 3.5%" },
        ],
        evidence: { attachments: 0, links: 0, records: 1 },
        latestRecords: [{ title: "决策记录", meta: "定价确认", time: "2025-12-15 12:19" }],
      },
      full: {
        sections: [
          {
            title: "定价方案",
            fields: [
              { k: "标价", v: "IDR 179k" },
              { k: "券后价", v: "IDR 169k" },
              { k: "目标转化率", v: "≥ 3.5%" },
              { k: "目标退款率", v: "≤ 3%" },
            ],
          },
          {
            title: "毛利测算（简表）",
            type: "table",
            columns: ["项", "值"],
            rows: [
              ["核价成本（IDR）", "78k"],
              ["券后价（IDR）", "169k"],
              ["粗略毛利率（估算）", "约 54%"],
            ],
          },
        ],
        attachments: [],
        links: [],
        records: [{ id: "p1", cols: { 定价: "179k", 券后: "169k", 备注: "首播促销" }, time: "2025-12-15 12:19" }],
        audit: [{ time: "2025-12-15 12:20", action: "做出决策", by: "张丽", note: "定价确认" }],
      },
    },
    wi_09: {
      id: "wi_09",
      name: "短视频测款",
      nature: "执行类",
      status: "已完成",
      phaseId: "phase_03",
      owner: "内容-赵云",
      createdAt: "2025-12-14 18:00:00",
      updatedAt: "2025-12-15 12:25:00",
      isMultiInstance: true,
      summary: {
        keyOutputs: [
          { label: "总曝光", value: "148,200" },
          { label: "点击率", value: "2.9%" },
          { label: "收藏率", value: "1.1%" },
        ],
        evidence: { attachments: 2, links: 2, records: 2 },
        latestRecords: [
          { title: "视频 A", meta: "曝光 92k / CTR 3.1%", time: "2025-12-14 20:10" },
          { title: "视频 B", meta: "曝光 56k / CTR 2.6%", time: "2025-12-15 09:40" },
        ],
      },
      multiInstance: {
        kpis: [
          { label: "曝光", value: "148,200" },
          { label: "CTR", value: "2.9%" },
          { label: "加购", value: "1,120" },
          { label: "评论", value: "326" },
        ],
        records: [
          {
            id: "sv1",
            title: "短视频 A",
            sub: "碎花氛围感",
            time: "2025-12-14 20:10",
            metrics: "曝光 92k / CTR 3.1% / 加购 760",
          },
          {
            id: "sv2",
            title: "短视频 B",
            sub: "显瘦腰线",
            time: "2025-12-15 09:40",
            metrics: "曝光 56k / CTR 2.6% / 加购 360",
          },
        ],
      },
      full: {
        sections: [
          {
            title: "汇总指标",
            fields: [
              { k: "总曝光", v: "148,200" },
              { k: "CTR", v: "2.9%" },
              { k: "加购", v: "1,120" },
              { k: "评论", v: "326" },
            ],
          },
        ],
        attachments: [
          { name: "短视频A.mp4", type: "file", time: "2025-12-14 20:10" },
          { name: "短视频B.mp4", type: "file", time: "2025-12-15 09:40" },
        ],
        links: [
          { name: "视频A链接", url: "https://example.com/svA" },
          { name: "视频B链接", url: "https://example.com/svB" },
        ],
        records: [
          {
            id: "sv1",
            cols: { 标题: "短视频A", 主题: "碎花氛围感", 曝光: "92k", CTR: "3.1%", 加购: "760", 评论: "210" },
            time: "2025-12-14 20:10",
          },
          {
            id: "sv2",
            cols: { 标题: "短视频B", 主题: "显瘦腰线", 曝光: "56k", CTR: "2.6%", 加购: "360", 评论: "116" },
            time: "2025-12-15 09:40",
          },
        ],
        audit: [{ time: "2025-12-15 12:25", action: "标记完成", by: "内容-赵云", note: "短视频测款记录已补齐" }],
      },
    },
    wi_10: {
      id: "wi_10",
      name: "商品上架",
      nature: "执行类",
      status: "已完成",
      phaseId: "phase_03",
      owner: "电商-陈杰",
      createdAt: "2025-12-15 12:21:00",
      updatedAt: "2025-12-15 12:26:30",
      summary: {
        keyOutputs: [
          { label: "上架平台", value: "TikTok / Shopee" },
          { label: "目标店铺", value: "TikTok@IDN_01；Shopee@IDN_A" },
          { label: "商品状态", value: "已上架" },
        ],
        evidence: { attachments: 0, links: 2, records: 1 },
        latestRecords: [{ title: "上架结果", meta: "2 店铺上架成功", time: "2025-12-15 12:26" }],
      },
      full: {
        sections: [
          {
            title: "上架配置",
            fields: [
              { k: "平台", v: "TikTok / Shopee" },
              { k: "店铺（多选）", v: "TikTok@IDN_01；Shopee@IDN_A" },
              { k: "价格", v: "标价 179k；券后 169k" },
              { k: "库存策略", v: "小库存试卖（每店 50）" },
            ],
          },
          {
            title: "上架结果",
            type: "table",
            columns: ["平台", "店铺", "状态", "商品ID/链接"],
            rows: [
              ["TikTok", "IDN_01", "成功", "https://example.com/tk_goods_1"],
              ["Shopee", "IDN_A", "成功", "https://example.com/sp_goods_1"],
            ],
          },
        ],
        attachments: [],
        links: [
          { name: "TikTok商品", url: "https://example.com/tk_goods_1" },
          { name: "Shopee商品", url: "https://example.com/sp_goods_1" },
        ],
        records: [{ id: "list_1", cols: { 结果: "2 店铺上架成功", 备注: "用于直播测款" }, time: "2025-12-15 12:26" }],
        audit: [{ time: "2025-12-15 12:26", action: "标记完成", by: "电商-陈杰", note: "上架成功" }],
      },
    },
    wi_11: {
      id: "wi_11",
      name: "样衣寄送与周转",
      nature: "执行类",
      status: "进行中",
      phaseId: "phase_03",
      owner: "样管-李娜",
      createdAt: "2025-12-14 10:00:00",
      updatedAt: "2025-12-15 12:28:00",
      isMultiInstance: true,
      summary: {
        keyOutputs: [
          { label: "周转次数", value: "3 次" },
          { label: "当前所在", value: "印尼直播间（雅加达）" },
          { label: "风险提示", value: "SY-INA-002 归还待确认" },
        ],
        evidence: { attachments: 0, links: 0, records: 3 },
        latestRecords: [
          { title: "寄送 #3", meta: "深圳 → 雅加达直播间", time: "2025-12-15 12:10" },
          { title: "寄送 #2", meta: "摄影棚 → 仓库", time: "2025-12-14 22:30" },
          { title: "寄送 #1", meta: "仓库 → 摄影棚", time: "2025-12-14 10:20" },
        ],
      },
      multiInstance: {
        kpis: [
          { label: "周转记录", value: "3" },
          { label: "在途", value: "1" },
          { label: "已签收", value: "2" },
          { label: "异常", value: "1" },
        ],
        records: [
          {
            id: "tr3",
            title: "寄送 #3",
            sub: "深圳 → 雅加达直播间",
            time: "2025-12-15 12:10",
            metrics: "状态 在途 / 运单 SF123456",
          },
          {
            id: "tr2",
            title: "寄送 #2",
            sub: "摄影棚 → 仓库",
            time: "2025-12-14 22:30",
            metrics: "状态 已签收 / SY-INA-001",
          },
          {
            id: "tr1",
            title: "寄送 #1",
            sub: "仓库 → 摄影棚",
            time: "2025-12-14 10:20",
            metrics: "状态 已签收 / SY-INA-001,002",
          },
        ],
      },
      full: {
        sections: [
          {
            title: "周转汇总",
            fields: [
              { k: "周转记录数", v: "3" },
              { k: "在途", v: "1" },
              { k: "已签收", v: "2" },
              { k: "异常", v: "1（归还待确认）" },
            ],
          },
        ],
        attachments: [],
        links: [],
        records: [
          {
            id: "tr1",
            cols: { 动作: "寄送", 从: "深圳仓", 到: "摄影棚", 样衣: "SY-INA-001,002", 状态: "已签收" },
            time: "2025-12-14 10:20",
          },
          {
            id: "tr2",
            cols: { 动作: "归还", 从: "摄影棚", 到: "深圳仓", 样衣: "SY-INA-001", 状态: "已签收" },
            time: "2025-12-14 22:30",
          },
          {
            id: "tr3",
            cols: { 动作: "寄送", 从: "深圳仓", 到: "雅加达直播间", 样衣: "SY-INA-001", 状态: "在途" },
            time: "2025-12-15 12:10",
          },
        ],
        audit: [{ time: "2025-12-15 12:28", action: "新增记录", by: "样管-李娜", note: "寄送至雅加达直播间" }],
      },
    },
    wi_12: {
      id: "wi_12",
      name: "直播测款",
      nature: "执行类",
      status: "进行中",
      phaseId: "phase_03",
      owner: "主播团队",
      createdAt: "2025-12-14 18:30:00",
      updatedAt: "2025-12-15 12:30:30",
      isMultiInstance: true,
      summary: {
        keyOutputs: [
          { label: "场次", value: "3 场（2 完成 / 1 进行中）" },
          { label: "总销量", value: "376 件" },
          { label: "转化率", value: "4.2%（高于平均）" },
        ],
        evidence: { attachments: 0, links: 1, records: 3 },
        latestRecords: [
          { title: "场次 3", meta: "进行中 / 预计 21:00 结束", time: "2025-12-15 19:00" },
          { title: "场次 2", meta: "完成 / 销量 200", time: "2025-12-14 21:00" },
          { title: "场次 1", meta: "完成 / 销量 156", time: "2025-12-14 21:00" },
        ],
      },
      multiInstance: {
        kpis: [
          { label: "场次 1 销量", value: "156" },
          { label: "场次 2 销量", value: "200" },
          { label: "场次 3 销量", value: "20" },
          { label: "转化率", value: "4.2%" },
        ],
        records: [
          {
            id: "ls1",
            title: "场次 1",
            sub: "FIOLA ARTA GLORYA S",
            time: "12 月 14 日 19:00-21:00",
            metrics: "销量 156 / 转化 4.1% / 退款 2.3%",
          },
          {
            id: "ls2",
            title: "场次 2",
            sub: "FIOLA ARTA GLORYA S",
            time: "12 月 14 日 19:00-21:00",
            metrics: "销量 200 / 转化 4.3% / 退款 2.1%",
          },
          {
            id: "ls3",
            title: "场次 3",
            sub: "FIOLA ARTA GLORYA S",
            time: "12 月 15 日 19:00-21:00",
            metrics: "进行中 / 当前销量 20 / 当前转化 4.2%",
          },
        ],
      },
      full: {
        sections: [
          {
            title: "汇总指标",
            fields: [
              { k: "总销量", v: "376" },
              { k: "转化率", v: "4.2%" },
              { k: "退款率", v: "2.2%" },
              { k: "差评率", v: "0.5%" },
            ],
          },
        ],
        attachments: [],
        links: [{ name: "直播回放", url: "https://example.com/live_replay" }],
        records: [
          {
            id: "ls1",
            cols: {
              场次: "场次 1",
              主播: "FIOLA",
              时段: "12月14日 19:00-21:00",
              销量: "156",
              转化: "4.1%",
              退款: "2.3%",
            },
            time: "2025-12-14 21:00",
          },
          {
            id: "ls2",
            cols: {
              场次: "场次 2",
              主播: "FIOLA",
              时段: "12月14日 19:00-21:00",
              销量: "200",
              转化: "4.3%",
              退款: "2.1%",
            },
            time: "2025-12-14 21:00",
          },
          {
            id: "ls3",
            cols: { 场次: "场次 3", 主播: "FIOLA", 时段: "12月15日 19:00-21:00", 销量: "20", 转化: "4.2%", 退款: "-" },
            time: "2025-12-15 19:00",
          },
        ],
        audit: [{ time: "2025-12-15 12:30", action: "状态更新", by: "系统", note: "场次 3 进行中" }],
      },
    },
    wi_13: {
      id: "wi_13",
      name: "测款结论判定",
      nature: "决策类",
      status: "待决策",
      phaseId: "phase_04",
      owner: "张丽",
      createdAt: "2025-12-15 12:30:00",
      updatedAt: "2025-12-15 12:30:30",
      summary: {
        keyOutputs: [
          { label: "建议结论", value: "待定（依据直播/短视频汇总）" },
          { label: "关键证据", value: "直播转化 4.2% / 销量 376" },
          { label: "下一步", value: "通过解锁工程准备；改版生成改版任务" },
        ],
        evidence: { attachments: 0, links: 1, records: 0 },
        latestRecords: [],
      },
      full: {
        sections: [
          {
            title: "测款汇总",
            fields: [
              { k: "短视频曝光", v: "148,200" },
              { k: "短视频CTR", v: "2.9%" },
              { k: "直播销量", v: "376" },
              { k: "直播转化", v: "4.2%" },
              { k: "退款率", v: "2.2%" },
            ],
          },
          {
            title: "决策选项",
            fields: [
              { k: "通过", v: "解锁工程准备（转档、制版、打样）" },
              { k: "改版", v: "生成改版任务（腰线调整），改版后重新测款" },
              { k: "淘汰", v: "终止项目，样衣进入退货处理" },
            ],
          },
        ],
        attachments: [],
        links: [{ name: "测款数据汇总", url: "https://example.com/test_summary" }],
        records: [],
        audit: [],
      },
    },
    wi_14: {
      id: "wi_14",
      name: "商品项目转档",
      nature: "执行类",
      status: "未解锁",
      phaseId: "phase_04",
      owner: "档案-王芳",
      createdAt: "",
      updatedAt: "-",
      summary: {
        keyOutputs: [{ label: "提示", value: "等待测款结论判定通过后解锁" }],
        evidence: { attachments: 0, links: 0, records: 0 },
        latestRecords: [],
      },
      full: { sections: [], attachments: [], links: [], records: [], audit: [] },
    },
    wi_15: {
      id: "wi_15",
      name: "改版任务",
      nature: "执行类",
      status: "未解锁",
      phaseId: "phase_04",
      owner: "版师-刘工",
      createdAt: "",
      updatedAt: "-",
      summary: {
        keyOutputs: [
          { label: "触发条件", value: "测款结论=改版时生成（反馈改版）" },
          { label: "当前状态", value: "未触发" },
        ],
        evidence: { attachments: 0, links: 0, records: 0 },
        latestRecords: [],
      },
      full: { sections: [], attachments: [], links: [], records: [], audit: [] },
    },
    wi_16: {
      id: "wi_16",
      name: "制版准备-打版任务",
      nature: "执行类",
      status: "未解锁",
      phaseId: "phase_04",
      owner: "版师-刘工",
      createdAt: "",
      updatedAt: "-",
      summary: {
        keyOutputs: [{ label: "提示", value: "等待测款结论判定通过后解锁" }],
        evidence: { attachments: 0, links: 0, records: 0 },
        latestRecords: [],
      },
      full: { sections: [], attachments: [], links: [], records: [], audit: [] },
    },
    wi_17: {
      id: "wi_17",
      name: "制版准备-花型任务",
      nature: "执行类",
      status: "未解锁",
      phaseId: "phase_04",
      owner: "花型-安娜",
      createdAt: "",
      updatedAt: "-",
      summary: {
        keyOutputs: [{ label: "提示", value: "等待测款结论判定通过后解锁" }],
        evidence: { attachments: 0, links: 0, records: 0 },
        latestRecords: [],
      },
      full: { sections: [], attachments: [], links: [], records: [], audit: [] },
    },
    wi_18: {
      id: "wi_18",
      name: "首单样衣打样",
      nature: "执行类",
      status: "未解锁",
      phaseId: "phase_04",
      owner: "跟单-小周",
      createdAt: "",
      updatedAt: "-",
      summary: {
        keyOutputs: [{ label: "提示", value: "等待测款结论判定通过后解锁" }],
        evidence: { attachments: 0, links: 0, records: 0 },
        latestRecords: [],
      },
      full: { sections: [], attachments: [], links: [], records: [], audit: [] },
    },
    wi_19: {
      id: "wi_19",
      name: "产前版样衣",
      nature: "执行类",
      status: "未解锁",
      phaseId: "phase_04",
      owner: "跟单-小周",
      createdAt: "",
      updatedAt: "-",
      summary: {
        keyOutputs: [{ label: "提示", value: "等待测款结论判定通过后解锁" }],
        evidence: { attachments: 0, links: 0, records: 0 },
        latestRecords: [],
      },
      full: { sections: [], attachments: [], links: [], records: [], audit: [] },
    },
    wi_20: {
      id: "wi_20",
      name: "样衣留存与库存",
      nature: "执行类",
      status: "未解锁",
      phaseId: "phase_05",
      owner: "样管-李娜",
      createdAt: "",
      updatedAt: "-",
      summary: {
        keyOutputs: [{ label: "提示", value: "待项目推进完成后执行" }],
        evidence: { attachments: 0, links: 0, records: 0 },
        latestRecords: [],
      },
      full: { sections: [], attachments: [], links: [], records: [], audit: [] },
    },
    wi_21: {
      id: "wi_21",
      name: "样衣退货与处理",
      nature: "执行类",
      status: "未解锁",
      phaseId: "phase_05",
      owner: "采购-王明",
      createdAt: "",
      updatedAt: "-",
      summary: {
        keyOutputs: [{ label: "提示", value: "待项目推进完成/淘汰后执行" }],
        evidence: { attachments: 0, links: 0, records: 0 },
        latestRecords: [],
      },
      full: { sections: [], attachments: [], links: [], records: [], audit: [] },
    },
  },
  logs: [
    {
      time: "2025-12-15 12:30:30",
      type: "状态变更",
      title: "项目状态：测款数据更新",
      detail: "直播场次 3 进行中，当前转化 4.2%",
    },
    {
      time: "2025-12-15 12:26:30",
      type: "工作项",
      title: "完成工作项：商品上架",
      detail: "已在 TikTok@IDN_01、Shopee@IDN_A 上架",
    },
    { time: "2025-12-15 12:20:00", type: "决策", title: "决策：样衣定价", detail: "定价 IDR 179k；券后 169k" },
    { time: "2025-12-15 12:05:00", type: "决策", title: "决策：样衣确认", detail: "确认通过；腰线优化列为可选改版点" },
    { time: "2025-12-15 11:25:00", type: "决策", title: "决策：初步可行性判断", detail: "通过（进入拍摄与测款）" },
    {
      time: "2025-12-15 11:10:10",
      type: "工作项",
      title: "完成工作项：到样入库与核对",
      detail: "SY-INA-001 / SY-INA-002 入库完成",
    },
  ],
}

export type WorkItem = (typeof mockProjectData.workItems)[keyof typeof mockProjectData.workItems]
export type Phase = (typeof mockProjectData.phases)[number]

export function getProjectData(projectId: string) {
  if (projectId === mockProjectData.projectId || projectId === "prj_20251216_001") {
    return mockProjectData
  }
  return null
}

export function getWorkItemInstance(projectId: string, workItemId: string) {
  const projectData = getProjectData(projectId)
  if (!projectData) return null
  return projectData.workItems[workItemId as keyof typeof projectData.workItems] || null
}

export function getPhaseWorkItems(projectData: typeof mockProjectData, phaseId: string) {
  const phase = projectData.phases.find((p) => p.id === phaseId)
  if (!phase) return []
  return phase.items.map((id) => projectData.workItems[id as keyof typeof projectData.workItems]).filter(Boolean)
}
