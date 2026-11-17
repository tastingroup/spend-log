import type { Purchase } from '../types'
import { challengeGroup, shortWon, today, won } from '../lib'
import { useSettings } from '../settings'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const sum = (list: Purchase[]) => list.reduce((a, p) => a + p.krw, 0)
const dayOf = (p: Purchase) => Number(p.date.slice(8, 10))

// 긴축 챌린지 달의 홈 카드: 총액·목표·작년 대비, 카테고리별 합계, 일별 달력
export function Challenge({
  month,
  purchases,
  day,
  onPickDay,
}: {
  month: string // YYYY-MM
  purchases: Purchase[] // 전체 기록 (작년 같은 달을 찾기 위해)
  day: number | null
  onPickDay: (day: number | null) => void
}) {
  const { challenge, lifeCategories } = useSettings()
  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const now = today()
  // 진행 중인 달은 오늘까지만, 지난 달은 말일까지 비교한다
  const elapsed = month === now.slice(0, 7) ? Number(now.slice(8, 10)) : month < now ? daysInMonth : 0

  const inMonth = purchases.filter((p) => p.date.startsWith(month))
  const lastYear = purchases.filter((p) => p.date.startsWith(`${year - 1}-${month.slice(5)}`))
  const lastYearSoFar = lastYear.filter((p) => dayOf(p) <= elapsed)
  const total = sum(inMonth)
  const diff = total - sum(lastYearSoFar)

  const byDay = Array.from({ length: daysInMonth + 1 }, (_, d) => sum(inMonth.filter((p) => dayOf(p) === d)))
  const zeroDays = byDay.slice(1, elapsed + 1).filter((v) => v === 0).length

  const groups = [...new Set([...lifeCategories, '쇼핑', ...inMonth.map(challengeGroup)])]
  const ratio = challenge.goal ? total / challenge.goal : 0
  const gaugeColor = ratio >= 1 ? 'bg-red-500' : ratio >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <>
      <section className="card">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold text-amber-600">긴축 챌린지</span>
          <span className="text-xs text-stone-500">
            무지출 {zeroDays}일 / {elapsed}일
          </span>
        </div>
        <div className="text-3xl font-bold tabular-nums">{won(total)}</div>

        {challenge.goal > 0 && (
          <div className="mt-2">
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
              <div className={`h-full rounded-full ${gaugeColor}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-stone-500">
              <span>목표 {won(challenge.goal)}</span>
              <span>{total > challenge.goal ? `${won(total - challenge.goal)} 초과` : `${won(challenge.goal - total)} 남음`}</span>
            </div>
          </div>
        )}

        {lastYear.length > 0 && elapsed > 0 && (
          <p className="mt-2 text-sm text-stone-600">
            작년 {elapsed < daysInMonth ? `${elapsed}일까지 ` : ''}
            {won(sum(lastYearSoFar))} 대비{' '}
            <span className={`font-semibold ${diff > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {won(Math.abs(diff))} {diff > 0 ? '더 씀' : '덜 씀'}
            </span>
          </p>
        )}

        <table className="mt-4 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-stone-500">
              <th className="pb-1 text-left font-normal">카테고리</th>
              <th className="pb-1 text-right font-normal">올해</th>
              <th className="w-12 pb-1 text-right font-normal">비중</th>
              {lastYear.length > 0 && <th className="pb-1 text-right font-normal">작년 같은 기간</th>}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const spent = sum(inMonth.filter((p) => challengeGroup(p) === g))
              return (
                <tr key={g} className={spent ? '' : 'text-stone-400'}>
                  <td className="py-1 font-medium">{g}</td>
                  <td className="py-1 text-right">{won(spent)}</td>
                  <td className="py-1 text-right text-xs text-stone-500">{total ? `${Math.round((spent / total) * 100)}%` : '-'}</td>
                  {lastYear.length > 0 && (
                    <td className="py-1 text-right text-stone-500">{won(sum(lastYearSoFar.filter((p) => challengeGroup(p) === g)))}</td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-xs text-stone-400">
              {w}
            </div>
          ))}
          {Array.from({ length: new Date(year, mon - 1, 1).getDay() }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {byDay.slice(1).map((spent, i) => {
            const d = i + 1
            const past = d <= elapsed
            const tone = !past ? 'text-stone-300' : spent === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100'
            return (
              <button
                key={d}
                onClick={() => onPickDay(day === d ? null : d)}
                className={`rounded-lg py-1.5 ${tone} ${day === d ? 'ring-2 ring-stone-900' : ''}`}
              >
                <div className="text-xs">{d}</div>
                <div className="h-4 text-[11px] font-semibold tabular-nums">{spent > 0 ? shortWon(spent) : past ? '0' : ''}</div>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-stone-500">날짜를 누르면 그날의 기록만 보여요.</p>
      </section>
    </>
  )
}
