export type AdminHotelSettings = {
  id: string
  hotel_name_ja: string
  hotel_name_en: string | null
  postal_code: string | null
  address_ja: string | null
  telephone: string | null
  fax: string | null
  email: string | null
  check_in_time: string
  check_out_time: string
  front_desk_open: string
  front_desk_close: string
  updated_at: string
}

export type AdminHotelSettingsForm = {
  hotelNameJa: string
  hotelNameEn: string
  postalCode: string
  addressJa: string
  telephone: string
  fax: string
  email: string
  checkInTime: string
  checkOutTime: string
  frontDeskOpen: string
  frontDeskClose: string
}
