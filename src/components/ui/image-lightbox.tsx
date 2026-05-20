import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxItem {
  src: string;
  alt: string;
  label: string;
}

interface ImageLightboxProps {
  items: LightboxItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightbox({ items, initialIndex, isOpen, onClose }: ImageLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(initialIndex);
    }
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (items.length <= 1) return;

      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current - 1 + items.length) % items.length);
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current + 1) % items.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, items.length, onClose]);

  if (!isOpen || items.length === 0 || typeof document === "undefined") {
    return null;
  }

  const activeItem = items[activeIndex];
  const canNavigate = items.length > 1;

  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + items.length) % items.length);
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % items.length);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-black/60 text-white p-2 hover:bg-black/80 transition-colors"
        aria-label="关闭图片预览"
      >
        <X className="size-5" />
      </button>

      {canNavigate && (
        <button
          type="button"
          onClick={showPrevious}
          className="absolute left-4 rounded-full bg-black/60 text-white p-2 hover:bg-black/80 transition-colors"
          aria-label="上一张图片"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      <div className="relative w-full max-w-6xl flex items-center justify-center">
        <img
          src={activeItem.src}
          alt={activeItem.alt}
          className="max-h-[88vh] max-w-full object-contain rounded-lg shadow-2xl"
        />
      </div>

      {canNavigate && (
        <button
          type="button"
          onClick={showNext}
          className="absolute right-4 rounded-full bg-black/60 text-white p-2 hover:bg-black/80 transition-colors"
          aria-label="下一张图片"
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-white flex items-center gap-3">
        {activeItem.label && <span>{activeItem.label}</span>}
        {canNavigate && <span>{activeIndex + 1} / {items.length}</span>}
      </div>
    </div>,
    document.body,
  );
}
