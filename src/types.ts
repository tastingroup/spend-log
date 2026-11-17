export type Target = '나' | '선물' | '대리구매'
// 쇼핑: 상품 단위로 상세히 남기는 기록 / 생활: 긴축 챌린지 기간에 금액·카테고리만 남기는 기록
export type Kind = '쇼핑' | '생활'
export type Channel = '' | '오프라인' | '온라인'

export interface Purchase {
  id: string
  date: string // YYYY-MM-DD
  kind: Kind
  category: string
  name: string
  brand: string
  place: string
  channel: Channel
  region: string
  currency: string
  amount: number // 결제 통화 기준 구매가
  rate: number // 1 통화 = rate 원. 환율을 못 구했으면 0
  krw: number // 원화 환산액 (실청구액으로 수정 가능)
  listPrice: number | null // 결제 통화 기준 정가
  qty: number
  target: Target
  recipient: string
  memo: string
  updatedAt: number
  deleted: 0 | 1
  dirty: 0 | 1 // 시트에 아직 올리지 않은 변경
}

export interface Photo {
  id: string
  purchaseId: string
  blob: Blob
}

export interface Category {
  name: string
  budget: number // 월 예산(원). 0이면 예산 없음
}

export interface Settings {
  categories: Category[]
  defaultCurrency: string
  lifeCategories: string[] // 챌린지 기간에만 쓰는 생활비 카테고리
  challenge: { on: boolean; month: number; goal: number } // month: 1~12, goal: 총액 목표(원)
  syncUrl: string
  syncToken: string
  lastSync: number
}
