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

  // CSRF protection with custom token value function
  // Accepts token from header (X-CSRF-Token or XSRF-Token) or body/query (_csrf)
  app.use(
    csurf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      },
      value: (req) => {
        // Check for token in headers first (common for SPAs)
        const headerToken = req.headers['x-csrf-token'] || req.headers['xsrf-token'];
        if (headerToken) {
          return headerToken as string;
        }
        // Fallback to body or query parameter
        return req.body?._csrf || req.query?._csrf;
      },
    }),
  );

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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend server running on http://localhost:${port}`);
  console.log(`🔒 Security: Helmet + CSRF protection enabled`);
}

bootstrap();
