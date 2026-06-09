FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install
COPY integration-test.mjs ./
COPY screen-init.mjs ./

CMD ["node", "integration-test.mjs"]
