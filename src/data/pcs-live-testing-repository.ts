import {
  LIVE_PURPOSE_META,
  SESSION_STATUS_META,
  getLiveSessionItems,
  listLiveSessions,
} from './pcs-testing.ts'
import type { LiveProductLine, LiveSessionRecord, LiveTestingStoreSnapshot } from './pcs-live-testing-types.ts'

const LIVE_TESTING_STORAGE_KEY = 'higood-pcs-live-testing-store-v1'
const LIVE_TESTING_STORE_VERSION = 1

let memorySnapshot: LiveTestingStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneSession(session: LiveSessionRecord): LiveSessionRecord {
  return {
    ...session,
    purposes: [...session.purposes],
  }
}

function cloneLine(line: LiveProductLine): LiveProductLine {
  return { ...line }
}

function cloneSnapshot(snapshot: LiveTestingStoreSnapshot): LiveTestingStoreSnapshot {
  return {
    version: snapshot.version,
    sessions: snapshot.sessions.map(cloneSession),
    productLines: snapshot.productLines.map(cloneLine),
  }
}

function toBusinessDate(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? ''
}

function parseSkuCodeSegments(skuCode: string): { colorCode: string; sizeCode: string } {
  const parts = skuCode.split('-').filter(Boolean)
  if (parts.length >= 2) {
    return {
      sizeCode: parts.at(-2) ?? '',
      colorCode: parts.at(-1) ?? '',
    }
  }
  return { colorCode: '', sizeCode: '' }
}

