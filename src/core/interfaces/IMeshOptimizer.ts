export interface IMeshOptimizer {
  optimize(
    positions: Float32Array,
    indices: Uint32Array,
    targetPolygonCount: number
  ): Promise<{ positions: Float32Array, indices: Uint32Array }>;
}
