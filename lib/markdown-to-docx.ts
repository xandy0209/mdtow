import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  TableOfContents,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  LevelFormat,
  PageBreak,
} from "docx";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

// Constants for styling
const FONT_FAMILY = "SimSun"; // 宋体
const FONT_SIZE = 24; // 小四 (12pt) -> 24 half-points
const LINE_SPACING = 360; // 1.5 lines (240 * 1.5)
const FIRST_LINE_INDENT = 480; // 2 chars (approx 240 twips per char)

const SIZE_2 = 44; // 二号 (22pt)
const SIZE_4 = 28; // 四号 (14pt)

// Helper to get full text from nodes
function getFullText(nodes: any[]): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "text") return n.value;
      if (n.children) return getFullText(n.children);
      return "";
    })
    .join("");
}

// Helper to strip manual numbering from heading text
function stripManualNumbering(nodes: any[]): any[] {
  if (nodes && nodes.length > 0 && nodes[0].type === 'text') {
    const text = nodes[0].value;
    // Matches: "1. ", "1.1 ", "1.1.1 ", "第1章 ", "第一章 ", "1.1. 背景"
    const strippedText = text.replace(/^(\d+(\.\d+)*)\.?\s+/, '')
                             .replace(/^第[一二三四五六七八九十\d]+[章节]\s+/, '')
                             .trim();
    if (strippedText !== text) {
      return [{ ...nodes[0], value: strippedText }, ...nodes.slice(1)];
    }
  }
  return nodes;
}

// Helper to process inline nodes (text, strong, emphasis, etc.)
function processInlineNodes(nodes: any[], style: any = {}): TextRun[] {
  const runs: TextRun[] = [];

  if (!nodes) return runs;

  for (const node of nodes) {
    if (node.type === "text") {
      runs.push(
        new TextRun({
          text: node.value,
          font: FONT_FAMILY,
          size: FONT_SIZE,
          ...style,
        })
      );
    } else if (node.type === "strong") {
      const innerRuns = processInlineNodes(node.children, { ...style, bold: true });
      runs.push(...innerRuns);
    } else if (node.type === "emphasis") {
      const innerRuns = processInlineNodes(node.children, { ...style, italics: true });
      runs.push(...innerRuns);
    } else if (node.type === "inlineCode") {
      runs.push(
        new TextRun({
          text: node.value,
          font: "Courier New",
          size: FONT_SIZE,
          highlight: "yellow",
          ...style,
        })
      );
    } else if (node.type === "link") {
      const innerRuns = processInlineNodes(node.children, {
        ...style,
        color: "0563C1",
        underline: { type: "single", color: "0563C1" },
      });
      runs.push(...innerRuns);
    } else if (node.type === 'image') {
       runs.push(
        new TextRun({
          text: `[Image: ${node.alt || 'No Alt Text'}]`,
          font: FONT_FAMILY,
          size: FONT_SIZE,
          color: "888888",
          italics: true,
          ...style,
        })
      );
    } else if (node.type === 'html') {
      if (/<br\s*\/?>/i.test(node.value)) {
        runs.push(new TextRun({ break: 1 }));
      } else {
        const text = node.value.replace(/&nbsp;/gi, '\u00A0').replace(/<[^>]+>/g, '');
        if (text) {
            runs.push(new TextRun({ text, font: FONT_FAMILY, size: FONT_SIZE, ...style }));
        }
      }
    }
  }

  return runs;
}

