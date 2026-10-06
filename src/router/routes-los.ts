import type { RouteRegistry } from './route-types.ts'
const render = async (id='',view='list') => (await import('../pages/los-live-rooms.ts')).renderLosLiveRoomPage(id,view)
export const routes: RouteRegistry = {
  exactRoutes: {
    '/los/live-room': () => render(),
    '/los/live-room/new': () => render('','edit'),
  },
  dynamicRoutes: [
    {pattern:/^\/los\/live-room\/([^/]+)\/edit$/,render:m=>render(decodeURIComponent(m[1]),'edit')},
    {pattern:/^\/los\/live-room\/([^/]+)\/label$/,render:m=>render(decodeURIComponent(m[1]),'label')},
    {pattern:/^\/los\/live-room\/([^/]+)$/,render:m=>render(decodeURIComponent(m[1]),'detail')},
  ],
}
