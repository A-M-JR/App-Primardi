import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Primardi',
        short_name: 'Primardi',
        description: 'Sistema de gestão de pedidos',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f264a',
        icons: [
            {
                src: '/icon-32x32.png',
                sizes: '32x32',
                type: 'image/png',
            },
            {
                src: '/logo_quadrada.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/logo_quadrada.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
            }
        ],
    }
}
