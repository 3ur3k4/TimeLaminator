<script setup lang="ts">
import { ref } from 'vue'
import AppLayout from './components/layout/AppLayout.vue'
import ProjectSettingsPanel from './components/panels/ProjectSettingsPanel.vue'
import PropertyControlsPanel from './components/panels/PropertyControlsPanel.vue'
import ThreeViewport from './components/preview/ThreeViewport.vue'
import { useProjectStore } from './stores/useProjectStore'
import { useParameterStore } from './stores/useParameterStore'
import { ProjectSerializer } from './core/services/ProjectSerializer'

const projectStore = useProjectStore()
const parameterStore = useParameterStore()
const viewportRef = ref<InstanceType<typeof ThreeViewport> | null>(null)
const projectFileInput = ref<HTMLInputElement | null>(null)

const handleExport = () => {
  if (!projectStore.meshData) {
    alert("No mesh to export. Please process a video first.")
    return
  }

  if (viewportRef.value) {
    viewportRef.value.exportMesh()
  }
}

const handleSave = () => {
  const json = ProjectSerializer.serialize({
    version: 1,
    projectName: projectStore.projectName,
    sourceFileName: projectStore.sourceFile?.name ?? null,
    targetPhysicalSize: projectStore.targetPhysicalSize,
    parameters: parameterStore.serialize(),
  })

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectStore.projectName || 'project'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const handleOpen = () => {
  projectFileInput.value?.click()
}

const onProjectFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const data = ProjectSerializer.parse(text)
    projectStore.projectName = data.projectName ?? 'Untitled Project'
    projectStore.targetPhysicalSize = data.targetPhysicalSize ?? projectStore.targetPhysicalSize
    parameterStore.restore(data.parameters ?? {})
    if (data.sourceFileName) {
      alert(`Project loaded. Re-select the source file "${data.sourceFileName}" to regenerate the mesh.`)
    }
  } catch {
    alert('Failed to load project file: invalid or corrupted JSON.')
  }
}
</script>

<template>
  <AppLayout
    v-model:project-name="projectStore.projectName"
    @export="handleExport"
    @open="handleOpen"
    @save="handleSave"
  >
    <template #left>
      <ProjectSettingsPanel />
    </template>

    <template #center>
      <ThreeViewport ref="viewportRef" />
      <!-- Future: Timeline / Mesh statistics bar can go here below the viewport -->
    </template>

    <template #right>
      <PropertyControlsPanel />
    </template>
  </AppLayout>

  <input
    type="file"
    ref="projectFileInput"
    accept="application/json"
    style="display: none"
    @change="onProjectFileChange"
  />
</template>

<style scoped>
/* App specific global overrides or specific logic can go here */
</style>
