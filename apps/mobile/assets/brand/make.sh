#!/bin/sh
# Regenerates the FamilyGuard mark SVGs. Arc = shelter; tall figure = parent, small = child, holding hands.
fig() { # $1 parent colour, $2 child colour
  cat <<SVG
<path d="M277 685.5 A250 250 0 1 1 747 685.5" fill="none" stroke="$1" stroke-width="80" stroke-linecap="round"/>
<g fill="none" stroke="$1" stroke-width="40" stroke-linecap="round" stroke-linejoin="round">
<path d="M440 532 V624 M440 624 L410 706 M440 624 L470 706 M440 560 L408 632 M440 560 L516 634"/></g>
<circle cx="440" cy="470" r="46" fill="$1"/>
<g fill="none" stroke="$2" stroke-width="36" stroke-linecap="round" stroke-linejoin="round">
<path d="M592 606 V662 M592 662 L572 708 M592 662 L612 708 M592 624 L524 636 M592 624 L618 668"/></g>
<circle cx="592" cy="560" r="34" fill="$2"/>
SVG
}
svg() { echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">'"$1$(fig "$2" "$3")"'</svg>' > "$4"; }
svg '<rect width="1024" height="1024" fill="#2F6B4F"/>' '#FFFFFF' '#BFE3CF' icon.svg
svg '' '#FFFFFF' '#BFE3CF' adaptive-foreground.svg
svg '' '#FFFFFF' '#FFFFFF' monochrome.svg
svg '' '#2F6B4F' '#7FB79A' mark-green.svg
echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#2F6B4F"/></svg>' > adaptive-background.svg
