import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Bundle visualizer - run with `npx vite build` and see stats.html
    ...(process.env.ANALYZE ? [visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })] : []),
  ],
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      }
    }
  },
  build: {
    // Enable source maps in production only for debugging
    sourcemap: false,
    // Minify aggressively
    minify: 'esbuild',
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // CSS code splitting
    cssCodeSplit: true,
    // Chunk size warnings at 500KB
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Manual chunks for vendor splitting
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Animation
          'vendor-animation': ['framer-motion'],
          // Charts
          'vendor-charts': ['recharts', 'chart.js', 'react-chartjs-2'],
          // UI Icons
          'vendor-icons': ['lucide-react'],
          // Rich text editor
          'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-image', '@tiptap/extension-link', '@tiptap/extension-placeholder'],
          // Socket IO
          'vendor-socket': ['socket.io-client'],
          // HTTP client
          'vendor-http': ['axios'],
          // Monaco editor (large)
          'vendor-monaco': ['@monaco-editor/react'],
          // Supabase
          'vendor-supabase': ['@supabase/supabase-js'],
          // Toast notifications
          'vendor-toast': ['react-hot-toast'],
        },
        // Compact output
        compact: true,
        // Use consistent chunk naming
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
