import { convertMarkdownToDocx } from "./lib/markdown-to-docx";
import fs from "fs";

const md = `1. 菜单路径：故障事件管理
   (1) 故障监控
       ■ 故障事件监控`;

convertMarkdownToDocx(md).then(async (blob) => {
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync("test-app.docx", buffer);
  console.log("Done");
});
