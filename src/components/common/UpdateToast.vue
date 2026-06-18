<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, updateServiceWorker } = useRegisterSW()
</script>

<template>
  <div v-if="needRefresh" class="update-toast">
    <span class="update-toast__message">Update available</span>
    <button class="update-toast__action" @click="updateServiceWorker()">Reload to apply</button>
  </div>
</template>

<style scoped>
.update-toast {
  position: fixed;
  bottom: var(--space-xl);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: var(--color-background-info);
  color: var(--color-text-info);
  border-radius: var(--border-radius-lg);
  font-size: var(--font-size-body);
}

.update-toast__action {
  background: transparent;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  color: var(--color-text-info);
  font: inherit;
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
}

.update-toast__action:hover {
  background: rgba(255, 255, 255, 0.12);
}

.update-toast__action:active {
  transform: scale(0.98);
}
</style>
