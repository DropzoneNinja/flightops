import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');
import { Pilot } from '../database/entities/pilot.entity';
import { LogbookEntryResponse } from './logbook.service';

// ── Layout constants ──────────────────────────────────────────────
const ML = 45;          // left margin
const MR = 550;         // right edge  (595.28 - 45)
const PAGE_BOTTOM = 795; // break before here (leaves room for footer)

// Data-row column positions
const C_NUM   = { x: ML,       w: 28 };
const C_DATE  = { x: ML + 28,  w: 78 };
const C_DUR   = { x: ML + 106, w: 52 };
const C_DIST  = { x: ML + 158, w: 56 };
const C_ALT   = { x: ML + 214, w: 60 };
const C_EQUIP = { x: ML + 274, w: MR - (ML + 274) }; // 231

// Sub-rows start under the date column and span to the right edge
const SUB_X = ML + 28;
const SUB_W = MR - (ML + 28);

// ── Helpers ───────────────────────────────────────────────────────

/** Draw multiple cells that all start at the same baseline Y. Returns the max bottom Y reached. */
function row(
  doc: any,
  y: number,
  cells: Array<{ x: number; w: number; text: string; align?: 'left' | 'right' | 'center' }>,
): number {
  let maxY = y;
  for (const cell of cells) {
    doc.text(cell.text, cell.x, y, { width: cell.w, align: cell.align ?? 'left', lineBreak: true });
    if (doc.y > maxY) maxY = doc.y;
  }
  return maxY;
}

function fmtDur(s: number | null): string {
  if (!s) return '-';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtDist(m: number | null): string {
  return m ? `${(m / 1000).toFixed(1)} km` : '-';
}
function fmtAlt(m: number | null): string {
  return m ? `${Math.round(m * 3.28084)} ft` : '-';
}
function fmtSpeed(mps: number | null): string {
  return mps ? `${(mps * 3.6).toFixed(0)} km/h` : '-';
}
function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function compassDir(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}
function stars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating));
}

// ── Column header ─────────────────────────────────────────────────

function drawColumnHeader(doc: any): void {
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#444444');
  // Each cell drawn at the same saved Y — no continued:true
  doc.text('#',          C_NUM.x,   y, { width: C_NUM.w });
  doc.text('Date',       C_DATE.x,  y, { width: C_DATE.w });
  doc.text('Duration',   C_DUR.x,   y, { width: C_DUR.w,   align: 'right' });
  doc.text('Distance',   C_DIST.x,  y, { width: C_DIST.w,  align: 'right' });
  doc.text('Max Alt',    C_ALT.x,   y, { width: C_ALT.w,   align: 'right' });
  doc.text('Wing / Engine', C_EQUIP.x, y, { width: C_EQUIP.w });
  // Advance past the header row (all cells are single line at size 8)
  doc.y = y + 14;
  doc.fillColor('#000000');
  doc.moveTo(ML, doc.y).lineTo(MR, doc.y).strokeColor('#aaaaaa').lineWidth(0.5).stroke()
    .strokeColor('#000000').lineWidth(1);
  doc.y += 6;
}

