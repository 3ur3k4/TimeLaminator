import type { IMeshGenerator, IVoxelVolume } from '../interfaces/IMeshGenerator';
// @ts-ignore
import isosurface from 'isosurface';

export class MarchingCubesGenerator implements IMeshGenerator {
  async generate(volume: IVoxelVolume): Promise<{ positions: Float32Array, indices: Uint32Array }> {
    const { data, width, height, depth, pitchZ } = volume;

    // Use marching cubes to extract the isosurface.
    // The scalar field threshold is around 0.5 since we have binary data 0 and 1.
    const threshold = 0.5;

    const mesh = isosurface.marchingCubes(
      [width, height, depth],
      (x: number, y: number, z: number) => {
        // Clamp bounds just in case
        const cx = Math.max(0, Math.min(width - 1, Math.floor(x)));
        const cy = Math.max(0, Math.min(height - 1, Math.floor(y)));
        const cz = Math.max(0, Math.min(depth - 1, Math.floor(z)));
        
        // Invert so that 1 => solid (inside), 0 => empty (outside)
        // isosurface expects potential < 0 inside, > 0 outside usually,
        // but if we do 0.5 - val:
        // val = 1 (solid) => -0.5
        // val = 0 (empty) =>  0.5
        return threshold - data[cz * width * height + cy * width + cx];
      }
    );

    // Apply pitchZ to Z coordinate
    const positions = new Float32Array(mesh.positions.length * 3);
    for (let i = 0; i < mesh.positions.length; i++) {
      positions[i * 3 + 0] = mesh.positions[i][0];
      positions[i * 3 + 1] = mesh.positions[i][1];
      positions[i * 3 + 2] = mesh.positions[i][2] * pitchZ;
    }

    const indices = new Uint32Array(mesh.cells.length * 3);
    for (let i = 0; i < mesh.cells.length; i++) {
      indices[i * 3 + 0] = mesh.cells[i][0];
      indices[i * 3 + 1] = mesh.cells[i][1];
      indices[i * 3 + 2] = mesh.cells[i][2];
    }

    return { positions, indices };
  }
}
