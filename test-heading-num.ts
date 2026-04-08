import { convertMarkdownToDocx } from "./lib/markdown-to-docx";
import fs from "fs";

const md = `
# 1. 第一章 绪论
## 1.1 背景
### 1.1.1 现状
# 2. 第二章 方法
## 2.1 方案
`;

async function test() {
    const blob = await convertMarkdownToDocx(md);
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync("test-heading-num.docx", buffer);
    console.log("Done");
}

test();