@Injectable()
export class LogbookPdfService {
  generate(pilot: Pilot, entries: LogbookEntryResponse[]): Readable {
    const doc = new PDFDocument({ margin: 45, size: 'A4', autoFirstPage: true, bufferPages: true });

    const active = entries.filter((e) => !e.deleted_at);
    active.sort((a, b) => a.flight_date.localeCompare(b.flight_date));

    // ── Summary totals ──────────────────────────────────────────────
    const totalFlights = active.length;
    const totalSecs = active.reduce((s, e) => s + (e.analyzed_duration_seconds ?? e.duration_seconds ?? 0), 0);
    const totalHours = totalSecs / 3600;
    const totalDistKm = active.reduce((s, e) => s + (e.analyzed_distance_m ?? e.distance_m ?? 0), 0) / 1000;
    const maxAltM = Math.max(0, ...active.map((e) => e.analyzed_max_altitude_m ?? e.max_altitude_m ?? 0));
    const catCounts: Record<string, number> = {};
    for (const e of active) {
      const cat = e.category ?? 'Uncategorised';
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }

    // ── Page title ──────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#000000')
      .text('Pilot Logbook', { align: 'center' })
      .moveDown(0.4);
    doc.font('Helvetica').fontSize(11).fillColor('#333333')
      .text(`Pilot: ${pilot.display_name}`, { align: 'center' })
      .text(`Generated: ${new Date().toISOString().split('T')[0]}`, { align: 'center' })
      .moveDown(1.2);

    // ── Summary box ─────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Summary');
    doc.moveTo(ML, doc.y + 2).lineTo(MR, doc.y + 2).stroke();
    doc.y += 8;
    doc.font('Helvetica').fontSize(9).fillColor('#222222');
    doc.text(`Total flights: ${totalFlights}`, ML, doc.y);
    doc.y += 12;
    doc.text(`Total airtime: ${totalHours.toFixed(1)} h`, ML, doc.y);
    doc.y += 12;
    doc.text(`Total distance: ${totalDistKm.toFixed(1)} km`, ML, doc.y);
    doc.y += 12;
    if (maxAltM > 0) { doc.text(`Max altitude: ${Math.round(maxAltM * 3.28084)} ft`, ML, doc.y); doc.y += 12; }
    if (Object.keys(catCounts).length) {
      doc.text(`By category: ${Object.entries(catCounts).map(([k, v]) => `${k} (${v})`).join(', ')}`, ML, doc.y);
      doc.y += 12;
    }
    doc.y += 20;
    doc.fillColor('#000000');

    // ── Column header (first occurrence) ───────────────────────────
    drawColumnHeader(doc);

    // ── Entries ────────────────────────────────────────────────────
    for (const e of active) {
      const rawDur  = e.analyzed_duration_seconds ?? e.duration_seconds;
      const rawDist = e.analyzed_distance_m ?? e.distance_m;
      const rawAlt  = e.analyzed_max_altitude_m ?? e.max_altitude_m;
      const equip   = [e.wing, e.engine].filter(Boolean).join(' / ') || '-';
      const flightNum = e.flight_number != null ? String(e.flight_number) : '-';

      // Estimate space needed for this entry (rough minimum)
      const hasStats   = !!(e.start_at || e.avg_speed_mps || e.max_climb_mps);
      const hasWeather = !!e.weather_snapshot;
      const hasNotes   = !!(e.notes);
      const hasCatEtc  = !!(e.category || e.rating || e.flight_purpose);
      const linesNeeded = 1 + 1 + (hasStats ? 1 : 0) + (hasWeather ? 1 : 0) + (hasNotes ? 1 : 0) + (hasCatEtc ? 1 : 0);
      const spaceNeeded = 28 + linesNeeded * 15 + 20; // pre-gap + content + separator zone

      if (doc.y + spaceNeeded > PAGE_BOTTOM) {
        doc.addPage();
        drawColumnHeader(doc);
      }

      const entryTopY = doc.y + 12; // pre-entry breathing room

      // ── Row 1: main data ──────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
      const r1Bottom = row(doc, entryTopY, [
        { x: C_NUM.x,   w: C_NUM.w,   text: flightNum },
        { x: C_DATE.x,  w: C_DATE.w,  text: e.flight_date },
        { x: C_DUR.x,   w: C_DUR.w,   text: fmtDur(rawDur),    align: 'right' },
        { x: C_DIST.x,  w: C_DIST.w,  text: fmtDist(rawDist),  align: 'right' },
        { x: C_ALT.x,   w: C_ALT.w,   text: fmtAlt(rawAlt),    align: 'right' },
        { x: C_EQUIP.x, w: C_EQUIP.w, text: equip },
      ]);

      let curY = r1Bottom + 5;

      // ── Row 2: launch / landing ───────────────────────────────────
      const launch  = e.launch_site_name;
      const landing = e.landing_site_name;
      let siteLine = '';
      if (launch && landing && launch !== landing) {
        siteLine = `${launch}  ->  ${landing}`;
      } else if (launch) {
        siteLine = launch;
      } else if (e.title) {
        siteLine = e.title;
      }
      if (siteLine) {
        doc.font('Helvetica').fontSize(9).fillColor('#111111');
        doc.text(siteLine, SUB_X, curY, { width: SUB_W });
        curY = doc.y + 4;
      }

      // ── Row 3: time & flight stats ─────────────────────────────────
      const statParts: string[] = [];
      if (e.start_at) {
        const t = `${fmtTime(e.start_at)}${e.end_at ? ' - ' + fmtTime(e.end_at) : ''}`;
        statParts.push(t);
      }
      if (e.avg_speed_mps) statParts.push(`Avg speed: ${fmtSpeed(e.avg_speed_mps)}`);
      if (e.max_climb_mps != null && e.max_climb_mps > 0) statParts.push(`Max climb: ${e.max_climb_mps.toFixed(1)} m/s`);
      if (e.max_sink_mps != null && e.max_sink_mps < 0) statParts.push(`Max sink: ${Math.abs(e.max_sink_mps).toFixed(1)} m/s`);

      if (statParts.length) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#444444');
        doc.text(statParts.join('   ·   '), SUB_X, curY, { width: SUB_W });
        curY = doc.y + 4;
      }

      // ── Row 4: weather ─────────────────────────────────────────────
      if (e.weather_snapshot) {
        const w = e.weather_snapshot;
        const wParts: string[] = [];
        if (w.temperature_c != null) wParts.push(`${w.temperature_c.toFixed(0)}°C`);
        if (w.wind_speed_kmh != null) {
          let ws = `Wind: ${w.wind_speed_kmh.toFixed(0)} km/h`;
          if (w.wind_direction_deg != null) ws += ` ${compassDir(w.wind_direction_deg)}`;
          if (w.gust_speed_kmh != null) ws += ` (gusts ${w.gust_speed_kmh.toFixed(0)} km/h)`;
          wParts.push(ws);
        }
        if (w.precipitation_mm != null && w.precipitation_mm > 0) wParts.push(`Rain: ${w.precipitation_mm.toFixed(1)} mm`);
        if (w.cloud_cover_pct != null) wParts.push(`Cloud: ${Math.round(w.cloud_cover_pct)}%`);
        if (w.cloud_base_m != null) wParts.push(`Ceiling: ${Math.round(w.cloud_base_m * 3.28084)} ft`);

        if (wParts.length) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#444444');
          doc.text(wParts.join('   ·   '), SUB_X, curY, { width: SUB_W });
          curY = doc.y + 4;
        }
      }

