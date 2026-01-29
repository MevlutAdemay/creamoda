/**
 * Get all style tags for dropdown (from StyleTag enum)
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { StyleTag } from '@prisma/client';

// Display names for StyleTag enum values
const STYLE_TAG_LABELS: Record<StyleTag, string> = {
  CASUAL: 'Casual',
  STREET: 'Street',
  SMART: 'Smart',
  BUSINESS: 'Business',
  ATHLEISURE: 'Athleisure',
};

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    // Get all enum values and format for dropdown
    const styles = Object.values(StyleTag).map((value) => ({
      id: value,
      value: value,
      name: STYLE_TAG_LABELS[value] || value,
    }));

    return NextResponse.json(styles);
  } catch (error) {
    console.error('Error fetching styles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch styles' },
      { status: 500 }
    );
  }
}
