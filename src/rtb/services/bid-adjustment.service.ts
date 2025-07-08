import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from '../constants/cache-keys';
import { AdRequest, UserContext } from './bid-evaluation.service';
import { AgeRangeDto } from '../../ai/dto/targetting-rule.dto';

interface AdjustmentBreakdown {
  baseMultiplier: number;
  deviceMultiplier: number;
  geoMultiplier: number;
  timeMultiplier: number;
  demographicMultiplier: number;
  finalMultiplier: number;
  adjustmentDetails: {
    device: string;
    geo: string;
    time: string;
    demographic: string;
  };
}

@Injectable()
export class BidAdjustmentService {
  private readonly logger = new Logger(BidAdjustmentService.name);

  // India Tier-1 Cities (Premium Markets)
  private readonly INDIA_TIER1_CITIES = [
    'mumbai',
    'delhi',
    'bangalore',
    'bengaluru',
    'hyderabad',
    'chennai',
    'kolkata',
    'pune',
    'ahmedabad',
    'gurgaon',
    'noida',
    'navi mumbai',
    'thane',
  ];

  // India Tier-2 Cities (Secondary Markets)
  private readonly INDIA_TIER2_CITIES = [
    'jaipur',
    'lucknow',
    'kanpur',
    'nagpur',
    'indore',
    'bhopal',
    'visakhapatnam',
    'patna',
    'vadodara',
    'ludhiana',
    'agra',
    'nashik',
    'faridabad',
    'meerut',
    'rajkot',
    'kalyan-dombivali',
    'vasai-virar',
    'varanasi',
    'srinagar',
    'aurangabad',
    'dhanbad',
    'amritsar',
    'navi mumbai',
    'allahabad',
    'ranchi',
    'howrah',
    'coimbatore',
    'jabalpur',
    'gwalior',
    'vijayawada',
    'jodhpur',
    'madurai',
    'raipur',
    'kota',
    'chandigarh',
    'guwahati',
  ];

  // Developed Countries (Premium Markets)
  private readonly PREMIUM_COUNTRIES = [
    'us',
    'uk',
    'ca',
    'au',
    'de',
    'fr',
    'ch',
    'no',
    'se',
    'dk',
    'nl',
    'be',
    'at',
    'fi',
    'ie',
    'nz',
    'jp',
    'sg',
    'hk',
  ];

