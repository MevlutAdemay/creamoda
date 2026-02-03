/**
 * Settlements page data shape (server → client).
 */

export type SettlementsPageData = {
  group: string;
  warehouseBuildingId: string | null;
  totals: {
    grossRevenueUsd: number;
    commissionFeeUsd: number;
    logisticsFeeUsd: number;
    returnDeductionUsd: number;
    netRevenueUsd: number;
    returnRate: number | null; // sum returnQty / sum fulfilledQty when fulfilledQty > 0
  };
  timeline: { bucket: string; netRevenueUsd: number; grossRevenueUsd: number }[];
  feesByBucket: { bucket: string; commissionFeeUsd: number; logisticsFeeUsd: number; returnDeductionUsd: number }[];
  settlementRows: {
    id: string;
    periodStartDayKey: string;
    periodEndDayKey: string;
    payoutDayKey: string;
    warehouseName: string;
    warehouseBuildingId: string;
    grossRevenueUsd: number;
    totalFeesUsd: number;
    netRevenueUsd: number;
    topLines: {
      productTemplateId: string;
      productCode: string;
      grossRevenueUsd: number;
      commissionFeeUsd: number;
      logisticsFeeUsd: number;
      returnDeductionUsd: number;
      netRevenueUsd: number;
      fulfilledQty: number;
      returnQty: number;
    }[];
  }[];
  warehouseSummary: {
    warehouseBuildingId: string;
    warehouseName: string;
    grossRevenueUsd: number;
    commissionFeeUsd: number;
    logisticsFeeUsd: number;
    returnDeductionUsd: number;
    netRevenueUsd: number;
    returnRate: number | null;
  }[];
  warehouseOptions: { value: string; label: string; buildingId: string }[];
};
