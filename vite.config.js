import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Bundle gồm cả bộ từ vựng JSON (~70KB) nên lớn hơn mức cảnh báo mặc định
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
  },
})
