interface VideoSummarySectionProps {
  summary?: string | null
}

export function VideoSummarySection({ summary }: VideoSummarySectionProps) {
  if (!summary) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-50">About This Video</h2>
        <p className="text-sm text-slate-400">No summary available for this video.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-50">About This Video</h2>
      <div
        className="prose prose-sm prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: summary }}
      />
    </div>
  )
}
