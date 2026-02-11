// app/player/collections/[studioId]/_components/AddToCollectionButton.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/ToastCenter';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';

const IDEMPOTENCY_PREFIX = 'ui:add-to-collection:';

type Props = {
  companyId: string;
  productTemplateId: string;
  disabled?: boolean;
  disabledLabel?: string;
};

export function AddToCollectionButton({
  companyId,
  productTemplateId,
  disabled = false,
  disabledLabel = 'On Your Collection',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const isDisabled = disabled || added;

  const handleClick = async () => {
    if (loading || isDisabled) return;
    setLoading(true);
    setError(null);
    try {
      const idempotencyKey = `${IDEMPOTENCY_PREFIX}${companyId}:${productTemplateId}`;
      const res = await fetch('/api/player/collection/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          productTemplateId,
          idempotencyKey,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.error === 'Insufficient balance' || (data?.error && String(data.error).toLowerCase().includes('insufficient'))
            ? 'Insufficient balance'
            : data?.error ?? 'Failed to add to collection';
        setError(msg);
        toast({ kind: 'error', message: msg });
        return;
      }

      setAdded(true);
      router.refresh();
    } catch {
      const msg = 'Failed to add to collection';
      setError(msg);
      toast({ kind: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  if (isDisabled) {
    return (
      <Button type="button" variant="secondary" size="sm" disabled>
        {disabledLabel}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={loading}
        onClick={handleClick}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <ModaVerseLogoLoader size={18} />
            Adding...
          </span>
        ) : (
          'Add to Collection'
        )}
      </Button>
      {error && (
        <span className="text-xs text-destructive max-w-[140px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
