import { realpathSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This repo lives on a NAS-backed share (W: -> \\NAS_Storage_1\Workspaces).
// Windows cannot deliver native change notifications across SMB, so chokidar's
// fs.watch throws `UNKNOWN: unknown error, watch` and kills the dev server on
// startup. Polling is the supported fallback. It costs a little CPU, so only
// turn it on when the project really is on a network path — a local clone keeps
// native watching. Set VITE_FORCE_POLLING=1 / =0 to override the detection.
function isNetworkPath(): boolean {
  const override = process.env.VITE_FORCE_POLLING
  if (override === '1') return true
  if (override === '0') return false
  try {
    return realpathSync.native(process.cwd()).startsWith('\\\\')
  } catch {
    return false
  }
}

const usePolling = isNetworkPath()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4304,
    watch: usePolling ? { usePolling: true, interval: 400 } : undefined,
  },
  preview: {
    host: '127.0.0.1',
    port: 4304,
  },
})
