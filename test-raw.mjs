import { unified } from "unified";
import remarkParse from "remark-parse";

const md = `1. 菜单路径：**故障**事件管理
   (1) 故障监控
       ■ 故障事件监控`;

const processor = unified().use(remarkParse);
const ast = processor.parse(md);

function processNode(node, markdown) {
  if (node.type === 'text') {
    const rawText = markdown.substring(node.position.start.offset, node.position.end.offset);
    console.log("TEXT VALUE:", JSON.stringify(node.value));
    console.log("RAW TEXT:", JSON.stringify(rawText));
  }
  if (node.children) {
    node.children.forEach(c => processNode(c, markdown));
  }
}

processNode(ast, md);
