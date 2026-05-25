import { config } from '../config.js'

// 浏览器直连 Tavily。若遇到 CORS，可改为 '/tavily/search' 并启用 vite.config.js 中的 proxy。
const ENDPOINT = 'https://api.tavily.com/search'

export async function search(query, { maxResults = 5 } = {}) {
  if (!config.tavilyKey) {
    return '（未配置 Tavily API key，无法联网搜索）'
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: config.tavilyKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: true,
    }),
  })

  if (!res.ok) {
    throw new Error(`Tavily 请求失败：${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const parts = []
  if (data.answer) parts.push(`摘要：${data.answer}`)
  for (const r of data.results || []) {
    parts.push(`标题：${r.title}\n链接：${r.url}\n内容：${r.content}`)
  }
  return parts.join('\n\n') || '（无搜索结果）'
}
