import { defineConfig, loadEnv } from "vite";
import { defaults } from "./src/config.ts";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const apiPort = env.PORT ?? defaults.PORT
    return {
        publicDir: "public",
        root: "client",
        build: {
            outDir: "../dist/client",
            emptyOutDir: true,
        },
        server: {
            host: "0.0.0.0",
            proxy: {
                "/api": `http://localhost:${apiPort}`,
            },
        },
    };
});
