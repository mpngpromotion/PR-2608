'use client'

import { ChangeEvent } from 'react'

interface ImagePickerProps {
  onSelect: (photoUrls: string[]) => void
}

export function ImagePicker({ onSelect }: ImagePickerProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    onSelect(files.map((file) => URL.createObjectURL(file)))
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm opacity-70">사진을 선택해주세요.</p>
      <input type="file" accept="image/*" multiple onChange={handleChange} />
    </div>
  )
}
