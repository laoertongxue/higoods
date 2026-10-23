/** Route-level lace reads prepare the shared record rows lazily; the shell must
 * not pull the PCS record core or the whole lace domain into startup. */
export async function withLaceRecords<T>(render: () => T): Promise<Awaited<T>> {
  const { withLaceFactoryRecords } = await import('../data/fcs/lace-factory-records.ts')
  return withLaceFactoryRecords(render)
}
