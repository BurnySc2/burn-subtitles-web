<script lang="ts">
import "../app.css"
import favicon from "$lib/assets/favicon.svg"
import Navigation from "$lib/components/Navigation.svelte"

let { children } = $props()
</script>

<svelte:head>
    <link
        rel="icon"
        href={favicon}
    >
    <style>
    /* Needs to be in sync with `subtitle-processing.ts` */
    @font-face {
        font-family: "Arial";
        src: url("/fonts/Arial.ttf") format("truetype");
    }
    @font-face {
        font-family: "Cairo";
        src: url("/fonts/Cairo.ttf") format("truetype");
    }
    @font-face {
        font-family: "Candara";
        src: url("/fonts/Candara.ttf") format("truetype");
    }
    @font-face {
        font-family: "Lateef";
        src: url("/fonts/Lateef.ttf") format("truetype");
    }
    @font-face {
        font-family: "MaruBuri";
        src: url("/fonts/MaruBuri.ttf") format("truetype");
    }
    @font-face {
        font-family: "Noto Kufi Arabic";
        src: url("/fonts/NotoKufiArabic.ttf") format("truetype");
    }
    @font-face {
        font-family: "Noto Sans";
        src: url("/fonts/NotoSans.ttf") format("truetype");
    }
    @font-face {
        font-family: "Noto Sans Arabic";
        src: url("/fonts/NotoSansArabic.ttf") format("truetype");
    }
    @font-face {
        font-family: "Noto Sans Japanese";
        src: url("/fonts/NotoSansJP.ttf") format("truetype");
    }
    @font-face {
        font-family: "Noto Sans Korean";
        src: url("/fonts/NotoSansKR.ttf") format("truetype");
    }
    @font-face {
        font-family: "Noto Sans Thai";
        src: url("/fonts/NotoSansThai.ttf") format("truetype");
    }
    @font-face {
        font-family: "Noto Sans Traditional Chinese";
        src: url("/fonts/NotoSansTC.ttf") format("truetype");
    }
    @font-face {
        font-family: "OpenSans";
        src: url("/fonts/OpenSans.ttf") format("truetype");
    }
    @font-face {
        font-family: "Roboto";
        src: url("/fonts/Roboto.ttf") format("truetype");
    }
    @font-face {
        font-family: "Rubik";
        src: url("/fonts/Rubik.ttf") format("truetype");
    }
    @font-face {
        font-family: "Tahoma";
        src: url("/fonts/Tahoma.ttf") format("truetype");
    }
    @font-face {
        font-family: "Tajawal";
        src: url("/fonts/Tajawal.ttf") format("truetype");
    }
    @font-face {
        font-family: "Vazirmatn";
        src: url("/fonts/VazirmatnBold.ttf") format("truetype");
        font-weight: bold;
    }
    @font-face {
        font-family: "Vazirmatn";
        src: url("/fonts/VazirmatnRegular.ttf") format("truetype");
    }
    </style>
</svelte:head>

<main class="flex flex-col mx-auto">
    <Navigation />
    <!-- Main Content -->
    {@render children?.()}
</main>
