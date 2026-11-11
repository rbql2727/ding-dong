import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { isAllowedLogImage } from '../../lib/richText'
import { MediaImg } from '../MediaImg'

/** 본문 속 이미지: 우리 Storage 이미지만 서명 주소로 보여 줌 (외부 이미지는 안내만) */
export function LogImageView({ node, selected }: ReactNodeViewProps) {
  const src = String(node.attrs.src ?? '')
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : ''
  return (
    <NodeViewWrapper className="my-3" data-drag-handle>
      {isAllowedLogImage(src) ? (
        <MediaImg
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`w-full border-2 border-ink bg-gray-100 ${selected ? 'outline-3 outline-accent' : ''}`}
        />
      ) : (
        <p className="border-2 border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500">
          다른 사이트의 이미지는 넣을 수 없어요. 저장하면 빠져요. (이미지 버튼으로 올려 주세요)
        </p>
      )}
    </NodeViewWrapper>
  )
}
