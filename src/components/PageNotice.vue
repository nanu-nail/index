<template>
  <div class="page-notice" :class="`page-notice--${tone}`" role="status">
    <strong v-if="title">{{ title }}</strong>
    <span><slot /></span>
  </div>
</template>

<script>
export default {
  name: 'PageNotice',
  props: {
    title: { type: String, default: '' },
    tone: { type: String, default: 'info' }
  }
}
</script>

<style scoped>
.page-notice { padding: 18px 20px; border: 1px solid #e7ded7; background: #fffdfa; color: #655d58; font-size: 15.666px; line-height: 1.8; }
.page-notice strong { display: block; margin-bottom: 4px; color: #302a27; font-weight: 500; }
.page-notice--warning { border-color: #e5cbbd; background: #fbf3ed; }
</style>
