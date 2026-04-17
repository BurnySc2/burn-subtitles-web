import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
    server: { allowedHosts: ["preview1.burnysc2.xyz"] },
    optimizeDeps: {
        exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
    },
    plugins: [tailwindcss(), sveltekit()],
    test: {
        expect: { requireAssertions: true },
        browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium", headless: true }],
        },
        include: ["src/**/*.{test,spec}.{js,ts}"],
        exclude: ["src/lib/server/**"],
    },
})
