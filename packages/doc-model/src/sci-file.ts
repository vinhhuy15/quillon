/**
 * .qln container (formerly .sci): a ZIP archive with
 *   mimetype        "application/x-quillon" (stored, first entry)
 *   document.json   the SciDocument
 *   preview.svg     optional preview image
 * Plain JSON documents are also accepted on read.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { DocumentFormatError, parseDocument, serializeDocument } from './document';
import type { SciDocument } from './types';

export const SCI_MIME = 'application/x-quillon';
export const SCI_EXTENSION = 'qln';
/** Extensions that open as documents: the current one and SciForge's. */
export const DOCUMENT_EXTENSIONS: readonly string[] = ['qln', 'sci'];

export interface SciExtras {
  previewSvg?: string;
}

export function encodeSci(doc: SciDocument, extras: SciExtras = {}): Uint8Array {
  const files: Zippable = {
    mimetype: [strToU8(SCI_MIME), { level: 0 }],
    'document.json': strToU8(serializeDocument(doc)),
  };
  if (extras.previewSvg) files['preview.svg'] = strToU8(extras.previewSvg);
  return zipSync(files, { level: 6 });
}

export function decodeSci(bytes: Uint8Array): SciDocument {
  // ZIP local file header signature "PK\x03\x04"
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch {
      throw new DocumentFormatError('File is damaged (cannot unzip)');
    }
    const json = entries['document.json'];
    if (!json) throw new DocumentFormatError('document.json missing from the file');
    return parseJson(strFromU8(json));
  }
  return parseJson(strFromU8(bytes));
}

function parseJson(text: string): SciDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DocumentFormatError('File is not a valid Quillon document');
  }
  return parseDocument(raw);
}
