# Audio Assets for Vibe Enhancements

This directory contains sound effects for AI action sensory feedback.

## Required Files

### 1. clank.mp3

- **Purpose**: Provoke action sound (Muse mode AI intervention)
- **Specifications**:
  - Duration: 0.5-1 second
  - Size: <100KB
  - Type: Metallic locking sound that reinforces "lock" metaphor
- **Source**: Freesound.org or Zapsplat (CC0 or CC BY license)
- **Search Terms**: "metal lock clank", "metal impact", "locking mechanism"

### 2. whoosh.mp3

- **Purpose**: Delete action sound (Loki mode text deletion)
- **Specifications**:
  - Duration: 0.5-1 second
  - Size: <100KB
  - Type: Wind/swoosh sound that conveys removal or disappearance
- **Source**: Freesound.org or Zapsplat (CC0 or CC BY license)
- **Search Terms**: "air whoosh", "wind swoosh", "disappear"

### 3. bonk.mp3

- **Purpose**: Rejection action sound (lock enforcement)
- **Status**: Already exists from P1 implementation
- **Type**: Impact sound for rejection feedback

## Download Instructions

1. Visit [Freesound.org](https://freesound.org) or [Zapsplat.com](https://www.zapsplat.com)
2. Search for sounds matching the descriptions above
3. Download files with CC0 or CC BY licenses
4. Optimize to <100KB if needed (convert to MP3, adjust bitrate)
5. Rename files to match the filenames above
6. Place files in this directory (`client/src/assets/audio/`)
7. If using CC BY licensed files, add attribution to `client/CREDITS.md`

## Integration

These audio files are loaded and played by the `useAudioFeedback` hook using the Web Audio API:

```typescript
// Preloaded on hook mount
const audioBuffers = {
  clank: await loadAudioBuffer("/assets/audio/clank.mp3"),
  whoosh: await loadAudioBuffer("/assets/audio/whoosh.mp3"),
  bonk: await loadAudioBuffer("/assets/audio/bonk.mp3"),
};

// Played on AI action
await playAudio(AIActionType.PROVOKE); // → clank.mp3
await playAudio(AIActionType.DELETE); // → whoosh.mp3
await playAudio(AIActionType.REJECT); // → bonk.mp3
```

## Status

- [x] clank.mp3 - ✅ Downloaded and placed (28.8 KB)
- [x] whoosh.mp3 - ✅ Downloaded and placed (18.4 KB)
- [x] bonk.mp3 - ✅ Downloaded and placed (10.9 KB)

**Note**: All audio files are ready for testing! Full sensory feedback system is operational.
