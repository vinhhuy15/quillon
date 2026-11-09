export * from './mathjax';
export * from './latex';
export * from './omml';
export * from './docx';
export * from './png-meta';
export * from './scene';
export { parseXml, escapeXml, XmlParseError, type XmlElement, type XmlNode } from './xml';

import type { MathNode } from '@sciforge/doc-model';
import { latexToMathML } from './mathjax';
import { mathmlToOmml } from './omml';

/** LaTeX → OMML in one step. */
export function latexToOmml(latex: string, display = true, opts: { namespace?: boolean } = {}): string {
  return mathmlToOmml(latexToMathML(latex, display), { para: display, namespace: opts.namespace });
}

export function mathNodeToOmml(n: Pick<MathNode, 'latex' | 'display'>): string {
  return latexToOmml(n.latex, n.display);
}
