import { useState } from 'react'
import type { Purchase } from '../types'
import { won } from '../lib'
import { PurchaseRow } from './PurchaseRow'

const TARGET_FILTERS = ['전체', '나', '선물·대리'] as const

export function ListView({ purchases, onOpen }: { purchases: Purchase[]; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [target, setTarget] = useState<(typeof TARGET_FILTERS)[number]>('전체')
  // 과거 구매가를 찾는 화면이므로 생활비 기록은 켰을 때만 섞는다
  const [withLife, setWithLife] = useState(false)
  const hasLife = purchases.some((p) => p.kind === '생활')
  purchases = withLife ? purchases : purchases.filter((p) => p.kind === '쇼핑')

  const categories = [...new Set(purchases.map((p) => p.category))]
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const results = purchases.filter((p) => {
    if (category && p.category !== category) return false
    if (target === '나' && p.target !== '나') return false
    if (target === '선물·대리' && p.target === '나') return false
    const hay = [p.name, p.brand, p.place, p.region, p.recipient, p.memo, p.category].join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })

  // 가격 이력 요약: 단가 기준, 환율 미확정 기록은 제외
  const priced = results.filter((p) => p.krw > 0)
  const unit = (p: Purchase) => p.krw / (p.qty || 1)
  const cheapest = priced.reduce<Purchase | null>((a, p) => (!a || unit(p) < unit(a) ? p : a), null)
  const filtered = words.length > 0 || category !== '' || target !== '전체'

  return (
    <div className="space-y-3 p-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="상품명, 브랜드, 구매처, 받는 사람 검색"
        className="field mt-2"
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setCategory('')} className={`chip ${category === '' ? 'chip-on' : ''}`}>
          전체
        </button>
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`chip ${category === c ? 'chip-on' : ''}`}>
            {c}
          </button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-stone-300" />
        {TARGET_FILTERS.slice(1).map((t) => (
          <button key={t} onClick={() => setTarget(target === t ? '전체' : t)} className={`chip ${target === t ? 'chip-on' : ''}`}>
            {t}
          </button>
        ))}
        {hasLife && (
          <button onClick={() => setWithLife(!withLife)} className={`chip ${withLife ? 'chip-on' : ''}`}>
            생활비 포함
          </button>
        )}
      </div>

      {filtered && cheapest && (
        <section className="card">
          <div className="text-xs font-semibold text-stone-500">가격 이력 · {results.length}건 (단가 기준)</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {(
              [
                ['최저', unit(cheapest)],
                ['평균', priced.reduce((a, p) => a + unit(p), 0) / priced.length],
                ['최근', unit(priced[0])],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-stone-500">{label}</div>
                <div className="font-bold tabular-nums">{won(value)}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">
            최저가: {cheapest.date} {cheapest.place || '구매처 미입력'}
            {cheapest.name && ` · ${cheapest.name}`}
          </p>
        </section>
      )}

      <section className="card">
        {results.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400">{purchases.length ? '조건에 맞는 기록이 없어요.' : '아직 기록이 없어요.'}</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {results.map((p) => (
              <PurchaseRow key={p.id} p={p} onOpen={onOpen} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
