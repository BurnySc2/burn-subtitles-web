import { describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-svelte"
import TimeInputs from "./TimeInputs.svelte"

describe("TimeInputs", () => {
    it("shows no errors when untouched and no source is loaded", async () => {
        const screen = await render(TimeInputs, {
            start_str: "00:00:01.000",
            end_str: "00:00:02.000",
            has_source: false,
            on_change: vi.fn(),
        })
        expect(screen.container.querySelector("p")).toBeNull()
    })

    it("shows a format error for an invalid start time", async () => {
        const screen = await render(TimeInputs, {
            start_str: "garbage",
            end_str: "00:00:02.000",
            has_source: true,
            on_change: vi.fn(),
        })
        await expect.element(screen.getByText(/Invalid timecode/)).toBeVisible()
    })

    it("shows a range error when end is not after start", async () => {
        const screen = await render(TimeInputs, {
            start_str: "00:00:05.000",
            end_str: "00:00:02.000",
            has_source: true,
            on_change: vi.fn(),
        })
        await expect.element(screen.getByText("End time must be greater than start time")).toBeVisible()
    })
})
