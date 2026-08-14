import { Router } from 'express'
import { body, query, validationResult } from 'express-validator'
import multer from 'multer'
import XLSX from 'xlsx'
import pool from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { requireMinLevel } from '../middleware/authorize.js'
import { upload } from '../middleware/upload.js'
import { generateAssetCode } from '../utils/crypto.js'
import { validateCategory, validateAssetStatus, validateQueryCategory, validateQueryAssetStatus } from '../middleware/dynamicValidate.js'

const router = Router()

router.use(requireAuth)

const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls|csv)$/i.test(file.originalname)) {
      cb(null, true)
    } else {
      const err = new Error('File harus berformat .xlsx, .xls, atau .csv')
      err.status = 400
      cb(err, false)
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 },
})

function fileToBase64(file) {
  if (!file) return null
  const mime = file.mimetype
  return `data:${mime};base64,${file.buffer.toString('base64')}`
}

// ─── GET /api/assets ────────────────────────────────────────────────────────
router.get(
  '/',
  validateQueryCategory,
  validateQueryAssetStatus,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

      const { category, status, search } = req.query
      const page = req.query.page || 1
      const limit = req.query.limit || 20
      const offset = (page - 1) * limit

      const conditions = ['a.deleted_at IS NULL']
      const params = []

      if (category) {
        params.push(category)
        conditions.push(`a.category = $${params.length}`)
      }
      if (status) {
        params.push(status)
        conditions.push(`a.status = $${params.length}`)
      }
      if (search) {
        params.push(`%${search}%`)
        conditions.push(`(a.name ILIKE $${params.length} OR a.description ILIKE $${params.length})`)
      }

      const where = conditions.join(' AND ')

      // Count total
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM assets a WHERE ${where}`,
        params,
      )
      const total = parseInt(countRes.rows[0].count, 10)

      // Fetch data
      params.push(limit, offset)
      const { rows } = await pool.query(
        `SELECT a.*,
                vd.model, vd.plate_number, vd.last_odometer,
                rd.location, rd.capacity
         FROM assets a
         LEFT JOIN vehicle_details vd ON vd.asset_id = a.id
         LEFT JOIN room_details rd ON rd.asset_id = a.id
         WHERE ${where}
         ORDER BY a.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      )

      res.json({
        data: rows,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      })
    } catch (err) {
      next(err)
    }
  },
)

