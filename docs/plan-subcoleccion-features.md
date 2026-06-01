# Plan de migración (detallado) — Features a subcolección

> **Estado:** propuesta / pendiente de aprobación.
> **Criticidad:** ALTA — la app está en producción con datos reales. Toda fase es reversible vía feature flag + `schemaVersion` + respaldo `_legacyFeatures`.
> **Regla de oro:** ningún paso destruye el blob legacy hasta que la Fase 6 cierre la ventana de estabilidad.

## Índice
1. Contexto y flujos actuales
2. Modelo de datos objetivo
3. PR-1: Identidad (`featureId`) y diff diferencial
4. PR-2..PR-5: prerrequisitos restantes
5. Fases 0–6 (tareas, pseudocódigo, aceptación, rollback)
6. API `lib/firebase.ts` (firmas)
7. Reglas de seguridad
8. Índices
9. Concurrencia / merge realtime
10. Límites de plan
11. Feature flag + version check
12. Backfill (script detallado)
13. Backup / restore (comandos)
14. Runbook de despliegue (gates + rollback)
15. Monitoreo y alertas
16. Costos estimados
17. Matriz de testing
18. Catálogo de edge cases
19. Matriz de cobertura
20. Decisiones abiertas
21. Inventario de consumidores

---

## 1. Contexto y flujos actuales

Hoy las features viven como **un string JSON por capa**, dentro de `layers[]`, dentro de `projects/{id}`. El autoguardado ([app/[projectId]/page.tsx:191-204](../app/[projectId]/page.tsx)) hace, 2s después de cualquier cambio:
```
saveProjectLayers(projectId, layers)  →  updateDoc({ layers: serializedLayers, updatedAt })
```
Es **sobrescritura total del documento** (last-write-wins global).

### Flujos actuales (para no romper ninguno)
| Acción | Disparador | Termina en |
|---|---|---|
| Dibujar | `_onCreated` (EditControl) | toGeoJSON → reemplaza capa → autosave blob |
| Editar geometría | `handleStopEdit` / `_onEdited` | toGeoJSON → reemplaza capa → autosave blob |
| Borrar | `handleDelete` / `_onDeleted` | toGeoJSON → reemplaza capa → autosave blob |
| Union/Subtract/Buffer | menú contextual | `onUpdateLayer(filtered+push)` → autosave blob |
| Paste WKT / Add / Duplicate | Sidebar | `setLayers(...)` → autosave blob |
| Color / Rename feature | Sidebar `updateFeatureColor` | `setLayers(...)` → autosave blob |
| Editar celda / Add columna | AttributeTable | `onUpdateLayer(map all)` → autosave blob |
| Add / Delete capa | Sidebar | `setLayers(...)` → autosave blob |
| Comentarios | FeatureComments | `addComment({featureIndex})` (subcolección comments) |
| Snapshot / Restore | VersionHistoryPanel | `createSnapshot(layers)` / `onRestore(layers)` |
| Fork | `forkProject` | copia blob de layers |
| API POST/GET/DELETE | rutas v1 | read-modify-write del blob |
| Embed / Explore / Dashboard | SSR/CSR | `getProject` / `getUserProjects` (parsean blob) |

### Problemas
- **Pérdida de datos:** feature agregada por API se pierde al siguiente autosave del navegador (snapshot en memoria sin ella).
- **Límite 1 MiB/documento.**
- **Latencia creciente** (editar 1 feature reescribe el proyecto).
- **Identidad por índice de array** (selección, `featureIndex` de comentarios, union/subtract).

---

## 2. Modelo de datos objetivo

```jsonc
// projects/{projectId}
{
  "name": "...", "ownerId": "...", "ownerName": "...", "ownerEmail": "...",
  "isPublic": false, "collaborators": [], "roles": {},
  "layers": [ { "id": "layer_x", "name": "Capa 1", "visible": true,
               "style": {...}, "order": 0 } ],   // SIN features
  "bbox": [minLng, minLat, maxLng, maxLat],       // null si vacío — thumbnail (PR-3)
  "featureCount": 12,                             // total — thumbnail/orden
  "layerFeatureCounts": { "layer_x": 12 },        // límites de plan (#11)
  "schemaVersion": 2,                             // 1 = blob legacy, 2 = subcolección
  "appMinVersion": "2026.06.01",                  // version check (PR-5)
  "createdAt": ..., "updatedAt": ...,
  "_legacyFeatures": [ ... ]                       // respaldo TEMPORAL post-backfill (se borra en F6)
}

// projects/{projectId}/features/{featureId}
{
  "layerId": "layer_x",
  "geometry": { "type": "Polygon", "coordinates": [...] },
  "properties": { "name": "...", "color": "#3388ff", "note": "...", "...": "custom" },
  "order": 1024,                 // numérico con huecos (ver §3.5)
  "createdAt": ..., "updatedAt": ...,
  "createdBy": "uid|api|fork|import"
}
```

