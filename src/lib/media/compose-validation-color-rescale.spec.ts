import { describe, expect, it } from "vitest"
import type { ComposeEdge, ComposeNode } from "./compose-types"
import { validate_compose } from "./compose-validation"

function color(id: string, color_value = "#112233", duration = 5): ComposeNode {
    return { id, type: "color", position: { x: 0, y: 0 }, data: { color: color_value, duration } }
}

function rescale(
    id: string,
    width = 1280,
    height = 720,
    fps: number | null = null,
    fit = "contain" as const,
): ComposeNode {
    return { id, type: "rescale", position: { x: 0, y: 0 }, data: { width, height, fps, fit } }
}

function trim(id: string, start = 0, end = 5): ComposeNode {
    return { id, type: "trim", position: { x: 0, y: 0 }, data: { start, end } }
}

function output(id = "out"): ComposeNode {
    return {
        id,
        type: "output",
        position: { x: 0, y: 0 },
        data: { file_name: null, width: 1280, height: 720, fps: 30, quality: "medium" },
    }
}

function edge(id: string, from: string, to: string): ComposeEdge {
    return { id, source: from, sourceHandle: null, target: to, targetHandle: null }
}

function fields(nodes: ComposeNode[], edges: ComposeEdge[]): string[] {
    return validate_compose(nodes, edges).map((issue) => `${issue.node_id}:${issue.field}`)
}

describe("validate_compose color and rescale", () => {
    it("test_color_hex_and_duration_contract", () => {
        for (const bad_color of ["red", "#FFF", "#GGGGGG", "", "112233"]) {
            const issues = fields([color("c", bad_color, 5), output()], [edge("e1", "c", "out")])
            expect(issues).toContain("c:color")
        }
        for (const bad_duration of [0, -1, 3601, Number.NaN, Number.POSITIVE_INFINITY]) {
            const issues = fields([color("c", "#112233", bad_duration), output()], [edge("e1", "c", "out")])
            expect(issues).toContain("c:duration")
        }
        expect(validate_compose([color("c", "#aAbBcC", 5), output()], [edge("e1", "c", "out")])).toEqual([])
        expect(validate_compose([color("c", "#000000", 3600), output()], [edge("e1", "c", "out")])).toEqual([])
    })

    it("test_rescale_dims_fps_fit_contract", () => {
        const bad_dims: Array<[number, number, string]> = [
            [1279, 720, "r:width"],
            [1280, 721, "r:height"],
            [0, 720, "r:width"],
            [1280, 7682, "r:height"],
        ]
        for (const [width, height, want] of bad_dims) {
            const issues = fields(
                [color("c"), rescale("r", width, height), output()],
                [edge("e1", "c", "r"), edge("e2", "r", "out")],
            )
            expect(issues).toContain(want)
        }
        for (const bad_fps of [0, 121]) {
            const issues = fields(
                [color("c"), rescale("r", 1280, 720, bad_fps), output()],
                [edge("e1", "c", "r"), edge("e2", "r", "out")],
            )
            expect(issues).toContain("r:fps")
        }
        const bad_fit = rescale("r", 1280, 720, null, "cover" as never)
        expect(fields([color("c"), bad_fit, output()], [edge("e1", "c", "r"), edge("e2", "r", "out")])).toContain(
            "r:fit",
        )
        expect(
            validate_compose(
                [color("c"), rescale("r", 1280, 720, null), output()],
                [edge("e1", "c", "r"), edge("e2", "r", "out")],
            ),
        ).toEqual([])
    })

    it("test_arity_and_upstream_duration_through_rescale", () => {
        expect(
            validate_compose([color("a"), color("c"), output()], [edge("e1", "a", "c"), edge("e2", "c", "out")]),
        ).toContainEqual({ node_id: "c", field: "input", message: "Color node must have no inputs" })
        expect(validate_compose([color("c"), rescale("r"), output()], [edge("e1", "r", "out")])).toContainEqual({
            node_id: "r",
            field: "input",
            message: "Rescale node must have exactly 1 input",
        })
        const issues = validate_compose(
            [color("c", "#112233", 5), rescale("r"), trim("t", 0, 10), output()],
            [edge("e1", "c", "r"), edge("e2", "r", "t"), edge("e3", "t", "out")],
        )
        expect(issues.some((issue) => issue.node_id === "t" && issue.field === "end")).toBe(true)
    })
})
