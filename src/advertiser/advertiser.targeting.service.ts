import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdvertiserHelper } from './advertiser.helper';
import {
  CreateCampaignDemographicTargetingDto,
  UpdateCampaignDemographicTargetingDto,
} from './dto/targeting/demographic-targeting.dto';
import {
  CreateCampaignGeographicTargetingDto,
  UpdateCampaignGeographicTargetingDto,
} from './dto/targeting/geographic-targeting.dto';
import {
  CreateCampaignDeviceTargetingDto,
  UpdateCampaignDeviceTargetingDto,
} from './dto/targeting/device-targeting.dto';
import {
  CreateCampaignContextualTargetingDto,
  UpdateCampaignContextualTargetingDto,
} from './dto/targeting/contextual-targeting.dto';
import {
  CreateCampaignBehavioralTargetingDto,
  UpdateCampaignBehavioralTargetingDto,
} from './dto/targeting/behavioral-targeting.dto';
import {
  CreateCampaignTimeTargetingDto,
  UpdateCampaignTimeTargetingDto,
} from './dto/targeting/time-targeting.dto';
import {
  CreateCampaignFrequencyTargetingDto,
  UpdateCampaignFrequencyTargetingDto,
} from './dto/targeting/frequency-targeting.dto';

@Injectable()
export class AdvertiserTargetingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly advertiserHelper: AdvertiserHelper,
  ) {}

  // ======================
  // DEMOGRAPHIC TARGETING
  // ======================

  async addDemographicTargeting(
    advertiserId: string,
    createDto: CreateCampaignDemographicTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      createDto.campaignId,
    );

    // Validate age range if both are provided
    if (
      createDto.ageMin &&
      createDto.ageMax &&
      createDto.ageMin > createDto.ageMax
    ) {
      throw new BadRequestException(
        'Minimum age cannot be greater than maximum age',
      );
    }

    return this.prisma.demographicTargeting.create({
      data: {
        campaignId: createDto.campaignId,
        ageMin: createDto.ageMin,
        ageMax: createDto.ageMax,
        genders: createDto.genders || [],
        languages: createDto.languages || [],
        education: createDto.education || [],
        incomeRange: createDto.incomeRange || [],
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getDemographicTargeting(advertiserId: string, campaignId: string) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    return this.prisma.demographicTargeting.findMany({
      where: {
        campaignId: campaignId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateDemographicTargeting(
    advertiserId: string,
    id: string,
    updateDto: UpdateCampaignDemographicTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      updateDto.campaignId,
    );

    // Check if the targeting rule exists and belongs to the campaign
    const existingRule = await this.prisma.demographicTargeting.findFirst({
      where: {
        id: id,
        campaignId: updateDto.campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Demographic targeting rule not found');
    }

    // Validate age range if both are provided
    if (
      updateDto.ageMin &&
      updateDto.ageMax &&
      updateDto.ageMin > updateDto.ageMax
    ) {
      throw new BadRequestException(
        'Minimum age cannot be greater than maximum age',
      );
    }

    return this.prisma.demographicTargeting.update({
      where: { id },
      data: {
        ageMin: updateDto.ageMin,
        ageMax: updateDto.ageMax,
        genders: updateDto.genders,
        languages: updateDto.languages,
        education: updateDto.education,
        incomeRange: updateDto.incomeRange,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteDemographicTargeting(
    advertiserId: string,
    campaignId: string,
    id: string,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    const existingRule = await this.prisma.demographicTargeting.findFirst({
      where: {
        id: id,
        campaignId: campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Demographic targeting rule not found');
    }

    await this.prisma.demographicTargeting.delete({
      where: { id },
    });

    return { message: 'Demographic targeting rule deleted successfully' };
  }

  // ======================
  // GEOGRAPHIC TARGETING
  // ======================

  async addGeographicTargeting(
    advertiserId: string,
    createDto: CreateCampaignGeographicTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      createDto.campaignId,
    );

    return this.prisma.geographicTargeting.create({
      data: {
        campaignId: createDto.campaignId,
        countries: createDto.countries || [],
        states: createDto.states || [],
        cities: createDto.cities || [],
        postalCodes: createDto.postalCodes || [],
        radius: createDto.radius,
        latitude: createDto.latitude,
        longitude: createDto.longitude,
        isInclude: createDto.isInclude ?? true,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getGeographicTargeting(advertiserId: string, campaignId: string) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    return this.prisma.geographicTargeting.findMany({
      where: {
        campaignId: campaignId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateGeographicTargeting(
    advertiserId: string,
    id: string,
    updateDto: UpdateCampaignGeographicTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      updateDto.campaignId,
    );

    const existingRule = await this.prisma.geographicTargeting.findFirst({
      where: {
        id: id,
        campaignId: updateDto.campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Geographic targeting rule not found');
    }

    return this.prisma.geographicTargeting.update({
      where: { id },
      data: {
        countries: updateDto.countries,
        states: updateDto.states,
        cities: updateDto.cities,
        postalCodes: updateDto.postalCodes,
        radius: updateDto.radius,
        latitude: updateDto.latitude,
        longitude: updateDto.longitude,
        isInclude: updateDto.isInclude,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteGeographicTargeting(
    advertiserId: string,
    campaignId: string,
    id: string,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    const existingRule = await this.prisma.geographicTargeting.findFirst({
      where: {
        id: id,
        campaignId: campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Geographic targeting rule not found');
    }

    await this.prisma.geographicTargeting.delete({
      where: { id },
    });

    return { message: 'Geographic targeting rule deleted successfully' };
  }

  // ======================
  // DEVICE TARGETING
  // ======================

  async addDeviceTargeting(
    advertiserId: string,
    createDto: CreateCampaignDeviceTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      createDto.campaignId,
    );

    return this.prisma.deviceTargeting.create({
      data: {
        campaignId: createDto.campaignId,
        deviceTypes: createDto.deviceTypes || [],
        operatingSystems: createDto.operatingSystems || [],
        browsers: createDto.browsers || [],
        connectionTypes: createDto.connectionTypes || [],
        minOSVersion: createDto.minOSVersion,
        maxOSVersion: createDto.maxOSVersion,
        deviceModels: createDto.deviceModels || [],
        isInclude: createDto.isInclude ?? true,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getDeviceTargeting(advertiserId: string, campaignId: string) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    return this.prisma.deviceTargeting.findMany({
      where: {
        campaignId: campaignId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateDeviceTargeting(
    advertiserId: string,
    id: string,
    updateDto: UpdateCampaignDeviceTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      updateDto.campaignId,
    );

    const existingRule = await this.prisma.deviceTargeting.findFirst({
      where: {
        id: id,
        campaignId: updateDto.campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Device targeting rule not found');
    }

    return this.prisma.deviceTargeting.update({
      where: { id },
      data: {
        deviceTypes: updateDto.deviceTypes,
        operatingSystems: updateDto.operatingSystems,
        browsers: updateDto.browsers,
        connectionTypes: updateDto.connectionTypes,
        minOSVersion: updateDto.minOSVersion,
        maxOSVersion: updateDto.maxOSVersion,
        deviceModels: updateDto.deviceModels,
        isInclude: updateDto.isInclude,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteDeviceTargeting(
    advertiserId: string,
    campaignId: string,
    id: string,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    const existingRule = await this.prisma.deviceTargeting.findFirst({
      where: {
        id: id,
        campaignId: campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Device targeting rule not found');
    }

    await this.prisma.deviceTargeting.delete({
      where: { id },
    });

    return { message: 'Device targeting rule deleted successfully' };
  }

  // ======================
  // CONTEXTUAL TARGETING
  // ======================

  async addContextualTargeting(
    advertiserId: string,
    createDto: CreateCampaignContextualTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      createDto.campaignId,
    );

    return this.prisma.contextualTargeting.create({
      data: {
        campaignId: createDto.campaignId,
        contentCategories: createDto.contentCategories || [],
        keywords: createDto.keywords || [],
        urlPatterns: createDto.urlPatterns || [],
        pageTypes: createDto.pageTypes || [],
        brandSafety: createDto.brandSafety || [],
        blockedKeywords: createDto.blockedKeywords || [],
        isInclude: createDto.isInclude ?? true,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getContextualTargeting(advertiserId: string, campaignId: string) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    return this.prisma.contextualTargeting.findMany({
      where: {
        campaignId: campaignId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateContextualTargeting(
    advertiserId: string,
    id: string,
    updateDto: UpdateCampaignContextualTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      updateDto.campaignId,
    );

    const existingRule = await this.prisma.contextualTargeting.findFirst({
      where: {
        id: id,
        campaignId: updateDto.campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Contextual targeting rule not found');
    }

    return this.prisma.contextualTargeting.update({
      where: { id },
      data: {
        contentCategories: updateDto.contentCategories,
        keywords: updateDto.keywords,
        urlPatterns: updateDto.urlPatterns,
        pageTypes: updateDto.pageTypes,
        brandSafety: updateDto.brandSafety,
        blockedKeywords: updateDto.blockedKeywords,
        isInclude: updateDto.isInclude,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteContextualTargeting(
    advertiserId: string,
    campaignId: string,
    id: string,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    const existingRule = await this.prisma.contextualTargeting.findFirst({
      where: {
        id: id,
        campaignId: campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Contextual targeting rule not found');
    }

    await this.prisma.contextualTargeting.delete({
      where: { id },
    });

    return { message: 'Contextual targeting rule deleted successfully' };
  }

  // ======================
  // BEHAVIORAL TARGETING
  // ======================

  async addBehavioralTargeting(
    advertiserId: string,
    createDto: CreateCampaignBehavioralTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      createDto.campaignId,
    );

    return this.prisma.behavioralTargeting.create({
      data: {
        campaignId: createDto.campaignId,
        interests: createDto.interests || [],
        purchaseIntent: createDto.purchaseIntent || [],
        lifestyleSegments: createDto.lifestyleSegments || [],
        audienceTypes: createDto.audienceTypes || [],
        userSegments: createDto.userSegments || [],
        purchaseFrequency: createDto.purchaseFrequency || [],
        sessionEngagement: createDto.sessionEngagement || [],
        avgOrderValue: createDto.avgOrderValue,
        sessionDuration: createDto.sessionDuration,
        pageViews: createDto.pageViews,
        isInclude: createDto.isInclude ?? true,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getBehavioralTargeting(advertiserId: string, campaignId: string) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    return this.prisma.behavioralTargeting.findMany({
      where: {
        campaignId: campaignId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateBehavioralTargeting(
    advertiserId: string,
    id: string,
    updateDto: UpdateCampaignBehavioralTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      updateDto.campaignId,
    );

    const existingRule = await this.prisma.behavioralTargeting.findFirst({
      where: {
        id: id,
        campaignId: updateDto.campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Behavioral targeting rule not found');
    }

    return this.prisma.behavioralTargeting.update({
      where: { id },
      data: {
        interests: updateDto.interests,
        purchaseIntent: updateDto.purchaseIntent,
        lifestyleSegments: updateDto.lifestyleSegments,
        audienceTypes: updateDto.audienceTypes,
        userSegments: updateDto.userSegments,
        purchaseFrequency: updateDto.purchaseFrequency,
        sessionEngagement: updateDto.sessionEngagement,
        avgOrderValue: updateDto.avgOrderValue,
        sessionDuration: updateDto.sessionDuration,
        pageViews: updateDto.pageViews,
        isInclude: updateDto.isInclude,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteBehavioralTargeting(
    advertiserId: string,
    campaignId: string,
    id: string,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    const existingRule = await this.prisma.behavioralTargeting.findFirst({
      where: {
        id: id,
        campaignId: campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Behavioral targeting rule not found');
    }

    await this.prisma.behavioralTargeting.delete({
      where: { id },
    });

    return { message: 'Behavioral targeting rule deleted successfully' };
  }

  // ======================
  // TIME TARGETING
  // ======================

  async addTimeTargeting(
    advertiserId: string,
    createDto: CreateCampaignTimeTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      createDto.campaignId,
    );

    // Validate time range if both start and end hours are provided
    if (createDto.startHour !== undefined && createDto.endHour !== undefined) {
      if (createDto.startHour > createDto.endHour) {
        throw new BadRequestException(
          'Start hour cannot be greater than end hour',
        );
      }
    }

    // Validate date range if both dates are provided
    if (createDto.startDate && createDto.endDate) {
      if (createDto.startDate > createDto.endDate) {
        throw new BadRequestException('Start date cannot be after end date');
      }
    }

    return this.prisma.timeTargeting.create({
      data: {
        campaignId: createDto.campaignId,
        timezone: createDto.timezone || 'Asia/Kolkata',
        timeSlots: createDto.timeSlots || [],
        daysOfWeek: createDto.daysOfWeek || [],
        holidayTypes: createDto.holidayTypes || [],
        startHour: createDto.startHour,
        endHour: createDto.endHour,
        startDate: createDto.startDate,
        endDate: createDto.endDate,
        includeHolidays: createDto.includeHolidays ?? true,
        workingDaysOnly: createDto.workingDaysOnly ?? false,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getTimeTargeting(advertiserId: string, campaignId: string) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    return this.prisma.timeTargeting.findMany({
      where: {
        campaignId: campaignId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateTimeTargeting(
    advertiserId: string,
    id: string,
    updateDto: UpdateCampaignTimeTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      updateDto.campaignId,
    );

    const existingRule = await this.prisma.timeTargeting.findFirst({
      where: {
        id: id,
        campaignId: updateDto.campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Time targeting rule not found');
    }

    // Validate time range if both start and end hours are provided
    if (updateDto.startHour !== undefined && updateDto.endHour !== undefined) {
      if (updateDto.startHour > updateDto.endHour) {
        throw new BadRequestException(
          'Start hour cannot be greater than end hour',
        );
      }
    }

    // Validate date range if both dates are provided
    if (updateDto.startDate && updateDto.endDate) {
      if (updateDto.startDate > updateDto.endDate) {
        throw new BadRequestException('Start date cannot be after end date');
      }
    }

    return this.prisma.timeTargeting.update({
      where: { id },
      data: {
        timezone: updateDto.timezone,
        timeSlots: updateDto.timeSlots,
        daysOfWeek: updateDto.daysOfWeek,
        holidayTypes: updateDto.holidayTypes,
        startHour: updateDto.startHour,
        endHour: updateDto.endHour,
        startDate: updateDto.startDate,
        endDate: updateDto.endDate,
        includeHolidays: updateDto.includeHolidays,
        workingDaysOnly: updateDto.workingDaysOnly,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteTimeTargeting(
    advertiserId: string,
    campaignId: string,
    id: string,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    const existingRule = await this.prisma.timeTargeting.findFirst({
      where: {
        id: id,
        campaignId: campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Time targeting rule not found');
    }

    await this.prisma.timeTargeting.delete({
      where: { id },
    });

    return { message: 'Time targeting rule deleted successfully' };
  }

  // ======================
  // FREQUENCY TARGETING
  // ======================

  async addFrequencyTargeting(
    advertiserId: string,
    createDto: CreateCampaignFrequencyTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      createDto.campaignId,
    );

    return this.prisma.frequencyTargeting.create({
      data: {
        campaignId: createDto.campaignId,
        maxImpressions: createDto.maxImpressions,
        frequencyWindow: createDto.frequencyWindow,
        frequencyScope: createDto.frequencyScope,
        maxClicksPerUser: createDto.maxClicksPerUser,
        minTimeBetween: createDto.minTimeBetween,
        customTimeWindowHours: createDto.customTimeWindowHours,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getFrequencyTargeting(advertiserId: string, campaignId: string) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    return this.prisma.frequencyTargeting.findMany({
      where: {
        campaignId: campaignId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateFrequencyTargeting(
    advertiserId: string,
    id: string,
    updateDto: UpdateCampaignFrequencyTargetingDto,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      updateDto.campaignId,
    );

    const existingRule = await this.prisma.frequencyTargeting.findFirst({
      where: {
        id: id,
        campaignId: updateDto.campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Frequency targeting rule not found');
    }

    return this.prisma.frequencyTargeting.update({
      where: { id },
      data: {
        maxImpressions: updateDto.maxImpressions,
        frequencyWindow: updateDto.frequencyWindow,
        frequencyScope: updateDto.frequencyScope,
        maxClicksPerUser: updateDto.maxClicksPerUser,
        minTimeBetween: updateDto.minTimeBetween,
        customTimeWindowHours: updateDto.customTimeWindowHours,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteFrequencyTargeting(
    advertiserId: string,
    campaignId: string,
    id: string,
  ) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    const existingRule = await this.prisma.frequencyTargeting.findFirst({
      where: {
        id: id,
        campaignId: campaignId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Frequency targeting rule not found');
    }

    await this.prisma.frequencyTargeting.delete({
      where: { id },
    });

    return { message: 'Frequency targeting rule deleted successfully' };
  }

  // ======================
  // GET ALL TARGETING RULES
  // ======================

  async getAllTargetingRules(advertiserId: string, campaignId: string) {
    await this.advertiserHelper.verifyCampaignOwnership(
      advertiserId,
      campaignId,
    );

    const [
      demographic,
      geographic,
      device,
      contextual,
      behavioral,
      time,
      frequency,
    ] = await Promise.all([
      this.prisma.demographicTargeting.findMany({
        where: { campaignId },
      }),
      this.prisma.geographicTargeting.findMany({
        where: { campaignId },
      }),
      this.prisma.deviceTargeting.findMany({
        where: { campaignId },
      }),
      this.prisma.contextualTargeting.findMany({
        where: { campaignId },
      }),
      this.prisma.behavioralTargeting.findMany({
        where: { campaignId },
      }),
      this.prisma.timeTargeting.findMany({
        where: { campaignId },
      }),
      this.prisma.frequencyTargeting.findMany({
        where: { campaignId },
      }),
    ]);

    return {
      campaignId,
      targeting: {
        demographic,
        geographic,
        device,
        contextual,
        behavioral,
        time,
        frequency,
      },
    };
  }
}
