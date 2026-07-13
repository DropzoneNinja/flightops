import { Injectable } from '@nestjs/common';
import { API_VERSION_STRING } from './common/api-version';

// Real app release version (package.json, bumped on every release — see the
// root `npm run version` script). Distinct from API_VERSION_STRING, the
// wire-contract version; see common/api-version.ts.
const { version: appVersion } = require('../package.json');

@Injectable()
export class AppService {
  getHealth(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'flightops-backend',
      apiVersion: API_VERSION_STRING,
    };
  }

  getInfo(): object {
    return {
      name: 'FlightOps Backend API',
      version: appVersion,
      apiVersion: API_VERSION_STRING,
      description: 'Paramotor flight site weather visualization API',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
