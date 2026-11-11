import type { ReactNode } from 'react'
import { BOLD, parseImageLine } from '../lib/richText'
import { MediaImg } from './MediaImg'

/** 로그 본문을 화면에 그리기 (형식 설명은 lib/richText.ts) */

function renderInline(line: string): ReactNode[] {
  // split 에 괄호 그룹이 있으면 [보통, 굵게, 보통, 굵게, ...] 순서로 나옴
  return line.split(BOLD).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))
}

/** 본문을 화면에 그리기 */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n')
  return (
    <div className={`leading-relaxed break-words text-gray-800 ${className}`}>
      {lines.map((line, i) => {
        const img = parseImageLine(line)
        if (img) {
          return (
            <MediaImg
              key={i}
              src={img.url}
              alt={img.alt}
              loading="lazy"
              decoding="async"
              className="my-3 w-full rounded-xl bg-gray-100"
            />
          )
        }
        if (line.trim() === '') return <div key={i} className="h-4" />
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(line)}
          </p>
        )
      })}
    </div>
  )
}
