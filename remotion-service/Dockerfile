FROM node:20-slim

# Install Chromium and fonts for Remotion rendering
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-dejavu-core \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and public assets (sounds)
COPY . .

# Build TypeScript server
RUN npm run build

EXPOSE 3100

CMD ["node", "dist/server.js"]