### Semántica e invariantes
- `featureId` = id de Firestore generado en **cliente**; espejado en `Feature.id` del GeoJSON en memoria.
- **Invariante:** `featureCount == Σ layerFeatureCounts == count(features)`. Se reconcilia en backfill y se valida en QA.
- **Validación de escritura:** `JSON.stringify(featureDoc).length < 1_000_000` (margen bajo 1 MiB). Rechazar o trocear MultiPolygon gigante.
- Geometría siempre presente; `properties` por defecto `{}`.

---

## 3. PR-1 — Identidad (`featureId`) y diff diferencial (Fase 0)

### 3.1 Por qué funciona en el modelo actual
Leaflet preserva `feature.id` al serializar: `getFeature = Util.extend({}, layer.feature, {geometry})` copia todos los miembros (incluido `id` y `properties`) y solo reemplaza geometría. → la identidad puede vivir dentro del GeoJSON y sobrevivir a la edición sin tocar Firestore.

### 3.2 Generación de id (= futuro doc id)
```ts
import { doc, collection } from 'firebase/firestore';
// id offline, sin escribir; será el doc id en la subcolección
export const newFeatureId = (projectId: string) =>
  doc(collection(db, 'projects', projectId, 'features')).id;
```

### 3.3 `ensureIds` — puntos de entrada (idempotente)
```ts
function ensureIds(projectId: string, fc: FeatureCollection): FeatureCollection {
  for (const f of fc.features) if (!f.id) f.id = newFeatureId(projectId);
  return fc;
}
```
| Punto de entrada | Archivo | Nota |
|---|---|---|
| Carga de proyecto | `parseLayers` / `getProject` ([firebase.ts:228](../lib/firebase.ts)) | backfill en memoria de datos legacy |
| Dibujo | `_onCreated` ([ActiveLayerEditor.tsx:299](../components/map/ActiveLayerEditor.tsx)) | feature nueva sin `layer.feature` |
| Import CSV | Sidebar/page import | cada fila |
| Paste WKT | Sidebar ([:255](../components/Sidebar.tsx)) | |
| Union/Subtract/Buffer | ActiveLayerEditor | resultado = id nuevo |
| **Duplicar** | Sidebar duplicate | **id NUEVO obligatorio** (no copiar el id) |

### 3.4 Changeset y diff por id
```ts
type Changeset = {
  creates: Feature[];                 // con id ya asignado
  updates: { id: string; geometry?; properties?; layerId? }[];
  deletes: string[];                  // ids
  layerMeta?: Layer[];                // si cambió metadata de capas
};

function diffFeatures(prevById: Map<string,Feature>, next: Feature[]): Changeset {
  const cs: Changeset = { creates: [], updates: [], deletes: [] };
  const nextIds = new Set<string>();
  for (const f of next) {
    nextIds.add(f.id);
    const prev = prevById.get(f.id);
    if (!prev) cs.creates.push(f);
    else if (geomChanged(prev, f) || propsChanged(prev, f)) cs.updates.push({ id: f.id, geometry: f.geometry, properties: f.properties, layerId: f.__layerId });
  }
  for (const id of prevById.keys()) if (!nextIds.has(id)) cs.deletes.push(id);
  return cs;
}
```
- Comparación de geometría/props: `JSON.stringify` cacheado o hash por feature para no recomputar todo.
- En Fase 0 el changeset **se calcula** pero se persiste como blob; en Fase 3 se traduce a ops Firestore.

### 3.5 Estrategia de `order`
- App es **append-only** para features (no hay UI de reordenar features, solo capas). → `order` numérico: al insertar, `order = (max order en la capa) + 1024`.
- Tie-break de lectura: `order ASC, createdAt ASC, id ASC`.
- Reordenamiento futuro: migrar a *fractional indexing* (claves string entre dos vecinas) sin rebalanceo. Documentado, no implementado ahora.

### 3.6 Undo/Redo (integración)
- `useUndoableState` sigue guardando `Layer[]` en memoria, pero **cada feature lleva `id` estable** → al deshacer, el array restaurado conserva los mismos ids.
- El diff entre "último persistido" y "estado actual" produce el changeset correcto:
  - undo-delete → `create` con el **mismo** id (sin duplicado).
  - undo-create → `delete` de ese id (sin huérfano).
  - undo-edit → `update`.
- **Requisito:** mantener `lastPersistedById` (snapshot del estado ya escrito) para diferenciar; se actualiza tras cada guardado exitoso.

