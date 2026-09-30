import { describe, expect, it } from "vitest";
import { parseSourceRef, SourceRefError } from "./sources";

describe("watch_add links", () => {
  it.each([
    ["https://t.me/spain_useful", { username: "spain_useful", topic: null }],
    ["@spain_useful", { username: "spain_useful", topic: null }],
    ["t.me/spain_useful/74767", { username: "spain_useful", topic: 74767 }],
    // What Telegram's "share link" of a topic looks like in the owner's screenshot.
    ["https://t.me/c/spain_useful/74767", { username: "spain_useful", topic: 74767 }],
    ["https://t.me/c/1234567890/55/999", { channelId: "1234567890", topic: 55 }],
    ["-1001234567890", { channelId: "1234567890", topic: null }],
  ])("reads %s", (input, expected) => {
    expect(parseSourceRef(input)).toEqual(expected);
  });

  it.each([
    ["https://t.me/+AbCdEf", "invite"],
    ["t.me/joinchat/xyz", "invite"],
    ["", "empty"],
    ["a b", "not_a_link"],
  ])("refuses %s", (input, reason) => {
    expect(() => parseSourceRef(input)).toThrow(SourceRefError);
    expect(() => parseSourceRef(input)).toThrow(reason);
  });
});
