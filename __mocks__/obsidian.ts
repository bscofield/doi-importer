// Minimal stub so tests can import main.ts without the Obsidian runtime.
import { vi } from 'vitest';
export class Plugin {}
export class PluginSettingTab {}
export class Notice {}
export class Modal {}
export class TFile {}
export const Setting = class {};
export const requestUrl = vi.fn(async () => ({ status: 200, text: '{}' }));
