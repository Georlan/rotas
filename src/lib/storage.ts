import type { RouteHistoryEntry } from '../types'

const HISTORY_KEY = 'rotas:history:v1'
const RESTAURANT_KEY = 'rotas:restaurant-address:v1'

export function readHistory(): RouteHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistory(entry: RouteHistoryEntry) {
  const current = readHistory()
  const next = [entry, ...current].slice(0, 8)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return next
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

export function readRestaurantAddress() {
  return localStorage.getItem(RESTAURANT_KEY) ?? ''
}

export function saveRestaurantAddress(address: string) {
  localStorage.setItem(RESTAURANT_KEY, address)
}
