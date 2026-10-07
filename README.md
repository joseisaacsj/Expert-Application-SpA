# Expert Applicator SpA — Demo

Plataforma de control de obras y remodelaciones industriales. **Frontend de demostración funcional**: el backend está simulado en el navegador para mostrar el alcance completo antes de construir el producto real (PHP + MySQL).

## Instalación y uso

```bash
npm install
npm run dev     # desarrollo
npm run test    # 37 pruebas: cálculos + permisos
npm run lint    # ESLint
npm run build   # producción (activa el service worker / PWA)
```

## Usuarios de demo

Contraseña para todos: `demo1234`

| Usuario | Rol | Ve costos |
|---|---|---|
| `admin` | Administrador (todas las obras) | Sí |
| `supervisora` | Supervisora (4 obras) | Sí |
| `jefecuadrilla` | Jefe de cuadrilla (Lampa, Quilicura) | No |
| `trabajador` | Trabajador (Lampa) | No |
| `maestro` | Jefe de cuadrilla (Lampa, Maipú) | No |
| `rrhh` | RRHH (todas, sueldos bloqueados) | No |

## Decisiones de arquitectura

- **`src/server/`** simula el futuro backend PHP: valida permisos **del lado "servidor"** (los datos sensibles ni siquiera llegan a la interfaz). Cuando exista el backend real, solo se reescribe `src/lib/api.js` para usar `fetch()` contra `API_BASE_URL` (`src/config/api.js`) sin tocar las páginas.
- **Indicadores calculados, nunca guardados** (`src/lib/calculos.js`, funciones puras testeadas): avance por partida, avance global ponderado por presupuesto, SPI, CPI, documentación del día y semáforos con umbrales editables por obra.
- **Reportes idempotentes**: cada reporte lleva un `clientId` (UUID) generado en el cliente; el servidor lo deduplica, así que reenviar tras un corte de conexión es seguro.
- **Modo offline**: reportes pendientes en IndexedDB (`src/lib/offline.js`); se sincronizan al abrir la app y al evento `online` (sin depender de Background Sync, que en iPhone no funciona igual). Las fotos se comprimen a 1280px JPEG antes de guardarse.
- **Roles por obra** (membresías): la misma persona puede tener roles distintos en distintas obras. Sueldos solo con permiso explícito `ver_sueldos`.
- **PWA**: manifest + service worker propio (sin workbox), registrado solo en producción para no interferir con HMR en desarrollo.

## Flujo del demo

1. Entra como `jefecuadrilla` → Reporte diario → envía un reporte en Lampa.
2. Entra como `supervisora` → el avance del tablero y del detalle ya refleja el reporte.
3. En DevTools → Network → "Offline" → envía otro reporte: queda "Guardado en el teléfono"; al volver "Online" se sincroniza solo, sin duplicarse.
4. Como `trabajador`, el detalle de obra muestra "Restringido por tu rol" en costos, y la API simulada tampoco entrega los montos.
5. Como `admin`, en Administración puedes cambiar roles por obra y restablecer los datos demo.

## Pendiente para el producto real

Backend PHP (endpoints en `src/server/endpoints.js` ya definen el contrato), MySQL, Auth.js, despliegue, materiales/compras, estados de pago, curva S, PDF, multiempresa (el modelo ya incluye `organizacion`).
