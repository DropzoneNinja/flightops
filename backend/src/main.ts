import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers with helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", 'blob:'],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    }),
  );

  // Cookie parser (required for CSRF)
  app.use(cookieParser());

  // CSRF protection — browser clients only.
  // Skipped for: Bearer token requests (mobile/native apps) and public auth
  // endpoints that mobile clients hit before they have a token.
  const csrfMiddleware = csurf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
    value: (req) => {
      const headerToken = req.headers['x-csrf-token'] || req.headers['xsrf-token'];
      if (headerToken) return headerToken as string;
      return req.body?._csrf || req.query?._csrf;
    },
  });

  const CSRF_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/check-username'];

  app.use((req, res, next) => {
    if (req.headers.authorization?.startsWith('Bearer ')) return next();
    if (CSRF_EXEMPT_PATHS.some((p) => req.path === p || req.path.endsWith(p))) return next();
    return csrfMiddleware(req, res, next);
  });

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Disable Node.js's default 5-minute requestTimeout (introduced in Node 18).
  // Large file uploads on slow connections easily exceed this, causing the server
  // to reset the socket mid-upload and nginx to return 408 to the client.
  const httpServer = app.getHttpServer();
  httpServer.requestTimeout = 0;

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend server running on http://localhost:${port}`);
  console.log(`🔒 Security: Helmet + CSRF protection enabled`);
}

bootstrap();
