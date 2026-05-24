import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
function ensureStaticPlaceholderAsset(root) {
    const source = resolve(root, 'public/placeholder.svg');
    const target = resolve(root, 'dist-manifest/placeholder.svg');
    if (!existsSync(source) || existsSync(target)) {
        return;
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
}
function ensureStaticPlaceholderPlugin() {
    return {
        name: 'ensure-static-placeholder-asset',
        configResolved(config) {
            ensureStaticPlaceholderAsset(config.root);
        },
        configureServer(server) {
            ensureStaticPlaceholderAsset(server.config.root);
        },
        buildStart() {
            ensureStaticPlaceholderAsset(process.cwd());
        },
    };
}
function normalizeId(id) {
    return id.replace(/\\/g, '/');
}
function resolveManualChunk(id) {
    const normalized = normalizeId(id);
    if (normalized.includes('/node_modules/')) {
        if (normalized.includes('/lucide'))
            return 'vendor-lucide';
        return 'vendor';
    }
    if (normalized.includes('/src/components/shell.ts')
        || normalized.includes('/src/main.ts')) {
        return 'app-shell';
    }
    if (normalized.includes('/src/router/routes.ts')) {
        return 'app-routes';
    }
    if (normalized.includes('/src/router/routes-fcs.ts')) {
        return 'app-routes-fcs';
    }
    if (normalized.includes('/src/router/routes-pcs.ts')) {
        return 'app-routes-pcs';
    }
    if (normalized.includes('/src/router/routes-pda.ts')) {
        return 'app-routes-pda';
    }
    return undefined;
}
export default defineConfig({
    plugins: [ensureStaticPlaceholderPlugin()],
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        chunkSizeWarningLimit: 3200,
        rollupOptions: {
            output: {
                manualChunks: resolveManualChunk,
            },
        },
    },
});
