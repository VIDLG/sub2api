import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

/**
 * Vite 插件：开发模式下注入公开配置到 index.html
 * 与生产模式的后端注入行为保持一致，消除闪烁
 */
/**
 * 仅在开发模式下注入公开配置，消除首屏闪烁。
 * 生产构建（build 模式）跳过，由 Go embed 服务端在请求时注入（附带正确的 CSP nonce）。
 */
function injectPublicSettings(backendUrl: string, isDev: boolean): Plugin {
  return {
    name: 'inject-public-settings',
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        if (!isDev) return html
        try {
          const response = await fetch(`${backendUrl}/api/v1/settings/public`, {
            signal: AbortSignal.timeout(2000),
          })
          if (response.ok) {
            const data = (await response.json()) as { code: number; data?: unknown }
            if (data.code === 0 && data.data) {
              const script = `<script>window.__APP_CONFIG__=${JSON.stringify(data.data)};</script>`
              return html.replace('</head>', `${script}\n</head>`)
            }
          }
        } catch (e) {
          console.warn('[vite] 无法获取公开配置，将回退到 API 调用:', (e as Error).message)
        }
        return html
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'
  const devPort = Number(env.VITE_DEV_PORT || 3000)
  const isDev = mode === 'development'

  return {
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']],
        },
      }),
      tailwindcss(),
      injectPublicSettings(backendUrl, isDev),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: '../backend/internal/web/dist-react',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (
                id.includes('/react/') ||
                id.includes('/react-dom/') ||
                id.includes('/react-router') ||
                id.includes('/scheduler/')
              ) {
                return 'vendor-react'
              }
              if (id.includes('/chart.js/') || id.includes('/react-chartjs/')) {
                return 'vendor-chart'
              }
              if (id.includes('/i18next/') || id.includes('/react-i18next/')) {
                return 'vendor-i18n'
              }
              if (id.includes('/@reactuses/') || id.includes('/xlsx/')) {
                return 'vendor-ui'
              }
              return 'vendor-misc'
            }
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: devPort,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/setup': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
