# Node.js API reference

**Note**: the API is not fully stable yet. It may change at every new version. There are many methods, types and internal data structures that are not yet exposed.

### Importing as a Node.js module
To import the `echograden` package as a Node.js module:

Install as a dependency in your project:
```bash
npm install echogarden
```

Import with:
```ts
import * as Echogarden from 'echogarden'
```

All methods, properties and arguments have TypeScript type information. You can use it to get more detailed and up-to-date type information that may not be covered here.

### Related pages
* [Options reference](Options.md)
* [List of all supported engines](Engines.md)
* [Quick guide to the command line interface](CLI.md)
* [WebSocket server reference](Server.md)

## Text-to-speech

### `synthesize(input, options, onSegment, onSentence)`

Synthesizes the given input.

* `input`: text to synthesize, can be a `string`, or a `string[]`. When given an array of strings, the elements of the array would be seen as predefined segments (this is useful if you would like to have more control over how segments are split, or your input has a special format requiring a custom splitting method).
* `options`: synthesis options object
* `onSegment`: a callback that is called whenever a segment has been synthesized (optional)
* `onSentence`: a callback that is called whenever a sentence has been synthesized (optional)

#### Returns (via promise):

```ts
{
	audio: RawAudio | Buffer
	timeline: Timeline
	language: string
}
```

`audio` may either be a
* `RawAudio` object, which is a structure containing the sample rate and raw 32-bit float channels:
```ts
{
	sampleRate: number
	channels: Float32Array[]
}
```
* A `Uint8Array` containing the audio in encoded form, in the case a particular codec was specified in the `outputAudioFormat.codec` option.

#### Segment and sentence event callbacks

You can optionally pass two `async` callbacks to `synthesize`, `onSegment` and `onSentence`.

For example:
```ts
async function onSegment(data: SynthesisSegmentEventData) {
	console.log(data.transcript)
}

const { audio } = await Echogarden.synthesize("Hello World!", { engine: 'espeak' }, onSegment)
```

`SynthesisSegmentEventData` is an object with the structure:
```ts
{
	index: number              // Index of part
	total: number              // Total number of parts

	audio: RawAudio | Buffer   // Audio for part

	timeline: Timeline         // Timeline for part
	transcript: string         // Transcript for part
	language: string           // Language for part

	peakDecibelsSoFar: number  // Peak decibels measured for all synthesized audio, so far
}
```

### `requestVoiceList(options)`

Requests a list of voices for a particular engine.

* `options`: voice list request options object

#### Returns (via promise):

```ts
{
	voiceList: SynthesisVoice[]
	bestMatchingVoice: SynthesisVoice
}
```

## Speech-to-text

### `recognize(input, options)`

Applies speech recognition to the input.

* `input`: can be an audio file path (`string`), encoded audio (`Buffer` or `Uint8array`) or a raw audio object (`RawAudio`)
* `options`: recognition options object

#### Returns (via promise):

```ts
{
	transcript: string

	timeline: Timeline
	wordTimeline: Timeline

	language: string

	inputRawAudio: RawAudio
	isolatedRawAudio?: RawAudio
	backgroundRawAudio?: RawAudio
}
```

## Speech-to-transcript alignment

### `align(input, transcript, options)`

Aligns input audio with the given transcript.

* `input`: can be an audio file path (`string`), encoded audio (`Buffer` or `Uint8array`) or a raw audio object (`RawAudio`)
* `transcript`: the transcript to align to
* `options`: alignment options object

#### Returns (via promise):

```ts
{
	timeline: Timeline
	wordTimeline: Timeline

	transcript: string
	language: string

	inputRawAudio: RawAudio
	isolatedRawAudio?: RawAudio
	backgroundRawAudio?: RawAudio
}
```

## Speech-to-text translation

### `translateSpeech(input, options)`

Translates speech audio directly to a transcript in a different language (only English is currently supported).

* `input`: can be an audio file path (`string`), encoded audio (`Buffer` or `Uint8array`) or a raw audio object (`RawAudio`)
* `options`: speech translation options object

#### Returns (via promise):
```ts
{
	transcript: string
	timeline: Timeline
	wordTimeline?: Timeline

	sourceLanguage: string
	targetLanguage: string

	inputRawAudio: RawAudio
	isolatedRawAudio?: RawAudio
	backgroundRawAudio?: RawAudio
}
```

## Text-to-text translation

### `translateText(input, options)`

Translates text to text.

* `input`: string
* `options`: text translation options object

#### Returns (via promise):
```ts
{
	text: string
	translatedText: string

	translationPairs: TranslationPair[]

	sourceLanguage: string
	targetLanguage: string
}
```

`translationPairs` is an array of objects corresponding to individual segments of the text and their translations.

## Speech-to-translated-transcript alignment

### `alignTranslation(input, translatedTranscript, options)`

Aligns input audio with the given translated transcript.

