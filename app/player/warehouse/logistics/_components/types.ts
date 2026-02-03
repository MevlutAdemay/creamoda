export type BacklogProductItem = {
  productTemplateId: string;
  productCode: string;
  productName: string;
  thumbnailUrl: string | null;
  backlogUnits: number;
  oldestDayKey: string;
  breakdown: Array<{
    dayKey: string;
    ordered: number;
    fulfilled: number;
    remaining: number;
  }>;
};
