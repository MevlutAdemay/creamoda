// app/components/ui/ProductImageCarousel.tsx
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

export interface ProductImageCarouselProps {
  images: string[];
  alt: string;
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
}: {
  image: string;
  alt: string;
  index: number;
  x: MotionValue<number>;
  viewportW: number;
}) {
  // Merkezden uzaklık: 0 = merkez, -1/+1 = bir slide uzak
  const progress = useTransform(x, (v) => {
    const w = Math.max(1, viewportW);
    return (v + index * w) / w;
  });

  // %15–20 küçülme (0.82–0.85 arası güzel)
  const scale = useTransform(progress, [-1, 0, 1], [0.64, 1, 0.64]);
  

  // Blur'u string olarak üret (yoksa tarayıcı umursamaz)
  const blurPx = useTransform(progress, [-1, 0, 1], [1.25, 0, 1.25]); // 2px'den 1.25px'e düşürüldü 
  const filter = useTransform(blurPx, (b) => `blur(${b}px)`);

  return (
    <div className="relative min-w-full h-full flex items-center justify-center select-none">
      <motion.div
        className="relative w-full h-full flex items-center justify-center will-change-transform"
        style={{ scale, filter }}
      >
        <Image
          src={image}
          alt={`${alt} - Resim ${index + 1}`}
          fill
          className="object-contain pointer-events-none"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={index === 0}
          draggable={false}
        />
      </motion.div>
    </div>
  );
}

export default function ProductImageCarousel({ images, alt, loop = false }: ProductImageCarouselProps) {
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

  if (images.length === 1) {
    return (
      <div className="relative w-full h-[270px] rounded-lg overflow-hidden">
        <Image
          src={images[0]}
          alt={alt}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
        />
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
          <Slide key={index} image={image} alt={alt} index={index} x={x} viewportW={viewportW} />
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
            aria-label={`${index + 1}. resme git`}
          />
        ))}
      </div>
    </div>
  );
}
