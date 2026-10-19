import { DEDICATED_POST_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'

export function isPostFinishingFactoryId(factoryId: string): boolean {
  return factoryId === DEDICATED_POST_FACTORY_ID || factoryId === 'ID-F002'
}

export function renderAccessoryPostFactoryAccessBlock(): string {
  return `<main class="min-h-screen bg-slate-100 p-4" data-managed-accessory-post-access-blocked><section class="rounded-xl border border-amber-300 bg-white p-4"><h1 class="font-semibold">后道辅料收货</h1><p role="alert" class="mt-3 text-sm">当前账号不属于后道工厂，不能办理这张辅料调拨。</p><a href="/fcs/pda/handover?tab=pickup" class="mt-4 inline-flex min-h-11 items-center rounded border px-3 text-sm">返回本厂交接</a></section></main>`
}
