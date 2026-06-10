export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return isNaN(value) ? null : value
  const str = String(value)
    .replace(/R\$\s?/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim()
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return isNaN(value) ? null : value
  const num = parseFloat(String(value).replace(",", "."))
  return isNaN(num) ? null : num
}

export function applyTransform(value: string, transformacao?: string | null): string {
  if (!transformacao) return value.trim()
  switch (transformacao) {
    case "trim":
      return value.trim()
    case "upper":
      return value.trim().toUpperCase()
    case "lower":
      return value.trim().toLowerCase()
    default:
      return value.trim()
  }
}
