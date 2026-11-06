#!/usr/bin/env bash
set -e

# Install playwright's chromium using puppeteer, not pip

echo "=== Installing puppeteer ==="
npm install puppeteer --no-save --silent 2>&1 | tail -5

# Use system google-chrome instead of installing its own chromium
echo "=== Fixing playwright config ==="
cat > /tmp/playwright-config.json << 'EOF'
{
  "chromium": {
    "executablePath": "/usr/bin/google-chrome-stable",
    "args": ["--headless", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"]
  }
}
EOF

# Install playwright python package (for API)
echo "=== Installing playwright python package ==="
pip3 install --no-cache-dir playwright --break-system-packages 2>&1 | tail -5

# Don't call playwright install chromium
echo "=== Skipping playwright install (using system chrome) ==="

echo "=== Playwright setup complete ==="