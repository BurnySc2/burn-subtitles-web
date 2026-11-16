export type OdsGrid = string[][][]

export class OdsParseError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "OdsParseError"
    }
}

function base_name(el: Element): string {
    const local = el.localName ?? ""
    const idx = local.lastIndexOf(":")
    return idx >= 0 ? local.slice(idx + 1) : local
}

function table_int_attr(el: Element, local: string, fallback: number): number {
    const raw = el.getAttribute(`table:${local}`) ?? el.getAttribute(local)
    if (raw === null) {
        return fallback
    }
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback
    }
    return Math.floor(parsed)
}

function space_count(el: Element): number {
    const raw = el.getAttribute("text:c") ?? el.getAttribute("c")
    if (raw === null) {
        return 1
    }
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 1
    }
    return Math.min(Math.floor(parsed), MAX_SPACES)
}

function node_to_text(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue ?? ""
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return ""
    }
    const el = node as Element
    if (base_name(el) === "s") {
        return " ".repeat(space_count(el))
    }
    if (base_name(el) === "tab") {
        return "\t"
    }
    if (base_name(el) === "line-break") {
        return "\n"
    }
    let out = ""
    for (const child of Array.from(el.childNodes)) {
        out += node_to_text(child)
    }
    return out
}

function paragraph_to_text(paragraph: Element): string {
    let out = ""
    for (const child of Array.from(paragraph.childNodes)) {
        out += node_to_text(child)
    }
    return out
}

export function cell_to_text(cell: Element): string {
    const paragraphs = Array.from(cell.children).filter((child) => base_name(child) === "p")
    if (paragraphs.length === 0) {
        return cell.textContent ?? ""
    }
    return paragraphs.map((paragraph) => paragraph_to_text(paragraph)).join("\n")
}

const MAX_ROW_REPEAT = 10000
const MAX_COL_REPEAT = 10000
const MAX_SPACES = 1024

export function expand_sheet_rows(row_nodes: Element[]): string[][] {
    const rows: string[][] = []
    for (const row of row_nodes) {
        const cells: string[] = []
        for (const child of Array.from(row.children)) {
            if (base_name(child) === "table-cell") {
                const text = cell_to_text(child)
                const repeat = Math.min(table_int_attr(child, "number-columns-repeated", 1), MAX_COL_REPEAT)
                const span = table_int_attr(child, "number-columns-spanned", 1)
                const block = [text]
                for (let i = 1; i < span; i += 1) {
                    block.push("")
                }
                for (let i = 0; i < repeat; i += 1) {
                    cells.push(...block)
                }
            } else if (base_name(child) === "covered-table-cell") {
                const repeat = Math.min(table_int_attr(child, "number-columns-repeated", 1), MAX_COL_REPEAT)
                for (let i = 0; i < repeat; i += 1) {
                    cells.push("")
                }
            }
        }
        const row_repeat = Math.min(table_int_attr(row, "number-rows-repeated", 1), MAX_ROW_REPEAT)
        for (let i = 0; i < row_repeat; i += 1) {
            rows.push([...cells])
        }
    }
    return rows
}

export function slice_ods_column(
    grid: OdsGrid,
    sheet_1b: number,
    col_1b: number,
    start_row_1b: number,
    end_row_1b: number,
): string[] {
    if (start_row_1b > end_row_1b) {
        return []
    }
    const sheet = grid[sheet_1b - 1]
    if (!sheet) {
        return []
    }
    const col = col_1b - 1
    if (col < 0) {
        return []
    }
    const start = Math.max(0, start_row_1b - 1)
    const end = Math.min(sheet.length - 1, end_row_1b - 1)
    if (start > end) {
        return []
    }
    const out: string[] = []
    for (let i = start; i <= end; i += 1) {
        out.push(sheet[i][col] ?? "")
    }
    return out
}

function is_nested_table(table: Element): boolean {
    let parent = table.parentElement
    while (parent) {
        if (base_name(parent) === "table") {
            return true
        }
        parent = parent.parentElement
    }
    return false
}

export function parse_ods_content_xml(xml: string): OdsGrid {
    const parser = new DOMParser()
    let doc: Document
    try {
        doc = parser.parseFromString(xml, "text/xml")
    } catch {
        throw new OdsParseError("Invalid ODS content.xml: XML parse error")
    }
    if (doc.getElementsByTagName("parsererror").length > 0) {
        throw new OdsParseError("Invalid ODS content.xml: XML parse error")
    }
    const tables = Array.from(doc.getElementsByTagName("table:table")).filter((table) => !is_nested_table(table))
    return tables.map((table) => {
        const row_nodes = Array.from(table.children).filter((child) => base_name(child) === "table-row")
        return expand_sheet_rows(row_nodes)
    })
}
