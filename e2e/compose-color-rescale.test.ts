import { expect, test } from "@playwright/test"

// Render oracle: color (0.5s black) -> rescale (64x36, contain) -> output (64x36 @10fps).
// No FFmpeg on this path: color/rescale/output render via MediaBunny only.
test("renders color through rescale at 64x36 and half a second", async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto("/compose?deterministic=1")
    await expect(page.locator(".svelte-flow")).toBeVisible()

    const graph = {
        version: 1,
        nodes: [
            {
                id: "color-1",
                type: "color",
                position: { x: 0, y: 0 },
                data: { color: "#000000", duration: 0.5, label: null },
            },
            {
                id: "rescale-1",
                type: "rescale",
                position: { x: 200, y: 0 },
                data: { width: 64, height: 36, fps: null, fit: "contain", label: null },
            },
            {
                id: "output-1",
                type: "output",
                position: { x: 400, y: 0 },
                data: {
                    file_name: null,
                    width: 64,
                    height: 36,
                    fps: 10,
                    quality: "medium",
                    audio_quality: "source-max",
                    crf: null,
                    label: null,
                },
            },
        ],
        edges: [
            { id: "e1", source: "color-1", sourceHandle: null, target: "rescale-1", targetHandle: null },
            { id: "e2", source: "rescale-1", sourceHandle: null, target: "output-1", targetHandle: null },
        ],
    }
    await page.locator('input[type="file"][accept*="json"]').setInputFiles({
        name: "composition.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(graph)),
    })
    await expect(page.getByText("✓ Graph valid")).toBeVisible()

    await page.getByRole("button", { name: "Render", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Result" })).toBeVisible({ timeout: 120_000 })
    const result_video = page.locator("h2:has-text('Result') ~ video")
    await expect(result_video).toHaveAttribute("src", /blob:/, { timeout: 120_000 })
    const src = await result_video.getAttribute("src")
    expect(src).toBeTruthy()

    const probed = await page.evaluate(async (video_src: string) => {
        const fetched = await fetch(video_src)
        const blob = await fetched.blob()
        try {
            // WHY variable specifier: keeps TS from resolving a dev-server-only path
            // (vite dev rewrites the bare "mediabunny" import inside the module).
            const specifier = "/src/lib/media/mediabunny-clip.ts"
            const { probe_media } = await import(/* @vite-ignore */ specifier)
            const file = new File([blob], "result.mp4", { type: blob.type || "video/mp4" })
            const probe = await probe_media(file)
            return { duration: probe.duration, width: probe.display_width, height: probe.display_height }
        } catch {
            // Fallback for static preview builds where /src is not served.
            const url = URL.createObjectURL(blob)
            try {
                return await new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
                    const element = document.createElement("video")
                    element.muted = true
                    element.preload = "auto"
                    element.onloadedmetadata = () =>
                        resolve({ duration: element.duration, width: element.videoWidth, height: element.videoHeight })
                    element.onerror = () => reject(new Error("video metadata failed"))
                    element.src = url
                })
            } finally {
                URL.revokeObjectURL(url)
            }
        }
    }, src as string)

    expect(probed.duration).toBeGreaterThan(0.25)
    expect(probed.duration).toBeLessThan(0.75)
    expect(probed.width).toBe(64)
    expect(probed.height).toBe(36)
})
