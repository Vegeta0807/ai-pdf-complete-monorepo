/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Black-Purple Monochromatic Palette using CSS custom properties
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
        },
        dark: {
          50: 'var(--color-dark-50)',
          100: 'var(--color-dark-100)',
          200: 'var(--color-dark-200)',
          300: 'var(--color-dark-300)',
          400: 'var(--color-dark-400)',
          500: 'var(--color-dark-500)',
          600: 'var(--color-dark-600)',
          700: 'var(--color-dark-700)',
          800: 'var(--color-dark-800)',
          900: 'var(--color-dark-900)',
          950: 'var(--color-dark-950)',
        },
        // Accent colors from the palette
        accent: {
          purple: 'var(--color-accent-purple)',
          'purple-dark': 'var(--color-accent-purple-dark)',
          'purple-light': 'var(--color-accent-purple-light)',
          black: 'var(--color-accent-black)',
          'gray-dark': 'var(--color-accent-gray-dark)',
          'purple-bright': 'var(--color-accent-purple-bright)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter Tight', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Default Tailwind sizes
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],

        // Custom responsive font sizes
        'hero': ['clamp(2.5rem, 8vw, 6rem)', { lineHeight: '1.1' }],
        'display': ['clamp(2rem, 6vw, 4rem)', { lineHeight: '1.2' }],
        'h1': ['clamp(1.75rem, 4vw, 2.5rem)', { lineHeight: '1.3' }],
        'h2': ['clamp(1.5rem, 3.5vw, 2rem)', { lineHeight: '1.3' }],
        'h3': ['clamp(1.25rem, 3vw, 1.5rem)', { lineHeight: '1.4' }],
        'body-lg': ['clamp(1.125rem, 2.5vw, 1.5rem)', { lineHeight: '1.6' }],
        'body': ['clamp(1rem, 2vw, 1.125rem)', { lineHeight: '1.6' }],
        'body-sm': ['clamp(0.875rem, 1.5vw, 1rem)', { lineHeight: '1.5' }],
        'caption': ['clamp(0.75rem, 1.2vw, 0.875rem)', { lineHeight: '1.4' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(139, 92, 246, 0.1), 0 10px 20px -2px rgba(0, 0, 0, 0.1)',
        'medium': '0 4px 25px -5px rgba(139, 92, 246, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        'large': '0 10px 40px -10px rgba(139, 92, 246, 0.2), 0 20px 25px -5px rgba(0, 0, 0, 0.15)',
        'purple': '0 4px 20px rgba(139, 92, 246, 0.3)',
        'dark': '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-secondary': 'var(--gradient-secondary)',
        'gradient-accent': 'var(--gradient-accent)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'slide-down': 'slideDown 0.6s ease-out',
        'scale-in': 'scaleIn 0.4s ease-out',
        'bounce-soft': 'bounceSoft 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)' },
          '100%': { boxShadow: '0 0 30px rgba(139, 92, 246, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}

