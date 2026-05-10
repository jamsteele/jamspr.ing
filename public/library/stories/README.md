# Stories Directory

Each story lives as a single Markdown file: `<story-id>.md`.
Metadata for all stories lives in `index.json`.

The frontend (`script.js`) lazy-loads `<id>.md` when its hotspot is clicked.
If the file doesn't exist yet, the modal shows a "not yet added" message
and links to the source URL.

## Adding a story

1. Find the text on [Project Gutenberg](https://www.gutenberg.org) or [Standard Ebooks](https://standardebooks.org).
2. Save the cleaned text as `<story-id>.md` in this folder.
3. (Optional) Add a content note to `index.json` if the piece needs context (e.g., source acknowledgment for *The Two Sisters*).

## Markdown formatting

Stories are rendered as plain Markdown:

- Paragraphs separated by blank lines
- `*italic*`, `**bold**` work
- `> blockquote` for set-off passages
- `---` for scene breaks

The first paragraph gets a drop cap automatically — no special markup needed.

## Source URLs (all confirmed public domain)

| Story ID | Author | Project Gutenberg / Source |
|---|---|---|
| `the-two-sisters` | Pauline Johnson | https://www.gutenberg.org/ebooks/3478 (Legends of Vancouver) |
| `the-boy-who-drew-cats` | Lafcadio Hearn | _Not on PG; try Standard Ebooks or Internet Archive_ |
| `the-open-window` | Saki | https://www.gutenberg.org/ebooks/269 (Beasts and Super-Beasts) |
| `the-nightingale-and-the-rose` | Oscar Wilde | https://www.gutenberg.org/ebooks/902 |
| `the-postmaster` | Tagore | https://www.gutenberg.org/ebooks/34757 (Mashi, and Other Stories) |
| `the-bet` | Chekhov | https://www.gutenberg.org/ebooks/55283 (The Bet, and other stories) |
| `the-necklace` | Maupassant | https://www.gutenberg.org/ebooks/3090 (Complete Original Short Stories) |
| `the-restaurant-of-many-orders` | Miyazawa | https://en.wikisource.org/wiki/Translation:The_Restaurant_With_Many_Orders (CC BY-SA 3.0) |
| `the-quarantine-at-alexander-abrahams` | L.M. Montgomery | https://www.gutenberg.org/ebooks/1354 (Chronicles of Avonlea) |
| `the-marine-excursion` | Leacock | https://www.gutenberg.org/ebooks/3533 (Sunshine Sketches of a Little Town) |
| `dead-stars` | Benitez | https://en.wikisource.org/wiki/Dead_Stars |
| `how-much-land-does-a-man-need` | Tolstoy | https://www.gutenberg.org/ebooks/6157 |
| `to-build-a-fire` | Jack London | https://www.gutenberg.org/ebooks/2429 (Lost Face) |
| `service-the-cremation-of-sam-mcgee` | Robert Service | https://www.gutenberg.org/ebooks/207 (Spell of the Yukon and Other Verses) |
| `service-the-spell-of-the-yukon` | Robert Service | https://www.gutenberg.org/ebooks/207 (Spell of the Yukon and Other Verses) |
| `service-the-shooting-of-dan-mcgrew` | Robert Service | https://www.gutenberg.org/ebooks/207 (Spell of the Yukon and Other Verses) |

## Cleaning the text after fetching

Project Gutenberg files come with boilerplate at the top and bottom (license info, transcriber notes, etc). Strip these out so the Markdown contains only the story itself.

For collections (Wilde's *Happy Prince*, Service's *Songs of a Sourdough*, Montgomery's *Chronicles of Avonlea*, Leacock's *Sunshine Sketches*) — extract just the one story, not the whole book.

## Suggested workflow in Claude Code

```
You: "Fetch The Two Sisters by Pauline Johnson from Project Gutenberg
and save it as the-two-sisters.md. Strip the PG boilerplate and only keep
the story text. Use clean Markdown paragraphs."
```

Repeat for each story. Should take maybe 30 minutes total to populate all 17.

## Progress checklist

- [x] the-two-sisters.md
- [x] the-open-window.md
- [x] the-nightingale-and-the-rose.md
- [x] the-postmaster.md
- [x] the-bet.md
- [x] the-necklace.md
- [x] the-restaurant-of-many-orders.md _(CC BY-SA 3.0 translation from Wikisource — see attribution at bottom of file)_
- [x] the-quarantine-at-alexander-abrahams.md
- [x] the-marine-excursion.md
- [x] sagacious-marcela.md _(replaced "Dead Stars" — Filipino folktale, fully PD globally; Dead Stars couldn't be sourced cleanly outside US PD)_
- [x] how-much-land-does-a-man-need.md
- [x] to-build-a-fire.md
- [x] service-the-cremation-of-sam-mcgee.md
- [x] service-the-spell-of-the-yukon.md
- [x] service-the-shooting-of-dan-mcgrew.md

**Deferred (not in current MVP):**
- _the-boy-who-drew-cats_ — original Hearn 1898 booklet not on PG, Wikisource, or any open-access full-text source we can scrape. To revive: paste manually from a Hearn collection, or substitute a Hearn tale that IS on PG (e.g. Yuki-Onna or Mujina from Kwaidan, PG #1210).
- _the-tell-tale-heart_ — pulled because it's a first-person murder confession; too gruesome for the cozy room vibe. To swap a non-gruesome Poe back in: A Descent into the Maelström (PG #2148, same file) is a survival adventure with no violence.