// ─── GET /api/assets/import-template/:category ─────────────────────────────
// Generate file .xlsx template per kategori (barang/kendaraan/ruangan)
router.get('/import-template/:category', async (req, res, next) => {
  try {
    const { category } = req.params

    const [catRows, statRows] = await Promise.all([
      pool.query('SELECT slug, name FROM asset_categories WHERE is_active = TRUE ORDER BY sort_order'),
      pool.query('SELECT slug, name FROM asset_statuses WHERE is_active = TRUE ORDER BY sort_order'),
    ])
    const categories = catRows.rows
    const statuses = statRows.rows.filter((s) => s.slug !== 'borrowed')

    const cat = categories.find((c) => c.slug === category)
    if (!cat) return res.status(400).json({ error: 'Kategori tidak ditemukan' })

    const isVehicle = cat.slug === 'vehicle'
    const isRoom = cat.slug === 'room'

    const columns = [
      { header: 'Nama Aset', width: 26 },
      { header: 'Status', width: 14 },
      { header: 'Deskripsi', width: 40 },
      ...(cat.slug === 'tool' ? [{ header: 'Jumlah', width: 10 }] : []),
      ...(isVehicle
        ? [
            { header: 'Model', width: 20 },
            { header: 'No. Polisi', width: 18 },
            { header: 'Odometer (km)', width: 14 },
          ]
        : []),
      ...(isRoom
        ? [
            { header: 'Lokasi', width: 24 },
            { header: 'Kapasitas', width: 12 },
          ]
        : []),
    ]

    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'WABT'

    const ws = wb.addWorksheet(cat.name)
    ws.columns = columns
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    }

    const statList = statuses.map((s) => s.slug).join(',')
    for (let r = 2; r <= 2000; r++) {
      ws.getCell(`B${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${statList}"`] }
    }

    const exampleRow =
      cat.slug === 'vehicle'
        ? ['Toyota Avanza', 'available', 'Mobil operasional', 'Avanza 1.3 E', 'B 1234 XYZ', '45000']
        : cat.slug === 'room'
          ? ['Meeting Room A', '', 'Ruang meeting lantai 2', 'Gedung A', '10']
          : ['Kunci No. 13', 'available', 'Kunci pas ukuran 13 mm', '5']

    const guide = wb.addWorksheet('Petunjuk')
    guide.columns = [{ width: 100 }]
    const lines = [
      [`PETUNJUK IMPORT - ${cat.name.toUpperCase()}`],
      [''],
      ['1. Kolom wajib diisi: Nama Aset.'],
      ['2. Status (pilih dari dropdown, boleh dikosongkan = Tersedia):'],
      ...statuses.map((s) => [`   - ${s.slug} = ${s.name}`]),
      [''],
      ...(cat.slug === 'tool'
        ? ['3. Kolom Jumlah (opsional): isi angka banyaknya unit barang yang sama. Contoh Jumlah=5 akan membuat "Kunci No. 13 (Unit 1)" s/d "(Unit 5)", masing-masing dengan QR sendiri.', '']
        : []),
      [`${cat.slug === 'tool' ? '4' : '3'}. Baris dengan nama aset yang sudah ada di sistem akan dilewati (tidak di-import).`],
      [`${cat.slug === 'tool' ? '5' : '4'}. Isi data mulai dari baris ke-2. Jangan mengubah atau menambah kolom header.`],
      [`${cat.slug === 'tool' ? '6' : '5'}. Simpan file lalu upload di menu Manajemen Aset -> Import Excel (pilih kategori yang sama).`],
      [''],
      ['CONTOH BARIS:'],
      exampleRow,
    ]
    lines.forEach((l) => guide.addRow(l))
    guide.getRow(1).font = { bold: true, size: 13 }

    const buf = await wb.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="template-${cat.slug}.xlsx"`)
    res.send(Buffer.from(buf))
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/assets/print ──────────────────────────────────────────────────
// Semua aset (tanpa pagination) untuk cetak QR massal
router.get('/print', validateQueryCategory, validateQueryAssetStatus, async (req, res, next) => {
  try {
    const { category, status } = req.query
    const conditions = ['a.deleted_at IS NULL']
    const params = []
    if (category) {
      params.push(category)
      conditions.push(`a.category = $${params.length}`)
    }
    if (status) {
      params.push(status)
      conditions.push(`a.status = $${params.length}`)
    }
    const where = conditions.join(' AND ')
    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.asset_code, a.category, a.status
       FROM assets a WHERE ${where} ORDER BY a.name ASC`,
      params,
    )
    res.json({ data: rows, total: rows.length })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/assets/export ─────────────────────────────────────────────────
