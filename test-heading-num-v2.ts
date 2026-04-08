import { convertMarkdownToDocx } from "./lib/markdown-to-docx";
import fs from "fs";

const md = `
# 绪论
## 背景
### 现状
# 方法
## 方案
`;

async function test() {
    const blob = await convertMarkdownToDocx(md);
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync("test-heading-num-v2.docx", buffer);
    console.log("Done");
}

test();
