# LinerNotes Backend API

NestJS-based backend API for the LinerNotes application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL and JWT secret
```

3. Generate Prisma client:
```bash
npx prisma generate
```

4. Run database migrations:
```bash
npx prisma migrate dev
```

## Development

Start the development server:
```bash
npm run start:dev
```

The API will be available at `http://localhost:3001/api`

## Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

## Project Structure

```
src/
├── prisma/          # Prisma service and module
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── main.ts          # Application entry point
└── app.module.ts    # Root application module
```

## API Configuration

- **Port**: 3001 (configurable via PORT env var)
- **Global prefix**: `/api`
- **CORS**: Enabled for localhost:3000 (web) and localhost:19006 (mobile)
- **Validation**: Global validation pipe enabled with class-validator
