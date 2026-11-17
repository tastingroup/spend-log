import { useSyncExternalStore } from 'react'
import type { Settings } from './types'

const KEY = 'spend-log:settings'

const DEFAULTS: Settings = {
  categories: [
    { name: '의류', budget: 0 },
    { name: '잡화', budget: 0 },
    { name: '주류', budget: 0 },
  ],
  defaultCurrency: 'KRW',
  lifeCategories: ['외식', '식재', '교통', '의료', '구독', '여행', '기타'],
  challenge: { on: true, month: 11, goal: 0 },
  syncUrl: '',
  syncToken: '',
  lastSync: 0,
}

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

export const getSettings = () => current

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // 저장 공간을 못 쓰는 환경이면 메모리에만 유지
  }
  listeners.forEach((l) => l())
}

export const useSettings = () =>
  useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, getSettings)
