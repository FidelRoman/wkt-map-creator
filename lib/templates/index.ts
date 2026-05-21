export interface Template {
    id: string;
    name: string;
    description: string;
    tags: string[];
    featureCount: number;
    layerName: string;
    color: string;
    getData: () => Promise<GeoJSON.FeatureCollection>;
}

export const TEMPLATES: Template[] = [
    {
        id: 'world-capitals',
        name: 'Capitales del Mundo',
        description: '~200 ciudades capitales del mundo como puntos geográficos.',
        tags: ['puntos', 'mundial', 'ciudades'],
        featureCount: 195,
        layerName: 'Capitales',
        color: '#6366f1',
        getData: async () => {
            const { default: data } = await import('./world-capitals.json');
            return data as GeoJSON.FeatureCollection;
        },
    },
    {
        id: 'latam-countries',
        name: 'Países de América Latina',
        description: 'Polígonos de los 20 países de América Latina y el Caribe.',
        tags: ['polígonos', 'latinoamérica', 'países'],
        featureCount: 20,
        layerName: 'LATAM',
        color: '#10b981',
        getData: async () => {
            const { default: data } = await import('./latam-countries.json');
            return data as GeoJSON.FeatureCollection;
        },
    },
    {
        id: 'us-states',
        name: 'Estados de EE.UU.',
        description: 'Polígonos simplificados de los 50 estados de los Estados Unidos.',
        tags: ['polígonos', 'usa', 'estados'],
        featureCount: 50,
        layerName: 'US States',
        color: '#3b82f6',
        getData: async () => {
            const { default: data } = await import('./us-states.json');
            return data as GeoJSON.FeatureCollection;
        },
    },
    {
        id: 'sample-routes',
        name: 'Rutas de Ejemplo',
        description: 'Líneas de ejemplo para rutas logísticas, carreteras o trazados.',
        tags: ['líneas', 'rutas', 'transporte'],
        featureCount: 5,
        layerName: 'Rutas',
        color: '#f59e0b',
        getData: async () => {
            const { default: data } = await import('./sample-routes.json');
            return data as GeoJSON.FeatureCollection;
        },
    },
    {
        id: 'sample-zones',
        name: 'Zonas de Cobertura',
        description: 'Polígonos de ejemplo para zonas de entrega, cobertura o áreas de servicio.',
        tags: ['polígonos', 'zonas', 'entrega'],
        featureCount: 6,
        layerName: 'Zonas',
        color: '#ec4899',
        getData: async () => {
            const { default: data } = await import('./sample-zones.json');
            return data as GeoJSON.FeatureCollection;
        },
    },
];
