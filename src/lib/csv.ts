import type { CsvParseResult, Delivery } from '../types'

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')

const aliases: Record<string, string[]> = {
  id: ['id', 'pedido', 'pedido_id', 'order_id'],
  customer: ['cliente', 'nome', 'customer', 'customer_name'],
  address: ['endereco', 'address', 'endereco_entrega'],
  phone: ['telefone', 'celular', 'phone', 'whatsapp'],
  note: ['observacao', 'observacoes', 'nota', 'note'],
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && char === delimiter) {
      count += 1
    }
  }

  return count
}

function detectDelimiter(firstLine: string) {
  const comma = countDelimiter(firstLine, ',')
  const semicolon = countDelimiter(firstLine, ';')
  return semicolon > comma ? ';' : ','
}

export function parseCsvLine(line: string, delimiter: string) {
  const fields: string[] = []
  let current = ''
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (char === delimiter && !quoted) {
      fields.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  fields.push(current.trim())
  return fields
}

function findHeaderIndex(headers: string[], key: keyof typeof aliases) {
  return headers.findIndex((header) => aliases[key].includes(header))
}

export function parseDeliveryCsv(content: string): CsvParseResult {
  const normalizedContent = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()

  if (!normalizedContent) {
    return {
      deliveries: [],
      issues: [{ line: 1, message: 'O arquivo CSV está vazio.' }],
    }
  }

  const lines = normalizedContent.split('\n').filter((line) => line.trim().length > 0)
  const delimiter = detectDelimiter(lines[0])
  const headers = parseCsvLine(lines[0], delimiter).map(normalize)

  const idIndex = findHeaderIndex(headers, 'id')
  const customerIndex = findHeaderIndex(headers, 'customer')
  const addressIndex = findHeaderIndex(headers, 'address')
  const phoneIndex = findHeaderIndex(headers, 'phone')
  const noteIndex = findHeaderIndex(headers, 'note')

  const missingHeaders = [
    idIndex < 0 ? 'id' : null,
    customerIndex < 0 ? 'cliente' : null,
    addressIndex < 0 ? 'endereco' : null,
  ].filter(Boolean)

  if (missingHeaders.length > 0) {
    return {
      deliveries: [],
      issues: [
        {
          line: 1,
          message: `Colunas obrigatórias ausentes: ${missingHeaders.join(', ')}.`,
        },
      ],
    }
  }

  const deliveries: Delivery[] = []
  const issues: CsvParseResult['issues'] = []
  const seenIds = new Set<string>()

  lines.slice(1).forEach((line, index) => {
    const lineNumber = index + 2
    const fields = parseCsvLine(line, delimiter)
    const id = (fields[idIndex] ?? '').trim()
    const customer = (fields[customerIndex] ?? '').trim()
    const address = (fields[addressIndex] ?? '').trim()
    const phone = phoneIndex >= 0 ? (fields[phoneIndex] ?? '').trim() : ''
    const note = noteIndex >= 0 ? (fields[noteIndex] ?? '').trim() : ''

    const missing: string[] = []
    if (!id) missing.push('id')
    if (!customer) missing.push('cliente')
    if (!address) missing.push('endereco')

    if (missing.length > 0) {
      issues.push({
        line: lineNumber,
        message: `Campos obrigatórios vazios: ${missing.join(', ')}.`,
      })
      return
    }

    if (seenIds.has(id)) {
      issues.push({
        line: lineNumber,
        message: `ID duplicado: ${id}.`,
      })
      return
    }

    seenIds.add(id)
    deliveries.push({
      id,
      customer,
      address,
      phone: phone || undefined,
      note: note || undefined,
      status: 'pending',
    })
  })

  return { deliveries, issues }
}
