// components/ui/art-card.tsx
'use client';

export function ArtCard() {
  return (
    <div className="fixed inset-0 bg-background overflow-hidden isolate">
      {/* LEFT TOP */}
      <div
        className="
          absolute
          left-[-16vw] top-[-14vh]
          w-[24vw] h-[68vh]
          rotate-24
          shadow-lg
        "
        style={{
          background: `linear-gradient(to left, color-mix(in oklab, var(--accent) 20%, transparent), color-mix(in oklab, var(--accent) 70%, transparent))`,
        }}
      />

      {/* LEFT BOTTOM */}
      <div
        className="
          absolute
          left-[-10vw] bottom-[-7vh]
          w-[14vw] h-[38vh]
          rotate-[-24deg]
          shadow-lg
        "
        style={{
          background: `linear-gradient(to left, color-mix(in oklab, var(--accent) 20%, transparent), color-mix(in oklab, var(--accent) 70%, transparent))`,
        }}
      />

      {/* RIGHT TOP */}
      <div
        className="
          absolute
          right-[-15vw] top-[-14vh]
          w-[62vw] h-[34vh]
          rotate-22
          shadow-lg
        "
        style={{
          background: `linear-gradient(to right, color-mix(in oklab, var(--secondary) 30%, transparent), color-mix(in oklab, var(--secondary) 70%, transparent))`,
        }}
      />

      {/* RIGHT BOTTOM - primary rengi theme ile uyumlu, farklı saydamlıkta gradient */}
      <div
        className="absolute right-[-22vw] bottom-[-5vh] w-[70vw] h-[76vh] rotate-22 shadow-xl rounded-[10vw]"
        style={{
          background: `linear-gradient(to right, color-mix(in oklab, var(--primary) 10%, transparent), color-mix(in oklab, var(--primary) 30%, transparent))`,
        }}
      />
    </div>
  );
}
