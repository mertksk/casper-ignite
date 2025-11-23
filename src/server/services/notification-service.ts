import "server-only";

/**
 * Notification Service
 * Sends alerts via multiple channels (Slack, Email, etc.)
 */

interface AlertParams {
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
  metadata?: Record<string, unknown>;
}

class NotificationService {
  /**
   * Send alert to all configured channels
   */
  async sendAlert(params: AlertParams): Promise<void> {
    const { title, message, severity, metadata } = params;

    console.log(`[ALERT ${severity.toUpperCase()}] ${title}: ${message}`, metadata);

    // Send to all channels in parallel
    await Promise.allSettled([
      this.sendToSlack(params),
      this.sendToEmail(params),
      this.sendToConsole(params),
    ]);
  }

  /**
   * Send notification to Slack
   */
  private async sendToSlack(params: AlertParams): Promise<void> {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!slackWebhookUrl) {
      console.warn("[Slack] Webhook URL not configured, skipping Slack notification");
      return;
    }

    const { title, message, severity, metadata } = params;

    // Color codes: critical=red, warning=yellow, info=blue
    const color = severity === "critical" ? "#FF0000" : severity === "warning" ? "#FFA500" : "#0000FF";

    const payload = {
      text: `🚨 ${severity.toUpperCase()}: ${title}`,
      attachments: [
        {
          color,
          title,
          text: message,
          fields: metadata
            ? Object.entries(metadata).map(([key, value]) => ({
                title: key,
                value: typeof value === "string" ? value : JSON.stringify(value),
                short: true,
              }))
            : [],
          footer: "Casper Radar Alerts",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    try {
      const response = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }

      console.log(`[Slack] Alert sent successfully: ${title}`);
    } catch (error) {
      console.error("[Slack] Failed to send alert:", error);
    }
  }

  /**
   * Send notification via email
   */
  private async sendToEmail(params: AlertParams): Promise<void> {
    const emailEnabled = process.env.EMAIL_ALERTS_ENABLED === "true";
    const adminEmails = process.env.ADMIN_EMAIL_ADDRESSES?.split(",") || [];

    if (!emailEnabled || adminEmails.length === 0) {
      console.warn("[Email] Email alerts not configured, skipping email notification");
      return;
    }

    const { title, message, severity, metadata } = params;

    // TODO: Implement email sending with your preferred service (SendGrid, AWS SES, etc.)
    // For now, just log
    console.log(`[Email] Would send to ${adminEmails.join(", ")}:`, {
      subject: `[${severity.toUpperCase()}] ${title}`,
      body: message,
      metadata,
    });

    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({
    //   to: adminEmails,
    //   from: 'alerts@casperradar.com',
    //   subject: `[${severity.toUpperCase()}] ${title}`,
    //   html: `<h2>${title}</h2><p>${message}</p><pre>${JSON.stringify(metadata, null, 2)}</pre>`,
    // });
  }

  /**
   * Log to console with formatting
   */
  private async sendToConsole(params: AlertParams): Promise<void> {
    const { title, message, severity, metadata } = params;

    const emoji = severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "🔵";
    const timestamp = new Date().toISOString();

    console.log("\n" + "=".repeat(80));
    console.log(`${emoji} [${severity.toUpperCase()}] ${timestamp}`);
    console.log(`Title: ${title}`);
    console.log(`Message: ${message}`);

    if (metadata && Object.keys(metadata).length > 0) {
      console.log("Metadata:");
      console.log(JSON.stringify(metadata, null, 2));
    }

    console.log("=".repeat(80) + "\n");
  }

  /**
   * Send critical alert (highest priority)
   */
  async sendCriticalAlert(title: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendAlert({
      title,
      message,
      severity: "critical",
      metadata,
    });
  }

  /**
   * Send warning alert (medium priority)
   */
  async sendWarningAlert(title: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendAlert({
      title,
      message,
      severity: "warning",
      metadata,
    });
  }

  /**
   * Send info alert (low priority)
   */
  async sendInfoAlert(title: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendAlert({
      title,
      message,
      severity: "info",
      metadata,
    });
  }
}

export const notificationService = new NotificationService();
