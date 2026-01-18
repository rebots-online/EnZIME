// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Synaptic theme colors
        synaptic: {
          bg: '#0a0a0f',
          surface: 'rgba(20, 20, 30, 0.8)',
          accent: '#00f0ff',
          secondary: '#ff00ff',
          tertiary: '#ffd700',
        },
        // Brutalist theme colors
        brutalist: {
          bg: '#e8e4e0',
          surface: '#f5f3f0',
          accent: '#ff6b35',
          secondary: '#0066cc',
          text: '#1a1a1a',
        },
        // Prismatic theme colors
        prismatic: {
          bg: '#fafafa',
          surface: '#ffffff',
          cyan: '#00bcd4',
          magenta: '#e91e63',
          gold: '#ffc107',
        },
        // Spectral theme colors
        spectral: {
          bg: '#0d0d12',
          surface: 'rgba(25, 25, 35, 0.9)',
          cyan: '#00e5ff',
          pink: '#ff4081',
          amber: '#ffab00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
