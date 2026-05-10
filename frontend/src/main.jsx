import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Download,
  ExternalLink,
  Globe2,
  Loader2,
  Newspaper,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import './styles.css'

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8000' : '')

const defaultQueries = ['Iran war', 'Iran Israel', 'Middle East'].join('\n')
const RANKING_MODE = 'keyword'

function cleanError(error) {
  const msg = error?.message || String(error)
  return msg.length > 900 ? msg.slice(0, 900) + '...' : msg
}

async function postJson(path, payload) {
  if (!API_BASE) {
    throw new Error(
      'Missing VITE_API_BASE_URL. Set it in the frontend Static Site environment variables, then rebuild the frontend.'
    )
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.detail || `Request failed: ${res.status}`)
  }

  return data
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  return '"' + s.replaceAll('"', '""') + '"'
}

function downloadCsv(rows) {
  const headers = ['Rank', 'Score', 'Title', 'Source', 'Published', 'Link']
  const keys = ['rank', 'score', 'title', 'source', 'published', 'link']

  const csv = [headers.map(csvEscape).join(',')]

  for (const row of rows) {
    csv.push(keys.map((key) => csvEscape(row[key])).join(','))
  }

  const blob = new Blob([csv.join('\n')], {
    type: 'text/csv;charset=utf-8-sig;',
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = 'news.csv'

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  URL.revokeObjectURL(url)
}

function FieldLabel({ children }) {
  return <label className="label">{children}</label>
}

function App() {
  const [topic, setTopic] = useState('Iran war')
  const [queries, setQueries] = useState(defaultQueries)
  const [maxArticles, setMaxArticles] = useState(50)
  const [topN, setTopN] = useState(10)
  const [maxAgeHours, setMaxAgeHours] = useState(24)
  const [queryCount, setQueryCount] = useState(5)

  const [articles, setArticles] = useState([])
  const [summary, setSummary] = useState('')
  const [status, setStatus] = useState('Ready')
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')
  const [mobileVisibleCount, setMobileVisibleCount] = useState(5)

  const queryList = useMemo(
    () =>
      queries
        .split('\n')
        .map((q) => q.trim())
        .filter(Boolean),
    [queries]
  )

  const mobileArticles = useMemo(
    () => articles.slice(0, mobileVisibleCount),
    [articles, mobileVisibleCount]
  )

  async function suggestQueries() {
    if (!topic.trim()) {
      setError('Please enter a topic first.')
      return
    }

    setError('')
    setSuggesting(true)
    setStatus('Suggesting search queries...')

    try {
      const data = await postJson('/api/suggest-queries', {
        topic,
        n: Number(queryCount),
      })

      setQueries(data.queries.join('\n'))
      setStatus(`Suggested ${data.queries.length} queries.`)
    } catch (err) {
      setError(cleanError(err))
      setStatus('Query suggestion error')
    } finally {
      setSuggesting(false)
    }
  }

  async function runMonitor() {
    if (!topic.trim()) {
      setError('Please enter a topic.')
      return
    }

    if (!queryList.length) {
      setError('Please enter at least one query.')
      return
    }

    setError('')
    setLoading(true)
    setArticles([])
    setSummary('')
    setMobileVisibleCount(5)
    setStatus(`Fetching RSS articles from ${queryList.length} queries...`)

    try {
      const data = await postJson('/api/run-monitor', {
        topic,
        queries: queryList,
        max_articles: Number(maxArticles),
        top_n: Number(topN),
        max_age_hours: Number(maxAgeHours),
        ranking_mode: RANKING_MODE,
      })

      setArticles(data.articles || [])
      setSummary(data.summary || '')
      setStatus(`Done. ${(data.articles || []).length} articles shown.`)
    } catch (err) {
      setError(cleanError(err))
      setStatus('Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="mx-auto w-full max-w-[1720px] space-y-3 sm:space-y-4">
        <header className="hero-card">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
            <div>
              <div className="eyebrow">
                <Globe2 className="h-4 w-4" />
                Geopolitical intelligence monitor
              </div>

              <h1 className="mt-3 max-w-4xl text-2xl font-semibold tracking-[-0.035em] text-slate-50 sm:text-3xl md:text-5xl">
                News monitoring for geopolitical briefings
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Search Google News RSS, rank recent headlines and generate a
                report
              </p>
            </div>

            <div className="status-card">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                System status
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-50">
                {(loading || suggesting) && (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                )}
                {status}
              </div>
            </div>
          </div>
        </header>

        <section className="panel p-4 md:p-5">
          <div className="mb-4 inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {queryList.length} active queries
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.7fr)_minmax(420px,1.35fr)_minmax(420px,1fr)]">
            <div className="space-y-2">
              <FieldLabel>Topic</FieldLabel>
              <input
                className="input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Iran war"
              />
            </div>

            <div className="space-y-2 xl:row-span-2">
              <FieldLabel>Queries</FieldLabel>
              <textarea
                className="textarea h-32"
                value={queries}
                onChange={(e) => setQueries(e.target.value)}
              />
              <p className="text-xs font-medium text-slate-500">
                One query per line.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <FieldLabel>Max/query</FieldLabel>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="500"
                  value={maxArticles}
                  onChange={(e) => setMaxArticles(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Top N</FieldLabel>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="50"
                  value={topN}
                  onChange={(e) => setTopN(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Age h</FieldLabel>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="480"
                  value={maxAgeHours}
                  onChange={(e) => setMaxAgeHours(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Nr Queries</FieldLabel>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="50"
                  value={queryCount}
                  onChange={(e) => setQueryCount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:col-start-3">
              <button
                className="btn-secondary"
                onClick={suggestQueries}
                disabled={suggesting || loading}
              >
                {suggesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Suggest Queries
              </button>

              <button
                className="btn-primary"
                onClick={runMonitor}
                disabled={loading || suggesting}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Run
              </button>

              <button
                className="btn-secondary"
                onClick={() => downloadCsv(articles)}
                disabled={!articles.length}
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </div>
          )}
        </section>

        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(700px,1fr)]">
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="section-icon">
                  <Newspaper className="h-4 w-4" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    Ranked Articles
                  </h2>
                  <p className="text-xs font-medium text-slate-500">
                    Click a title to open the source.
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {articles.length} rows
              </span>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {articles.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500">
                  Run the monitor to populate the table.
                </div>
              )}

              {mobileArticles.map((row, idx) => (
                <article
                  key={`${row.link}-${idx}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      Rank #{row.rank}
                    </span>

                    <span className="text-xs font-semibold tabular-nums text-slate-500">
                      Score {Number(row.score || 0).toFixed(3)}
                    </span>
                  </div>

                  <a
                    className="flex items-start gap-1.5 text-base font-semibold leading-6 text-slate-950 hover:text-cyan-700"
                    href={row.link}
                    target="_blank"
                    rel="noreferrer"
                    title={row.link}
                  >
                    <span>{row.title}</span>
                    <ExternalLink className="mt-1 h-4 w-4 flex-none text-slate-400" />
                  </a>

                  <div className="mt-3 grid gap-1 text-sm text-slate-600">
                    <div>
                      <span className="font-semibold text-slate-800">
                        Source:
                      </span>{' '}
                      {row.source}
                    </div>

                    <div>
                      <span className="font-semibold text-slate-800">
                        Published:
                      </span>{' '}
                      {row.published}
                    </div>
                  </div>
                </article>
              ))}

              {articles.length > mobileVisibleCount && (
                <button
                  className="btn-secondary"
                  onClick={() =>
                    setMobileVisibleCount((count) =>
                      Math.min(count + 5, articles.length)
                    )
                  }
                >
                  Show 5 more articles
                </button>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
              <div className="max-h-[800px] overflow-y-auto">
                <table className="w-full table-fixed border-collapse text-left text-[13px]">
                  <colgroup>
                    <col className="w-[52px]" />
                    <col className="w-[70px]" />
                    <col />
                    <col className="w-[115px]" />
                    <col className="w-[150px]" />
                  </colgroup>

                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Rank</th>
                      <th className="px-3 py-3">Score</th>
                      <th className="px-3 py-3">Title</th>
                      <th className="px-3 py-3">Source</th>
                      <th className="px-3 py-3">Published</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {articles.length === 0 && (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-4 py-16 text-center text-slate-500"
                        >
                          Run the monitor to populate the table.
                        </td>
                      </tr>
                    )}

                    {articles.map((row, idx) => (
                      <tr
                        key={`${row.link}-${idx}`}
                        className="align-top transition hover:bg-slate-50"
                      >
                        <td className="px-3 py-4 font-semibold text-slate-950">
                          {row.rank}
                        </td>

                        <td className="px-3 py-4 tabular-nums text-slate-600">
                          {Number(row.score || 0).toFixed(3)}
                        </td>

                        <td className="px-3 py-4 font-medium leading-5">
                          <a
                            className="group inline-flex items-start gap-1.5 text-slate-900 hover:text-cyan-700"
                            href={row.link}
                            target="_blank"
                            rel="noreferrer"
                            title={row.link}
                          >
                            <span className="group-hover:underline">
                              {row.title}
                            </span>
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-400 group-hover:text-cyan-700" />
                          </a>
                        </td>

                        <td className="break-words px-3 py-4 text-slate-600">
                          {row.source}
                        </td>

                        <td className="break-words px-3 py-4 text-slate-500">
                          {row.published}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="briefing-card">
            <div className="mb-3 flex items-center gap-2">
              <div className="section-icon-dark">
                <Sparkles className="h-4 w-4" />
              </div>

              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  AI Briefing
                </h2>
                <p className="text-xs font-medium text-slate-400">
                  Generated from ranked RSS metadata.
                </p>
              </div>
            </div>

            <div className="briefing-body">
              {summary || 'The generated geopolitical briefing will appear here.'}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
