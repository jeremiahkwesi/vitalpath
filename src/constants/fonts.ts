// src/constants/fonts.ts
// Works with all import styles:
// - import { fonts } from "...";
// - import fonts from "...";
// - import * as fonts from "..."  -> fonts.medium

export const regular = "System";
export const medium = "System";
export const semiBold = "System";
export const bold = "System";

export const fontWeights = {
  regular: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
} as const;

export const fonts = {
  regular,
  medium,
  semiBold,
  bold,
};

export default fonts;

// CommonJS interop safety (some tooling may require this)
try {
  // @ts-ignore
  if (typeof module !== "undefined" && module.exports) {
    // @ts-ignore
    module.exports = Object.assign({}, fonts, {
      fonts,
      default: fonts,
      regular,
      medium,
      semiBold,
      bold,
    });
  }
} catch {}