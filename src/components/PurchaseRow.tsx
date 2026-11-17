import type { Purchase } from '../types'
import { discountPct, isDraft, money, won } from '../lib'

export function PurchaseRow({ p, onOpen }: { p: Purchase; onOpen: (id: string) => void }) {
  const off = discountPct(p)
  const sub = [p.brand, p.place, p.region].filter(Boolean).join(' · ')
  // 생활비 기록은 상품명이 없으므로 메모나 카테고리를 제목으로 쓴다
  const title = p.name || (p.kind === '생활' ? p.memo || p.category : '')
  return (
    <button onClick={() => onOpen(p.id)} className="flex w-full items-start gap-3 py-3 text-left">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate font-medium ${title ? '' : 'text-stone-400'}`}>{title || '상품명 미입력'}</span>
          {p.target !== '나' && (
            <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[11px] text-rose-700">
              {p.target}
              {p.recipient && ` · ${p.recipient}`}
            </span>
          )}
          {isDraft(p) && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">정리 대기</span>}
        </div>
        <div className="truncate text-xs text-stone-500">
          {p.date.slice(2).replaceAll('-', '.')} · {p.category}
          {sub && ` · ${sub}`}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums">{p.krw ? won(p.krw) : money(p.amount, p.currency)}</div>
        <div className="text-xs text-stone-500 tabular-nums">
          {p.currency !== 'KRW' && p.krw > 0 && money(p.amount, p.currency)}
          {off !== null && <span className="ml-1 text-emerald-700">-{off}%</span>}
        </div>
      </div>
    </button>
  )
}
