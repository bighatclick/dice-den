# Store listing (English)

Source of truth for the App Store and Google Play text (specs.md §2).
`src/__tests__/storeText.test.ts` checks lengths, banned words, emoji and trademarks.

| File | Limit |
|---|---|
| `ios/title.txt` | 30 |
| `ios/subtitle.txt` | 30 |
| `ios/keywords.txt` | 100, comma-separated, no spaces |
| `ios/promotional-text.txt` | 170 |
| `ios/description.txt` | 4000 |
| `play/title.txt` | 30 |
| `play/short-description.txt` | 80 |
| `play/full-description.txt` | 4000 |
| `screenshot-captions.txt` | one per screenshot |

Still to write once ads and purchases exist (build phase 5): the App Review
notes (ad rules, Remove Ads, packs, optional rewarded ads) and the privacy
labels for AdMob.
