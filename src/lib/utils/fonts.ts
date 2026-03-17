type FontOption = {
    font_family: string
    select_name: string
    url: string
    filename: string
    font_weight?: "normal" | "bold"
}

export const available_fonts: FontOption[] = [
    // Needs to be in sync with +layout.svelte font-face
    // Always download the Font-Regular version
    // https://fonts.google.com
    {
        font_family: "Arial",
        select_name: "Arial",
        url: "/fonts/Arial.ttf",
        filename: "Arial.ttf",
    },
    {
        font_family: "Cairo",
        select_name: "Cairo",
        url: "/fonts/Cairo.ttf",
        filename: "Cairo.ttf",
    },
    {
        font_family: "Candara",
        select_name: "Candara",
        url: "/fonts/Candara.ttf",
        filename: "Candara.ttf",
    },
    {
        font_family: "Lateef",
        select_name: "Lateef",
        url: "/fonts/Lateef.ttf",
        filename: "Lateef.ttf",
    },
    {
        font_family: "MaruBuri",
        select_name: "MaruBuri",
        url: "/fonts/MaruBuri.ttf",
        filename: "MaruBuri.ttf",
    },
    {
        font_family: "Noto Kufi Arabic",
        select_name: "Noto Kufi Arabic",
        url: "/fonts/NotoKufiArabic.ttf",
        filename: "NotoKufiArabic.ttf",
    },
    {
        font_family: "Noto Sans",
        select_name: "Noto Sans",
        url: "/fonts/NotoSans.ttf",
        filename: "NotoSans.ttf",
    },
    {
        font_family: "Noto Sans Arabic",
        select_name: "Noto Sans Arabic",
        url: "/fonts/NotoSansArabic.ttf",
        filename: "NotoSansArabic.ttf",
    },
    {
        font_family: "Noto Sans Japanese",
        select_name: "Noto Sans Japanese",
        url: "/fonts/NotoSansJP.ttf",
        filename: "NotoSansJP.ttf",
    },
    {
        font_family: "Noto Sans Korean",
        select_name: "Noto Sans Korean",
        url: "/fonts/NotoSansKR.ttf",
        filename: "NotoSansKR.ttf",
    },
    {
        font_family: "Noto Sans Thai",
        select_name: "Noto Sans Thai",
        url: "/fonts/NotoSansThai.ttf",
        filename: "NotoSansThai.ttf",
    },
    {
        font_family: "Noto Sans Traditional Chinese",
        select_name: "Noto Sans Traditional Chinese",
        url: "/fonts/NotoSansTC.ttf",
        filename: "NotoSansTC.ttf",
    },
    {
        font_family: "OpenSans",
        select_name: "OpenSans",
        url: "/fonts/OpenSans.ttf",
        filename: "OpenSans.ttf",
    },
    {
        font_family: "Roboto",
        select_name: "Roboto",
        url: "/fonts/Roboto.ttf",
        filename: "Roboto.ttf",
    },
    {
        font_family: "Rubik",
        select_name: "Rubik",
        url: "/fonts/Rubik.ttf",
        filename: "Rubik.ttf",
    },
    // Copyright issues? https://font.download/font/tahoma
    {
        font_family: "Tahoma",
        select_name: "Tahoma",
        url: "/fonts/Tahoma.ttf",
        filename: "Tahoma.ttf",
    },
    {
        font_family: "Tajawal",
        select_name: "Tajawal",
        url: "/fonts/Tajawal.ttf",
        filename: "Tajawal.ttf",
    },
    {
        font_family: "Vazirmatn",
        select_name: "VazirmatnRegular",
        url: "/fonts/VazirmatnRegular.ttf",
        filename: "VazirmatnRegular.ttf",
    },
    {
        font_family: "Vazirmatn",
        select_name: "VazirmatnBold",
        url: "/fonts/VazirmatnBold.ttf",
        filename: "VazirmatnBold.ttf",
        font_weight: "bold",
    },
]
