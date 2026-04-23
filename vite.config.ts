import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env': JSON.stringify({
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        VITE_GEMINI_API_KEY: env.VITE_GEMINI_API_KEY,
        VITE_OPENAI_API_KEY: env.VITE_OPENAI_API_KEY,
        VITE_CLAUDE_API_KEY: env.VITE_CLAUDE_API_KEY,
        VITE_GEMINI_MODEL: env.VITE_GEMINI_MODEL,
        VITE_OPENAI_MODEL: env.VITE_OPENAI_MODEL,
        VITE_CLAUDE_MODEL: env.VITE_CLAUDE_MODEL,
        VITE_AI_PROVIDER: env.VITE_AI_PROVIDER,
        VITE_FALLBACK_AI_PROVIDER: env.VITE_FALLBACK_AI_PROVIDER,
      }),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
