import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  type NotificationCategory,
  NotificationChannel,
  type NotificationType,
} from './notification.entity';

export interface ChannelPreference {
  enabled: boolean;
  frequency?: 'immediate' | 'digest' | 'weekly' | 'never';
  categories?: Record<string, boolean>;
  types?: Record<string, boolean>;
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string;
    timezone: string;
    days?: number[]; // 0-6 (Sunday-Saturday)
  };
}

export interface DoNotDisturbSettings {
  enabled: boolean;
  startTime?: string; // HH:mm format
  endTime?: string;
  timezone?: string;
  until?: Date; // Temporary DND until specific date
  reason?: string;
}

export interface PreferenceStats {
  received: number;
  opened: number;
  clicked: number;
  optedOut: number;
  lastNotificationAt?: Date;
  lastOptOutAt?: Date;
  lastOptInAt?: Date;
}

@Entity('notification_preferences')
@Unique(['organizationId', 'userId'])
@Index(['userId'])
@Index(['organizationId'])
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail?: string;

  @Column({ type: 'jsonb', default: {} })
  channels: {
    [NotificationChannel.EMAIL]?: ChannelPreference;
    [NotificationChannel.SMS]?: ChannelPreference;
    [NotificationChannel.IN_APP]?: ChannelPreference;
    [NotificationChannel.SLACK]?: ChannelPreference;
    [NotificationChannel.TEAMS]?: ChannelPreference;
    [NotificationChannel.WEBHOOK]?: ChannelPreference;
  };

  @Column({ type: 'jsonb', nullable: true })
  doNotDisturb?: DoNotDisturbSettings;

  @Column({ type: 'simple-array', nullable: true })
  blockedUsers?: string[];

  @Column({ type: 'simple-array', nullable: true })
  blockedSources?: string[];

  @Column({ type: 'jsonb', default: {} })
  stats: PreferenceStats;

  @Column({ type: 'boolean', default: false })
  optedOut: boolean;

  @Column({ type: 'timestamp', nullable: true })
  optedOutAt?: Date;

  @Column({ type: 'text', nullable: true })
  optOutReason?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  unsubscribeToken?: string;

  @Column({ type: 'jsonb', nullable: true })
  customSettings?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  lastUpdatedBy?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Methods
  canReceiveNotification(
    channel: NotificationChannel,
    type: NotificationType,
    category: NotificationCategory,
    fromUserId?: string,
    source?: string
  ): { allowed: boolean; reason?: string } {
    // Check global opt-out
    if (this.optedOut) {
      return { allowed: false, reason: 'User has opted out of all notifications' };
    }

    // Check blocked users
    if (fromUserId && this.blockedUsers?.includes(fromUserId)) {
      return { allowed: false, reason: 'Sender is blocked by user' };
    }

    // Check blocked sources
    if (source && this.blockedSources?.includes(source)) {
      return { allowed: false, reason: 'Source is blocked by user' };
    }

    // Check Do Not Disturb
    const dndResult = this.checkDoNotDisturb();
    if (!dndResult.allowed) {
      return dndResult;
    }

    // Check channel preferences
    const channelPref = this.channels[channel];
    if (!channelPref) {
      // No preference set, allow by default
      return { allowed: true };
    }

    if (!channelPref.enabled) {
      return { allowed: false, reason: `${channel} notifications are disabled` };
    }

    // Check frequency
    if (channelPref.frequency === 'never') {
      return { allowed: false, reason: 'User has set frequency to never' };
    }

    // Check category preferences
    if (channelPref.categories && category in channelPref.categories) {
      if (!channelPref.categories[category]) {
        return { allowed: false, reason: `${category} notifications are disabled` };
      }
    }

    // Check type preferences
    if (channelPref.types && type in channelPref.types) {
      if (!channelPref.types[type]) {
        return { allowed: false, reason: `${type} notifications are disabled` };
      }
    }

    // Check quiet hours for channel
    const quietHoursResult = this.checkQuietHours(channelPref);
    if (!quietHoursResult.allowed) {
      return quietHoursResult;
    }

    return { allowed: true };
  }

  private checkDoNotDisturb(): { allowed: boolean; reason?: string } {
    if (!this.doNotDisturb?.enabled) {
      return { allowed: true };
    }

    const now = new Date();

    // Check temporary DND
    if (this.doNotDisturb.until && now < this.doNotDisturb.until) {
      return {
        allowed: false,
        reason: `Do Not Disturb is active until ${this.doNotDisturb.until.toISOString()}`,
      };
    }

    // Check scheduled DND
    if (this.doNotDisturb.startTime && this.doNotDisturb.endTime && this.doNotDisturb.timezone) {
      // Implement timezone-aware time checking
      const currentTimeInZone = this.getCurrentTimeInTimezone(now, this.doNotDisturb.timezone);
      const { startTime, endTime } = this.doNotDisturb;

      const isInDNDPeriod = this.isTimeInRange(currentTimeInZone, startTime, endTime);
      if (isInDNDPeriod) {
        return {
          allowed: false,
          reason: `Do Not Disturb is active from ${startTime} to ${endTime} (${this.doNotDisturb.timezone})`,
        };
      }
    }

    return { allowed: true };
  }

  private checkQuietHours(channelPref: ChannelPreference): { allowed: boolean; reason?: string } {
    if (!channelPref.quietHours?.enabled) {
      return { allowed: true };
    }

    const now = new Date();
    const timezone = channelPref.quietHours.timezone || 'UTC';
    const currentTimeInZone = this.getCurrentTimeInTimezone(now, timezone);
    const currentDayInZone = this.getDayInTimezone(now, timezone);

    // Check if today is included in quiet hours days
    if (channelPref.quietHours.days && !channelPref.quietHours.days.includes(currentDayInZone)) {
      return { allowed: true };
    }

    const { startTime, endTime } = channelPref.quietHours;
    const isInQuietHours = this.isTimeInRange(currentTimeInZone, startTime, endTime);

    if (isInQuietHours) {
      return {
        allowed: false,
        reason: `Quiet hours are active from ${startTime} to ${endTime} (${timezone})`,
      };
    }

    return { allowed: true };
  }

  private isTimeInRange(current: string, start: string, end: string): boolean {
    const [currentHour, currentMin] = current.split(':').map(Number);
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight ranges (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  updateStats(event: 'received' | 'opened' | 'clicked' | 'optedOut'): void {
    if (!this.stats) {
      this.stats = {
        received: 0,
        opened: 0,
        clicked: 0,
        optedOut: 0,
      };
    }

    this.stats[event]++;

    if (event === 'received') {
      this.stats.lastNotificationAt = new Date();
    } else if (event === 'optedOut') {
      this.stats.lastOptOutAt = new Date();
      this.optedOut = true;
      this.optedOutAt = new Date();
    }
  }

  optIn(): void {
    this.optedOut = false;
    this.optedOutAt = null;
    this.optOutReason = null;

    if (!this.stats) {
      this.stats = {
        received: 0,
        opened: 0,
        clicked: 0,
        optedOut: 0,
      };
    }

    this.stats.lastOptInAt = new Date();
  }

  setChannelPreference(channel: NotificationChannel, preference: Partial<ChannelPreference>): void {
    if (!this.channels) {
      this.channels = {};
    }

    this.channels[channel] = {
      ...this.channels[channel],
      ...preference,
    };
  }

  setCategoryPreference(
    channel: NotificationChannel,
    category: NotificationCategory,
    enabled: boolean
  ): void {
    if (!this.channels[channel]) {
      this.channels[channel] = { enabled: true };
    }

    if (!this.channels[channel].categories) {
      this.channels[channel].categories = {};
    }

    this.channels[channel].categories[category] = enabled;
  }

  setTypePreference(channel: NotificationChannel, type: NotificationType, enabled: boolean): void {
    if (!this.channels[channel]) {
      this.channels[channel] = { enabled: true };
    }

    if (!this.channels[channel].types) {
      this.channels[channel].types = {};
    }

    this.channels[channel].types[type] = enabled;
  }

  blockUser(userId: string): void {
    if (!this.blockedUsers) {
      this.blockedUsers = [];
    }

    if (!this.blockedUsers.includes(userId)) {
      this.blockedUsers.push(userId);
    }
  }

  unblockUser(userId: string): void {
    if (this.blockedUsers) {
      this.blockedUsers = this.blockedUsers.filter((id) => id !== userId);
    }
  }

  blockSource(source: string): void {
    if (!this.blockedSources) {
      this.blockedSources = [];
    }

    if (!this.blockedSources.includes(source)) {
      this.blockedSources.push(source);
    }
  }

  unblockSource(source: string): void {
    if (this.blockedSources) {
      this.blockedSources = this.blockedSources.filter((s) => s !== source);
    }
  }

  generateUnsubscribeToken(): string {
    // Generate a secure random token
    const crypto = require('crypto');
    this.unsubscribeToken = crypto.randomBytes(32).toString('hex');
    return this.unsubscribeToken;
  }

  private getCurrentTimeInTimezone(date: Date, timezone: string): string {
    try {
      // Use Intl.DateTimeFormat for timezone conversion
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(date);
      const hour = parts.find((part) => part.type === 'hour')?.value || '00';
      const minute = parts.find((part) => part.type === 'minute')?.value || '00';

      return `${hour}:${minute}`;
    } catch (error) {
      // Fallback to UTC if timezone is invalid
      console.error(`Invalid timezone: ${timezone}, falling back to UTC`);
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }

  private getDayInTimezone(date: Date, timezone: string): number {
    try {
      // Use Intl.DateTimeFormat for timezone conversion
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      });

      const dayString = formatter.format(date);
      const dayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };

      return dayMap[dayString] ?? date.getUTCDay();
    } catch (error) {
      // Fallback to UTC if timezone is invalid
      console.error(`Invalid timezone: ${timezone}, falling back to UTC`);
      return date.getUTCDay();
    }
  }
}
