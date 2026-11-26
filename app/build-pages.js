// app/index.html (Claude 아티팩트용 조각)을 GitHub Pages용 완전한 HTML 문서 docs/index.html로 변환한다.
// 사용법: node app/build-pages.js
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const titleMatch = src.match(/<title>[\s\S]*?<\/title>/);
const title = titleMatch ? titleMatch[0] : "<title>후쿠오카 가족여행</title>";
const body = src.replace(titleMatch ? titleMatch[0] : "", "");

const out =
  '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  title + "\n" +
  "<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px)}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>\n" +
  "</head>\n<body>\n" + body + "\n</body>\n</html>\n";

const dir = path.join(__dirname, "..", "docs");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "index.html"), out);
console.log("wrote docs/index.html (" + out.length + " bytes)");
