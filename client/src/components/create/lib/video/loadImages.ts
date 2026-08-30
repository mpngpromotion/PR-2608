export async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)

  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    // decode()가 끝나기 전에 revoke하면 안 된다.
    URL.revokeObjectURL(url)
  }
}

export async function filesToImages(files: File[]) {
  return Promise.all(files.map(fileToImage))
}

// 앱의 사진 업로드 단계는 File을 바로 URL.createObjectURL()로 바꿔서 들고 있으므로,
// export 시점엔 File이 아니라 이 object URL 문자열만 남아있다.
export async function urlToImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  await image.decode()
  return image
}
