import { useEffect, useMemo, useState } from 'react'
import { addPhoto, db, removePurchase, savePurchase, shrinkImage, usePhotos } from '../db'
import { getRate } from '../fx'
import { CURRENCIES, discountPct, isChallengeMonth, money, parseNum, won } from '../lib'
import { useSettings } from '../settings'
import type { Channel, Photo, Purchase, Target } from '../types'

const TARGETS: Target[] = ['나', '선물', '대리구매']
const CHANNELS: Channel[] = ['오프라인', '온라인']

function Thumb({ photo }: { photo: Photo }) {
  const url = useMemo(() => URL.createObjectURL(photo.blob), [photo.blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div className="relative shrink-0">
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt="첨부 사진" className="h-24 w-24 rounded-xl object-cover" />
      </a>
      <button
        onClick={() => db.photos.delete(photo.id)}
        className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-stone-900 text-sm text-white"
        aria-label="사진 삭제"
      >
        ×
      </button>
    </div>
  )
}

export function EditForm({ id, purchases, onClose }: { id: string; purchases: Purchase[]; onClose: () => void }) {
  const settings = useSettings()
  const { categories, lifeCategories } = settings
  const photos = usePhotos(id)
  const [p, setP] = useState<Purchase | null>(null)
  const [amountStr, setAmountStr] = useState('')
  const [listStr, setListStr] = useState('')
  const [krwStr, setKrwStr] = useState('')

  useEffect(() => {
    db.purchases.get(id).then((found) => {
      if (!found) return onClose()
      setP(found)
      setAmountStr(found.amount ? String(found.amount) : '')
      setListStr(found.listPrice ? String(found.listPrice) : '')
      setKrwStr(found.krw ? String(found.krw) : '')
    })
  }, [id])

  // 자동완성 후보: 지금까지 입력한 값들
  const options = useMemo(() => {
    const uniq = (key: 'name' | 'brand' | 'place' | 'region' | 'recipient') => [...new Set(purchases.map((o) => o[key]).filter(Boolean))]
    return { name: uniq('name'), brand: uniq('brand'), place: uniq('place'), region: uniq('region'), recipient: uniq('recipient') }
  }, [purchases])

  if (!p) return null
  const set = (patch: Partial<Purchase>) => setP((cur) => (cur ? { ...cur, ...patch } : cur))

  // 금액·통화·날짜가 바뀌면 그 날짜 환율로 원화 금액을 다시 계산한다
  async function recalc(next: { amount?: number; currency?: string; date?: string }) {
    const merged = { amount: p!.amount, currency: p!.currency, date: p!.date, ...next }
    set(next)
    const rate = (await getRate(merged.currency, merged.date)) ?? 0
    const krw = Math.round(merged.amount * rate)
    set({ rate, krw })
    setKrwStr(krw ? String(krw) : '')
  }

  const off = discountPct(p)
  const tokens = p.name.split(/\s+/).filter((t) => t.length >= 2)
  const similar = purchases
    .filter(
      (o) =>
        o.id !== p.id &&
        o.name &&
        (tokens.some((t) => o.name.includes(t)) || (p.brand && o.brand === p.brand && o.category === p.category)),
    )
    .slice(0, 3)

  async function save() {
    await savePurchase(p!)
    onClose()
  }

  async function remove() {
    if (!confirm('이 기록을 삭제할까요?')) return
    await removePurchase(id)
    onClose()
  }

  const chips = <T extends string>(values: T[], current: T, pick: (v: T) => void) => (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <button key={v} type="button" onClick={() => pick(v)} className={`chip ${current === v ? 'chip-on' : ''}`}>
          {v}
        </button>
      ))}
    </div>
  )

  const text = (label: string, key: 'name' | 'brand' | 'place' | 'region' | 'recipient', placeholder = '') => (
    <div>
      <label className="label">{label}</label>
      <input list={`opt-${key}`} value={p[key]} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value })} className="field" />
      <datalist id={`opt-${key}`}>
        {options[key].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </div>
  )

  const life = p.kind === '생활'
  const shopNames = categories.map((c) => c.name)
  // 생활비 카테고리는 챌린지 달의 기록이거나 이미 생활비 기록일 때만 고를 수 있다
  const lifeNames = life || isChallengeMonth(p.date, settings) ? lifeCategories.filter((n) => !shopNames.includes(n)) : []
  const categoryNames = [...new Set([...lifeNames, ...shopNames, p.category])]
  const pickCategory = (category: string) =>
    set({ category, kind: shopNames.includes(category) ? '쇼핑' : lifeNames.includes(category) ? '생활' : p.kind })

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-stone-100">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-stone-100/95 px-4 py-3 backdrop-blur">
          <button onClick={onClose} className="py-1 pr-3 text-stone-500">
            취소
          </button>
          <h2 className="font-bold">{life ? '생활비 기록' : '구매 상세'}</h2>
          <button onClick={save} className="py-1 pl-3 font-bold text-amber-600">
            저장
          </button>
        </header>

        <div className="space-y-4 px-4 pb-10">
          <section className="card space-y-3">
            <div>
              <label className="label">카테고리</label>
              {chips(categoryNames, p.category, pickCategory)}
            </div>
            {!life && text('상품명', 'name', '예: 울 니트 가디건')}
            {!life && similar.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm">
                <div className="mb-1 text-xs font-semibold text-amber-800">비슷한 구매 이력</div>
                {similar.map((o) => (
                  <div key={o.id} className="flex justify-between gap-2 py-0.5 text-stone-700">
                    <span className="truncate">
                      {o.date.slice(2, 7).replace('-', '.')} {o.name}
                      {o.place && ` · ${o.place}`}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{won(o.krw)}</span>
                  </div>
                ))}
              </div>
            )}
            {!life && text('브랜드', 'brand')}
          </section>

          <section className="card space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label">구매가</label>
                <input
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => {
                    setAmountStr(e.target.value)
                    recalc({ amount: parseNum(e.target.value) })
                  }}
                  className="field text-right font-semibold tabular-nums"
                />
              </div>
              <div className="w-24">
                <label className="label">통화</label>
                <select value={p.currency} onChange={(e) => recalc({ currency: e.target.value })} className="field">
                  {[...new Set([...CURRENCIES, p.currency])].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={life ? 'hidden' : 'flex gap-2'}>
              <div className="flex-1">
                <label className="label">정가 ({p.currency}){off !== null && <span className="ml-1 text-emerald-700">{off}% 할인</span>}</label>
                <input
                  inputMode="decimal"
                  value={listStr}
                  placeholder="선택"
                  onChange={(e) => {
                    setListStr(e.target.value)
                    set({ listPrice: parseNum(e.target.value) || null })
                  }}
                  className="field text-right tabular-nums"
                />
              </div>
              <div className="w-24">
                <label className="label">수량</label>
                <input
                  inputMode="numeric"
                  value={p.qty}
                  onChange={(e) => set({ qty: Math.max(1, Math.round(parseNum(e.target.value))) })}
                  className="field text-right tabular-nums"
                />
              </div>
            </div>
            {p.currency !== 'KRW' && (
              <div>
                <label className="label">
                  원화 금액{' '}
                  {p.rate > 0
                    ? `· 1 ${p.currency} = ${p.rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원 (${p.date} 기준)`
                    : '· 환율을 가져오지 못했어요'}
                </label>
                <input
                  inputMode="numeric"
                  value={krwStr}
                  placeholder="카드 실청구액으로 고쳐 쓸 수 있어요"
                  onChange={(e) => {
                    setKrwStr(e.target.value)
                    set({ krw: Math.round(parseNum(e.target.value)) })
                  }}
                  className="field text-right tabular-nums"
                />
                <p className="mt-1 text-right text-xs text-stone-500">{money(p.amount, p.currency)} → {won(p.krw)}</p>
              </div>
            )}
          </section>

          <section className="card space-y-3">
            <div>
              <label className="label">구매일</label>
              <input type="date" value={p.date} onChange={(e) => e.target.value && recalc({ date: e.target.value })} className="field" />
            </div>
            {text('구매처', 'place', '예: 무신사, 더현대 서울')}
            {!life && (
              <div>
                <label className="label">채널</label>
                {chips(CHANNELS, p.channel, (channel) => set({ channel: p.channel === channel ? '' : channel }))}
              </div>
            )}
            {!life && text('지역', 'region', '예: 서울, 도쿄')}
          </section>

          <section className="card space-y-3">
            {!life && (
              <div>
                <label className="label">누구를 위한 구매인가요?</label>
                {chips(TARGETS, p.target, (target) => set({ target }))}
              </div>
            )}
            {!life && p.target !== '나' && text('받는 사람', 'recipient', '예: 엄마')}
            <div>
              <label className="label">메모</label>
              <textarea value={p.memo} onChange={(e) => set({ memo: e.target.value })} rows={3} className="field" placeholder={life ? '무엇에 썼는지' : '사이즈, 색상, 산 이유 등'} />
            </div>
          </section>

          <section className="card">
            <label className="label">사진 (이 기기에만 저장돼요)</label>
            <div className="flex gap-3 overflow-x-auto pt-2">
              {photos.map((photo) => (
                <Thumb key={photo.id} photo={photo} />
              ))}
              <label className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-stone-300 text-3xl text-stone-400">
                +
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) await addPhoto(id, await shrinkImage(file))
                  }}
                />
              </label>
            </div>
          </section>

          <button onClick={save} className="btn w-full">
            저장
          </button>
          <button onClick={remove} className="w-full py-2 text-sm text-red-600">
            이 기록 삭제
          </button>
        </div>
      </div>
    </div>
  )
}
