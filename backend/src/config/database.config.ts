import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const fileExtension = isProduction ? '.js' : '{.ts,.js}';

  return {
    type: 'postgres',
    host: configService.get<string>('DATABASE_HOST', 'localhost'),
    port: configService.get<number>('DATABASE_PORT', 5432),
    username: configService.get<string>('DATABASE_USER', 'flightops'),
    password: configService.get<string>('DATABASE_PASSWORD', 'changeme'),
    database: configService.get<string>('DATABASE_NAME', 'flightops'),
    entities: [__dirname + `/../**/*.entity${fileExtension}`],
    migrations: [__dirname + `/../database/migrations/*${fileExtension}`],
    synchronize: false, // Use migrations in production
    logging: !isProduction,
    migrationsRun: true, // Auto-run migrations on startup
  };
};

// Data source for TypeORM CLI (migrations)
const isProductionEnv = process.env.NODE_ENV === 'production';
const cliFileExtension = isProductionEnv ? '.js' : '{.ts,.js}';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  username: process.env.DATABASE_USER || 'flightops',
  password: process.env.DATABASE_PASSWORD || 'changeme',
  database: process.env.DATABASE_NAME || 'flightops',
  entities: [__dirname + `/../**/*.entity${cliFileExtension}`],
  migrations: [__dirname + `/../database/migrations/*${cliFileExtension}`],
  synchronize: false,
  logging: true,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
