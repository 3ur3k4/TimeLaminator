<template>
  <div class="panel-content">
    <div class="section">
      <h2 class="section-label">Voxelization</h2>
      <div class="control-group">
        <label>Layer Pitch (mm)</label>
        <input type="number" v-model="parameterStore.layerPitch" step="0.05" class="number-input" />
      </div>
      <div class="control-group row">
        <label>Invert Stack</label>
        <input type="checkbox" v-model="parameterStore.invertStack" />
      </div>
      <div class="control-group">
        <label>Frame Step</label>
        <input type="number" v-model="parameterStore.frameStep" min="1" class="number-input" />
      </div>
    </div>

    <div class="section">
      <h2 class="section-label">Transform</h2>
      <div class="control-group row">
        <label>Gizmo Mode</label>
        <select v-model="parameterStore.transformMode" class="select-input gizmo-mode-select">
          <option value="rotate">Rotate (R)</option>
          <option value="scale">Scale (S)</option>
        </select>
      </div>
      <label class="subsection-label">Rotate</label>
      <div class="control-group row axis-row">
        <label>X</label>
        <NumericDragField
          v-model="parameterStore.rotationX"
          v-model:locked="rotXLocked"
          unit="°"
          :step="1"
          :drag-sensitivity="0.5"
          :min="-180"
          :max="180"
          :decimals="0"
        />
      </div>
      <div class="control-group row axis-row">
        <label>Y</label>
        <NumericDragField
          v-model="parameterStore.rotationY"
          v-model:locked="rotYLocked"
          unit="°"
          :step="1"
          :drag-sensitivity="0.5"
          :min="-180"
          :max="180"
          :decimals="0"
        />
      </div>
      <div class="control-group row axis-row">
        <label>Z</label>
        <NumericDragField
          v-model="parameterStore.rotationZ"
          v-model:locked="rotZLocked"
          unit="°"
          :step="1"
          :drag-sensitivity="0.5"
          :min="-180"
          :max="180"
          :decimals="0"
        />
      </div>
      <label class="subsection-label">Scale</label>
      <div class="control-group row axis-row">
        <label>X</label>
        <NumericDragField
          v-model="parameterStore.scaleX"
          v-model:locked="scaleXLocked"
          :step="0.05"
          :drag-sensitivity="0.01"
          :min="0.1"
          :max="5"
          :decimals="2"
        />
      </div>
      <div class="control-group row axis-row">
        <label>Y</label>
        <NumericDragField
          v-model="parameterStore.scaleY"
          v-model:locked="scaleYLocked"
          :step="0.05"
          :drag-sensitivity="0.01"
          :min="0.1"
          :max="5"
          :decimals="2"
        />
      </div>
      <div class="control-group row axis-row">
        <label>Z</label>
        <NumericDragField
          v-model="parameterStore.scaleZ"
          v-model:locked="scaleZLocked"
          :step="0.05"
          :drag-sensitivity="0.01"
          :min="0.1"
          :max="5"
          :decimals="2"
        />
      </div>
    </div>

    <div class="section">
      <h2 class="section-label">Cleanup</h2>
      <div class="control-group row">
        <label>Pre-blur (Edge Soften)</label>
        <input type="checkbox" v-model="parameterStore.preBlur" />
      </div>
      <div class="control-group" v-if="parameterStore.preBlur">
        <label>Blur Radius (px)</label>
        <div class="slider-group">
          <input type="range" v-model="parameterStore.blurRadius" min="1" max="6" step="1" />
          <span class="value-readout">{{ parameterStore.blurRadius }}</span>
        </div>
      </div>
      <div class="control-group row">
        <label>Noise Removal (Erode/Dilate)</label>
        <input type="checkbox" v-model="parameterStore.removeNoise" />
      </div>
      <div class="control-group row">
        <label>Speckle Removal</label>
        <input type="checkbox" v-model="parameterStore.removeSpeckles" />
      </div>
      <div class="control-group" v-if="parameterStore.removeSpeckles">
        <label>Min Cluster Size (voxels)</label>
        <input type="number" v-model="parameterStore.speckleSize" min="1" class="number-input" />
      </div>
    </div>

    <div class="section">
      <h2 class="section-label">Mesh Optimization</h2>
      <div class="control-group">
        <label>Algorithm</label>
        <select v-model="parameterStore.algorithm" class="select-input">
          <option value="marching_cubes">Marching Cubes</option>
          <option value="surface_nets">Surface Nets</option>
        </select>
      </div>
      <div class="control-group">
        <label>Target Polygon Count</label>
        <input type="number" v-model="parameterStore.targetPolygonCount" step="1000" class="number-input" />
      </div>
    </div>

    <div class="section">
      <h2 class="section-label">Preview</h2>
      <div class="control-group">
        <label>Render Mode</label>
        <select v-model="parameterStore.renderMode" class="select-input">
          <option value="shaded">Shaded</option>
          <option value="wireframe">Wireframe</option>
          <option value="normals">Normals</option>
        </select>
      </div>
      <div class="control-group row">
        <label>Cross-section</label>
        <input type="checkbox" v-model="parameterStore.crossSectionEnabled" />
      </div>
      <div class="control-group" v-if="parameterStore.crossSectionEnabled">
        <label>Clip Position (Z)</label>
        <div class="slider-group">
          <input type="range" v-model.number="parameterStore.crossSectionPosition" min="0" max="1" step="0.01" />
          <span class="value-readout">{{ Math.round(parameterStore.crossSectionPosition * 100) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useParameterStore } from '../../stores/useParameterStore';
import NumericDragField from '../common/NumericDragField.vue';

const parameterStore = useParameterStore();

// Per-axis lock toggles for the transform fields (UI-only, not persisted).
const rotXLocked = ref(false);
const rotYLocked = ref(false);
const rotZLocked = ref(false);
const scaleXLocked = ref(false);
const scaleYLocked = ref(false);
const scaleZLocked = ref(false);
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

.control-group.row {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.control-group label {
  font-size: var(--font-size-caption);
  color: var(--color-text-primary);
}

.subsection-label {
  font-size: var(--font-size-caption);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: var(--space-xs);
}

.gizmo-mode-select {
  width: auto;
  height: 28px;
}

.axis-row label {
  flex: 0 0 16px;
}

.number-input, .select-input {
  width: 100%;
  height: 36px;
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  padding: 0 var(--space-sm);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

.number-input:focus, .select-input:focus {
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
  min-width: 32px;
  text-align: right;
}
</style>
