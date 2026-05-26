<script setup>
import { computed } from 'vue'
import { render } from '../lib/markdown.js'

const props = defineProps({
  role: { type: String, required: true },
  content: { type: String, default: '' },
  reasoning: { type: String, default: '' },
})

const html = computed(() => render(props.content))
const reasoningHtml = computed(() => render(props.reasoning))
const isUser = computed(() => props.role === 'user')
const hasReasoning = computed(() => !isUser.value && props.reasoning && props.reasoning.length > 0)
</script>

<template>
  <div class="row" :class="{ user: isUser }">
    <div class="bubble" :class="role">
      <div v-if="isUser" class="plain">{{ content }}</div>
      <template v-else>
        <details v-if="hasReasoning" class="thinking" open>
          <summary>思考过程</summary>
          <div class="md" v-html="reasoningHtml"></div>
        </details>
        <div class="md" v-html="html"></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  margin: 14px 0;
}
.row.user {
  justify-content: flex-end;
}
.bubble {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.6;
  word-break: break-word;
}
.bubble.user {
  background: var(--user);
  color: #fff;
}
.bubble.assistant {
  background: var(--assistant);
  border: 1px solid var(--border);
}
.plain {
  white-space: pre-wrap;
}
.thinking {
  margin-bottom: 10px;
  border-left: 3px solid var(--border);
  padding: 4px 0 4px 12px;
}
.thinking summary {
  cursor: pointer;
  color: var(--muted);
  font-size: 13px;
  user-select: none;
}
.thinking .md {
  margin-top: 6px;
  color: var(--muted);
  font-size: 14px;
}
</style>