function splitParagraph(paragraphNode: any, markdown: string) {
  const groups: { nodes: any[], indent: number }[] = [];
  let currentGroup = { nodes: [] as any[], indent: 0 };
  
  function getLastText(nodes: any[]): string {
    if (nodes.length === 0) return '';
    const lastNode = nodes[nodes.length - 1];
    if (lastNode.type === 'text') return lastNode.value || '';
    if (lastNode.children) return getLastText(lastNode.children);
    return lastNode.value || '';
  }

  function traverse(nodes: any[]) {
    for (const node of nodes) {
      if (node.type === 'text' && node.value.includes('\n')) {
        const rawText = markdown.substring(node.position.start.offset, node.position.end.offset);
        const rawLines = rawText.split('\n');
        const valueLines = node.value.split('\n');
        
        for (let i = 0; i < valueLines.length; i++) {
          const line = valueLines[i];
          const rawLine = rawLines[i] || '';
          const match = rawLine.match(/^(\s*)/);
          const spaces = match ? match[1].length : 0;

          const lastText = getLastText(currentGroup.nodes);
          const shouldJoin = /[:：]\s*$/.test(lastText);

          if (shouldJoin && (i > 0 || currentGroup.nodes.length > 0)) {
            currentGroup.nodes.push({ ...node, value: line.trimStart() });
          } else {
            if (i > 0 || currentGroup.nodes.length > 0) {
              // Only push if the current group has non-empty content
              const hasContent = currentGroup.nodes.some(n => 
                (n.type === 'text' && n.value && n.value.trim().length > 0) || 
                (n.type !== 'text')
              );
              if (hasContent) {
                groups.push(currentGroup);
              }
              currentGroup = { nodes: [], indent: spaces };
            }
            // Only add the line if it's not empty, or if we are joining
            if (line.trim().length > 0) {
              currentGroup.nodes.push({ ...node, value: line.trimStart() });
            }
          }
        }
      } else if (node.type === 'html' && /<br\s*\/?>/i.test(node.value)) {
        groups.push(currentGroup);
        currentGroup = { nodes: [], indent: 0 };
      } else if (node.children) {
        currentGroup.nodes.push(node);
      } else {
        if (currentGroup.nodes.length === 0 && node.type === 'text') {
          currentGroup.nodes.push({ ...node, value: node.value.trimStart() });
        } else {
          currentGroup.nodes.push(node);
        }
      }
    }
  }
  
  if (paragraphNode.children) {
      traverse(paragraphNode.children);
  }
  
  const hasContent = currentGroup.nodes.some(n => 
    (n.type === 'text' && n.value && n.value.trim().length > 0) || 
    (n.type !== 'text')
  );
  if (hasContent) {
    groups.push(currentGroup);
  }
  
  return groups;
}

interface ConversionContext {
  markdown: string;
  numberingConfigs: any[];
  listCounter: number;
  lastPseudoListRef?: string;
  lastPseudoListType?: 'ordered' | 'bullet';
}

