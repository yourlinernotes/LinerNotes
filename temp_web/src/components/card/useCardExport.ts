"use client";

import { toPng } from "html-to-image";
import { useCallback } from "react";

export function useCardExport() {
  const exportCard = useCallback(async (element: HTMLElement, reviewId: string) => {
    if (!element) {
      throw new Error("No element provided for export");
    }

    try {
      // Generate high-quality PNG
      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2, // 2x for retina displays
        backgroundColor: "#000000", // Ensure no transparency issues
      });

      // Download the image
      const link = document.createElement("a");
      link.download = `linernotes-${reviewId}.png`;
      link.href = dataUrl;
      link.click();

      return dataUrl;
    } catch (error) {
      console.error("Failed to export card:", error);
      throw error;
    }
  }, []);

  const copyCardToClipboard = useCallback(async (element: HTMLElement) => {
    if (!element) {
      throw new Error("No element provided for copy");
    }

    try {
      const blob = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2,
      }).then((dataUrl) => {
        return fetch(dataUrl).then((res) => res.blob());
      });

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);

      return true;
    } catch (error) {
      console.error("Failed to copy card:", error);
      throw error;
    }
  }, []);

  return { exportCard, copyCardToClipboard };
}
