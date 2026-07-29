import multer from 'multer'

const storage = multer.memoryStorage()

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
