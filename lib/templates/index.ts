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
        name: 'World Capitals',
        description: '~200 world capital cities as geographic points.',
        tags: ['points', 'world', 'cities'],
        featureCount: 195,
        layerName: 'Capitals',
        color: '#6366f1',
        getData: async () => {
            const { default: data } = await import('./world-capitals.json');
            return data as GeoJSON.FeatureCollection;
        },
    },
    {
        id: 'latam-countries',
        name: 'Latin America Countries',
        description: 'Polygons of the 20 countries of Latin America and the Caribbean.',
        tags: ['polygons', 'latin-america', 'countries'],
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
        name: 'US States',
        description: 'Simplified polygons of all 50 United States.',
        tags: ['polygons', 'usa', 'states'],
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
        name: 'Sample Routes',
        description: 'Example lines for logistics routes, roads or transit paths.',
        tags: ['lines', 'routes', 'transport'],
        featureCount: 5,
        layerName: 'Routes',
        color: '#f59e0b',
        getData: async () => {
            const { default: data } = await import('./sample-routes.json');
            return data as GeoJSON.FeatureCollection;
        },
    },
    {
        id: 'sample-zones',
        name: 'Coverage Zones',
        description: 'Example polygons for delivery zones, coverage areas or service regions.',
        tags: ['polygons', 'zones', 'delivery'],
        featureCount: 6,
        layerName: 'Zones',
        color: '#ec4899',
        getData: async () => {
            const { default: data } = await import('./sample-zones.json');
            return data as GeoJSON.FeatureCollection;
        },
    },
];
