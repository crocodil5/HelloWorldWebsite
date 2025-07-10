module.exports = {
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{html,js,ts,jsx,tsx}",
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "wwwpaypalcomazure-radiance": "var(--wwwpaypalcomazure-radiance)",
        wwwpaypalcomblack: "var(--wwwpaypalcomblack)",
        wwwpaypalcomcobalt: "var(--wwwpaypalcomcobalt)",
        "wwwpaypalcomdove-gray": "var(--wwwpaypalcomdove-gray)",
        wwwpaypalcomendeavour: "var(--wwwpaypalcomendeavour)",
        wwwpaypalcommalibu: "var(--wwwpaypalcommalibu)",
        "wwwpaypalcommine-shaft": "var(--wwwpaypalcommine-shaft)",
        "wwwpaypalcomresolution-blue": "var(--wwwpaypalcomresolution-blue)",
        wwwpaypalcomsilver: "var(--wwwpaypalcomsilver)",
        wwwpaypalcomwhite: "var(--wwwpaypalcomwhite)",
        "wwwpaypalcomwhite-white-lilac": "var(--wwwpaypalcomwhite-white-lilac)",
        "wwwpaypalcomathens-gray": "var(--wwwpaypalcomathens-gray)",
        wwwpaypalcomnevada: "var(--wwwpaypalcomnevada)",
        wwwpaypalcomporcelain: "var(--wwwpaypalcomporcelain)",
        "wwwpaypalcomscience-blue": "var(--wwwpaypalcomscience-blue)",
        "wwwpaypalcomshuttle-gray": "var(--wwwpaypalcomshuttle-gray)",
        "wwwpaypalcomdusty-gray": "var(--wwwpaypalcomdusty-gray)",
        wwwpaypalcomiron: "var(--wwwpaypalcomiron)",
        wwwpaypalcomabbey: "var(--wwwpaypalcomabbey)",
        wwwpaypalcomalabaster: "var(--wwwpaypalcomalabaster)",
        wwwpaypalcomdenim: "var(--wwwpaypalcomdenim)",
        wwwpaypalcomfroly: "var(--wwwpaypalcomfroly)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        "www-paypal-com-helvetica-neue-bold":
          "var(--www-paypal-com-helvetica-neue-bold-font-family)",
        "www-paypal-com-helvetica-neue-medium":
          "var(--www-paypal-com-helvetica-neue-medium-font-family)",
        "www-paypal-com-helvetica-neue-regular":
          "var(--www-paypal-com-helvetica-neue-regular-font-family)",
        "www-paypal-com-helvetica-regular":
          "var(--www-paypal-com-helvetica-regular-font-family)",
        "www-paypal-com-semantic-heading-1":
          "var(--www-paypal-com-semantic-heading-1-font-family)",
        "www-paypal-com-semantic-heading-4":
          "var(--www-paypal-com-semantic-heading-4-font-family)",
        "www-paypal-com-semantic-item":
          "var(--www-paypal-com-semantic-item-font-family)",
        "www-paypal-com-semantic-input":
          "var(--www-paypal-com-semantic-input-font-family)",
        "www-paypal-com-semantic-label":
          "var(--www-paypal-com-semantic-label-font-family)",
        "www-paypal-com-semantic-link":
          "var(--www-paypal-com-semantic-link-font-family)",
        "www-paypal-com-semantic-heading-3":
          "var(--www-paypal-com-semantic-heading-3-font-family)",
        "www-paypal-com-semantic-link-underline":
          "var(--www-paypal-com-semantic-link-underline-font-family)",
        sans: [
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
  darkMode: ["class"],
};
