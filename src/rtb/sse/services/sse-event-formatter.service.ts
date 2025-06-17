import { Injectable } from '@nestjs/common';
import { SSEEventDto } from '../dto/sse-event.dto';

/**
 * SSE Event Formatter Service
 * 
 * Formats events according to the Server-Sent Events specification.
 * Handles event serialization and proper SSE formatting.
 */
@Injectable()
export class SSEEventFormatterService {
  /**
   * Format an event for SSE transmission
   * 
   * SSE Format:
   * event: eventname
   * id: eventid
   * retry: milliseconds
   * data: event data
   * 
   * Each field ends with \n, and events are separated by \n\n
   */
  formatEvent(event: SSEEventDto): string {
    const lines: string[] = [];

    // Add event type
    lines.push(`event: ${event.type}`);

    // Add event ID (sequence number)
    if (event.sequence !== undefined) {
      lines.push(`id: ${event.sequence}`);
    }

    // Add retry hint for connection issues
    if (event.type === 'error' || event.type === 'heartbeat') {
      lines.push('retry: 5000'); // 5 second retry
    }

    // Add timestamp as comment for debugging
    lines.push(`: ${event.timestamp}`);

    // Format and add data
    const dataString = this.formatData(event.data);
    
    // Split data by newlines and prefix each line with "data: "
    const dataLines = dataString.split('\n');
    dataLines.forEach(line => {
      lines.push(`data: ${line}`);
    });

    // End with double newline
    return lines.join('\n') + '\n\n';
  }

  /**
   * Format data field for SSE
   */
  private formatData(data: any): string {
    try {
      // For simple strings, return as-is
      if (typeof data === 'string') {
        return data;
      }

      // For objects, pretty print for better debugging
      if (process.env.NODE_ENV === 'development') {
        return JSON.stringify(data, null, 2);
      }

      // Production: compact JSON
      return JSON.stringify(data);
      
    } catch (error) {
      // Fallback for circular references or other issues
      return JSON.stringify({
        error: 'Failed to serialize data',
        message: error.message,
      });
    }
  }

  /**
   * Format a simple text event
   */
  formatTextEvent(eventType: string, message: string, id?: number): string {
    const lines = [
      `event: ${eventType}`,
    ];

    if (id !== undefined) {
      lines.push(`id: ${id}`);
    }

    lines.push(`data: ${message}`);
    
    return lines.join('\n') + '\n\n';
  }

  /**
   * Format a heartbeat/ping event
   */
  formatHeartbeat(id?: number): string {
    return this.formatTextEvent('heartbeat', 'ping', id);
  }

  /**
   * Format connection close event
   */
  formatCloseEvent(): string {
    return 'event: close\ndata: {"message": "Connection closed"}\n\n';
  }

  /**
   * Create a comment line (for keeping connection alive without sending data)
   */
  formatComment(comment: string): string {
    return `: ${comment}\n\n`;
  }
}