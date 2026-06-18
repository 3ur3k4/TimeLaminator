import type { IMeshOptimizer } from '../interfaces/IMeshOptimizer';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

export class MeshOptimizerService implements IMeshOptimizer {
  async optimize(
    positions: Float32Array,
    indices: Uint32Array,
    targetPolygonCount: number
  ): Promise<{ positions: Float32Array; indices: Uint32Array }> {
    await MeshoptSimplifier.ready;

    // target_index_count is target polygons * 3
    const targetIndexCount = targetPolygonCount * 3;
    const targetError = 0.01; // Adjust based on visual quality needs

    // Run simplify
    const [simplifiedIndices] = MeshoptSimplifier.simplify(
      indices,
      positions,
      3, // vertex_positions_stride (X, Y, Z = 3 floats)
      targetIndexCount,
      targetError
    );

    // We return the same positions array but with the new simplified indices.
    // Three.js and STLExporter will only iterate over the used indices.
    return {
      positions,
      indices: simplifiedIndices,
    };
  }
}
