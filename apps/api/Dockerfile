FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
RUN npm install

FROM deps AS build
COPY . .
RUN npm run db:generate \
 && npm run build:packages \
 && npm run build -w @ml-ims/api

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@ml-ims/api"]
