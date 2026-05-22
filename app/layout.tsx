import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { AIProvider } from '@/lib/ai-context'
import { AIChatPanel } from '@/components/ai-chat-panel'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" })

export const metadata: Metadata = {
  metadataBase: new URL('https://www.alvarobueno.com.br'),
  title: 'Primardi - Gestão Comercial',
  description: 'Sistema de gestão de pedidos, orçamentos e clientes.',
  icons: {
    icon: '/icon-32x32.png',
    apple: '/logo_quadrada.png',
  },
  openGraph: {
    title: 'Primardi - Gestão Comercial',
    description: 'Sistema de gestão de pedidos, orçamentos e clientes.',
    url: 'https://www.alvarobueno.com.br',
    siteName: 'Primardi',
    images: [
      {
        url: '/logo_quadrada.png',
        width: 1000,
        height: 1000,
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Primardi - Gestão Comercial',
    description: 'Sistema de gestão de pedidos, orçamentos e clientes.',
    images: ['/logo_quadrada.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#1a365d',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedColor = localStorage.getItem('flexo_theme_sidebar');
                  if (savedColor) {
                    if (savedColor.startsWith('#')) {
                      document.documentElement.style.setProperty('--sidebar', savedColor);
                      document.documentElement.style.setProperty('--sidebar-border', savedColor + '40');
                    } else {
                      document.documentElement.style.setProperty('--sidebar', 'transparent');
                      // Para gradientes, adicionamos um estilo global temporário até o AppShell assumir
                      var style = document.createElement('style');
                      style.innerHTML = '[data-sidebar="sidebar-inner"] { background: ' + savedColor + ' !important; }';
                      document.head.appendChild(style);
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <AIProvider>
            {children}
            {/* Módulo IA — Chat flutuante acessível de qualquer tela */}
            <AIChatPanel />
          </AIProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
