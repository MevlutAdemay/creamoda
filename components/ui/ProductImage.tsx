//app/components/ui/ProductImage.tsx


"use client";
import Image from "next/image";
import clsx from "clsx";

interface ProductImageProps {
  src: string;
  alt: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  rounded?: boolean;
  mode?: "contain" | "cover";
  blurDataURL?: string; // NEW
}

const sizeMap = {
  xs: { w: 120, h: 180 },
  sm: { w: 180, h: 270 },
  md: { w: 300, h: 450 },
  lg: { w: 400, h: 600 },
  xl: { w: 600, h: 900 },
};

export default function ProductImage({
  src,
  alt,
  size = "xl",
  className,
  rounded = true,
  mode = "contain",
  blurDataURL,
}: ProductImageProps) {
  const { w, h } = sizeMap[size];
  return (
    <div
      className={clsx(
        "relative overflow-hidden bg-transparent",
        rounded && "rounded",
        className
      )}
      style={{ width: `${w}px`, height: `${h}px` }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={`${w}px`}
        style={{ objectFit: mode }}
        placeholder={blurDataURL ? "blur" : "empty"}
        blurDataURL={blurDataURL}
      />
    </div>
  );
}
