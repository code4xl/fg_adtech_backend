// src/rtb/dto/index.ts - UPDATE for Phase 5
// Add these exports to your existing DTO index file

// Existing exports (keep these)
export * from './bid-request.dto';
export * from './bid-response.dto';
export * from './auction-status.dto';
export * from './health.dto';
export * from './tracking.dto'; // If this exists, replace with tracking-events.dto

// Phase 5: NEW - Tracking Events DTOs
export * from './tracking-events.dto';

// Re-export specific tracking DTOs for convenience
// export {
//     ImpressionEventDto,
//     ClickEventDto,
//     BatchImpressionEventsDto,
//     BatchClickEventsDto,
//     TrackingResponseDto,
//     BatchTrackingResponseDto
// } from './tracking-events.dto';
