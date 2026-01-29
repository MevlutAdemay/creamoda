// components/player/designoffices/OfficialWebsiteLink.tsx

'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

type OfficialWebsiteLinkProps = {
  url: string;
};

function extractDomain(url: string): string | null {
  try {
    // Handle URLs with or without protocol
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(urlWithProtocol);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function OfficialWebsiteLink({ url }: OfficialWebsiteLinkProps) {
  const domain = extractDomain(url);

  return (
    <div className="flex items-center gap-2 mt-2">
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 hover:underline underline-offset-2"
      >
        <span>Official website</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </Link>
      {domain && (
        <span className="text-xs font-mono text-muted-foreground/60 px-1.5 py-0.5 rounded border border-border/50 bg-muted/30">
          {domain}
        </span>
      )}
    </div>
  );
}
