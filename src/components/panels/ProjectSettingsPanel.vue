<template>
  <div class="panel-content">
    <div class="section">
      <h2 class="section-label">Source</h2>
      <div class="control-group">
        <label>Input File</label>
        <button class="btn" @click="triggerFileInput" :disabled="projectStore.isProcessing">
          {{ projectStore.isProcessing ? 'Processing...' : 'Select Video/Images...' }}
        </button>
        <input type="file" ref="fileInput" accept="video/mp4,video/quicktime,video/*" style="display: none" @change="onFileChange" />
        <div v-if="projectStore.isProcessing" class="progress-bar-container">
          <div class="progress-bar" :style="{ width: projectStore.progress * 100 + '%' }"></div>
        </div>
        <div v-if="projectStore.statusMessage" class="status-message">{{ projectStore.statusMessage }}</div>
      </div>
      <div class="control-group">
        <label>Frame Range</label>
        <div class="range-inputs">
          <input type="number" v-model="parameterStore.frameRange[0]" class="number-input" />
          <span> - </span>
          <input type="number" v-model="parameterStore.frameRange[1]" class="number-input" />
        </div>
      </div>
      <div class="control-group">
        <label>Binarization Threshold</label>
        <div class="slider-group">
          <input type="range" v-model="parameterStore.threshold" min="0" max="255" />
          <span class="value-readout">{{ parameterStore.threshold }}</span>
        </div>
      </div>
      <div class="control-group">
        <label>Max Resolution (px, longer edge)</label>
        <input type="number" v-model="parameterStore.maxResolution" min="32" step="32" class="number-input" />
      </div>
      <div class="control-group" v-if="previewUrl">
        <label>Preview</label>
        <video :src="previewUrl" class="video-preview" controls muted></video>
      </div>
    </div>

    <div class="section">
      <h2 class="section-label">Target Size</h2>
      <div class="control-group">
        <label>Max Extent (mm)</label>
        <input type="number" v-model="projectStore.targetPhysicalSize" class="number-input" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { useProjectStore } from '../../stores/useProjectStore';
import { useParameterStore } from '../../stores/useParameterStore';

const projectStore = useProjectStore();
const parameterStore = useParameterStore();

const fileInput = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);

const triggerFileInput = () => {
  fileInput.value?.click();
};

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = URL.createObjectURL(file);
    projectStore.processVideo(file);
  }
};

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});
</script>

<style scoped>
.panel-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.control-group label {
  font-size: var(--font-size-caption);
  color: var(--color-text-primary);
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.number-input {
  width: 100%;
  height: 36px;
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  padding: 0 var(--space-sm);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

.number-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-background-info);
  border-color: var(--color-text-info);
}

.slider-group {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.slider-group input[type="range"] {
  flex: 1;
}

.value-readout {
  font-size: var(--font-size-caption);
  font-variant-numeric: tabular-nums;
  min-width: 24px;
  text-align: right;
}

.progress-bar-container {
  width: 100%;
  height: 4px;
  background: var(--color-background-tertiary);
  border-radius: 2px;
  overflow: hidden;
  margin-top: var(--space-xs);
}

.progress-bar {
  height: 100%;
  background: var(--color-background-info);
  transition: width 0.1s linear;
}

.status-message {
  font-size: var(--font-size-caption);
  color: var(--color-text-secondary);
  margin-top: var(--space-xs);
}

.video-preview {
  width: 100%;
  max-height: 160px;
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
}
</style>
