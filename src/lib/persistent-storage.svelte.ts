import * as z from "zod"
import { browser } from "$app/environment"

// Zod
const VerticalAnchor = z.union([z.literal("top"), z.literal("center"), z.literal("bottom")])

const default_subtitle_settings = {
    font: {
        index: 0,
        size: 24,
        right_to_left: false,
    },
    text: { color: "#ffff7f", stroke: "#000000", outline_size: 1 },
    shadow: { size: 0 },
    position: { horizontal_margin: 30, vertical_anchor: "top", vertical: 0 },
} as const
const SubtitleSettings = z
    .object({
        font: z.object({
            index: z.number(),
            size: z.number().min(1).max(1000).catch(24),
            right_to_left: z.boolean(),
        }),
        text: z.object({
            color: z.string(), // TODO Use hex validation instead
            stroke: z.string(), // TODO Use hex validation instead
            outline_size: z.number().min(0).max(10),
        }),
        shadow: z.object({
            size: z.number().min(0).max(10),
        }),
        position: z.object({
            horizontal_margin: z.number().min(0).max(2000),
            vertical_anchor: VerticalAnchor,
            vertical: z.number().min(0).max(2000),
        }),
    })
    .catch(default_subtitle_settings)
const PermaState = z.object({
    loading: z.object({
        subtitle_settings: true,
    }),
    subtitle_settings: SubtitleSettings,
})

// Types
export type TSubtitleSettings = z.infer<typeof SubtitleSettings>
export type TPermaState = z.infer<typeof PermaState>

export const perma_state = $state<TPermaState>({
    loading: {
        subtitle_settings: true,
    },
    subtitle_settings: default_subtitle_settings,
})

$effect.root(() => {
    // Global settings
    $effect(() => {
        // Save data
        if (browser && !perma_state.loading.subtitle_settings) {
            localStorage.setItem("subtitle_settings", JSON.stringify(perma_state.subtitle_settings))
        }
        // Load data
        if (browser && perma_state.loading.subtitle_settings) {
            perma_state.loading.subtitle_settings = false
            const data = localStorage.getItem("subtitle_settings")
            if (data !== null) {
                perma_state.subtitle_settings = {
                    // Set default
                    ...perma_state,
                    // Load using zod instead
                    ...SubtitleSettings.parse(JSON.parse(data)),
                }
            }
        }
        $state.snapshot(perma_state.subtitle_settings)
    })
})
