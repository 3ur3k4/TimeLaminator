import type { IVoxelVolume } from '../interfaces/IMeshGenerator';

export class SpeckleRemover {
  /**
   * Labels 6-connected voxel clusters and discards any cluster smaller than minVoxelCount.
   */
  static remove(volume: IVoxelVolume, minVoxelCount: number): IVoxelVolume {
    const { data, width, height, depth } = volume;
    const sliceSize = width * height;
    const total = sliceSize * depth;

    const labels = new Int32Array(total).fill(-1);
    const componentSizes: number[] = [];
    const stack: number[] = [];

    for (let start = 0; start < total; start++) {
      if (data[start] === 0 || labels[start] !== -1) continue;

      const label = componentSizes.length;
      let size = 0;
      stack.push(start);
      labels[start] = label;

      while (stack.length > 0) {
        const idx = stack.pop() as number;
        size++;

        const z = Math.floor(idx / sliceSize);
        const rem = idx % sliceSize;
        const y = Math.floor(rem / width);
        const x = rem % width;

        if (x > 0) SpeckleRemover.tryVisit(idx - 1, data, labels, label, stack);
        if (x < width - 1) SpeckleRemover.tryVisit(idx + 1, data, labels, label, stack);
        if (y > 0) SpeckleRemover.tryVisit(idx - width, data, labels, label, stack);
        if (y < height - 1) SpeckleRemover.tryVisit(idx + width, data, labels, label, stack);
        if (z > 0) SpeckleRemover.tryVisit(idx - sliceSize, data, labels, label, stack);
        if (z < depth - 1) SpeckleRemover.tryVisit(idx + sliceSize, data, labels, label, stack);
      }

      componentSizes.push(size);
    }

    const output = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      const label = labels[i];
      if (label !== -1 && componentSizes[label] >= minVoxelCount) {
        output[i] = 1;
      }
    }

    return { data: output, width, height, depth, pitchZ: volume.pitchZ };
  }

  private static tryVisit(
    idx: number,
    data: Uint8Array,
    labels: Int32Array,
    label: number,
    stack: number[]
  ): void {
    if (data[idx] === 1 && labels[idx] === -1) {
      labels[idx] = label;
      stack.push(idx);
    }
  }
}
