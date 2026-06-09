FROM node:20-alpine

WORKDIR /app

# Copy simulator source
COPY package.json ./
COPY fake-pi.js ./
COPY seed.js ./
COPY watch.js ./

# No npm install needed — zero external deps, uses Node 20 built-ins

CMD ["node", "fake-pi.js"]
