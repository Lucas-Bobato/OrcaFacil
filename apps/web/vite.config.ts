/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Em desenvolvimento, /api é encaminhado para a API (porta 3333 por padrão).
const alvoApi = process.env.API_PROXY_TARGET ?? 'http://localhost:3333';

const { headers: regrasDeCabecalho } = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: Array<{ headers: Array<{ key: string; value: string }> }>;
};
// HSTS só faz sentido em HTTPS; no preview local (HTTP) o navegador o ignoraria.
const cabecalhosDeProducao = Object.fromEntries(
  regrasDeCabecalho[0].headers.filter((h) => h.key !== 'Strict-Transport-Security').map((h) => [h.key, h.value]),
);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'OrçaFácil',
        short_name: 'OrçaFácil',
        description: 'Orçamentos profissionais em PDF, prontos para enviar pelo WhatsApp.',
        lang: 'pt-BR',
        theme_color: '#25467C',
        background_color: '#F6F7F3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // A interface fica em cache; os dados sempre vêm da API.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: { '/api': { target: alvoApi, changeOrigin: true } },
  },
  preview: {
    port: Number(process.env.WEB_PORT ?? 4173),
    // Mesmos cabeçalhos da produção, para testar a CSP localmente antes de publicar.
    headers: cabecalhosDeProducao,
    proxy: { '/api': { target: alvoApi, changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: false,
    coverage: { include: ['src/**'], exclude: ['src/main.tsx'] },
  },
});
