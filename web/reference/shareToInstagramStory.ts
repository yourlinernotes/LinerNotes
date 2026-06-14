// shareToInstagramStory.ts
// Shares a LinerNotes review card to Instagram Stories.
//
// Deps (all free; needs an EAS dev build, NOT Expo Go, because react-native-share
// is a native module):
//   npx expo install react-native-share expo-clipboard react-native-view-shot
//
// Setup once:
//   1. Register a free Meta App at developers.facebook.com -> grab the App ID.
//   2. Add the react-native-share config plugin in app.json so iOS gets the
//      `instagram-stories` query scheme and Android gets the share intent:
//        "plugins": [["react-native-share", { "ios": ["instagram-stories"], "android": [...] }]]
//   3. No Facebook Login and no Meta app review needed — this is the lightweight
//      "sharing to stories" deep link, not the heavyweight Stories API.

import Share from 'react-native-share';
import * as Clipboard from 'expo-clipboard';

const META_APP_ID = 'YOUR_META_APP_ID'; // from developers.facebook.com

export type StoryCard = {
  /** file:// URI of the rendered card image (see captureCard below). */
  imageUri: string;
  /** Deep link to the review, e.g. https://linernotes.app/anusha/girlpuke */
  reviewUrl: string;
  /** Two hex colours pulled from the album art, for the story gradient. */
  topColor: string;     // e.g. '#3a342c'
  bottomColor: string;  // e.g. '#100f0d'
  /** true  = full-bleed: the image IS the whole story (recommended, "finished" look)
   *  false = sticker: the card floats on the gradient, user can move/resize it */
  fullBleed?: boolean;
};

export type ShareResult = { ok: true } | { ok: false; reason: 'no-instagram' | 'error' };

/**
 * Copies the review link to the clipboard (so the user can add IG's link sticker
 * and paste, if they want a tappable link), then opens the IG story composer with
 * the card pre-loaded. The card's own handle/timestamp is the primary hook — the
 * link sticker is optional, not the mechanism.
 *
 * Caller should, on { ok: true }, show a one-line prompt:
 *   "Link copied — add a link sticker + paste if you want it tappable."
 */
export async function shareToInstagramStory(card: StoryCard): Promise<ShareResult> {
  // 1) Make the link available regardless of which route the user takes.
  try {
    await Clipboard.setStringAsync(card.reviewUrl);
  } catch {
    // Non-fatal: the handle baked into the card is the typed fallback.
  }

  // 2) Build the share payload. Full-bleed background vs. floating sticker.
  const base = {
    social: Share.Social.INSTAGRAM_STORIES,
    appId: META_APP_ID,
    backgroundBottomColor: card.bottomColor,
    backgroundTopColor: card.topColor,
  } as const;

  const options = card.fullBleed
    ? { ...base, backgroundImage: card.imageUri } // the whole story is the artifact
    : { ...base, stickerImage: card.imageUri };   // card floats on the gradient

  // 3) Open Instagram. If it isn't installed, shareSingle rejects — fall back to
  //    the OS share sheet so the loop still closes (link is already on clipboard).
  try {
    await Share.shareSingle(options as any);
    return { ok: true };
  } catch (err: any) {
    const notInstalled =
      typeof err?.message === 'string' &&
      /not installed|no app|cannot open|activity/i.test(err.message);

    try {
      await Share.open({ url: card.imageUri, message: card.reviewUrl });
    } catch {
      /* user cancelled or no target — nothing more to do */
    }
    return { ok: false, reason: notInstalled ? 'no-instagram' : 'error' };
  }
}

// ---------------------------------------------------------------------------
// Turning your on-screen card into the image to share.
//
// You design the card once as a normal React Native component (your <ReviewCard/>),
// then capture it to a PNG with react-native-view-shot. For the full-bleed story,
// render it inside a 1080x1920 frame (9:16) so it fills the story; for a sticker,
// render it at the card's natural size with a transparent background.
//
//   import { captureRef } from 'react-native-view-shot';
//
//   const cardRef = useRef(null);
//   // ...render <View ref={cardRef}><ReviewCard .../></View> off-screen or on a share screen...
//
//   const imageUri = await captureRef(cardRef, {
//     format: 'png',
//     quality: 1,
//     result: 'tmpfile',   // returns a file:// URI, which shareToInstagramStory wants
//     // For a 9:16 full-bleed story, size the wrapping View to 1080x1920 (or a /3 scale).
//   });
//
//   const res = await shareToInstagramStory({
//     imageUri,
//     reviewUrl: 'https://linernotes.app/anusha/girlpuke',
//     topColor: albumColors.top,
//     bottomColor: albumColors.bottom,
//     fullBleed: true,
//   });
//
//   if (res.ok) showToast('Link copied — add a link sticker + paste to make it tappable');
//   else if (res.reason === 'no-instagram') showToast('Instagram not found — shared via your other apps');
//
// Note: a transparent sticker PNG needs the captured View to have no background
// colour; a full-bleed background can be opaque since the gradient sits behind it
// anyway. Keep the handle + moment timestamp inside the card art itself so the
// loop closes even without the link sticker.
