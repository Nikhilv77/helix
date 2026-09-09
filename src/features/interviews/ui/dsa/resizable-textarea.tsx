"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef
} from "react";

type ResizableTextareaProps = Omit<ComponentPropsWithoutRef<"textarea">, "className"> & {
  containerClassName?: string;
  textareaClassName?: string;
  minHeight: number;
  maxHeight: number;
};

export function ResizableTextarea({
  containerClassName = "",
  textareaClassName = "",
  minHeight,
  maxHeight,
  onInput,
  style,
  value,
  ...props
}: ResizableTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeToContent = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const contentHeight = textarea.scrollHeight;
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, contentHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight, minHeight]);

  useLayoutEffect(() => {
    resizeToContent();
  }, [resizeToContent, value]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || typeof ResizeObserver === "undefined") return;

    let previousWidth = textarea.getBoundingClientRect().width;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = entry.contentRect.width;
      if (Math.abs(nextWidth - previousWidth) < 0.5) return;
      previousWidth = nextWidth;
      resizeToContent();
    });

    observer.observe(textarea);
    return () => observer.disconnect();
  }, [resizeToContent]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      onInput={(event) => {
        resizeToContent();
        onInput?.(event);
      }}
      className={`resize-none ${containerClassName} ${textareaClassName}`}
      style={{ ...style, minHeight, maxHeight, height: minHeight }}
    />
  );
}
