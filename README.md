# DOI Importer

An Obsidian plugin that turns a selected DOI into a reference note. Highlight a DOI in any note, run the command, and the plugin fetches metadata from the [Crossref API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) and creates a structured note — replacing your selection with a wiki-link to it.

## Usage

1. In any note, select a DOI. Any of these formats work:
   - `10.1037/0003-066X.59.1.29`
   - `doi:10.1037/0003-066X.59.1.29`
   - `https://doi.org/10.1037/0003-066X.59.1.29`
2. Open the command palette (`Cmd/Ctrl+P`) and run **Import DOI**.
3. The plugin fetches metadata and creates a reference note. The selected text is replaced with a wiki-link: `[[smith2003|Article Title]]`.

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

### Filename template tokens

| Token | Example output | Description |
|---|---|---|
| `{{citekey}}` | `smith2023` | Author family name + year, lowercased |
| `{{doi-slug}}` | `10-1037-0003-066x-59-1-29` | DOI with non-alphanumeric characters replaced by `-` |
| `{{title}}` | `how-the-mind-works` | First 40 characters of title, lowercased, spaces to dashes |