* `input`: can be an audio file path (`string`), encoded audio (`Buffer` or `Uint8array`) or a raw audio object (`RawAudio`)
* `translatedTranscript`: the translated transcript to align to
* `options`: translation alignment options object

#### Returns (via promise):

```ts
{
	timeline: Timeline
	wordTimeline: Timeline

	translatedTranscript: string
	sourceLanguage: string
	targetLanguage: string

	inputRawAudio: RawAudio
	isolatedRawAudio?: RawAudio
	backgroundRawAudio?: RawAudio
}
```

### `alignTranscriptAndTranslation(input, transcript, translatedTranscript, options)`

Aligns input audio to both the native language transcript a translated one.

* `input`: can be an audio file path (`string`), encoded audio (`Buffer` or `Uint8array`) or a raw audio object (`RawAudio`)
* `transcript`: the transcript to align to, in the native speech language
* `translatedTranscript`: the translated transcript to align to
* `options`: transcript and translation alignment options object

#### Returns (via promise):

```ts
{
	timeline: Timeline
	wordTimeline: Timeline

	translatedTimeline: Timeline
	translatedWordTimeline: Timeline

	transcript: string
	translatedTranscript: string

	sourceLanguage: string
	targetLanguage: string

	inputRawAudio: RawAudio
	isolatedRawAudio?: RawAudio
	backgroundRawAudio?: RawAudio
}
```

### `alignTimelineTranslation(inputTimeline, translatedTranscript, options)`

Aligns given timeline with its translated transcript.

* `inputTimeline`: input timeline in the native language
* `translatedTranscript`: the translated transcript to align to
* `options`: timeline translation alignment options object

#### Returns (via promise):

```ts
{
	timeline: Timeline
	wordTimeline: Timeline

	sourceLanguage?: string
	targetLanguage: string

	rawAudio?: RawAudio
}
```

## Language detection

### `detectSpeechLanguage(input, options)`

Detects language of spoken audio.

* `input`: can be an audio file path (`string`), encoded audio (`Buffer` or `Uint8array`) or a raw audio object (`RawAudio`)
* `options`: speech language detection options object

#### Returns (via promise):
```ts
{
	detectedLanguage: string
	detectedLanguageName: string
	detectedLanguageProbabilities: LanguageDetectionResults
}
```

### `detectTextLanguage(input, options)`

Detects language of text.

* `input`: input text as `string`
* `options`: text language detection options object

#### Returns (via promise):
```ts
{
	detectedLanguage: string
	detectedLanguageName: string
	detectedLanguageProbabilities: LanguageDetectionResults
}
```

## Voice activity detection

### `detectVoiceActivity(input, options)`

Detects voice activity in audio (non-real-time).

* `input`: can be an audio file path (`string`), encoded audio (`Buffer` or `Uint8array`) or a raw audio object (`RawAudio`)
* `options`: voice activity detection options object

#### Returns (via promise):
```ts
{
	timeline: Timeline
}
```

## Speech denoising

### `denoise(input, options)`

Tries to reduce background noise in spoken audio.

* `input`: can be an audio file path (`string`), encoded audio (`Buffer` or `Uint8array`) or a raw audio object (`RawAudio`)
* `options`: denoising options object

#### Returns (via promise):
```ts
{
	denoisedAudio: RawAudio
}
```

## Source separation

### `isolate(input, options)`

Attempts to isolate an individual [audio stem](https://en.wikipedia.org/wiki/Stem_(audio)), like human voice, or one or more musical instruments (depending on model training), from the given waveform.

* `input`: can be an audio file path (`string`), encoded audio (`Buffer` or `Uint8array`) or a raw audio object (`RawAudio`)
* `options`: source separation options object

#### Returns (via promise):
```ts
{
	inputRawAudio: RawAudio
	isolatedRawAudio: RawAudio
	backgroundRawAudio: RawAudio
}
```

## Subtitles

### `timelineToSubtitles(timeline, options)`

Converts a timeline to subtitles.

* `timeline`: timeline object
* `options`: subtitles configuration object

#### Returns:

Subtitle file content, as a string.

### `subtitlesToTimeline(subtitles)`

Converts subtitles to a timeline.

* `subtitles`: timeline object

**Note**: This function simply converts each individual cue to a segment entry in a timeline. Since subtitle cues may contain parts of sentences or phrases, this may not produce very useful results for your needs. However, you can use it as a means to parse a subtitle file (`srt` or `vtt`), and apply your own processing later.

#### Returns:

Timeline object.

## Global options

### `setGlobalOption(key, value)`

Sets a global option.

See the [options reference](Options.md) for more details about the available global options.


### `getGlobalOption(key)`

Gets a global option.

#### Returns:

The value associated with the given key.

## TODO

* Expose more methods that may be useful for developers, like phonemization, etc.
* Expose audio playback used in CLI, possibly with timeline synchronization support.
