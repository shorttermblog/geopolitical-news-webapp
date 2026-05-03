import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Download, ExternalLink, Globe2, Loader2, Newspaper, RefreshCw, Sparkles } from 'lucide-react'
import './styles.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const defaultQueries = ['Iran war', 'Iran Israel', 'Middle East'].join('\n')
const RANKING_MODE = 'keyword'

function cleanError(error) {
  const msg = error?.message || String(error)
  return msg.length > 900 ? msg.slice(0, 900) + '...' : msg
}

async function postJson(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `Request failed: ${res.status}`)
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
  for (const row of rows) csv.push(keys.map((key) => csvEscape(row[key])).join(','))

  const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8-sig;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'news.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-950">{value ?? '—'}</div>
    </div>
  )
}

function FieldLabel({ children }) {
  return <label className="text-sm font-semibold text-slate-700">{children}</label>
}

function App() {
  const [topic, setTopic] = useState('Iran war')
  const [queries, setQueries] = useState(defaultQueries)
  const [maxArticles, setMaxArticles] = useState(50)
  const [topN, setTopN] = useState(5)
  const [maxAgeHours, setMaxAgeHours] = useState(24)
  const [queryCount, setQueryCount] = useState(5)
  const [articles, setArticles] = useState([])
  const [summary, setSummary] = useState('')
  const [stats, setStats] = useState(null)
  const [status, setStatus] = useState('Ready')
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')

  const queryList = useMemo(
    () => queries.split('\n').map((q) => q.trim()).filter(Boolean),
    [queries]
  )

  async function suggestQueries() {
    if (!topic.trim()) return setError('Please enter a topic first.')

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
    if (!topic.trim()) return setError('Please enter a topic.')
    if (!queryList.length) return setError('Please enter at least one query.')

    setError('')
    setLoading(true)
    setArticles([])
    setSummary('')
    setStats(null)
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
      setStats(data.stats || null)
      setStatus(`Done. ${(data.articles || []).length} articles shown.`)
    } catch (err) {
      setError(cleanError(err))
      setStatus('Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_30%),linear-gradient(180deg,#f8fafc,#eef2ff)] p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-soft backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
                <Globe2 className="h-4 w-4" /> Geopolitical monitoring dashboard
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">
                Geopolitical News Intelligence
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                Search Google News RSS, rank recent headlines, and generate a concise AI briefing from RSS metadata only.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-4 text-white shadow-lg xl:min-w-[360px]">
              <div className="text-xs uppercase tracking-wide text-slate-300">Status</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                {(loading || suggesting) && <Loader2 className="h-4 w-4 animate-spin" />}
                {status}
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Monitor setup</h2>
              <p className="mt-1 text-sm text-slate-500">Ranking uses the stable keyword mode by default.</p>
            </div>
            <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 md:block">
              {queryList.length} active queries
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.75fr)_minmax(360px,1.25fr)_minmax(360px,1fr)]">
            <div className="space-y-2">
              <FieldLabel>Topic</FieldLabel>
              <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Iran war" />
            </div>

            <div className="space-y-2 xl:row-span-2">
              <FieldLabel>Queries</FieldLabel>
              <textarea className="textarea h-40" value={queries} onChange={(e) => setQueries(e.target.value)} />
              <p className="text-xs text-slate-500">One query per line.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <FieldLabel>Max articles/query</FieldLabel>
                <input className="input" type="number" min="1" max="500" value={maxArticles} onChange={(e) => setMaxArticles(e.target.value)} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Top N summary</FieldLabel>
                <input className="input" type="number" min="1" max="50" value={topN} onChange={(e) => setTopN(e.target.value)} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Max article age</FieldLabel>
                <input className="input" type="number" min="1" max="480" value={maxAgeHours} onChange={(e) => setMaxAgeHours(e.target.value)} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Suggested queries</FieldLabel>
                <input className="input" type="number" min="1" max="50" value={queryCount} onChange={(e) => setQueryCount(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 xl:col-start-3">
              <button className="btn-secondary" onClick={suggestQueries} disabled={suggesting || loading}>
                {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Suggest
              </button>
              <button className="btn-primary" onClick={runMonitor} disabled={loading || suggesting}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Run
              </button>
              <button className="btn-secondary" onClick={() => downloadCsv(articles)} disabled={!articles.length}>
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Raw downloaded" value={stats?.raw_downloaded} />
          <StatCard label="Unique" value={stats?.unique_articles} />
          <StatCard label="Recent kept" value={stats?.recent_articles} />
          <StatCard label="Articles shown" value={stats?.articles_shown ?? articles.length} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(520px,1fr)] 2xl:grid-cols-[minmax(0,1.05fr)_minmax(640px,1fr)]">
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-soft backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-sky-700" />
                <h2 className="text-lg font-semibold">Ranked Articles</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                {articles.length} rows
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="max-h-[760px] overflow-y-auto">
                <table className="w-full table-fixed border-collapse bg-white text-left text-[13px]">
                  <colgroup>
                    <col className="w-[52px]" />
                    <col className="w-[70px]" />
                    <col />
                    <col className="w-[115px]" />
                    <col className="w-[150px]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-slate-950 text-[11px] uppercase tracking-wide text-white">
                    <tr>
                      <th className="px-3 py-3">Rank</th>
                      <th className="px-3 py-3">Score</th>
                      <th className="px-3 py-3">Title</th>
                      <th className="px-3 py-3">Source</th>
                      <th className="px-3 py-3">Published</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {articles.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-4 py-12 text-center text-slate-500">
                          Run the monitor to populate the table.
                        </td>
                      </tr>
                    )}

                    {articles.map((row, idx) => (
                      <tr key={`${row.link}-${idx}`} className="align-top hover:bg-sky-50/60">
                        <td className="px-3 py-4 font-semibold text-slate-950">{row.rank}</td>
                        <td className="px-3 py-4 tabular-nums text-slate-700">{Number(row.score || 0).toFixed(3)}</td>
                        <td className="px-3 py-4 font-medium leading-5">
                          <a
                            className="inline-flex items-start gap-1.5 text-sky-800 hover:text-sky-950 hover:underline"
                            href={row.link}
                            target="_blank"
                            rel="noreferrer"
                            title={row.link}
                          >
                            <span>{row.title}</span>
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-none" />
                          </a>
                        </td>
                        <td className="break-words px-3 py-4 text-slate-700">{row.source}</td>
                        <td className="break-words px-3 py-4 text-slate-600">{row.published}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-slate-950 p-5 text-white shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sky-300" />
              <h2 className="text-lg font-semibold">AI Briefing</h2>
            </div>
            <div className="min-h-[760px] whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.06] p-6 text-sm leading-7 text-slate-100 md:text-[15px]">
              {summary || 'The generated geopolitical briefing will appear here.'}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
