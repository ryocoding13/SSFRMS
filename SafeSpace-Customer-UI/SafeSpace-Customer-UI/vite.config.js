import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const env = loadEnv(mode, process.cwd(), '');
  let apiUrl = env.VITE_API_URL || '';

  // Khi build production, bảo đảm không rò rỉ URL localhost từ file .env.local cá nhân
  if (isProd && (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1') || apiUrl.trim() === '/')) {
    apiUrl = '';
  }

  return {
    base: './',
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      __DEV_API_FALLBACK__: isProd ? '""' : '"http://localhost:5151"'
    }
  };
});
