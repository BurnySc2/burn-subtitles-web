# Font Licenses

This document covers licensing for fonts shipped in `static/fonts/`.

- **Code** in this repository is licensed under the **MIT License** (see `/LICENSE`).
- **Fonts** are licensed **separately** under their own licenses and are **not** covered by the repository MIT license.
- Of the 16 font files currently shipped, **14 files (13 families) are under SIL Open Font License 1.1 (OFL-1.1)** and **2 files are under Apache License 2.0**.
- Full license texts are vendored alongside the fonts:
  - `static/fonts/OFL.txt` — verbatim SIL Open Font License 1.1 (26 February 2007)
  - `static/fonts/APACHE-2.0.txt` — verbatim Apache License, Version 2.0 (January 2004)

> **Note:** Proprietary Microsoft fonts **Arial, Candara, and Tahoma were purged on 2026-08-28** due to their proprietary Microsoft license and are no longer distributed in this repository. They have been replaced by the OFL/Apache-licensed fonts listed below. See `src/lib/utils/fonts.ts` for the current 16-file manifest.

## Licensed Fonts

| Filename | Family | License | Copyright Holder | Upstream URL | Google Fonts URL |
|---|---|---|---|---|---|
| Cairo.ttf | Cairo | OFL-1.1 | Copyright 2014-2016 The Cairo Project Authors (https://github.com/Gue3bara/Cairo) | https://github.com/Gue3bara/Cairo | https://fonts.google.com/specimen/Cairo |
| Lateef.ttf | Lateef | OFL-1.1 | Copyright 2004-2021 SIL International | https://github.com/silnrsi/font-lateef | https://fonts.google.com/specimen/Lateef |
| MaruBuri.ttf | MaruBuri | OFL-1.1 | Copyright 2020-2022 The MaruBuri Project Authors (https://github.com/naver/maruBuri) | https://github.com/naver/maruBuri | https://fonts.google.com/specimen/Maru+Buri |
| NotoKufiArabic.ttf | Noto Kufi Arabic | OFL-1.1 | Copyright 2015-2023 Google LLC | https://github.com/googlefonts/noto-fonts | https://fonts.google.com/specimen/Noto+Kufi+Arabic |
| NotoSans.ttf | Noto Sans | OFL-1.1 | Copyright 2012-2023 Google LLC | https://github.com/googlefonts/noto-fonts | https://fonts.google.com/specimen/Noto+Sans |
| NotoSansArabic.ttf | Noto Sans Arabic | OFL-1.1 | Copyright 2015-2023 Google LLC | https://github.com/googlefonts/noto-fonts | https://fonts.google.com/specimen/Noto+Sans+Arabic |
| NotoSansJP.ttf | Noto Sans JP | OFL-1.1 | Copyright 2014-2021 Adobe Systems Incorporated and Google Inc. | https://github.com/googlefonts/noto-cjk | https://fonts.google.com/specimen/Noto+Sans+JP |
| NotoSansKR.ttf | Noto Sans KR | OFL-1.1 | Copyright 2014-2021 Adobe Systems Incorporated and Google Inc. | https://github.com/googlefonts/noto-cjk | https://fonts.google.com/specimen/Noto+Sans+KR |
| NotoSansThai.ttf | Noto Sans Thai | OFL-1.1 | Copyright 2015-2023 Google LLC | https://github.com/googlefonts/noto-fonts | https://fonts.google.com/specimen/Noto+Sans+Thai |
| NotoSansTC.ttf | Noto Sans TC | OFL-1.1 | Copyright 2014-2021 Adobe Systems Incorporated and Google Inc. | https://github.com/googlefonts/noto-cjk | https://fonts.google.com/specimen/Noto+Sans+TC |
| OpenSans.ttf | Open Sans | Apache-2.0 | Copyright 2020 The Open Sans Project Authors (https://github.com/googlefonts/opensans), Steve Matteson | https://github.com/googlefonts/opensans | https://fonts.google.com/specimen/Open+Sans |
| Roboto.ttf | Roboto | Apache-2.0 | Copyright 2011 Google Inc., Christian Robertson | https://github.com/google/roboto | https://fonts.google.com/specimen/Roboto |
| Rubik.ttf | Rubik | OFL-1.1 | Copyright 2015-2021 The Rubik Project Authors (https://github.com/googlefonts/rubik) | https://github.com/googlefonts/rubik | https://fonts.google.com/specimen/Rubik |
| Tajawal.ttf | Tajawal | OFL-1.1 | Copyright 2018 The Tajawal Project Authors (https://github.com/BoutrosFonts/Tajawal) | https://github.com/BoutrosFonts/Tajawal | https://fonts.google.com/specimen/Tajawal |
| VazirmatnRegular.ttf + VazirmatnBold.ttf | Vazirmatn | OFL-1.1 | Copyright 2015-2023 Saber Rastikerdar (https://github.com/rastikerdar/vazirmatn) | https://github.com/rastikerdar/vazirmatn | https://fonts.google.com/specimen/Vazirmatn |

> **Note on Vazirmatn:** 2 weights share the same license — `VazirmatnRegular.ttf` and `VazirmatnBold.ttf` are both `Vazirmatn` family, OFL-1.1, same copyright holder and upstream. The table uses a combined row to represent both files (16 files total across 15 table rows).

## License Summary

- **OFL-1.1: 14 files** — Cairo, Lateef, MaruBuri, Noto Kufi Arabic, Noto Sans, Noto Sans Arabic, Noto Sans JP, Noto Sans KR, Noto Sans Thai, Noto Sans TC, Rubik, Tajawal, Vazirmatn Regular, Vazirmatn Bold
- **Apache-2.0: 2 files** — Open Sans, Roboto

Full texts: [`OFL.txt`](./OFL.txt) and [`APACHE-2.0.txt`](./APACHE-2.0.txt) in this same directory.

## Usage Notes

- You may use, embed, bundle, and redistribute these fonts under their respective licenses, even commercially, subject to each license's conditions.
- **OFL fonts** (`OFL-1.1`): You may use in documents, websites, apps, and videos. You may bundle with software provided you include the copyright notice and `OFL.txt`. Modified versions must remain under OFL-1.1 and must not be sold by themselves. See `OFL.txt` § Permission & Conditions 1–5.
- **Apache fonts** (`Apache-2.0`): You may use, modify, and distribute under Apache-2.0 terms. You must include a copy of `APACHE-2.0.txt`, retain copyright/attribution notices, and state significant changes. See `APACHE-2.0.txt` §4.
- Documents/images/videos **created using** the fonts (e.g., subtitles burned into video) are **not** considered derivative font software and are **not** required to be under OFL/Apache.
- No warranty is provided for any font. See `DISCLAIMER` in `OFL.txt` and `§7–8` in `APACHE-2.0.txt`.

## Reserved Font Name (RFN)

- Some OFL fonts declare a **Reserved Font Name** (RFN) in their copyright header (e.g., `with Reserved Font Name <Name>`).
- Per `OFL.txt` §3: **No Modified Version may use the Reserved Font Name(s) unless explicit written permission is granted by the corresponding Copyright Holder.** This applies only to the primary font name as presented to users.
- If you fork/modify an OFL font with an RFN, rename the font family to avoid the reserved name unless you have permission.
- Check each font's upstream repository or embedded `name` table for whether an RFN is declared. When in doubt, treat the family name as reserved and choose a new name for derivatives.

## How to Verify

1. **File manifest matches code:**
   ```sh
   ls -1 static/fonts/*.ttf
   # should list 16 TTFs; compare with src/lib/utils/fonts.ts `available_fonts`
   ```

2. **License texts are verbatim:**
   - `OFL.txt` should be byte-identical to the canonical SIL OFL 1.1 at:
     - https://openfontlicense.org/open-font-license-official-text/
     - https://github.com/google/fonts/blob/main/ofl/OFL.txt
     - `Version 1.1 - 26 February 2007` must appear verbatim.
   - `APACHE-2.0.txt` should be byte-identical to:
     - https://www.apache.org/licenses/LICENSE-2.0.txt
     - `Version 2.0, January 2004` must appear verbatim.

3. **Per-font licensing at Google Fonts:**
   - Every font in the table lists a Google Fonts URL where the sidebar shows the license (OFL or Apache). Cross-check:
     - Example: https://fonts.google.com/specimen/Cairo → “License: Open Font License”
     - Example: https://fonts.google.com/specimen/Roboto → “License: Apache 2.0”

4. **Upstream copyright holders:**
   - Verify holder strings at the upstream URLs in the table (e.g., GitHub `LICENSE`/`OFL.txt` files):
     - Cairo: https://github.com/Gue3bara/Cairo
     - Lateef: https://github.com/silnrsi/font-lateef
     - MaruBuri: https://github.com/naver/maruBuri
     - Noto families: https://github.com/googlefonts/noto-fonts, https://github.com/googlefonts/noto-cjk
     - Open Sans: https://github.com/googlefonts/opensans
     - Roboto: https://github.com/google/roboto
     - Rubik: https://github.com/googlefonts/rubik
     - Tajawal: https://github.com/BoutrosFonts/Tajawal
     - Vazirmatn: https://github.com/rastikerdar/vazirmatn

5. **No proprietary fonts remain:**
   ```sh
   # Should return no results — these were purged 2026-08-28
   ls static/fonts/ | grep -iE "arial|candara|tahoma"
   ```

6. **MIT does not apply to fonts:**
   - Repository `LICENSE` (MIT) covers code only. Fonts remain under OFL-1.1 / Apache-2.0 as documented here. If you redistribute the app, you must comply with **both** MIT (for code) **and** the font licenses (for `static/fonts/*`).

## Attribution Checklist for Redistributions

- Keep all 16 TTF files + `OFL.txt` + `APACHE-2.0.txt` + `FONT_LICENSES.md` together when redistributing fonts.
- Preserve copyright notices (table above + inside each TTF's `name` table).
- Do not sell any font by itself (OFL §1).
- Include both license files (`OFL.txt`, `APACHE-2.0.txt`) as stand-alone text files, human-readable headers, or machine-readable metadata fields easily viewable by users (OFL §2, Apache-2.0 §4a).

---

*This file is UTF-8. Last updated: 2026-08-28. For questions about a specific font, consult its upstream repository and the vendored license texts in this directory.*
