import * as XLSX from 'xlsx'
import { downloadBlob } from '@/lib/utils'
import type { BusinessResult, Lead } from '@/types'
import { CATEGORY_LABELS, PIPELINE_LABELS, STATUS_LABELS } from '@/types'

function rowsFromLeads(leads: Lead[]) {
  return leads.map((l) => ({
    Nome: l.name,
    Categoria: CATEGORY_LABELS[l.category],
    Cidade: l.city,
    Estado: l.state,
    Website: l.website ?? '',
    Endereço: l.address,
    Avaliação: l.rating ?? '',
    Avaliações: l.review_count ?? '',
    Telefone: l.phone ?? '',
    Email: l.email ?? '',
    Status: STATUS_LABELS[l.status],
    Pipeline: PIPELINE_LABELS[l.pipeline_stage],
    Observações: l.notes ?? '',
    Criado_em: l.created_at,
  }))
}

function rowsFromBusinesses(results: BusinessResult[]) {
  return results.map((b, i) => ({
    '#': i + 1,
    Nome: b.name,
    Categoria: CATEGORY_LABELS[b.category],
    Cidade: b.city,
    Estado: b.state,
    Endereço: b.address,
    Telefone: b.phone ?? '',
    Email: b.email ?? '',
    Website: b.website ?? '',
    Avaliação: b.rating ?? '',
    Avaliações: b.review_count ?? '',
    Latitude: b.lat ?? '',
    Longitude: b.lng ?? '',
  }))
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join(
    '\n',
  )
}

export function exportLeadsCSV(leads: Lead[], filename = 'openleads-leads.csv') {
  const rows = rowsFromLeads(leads)
  if (!rows.length) return
  downloadBlob(filename, new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
}

export function exportLeadsXLSX(leads: Lead[], filename = 'openleads-leads.xlsx') {
  const rows = rowsFromLeads(leads)
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Leads')
  const ab = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  downloadBlob(
    filename,
    new Blob([ab], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
}

export function exportLeadsJSON(leads: Lead[], filename = 'openleads-leads.json') {
  downloadBlob(
    filename,
    new Blob([JSON.stringify(leads, null, 2)], { type: 'application/json' }),
  )
}

export function exportSearchResultsCSV(
  results: BusinessResult[],
  filename = 'openleads-contatos.csv',
) {
  const rows = rowsFromBusinesses(results)
  if (!rows.length) return
  downloadBlob(filename, new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
}

export function exportSearchResultsXLSX(
  results: BusinessResult[],
  filename = 'openleads-contatos.xlsx',
) {
  const rows = rowsFromBusinesses(results)
  if (!rows.length) return
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Contatos')
  const ab = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  downloadBlob(
    filename,
    new Blob([ab], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
}
