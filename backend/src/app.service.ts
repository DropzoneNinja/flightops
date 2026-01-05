import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'flightops-backend',
    };
  }

  getInfo(): object {
    return {
      name: 'FlightOps Backend API',
      version: '1.0.0',
      description: 'Paramotor flight site weather visualization API',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
