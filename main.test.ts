import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    stripDoi,
    isValidDoi,
    stripJats,
    formatAuthors,
    buildCitekey,
    resolveFileName,
    findNoteByDoi,
    findAvailableFileName,
    buildNoteContent,
    fetchCitation,
    DEFAULT_SETTINGS,
} from './main';
import { requestUrl } from 'obsidian';

// ─── DEFAULT_SETTINGS ────────────────────────────────────────────────────────

describe('DEFAULT_SETTINGS', () => {
    it('has citationStyle set to apa', () => {
        expect(DEFAULT_SETTINGS.citationStyle).toBe('apa');
    });
});

// ─── fetchCitation ────────────────────────────────────────────────────────────

describe('fetchCitation', () => {
    const mockedRequestUrl = vi.mocked(requestUrl);

    beforeEach(() => {
        mockedRequestUrl.mockResolvedValue({ status: 200, text: '  Smith, J. (2023). A title. Nature.  ' } as any);
    });

    it('sends Accept header with configured style and locale', async () => {
        await fetchCitation('10.1037/abc', 'chicago-author-date');
        expect(mockedRequestUrl).toHaveBeenCalledWith(expect.objectContaining({
            headers: { 'Accept': 'text/x-bibliography; style=chicago-author-date; locale=en-US' },
        }));
    });

    it('sends Accept header with apa style by default', async () => {
        await fetchCitation('10.1037/abc', 'apa');
        expect(mockedRequestUrl).toHaveBeenCalledWith(expect.objectContaining({
            headers: { 'Accept': 'text/x-bibliography; style=apa; locale=en-US' },
        }));
    });

    it('calls doi.org with the encoded DOI', async () => {
        await fetchCitation('10.1037/abc', 'apa');
        expect(mockedRequestUrl).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://doi.org/10.1037%2Fabc',
            method: 'GET',
        }));
    });

    it('returns trimmed citation text on success', async () => {
        const result = await fetchCitation('10.1037/abc', 'apa');
        expect(result).toBe('Smith, J. (2023). A title. Nature.');
    });

    it('throws on non-200 status', async () => {
        mockedRequestUrl.mockResolvedValue({ status: 404, text: '' } as any);
        await expect(fetchCitation('10.1037/abc', 'apa')).rejects.toThrow('Status 404');
    });
});

// ─── stripDoi ────────────────────────────────────────────────────────────────

describe('stripDoi', () => {
    it('leaves a bare DOI unchanged', () => {
        expect(stripDoi('10.1037/abc')).toBe('10.1037/abc');
    });

    it('strips https://doi.org/ prefix', () => {
        expect(stripDoi('https://doi.org/10.1037/abc')).toBe('10.1037/abc');
    });

    it('strips http://doi.org/ prefix', () => {
        expect(stripDoi('http://doi.org/10.1037/abc')).toBe('10.1037/abc');
    });

    it('strips doi: prefix', () => {
        expect(stripDoi('doi:10.1037/abc')).toBe('10.1037/abc');
    });

    it('strips doi: prefix case-insensitively', () => {
        expect(stripDoi('DOI:10.1037/abc')).toBe('10.1037/abc');
    });

    it('strips https://doi.org/ prefix case-insensitively', () => {
        expect(stripDoi('HTTPS://DOI.ORG/10.1037/abc')).toBe('10.1037/abc');
    });
});

// ─── isValidDoi ──────────────────────────────────────────────────────────────

describe('isValidDoi', () => {
    it('accepts a DOI starting with 10.', () => {
        expect(isValidDoi('10.1037/abc')).toBe(true);
    });

    it('rejects a plain URL', () => {
        expect(isValidDoi('https://doi.org/10.1037/abc')).toBe(false);
    });

    it('rejects arbitrary text', () => {
        expect(isValidDoi('not a doi')).toBe(false);
    });

    it('rejects an empty string', () => {
        expect(isValidDoi('')).toBe(false);
    });
});

// ─── stripJats ───────────────────────────────────────────────────────────────

describe('stripJats', () => {
    it('removes XML tags', () => {
        expect(stripJats('<jats:p>Hello world</jats:p>')).toBe('Hello world');
    });

    it('removes nested tags', () => {
        expect(stripJats('<p>Hello <em>world</em></p>')).toBe('Hello world');
    });

    it('collapses extra whitespace', () => {
        expect(stripJats('Hello   \n  world')).toBe('Hello world');
    });

    it('trims leading and trailing whitespace', () => {
        expect(stripJats('  Hello world  ')).toBe('Hello world');
    });

    it('passes plain text through unchanged', () => {
        expect(stripJats('Plain text.')).toBe('Plain text.');
    });
});

// ─── formatAuthors ───────────────────────────────────────────────────────────

