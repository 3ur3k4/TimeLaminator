export interface IVoxelVolume {
  data: Uint8Array;
  width: number;
  height: number;
  depth: number;
  pitchZ: number; // Layer pitch in mm
}

export interface IMeshGenerator {
  generate(volume: IVoxelVolume): Promise<{ positions: Float32Array, indices: Uint32Array }>;
}
