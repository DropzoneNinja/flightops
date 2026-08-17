/**
 * One-time (re-runnable) backfill that merges logbook entries which were
 * split across the two independent ingestion paths — web GPX upload and
 * flightnow mobile sync — for the same real flight. See LogbookMergeService
 * for the matching/merge logic and why re-running this is always safe.
 *
 * Usage:
 *   npm run logbook:merge-backfill -- --dry-run
 *   npm run logbook:merge-backfill
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { LogbookMergeService } from '../../logbook/logbook-merge.service';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const mergeService = app.get(LogbookMergeService);
    const summary = await mergeService.backfillMergeDuplicates({ dryRun });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
