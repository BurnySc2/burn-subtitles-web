import { describe, expect, it } from "vitest"
import { type OdsGrid, parse_ods_content_xml, slice_ods_column } from "./ods-parse"

const NS =
    'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
    'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"'

function wrap_sheet(inner: string): string {
    return (
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<office:document-content ${NS}><office:body><office:spreadsheet>${inner}` +
        `</office:spreadsheet></office:body></office:document-content>`
    )
}

describe("parse_ods_content_xml cue block", () => {
    it("joins multi-text:p with newline and recovers spaces, tabs, line breaks", () => {
        const xml_cue = wrap_sheet(
            `<table:table table:name="Sheet1"><table:table-row>` +
                `<table:table-cell><text:p>A</text:p></table:table-cell>` +
                `<table:table-cell><text:p>B</text:p></table:table-cell>` +
                `<table:table-cell><text:p>1</text:p>` +
                `<text:p>00:00:00,280 --&gt; 00:00:03,240</text:p>` +
                `<text:p>In that<text:s text:c="2"/>moment<text:tab/>here` +
                `<text:line-break/>there</text:p></table:table-cell>` +
                `</table:table-row></table:table>`,
        )
        const grid = parse_ods_content_xml(xml_cue)
        expect(grid[0][0][2]).toBe("1\n00:00:00,280 --> 00:00:03,240\nIn that  moment\there\nthere")
    })
})

describe("parse_ods_content_xml column shift", () => {
    it("resolves repeats, covered plus spanned, missing cells, row repeat, nested exclusion", () => {
        const xml_shift = wrap_sheet(
            `<table:table table:name="Sheet1">` +
                `<table:table-row><table:table-cell table:number-columns-repeated="2">` +
                `<text:p>R</text:p></table:table-cell>` +
                `<table:table-cell><text:p>C0</text:p></table:table-cell></table:table-row>` +
                `<table:table-row><table:table-cell table:number-columns-spanned="2">` +
                `<text:p>M</text:p></table:table-cell><table:covered-table-cell/>` +
                `<table:table-cell><text:p>D1</text:p></table:table-cell></table:table-row>` +
                `<table:table-row><table:table-cell><text:p>only-a</text:p>` +
                `</table:table-cell></table:table-row>` +
                `<table:table-row table:number-rows-repeated="3"><table:table-cell>` +
                `<text:p>rep</text:p></table:table-cell></table:table-row>` +
                `<table:table-row><table:table-cell><text:p>outer</text:p>` +
                `<table:table table:name="Nested"><table:table-row><table:table-cell>` +
                `<text:p>inner</text:p></table:table-cell></table:table-row></table:table>` +
                `</table:table-cell></table:table-row>` +
                `</table:table>`,
        )
        const grid = parse_ods_content_xml(xml_shift)
        expect(grid.length).toBe(1)
        expect(grid[0].length).toBe(7)
        expect(grid[0][0]).toEqual(["R", "R", "C0"])
        expect(grid[0][1]).toEqual(["M", "", "", "D1"])
        expect(grid[0][1][2]).toBe("")
        expect(slice_ods_column(grid, 1, 3, 3, 3)).toEqual([""])
        expect(grid[0].slice(3, 6)).toEqual([["rep"], ["rep"], ["rep"]])
        expect(grid[0][6][0]).toBe("outer")
    })
})

describe("slice_ods_column", () => {
    it("uses 1-based indexing with empty on inversion, missing, and clamp", () => {
        const sheet: string[][] = Array.from({ length: 60 }, (_, idx) => ["a", "b", `row-${idx + 1}`])
        sheet[9] = ["short"]
        const grid: OdsGrid = [sheet]
        expect(slice_ods_column(grid, 1, 3, 50, 56)).toEqual([
            "row-50",
            "row-51",
            "row-52",
            "row-53",
            "row-54",
            "row-55",
            "row-56",
        ])
        expect(slice_ods_column(grid, 1, 3, 56, 50)).toEqual([])
        expect(slice_ods_column(grid, 1, 3, 10, 10)).toEqual([""])
        expect(slice_ods_column(grid, 1, 3, 59, 200)).toEqual(["row-59", "row-60"])
        expect(slice_ods_column(grid, 9, 3, 50, 56)).toEqual([])
        expect(slice_ods_column(grid, 1, 3, 100, 200)).toEqual([])
    })
})