// Export daftar aset (sesuai filter) ke file .xlsx
router.get('/export', validateQueryCategory, validateQueryAssetStatus, async (req, res, next) => {
  try {
    const { category, status, search } = req.query
    const conditions = ['a.deleted_at IS NULL']
    const params = []
    if (category) {
      params.push(category)
      conditions.push(`a.category = $${params.length}`)
    }
    if (status) {
      params.push(status)
      conditions.push(`a.status = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(a.name ILIKE $${params.length} OR a.description ILIKE $${params.length})`)
    }
    const where = conditions.join(' AND ')
    const { rows } = await pool.query(
      `SELECT a.*,
              vd.model, vd.plate_number, vd.last_odometer,
              rd.location, rd.capacity
       FROM assets a
       LEFT JOIN vehicle_details vd ON vd.asset_id = a.id
       LEFT JOIN room_details rd ON rd.asset_id = a.id
       WHERE ${where}
       ORDER BY a.created_at DESC`,
      params,
    )

    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'WABT'
    const ws = wb.addWorksheet('Aset')
    ws.columns = [
      { header: 'Nama Aset', width: 26 },
      { header: 'Kategori', width: 12 },
      { header: 'Status', width: 14 },
      { header: 'Deskripsi', width: 32 },
      { header: 'Model', width: 18 },
      { header: 'No. Polisi', width: 16 },
      { header: 'Odometer (km)', width: 14 },
      { header: 'Lokasi', width: 22 },
      { header: 'Kapasitas', width: 12 },
      { header: 'Kode QR', width: 28 },
    ]
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }
    rows.forEach((r) =>
      ws.addRow([
        r.name,
        r.category,
        r.status,
        r.description || '',
        r.model || '',
        r.plate_number || '',
        r.last_odometer || '',
        r.location || '',
        r.capacity || '',
        r.asset_code,
      ]),
    )

    const buf = await wb.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="export-aset.xlsx"')
    res.send(Buffer.from(buf))
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/assets/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*,
              vd.model, vd.plate_number, vd.last_odometer,
              rd.location, rd.capacity
       FROM assets a
       LEFT JOIN vehicle_details vd ON vd.asset_id = a.id
       LEFT JOIN room_details rd ON rd.asset_id = a.id
       WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Aset tidak ditemukan' })
    res.json({ data: rows[0] })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/assets/:id/qrcode ─────────────────────────────────────────────
router.get('/:id/qrcode', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, asset_code FROM assets WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Aset tidak ditemukan' })

    const asset = rows[0]
    const frontendUrl = process.env.CORS_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:5173'
    const qrUrl = `${frontendUrl}/scan/${asset.asset_code}`

    res.json({
      asset_code: asset.asset_code,
      asset_name: asset.name,
      qr_url: qrUrl,
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/assets/import ────────────────────────────────────────────────
// Import aset massal dari file Excel (.xlsx/.xls/.csv)
router.post('/import', requireMinLevel('admin'), excelUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File Excel wajib diunggah' })

    const category = String(req.body.category || '').trim()
    if (!category) {
      return res.status(400).json({ error: 'Pilih kategori terlebih dahulu' })
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })

    const normalizeHeader = (h) => String(h || '').trim().toLowerCase().replace(/\s+/g, ' ')
    const headerIdx = raw.findIndex((r) => Array.isArray(r) && normalizeHeader(r[0]) === 'nama aset')
    if (headerIdx === -1) {
      return res.status(400).json({ error: 'Format file tidak dikenali. Gunakan template yang disediakan.' })
    }

    const headers = raw[headerIdx]
    const col = (...labels) => {
      const normalized = labels.map((l) => normalizeHeader(l))
      const idx = headers.findIndex((h) => normalized.includes(normalizeHeader(h)))
      return idx === -1 ? null : idx
    }
    const colName = col('Nama Aset')
    const colStatus = col('Status')
    const colDesc = col('Deskripsi')
    const colModel = col('Model')
    const colPlate = col('No. Polisi')
    const colOdo = col('Odometer (km)', 'Odometer')
    const colLoc = col('Lokasi')
    const colCap = col('Kapasitas')
    const colJumlah = col('Jumlah')

    const value = (r, idx) => (idx !== null && Array.isArray(r) && r[idx] !== undefined && r[idx] !== null ? String(r[idx]).trim() : '')

    const [catRows, statRows] = await Promise.all([
      pool.query('SELECT slug FROM asset_categories WHERE is_active = TRUE'),
      pool.query('SELECT slug FROM asset_statuses WHERE is_active = TRUE'),
    ])
    const validCategories = new Set(catRows.rows.map((r) => r.slug))
    const validStatuses = new Set(statRows.rows.map((r) => r.slug))

    if (!validCategories.has(category)) {
      return res.status(400).json({ error: `Kategori "${category}" tidak valid` })
    }

    const isVehicle = category === 'vehicle'
    const isRoom = category === 'room'

    const validRows = []
    const errors = []
    for (let i = headerIdx + 1; i < raw.length; i++) {
      const row = raw[i]
      const rowNum = i + 1
      const name = value(row, colName)

      const isEmptyRow =
        !name &&
        !value(row, colStatus) &&
        !value(row, colDesc) &&
        !(isVehicle && (value(row, colModel) || value(row, colPlate) || value(row, colOdo))) &&
        !(isRoom && (value(row, colLoc) || value(row, colCap)))
      if (isEmptyRow) continue

      if (!name) {
        errors.push({ row: rowNum, name: '', error: 'Nama Aset wajib diisi' })
        continue
      }
      if (name.length > 150) {
        errors.push({ row: rowNum, name, error: 'Nama aset maksimal 150 karakter' })
        continue
      }

      const status = value(row, colStatus) || 'available'
      if (!validStatuses.has(status) || status === 'borrowed') {
        errors.push({ row: rowNum, name, error: `Status "${status}" tidak valid untuk import` })
        continue
      }

      let last_odometer = null
      if (isVehicle) {
        const odoStr = value(row, colOdo)
        if (odoStr) {
          last_odometer = Number(odoStr)
          if (!Number.isInteger(last_odometer) || last_odometer < 0) {
            errors.push({ row: rowNum, name, error: 'Odometer harus berupa angka bulat >= 0' })
            continue
          }
        }
      }

      let capacity = null
      if (isRoom) {
        const capStr = value(row, colCap)
        if (capStr) {
          capacity = Number(capStr)
          if (!Number.isInteger(capacity) || capacity < 1) {
            errors.push({ row: rowNum, name, error: 'Kapasitas harus berupa angka bulat >= 1' })
            continue
          }
        }
      }

      let quantity = 1
      const qtyStr = value(row, colJumlah)
      if (qtyStr) {
        quantity = Number(qtyStr)
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
          errors.push({ row: rowNum, name, error: 'Jumlah harus berupa angka bulat 1-500' })
          continue
        }
      }
      if (quantity > 1 && category !== 'tool') {
        errors.push({ row: rowNum, name, error: 'Kolom Jumlah hanya berlaku untuk kategori tool (barang)' })
        continue
      }

      validRows.push({
        name,
        category,
        status,
        quantity,
        description: value(row, colDesc) || null,
        model: isVehicle ? value(row, colModel) || null : null,
        plate_number: isVehicle ? value(row, colPlate) || null : null,
        last_odometer,
        location: isRoom ? value(row, colLoc) || null : null,
        capacity,
      })
    }

    // Skip nama yang sudah ada (case-insensitive) — per unit
    const allNames = []
    validRows.forEach((r) => {
      const qty = r.quantity || 1
      for (let i = 1; i <= qty; i++) allNames.push((qty > 1 ? `${r.name} (Unit ${i})` : r.name).toLowerCase())
    })
    let existingSet = new Set()
    if (allNames.length > 0) {
      const { rows } = await pool.query(
        'SELECT LOWER(name) AS name FROM assets WHERE deleted_at IS NULL AND LOWER(name) = ANY($1)',
        [allNames],
      )
      existingSet = new Set(rows.map((r) => r.name))
    }
    const skipped = []
    const toInsert = []
    validRows.forEach((r) => {
      const qty = r.quantity || 1
      for (let i = 1; i <= qty; i++) {
        const unitName = qty > 1 ? `${r.name} (Unit ${i})` : r.name
        if (existingSet.has(unitName.toLowerCase())) {
          skipped.push({ row: -1, name: unitName, error: 'Nama aset sudah ada di sistem' })
        } else {
          toInsert.push({ ...r, name: unitName })
        }
      }
    })

    let imported = 0
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const item of toInsert) {
        try {
          const { rows } = await client.query(
            `INSERT INTO assets (asset_code, category, name, description, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [generateAssetCode(), item.category, item.name, item.description, item.status],
          )
          const assetId = rows[0].id

          if (item.category === 'vehicle') {
            await client.query(
              `INSERT INTO vehicle_details (asset_id, model, plate_number, last_odometer)
               VALUES ($1, $2, $3, $4)`,
              [assetId, item.model, item.plate_number, item.last_odometer],
            )
          } else if (item.category === 'room') {
            await client.query(
              `INSERT INTO room_details (asset_id, location, capacity)
               VALUES ($1, $2, $3)`,
              [assetId, item.location, item.capacity],
            )
          }
          imported++
        } catch (err) {
          errors.push({ row: -1, name: item.name, error: 'Gagal menyimpan: ' + err.message })
        }
      }
      if (imported > 0) {
        await client.query('SELECT log_audit($1,$2,$3,$4,$5,$6)', [
          req.admin.id, req.admin.name, 'import_assets', 'assets',
          null, JSON.stringify({ imported, skipped: skipped.length, errors: errors.length }),
        ])
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    res.json({ imported, skipped: skipped.length, errors })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/assets ────────────────────────────────────────────────────────
router.post(
  '/',
  requireMinLevel('admin'),
  upload.single('photo'),
  validateCategory,
  [
    body('name').trim().notEmpty().withMessage('Nama aset wajib diisi'),
    body('description').optional().trim(),
    body('status').optional(),
    body('quantity').optional().isInt({ min: 1, max: 500 }).withMessage('Jumlah unit harus angka 1-500').toInt(),
    // vehicle details
    body('model').optional().trim(),
    body('plate_number').optional().trim(),
    body('last_odometer').optional().isInt({ min: 0 }).withMessage('Odometer harus berupa angka bulat >= 0').toInt(),
    // room details
    body('location').optional().trim(),
    body('capacity').optional().isInt({ min: 1 }).withMessage('Kapasitas harus berupa angka bulat >= 1').toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

      const {
        name, category, description, status = 'available',
        model, plate_number, last_odometer,
        location, capacity, quantity,
      } = req.body

      const qty = quantity || 1
      if (qty > 1 && category !== 'tool') {
        return res.status(400).json({ error: 'Jumlah unit hanya berlaku untuk kategori tool (barang)' })
      }

      const photo_url = fileToBase64(req.file)

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const created = []
        for (let i = 1; i <= qty; i++) {
          const unitName = qty > 1 ? `${name} (Unit ${i})` : name
          const { rows } = await client.query(
            `INSERT INTO assets (asset_code, category, name, description, photo_url, status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [generateAssetCode(), category, unitName, description || null, i === 1 ? photo_url : null, status],
          )
          const asset = rows[0]
          if (category === 'vehicle') {
            await client.query(
              `INSERT INTO vehicle_details (asset_id, model, plate_number, last_odometer)
               VALUES ($1, $2, $3, $4)`,
              [asset.id, model || null, plate_number || null, last_odometer || null],
            )
          } else if (category === 'room') {
            await client.query(
              `INSERT INTO room_details (asset_id, location, capacity)
               VALUES ($1, $2, $3)`,
              [asset.id, location || null, capacity || null],
            )
          }
          created.push(asset)
        }

        await client.query('SELECT log_audit($1,$2,$3,$4,$5,$6)', [
          req.admin.id, req.admin.name, 'create_asset', 'assets',
          String(created[0].id), JSON.stringify({ name, category, status, quantity: qty }),
        ])
        await client.query('COMMIT')
        res.status(201).json({ data: qty > 1 ? created : created[0], count: qty })
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    } catch (err) {
      next(err)
    }
  },
)

// ─── PUT /api/assets/:id ─────────────────────────────────────────────────────
router.put(
  '/:id',
  requireMinLevel('admin'),
  upload.single('photo'),
  validateAssetStatus,
  [
    body('name').optional().trim().notEmpty().withMessage('Nama tidak boleh kosong'),
    body('status').optional(),
    body('description').optional().trim(),
    body('model').optional().trim(),
    body('plate_number').optional().trim(),
    body('last_odometer').optional().isInt({ min: 0 }).withMessage('Odometer harus berupa angka bulat >= 0').toInt(),
    body('location').optional().trim(),
    body('capacity').optional().isInt({ min: 1 }).withMessage('Kapasitas harus berupa angka bulat >= 1').toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

      const { id } = req.params
      const { name, description, status, model, plate_number, last_odometer, location, capacity } =
        req.body

      const { rows: existing } = await pool.query(
        'SELECT * FROM assets WHERE id = $1 AND deleted_at IS NULL',
        [id],
      )
      if (existing.length === 0) return res.status(404).json({ error: 'Aset tidak ditemukan' })

      const asset = existing[0]
      const photo_url = req.file
        ? fileToBase64(req.file)
        : req.body.remove_photo === '1' || req.body.remove_photo === 'true'
          ? null
          : asset.photo_url

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        const { rows } = await client.query(
          `UPDATE assets SET
             name = $1, description = $2, status = $3, photo_url = $4, updated_at = NOW()
           WHERE id = $5 RETURNING *`,
          [
            name ?? asset.name,
            description !== undefined ? description : asset.description,
            status ?? asset.status,
            photo_url,
            id,
          ],
        )

        const category = asset.category
        if (category === 'vehicle') {
          await client.query(
            `INSERT INTO vehicle_details (asset_id, model, plate_number, last_odometer)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (asset_id) DO UPDATE SET
               model = EXCLUDED.model,
               plate_number = EXCLUDED.plate_number,
               last_odometer = EXCLUDED.last_odometer`,
            [id, model ?? null, plate_number ?? null, last_odometer ?? null],
          )
        } else if (category === 'room') {
          await client.query(
            `INSERT INTO room_details (asset_id, location, capacity)
             VALUES ($1, $2, $3)
             ON CONFLICT (asset_id) DO UPDATE SET
               location = EXCLUDED.location,
               capacity = EXCLUDED.capacity`,
            [id, location ?? null, capacity ?? null],
          )
        }

        await client.query('SELECT log_audit($1,$2,$3,$4,$5,$6)', [
          req.admin.id, req.admin.name, 'update_asset', 'assets',
          String(id), JSON.stringify({ name, status, description }),
        ])
        await client.query('COMMIT')
        res.json({ data: rows[0] })
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    } catch (err) {
      next(err)
    }
  },
)

// ─── DELETE /api/assets/:id (soft delete) ────────────────────────────────────
router.delete('/:id', requireMinLevel('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE assets SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id, name',
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Aset tidak ditemukan' })
    await pool.query('SELECT log_audit($1,$2,$3,$4,$5,$6)', [
      req.admin.id, req.admin.name, 'delete_asset', 'assets',
      String(rows[0].id), JSON.stringify({ name: rows[0].name }),
    ])
    res.json({ message: 'Aset berhasil dihapus', id: rows[0].id })
  } catch (err) {
    next(err)
  }
})

export default router