### 3.7 Mapeo operación → changeset (referencia para Fase 3)
| Operación | creates | updates | deletes |
|---|---|---|---|
| Dibujar | [nueva] | — | — |
| Editar geometría | — | [id] | — |
| Borrar | — | — | [id] |
| Union | [union] | — | [a, b] |
| Subtract | — | [a] (geom nueva) | — / [b]* |
| Buffer | [buffer] | — | — |
| Paste WKT (n) | [n nuevas] | — | — |
| Import CSV (n) | [n nuevas] (batch) | — | — |
| Duplicar | [copia id nuevo] | — | — |
| Color / Rename | — | [id] (props) | — |
| Editar celda | — | [id] (props) | — |
| Add columna (bulk) | — | [todas] (props) | — |
| Delete capa | — | — | [todas las de la capa] |
*según semántica actual de subtract; confirmar en Fase 0.

---

## 4. PR-2..PR-5

### PR-2 — Borrado en cascada / huérfanos
Firestore **no** borra subcolecciones al borrar el padre.
- `deleteLayerCascade(projectId, layerId)`: query features `where layerId == layerId` → borrar en batches ≤500; actualizar `layerFeatureCounts`/`featureCount`/`bbox`.
- `deleteProjectCascade(projectId)`: borrar todas las features (batches) y luego el doc. **Decisión abierta #4**: cliente/Admin batches vs Cloud Function `recursiveDelete`.
- Riesgo si se omite: features huérfanas facturando storage y reapareciendo si se reusa un id.

### PR-3 — Fuente del thumbnail
Dashboard ya no carga features. → mantener `bbox` y `featureCount` en el doc, actualizados en el write path. El thumbnail de Mapbox se calcula desde `bbox` (no desde las geometrías). Migrar [app/page.tsx:32-46](../app/page.tsx) `getProjectThumbnailUrl` para usar `project.bbox`.

### PR-4 — `updatedAt` granular
Cada `createFeature/updateFeature/deleteFeature` y cada cambio de metadata de capa bumpea `project.updatedAt` (orden de dashboard, `getSharedProjects`/`getPublicProjects` con `orderBy updatedAt`). Para evitar contención: bump como parte del mismo batch/transacción del cambio (no un write extra suelto), con debounce.

### PR-5 — Cliente obsoleto / `schemaVersion`
- Cada build expone `APP_VERSION`. El proyecto guarda `appMinVersion`. Al cargar, si `APP_VERSION < appMinVersion` → forzar recarga (banner "nueva versión, recargá") y **bloquear escrituras**.
- El path legacy (escribir blob) se **desactiva** cuando `schemaVersion==2`; un cliente viejo que intente escribir blob es rechazado por version check (no por rules, que no distinguen).
- Enlaza con el incidente de `Cache-Control: immutable` ya corregido.

---

## 5. Fases

> Cada fase: **Objetivo → Tareas → Aceptación → Rollback → Checklist**.

### Fase 0 — Identidad y diff (modelo blob actual) · PR-1
**Objetivo:** identidad estable y diff-por-id sin cambiar el modelo de datos. Entregable aislado, desplegable solo.

**Tareas**
1. `newFeatureId`, `ensureIds` en `lib/map-utils.ts` (o `lib/firebase.ts`).
2. Llamar `ensureIds` en todos los puntos de entrada (§3.3).
3. `_onCreated`: asignar id a la feature dibujada antes de actualizar estado.
4. Duplicar: forzar id nuevo.
5. Mantener `lastPersistedById` y `diffFeatures` en el autosave (sigue escribiendo blob, pero a través del diff; valida que el blob resultante == estado).
6. Modelar union/subtract/buffer/import como changesets reversibles (que el undo restaure ids exactos).

**Aceptación (casos)**
- Dibujar A, B; editar A; borrar B; **undo×2, redo×2** → sin duplicados ni features fantasma; ids estables.
- Duplicar A → A' con id distinto.
- Recargar proyecto legacy → todas las features adquieren id en memoria; al guardar, el blob los incluye.

**Rollback:** revertir commits; el blob sigue siendo el formato (los ids extra son inertes).

**Checklist:** ☐ tests unit diff ☐ tests undo/redo ☐ smoke en staging ☐ verificar blob serializa ids.

---

### Fase 1 — Infraestructura (definir, sin activar) · PR-2/3/4/5
**Objetivo:** dejar tipos, rules, índices y funciones listos, sin cambiar runtime.

