import { describe, expect, it, vi } from "vitest"
import { render } from "vitest-browser-svelte"
import ViewerFilePicker from "./ViewerFilePicker.svelte"

function set_input_files(input: HTMLInputElement, files: File[]): void {
    const transfer = new DataTransfer()
    for (const file of files) {
        transfer.items.add(file)
    }
    Object.defineProperty(input, "files", { value: transfer.files, configurable: true })
}

function drop_files(target: Element, files: File[]): void {
    const transfer = new DataTransfer()
    for (const file of files) {
        transfer.items.add(file)
    }
    const event = new Event("drop", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "dataTransfer", { value: transfer })
    target.dispatchEvent(event)
}

function drag_over(target: Element): void {
    const event = new Event("dragover", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "dataTransfer", { value: new DataTransfer() })
    target.dispatchEvent(event)
}

function status_text(screen: { container: HTMLElement }): string {
    return screen.container.querySelector("#viewer-file-status")?.textContent ?? ""
}

describe("ViewerFilePicker", () => {
    it("calls on_file and shows Accepted status when a valid video is picked", async () => {
        const on_file = vi.fn()
        const screen = await render(ViewerFilePicker, { on_file })
        const input = screen.container.querySelector('input[type="file"]') as HTMLInputElement
        set_input_files(input, [new File(["x"], "clip.mp4", { type: "video/mp4" })])
        input.dispatchEvent(new Event("change", { bubbles: true }))
        await vi.waitFor(() => expect(on_file).toHaveBeenCalledTimes(1))
        expect(on_file.mock.calls[0]?.[0]).toBeInstanceOf(File)
        expect(status_text(screen)).toMatch(/Accepted: clip\.mp4/)
        await screen.unmount()
    })

    it("calls on_file via DataTransfer drop for an audio file", async () => {
        const on_file = vi.fn()
        const screen = await render(ViewerFilePicker, { on_file })
        const zone = screen.container.querySelector(".drop-zone") as HTMLElement
        drop_files(zone, [new File(["x"], "sound.mp3", { type: "audio/mpeg" })])
        await vi.waitFor(() => expect(on_file).toHaveBeenCalledTimes(1))
        expect(status_text(screen)).toMatch(/Accepted: sound\.mp3/)
        await screen.unmount()
    })

    it("shows Rejected and skips on_file for a .txt drop", async () => {
        const on_file = vi.fn()
        const screen = await render(ViewerFilePicker, { on_file })
        const zone = screen.container.querySelector(".drop-zone") as HTMLElement
        drop_files(zone, [new File(["x"], "notes.txt", { type: "text/plain" })])
        await vi.waitFor(() => expect(status_text(screen)).toMatch(/Rejected: notes\.txt/))
        expect(on_file).not.toHaveBeenCalled()
        await screen.unmount()
    })

    it("shows Replace and Remove after accept, and Remove clears and calls on_remove", async () => {
        const on_file = vi.fn()
        const on_remove = vi.fn()
        const screen = await render(ViewerFilePicker, { on_file, on_remove })
        const zone = screen.container.querySelector(".drop-zone") as HTMLElement
        drop_files(zone, [new File(["x"], "clip.mp4", { type: "video/mp4" })])
        await vi.waitFor(() => expect(on_file).toHaveBeenCalledTimes(1))
        const buttons = [...screen.container.querySelectorAll("button")]
        expect(buttons.map((button) => button.textContent?.trim())).toEqual(["Replace file", "Remove"])
        ;(screen.container.querySelector("button:last-of-type") as HTMLButtonElement).click()
        await vi.waitFor(() => expect(status_text(screen)).toMatch(/No file chosen/))
        expect(on_remove).toHaveBeenCalledTimes(1)
        await screen.unmount()
    })

    it("blocks dragover and drop when disabled", async () => {
        const on_file = vi.fn()
        const screen = await render(ViewerFilePicker, { on_file, disabled: true })
        const zone = screen.container.querySelector(".drop-zone") as HTMLElement
        drag_over(zone)
        expect(zone.classList.contains("drag-over")).toBe(false)
        drop_files(zone, [new File(["x"], "clip.mp4", { type: "video/mp4" })])
        expect(on_file).not.toHaveBeenCalled()
        expect(status_text(screen)).toMatch(/No file chosen/)
        const buttons = screen.container.querySelectorAll("button")
        for (const button of buttons) {
            expect((button as HTMLButtonElement).disabled).toBe(true)
        }
        await screen.unmount()
    })
})
