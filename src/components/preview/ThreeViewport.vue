<template>
  <div class="viewport-wrapper">
    <div class="viewport-container" ref="containerRef">
      <!-- Three.js Canvas will be mounted here -->
    </div>
    
    <div class="transform-toolbar" v-if="projectStore.meshData">
      <button
        class="transform-btn"
        :class="{ active: parameterStore.transformMode === 'rotate' }"
        title="Rotate (R)"
        @click="parameterStore.transformMode = 'rotate'"
      >Rotate</button>
      <button
        class="transform-btn"
        :class="{ active: parameterStore.transformMode === 'scale' }"
        title="Scale (S)"
        @click="parameterStore.transformMode = 'scale'"
      >Scale</button>
    </div>

    <div class="stats-overlay" v-if="projectStore.meshData">
      <div class="stat-item">
        <span class="stat-label">Vertices:</span>
        <span class="stat-value">{{ vertexCount.toLocaleString() }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Faces:</span>
        <span class="stat-value">{{ faceCount.toLocaleString() }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Est. size:</span>
        <span class="stat-value">{{ estFileSizeLabel }}</span>
      </div>
      <div class="stat-item" title="Rough estimate, not slicer-accurate">
        <span class="stat-label">Est. print time:</span>
        <span class="stat-value">{{ estPrintTimeLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { useProjectStore } from '../../stores/useProjectStore';
import { useParameterStore } from '../../stores/useParameterStore';
import { STLExporterService } from '../../core/services/STLExporterService';
import {
  computeMeshVolumeMm3,
  estimateBinarySTLBytes,
  estimatePrintTimeMinutes,
  formatBytes,
  formatMinutes,
} from '../../core/utils/meshStats';

const containerRef = ref<HTMLDivElement | null>(null);
const projectStore = useProjectStore();
const parameterStore = useParameterStore();

const vertexCount = ref(0);
const faceCount = ref(0);
const estFileSizeLabel = ref('—');
const estPrintTimeLabel = ref('—');

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let transformControls: TransformControls;
let animationFrameId: number;
let currentMesh: THREE.Mesh | null = null;
let standardMaterial: THREE.MeshStandardMaterial;
let normalMaterial: THREE.MeshNormalMaterial;
const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
let meshZRange: { min: number; max: number } | null = null;
let syncingFromGizmo = false;

const buildMesh = (data: { positions: Float32Array, indices: Uint32Array } | null) => {
  if (!scene) return;

  if (currentMesh) {
    if (transformControls) transformControls.detach();
    scene.remove(currentMesh);
    currentMesh.geometry.dispose();
    currentMesh = null;
  }

  if (!data) {
    meshZRange = null;
    estFileSizeLabel.value = '—';
    estPrintTimeLabel.value = '—';
    return;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals(); // Compute normals for lighting

  currentMesh = new THREE.Mesh(geometry, standardMaterial);

  // Center mesh and fix orientation
  geometry.computeBoundingBox();
  if (geometry.boundingBox) {
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    // Apply center offset
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeBoundingBox();
    meshZRange = { min: geometry.boundingBox!.min.z, max: geometry.boundingBox!.max.z };
  }

  // Apply initial rotation and scale from parameter store
  currentMesh.rotation.set(
    parameterStore.rotationX * Math.PI / 180,
    parameterStore.rotationY * Math.PI / 180,
    parameterStore.rotationZ * Math.PI / 180
  );
  currentMesh.scale.set(parameterStore.scaleX, parameterStore.scaleY, parameterStore.scaleZ);

  scene.add(currentMesh);
  applyRenderMode();
  applyCrossSection();
  if (transformControls) {
    transformControls.attach(currentMesh);
  }

  // Update stats
  vertexCount.value = geometry.attributes.position.count;
  faceCount.value = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  estFileSizeLabel.value = formatBytes(estimateBinarySTLBytes(faceCount.value));
  const volumeMm3 = computeMeshVolumeMm3(data.positions, data.indices);
  estPrintTimeLabel.value = formatMinutes(estimatePrintTimeMinutes(volumeMm3));
};

const applyRenderMode = () => {
  if (!currentMesh) return;
  if (parameterStore.renderMode === 'normals') {
    currentMesh.material = normalMaterial;
  } else {
    standardMaterial.wireframe = parameterStore.renderMode === 'wireframe';
    currentMesh.material = standardMaterial;
  }
};

const applyCrossSection = () => {
  // clip plane normal is (0, 0, -1): keeps points where -z + constant >= 0, i.e. z <= constant
  if (!parameterStore.crossSectionEnabled || !meshZRange) {
    standardMaterial.clippingPlanes = [];
    normalMaterial.clippingPlanes = [];
    return;
  }
  const { min, max } = meshZRange;
  clipPlane.constant = min + (max - min) * parameterStore.crossSectionPosition;
  standardMaterial.clippingPlanes = [clipPlane];
  normalMaterial.clippingPlanes = [clipPlane];
};

const exportMesh = () => {
  if (currentMesh) {
    const exporter = new STLExporterService();
    exporter.export(currentMesh, 'timelaminator_output.stl');
  }
};

defineExpose({ exportMesh });

watch(() => projectStore.meshData, (newData) => {
  buildMesh(newData);
});

// Watch for rotation parameter changes (e.g. from the numeric sliders).
// Skipped while syncingFromGizmo to avoid feedback loops with the gizmo drag handler below.
watch(
  () => [parameterStore.rotationX, parameterStore.rotationY, parameterStore.rotationZ],
  ([rx, ry, rz]) => {
    if (currentMesh && !syncingFromGizmo) {
      currentMesh.rotation.set(
        rx * Math.PI / 180,
        ry * Math.PI / 180,
        rz * Math.PI / 180
      );
    }
  }
);

// Watch for scale parameter changes (e.g. from the numeric sliders).
watch(
  () => [parameterStore.scaleX, parameterStore.scaleY, parameterStore.scaleZ],
  ([sx, sy, sz]) => {
    if (currentMesh && !syncingFromGizmo) {
      currentMesh.scale.set(sx, sy, sz);
    }
  }
);

watch(() => parameterStore.renderMode, applyRenderMode);
watch(() => [parameterStore.crossSectionEnabled, parameterStore.crossSectionPosition], applyCrossSection);
watch(() => parameterStore.transformMode, (mode) => {
  if (transformControls) transformControls.setMode(mode);
});

const initThree = () => {
  if (!containerRef.value) return;

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1c1a);

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(100, 100, 100);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.localClippingEnabled = true;
  containerRef.value.appendChild(renderer.domElement);

  // Materials (shared across mesh rebuilds so render-mode toggling is instant)
  standardMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.5,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Blender-style transform gizmo for rotate/scale on the loaded mesh
  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setMode(parameterStore.transformMode);
  scene.add(transformControls.getHelper());

  // Disable orbiting while dragging a gizmo handle
  transformControls.addEventListener('dragging-changed', (event) => {
    controls.enabled = !event.value;
  });

  // Reflect gizmo drags back into the parameter store so the numeric
  // sliders in the side panel stay in sync.
  transformControls.addEventListener('objectChange', () => {
    if (!currentMesh) return;
    syncingFromGizmo = true;
    parameterStore.rotationX = currentMesh.rotation.x * 180 / Math.PI;
    parameterStore.rotationY = currentMesh.rotation.y * 180 / Math.PI;
    parameterStore.rotationZ = currentMesh.rotation.z * 180 / Math.PI;
    parameterStore.scaleX = currentMesh.scale.x;
    parameterStore.scaleY = currentMesh.scale.y;
    parameterStore.scaleZ = currentMesh.scale.z;
    syncingFromGizmo = false;
  });

  // Lights - Increased intensity
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(100, 200, 100);
  scene.add(dirLight);

  // Helper grid
  const gridHelper = new THREE.GridHelper(200, 50, 0x888888, 0x444444);
  scene.add(gridHelper);
  
  // Axes Helper
  const axesHelper = new THREE.AxesHelper(50);
  scene.add(axesHelper);

  // Resize handler
  window.addEventListener('resize', onWindowResize);

  animate();
};

const onWindowResize = () => {
  if (!containerRef.value || !camera || !renderer) return;
  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
};

const animate = () => {
  animationFrameId = requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
};

// Blender-style keyboard shortcuts: R = rotate, S = scale.
// Ignored while the user is typing into a text/number field elsewhere in the UI.
const onKeyDown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
  if (!currentMesh) return;

  if (event.key === 'r' || event.key === 'R') {
    parameterStore.transformMode = 'rotate';
  } else if (event.key === 's' || event.key === 'S') {
    parameterStore.transformMode = 'scale';
  }
};

onMounted(() => {
  initThree();
  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('keydown', onKeyDown);
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (currentMesh) currentMesh.geometry.dispose();
  if (standardMaterial) standardMaterial.dispose();
  if (normalMaterial) normalMaterial.dispose();
  if (transformControls) transformControls.dispose();
  if (renderer) renderer.dispose();
  if (controls) controls.dispose();
});
</script>

<style scoped>
.viewport-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.viewport-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.transform-toolbar {
  position: absolute;
  top: var(--space-md);
  left: var(--space-md);
  display: flex;
  gap: var(--space-xs);
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  padding: var(--space-xs);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.transform-btn {
  background: transparent;
  border: none;
  border-radius: var(--border-radius-md);
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-caption);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.transform-btn:hover {
  background: var(--color-background-tertiary);
  color: var(--color-text-primary);
}

.transform-btn.active {
  background: var(--color-background-info);
  color: var(--color-text-primary);
}

.stats-overlay {
  position: absolute;
  bottom: var(--space-md);
  left: var(--space-md);
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-secondary);
  border-radius: var(--border-radius-md);
  padding: var(--space-sm) var(--space-md);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  pointer-events: none; /* Let clicks pass through to canvas */
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.stat-label {
  font-size: var(--font-size-label);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-value {
  font-size: var(--font-size-body);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
</style>