**Tareas**
1. Tipos en [lib/firebase.ts](../lib/firebase.ts): `Layer` sin `features` obligatorio (transición), `FeatureDoc`, `Project` con `bbox`/`featureCount`/`layerFeatureCounts`/`schemaVersion`/`appMinVersion`.
2. Funciones nuevas (firmas en §6), **sin cablear**.
3. Rules de `features` (§7) — desplegar a un proyecto Firestore de **staging** primero.
4. Índices (§8) — desplegar y **esperar build**.
5. `order` (§3.5), validación <1 MiB, helpers de bbox/counts.
6. Decisión límites de plan (§10).

**Aceptación:** `firebase deploy --only firestore:rules,firestore:indexes` verde en staging; índices `READY`; funciones con tests unit (mock Firestore).

**Rollback:** no afecta runtime (nada cableado); revertir rules/índices si hace falta.

**Checklist:** ☐ índices READY ☐ rules emulador OK ☐ funciones testeadas ☐ flag creado en OFF.

---

### Fase 2 — Lectura dual (detrás del flag)
**Objetivo:** leer el modelo nuevo cuando `schemaVersion==2`, legacy si no.

**Tareas**
1. `getProjectWithFeatures(projectId)`: lee doc; si `v2` → `getDocs(features)` y reconstruye `layers[].features` agrupando por `layerId`, ordenando por `order`; si `v1` → `parseLayers` legacy.
2. `subscribeToProjectFeatures` (un solo `onSnapshot`, ver §9) — **el primer snapshot ES la carga** (evita doble read).
3. Adaptar lectores: editor load, [EmbedViewer/SSR](../app/embed/[projectId]), [explore](../app/explore/page.tsx), [templates](../app/templates/page.tsx), [editor](../app/editor/page.tsx), [export-utils](../lib/export-utils.ts).
4. **Dashboard** ([app/page.tsx](../app/page.tsx)): thumbnail desde `bbox`; NO leer features.
5. SSR del embed: leer subcolección con Admin SDK (no client).

**Aceptación:** abrir proyectos v2 (creados a mano en staging) y v1; ambos renderizan idéntico; dashboard no hace reads de features (verificar en consola Firebase).

**Rollback:** flag OFF → solo lectura legacy.

**Checklist:** ☐ v1 y v2 leen ☐ embed SSR OK ☐ dashboard sin reads de features ☐ listener se cierra al salir.

---

### Fase 3 — Escritura granular (detrás del flag)
**Objetivo:** persistir changesets a la subcolección.

