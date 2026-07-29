import { useRef, useCallback } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download } from 'lucide-react'

const FRONTEND_URL =
  import.meta.env.VITE_FRONTEND_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')

export function QRCodeDisplay({ assetCode, assetName, size = 200 }) {
  const canvasRef = useRef(null)

  const qrUrl = `${FRONTEND_URL}/scan/${assetCode}`

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current?.querySelector('canvas')
    if (!canvas) return

    // Create a new canvas with white background + label
    const padding = 24
    const labelHeight = 48
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvas.width + padding * 2
    exportCanvas.height = canvas.height + padding * 2 + labelHeight
    const ctx = exportCanvas.getContext('2d')

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)

    // Draw QR
    ctx.drawImage(canvas, padding, padding)

    // Asset name label
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold 14px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(assetName, exportCanvas.width / 2, canvas.height + padding + 20)

    // Asset code sub-label
    ctx.fillStyle = '#64748b'
    ctx.font = `11px monospace`
    ctx.fillText(assetCode, exportCanvas.width / 2, canvas.height + padding + 38)

    // Download
    const link = document.createElement('a')
    link.download = `QR-${assetCode}.png`
    link.href = exportCanvas.toDataURL('image/png')
    link.click()
  }, [assetCode, assetName])

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div
        ref={canvasRef}
        className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-card flex items-center justify-center"
      >
        <QRCodeCanvas
          value={qrUrl}
          size={size}
          bgColor="#ffffff"
          fgColor="#0f172a"
          level="M"
          includeMargin={false}
        />
      </div>

      <div className="text-center space-y-0.5">
        <p className="text-sm font-bold text-slate-900 tracking-tight">{assetName}</p>
        <p className="text-xs font-mono text-slate-500">{assetCode}</p>
        <p className="text-[11px] text-slate-400 max-w-xs truncate pt-1">{qrUrl}</p>
      </div>

      <button
        onClick={handleDownload}
        className="btn-primary btn-sm flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Download PNG</span>
      </button>
    </div>
  )
}

// Versi ringkas untuk bulk print
export function QRCodePrint({ assetCode, assetName }) {
  const qrUrl = `${FRONTEND_URL}/scan/${assetCode}`
  return (
    <div className="flex flex-col items-center p-4 border border-slate-200 rounded-2xl print:border-black bg-white">
      <QRCodeCanvas value={qrUrl} size={150} bgColor="#ffffff" fgColor="#000000" level="M" />
      <p className="text-xs font-bold mt-2 text-center text-slate-900">{assetName}</p>
      <p className="text-[11px] font-mono text-slate-500">{assetCode}</p>
    </div>
  )
}
