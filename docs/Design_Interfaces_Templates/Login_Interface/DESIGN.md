---
name: Institutional Excellence
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#5e3f3b'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#936e69'
  outline-variant: '#e9bcb6'
  surface-tint: '#c0000c'
  primary: '#b5000b'
  on-primary: '#ffffff'
  primary-container: '#e30613'
  on-primary-container: '#fff5f3'
  inverse-primary: '#ffb4aa'
  secondary: '#5b5f63'
  on-secondary: '#ffffff'
  secondary-container: '#dde0e5'
  on-secondary-container: '#5f6368'
  tertiary: '#515a61'
  on-tertiary: '#ffffff'
  tertiary-container: '#69727a'
  on-tertiary-container: '#f0f7ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad5'
  primary-fixed-dim: '#ffb4aa'
  on-primary-fixed: '#410001'
  on-primary-fixed-variant: '#930007'
  secondary-fixed: '#e0e3e8'
  secondary-fixed-dim: '#c3c7cc'
  on-secondary-fixed: '#181c20'
  on-secondary-fixed-variant: '#43474c'
  tertiary-fixed: '#dbe4ed'
  tertiary-fixed-dim: '#bfc8d0'
  on-tertiary-fixed: '#141d23'
  on-tertiary-fixed-variant: '#3f484f'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Public Sans
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Public Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system is engineered for a high-performance educational environment, emphasizing authority, clarity, and institutional pride. It is designed to serve a diverse audience of students, faculty, and administrators, providing a user experience that feels reliable and academically rigorous.

The visual style is **Corporate / Modern** with a focus on high-contrast accessibility. It utilizes structured layouts and a restrained color palette to ensure information density remains readable. The aesthetic is professional and stable, avoiding fleeting trends in favor of a timeless, trustworthy presence that reflects the heritage and future of a leading educational institution.

## Colors

This design system employs a high-contrast palette rooted in **Institutional Red (#E30613)**. This primary color is used for key call-to-actions, branding elements, and critical highlights to draw immediate attention.

- **Primary:** Institutional Red is the core brand identifier. Use it sparingly for buttons and active states to maintain its impact.
- **Surface & Secondary:** A range of neutrals—from pure White (#FFFFFF) to Slate Grey (#212529)—provides a clean canvas. White is the default background for content, while light greys define container boundaries.
- **Text:** Deep Black (#000000) is used for headings and primary body text to ensure maximum legibility and WCAG AA/AAA compliance against white backgrounds.
- **Functional:** Success (Green), Warning (Amber), and Error (Red) states should be clearly distinguished but secondary to the brand's primary red.

## Typography

The design system utilizes **Public Sans** across all levels. Its neutral, institutional character ensures maximum clarity and accessibility across both digital and printed contexts.

- **Headlines:** Use Bold weights (700) for primary titles to establish a strong hierarchy. Large displays should use slight negative letter-spacing to appear more compact and authoritative.
- **Body Text:** Standard body copy uses a 16px base with a generous 24px line height to support long-form reading in academic contexts.
- **Labels:** Use Semi-bold weights (600) for navigation, buttons, and metadata labels to distinguish them from narrative text. Small labels may be set in all-caps for distinct categorization.

## Layout & Spacing

The design system follows a **Fixed-Grid** philosophy for desktop to maintain structural integrity and a **Fluid-Grid** for mobile. 

- **Desktop:** A 12-column grid with a maximum container width of 1280px. Gutters are fixed at 24px to provide clear separation between information modules.
- **Mobile:** A 4-column fluid grid with 16px margins. Content should stack vertically, prioritizing top-down readability.
- **Spacing Rhythm:** All margins and paddings are based on an 8px incremental scale. Use `md` (24px) for standard component spacing and `lg` (48px) to separate distinct sections of a page.

## Elevation & Depth

To maintain a professional and "flat" institutional aesthetic, this design system avoids heavy shadows and skeuomorphism. Instead, it utilizes **Tonal Layers** and **Low-Contrast Outlines**.

- **Surfaces:** Depth is achieved by shifting background colors. The primary canvas is White, while secondary sections or sidebars use the Neutral Grey (#F8F9FA).
- **Outlines:** Use 1px solid borders in a light grey (#DEE2E6) to define cards and input fields.
- **Active Elevation:** When an element requires a shadow (such as a modal or dropdown), use a very soft, "ambient shadow" with 0px offset, 8px blur, and 5% opacity black. This keeps the UI feeling light and modern rather than heavy.

## Shapes

The design system uses a **Soft (1)** shape language. This adds a subtle modern touch to an otherwise rigid institutional structure without feeling overly casual or "bubbly."

- **Standard Elements:** Buttons, input fields, and small cards use a 4px (0.25rem) corner radius.
- **Large Containers:** Larger blocks or feature sections may use 8px (0.5rem) to soften the layout.
- **Data Points:** Badges or status indicators may use a pill-shape (full rounding) to differentiate them from functional UI components.

## Components

- **Buttons:** Primary buttons are solid Institutional Red with White text. Secondary buttons use a Slate Grey outline with Slate Grey text. Ensure a 48px minimum hit target for accessibility.
- **Input Fields:** Use a 1px Grey border with Public Sans Regular text. On focus, the border transitions to Institutional Red with a subtle 2px outer glow.
- **Cards:** Cards should be White with a subtle 1px Grey border. Headers within cards should use the Institutional Red as an accent line or for the title text to maintain brand consistency.
- **Chips & Badges:** Use for categories and status. Badges use light-tinted backgrounds of the status color with high-contrast dark text.
- **Lists:** Clean, horizontal dividers (1px) should separate list items. Use chevron icons for navigation-heavy lists to indicate drill-down actions.
- **Navigation:** Top navigation should be clean and white with Institutional Red used only for the active state indicator (a bottom border or bold text).