function buildSeedSnapshot(): LiveTestingStoreSnapshot {
  const sessions = listLiveSessions()
  const sessionRecords: LiveSessionRecord[] = sessions.map((session) => ({
    liveSessionId: session.id,
    liveSessionCode: session.id,
    sessionTitle: session.title,
    channelName: session.liveAccount,
    hostName: session.anchor,
    sessionStatus: SESSION_STATUS_META[session.status].label,
    businessDate: toBusinessDate(session.startAt),
    startedAt: session.startAt,
    endedAt: session.endAt ?? '',
    ownerName: session.owner,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    purposes: session.purposes.map((purpose) => LIVE_PURPOSE_META[purpose].label),
    itemCount: session.itemCount,
    testItemCount: session.testItemCount,
    testAccountingStatus: session.testAccountingStatus,
    gmvAmount: session.gmvTotal,
    legacyProjectRef: null,
    legacyProjectId: null,
  }))

  const extraSessionRecords: LiveSessionRecord[] = [
    {
      liveSessionId: 'LS-20260404-011',
      liveSessionCode: 'LS-20260404-011',
      sessionTitle: '轻量夹克测款直播专场',
      channelName: 'TikTok / 商品中心直播间',
      hostName: '家播-小南',
      sessionStatus: '已关账',
      businessDate: '2026-04-04',
      startedAt: '2026-04-04 19:30',
      endedAt: '2026-04-04 22:00',
      ownerName: '商品运营',
      createdAt: '2026-04-04 18:00',
      updatedAt: '2026-04-04 22:10',
      purposes: ['测款', '带货'],
      itemCount: 6,
      testItemCount: 2,
      testAccountingStatus: 'ACCOUNTED',
      gmvAmount: 31800,
      legacyProjectRef: null,
      legacyProjectId: null,
    },
    {
      liveSessionId: 'LS-20260405-014',
      liveSessionCode: 'LS-20260405-014',
      sessionTitle: '商务衬衫快反直播测试',
      channelName: 'TikTok / 快反直播间',
      hostName: '家播-阿峰',
      sessionStatus: '已关账',
      businessDate: '2026-04-05',
      startedAt: '2026-04-05 20:00',
      endedAt: '2026-04-05 22:30',
      ownerName: '快反运营',
      createdAt: '2026-04-05 18:40',
      updatedAt: '2026-04-05 22:40',
      purposes: ['测款'],
      itemCount: 5,
      testItemCount: 2,
      testAccountingStatus: 'ACCOUNTED',
      gmvAmount: 26400,
      legacyProjectRef: null,
      legacyProjectId: null,
    },
    {
      liveSessionId: 'LS-20260329-016',
      liveSessionCode: 'LS-20260329-016',
      sessionTitle: '波点雪纺连衣裙改版前测款',
      channelName: 'TikTok / 基础款直播间',
      hostName: '家播-小米',
      sessionStatus: '已关账',
      businessDate: '2026-03-29',
      startedAt: '2026-03-29 19:00',
      endedAt: '2026-03-29 21:20',
      ownerName: '商品企划',
      createdAt: '2026-03-29 17:30',
      updatedAt: '2026-03-29 21:30',
      purposes: ['测款'],
      itemCount: 4,
      testItemCount: 2,
      testAccountingStatus: 'ACCOUNTED',
      gmvAmount: 12600,
      legacyProjectRef: null,
      legacyProjectId: null,
    },
    {
      liveSessionId: 'LS-20260331-017',
      liveSessionCode: 'LS-20260331-017',
      sessionTitle: '牛仔机车短外套改版测款',
      channelName: 'Shopee / 改版测款直播间',
      hostName: '达人-Lia',
      sessionStatus: '已关账',
      businessDate: '2026-03-31',
      startedAt: '2026-03-31 20:00',
      endedAt: '2026-03-31 22:10',
      ownerName: '快反开发',
      createdAt: '2026-03-31 18:20',
      updatedAt: '2026-03-31 22:20',
      purposes: ['测款'],
      itemCount: 4,
      testItemCount: 1,
      testAccountingStatus: 'ACCOUNTED',
      gmvAmount: 11800,
      legacyProjectRef: null,
      legacyProjectId: null,
    },
    {
      liveSessionId: 'LS-20260403-020',
      liveSessionCode: 'LS-20260403-020',
      sessionTitle: '快反 POLO 衫市场复盘专场',
      channelName: 'TikTok / 快反直播间',
      hostName: '家播-阿峰',
      sessionStatus: '已关账',
      businessDate: '2026-04-03',
      startedAt: '2026-04-03 19:20',
      endedAt: '2026-04-03 21:30',
      ownerName: '快反运营',
      createdAt: '2026-04-03 18:10',
      updatedAt: '2026-04-03 21:35',
      purposes: ['测款'],
      itemCount: 3,
      testItemCount: 1,
      testAccountingStatus: 'ACCOUNTED',
      gmvAmount: 8300,
      legacyProjectRef: null,
      legacyProjectId: null,
    },
    {
      liveSessionId: 'LS-20260404-021',
      liveSessionCode: 'LS-20260404-021',
      sessionTitle: '都市西装马甲复盘直播',
      channelName: 'Shopee / 改版直播间',
      hostName: '达人-Mika',
      sessionStatus: '已关账',
      businessDate: '2026-04-04',
      startedAt: '2026-04-04 16:00',
      endedAt: '2026-04-04 18:10',
      ownerName: '改版运营',
      createdAt: '2026-04-04 15:00',
      updatedAt: '2026-04-04 18:20',
      purposes: ['测款'],
      itemCount: 3,
      testItemCount: 1,
      testAccountingStatus: 'ACCOUNTED',
      gmvAmount: 7600,
      legacyProjectRef: null,
      legacyProjectId: null,
    },
    {
      liveSessionId: 'LS-20260405-023',
      liveSessionCode: 'LS-20260405-023',
      sessionTitle: '男装休闲夹克淘汰复盘',
      channelName: 'TikTok / 男装测试直播间',
      hostName: '家播-阿力',
      sessionStatus: '已关账',
      businessDate: '2026-04-05',
      startedAt: '2026-04-05 18:50',
      endedAt: '2026-04-05 21:00',
      ownerName: '男装运营',
      createdAt: '2026-04-05 17:10',
      updatedAt: '2026-04-05 21:10',
      purposes: ['测款'],
      itemCount: 4,
      testItemCount: 1,
      testAccountingStatus: 'ACCOUNTED',
      gmvAmount: 5400,
      legacyProjectRef: null,
      legacyProjectId: null,
    },
    {
      liveSessionId: 'LS-20260405-024',
      liveSessionCode: 'LS-20260405-024',
      sessionTitle: '居家套装双渠道复盘直播',
      channelName: '微信小程序 / 居家品类直播间',
      hostName: '家播-小溪',
      sessionStatus: '已关账',
      businessDate: '2026-04-05',
      startedAt: '2026-04-05 14:10',
      endedAt: '2026-04-05 16:00',
      ownerName: '品类运营',
      createdAt: '2026-04-05 13:00',
      updatedAt: '2026-04-05 16:10',
      purposes: ['测款'],
      itemCount: 3,
      testItemCount: 1,
      testAccountingStatus: 'ACCOUNTED',
      gmvAmount: 4100,
      legacyProjectRef: null,
      legacyProjectId: null,
    },
    {
      liveSessionId: 'LS-20260406-025',
      liveSessionCode: 'LS-20260406-025',
      sessionTitle: '针织背心淘汰复盘直播',
      channelName: 'Shopee / 男装快反直播间',
      hostName: '达人-Ken',
      sessionStatus: '已关账',
      businessDate: '2026-04-06',
      startedAt: '2026-04-06 19:00',
      endedAt: '2026-04-06 20:40',
      ownerName: '男装快反',
      createdAt: '2026-04-06 18:10',
      updatedAt: '2026-04-06 20:45',
      purposes: ['测款'],
      itemCount: 3,
      testItemCount: 1,
      testAccountingStatus: 'ACCOUNTED',
      gmvAmount: 3900,
      legacyProjectRef: null,
      legacyProjectId: null,
    },
  ]

  const productLines: LiveProductLine[] = sessions.flatMap((session) =>
    getLiveSessionItems(session.id).map((item, index) => {
      const skuSegments = parseSkuCodeSegments(item.sku)
      return {
        liveLineId: `${session.id}__${item.id}`,
        liveLineCode: `${session.id}-L${String(index + 1).padStart(2, '0')}`,
        liveSessionId: session.id,
        liveSessionCode: session.id,
        lineNo: index + 1,
        productTitle: item.productName,
        styleCode: item.productRef,
        spuCode: item.productRef,
        skuCode: item.sku,
        colorCode: skuSegments.colorCode,
        sizeCode: skuSegments.sizeCode,
        exposureQty: item.exposure,
        clickQty: item.click,
        orderQty: item.order,
        gmvAmount: item.gmv,
        businessDate: toBusinessDate(session.startAt),
        ownerName: session.owner,
        sessionStatus: SESSION_STATUS_META[session.status].label,
        legacyProjectRef: item.projectRef,
        legacyProjectId: item.projectRef,
      }
    }),
  )

  const extraProductLines: LiveProductLine[] = [
    {
      liveLineId: 'LS-20260404-011__item-001',
      liveLineCode: 'LS-20260404-011-L01',
      liveSessionId: 'LS-20260404-011',
      liveSessionCode: 'LS-20260404-011',
      lineNo: 1,
      productTitle: '设计款户外轻量夹克',
      styleCode: 'SPU-JACKET-085',
      spuCode: 'SPU-JACKET-085',
      skuCode: 'SPU-JACKET-085-M-BLACK',
      colorCode: 'BLACK',
      sizeCode: 'M',
      exposureQty: 42100,
      clickQty: 3220,
      orderQty: 186,
      gmvAmount: 68640,
      businessDate: '2026-04-04',
      ownerName: '商品运营',
      sessionStatus: '已关账',
      legacyProjectRef: 'PRJ-20251216-013',
      legacyProjectId: 'PRJ-20251216-013',
    },
    {
      liveLineId: 'LS-20260405-014__item-001',
      liveLineCode: 'LS-20260405-014-L01',
      liveSessionId: 'LS-20260405-014',
      liveSessionCode: 'LS-20260405-014',
      lineNo: 1,
      productTitle: '快反商务修身长袖衬衫',
      styleCode: 'SPU-SHIRT-086',
      spuCode: 'SPU-SHIRT-086',
      skuCode: 'SPU-SHIRT-086-L-WHITE',
      colorCode: 'WHITE',
      sizeCode: 'L',
      exposureQty: 39800,
      clickQty: 2890,
      orderQty: 162,
      gmvAmount: 35478,
      businessDate: '2026-04-05',
      ownerName: '快反运营',
      sessionStatus: '已关账',
      legacyProjectRef: 'PRJ-20251216-014',
      legacyProjectId: 'PRJ-20251216-014',
    },
    {
      liveLineId: 'LS-20260329-016__item-001',
      liveLineCode: 'LS-20260329-016-L01',
      liveSessionId: 'LS-20260329-016',
      liveSessionCode: 'LS-20260329-016',
      lineNo: 1,
      productTitle: '基础款波点雪纺连衣裙改版',
      styleCode: 'SPU-2026-016',
      spuCode: 'SPU-2026-016',
      skuCode: 'SPU-2026-016-M-PINK',
      colorCode: 'PINK',
      sizeCode: 'M',
      exposureQty: 20800,
      clickQty: 1240,
      orderQty: 33,
      gmvAmount: 8217,
      businessDate: '2026-03-29',
      ownerName: '商品企划',
      sessionStatus: '已关账',
      legacyProjectRef: 'PRJ-20251216-016',
      legacyProjectId: 'PRJ-20251216-016',
    },
    {
      liveLineId: 'LS-20260331-017__item-001',
      liveLineCode: 'LS-20260331-017-L01',
      liveSessionId: 'LS-20260331-017',
      liveSessionCode: 'LS-20260331-017',
      lineNo: 1,
      productTitle: '改版牛仔机车短外套',
      styleCode: 'SPU-2026-017',
      spuCode: 'SPU-2026-017',
      skuCode: 'SPU-2026-017-L-BLUE',
      colorCode: 'BLUE',
      sizeCode: 'L',
      exposureQty: 19600,
      clickQty: 980,
      orderQty: 28,
      gmvAmount: 9212,
      businessDate: '2026-03-31',
      ownerName: '快反开发',
      sessionStatus: '已关账',
      legacyProjectRef: 'PRJ-20251216-017',
      legacyProjectId: 'PRJ-20251216-017',
    },
    {
      liveLineId: 'LS-20260403-020__item-001',
      liveLineCode: 'LS-20260403-020-L01',
      liveSessionId: 'LS-20260403-020',
      liveSessionCode: 'LS-20260403-020',
      lineNo: 1,
      productTitle: '快反 POLO 衫暂缓款',
      styleCode: 'SPU-2026-020',
      spuCode: 'SPU-2026-020',
      skuCode: 'SPU-2026-020-M-NAVY',
      colorCode: 'NAVY',
      sizeCode: 'M',
      exposureQty: 15200,
      clickQty: 650,
      orderQty: 19,
      gmvAmount: 3211,
      businessDate: '2026-04-03',
      ownerName: '快反运营',
      sessionStatus: '已关账',
      legacyProjectRef: 'PRJ-20251216-020',
      legacyProjectId: 'PRJ-20251216-020',
    },
    {
      liveLineId: 'LS-20260404-021__item-001',
      liveLineCode: 'LS-20260404-021-L01',
      liveSessionId: 'LS-20260404-021',
      liveSessionCode: 'LS-20260404-021',
      lineNo: 1,
      productTitle: '改版都市西装马甲暂缓款',
      styleCode: 'SPU-2026-021',
      spuCode: 'SPU-2026-021',
      skuCode: 'SPU-2026-021-L-GREY',
      colorCode: 'GREY',
      sizeCode: 'L',
      exposureQty: 11900,
      clickQty: 520,
      orderQty: 12,
      gmvAmount: 2748,
      businessDate: '2026-04-04',
      ownerName: '改版运营',
      sessionStatus: '已关账',
      legacyProjectRef: 'PRJ-20251216-021',
      legacyProjectId: 'PRJ-20251216-021',
    },
    {
      liveLineId: 'LS-20260405-023__item-001',
      liveLineCode: 'LS-20260405-023-L01',
      liveSessionId: 'LS-20260405-023',
      liveSessionCode: 'LS-20260405-023',
      lineNo: 1,
      productTitle: '基础款男装休闲夹克淘汰款',
      styleCode: 'SPU-2026-023',
      spuCode: 'SPU-2026-023',
      skuCode: 'SPU-2026-023-XL-BLACK',
      colorCode: 'BLACK',
      sizeCode: 'XL',
      exposureQty: 10800,
      clickQty: 410,
      orderQty: 9,
      gmvAmount: 2601,
      businessDate: '2026-04-05',
      ownerName: '男装运营',
      sessionStatus: '已关账',
      legacyProjectRef: 'PRJ-20251216-023',
      legacyProjectId: 'PRJ-20251216-023',
    },
    {
      liveLineId: 'LS-20260405-024__item-001',
      liveLineCode: 'LS-20260405-024-L01',
      liveSessionId: 'LS-20260405-024',
      liveSessionCode: 'LS-20260405-024',
      lineNo: 1,
      productTitle: '快反居家套装淘汰款',
      styleCode: 'SPU-2026-024',
      spuCode: 'SPU-2026-024',
      skuCode: 'SPU-2026-024-L-BEIGE',
      colorCode: 'BEIGE',
      sizeCode: 'L',
      exposureQty: 9200,
      clickQty: 360,
      orderQty: 8,
      gmvAmount: 1464,
      businessDate: '2026-04-05',
      ownerName: '品类运营',
      sessionStatus: '已关账',
      legacyProjectRef: 'PRJ-20251216-024',
      legacyProjectId: 'PRJ-20251216-024',
    },
    {
      liveLineId: 'LS-20260406-025__item-001',
      liveLineCode: 'LS-20260406-025-L01',
      liveSessionId: 'LS-20260406-025',
      liveSessionCode: 'LS-20260406-025',
      lineNo: 1,
      productTitle: '改版针织背心淘汰款',
      styleCode: 'SPU-2026-025',
      spuCode: 'SPU-2026-025',
      skuCode: 'SPU-2026-025-M-GREEN',
      colorCode: 'GREEN',
      sizeCode: 'M',
      exposureQty: 8700,
      clickQty: 315,
      orderQty: 6,
      gmvAmount: 894,
      businessDate: '2026-04-06',
      ownerName: '男装快反',
      sessionStatus: '已关账',
      legacyProjectRef: 'PRJ-20251216-025',
      legacyProjectId: 'PRJ-20251216-025',
    },
  ]

  return {
    version: LIVE_TESTING_STORE_VERSION,
    sessions: [...sessionRecords, ...extraSessionRecords],
    productLines: [...productLines, ...extraProductLines],
  }
}

