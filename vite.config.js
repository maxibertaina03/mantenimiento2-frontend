/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
// https://vitejs.dev/config/
export default defineConfig(function (_a) {
    var command = _a.command, mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), 'VITE_');
    // Guarda de despliegue: en Vite las VITE_* se INCRUSTAN en el bundle al
    // compilar. Si falta VITE_API_URL, el build sale apuntando a localhost:3000 y
    // en produccion todo falla con ERR_CONNECTION_REFUSED (que en el navegador
    // se ve como un error de CORS). Preferimos romper el build antes que
    // publicar algo roto en silencio.
    if (command === 'build' && !env.VITE_API_URL) {
        throw new Error([
            'Falta VITE_API_URL en el build.',
            'En Vercel: vercel deploy --prod -b VITE_API_URL=https://<backend>/api -b VITE_CLERK_PUBLISHABLE_KEY=<pk>',
            'En local: definila en el archivo .env',
        ].join('\n'));
    }
    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            port: 5173,
        },
        test: {
            environment: 'jsdom',
            globals: true,
            setupFiles: './src/test/setup.ts',
            css: false,
        },
    };
});