describe('formatAuthors', () => {
    it('formats family + given as "Family, Given"', () => {
        expect(formatAuthors([{ family: 'Smith', given: 'John' }])).toEqual(['Smith, John']);
    });

    it('formats family-only author', () => {
        expect(formatAuthors([{ family: 'Smith' }])).toEqual(['Smith']);
    });

    it('formats organisational author via name field', () => {
        expect(formatAuthors([{ name: 'WHO' }])).toEqual(['WHO']);
    });

    it('skips authors with no usable fields', () => {
        expect(formatAuthors([{}])).toEqual([]);
    });

    it('handles a mixed list', () => {
        expect(formatAuthors([
            { family: 'Smith', given: 'John' },
            { name: 'ACME Corp' },
            { family: 'Jones' },
        ])).toEqual(['Smith, John', 'ACME Corp', 'Jones']);
    });
});

// ─── buildCitekey ────────────────────────────────────────────────────────────

describe('buildCitekey', () => {
    it('produces familyyear, lowercased', () => {
        expect(buildCitekey({
            author: [{ family: 'Smith' }],
            issued: { 'date-parts': [[2023]] },
        })).toBe('smith2023');
    });

    it('uses first author only', () => {
        expect(buildCitekey({
            author: [{ family: 'Smith' }, { family: 'Jones' }],
            issued: { 'date-parts': [[2023]] },
        })).toBe('smith2023');
    });

    it('falls back to Unknown when author is missing', () => {
        expect(buildCitekey({ issued: { 'date-parts': [[2023]] } })).toBe('unknown2023');
    });

    it('falls back to XXXX when year is missing', () => {
        expect(buildCitekey({ author: [{ family: 'Smith' }] })).toBe('smithxxxx');
    });

    it('falls back to unknownXXXX when both are missing', () => {
        expect(buildCitekey({})).toBe('unknownxxxx');
    });

    it('lowercases mixed-case family names', () => {
        expect(buildCitekey({
            author: [{ family: 'MacDonald' }],
            issued: { 'date-parts': [[2020]] },
        })).toBe('macdonald2020');
    });
});

// ─── resolveFileName ─────────────────────────────────────────────────────────

describe('resolveFileName', () => {
    const msg = {
        author: [{ family: 'Smith' }],
        issued: { 'date-parts': [[2023]] as [number[]] },
        title: ['How the Mind Works'],
    };

    it('replaces {{citekey}}', () => {
        expect(resolveFileName('{{citekey}}', msg, '10.1/abc')).toBe('smith2023');
    });

    it('replaces {{doi-slug}}', () => {
        expect(resolveFileName('{{doi-slug}}', msg, '10.1037/abc.123')).toBe('10-1037-abc-123');
    });

    it('replaces {{title}} with lowercased slug of first 40 chars', () => {
        expect(resolveFileName('{{title}}', msg, '10.1/x')).toBe('how-the-mind-works');
    });

    it('truncates title slug at 40 characters', () => {
        const longTitle = { ...msg, title: ['A'.repeat(50)] };
        expect(resolveFileName('{{title}}', longTitle, '10.1/x')).toHaveLength(40);
    });

    it('supports combining tokens', () => {
        expect(resolveFileName('{{citekey}}-{{doi-slug}}', msg, '10.1/ab')).toBe('smith2023-10-1-ab');
    });
});

// ─── findAvailableFileName ───────────────────────────────────────────────────

describe('findAvailableFileName', () => {
    const makeApp = (existingPaths: string[]) => ({
        vault: {
            getFileByPath: vi.fn((path: string) =>
                existingPaths.includes(path) ? { path } : null
            ),
        },
    });

    it('returns baseName when the slot is free', () => {
        const app = makeApp([]);
        expect(findAvailableFileName(app as any, 'References', 'smith2023')).toBe('smith2023');
    });

    it('appends b when baseName is taken', () => {
        const app = makeApp(['References/smith2023.md']);
        expect(findAvailableFileName(app as any, 'References', 'smith2023')).toBe('smith2023b');
    });

    it('appends c when baseName and b are taken', () => {
        const app = makeApp(['References/smith2023.md', 'References/smith2023b.md']);
        expect(findAvailableFileName(app as any, 'References', 'smith2023')).toBe('smith2023c');
    });

    it('works through multiple suffixes', () => {
        const taken = ['smith2023', 'smith2023b', 'smith2023c', 'smith2023d']
            .map(n => `References/${n}.md`);
        const app = makeApp(taken);
        expect(findAvailableFileName(app as any, 'References', 'smith2023')).toBe('smith2023e');
    });
});

// ─── findNoteByDoi ───────────────────────────────────────────────────────────

describe('findNoteByDoi', () => {
    const makeApp = (files: { path: string; doi?: string }[]) => ({
        vault: {
            getMarkdownFiles: () => files.map(f => ({ path: f.path, basename: f.path })),
        },
        metadataCache: {
            getFileCache: (file: { path: string }) => {
                const f = files.find(x => x.path === file.path);
                return f?.doi ? { frontmatter: { doi: f.doi } } : null;
            },
        },
    });

    it('returns the file whose frontmatter doi matches', () => {
        const app = makeApp([
            { path: 'References/jones2020.md', doi: '10.1/xyz' },
            { path: 'References/smith2023.md', doi: '10.1/abc' },
        ]);
        const result = findNoteByDoi(app as any, '10.1/abc');
        expect(result).not.toBeNull();
        expect((result as any).path).toBe('References/smith2023.md');
    });

    it('returns null when no file matches', () => {
        const app = makeApp([{ path: 'References/smith2023.md', doi: '10.1/other' }]);
        expect(findNoteByDoi(app as any, '10.1/abc')).toBeNull();
    });

    it('returns null for an empty vault', () => {
        const app = makeApp([]);
        expect(findNoteByDoi(app as any, '10.1/abc')).toBeNull();
    });

    it('ignores files with no doi frontmatter', () => {
        const app = makeApp([{ path: 'References/smith2023.md' }]);
        expect(findNoteByDoi(app as any, '10.1/abc')).toBeNull();
    });
});

