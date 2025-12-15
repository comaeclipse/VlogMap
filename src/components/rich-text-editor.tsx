"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Bold, Italic, List, ListOrdered, Quote } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

export function RichTextEditor({
  content,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-invert max-w-none min-h-[150px] px-3 py-2 rounded-md border border-white/10 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900",
      },
    },
  })

  if (!editor) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-md border border-white/10 bg-slate-900/60 p-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={
            editor.isActive("bold")
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:text-white"
          }
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={
            editor.isActive("italic")
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:text-white"
          }
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={
            editor.isActive("bulletList")
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:text-white"
          }
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={
            editor.isActive("orderedList")
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:text-white"
          }
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={
            editor.isActive("blockquote")
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:text-white"
          }
        >
          <Quote className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} />
      {placeholder && !editor.getText() && (
        <p className="pointer-events-none absolute mt-2 px-3 text-sm text-slate-500">
          {placeholder}
        </p>
      )}
    </div>
  )
}
