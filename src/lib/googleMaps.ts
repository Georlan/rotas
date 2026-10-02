import type { Delivery, LatLngPoint, LocatedDelivery } from '../types'
import { nearestNeighborOrder } from './route'

let loaderPromise: Promise<void> | null = null

export function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve()

  if (!apiKey) {
    return Promise.reject(new Error('A chave do Google Maps não foi configurada.'))
  }

  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-loader="rotas"]',
    )

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('Não foi possível carregar o Google Maps.')),
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.dataset.googleMapsLoader = 'rotas'
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Não foi possível carregar o Google Maps.'))
    document.head.appendChild(script)
  })

  return loaderPromise
}

function geocodeAddress(geocoder: google.maps.Geocoder, address: string) {
  return new Promise<LatLngPoint>((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      const location = results?.[0]?.geometry.location

      if (status !== 'OK' || !location) {
        reject(new Error(`Não foi possível localizar: ${address}`))
        return
      }

      resolve({ lat: location.lat(), lng: location.lng() })
    })
  })
}

export async function optimizeByGeocodedDistance(
  restaurantAddress: string,
  deliveries: Delivery[],
): Promise<LocatedDelivery[]> {
  const geocoder = new google.maps.Geocoder()
  const origin = await geocodeAddress(geocoder, restaurantAddress)

  const located = await Promise.all(
    deliveries.map(async (delivery) => {
      const point = await geocodeAddress(geocoder, delivery.address)
      return { ...delivery, ...point }
    }),
  )

  return nearestNeighborOrder(origin, located)
}

export function createMap(element: HTMLElement) {
  return new google.maps.Map(element, {
    center: { lat: -14.235, lng: -51.9253 },
    zoom: 4,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  })
}

export function createDirectionsRenderer(map: google.maps.Map) {
  return new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: false,
    preserveViewport: false,
  })
}

export async function drawDeliveryRoute(
  map: google.maps.Map,
  renderer: google.maps.DirectionsRenderer,
  restaurantAddress: string,
  deliveries: Delivery[],
) {
  const pending = deliveries.filter((delivery) => delivery.status !== 'completed')

  if (!restaurantAddress.trim() || pending.length === 0) {
    renderer.setDirections({ routes: [], geocoded_waypoints: [], request: {} as google.maps.DirectionsRequest })
    return
  }

  const destination = pending[pending.length - 1]
  const service = new google.maps.DirectionsService()

  const response = await service.route({
    origin: restaurantAddress,
    destination: destination.address,
    waypoints: pending.slice(0, -1).map((delivery) => ({
      location: delivery.address,
      stopover: true,
    })),
    optimizeWaypoints: false,
    travelMode: google.maps.TravelMode.DRIVING,
  })

  renderer.setDirections(response)

  const bounds = response.routes[0]?.bounds
  if (bounds) map.fitBounds(bounds)
}