// ─── buildNoteContent ────────────────────────────────────────────────────────

describe('buildNoteContent', () => {
    const fullMsg = {
        title: ['How the Mind Works'],
        author: [{ family: 'Smith', given: 'John' }, { family: 'Jones', given: 'Alice' }],
        issued: { 'date-parts': [[2023]] as [number[]] },
        'container-title': ['Nature'],
        volume: '42',
        issue: '3',
        page: '100-110',
        publisher: 'Springer',
        URL: 'https://doi.org/10.1/abc',
        type: 'journal-article',
        abstract: '<jats:p>An abstract.</jats:p>',
    };

    it('opens and closes with ---', () => {
        const content = buildNoteContent(fullMsg, '10.1/abc');
        const lines = content.split('\n');
        expect(lines[0]).toBe('---');
        const closingIndex = lines.indexOf('---', 1);
        expect(closingIndex).toBeGreaterThan(0);
    });

    it('includes doi in frontmatter', () => {
        expect(buildNoteContent(fullMsg, '10.1/abc')).toContain('doi: "10.1/abc"');
    });

    it('includes title in frontmatter', () => {
        expect(buildNoteContent(fullMsg, '10.1/abc')).toContain('title: "How the Mind Works"');
    });

    it('includes both DOI and title as aliases', () => {
        const content = buildNoteContent(fullMsg, '10.1/abc');
        expect(content).toContain('  - "10.1/abc"');
        expect(content).toContain('  - "How the Mind Works"');
    });

    it('includes authors in frontmatter', () => {
        const content = buildNoteContent(fullMsg, '10.1/abc');
        expect(content).toContain('  - "Smith, John"');
        expect(content).toContain('  - "Jones, Alice"');
    });

    it('includes year, journal, volume, issue, pages, publisher, url, type', () => {
        const content = buildNoteContent(fullMsg, '10.1/abc');
        expect(content).toContain('year: 2023');
        expect(content).toContain('journal: "Nature"');
        expect(content).toContain('volume: "42"');
        expect(content).toContain('issue: "3"');
        expect(content).toContain('pages: "100-110"');
        expect(content).toContain('publisher: "Springer"');
        expect(content).toContain('url: "https://doi.org/10.1/abc"');
        expect(content).toContain('type: "journal-article"');
    });

    it('falls back to https://doi.org/{doi} for url when URL field absent', () => {
        const msg = { ...fullMsg, URL: undefined };
        expect(buildNoteContent(msg, '10.1/abc')).toContain('url: "https://doi.org/10.1/abc"');
    });

    it('omits optional fields when absent', () => {
        const content = buildNoteContent({ title: ['Title'] }, '10.1/abc');
        expect(content).not.toContain('journal:');
        expect(content).not.toContain('volume:');
        expect(content).not.toContain('issue:');
        expect(content).not.toContain('pages:');
        expect(content).not.toContain('publisher:');
        expect(content).not.toContain('type:');
        expect(content).not.toContain('year:');
    });

    it('uses title as H1 heading', () => {
        expect(buildNoteContent(fullMsg, '10.1/abc')).toContain('\n# How the Mind Works\n');
    });

    it('falls back to DOI as H1 heading when title absent', () => {
        expect(buildNoteContent({}, '10.1/abc')).toContain('\n# 10.1/abc\n');
    });

    it('renders authors in body', () => {
        const content = buildNoteContent(fullMsg, '10.1/abc');
        expect(content).toContain('**Authors:** Smith, John; Jones, Alice');
    });

    it('omits Authors line when no authors', () => {
        expect(buildNoteContent({ title: ['Title'] }, '10.1/abc')).not.toContain('**Authors:**');
    });

    it('strips JATS tags from abstract in body', () => {
        const content = buildNoteContent(fullMsg, '10.1/abc');
        expect(content).toContain('An abstract.');
        expect(content).not.toContain('<jats:p>');
    });

    it('omits Abstract section when abstract absent', () => {
        const msg = { ...fullMsg, abstract: undefined };
        expect(buildNoteContent(msg, '10.1/abc')).not.toContain('**Abstract:**');
    });

    it('escapes double quotes in title', () => {
        const msg = { ...fullMsg, title: ['Title with "quotes"'] };
        const content = buildNoteContent(msg, '10.1/abc');
        expect(content).toContain('title: "Title with \\"quotes\\""');
    });
});
