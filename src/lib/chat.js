import { config } from '../config.js'
import { search } from './tavily.js'

const tools = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        '当需要实时、最新或你不确定的外部信息（如新闻、天气、价格、近期事件、具体事实核查）时，调用此工具联网搜索。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词或问题' },
        },
        required: ['query'],
      },
    },
  },
]

const MAX_ROUNDS = 3

// 手动解析 SSE 流，每个 data 事件回调 onEvent(jsonObject)。
// 直接用 fetch + ReadableStream，避免 SDK 对响应体的缓冲，确保真·增量。
async function streamSSE(body, signal, onEvent) {
  const res = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey || 'sk-noop'}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new Error(`模型请求失败：${res.status} ${res.statusText} ${detail}`.trim())
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    // SSE 以空行分隔事件；按行处理 data: 前缀
    let nl
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        onEvent(JSON.parse(data))
      } catch {
        // 忽略不完整/非 JSON 行
      }
    }
  }
}

// messages: 完整对话历史（含 system）。回调用于实时 UI 更新。
export async function streamChat(messages, { onToken, onToolStart, signal } = {}) {
  const working = [...messages]

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let content = ''
    const toolCalls = [] // { id, name, arguments }

    await streamSSE(
      {
        model: config.model,
        messages: working,
        tools,
        tool_choice: 'auto',
        stream: true,
      },
      signal,
      (json) => {
        const delta = json.choices?.[0]?.delta
        if (!delta) return

        if (delta.content) {
          content += delta.content
          onToken?.(delta.content)
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: tc.id || '', name: '', arguments: '' }
            }
            if (tc.id) toolCalls[idx].id = tc.id
            if (tc.function?.name) toolCalls[idx].name += tc.function.name
            if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments
          }
        }
      }
    )

    const calls = toolCalls.filter(Boolean)
    if (calls.length === 0) {
      return content
    }

    // 记录 assistant 的 tool_calls 请求
    working.push({
      role: 'assistant',
      content: content || null,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.arguments },
      })),
    })

    // 执行每个工具调用
    for (const c of calls) {
      let result
      try {
        const args = JSON.parse(c.arguments || '{}')
        if (c.name === 'web_search') {
          onToolStart?.(args.query)
          result = await search(args.query)
        } else {
          result = `未知工具：${c.name}`
        }
      } catch (e) {
        result = `工具执行失败：${e.message}`
      }
      working.push({ role: 'tool', tool_call_id: c.id, content: result })
    }
    // 继续下一轮，让模型基于工具结果作答
  }

  return '（已达到最大工具调用轮次）'
}
