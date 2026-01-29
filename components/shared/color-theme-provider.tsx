'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type ColorTheme = 'default' | 'retro-arcade' | 'solar-dusk' | 'starry-night' | 'vercel' | 'modern-minimal' | 'amethyst-haze' | 'yellow-pallet' | 'luxury';

interface ColorThemeContextType {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load theme from localStorage
    const saved = localStorage.getItem('color-theme') as ColorTheme;
    if (saved) {
      setColorThemeState(saved);
      document.documentElement.setAttribute('data-color-theme', saved);
    }
  }, []);

  const setColorTheme = (theme: ColorTheme) => {
    setColorThemeState(theme);
    localStorage.setItem('color-theme', theme);
    document.documentElement.setAttribute('data-color-theme', theme);
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error('useColorTheme must be used within ColorThemeProvider');
  }
  return context;
}
