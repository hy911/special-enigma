const env = import.meta.env

export const config = {
  baseURL: env.VITE_BASE_URL || 'http://172.16.113.1:8000/v1',
  model: env.VITE_MODEL || 'qwen3.6',
  apiKey: env.VITE_API_KEY || 'sk-noop',
  tavilyKey: env.VITE_TAVILY_KEY || '',
}
