import { Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { Parser } from '@openaip/openair-parser';

export interface AirspaceFeature {
  type: 'Feature';
  properties: {
    class: 'A' | 'C' | 'CTR' | 'D' | 'E' | 'G' | 'Q' | 'R' | 'RMZ';
    name: string;
    lower: string;
    upper: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface AirspaceGeoJSON {
  type: 'FeatureCollection';
  features: AirspaceFeature[];
}

@Injectable()
export class AirspaceService {
  private airspaceData: AirspaceGeoJSON;

  /**
   * Preprocess Australian OpenAir format to match parser requirements
   * Converts: xxxFT -> xxxft AMSL, SFC -> GND, BCTA -> FL245
   * Cleans up malformed class definitions
   */
  private preprocessOpenAir(content: string): string {
    return content
      .split('\n')
      .map(line => {
        // Clean up airspace class lines with special characters (e.g., "AC RMZƒ" -> "AC RMZ")
        if (line.match(/^AC\s+/i)) {
          return line.replace(/[^\x20-\x7E]/g, '').trim();
        }
        // Convert altitude definitions with various formats
        // Format: "1500FT" -> "1500ft AMSL"
        if (line.match(/^(AH|AL)\s+\d+FT$/i)) {
          return line.replace(/(\d+)FT$/i, '$1ft AMSL');
        }
        // Format: "700 AGL" -> "700ft AGL"
        if (line.match(/^(AH|AL)\s+(\d+)\s+AGL/i)) {
          return line.replace(/(\d+)\s+AGL/i, '$1ft AGL');
        }
        // Format: "700 AMSL" -> "700ft AMSL"
        if (line.match(/^(AH|AL)\s+(\d+)\s+(AMSL|MSL)/i)) {
          return line.replace(/(\d+)\s+(AMSL|MSL)/i, '$1ft $2');
        }
        // Convert SFC to GND (parser expects GND)
        if (line.match(/^(AH|AL)\s+SFC$/i)) {
          return line.replace(/SFC$/i, 'GND');
        }
        // Convert BCTA (Base of Controlled Airspace) to FL245
        if (line.match(/^(AH|AL)\s+BCTA$/i)) {
          return line.replace(/BCTA$/i, 'FL245');
        }
        // Convert UNL (Unlimited) to FL999
        if (line.match(/^(AH|AL)\s+UNL$/i)) {
          return line.replace(/UNL$/i, 'FL999');
        }
        // Convert NOTAM (defined by Notice to Airmen)
        // For lower limit (AL), use GND; for upper limit (AH), use FL999
        if (line.match(/^AL\s+NOTAM$/i)) {
          return line.replace(/NOTAM$/i, 'GND');
        }
        if (line.match(/^AH\s+NOTAM$/i)) {
          return line.replace(/NOTAM$/i, 'FL999');
        }
        return line;
      })
      .join('\n');
  }

  constructor() {
    // Load and parse OpenAir file once at service initialization
    // In dev: __dirname is dist/src/airspace, path: ../../../src/assets/
    // In production (Docker): __dirname is dist/airspace, assets copied to dist/assets by nest-cli.json
    // Try both paths for compatibility
    const possiblePaths = [
      join(__dirname, '../assets/airspace.openair'),
      join(__dirname, '../../../src/assets/airspace.openair'),
    ];

    let successfulPath: string;
    let parser: Parser;

    for (const filePath of possiblePaths) {
      try {
        console.log(`[AirspaceService] Attempting to load OpenAir from: ${filePath}`);

        // Read and preprocess the OpenAir file
        const rawContent = readFileSync(filePath, 'utf-8');
        const processedContent = this.preprocessOpenAir(rawContent);

        // Write preprocessed content to temp file in /tmp (writable location)
        const tempFilePath = join('/tmp', basename(filePath) + '.processed');
        writeFileSync(tempFilePath, processedContent, 'utf-8');

        parser = new Parser({
          version: '1.0', // Use version 1.0 for more lenient altitude parsing
          validateGeometry: true,
          fixGeometry: false,
          targetAltUnit: 'FT',
        });

        const { success, error } = parser.parse(tempFilePath);

        if (success) {
          successfulPath = filePath;
          console.log(`✅ [AirspaceService] Successfully loaded and preprocessed OpenAir from: ${filePath}`);
          break;
        } else {
          console.error(`❌ [AirspaceService] Parse error at ${filePath}:`, error?.errorMessage);
          throw new Error(error?.errorMessage || 'Unknown parse error');
        }
      } catch (err) {
        console.log(`⚠️  [AirspaceService] Failed to load from ${filePath}, trying next path...`);
        // Try next path
      }
    }

    if (!parser || !successfulPath) {
      throw new Error('[AirspaceService] Could not find or parse airspace.openair in any expected location');
    }

    // Parse OpenAir to GeoJSON
    console.log('[AirspaceService] ⏳ Parsing OpenAir format to GeoJSON...');
    const parsed = parser.toGeojson();

    // Transform to our expected format (convert upperCeiling/lowerCeiling to simple strings)
    this.airspaceData = {
      type: 'FeatureCollection',
      features: parsed.features
        .filter(feature => feature.geometry.type === 'Polygon') // Only keep Polygon geometries
        .map(feature => {
          // Convert ceiling objects to simple altitude strings
          const lowerCeiling = feature.properties.lowerCeiling;
          const upperCeiling = feature.properties.upperCeiling;

          let lower = 'SFC';
          let upper = 'UNLIMITED';

          // Format lower altitude
          if (lowerCeiling) {
            if (lowerCeiling.referenceDatum === 'GND') {
              lower = 'SFC';
            } else if (lowerCeiling.unit === 'FL') {
              lower = `FL${lowerCeiling.value}`;
            } else {
              lower = `${lowerCeiling.value}FT`;
            }
          }

          // Format upper altitude
          if (upperCeiling) {
            if (upperCeiling.unit === 'FL') {
              upper = `FL${upperCeiling.value}`;
            } else {
              upper = `${upperCeiling.value}FT`;
            }
          }

          return {
            type: 'Feature' as const,
            properties: {
              class: feature.properties.class as 'A' | 'C' | 'CTR' | 'D' | 'E' | 'G' | 'Q' | 'R' | 'RMZ',
              name: feature.properties.name,
              lower,
              upper,
            },
            geometry: feature.geometry as any, // Safe to cast since we filtered for Polygon only
          };
        }),
    };

    console.log(`✅ [AirspaceService] Parsed ${this.airspaceData.features.length} airspace features`);
  }

  /**
   * Get all airspace features as GeoJSON
   */
  getAirspace(): AirspaceGeoJSON {
    return this.airspaceData;
  }

  /**
   * Get available airspace classes
   */
  getClasses(): string[] {
    return ['A', 'C', 'CTR', 'D', 'E', 'G', 'Q', 'R', 'RMZ'];
  }

  /**
   * Get description text for a specific airspace class
   */
  getClassDescription(airspaceClass: string): { class: string; description: string } {
    const validClasses = ['A', 'C', 'CTR', 'D', 'E', 'G', 'Q', 'R', 'RMZ'];

    if (!validClasses.includes(airspaceClass)) {
      throw new NotFoundException(`Invalid airspace class: ${airspaceClass}`);
    }

    // Handle classes without description files (CTR, RMZ)
    const filesWithDescriptions = ['A', 'C', 'D', 'E', 'G', 'Q', 'R'];
    if (!filesWithDescriptions.includes(airspaceClass)) {
      return {
        class: airspaceClass,
        description: `Class ${airspaceClass} airspace description not yet available.`
      };
    }

    // Try multiple paths (dev vs production)
    const possiblePaths = [
      join(__dirname, `../assets/class-descriptions/Class${airspaceClass}.txt`),
      join(__dirname, `../../../src/assets/class-descriptions/Class${airspaceClass}.txt`),
    ];

    for (const filePath of possiblePaths) {
      try {
        const description = readFileSync(filePath, 'utf-8');
        return { class: airspaceClass, description: description.trim() };
      } catch (err) {
        // Try next path
        continue;
      }
    }

    throw new NotFoundException(`Description file not found for class ${airspaceClass}`);
  }
}
