/**
 * Reads the intrinsic pixel dimensions of a video File without decoding it,
 * using a hidden <video> element with `preload="metadata"`.
 *
 * Resolves `null` when the dimensions are unavailable (unsupported or unreadable
 * file, missing/invalid metadata, or a ~10s timeout). Never throws.
 */
export async function get_video_dimensions(file: File): Promise<{ width: number; height: number } | null> {
    const object_url = URL.createObjectURL(file)
    const video = document.createElement("video")
    const abort_controller = new AbortController()
    let timeout_id: ReturnType<typeof setTimeout> | null = null

    try {
        video.preload = "metadata"
        video.src = object_url

        const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
            video.addEventListener(
                "loadedmetadata",
                () => {
                    const width = video.videoWidth
                    const height = video.videoHeight
                    if (width > 0 && height > 0 && !Number.isNaN(width) && !Number.isNaN(height)) {
                        resolve({ width, height })
                    } else {
                        resolve(null)
                    }
                },
                { signal: abort_controller.signal },
            )
            video.addEventListener("error", () => resolve(null), { signal: abort_controller.signal })
            timeout_id = setTimeout(() => resolve(null), 10_000)
        })

        return dimensions
    } catch {
        return null
    } finally {
        // Clean up: remove all event listeners, clear the timeout, detach the
        // element and release the object URL.
        abort_controller.abort()
        if (timeout_id !== null) {
            clearTimeout(timeout_id)
        }
        video.remove()
        URL.revokeObjectURL(object_url)
    }
}
