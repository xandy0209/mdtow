import { unified } from "unified";
import remarkParse from "remark-parse";

const md = `1. 菜单路径：**故障**事件管理
   (1) 故障监控
       ■ 故障事件监控`;

const processor = unified().use(remarkParse);
const ast = processor.parse(md);

function splitInlineNodes(nodes, markdown) {
  const groups = [];
  let currentGroup = { nodes: [], indent: 0 };
  
  for (const node of nodes) {
    if (node.type === 'text' && node.value.includes('\n')) {
      const rawText = markdown.substring(node.position.start.offset, node.position.end.offset);
      const rawLines = rawText.split('\n');
      const valueLines = node.value.split('\n');
      
      // First line goes to current group
      currentGroup.nodes.push({ ...node, value: valueLines[0] });
      groups.push(currentGroup);
      
      // Subsequent lines create new groups
      for (let i = 1; i < valueLines.length; i++) {
        const rawLine = rawLines[i];
        const match = rawLine.match(/^(\s*)/);
        const spaces = match ? match[1].length : 0;
        
        currentGroup = { nodes: [], indent: spaces };
        if (valueLines[i]) {
          currentGroup.nodes.push({ ...node, value: valueLines[i] });
        }
        if (i < valueLines.length - 1) {
            groups.push(currentGroup);
        }
      }
    } else {
      currentGroup.nodes.push(node);
    }
  }
  groups.push(currentGroup);
  return groups;
}

const paragraphNode = ast.children[0].children[0].children[0];
const groups = splitInlineNodes(paragraphNode.children, md);
console.log(JSON.stringify(groups, null, 2));
