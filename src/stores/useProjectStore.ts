import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'
import { CanvasVideoProcessor } from '../core/services/CanvasVideoProcessor'
import { FFmpegVideoProcessor } from '../core/services/FFmpegVideoProcessor'
import { FrameProcessor } from '../core/services/FrameProcessor'
import { Voxelizer } from '../core/services/Voxelizer'
import { SpeckleRemover } from '../core/services/SpeckleRemover'
import { MarchingCubesGenerator } from '../core/services/MarchingCubesGenerator'
import { VertexWelder } from '../core/services/VertexWelder'
import { MeshOptimizerService } from '../core/services/MeshOptimizerService'
import { useParameterStore } from './useParameterStore'

// Debounce window for auto re-running the pipeline after a parameter change.
const REPROCESS_DEBOUNCE_MS = 400

export const useProjectStore = defineStore('project', () => {
  const projectName = ref('Untitled Project')
  const sourceFile = ref<File | null>(null)
  const isProcessing = ref(false)
  const progress = ref(0)
  const statusMessage = ref<string | null>(null)
  const targetPhysicalSize = ref(100) // target size in mm

  // Cached decoded frames, kept around so parameter tweaks can re-run the
  // pipeline from step 2 onward without re-decoding the source video.
  const rawFrames = shallowRef<ImageData[] | null>(null)

  // Non-deep reactive for heavy mesh data
  const meshData = shallowRef<{ positions: Float32Array, indices: Uint32Array } | null>(null)

  const reprocessMesh = async () => {
    if (!rawFrames.value || rawFrames.value.length === 0) return

    const parameterStore = useParameterStore()
    isProcessing.value = true
    progress.value = 0

    try {
      // 1. Frame range trim + frame step decimation
      progress.value = 0.1
      const trimmed = FrameProcessor.trim(rawFrames.value, parameterStore.frameRange)
      const sampledFrames = FrameProcessor.decimate(trimmed, parameterStore.frameStep)
      if (sampledFrames.length === 0) {
        throw new Error("No frames left after applying frame range / frame step")
      }
      const width = sampledFrames[0].width
      const height = sampledFrames[0].height

      // 2. Per-frame cleanup: pre-blur -> re-threshold -> noise removal (erosion/dilation)
      progress.value = 0.3
      const binaryFrames: Uint8Array[] = sampledFrames.map((frame) => {
        let gray = FrameProcessor.toGrayscale(frame)
        if (parameterStore.preBlur) {
          gray = FrameProcessor.blur(gray, width, height, parameterStore.blurRadius)
        }
        let binary = FrameProcessor.threshold(gray, parameterStore.threshold)
        if (parameterStore.removeNoise) {
          binary = FrameProcessor.removeNoise(binary, width, height)
        }
        return binary
      })

      // 3. Voxelize (time -> Z stacking)
      progress.value = 0.5
      let volume = Voxelizer.stack(
        binaryFrames,
        width,
        height,
        parameterStore.invertStack,
        parameterStore.layerPitch
      )

      // 4. Speckle removal (3D connected-component analysis)
      if (parameterStore.removeSpeckles) {
        volume = SpeckleRemover.remove(volume, parameterStore.speckleSize)
      }

      // 5. Generate Mesh
      progress.value = 0.7
      const generator = new MarchingCubesGenerator()
      let mesh = await generator.generate(volume)

      // 6. Vertex welding (automatic, before decimation)
      progress.value = 0.85
      mesh = VertexWelder.weld(mesh.positions, mesh.indices)

      // 7. Quadric decimation to target polygon count
      progress.value = 0.92
      if (mesh.indices.length / 3 > parameterStore.targetPolygonCount) {
        const optimizer = new MeshOptimizerService()
        mesh = await optimizer.optimize(mesh.positions, mesh.indices, parameterStore.targetPolygonCount)
      }

      // 8. Update state
      meshData.value = mesh
      progress.value = 1.0

    } catch (err) {
      console.error("Processing failed:", err)
      alert("Error processing video. Check console for details.")
    } finally {
      isProcessing.value = false
    }
  }

  const processVideo = async (file: File) => {
    isProcessing.value = true
    progress.value = 0
    statusMessage.value = null
    sourceFile.value = file

    const onDecodeProgress = (p: number) => {
      progress.value = p * 0.4 // decoding is 40% of total progress
    }

    try {
      const processor = new CanvasVideoProcessor()
      rawFrames.value = await processor.decode(file, parameterStore.maxResolution, onDecodeProgress)
    } catch (canvasErr) {
      // Native <video> decode failed (e.g. an unsupported codec such as
      // Apple ProRes). Fall back to a software decoder that works
      // regardless of browser codec support, at the cost of a one-time
      // wasm core download and slower, CPU-bound decoding.
      console.warn("Native decode failed, falling back to software decoder:", canvasErr)
      statusMessage.value = 'Browser playback failed - using software decoder (first use downloads ~30MB)...'
      progress.value = 0
      try {
        const fallback = new FFmpegVideoProcessor()
        rawFrames.value = await fallback.decode(file, parameterStore.maxResolution, onDecodeProgress)
      } catch (fallbackErr) {
        console.error("Fallback decoding failed:", fallbackErr)
        const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
        alert("Error decoding video: " + message)
        isProcessing.value = false
        statusMessage.value = null
        return
      }
    }

    statusMessage.value = null
    await reprocessMesh()
  }

  // Auto re-run the pipeline (debounced) whenever a parameter that affects
  // mesh generation changes, reusing the cached decoded frames. Purely
  // cosmetic params (rotation, render mode, cross-section) are handled live
  // in ThreeViewport and intentionally excluded here.
  const parameterStore = useParameterStore()
  let reprocessTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => [
      parameterStore.frameRange[0],
      parameterStore.frameRange[1],
      parameterStore.frameStep,
      parameterStore.preBlur,
      parameterStore.blurRadius,
      parameterStore.threshold,
      parameterStore.removeNoise,
      parameterStore.removeSpeckles,
      parameterStore.speckleSize,
      parameterStore.invertStack,
      parameterStore.layerPitch,
      parameterStore.targetPolygonCount,
    ],
    () => {
      if (!rawFrames.value) return
      if (reprocessTimer) clearTimeout(reprocessTimer)
      reprocessTimer = setTimeout(reprocessMesh, REPROCESS_DEBOUNCE_MS)
    }
  )

  // maxResolution changes the decoded frame size itself, so the source video
  // must be re-decoded (not just the downstream mesh pipeline re-run).
  let redecodeTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => parameterStore.maxResolution,
    () => {
      if (!sourceFile.value) return
      if (redecodeTimer) clearTimeout(redecodeTimer)
      redecodeTimer = setTimeout(() => processVideo(sourceFile.value!), REPROCESS_DEBOUNCE_MS)
    }
  )

  return { projectName, sourceFile, isProcessing, progress, statusMessage, targetPhysicalSize, meshData, processVideo }
})
