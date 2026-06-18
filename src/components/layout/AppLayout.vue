<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <input
          class="project-title-input"
          :value="projectName"
          @input="emit('update:projectName', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="header-right">
        <button class="btn" @click="emit('open')">Open</button>
        <button class="btn" @click="emit('save')">Save</button>
        <button class="btn btn-primary" @click="emit('export')">Export</button>
      </div>
    </header>
    
    <main class="app-main">
      <aside class="panel left-panel">
        <slot name="left"></slot>
      </aside>
      
      <section class="center-preview">
        <slot name="center"></slot>
      </section>
      
      <aside class="panel right-panel">
        <slot name="right"></slot>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
// Layout component
defineProps<{
  projectName: string
}>();

const emit = defineEmits<{
  (e: 'export'): void
  (e: 'open'): void
  (e: 'save'): void
  (e: 'update:projectName', value: string): void
}>();
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--color-background-primary);
}

.app-header {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-lg);
  border-bottom: 0.5px solid var(--color-border-tertiary);
  background-color: var(--color-background-secondary);
}

.project-title-input {
  font-family: var(--font-sans);
  font-size: var(--font-size-section);
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0;
  background: transparent;
  border: none;
  outline: none;
  padding: var(--space-xs);
  border-radius: var(--border-radius-md);
  min-width: 160px;
}

.project-title-input:hover,
.project-title-input:focus {
  background: var(--color-background-tertiary);
}

.project-title-input:focus {
  box-shadow: 0 0 0 2px var(--color-background-info);
}

.header-right {
  display: flex;
  gap: var(--space-sm);
}

.app-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.panel {
  display: flex;
  flex-direction: column;
  padding: var(--space-lg);
  overflow-y: auto;
  background-color: var(--color-background-secondary);
}

.left-panel {
  width: 220px;
  border-right: 0.5px solid var(--color-border-tertiary);
}

.center-preview {
  flex: 1;
  position: relative;
  background-color: var(--color-background-primary);
  display: flex;
  flex-direction: column;
}

.right-panel {
  width: 240px;
  border-left: 0.5px solid var(--color-border-tertiary);
}
</style>
