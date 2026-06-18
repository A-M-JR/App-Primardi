import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, decimals: number = 2) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function maskCurrency(value: string, decimals: number = 2) {
  const cleanValue = value.replace(/\D/g, '')
  if (!cleanValue) return ''
  const numberValue = Number(cleanValue) / Math.pow(10, decimals)
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function parseCurrencyToNumber(value: string): number {
  if (!value) return 0
  return Number(value.replace(/\D/g, '')) / 10000 // Fixo para 4 casas decimais no parse de valores
}

/** Remove tudo que não é dígito. */
export function soDigitos(value: string): string {
  return (value || '').replace(/\D/g, '')
}

/** Máscara de CNPJ: 00.000.000/0000-00 (aplica progressivamente). */
export function maskCnpj(value: string): string {
  const d = soDigitos(value).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** Máscara de CPF: 000.000.000-00. */
export function maskCpf(value: string): string {
  const d = soDigitos(value).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

/** Máscara de CEP: 00000-000. */
export function maskCep(value: string): string {
  const d = soDigitos(value).slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}

/** Máscara de telefone BR: (00) 0000-0000 ou (00) 00000-0000. */
export function maskTelefone(value: string): string {
  const d = soDigitos(value).slice(0, 11)
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

/** Máscara de EAN/GTIN — só dígitos, até 14. */
export function maskEan(value: string): string {
  return soDigitos(value).slice(0, 14)
}
