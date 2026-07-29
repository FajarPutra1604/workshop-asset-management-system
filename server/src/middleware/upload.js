import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads')

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOADS_DIR)
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`
    cb(null, uniqueName)
  },
})

function fileFilter(_req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Hanya file gambar yang diizinkan (JPEG, PNG, WebP)'), false)
  }
}

const MAX_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES) || 2 * 1024 * 1024 // 2MB (frontend sudah compress)

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
})
