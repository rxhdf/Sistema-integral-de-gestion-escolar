# Sistema de diseño — SIGE

Fuente de verdad para tokens de diseño (color, tipografía, radios,
espaciado) usados en el frontend. Origen: generación Stitch en
`docs/Design_Interfaces_Templates/Login_Interface/DESIGN.md`, aprobada
tal cual el 2026-08-07.

## Logo institucional

El SVG del logo del COBAO vive en `frontend/src/assets/images/cobao_logo.svg`
— esa ruta es la fuente de verdad del asset, no este documento (no se
versiona el binario aquí). `code.html` (mockup de login) lo referencia
como ruta relativa desde `docs/Design_Interfaces_Templates/Login_Interface/`.

## Nota sobre colores — leer antes de tocar esto

La prosa original de `DESIGN.md` describía colores distintos a los
tokens (ej. "Slate Grey", "#212529", "#DEE2E6" para bordes/texto
secundario, que no corresponden a ningún valor del YAML). **Los tokens
YAML de abajo son la fuente de verdad aprobada, no la prosa** — incluye
`outline` café (`#936e69`) y `outline-variant` rosa-tostado
(`#e9bcb6`), que son la identidad visual final y confirmada de SIGE,
no un bug de generación. **No modificar estos colores en futuras
generaciones de Stitch sin aprobación explícita.**

## Tokens (YAML, tal cual `DESIGN.md`)

```yaml
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
```

## Correcciones aplicadas

Al portar estos tokens a `code.html` (Login_Interface), Stitch generó
una escala de `borderRadius` distinta a la de `DESIGN.md` — perdió las
claves `sm`/`md` y desplazó el resto una posición, dejando `full` en
`0.75rem` en vez de `9999px`. Esto rompía visualmente los íconos
circulares de "Centraliza expedientes académicos", "Digitaliza captura
y consulta" y "Acceso basado en roles" (`rounded-full` sobre `w-12
h-12`), que salían como cuadrados con esquina redondeada en vez de
círculos.

- **Corregido**: `borderRadius` en `code.html` ahora usa la escala
  exacta de `DESIGN.md` (`sm=0.125rem`, `DEFAULT=0.25rem`,
  `md=0.375rem`, `lg=0.5rem`, `xl=0.75rem`, `full=9999px`).
- **Corregido**: import duplicado de la fuente "Material Symbols
  Outlined" (`<link>` repetido) eliminado de `code.html`.
- **Colores**: revisados y aprobados sin cambios — ver nota arriba.
  Ningún valor de `colors` fue modificado.
- **Sin tocar**: lógica de negocio (el formulario sigue siendo maqueta
  estática, sin llamada a `POST /auth/login`) y el resto del markup de
  `code.html` quedan exactamente igual; son trabajo pendiente aparte.
