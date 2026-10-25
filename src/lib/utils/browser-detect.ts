type navigator_probe = {
    userAgentData?: { brands?: Array<{ brand: string }> } | undefined
    userAgent?: string | undefined
}

export function is_chromium(navigator_override?: navigator_probe): boolean {
    let source: navigator_probe | undefined
    if (navigator_override !== undefined) {
        source = navigator_override
    } else {
        if (typeof navigator === "undefined") {
            return true
        }
        source = navigator as unknown as navigator_probe
    }
    const brands = source.userAgentData?.brands
    if (Array.isArray(brands) && brands.some((entry) => entry.brand.toLowerCase().includes("chromium"))) {
        return true
    }
    const ua = source.userAgent ?? ""
    return /Chrome|Chromium|Edg|OPR|Brave/i.test(ua) && !/Firefox|FxiOS/i.test(ua)
}
