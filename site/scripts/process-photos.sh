#!/usr/bin/env bash
# process-photos.sh
# Copies and resizes photos from Google Drive to site/src/images/
# Uses macOS sips to resize to max 1920px wide at 85% JPEG quality.

set -e

PHOTOS_BASE="/Users/matthew/Library/CloudStorage/GoogleDrive-matthew@ayso13.org/Shared drives/Region 13 Operations/Communication/Photos/MY 25"
DEST="$(cd "$(dirname "$0")/.." && pwd)/src/images"

mkdir -p "$DEST"

resize() {
  local src="$1"
  local dest="$2"
  if [[ ! -f "$src" ]]; then
    echo "  ⚠  Missing: $src"
    return
  fi
  echo "  → $(basename "$dest")"
  sips -Z 1920 -s format jpeg -s formatOptions 85 "$src" --out "$dest" 2>/dev/null
}

echo "── Action photos (professional Oct 11 shoot) ──────────────────"
i=1
while IFS= read -r f; do
  [[ $i -gt 20 ]] && break
  resize "$f" "$DEST/action-$(printf '%02d' $i).jpg"
  ((i++))
done < <(find "$PHOTOS_BASE/Output" -maxdepth 1 -iname "*.jpg" | sort)

echo "── Game photos (Oct 11 highlights) ────────────────────────────"
i=1
while IFS= read -r f; do
  [[ $i -gt 10 ]] && break
  resize "$f" "$DEST/game-$(printf '%02d' $i).jpg"
  ((i++))
done < <(find "$PHOTOS_BASE/aysooct11-photo-download-1of1/Highlights" -maxdepth 1 \( -iname "*.jpg" -o -iname "*.jpeg" \) | sort)

echo "── Gary Loitz fall game photos ─────────────────────────────────"
i=1
while IFS= read -r f; do
  [[ $i -gt 6 ]] && break
  resize "$f" "$DEST/fall-game-$(printf '%02d' $i).jpg"
  ((i++))
done < <(find "$PHOTOS_BASE/Gary Loitz 9-27-25/highlights" -maxdepth 1 \( -iname "*.jpg" -o -iname "*.jpeg" \) | sort)

echo "── All-Stars photos ────────────────────────────────────────────"
i=1
while IFS= read -r f; do
  [[ $i -gt 8 ]] && break
  resize "$f" "$DEST/all-stars-$(printf '%02d' $i).jpg"
  ((i++))
done < <(find "$PHOTOS_BASE/All Stars" -maxdepth 1 \( -iname "*.jpg" -o -iname "*.jpeg" \) | sort)

echo "── WCA (Women's Coaching Alliance) photos ──────────────────────"
i=1
while IFS= read -r f; do
  [[ $i -gt 8 ]] && break
  resize "$f" "$DEST/wca-$(printf '%02d' $i).jpg"
  ((i++))
done < <(find "$PHOTOS_BASE/WCA" -maxdepth 1 \( -iname "*.jpg" -o -iname "*.jpeg" \) | sort)

echo "── Winter / Grad Series SELECTS ────────────────────────────────"
i=1
while IFS= read -r f; do
  [[ $i -gt 10 ]] && break
  resize "$f" "$DEST/grad-series-$(printf '%02d' $i).jpg"
  ((i++))
done < <(find "$PHOTOS_BASE/Winter 26 Grad Series Photos/SELECTS" -maxdepth 1 \( -iname "*.jpg" -o -iname "*.JPG" -o -iname "*.jpeg" \) | sort)

echo "── Gary Loitz Sept 13 Victory highlights ───────────────────────"
i=1
while IFS= read -r f; do
  [[ $i -gt 5 ]] && break
  resize "$f" "$DEST/victory-$(printf '%02d' $i).jpg"
  ((i++))
done < <(find "$PHOTOS_BASE/Gary Loitz 9:13:25 Victory/highlights" -maxdepth 1 \( -iname "*.jpg" -o -iname "*.jpeg" \) 2>/dev/null | sort)

echo "── Copy logo SVG ───────────────────────────────────────────────"
cp "$(cd "$(dirname "$0")/../.." && pwd)/logo/ayso13logo.svg" "$DEST/logo.svg"
echo "  → logo.svg"

echo ""
echo "Done. Photos written to: $DEST"
ls "$DEST" | wc -l | xargs echo "Total files:"
