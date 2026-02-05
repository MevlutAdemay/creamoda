// app/player/sales/_components/ShowcaseImageCarousel.tsx

'use client';

import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import {
  motion,
  PanInfo,
  useAnimationControls,
  useMotionValue,
  useTransform,
  MotionValue,
} from 'framer-motion';
import { Sparkles } from 'lucide-react';

export type ShowcaseImageItem = {
  id: string;
  isUnlocked: boolean;
  paidXp: number | null;
  paidDiamond: number | null;
  /** From ProductImageTemplate when paidXp/paidDiamond null */
  effectiveCostXp?: number | null;
  effectiveCostDiamond?: number | null;
  unlockType?: string | null;
  displayUrl: string | null;
  templateUrl?: string | null;
};

type ShowcaseImageCarouselProps = {
  images: ShowcaseImageItem[];
  alt: string;
};

const DRAG_PX_MIN = 40;
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 };

function Slide({
  item,
  alt,
  index,
  x,
  viewportW,
}: {
  item: ShowcaseImageItem;
  alt: string;
  index: number;
  x: MotionValue<number>;
  viewportW: number;
}) {
  const progress = useTransform(x, (v) => {
    const w = Math.max(1, viewportW);
    return (v + index * w) / w;
  });
  const scale = useTransform(progress, [-1, 0, 1], [0.64, 1, 0.64]);
  const blurPx = useTransform(progress, [-1, 0, 1], [1.25, 0, 1.25]);
  const filter = useTransform(blurPx, (b) => `blur(${b}px)`);

  const url = item.isUnlocked && item.displayUrl ? item.displayUrl : item.displayUrl ?? item.templateUrl ?? null;

  return (
    <div className="relative min-w-full h-full flex items-center justify-center select-none" style={{ minWidth: viewportW, width: viewportW }}>
      <motion.div
        className="relative w-full h-full flex items-center justify-center will-change-transform"
        style={{ scale, filter }}
      >
        {url ? (
          <img
            src={url}
            alt={item.isUnlocked ? `${alt} ${index + 1}` : ''}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-muted/50" />
        )}
      </motion.div>
    </div>
  );
}

export function ShowcaseImageCarousel({ images, alt }: ShowcaseImageCarouselProps) {
  const unlockedImages = images.filter((item) => item.isUnlocked);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewportW, setViewportW] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const controls = useAnimationControls();
  const x = useMotionValue(0);

  useLayoutEffect(() => {
    if (unlockedImages.length <= 1) return;
    const el = wrapRef.current;
    if (!el) return;
    const setW = () => setViewportW(el.clientWidth);
    setW();
    const ro = new ResizeObserver(setW);
    ro.observe(el);
    return () => ro.disconnect();
  }, [unlockedImages.length]);

  useEffect(() => {
    if (unlockedImages.length <= 1) return;
    controls.start({ x: -currentIndex * viewportW, transition: SPRING });
  }, [currentIndex, viewportW, controls, unlockedImages.length]);

  if (unlockedImages.length === 0) {
    return (
      <div className="relative w-full aspect-2/3 bg-muted/50 flex items-center justify-center">
        <Sparkles className="size-10 text-muted-foreground/50" />
      </div>
    );
  }

  if (unlockedImages.length === 1) {
    const item = unlockedImages[0];
    const url = item.isUnlocked && item.displayUrl ? item.displayUrl : item.displayUrl ?? item.templateUrl ?? null;
    return (
      <div className="relative w-full aspect-2/3 overflow-hidden bg-muted/30">
        {url ? (
          <img
            src={url}
            alt={alt}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-muted/50" />
        )}
      </div>
    );
  }

  const maxIndex = unlockedImages.length - 1;
  const goNext = () =>
    setCurrentIndex((i) => (i >= maxIndex ? maxIndex : i + 1));
  const goPrev = () =>
    setCurrentIndex((i) => (i <= 0 ? 0 : i - 1));

  const bounceBack = async () => {
    const target = -currentIndex * viewportW;
    const nudge = 20;
    await controls.start({
      x: target + (currentIndex === 0 ? nudge : -nudge),
      transition: { type: 'spring', stiffness: 450, damping: 22 },
    });
    await controls.start({ x: target, transition: SPRING });
  };

  const handleDragStart = () => {
    controls.stop();
  };

  const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const dragged = info.offset.x;
    const threshold = Math.max(DRAG_PX_MIN, viewportW * 0.1);
    const atFirst = currentIndex === 0;
    const atLast = currentIndex === maxIndex;

    if (dragged <= -threshold) {
      if (atLast) await bounceBack();
      else goNext();
    } else if (dragged >= threshold) {
      if (atFirst) await bounceBack();
      else goPrev();
    } else {
      controls.start({ x: -currentIndex * viewportW, transition: SPRING });
    }
  };
  
  return (
    <div ref={wrapRef} className="relative w-full aspect-2/3 overflow-hidden bg-muted/30">
      <motion.div
        className="flex h-full will-change-transform cursor-grab active:cursor-grabbing"
        drag="x"
        dragElastic={0.18}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        initial={false}
        style={{ x, width: unlockedImages.length * viewportW }}
      >
        {unlockedImages.map((item, index) => (
          <Slide
            key={item.id}
            item={item}
            alt={alt}
            index={index}
            x={x}
            viewportW={viewportW}
          />
        ))}
      </motion.div>

      <div className="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-2 z-10 pb-1">
        {unlockedImages.map((_, index) => (
          <button
            key={index}
            type="button"
            className={`h-2 rounded-full transition-all duration-300 ${
              currentIndex === index ? 'bg-foreground w-4' : 'bg-foreground/50 hover:bg-foreground/75 w-2'
            }`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
