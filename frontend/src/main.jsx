import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Download, ExternalLink, Globe2, Loader2, Newspaper, RefreshCw, Search, Sparkles } from 'lucide-react'
import './styles.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const defaultQueries = ['Iran war', 'Iran Israel', 'Middle East'].join('\n')

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
  const [rankingMode, setRankingMode] = useState('keyword')
  const [articles, setArticles] = useState([])
  const [summary, setSummary] = useState('')
  const [stats, setStats] = useState(null)
  const [status, setStatus] = useState('Ready')
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')

  const queryList = useMemo(() => queries.split('\n').map((q) => q.trim()).filter(Boolean), [queries])

  async function suggestQueries() {
    if (!topic.trim()) return setError('Please enter a topic first.')
    setError('')
    setSuggesting(true)
    setStatus('Suggesting search queries...')
    try {
      const data = await postJson('/api/suggest-queries', { topic, n: Number(queryCount) })
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
        ranking_mode: rankingMode,
      })
      setArticles(data.articles || [])
      setSummary(data.summary || '')
      setStats(data.stats || null)
      setStatus(`Done. ${(data.articles || []).length} articles shown. Article bodies read: ${data.stats?.article_bodies_read ?? 0}.`)
    } catch (err) {
      setError(cleanError(err))
      setStatus('Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_30%),linear-gradient(180deg,#f8fafc,#eef2ff)] p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-soft backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
                <Globe2 className="h-4 w-4" /> Geopolitical monitoring dashboard
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">Geopolitical News Intelligence</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">Search Google News RSS, rank recent articles, extract top article excerpts, and generate a concise AI briefing.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-4 text-white shadow-lg">
              <div className="text-xs uppercase tracking-wide text-slate-300">Status</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                {(loading || suggesting) && <Loader2 className="h-4 w-4 animate-spin" />}
                {status}
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[440px_1fr]">
          <aside className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
              <Search className="h-5 w-5 text-sky-700" />
              <h2 className="text-lg font-semibold">Monitor setup</h2>
            </div>

            <div className="mt-5 space-y-5">
              <div className="space-y-2">
                <FieldLabel>Topic</FieldLabel>
                <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Iran war" />
              </div>

              <div className="space-y-2">
                <FieldLabel>Queries</FieldLabel>
                <textarea className="textarea h-36" value={queries} onChange={(e) => setQueries(e.target.value)} />
                <p className="text-xs text-slate-500">One query per line. Current active queries: {queryList.length}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel>Max articles per query</FieldLabel>
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

              <div className="space-y-2">
                <FieldLabel>Ranking mode</FieldLabel>
                <select className="input" value={rankingMode} onChange={(e) => setRankingMode(e.target.value)}>
                  <option value="keyword">Lightweight keyword ranking</option>
                  <option value="local_embeddings">Local embeddings, like your desktop app</option>
                </select>
                <p className="text-xs text-slate-500">Keyword mode is the default for Render stability. Local embeddings require the full requirements file.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <button className="btn-secondary" onClick={suggestQueries} disabled={suggesting || loading}>{suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Suggest</button>
                <button className="btn-primary" onClick={runMonitor} disabled={loading || suggesting}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Run</button>
                <button className="btn-secondary" onClick={() => downloadCsv(articles)} disabled={!articles.length}><Download className="h-4 w-4" />CSV</button>
              </div>

              {error && <div className="whitespace-pre-wrap rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
            </div>
          </aside>

          <section className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Raw downloaded" value={stats?.raw_downloaded} />
              <StatCard label="Unique" value={stats?.unique_articles} />
              <StatCard label="Recent kept" value={stats?.recent_articles} />
              <StatCard label="Articles shown" value={stats?.articles_shown ?? articles.length} />
              <StatCard label="Bodies read" value={stats?.article_bodies_read} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
              <div className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-soft backdrop-blur">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-sky-700" /><h2 className="text-lg font-semibold">Ranked Articles</h2></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{articles.length} rows</span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="max-h-[640px] overflow-auto">
                    <table className="min-w-[1100px] w-full border-collapse bg-white text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-950 text-xs uppercase tracking-wide text-white">
                        <tr>
                          <th className="w-[70px] px-4 py-3">Rank</th>
                          <th className="w-[90px] px-4 py-3">Score</th>
                          <th className="min-w-[420px] px-4 py-3">Title</th>
                          <th className="w-[170px] px-4 py-3">Source</th>
                          <th className="w-[220px] px-4 py-3">Published</th>
                          <th className="min-w-[360px] px-4 py-3">Link</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {articles.length === 0 && <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">Run the monitor to populate the table.</td></tr>}
                        {articles.map((row, idx) => (
                          <tr key={`${row.link}-${idx}`} className="align-top hover:bg-sky-50/60">
                            <td className="px-4 py-4 font-semibold text-slate-950">{row.rank}</td>
                            <td className="px-4 py-4 tabular-nums text-slate-700">{Number(row.score || 0).toFixed(3)}</td>
                            <td className="px-4 py-4 font-medium leading-6 text-slate-950">{row.title}</td>
                            <td className="px-4 py-4 text-slate-700">{row.source}</td>
                            <td className="px-4 py-4 text-slate-600">{row.published}</td>
                            <td className="px-4 py-4"><a className="inline-flex max-w-[340px] items-center gap-2 truncate text-sky-700 hover:text-sky-900 hover:underline" href={row.link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 flex-none" /><span className="truncate">{row.link}</span></a></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/70 bg-slate-950 p-5 text-white shadow-soft">
                <div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-sky-300" /><h2 className="text-lg font-semibold">AI Briefing</h2></div>
                <div className="min-h-[640px] whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-sm leading-7 text-slate-100">{summary || 'The generated geopolitical briefing will appear here.'}</div>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
