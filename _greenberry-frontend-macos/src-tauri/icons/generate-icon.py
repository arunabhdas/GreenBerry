#!/usr/bin/env python3
"""GreenBerry app-icon generator. Flat, premium, green, berry-as-synecdoche,
native macOS Big Sur squircle. Emits 3 variants: pale | green | raspberry."""
import math, sys

S = 1024
SQ = 824
X0 = (S - SQ) / 2
Y0 = (S - SQ) / 2 - 6
R = SQ * 0.2237
BCX, BCY, BR = 512, 566, 202

def star(cx, cy, outer, inner, points=5, rot=-90):
    pts = []
    for i in range(points * 2):
        r = outer if i % 2 == 0 else inner
        a = math.radians(rot + i * (360 / (points * 2)))
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return "M " + " L ".join(f"{x:.2f},{y:.2f}" for x, y in pts) + " Z"

DEFS_COMMON = f'''
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2FD07E"/><stop offset="0.55" stop-color="#16A94F"/><stop offset="1" stop-color="#0B7A3B"/>
    </linearGradient>
    <radialGradient id="bgGlow" cx="0.5" cy="0.12" r="0.9">
      <stop offset="0" stop-color="#7BF0AD" stop-opacity="0.45"/><stop offset="0.5" stop-color="#7BF0AD" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2BB86A"/><stop offset="1" stop-color="#0C7A3E"/>
    </linearGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="sqShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#04361B" flood-opacity="0.28"/>
    </filter>'''

def bg_layers():
    return f'''
  <g filter="url(#sqShadow)"><rect x="{X0}" y="{Y0}" width="{SQ}" height="{SQ}" rx="{R:.1f}" ry="{R:.1f}" fill="url(#bg)"/></g>
  <rect x="{X0}" y="{Y0}" width="{SQ}" height="{SQ}" rx="{R:.1f}" ry="{R:.1f}" fill="url(#bgGlow)"/>
  <rect x="{X0}" y="{Y0}" width="{SQ}" height="{SQ}" rx="{R:.1f}" ry="{R:.1f}" fill="none" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="3"/>'''

def leaf(cx, cy):
    return f'''
  <g transform="rotate(20 {cx} {cy})">
    <path d="M {cx+8} {cy+14} C {cx+120} {cy-70}, {cx+232} {cy-40}, {cx+250} {cy+40}
             C {cx+150} {cy+70}, {cx+40} {cy+70}, {cx+8} {cy+14} Z" fill="url(#leaf)"/>
    <path d="M {cx+22} {cy+30} C {cx+110} {cy-8}, {cx+180} {cy}, {cx+236} {cy+34}"
          fill="none" stroke="#9DEBBE" stroke-opacity="0.7" stroke-width="6" stroke-linecap="round"/>
  </g>'''

def calyx(cx, cy, dark, dot):
    return f'''
  <circle cx="{cx}" cy="{cy}" r="66" fill="#0B7A3B" fill-opacity="0.10"/>
  <path d="{star(cx, cy, 58, 25)}" fill="{dark}"/>
  <circle cx="{cx}" cy="{cy}" r="12" fill="{dot}"/>'''

def sphere_berry(defs_grad, hi_op, rim_op=0.0):
    """Single glossy berry using gradient id 'berry'. rim_op adds a crisp
    silhouette ring so a tonal berry stays legible on the green background."""
    top = BCY - BR + 22
    rim = (f'  <circle cx="{BCX}" cy="{BCY}" r="{BR}" fill="none" '
           f'stroke="#06421F" stroke-opacity="{rim_op}" stroke-width="5"/>\n') if rim_op else ""
    body = f'''
  <ellipse cx="{BCX}" cy="{BCY+BR-6}" rx="{BR*0.82:.0f}" ry="46" fill="#04361B" fill-opacity="0.22" filter="url(#soft)"/>
{leaf(BCX, BCY-BR)}
  <circle cx="{BCX}" cy="{BCY}" r="{BR}" fill="url(#berry)"/>
{rim}  <path d="M {BCX+BR} {BCY} A {BR} {BR} 0 0 1 {BCX-40} {BCY+BR-8} A {BR*0.9:.0f} {BR*0.9:.0f} 0 0 0 {BCX+BR} {BCY} Z" fill="#07361C" fill-opacity="0.12"/>
  <ellipse cx="{BCX-70}" cy="{BCY-92}" rx="52" ry="34" fill="#FFFFFF" fill-opacity="{hi_op}" transform="rotate(-28 {BCX-70} {BCY-92})"/>
{calyx(BCX, top, "#0A5C30", "#12924A")}'''
    return defs_grad, body

