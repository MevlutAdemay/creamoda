import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Kullanıcı bilgilerini wallet ile birlikte getir
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        wallet: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        role: user.role,
        emailVerified: user.emailVerified,
        onboardingStatus: user.onboardingStatus,
        onboardingStep: user.onboardingStep,
        wallet: user.wallet ? {
          balanceUsd: Number(user.wallet.balanceUsd),
          balanceXp: user.wallet.balanceXp,
          balanceDiamond: user.wallet.balanceDiamond,
        } : null,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
