import { useState } from 'react'
import type { Purchase } from '../types'
import { useSettings } from '../settings'
import { isChallengeMonth, isDraft, today, won } from '../lib'
import { PurchaseRow } from './PurchaseRow'
import { Challenge } from './Challenge'

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function Home({ purchases, onOpen }: { purchases: Purchase[]; onOpen: (id: string) => void }) {
  const settings = useSettings()
  const { categories } = settings
  const thisMonth = today().slice(0, 7)
  const [month, setMonthRaw] = useState(thisMonth)
  const [day, setDay] = useState<number | null>(null) // 챌린지 달력에서 고른 날짜
  const setMonth = (m: string) => {
    setMonthRaw(m)
    setDay(null)
  }
  const challenge = isChallengeMonth(month, settings)

  const inMonth = purchases.filter((p) => p.date.startsWith(month))
  const mine = inMonth.filter((p) => p.target === '나' && p.kind === '쇼핑')
  const shown = day ? inMonth.filter((p) => Number(p.date.slice(8, 10)) === day) : inMonth
  const sum = (list: Purchase[]) => list.reduce((a, p) => a + p.krw, 0)
  const others = sum(inMonth.filter((p) => p.kind === '쇼핑')) - sum(mine)
  const drafts = purchases.filter(isDraft)

  // 설정에 없는 카테고리로 기록된 구매도 빠뜨리지 않는다
  const names = [...new Set([...categories.map((c) => c.name), ...mine.map((p) => p.category)])]

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="px-3 py-2 text-xl text-stone-500" aria-label="이전 달">
          ‹
        </button>
        <h1 className="text-lg font-bold">
          {month.slice(0, 4)}년 {Number(month.slice(5))}월
        </h1>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= thisMonth}
          className="px-3 py-2 text-xl text-stone-500 disabled:text-stone-300"
          aria-label="다음 달"
        >
          ›
        </button>
      </header>

      {challenge && <Challenge month={month} purchases={purchases} day={day} onPickDay={setDay} />}

      <section className={challenge ? 'hidden' : 'card'}>
        <div className="text-xs text-stone-500">나를 위한 소비</div>
        <div className="text-3xl font-bold tabular-nums">{won(sum(mine))}</div>
        {others > 0 && <div className="mt-1 text-sm text-stone-500">선물·대리구매 {won(others)} 별도</div>}

        <div className="mt-4 space-y-4">
          {names.map((name) => {
            const spent = sum(mine.filter((p) => p.category === name))
            const budget = categories.find((c) => c.name === name)?.budget ?? 0
            const ratio = budget ? spent / budget : 0
            const color = ratio >= 1 ? 'bg-red-500' : ratio >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
            return (
              <div key={name}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{name}</span>
                  <span className="tabular-nums">
                    <span className={ratio >= 1 ? 'font-semibold text-red-600' : ''}>{won(spent)}</span>
                    {budget > 0 && <span className="text-stone-400"> / {won(budget)}</span>}
                  </span>
                </div>
                {budget > 0 && (
                  <>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-200">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                    </div>
                    <div className="mt-1 text-right text-xs text-stone-500">
                      {spent > budget ? `${won(spent - budget)} 초과` : `${won(budget - spent)} 남음`}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {drafts.length > 0 && (
        <section className="card">
          <h2 className="text-sm font-bold">
            정리 대기함 <span className="text-amber-600">{drafts.length}</span>
          </h2>
          <p className="text-xs text-stone-500">상품명이나 환율이 비어 있는 기록이에요. 눌러서 채워 주세요.</p>
          <div className="mt-1 divide-y divide-stone-100">
            {drafts.map((p) => (
              <PurchaseRow key={p.id} p={p} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="text-sm font-bold">
          {day ? `${day}일의 기록` : '이 달의 기록'} {shown.length}건
        </h2>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400">{day ? '이 날은 지출이 없어요.' : '아직 기록이 없어요. 아래 + 버튼으로 시작하세요.'}</p>
        ) : (
          <div className="mt-1 divide-y divide-stone-100">
            {shown.map((p) => (
              <PurchaseRow key={p.id} p={p} onOpen={onOpen} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