// Helper to process block nodes
function processBlockNode(node: any, level: number = 0, ctx: ConversionContext, currentListRef?: string, currentListType?: boolean, forceCenter: boolean = false): (Paragraph | Table | TableOfContents)[] {
  const elements: (Paragraph | Table | TableOfContents)[] = [];
  const markdown = ctx.markdown;

  switch (node.type) {
    case "heading":
      const depth = node.depth;
      const headingChildren = stripManualNumbering(node.children);

      let headingStyle: any = {};
      let headingSpacing: any = { before: 240, after: 120 };
      if (forceCenter) {
          const text = getFullText(node.children);
          const isVersionOrDate = (text: string) => {
              return text.includes("版本") || 
                     text.includes("日期") || 
                     /\d{4}年\d{1,2}月\d{1,2}日/.test(text) ||
                     /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text);
          };

          if (isVersionOrDate(text)) {
              headingStyle = { size: SIZE_4, bold: false };
          } else {
              headingStyle = { size: SIZE_2, bold: true };
              if (text.includes("需求文档") || text.includes("PRD")) {
                  headingSpacing.after = 4800; // Large gap to push version/date to bottom
              }
          }
      }

      elements.push(
        new Paragraph({
          children: processInlineNodes(headingChildren, headingStyle),
          style: forceCenter ? undefined : `Heading${depth}`,
          alignment: forceCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: headingSpacing,
        })
      );
      break;

    case "paragraph":
      const topGroups = splitParagraph(node, markdown);
      topGroups.forEach(group => {
          if (group.nodes.length > 0 && group.nodes[0].type === 'text') {
              const text = group.nodes[0].value;
              
              // Support for 7-9 levels of headings (since remark-parse only supports up to 6)
              const headingMatch = text.match(/^(#{7,9})\s+(.*)/);
              if (headingMatch) {
                  const depth = headingMatch[1].length;
                  const content = headingMatch[2];
                  const pseudoHeadingChildren = stripManualNumbering([{ ...group.nodes[0], value: content }, ...group.nodes.slice(1)]);
                  
                  let pseudoHeadingStyle: any = {};
                  let pseudoHeadingSpacing: any = { before: 240, after: 120 };
                  if (forceCenter) {
                      const fullText = getFullText(pseudoHeadingChildren);
                      const isVersionOrDate = (text: string) => {
                          return text.includes("版本") || 
                                 text.includes("日期") || 
                                 /\d{4}年\d{1,2}月\d{1,2}日/.test(text) ||
                                 /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text);
                      };

                      if (isVersionOrDate(fullText)) {
                          pseudoHeadingStyle = { size: SIZE_4, bold: false };
                      } else {
                          pseudoHeadingStyle = { size: SIZE_2, bold: true };
                          if (fullText.includes("需求文档") || fullText.includes("PRD")) {
                              pseudoHeadingSpacing.after = 4800;
                          }
                      }
                  }

                  elements.push(
                    new Paragraph({
                      children: processInlineNodes(pseudoHeadingChildren, pseudoHeadingStyle),
                      style: forceCenter ? undefined : `Heading${depth}`,
                      alignment: forceCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
                      spacing: pseudoHeadingSpacing,
                    })
                  );
                  // Reset pseudo list state on heading
                  ctx.lastPseudoListRef = undefined;
                  ctx.lastPseudoListType = undefined;
                  return;
              }

              // Pseudo-list detection for (1), (2) etc.
              const orderedMatch = text.match(/^\s*\((\d+)\)\s+(.*)/);
              if (orderedMatch) {
                  const content = orderedMatch[2];
                  const pseudoNodes = [{ ...group.nodes[0], value: content }, ...group.nodes.slice(1)];
                  
                  // Use level 1 for (1) as it usually implies a sub-level
                  const targetLevel = level > 0 ? level : 1;
                  
                  let ref = currentListRef;
                  if (!ref) {
                      // If not inside a real list, check if we can continue a previous pseudo-list
                      if (ctx.lastPseudoListType === 'ordered' && ctx.lastPseudoListRef) {
                          ref = ctx.lastPseudoListRef;
                      } else {
                          ctx.listCounter++;
                          ref = `ordered-list-${ctx.listCounter}`;
                          ctx.lastPseudoListRef = ref;
                          ctx.lastPseudoListType = 'ordered';
                              ctx.numberingConfigs.push({
                              reference: ref,
                              levels: Array.from({ length: 9 }, (_, i) => ({
                                  level: i,
                                  format: LevelFormat.DECIMAL,
                                  text: i === 0 ? `%1.` : i === 1 ? `(%2)` : `%${i + 1}.`,
                                  alignment: AlignmentType.START,
                                  pStyle: "ListParagraph",
                                  style: {
                                      paragraph: {
                                          indent: { left: (level + i + 1) * 480, hanging: 480 },
                                      },
                                  },
                              })),
                          });
                      }
                  }

                  elements.push(new Paragraph({
                      children: processInlineNodes(pseudoNodes),
                      style: "ListParagraph",
                      numbering: {
                          reference: ref!,
                          level: targetLevel,
                      },
                      spacing: { line: LINE_SPACING, lineRule: "auto", before: 120, after: 120 },
                      alignment: AlignmentType.LEFT,
                  }));
                  return;
              }

              // Pseudo-list detection for ■, ●, etc.
              const bulletMatch = text.match(/^\s*[■■●○▪]\s+(.*)/);
              if (bulletMatch) {
                  const content = bulletMatch[1];
                  const pseudoNodes = [{ ...group.nodes[0], value: content }, ...group.nodes.slice(1)];
                  
                  // Use level 2 for bullets if they follow (1)
                  const targetLevel = level > 0 ? level + 1 : 2;
                  
                  let ref = currentListRef;
                  if (!ref) {
                      if (ctx.lastPseudoListType === 'bullet' && ctx.lastPseudoListRef) {
                          ref = ctx.lastPseudoListRef;
                      } else {
                          ctx.listCounter++;
                          ref = `bullet-list-${ctx.listCounter}`;
                          ctx.lastPseudoListRef = ref;
                          ctx.lastPseudoListType = 'bullet';
                          ctx.numberingConfigs.push({
                              reference: ref,
                              levels: Array.from({ length: 9 }, (_, i) => ({
                                  level: i,
                                  format: LevelFormat.BULLET,
                                  text: i === 0 ? "•" : i === 1 ? "○" : "■",
                                  alignment: AlignmentType.START,
                                  pStyle: "ListParagraph",
                                  style: {
                                      paragraph: {
                                          indent: { left: (level + i + 1) * 480, hanging: 480 },
                                      },
                                  },
                              })),
                          });
                      }
                  }

                  elements.push(new Paragraph({
                      children: processInlineNodes(pseudoNodes),
                      style: "ListParagraph",
                      numbering: {
                          reference: ref!,
                          level: targetLevel,
                      },
                      spacing: { line: LINE_SPACING, lineRule: "auto", before: 120, after: 120 },
                      alignment: AlignmentType.LEFT,
                  }));
                  return;
              }
          }

          // If it's a normal paragraph, reset pseudo list continuity
          ctx.lastPseudoListRef = undefined;
          ctx.lastPseudoListType = undefined;

          let paraStyle: any = {};
          let paraSpacing: any = {
            line: LINE_SPACING,
            lineRule: "auto",
            before: 120,
            after: 120,
          };

          if (forceCenter) {
              const fullText = getFullText(group.nodes);
              const isVersionOrDate = (text: string) => {
                  return text.includes("版本") || 
                         text.includes("日期") || 
                         /\d{4}年\d{1,2}月\d{1,2}日/.test(text) ||
                         /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text);
              };

              if (isVersionOrDate(fullText)) {
                  paraStyle = { size: SIZE_4, bold: false };
              } else {
                  paraStyle = { size: SIZE_2, bold: true };
                  if (fullText.includes("需求文档") || fullText.includes("PRD")) {
                      paraSpacing.after = 4800;
                  }
              }
          }

          elements.push(
            new Paragraph({
              children: processInlineNodes(group.nodes, paraStyle),
              spacing: paraSpacing,
              indent: forceCenter ? undefined : {
                left: 0,
                firstLine: FIRST_LINE_INDENT,
              },
              alignment: forceCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
            })
          );
      });
      break;

    case "list":
      if (node.children) {
        let listRef = currentListRef;
        const isOrdered = node.ordered;
        let effectiveLevel = level;

        // If not already in a list, or if the list type changed (ordered vs bullet), create a new numbering instance
        if (!listRef || isOrdered !== currentListType) {
            ctx.listCounter++;
            listRef = `${isOrdered ? 'ordered' : 'bullet'}-list-${ctx.listCounter}`;
            // If we are switching types in a nested list, we start at level 0 of the new config,
            // but we need to offset the indentation to match the current nesting level.
            const indentOffset = listRef === currentListRef ? 0 : level;
            
            ctx.numberingConfigs.push({
                reference: listRef,
                levels: Array.from({ length: 9 }, (_, i) => ({
                    level: i,
                    format: isOrdered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
                    // Level 0: 1.  Level 1: (1)  Level 2: ① ...
                    text: isOrdered 
                        ? (i === 0 ? `%1.` : i === 1 ? `(%2)` : `%${i + 1}.`) 
                        : (i % 3 === 0 ? "•" : i % 3 === 1 ? "○" : "■"),
                    alignment: AlignmentType.START,
                    pStyle: "ListParagraph",
                    style: {
                        paragraph: {
                            // Use hanging indent for native look
                            indent: { left: (indentOffset + i + 1) * 480, hanging: 480 },
                        },
                    },
                    ...(i === 0 && isOrdered && node.start ? { start: node.start } : {}),
                })),
            });
            
            // If we started a new config for a nested list, the paragraph level should be 0
            if (currentListRef && isOrdered !== currentListType) {
                effectiveLevel = 0;
            }
        }

        node.children.forEach((listItem: any, index: number) => {
            if (listItem.children) {
                let isFirstLineOfListItem = true;
                const totalChildren = listItem.children.length;
                
                listItem.children.forEach((child: any, childIndex: number) => {
                    if (child.type === 'paragraph') {
                         const groups = splitParagraph(child, markdown);
                         const totalGroups = groups.length;
                         
                         groups.forEach((group, groupIndex) => {
                             const isFirst = isFirstLineOfListItem;
                             const isLast = (childIndex === totalChildren - 1) && (groupIndex === totalGroups - 1);
                             
                             elements.push(
                                new Paragraph({
                                    children: processInlineNodes(group.nodes),
                                    style: "ListParagraph",
                                    spacing: {
                                        line: LINE_SPACING,
                                        lineRule: "auto",
                                        before: isFirst ? 120 : 0,
                                        after: isLast ? 120 : 0,
                                    },
                                    // Remove paragraph indent for list items to use numbering indent
                                    alignment: forceCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
                                    ...(isFirstLineOfListItem ? {
                                        numbering: {
                                            reference: listRef!,
                                            level: effectiveLevel,
                                        }
                                    } : {
                                        // Subsequent paragraphs in the same list item should align with the first line's text
                                        indent: forceCenter ? undefined : { left: (effectiveLevel + 1) * 480 }
                                    })
                                })
                             );
                             isFirstLineOfListItem = false;
                         });
                    } else {
                         // Recursively handle other blocks in list items (like nested lists)
                         // For nested lists, we pass the same listRef but increment level
                         elements.push(...processBlockNode(child, effectiveLevel + 1, ctx, listRef, isOrdered, forceCenter));
                         isFirstLineOfListItem = false;
                    }
                });
            }
        });
      }
      break;

    case "code":
      const codeLines = node.value ? node.value.split('\n') : [];
      codeLines.forEach((line: string) => {
          elements.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: line,
                        font: "Courier New",
                        size: 20, // 10pt
                    })
                ],
                spacing: {
                    line: 240, // Single spacing for code
                },
                shading: {
                    fill: "F0F0F0",
                    type: "clear",
                    color: "auto",
                },
                border: {
                    left: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 4 },
                }
            })
          );
      });
      break;
      
    case "blockquote":
        if (node.children) {
            node.children.forEach((child: any) => {
                const childElements = processBlockNode(child, level + 1, ctx, undefined, undefined, forceCenter);
                childElements.forEach(el => {
                    elements.push(el);
                });
            });
        }
        break;

    case "table":
        if (node.children) {
            const rows = node.children.map((row: any) => {
                const cells = row.children.map((cell: any) => {
                    return new TableCell({
                        children: [new Paragraph({ children: processInlineNodes(cell.children) })],
                        width: {
                            size: 100 / row.children.length,
                            type: WidthType.PERCENTAGE,
                        },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        }
                    });
                });
                return new TableRow({ children: cells });
            });
            
            elements.push(new Table({
                rows: rows,
                width: {
                    size: 100,
                    type: WidthType.PERCENTAGE,
                }
            }));
        }
        break;

    default:
      break;
  }

  return elements;
}

