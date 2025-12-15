interface VideoSummarySectionProps {
  summary?: string | null
}

export function VideoSummarySection({ summary }: VideoSummarySectionProps) {
  if (!summary) return null

  return (
    <section className="border-b border-white/10 bg-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-semibold text-slate-50">
          About This Video
        </h2>
        <div
          className="prose prose-sm prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: summary }}
        />
      </div>
    </section>
  )
}
