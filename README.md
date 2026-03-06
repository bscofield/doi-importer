# DOI Importer

An Obsidian plugin with two commands for working with DOIs:

- **Import DOI** — turns a selected DOI into a structured reference note, replacing the selection with a wiki-link.
- **Copy DOI citation** — replaces a selected DOI with a formatted citation string (APA, Chicago, etc.).

Both commands fetch data from [Crossref](https://www.crossref.org/) and accept DOIs in any of these formats:
- `10.1037/0003-066X.59.1.29`
- `doi:10.1037/0003-066X.59.1.29`
- `https://doi.org/10.1037/0003-066X.59.1.29`

## Commands

### Import DOI

1. Select a DOI in any note.
2. Open the command palette (`Cmd/Ctrl+P`) and run **Import DOI**.
3. The plugin fetches metadata from the Crossref API and creates a reference note. The selected text is replaced with a wiki-link: `[[smith2003|Article Title]]`.

### Copy DOI citation

1. Select a DOI in any note.
2. Open the command palette (`Cmd/Ctrl+P`) and run **Copy DOI citation**.
3. The selected DOI is replaced with a plain-text formatted citation in your configured style (default: APA).

Example output with `apa` style:

```
Pinker, S. (2003). How the mind works. American Psychologist, 59(1), 29–40. https://doi.org/10.1037/0003-066X.59.1.29
```

The citation style is configurable in settings. All 2,400+ [CSL styles](https://api.crossref.org/v1/styles) are supported (e.g. `chicago-author-date`, `nature`, `modern-language-association`).

## Generated note

Each reference note contains YAML frontmatter and a body section:

```markdown
---
doi: "10.1037/0003-066X.59.1.29"
title: "How the Mind Works"
aliases:
  - "10.1037/0003-066X.59.1.29"
  - "How the Mind Works"
authors:
  - "Pinker, Steven"
year: 2003
journal: "American Psychologist"
volume: "59"
issue: "1"
pages: "29–40"
publisher: "APA"
url: "https://doi.org/10.1037/0003-066X.59.1.29"
type: "journal-article"
---

# How the Mind Works

**Authors:** Pinker, Steven

**Abstract:**

Abstract text here...
```

Fields that are absent from the Crossref response are omitted from the frontmatter. The `aliases` field always includes both the bare DOI and the full title, so the note is findable by either.

## Citekey and filename

The default citekey format is `familyyear` (e.g. `smith2023`), always lowercased. The default filename is the citekey.

If two different papers would produce the same citekey, the second one gets a letter suffix: `smith2023b`, `smith2023c`, and so on. If you import the same DOI twice, the plugin recognises the existing note by its `doi` frontmatter field and links to it rather than creating a duplicate.

## Settings

| Setting | Default | Description |
|---|---|---|
| Notes folder | `References` | Folder where reference notes are created. Created automatically if it doesn't exist. |
| File name template | `{{citekey}}` | Template for note filenames. See tokens below. |
| Open note after import | on | Opens the new (or existing) note after import. |
| Citation style | `apa` | CSL style name used by **Copy DOI citation**. Full list at `https://api.crossref.org/v1/styles`. |

### Filename template tokens

| Token | Example output | Description |
|---|---|---|
| `{{citekey}}` | `smith2023` | Author family name + year, lowercased |
| `{{doi-slug}}` | `10-1037-0003-066x-59-1-29` | DOI with non-alphanumeric characters replaced by `-` |
| `{{title}}` | `how-the-mind-works` | First 40 characters of title, lowercased, spaces to dashes |
