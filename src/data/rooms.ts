import type { PhysicalRoom, RoomType } from '../types/domain'

const floors = [2, 3, 4, 5, 6]
const roomSuffixes = ['01', '02', '03', '05', '06', '07', '08', '10']
const westernRooms = new Set([
  '201',
  '202',
  '203',
  '205',
  '206',
  '207',
  '208',
  '210',
  '301',
  '401',
  '501',
  '601',
  '307',
])

export const physicalRooms: PhysicalRoom[] = floors.flatMap((floor) =>
  roomSuffixes.map((suffix) => {
    const roomNumber = `${floor}${suffix}`
    const isOneLine = suffix === '01'
    const isRoom501 = roomNumber === '501'
    return {
      roomNumber,
      floor,
      style: westernRooms.has(roomNumber) ? 'western' : 'japanese',
      standardCapacity: isOneLine ? 4 : 2,
      maxCapacity: 4,
      salesStatus: isRoom501 ? 'inactive' : 'active',
      operationsNote: isRoom501 ? 'オンライン販売方針は確認中' : null,
    }
  }),
)

// Presentation groups only. Final saleable room types await measurements and operations policy.
export const japaneseRoomRepresentativeImage =
  '/images/rooms/tatami-room.webp'

export const roomTypePreviews: RoomType[] = [
  {
    id: 'japanese-preview',
    nameJa: '和室',
    style: 'japanese',
    descriptionJa:
      '畳の落ち着きに包まれ、人数に合わせたお布団でお休みいただけます。',
    standardCapacity: 2,
    maxCapacity: 4,
    image: japaneseRoomRepresentativeImage,
    areaSquareMeters: null,
    bedDescriptionJa: 'ご宿泊人数分のお布団をご用意します',
  },
  {
    id: 'western-preview',
    nameJa: '洋室',
    style: 'western',
    descriptionJa:
      '使いやすさを大切にした、穏やかにお過ごしいただける洋室です。',
    standardCapacity: 2,
    maxCapacity: 4,
    image: '/images/rooms/western-room.webp',
    areaSquareMeters: null,
    bedDescriptionJa: null,
  },
]
