// 货权主体/法人实体

export interface LegalEntity {
  id: string
  name: string
  countryCode: string
  currency: string
}

export const legalEntities: LegalEntity[] = [
  {
    id: 'LE-001',
    name: 'PT HIGOOD LIVE JAKARTA',
    countryCode: 'ID',
    currency: 'IDR',
  },
  {
    id: 'LE-002',
    name: 'HiGOOD LIVE Limited',
    countryCode: 'HK',
    currency: 'USD',
  },
  {
    id: 'LE-003',
    name: 'PT HIGOOD INDONESIA',
    countryCode: 'ID',
    currency: 'IDR',
  },
]
