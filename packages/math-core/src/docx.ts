/**
 * Minimal .docx writer: paragraphs of text and native Word equations (OMML).
 */
import { strToU8, zipSync } from 'fflate';
import { OMML_NS } from './omml';
import { escapeXml } from './xml';

export type DocxBlock =
  | { kind: 'math'; omml: string; number?: number }
  | { kind: 'text'; text: string; bold?: boolean; italic?: boolean; fontSizePt?: number; color?: string };

const OMML_HTML_NS = 'http://schemas.microsoft.com/office/2004/12/omml';
const W_NS ='http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** Strip an outer <m:oMathPara> so the equation can sit inline with a number tab. */
function innerOMath(omml: string): string {
  const m = /<m:oMath(?:\s[^>]*)?>[\s\S]*<\/m:oMath>/.exec(omml);
  return m ? m[0].replace(/^<m:oMath\s[^>]*>/, '<m:oMath>') : omml;
}

function paragraph(b: DocxBlock): string {
  if (b.kind === 'math') {
    if (b.number === undefined) {
      const para = /<m:oMathPara/.test(b.omml) ? b.omml : `<m:oMathPara>${innerOMath(b.omml)}</m:oMathPara>`;
      return `<w:p>${para.replace(/^<m:oMathPara\s[^>]*>/, '<m:oMathPara>')}</w:p>`;
    }
    // Numbered: centered equation + right-aligned "(n)" using tab stops.
    return (
      `<w:p><w:pPr><w:tabs><w:tab w:val="center" w:pos="4680"/><w:tab w:val="right" w:pos="9360"/></w:tabs></w:pPr>` +
      `<w:r><w:tab/></w:r>${innerOMath(b.omml)}<w:r><w:tab/><w:t>(${b.number})</w:t></w:r></w:p>`
    );
  }
  const rPr: string[] = [];
  if (b.bold) rPr.push('<w:b/>');
  if (b.italic) rPr.push('<w:i/>');
  if (b.color) rPr.push(`<w:color w:val="${escapeXml(b.color.replace('#', ''))}"/>`);
  if (b.fontSizePt) rPr.push(`<w:sz w:val="${Math.round(b.fontSizePt * 2)}"/>`);
  const props = rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : '';
  const runs = b.text
    .split('\n')
    .map((line, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r>${props}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`)
    .join('');
  return `<w:p>${runs}</w:p>`;
}

export function buildDocx(blocks: DocxBlock[], title = 'SciForge export'): Uint8Array {
  const body = blocks.map(paragraph).join('');
  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W_NS}" xmlns:m="${OMML_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `</Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `</Relationships>`;
  const core =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<dc:title>${escapeXml(title)}</dc:title><dc:creator>SciForge</dc:creator></cp:coreProperties>`;
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    'docProps/core.xml': strToU8(core),
    'word/document.xml': strToU8(document),
  });
}

/**
 * HTML clipboard payload that Word recognises as a native equation
 * (the same conditional-comment form Word itself writes), with a MathML fallback
 * for other HTML editors.
 */
export function wordClipboardHtml(omml: string, mathml: string): string {
  return (
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" ` +
    // Word's HTML dialect uses the pre-standard OMML namespace, not the .docx one.
    `xmlns:m="${OMML_HTML_NS}" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">` +
    `<meta name="ProgId" content="Word.Document"></head><body>` +
    `<!--StartFragment--><p class="MsoNormal"><!--[if gte msEquation 12]>${ommlToWordHtml(omml)}<![endif]-->` +
    `<![if !msEquation]>${mathml}<![endif]></p><!--EndFragment--></body></html>`
  );
}

/**
 * Word's HTML dialect of OMML differs from the .docx one: run text sits directly
 * inside <m:r> (no <m:t>), wrapped in a Cambria Math span, and the m: namespace is
 * declared on <html>.
 */
export function ommlToWordHtml(omml: string): string {
  return omml
    .replace(/ xmlns:m="[^"]*"/g, '')
    .replace(
      /<m:r>(<m:rPr>[\s\S]*?<\/m:rPr>)?<m:t(?: xml:space="preserve")?>([\s\S]*?)<\/m:t><\/m:r>/g,
      (_m, rPr: string | undefined, text: string) =>
        `<span style='font-family:"Cambria Math"'><m:r>${rPr ?? ''}${text}</m:r></span>`,
    );
}
