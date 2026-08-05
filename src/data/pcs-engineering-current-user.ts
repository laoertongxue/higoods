export interface PcsEngineeringCurrentUser {
  userId: string
  userName: string
  role: '跟单'
}

// 原型统一使用的当前登录跟单身份；页面只读展示，不允许业务人员自由填写操作身份。
export const CURRENT_PCS_ENGINEERING_USER: PcsEngineeringCurrentUser = {
  userId: 'U-MERCH-LINXIAO',
  userName: '跟单-林晓',
  role: '跟单',
}
