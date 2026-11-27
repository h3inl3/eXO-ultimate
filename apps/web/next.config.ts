import type { NextConfig } from 'next';

const config: NextConfig = {
  // @exo/shared ships TypeScript source; let Next compile it.
  transpilePackages: ['@exo/shared', '@exo/api-client'],
};
export default config;
