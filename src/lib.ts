import type { Purchase, Settings } from './types'

export const CURRENCIES = ['KRW', 'USD', 'JPY', 'EUR', 'CNY', 'GBP', 'HKD', 'TWD', 'THB', 'VND', 'SGD', 'AUD']

export const won = (n: number) => Math.round(n).toLocaleString('ko-KR') + '원'

export const money = (n: number, currency: string) =>
  currency === 'KRW' ? won(n) : `${n.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} ${currency}`

export function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const parseNum = (s: string): number => {
  const n = Number(s.replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

// 상품명이 없는 쇼핑 기록, 환율을 못 구한 기록은 "정리 대기"
export const isDraft = (p: Purchase) => (p.kind === '쇼핑' && !p.name.trim()) || (p.amount > 0 && p.krw === 0)

// ym(YYYY-MM)이 긴축 챌린지 달인지
export const isChallengeMonth = (ym: string, s: Settings) => s.challenge.on && Number(ym.slice(5, 7)) === s.challenge.month

// 챌린지 집계용 카테고리: 쇼핑 기록(의류·잡화·주류 등)은 모두 '쇼핑'으로 묶는다
export const challengeGroup = (p: Purchase) => (p.kind === '쇼핑' ? '쇼핑' : p.category)

// 달력 칸에 넣는 짧은 금액 표기
export const shortWon = (n: number) => (n >= 10000 ? `${+(n / 10000).toFixed(1)}만` : Math.round(n).toLocaleString('ko-KR'))

export const discountPct = (p: Pick<Purchase, 'amount' | 'listPrice'>): number | null =>
  p.listPrice && p.listPrice > p.amount ? Math.round((1 - p.amount / p.listPrice) * 100) : null

export const uid = () => crypto.randomUUID()
