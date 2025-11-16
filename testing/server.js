// Simple HTTP server for testing dashboard
const port = 5500;

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    let filepath = url.pathname;

    // Default to index.html
    if (filepath === '/' || filepath === '') {
      filepath = '/index.html';
    }

    // Build full path
    const fullPath = import.meta.dir + filepath;

    try {
      const file = Bun.file(fullPath);
      const exists = await file.exists();

      if (!exists) {
        return new Response('404 Not Found', { status: 404 });
      }

      return new Response(file);
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
});

console.log(`\n================================================`);
console.log(` INHOST Testing Dashboard - Servidor HTTP`);
console.log(`================================================\n`);
console.log(`[INFO] Servidor HTTP iniciado en puerto ${port}`);
console.log(`[INFO] Abre tu navegador en: http://localhost:${port}\n`);
console.log(`Presiona CTRL+C para detener\n`);
