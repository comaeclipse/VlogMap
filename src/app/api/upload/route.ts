import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import sharp from "sharp"
import { requireAdmin } from "@/lib/auth"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"]

export async function POST(request: NextRequest) {
  const authResponse = requireAdmin(request)
  if (authResponse) return authResponse

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const markerId = formData.get("markerId") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Process with sharp: convert to JPEG, optimize
    const processedImage = await sharp(buffer)
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .resize(1920, 1080, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer()

    // Generate filename
    const timestamp = Date.now()
    const filename = markerId
      ? `screenshots/marker-${markerId}-${timestamp}.jpg`
      : `screenshots/upload-${timestamp}.jpg`

    // Upload to Vercel Blob
    const blob = await put(filename, processedImage, {
      access: "public",
      contentType: "image/jpeg",
    })

    return NextResponse.json({
      url: blob.url,
      size: processedImage.length,
    })
  } catch (error) {
    console.error("Upload failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}
