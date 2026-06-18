/**
 * Compressão de imagem no navegador (canvas) antes do upload — economiza espaço.
 * Redimensiona para `maxSize` no maior lado e exporta em WebP (mantém transparência).
 */
export async function compressImage(file: File, maxSize = 512, quality = 0.85): Promise<Blob> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(new Error("read_error"))
    r.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error("img_error"))
    i.src = dataUrl
  })

  let { width, height } = img
  if (width > maxSize || height > maxSize) {
    const scale = maxSize / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas_error")
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality))
  if (blob) return blob
  // fallback: PNG (alguns navegadores antigos não exportam webp)
  const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"))
  if (!png) throw new Error("compress_error")
  return png
}
