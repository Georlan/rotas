import { describe, expect, it } from 'vitest'
import { parseDeliveryCsv } from './csv'

describe('parseDeliveryCsv', () => {
  it('parses required columns and quoted addresses', () => {
    const result = parseDeliveryCsv(
      'id,cliente,endereco\n1,Ana,"Rua A, 10 - Centro"\n2,Bruno,Rua B 20',
    )

    expect(result.issues).toHaveLength(0)
    expect(result.deliveries).toHaveLength(2)
    expect(result.deliveries[0]).toMatchObject({
      id: '1',
      customer: 'Ana',
      address: 'Rua A, 10 - Centro',
    })
  })

  it('accepts semicolon-delimited files and accented headers', () => {
    const result = parseDeliveryCsv(
      'pedido;cliente;endereço;observação\n10;Carla;Rua C 30;Ligar ao chegar',
    )

    expect(result.issues).toHaveLength(0)
    expect(result.deliveries[0].note).toBe('Ligar ao chegar')
  })

  it('rejects duplicate ids without discarding valid rows', () => {
    const result = parseDeliveryCsv(
      'id,cliente,endereco\n1,Ana,Rua A\n1,Bia,Rua B\n2,Caio,Rua C',
    )

    expect(result.deliveries).toHaveLength(2)
    expect(result.issues[0].message).toContain('ID duplicado')
  })
})
