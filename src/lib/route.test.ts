import { describe, expect, it } from 'vitest'
import { buildGoogleMapsUrl, moveItem, nearestNeighborOrder } from './route'
import type { LocatedDelivery } from '../types'

const base: LocatedDelivery[] = [
  {
    id: 'far',
    customer: 'Far',
    address: 'Far',
    status: 'pending',
    lat: 0,
    lng: 3,
  },
  {
    id: 'near',
    customer: 'Near',
    address: 'Near',
    status: 'pending',
    lat: 0,
    lng: 1,
  },
  {
    id: 'middle',
    customer: 'Middle',
    address: 'Middle',
    status: 'pending',
    lat: 0,
    lng: 2,
  },
]

describe('nearestNeighborOrder', () => {
  it('starts from the nearest stop and continues greedily', () => {
    const result = nearestNeighborOrder({ lat: 0, lng: 0 }, base)
    expect(result.map((item) => item.id)).toEqual(['near', 'middle', 'far'])
  })
})

describe('moveItem', () => {
  it('moves a delivery without mutating the original array', () => {
    const source = ['a', 'b', 'c']
    expect(moveItem(source, 2, 0)).toEqual(['c', 'a', 'b'])
    expect(source).toEqual(['a', 'b', 'c'])
  })
})

describe('buildGoogleMapsUrl', () => {
  it('uses the restaurant as origin and ignores completed deliveries', () => {
    const url = buildGoogleMapsUrl('Restaurante', [
      { id: '1', customer: 'A', address: 'Rua A', status: 'pending' },
      { id: '2', customer: 'B', address: 'Rua B', status: 'completed' },
      { id: '3', customer: 'C', address: 'Rua C', status: 'pending' },
    ])

    expect(url).toContain('origin=Restaurante')
    expect(url).toContain('destination=Rua+C')
    expect(url).toContain('waypoints=Rua+A')
    expect(url).not.toContain('Rua+B')
  })
})
