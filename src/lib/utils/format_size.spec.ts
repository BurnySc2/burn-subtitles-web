import { describe, expect, it } from "vitest"
import { format_dual_size } from "./format_size"

describe("format_dual_size", () => {
    it("shows MiB and MB side by side", () => {
        expect(format_dual_size(1_048_576, 1)).toBe("1.0 MiB · 1.0 MB")
    })

    it("respects the decimals argument", () => {
        expect(format_dual_size(1_500_000, 1)).toBe("1.4 MiB · 1.5 MB")
        expect(format_dual_size(1_500_000, 2)).toBe("1.43 MiB · 1.50 MB")
    })

    it("formats zero bytes", () => {
        expect(format_dual_size(0, 1)).toBe("0.0 MiB · 0.0 MB")
    })
})
