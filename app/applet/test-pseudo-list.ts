import { convertMarkdownToDocx } from "./lib/markdown-to-docx";
import * as fs from "fs";

async function test() {
  const md = `## 4.1 视图关系
1. 菜单路径：故障事件管理
   (1) 故障监控
   ■ 故障事件监控
   (2) 配置管理
   ■ 故障识别规则
   ■ 故障短信发送配置`;

  const blob = await convertMarkdownToDocx(md);
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync("test-output.docx", buffer);
  console.log("Generated test-output.docx");
}

test();
