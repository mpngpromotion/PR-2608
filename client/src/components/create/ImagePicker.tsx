'use client'

import { ChangeEvent, useState } from 'react'

const MIN_PHOTOS = 5
const MAX_PHOTOS = 10

interface ImagePickerProps {
  onSelect: (photoUrls: string[]) => void
}

// 기획안 화면 4: "사진을 선택해주세요 (5~10장까지 선택 가능)" 화면.
export function ImagePicker({ onSelect }: ImagePickerProps) {
  const [error, setError] = useState('')

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length < MIN_PHOTOS || files.length > MAX_PHOTOS) {
      setError(`${MIN_PHOTOS}~${MAX_PHOTOS}장까지 선택 가능해요. (${files.length}장 선택됨)`)
      return
    }
    setError('')
    onSelect(files.map((file) => URL.createObjectURL(file)))
  }

  return (
    <div className='mx-auto flex aspect-9/16 w-full max-w-xs flex-col items-center justify-center gap-4 bg-zinc-500 text-white'>
      <p className='text-sm'>
        사진을 선택해 주세요
        <br />
        {MIN_PHOTOS}~{MAX_PHOTOS}장까지 선택 가능
      </p>
      <input type='file' accept='image/*' multiple onChange={handleChange} />
      {error && <p className='text-xs text-red-200'>{error}</p>}
    </div>
  )
}
