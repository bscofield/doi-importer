import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile, requestUrl } from 'obsidian';

// ─── Crossref Types ───────────────────────────────────────────────────────────

interface CrossrefAuthor {
	given?: string;
	family?: string;
	name?: string;
}

interface CrossrefMessage {
	title?: string[];
	author?: CrossrefAuthor[];
	issued?: { 'date-parts': [number[]] };
	DOI?: string;
	URL?: string;
	abstract?: string;
	type?: string;
	'container-title'?: string[];
	volume?: string;
	issue?: string;
	page?: string;
	publisher?: string;
	ISSN?: string[];
	ISBN?: string[];
}

// ─── Settings ────────────────────────────────────────────────────────────────

interface DoiImporterSettings {
	notesFolder: string;
	fileNameTemplate: string;
	openNoteAfterImport: boolean;
}

const DEFAULT_SETTINGS: DoiImporterSettings = {
	notesFolder: 'References',
	fileNameTemplate: '{{citekey}}',
	openNoteAfterImport: true,
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function stripDoi(raw: string): string {
	return raw.replace(/^(https?:\/\/doi\.org\/|doi:)/i, '');
}

export function isValidDoi(doi: string): boolean {
	return doi.startsWith('10.');
}

export function stripJats(text: string): string {
	return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function formatAuthors(authors: CrossrefAuthor[]): string[] {
	return authors.map(a => {
		if (a.family && a.given) return `${a.family}, ${a.given}`;
		if (a.family) return a.family;
		if (a.name) return a.name;
		return '';
	}).filter(Boolean);
}

export function buildCitekey(msg: CrossrefMessage): string {
	const family = msg.author?.[0]?.family ?? 'Unknown';
	const year = msg.issued?.['date-parts']?.[0]?.[0]?.toString() ?? 'XXXX';
	return `${family}${year}`.toLowerCase();
}

export function resolveFileName(template: string, msg: CrossrefMessage, doi: string): string {
	const citekey = buildCitekey(msg);
	const doiSlug = doi.replace(/[^a-z0-9]/gi, '-');
	const titleRaw = msg.title?.[0] ?? '';
	const titleSlug = titleRaw.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
	return template
		.replace('{{citekey}}', citekey)
		.replace('{{doi-slug}}', doiSlug)
		.replace('{{title}}', titleSlug);
}

export function findNoteByDoi(app: App, doi: string): TFile | null {
	for (const file of app.vault.getMarkdownFiles()) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (fm?.doi === doi) return file;
	}
	return null;
}

export function findAvailableFileName(app: App, folder: string, baseName: string): string {
	if (!app.vault.getFileByPath(`${folder}/${baseName}.md`)) return baseName;
	for (const char of 'bcdefghijklmnopqrstuvwxyz') {
		const candidate = `${baseName}${char}`;
		if (!app.vault.getFileByPath(`${folder}/${candidate}.md`)) return candidate;
	}
	return `${baseName}-${Date.now()}`;
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
	if (!app.vault.getFolderByPath(folderPath)) {
		await app.vault.createFolder(folderPath);
	}
}

export function buildNoteContent(msg: CrossrefMessage, doi: string): string {
	const lines: string[] = ['---'];

	lines.push(`doi: "${doi}"`);

	const title = msg.title?.[0];
	if (title) lines.push(`title: "${title.replace(/"/g, '\\"')}"`);

	const authors = msg.author ? formatAuthors(msg.author) : [];
	if (authors.length > 0) {
		lines.push('authors:');
		authors.forEach(a => lines.push(`  - "${a}"`));
	}

	const year = msg.issued?.['date-parts']?.[0]?.[0];
	if (year) lines.push(`year: ${year}`);

	const journal = msg['container-title']?.[0];
	if (journal) lines.push(`journal: "${journal}"`);

	if (msg.volume) lines.push(`volume: "${msg.volume}"`);
	if (msg.issue) lines.push(`issue: "${msg.issue}"`);
	if (msg.page) lines.push(`pages: "${msg.page}"`);
	if (msg.publisher) lines.push(`publisher: "${msg.publisher}"`);

	const url = msg.URL ?? `https://doi.org/${doi}`;
	lines.push(`url: "${url}"`);

	if (msg.type) lines.push(`type: "${msg.type}"`);

	const aliases: string[] = [doi];
	if (title) aliases.push(title.replace(/"/g, '\\"'));
	lines.push('aliases:');
	aliases.forEach(a => lines.push(`  - "${a}"`));

	lines.push('---');
	lines.push('');

	const heading = title ?? doi;
	lines.push(`# ${heading}`);
	lines.push('');

	if (authors.length > 0) {
		lines.push(`**Authors:** ${authors.join('; ')}`);
		lines.push('');
	}

	if (msg.abstract) {
		const stripped = stripJats(msg.abstract);
		if (stripped) {
			lines.push('**Abstract:**');
			lines.push('');
			lines.push(stripped);
		}
	}

	return lines.join('\n');
}

// ─── Main Plugin Class ────────────────────────────────────────────────────────

export default class DoiImporter extends Plugin {
	settings: DoiImporterSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new DoiImporterSettingTab(this.app, this));

		this.addCommand({
			id: 'import-doi',
			name: 'Import DOI',
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				this.importDoi(editor);
			}
		});
	}

	onunload() {}

	async importDoi(editor: Editor): Promise<void> {
		const raw = editor.getSelection();
		if (!raw) {
			new Notice('No text selected. Please select a DOI.');
			return;
		}

		const doi = stripDoi(raw.trim());
		if (!isValidDoi(doi)) {
			new Notice('Selected text does not appear to be a valid DOI.');
			return;
		}

		new Notice('Fetching DOI metadata...');

		let msg: CrossrefMessage;
		try {
			msg = await this.fetchCrossref(doi);
		} catch (e) {
			if (e instanceof Error && e.message.startsWith('Status ')) {
				new Notice('DOI not found or Crossref unavailable.');
			} else {
				new Notice('Network error: could not reach Crossref.');
			}
			return;
		}

		const content = buildNoteContent(msg, doi);
		const linkText = msg.title?.[0] ?? doi;

		// Check if any existing note already tracks this DOI
		const existingByDoi = findNoteByDoi(this.app, doi);
		if (existingByDoi) {
			new Notice(`Note already exists: ${existingByDoi.path}`);
			editor.replaceSelection(`[[${existingByDoi.basename}|${linkText}]]`);
			if (this.settings.openNoteAfterImport) {
				this.app.workspace.getLeaf(false).openFile(existingByDoi);
			}
			return;
		}

		// Resolve filename, appending b/c/... if a different paper occupies the slot
		const baseName = resolveFileName(this.settings.fileNameTemplate, msg, doi);
		const fileName = findAvailableFileName(this.app, this.settings.notesFolder, baseName);
		const path = `${this.settings.notesFolder}/${fileName}.md`;

		await ensureFolder(this.app, this.settings.notesFolder);
		const file = await this.app.vault.create(path, content);
		new Notice(`Created: ${fileName}`);
		editor.replaceSelection(`[[${fileName}|${linkText}]]`);

		if (this.settings.openNoteAfterImport) {
			this.app.workspace.getLeaf(false).openFile(file);
		}
	}

	private async fetchCrossref(doi: string): Promise<CrossrefMessage> {
		const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
		const response = await requestUrl({ url, method: 'GET' });
		if (response.status !== 200) throw new Error(`Status ${response.status}`);
		return (JSON.parse(response.text) as { message: CrossrefMessage }).message;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class DoiImporterSettingTab extends PluginSettingTab {
	plugin: DoiImporter;

	constructor(app: App, plugin: DoiImporter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Notes folder')
			.setDesc('Folder where reference notes will be created.')
			.addText(text => text
				.setPlaceholder('References')
				.setValue(this.plugin.settings.notesFolder)
				.onChange(async (value) => {
					this.plugin.settings.notesFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('File name template')
			.setDesc('Template for note filenames. Tokens: {{citekey}}, {{doi-slug}}, {{title}}')
			.addText(text => text
				.setPlaceholder('{{citekey}}')
				.setValue(this.plugin.settings.fileNameTemplate)
				.onChange(async (value) => {
					this.plugin.settings.fileNameTemplate = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Open note after import')
			.setDesc('Automatically open the new reference note after creation.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.openNoteAfterImport)
				.onChange(async (value) => {
					this.plugin.settings.openNoteAfterImport = value;
					await this.plugin.saveSettings();
				}));
	}
}
