import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

/**
 * Storage de arquivos no Cloudflare R2 (S3-compatível). Mantém o Neon só como
 * banco — aqui guardamos os binários (logos, e futuramente PDFs de edital) e no
 * banco fica apenas a URL pública.
 *
 * Envs (em .env.local local e nas envs do host em prod):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 */

export function r2Configurado(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_URL
  )
}

let _client: S3Client | null = null
function client(): S3Client {
  if (_client) return _client
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  })
  return _client
}

const publicBase = () => (process.env.R2_PUBLIC_URL as string).replace(/\/$/, "")

/** Sobe um arquivo e devolve a URL pública. */
export async function uploadR2(key: string, body: Buffer | Uint8Array, contentType: string): Promise<string> {
  if (!r2Configurado()) throw new Error("R2 não configurado.")
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET as string,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  return `${publicBase()}/${key}`
}

/** Remove um objeto pela URL pública (best-effort; ignora erros). */
export async function removerR2PorUrl(url: string): Promise<void> {
  if (!r2Configurado() || !url) return
  const base = publicBase()
  if (!url.startsWith(base)) return // não é do nosso bucket
  const key = url.slice(base.length + 1)
  try {
    await client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET as string, Key: key }))
  } catch {
    /* best-effort */
  }
}
