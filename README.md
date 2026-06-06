# Eventful

Eventful is a Node.js and TypeScript backend for an event ticketing platform. It supports creator and eventee authentication, event creation and browsing, ticket purchase with Paystack-style payment flow, QR code generation and scanning, reminders, analytics, caching, rate limiting, and API documentation.

It also includes a lightweight browser frontend served from the same Express app so you can test the API without a separate client project.

## Features

- Authentication and authorization for `CREATOR` and `EVENTEE` roles
- Event creation, listing, detail lookup, share links, and reminder scheduling
- Ticket purchase flow with QR code generation
- QR code scan verification for event access
- Creator analytics for tickets sold, revenue, attendees, and scans
- Creator payment visibility
- Reminder processor scheduled by cron
- Cache layer with Redis fallback to in-memory cache
- Rate limiting and security middleware
- Swagger docs and Postman collection for API exploration

## Tech Stack

- Node.js
- TypeScript
- Express
- Prisma
- MySQL
- Redis-compatible cache
- JWT authentication
- Paystack payment integration
- QRCode generation
- Jest and Supertest for tests

## Project Structure

- `src/app.ts` - Express app setup, middleware, and routes
- `src/server.ts` - Server bootstrap and database connection
- `src/routes/` - API route handlers
- `src/services/` - Business logic services
- `src/middleware/` - Auth and role guards
- `src/jobs/reminderJob.ts` - Cron reminder processor
- `public/` - Static frontend for manual testing and demo use
- `prisma/schema.prisma` - Database schema
- `tests/` - Unit and integration tests
- `postman/` - Postman collection and environment

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`.

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Run database migrations:

```bash
npm run prisma:migrate
```

5. Start the development server:

```bash
npm run dev
```

6. Open the browser UI:

```text
http://localhost:5000
```

## Scripts

- `npm run dev` - Start the server in development mode
- `npm run build` - Compile TypeScript to `dist`
- `npm start` - Run the compiled server
- `npm test` - Run Jest tests
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run Prisma migrations
- `npm run prisma:studio` - Open Prisma Studio

## Environment Variables

The project uses these variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `REDIS_URL`
- `PAYSTACK_SECRET_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `PORT`
- `NODE_ENV`

See `.env.example` for a reference template.

## API Docs

- Swagger UI: `/docs`
- Postman collection: [`postman/Eventful.postman_collection.json`](postman/Eventful.postman_collection.json)
- Postman environment: [`postman/Eventful.postman_environment.json`](postman/Eventful.postman_environment.json)
- Frontend app: `/`

## Main Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /events`
- `GET /events/:id`
- `GET /events/:id/share`
- `POST /events`
- `POST /events/:id/reminders`
- `POST /tickets/events/:eventId/purchase`
- `GET /tickets/me`
- `POST /tickets/scan`
- `GET /analytics/creator/me`
- `GET /analytics/events/:eventId`
- `GET /payments/callback`
- `GET /payments/creator/me`

## Testing

Run the test suite with:

```bash
npm test
```

The current suite covers auth, events, and ticket purchase flows.

## Notes

- The payment flow supports a mock mode for local development when `PAYSTACK_SECRET_KEY=mock` or `NODE_ENV=test`.
- Reminder processing runs automatically through the cron job imported in the server bootstrap.
- Cache reads are used for frequently accessed event and analytics endpoints.
- The frontend is intentionally lightweight and talks directly to the same backend routes documented in Swagger.
