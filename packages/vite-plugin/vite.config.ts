import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WorkerifyVitePlugin',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['vite'],
      output: {
        globals: {
          vite: 'vite'
        }
      }
    },
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true
  },
  esbuild: {
    target: 'es2022'
  }
})