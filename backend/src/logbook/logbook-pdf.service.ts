import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');
import { Pilot } from '../database/entities/pilot.entity';
import { LogbookEntryResponse } from './logbook.service';

@Injectable()
export class LogbookPdfService {
  private readonly logger = new Logger(LogbookPdfService.name);

  generate(pilot: Pilot, entries: LogbookEntryResponse[]): Readable {
    const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true, bufferPages: true });

    const active = entries.filter((e) => !e.deleted_at);
    active.sort((a, b) => a.flight_date.localeCompare(b.flight_date));

    // --- Summary totals ---
    const totalFlights = active.length;
    const totalSeconds = active.reduce((s, e) => s + (e.analyzed_duration_seconds ?? e.duration_seconds ?? 0), 0);
    const totalHours = totalSeconds / 3600;
    const totalDistKm = active.reduce((s, e) => s + (e.analyzed_distance_m ?? e.distance_m ?? 0), 0) / 1000;
    const maxAlt = Math.max(...active.map((e) => e.analyzed_max_altitude_m ?? e.max_altitude_m ?? 0));
    const catCounts: Record<string, number> = {};
    for (const e of active) {
      const cat = e.category ?? 'Uncategorised';
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }

    // Header
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('Pilot Logbook', { align: 'center' })
      .moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(12)
      .text(`Pilot: ${pilot.display_name}`, { align: 'center' })
      .text(`Generated: ${new Date().toISOString().split('T')[0]}`, { align: 'center' })
      .moveDown(1);

    // Summary box
    doc.font('Helvetica-Bold').fontSize(11).text('Summary');
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Total flights: ${totalFlights}`);
    doc.text(`Total hours: ${totalHours.toFixed(1)} h`);
    doc.text(`Total distance: ${totalDistKm.toFixed(1)} km`);
    if (maxAlt > 0) doc.text(`Max altitude: ${Math.round(maxAlt * 3.28084)} ft`);
    if (Object.keys(catCounts).length) {
      doc.text(`By category: ${Object.entries(catCounts).map(([k, v]) => `${k} (${v})`).join(', ')}`);
    }
    doc.moveDown(1);

    // Column header
    doc.font('Helvetica-Bold').fontSize(9);
    const colNum = 40, colDate = 68, colSite = 126, colDur = 258, colDist = 300, colAlt = 342, colEquip = 384;
    doc.text('#', colNum, doc.y, { continued: true, width: 25 });
    doc.text('Date', colDate, doc.y, { continued: true, width: 55 });
    doc.text('Launch → Landing', colSite, doc.y, { continued: true, width: 129 });
    doc.text('Dur (min)', colDur, doc.y, { continued: true, width: 39 });
    doc.text('Dist (km)', colDist, doc.y, { continued: true, width: 39 });
    doc.text('Alt (ft)', colAlt, doc.y, { continued: true, width: 39 });
    doc.text('Wing/Engine', colEquip, doc.y, { width: 171 });
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(8);

    for (const e of active) {
      // Start a new page if close to the bottom
      if (doc.y > 750) doc.addPage();

      const rawDur = e.analyzed_duration_seconds ?? e.duration_seconds;
      const rawDist = e.analyzed_distance_m ?? e.distance_m;
      const rawAlt = e.analyzed_max_altitude_m ?? e.max_altitude_m;
      const dur = rawDur ? Math.round(rawDur / 60) : '-';
      const dist = rawDist ? (rawDist / 1000).toFixed(1) : '-';
      const alt = rawAlt ? Math.round(rawAlt * 3.28084) : '-';
      const sites = [e.launch_site_name, e.landing_site_name].filter(Boolean).join(' → ') || e.title || '-';
      const equip = [e.wing, e.engine].filter(Boolean).join(' / ') || '-';
      const flightNum = e.flight_number != null ? String(e.flight_number) : '-';

      const rowY = doc.y;
      doc.text(flightNum, colNum, rowY, { width: 25 });
      doc.text(e.flight_date, colDate, rowY, { width: 55 });
      doc.text(sites, colSite, rowY, { width: 129 });
      doc.text(String(dur), colDur, rowY, { width: 39 });
      doc.text(String(dist), colDist, rowY, { width: 39 });
      doc.text(String(alt), colAlt, rowY, { width: 39 });
      doc.text(equip, colEquip, rowY, { width: 171 });

      // Weather one-liner and notes on next line
      const details: string[] = [];
      if (e.weather_snapshot) {
        const w = e.weather_snapshot;
        const wParts: string[] = [];
        if (w.temperature_c != null) wParts.push(`${w.temperature_c.toFixed(0)}°C`);
        if (w.wind_speed_kmh != null) wParts.push(`wind ${w.wind_speed_kmh.toFixed(0)} km/h`);
        if (w.wind_direction_deg != null) wParts.push(`${compassDir(w.wind_direction_deg)}`);
        if (wParts.length) details.push(`Weather: ${wParts.join(', ')}`);
      }
      if (e.notes) details.push(`Notes: ${e.notes}`);
      if (e.category) details.push(e.category);
      if (e.rating) details.push(`★${e.rating}`);

      if (details.length) {
        doc
          .moveDown(0.5)
          .font('Helvetica-Oblique')
          .fontSize(7)
          .fillColor('#555555')
          .text(details.join('  ·  '), colSite, doc.y, { width: 510 })
          .font('Helvetica')
          .fillColor('#000000')
          .fontSize(8);
      }

      doc.moveDown(0.4);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#dddddd').stroke().strokeColor('#000000');
      doc.moveDown(0.1);
    }

    // Footer on each page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#888888')
        .text(
          `Private logbook — ${pilot.display_name}   |   Page ${i + 1} of ${pages.count}`,
          40,
          doc.page.height - 30,
          { align: 'center', width: doc.page.width - 80 },
        )
        .fillColor('#000000');
    }

    doc.end();
    return doc as unknown as Readable;
  }
}

function compassDir(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
