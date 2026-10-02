import type { Delivery, LatLngPoint, LocatedDelivery } from '../types'

const EARTH_RADIUS_KM = 6371

export function haversineKm(a: LatLngPoint, b: LatLngPoint) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(value))
}

export function nearestNeighborOrder(
  origin: LatLngPoint,
  deliveries: LocatedDelivery[],
): LocatedDelivery[] {
  const remaining = [...deliveries]
  const ordered: LocatedDelivery[] = []
  let current = origin

  while (remaining.length > 0) {
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY

    remaining.forEach((delivery, index) => {
      const distance = haversineKm(current, delivery)

      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })

    const [next] = remaining.splice(bestIndex, 1)
    ordered.push(next)
    current = next
  }

  return ordered
}

export function buildGoogleMapsUrl(restaurantAddress: string, deliveries: Delivery[]) {
  const pending = deliveries.filter((delivery) => delivery.status !== 'completed')

  if (!restaurantAddress.trim() || pending.length === 0) return ''

  const destination = pending[pending.length - 1]
  const waypoints = pending.slice(0, -1)

  const params = new URLSearchParams({
    api: '1',
    origin: restaurantAddress,
    destination: destination.address,
    travelmode: 'driving',
  })

  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map((delivery) => delivery.address).join('|'))
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items
  }

  const copy = [...items]
  const [item] = copy.splice(fromIndex, 1)
  copy.splice(toIndex, 0, item)
  return copy
}
