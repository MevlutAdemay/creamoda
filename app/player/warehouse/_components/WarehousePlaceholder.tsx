import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

type WarehousePlaceholderProps = {
  title: string;
  bullets: string[];
  backHref: string;
  noWarehouse?: boolean;
};

export function WarehousePlaceholder({
  title,
  bullets,
  backHref,
  noWarehouse = false,
}: WarehousePlaceholderProps) {
  if (noWarehouse) {
    return (
      <Card className="border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">No warehouse selected</CardTitle>
          <CardDescription>
            Select a warehouse from the overview to view this section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Warehouse Overview
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-muted bg-muted/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">This section will be implemented next.</CardTitle>
        <CardDescription>
          The following will be available here:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
        <Button asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Warehouse Overview
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
