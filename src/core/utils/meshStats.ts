// Signed volume via the divergence theorem (sum of signed tetrahedron volumes from the origin).
export function computeMeshVolumeMm3(positions: Float32Array, indices: Uint32Array): number {
  let sixVolume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;

    const x1 = positions[ia], y1 = positions[ia + 1], z1 = positions[ia + 2];
    const x2 = positions[ib], y2 = positions[ib + 1], z2 = positions[ib + 2];
    const x3 = positions[ic], y3 = positions[ic + 1], z3 = positions[ic + 2];

    sixVolume +=
      x1 * (y2 * z3 - y3 * z2) -
      y1 * (x2 * z3 - x3 * z2) +
      z1 * (x2 * y3 - x3 * y2);
  }
  return Math.abs(sixVolume) / 6;
}

export function estimateBinarySTLBytes(faceCount: number): number {
  // 80-byte header + 4-byte triangle count + 50 bytes per triangle (12 floats + 2-byte attribute).
  return 84 + faceCount * 50;
}

// Rough heuristic, not a slicer-accurate estimate: assumes a typical FDM extrusion flow
// rate of ~10 mm^3/s for common 0.4 mm nozzle settings.
export function estimatePrintTimeMinutes(volumeMm3: number): number {
  const flowRateMm3PerSecond = 10;
  return volumeMm3 / flowRateMm3PerSecond / 60;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}
