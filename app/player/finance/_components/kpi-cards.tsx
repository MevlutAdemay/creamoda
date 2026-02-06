'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlayerWallet } from '@/stores/usePlayerWallet';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

type Kpis = {
  net: number;
  totalIn: number;
  totalOut: number;
  biggestExpenseCategory?: string | null;
};

type Props = {
  kpis: Kpis;
};

export function FinanceKpiCards({ kpis }: Props) {
  const t = useTranslations('finance.kpi');
  const locale = useLocale();
  const { balanceUsd, balanceXp, balanceDiamond } = usePlayerWallet();
  const fmtUsd = (n: number) => formatCurrency(n, locale);

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-0.5 sm:pb-1">
          <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-0.5 sm:gap-1">
            <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {t('walletUsd')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 sm:pt-0">
          <p className="text-xs sm:text-xl font-semibold tabular-nums">{fmtUsd(balanceUsd)}</p>
        </CardContent>
      </Card>
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-0.5 sm:pb-1">
          <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground">{t('walletXp')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 sm:pt-0">
          <p className="text-xs sm:text-xl font-semibold tabular-nums">{balanceXp.toLocaleString()}</p>
        </CardContent>
      </Card>
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-0.5 sm:pb-1">
          <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground">{t('walletDiamond')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 sm:pt-0">
          <p className="text-xs sm:text-xl font-semibold tabular-nums">{balanceDiamond.toLocaleString()}</p>
        </CardContent>
      </Card>
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-0.5 sm:pb-1">
          <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-0.5 sm:gap-1">
            <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500" />
            {t('totalIn')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 sm:pt-0">
          <p className="text-xs sm:text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">{fmtUsd(kpis.totalIn)}</p>
        </CardContent>
      </Card>
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-0.5 sm:pb-1">
          <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-0.5 sm:gap-1">
            <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />
            {t('totalOut')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 sm:pt-0">
          <p className="text-xs sm:text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">{fmtUsd(kpis.totalOut)}</p>
        </CardContent>
      </Card>
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-0.5 sm:pb-1">
          <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-0.5 sm:gap-1">
            <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {t('netCashflow')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 sm:pt-0">
          <p className={`text-xs sm:text-xl font-semibold tabular-nums ${kpis.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {fmtUsd(kpis.net)}
          </p>
          {kpis.biggestExpenseCategory && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">{t('biggestExpense', { category: kpis.biggestExpenseCategory })}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
