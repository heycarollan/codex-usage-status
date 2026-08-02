import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRemoteControlStatusBarPresentation,
  isPairingArtifactExpired,
  parseRemoteControlClientList,
  parseRemoteControlPairingArtifact,
  parseRemoteControlPairingClaimed,
  parseRemoteControlStatus,
  redactRemoteControlSecrets
} from "../src/remoteControl";

test("presents a Remote status-bar action for onboarding and connection state", () => {
  assert.deepEqual(
    buildRemoteControlStatusBarPresentation({
      supported: true,
      busy: false,
      status: null,
      errorMessage: null,
      onboardingHighlighted: true
    }),
    {
      text: "$(remote) Set up Remote",
      tooltip: "Pair your phone with Codex.",
      accessibilityLabel: "Pair your phone with Codex",
      warning: true
    }
  );

  assert.match(
    buildRemoteControlStatusBarPresentation({
      supported: true,
      busy: false,
      status: "connected",
      errorMessage: null,
      onboardingHighlighted: false
    }).text,
    /Remote: On/
  );

  assert.equal(
    buildRemoteControlStatusBarPresentation({
      supported: true,
      busy: false,
      status: "disabled",
      errorMessage: null,
      onboardingHighlighted: false
    }).text,
    "$(remote) Remote"
  );
});

test("parses supported remote-control status without requiring an environment id", () => {
  assert.deepEqual(
    parseRemoteControlStatus({
      status: "disabled",
      serverName: "workstation",
      installationId: "installation-1",
      environmentId: null
    }),
    {
      status: "disabled",
      serverName: "workstation",
      installationId: "installation-1",
      environmentId: null
    }
  );

  assert.throws(
    () => parseRemoteControlStatus({ status: "ready", serverName: "workstation" }),
    /unknown remote-control status/
  );
});

test("requires a manual code and valid expiration for pairing", () => {
  const artifact = parseRemoteControlPairingArtifact({
    pairingCode: "opaque-pairing-artifact",
    manualPairingCode: "ABCD-1234",
    environmentId: "environment-1",
    expiresAt: 2000
  });

  assert.deepEqual(artifact, {
    pairingCode: "opaque-pairing-artifact",
    manualPairingCode: "ABCD-1234",
    environmentId: "environment-1",
    expiresAt: 2000
  });
  assert.equal(isPairingArtifactExpired(artifact, 1_999_999), false);
  assert.equal(isPairingArtifactExpired(artifact, 2_000_000), true);

  assert.throws(
    () => parseRemoteControlPairingArtifact({
      pairingCode: "opaque-pairing-artifact",
      environmentId: "environment-1",
      expiresAt: 2000
    }),
    /manual remote-control pairing code/
  );
});

test("parses pairing claims and revocable controller devices", () => {
  assert.equal(parseRemoteControlPairingClaimed({ claimed: true }), true);
  assert.throws(() => parseRemoteControlPairingClaimed({ claimed: "yes" }), /pairing status/);

  assert.deepEqual(
    parseRemoteControlClientList({
      data: [
        {
          clientId: "client-1",
          displayName: "Phone",
          deviceType: "phone",
          platform: "Android",
          osVersion: "16",
          deviceModel: "Pixel",
          appVersion: "1.2.3",
          lastSeenAt: 1900000000
        }
      ],
      nextCursor: null
    }),
    {
      data: [
        {
          clientId: "client-1",
          displayName: "Phone",
          deviceType: "phone",
          platform: "Android",
          osVersion: "16",
          deviceModel: "Pixel",
          appVersion: "1.2.3",
          lastSeenAt: 1900000000
        }
      ],
      nextCursor: null
    }
  );

  assert.throws(
    () => parseRemoteControlClientList({ data: [{ displayName: "Missing id" }] }),
    /client id/
  );
});

test("redacts remote-control pairing and device identifiers from log messages", () => {
  assert.equal(
    redactRemoteControlSecrets(
      "Pair ABCD-1234 for environment-1 and client-1; ABCD-1234 expires soon.",
      ["ABCD-1234", "environment-1", "client-1", null]
    ),
    "Pair [redacted] for [redacted] and [redacted]; [redacted] expires soon."
  );
});
