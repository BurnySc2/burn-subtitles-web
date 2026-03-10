import * as z from "zod"

// Zod
const TempState = z.object({
    extract_srt: z.object({
        file: z.custom<File | null>(),
        ods_data: z.union([z.array(z.array(z.array(z.string()))), z.null()]),
        selected_sheet: z.number(),
        selected_column: z.number(),
        selected_start_row: z.number(),
        selected_end_row: z.number(),
    }),
})

// Types
export type TTempState = z.infer<typeof TempState>

export const temp_state: TTempState = $state({
    extract_srt: {
        file: null,
        ods_data: null,
        selected_sheet: 0,
        selected_column: 0,
        selected_start_row: 0,
        selected_end_row: 999,
    },
})
