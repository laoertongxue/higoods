import type { RouteRegistry } from './route-types.ts'

export async function renderCentralPdaEntry(pathname: string): Promise<string> {
  // These pages prepare their own receiving/order records and failure recovery.
  // Do not let unrelated collections or cutting tickets fail before that page.
  if (/^\/fcs\/pda\/central\/(?:lace|webbing|post|wool|wool-craft|dye|print)(?:\/|$)/.test(pathname.split('?')[0])) {
    return (await import('../pages/central-pda/entry.ts')).renderCentralPdaPage(pathname)
  }
  await (await import('../data/pcs-record-runtime.ts')).ensurePcsRecordState()
  await (await import('../data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords()
  return (await import('../pages/central-pda/entry.ts')).renderCentralPdaPage(pathname)
}

export const routes: RouteRegistry = {
  exactRoutes: Object.fromEntries(['receive', 'execute', 'warehouse'].map(tab => [`/fcs/pda/central/${tab}`, renderCentralPdaEntry])),
  dynamicRoutes: [
    { pattern: /^\/fcs\/pda\/central\/lace\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/webbing\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/post\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/post\/sewing-return$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/binding\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/wool-craft\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/wool\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/cut\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/(receive|execute|warehouse)\/([^/]+)$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/dye\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/water\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/print\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
    { pattern: /^\/fcs\/pda\/central\/wash\/(receive|execute|warehouse)(?:\/([^/]+))?$/, render: match => renderCentralPdaEntry(match[0]) },
  ],
}
