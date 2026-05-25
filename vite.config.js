import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // 兜底：若 Tavily 浏览器直连遇到 CORS，可启用此 proxy，
    // 并把 src/lib/tavily.js 的 endpoint 改为 '/tavily/search'
    proxy: {
      '/tavily': {
        target: 'https://api.tavily.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/tavily/, ''),
      },
    },
  },
})
