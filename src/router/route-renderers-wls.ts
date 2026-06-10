type AnyAsyncRenderer = (...args: unknown[]) => Promise<string>

function createAsyncRenderer<TArgs extends unknown[]>(
  importModule: () => Promise<Record<string, unknown>>,
  exportName: string,
): (...args: TArgs) => Promise<string> {
  let modulePromise: Promise<Record<string, unknown>> | null = null

  return async (...args: TArgs): Promise<string> => {
    if (!modulePromise) {
      modulePromise = importModule().catch((error) => {
        modulePromise = null
        throw error
      })
    }

    const module = await modulePromise
    const renderer = module[exportName]

    if (typeof renderer !== 'function') {
      throw new Error(`页面渲染函数不存在: ${exportName}`)
    }

    return (renderer as AnyAsyncRenderer)(...args)
  }
}

export const renderWlsTransferMaterialPrepPage = createAsyncRenderer(
  () => import('../pages/wls/transfer-material-prep'),
  'renderWlsTransferMaterialPrepPage',
)

export const renderWlsTransferMaterialPrepDetailPage = createAsyncRenderer(
  () => import('../pages/wls/transfer-material-prep'),
  'renderWlsTransferMaterialPrepDetailPage',
)
