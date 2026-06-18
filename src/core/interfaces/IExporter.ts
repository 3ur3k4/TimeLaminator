import * as THREE from 'three';

export interface IExporter {
  export(mesh: THREE.Mesh, filename: string): void;
}
