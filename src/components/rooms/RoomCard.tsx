import { ArrowRight, Users } from 'lucide-react'
import { ButtonLink } from '../common/ButtonLink'
import type { RoomType } from '../../types/domain'

export function RoomCard({ room }: { room: RoomType }) {
  return (
    <article className="overflow-hidden bg-surface shadow-soft">
      <div className="aspect-[4/3] overflow-hidden">
        <img
          src={room.image}
          alt={`${room.nameJa}の客室`}
          className="h-full w-full object-cover transition duration-700 hover:scale-[1.03]"
        />
      </div>
      <div className="p-6 sm:p-8">
        <p className="text-xs tracking-[0.2em] text-accent">
          {room.style === 'japanese' ? 'JAPANESE ROOM' : 'WESTERN ROOM'}
        </p>
        <h3 className="mt-2 font-serif text-2xl">{room.nameJa}</h3>
        <p className="mt-4 min-h-14 leading-7 text-muted">
          {room.descriptionJa}
        </p>
        <div className="mt-5 flex items-center gap-2 text-sm text-muted">
          <Users size={17} />
          <span>
            基本 {room.standardCapacity}名 / 最大 {room.maxCapacity}名
          </span>
        </div>
        {room.bedDescriptionJa && (
          <p className="mt-2 text-sm text-muted">{room.bedDescriptionJa}</p>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink to="/rooms" variant="outline">
            詳しく見る <ArrowRight size={16} />
          </ButtonLink>
          <ButtonLink to="/booking">予約する</ButtonLink>
        </div>
      </div>
    </article>
  )
}
