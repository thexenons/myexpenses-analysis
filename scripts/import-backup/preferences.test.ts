import assert from "node:assert/strict";
import test from "node:test";

import {
    BackupPreferencesError,
    parseBackupPreferences,
} from "./preferences.ts";
import { SAFE_PREFERENCES_XML_FIXTURE } from "./test-fixtures.ts";

function xmlBytes(source: string): Uint8Array {
    return new TextEncoder().encode(source);
}

test("returns only typed, non-sensitive preference metadata", () => {
    const metadata = parseBackupPreferences(
        xmlBytes(SAFE_PREFERENCES_XML_FIXTURE),
    );

    assert.deepEqual(metadata, {
        automaticExchangeRateDownload: false,
        currentVersion: 871,
        defaultTransferCategory: 1,
        exchangeRateProvider: "FRANKFURTER",
        firstInstallDatabaseSchemaVersion: 170,
        groupMonthStart: 1,
        groupWeekStart: 2,
        historyIncludeTransfers: false,
        homeCurrency: "EUR",
        transactionTimeEnabled: true,
        unmappedTransactionAsTransfer: false,
        valueDate: false,
    });
    const serialized = JSON.stringify(metadata);
    assert.doesNotMatch(serialized, /fixture-secret|private@example/iu);
    assert.equal(Object.hasOwn(metadata, "pref_new_licence_key"), false);
    assert.equal(Object.hasOwn(metadata, "licence_email"), false);
});

test("ignores typed unknown preferences, including sets and escaped values", () => {
    const metadata = parseBackupPreferences(
        xmlBytes(`<?xml version="1.0" encoding="utf-8"?>
            <map>
                <string name="untrusted">A &amp; B</string>
                <set name="providers"><string>one</string><string>two</string></set>
                <long name="timestamp" value="123" />
                <boolean name="transaction_time" value="false" />
            </map>`),
    );

    assert.deepEqual(metadata, { transactionTimeEnabled: false });
});

test("rejects DTDs, invalid UTF-8 and malformed allowlisted values", () => {
    assert.throws(
        () =>
            parseBackupPreferences(
                xmlBytes(
                    '<!DOCTYPE map [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><map></map>',
                ),
            ),
        BackupPreferencesError,
    );
    assert.throws(
        () => parseBackupPreferences(new Uint8Array([0xc3, 0x28])),
        BackupPreferencesError,
    );
    assert.throws(
        () =>
            parseBackupPreferences(
                xmlBytes(
                    '<map><boolean name="transaction_time" value="yes" /></map>',
                ),
            ),
        BackupPreferencesError,
    );
    assert.throws(
        () =>
            parseBackupPreferences(
                xmlBytes('<map><string name="home_currency">EURO</string></map>'),
            ),
        BackupPreferencesError,
    );
});

test("rejects preference inputs above the standalone parser limit", () => {
    assert.throws(
        () => parseBackupPreferences(new Uint8Array(4 * 1024 * 1024 + 1)),
        /exceed the size limit/iu,
    );
});

test("rejects duplicate or incorrectly typed allowlisted preferences", () => {
    assert.throws(
        () =>
            parseBackupPreferences(
                xmlBytes(`<map>
                    <int name="currentversion" value="871" />
                    <int name="currentversion" value="872" />
                </map>`),
            ),
        /repeats an allowlisted preference/iu,
    );
    assert.throws(
        () =>
            parseBackupPreferences(
                xmlBytes(
                    '<map><string name="currentversion">871</string></map>',
                ),
            ),
        /unexpected primitive type/iu,
    );
});

test("validates calendar policy ranges and safe category identifiers", () => {
    assert.throws(
        () =>
            parseBackupPreferences(
                xmlBytes('<map><string name="group_month_start">0</string></map>'),
            ),
        /outside its range/iu,
    );
    assert.throws(
        () =>
            parseBackupPreferences(
                xmlBytes('<map><string name="group_week_start">8</string></map>'),
            ),
        /outside its range/iu,
    );
    assert.throws(
        () =>
            parseBackupPreferences(
                xmlBytes(
                    '<map><long name="default_transfer_category" value="9007199254740992" /></map>',
                ),
            ),
        /safe integer range/iu,
    );
});
