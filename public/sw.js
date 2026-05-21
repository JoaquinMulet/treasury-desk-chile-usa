/**
 * Service Worker de limpieza · auto-desinstala cualquier SW previo registrado en este origin.
 * Necesario porque el navegador del usuario tiene un SW viejo cacheado de otro proyecto
 * que intercepta requests con "Failed to convert value to 'Response'".
 *
 * Este archivo reemplaza al SW antiguo, limpia caches y se desregistra a sí mismo,
 * permitiendo que las requests vuelvan a pasar directo al servidor.
 */
self.addEventListener("install", () => {
  // Activar inmediatamente sin esperar
  self.skipWaiting();
});

self.addEventListener("activate", async (event) => {
  event.waitUntil(
    (async () => {
      // 1. Borrar todas las caches del SW antiguo
      try {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      } catch {}

      // 2. Desregistrar este SW
      try {
        await self.registration.unregister();
      } catch {}

      // 3. Forzar reload de todas las pestañas abiertas para que carguen sin SW
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((client) => {
          if ("navigate" in client) client.navigate(client.url);
        });
      } catch {}
    })(),
  );
});

// No interceptar ningún fetch — dejar pasar todo al servidor
self.addEventListener("fetch", () => {
  // Sin handler: el navegador hace el request normalmente
});
