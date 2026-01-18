import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { GeocodingResponse } from '../interfaces/geocoding-response.interface';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly BASE_URL = 'https://nominatim.openstreetmap.org';
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second (Nominatim rate limit)

  constructor() {
    // Force IPv4 by creating custom agent (following OpenMeteoService pattern)
    const httpsAgent = new https.Agent({
      family: 4, // Force IPv4
      keepAlive: true,
      timeout: 10000,
    });

    this.axiosInstance = axios.create({
      baseURL: this.BASE_URL,
      timeout: 10000, // 10 second timeout
      httpsAgent,
      headers: {
        'User-Agent': 'FlightOps-Geocoding-Service/1.0',
      },
    });
  }

  /**
   * Reverse geocode coordinates to get nearest address
   * @param lat Latitude
   * @param lon Longitude
   * @returns Geocoding response with formatted address
   */
  async reverseGeocode(lat: number, lon: number): Promise<GeocodingResponse> {
    // Rate limiting logic - ensure 1 second between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const delay = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      this.logger.debug(`Rate limiting: waiting ${delay}ms before next request`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      this.logger.log(`Reverse geocoding coordinates: (${lat}, ${lon})`);

      const response = await this.axiosInstance.get('/reverse', {
        params: {
          lat,
          lon,
          format: 'json',
          addressdetails: 1,
        },
      });

      this.lastRequestTime = Date.now();

      const formattedAddress = this.formatAddress(response.data);
      this.logger.log(`Successfully geocoded: "${formattedAddress}"`);

      return {
        formattedAddress,
        displayName: response.data.display_name || formattedAddress,
      };
    } catch (error) {
      this.logger.error(`Reverse geocoding failed: ${error.message}`);
      throw new Error(`Geocoding service error: ${error.message}`);
    }
  }

  /**
   * Format address from Nominatim response components
   * @param data Nominatim API response
   * @returns Formatted address string
   */
  private formatAddress(data: any): string {
    if (!data.address) {
      return data.display_name || 'Address not found';
    }

    const addr = data.address;
    const parts = [
      addr.house_number,
      addr.road,
      addr.suburb || addr.neighbourhood,
      addr.city || addr.town || addr.village,
      addr.state,
      addr.country,
    ].filter(Boolean);

    return parts.join(', ') || data.display_name || 'Address not found';
  }
}
