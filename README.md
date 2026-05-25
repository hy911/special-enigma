# Qwen3.6 对话页面

纯前端（Vue 3 + Vite）对话应用，直接调用本地 Qwen3.6 模型（OpenAI 兼容接口），支持：

- 流式输出
- Markdown 渲染（含代码高亮）
- Web Search（Tavily）—— 由模型通过 tool calling 自动决定是否联网搜索

## 配置

复制 `.env.example` 为 `.env` 并按需修改：

```bash
cp .env.example .env
```

| 变量 | 说明 |
| --- | --- |
| `VITE_BASE_URL` | 本地模型的 OpenAI 兼容地址，注意带 `/v1`，如 `http://172.16.113.1:8000/v1` |
| `VITE_MODEL` | 模型名，按部署填写 |
| `VITE_API_KEY` | 本地模型若无鉴权可填 `sk-noop` |
| `VITE_TAVILY_KEY` | Tavily 的 API key |

> ⚠️ 纯前端方案下，Tavily key 会包含在浏览器产物中，**仅适合本地/内网自用**。`.env` 已被 git 忽略。

## 运行

```bash
npm install
npm run dev
```

浏览器打开 Vite 提示的地址（默认 http://localhost:5173）。

## 重要：开启本地模型 CORS

浏览器直连模型需要服务端允许跨域。以 vLLM 为例，启动时加上：

```bash
vllm serve <model> --host 0.0.0.0 --port 8000 \
  --allowed-origins '["*"]'
```

若 Tavily 浏览器直连遇到 CORS 限制：把 `src/lib/tavily.js` 里的 `ENDPOINT`
改为 `'/tavily/search'`，开发环境会走 `vite.config.js` 中已配置的代理。

## 构建

```bash
npm run build      # 产物在 dist/
npm run preview
```
