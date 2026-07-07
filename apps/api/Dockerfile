FROM node:18-alpine

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/crypto/package.json packages/crypto/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm -r --filter './packages/*' build
RUN pnpm --filter @zerodrive/api build

RUN pnpm prune --prod

EXPOSE 3001

CMD ["pnpm", "--filter", "@zerodrive/api", "start"]
