import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

interface PackageJson {
  version?: string
}

function getAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as PackageJson
    if (pkg.version) return pkg.version
  } catch {
    // ignore malformed package.json and use final fallback below
  }

  return '0.0.0-dev'
}

const appVersion = getAppVersion()

export default defineConfig({
  main: {
    define: {
      'process.env.APP_VERSION': JSON.stringify(appVersion)
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    define: {
      'process.env.APP_VERSION': JSON.stringify(appVersion)
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    define: {
      'process.env.APP_VERSION': JSON.stringify(appVersion)
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    }
  }
})
