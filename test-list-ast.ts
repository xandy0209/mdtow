import { unified } from "unified";
import remarkParse from "remark-parse";

const md = `
1. Item 1
2. Item 2
   * Bullet A
   * Bullet B
`;

const processor = unified().use(remarkParse);
const ast = processor.parse(md);
console.log(JSON.stringify(ast, null, 2));
