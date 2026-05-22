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
