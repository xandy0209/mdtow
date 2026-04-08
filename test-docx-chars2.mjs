import { Document, Packer, Paragraph, TextRun } from "docx";
import fs from "fs";

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({
          children: [new TextRun("Hello World 1")],
          indent: {
            left: 0,
            firstLine: 480,
            firstLineChars: 200,
          },
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("test-chars2.docx", buffer);
  console.log("Done");
});
