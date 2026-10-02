import { useEffect, useMemo, useRef, useState } from 'react'
import { parseDeliveryCsv } from './lib/csv'
import {
  createDirectionsRenderer,
  createMap,
  drawDeliveryRoute,
  loadGoogleMaps,
  optimizeByGeocodedDistance,
} from './lib/googleMaps'
import { buildGoogleMapsUrl, moveItem } from './lib/route'
import {
  clearHistory,
  readHistory,
  readRestaurantAddress,
  saveHistory,
  saveRestaurantAddress,
} from './lib/storage'
import type { CsvIssue, Delivery, RouteHistoryEntry } from './types'

const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''
const MAX_MVP_STOPS = 20

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function makeHistoryEntry(
  restaurantAddress: string,
  deliveries: Delivery[],
): RouteHistoryEntry {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    restaurantAddress,
    deliveries,
  }
}

export default function App() {
  const [restaurantAddress, setRestaurantAddress] = useState(readRestaurantAddress)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [issues, setIssues] = useState<CsvIssue[]>([])
  const [history, setHistory] = useState<RouteHistoryEntry[]>(readHistory)
  const [fileName, setFileName] = useState('')
  const [mapState, setMapState] = useState<'disabled' | 'loading' | 'ready' | 'error'>(
    mapsApiKey ? 'loading' : 'disabled',
  )
  const [message, setMessage] = useState('')
  const [optimizing, setOptimizing] = useState(false)

  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const directionsRef = useRef<google.maps.DirectionsRenderer | null>(null)

  const pending = deliveries.filter((delivery) => delivery.status === 'pending')
  const completed = deliveries.length - pending.length
  const googleMapsUrl = useMemo(
    () => buildGoogleMapsUrl(restaurantAddress, deliveries),
    [restaurantAddress, deliveries],
  )

  useEffect(() => {
    saveRestaurantAddress(restaurantAddress)
  }, [restaurantAddress])

  useEffect(() => {
    if (!mapsApiKey || !mapElementRef.current) return

    let active = true
    setMapState('loading')

    loadGoogleMaps(mapsApiKey)
      .then(() => {
        if (!active || !mapElementRef.current) return
        const map = createMap(mapElementRef.current)
        const renderer = createDirectionsRenderer(map)
        mapRef.current = map
        directionsRef.current = renderer
        setMapState('ready')
      })
      .catch((error: unknown) => {
        if (!active) return
        setMapState('error')
        setMessage(error instanceof Error ? error.message : 'Falha ao carregar o mapa.')
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (
      mapState !== 'ready' ||
      !mapRef.current ||
      !directionsRef.current ||
      !restaurantAddress.trim() ||
      pending.length === 0
    ) {
      return
    }

    const timeout = window.setTimeout(() => {
      drawDeliveryRoute(
        mapRef.current!,
        directionsRef.current!,
        restaurantAddress,
        deliveries,
      ).catch((error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível desenhar a rota no mapa.',
        )
      })
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [deliveries, restaurantAddress, mapState])

  async function handleCsv(file: File) {
    setMessage('')
    setFileName(file.name)

    try {
      const content = await file.text()
      const result = parseDeliveryCsv(content)
      setIssues(result.issues)

      if (result.deliveries.length > MAX_MVP_STOPS) {
        setDeliveries(result.deliveries.slice(0, MAX_MVP_STOPS))
        setMessage(
          `O MVP usa no máximo ${MAX_MVP_STOPS} entregas por rota. As demais linhas não foram carregadas.`,
        )
      } else {
        setDeliveries(result.deliveries)
      }
    } catch {
      setIssues([{ line: 1, message: 'Não foi possível ler o arquivo enviado.' }])
      setDeliveries([])
    }
  }

  async function optimizeRoute() {
    if (!restaurantAddress.trim()) {
      setMessage('Informe o endereço do restaurante antes de gerar a rota.')
      return
    }

    if (deliveries.length === 0) {
      setMessage('Importe um CSV com pelo menos uma entrega.')
      return
    }

    if (!mapsApiKey) {
      setMessage(
        'Configure VITE_GOOGLE_MAPS_API_KEY para localizar os endereços e otimizar a ordem.',
      )
      return
    }

    if (mapState !== 'ready') {
      setMessage('O Google Maps ainda não está pronto. Tente novamente em alguns segundos.')
      return
    }

    setOptimizing(true)
    setMessage('Localizando endereços e calculando uma ordem inicial...')

    try {
      const ordered = await optimizeByGeocodedDistance(restaurantAddress, deliveries)
      const normalized = ordered.map((delivery) => ({
        ...delivery,
        status: delivery.status ?? 'pending',
      }))

      setDeliveries(normalized)
      const nextHistory = saveHistory(makeHistoryEntry(restaurantAddress, normalized))
      setHistory(nextHistory)
      setMessage('Rota ordenada. Revise a sequência e ajuste manualmente se necessário.')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível otimizar a rota com os endereços informados.',
      )
    } finally {
      setOptimizing(false)
    }
  }

  function reorder(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    setDeliveries((current) => moveItem(current, index, nextIndex))
  }

  function toggleCompleted(id: string) {
    setDeliveries((current) =>
      current.map((delivery) =>
        delivery.id === id
          ? {
              ...delivery,
              status: delivery.status === 'completed' ? 'pending' : 'completed',
            }
          : delivery,
      ),
    )
  }

  function restoreRoute(entry: RouteHistoryEntry) {
    setRestaurantAddress(entry.restaurantAddress)
    setDeliveries(entry.deliveries.map((delivery) => ({ ...delivery, status: 'pending' })))
    setIssues([])
    setFileName('Rota restaurada do histórico')
    setMessage('Rota restaurada. Você pode editar a sequência antes de sair para entrega.')
  }

  function resetWorkspace() {
    setDeliveries([])
    setIssues([])
    setFileName('')
    setMessage('')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <div>
            <strong>Rotas</strong>
            <small>organizador de entregas</small>
          </div>
        </div>
        <span className="mvp-badge">MVP</span>
      </header>

      <main className="page">
        <section className="hero">
          <div className="hero-copy-block">
            <p className="eyebrow">ROTEAMENTO PARA RESTAURANTES</p>
            <h1>Uma rota boa começa com uma ordem afiada.</h1>
            <p className="hero-copy">
              Importe os pedidos, organize a sequência e transforme uma lista solta em
              um trajeto pronto para sair da cozinha e ganhar a rua.
            </p>
          </div>

          <div className="hero-side">
            <div className="route-sculpture" aria-hidden="true">
              <div className="pencil-line" />
              <div className="sharpener-cap">
                <span />
              </div>
              <div className="shaving shaving-1" />
              <div className="shaving shaving-2" />
              <div className="shaving shaving-3" />
              <div className="shaving shaving-4" />
              <div className="shaving shaving-5" />
              <div className="route-tail" />
            </div>

            <div className="hero-summary" aria-label="Resumo da rota">
              <div>
                <span>{deliveries.length}</span>
                <small>entregas</small>
              </div>
              <div>
                <span>{pending.length}</span>
                <small>pendentes</small>
              </div>
              <div>
                <span>{completed}</span>
                <small>concluídas</small>
              </div>
            </div>
          </div>
        </section>

        <section className="setup-grid">
          <article className="panel origin-panel">
            <div className="panel-heading">
              <div>
                <span className="step">1</span>
                <h2>Ponto de saída</h2>
              </div>
              <span className={`status-dot ${mapState}`}>
                {mapState === 'ready'
                  ? 'Google Maps pronto'
                  : mapState === 'disabled'
                    ? 'API não configurada'
                    : mapState === 'error'
                      ? 'Falha no mapa'
                      : 'Carregando mapa'}
              </span>
            </div>

            <label htmlFor="restaurant">Endereço do restaurante</label>
            <input
              id="restaurant"
              type="text"
              value={restaurantAddress}
              onChange={(event) => setRestaurantAddress(event.target.value)}
              placeholder="Ex.: Rua Principal, 120 - Centro, Fortaleza - CE"
              autoComplete="street-address"
            />
            <p className="helper">
              Esse endereço será sempre o ponto inicial. Ele fica salvo apenas neste
              navegador.
            </p>
          </article>

          <article className="panel import-panel">
            <div className="panel-heading">
              <div>
                <span className="step">2</span>
                <h2>Pedidos por CSV</h2>
              </div>
              {fileName && <span className="file-name">{fileName}</span>}
            </div>

            <label className="file-drop">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleCsv(file)
                  event.currentTarget.value = ''
                }}
              />
              <strong>Selecionar arquivo CSV</strong>
              <span>Colunas obrigatórias: id, cliente, endereco</span>
            </label>

            <a className="text-link" href="/modelo-pedidos.csv" download>
              Baixar CSV de exemplo
            </a>
          </article>
        </section>

        {issues.length > 0 && (
          <section className="notice error-notice">
            <strong>Revise o arquivo antes de continuar.</strong>
            <ul>
              {issues.slice(0, 6).map((issue) => (
                <li key={`${issue.line}-${issue.message}`}>
                  Linha {issue.line}: {issue.message}
                </li>
              ))}
            </ul>
            {issues.length > 6 && <p>+ {issues.length - 6} problema(s) não exibido(s).</p>}
          </section>
        )}

        {message && <section className="notice">{message}</section>}

        <section className="workspace-grid">
          <article className="panel map-panel">
            <div className="panel-heading route-heading">
              <div>
                <span className="step">3</span>
                <h2>Mapa da rota</h2>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={resetWorkspace}
                disabled={deliveries.length === 0}
              >
                Limpar
              </button>
            </div>

            <div className="map-wrap">
              <div ref={mapElementRef} className="map-canvas" aria-label="Mapa da rota" />

              {mapState !== 'ready' && (
                <div className="map-fallback">
                  <strong>
                    {mapState === 'disabled'
                      ? 'Configure o Google Maps para ativar o mapa.'
                      : mapState === 'error'
                        ? 'O mapa não pôde ser carregado.'
                        : 'Carregando Google Maps...'}
                  </strong>
                  <p>
                    Sem a chave, o CSV, a sequência manual e o histórico continuam
                    funcionando. A otimização geográfica precisa da API.
                  </p>
                </div>
              )}
            </div>

            <div className="map-actions">
              <button
                className="button primary"
                type="button"
                onClick={() => void optimizeRoute()}
                disabled={optimizing || deliveries.length === 0}
              >
                {optimizing ? 'Calculando...' : 'Gerar melhor ordem'}
              </button>

              <a
                className={`button maps-link ${googleMapsUrl ? '' : 'disabled'}`}
                href={googleMapsUrl || undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!googleMapsUrl}
              >
                Abrir no Google Maps
              </a>
            </div>

            <p className="algorithm-note">
              O MVP usa uma heurística de vizinho mais próximo sobre as coordenadas dos
              endereços. É rápida e útil para validar o fluxo, mas ainda não é um
              otimizador logístico avançado.
            </p>
          </article>

          <article className="panel sequence-panel">
            <div className="panel-heading">
              <div>
                <span className="step">4</span>
                <h2>Sequência de entregas</h2>
              </div>
              <span className="muted">{deliveries.length} paradas</span>
            </div>

            {deliveries.length === 0 ? (
              <div className="empty-state">
                <strong>Nenhum pedido carregado.</strong>
                <p>Importe um CSV para montar a primeira rota.</p>
              </div>
            ) : (
              <ol className="route-list">
                {deliveries.map((delivery, index) => (
                  <li
                    className={delivery.status === 'completed' ? 'completed' : ''}
                    key={delivery.id}
                  >
                    <div className="stop-number">{index + 1}</div>
                    <div className="stop-content">
                      <div className="stop-title">
                        <strong>{delivery.customer}</strong>
                        <span>#{delivery.id}</span>
                      </div>
                      <p>{delivery.address}</p>
                      {(delivery.phone || delivery.note) && (
                        <small>
                          {[delivery.phone, delivery.note].filter(Boolean).join(' · ')}
                        </small>
                      )}
                      <div className="stop-actions">
                        <button
                          type="button"
                          onClick={() => reorder(index, -1)}
                          disabled={index === 0}
                          aria-label={`Mover ${delivery.customer} para cima`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => reorder(index, 1)}
                          disabled={index === deliveries.length - 1}
                          aria-label={`Mover ${delivery.customer} para baixo`}
                        >
                          ↓
                        </button>
                        <button
                          className="complete-button"
                          type="button"
                          onClick={() => toggleCompleted(delivery.id)}
                        >
                          {delivery.status === 'completed'
                            ? 'Reabrir entrega'
                            : 'Marcar concluída'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </section>

        <section className="panel history-panel">
          <div className="panel-heading">
            <div>
              <span className="step">5</span>
              <h2>Histórico local</h2>
            </div>
            <button
              className="text-button"
              type="button"
              disabled={history.length === 0}
              onClick={() => {
                clearHistory()
                setHistory([])
              }}
            >
              Apagar histórico
            </button>
          </div>

          {history.length === 0 ? (
            <p className="muted">
              As rotas geradas aparecerão aqui e ficarão salvas neste navegador.
            </p>
          ) : (
            <div className="history-list">
              {history.map((entry) => (
                <button
                  type="button"
                  className="history-item"
                  onClick={() => restoreRoute(entry)}
                  key={entry.id}
                >
                  <span>
                    <strong>{entry.deliveries.length} entregas</strong>
                    <small>{entry.restaurantAddress}</small>
                  </span>
                  <time>{formatDate(entry.createdAt)}</time>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>Rotas MVP</span>
        <span>CSV → ordenar → revisar → Google Maps</span>
      </footer>
    </div>
  )
}
