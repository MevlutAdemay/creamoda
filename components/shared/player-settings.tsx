'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './theme-toggle';
import { Palette, X } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useColorTheme } from './color-theme-provider';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState } from 'react';

interface PlayerSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    name?: string;
    email: string;
    displayName?: string;
    balanceUSD?: number;
    balanceXP?: number;
    balanceDiamond?: number;
  };
}

export default function PlayerSettings({ open, onOpenChange, user: propUser }: PlayerSettingsProps) {
  const user = propUser || { email: 'player@modaverse.com' };
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [colorTheme, setColorTheme] = useState('default');

  // Get color theme context only on client
  useEffect(() => {
    setMounted(true);
    try {
      // This will only work on client side after hydration
      const contextModule = require('./color-theme-provider');
      // You can safely use hook here if needed
    } catch (error) {
      // Silently fail - context will be handled by provider
    }
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-4">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Manage your account settings and preferences
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Player Info */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Player Information</h3>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">Name:</span>{' '}
                <span className="font-medium">{user.displayName || user.name || 'N/A'}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Email:</span>{' '}
                <span className="font-medium">{user.email}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Role:</span>{' '}
                <span className="font-medium">Player</span>
              </p>
            </div>
          </div>

          <Separator />

          {/* Theme Settings */}
          <ColorThemeSettings />

          <Separator />

          {/* Logout Button */}
          <div className="pt-2">
            <Button 
              onClick={handleLogout} 
              variant="destructive"
              className="w-full"
            >
              Logout
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Separate component for theme settings that uses the context
function ColorThemeSettings() {
  const { colorTheme, setColorTheme } = useColorTheme();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Palette className="w-4 h-4" />
        Theme Settings
      </h3>
      
      {/* Color Theme Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Color Theme</Label>
        <RadioGroup
          value={colorTheme}
          onValueChange={(value) => setColorTheme(value as any)}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="default" id="theme-default" />
            <Label htmlFor="theme-default" className="text-sm cursor-pointer">Default</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="retro-arcade" id="theme-retro-arcade" />
            <Label htmlFor="theme-retro-arcade" className="text-sm cursor-pointer">Retro Arcade</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="solar-dusk" id="theme-solar-dusk" />
            <Label htmlFor="theme-solar-dusk" className="text-sm cursor-pointer">Solar Dusk</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="starry-night" id="theme-starry-night" />
            <Label htmlFor="theme-starry-night" className="text-sm cursor-pointer">Starry Night</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="vercel" id="theme-vercel" />
            <Label htmlFor="theme-vercel" className="text-sm cursor-pointer">Vercel</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="modern-minimal" id="theme-modern-minimal" />
            <Label htmlFor="theme-modern-minimal" className="text-sm cursor-pointer">Modern Minimal</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="amethyst-haze" id="theme-amethyst-haze" />
            <Label htmlFor="theme-amethyst-haze" className="text-sm cursor-pointer">Amethyst Haze</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yellow-pallet" id="theme-yellow-pallet" />
            <Label htmlFor="theme-yellow-pallet" className="text-sm cursor-pointer">Yellow Pallet</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="luxury" id="theme-luxury" />
            <Label htmlFor="theme-luxury" className="text-sm cursor-pointer">Luxury</Label>
          </div>
        </RadioGroup>
      </div>

      <Separator />

      {/* Dark/Light Mode Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
        <div className="flex flex-col">
          <span className="text-sm font-medium">Dark Mode</span>
          <span className="text-xs text-muted-foreground">Toggle dark/light theme</span>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}

