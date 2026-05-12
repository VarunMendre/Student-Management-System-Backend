OCR worker app for scholarship form processing.

DirectAdmin suggested settings:

- Application root: the `ocr-worker-app` folder
- Startup file: `ocrWorker.js`
- App mode: `production`

Required environment variables:

- `MYSQL_HOSTNAME`
- `MYSQL_DB`
- `MYSQL_USERNAME`
- `MYSQL_PASSWORD`
- `OCR_POLL_INTERVAL_MS`
- `OCR_IDLE_LOG_EVERY`
- `UPLOADS_ROOT`

Use `UPLOADS_ROOT=../uploads` when this worker app sits beside the main API app files and the uploaded forms live in the main app's `uploads/` folder.
