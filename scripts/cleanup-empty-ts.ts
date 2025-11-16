import { readdir, stat, rm, writeFile } from "fs/promises";
import { join } from "path";

const TARGET_DIRS = [
  "apps/api-gateway/src",
  "packages/shared/src",
];

const LOG_FILE = "cleanup-log.txt";

// Consideramos "vacío" si tiene 0–3 bytes (archivos que quedaron con \n o un espacio)
const MAX_SIZE = 3;

async function cleanupEmptyTSFiles() {
  const deletedFiles: string[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.name.endsWith(".ts")) continue;

      const fileStats = await stat(fullPath);

      if (fileStats.size <= MAX_SIZE) {
        deletedFiles.push(fullPath);
        await rm(fullPath);
      }
    }
  }

  for (const dir of TARGET_DIRS) {
    try {
      await walk(dir);
    } catch (err) {
      console.error("Error procesando carpeta:", dir, err);
    }
  }

  const logContent =
    `=== CLEANUP EMPTY TS FILES ===\n\n` +
    `Fecha: ${new Date().toISOString()}\n\n` +
    (deletedFiles.length
      ? `Archivos eliminados (${deletedFiles.length}):\n` +
        deletedFiles.map((f) => ` - ${f}`).join("\n")
      : "No se encontraron archivos vacíos.");

  await writeFile(LOG_FILE, logContent);

  console.log(logContent);
}

cleanupEmptyTSFiles();
