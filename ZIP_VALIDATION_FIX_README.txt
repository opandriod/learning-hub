ZIP Validation Fix
==================

This update changes the marketplace upload validator:

1. Lab / Practical uploads now require at least 2 KB.
2. Minor Project and Major Project uploads still require at least 10 KB.
3. All ZIP uploads still require:
   - README.txt or README.md
   - at least 3 files
   - no dangerous files such as .exe, .bat, .cmd, .vbs, .scr
4. Pricing remains allowed only for Minor Project and Major Project.
5. Practical/Lab uploads remain free only.

Why this fix was needed:
Small C practical ZIP files can be valid but smaller than real Minor/Major projects, so the old 10 KB minimum was too strict for lab uploads.
