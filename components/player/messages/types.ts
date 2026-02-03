/**
 * Shape returned by GET /api/player/messages (subset of PlayerMessage)
 */
export type PlayerMessageItem = {
  id: string;
  title: string;
  body: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  kind: string;
  department: string;
  category: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  context: { buildingRole?: string; buildingId?: string; buildingName?: string; marketZone?: string } | null;
  bullets: { productTemplateId?: string; productName?: string; qty?: number }[] | null;
  ctaType: string | null;
  ctaLabel: string | null;
  ctaPayload: { route?: string; buildingId?: string; tab?: string } | null;
};
