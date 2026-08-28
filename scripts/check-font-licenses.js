import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fonts_dir = path.resolve(__dirname, "..", "static", "fonts")

// ANSI colors — disabled if NO_COLOR set or not a TTY
const use_color = !process.env.NO_COLOR && process.stdout.isTTY
const c = {
    red: use_color ? "\x1b[31m" : "",
    green: use_color ? "\x1b[32m" : "",
    yellow: use_color ? "\x1b[33m" : "",
    cyan: use_color ? "\x1b[36m" : "",
    bold: use_color ? "\x1b[1m" : "",
    reset: use_color ? "\x1b[0m" : "",
}

const ALLOWED_TTF = [
    "Cairo.ttf",
    "Lateef.ttf",
    "MaruBuri.ttf",
    "NotoKufiArabic.ttf",
    "NotoSans.ttf",
    "NotoSansArabic.ttf",
    "NotoSansJP.ttf",
    "NotoSansKR.ttf",
    "NotoSansThai.ttf",
    "NotoSansTC.ttf",
    "OpenSans.ttf",
    "Roboto.ttf",
    "Rubik.ttf",
    "Tajawal.ttf",
    "VazirmatnRegular.ttf",
    "VazirmatnBold.ttf",
]

const ALLOWED_ANCILLARY = ["OFL.txt", "APACHE-2.0.txt", "FONT_LICENSES.md", "README.md"]
const IGNORED = [".DS_Store"]
const PROPRIETARY_KEYWORDS = ["arial", "candara", "tahoma"]

const OFL_REQUIRED = "Version 1.1 - 26 February 2007"
const APACHE_REQUIRED = "Version 2.0, January 2004"
const FONT_LICENSES_REQUIRED_STRINGS = ["OFL-1.1", "Apache-2.0", "Copyright"]

const errors = []

function fail(msg) {
    errors.push(msg)
}

// 1. Check static/fonts exists
if (!fs.existsSync(fonts_dir)) {
    console.error(
        `${c.red}${c.bold}ERROR:${c.reset}${c.red} static/fonts directory not found at ${fonts_dir}${c.reset}`,
    )
    process.exit(1)
}

let stat
try {
    stat = fs.statSync(fonts_dir)
    if (!stat.isDirectory()) {
        console.error(
            `${c.red}${c.bold}ERROR:${c.reset}${c.red} static/fonts exists but is not a directory: ${fonts_dir}${c.reset}`,
        )
        process.exit(1)
    }
} catch (e) {
    console.error(`${c.red}${c.bold}ERROR:${c.reset}${c.red} cannot stat static/fonts: ${e.message}${c.reset}`)
    process.exit(1)
}

let files = []
try {
    files = fs.readdirSync(fonts_dir)
} catch (e) {
    console.error(`${c.red}${c.bold}ERROR:${c.reset}${c.red} cannot read static/fonts: ${e.message}${c.reset}`)
    process.exit(1)
}

// Filter out ignored for display but keep for checks where needed
const file_set = new Set(files)
const allowed_set = new Set(ALLOWED_TTF)
const ancillary_set = new Set(ALLOWED_ANCILLARY)

// 2. Check all 16 allowlisted TTFs present
let present_count = 0
for (const ttf of ALLOWED_TTF) {
    if (!file_set.has(ttf)) {
        fail(`ERROR: Missing allowlisted font '${ttf}' — expected in static/fonts.`)
    } else {
        present_count++
    }
}

// 3. Check for unknown .ttf files and proprietary names
for (const file of files) {
    if (IGNORED.includes(file)) {
        continue
    }

    const lower = file.toLowerCase()

    // Proprietary check (case-insensitive)
    for (const keyword of PROPRIETARY_KEYWORDS) {
        if (lower.includes(keyword)) {
            fail(
                `ERROR: Proprietary font '${file}' detected (matches '${keyword}') — proprietary fonts (Arial/Candara/Tahoma) are not allowed. Remove it.`,
            )
            // don't double-report as unknown if it's also proprietary, but still flag unknown if ttf
            break
        }
    }

    const is_ttf = lower.endsWith(".ttf")
    const is_allowed_ttf = allowed_set.has(file)
    const is_allowed_ancillary = ancillary_set.has(file)

    if (is_ttf && !is_allowed_ttf) {
        fail(`ERROR: Unknown font '${file}' — not in allowlist. Add to FONT_LICENSES.md or remove.`)
    } else if (!is_ttf && !is_allowed_ttf && !is_allowed_ancillary) {
        // Non-TTF unknown file (not in allowlist and not ignored)
        // Spec says allow only those 4 ancillary files + .DS_Store; anything else is unexpected
        // But to avoid false positives on hidden files, only flag if it looks like a font or license
        // For strictness, flag any unexpected file that isn't ignored
        // However, we only error if it's not ignored — to keep check useful
        // Comment: this catches stray files like Bad.otf, LICENSE.txt, etc.
        fail(
            `ERROR: Unknown file '${file}' — not in allowlist. Allowed files are: ${[...ALLOWED_TTF, ...ALLOWED_ANCILLARY].join(", ")} plus .DS_Store. Remove or add to allowlist if licensed.`,
        )
    }
}