export async function convertMarkdownToDocx(markdown: string): Promise<Blob> {
  const processor = unified().use(remarkParse).use(remarkGfm);
  const ast = processor.parse(markdown);

  const docChildren: (Paragraph | Table | TableOfContents)[] = [];

  const ctx: ConversionContext = {
    markdown,
    listCounter: 0,
    lastPseudoListRef: undefined,
    lastPseudoListType: undefined,
    numberingConfigs: [
        {
            reference: "heading-numbering",
            levels: [
                {
                    level: 0,
                    format: LevelFormat.DECIMAL,
                    text: "%1",
                    alignment: AlignmentType.START,
                    pStyle: "Heading1",
                    style: {
                        paragraph: {
                            indent: { left: 0, hanging: 0 },
                            alignment: AlignmentType.LEFT,
                        },
                    },
                },
                {
                    level: 1,
                    format: LevelFormat.DECIMAL,
                    text: "%1.%2",
                    alignment: AlignmentType.START,
                    pStyle: "Heading2",
                    style: {
                        paragraph: {
                            indent: { left: 0, hanging: 0 },
                            alignment: AlignmentType.LEFT,
                        },
                    },
                },
                {
                    level: 2,
                    format: LevelFormat.DECIMAL,
                    text: "%1.%2.%3",
                    alignment: AlignmentType.START,
                    pStyle: "Heading3",
                    style: {
                        paragraph: {
                            indent: { left: 0, hanging: 0 },
                            alignment: AlignmentType.LEFT,
                        },
                    },
                },
                {
                    level: 3,
                    format: LevelFormat.DECIMAL,
                    text: "%1.%2.%3.%4",
                    alignment: AlignmentType.START,
                    pStyle: "Heading4",
                    style: {
                        paragraph: {
                            indent: { left: 0, hanging: 0 },
                            alignment: AlignmentType.LEFT,
                        },
                    },
                },
                {
                    level: 4,
                    format: LevelFormat.DECIMAL,
                    text: "%1.%2.%3.%4.%5",
                    alignment: AlignmentType.START,
                    pStyle: "Heading5",
                    style: {
                        paragraph: {
                            indent: { left: 0, hanging: 0 },
                            alignment: AlignmentType.LEFT,
                        },
                    },
                },
                {
                    level: 5,
                    format: LevelFormat.DECIMAL,
                    text: "%1.%2.%3.%4.%5.%6",
                    alignment: AlignmentType.START,
                    pStyle: "Heading6",
                    style: {
                        paragraph: {
                            indent: { left: 0, hanging: 0 },
                            alignment: AlignmentType.LEFT,
                        },
                    },
                },
                {
                    level: 6,
                    format: LevelFormat.DECIMAL,
                    text: "%1.%2.%3.%4.%5.%6.%7",
                    alignment: AlignmentType.START,
                    pStyle: "Heading7",
                    style: {
                        paragraph: {
                            indent: { left: 0, hanging: 0 },
                            alignment: AlignmentType.LEFT,
                        },
                    },
                },
                {
                    level: 7,
                    format: LevelFormat.DECIMAL,
                    text: "%1.%2.%3.%4.%5.%6.%7.%8",
                    alignment: AlignmentType.START,
                    pStyle: "Heading8",
                    style: {
                        paragraph: {
                            indent: { left: 0, hanging: 0 },
                            alignment: AlignmentType.LEFT,
                        },
                    },
                },
                {
                    level: 8,
                    format: LevelFormat.DECIMAL,
                    text: "%1.%2.%3.%4.%5.%6.%7.%8.%9",
                    alignment: AlignmentType.START,
                    pStyle: "Heading9",
                    style: {
                        paragraph: {
                            indent: { left: 0, hanging: 0 },
                            alignment: AlignmentType.LEFT,
                        },
                    },
                },
            ],
        },
    ]
  };

  // Identify cover nodes
  let coverNodes: any[] = [];
  let contentNodes: any[] = [];
  let foundContentStart = false;

  // @ts-ignore
  if (ast.children) {
    // @ts-ignore
    for (const node of ast.children) {
      if (!foundContentStart) {
        // If we hit a Heading 2, or a second Heading 1, start content
        if (node.type === 'heading') {
           const text = getFullText(node.children);
           const isCoverTitle = text.includes("需求文档") || text.includes("PRD");
           
           if (!isCoverTitle || coverNodes.some(n => n.type === 'heading' && n.depth === 1)) {
             foundContentStart = true;
             contentNodes.push(node);
             continue;
           }
        }
        coverNodes.push(node);
      } else {
        contentNodes.push(node);
      }
    }
  }

  // If no cover nodes found (e.g. empty doc), just use all as content
  if (coverNodes.length === 0 && contentNodes.length > 0) {
    coverNodes = [contentNodes[0]];
    contentNodes = contentNodes.slice(1);
  }

  // 1. Process Cover
  // Add 8 empty lines before cover content
  for (let i = 0; i < 8; i++) {
    docChildren.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 240 } }));
  }

  for (const node of coverNodes) {
    docChildren.push(...processBlockNode(node, 0, ctx, undefined, undefined, true));
  }
  
  // Page Break after Cover
  docChildren.push(
    new Paragraph({
        children: [new PageBreak()],
    })
  );

  // 2. Add TOC Title (Not a heading style to avoid being in TOC)
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "目录",
          bold: true,
          size: 32, // 16pt
          font: FONT_FAMILY,
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: {
        before: 480,
        after: 240,
      },
    })
  );

  // 3. Add TOC
  docChildren.push(
    new TableOfContents("", {
      hyperlink: true,
      styles: [
        { styleId: "Heading1", level: 1 },
        { styleId: "Heading2", level: 2 },
        { styleId: "Heading3", level: 3 },
        { styleId: "Heading4", level: 4 },
        { styleId: "Heading5", level: 5 },
        { styleId: "Heading6", level: 6 },
        { styleId: "Heading7", level: 7 },
        { styleId: "Heading8", level: 8 },
        { styleId: "Heading9", level: 9 },
      ],
    })
  );

  // 4. Page Break after TOC
  docChildren.push(
    new Paragraph({
        children: [new PageBreak()],
    })
  );

  // 5. Process Content
  for (const node of contentNodes) {
    docChildren.push(...processBlockNode(node, 0, ctx));
  }

  const doc = new Document({
    features: {
      updateFields: true,
    },
    numbering: {
        config: ctx.numberingConfigs,
    },
    styles: {
        paragraphStyles: [
            {
                id: "ListParagraph",
                name: "List Paragraph",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                paragraph: {
                    spacing: {
                        before: 120,
                        after: 120,
                    },
                },
            },
            {
                id: "Heading1",
                name: "Heading 1",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    font: FONT_FAMILY,
                    size: 32, // 16pt
                    bold: true,
                    color: "000000",
                },
                paragraph: {
                    spacing: {
                        before: 240,
                        after: 120,
                    },
                    outlineLevel: 0,
                    alignment: AlignmentType.LEFT,
                    numbering: {
                        reference: "heading-numbering",
                        level: 0,
                    },
                },
            },
             {
                id: "Heading2",
                name: "Heading 2",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    font: FONT_FAMILY,
                    size: 28, // 14pt
                    bold: true,
                    color: "000000",
                },
                paragraph: {
                    spacing: {
                        before: 240,
                        after: 120,
                    },
                    outlineLevel: 1,
                    alignment: AlignmentType.LEFT,
                    numbering: {
                        reference: "heading-numbering",
                        level: 1,
                    },
                },
            },
            {
                id: "Heading3",
                name: "Heading 3",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    font: FONT_FAMILY,
                    size: 24, // 12pt
                    bold: true,
                    color: "000000",
                },
                paragraph: {
                    spacing: {
                        before: 240,
                        after: 120,
                    },
                    outlineLevel: 2,
                    alignment: AlignmentType.LEFT,
                    numbering: {
                        reference: "heading-numbering",
                        level: 2,
                    },
                },
            },
            {
                id: "Heading4",
                name: "Heading 4",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    font: FONT_FAMILY,
                    size: 24,
                    bold: true,
                    color: "000000",
                },
                paragraph: {
                    spacing: {
                        before: 240,
                        after: 120,
                    },
                    outlineLevel: 3,
                    alignment: AlignmentType.LEFT,
                    numbering: {
                        reference: "heading-numbering",
                        level: 3,
                    },
                },
            },
            {
                id: "Heading5",
                name: "Heading 5",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    font: FONT_FAMILY,
                    size: 24,
                    bold: true,
                    color: "000000",
                },
                paragraph: {
                    spacing: {
                        before: 240,
                        after: 120,
                    },
                    outlineLevel: 4,
                    alignment: AlignmentType.LEFT,
                    numbering: {
                        reference: "heading-numbering",
                        level: 4,
                    },
                },
            },
            {
                id: "Heading6",
                name: "Heading 6",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    font: FONT_FAMILY,
                    size: 24,
                    bold: true,
                    color: "000000",
                },
                paragraph: {
                    spacing: {
                        before: 240,
                        after: 120,
                    },
                    outlineLevel: 5,
                    alignment: AlignmentType.LEFT,
                    numbering: {
                        reference: "heading-numbering",
                        level: 5,
                    },
                },
            },
            {
                id: "Heading7",
                name: "Heading 7",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    font: FONT_FAMILY,
                    size: 24,
                    bold: true,
                    color: "000000",
                },
                paragraph: {
                    spacing: {
                        before: 240,
                        after: 120,
                    },
                    outlineLevel: 6,
                    alignment: AlignmentType.LEFT,
                    numbering: {
                        reference: "heading-numbering",
                        level: 6,
                    },
                },
            },
            {
                id: "Heading8",
                name: "Heading 8",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    font: FONT_FAMILY,
                    size: 24,
                    bold: true,
                    color: "000000",
                },
                paragraph: {
                    spacing: {
                        before: 240,
                        after: 120,
                    },
                    outlineLevel: 7,
                    alignment: AlignmentType.LEFT,
                    numbering: {
                        reference: "heading-numbering",
                        level: 7,
                    },
                },
            },
            {
                id: "Heading9",
                name: "Heading 9",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    font: FONT_FAMILY,
                    size: 24,
                    bold: true,
                    color: "000000",
                },
                paragraph: {
                    spacing: {
                        before: 240,
                        after: 120,
                    },
                    outlineLevel: 8,
                    alignment: AlignmentType.LEFT,
                    numbering: {
                        reference: "heading-numbering",
                        level: 8,
                    },
                },
            },
            {
                id: "TOC1",
                name: "toc 1",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: FONT_FAMILY, size: 24 },
                paragraph: { spacing: { before: 120, after: 120 } },
            },
            {
                id: "TOC2",
                name: "toc 2",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: FONT_FAMILY, size: 24 },
                paragraph: { 
                    spacing: { before: 60, after: 60 },
                    indent: { left: 240 },
                },
            },
            {
                id: "TOC3",
                name: "toc 3",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: FONT_FAMILY, size: 24 },
                paragraph: { 
                    spacing: { before: 40, after: 40 },
                    indent: { left: 480 },
                },
            },
            {
                id: "TOC4",
                name: "toc 4",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: FONT_FAMILY, size: 24 },
                paragraph: { indent: { left: 720 } },
            },
            {
                id: "TOC5",
                name: "toc 5",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: FONT_FAMILY, size: 24 },
                paragraph: { indent: { left: 960 } },
            },
            {
                id: "TOC6",
                name: "toc 6",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: FONT_FAMILY, size: 24 },
                paragraph: { indent: { left: 1200 } },
            },
            {
                id: "TOC7",
                name: "toc 7",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: FONT_FAMILY, size: 24 },
                paragraph: { indent: { left: 1440 } },
            },
            {
                id: "TOC8",
                name: "toc 8",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: FONT_FAMILY, size: 24 },
                paragraph: { indent: { left: 1680 } },
            },
            {
                id: "TOC9",
                name: "toc 9",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { font: FONT_FAMILY, size: 24 },
                paragraph: { indent: { left: 1920 } },
            },
        ],
    },
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
