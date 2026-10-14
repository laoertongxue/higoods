import { renderGarmentInventoryPage } from './page.ts'

export const garmentInventoryWlsRoutes = [
  {
    path: '/wls/online/garment-inventory',
    render: () => renderGarmentInventoryPage(),
  },
]
