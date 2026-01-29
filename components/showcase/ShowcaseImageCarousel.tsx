/**
 * ShowcaseImageCarousel with locked overlay support
 */

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
import Image from 'next/image';
import { Lock } from 'lucide-react';

type ImageData = {
  id: string;
  url: string;
  slot: string;
  unlockType: string;
  isUnlocked?: boolean;
};

export interface ShowcaseImageCarouselProps {
  images: ImageData[];
  alt: string;
  showLockedOverlay?: boolean; // Only show overlay in Showcase tab
  loop?: boolean;
}

const DRAG_PX_MIN = 40;
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 };

function Slide({
  image,
  alt,
  index,
  x,
  viewportW,
  showLockedOverlay,
}: {
  image: ImageData;
  alt: string;
  index: number;
  x: MotionValue<number>;
  viewportW: number;
  showLockedOverlay: boolean;
}) {
  const progress = useTransform(x, (v) => {
    const w = Math.max(1, viewportW);
    return (v + index * w) / w;
  });

  const scale = useTransform(progress, [-1, 0, 1], [0.64, 1, 0.64]);
  const blurPx = useTransform(progress, [-1, 0, 1], [1.25, 0, 1.25]);
  const filter = useTransform(blurPx, (b) => `blur(${b}px)`);

  // Determine if image should show locked overlay
  const isLocked =
    showLockedOverlay &&
    (image.unlockType === 'PURCHASE_XP' || image.unlockType === 'PURCHASE_DIAMOND') &&
    !image.isUnlocked;

  return (
    <div className="relative min-w-full h-full flex items-center justify-center select-none">
      <motion.div
        className="relative w-full h-full flex items-center justify-center will-change-transform"
        style={{ scale, filter }}
      >
        <Image
          src={image.url}
          alt={`${alt} - Image ${index + 1}`}
          fill
          className="object-contain pointer-events-none"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={index === 0}
          draggable={false}
        />

        {/* Locked overlay */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2 text-white">
              <Lock className="w-8 h-8" />
              <span className="text-sm font-medium">Locked</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function ShowcaseImageCarousel({
  images,
  alt,
  showLockedOverlay = false,
  loop = false,
}: ShowcaseImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewportW, setViewportW] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const controls = useAnimationControls();
  const x = useMotionValue(0);

  useLayoutEffect(() => {
    if (images.length <= 1) return;
    const el = wrapRef.current;
    if (!el) return;

    const setW = () => setViewportW(el.clientWidth);
    setW();

    const ro = new ResizeObserver(setW);
    ro.observe(el);
    return () => ro.disconnect();
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    controls.start({ x: -currentIndex * viewportW, transition: SPRING });
  }, [currentIndex, viewportW, controls, images.length]);

  if (images.length === 0) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
        No images available
      </div>
    );
  }

  if (images.length === 1) {
    const isLocked =
      showLockedOverlay &&
      (images[0].unlockType === 'PURCHASE_XP' || images[0].unlockType === 'PURCHASE_DIAMOND') &&
      !images[0].isUnlocked;

    return (
      <div className="relative w-full h-full rounded-lg overflow-hidden">
        <Image
          src={images[0].url}
          alt={alt}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
        />
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2 text-white">
              <Lock className="w-8 h-8" />
              <span className="text-sm font-medium">Locked</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const maxIndex = images.length - 1;

  const goNext = () =>
    setCurrentIndex((i) => (loop ? (i === maxIndex ? 0 : i + 1) : Math.min(i + 1, maxIndex)));
  const goPrev = () =>
    setCurrentIndex((i) => (loop ? (i === 0 ? maxIndex : i - 1) : Math.max(i - 1, 0)));

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
      if (!loop && atLast) await bounceBack();
      else goNext();
    } else if (dragged >= threshold) {
      if (!loop && atFirst) await bounceBack();
      else goPrev();
    } else {
      controls.start({ x: -currentIndex * viewportW, transition: SPRING });
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden">
      <motion.div
        className="flex h-full will-change-transform cursor-grab active:cursor-grabbing"
        drag="x"
        dragElastic={0.18}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        initial={false}
        style={{ x }}
      >
        {images.map((image, index) => (
          <Slide
            key={image.id}
            image={image}
            alt={alt}
            index={index}
            x={x}
            viewportW={viewportW}
            showLockedOverlay={showLockedOverlay}
          />
        ))}
      </motion.div>

      {/* Dots */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-2 z-10 pb-1">
        {images.map((_, index) => (
          <button
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              currentIndex === index ? 'bg-foreground w-4' : 'bg-foreground/50 hover:bg-foreground/75 w-2'
            }`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Go to image ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