  // Emerging Markets
  private readonly EMERGING_COUNTRIES = [
    'br',
    'mx',
    'ar',
    'th',
    'my',
    'ph',
    'id',
    'vn',
    'bd',
    'pk',
    'eg',
    'za',
    'ng',
    'ke',
    'tr',
    'pl',
    'cz',
    'hu',
    'ro',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Calculate comprehensive bid adjustments
   */
  public async calculateComprehensiveBidAdjustments(
    campaignId: string,
    baseBidCPM: number,
    context: UserContext,
  ): Promise<{ finalBidCPM: number; breakdown: AdjustmentBreakdown }> {
    try {
      // Get all adjustment multipliers
      const deviceMultiplier = await this.getDeviceAdjustment(
        campaignId,
        context.deviceType,
      );

      const geoMultiplier = await this.getGeographicAdjustment(
        campaignId,
        context.country,
        context.region,
        context.city,
      );
      // get hour, dayOfWeek (not in context)
      const dateInIST = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
      });

      const date = new Date(dateInIST);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const timeMultiplier = this.getTemporalAdjustment(
        hour,
        dayOfWeek, // Sunday = 0 ... Saturday = 6
      );
      const avgAge =
        (Number(context.additionalData?.ageGroup.split('-')[0]) +
          Number(context.additionalData?.ageGroup.split('-')[1])) /
        2;
      const demographicMultiplier = this.getDemographicAdjustment(avgAge);

      // Apply industry-standard multiplicative formula
      const finalMultiplier =
        deviceMultiplier *
        geoMultiplier *
        timeMultiplier *
        demographicMultiplier;
      const finalBidCPM = baseBidCPM * finalMultiplier;

      const breakdown: AdjustmentBreakdown = {
        baseMultiplier: 1.0,
        deviceMultiplier,
        geoMultiplier,
        timeMultiplier,
        demographicMultiplier,
        finalMultiplier,
        adjustmentDetails: {
          device: `${context.deviceType}: ${this.formatMultiplierChange(deviceMultiplier)}`,
          geo: `${context.country}/${context.city || context.region}: ${this.formatMultiplierChange(geoMultiplier)}`,
          time: `${hour}:00, ${dayOfWeek == 0 || dayOfWeek == 6 ? 'Weekend' : 'Weekday'}: ${this.formatMultiplierChange(timeMultiplier)}`,
          demographic: `Age: ${avgAge}: ${this.formatMultiplierChange(demographicMultiplier)}`,
        },
      };

      // this.logger.debug('Bid adjustment calculation completed', {
      //   campaignId,
      //   baseBidCPM,
      //   finalBidCPM,
      //   breakdown,
      // });

      return { finalBidCPM, breakdown };
    } catch (error) {
      this.logger.error('Bid adjustment calculation failed', {
        error: error.message,
        campaignId,
      });

      // Return baseline adjustments on error
      return {
        finalBidCPM: baseBidCPM,
        breakdown: {
          baseMultiplier: 1.0,
          deviceMultiplier: 1.0,
          geoMultiplier: 1.0,
          timeMultiplier: 1.0,
          demographicMultiplier: 1.0,
          finalMultiplier: 1.0,
          adjustmentDetails: {
            device: 'Error - using baseline',
            geo: 'Error - using baseline',
            time: 'Error - using baseline',
            demographic: 'Error - using baseline',
          },
        },
      };
    }
  }

  /**
   * Device-based adjustments following industry standards
   */
  private async getDeviceAdjustment(
    campaignId: string,
    deviceType: string,
  ): Promise<number> {
    const cacheKey = REDIS_KEYS.DEVICE_MULTIPLIER(deviceType, campaignId);

    try {
      // Check cache first
      const cached = await this.redis.get<string>(cacheKey);
      if (cached) {
        return parseFloat(cached);
      }

      // Calculate device adjustment based on industry standards
      let multiplier = 1.0;

      switch (deviceType?.toLowerCase()) {
        case 'mobile':
        case 'smartphone':
          multiplier = 1.25; // +25% for mobile (highest engagement)
          break;

        case 'tablet':
          multiplier = 0.85; // -15% for tablet (lower performance)
          break;

        case 'desktop':
        case 'computer':
          multiplier = 1.0; // Baseline
          break;

        case 'smart_tv':
        case 'connected_tv':
        case 'ctv':
          multiplier = 1.4; // +40% for premium TV inventory
          break;

        default:
          multiplier = 1.0; // Unknown device type
      }

      // Cache for 2 hours
      await this.redis.set(cacheKey, multiplier.toString(), 7200);

      return multiplier;
    } catch (error) {
      this.logger.warn('Device adjustment calculation failed', {
        error: error.message,
        deviceType,
      });
      return 1.0;
    }
  }

  /**
   * Geographic adjustments with India city-level granularity
   */
  private async getGeographicAdjustment(
    campaignId: string,
    country: string,
    region?: string,
    city?: string,
  ): Promise<number> {
    const cacheKey = REDIS_KEYS.GEO_MULTIPLIER(
      `${country}_${region || ''}_${city || ''}`,
      campaignId,
    );

    try {
      // Check cache first
      const cached = await this.redis.get<string>(cacheKey);
      if (cached) {
        return parseFloat(cached);
      }

      let multiplier = 1.0;
      const countryLower = country?.toLowerCase();
      const cityLower = city?.toLowerCase();

      // India-specific city-level adjustments
      if (countryLower === 'in' || countryLower === 'india') {
        if (cityLower && this.INDIA_TIER1_CITIES.includes(cityLower)) {
          multiplier = 1.35; // +35% for Tier-1 Indian cities
        } else if (cityLower && this.INDIA_TIER2_CITIES.includes(cityLower)) {
          multiplier = 1.15; // +15% for Tier-2 Indian cities
        } else {
          multiplier = 0.8; // -20% for Tier-3/rural areas
        }
      }
      // Premium developed countries
      else if (this.PREMIUM_COUNTRIES.includes(countryLower)) {
        const premiumMultipliers = {
          us: 1.5, // +50% for US
          uk: 1.4, // +40% for UK
          ca: 1.35, // +35% for Canada
          au: 1.3, // +30% for Australia
          de: 1.25, // +25% for Germany
          fr: 1.25, // +25% for France
          ch: 1.6, // +60% for Switzerland
          no: 1.5, // +50% for Norway
          se: 1.4, // +40% for Sweden
          dk: 1.35, // +35% for Denmark
          nl: 1.3, // +30% for Netherlands
          jp: 1.4, // +40% for Japan
          sg: 1.45, // +45% for Singapore
          hk: 1.4, // +40% for Hong Kong
        };
        multiplier = premiumMultipliers[countryLower] || 1.2;
      }
      // Emerging markets
      else if (this.EMERGING_COUNTRIES.includes(countryLower)) {
        const emergingMultipliers = {
          br: 0.7, // -30% for Brazil
          mx: 0.75, // -25% for Mexico
          ar: 0.65, // -35% for Argentina
          th: 0.8, // -20% for Thailand
          my: 0.75, // -25% for Malaysia
          ph: 0.7, // -30% for Philippines
          id: 0.7, // -30% for Indonesia
          vn: 0.65, // -35% for Vietnam
        };
        multiplier = emergingMultipliers[countryLower] || 0.7;
      }
      // Other countries (default)
      else {
        multiplier = 0.9; // -10% for other countries
      }

      // Cache for 4 hours
      await this.redis.set(cacheKey, multiplier.toString(), 14400);

      return multiplier;
    } catch (error) {
      this.logger.warn('Geographic adjustment calculation failed', {
        error: error.message,
        country,
        city,
      });
      return 1.0;
    }
  }
  /**
   * Temporal (time-based) adjustments
   */
  private getTemporalAdjustment(
    hour: number,
    dayOfWeek: number, // Sunday = 0 ... Saturday = 6
  ): number {
    const hourMultipliers: Record<number, number> = {
      0: 0.7,
      1: 0.7,
      2: 0.7,
      3: 0.7,
      4: 0.7,
      5: 0.7,
      6: 0.8,
      7: 0.9,
      8: 1.0,
      9: 1.2,
      10: 1.2,
      11: 1.2,
      12: 1.2,
      13: 1.2,
      14: 1.2,
      15: 1.2,
      16: 1.2,
      17: 1.2,
      18: 1.15,
      19: 1.3,
      20: 1.3,
      21: 1.3,
      22: 1.3,
      23: 1.15,
    };

    const dayMultipliers: Record<number, number> = {
      0: 0.9, // Sunday
      1: 1.1, // Monday
      2: 1.1, // Tuesday
      3: 1.1, // Wednesday
      4: 1.1, // Thursday
      5: 1.1, // Friday
      6: 0.9, // Saturday
    };

    const timeMultiplier = hourMultipliers[hour] ?? 1.0;
    const dayMultiplier = dayMultipliers[dayOfWeek] ?? 1.0;

    return timeMultiplier * dayMultiplier;
  }

  /**
   * Demographic adjustments
   */
  private getDemographicAdjustment(userAge?: number): number {
    let ageMultiplier = 1.0;

    // Age-based adjustments
    if (userAge) {
      if (userAge >= 25 && userAge <= 34) {
        ageMultiplier = 1.1; // +10% for peak purchasing power age
      } else if (userAge >= 35 && userAge <= 44) {
        ageMultiplier = 1.15; // +15% for peak earning years
      } else if (userAge >= 45 && userAge <= 54) {
        ageMultiplier = 1.05; // +5% for established professionals
      } else if (userAge >= 18 && userAge <= 24) {
        ageMultiplier = 0.95; // -5% for younger audience
      } else if (userAge >= 55) {
        ageMultiplier = 0.9; // -10% for older audience
      }
    }

    return ageMultiplier;
  }

  /**
   * Format multiplier for logging and debugging
   */
  private formatMultiplierChange(multiplier: number): string {
    const percentage = ((multiplier - 1) * 100).toFixed(1);
    const sign = multiplier >= 1 ? '+' : '';
    return `${sign}${percentage}%`;
  }
}
