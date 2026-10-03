import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALLBACK_MESSAGE,
  parseGoogleCallback,
} from "./google-callback";

describe("parseGoogleCallback", () => {
  it("extracts the ID token and state from Google's fragment", () => {
    expect(
      parseGoogleCallback("#state=abc&id_token=eyJ.x.y&authuser=0"),
    ).toEqual({
      type: GOOGLE_CALLBACK_MESSAGE,
      state: "abc",
      idToken: "eyJ.x.y",
      error: null,
    });
  });

  it("reports Google's error (user denied consent)", () => {
    expect(parseGoogleCallback("#error=access_denied&state=abc")).toMatchObject(
      {
        state: "abc",
        idToken: null,
        error: "access_denied",
      },
    );
  });

  it("treats a fragment with no token as a failure, not a success", () => {
    expect(parseGoogleCallback("").error).toBe("missing_id_token");
  });
});