function hydrateSnapshot(snapshot: LiveTestingStoreSnapshot): LiveTestingStoreSnapshot {
  return {
    version: LIVE_TESTING_STORE_VERSION,
    sessions: Array.isArray(snapshot.sessions) ? snapshot.sessions.map(cloneSession) : [],
    productLines: Array.isArray(snapshot.productLines) ? snapshot.productLines.map(cloneLine) : [],
  }
}

function loadSnapshot(): LiveTestingStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = buildSeedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(LIVE_TESTING_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = buildSeedSnapshot()
      localStorage.setItem(LIVE_TESTING_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<LiveTestingStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: LIVE_TESTING_STORE_VERSION,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions as LiveSessionRecord[] : buildSeedSnapshot().sessions,
      productLines: Array.isArray(parsed.productLines)
        ? parsed.productLines as LiveProductLine[]
        : buildSeedSnapshot().productLines,
    })
    localStorage.setItem(LIVE_TESTING_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = buildSeedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(LIVE_TESTING_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

export function getLiveTestingStoreSnapshot(): LiveTestingStoreSnapshot {
  return loadSnapshot()
}

export function listLiveSessionRecords(): LiveSessionRecord[] {
  return loadSnapshot().sessions.map(cloneSession)
}

export function getLiveSessionRecordById(liveSessionId: string): LiveSessionRecord | null {
  const record = loadSnapshot().sessions.find((item) => item.liveSessionId === liveSessionId)
  return record ? cloneSession(record) : null
}

export function listLiveProductLines(): LiveProductLine[] {
  return loadSnapshot().productLines.map(cloneLine)
}

export function listLiveProductLinesBySession(liveSessionId: string): LiveProductLine[] {
  return loadSnapshot()
    .productLines
    .filter((item) => item.liveSessionId === liveSessionId)
    .sort((a, b) => a.lineNo - b.lineNo)
    .map(cloneLine)
}

export function getLiveProductLineById(liveLineId: string): LiveProductLine | null {
  const line = loadSnapshot().productLines.find((item) => item.liveLineId === liveLineId)
  return line ? cloneLine(line) : null
}

export function resetLiveTestingRepository(): void {
  const snapshot = buildSeedSnapshot()
  memorySnapshot = snapshot
  if (canUseStorage()) {
    localStorage.removeItem(LIVE_TESTING_STORAGE_KEY)
    localStorage.setItem(LIVE_TESTING_STORAGE_KEY, JSON.stringify(snapshot))
  }
}
