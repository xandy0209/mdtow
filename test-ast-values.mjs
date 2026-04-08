import { unified } from "unified";
import remarkParse from "remark-parse";

const md = `1. 菜单路径：故障事件管理
   (1) 故障监控
       ■ 故障事件监控`;

const processor = unified().use(remarkParse);
const ast = processor.parse(md);

const textNode = ast.children[0].children[0].children[0].children[0];
console.log("node.value:");
console.log(JSON.stringify(textNode.value));

const rawText = md.substring(textNode.position.start.offset, textNode.position.end.offset);
console.log("rawText:");
console.log(JSON.stringify(rawText));
