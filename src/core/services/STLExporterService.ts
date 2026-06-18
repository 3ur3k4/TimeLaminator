import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import type { IExporter } from '../interfaces/IExporter';

export class STLExporterService implements IExporter {
  export(mesh: THREE.Mesh, filename: string = 'timelaminator.stl'): void {
    const exporter = new STLExporter();
    
    // We create a temporary scene to export only this mesh, with its transformations applied.
    const exportScene = new THREE.Scene();
    const meshClone = mesh.clone();
    
    // Ensure the matrix is updated so the exporter captures rotations/scales.
    meshClone.updateMatrixWorld(true);
    exportScene.add(meshClone);

    const stlString = exporter.parse(exportScene, { binary: true });
    
    // STLExporter parse with binary:true returns a DataView.
    // Need to convert to Blob.
    const dataView = stlString as DataView;
    const blob = new Blob([dataView.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
