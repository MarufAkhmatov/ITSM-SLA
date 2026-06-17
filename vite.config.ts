import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    host: true,            // bind 0.0.0.0 so a phone on the same Wi-Fi can reach it
    // Honor a PORT env if provided (e.g. the preview harness assigns a free
    // port); otherwise fall back to Vite's default 5173 (persistent dev server).
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    allowedHosts: true,    // allow tunnel hostnames (cloudflared / ngrok / localtunnel)
    proxy: {
      // Frontend calls same-origin "/api/*" which Vite forwards to the Python
      // backend — so only port 5173 needs to be exposed (LAN or tunnel).
      '/api': { target: 'http://localhost:8077', changeOrigin: true },
    },
  },
})
