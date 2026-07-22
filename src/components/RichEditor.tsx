import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Undo2, Redo2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface RichEditorHandle {
  focus: () => void;
  getHtml: () => string;
}

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  /** Renders on the right of the formatting toolbar (Inspiration + lamp). */
  toolbarTrailing?: ReactNode;
}

function normalize(content: string): string {
  return content && content.trim() ? content : '<p></p>';
}

/**
 * Notie's long-form writing surface. A calm TipTap editor with a minimal
 * toolbar — bold, italic, underline, lists, undo/redo. No AI actions.
 */
export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  (
    {
      content,
      onChange,
      editable = true,
      placeholder = 'Begin writing…',
      className,
      toolbarTrailing,
    },
    ref,
  ) => {
    const lastHtmlRef = useRef('');
    const isExternalUpdateRef = useRef(false);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Underline,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Link.configure({ openOnClick: false, autolink: true }),
        Image.configure({ inline: false, allowBase64: true }),
        Placeholder.configure({ placeholder }),
      ],
      content: normalize(content),
      editable,
      editorProps: {
        attributes: {
          class: 'notie-prose focus:outline-none min-h-[280px] px-1 py-2',
        },
      },
      onUpdate: ({ editor }) => {
        if (isExternalUpdateRef.current) return;
        const html = editor.getHTML();
        lastHtmlRef.current = html;
        onChange(html);
      },
    });

    useEffect(() => {
      if (!editor) return;
      const next = normalize(content);
      if (next === lastHtmlRef.current) return;
      isExternalUpdateRef.current = true;
      editor.commands.setContent(next, { emitUpdate: false });
      lastHtmlRef.current = next;
      isExternalUpdateRef.current = false;
      // Intentionally scoped to `content` — re-running on `editor` identity
      // change alone would reset the cursor on every keystroke.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, editor]);

    useEffect(() => {
      editor?.setEditable(editable);
    }, [editor, editable]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editor?.commands.focus(),
        getHtml: () => editor?.getHTML() ?? '',
      }),
      [editor],
    );

    const toolbarBtn = (active: boolean) =>
      cn(
        'inline-flex h-7 w-7 items-center justify-center rounded transition-colors',
        active ? 'bg-moss/15 text-moss' : 'text-foreground/55 hover:bg-moss/10 hover:text-foreground',
      );

    if (!editor) return null;

    return (
      <div className={cn('flex flex-col', className)}>
        {editable && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-card/60 px-1.5 py-1 shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <button
                type="button"
                title="Bold"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={toolbarBtn(editor.isActive('bold'))}
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Italic"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={toolbarBtn(editor.isActive('italic'))}
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Underline"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={toolbarBtn(editor.isActive('underline'))}
              >
                <UnderlineIcon className="h-3.5 w-3.5" />
              </button>
              <div className="mx-1 h-4 w-px bg-border" />
              <button
                type="button"
                title="Bullet list"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={toolbarBtn(editor.isActive('bulletList'))}
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Numbered list"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={toolbarBtn(editor.isActive('orderedList'))}
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </button>
              <div className="mx-1 h-4 w-px bg-border" />
              <button
                type="button"
                title="Undo"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className={cn(toolbarBtn(false), 'disabled:opacity-30')}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Redo"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className={cn(toolbarBtn(false), 'disabled:opacity-30')}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {toolbarTrailing ? (
              <div className="flex shrink-0 items-center gap-2 border-l border-border pl-2">
                {toolbarTrailing}
              </div>
            ) : null}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    );
  },
);

RichEditor.displayName = 'RichEditor';
