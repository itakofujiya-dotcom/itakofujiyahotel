export const publicNavigation = [
  { label: '客室', to: '/rooms' },
  { label: '館内施設', to: '/facilities' },
  { label: 'アクセス', to: '/access' },
  { label: '周辺観光', to: '/sightseeing' },
  { label: 'よくある質問', to: '/faq' },
] as const

export const adminNavigation = [
  { label: 'ダッシュボード', to: '/admin' },
  { label: '予約管理', to: '/admin/reservations' },
  { label: '客室管理', to: '/admin/rooms' },
  { label: '料金管理', to: '/admin/rates' },
  { label: '基本設定', to: '/admin/settings' },
] as const
