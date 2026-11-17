import { useState } from 'react'
import { importPurchases } from '../db'
import type { Purchase } from '../types'
import { CURRENCIES, parseNum, today } from '../lib'
import { setSettings, useSettings } from '../settings'
import { syncNow } from '../sync'

const CSV_COLS: [keyof Purchase, string][] = [
  ['date', '구매일'],
  ['kind', '구분'],
  ['category', '카테고리'],
  ['name', '상품명'],
  ['brand', '브랜드'],
  ['place', '구매처'],
  ['channel', '채널'],
  ['region', '지역'],
  ['currency', '통화'],
  ['amount', '금액'],
  ['rate', '환율'],
  ['krw', '원화금액'],
  ['listPrice', '정가'],
  ['qty', '수량'],
  ['target', '대상'],
  ['recipient', '받는사람'],
  ['memo', '메모'],
]

function exportCsv(purchases: Purchase[]) {
  const cell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const lines = [CSV_COLS.map(([, label]) => label).join(','), ...purchases.map((p) => CSV_COLS.map(([key]) => cell(p[key])).join(','))]
  // 엑셀이 한글을 깨뜨리지 않도록 BOM을 붙인다
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `소비노트-${today()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function SettingsView({ purchases }: { purchases: Purchase[] }) {
  const s = useSettings()
  const [newCat, setNewCat] = useState('')
  const [syncMsg, setSyncMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  async function importFiles(files: FileList) {
    try {
      let count = 0
      for (const file of files) count += await importPurchases(JSON.parse(await file.text()))
      setImportMsg(`${count}건을 가져왔어요.`)
    } catch (e) {
      setImportMsg(`가져오기 실패: ${e instanceof Error ? e.message : e}`)
    }
  }

  const setCategory = (i: number, budget: number) =>
    setSettings({ categories: s.categories.map((c, j) => (j === i ? { ...c, budget } : c)) })

  function addCategory() {
    const name = newCat.trim()
    if (!name || s.categories.some((c) => c.name === name)) return
    setSettings({ categories: [...s.categories, { name, budget: 0 }] })
    setNewCat('')
  }

  async function sync() {
    setSyncing(true)
    setSyncMsg('')
    try {
      await syncNow()
      setSyncMsg('동기화 완료')
    } catch (e) {
      setSyncMsg(`실패: ${e instanceof Error ? e.message : e}`)
    }
    setSyncing(false)
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="pt-2 text-lg font-bold">설정</h1>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold">카테고리 · 월 예산</h2>
        <p className="text-xs text-stone-500">예산을 0으로 두면 게이지 없이 합계만 보여요.</p>
        {s.categories.map((c, i) => (
          <div key={c.name} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate font-medium">{c.name}</span>
            <input
              inputMode="numeric"
              value={c.budget ? c.budget.toLocaleString('ko-KR') : ''}
              placeholder="예산 없음"
              onChange={(e) => setCategory(i, Math.round(parseNum(e.target.value)))}
              className="field flex-1 text-right tabular-nums"
              aria-label={`${c.name} 월 예산`}
            />
            <span className="text-sm text-stone-500">원</span>
            <button
              onClick={() => confirm(`'${c.name}' 카테고리를 목록에서 뺄까요? 기존 기록은 그대로 남아요.`) && setSettings({ categories: s.categories.filter((_, j) => j !== i) })}
              className="px-1 text-xl text-stone-400"
              aria-label={`${c.name} 삭제`}
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="새 카테고리"
            className="field flex-1"
          />
          <button onClick={addCategory} className="btn-ghost">
            추가
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">긴축 챌린지</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.challenge.on}
              onChange={(e) => setSettings({ challenge: { ...s.challenge, on: e.target.checked } })}
              className="h-5 w-5 accent-stone-900"
            />
            사용
          </label>
        </div>
        <p className="text-xs text-stone-500">챌린지 달에는 홈이 챌린지 화면으로 바뀌고, 빠른 기록에서 생활비 카테고리를 고를 수 있어요.</p>
        {s.challenge.on && (
          <>
            <div className="flex gap-2">
              <div className="w-24">
                <label className="label">챌린지 달</label>
                <select
                  value={s.challenge.month}
                  onChange={(e) => setSettings({ challenge: { ...s.challenge, month: Number(e.target.value) } })}
                  className="field"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}월
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="label">총액 목표 (원)</label>
                <input
                  inputMode="numeric"
                  value={s.challenge.goal ? s.challenge.goal.toLocaleString('ko-KR') : ''}
                  placeholder="목표 없음"
                  onChange={(e) => setSettings({ challenge: { ...s.challenge, goal: Math.round(parseNum(e.target.value)) } })}
                  className="field text-right tabular-nums"
                  aria-label="챌린지 총액 목표"
                />
              </div>
            </div>
            <div>
              <label className="label">생활비 카테고리 (쉼표로 구분)</label>
              <input
                defaultValue={s.lifeCategories.join(', ')}
                onBlur={(e) => {
                  const names = [...new Set(e.target.value.split(',').map((v) => v.trim()).filter(Boolean))]
                  if (names.length) setSettings({ lifeCategories: names })
                }}
                className="field"
              />
              <p className="mt-1 text-xs text-stone-500">쇼핑 기록(위 카테고리)은 챌린지 집계에서 '쇼핑'으로 합산돼요.</p>
            </div>
          </>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold">기본 통화</h2>
        <select value={s.defaultCurrency} onChange={(e) => setSettings({ defaultCurrency: e.target.value })} className="field">
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <p className="text-xs text-stone-500">해외여행 중에는 현지 통화로 바꿔 두면 빠른 기록이 편해요.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold">구글 시트 동기화</h2>
        <p className="text-xs text-stone-500">README의 안내대로 시트에 Apps Script를 배포한 뒤, 웹 앱 주소와 토큰을 넣어 주세요.</p>
        <div>
          <label className="label">웹 앱 주소</label>
          <input
            value={s.syncUrl}
            onChange={(e) => setSettings({ syncUrl: e.target.value.trim() })}
            placeholder="https://script.google.com/macros/s/…/exec"
            className="field text-sm"
          />
        </div>
        <div>
          <label className="label">토큰</label>
          <input value={s.syncToken} onChange={(e) => setSettings({ syncToken: e.target.value.trim() })} className="field text-sm" />
        </div>
        <button onClick={sync} disabled={!s.syncUrl || syncing} className="btn w-full">
          {syncing ? '동기화 중…' : '지금 동기화'}
        </button>
        <p className="text-xs text-stone-500">
          {syncMsg || (s.lastSync ? `마지막 동기화: ${new Date(s.lastSync).toLocaleString('ko-KR')}` : '아직 동기화한 적이 없어요.')}
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold">내보내기 · 가져오기</h2>
        <button onClick={() => exportCsv(purchases)} disabled={!purchases.length} className="btn-ghost w-full disabled:text-stone-300">
          CSV 파일로 저장 ({purchases.length}건)
        </button>
        <label className="btn-ghost block w-full cursor-pointer">
          기록 파일(JSON) 가져오기
          <input
            type="file"
            accept="application/json,.json"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) importFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <p className="text-xs text-stone-500">{importMsg || '과거 긴축 챌린지 기록처럼 미리 변환해 둔 파일을 넣어요. 여러 개를 한 번에 고를 수 있어요.'}</p>
      </section>
    </div>
  )
}