def raspberry():
    """Aggregate berry: hex-packed drupelets clipped to a compact rounded lump
    (raspberry/mulberry), with a single drupelet tip at the very bottom."""
    cx, cy = BCX, BCY + 4
    dr = 50                      # drupelet radius
    step = dr * 1.7
    vstep = step * 0.86
    RX, RY = 196, 188            # cluster silhouette half-extents
    pts = []
    for row in range(-3, 4):
        y = row * vstep
        off = (step / 2) if (row % 2) else 0
        for col in range(-3, 4):
            x = col * step + off
            # rounded lump; allow a small tail below so it reads as a berry tip
            r2 = (x / RX) ** 2 + (y / RY) ** 2
            tip = (y > 0 and abs(x) < dr * 0.6 and y <= RY + vstep * 0.9)
            if r2 <= 1.04 or tip:
                pts.append((cx + x, cy + y))
    # draw back-to-front (top rows last so they overlap downward)
    pts.sort(key=lambda p: p[1])
    circles = []
    for (x, y) in pts:
        circles.append(
            f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{dr}" fill="url(#drup)"/>'
            f'<ellipse cx="{x-dr*0.32:.0f}" cy="{y-dr*0.34:.0f}" rx="{dr*0.34:.0f}" ry="{dr*0.24:.0f}" '
            f'fill="#FFFFFF" fill-opacity="0.35" transform="rotate(-25 {x-dr*0.32:.0f} {y-dr*0.34:.0f})"/>')
    defs = '''
    <radialGradient id="drup" cx="0.38" cy="0.32" r="0.88">
      <stop offset="0" stop-color="#C8F9DD"/><stop offset="0.5" stop-color="#4FCB88"/><stop offset="1" stop-color="#0C8043"/>
    </radialGradient>'''
    top = cy - RY - 2
    body = f'''
  <ellipse cx="{cx}" cy="{cy+RY-6:.0f}" rx="150" ry="42" fill="#04361B" fill-opacity="0.22" filter="url(#soft)"/>
{leaf(cx+30, top+40)}
  {''.join(circles)}
  <path d="{star(cx, top+30, 60, 25)}" fill="#0A5C30"/>
  <circle cx="{cx}" cy="{top+30}" r="11" fill="#4FCB88"/>'''
    return defs, body

VARIANTS = {
    "pale":  sphere_berry('''
    <radialGradient id="berry" cx="0.38" cy="0.32" r="0.85">
      <stop offset="0" stop-color="#F4FFF8"/><stop offset="0.45" stop-color="#E4FBEC"/><stop offset="1" stop-color="#B4E7C7"/>
    </radialGradient>''', 0.55),
    "green": sphere_berry('''
    <radialGradient id="berry" cx="0.36" cy="0.28" r="0.92">
      <stop offset="0" stop-color="#EAFEF2"/><stop offset="0.4" stop-color="#86E7B3"/><stop offset="1" stop-color="#149B54"/>
    </radialGradient>''', 0.5, rim_op=0.20),
    "raspberry": raspberry(),
}

name = sys.argv[1]
defs_grad, body = VARIANTS[name]
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">
  <defs>{DEFS_COMMON}{defs_grad}</defs>
{bg_layers()}
{body}
</svg>'''
with open(f"icon-{name}.svg", "w") as f:
    f.write(svg)
print("wrote", f"icon-{name}.svg")
