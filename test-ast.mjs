import { unified } from "unified";
import remarkParse from "remark-parse";

const md = `1. 菜单路径：故障事件管理
   (1) 故障监控
       ■ 故障事件监控
   (2) 配置管理
       ■ 故障识别规则
       ■ 故障短信发送配置`;

const processor = unified().use(remarkParse);
const ast = processor.parse(md);

function printPositions(node) {
  if (node.type === 'text' || node.type === 'break') {
    console.log(node.type, JSON.stringify(node.value), node.position);
  }
  if (node.children) {
    node.children.forEach(printPositions);
  }
}
printPositions(ast);
