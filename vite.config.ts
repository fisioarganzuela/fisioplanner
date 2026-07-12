import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// SPA pura para GitHub Pages. Sin SSR, sin Nitro.
// Cuando publicas en <user>.github.io/<repo>/, define VITE_BASE_PATH="/<repo>/" en el workflow.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      // Redirige el cliente auto-generado de Lovable Cloud al cliente externo
      // que apunta al Supabase del usuario (vdrxstbayoyshukkkzub).
      "@/integrations/supabase/client": path.resolve(
        __dirname,
        "src/integrations/supabase/external-client.ts",
      ),
    },
  },
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
