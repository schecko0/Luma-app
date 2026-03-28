import { getDb } from './database'
import type { PaginationParams, PaginatedResult } from '../renderer/src/types'

/**
 * Genera el siguiente folio de factura de forma atómica.
 * Formato: V-00001, V-00002, ...
 */
export function getNextInvoiceFolio(): string {
  const db = getDb()
  const update = db.prepare(`
    UPDATE invoice_sequence SET last_seq = last_seq + 1 WHERE id = 1
  `)
  const select = db.prepare(`SELECT last_seq FROM invoice_sequence WHERE id = 1`)

  // Transacción atómica: incrementar y leer en un solo paso
  const getNextFolio = db.transaction(() => {
    update.run()
    const row = select.get() as { last_seq: number }
    return row.last_seq
  })

  const seq = getNextFolio()
  return `V-${String(seq).padStart(5, '0')}`
}

/**
 * Construye una query paginada genérica.
 * Recibe la query base (sin LIMIT/OFFSET) y los parámetros de paginación.
 */
export function paginate<T>(
  baseQuery: string,
  countQuery: string,
  params: unknown[],
  pagination: PaginationParams
): PaginatedResult<T> {
  const db = getDb()
  const { page, pageSize } = pagination
  const offset = (page - 1) * pageSize

  const items = db.prepare(`${baseQuery} LIMIT ? OFFSET ?`).all([...params, pageSize, offset]) as T[]
  const countRow = db.prepare(countQuery).get(params) as { total: number }

  return {
    items,
    total: countRow?.total ?? 0,
    page,
    pageSize,
  }
}

/**
 * Envuelve una operación en una transacción SQLite.
 * Si lanza error, hace rollback automático.
 */
export function withTransaction<T>(fn: () => T): T {
  const db = getDb()
  const transaction = db.transaction(fn)
  return transaction()
}

/**
 * Convierte un booleano JS a entero SQLite (1/0).
 */
export function boolToInt(val: boolean): number {
  return val ? 1 : 0
}

/**
 * Convierte un entero SQLite (1/0) a booleano JS.
 */
export function intToBool(val: number | null): boolean {
  return val === 1
}

/**
 * Retorna la fecha/hora actual en formato ISO 8601 (para columnas TEXT de SQLite).
 */
export function nowISO(): string {
  return new Date().toISOString()
}
