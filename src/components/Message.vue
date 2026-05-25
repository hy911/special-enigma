<script setup>
import { computed } from 'vue'
import { render } from '../lib/markdown.js'

const props = defineProps({
  role: { type: String, required: true },
  content: { type: String, default: '' },
})

const html = computed(() => render(props.content))
const isUser = computed(() => props.role === 'user')
</script>

<template>
  <div class="row" :class="{ user: isUser }">
    <div class="bubble" :class="role">
      <div v-if="isUser" class="plain">{{ content }}</div>
      <div v-else class="md" v-html="html"></div>
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
</style>
