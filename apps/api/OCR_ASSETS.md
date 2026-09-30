# Local OCR assets

The plan analyzer uses Tesseract.js with its Node worker, WASM core, and the English `tessdata_fast` model packaged locally. Runtime OCR does not download worker code, language data, or call a hosted OCR service.

`eng.traineddata` is from the official [Tesseract tessdata_fast repository](https://github.com/tesseract-ocr/tessdata_fast). That repository licenses its model data under Apache-2.0; the notice is included in [`TESSDATA_LICENSE`](./TESSDATA_LICENSE). The packaged model SHA-256 is `7D4322BD2A7749724879683FC3912CB542F19906C83BCC1A52132556427170B2`.