**Tareas**
1. Cablear `diffFeatures` → `bulkWriteChangeset` (create/update/delete) en vez del blob.
2. Mantener en el mismo batch: `updatedAt` (PR-4), `layerFeatureCounts`/`featureCount` (#11), `bbox` (#18).
3. **Debounce por feature** en drag (#9); coalescer múltiples updates del mismo id.
4. **Ops masivas** (add columna, color/rename múltiple) → batch ≤500 + debounce (#6).
5. Cascadas (delete capa/proyecto) (#2).
6. **Errores + estado de guardado** (#17): cola de reintentos con backoff; estados `idle|saving|saved|error`; reemplazar `isSaving` global; banner de error con reintento manual.
7. `onSnapshot` reconciliación con `hasPendingWrites` (§9).

**Aceptación (críticos):**
- Editar 1 feature → **1** write de doc (verificar en consola).
- **Concurrencia (el bug):** con editor abierto, `POST /features` por API → la feature aparece vía listener y **persiste** tras el siguiente autosave local.
- Borrar capa → 0 features huérfanas (query `where layerId==` vacía).
- Fallo de red simulado → estado `error`, reintento, sin corromper estado.

**Rollback:** flag OFF → vuelve a escritura blob (proyectos no migrados); proyectos ya `v2` requieren flag ON (de ahí la ventana de dual-write en F5).

**Checklist:** ☐ 1 edit = 1 write ☐ test concurrencia API ☐ counts/bbox correctos ☐ cascada sin huérfanos ☐ retry/estado UI.

---

### Fase 4 — API REST (compatibilidad)
**Tareas** — [features/route.ts](../app/api/v1/projects/[projectId]/features/route.ts), [layers/route.ts](../app/api/v1/projects/[projectId]/layers/route.ts)
1. `POST /features` → `bulkWriteChangeset` (Admin) en subcolección + actualizar counts/bbox/updatedAt. **Cierra el bug a nivel API.**
2. `GET /features` → query a subcolección con filtros `layer`/`name`/`bbox`/paginación nativos (mantener shape de respuesta: `_layerId`, `_layerName`, `_wkt`).
3. `DELETE /features` → por `featureId`. **Compat:** aceptar `featureIndex` resolviéndolo por `order` (deprecado, con header `Deprecation`).
4. `POST /layers` → metadata + features en batch.
5. Para proyectos `v1` (no migrados aún): la API debe seguir operando sobre el blob (dual-path por `schemaVersion`).

**Aceptación:** suite de la API (POST/GET/DELETE) verde contra proyectos v1 y v2; contrato de respuesta sin cambios incompatibles salvo DELETE (documentado).

**Rollback:** desplegar versión previa de las rutas.

**Checklist:** ☐ POST escribe subcolección ☐ GET filtra ☐ DELETE compat ☐ v1 sigue funcionando.

---

### Fase 5 — Backup, backfill y comentarios (staging → prod)
**Tareas** (detalle en §12)
1. **Backup/export** de Firestore (§13).
2. **Backfill** idempotente, resumable, con dry-run y reconciliación (§12).
3. **Comentarios**: `featureIndex → featureId` con el orden exacto del backfill; huérfanos a un log (#16). Cambiar `FeatureComment` en [firebase.ts:408](../lib/firebase.ts) y `FeatureComments.tsx`.
4. **Dual-write** opcional durante ventana (escribir blob + subcolección) para rollback inmediato.
5. **Snapshots**: autocontenidos; `handleRestore` reemplaza atómicamente la subcolección (borrar + recrear en batch) + layers meta; convertir snapshots legacy al restaurar.
6. `forkProject`: copiar features con batched writes.

**Aceptación:** backfill en **copia de prod**; `featureCount`/`layerFeatureCounts` == count real por proyecto; comentarios remapeados (0 huérfanos inesperados); restore de snapshot reproduce el estado.

**Rollback:** si falla, proyectos quedan `v1` (dual-read los sirve); `_legacyFeatures` intacto.

**Checklist:** ☐ export hecho ☐ dry-run revisado ☐ reconciliación 100% ☐ comentarios OK ☐ restore OK.

---

### Fase 6 — Cutover y limpieza
**Tareas**
1. Activar flag gradualmente (gradualidad natural por `schemaVersion` por proyecto).
2. **Monitoreo/alertas** (§15): éxito/fallo writes, errores listener, volumen reads.
3. `appMinVersion` → forzar recarga de clientes obsoletos (PR-5).
4. Ventana de estabilidad (p.ej. 1–2 semanas) con dual-write.
5. Retirar path legacy; borrar `_legacyFeatures` (script batched).

**Aceptación:** 100% proyectos `v2`; métricas estables; 0 escrituras legacy; storage liberado.

**Rollback:** mientras `_legacyFeatures` exista y dual-write esté ON, volver a flag legacy sin pérdida.

**Checklist:** ☐ 100% v2 ☐ métricas OK ☐ clientes actualizados ☐ legacy retirado ☐ `_legacyFeatures` borrado.

---

## 6. `lib/firebase.ts` — firmas

```ts
// Lectura
getProjectWithFeatures(projectId: string): Promise<Project>;          // dual v1/v2
subscribeToProjectFeatures(
  projectId: string,
  cb: (change: { docs: FeatureDoc[]; fromCache: boolean; hasPendingWrites: boolean }) => void
): Unsubscribe;

// Escritura granular
createFeature(projectId: string, f: FeatureDoc): Promise<void>;
updateFeature(projectId: string, id: string, patch: Partial<FeatureDoc>): Promise<void>;
deleteFeature(projectId: string, id: string): Promise<void>;
bulkWriteChangeset(projectId: string, cs: Changeset): Promise<void>;  // batches ≤500 + counts/bbox/updatedAt

// Metadata
saveLayersMeta(projectId: string, layers: LayerMeta[]): Promise<void>;

// Cascadas
deleteLayerCascade(projectId: string, layerId: string): Promise<void>;
deleteProjectCascade(projectId: string): Promise<void>;

// Límites
getLayerFeatureCount(projectId: string, layerId: string): Promise<number>; // del doc o count()

// Helpers internos
computeBbox(features: FeatureDoc[]): Bbox | null;
validateFeatureSize(f: FeatureDoc): void; // throw si ≥ ~1 MiB
```
> Mantener `saveProjectLayers`, `parseLayers`, etc. durante la transición (path legacy gobernado por flag/`schemaVersion`).

---

## 7. Reglas de seguridad (`firestore.rules`)

```
match /projects/{projectId}/features/{featureId} {
  function proj() { return get(/databases/$(database)/documents/projects/$(projectId)).data; }
  function isProjEditor() {
    return isSignedIn() && (
      proj().ownerId == request.auth.uid ||
      (request.auth.token.email in proj().collaborators &&
       proj().roles.get(request.auth.token.email, 'editor') != 'viewer'));
  }
  allow read: if proj().isPublic == true ||
                 (isSignedIn() && (proj().ownerId == request.auth.uid ||
                  request.auth.token.email in proj().collaborators));
  allow create, update, delete: if isProjEditor();
}
```
**Notas de coste:** `get()` del proyecto se evalúa por operación (1 read facturado). Para `list` (cargar N features) la regla se evalúa **a nivel de query**, no por doc → cargar la subcolección NO dispara N `get()`. Las rules **no** validan `layerId` ni cuentan features (límites en cliente/API/Function).

---

## 8. Índices (`firestore.indexes.json`)
```jsonc
{ "collectionGroup": "features", "queryScope": "COLLECTION",
  "fields": [ {"fieldPath":"layerId","order":"ASCENDING"},
              {"fieldPath":"order","order":"ASCENDING"} ] }
// comments: reemplazar featureIndex → featureId
{ "collectionGroup": "comments", "queryScope": "COLLECTION",
  "fields": [ {"fieldPath":"layerId","order":"ASCENDING"},
              {"fieldPath":"featureId","order":"ASCENDING"},
              {"fieldPath":"createdAt","order":"ASCENDING"} ] }
```

---

## 9. Concurrencia / merge realtime
```ts
subscribeToProjectFeatures(pid, ({ docs, hasPendingWrites }) => {
  if (hasPendingWrites) return;            // eco de mi propia escritura → ignorar
  // Merge por id: aplicar remotos EXCEPTO sobre features en edición local (dirty set)
  setLayers(prev => mergeRemote(prev, docs, dirtyIdsRef.current));
});
```
- `hasPendingWrites` (metadata del snapshot) distingue escritura local pendiente de cambio del servidor → evita loops.
- `dirtyIdsRef`: ids con edición local sin confirmar; no se pisan con datos remotos hasta que su write confirme.
- Resolución: **last-write-wins por feature** (no por proyecto) → elimina el clobber masivo actual.
- El primer snapshot sirve de carga inicial (no `getDocs` aparte).
- **No** usar `onSnapshot` en embed/explore/público de alto tráfico → lectura puntual cacheada.

---

## 10. Límites de plan
- `layerFeatureCounts[layerId]` en el doc, actualizado **en el mismo batch/transacción** del cambio (increment/decrement).
- Validación antes de crear: leer del doc (0 reads extra si ya está en memoria) o `count()` (1 read).
- **Seguridad:** las rules no pueden contar → un cliente con token podría exceder por SDK directo. Si el límite debe ser **inviolable** (decisión #2), enrutar las creaciones por una Cloud Function/endpoint que valide y escriba.
- Reconciliación periódica (job) para corregir derivas del contador.

---

## 11. Feature flag + version check (PR-5)
- `NEXT_PUBLIC_FEATURES_SUBCOLLECTION` (`on|off`) — gate global de lectura/escritura nueva. Leído en el editor y la capa de datos.
- `APP_VERSION` inyectada en build (`NEXT_PUBLIC_APP_VERSION`).
- `project.appMinVersion`: si `APP_VERSION < appMinVersion` → banner + bloqueo de escritura + sugerir recarga.
- Gradualidad real por `schemaVersion` por proyecto (no todo-o-nada).

---

## 12. Backfill (script Admin SDK, `scripts/backfill-features.ts`)
**Propiedades:** idempotente, resumable, dry-run, batched, con reconciliación.

```
para cada projectDoc donde schemaVersion != 2 (paginado por __name__, checkpoint en archivo/colección migrationState):
  intentar:
    layers = parse(projectDoc.layers)   // try/catch por JSON corrupto → log y marcar 'needs_review'
    indexMap = {}                        // (layerId,index) -> featureId  (para comentarios)
    batch = nuevo writeBatch
    counts = {}; bbox = null; order = {}
    para cada layer, para cada feature[i]:
        fid = feature.id ?? generar()    // reusar id si ya vino de Fase 0
        order[layer] = (order[layer] ?? 0) + 1024
        batch.set(features/fid, { layerId, geometry, properties, order, createdAt, updatedAt, createdBy:'backfill' })
        counts[layer]++; bbox = extend(bbox, feature)
        indexMap[(layer,i)] = fid
        si batch llega a 450 ops → commit + nuevo batch (idempotente: set, no add)
    // comentarios del proyecto:
    para cada comment con featureIndex:
        fid = indexMap[(comment.layerId, comment.featureIndex)]
        si fid → update(comment, { featureId: fid }); si no → log huérfano
    // finalizar proyecto:
    update(project, { layers: layersMetaSinFeatures, featureCount: Σcounts, layerFeatureCounts: counts,
                      bbox, schemaVersion: 2, _legacyFeatures: projectDoc.layers /* respaldo */ })
    commit
    checkpoint(projectId, 'done')
  catch e:
    checkpoint(projectId, 'error', e); continuar
al final: REPORTE { migrados, errores, huérfanos, proyectos needs_review }
```
**Dry-run:** misma lógica sin `commit`; imprime conteos esperados y diferencias.
**Reconciliación:** post-run, para muestra/total: `count(features)==featureCount==ΣlayerFeatureCounts`.
**Resumable:** colección `migrationState/{projectId}` con estado; reejecutar salta los `done`.
**Idempotencia:** `set(features/{fid})` con ids deterministas (de Fase 0) → reejecutar no duplica.

---

## 13. Backup / restore (antes de tocar prod)
```bash
# Export completo (o por colección) a un bucket GCS
gcloud firestore export gs://<BUCKET>/backups/pre-features-$(date +%F) \
  --project=<FIREBASE_PROJECT_ID>

# (si hay que restaurar)
gcloud firestore import gs://<BUCKET>/backups/pre-features-YYYY-MM-DD \
  --project=<FIREBASE_PROJECT_ID>
```
- Verificar que existe el bucket y permisos (`Datastore Import Export Admin`).
- Guardar el path del export en el runbook.

---

## 14. Runbook de despliegue (orden + gates + rollback)
| # | Paso | Gate (go/no-go) | Rollback |
|---|------|-----------------|----------|
| 1 | Deploy **Fase 0** (ids+diff, blob) | Smoke draw/edit/undo OK | revert commit |
| 2 | Deploy **índices** | estado `READY` en consola | borrar índices |
| 3 | Deploy **rules** (features) | emulador + staging OK | revert rules |
| 4 | Deploy código **F1–F4** con flag **OFF** | build OK; nada activo | revert |
| 5 | **Backup** Firestore (§13) | export `SUCCESSFUL` | n/a |
| 6 | **Backfill dry-run** en copia de prod | reconciliación 100% | n/a |
| 7 | **Backfill real** + dual-write ON, lote pequeño (canary) | proyectos canary OK | proyectos quedan v1 |
| 8 | Backfill resto (paginado) | reconciliación total | re-run resumable |
| 9 | Flag **ON** + `appMinVersion` bump | métricas estables | flag OFF |
| 10 | Ventana estabilidad (1–2 sem) | 0 errores legacy | flag OFF (dual-write protege) |
| 11 | Retirar legacy + borrar `_legacyFeatures` | confirmación final | restaurar de backup |

> **Nunca** ejecutar el paso 11 sin haber completado el 10 y con backup verificado.

---

## 15. Monitoreo y alertas
- **Métricas:** writes OK/fallidos por feature; latencia de guardado; errores de listener; reads/min (amplificación); tamaño de docs feature.
- **Logs:** cada fallo de `bulkWriteChangeset` con projectId/featureIds; huérfanos en backfill; version-check forzando recarga.
- **Alertas (cutover):** tasa de error de writes > umbral; pico anómalo de reads; crecimiento de `migrationState` con `error`.
- Dashboard temporal en Firebase/Cloud Monitoring durante F6.

---

## 16. Costos estimados (orden de magnitud)
- Lecturas: ~$0.06/100k. Abrir proyecto de 500 features = 500 reads ≈ $0.0003; 100k aperturas ≈ $30 (pero la mayoría son proyectos pequeños).
- Escrituras: ~$0.18/100k. Edición incremental ≈ igual que hoy (1 op); bulk/import = N ops (centavos).
- Storage: similar + pequeño overhead por doc.
- **Conclusión:** costo no es el factor; el driver es el límite de 1 MiB y la escalabilidad. Guardrail: dashboard/listados NUNCA leen features.

---

## 17. Matriz de testing
| Tipo | Casos |
|------|-------|
| Unit | diffFeatures; reversibilidad changeset; computeBbox; counts; validateFeatureSize; order |
| Integración | draw/edit/delete; union/subtract/buffer; paste WKT; import CSV; duplicate; color/rename; add columna; add/delete capa; undo/redo |
| **Concurrencia** | API POST con editor abierto → no se pierde; dos editores en features distintas; mismo feature (LWW) |
| Cascada | delete capa → 0 huérfanos; delete proyecto → 0 huérfanos |
| Rules | owner/editor/viewer/público (read/write) emulador |
| Migración | backfill copia prod; reconciliación; comentarios; restore snapshot; needs_review |
| API | POST/GET/DELETE v1 y v2; DELETE compat index/id; paginación/bbox |
| Límites | maxFeaturesPerLayer (contador) cliente y API |
| Regresión | embed, explore, templates, editor, export, thumbnail |

---

## 18. Catálogo de edge cases
- Feature sin geometría / geometría inválida → rechazar en write.
- Single MultiPolygon ≥ 1 MiB → `validateFeatureSize` (trocear o rechazar).
- `features` JSON corrupto en legacy → backfill marca `needs_review`, no rompe.
- Comentario con `featureIndex` fuera de rango → log huérfano, no falla.
- Duplicar feature → id nuevo (no colisión).
- Borrar capa con muchas features → batches; no exceder 500 ops/op.
- Proyecto borrado con subcolección viva → cascada (PR-2).
- `order` colisión → tie-break createdAt+id.
- Cliente offline / fallo de red → cola de reintentos; estado `error`.
- Cliente obsoleto escribiendo legacy sobre v2 → bloqueado por version check.
- Snapshot legacy restaurado post-migración → convertir a subcolección.
- Fork de proyecto grande → batched copy; respetar límites.
- Eco de onSnapshot de la propia escritura → `hasPendingWrites`.
- Drag de vértices rápido → debounce por feature; límite ~1 write/seg/doc.

---

## 19. Matriz de cobertura
| Punto | Fase |
|---|---|
| PR-1 / #1 featureId + undo-redo | Fase 0 |
| PR-2 / #2 cascada/huérfanos | F1 + F3 |
| PR-3 / #18 thumbnail (bbox/featureCount) | F1 + F2 + F3 |
| PR-4 / #3 updatedAt granular | F1 + F3 |
| PR-5 / #4 cliente obsoleto/schemaVersion | F1 + F6 |
| #5 atomicidad multi-feature + undo | Fase 0 |
| #6 ops masivas de propiedades | F3 |
| #7 hasPendingWrites (anti-eco) | F2 |
| #8 listener único = carga | F2 |
| #9 debounce por feature en drag | F3 |
| #10 estrategia de `order` | F1 |
| #11 límites de plan (contador/seguridad) | F1 + F3 + §10 |
| #12 <1 MiB + coste rules get()/list | F1 + §7 |
| #13 backup pre-migración | F5 + §13 |
| #14 orden de despliegue | §14 |
| #15 backfill robusto + snapshots | F5 + §12 |
| #16 migración de comentarios | F5 + §12 |
| #17 errores/reintentos + estado guardado | F3 |
| #19 monitoreo/alertas | F6 + §15 |
| (base) rules/índices/funciones/API/consumidores/fork/flag/tests | F1–F6 + transversal |

---

## 20. Decisiones abiertas (confirmar antes de codear)
1. **Thumbnail:** ¿`bbox`+`featureCount` (barato) o además miniatura/preview cacheada?
2. **Límite de plan duro:** ¿validación cliente/API o forzar por Cloud Function (inviolable)?
3. **API `DELETE`:** ¿versionar endpoint o aceptar `featureIndex` y `featureId` en paralelo?
4. **Borrado recursivo:** ¿batches Admin/cliente o Cloud Function `recursiveDelete`?
5. **Dual-write:** ¿lo activamos en la ventana de cutover (más seguro, más costo) o confiamos en `_legacyFeatures` + dual-read?

---

## 21. Inventario de consumidores
- [app/[projectId]/page.tsx](../app/[projectId]/page.tsx) — load, autosave, undo/redo, selección.
- [components/map/ActiveLayerEditor.tsx](../components/map/ActiveLayerEditor.tsx) — _onCreated/_onEdited/_onDeleted, union/subtract/buffer, comentarios.
- [components/map/InitialDataLoader.tsx](../components/map/InitialDataLoader.tsx) — render desde estado.
- [components/Sidebar.tsx](../components/Sidebar.tsx) — paste WKT, duplicate, color/rename, add/delete capa.
- [components/AttributeTable.tsx](../components/AttributeTable.tsx) — editar celdas, agregar columna (bulk).
- [components/Map.tsx](../components/Map.tsx) — render de capas no activas.
- [components/VersionHistoryPanel.tsx](../components/VersionHistoryPanel.tsx) — snapshots/restore.
- [components/map/FeatureComments.tsx](../components/map/FeatureComments.tsx) — featureIndex→featureId.
- [lib/firebase.ts](../lib/firebase.ts) — funciones de proyecto/feature/snapshot/fork.
- [lib/export-utils.ts](../lib/export-utils.ts) — export.
- [app/api/v1/projects/[projectId]/features/route.ts](../app/api/v1/projects/[projectId]/features/route.ts), [layers/route.ts](../app/api/v1/projects/[projectId]/layers/route.ts) — API.
- [app/page.tsx](../app/page.tsx) — dashboard/thumbnail.
- [app/embed/[projectId]](../app/embed/[projectId]), [app/explore/page.tsx](../app/explore/page.tsx), [app/templates/page.tsx](../app/templates/page.tsx), [app/editor/page.tsx](../app/editor/page.tsx) — lecturas/creación.
- [firestore.rules](../firestore.rules), [firestore.indexes.json](../firestore.indexes.json).
