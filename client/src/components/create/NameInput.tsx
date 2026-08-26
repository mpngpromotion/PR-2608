'use client'

interface NameInputProps {
  name: string
  onChange: (name: string) => void
  onNext: () => void
}

// 기획안 화면 3: "레이어 이름을 적어주세요" 입력 화면.
export function NameInput({ name, onChange, onNext }: NameInputProps) {
  return (
    <div className='mx-auto flex aspect-9/16 w-full max-w-xs flex-col items-center justify-center gap-4 bg-zinc-500 text-white'>
      <input
        value={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder='레이어 이름을 적어주세요.'
        className='border-b border-white/50 bg-transparent px-2 text-center outline-none placeholder:text-white/70'
      />
      <button
        type='button'
        disabled={!name.trim()}
        onClick={onNext}
        className='text-sm underline underline-offset-4 disabled:opacity-40'
      >
        다음
      </button>
    </div>
  )
}
