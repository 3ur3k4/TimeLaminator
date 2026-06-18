export interface ProjectFile {
  version: number;
  projectName: string;
  sourceFileName: string | null;
  targetPhysicalSize: number;
  parameters: Record<string, unknown>;
}

export class ProjectSerializer {
  static serialize(data: ProjectFile): string {
    return JSON.stringify(data, null, 2);
  }

  static parse(json: string): ProjectFile {
    return JSON.parse(json) as ProjectFile;
  }
}
