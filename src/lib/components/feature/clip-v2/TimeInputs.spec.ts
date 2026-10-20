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

    it("disables Now buttons with a hint when capture is unavailable", async () => {
        const screen = await render(TimeInputs, {
            start_str: "00:00:01.000",
            end_str: "00:00:02.000",
            has_source: false,
            on_change: vi.fn(),
        })
        const buttons = screen.container.querySelectorAll("button")
        expect(buttons.length).toBe(2)
        for (const button of buttons) {
            expect((button as HTMLButtonElement).disabled).toBe(true)
            expect(button.getAttribute("title")).toBe("Play the preview first to capture its position.")
        }
    })

    it("calls on_use_current per field when Now is clicked", async () => {
        const on_use_current = vi.fn()
        const screen = await render(TimeInputs, {
            start_str: "00:00:01.000",
            end_str: "00:00:02.000",
            has_source: true,
            on_change: vi.fn(),
            on_use_current,
            can_use_current: true,
        })
        const buttons = screen.container.querySelectorAll("button")
        expect(buttons.length).toBe(2)
        ;(buttons[0] as HTMLButtonElement).click()
        ;(buttons[1] as HTMLButtonElement).click()
        expect(on_use_current).toHaveBeenCalledWith("start")
        expect(on_use_current).toHaveBeenCalledWith("end")
    })

    it("shows the live time in Now button titles", async () => {
        const screen = await render(TimeInputs, {
            start_str: "00:00:01.000",
            end_str: "00:00:02.000",
            has_source: true,
            on_change: vi.fn(),
            on_use_current: vi.fn(),
            current_time_str: "00:00:04.250",
            can_use_current: true,
        })
        const buttons = screen.container.querySelectorAll("button")
        expect(buttons.length).toBe(2)
        expect(buttons[0]?.getAttribute("title")).toContain("00:00:04.250")
        expect(buttons[1]?.getAttribute("title")).toContain("00:00:04.250")
    })

    it("lays out fields in a flex row with a centered range error", async () => {
        const screen = await render(TimeInputs, {
            start_str: "00:00:05.000",
            end_str: "00:00:02.000",
            has_source: true,
            on_change: vi.fn(),
        })
        expect(screen.container.querySelector(".flex-row")).not.toBeNull()
        const range = screen.container.querySelector("p.w-full.text-center")
        expect(range?.textContent).toBe("End time must be greater than start time")
    })
})
