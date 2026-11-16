import { describe, expect, it } from "vitest"
import { get_effective_font_family } from "$lib/utils/custom-font"
import { generate_ass_file } from "$lib/utils/subtitle-processing"

describe("generate_ass_file", () => {
    it("emits the default PlayResX/PlayResY (1920x1080) when no play_res is given", () => {
        const ass = generate_ass_file(undefined, undefined, "Arial")
        expect(ass).toContain("PlayResX: 1920")
        expect(ass).toContain("PlayResY: 1080")
    })

    it("emits the provided play_res for PlayResX/PlayResY", () => {
        const ass = generate_ass_file(undefined, { x: 1280, y: 720 }, "Arial")
        expect(ass).toContain("PlayResX: 1280")
        expect(ass).toContain("PlayResY: 720")
    })

    it("emits the PlayRes lines inside the [Script Info] section (before [V4+ Styles])", () => {
        const ass = generate_ass_file(undefined, undefined, "Arial")
        const script_info_end = ass.indexOf("[V4+ Styles]")
        expect(script_info_end).toBeGreaterThan(-1)
        expect(ass.slice(0, script_info_end)).toContain("PlayResX: 1920")
        expect(ass.slice(0, script_info_end)).toContain("PlayResY: 1080")
    })

    it("keeps the rest of the header structure intact", () => {
        const ass = generate_ass_file(undefined, undefined, "Arial")
        expect(ass).toContain("ScriptType: v4.00+")
        expect(ass).toContain("ScaledBorderAndShadow: yes")
        expect(ass).toContain("[V4+ Styles]")
        expect(ass).toContain("[Events]")
    })

    it("emits dialogue lines for a minimal SRT", () => {
        const srt = "1\n00:00:01,000 --> 00:00:02,000\nHello, world!"
        const ass = generate_ass_file(srt, undefined, "Arial")
        // Dialogue line keeps the subtitle text (whitespace-collapsed) and ASS-formatted timestamps.
        expect(ass).toContain("Hello, world!")
        expect(ass).toContain("Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello, world!")
    })

    it("emits the custom font family in the Default style", () => {
        const srt = "1\n00:00:01,000 --> 00:00:02,000\nHello, world!"
        const ass = generate_ass_file(srt, undefined, "MyCustomFamily")
        expect(ass).toContain("Style: Default,MyCustomFamily,")
    })

    it("emits the builtin font family for the null custom-font path", () => {
        const builtin = get_effective_font_family(0, null)
        const ass = generate_ass_file(undefined, undefined, builtin)
        expect(ass).toContain(`Style: Default,${builtin},`)
    })
})
