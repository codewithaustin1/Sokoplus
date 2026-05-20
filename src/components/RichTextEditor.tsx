import { useState, useRef } from "react";
import {
  Bold,
  Italic,
  Heading,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Eye,
  Edit3,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import Markdown from "react-markdown";

interface RichTextEditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Write your masterpiece here...",
  id,
}: RichTextEditorProps) {
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [showHelp, setShowHelp] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertFormatting = (type: "bold" | "italic" | "h2" | "h3" | "list" | "numlist" | "quote" | "link") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let replacement = "";
    let cursorOffset = 0;

    switch (type) {
      case "bold":
        replacement = `**${selectedText || "bold text"}**`;
        cursorOffset = selectedText ? 0 : -2;
        break;
      case "italic":
        replacement = `*${selectedText || "italic text"}*`;
        cursorOffset = selectedText ? 0 : -1;
        break;
      case "h2":
        replacement = `\n## ${selectedText || "Heading"}\n`;
        break;
      case "h3":
        replacement = `\n### ${selectedText || "Subheading"}\n`;
        break;
      case "list":
        replacement = `\n- ${selectedText || "List item"}\n`;
        break;
      case "numlist":
        replacement = `\n1. ${selectedText || "List item"}\n`;
        break;
      case "quote":
        replacement = `\n> ${selectedText || "Quote testimonial"}\n`;
        break;
      case "link":
        const url = prompt("Enter link URL (e.g. https://...):", "https://");
        if (url === null) return; // User cancelled
        replacement = `[${selectedText || "Link text"}](${url})`;
        break;
    }

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    onChange(newContent);

    // Refocus the textarea and set active cursor position/selection
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start, start + replacement.length);
      } else {
        const newCursorPos = start + replacement.length + cursorOffset;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  const getWordCount = () => {
    if (!content.trim()) return 0;
    return content.trim().split(/\s+/).length;
  };

  const getCharacterCount = () => {
    return content.length;
  };

  return (
    <div className="flex flex-col border border-gray-150 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-orange-600/20 focus-within:border-orange-500 transition-all bg-white">
      {/* Header bar with controls and tabs */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 gap-2 select-none">
        {/* Toggle tabs */}
        <div className="flex space-x-1 bg-gray-200/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("write")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "write"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Edit3 size={13} />
            <span>Write Markdown</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "preview"
                ? "bg-white text-orange-600 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Eye size={13} />
            <span>Interactive Preview</span>
          </button>
        </div>

        {/* Action icons / Rich formats - only active in 'write' mode */}
        <div className="flex items-center gap-0.5">
          {activeTab === "write" && (
            <>
              <button
                type="button"
                onClick={() => insertFormatting("bold")}
                className="p-1.5 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
                title="Bold (Ctrl+B/**)"
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("italic")}
                className="p-1.5 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
                title="Italic (Ctrl+I/*)"
              >
                <Italic size={14} />
              </button>
              <div className="w-px h-4 bg-gray-250 mx-1" />
              <button
                type="button"
                onClick={() => insertFormatting("h2")}
                className="p-1.5 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-colors font-bold text-[10px] flex items-center gap-0.5"
                title="Heading 2 (##)"
              >
                <Heading size={13} />
                <span>H2</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("h3")}
                className="p-1.5 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-colors font-bold text-[10px] flex items-center gap-0.5"
                title="Heading 3 (###)"
              >
                <Heading size={13} />
                <span>H3</span>
              </button>
              <div className="w-px h-4 bg-gray-250 mx-1" />
              <button
                type="button"
                onClick={() => insertFormatting("list")}
                className="p-1.5 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
                title="Unordered List (-)"
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("numlist")}
                className="p-1.5 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
                title="Ordered List (1.)"
              >
                <ListOrdered size={14} />
              </button>
              <div className="w-px h-4 bg-gray-250 mx-1" />
              <button
                type="button"
                onClick={() => insertFormatting("quote")}
                className="p-1.5 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
                title="Blockquote (>)"
              >
                <Quote size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("link")}
                className="p-1.5 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
                title="Insert Link ([text](url))"
              >
                <LinkIcon size={14} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className={`p-1.5 rounded-lg transition-colors ${
              showHelp ? "bg-orange-50 text-orange-600" : "hover:bg-gray-200 text-gray-400"
            }`}
            title="Formatting Guide"
          >
            <HelpCircle size={14} />
          </button>
        </div>
      </div>

      {/* Formatting Help Information Sheet */}
      {showHelp && (
        <div className="bg-orange-50/70 border-b border-orange-100 p-4 text-xs text-orange-950 space-y-2">
          <div className="font-bold flex items-center text-[11px] uppercase tracking-wider text-orange-800">
            <BookOpen size={12} className="mr-1.5" /> Quick Markdown Typography Guide
          </div>
          <p className="text-gray-600 mb-2 leading-relaxed">
            Standard Markdown parses into clean native SokoPlus design formats instantly.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-medium text-gray-700 font-sans">
            <div>
              <code className="bg-white/80 border border-orange-100 px-1 py-0.5 rounded text-orange-800 font-semibold font-mono">
                **bold text**
              </code>{" "}
              → <strong>Bold Highlight</strong>
            </div>
            <div>
              <code className="bg-white/80 border border-orange-100 px-1 py-0.5 rounded text-orange-800 font-semibold font-mono">
                *italic text*
              </code>{" "}
              → <em>Italic Emphasis</em>
            </div>
            <div>
              <code className="bg-white/80 border border-orange-100 px-1 py-0.5 rounded text-orange-800 font-semibold font-mono">
                ## Main Heading
              </code>{" "}
              → <span className="font-semibold text-gray-900">Heading 2 Title</span>
            </div>
            <div>
              <code className="bg-white/80 border border-orange-100 px-1 py-0.5 rounded text-orange-800 font-semibold font-mono">
                ### Section Title
              </code>{" "}
              → <span className="font-semibold text-gray-800">Heading 3 Title</span>
            </div>
            <div>
              <code className="bg-white/80 border border-orange-100 px-1 py-0.5 rounded text-orange-800 font-semibold font-mono">
                - Bullet item
              </code>{" "}
              → Bulleted listing points
            </div>
            <div>
              <code className="bg-white/80 border border-orange-100 px-1 py-0.5 rounded text-orange-800 font-semibold font-mono">
                [SokoPlus](url)
              </code>{" "}
              → <span className="text-orange-600 underline">Active link/URL</span>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <code className="bg-white/80 border border-orange-100 px-1 py-0.5 rounded text-orange-800 font-semibold font-mono">
                &gt; Inspiring quotes
              </code>{" "}
              → Left-accented blockquote styling for highlights
            </div>
          </div>
        </div>
      )}

      {/* Central Editor panels */}
      <div className="relative min-h-[160px] bg-white">
        {activeTab === "write" ? (
          <textarea
            ref={textareaRef}
            id={id}
            required
            placeholder={placeholder}
            className="w-full min-h-[180px] p-4 bg-white text-gray-900 outline-none border-0 focus:ring-0 resize-y font-sans text-sm leading-relaxed"
            value={content}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <div className="w-full min-h-[180px] p-6 bg-gray-50/50 max-h-[350px] overflow-y-auto select-text prose prose-orange max-w-none">
            {content.trim() ? (
              <Markdown
                components={{
                  h2: ({ ...props }) => (
                    <h2
                      className="text-lg font-black text-gray-900 mt-5 first:mt-0 mb-3 border-b border-gray-100 pb-1 font-sans"
                      {...props}
                    />
                  ),
                  h3: ({ ...props }) => (
                    <h3 className="text-base font-bold text-gray-850 mt-4 mb-2 font-sans" {...props} />
                  ),
                  p: ({ ...props }) => (
                    <p className="text-sm text-gray-700 leading-relaxed mb-4" {...props} />
                  ),
                  ul: ({ ...props }) => (
                    <ul className="list-disc pl-5 mb-4 space-y-1.5 text-sm text-gray-700" {...props} />
                  ),
                  ol: ({ ...props }) => (
                    <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-sm text-gray-700" {...props} />
                  ),
                  li: ({ ...props }) => <li className="text-gray-700" {...props} />,
                  a: ({ ...props }) => (
                    <a
                      className="text-orange-600 hover:text-orange-700 underline font-semibold transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    />
                  ),
                  blockquote: ({ ...props }) => (
                    <blockquote
                      className="border-l-4 border-orange-500 pl-4 italic text-gray-600 my-4 bg-gray-50 py-1 pr-2 rounded-r-lg"
                      {...props}
                    />
                  ),
                  strong: ({ ...props }) => <strong className="font-extrabold text-gray-950" {...props} />,
                  em: ({ ...props }) => <em className="italic" {...props} />,
                }}
              >
                {content}
              </Markdown>
            ) : (
              <p className="text-sm text-gray-400 italic font-medium">
                No content written yet. Tap &apos;Write Markdown&apos; to begin crafting the story.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Editor footer: Status details */}
      <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">
        <div>Story content (Markdown &amp; Rich Format)</div>
        <div className="flex space-x-4">
          <span>{getWordCount()} words</span>
          <span>{getCharacterCount()} characters</span>
        </div>
      </div>
    </div>
  );
}
