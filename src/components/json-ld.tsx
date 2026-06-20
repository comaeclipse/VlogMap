interface JsonLdProps {
  // A schema.org structured-data object, serialized into a
  // <script type="application/ld+json"> tag for search engines.
  data: Record<string, unknown>
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inline; escape '<' to avoid any
      // chance of breaking out of the script element.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  )
}
