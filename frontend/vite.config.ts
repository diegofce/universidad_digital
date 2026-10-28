import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setup/setup.ts',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'src/tests/**',
        'src/test-setup.ts',
        'src/main.tsx',
        'src/**/*.d.ts',
        'src/**/types.ts',
        '**/dist/**',
        '**/*.config.*',
        'vite.config.ts',
      ],
    },
  },
});
