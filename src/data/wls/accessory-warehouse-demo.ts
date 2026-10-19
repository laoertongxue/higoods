import { buildAccessoryWarehouseUpstreamFixtures } from './accessory-warehouse-upstream-fixtures.ts'

/** 只读演示来源，分别由需求、生产单和运行任务原拥有模块采用。 */
export const ACCESSORY_WAREHOUSE_DEMOS = buildAccessoryWarehouseUpstreamFixtures({ materialAssets: {
  价格吊牌: '/materials/accessory-flow/price-tag.jpg',
  品牌吊牌: '/materials/accessory-flow/brand-tag.jpg',
  吊粒: '/materials/accessory-flow/tag-fastener.png',
} })
