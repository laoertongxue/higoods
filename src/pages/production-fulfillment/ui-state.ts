import type { StandardListColumnPreferences, StandardListSortState } from '../../components/ui/list-table-model'
import type { PFFilters } from './model'
export const base = '/dds/supply-chain/production-fulfillment'
export const sections: Record<string,string> = { overview:'时效总览', tasks:'生产任务', 'follow-up':'我的跟单', 'work-items':'工作项监控', teams:'团队与工厂', fulfillment:'订单履约分析', configuration:'规则与配置', examples:'规则验证示例' }
export function emptyFilters(): PFFilters { return {query:'',health:'全部',follower:'全部',stage:'全部',team:'全部',factory:'全部',region:'全部',supplyMode:'全部',scope:'在途',dateField:'生效到期',dateFrom:'',dateTo:'',issuesOnly:false} }
export interface ViewState {
  section: string; taskId: string; teamId: string; draft: PFFilters; filters: PFFilters;
  page: number; more: boolean; sort: StandardListSortState | null; prefs: StandardListColumnPreferences;
  role: string; user: string; detailTab: string; timelineMode: string; timelineScale: string;
  collapsed: string[]; showChildren: boolean; showDependencies: boolean; selectedNode: string;
  notice: string; fullscreen: boolean; fulfillmentMode: string; timezone: string; version: string;
  analysisView: string; overviewTab: string; teamTab: string; filterOpen: boolean; detailSubTab: string;
  workTab: string; exampleId: string; timelineTeam: string; timelineBasis: string;
  dependencyScope?: '全部工作' | '卡点与影响'; dependencyZoom?: number;
}
export const ui: ViewState = {section:'overview', taskId:'',teamId:'',draft:emptyFilters(),filters:emptyFilters(),page:1,more:false,sort:null,prefs:{order:[],visibleKeys:[],frozenKeys:[],pageSize:20},role:'供应链管理',user:'管理员',detailTab:'全程时效',timelineMode:'全部工作',timelineScale:'日',collapsed:[],showChildren:false,showDependencies:false,selectedNode:'',notice:'',fullscreen:false,fulfillmentMode:'发货行',timezone:'Asia/Shanghai',version:'当前生效',analysisView:'分布',overviewTab:'运行概况',teamTab:'可执行工作',filterOpen:false,detailSubTab:'',workTab:'时效与数量',exampleId:'BOM',timelineTeam:'全部',timelineBasis:'当前标准'}
