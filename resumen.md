# WKT Map Creator — Resumen del Proyecto

## Qué es

WKT Map Creator es un editor de datos geográficos en la web, construido para el flujo de trabajo real de desarrolladores GIS y data engineers. Su diferenciador central es el soporte nativo de WKT (Well-Known Text): puedes pegar directamente la salida de `ST_AsText()` de PostGIS, de Shapely, o de GDAL, y verla en el mapa al instante. Sin conversiones. Sin fricciones.

Es el eslabón que falta entre la base de datos espacial y el mapa compartible.

---

## El problema que resuelve

Los profesionales GIS viven en dos mundos que no hablan entre sí:

- **Herramientas desktop** (QGIS, ArcGIS): potentes pero lentas, caras y no colaborativas.
- **Google Maps / Mapbox Studio**: visualización bonita pero sin soporte de WKT, sin API, sin Attribute Table, sin flujo de trabajo técnico.

WKT Map Creator cierra esa brecha. Es la herramienta que un equipo de ingeniería puede usar para crear, editar, analizar y compartir datos geográficos sin abandonar su stack técnico.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16, React, Tailwind CSS |
| Mapa | Mapbox GL JS |
| Backend / Auth | Firebase (Firestore + Firebase Auth) |
| API de servidor | Firebase Admin SDK (Next.js API Routes) |
| Análisis espacial | Turf.js |
| Pagos | Paddle |
| Despliegue target | Vercel |

---

## Funcionalidades actuales

### Editor de mapas
- Capas vectoriales con estilos configurables (color, opacidad, grosor, radio de puntos)
- Dibujo interactivo en el mapa (polígonos, líneas, puntos)
- Pegado y edición de WKT directamente en el editor
- Operaciones espaciales: unión de polígonos, diferencia, buffer (análisis de zona de influencia)
- Attribute Table visual: spreadsheet de atributos con edición inline y export CSV
- Medición de áreas y distancias

### Importación / Exportación
- **Importar:** GeoJSON, Shapefile (.shp + .dbf), CSV con columna WKT, CSV con lat/lng
- **Exportar:** CSV, KML, GeoJSON, PostGIS SQL (`INSERT` statements listos para `psql`)

### Colaboración y compartir
- Link público de solo lectura por proyecto
- Colaboradores con acceso al editor (hasta 5 en Pro)
- Embed iframe para incrustar el mapa en cualquier sitio web
- Viewer embeddable sin autenticación

### API REST por proyecto
- Endpoint `GET /api/v1/projects/{projectId}/features`
- Autenticación por Bearer token (API keys gestionables desde Settings)
- Filtro por bounding box (`?bbox=minLon,minLat,maxLon,maxLat`)
- Rate limiting: 1,000 calls/día en Pro
- Respuesta en GeoJSON estándar

### Sandbox sin login
- Editor anónimo en `/editor` con persistencia en localStorage
- Límite de 10 features — experiencia de producto sin fricción de registro

---

## Modelo de negocio — SaaS freemium

| Plan | Precio | Público objetivo |
|---|---|---|
| **Free** | $0 | Devs que prueban, proyectos personales |
| **Pro** | $10/mes · $99/año | GIS engineers, consultores, freelancers |

### Límites por plan

| Feature | Free | Pro |
|---|---|---|
| Proyectos | 3 | Ilimitados |
| Capas / proyecto | 2 | 20 |
| Features / capa | 10 | 5,000 |
| Colaboradores | — | 5 |
| API REST | — | ✓ 1K calls/mes |
| Export KML | — | ✓ |
| Historial de versiones | — | ✓ 20 snapshots |
| Embed iframe | — | ✓ |
| Análisis espacial (Buffer, Unión) | — | ✓ |

### Infraestructura de pagos
- Paddle: checkout overlay, gestión de suscripciones, portal de cliente
- Webhook procesado en servidor que actualiza el plan en Firestore al instante
- Upsell contextual: el UpgradeModal se dispara exactamente en el momento en que el usuario toca un límite

---

## Ventaja competitiva

| | WKT Map Creator | Google My Maps | ArcGIS Online |
|---|---|---|---|
| WKT nativo | ✓ | ✗ (scripts only) | ✗ (scripts only) |
| API REST por proyecto | ✓ | ✗ | ✓ (caro) |
| Attribute Table visual | ✓ | ✗ | ✓ |
| Análisis espacial (Buffer, Unión) | ✓ | ✗ | ✓ |
| Import GeoJSON / Shapefile | ✓ | ✓ | ✓ |
| Precio accesible | ✓ desde $0 | Gratis* | ✗ |
| Embed sin login | ✓ | Limitado | ✗ |

---

## Estado actual

**El producto está listo para vender.** Todas las variables de entorno críticas están configuradas:
- Firebase (Auth + Firestore + Admin SDK)
- Paddle (API key, client token, price IDs Pro mensual/anual, webhook secret)

El flujo completo funciona: usuario se registra → usa en Free → toca un límite → ve el UpgradeModal → paga en Paddle → webhook actualiza el plan → accede a features Pro de inmediato.

---

## Roadmap — Próximas fases

### Fase 3 — Retención y experiencia
- **Version History panel** — UI para ver y restaurar snapshots (la función `createSnapshot` ya existe en Firebase)
- **Onboarding tour** — guía interactiva con driver.js para nuevos usuarios
- **Measurement overlay** — mostrar área y longitud como tooltip en tiempo real al dibujar

### Fase 4 — Crecimiento
- **Dark mode**
- **Project thumbnails** — preview automático con Mapbox Static API
- **Sidebar responsiva / mobile**
- **Real-time collaboration** — cursores y cambios en vivo con Firestore `onSnapshot`

### Fase 5 — Expansión Pro
- **Webhooks** — notificaciones POST a sistemas externos cuando cambia un proyecto
- **Team Workspaces** — namespaces compartidos con roles (admin, editor, viewer)
- **White-label embed** — embed sin watermark para clientes enterprise
- **SSO / SAML** — para clientes enterprise

---

## Visión

WKT Map Creator apunta a ser la **herramienta estándar de visualización y edición geoespacial para equipos de ingeniería**. El mismo lugar que Figma ocupa para diseño o Retool para herramientas internas: una app web colaborativa, con API, que vive entre la base de datos y la presentación.

El mercado GIS profesional está desatendido por herramientas que son o demasiado caras (ArcGIS Enterprise: $700+/usuario/año) o demasiado limitadas (Google My Maps). Existe un espacio enorme para una herramienta moderna, asequible y centrada en el flujo de trabajo técnico.
