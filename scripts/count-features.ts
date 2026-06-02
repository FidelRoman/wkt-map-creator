import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

const apiKey = 'wk_77fa69e91c7e70ebc86f85635b82e107f642b7111b90663f';
const pId = 'zSZcvJiq0LedbYarAnUL';

async function run() {
  const base = 'http://localhost:3000';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const getFeaturesRes = await fetch(`${base}/api/v1/projects/${pId}/features`, { headers });
  console.log(`Production GET features status: ${getFeaturesRes.status}`);
  const featuresData = (await getFeaturesRes.json()) as any;
  console.log(`Features returned count: ${featuresData.features?.length}`);
  console.log(`Meta:`, featuresData.meta);
  featuresData.features?.forEach((f: any, i: number) => {
    console.log(`[${i}] ID: ${f.id}, Name: ${f.properties?.name}, Layer ID: ${f.properties?._layerId}`);
  });
}

run().catch(console.error).finally(() => process.exit(0));
