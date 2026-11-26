// 소스(app/app.src.html)에 Paperlogy 폰트(font/woff2)를 넣어 두 파일을 만든다.
//  - app/index.html : Claude 아티팩트용 (조각 형태, 폰트 내장)
//  - docs/index.html: GitHub Pages용 (완전한 HTML 문서, 폰트 내장)
// 사용법: node app/build-pages.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(__dirname, "app.src.html"), "utf8");

const weights = [
  ["400", "Paperlogy-4Regular.woff2"],
  ["500", "Paperlogy-5Medium.woff2"],
  ["700", "Paperlogy-7Bold.woff2"],
  ["800", "Paperlogy-8ExtraBold.woff2"],
];
const fontCss = weights
  .map(([w, file]) => {
    const b64 = fs.readFileSync(path.join(root, "font", "woff2", file)).toString("base64");
    return `@font-face{font-family:"Paperlogy";font-weight:${w};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
  })
  .join("\n");

const artifact = src.replace("/*FONTS*/", fontCss);
fs.writeFileSync(path.join(__dirname, "index.html"), artifact);

const titleMatch = artifact.match(/<title>[\s\S]*?<\/title>/);
const title = titleMatch ? titleMatch[0] : "<title>후쿠오카 가족여행</title>";
const body = artifact.replace(title, "");
const page =
  '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  title + "\n" +
  "<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px)}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>\n" +
  "</head>\n<body>\n" + body + "\n</body>\n</html>\n";
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "index.html"), page);

console.log("wrote app/index.html (" + Math.round(artifact.length / 1024) + " KB), docs/index.html (" + Math.round(page.length / 1024) + " KB)");
