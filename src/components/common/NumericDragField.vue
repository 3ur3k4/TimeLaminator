<template>
  <div class="numeric-drag-field" :class="{ dragging: isDragging, locked }">
    <button
      class="chevron chevron-left"
      type="button"
      tabindex="-1"
      :disabled="locked"
      @mousedown.stop.prevent
      @click.stop="step(-1)"
    >‹</button>

    <input
      v-if="editing"
      ref="editInputRef"
      v-model="editValue"
      class="numeric-text-input"
      type="text"
      inputmode="decimal"
      @blur="commitEdit"
      @keydown.enter="commitEdit"
      @keydown.escape="cancelEdit"
    />
    <span v-else class="numeric-value" @mousedown="onValueMouseDown">{{ displayValue }}</span>

    <button
      class="chevron chevron-right"
      type="button"
      tabindex="-1"
      :disabled="locked"
      @mousedown.stop.prevent
      @click.stop="step(1)"
    >›</button>

    <button
      class="lock-toggle"
      type="button"
      :class="{ active: locked }"
      :title="locked ? 'Unlock' : 'Lock'"
      @click="$emit('update:locked', !locked)"
    >
      <svg v-if="locked" width="10" height="10" viewBox="0 0 10 10" fill="none">
        <rect x="2" y="4.5" width="6" height="4.5" rx="0.8" fill="currentColor" />
        <path d="M3.2 4.5V3.2a1.8 1.8 0 0 1 3.6 0v1.3" stroke="currentColor" stroke-width="0.9" fill="none" />
      </svg>
      <svg v-else width="10" height="10" viewBox="0 0 10 10" fill="none">
        <rect x="2" y="4.5" width="6" height="4.5" rx="0.8" fill="currentColor" />
        <path d="M3.2 4.5V3.2a1.8 1.8 0 0 1 3.6 0" stroke="currentColor" stroke-width="0.9" fill="none" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: number
  unit?: string
  step?: number
  dragSensitivity?: number
  min?: number
  max?: number
  decimals?: number
  locked?: boolean
}>(), {
  unit: '',
  step: 1,
  dragSensitivity: 0.5,
  decimals: 0,
  locked: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'update:locked', value: boolean): void
}>();

const editing = ref(false);
const editValue = ref('');
const editInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

const clamp = (value: number) => {
  let v = value;
  if (props.min !== undefined) v = Math.max(props.min, v);
  if (props.max !== undefined) v = Math.min(props.max, v);
  return v;
};

const round = (value: number) => {
  const factor = Math.pow(10, props.decimals);
  return Math.round(value * factor) / factor;
};

const displayValue = computed(() => `${props.modelValue.toFixed(props.decimals)}${props.unit}`);

const step = (direction: 1 | -1) => {
  if (props.locked) return;
  emit('update:modelValue', clamp(round(props.modelValue + direction * props.step)));
};

let dragStartX = 0;
let dragStartValue = 0;
let pointerMoved = false;

const onValueMouseDown = (event: MouseEvent) => {
  if (props.locked) return;
  dragStartX = event.clientX;
  dragStartValue = props.modelValue;
  pointerMoved = false;
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const onMouseMove = (event: MouseEvent) => {
  const dx = event.clientX - dragStartX;
  if (Math.abs(dx) > 3) {
    pointerMoved = true;
    isDragging.value = true;
  }
  if (isDragging.value) {
    emit('update:modelValue', clamp(round(dragStartValue + dx * props.dragSensitivity)));
  }
};

const onMouseUp = () => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  if (!pointerMoved) {
    startEdit();
  }
  isDragging.value = false;
};

const startEdit = () => {
  if (props.locked) return;
  editValue.value = String(props.modelValue);
  editing.value = true;
  nextTick(() => {
    editInputRef.value?.focus();
    editInputRef.value?.select();
  });
};

const commitEdit = () => {
  if (!editing.value) return;
  const parsed = parseFloat(editValue.value);
  if (!isNaN(parsed)) {
    emit('update:modelValue', clamp(round(parsed)));
  }
  editing.value = false;
};

const cancelEdit = () => {
  editing.value = false;
};
</script>

<style scoped>
.numeric-drag-field {
  display: flex;
  align-items: center;
  flex: 1;
  height: 28px;
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  user-select: none;
}

.numeric-drag-field.dragging {
  border-color: var(--color-text-info);
}

.numeric-drag-field.locked {
  opacity: 0.5;
}

.chevron {
  flex: 0 0 18px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.1s;
}

.numeric-drag-field:hover .chevron {
  opacity: 1;
}

.chevron:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: var(--color-background-tertiary);
}

.chevron:disabled {
  cursor: default;
}

.numeric-value {
  flex: 1;
  text-align: center;
  font-size: var(--font-size-caption);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
  cursor: ew-resize;
  white-space: nowrap;
}

.numeric-text-input {
  flex: 1;
  width: 100%;
  text-align: center;
  font-size: var(--font-size-caption);
  font-family: var(--font-sans);
  color: var(--color-text-primary);
  background: var(--color-background-tertiary);
  border: none;
  outline: none;
}

.lock-toggle {
  flex: 0 0 18px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-left: 1px solid var(--color-border-secondary);
  color: var(--color-text-tertiary, var(--color-text-secondary));
  cursor: pointer;
  opacity: 0.6;
}

.lock-toggle:hover {
  opacity: 1;
}

.lock-toggle.active {
  color: var(--color-text-info);
  opacity: 1;
}
</style>
