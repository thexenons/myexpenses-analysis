import nodemailer from "nodemailer";

export interface NotificationSettings {
    readonly to: string;
    readonly from: string;
    readonly password: string;
}

export function smtpOptionsForNotification(settings: NotificationSettings) {
    return {
        host: "smtp.mail.ovh.net",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: settings.from, pass: settings.password },
        tls: { rejectUnauthorized: true },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        dnsTimeout: 10_000,
        socketTimeout: 10_000,
        logger: false,
        debug: false,
    };
}

interface NotificationTransport {
    sendMail: (message: {
        from: string; to: string; subject: string; text: string;
    }) => Promise<{ accepted: string[] }>;
    close: () => void;
}

type TransportFactory = (
    options: ReturnType<typeof smtpOptionsForNotification>,
) => NotificationTransport;

/** The message intentionally carries no backup or financial metadata. */
export async function sendBackupNotification(
    settings: NotificationSettings,
    createTransport: TransportFactory = (options) => nodemailer.createTransport(options),
): Promise<void> {
    const transport = createTransport(smtpOptionsForNotification(settings));
    try {
        const result = await transport.sendMail({
            from: settings.from,
            to: settings.to,
            subject: "MyExpenses backup processed",
            text: "A MyExpenses backup was successfully processed.",
        });
        if (
            result.accepted.length !== 1 ||
            result.accepted[0]?.toLowerCase() !== settings.to.toLowerCase()
        ) {
            throw new Error("Notification was not accepted");
        }
    } finally {
        transport.close();
    }
}
