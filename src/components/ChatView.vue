<script setup>
import { ref, nextTick, reactive } from 'vue'
import Message from './Message.vue'
import { streamChat, generateFollowUps } from '../lib/chat.js'
import { config } from '../config.js'

const now = new Date()
const todayStr = now.toLocaleString('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})

const SYSTEM_PROMPT = {
  role: 'system',
  content:
    `当前日期是 ${todayStr}。请以此为准理解“最新”“现状”“今年”等时间相关表述，不要默认更早的年份。\n` +
    '你是一个有帮助的中文助手。回答使用 Markdown 格式。当需要实时或最新信息时，调用 web_search 工具联网搜索后再作答。',
}

// 用于发送给模型的完整历史（含 system）
const history = reactive([SYSTEM_PROMPT])
// 用于展示的消息（不含 system）
const display = ref([])

const input = ref('')
const busy = ref(false)
const status = ref('')
const scroller = ref(null)
const followUps = ref([])
let controller = null
let reqSeq = 0

async function scrollToBottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function send() {
  const text = input.value.trim()
  if (!text || busy.value) return

  input.value = ''
  busy.value = true
  status.value = ''
  followUps.value = []
  const mySeq = ++reqSeq

  history.push({ role: 'user', content: text })
  display.value.push({ role: 'user', content: text })

  const assistantMsg = reactive({ role: 'assistant', content: '', reasoning: '' })
  display.value.push(assistantMsg)
  await scrollToBottom()

  // 打字机平滑输出：token 先进缓冲，rAF 逐帧把字揭示到界面，
  // 保证浏览器逐帧重绘。reasoning（思考）与 content（正式回答）各一条缓冲。
  let reasoningTarget = ''
  let contentTarget = ''
  let streamDone = false

  const reveal = (cur, target) => {
    const remaining = target.length - cur.length
    const step = Math.max(2, Math.ceil(remaining / 12))
    return target.slice(0, cur.length + step)
  }

  const typer = new Promise((resolve) => {
    const tick = () => {
      let working = false
      if (assistantMsg.reasoning.length < reasoningTarget.length) {
        assistantMsg.reasoning = reveal(assistantMsg.reasoning, reasoningTarget)
        working = true
      }
      if (assistantMsg.content.length < contentTarget.length) {
        assistantMsg.content = reveal(assistantMsg.content, contentTarget)
        working = true
      }
      if (working) {
        scrollToBottom()
        requestAnimationFrame(tick)
      } else if (streamDone) {
        resolve()
      } else {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  })

  controller = new AbortController()

  try {
    await streamChat(history, {
      signal: controller.signal,
      onReasoning: (t) => {
        reasoningTarget += t
      },
      onToken: (t) => {
        contentTarget += t
      },
      onToolStart: (q) => {
        status.value = `正在联网搜索：${q}`
        scrollToBottom()
      },
    })
  } catch (e) {
    if (e.name === 'AbortError') {
      contentTarget += '\n\n_（已停止）_'
    } else {
      contentTarget =
        `**出错了：** ${e.message}\n\n请检查本地模型 \`${config.baseURL}\` 是否可达，` +
        '以及是否已开启 CORS（允许浏览器跨域访问）。'
    }
  } finally {
    streamDone = true
    await typer // 等打字机把剩余文字吐完
    history.push({ role: 'assistant', content: assistantMsg.content })
    busy.value = false
    status.value = ''
    controller = null
    scrollToBottom()
  }

  // 回答完成后生成追问 chips（非阻塞输入；用序号防过期结果覆盖）
  const fu = await generateFollowUps(history)
  if (mySeq === reqSeq) {
    followUps.value = fu
    scrollToBottom()
  }
}

function ask(q) {
  if (busy.value) return
  input.value = q
  followUps.value = []
  send()
}

function stop() {
  controller?.abort()
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}
</script>

<template>
  <div class="chat">
    <header>
      <h1>Qwen3.6 对话</h1>
      <span class="model">{{ config.model }} · 流式 · Markdown · Tavily 搜索</span>
    </header>

    <div class="messages" ref="scroller">
      <div v-if="display.length === 0" class="empty">
        开始和本地模型对话吧。需要最新信息时模型会自动联网搜索。
      </div>
      <Message
        v-for="(m, i) in display"
        :key="i"
        :role="m.role"
        :content="m.content"
        :reasoning="m.reasoning"
      />
      <div v-if="status" class="status">{{ status }}</div>
      <div v-if="followUps.length && !busy" class="followups">
        <button
          v-for="(q, i) in followUps"
          :key="i"
          class="chip"
          @click="ask(q)"
        >
          {{ q }}
        </button>
      </div>
    </div>

    <div class="composer">
      <textarea
        v-model="input"
        :disabled="busy"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        rows="1"
        @keydown="onKeydown"
      ></textarea>
      <button v-if="!busy" class="send" :disabled="!input.trim()" @click="send">
        发送
      </button>
      <button v-else class="stop" @click="stop">停止</button>
    </div>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 860px;
  margin: 0 auto;
}
header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
header h1 {
  margin: 0;
  font-size: 18px;
}
.model {
  font-size: 12px;
  color: var(--muted);
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.empty {
  color: var(--muted);
  text-align: center;
  margin-top: 40px;
}
.status {
  color: var(--muted);
  font-size: 13px;
  margin: 6px 4px;
  font-style: italic;
}
.followups {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 10px 4px 4px;
}
.chip {
  align-self: flex-start;
  max-width: 100%;
  text-align: left;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 8px 14px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.chip:hover {
  border-color: var(--user);
}
.composer {
  display: flex;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}
textarea {
  flex: 1;
  resize: none;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  font: inherit;
  max-height: 160px;
}
textarea:focus {
  outline: none;
  border-color: var(--user);
}
button {
  border: none;
  border-radius: 10px;
  padding: 0 20px;
  font: inherit;
  cursor: pointer;
  color: #fff;
}
.send { background: var(--user); }
.send:disabled { opacity: 0.5; cursor: not-allowed; }
.stop { background: #cc3b3b; }
</style>
