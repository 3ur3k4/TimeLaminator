import type { IVoxelVolume } from '../interfaces/IMeshGenerator';

export class Voxelizer {
  /**
   * Stacks a sequence of already-binarized 2D frames into a single 3D voxel volume,
   * mapping time directly to Z. Binarization, blur, and per-frame cleanup happen upstream
   * (see FrameProcessor) so this step is purely the time -> Z projection.
   */
  static stack(
    binaryFrames: Uint8Array[],
    width: number,
    height: number,
    invertStack: boolean,
    pitchZ: number
  ): IVoxelVolume {
    const depth = binaryFrames.length;
    if (depth === 0) {
      throw new Error("No frames provided for voxelization");
    }

    const sliceSize = width * height;
    const data = new Uint8Array(sliceSize * depth);

    for (let z = 0; z < depth; z++) {
      // If invertStack is true, we reverse the time mapping
      const sourceZ = invertStack ? (depth - 1 - z) : z;
      data.set(binaryFrames[sourceZ], z * sliceSize);
    }

    return {
      data,
      width,
      height,
      depth,
      pitchZ
    };
  }
}
