import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { BudgetNotificationService } from "src/notification/services/budget.notification.service";

@Injectable()
export class BudgetNotificationJob {
      private readonly logger = new Logger(BudgetNotificationJob.name);
    
    constructor(
        private readonly budgetNotificationService: BudgetNotificationService,
    ) { }

    /**
     * Send daily spending/revenue notifications -- Done
     * Runs at 9 AM IST every day
     */
    @Cron('0 9 * * *', {
        name: 'sendDailyNotifications',
        timeZone: 'Asia/Kolkata',
    })
    async sendDailyNotifications() {
        const startTime = Date.now();
        this.logger.debug('🚀 Starting daily notification job');

        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            // Run all notifications in parallel
            const [advertiserCount, publisherCount, adminCount] = await Promise.all([
                this.budgetNotificationService.sendPublisherRevenueNotifications(yesterdayStr),
                this.budgetNotificationService.sendAdvertiserSpendingNotifications(yesterdayStr),
                this.budgetNotificationService.sendSystemRevenueNotifications(yesterdayStr),
            ]);

            const processingTime = Date.now() - startTime;

            this.logger.debug('✅ Daily notification job completed', {
                advertiserNotifications: advertiserCount,
                publisherNotifications: publisherCount,
                adminNotifications: adminCount,
                processingTimeMs: processingTime,
            });

        } catch (error) {
            this.logger.error('❌ Daily notification job failed', {
                error: error.message,
                stack: error.stack,
            });
        }
    }
}