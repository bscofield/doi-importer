# DOI Importer

An Obsidian plugin with two commands for working with DOIs:

- **Import DOI** — turns a selected DOI into a structured reference note, replacing the selection with a wiki-link.
- **Copy DOI citation** — replaces a selected DOI with a formatted citation string (APA, Chicago, etc.).

Both commands fetch data from [Crossref](https://www.crossref.org/) and accept DOIs in any of these formats:
- `10.1017/s0140525x9800123x`
- `doi:10.1017/s0140525x9800123x`
- `https://doi.org/10.1017/s0140525x9800123x`

## Commands

### Import DOI

1. Select a DOI in any note.
2. Open the command palette (`Cmd/Ctrl+P`) and run **Import DOI**.
3. The plugin fetches metadata from the Crossref API and creates a reference note. The selected text is replaced with a wiki-link: `[[howe1998|Innate talents: Reality or myth?]]`.

### Copy DOI citation

1. Select a DOI in any note.
2. Open the command palette (`Cmd/Ctrl+P`) and run **Copy DOI citation**.
3. The selected DOI is replaced with a plain-text formatted citation in your configured style (default: APA).

Example output with `apa` style:

```
Howe, M. J. A., Davidson, J. W., & Sloboda, J. A. (1998). Innate talents: Reality or myth? Behavioral and Brain Sciences, 21(3), 399–407. https://doi.org/10.1017/s0140525x9800123x
```

The citation style is configurable in settings. All 2,400+ [CSL styles](https://api.crossref.org/v1/styles) are supported (e.g. `chicago-author-date`, `nature`, `modern-language-association`).

## Generated note

Each reference note contains YAML frontmatter and a body section:

```markdown
---
doi: "10.1017/s0140525x9800123x"
title: "Innate talents: Reality or myth?"
aliases:
  - "10.1017/s0140525x9800123x"
  - "howe1998"
  - "Innate talents: Reality or myth?"
authors:
  - "Howe, Michael J. A."
  - "Davidson, Jane W."
  - "Sloboda, John A."
year: 1998
journal: "Behavioral and Brain Sciences"
volume: "21"
issue: "3"
pages: "399–407"
publisher: "Cambridge University Press (CUP)"
url: "https://doi.org/10.1017/s0140525x9800123x"
type: "journal-article"
---

# Innate talents: Reality or myth?

**Authors:** Howe, Michael J. A.; Davidson, Jane W.; Sloboda, John A.

**Abstract:**

Talents that selectively facilitate the acquisition of high levels of skill are said to be present in some children but not others. The evidence for this includes biological correlates of specific abilities, certain rare abilities in autistic savants, and the seemingly spontaneous emergence of exceptional abilities in young children, but there is also contrary evidence indicating an absence of early precursors of high skill levels. An analysis of positive and negative evidence and arguments suggests that differences in early experiences, preferences, opportunities, habits, training, and practice are the real determinants of excellence.
```

Fields that are absent from the Crossref response are omitted from the frontmatter. The `aliases` field always includes the bare DOI, the citekey, and the full title, so the note is findable by any of them.

## Citekey and filename

The default citekey format is `familyyear` (e.g. `howe1998`), always lowercased. The default filename template is `{{citekey}}`.

If two different papers would produce the same citekey, the second one gets a letter suffix: `howe1998b`, `howe1998c`, and so on. If you import the same DOI twice, the plugin recognises the existing note by its `doi` frontmatter field and links to it rather than creating a duplicate.

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
| `{{citekey}}` | `howe1998` | Author family name + year, lowercased |
| `{{doi-slug}}` | `10-1017-s0140525x9800123x` | DOI with non-alphanumeric characters replaced by `-` |
| `{{title}}` | `Innate talents Reality or myth` | Title with problematic filename characters stripped; case and spaces preserved |
| `{{year}}` | `1998` | Four-digit publication year |

For example, the template `{{title}} ({{year}})` produces `Innate talents Reality or myth (1998).md`.
