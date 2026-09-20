import JSZip from 'jszip';
import type { ProjectFile } from '@/lib/types/database';

export async function exportProjectToZip(
  projectName: string,
  files: ProjectFile[]
): Promise<void> {
  const zip = new JSZip();

  const sourceFiles = files.filter((f) => !f.is_folder);

  for (const file of sourceFiles) {
    const cleanPath = file.path.replace(/^\/+/, '');
    zip.file(cleanPath, file.content);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const sanitizedName = (projectName || 'ai-studio-project')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
  const filename = `${sanitizedName}.zip`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
