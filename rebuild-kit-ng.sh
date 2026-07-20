#!/usr/bin/env zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
STARTER_DIR="/Users/uji/development/restheart-cloud/restheart-cloud-starter-ng"

echo "Building @restheart-cloud/kit..."
npm run build -w packages/kit

echo "Building @restheart-cloud/kit-ng..."
npm run build -w packages/kit-ng

echo "Linking @restheart-cloud/kit..."
npm link -w packages/kit

echo "Linking @restheart-cloud/kit-ng..."
(cd packages/kit-ng/dist && npm link)

echo "Linking into starter..."
cd "$STARTER_DIR" && npm link @restheart-cloud/kit @restheart-cloud/kit-ng

echo "Clearing starter cache..."
rm -rf "$STARTER_DIR/.angular/cache"

cd "$SCRIPT_DIR"
echo "Done. Restart ng serve if needed."
