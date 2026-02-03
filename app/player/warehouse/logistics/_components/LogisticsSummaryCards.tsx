/**
 * Summary cards for logistics: ordered today, total shipped today (FIFO breakdown),
 * backlog total, capacity/day.
 */

type LogisticsSummaryCardsProps = {
  orderedUnitsToday: number;
  totalShippedToday: number;
  shippedFromBacklogToday: number;
  shippedFromTodayOrders: number;
  backlogUnitsTotal: number;
  capacityPerDay: number;
};

export function LogisticsSummaryCards({
  orderedUnitsToday,
  totalShippedToday,
  shippedFromBacklogToday,
  shippedFromTodayOrders,
  backlogUnitsTotal,
  capacityPerDay,
}: LogisticsSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border bg-card/50 p-4 shadow-sm justify-center items-left">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          Ordered units today
        </p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{orderedUnitsToday}</p>
        <p className="mt-1 text-sm text-muted-foreground">New orders created today</p>
      </div>
      <div className="rounded-lg border bg-card/50 p-4 shadow-sm">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          Total shipped today
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{totalShippedToday}</p>
        {capacityPerDay > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Capacity used: {totalShippedToday} / {capacityPerDay}
          </p>
        )}
        {(shippedFromBacklogToday > 0 || shippedFromTodayOrders > 0) && (
          <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              Shipped today ({totalShippedToday}):
            </p>
            <ul className="mt-0.5 list-inside list-disc space-y-0.5">
              <li>{shippedFromBacklogToday} from previous backlog</li>
              <li>{shippedFromTodayOrders} from today&apos;s orders</li>
            </ul>
          </div>
        )}
      </div>
      <div className="rounded-lg border bg-card/50 p-4 shadow-sm">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          Backlog units total
        </p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{backlogUnitsTotal}</p>
      </div>
      <div className="rounded-lg border bg-card/50 p-4 shadow-sm">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          Capacity / day
        </p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{capacityPerDay}</p>
      </div>
    </div>
  );
}
