import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  TableOfContents,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

// Constants for styling
const FONT_FAMILY = "SimSun"; // 宋体
const FONT_SIZE = 24; // 小四 (12pt) -> 24 half-points
const LINE_SPACING = 360; // 1.5 lines (240 * 1.5)
const FIRST_LINE_INDENT = 480; // 2 chars (approx 240 twips per char)

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
    }
  }

  return runs;
}

// Helper to process block nodes
function processBlockNode(node: any): (Paragraph | Table | TableOfContents)[] {
  const elements: (Paragraph | Table | TableOfContents)[] = [];

  switch (node.type) {
    case "heading":
      const level =
        node.depth === 1
          ? HeadingLevel.HEADING_1
          : node.depth === 2
          ? HeadingLevel.HEADING_2
          : node.depth === 3
          ? HeadingLevel.HEADING_3
          : node.depth === 4
          ? HeadingLevel.HEADING_4
          : node.depth === 5
          ? HeadingLevel.HEADING_5
          : HeadingLevel.HEADING_6;

      elements.push(
        new Paragraph({
          children: processInlineNodes(node.children),
          heading: level,
          spacing: {
            before: 240,
            after: 120,
          },
        })
      );
      break;

    case "paragraph":
      elements.push(
        new Paragraph({
          children: processInlineNodes(node.children),
          spacing: {
            line: LINE_SPACING,
            lineRule: "auto",
            before: 120,
            after: 120,
          },
          indent: {
            firstLine: FIRST_LINE_INDENT,
          },
          alignment: AlignmentType.JUSTIFIED,
        })
      );
      break;

    case "list":
      if (node.children) {
        node.children.forEach((listItem: any, index: number) => {
            const isOrdered = node.ordered;
            const bullet = isOrdered ? `${index + 1}.` : "•";
            
            if (listItem.children) {
                listItem.children.forEach((child: any) => {
                    if (child.type === 'paragraph') {
                         elements.push(
                            new Paragraph({
                                children: [
                                    new TextRun({ text: `${bullet}\t`, font: FONT_FAMILY, size: FONT_SIZE }),
                                    ...processInlineNodes(child.children)
                                ],
                                spacing: {
                                    line: LINE_SPACING,
                                    lineRule: "auto",
                                },
                                indent: {
                                    left: 720,
                                    hanging: 360,
                                }
                            })
                        );
                    } else {
                         // Recursively handle other blocks in list items
                         elements.push(...processBlockNode(child));
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
                const childElements = processBlockNode(child);
                childElements.forEach(el => {
                    if (el instanceof Paragraph) {
                        // We can't easily modify the paragraph object after creation without type casting
                        // But we can just add it. 
                        // For a real blockquote effect, we might want to wrap in a table or add indentation.
                        // Let's just add indentation.
                        // Since we can't modify the object easily, we'll just push it as is for now.
                        elements.push(el);
                    } else {
                        elements.push(el);
                    }
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

  // Add Title Page or Header?
  // Requirement: "具备目录" (Include TOC)
  
  // Add TOC Title
  docChildren.push(
    new Paragraph({
      text: "目录",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    })
  );

  // Add TOC
  docChildren.push(
    new TableOfContents("Summary", {
      hyperlink: true,
      headingStyleRange: "1-3",
    })
  );

  // Page Break after TOC
  docChildren.push(
    new Paragraph({
        children: [new TextRun({ text: "" })],
        pageBreakBefore: true,
    })
  );

  // Process AST
  // @ts-ignore
  if (ast.children) {
      // @ts-ignore
      for (const node of ast.children) {
        docChildren.push(...processBlockNode(node));
      }
  }

  const doc = new Document({
    features: {
      updateFields: true,
    },
    styles: {
        paragraphStyles: [
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
                },
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