// 4. Check OFL.txt
const ofl_path = path.join(fonts_dir, "OFL.txt")
if (!file_set.has("OFL.txt")) {
    fail(`ERROR: Missing 'OFL.txt' — expected in static/fonts (should contain "${OFL_REQUIRED}").`)
} else {
    try {
        const content = fs.readFileSync(ofl_path, "utf8")
        if (!content.includes(OFL_REQUIRED)) {
            fail(
                `ERROR: OFL.txt does not contain required string "${OFL_REQUIRED}" — ensure it is the verbatim SIL OFL 1.1 text.`,
            )
        }
    } catch (e) {
        fail(`ERROR: Cannot read OFL.txt: ${e.message}`)
    }
}

// 5. Check APACHE-2.0.txt
const apache_path = path.join(fonts_dir, "APACHE-2.0.txt")
if (!file_set.has("APACHE-2.0.txt")) {
    fail(`ERROR: Missing 'APACHE-2.0.txt' — expected in static/fonts (should contain "${APACHE_REQUIRED}").`)
} else {
    try {
        const content = fs.readFileSync(apache_path, "utf8")
        if (!content.includes(APACHE_REQUIRED)) {
            fail(
                `ERROR: APACHE-2.0.txt does not contain required string "${APACHE_REQUIRED}" — ensure it is the verbatim Apache 2.0 text.`,
            )
        }
    } catch (e) {
        fail(`ERROR: Cannot read APACHE-2.0.txt: ${e.message}`)
    }
}

// 6. Check FONT_LICENSES.md
const licenses_path = path.join(fonts_dir, "FONT_LICENSES.md")
if (!file_set.has("FONT_LICENSES.md")) {
    fail(`ERROR: Missing 'FONT_LICENSES.md' — expected in static/fonts.`)
} else {
    try {
        const content = fs.readFileSync(licenses_path, "utf8")
        for (const ttf of ALLOWED_TTF) {
            if (!content.includes(ttf)) {
                fail(
                    `ERROR: FONT_LICENSES.md does not contain required filename '${ttf}' — ensure all 16 fonts are documented.`,
                )
            }
        }
        for (const str of FONT_LICENSES_REQUIRED_STRINGS) {
            if (!content.includes(str)) {
                fail(
                    `ERROR: FONT_LICENSES.md does not contain required string "${str}" — ensure license summary is present.`,
                )
            }
        }
    } catch (e) {
        fail(`ERROR: Cannot read FONT_LICENSES.md: ${e.message}`)
    }
}

// 7. Report
if (errors.length > 0) {
    console.error(`\n${c.red}${c.bold}Font license check failed with ${errors.length} error(s):${c.reset}`)
    for (const e of errors) {
        // Ensure each error starts with ERROR: for CI parsing; add color if not already colored
        if (e.startsWith("ERROR:")) {
            console.error(`${c.red}${e}${c.reset}`)
        } else {
            console.error(`${c.red}ERROR: ${e}${c.reset}`)
        }
    }
    console.error(`\n${c.yellow}Checked directory: ${fonts_dir}${c.reset}`)
    console.error(`${c.yellow}Found files: ${files.join(", ")}${c.reset}`)
    process.exit(1)
}

// Success — clear message listing counts
const ttf_on_disk = files.filter((f) => f.toLowerCase().endsWith(".ttf")).length
const ancillary_present = ALLOWED_ANCILLARY.filter((f) => file_set.has(f)).length

console.log(`\n${c.green}${c.bold}✔ Font license check passed${c.reset}`)
console.log(
    `${c.green}  • TTF files: ${present_count}/${ALLOWED_TTF.length} allowlisted fonts present (${ttf_on_disk} .ttf on disk)${c.reset}`,
)
console.log(`${c.green}  • No unknown .ttf files, no proprietary fonts (Arial/Candara/Tahoma)${c.reset}`)
console.log(
    `${c.green}  • License texts: OFL.txt (${OFL_REQUIRED}) and APACHE-2.0.txt (${APACHE_REQUIRED}) verified${c.reset}`,
)
console.log(
    `${c.green}  • FONT_LICENSES.md: contains all 16 filenames + strings ${FONT_LICENSES_REQUIRED_STRINGS.map((s) => `"${s}"`).join(", ")}${c.reset}`,
)
console.log(
    `${c.green}  • Ancillary: ${ancillary_present} of ${ALLOWED_ANCILLARY.length} optional files present (${ALLOWED_ANCILLARY.join(", ")}) + .DS_Store ignored${c.reset}`,
)
console.log(`${c.cyan}  • Directory: ${fonts_dir}${c.reset}\n`)

process.exit(0)
