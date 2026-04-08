import { unified } from "unified";
import remarkParse from "remark-parse";

const md = `1. 菜单路径：**故障**事件管理
   (1) 故障监控
       ■ 故障事件监控`;

const processor = unified().use(remarkParse);
const ast = processor.parse(md);

function splitParagraph(paragraphNode, markdown) {
  const groups = [];
  let currentGroup = { nodes: [], indent: 0 };
  
  function traverse(nodes) {
    for (const node of nodes) {
      if (node.type === 'text' && node.value.includes('\n')) {
        const rawText = markdown.substring(node.position.start.offset, node.position.end.offset);
        const rawLines = rawText.split('\n');
        const valueLines = node.value.split('\n');
        
        currentGroup.nodes.push({ ...node, value: valueLines[0] });
        groups.push(currentGroup);
        
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
      } else if (node.children) {
        // For nodes like strong, emphasis, we should ideally split them too,
        // but for simplicity, let's assume they don't contain \n.
        // If they do, this simple approach might break.
        // Let's just add them to the current group.
        currentGroup.nodes.push(node);
      } else {
        currentGroup.nodes.push(node);
      }
    }
  }
  
  traverse(paragraphNode.children);
  groups.push(currentGroup);
  
  // Filter out empty groups
  return groups.filter(g => g.nodes.length > 0);
}

const paragraphNode = ast.children[0].children[0].children[0];
const groups = splitParagraph(paragraphNode, md);
console.log(JSON.stringify(groups, null, 2));
