import tailwindcss from '@tailwindcss/vite';
import workerifyPlugin from '@workerify/vite-plugin';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [tailwindcss(), workerifyPlugin()],
});