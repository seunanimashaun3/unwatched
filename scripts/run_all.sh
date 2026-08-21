#!/usr/bin/env bash
# Rebuild data for every supported city, then the index.
# Usage: ./scripts/run_all.sh [slug ...]   (default: all cities in cities.py)
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate

if [ "$#" -gt 0 ]; then
  CITIES=("$@")
else
  # portable (works on macOS bash 3.2): read newline-separated slugs into array
  CITIES=()
  while IFS= read -r slug; do
    [ -n "$slug" ] && CITIES+=("$slug")
  done < <(PYTHONPATH=scripts python -c "from cities import all_slugs; print('\n'.join(all_slugs()))")
fi

for slug in "${CITIES[@]}"; do
  echo "=================== $slug ==================="
  python scripts/extract_cameras.py "$slug"
  sleep 5   # be gentle with Overpass between cities
  python scripts/extract_overture.py "$slug"
  python scripts/build_graph.py "$slug"
done

python scripts/build_index.py
echo "ALL DONE"
