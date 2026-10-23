// This Vercel project uses frontend/ as its root directory.
// Keep API calls on the frontend origin so HTTP-only session cookies work.
const rawOrigin = process.env.JALWATCH_API_ORIGIN;
if (!rawOrigin) {
  throw new Error('Set JALWATCH_API_ORIGIN to the deployed backend HTTPS origin');
}

const backend = new URL(rawOrigin);
if (
  backend.protocol !== 'https:' ||
  backend.username ||
  backend.password ||
  backend.pathname !== '/' ||
  backend.search ||
  backend.hash
) {
  throw new Error('JALWATCH_API_ORIGIN must be an HTTPS origin without a path');
}

export const config = {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: `${backend.origin}/api/:path*` },
    { source: '/(.*)', destination: '/index.html' },
  ],
};
