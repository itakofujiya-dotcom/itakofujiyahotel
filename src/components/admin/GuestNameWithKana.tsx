type GuestNameWithKanaProps = {
  name: string
  nameKanaOrRoman?: string | null
  className?: string
  nameClassName?: string
  kanaClassName?: string
}

export function GuestNameWithKana({
  name,
  nameKanaOrRoman,
  className = '',
  nameClassName = '',
  kanaClassName = 'mt-1 text-xs font-normal text-muted',
}: GuestNameWithKanaProps) {
  const kana = nameKanaOrRoman?.trim()

  return (
    <span className={`block min-w-0 ${className}`}>
      <span className={`block break-words ${nameClassName}`}>{name}</span>
      {kana && (
        <span className={`block break-words ${kanaClassName}`}>{kana}</span>
      )}
    </span>
  )
}
