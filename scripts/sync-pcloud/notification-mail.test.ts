import assert from "node:assert/strict";
import test from "node:test";

import {
    sendBackupNotification,
    smtpOptionsForNotification,
    type NotificationSettings,
} from "./notification-mail.ts";

const settings: NotificationSettings = {
    to: "recipient@example.com",
    from: "sender@example.com",
    password: "private-password",
};

test("SMTP uses OVH implicit TLS and bounded timeouts", () => {
    const options = smtpOptionsForNotification(settings);
    assert.equal(options.host, "smtp.mail.ovh.net");
    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.deepEqual(options.auth, { user: settings.from, pass: settings.password });
    for (const key of ["connectionTimeout", "greetingTimeout", "dnsTimeout", "socketTimeout"] as const) {
        assert.ok(options[key] > 0 && options[key] <= 10_000);
    }
    assert.notEqual(options.tls?.rejectUnauthorized, false);
    assert.equal(options.logger, false);
    assert.equal(options.debug, false);
});

test("message contains no backup details and requires intended recipient acceptance", async () => {
    const messages: Array<{ from: string; to: string; subject: string; text: string }> = [];
    let closed = 0;
    const factory = () => ({
        sendMail: async (message: { from: string; to: string; subject: string; text: string }) => {
            messages.push(message);
            return { accepted: [settings.to] };
        },
        close: () => { closed++; },
    });
    await sendBackupNotification(settings, factory);
    assert.equal(closed, 1);
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.to, settings.to);
    assert.equal(messages[0]?.from, settings.from);
    assert.doesNotMatch(JSON.stringify(messages), /private-password|fileId|checksum|amount|account/iu);
    await assert.rejects(sendBackupNotification(settings, () => ({
        sendMail: async () => ({ accepted: [] }),
        close: () => { closed++; },
    })), /not accepted/iu);
    assert.equal(closed, 2);
});
