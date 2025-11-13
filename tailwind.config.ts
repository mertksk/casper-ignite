import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			brand: {
  				'50': '#fff8ec',
  				'100': '#ffe9c8',
  				'200': '#ffd59f',
  				'300': '#ffbd73',
  				'400': '#ffa248',
  				'500': '#ff7f24',
  				'600': '#f55b16',
  				'700': '#c94312',
  				'800': '#97300f',
  				'900': '#651f0a'
  			},
  			risk: {
  				neutral: '#38a3ff',
  				warning: '#ffb703',
  				danger: '#ff4d6d'
  			},
 			background: 'hsl(var(--background))',
 			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
 		borderRadius: {
 			lg: 'var(--radius)',
 			md: 'calc(var(--radius) - 2px)',
 			sm: 'calc(var(--radius) - 4px)'
 		},
  		boxShadow: {
  			card: '0 14px 30px rgba(15, 16, 31, 0.12)',
  			'cartoon-pop': '0 10px 0 rgba(20,20,20,0.1)'
  		},
  		backgroundImage: {
  			'doodle-grid': 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)',
  			'candy-wave': 'linear-gradient(135deg, rgba(255,162,72,0.25), rgba(56,163,255,0.2))',
  			'star-spark': 'radial-gradient(circle, rgba(255,255,255,0.8) 0, rgba(255,255,255,0) 55%)'
 		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
