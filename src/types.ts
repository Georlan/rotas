export type DeliveryStatus = 'pending' | 'completed'

export interface Delivery {
  id: string
  customer: string
  address: string
  phone?: string
  note?: string
  status: DeliveryStatus
  lat?: number
  lng?: number
}

export interface CsvIssue {
  line: number
  message: string
}

export interface CsvParseResult {
  deliveries: Delivery[]
  issues: CsvIssue[]
}

export interface RouteHistoryEntry {
  id: string
  createdAt: string
  restaurantAddress: string
  deliveries: Delivery[]
}

export interface LocatedDelivery extends Delivery {
  lat: number
  lng: number
}

export interface LatLngPoint {
  lat: number
  lng: number
}
