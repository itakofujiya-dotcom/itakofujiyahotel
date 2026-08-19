export type Nullable<T> = T | null

export type HotelSettings = {
  hotelNameJa: string
  hotelNameEn: string
  postalCode: string
  addressJa: string
  telephone: string
  fax: string
  email: Nullable<string>
  checkIn: string
  checkOut: string
  frontDeskOpen: string
  frontDeskClose: string
  mapUrl: string
}

export type BookingSearchParams = {
  checkIn: Date | null
  checkOut: Date | null
  adults: number
  children: number
  rooms: number
}

export type RoomStyle = 'western' | 'japanese'
export type RoomSalesStatus =
  'active' | 'inactive' | 'admin_only' | 'maintenance'

export type PhysicalRoom = {
  roomNumber: string
  floor: number
  style: RoomStyle
  standardCapacity: number
  maxCapacity: number
  salesStatus: RoomSalesStatus
  operationsNote: Nullable<string>
}

export type RoomType = {
  id: string
  nameJa: string
  style: RoomStyle
  descriptionJa: string
  standardCapacity: number
  maxCapacity: number
  image: string
  areaSquareMeters: Nullable<number>
  bedDescriptionJa: Nullable<string>
}

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'checked_in'
  | 'checked_out'
  | 'no_show'
export type PaymentMethod = 'pay_at_hotel' | 'bank_transfer' | 'card'
export type PaymentStatus =
  'pending' | 'awaiting_payment' | 'paid' | 'refunded' | 'cancelled'

export type Amenity = {
  id: string
  labelJa: string
  category: 'facility' | 'toiletry'
  provided: boolean
}
