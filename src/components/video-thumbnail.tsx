"use client"

import { useState } from "react"

type VideoThumbnailProps = {
  src: string
  alt: string
  className?: string
}

export function VideoThumbnail({ src, alt, className = "" }: VideoThumbnailProps) {
  const [imgSrc, setImgSrc] = useState(src)

  const handleError = () => {
    // Fallback from maxresdefault to hqdefault if the high-res version fails
    if (imgSrc.includes("maxresdefault")) {
      setImgSrc(imgSrc.replace("maxresdefault", "hqdefault"))
    }
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  )
}