      // ── Row 5: notes ───────────────────────────────────────────────
      if (e.notes) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#333333');
        doc.text(e.notes, SUB_X, curY, { width: SUB_W });
        curY = doc.y + 4;
      }

      // ── Row 6: category / rating / purpose ─────────────────────────
      const metaParts: string[] = [];
      if (e.category) metaParts.push(e.category);
      if (e.flight_purpose) metaParts.push(e.flight_purpose);
      if (e.rating) metaParts.push(stars(e.rating));

      if (metaParts.length) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#666666');
        doc.text(metaParts.join('   ·   '), SUB_X, curY, { width: SUB_W });
        curY = doc.y + 4;
      }

      // ── Separator ──────────────────────────────────────────────────
      doc.y = curY + 8;
      doc.moveTo(ML, doc.y).lineTo(MR, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke()
        .strokeColor('#000000').lineWidth(1);
      doc.y += 2;
    }

    // ── Footer on every page ────────────────────────────────────────
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      doc.font('Helvetica').fontSize(7).fillColor('#888888')
        .text(
          `Private logbook  —  ${pilot.display_name}   |   Page ${i + 1} of ${pages.count}`,
          ML, doc.page.height - 28,
          { align: 'center', width: MR - ML },
        )
        .fillColor('#000000');
    }

    doc.end();
    return doc as unknown as Readable;
  }
}
