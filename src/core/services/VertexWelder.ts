import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class VertexWelder {
  /**
   * Merges coincident/near-coincident vertices generated at voxel-cell boundaries by
   * Marching Cubes. Run automatically before decimation; no UI control needed.
   */
  static weld(
    positions: Float32Array,
    indices: Uint32Array,
    tolerance: number = 1e-4
  ): { positions: Float32Array; indices: Uint32Array } {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const merged = mergeVertices(geometry, tolerance);
    const mergedPositionAttr = merged.attributes.position as THREE.BufferAttribute;
    const mergedIndexAttr = merged.getIndex();

    const weldedPositions = new Float32Array(mergedPositionAttr.array as ArrayLike<number>);
    const weldedIndices = mergedIndexAttr
      ? new Uint32Array(mergedIndexAttr.array as ArrayLike<number>)
      : Uint32Array.from({ length: weldedPositions.length / 3 }, (_, i) => i);

    geometry.dispose();
    merged.dispose();

    return { positions: weldedPositions, indices: weldedIndices };
  }
}
