import { defineStore } from 'pinia'
import { ref } from 'vue'

export type RenderMode = 'shaded' | 'wireframe' | 'normals'

export const useParameterStore = defineStore('parameter', () => {
  // Source
  const maxResolution = ref(512) // px, longer edge; source video is downscaled if it exceeds this

  // Layer & Timing
  const layerPitch = ref(0.2) // mm
  const invertStack = ref(false)
  const frameRange = ref<[number, number]>([0, 100])
  const frameStep = ref(1)

  // Cleanup
  const threshold = ref(128)
  const preBlur = ref(false)
  const blurRadius = ref(1) // px
  const removeNoise = ref(false)
  const removeSpeckles = ref(false)
  const speckleSize = ref(5) // min voxel cluster size to keep

  // Optimization
  const algorithm = ref<'marching_cubes' | 'surface_nets'>('marching_cubes')
  const targetPolygonCount = ref(100000)

  // Orientation
  const rotationX = ref(-90) // Default to -90 to stand upright
  const rotationY = ref(0)
  const rotationZ = ref(0)

  // Scale (applied on top of the voxel-derived mesh size)
  const scaleX = ref(1)
  const scaleY = ref(1)
  const scaleZ = ref(1)

  // Preview
  const renderMode = ref<RenderMode>('shaded')
  const crossSectionEnabled = ref(false)
  const crossSectionPosition = ref(1) // normalized 0-1 along Z extent
  const transformMode = ref<'rotate' | 'scale'>('rotate')

  const serialize = () => ({
    maxResolution: maxResolution.value,
    layerPitch: layerPitch.value,
    invertStack: invertStack.value,
    frameRange: [...frameRange.value] as [number, number],
    frameStep: frameStep.value,
    threshold: threshold.value,
    preBlur: preBlur.value,
    blurRadius: blurRadius.value,
    removeNoise: removeNoise.value,
    removeSpeckles: removeSpeckles.value,
    speckleSize: speckleSize.value,
    algorithm: algorithm.value,
    targetPolygonCount: targetPolygonCount.value,
    rotationX: rotationX.value,
    rotationY: rotationY.value,
    rotationZ: rotationZ.value,
    scaleX: scaleX.value,
    scaleY: scaleY.value,
    scaleZ: scaleZ.value,
    renderMode: renderMode.value,
    crossSectionEnabled: crossSectionEnabled.value,
    crossSectionPosition: crossSectionPosition.value,
  })

  const restore = (data: Partial<ReturnType<typeof serialize>>) => {
    if (data.maxResolution !== undefined) maxResolution.value = data.maxResolution
    if (data.layerPitch !== undefined) layerPitch.value = data.layerPitch
    if (data.invertStack !== undefined) invertStack.value = data.invertStack
    if (data.frameRange !== undefined) frameRange.value = [...data.frameRange]
    if (data.frameStep !== undefined) frameStep.value = data.frameStep
    if (data.threshold !== undefined) threshold.value = data.threshold
    if (data.preBlur !== undefined) preBlur.value = data.preBlur
    if (data.blurRadius !== undefined) blurRadius.value = data.blurRadius
    if (data.removeNoise !== undefined) removeNoise.value = data.removeNoise
    if (data.removeSpeckles !== undefined) removeSpeckles.value = data.removeSpeckles
    if (data.speckleSize !== undefined) speckleSize.value = data.speckleSize
    if (data.algorithm !== undefined) algorithm.value = data.algorithm
    if (data.targetPolygonCount !== undefined) targetPolygonCount.value = data.targetPolygonCount
    if (data.rotationX !== undefined) rotationX.value = data.rotationX
    if (data.rotationY !== undefined) rotationY.value = data.rotationY
    if (data.rotationZ !== undefined) rotationZ.value = data.rotationZ
    if (data.scaleX !== undefined) scaleX.value = data.scaleX
    if (data.scaleY !== undefined) scaleY.value = data.scaleY
    if (data.scaleZ !== undefined) scaleZ.value = data.scaleZ
    if (data.renderMode !== undefined) renderMode.value = data.renderMode
    if (data.crossSectionEnabled !== undefined) crossSectionEnabled.value = data.crossSectionEnabled
    if (data.crossSectionPosition !== undefined) crossSectionPosition.value = data.crossSectionPosition
  }

  return {
    maxResolution,
    layerPitch, invertStack, frameRange, frameStep,
    threshold, preBlur, blurRadius, removeNoise, removeSpeckles, speckleSize,
    algorithm, targetPolygonCount,
    rotationX, rotationY, rotationZ,
    scaleX, scaleY, scaleZ,
    renderMode, crossSectionEnabled, crossSectionPosition, transformMode,
    serialize, restore,
  }
})
